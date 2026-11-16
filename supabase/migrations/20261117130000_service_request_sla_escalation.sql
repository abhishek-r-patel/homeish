-- Escalate overdue service requests to admins, then to the committee, from the daily job (PRD D-59).

ALTER TABLE public.service_request_categories
  ADD COLUMN committee_escalation_days integer NOT NULL DEFAULT 2,
  ADD CONSTRAINT service_request_categories_committee_escalation_days_check
    CHECK (committee_escalation_days BETWEEN 1 AND 30) NOT VALID;
ALTER TABLE public.service_request_categories
  VALIDATE CONSTRAINT service_request_categories_committee_escalation_days_check;

ALTER TABLE public.service_request_events
  DROP CONSTRAINT service_request_events_type_check,
  ADD CONSTRAINT service_request_events_type_check
    CHECK (event_type IN (
      'created', 'assigned', 'reassigned', 'status_changed',
      'rejected', 'confirmed', 'reopened', 'rated', 'commented', 'auto_closed',
      'escalated'
    )) NOT VALID;
ALTER TABLE public.service_request_events
  VALIDATE CONSTRAINT service_request_events_type_check;

-- In-app notifications are always sent; admins may add email on top.
CREATE TABLE public.service_request_escalation_settings (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  delivery text NOT NULL DEFAULT 'in_app',
  CONSTRAINT service_request_escalation_settings_delivery_check
    CHECK (delivery IN ('in_app', 'in_app_email'))
);

-- One row per request and level is the idempotency record for the daily job.
-- Rows follow their request when retention deletes old closed requests.
CREATE TABLE public.service_request_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  level text NOT NULL,
  escalated_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivery text NOT NULL,
  recipient_count integer NOT NULL,
  request_trace text,
  CONSTRAINT service_request_escalations_level_check
    CHECK (level IN ('admin', 'committee')),
  CONSTRAINT service_request_escalations_delivery_check
    CHECK (delivery IN ('in_app', 'in_app_email')),
  CONSTRAINT service_request_escalations_recipient_count_check
    CHECK (recipient_count BETWEEN 0 AND 10),
  CONSTRAINT service_request_escalations_request_trace_check
    CHECK (request_trace IS NULL OR char_length(request_trace) BETWEEN 1 AND 128),
  CONSTRAINT service_request_escalations_request_level_key
    UNIQUE (society_id, request_id, level),
  CONSTRAINT service_request_escalations_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.service_requests (society_id, id) ON DELETE CASCADE
);

CREATE INDEX service_request_escalation_settings_created_by_idx
  ON public.service_request_escalation_settings (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX service_request_escalation_settings_updated_by_idx
  ON public.service_request_escalation_settings (updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX service_request_escalations_society_level_on_idx
  ON public.service_request_escalations (society_id, level, escalated_on);

CREATE TRIGGER service_request_escalation_settings_set_updated_at
  BEFORE UPDATE ON public.service_request_escalation_settings
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.service_request_escalation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_escalations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_request_escalation_settings,
  public.service_request_escalations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.service_request_escalation_settings,
  public.service_request_escalations TO service_role;

-- Read and written only through the functions below; recipients are never exposed.
CREATE POLICY service_request_escalation_settings_no_direct_access
  ON public.service_request_escalation_settings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY service_request_escalations_no_direct_access
  ON public.service_request_escalations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION private.service_request_escalation_level(
  p_society_id uuid,
  p_request_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE WHEN bool_or(step.level = 'committee') THEN 'committee'
      ELSE 'admin' END
    FROM public.service_request_escalations AS step
    WHERE step.society_id = p_society_id AND step.request_id = p_request_id
    HAVING count(*) > 0
  ), 'none')
$$;

REVOKE ALL ON FUNCTION private.service_request_escalation_level(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Escalate one request to one level. Returns the email work list, or NULL when
-- the level was already recorded (a repeat or catch-up run).
CREATE OR REPLACE FUNCTION private.service_request_escalate(
  p_society_id uuid,
  p_request_id uuid,
  p_level text,
  p_today date,
  p_delivery text,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_ids uuid[];
  recipient_id uuid;
  escalation_id uuid;
  request_label text;
  level_label text := CASE p_level
    WHEN 'committee' THEN 'the management committee'
    ELSE 'the society admins' END;
BEGIN
  SELECT COALESCE(array_agg(chosen.user_id ORDER BY chosen.created_at, chosen.id),
      ARRAY[]::uuid[])
  INTO recipient_ids
  FROM (
    SELECT membership.id, membership.user_id, membership.created_at
    FROM public.memberships AS membership
    JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND membership.roles @> ARRAY[p_level]::text[]
      AND profile.status = 'active'
    ORDER BY membership.created_at, membership.id
    LIMIT 10
  ) AS chosen;

  INSERT INTO public.service_request_escalations (
    society_id, request_id, level, escalated_on, delivery, recipient_count,
    request_trace
  )
  VALUES (
    p_society_id, p_request_id, p_level, p_today, p_delivery,
    COALESCE(pg_catalog.array_length(recipient_ids, 1), 0), p_request_trace
  )
  ON CONFLICT ON CONSTRAINT service_request_escalations_request_level_key
  DO NOTHING
  RETURNING id INTO escalation_id;
  IF escalation_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'escalated', NULL, NULL,
    'Escalated to ' || level_label
  );

  SELECT category.name || CASE WHEN unit.number IS NULL THEN ' · Common area'
      ELSE ' · Unit ' || unit.number END
  INTO request_label
  FROM public.service_requests AS request
  JOIN public.service_request_categories AS category
    ON category.society_id = request.society_id
    AND category.id = request.category_id
  LEFT JOIN public.units AS unit
    ON unit.society_id = request.society_id AND unit.id = request.unit_id
  WHERE request.society_id = p_society_id AND request.id = p_request_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, NULL, 'system', 'request.escalate', 'service_request',
    p_request_id::text,
    pg_catalog.jsonb_build_object(
      'level', p_level, 'escalated_on', p_today, 'delivery', p_delivery,
      'recipient_count', COALESCE(pg_catalog.array_length(recipient_ids, 1), 0)
    ),
    p_request_trace
  );

  FOREACH recipient_id IN ARRAY recipient_ids LOOP
    PERFORM private.create_notification(
      p_society_id, recipient_id, 'service_request_escalated',
      'Request escalated',
      pg_catalog.left(request_label, 160)
        || ' is past its response target and was escalated to '
        || level_label || '.',
      'service_request', p_request_id, p_request_trace
    );
  END LOOP;

  IF p_delivery <> 'in_app_email' THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'email', profile.email::text,
      'name', profile.full_name,
      'level', p_level,
      'request_id', p_request_id,
      'request_label', pg_catalog.left(request_label, 160)
    ) ORDER BY profile.email)
    FROM public.profiles AS profile
    WHERE profile.id = ANY (recipient_ids)
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION private.service_request_escalate(
  uuid, uuid, text, date, text, text
) FROM PUBLIC, anon, authenticated, service_role;

-- Steps count in whole IST days. p_today is the job's period key and may only be
-- today or yesterday in India (a late catch-up run); the cut-off never passes now().
-- Each request escalates at most once per level for its whole life: a reopened
-- request that was already escalated keeps its level and is not escalated to
-- admins again. The committee step counts from the admin escalation date, so a
-- reopened request still open after that interval can reach the committee.
CREATE OR REPLACE FUNCTION public.request_escalation_run(
  p_society_id uuid,
  p_today date,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  india_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  delivery_choice text;
  cutoff timestamptz;
  candidate record;
  step_emails jsonb;
  emails jsonb := '[]'::jsonb;
  admin_count integer := 0;
  committee_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'The daily request job requires service role.'
      USING ERRCODE = '42501';
  END IF;
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_today NOT BETWEEN india_today - 1 AND india_today
  THEN
    RAISE EXCEPTION 'The escalation run details are invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'service_request')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN pg_catalog.jsonb_build_object(
      'admin', 0, 'committee', 0, 'emails', '[]'::jsonb
    );
  END IF;

  SELECT settings.delivery INTO delivery_choice
  FROM public.service_request_escalation_settings AS settings
  WHERE settings.society_id = p_society_id;
  delivery_choice := COALESCE(delivery_choice, 'in_app');
  cutoff := LEAST(
    now(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  -- Committee first, so a request that reaches admins in this run waits its full interval.
  FOR candidate IN
    SELECT request.id
    FROM public.service_requests AS request
    JOIN public.service_request_categories AS category
      ON category.society_id = request.society_id
      AND category.id = request.category_id
    JOIN public.service_request_escalations AS admin_step
      ON admin_step.society_id = request.society_id
      AND admin_step.request_id = request.id
      AND admin_step.level = 'admin'
    WHERE request.society_id = p_society_id
      AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
      AND admin_step.escalated_on + category.committee_escalation_days <= p_today
      AND NOT EXISTS (
        SELECT 1 FROM public.service_request_escalations AS committee_step
        WHERE committee_step.society_id = request.society_id
          AND committee_step.request_id = request.id
          AND committee_step.level = 'committee'
      )
    ORDER BY admin_step.escalated_on, request.id
    LIMIT 200
    FOR UPDATE OF request SKIP LOCKED
  LOOP
    step_emails := private.service_request_escalate(
      p_society_id, candidate.id, 'committee', p_today, delivery_choice,
      p_request_trace
    );
    IF step_emails IS NOT NULL THEN
      committee_count := committee_count + 1;
      emails := emails || step_emails;
    END IF;
  END LOOP;

  FOR candidate IN
    SELECT request.id
    FROM public.service_requests AS request
    WHERE request.society_id = p_society_id
      AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
      AND request.sla_due_at IS NOT NULL
      AND request.sla_due_at < cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.service_request_escalations AS admin_step
        WHERE admin_step.society_id = request.society_id
          AND admin_step.request_id = request.id
          AND admin_step.level = 'admin'
      )
    ORDER BY request.sla_due_at, request.id
    LIMIT 200
    FOR UPDATE OF request SKIP LOCKED
  LOOP
    step_emails := private.service_request_escalate(
      p_society_id, candidate.id, 'admin', p_today, delivery_choice,
      p_request_trace
    );
    IF step_emails IS NOT NULL THEN
      admin_count := admin_count + 1;
      emails := emails || step_emails;
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'admin', admin_count, 'committee', committee_count, 'emails', emails
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_escalation_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_escalation_run(uuid, date, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.request_escalation_settings_get(
  p_society_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.service_request_escalation_settings;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Escalation settings are not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO settings_row
  FROM public.service_request_escalation_settings
  WHERE society_id = p_society_id;
  RETURN pg_catalog.jsonb_build_object(
    'delivery', COALESCE(settings_row.delivery, 'in_app'),
    'updated_at', settings_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_escalation_settings_save(
  p_society_id uuid,
  p_delivery text,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.service_request_escalation_settings;
  after_row public.service_request_escalation_settings;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service request administration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_delivery IS NULL OR p_delivery NOT IN ('in_app', 'in_app_email') THEN
    RAISE EXCEPTION 'Choose how escalations are sent.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before_row
  FROM public.service_request_escalation_settings
  WHERE society_id = p_society_id
  FOR UPDATE;
  IF FOUND THEN
    IF p_expected_updated_at IS NULL
      OR before_row.updated_at <> p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The escalation settings changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    UPDATE public.service_request_escalation_settings
    SET delivery = p_delivery
    WHERE society_id = p_society_id
    RETURNING * INTO after_row;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'The escalation settings changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    INSERT INTO public.service_request_escalation_settings (
      society_id, delivery, created_by, updated_by
    )
    VALUES (p_society_id, p_delivery, current_user_id, current_user_id)
    ON CONFLICT (society_id) DO NOTHING
    RETURNING * INTO after_row;
    IF after_row.society_id IS NULL THEN
      RAISE EXCEPTION 'The escalation settings changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'request.escalation_settings.update',
    'service_request_escalation_settings', p_society_id::text,
    pg_catalog.jsonb_build_object(
      'delivery', COALESCE(before_row.delivery, 'in_app')
    ),
    pg_catalog.jsonb_build_object('delivery', after_row.delivery),
    p_request_id
  );
  RETURN pg_catalog.jsonb_build_object(
    'delivery', after_row.delivery,
    'updated_at', after_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_escalation_settings_get(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_escalation_settings_save(
  uuid, text, timestamptz, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_escalation_settings_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_escalation_settings_save(
  uuid, text, timestamptz, text
) TO authenticated;

-- Adds the committee interval to the latest definition (20261110213000). A new
-- parameter needs DROP + CREATE; NULL keeps the current value (2 for new categories).
DROP FUNCTION public.request_category_save(
  uuid, uuid, text, integer, integer, boolean, timestamptz, text
);

CREATE FUNCTION public.request_category_save(
  p_society_id uuid,
  p_category_id uuid,
  p_name text,
  p_sla_hours integer,
  p_sort_order integer,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_id text,
  p_committee_escalation_days integer DEFAULT NULL
)
RETURNS public.service_request_categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.service_request_categories;
  after_row public.service_request_categories;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service request administration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
    OR p_sort_order NOT BETWEEN 0 AND 10000
    OR (p_sla_hours IS NOT NULL AND p_sla_hours NOT BETWEEN 1 AND 8760)
    OR p_active IS NULL
    OR (p_committee_escalation_days IS NOT NULL
      AND p_committee_escalation_days NOT BETWEEN 1 AND 30)
  THEN
    RAISE EXCEPTION 'The category details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  IF p_category_id IS NULL THEN
    INSERT INTO public.service_request_categories (
      society_id, name, sla_hours, sort_order, active,
      committee_escalation_days, created_by, updated_by
    )
    VALUES (
      p_society_id, btrim(p_name), p_sla_hours, p_sort_order, p_active,
      COALESCE(p_committee_escalation_days, 2), current_user_id, current_user_id
    )
    RETURNING * INTO after_row;
  ELSE
    SELECT * INTO before_row
    FROM public.service_request_categories
    WHERE society_id = p_society_id AND id = p_category_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The category was not found.'
        USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_updated_at IS NULL
      OR before_row.updated_at <> p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The category changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;

    UPDATE public.service_request_categories
    SET name = btrim(p_name),
        sla_hours = p_sla_hours,
        sort_order = p_sort_order,
        active = p_active,
        committee_escalation_days = COALESCE(
          p_committee_escalation_days, before_row.committee_escalation_days
        ),
        updated_by = current_user_id
    WHERE society_id = p_society_id AND id = p_category_id
    RETURNING * INTO after_row;
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin',
    CASE WHEN p_category_id IS NULL
      THEN 'request.categories.create' ELSE 'request.categories.update' END,
    'service_request_category', after_row.id::text,
    CASE WHEN p_category_id IS NULL THEN NULL ELSE
      pg_catalog.jsonb_build_object(
        'name', before_row.name, 'sla_hours', before_row.sla_hours,
        'sort_order', before_row.sort_order, 'active', before_row.active,
        'committee_escalation_days', before_row.committee_escalation_days
      )
    END,
    pg_catalog.jsonb_build_object(
      'name', after_row.name, 'sla_hours', after_row.sla_hours,
      'sort_order', after_row.sort_order, 'active', after_row.active,
      'committee_escalation_days', after_row.committee_escalation_days
    ),
    p_request_id
  );
  RETURN after_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_category_save(
  uuid, uuid, text, integer, integer, boolean, timestamptz, text, integer
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_category_save(
  uuid, uuid, text, integer, integer, boolean, timestamptz, text, integer
) TO authenticated;

-- Same body as 20261114100000 (P10.3 paged rewrite) plus escalation_level,
-- computed only for the returned page.
CREATE OR REPLACE FUNCTION public.request_list(
  p_society_id uuid,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'default'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  can_manage boolean;
  is_resident boolean;
  own_units uuid[];
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service requests are not available.'
      USING ERRCODE = '42501';
  END IF;
  IF (p_status IS NOT NULL AND p_status NOT IN (
      'open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
    ))
    OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset < 0
    OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from)
    OR p_sort IS NULL OR p_sort NOT IN ('default', 'votes')
  THEN
    RAISE EXCEPTION 'The request filters are invalid.'
      USING ERRCODE = '22023';
  END IF;

  can_manage := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  own_units := private.current_user_unit_ids(p_society_id);

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(filtered)
      ORDER BY
        CASE WHEN p_sort = 'votes' THEN filtered.upvote_count END DESC NULLS LAST,
        filtered.is_overdue DESC,
        filtered.created_at DESC
    )
    FROM (
      SELECT
        page.*,
        unit.number AS unit_number,
        requester.full_name AS requester_name,
        assignee_profile.full_name AS assignee_name,
        COALESCE(votes.upvote_count, 0) AS upvote_count,
        COALESCE(votes.has_upvoted, false) AS has_upvoted,
        private.service_request_escalation_level(
          page.society_id, page.id
        ) AS escalation_level
      FROM (
        SELECT
          request.*,
          category.name AS category_name,
          COALESCE(
            request.status IN ('open', 'assigned', 'in_progress', 'reopened')
              AND request.sla_due_at < now(),
            false
          ) AS is_overdue
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id
          AND category.id = request.category_id
        WHERE request.society_id = p_society_id
          AND (
            can_manage
            OR (request.location_type = 'unit'
              AND request.unit_id = ANY (own_units)
              AND private.occupies_unit(request.unit_id))
            OR (request.location_type = 'common_area' AND is_resident)
            OR EXISTS (
              SELECT 1 FROM public.memberships AS current_assignee
              WHERE current_assignee.society_id = request.society_id
                AND current_assignee.id = request.assigned_membership_id
                AND current_assignee.user_id = current_user_id
                AND current_assignee.status = 'active'
            )
          )
          AND (p_status IS NULL OR request.status = p_status)
          AND (p_category_id IS NULL OR request.category_id = p_category_id)
          AND (p_unit_id IS NULL OR request.unit_id = p_unit_id)
          AND (p_assignee_id IS NULL
            OR request.assigned_membership_id = p_assignee_id)
          AND (p_from IS NULL OR request.created_at::date >= p_from)
          AND (p_to IS NULL OR request.created_at::date <= p_to)
        ORDER BY
          CASE WHEN p_sort = 'votes' THEN (
            SELECT count(*)::integer FROM public.service_request_upvotes AS vote
            WHERE vote.society_id = request.society_id
              AND vote.request_id = request.id
          ) END DESC NULLS LAST,
          CASE WHEN request.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request.sla_due_at < now() THEN 0 ELSE 1 END,
          request.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) AS page
      LEFT JOIN public.units AS unit
        ON unit.society_id = page.society_id AND unit.id = page.unit_id
      LEFT JOIN public.profiles AS requester
        ON requester.id = page.created_by
      LEFT JOIN public.memberships AS assignee
        ON assignee.society_id = page.society_id
        AND assignee.id = page.assigned_membership_id
      LEFT JOIN public.profiles AS assignee_profile
        ON assignee_profile.id = assignee.user_id
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS upvote_count,
          bool_or(vote.user_id = current_user_id) AS has_upvoted
        FROM public.service_request_upvotes AS vote
        WHERE vote.society_id = page.society_id
          AND vote.request_id = page.id
      ) AS votes ON true
    ) AS filtered
  ), '[]'::jsonb);
END;
$$;

-- Same body as 20261114083000 plus escalation_level on the request object.
CREATE OR REPLACE FUNCTION public.request_get(
  p_society_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The service request is not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT request.* INTO request_row
  FROM public.service_requests AS request
  WHERE request.society_id = p_society_id AND request.id = p_request_id
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR (request.location_type = 'unit'
        AND private.occupies_unit(request.unit_id))
      OR (request.location_type = 'common_area'
        AND private.has_role(p_society_id, ARRAY['resident']::text[]))
      OR EXISTS (
        SELECT 1 FROM public.memberships AS assignee
        WHERE assignee.society_id = request.society_id
          AND assignee.id = request.assigned_membership_id
          AND assignee.user_id = current_user_id
          AND assignee.status = 'active'
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The service request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'request', pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object(
      'category_name', (
        SELECT name FROM public.service_request_categories
        WHERE society_id = p_society_id AND id = request_row.category_id
      ),
      'unit_number', (
        SELECT number FROM public.units
        WHERE society_id = p_society_id AND id = request_row.unit_id
      ),
      'requester_name', (
        SELECT full_name FROM public.profiles WHERE id = request_row.created_by
      ),
      'assignee_name', (
        SELECT profile.full_name
        FROM public.memberships AS member
        JOIN public.profiles AS profile ON profile.id = member.user_id
        WHERE member.society_id = p_society_id
          AND member.id = request_row.assigned_membership_id
      ),
      'is_overdue',
        COALESCE(
          request_row.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request_row.sla_due_at < now(),
          false
        ),
      'escalation_level',
        private.service_request_escalation_level(p_society_id, p_request_id)
    ) || (
      private.service_request_upvote_summary(p_society_id, p_request_id)
        - 'request_id'
    ),
    'comments', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(comment) || pg_catalog.jsonb_build_object(
          'author_name', profile.full_name
        ) ORDER BY comment.created_at
      )
      FROM public.service_request_comments AS comment
      JOIN public.profiles AS profile ON profile.id = comment.created_by
      WHERE comment.society_id = p_society_id
        AND comment.request_id = p_request_id
    ), '[]'::jsonb),
    'attachments', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(attachment) ORDER BY attachment.created_at
      )
      FROM public.service_request_attachments AS attachment
      WHERE attachment.society_id = p_society_id
        AND attachment.request_id = p_request_id
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(event) || pg_catalog.jsonb_build_object(
          'actor_name', profile.full_name
        ) ORDER BY event.created_at
      )
      FROM public.service_request_events AS event
      LEFT JOIN public.profiles AS profile ON profile.id = event.created_by
      WHERE event.society_id = p_society_id
        AND event.request_id = p_request_id
    ), '[]'::jsonb)
  );
END;
$$;
