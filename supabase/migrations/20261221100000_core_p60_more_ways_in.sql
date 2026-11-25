-- P60 resident module visibility, platform updates and counts-only developer usage.
ALTER TABLE public.module_configs
  ADD COLUMN residents_visible boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION private.module_enabled(
  p_society_id uuid,
  p_module_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_module_key = 'core'
    OR EXISTS (
      SELECT 1
      FROM public.module_configs AS module_config
      WHERE module_config.society_id = p_society_id
        AND module_config.module_key = p_module_key
        AND module_config.enabled
        AND (
          auth.role() = 'service_role'
          OR (SELECT private.is_developer())
          OR NOT private.has_role(
            p_society_id,
            ARRAY['resident']::text[]
          )
          OR private.has_role(
            p_society_id,
            ARRAY['admin', 'committee', 'guard', 'hk_supervisor']::text[]
          )
          OR (
            module_config.residents_visible
          )
        )
    ),
    false
  )
$$;

CREATE FUNCTION public.developer_resident_visibility_set(
  p_society_id uuid,
  p_module_key text,
  p_residents_visible boolean,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  config public.module_configs;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_module_key IS NULL OR p_module_key = 'core'
    OR NOT EXISTS (SELECT 1 FROM public.modules WHERE key = p_module_key)
    OR p_residents_visible IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a supported optional module.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO config
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = p_module_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The module configuration was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF config.residents_visible <> p_residents_visible THEN
    UPDATE public.module_configs
    SET residents_visible = p_residents_visible,
        updated_by = (SELECT auth.uid()),
        updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND module_key = p_module_key;
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, (SELECT auth.uid()), 'developer',
      'developer.modules.resident_visibility', 'module_config', p_module_key,
      jsonb_build_object('residents_visible', config.residents_visible),
      jsonb_build_object('residents_visible', p_residents_visible),
      p_request_id
    );
  END IF;
  RETURN jsonb_build_object('residentsVisible', p_residents_visible);
END;
$$;

CREATE TABLE public.platform_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  href text,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT platform_updates_title_check
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT platform_updates_body_check
    CHECK (body = btrim(body) AND char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT platform_updates_href_check
    CHECK (
      href IS NULL
      OR (
        char_length(href) BETWEEN 1 AND 500
        AND href LIKE '/%'
        AND substring(href from 2 for 1) NOT IN ('/', chr(92))
      )
    ),
  CONSTRAINT platform_updates_publish_withdraw_check
    CHECK (withdrawn_at IS NULL OR published_at IS NOT NULL)
);

CREATE TABLE public.platform_update_reads (
  update_id uuid NOT NULL REFERENCES public.platform_updates (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (update_id, user_id)
);

CREATE INDEX platform_updates_published_idx
  ON public.platform_updates (published_at DESC)
  WHERE published_at IS NOT NULL AND withdrawn_at IS NULL;
CREATE INDEX platform_update_reads_user_idx
  ON public.platform_update_reads (user_id, read_at DESC);
CREATE INDEX platform_updates_created_by_idx
  ON public.platform_updates (created_by);
CREATE INDEX platform_updates_updated_by_idx
  ON public.platform_updates (updated_by);
CREATE INDEX billing_bills_society_created_at_idx
  ON public.billing_bills (society_id, created_at DESC);
CREATE INDEX notices_society_created_at_idx
  ON public.notices (society_id, created_at DESC);

CREATE TRIGGER platform_updates_set_updated_at
  BEFORE UPDATE ON public.platform_updates
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.platform_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_update_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_updates
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.platform_update_reads
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY platform_updates_no_direct_access
  ON public.platform_updates FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
CREATE POLICY platform_update_reads_no_direct_access
  ON public.platform_update_reads FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE FUNCTION public.developer_platform_updates_get()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', update.id,
      'title', update.title,
      'body', update.body,
      'href', update.href,
      'publishedAt', update.published_at,
      'withdrawnAt', update.withdrawn_at,
      'updatedAt', update.updated_at
    ) ORDER BY update.updated_at DESC, update.id
  ), '[]'::jsonb)
  FROM public.platform_updates AS update
  WHERE private.is_developer()
$$;

CREATE FUNCTION public.developer_platform_update_save(
  p_update_id uuid,
  p_title text,
  p_body text,
  p_href text,
  p_publish boolean,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_update public.platform_updates;
  saved_update public.platform_updates;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR btrim(p_title) <> p_title
    OR char_length(p_title) NOT BETWEEN 1 AND 120
    OR p_body IS NULL OR btrim(p_body) <> p_body
    OR char_length(p_body) NOT BETWEEN 1 AND 2000
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR (
      p_href IS NOT NULL
      AND (
        char_length(p_href) NOT BETWEEN 1 AND 500
        OR p_href NOT LIKE '/%'
        OR substring(p_href from 2 for 1) IN ('/', chr(92))
      )
    )
  THEN
    RAISE EXCEPTION 'Check the update title, body and page link.' USING ERRCODE = '22023';
  END IF;
  IF p_update_id IS NULL THEN
    INSERT INTO public.platform_updates (
      title, body, href, published_at, created_by, updated_by
    ) VALUES (
      p_title, p_body, p_href,
      CASE WHEN p_publish THEN now() ELSE NULL END,
      (SELECT auth.uid()), (SELECT auth.uid())
    ) RETURNING * INTO saved_update;
  ELSE
    SELECT * INTO current_update
    FROM public.platform_updates
    WHERE id = p_update_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The update was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_updated_at IS DISTINCT FROM current_update.updated_at THEN
      RAISE EXCEPTION 'The update changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.platform_updates
    SET title = p_title,
        body = p_body,
        href = p_href,
        published_at = CASE
          WHEN p_publish THEN COALESCE(published_at, now())
          ELSE NULL
        END,
        withdrawn_at = NULL,
        updated_by = (SELECT auth.uid()),
        updated_at = clock_timestamp()
    WHERE id = p_update_id
    RETURNING * INTO saved_update;
  END IF;
  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    (SELECT auth.uid()), 'developer', 'platform.update.save', 'platform_update',
    saved_update.id::text,
    CASE WHEN current_update.id IS NULL THEN NULL ELSE jsonb_build_object(
      'title', current_update.title,
      'body', current_update.body,
      'href', current_update.href,
      'publishedAt', current_update.published_at,
      'withdrawnAt', current_update.withdrawn_at,
      'published', current_update.published_at IS NOT NULL,
      'withdrawn', current_update.withdrawn_at IS NOT NULL
    ) END,
    jsonb_build_object(
      'title', saved_update.title,
      'body', saved_update.body,
      'href', saved_update.href,
      'publishedAt', saved_update.published_at,
      'withdrawnAt', saved_update.withdrawn_at,
      'published', saved_update.published_at IS NOT NULL,
      'withdrawn', saved_update.withdrawn_at IS NOT NULL
    ),
    p_request_id
  );
  RETURN jsonb_build_object('id', saved_update.id);
END;
$$;

CREATE FUNCTION public.developer_platform_update_withdraw(
  p_update_id uuid,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_update public.platform_updates;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO current_update
  FROM public.platform_updates
  WHERE id = p_update_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The update was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF current_update.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The update changed. Refresh before withdrawing.'
      USING ERRCODE = '23505';
  END IF;
  UPDATE public.platform_updates
  SET withdrawn_at = COALESCE(withdrawn_at, now()),
      updated_by = (SELECT auth.uid()),
      updated_at = clock_timestamp()
  WHERE id = p_update_id;
  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    (SELECT auth.uid()), 'developer', 'platform.update.withdraw',
    'platform_update', p_update_id::text,
    jsonb_build_object('withdrawn', current_update.withdrawn_at IS NOT NULL),
    jsonb_build_object('withdrawn', true),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.platform_updates_get()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
      AND membership.roles && ARRAY['admin', 'committee']::text[]
  ) THEN
    RAISE EXCEPTION 'Administrator or committee access is required.'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', update.id,
        'title', update.title,
        'body', update.body,
        'href', update.href,
        'publishedAt', update.published_at,
        'hasRead', read_marker.update_id IS NOT NULL
      )
      ORDER BY update.published_at DESC, update.id
    )
    FROM public.platform_updates AS update
    LEFT JOIN public.platform_update_reads AS read_marker
      ON read_marker.update_id = update.id
      AND read_marker.user_id = (SELECT auth.uid())
    WHERE update.published_at IS NOT NULL
      AND update.published_at <= now()
      AND update.withdrawn_at IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.platform_update_mark_read(p_update_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
      AND membership.roles && ARRAY['admin', 'committee']::text[]
  ) THEN
    RAISE EXCEPTION 'Administrator or committee access is required.'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.platform_update_reads (update_id, user_id)
  SELECT update.id, (SELECT auth.uid())
  FROM public.platform_updates AS update
  WHERE update.id = p_update_id
    AND update.published_at IS NOT NULL
    AND update.published_at <= now()
    AND update.withdrawn_at IS NULL
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE FUNCTION public.developer_usage_overview_get()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'societyId', usage.society_id,
        'societyName', society.name,
        'peopleJoined', usage.people_joined,
        'visitors30d', usage.visitors_30d,
        'requests30d', usage.requests_30d,
        'bills30d', usage.bills_30d,
        'notices30d', usage.notices_30d,
        'modulesOn', usage.modules_on
      ) ORDER BY society.name, usage.society_id
    )
    FROM (
      SELECT society.id AS society_id,
        (
          SELECT count(DISTINCT membership.user_id)::integer
          FROM public.memberships AS membership
          WHERE membership.society_id = society.id
            AND membership.status = 'active'
            AND membership.user_id IS NOT NULL
        ) AS people_joined,
        (
          SELECT count(*)::integer
          FROM public.visitor_entries AS entry
          WHERE entry.society_id = society.id
            AND entry.created_at >= now() - interval '30 days'
        ) AS visitors_30d,
        (
          SELECT count(*)::integer
          FROM public.service_requests AS request
          WHERE request.society_id = society.id
            AND request.created_at >= now() - interval '30 days'
        ) AS requests_30d,
        (
          SELECT count(*)::integer
          FROM public.billing_bills AS bill
          WHERE bill.society_id = society.id
            AND bill.created_at >= now() - interval '30 days'
        ) AS bills_30d,
        (
          SELECT count(*)::integer
          FROM public.notices AS notice
          WHERE notice.society_id = society.id
            AND notice.created_at >= now() - interval '30 days'
        ) AS notices_30d,
        (
          SELECT count(*)::integer
          FROM public.module_configs AS config
          WHERE config.society_id = society.id
            AND config.enabled
            AND config.module_key <> 'core'
        ) AS modules_on
      FROM public.societies AS society
    ) AS usage
    JOIN public.societies AS society ON society.id = usage.society_id
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.developer_resident_visibility_set(uuid, text, boolean, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_platform_updates_get()
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_platform_update_save(
  uuid, text, text, text, boolean, timestamptz, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_platform_update_withdraw(
  uuid, timestamptz, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.platform_updates_get()
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.platform_update_mark_read(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_usage_overview_get()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.developer_resident_visibility_set(
  uuid, text, boolean, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_platform_updates_get()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_platform_update_save(
  uuid, text, text, text, boolean, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_platform_update_withdraw(
  uuid, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_updates_get()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_mark_read(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_usage_overview_get()
  TO authenticated;
