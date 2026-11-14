-- Notice Board (PRD §5.8 NTC-1..3, post-MVP P11): admins and committee members publish
-- notices to all residents, chosen blocks or owners; guards never see notices.
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  pinned boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'published',
  edited_at timestamptz,
  withdrawn_at timestamptz,
  withdrawn_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  attachment_path text,
  attachment_content_type text,
  attachment_size_bytes integer,
  client_request_id uuid NOT NULL,
  CONSTRAINT notices_title_check
    CHECK (char_length(title) BETWEEN 1 AND 120 AND title = btrim(title)),
  CONSTRAINT notices_body_check
    CHECK (char_length(body) BETWEEN 1 AND 5000 AND body = btrim(body)),
  CONSTRAINT notices_audience_check
    CHECK (audience IN ('all', 'blocks', 'owners')),
  CONSTRAINT notices_status_check
    CHECK (status IN ('published', 'withdrawn')),
  CONSTRAINT notices_withdrawn_check
    CHECK (
      (status = 'withdrawn') = (withdrawn_at IS NOT NULL)
      AND (withdrawn_at IS NULL) = (withdrawn_by IS NULL)
    ),
  CONSTRAINT notices_expiry_check
    CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT notices_attachment_check
    CHECK (
      (
        attachment_path IS NULL
        AND attachment_content_type IS NULL
        AND attachment_size_bytes IS NULL
      )
      OR (
        attachment_path IS NOT NULL
        AND char_length(attachment_path) <= 500
        AND attachment_content_type IN (
          'image/jpeg', 'image/png', 'application/pdf'
        )
        AND attachment_size_bytes BETWEEN 1 AND 5242880
      )
    ),
  CONSTRAINT notices_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT notices_client_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE INDEX notices_society_feed_idx
  ON public.notices (society_id, status, pinned DESC, created_at DESC);
CREATE INDEX notices_created_by_idx ON public.notices (created_by);
CREATE INDEX notices_updated_by_idx ON public.notices (updated_by);
CREATE INDEX notices_withdrawn_by_idx
  ON public.notices (withdrawn_by) WHERE withdrawn_by IS NOT NULL;
CREATE UNIQUE INDEX notices_attachment_path_key
  ON public.notices (attachment_path) WHERE attachment_path IS NOT NULL;

CREATE TRIGGER notices_set_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.notice_blocks (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  notice_id uuid NOT NULL,
  block_id uuid NOT NULL,
  CONSTRAINT notice_blocks_pkey PRIMARY KEY (society_id, notice_id, block_id),
  CONSTRAINT notice_blocks_notice_same_society_fkey
    FOREIGN KEY (society_id, notice_id)
    REFERENCES public.notices (society_id, id) ON DELETE CASCADE,
  CONSTRAINT notice_blocks_block_same_society_fkey
    FOREIGN KEY (society_id, block_id)
    REFERENCES public.blocks (society_id, id) ON DELETE RESTRICT
);

CREATE INDEX notice_blocks_block_idx
  ON public.notice_blocks (society_id, block_id);

CREATE TABLE public.notice_reads (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  notice_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notice_reads_pkey PRIMARY KEY (society_id, notice_id, user_id),
  CONSTRAINT notice_reads_notice_same_society_fkey
    FOREIGN KEY (society_id, notice_id)
    REFERENCES public.notices (society_id, id) ON DELETE CASCADE
);

CREATE INDEX notice_reads_user_idx ON public.notice_reads (user_id);

-- Audience membership for any user; internal only so callers cannot probe other users.
CREATE OR REPLACE FUNCTION private.notice_audience_includes(
  p_society_id uuid,
  p_notice_id uuid,
  p_audience text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_audience
    WHEN 'all' THEN true
    WHEN 'owners' THEN EXISTS (
      SELECT 1
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      JOIN public.units AS unit
        ON unit.society_id = occupant.society_id
        AND unit.id = occupant.unit_id
      WHERE occupant.society_id = p_society_id
        AND occupant.status = 'active'
        AND occupant.relationship = 'owner'
        AND membership.user_id = p_user_id
        AND membership.status = 'active'
        AND unit.active
    )
    WHEN 'blocks' THEN EXISTS (
      SELECT 1
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      JOIN public.units AS unit
        ON unit.society_id = occupant.society_id
        AND unit.id = occupant.unit_id
      JOIN public.notice_blocks AS target
        ON target.society_id = unit.society_id
        AND target.block_id = unit.block_id
      WHERE occupant.society_id = p_society_id
        AND target.notice_id = p_notice_id
        AND occupant.status = 'active'
        AND membership.user_id = p_user_id
        AND membership.status = 'active'
        AND unit.active
    )
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION private.notice_audience_includes(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Managers see every notice (including the archive); residents see live notices for their audience.
CREATE OR REPLACE FUNCTION private.notice_visible(
  p_society_id uuid,
  p_notice_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notices AS notice
    WHERE notice.society_id = p_society_id
      AND notice.id = p_notice_id
      AND private.module_enabled(p_society_id, 'notice')
      AND (
        private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
        OR (
          notice.status = 'published'
          AND (notice.expires_at IS NULL OR notice.expires_at > now())
          AND private.has_role(p_society_id, ARRAY['resident']::text[])
          AND private.notice_audience_includes(
            p_society_id, notice.id, notice.audience, (SELECT auth.uid())
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION private.notice_visible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.notice_visible(uuid, uuid)
  TO authenticated, service_role;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notices
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.notice_blocks
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.notice_reads
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.notices TO authenticated;
GRANT SELECT ON TABLE public.notice_blocks TO authenticated;
GRANT SELECT ON TABLE public.notice_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notice_blocks
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notice_reads
  TO service_role;

CREATE POLICY notices_read_visible
  ON public.notices FOR SELECT TO authenticated
  USING (private.notice_visible(society_id, id));

CREATE POLICY notice_blocks_read_managers
  ON public.notice_blocks FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'notice')
    AND private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );

-- Readers are not exposed; managers see only the aggregate count through the RPCs.
CREATE POLICY notice_reads_read_own
  ON public.notice_reads FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND private.module_enabled(society_id, 'notice')
  );

CREATE OR REPLACE FUNCTION private.notice_json(p_notice public.notices)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    pg_catalog.to_jsonb(p_notice)
      - 'client_request_id' - 'updated_by' - 'withdrawn_by'
  ) || pg_catalog.jsonb_build_object(
    'author_name', (
      SELECT profile.full_name FROM public.profiles AS profile
      WHERE profile.id = p_notice.created_by
    ),
    'blocks', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', block.id, 'name', block.name)
        ORDER BY block.name
      )
      FROM public.notice_blocks AS target
      JOIN public.blocks AS block
        ON block.society_id = target.society_id AND block.id = target.block_id
      WHERE target.society_id = p_notice.society_id
        AND target.notice_id = p_notice.id
    ), '[]'::jsonb),
    'is_expired', COALESCE(p_notice.expires_at <= now(), false),
    'has_read', EXISTS (
      SELECT 1 FROM public.notice_reads AS reading
      WHERE reading.society_id = p_notice.society_id
        AND reading.notice_id = p_notice.id
        AND reading.user_id = (SELECT auth.uid())
    ),
    'read_count', CASE
      WHEN private.has_role(
        p_notice.society_id, ARRAY['admin', 'committee']::text[]
      ) THEN (
        SELECT count(*)::integer FROM public.notice_reads AS reading
        WHERE reading.society_id = p_notice.society_id
          AND reading.notice_id = p_notice.id
      )
    END,
    'can_manage',
      private.has_role(p_notice.society_id, ARRAY['admin']::text[])
      OR (
        private.has_role(p_notice.society_id, ARRAY['committee']::text[])
        AND p_notice.created_by = (SELECT auth.uid())
      )
  )
$$;

REVOKE ALL ON FUNCTION private.notice_json(public.notices)
  FROM PUBLIC, anon, authenticated, service_role;

-- Validates all editable fields; raises 22023 for any invalid value.
CREATE OR REPLACE FUNCTION private.notice_validate(
  p_society_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_block_ids uuid[],
  p_attachment jsonb
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  distinct_block_count integer;
  path_pattern text;
BEGIN
  IF p_title IS NULL
    OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120
    OR p_body IS NULL
    OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 5000
    OR p_audience IS NULL
    OR p_audience NOT IN ('all', 'blocks', 'owners')
    OR pg_catalog.array_position(p_block_ids, NULL) IS NOT NULL
  THEN
    RAISE EXCEPTION 'The notice details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT block_id)::integer INTO distinct_block_count
  FROM pg_catalog.unnest(COALESCE(p_block_ids, ARRAY[]::uuid[])) AS block_id;
  IF p_audience = 'blocks' THEN
    IF distinct_block_count NOT BETWEEN 1 AND 50
      OR distinct_block_count <> (
        SELECT count(*)::integer FROM public.blocks AS block
        WHERE block.society_id = p_society_id
          AND block.id = ANY (p_block_ids)
          AND block.active
      )
    THEN
      RAISE EXCEPTION 'Choose one or more active blocks for this notice.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF distinct_block_count > 0 THEN
    RAISE EXCEPTION 'Blocks can be chosen only for a block audience.'
      USING ERRCODE = '22023';
  END IF;

  IF p_attachment IS NOT NULL THEN
    path_pattern := '^' || p_society_id::text
      || '/notices/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
      || '\.(jpg|png|pdf)$';
    IF pg_catalog.jsonb_typeof(p_attachment) <> 'object'
      OR (p_attachment->>'path') IS NULL
      OR (p_attachment->>'path') !~ path_pattern
      OR NOT (
        (p_attachment->>'content_type' = 'image/jpeg'
          AND (p_attachment->>'path') LIKE '%.jpg')
        OR (p_attachment->>'content_type' = 'image/png'
          AND (p_attachment->>'path') LIKE '%.png')
        OR (p_attachment->>'content_type' = 'application/pdf'
          AND (p_attachment->>'path') LIKE '%.pdf')
      )
      OR NOT COALESCE(p_attachment->>'size_bytes', '') ~ '^[1-9][0-9]{0,6}$'
      OR (p_attachment->>'size_bytes')::integer > 5242880
    THEN
      RAISE EXCEPTION 'The notice attachment is invalid.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.notice_validate(
  uuid, text, text, text, uuid[], jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- Loads a notice for a write and checks the caller may manage it (admins: all; committee: own).
CREATE OR REPLACE FUNCTION private.notice_for_update(
  p_society_id uuid,
  p_notice_id uuid
)
RETURNS public.notices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  notice_row public.notices;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'notice')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Notice changes are not allowed.'
      USING ERRCODE = '42501';
  END IF;
  SELECT notice.* INTO notice_row
  FROM public.notices AS notice
  WHERE notice.society_id = p_society_id AND notice.id = p_notice_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The notice was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND notice_row.created_by <> current_user_id
  THEN
    RAISE EXCEPTION 'Only the author or an admin can change this notice.'
      USING ERRCODE = '42501';
  END IF;
  RETURN notice_row;
END;
$$;

REVOKE ALL ON FUNCTION private.notice_for_update(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.notice_actor_role(p_society_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    ELSE 'committee'
  END
$$;

REVOKE ALL ON FUNCTION private.notice_actor_role(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notice_create(
  p_society_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_block_ids uuid[],
  p_pinned boolean,
  p_expires_at timestamptz,
  p_attachment jsonb,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_row public.notices;
  new_row public.notices;
  recipient record;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'notice')
  THEN
    RAISE EXCEPTION 'Notice publishing is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.' USING ERRCODE = '42501';
  END IF;
  IF p_client_request_id IS NULL OR p_pinned IS NULL THEN
    RAISE EXCEPTION 'The notice details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT notice.* INTO existing_row
  FROM public.notices AS notice
  WHERE notice.society_id = p_society_id
    AND notice.created_by = current_user_id
    AND notice.client_request_id = p_client_request_id;
  IF FOUND THEN RETURN private.notice_json(existing_row); END IF;

  PERFORM private.notice_validate(
    p_society_id, p_title, p_body, p_audience, p_block_ids, p_attachment
  );
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'The notice expiry must be in the future.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notices (
    society_id, created_by, updated_by, title, body, audience, pinned,
    expires_at, attachment_path, attachment_content_type,
    attachment_size_bytes, client_request_id
  )
  VALUES (
    p_society_id, current_user_id, current_user_id, btrim(p_title),
    btrim(p_body), p_audience, p_pinned, p_expires_at,
    p_attachment->>'path', p_attachment->>'content_type',
    (p_attachment->>'size_bytes')::integer, p_client_request_id
  )
  RETURNING * INTO new_row;

  INSERT INTO public.notice_blocks (society_id, notice_id, block_id)
  SELECT DISTINCT p_society_id, new_row.id, block_id
  FROM pg_catalog.unnest(COALESCE(p_block_ids, ARRAY[]::uuid[])) AS block_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, private.notice_actor_role(p_society_id),
    'notice.publish', 'notice', new_row.id::text,
    pg_catalog.jsonb_build_object(
      'audience', new_row.audience, 'pinned', new_row.pinned
    ),
    p_request_trace
  );

  FOR recipient IN
    SELECT membership.user_id
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND membership.user_id IS NOT NULL
      AND membership.user_id <> current_user_id
      AND membership.roles @> ARRAY['resident']::text[]
      AND private.notice_audience_includes(
        p_society_id, new_row.id, new_row.audience, membership.user_id
      )
  LOOP
    PERFORM private.create_notification(
      p_society_id,
      recipient.user_id,
      'notice_published',
      CASE WHEN new_row.pinned THEN 'Important notice' ELSE 'New notice' END,
      pg_catalog.left(new_row.title, 300),
      'notice',
      new_row.id,
      p_request_trace
    );
  END LOOP;

  RETURN private.notice_json(new_row);
END;
$$;

-- Edits keep the original publish time, mark the notice as edited and send no new push.
CREATE OR REPLACE FUNCTION public.notice_update(
  p_society_id uuid,
  p_notice_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_block_ids uuid[],
  p_expires_at timestamptz,
  p_attachment jsonb,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  notice_row public.notices;
  attachment jsonb := p_attachment;
BEGIN
  notice_row := private.notice_for_update(p_society_id, p_notice_id);
  IF notice_row.status = 'withdrawn' THEN
    RAISE EXCEPTION 'A withdrawn notice cannot be edited.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF p_expected_updated_at IS NULL
    OR notice_row.updated_at <> p_expected_updated_at
  THEN
    RAISE EXCEPTION 'The notice changed in another session.'
      USING ERRCODE = '23505', HINT = 'stale_record';
  END IF;

  -- Keeping the current file reuses its stored metadata.
  IF attachment IS NOT NULL
    AND attachment->>'path' = notice_row.attachment_path
  THEN
    attachment := pg_catalog.jsonb_build_object(
      'path', notice_row.attachment_path,
      'content_type', notice_row.attachment_content_type,
      'size_bytes', notice_row.attachment_size_bytes::text
    );
  END IF;
  PERFORM private.notice_validate(
    p_society_id, p_title, p_body, p_audience, p_block_ids, attachment
  );
  IF p_expires_at IS NOT NULL
    AND p_expires_at IS DISTINCT FROM notice_row.expires_at
    AND p_expires_at <= now()
  THEN
    RAISE EXCEPTION 'The notice expiry must be in the future.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.notices
  SET title = btrim(p_title),
      body = btrim(p_body),
      audience = p_audience,
      expires_at = p_expires_at,
      attachment_path = attachment->>'path',
      attachment_content_type = attachment->>'content_type',
      attachment_size_bytes = (attachment->>'size_bytes')::integer,
      edited_at = now()
  WHERE society_id = p_society_id AND id = p_notice_id
  RETURNING * INTO notice_row;

  DELETE FROM public.notice_blocks
  WHERE society_id = p_society_id AND notice_id = p_notice_id;
  INSERT INTO public.notice_blocks (society_id, notice_id, block_id)
  SELECT DISTINCT p_society_id, p_notice_id, block_id
  FROM pg_catalog.unnest(COALESCE(p_block_ids, ARRAY[]::uuid[])) AS block_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, private.notice_actor_role(p_society_id),
    'notice.update', 'notice', p_notice_id::text,
    pg_catalog.jsonb_build_object('audience', notice_row.audience),
    p_request_trace
  );
  RETURN private.notice_json(notice_row);
END;
$$;

-- Set semantics make retries safe: the same desired state is a no-op.
CREATE OR REPLACE FUNCTION public.notice_set_pinned(
  p_society_id uuid,
  p_notice_id uuid,
  p_pinned boolean,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notice_row public.notices;
BEGIN
  notice_row := private.notice_for_update(p_society_id, p_notice_id);
  IF p_pinned IS NULL THEN
    RAISE EXCEPTION 'Choose whether to pin the notice.'
      USING ERRCODE = '22023';
  END IF;
  IF notice_row.status = 'withdrawn' THEN
    RAISE EXCEPTION 'A withdrawn notice cannot be pinned.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF notice_row.pinned = p_pinned THEN
    RETURN private.notice_json(notice_row);
  END IF;

  UPDATE public.notices SET pinned = p_pinned
  WHERE society_id = p_society_id AND id = p_notice_id
  RETURNING * INTO notice_row;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, auth.uid(), private.notice_actor_role(p_society_id),
    CASE WHEN p_pinned THEN 'notice.pin' ELSE 'notice.unpin' END,
    'notice', p_notice_id::text, p_request_trace
  );
  RETURN private.notice_json(notice_row);
END;
$$;

-- Withdrawn notices move to the archive and their unread in-app alerts are removed.
CREATE OR REPLACE FUNCTION public.notice_withdraw(
  p_society_id uuid,
  p_notice_id uuid,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  notice_row public.notices;
BEGIN
  notice_row := private.notice_for_update(p_society_id, p_notice_id);
  IF notice_row.status = 'withdrawn' THEN
    RETURN private.notice_json(notice_row);
  END IF;

  UPDATE public.notices
  SET status = 'withdrawn',
      withdrawn_at = now(),
      withdrawn_by = current_user_id
  WHERE society_id = p_society_id AND id = p_notice_id
  RETURNING * INTO notice_row;

  DELETE FROM public.notifications
  WHERE society_id = p_society_id
    AND entity_type = 'notice'
    AND entity_id = p_notice_id
    AND read_at IS NULL;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, current_user_id, private.notice_actor_role(p_society_id),
    'notice.withdraw', 'notice', p_notice_id::text, p_request_trace
  );
  RETURN private.notice_json(notice_row);
END;
$$;

-- Current notices list pinned first; the archive (withdrawn or expired) is for managers only.
CREATE OR REPLACE FUNCTION public.notice_list(
  p_society_id uuid,
  p_view text DEFAULT 'current',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_manager boolean;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'notice')
  THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  IF p_view IS NULL OR p_view NOT IN ('current', 'archive')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset < 0
  THEN
    RAISE EXCEPTION 'The notice filters are invalid.'
      USING ERRCODE = '22023';
  END IF;
  is_manager := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  IF p_view = 'archive' AND NOT is_manager THEN
    RAISE EXCEPTION 'The notice archive is not available.'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      private.notice_json(page)
      ORDER BY
        CASE WHEN p_view = 'current' THEN page.pinned END DESC NULLS LAST,
        page.created_at DESC,
        page.id
    )
    FROM (
      SELECT notice.*
      FROM public.notices AS notice
      WHERE notice.society_id = p_society_id
        AND CASE
          WHEN p_view = 'archive' THEN
            notice.status = 'withdrawn'
            OR (notice.expires_at IS NOT NULL AND notice.expires_at <= now())
          ELSE
            notice.status = 'published'
            AND (notice.expires_at IS NULL OR notice.expires_at > now())
            AND (
              is_manager
              OR private.notice_audience_includes(
                p_society_id, notice.id, notice.audience, current_user_id
              )
            )
        END
      ORDER BY
        CASE WHEN p_view = 'current' THEN notice.pinned END DESC NULLS LAST,
        notice.created_at DESC,
        notice.id
      LIMIT p_limit OFFSET p_offset
    ) AS page
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.notice_get(
  p_society_id uuid,
  p_notice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notice_row public.notices;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'notice')
  THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.notice_visible(p_society_id, p_notice_id) THEN
    RAISE EXCEPTION 'The notice was not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT notice.* INTO notice_row
  FROM public.notices AS notice
  WHERE notice.society_id = p_society_id AND notice.id = p_notice_id;

  result := private.notice_json(notice_row);
  IF private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]) THEN
    result := result || pg_catalog.jsonb_build_object(
      'audience_count', (
        SELECT count(*)::integer
        FROM public.memberships AS membership
        WHERE membership.society_id = p_society_id
          AND membership.status = 'active'
          AND membership.user_id IS NOT NULL
          AND membership.roles @> ARRAY['resident']::text[]
          AND private.notice_audience_includes(
            p_society_id, notice_row.id, notice_row.audience,
            membership.user_id
          )
      )
    );
  END IF;
  RETURN result;
END;
$$;

-- Records a read receipt for a visible notice and clears its in-app alert.
CREATE OR REPLACE FUNCTION public.notice_mark_read(
  p_society_id uuid,
  p_notice_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'notice')
  THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.notice_visible(p_society_id, p_notice_id) THEN
    RAISE EXCEPTION 'The notice was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RETURN;
  END IF;
  -- Only resident audience members count as readers; other managers just clear alerts.
  INSERT INTO public.notice_reads (society_id, notice_id, user_id)
  SELECT p_society_id, p_notice_id, current_user_id
  FROM public.notices AS notice
  WHERE notice.society_id = p_society_id
    AND notice.id = p_notice_id
    AND private.has_role(p_society_id, ARRAY['resident']::text[])
    AND private.notice_audience_includes(
      p_society_id, notice.id, notice.audience, current_user_id
    )
  ON CONFLICT ON CONSTRAINT notice_reads_pkey DO NOTHING;
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = current_user_id
    AND society_id = p_society_id
    AND entity_type = 'notice'
    AND entity_id = p_notice_id
    AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notice_create(
  uuid, text, text, text, uuid[], boolean, timestamptz, jsonb, uuid, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_update(
  uuid, uuid, text, text, text, uuid[], timestamptz, jsonb, timestamptz, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_set_pinned(uuid, uuid, boolean, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_withdraw(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_list(uuid, text, integer, integer)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_get(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_mark_read(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.notice_create(
  uuid, text, text, text, uuid[], boolean, timestamptz, jsonb, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_update(
  uuid, uuid, text, text, text, uuid[], timestamptz, jsonb, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_set_pinned(uuid, uuid, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_withdraw(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_list(uuid, text, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_get(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_mark_read(uuid, uuid)
  TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notice-files', 'notice-files', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
);

-- Managers can read every notice file in their society (needed to verify uploads);
-- residents only read the file attached to a notice they can see.
DROP POLICY homeish_files_read ON storage.objects;
CREATE POLICY homeish_files_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    CASE bucket_id
      WHEN 'visitor-photos' THEN
        private.module_enabled(private.file_society_id(name), 'visitor')
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
      WHEN 'delivery-photos' THEN
        private.module_enabled(private.file_society_id(name), 'delivery')
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
        AND name ~* (
          '^' || private.file_society_id(name)::text ||
          '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}/deliveries/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        )
        AND EXISTS (
          SELECT 1 FROM public.units unit
          WHERE unit.society_id = private.file_society_id(name)
            AND lower(unit.id::text) = lower(split_part(name, '/', 2))
            AND unit.active
        )
      WHEN 'request-files' THEN
        private.module_enabled(private.file_society_id(name), 'service_request')
        AND EXISTS (
          SELECT 1 FROM public.service_request_attachments AS attachment
          WHERE attachment.storage_path = name
        )
      WHEN 'notice-files' THEN
        private.module_enabled(private.file_society_id(name), 'notice')
        AND (
          private.has_role(
            private.file_society_id(name),
            ARRAY['admin', 'committee']::text[]
          )
          OR EXISTS (
            SELECT 1 FROM public.notices AS notice
            WHERE notice.attachment_path = name
              AND notice.society_id = private.file_society_id(name)
              AND private.notice_visible(notice.society_id, notice.id)
          )
        )
      WHEN 'payment-proofs' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'society-assets' THEN
        private.is_member(private.file_society_id(name))
        OR private.is_developer()
      ELSE false
    END
  );

DROP POLICY homeish_files_insert ON storage.objects;
CREATE POLICY homeish_files_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    CASE bucket_id
      WHEN 'visitor-photos' THEN
        private.module_enabled(private.file_society_id(name), 'visitor')
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
      WHEN 'delivery-photos' THEN
        private.module_enabled(private.file_society_id(name), 'delivery')
        AND private.society_writable(private.file_society_id(name))
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
        AND name ~* (
          '^' || private.file_society_id(name)::text ||
          '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}/deliveries/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        )
        AND EXISTS (
          SELECT 1 FROM public.units unit
          WHERE unit.society_id = private.file_society_id(name)
            AND lower(unit.id::text) = lower(split_part(name, '/', 2))
            AND unit.active
        )
      WHEN 'request-files' THEN
        private.module_enabled(private.file_society_id(name), 'service_request')
        AND private.society_writable(private.file_society_id(name))
        AND private.has_role(
          private.file_society_id(name), ARRAY['admin', 'resident']::text[]
        )
        AND private.is_service_request_file_owner(name)
      WHEN 'notice-files' THEN
        private.module_enabled(private.file_society_id(name), 'notice')
        AND private.society_writable(private.file_society_id(name))
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
        AND name ~ (
          '^' || private.file_society_id(name)::text ||
          '/notices/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
        )
      WHEN 'payment-proofs' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'society-assets' THEN
        private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
        OR private.is_developer()
      ELSE false
    END
  );

-- Managers remove replaced or removed attachments once no notice references them.
CREATE POLICY notice_files_manager_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'notice-files'
    AND private.module_enabled(private.file_society_id(name), 'notice')
    AND private.has_role(
      private.file_society_id(name),
      ARRAY['admin', 'committee']::text[]
    )
    AND name ~ (
      '^' || private.file_society_id(name)::text ||
      '/notices/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}/' ||
      '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notices AS notice
      WHERE notice.attachment_path = name
    )
  );
