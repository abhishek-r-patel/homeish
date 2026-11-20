-- P53 communication additions: notice drafts, scheduling and planning fields (P53.1), the
-- restricted member contact log (P53.2) and the derived communication dashboard (P53.3).

-- P53.1 notice lifecycle -------------------------------------------------------
-- Planning status maps onto the P11 lifecycle: draft and scheduled are new unpublished states;
-- posted = published and not expired; removed = withdrawn or expired. Existing notices are posted.
ALTER TABLE public.notices ADD COLUMN scheduled_for date;
ALTER TABLE public.notices ADD COLUMN published_at timestamptz;
UPDATE public.notices SET published_at = created_at WHERE published_at IS NULL;
-- The default keeps P11 notice_create unchanged: it publishes immediately.
ALTER TABLE public.notices ALTER COLUMN published_at SET DEFAULT now();

ALTER TABLE public.notices DROP CONSTRAINT notices_status_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_status_check
  CHECK (status IN ('draft', 'scheduled', 'published', 'withdrawn'));
ALTER TABLE public.notices ADD CONSTRAINT notices_schedule_check
  CHECK (
    (status <> 'scheduled' OR scheduled_for IS NOT NULL)
    AND (status <> 'draft' OR scheduled_for IS NULL)
  );
ALTER TABLE public.notices ADD CONSTRAINT notices_published_at_check
  CHECK (
    (status <> 'published' OR published_at IS NOT NULL)
    AND (status NOT IN ('draft', 'scheduled') OR published_at IS NULL)
  );

CREATE INDEX notices_scheduled_due_idx
  ON public.notices (society_id, scheduled_for) WHERE status = 'scheduled';

-- Planning fields are manager-only, so they live outside `notices`, which residents can select.
CREATE TABLE public.notice_plans (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  notice_id uuid NOT NULL,
  prepared_by text,
  display_location text,
  priority text,
  next_action text,
  next_action_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT notice_plans_pkey PRIMARY KEY (society_id, notice_id),
  CONSTRAINT notice_plans_notice_same_society_fkey
    FOREIGN KEY (society_id, notice_id)
    REFERENCES public.notices (society_id, id) ON DELETE CASCADE,
  CONSTRAINT notice_plans_prepared_by_check CHECK (
    prepared_by IS NULL
    OR (prepared_by = btrim(prepared_by) AND char_length(prepared_by) BETWEEN 1 AND 80)
  ),
  CONSTRAINT notice_plans_display_location_check CHECK (
    display_location IS NULL
    OR (display_location = btrim(display_location)
      AND char_length(display_location) BETWEEN 1 AND 120)
  ),
  CONSTRAINT notice_plans_priority_check
    CHECK (priority IS NULL OR priority IN ('high', 'medium', 'low')),
  CONSTRAINT notice_plans_next_action_check CHECK (
    next_action IS NULL
    OR (next_action = btrim(next_action) AND char_length(next_action) BETWEEN 1 AND 200)
  )
);

CREATE INDEX notice_plans_updated_by_idx ON public.notice_plans (updated_by);
CREATE TRIGGER notice_plans_set_updated_at
  BEFORE UPDATE ON public.notice_plans
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.notice_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notice_plans FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY notice_plans_no_direct_access ON public.notice_plans
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

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
    'planning_status', CASE
      WHEN p_notice.status IN ('draft', 'scheduled') THEN p_notice.status
      WHEN p_notice.status = 'withdrawn' OR p_notice.expires_at <= now() THEN 'removed'
      ELSE 'posted'
    END,
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
    'plan', CASE
      WHEN private.has_role(
        p_notice.society_id, ARRAY['admin', 'committee']::text[]
      ) THEN (
        SELECT pg_catalog.jsonb_build_object(
          'prepared_by', plan.prepared_by,
          'display_location', plan.display_location,
          'priority', plan.priority,
          'next_action', plan.next_action,
          'next_action_on', plan.next_action_on
        )
        FROM public.notice_plans AS plan
        WHERE plan.society_id = p_notice.society_id
          AND plan.notice_id = p_notice.id
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

-- India calendar day used for schedules and dashboards.
CREATE FUNCTION private.communication_today()
RETURNS date LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date
$$;
REVOKE ALL ON FUNCTION private.communication_today()
  FROM PUBLIC, anon, authenticated, service_role;

-- A posting day is after today; expiry falls after the posting day starts (or after now for drafts).
CREATE FUNCTION private.notice_schedule_validate(
  p_scheduled_for date,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_scheduled_for IS NOT NULL
    AND p_scheduled_for <= private.communication_today()
  THEN
    RAISE EXCEPTION 'Choose a posting day after today.' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND (
    p_expires_at <= now()
    OR (
      p_scheduled_for IS NOT NULL
      AND p_expires_at <= (p_scheduled_for::timestamp AT TIME ZONE 'Asia/Kolkata')
    )
  ) THEN
    RAISE EXCEPTION 'The notice expiry must be after it is posted.'
      USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.notice_schedule_validate(date, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

-- Shared publish side effects for publish-now and the daily scheduled run (same push as P11).
CREATE FUNCTION private.notice_publish_effects(
  p_notice public.notices,
  p_scheduled boolean,
  p_request_trace text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  recipient record;
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_notice.society_id, current_user_id,
    CASE WHEN current_user_id IS NULL THEN 'system'
      ELSE private.notice_actor_role(p_notice.society_id) END,
    'notice.publish', 'notice', p_notice.id::text,
    pg_catalog.jsonb_build_object(
      'audience', p_notice.audience, 'pinned', p_notice.pinned,
      'scheduled', p_scheduled
    ),
    p_request_trace
  );

  FOR recipient IN
    SELECT membership.user_id
    FROM public.memberships AS membership
    WHERE membership.society_id = p_notice.society_id
      AND membership.status = 'active'
      AND membership.user_id IS NOT NULL
      AND membership.user_id <> p_notice.created_by
      AND membership.user_id IS DISTINCT FROM current_user_id
      AND membership.roles @> ARRAY['resident']::text[]
      AND private.notice_audience_includes(
        p_notice.society_id, p_notice.id, p_notice.audience, membership.user_id
      )
  LOOP
    PERFORM private.create_notification(
      p_notice.society_id,
      recipient.user_id,
      'notice_published',
      CASE WHEN p_notice.pinned THEN 'Important notice' ELSE 'New notice' END,
      pg_catalog.left(p_notice.title, 300),
      'notice',
      p_notice.id,
      p_request_trace
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.notice_publish_effects(public.notices, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- P11 edits now apply to published notices only; drafts are edited through notice_draft_save.
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
  IF notice_row.status <> 'published' THEN
    RAISE EXCEPTION 'Only a posted notice can be edited here.'
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

-- Creates (p_notice_id NULL) or edits a draft or scheduled notice. A posting day makes it scheduled.
CREATE FUNCTION public.notice_draft_save(
  p_society_id uuid,
  p_notice_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_block_ids uuid[],
  p_pinned boolean,
  p_expires_at timestamptz,
  p_attachment jsonb,
  p_scheduled_for date,
  p_expected_updated_at timestamptz,
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
  notice_row public.notices;
  attachment jsonb := p_attachment;
  next_status text := CASE WHEN p_scheduled_for IS NULL THEN 'draft' ELSE 'scheduled' END;
BEGIN
  IF p_notice_id IS NULL THEN
    IF current_user_id IS NULL
      OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR NOT private.module_enabled(p_society_id, 'notice')
      OR NOT private.society_writable(p_society_id)
    THEN
      RAISE EXCEPTION 'Notice changes are not allowed.' USING ERRCODE = '42501';
    END IF;
    IF p_client_request_id IS NULL OR p_pinned IS NULL THEN
      RAISE EXCEPTION 'The notice details are invalid.' USING ERRCODE = '22023';
    END IF;
    SELECT notice.* INTO notice_row
    FROM public.notices AS notice
    WHERE notice.society_id = p_society_id
      AND notice.created_by = current_user_id
      AND notice.client_request_id = p_client_request_id;
    IF FOUND THEN RETURN private.notice_json(notice_row); END IF;

    PERFORM private.notice_validate(
      p_society_id, p_title, p_body, p_audience, p_block_ids, p_attachment
    );
    PERFORM private.notice_schedule_validate(p_scheduled_for, p_expires_at);

    INSERT INTO public.notices (
      society_id, created_by, updated_by, title, body, audience, pinned,
      expires_at, status, scheduled_for, published_at, attachment_path,
      attachment_content_type, attachment_size_bytes, client_request_id
    )
    VALUES (
      p_society_id, current_user_id, current_user_id, btrim(p_title),
      btrim(p_body), p_audience, p_pinned, p_expires_at, next_status,
      p_scheduled_for, NULL, p_attachment->>'path',
      p_attachment->>'content_type', (p_attachment->>'size_bytes')::integer,
      p_client_request_id
    )
    RETURNING * INTO notice_row;
  ELSE
    notice_row := private.notice_for_update(p_society_id, p_notice_id);
    IF notice_row.status NOT IN ('draft', 'scheduled') THEN
      RAISE EXCEPTION 'Only a draft or scheduled notice can be changed here.'
        USING ERRCODE = '23505', HINT = 'invalid_state';
    END IF;
    IF p_expected_updated_at IS NULL
      OR notice_row.updated_at <> p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The notice changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    IF p_pinned IS NULL THEN
      RAISE EXCEPTION 'The notice details are invalid.' USING ERRCODE = '22023';
    END IF;
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
    PERFORM private.notice_schedule_validate(p_scheduled_for, p_expires_at);

    UPDATE public.notices
    SET title = btrim(p_title),
        body = btrim(p_body),
        audience = p_audience,
        pinned = p_pinned,
        expires_at = p_expires_at,
        status = next_status,
        scheduled_for = p_scheduled_for,
        attachment_path = attachment->>'path',
        attachment_content_type = attachment->>'content_type',
        attachment_size_bytes = (attachment->>'size_bytes')::integer
    WHERE society_id = p_society_id AND id = p_notice_id
    RETURNING * INTO notice_row;

    DELETE FROM public.notice_blocks
    WHERE society_id = p_society_id AND notice_id = p_notice_id;
  END IF;

  INSERT INTO public.notice_blocks (society_id, notice_id, block_id)
  SELECT DISTINCT p_society_id, notice_row.id, block_id
  FROM pg_catalog.unnest(COALESCE(p_block_ids, ARRAY[]::uuid[])) AS block_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, private.notice_actor_role(p_society_id),
    CASE WHEN p_notice_id IS NULL THEN 'notice.draft_create' ELSE 'notice.draft_update' END,
    'notice', notice_row.id::text,
    pg_catalog.jsonb_build_object(
      'status', notice_row.status, 'scheduled_for', notice_row.scheduled_for,
      'audience', notice_row.audience
    ),
    p_request_trace
  );
  RETURN private.notice_json(notice_row);
END;
$$;

-- Publishes a draft or scheduled notice now with the normal P11 push.
CREATE FUNCTION public.notice_draft_publish(
  p_society_id uuid,
  p_notice_id uuid,
  p_expected_updated_at timestamptz,
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
  IF notice_row.status = 'published' THEN
    RETURN private.notice_json(notice_row);
  END IF;
  IF notice_row.status <> ALL (ARRAY['draft', 'scheduled']) THEN
    RAISE EXCEPTION 'Only a draft or scheduled notice can be posted.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF p_expected_updated_at IS NULL
    OR notice_row.updated_at <> p_expected_updated_at
  THEN
    RAISE EXCEPTION 'The notice changed in another session.'
      USING ERRCODE = '23505', HINT = 'stale_record';
  END IF;
  IF notice_row.expires_at IS NOT NULL AND notice_row.expires_at <= now() THEN
    RAISE EXCEPTION 'The notice expiry has passed. Change it before posting.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.notices
  SET status = 'published', published_at = now()
  WHERE society_id = p_society_id AND id = p_notice_id
  RETURNING * INTO notice_row;
  PERFORM private.notice_publish_effects(
    notice_row, notice_row.scheduled_for IS NOT NULL, p_request_trace
  );
  RETURN private.notice_json(notice_row);
END;
$$;

-- Daily job (service role): posts notices due today or earlier. An expired one returns to draft.
CREATE FUNCTION public.notice_scheduled_publish_run(
  p_society_id uuid,
  p_today date,
  p_request_trace text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notice_row public.notices;
  published_count integer := 0;
BEGIN
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_today > private.communication_today()
  THEN
    RAISE EXCEPTION 'The scheduled notice run is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'notice')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN 0;
  END IF;

  FOR notice_row IN
    SELECT notice.*
    FROM public.notices AS notice
    WHERE notice.society_id = p_society_id
      AND notice.status = 'scheduled'
      AND notice.scheduled_for <= p_today
    ORDER BY notice.scheduled_for, notice.created_at, notice.id
    FOR UPDATE SKIP LOCKED
  LOOP
    IF notice_row.expires_at IS NOT NULL AND notice_row.expires_at <= now() THEN
      UPDATE public.notices
      SET status = 'draft', scheduled_for = NULL
      WHERE society_id = p_society_id AND id = notice_row.id;
      INSERT INTO public.audit_logs (
        society_id, actor_id, actor_role, action, entity_type, entity_id,
        "after", request_id
      )
      VALUES (
        p_society_id, NULL, 'system', 'notice.schedule_expired', 'notice',
        notice_row.id::text,
        pg_catalog.jsonb_build_object('scheduled_for', notice_row.scheduled_for),
        p_request_trace
      );
    ELSE
      UPDATE public.notices
      SET status = 'published', published_at = now()
      WHERE society_id = p_society_id AND id = notice_row.id
      RETURNING * INTO notice_row;
      PERFORM private.notice_publish_effects(notice_row, true, p_request_trace);
      published_count := published_count + 1;
    END IF;
  END LOOP;
  RETURN published_count;
END;
$$;

-- Saves the manager-only planning fields; allowed on any notice status (set semantics).
CREATE FUNCTION public.notice_plan_save(
  p_society_id uuid,
  p_notice_id uuid,
  p_prepared_by text,
  p_display_location text,
  p_priority text,
  p_next_action text,
  p_next_action_on date,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notice_row public.notices;
  prepared text := NULLIF(btrim(COALESCE(p_prepared_by, '')), '');
  location text := NULLIF(btrim(COALESCE(p_display_location, '')), '');
  action_text text := NULLIF(btrim(COALESCE(p_next_action, '')), '');
BEGIN
  notice_row := private.notice_for_update(p_society_id, p_notice_id);
  IF char_length(prepared) > 80
    OR char_length(location) > 120
    OR char_length(action_text) > 200
    OR (p_priority IS NOT NULL AND p_priority NOT IN ('high', 'medium', 'low'))
    OR (p_next_action_on IS NOT NULL AND action_text IS NULL)
  THEN
    RAISE EXCEPTION 'The planning details are invalid.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notice_plans (
    society_id, notice_id, prepared_by, display_location, priority,
    next_action, next_action_on, updated_by
  )
  VALUES (
    p_society_id, p_notice_id, prepared, location, p_priority, action_text,
    p_next_action_on, auth.uid()
  )
  ON CONFLICT ON CONSTRAINT notice_plans_pkey DO UPDATE
  SET prepared_by = EXCLUDED.prepared_by,
      display_location = EXCLUDED.display_location,
      priority = EXCLUDED.priority,
      next_action = EXCLUDED.next_action,
      next_action_on = EXCLUDED.next_action_on;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), private.notice_actor_role(p_society_id),
    'notice.plan_update', 'notice', p_notice_id::text,
    pg_catalog.jsonb_build_object(
      'priority', p_priority, 'next_action_on', p_next_action_on
    ),
    p_request_trace
  );
  RETURN private.notice_json(notice_row);
END;
$$;

-- Adds the manager-only `planned` view (drafts and scheduled). The archive keeps withdrawn and
-- expired posted notices; current and archive order by the time the notice was posted.
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
  IF p_view IS NULL OR p_view NOT IN ('current', 'archive', 'planned')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset < 0
  THEN
    RAISE EXCEPTION 'The notice filters are invalid.'
      USING ERRCODE = '22023';
  END IF;
  is_manager := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  IF p_view IN ('archive', 'planned') AND NOT is_manager THEN
    RAISE EXCEPTION 'This notice list is not available.'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      private.notice_json(notice)
      ORDER BY page.sort_pinned DESC, page.sort_day ASC NULLS LAST,
        page.sort_time DESC, page.id
    )
    FROM (
      SELECT
        candidate.id,
        CASE WHEN p_view = 'current' THEN candidate.pinned ELSE false END AS sort_pinned,
        CASE WHEN p_view = 'planned' THEN candidate.scheduled_for END AS sort_day,
        CASE WHEN p_view = 'planned' THEN candidate.updated_at
          ELSE COALESCE(candidate.published_at, candidate.created_at) END AS sort_time
      FROM public.notices AS candidate
      WHERE candidate.society_id = p_society_id
        AND CASE
          WHEN p_view = 'planned' THEN
            candidate.status IN ('draft', 'scheduled')
          WHEN p_view = 'archive' THEN
            candidate.status = 'withdrawn'
            OR (
              candidate.status = 'published'
              AND candidate.expires_at IS NOT NULL
              AND candidate.expires_at <= now()
            )
          ELSE
            candidate.status = 'published'
            AND (candidate.expires_at IS NULL OR candidate.expires_at > now())
            AND (
              is_manager
              OR private.notice_audience_includes(
                p_society_id, candidate.id, candidate.audience, current_user_id
              )
            )
        END
      ORDER BY sort_pinned DESC, sort_day ASC NULLS LAST, sort_time DESC, candidate.id
      LIMIT p_limit OFFSET p_offset
    ) AS page
    JOIN public.notices AS notice
      ON notice.society_id = p_society_id AND notice.id = page.id
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.notice_draft_save(
  uuid, uuid, text, text, text, uuid[], boolean, timestamptz, jsonb, date,
  timestamptz, uuid, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_draft_publish(uuid, uuid, timestamptz, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_plan_save(
  uuid, uuid, text, text, text, text, date, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.notice_scheduled_publish_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notice_draft_save(
  uuid, uuid, text, text, text, uuid[], boolean, timestamptz, jsonb, date,
  timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_draft_publish(uuid, uuid, timestamptz, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_plan_save(
  uuid, uuid, text, text, text, text, date, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_scheduled_publish_run(uuid, date, text)
  TO service_role;

-- P53.2 member contact log -----------------------------------------------------
-- Admin/committee record of contacts that are not service requests. A logged contact is not
-- proof of delivery or receipt. Closed entries are deleted three years after closing.
CREATE TABLE public.member_contact_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  contact_on date NOT NULL,
  unit_id uuid,
  contact_type text NOT NULL,
  channel text NOT NULL,
  direction text NOT NULL,
  summary text NOT NULL,
  handled_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  follow_up_on date,
  status text NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  service_request_id uuid,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT member_contact_logs_type_check CHECK (contact_type IN (
    'query', 'complaint', 'request', 'information', 'feedback', 'other'
  )),
  CONSTRAINT member_contact_logs_channel_check CHECK (channel IN (
    'in_person', 'phone', 'email', 'letter', 'whatsapp', 'other'
  )),
  CONSTRAINT member_contact_logs_direction_check
    CHECK (direction IN ('incoming', 'outgoing')),
  CONSTRAINT member_contact_logs_summary_check
    CHECK (summary = btrim(summary) AND char_length(summary) BETWEEN 1 AND 300),
  CONSTRAINT member_contact_logs_status_check
    CHECK (status IN ('open', 'follow_up', 'closed')),
  CONSTRAINT member_contact_logs_follow_up_check CHECK (
    (follow_up_on IS NULL OR follow_up_on >= contact_on)
    AND (status <> 'follow_up' OR follow_up_on IS NOT NULL)
  ),
  CONSTRAINT member_contact_logs_closed_check
    CHECK ((status = 'closed') = (closed_at IS NOT NULL)),
  CONSTRAINT member_contact_logs_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT member_contact_logs_request_same_society_fkey
    FOREIGN KEY (society_id, service_request_id)
    REFERENCES public.service_requests (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT member_contact_logs_client_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE INDEX member_contact_logs_society_list_idx
  ON public.member_contact_logs (society_id, contact_on DESC, created_at DESC);
CREATE INDEX member_contact_logs_unit_idx
  ON public.member_contact_logs (society_id, unit_id)
  WHERE society_id IS NOT NULL AND unit_id IS NOT NULL;
CREATE INDEX member_contact_logs_request_idx
  ON public.member_contact_logs (society_id, service_request_id)
  WHERE society_id IS NOT NULL AND service_request_id IS NOT NULL;
CREATE INDEX member_contact_logs_closed_idx
  ON public.member_contact_logs (closed_at) WHERE status = 'closed';
CREATE INDEX member_contact_logs_handled_by_idx ON public.member_contact_logs (handled_by);
CREATE INDEX member_contact_logs_created_by_idx ON public.member_contact_logs (created_by);
CREATE INDEX member_contact_logs_updated_by_idx ON public.member_contact_logs (updated_by);

CREATE TRIGGER member_contact_logs_set_updated_at
  BEFORE UPDATE ON public.member_contact_logs
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.member_contact_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_contact_logs FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY member_contact_logs_no_direct_access ON public.member_contact_logs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.member_contact_log_json(p_log public.member_contact_logs)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', p_log.id,
    'contact_on', p_log.contact_on,
    'unit_id', p_log.unit_id,
    'unit_label', private.community_unit_label(p_log.society_id, p_log.unit_id),
    'contact_type', p_log.contact_type,
    'channel', p_log.channel,
    'direction', p_log.direction,
    'summary', p_log.summary,
    'handled_by', p_log.handled_by,
    'handled_by_name', private.core_toolkit_person(p_log.handled_by),
    'follow_up_on', p_log.follow_up_on,
    'status', p_log.status,
    'closed_at', p_log.closed_at,
    'service_request_id', p_log.service_request_id,
    'days_open', GREATEST(0, CASE
      WHEN p_log.closed_at IS NOT NULL
        THEN (p_log.closed_at AT TIME ZONE 'Asia/Kolkata')::date - p_log.contact_on
      ELSE private.communication_today() - p_log.contact_on
    END),
    'follow_up_overdue', p_log.status <> 'closed'
      AND p_log.follow_up_on IS NOT NULL
      AND p_log.follow_up_on < private.communication_today(),
    'created_at', p_log.created_at,
    'updated_at', p_log.updated_at
  )
$$;
REVOKE ALL ON FUNCTION private.member_contact_log_json(public.member_contact_logs)
  FROM PUBLIC, anon, authenticated, service_role;

-- Creates (p_log_id NULL, idempotent on p_client_request_id) or edits a contact log entry.
CREATE FUNCTION public.member_contact_log_save(
  p_society_id uuid,
  p_log_id uuid,
  p_values jsonb,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uuid_pattern constant text :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  existing_row public.member_contact_logs;
  saved_row public.member_contact_logs;
  v_contact_on date;
  v_unit_id uuid;
  v_type text;
  v_channel text;
  v_direction text;
  v_summary text;
  v_handled_by uuid;
  v_follow_up_on date;
  v_status text;
  v_request_id uuid;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object' THEN
    RAISE EXCEPTION 'The contact details are invalid.' USING ERRCODE = '22023';
  END IF;

  IF p_log_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'The contact details are invalid.' USING ERRCODE = '22023';
    END IF;
    SELECT log.* INTO existing_row
    FROM public.member_contact_logs AS log
    WHERE log.society_id = p_society_id
      AND log.created_by = auth.uid()
      AND log.client_request_id = p_client_request_id;
    IF FOUND THEN RETURN private.member_contact_log_json(existing_row); END IF;
  ELSE
    SELECT log.* INTO existing_row
    FROM public.member_contact_logs AS log
    WHERE log.society_id = p_society_id AND log.id = p_log_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The contact entry was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_updated_at IS NULL OR existing_row.updated_at <> p_expected_updated_at THEN
      RAISE EXCEPTION 'The contact entry changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
  END IF;

  v_contact_on := private.core_toolkit_json_date(p_values, 'contact_on', 'contact date');
  v_follow_up_on := private.core_toolkit_json_date(p_values, 'follow_up_on', 'follow-up date');
  v_type := private.core_toolkit_json_text(p_values, 'contact_type', 20, 'contact type');
  v_channel := private.core_toolkit_json_text(p_values, 'channel', 20, 'channel');
  v_direction := private.core_toolkit_json_text(p_values, 'direction', 20, 'direction');
  v_status := private.core_toolkit_json_text(p_values, 'status', 20, 'status');
  v_summary := private.core_toolkit_json_text(p_values, 'summary', 300, 'summary');
  v_unit_id := private.core_toolkit_json_text(p_values, 'unit_id', 36, 'unit', uuid_pattern)::uuid;
  v_handled_by := private.core_toolkit_json_text(
    p_values, 'handled_by', 36, 'handled by', uuid_pattern
  )::uuid;
  v_request_id := private.core_toolkit_json_text(
    p_values, 'service_request_id', 36, 'service request', uuid_pattern
  )::uuid;

  IF v_contact_on IS NULL OR v_contact_on > private.communication_today()
    OR v_summary IS NULL OR v_handled_by IS NULL
    OR v_type IS NULL OR v_type NOT IN ('query', 'complaint', 'request', 'information', 'feedback', 'other')
    OR v_channel IS NULL OR v_channel NOT IN ('in_person', 'phone', 'email', 'letter', 'whatsapp', 'other')
    OR v_direction IS NULL OR v_direction NOT IN ('incoming', 'outgoing')
    OR v_status IS NULL OR v_status NOT IN ('open', 'follow_up', 'closed')
    OR (v_follow_up_on IS NOT NULL AND v_follow_up_on < v_contact_on)
    OR (v_status = 'follow_up' AND v_follow_up_on IS NULL)
  THEN
    RAISE EXCEPTION 'The contact details are invalid.' USING ERRCODE = '22023';
  END IF;
  IF v_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.units AS unit
    WHERE unit.society_id = p_society_id AND unit.id = v_unit_id
      AND (unit.active OR unit.id = existing_row.unit_id)
  ) THEN
    RAISE EXCEPTION 'Choose a unit in this society.' USING ERRCODE = '22023';
  END IF;
  IF v_request_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_requests AS request
    WHERE request.society_id = p_society_id AND request.id = v_request_id
  ) THEN
    RAISE EXCEPTION 'Choose a service request in this society.' USING ERRCODE = '22023';
  END IF;
  -- A former handler may stay on an existing entry; new handlers must be current managers.
  IF v_handled_by IS DISTINCT FROM existing_row.handled_by AND NOT EXISTS (
    SELECT 1 FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = v_handled_by
      AND membership.status = 'active'
      AND membership.roles && ARRAY['admin', 'committee']::text[]
  ) THEN
    RAISE EXCEPTION 'Choose an admin or committee member as the handler.'
      USING ERRCODE = '22023';
  END IF;

  IF p_log_id IS NULL THEN
    INSERT INTO public.member_contact_logs (
      society_id, contact_on, unit_id, contact_type, channel, direction, summary,
      handled_by, follow_up_on, status, closed_at, service_request_id,
      client_request_id, created_by, updated_by
    )
    VALUES (
      p_society_id, v_contact_on, v_unit_id, v_type, v_channel, v_direction, v_summary,
      v_handled_by, v_follow_up_on, v_status,
      CASE WHEN v_status = 'closed' THEN now() END, v_request_id,
      p_client_request_id, auth.uid(), auth.uid()
    )
    RETURNING * INTO saved_row;
  ELSE
    UPDATE public.member_contact_logs
    SET contact_on = v_contact_on,
        unit_id = v_unit_id,
        contact_type = v_type,
        channel = v_channel,
        direction = v_direction,
        summary = v_summary,
        handled_by = v_handled_by,
        follow_up_on = v_follow_up_on,
        status = v_status,
        closed_at = CASE
          WHEN v_status <> 'closed' THEN NULL
          ELSE COALESCE(existing_row.closed_at, now())
        END,
        service_request_id = v_request_id
    WHERE society_id = p_society_id AND id = p_log_id
    RETURNING * INTO saved_row;
  END IF;

  -- The summary is left out of the audit trail; the entry itself holds it.
  PERFORM private.core_toolkit_audit(
    p_society_id,
    CASE WHEN p_log_id IS NULL THEN 'contact_log.create' ELSE 'contact_log.update' END,
    'member_contact_log', saved_row.id::text,
    CASE WHEN p_log_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'status', existing_row.status, 'follow_up_on', existing_row.follow_up_on
    ) END,
    pg_catalog.jsonb_build_object(
      'status', saved_row.status, 'follow_up_on', saved_row.follow_up_on,
      'contact_type', saved_row.contact_type, 'channel', saved_row.channel
    ),
    p_request_trace
  );
  RETURN private.member_contact_log_json(saved_row);
END;
$$;

-- Lists entries (newest first, up to 200) plus the pick-lists the form needs.
CREATE FUNCTION public.member_contact_logs_get(
  p_society_id uuid,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.core_toolkit_authorize(
    p_society_id, ARRAY['admin', 'committee']::text[], false
  );
  IF p_status IS NOT NULL AND p_status NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION 'The contact filter is invalid.' USING ERRCODE = '22023';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'logs', COALESCE((
      SELECT pg_catalog.jsonb_agg(private.member_contact_log_json(page) ORDER BY page.contact_on DESC, page.created_at DESC, page.id)
      FROM (
        SELECT log.*
        FROM public.member_contact_logs AS log
        WHERE log.society_id = p_society_id
          AND (
            p_status IS NULL
            OR (p_status = 'open' AND log.status <> 'closed')
            OR (p_status = 'closed' AND log.status = 'closed')
          )
        ORDER BY log.contact_on DESC, log.created_at DESC, log.id
        LIMIT 200
      ) AS page
    ), '[]'::jsonb),
    'handlers', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', handler.user_id, 'name', handler.full_name)
        ORDER BY handler.full_name, handler.user_id
      )
      FROM (
        SELECT DISTINCT membership.user_id, profile.full_name
        FROM public.memberships AS membership
        JOIN public.profiles AS profile ON profile.id = membership.user_id
        WHERE membership.society_id = p_society_id
          AND membership.status = 'active'
          AND membership.roles && ARRAY['admin', 'committee']::text[]
      ) AS handler
    ), '[]'::jsonb),
    'units', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', unit.id,
          'label', private.community_unit_label(p_society_id, unit.id)
        )
        ORDER BY private.community_unit_label(p_society_id, unit.id)
      )
      FROM public.units AS unit
      WHERE unit.society_id = p_society_id AND unit.active
    ), '[]'::jsonb),
    'requests', CASE
      WHEN private.module_enabled(p_society_id, 'service_request') THEN COALESCE((
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('id', recent.id, 'label', recent.label)
          ORDER BY recent.created_at DESC, recent.id
        )
        FROM (
          SELECT request.id, request.created_at,
            pg_catalog.left(
              category.name || ' · '
              || pg_catalog.to_char(request.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY')
              || ' · ' || request.description,
              120
            ) AS label
          FROM public.service_requests AS request
          JOIN public.service_request_categories AS category
            ON category.society_id = request.society_id
            AND category.id = request.category_id
          WHERE request.society_id = p_society_id
            AND request.status <> 'rejected'
          ORDER BY request.created_at DESC, request.id
          LIMIT 100
        ) AS recent
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

-- Daily retention (service role): deletes entries closed more than three years before p_today.
CREATE FUNCTION public.communication_retention_run(p_today date, p_request_trace text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cutoff timestamptz;
  total integer;
BEGIN
  IF p_today IS NULL THEN
    RAISE EXCEPTION 'The retention day is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := ((p_today - interval '3 years')::date)::timestamp AT TIME ZONE 'Asia/Kolkata';

  WITH removed AS (
    DELETE FROM public.member_contact_logs AS log
    WHERE log.status = 'closed' AND log.closed_at < cutoff
    RETURNING log.society_id
  ),
  grouped AS (
    SELECT removed.society_id, count(*)::integer AS removed_count
    FROM removed
    GROUP BY removed.society_id
  ),
  audited AS (
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, "after", request_id
    )
    SELECT grouped.society_id, NULL, 'system', 'core.contact_log.retention_delete',
      'member_contact_log',
      pg_catalog.jsonb_build_object('deleted', grouped.removed_count, 'before', cutoff),
      p_request_trace
    FROM grouped
    RETURNING 1
  )
  SELECT COALESCE(sum(grouped.removed_count), 0)::integer INTO total FROM grouped;
  RETURN pg_catalog.jsonb_build_object('contactLogsDeleted', total);
END;
$$;

REVOKE ALL ON FUNCTION public.member_contact_log_save(uuid, uuid, jsonb, timestamptz, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.member_contact_logs_get(uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.communication_retention_run(date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_contact_log_save(uuid, uuid, jsonb, timestamptz, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_contact_logs_get(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.communication_retention_run(date, text) TO service_role;

-- P53.3 communication dashboard ------------------------------------------------
-- Read-only monthly figures counted from stored records (India months). A section is null when
-- its module is off. Requests use the P49.3 report definitions. No figures are typed in.
CREATE FUNCTION public.communication_dashboard_get(p_society_id uuid, p_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  month_start date;
  start_at timestamptz;
  end_at timestamptz;
  today date := private.communication_today();
BEGIN
  PERFORM private.core_toolkit_authorize(
    p_society_id, ARRAY['admin', 'committee']::text[], false
  );
  IF p_month IS NULL OR p_month > today THEN
    RAISE EXCEPTION 'Choose this month or an earlier one.' USING ERRCODE = '22023';
  END IF;
  month_start := pg_catalog.date_trunc('month', p_month)::date;
  start_at := month_start::timestamp AT TIME ZONE 'Asia/Kolkata';
  end_at := (month_start + interval '1 month')::timestamp AT TIME ZONE 'Asia/Kolkata';

  RETURN pg_catalog.jsonb_build_object(
    'month', pg_catalog.to_char(month_start, 'YYYY-MM'),
    'notices', CASE WHEN private.module_enabled(p_society_id, 'notice') THEN (
      SELECT pg_catalog.jsonb_build_object(
        'posted', count(*) FILTER (
          WHERE notice.published_at >= start_at AND notice.published_at < end_at
        ),
        'removed', count(*) FILTER (
          WHERE notice.published_at IS NOT NULL
            AND LEAST(notice.withdrawn_at, notice.expires_at) >= start_at
            AND LEAST(notice.withdrawn_at, notice.expires_at) < end_at
            AND LEAST(notice.withdrawn_at, notice.expires_at) <= now()
        ),
        'planned_now', count(*) FILTER (WHERE notice.status IN ('draft', 'scheduled'))
      )
      FROM public.notices AS notice
      WHERE notice.society_id = p_society_id
    ) END,
    'meetings', CASE WHEN private.module_enabled(p_society_id, 'meeting') THEN (
      SELECT pg_catalog.jsonb_build_object('notices_issued', count(*))
      FROM public.meetings AS meeting
      WHERE meeting.society_id = p_society_id
        AND meeting.scheduled_at >= start_at AND meeting.scheduled_at < end_at
    ) END,
    'events', CASE WHEN private.module_enabled(p_society_id, 'event') THEN (
      SELECT pg_catalog.jsonb_build_object('published', count(*))
      FROM public.events AS event
      WHERE event.society_id = p_society_id
        AND event.published_at >= start_at AND event.published_at < end_at
    ) END,
    'sos', CASE WHEN private.module_enabled(p_society_id, 'sos') THEN (
      SELECT pg_catalog.jsonb_build_object('raised', count(*))
      FROM public.sos_alerts AS alert
      WHERE alert.society_id = p_society_id
        AND alert.status <> 'cancelled'
        AND alert.raised_at >= start_at AND alert.raised_at < end_at
    ) END,
    'requests', CASE WHEN private.module_enabled(p_society_id, 'service_request') THEN
      pg_catalog.jsonb_build_object(
        'received', (
          SELECT count(*) FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.status <> 'rejected'
            AND request.created_at >= start_at AND request.created_at < end_at
        ),
        'resolved', (
          SELECT count(*) FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.status <> 'rejected'
            AND request.resolved_at >= start_at AND request.resolved_at < end_at
        ),
        'avg_days', (
          SELECT round(avg(
            extract(epoch FROM request.resolved_at - request.created_at) / 86400
          )::numeric, 1)
          FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.resolved_at >= start_at AND request.resolved_at < end_at
        )
      )
    END,
    'contact_log', (
      SELECT pg_catalog.jsonb_build_object(
        'logged', count(*) FILTER (
          WHERE log.contact_on >= month_start
            AND log.contact_on < (month_start + interval '1 month')::date
        ),
        'closed', count(*) FILTER (
          WHERE log.closed_at >= start_at AND log.closed_at < end_at
        ),
        'open_now', count(*) FILTER (WHERE log.status <> 'closed'),
        'follow_up_overdue', count(*) FILTER (
          WHERE log.status <> 'closed' AND log.follow_up_on < today
        )
      )
      FROM public.member_contact_logs AS log
      WHERE log.society_id = p_society_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.communication_dashboard_get(uuid, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.communication_dashboard_get(uuid, date) TO authenticated;
