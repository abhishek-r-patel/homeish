-- P55 search, personal tiles, setup, feature requests, onboarding and calendar.
ALTER TABLE public.person_workspace_preferences
  ADD COLUMN quick_action_pins text[];

ALTER TABLE public.person_workspace_preferences
  ADD CONSTRAINT person_workspace_preferences_pins_check
  CHECK (
    quick_action_pins IS NULL
    OR (
      cardinality(quick_action_pins) BETWEEN 0 AND 8
      AND quick_action_pins <@ ARRAY[
        'notice.create', 'billing.payment', 'billing.generate',
        'expense.create', 'poll.create', 'request.review', 'billing.view',
        'meeting.view', 'visitor.preapprove', 'request.create',
        'household.view', 'visitor.manage', 'delivery.manage',
        'rounds.manage', 'staff.entry', 'request.log',
        'inventory.manage', 'petty_cash.view'
      ]::text[]
    )
  );

CREATE TABLE public.society_workspace_settings (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE CASCADE,
  residents_joined_percent integer NOT NULL DEFAULT 75,
  getting_started_dismissed_at timestamptz,
  getting_started_dismissed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT society_workspace_settings_percent_check
    CHECK (residents_joined_percent BETWEEN 1 AND 100),
  CONSTRAINT society_workspace_settings_dismiss_check
    CHECK (
      (getting_started_dismissed_at IS NULL)
      = (getting_started_dismissed_by IS NULL)
    )
);

CREATE TABLE public.society_feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE CASCADE,
  module_key text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  status_updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT society_feature_requests_note_check
    CHECK (note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500)),
  CONSTRAINT society_feature_requests_status_check
    CHECK (status IN ('new', 'agreed', 'declined'))
);

CREATE INDEX society_feature_requests_society_idx
  ON public.society_feature_requests (society_id, created_at DESC);
CREATE INDEX society_feature_requests_status_idx
  ON public.society_feature_requests (status, created_at DESC);

CREATE TABLE public.society_onboarding_records (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'agreed',
  agreed_modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  go_live_on date,
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT society_onboarding_records_stage_check
    CHECK (stage IN ('agreed', 'setting_up', 'live', 'paused')),
  CONSTRAINT society_onboarding_records_contact_name_check
    CHECK (
      contact_name IS NULL
      OR (contact_name = btrim(contact_name) AND char_length(contact_name) BETWEEN 1 AND 120)
    ),
  CONSTRAINT society_onboarding_records_contact_phone_check
    CHECK (
      contact_phone IS NULL
      OR contact_phone ~ '^\+?[0-9]{10,15}$'
    ),
  CONSTRAINT society_onboarding_records_contact_email_check
    CHECK (
      contact_email IS NULL
      OR (
        char_length(contact_email) BETWEEN 3 AND 254
        AND contact_email = lower(contact_email)
        AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
      )
    ),
  CONSTRAINT society_onboarding_records_notes_check
    CHECK (
      notes IS NULL
      OR (notes = btrim(notes) AND char_length(notes) BETWEEN 1 AND 1000)
    )
);

ALTER TABLE public.society_workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_onboarding_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY society_workspace_settings_read
  ON public.society_workspace_settings FOR SELECT TO authenticated
  USING (
    private.is_developer()
    OR private.has_role(society_id, ARRAY['admin']::text[])
  );

CREATE POLICY society_feature_requests_admin_read
  ON public.society_feature_requests FOR SELECT TO authenticated
  USING (
    private.is_developer()
    OR private.has_role(society_id, ARRAY['admin']::text[])
  );

CREATE POLICY society_feature_requests_admin_insert
  ON public.society_feature_requests FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND created_by = auth.uid()
  );

CREATE POLICY society_feature_requests_developer_update
  ON public.society_feature_requests FOR UPDATE TO authenticated
  USING (private.is_developer())
  WITH CHECK (private.is_developer());

CREATE POLICY society_onboarding_records_developer
  ON public.society_onboarding_records FOR ALL TO authenticated
  USING (private.is_developer())
  WITH CHECK (private.is_developer());

REVOKE ALL ON public.society_workspace_settings
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.society_feature_requests
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.society_onboarding_records
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.society_workspace_settings TO authenticated;
GRANT SELECT, INSERT ON public.society_feature_requests TO authenticated;
GRANT UPDATE ON public.society_feature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.society_workspace_settings,
     public.society_feature_requests,
     public.society_onboarding_records
  TO service_role;

CREATE OR REPLACE FUNCTION public.workspace_quick_action_pins_get(
  p_society_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result text[];
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  SELECT preference.quick_action_pins
  INTO result
  FROM public.person_workspace_preferences AS preference
  WHERE preference.user_id = auth.uid()
    AND preference.society_id = p_society_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_quick_action_pins_save(
  p_society_id uuid,
  p_action_keys text[]
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  IF cardinality(p_action_keys) <>
    cardinality(ARRAY(SELECT DISTINCT key FROM unnest(p_action_keys) AS key)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Pin each action once';
  END IF;
  INSERT INTO public.person_workspace_preferences (
    user_id,
    society_id,
    quick_action_pins
  )
  VALUES (
    auth.uid(),
    p_society_id,
    p_action_keys
  )
  ON CONFLICT (user_id, society_id) DO UPDATE
  SET quick_action_pins = EXCLUDED.quick_action_pins,
      updated_at = now();
  RETURN p_action_keys;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_quick_action_pins_reset(
  p_society_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  UPDATE public.person_workspace_preferences
  SET quick_action_pins = NULL,
      updated_at = now()
  WHERE user_id = auth.uid()
    AND society_id = p_society_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_search_records(
  p_society_id uuid,
  p_query text
)
RETURNS TABLE (
  kind text,
  record_id uuid,
  title text,
  subtitle text,
  href text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  term text := btrim(p_query);
  is_admin_work boolean;
  is_guard boolean;
  pattern text;
BEGIN
  is_admin_work := private.has_role(
    p_society_id,
    ARRAY['admin', 'committee']::text[]
  );
  is_guard := private.has_role(p_society_id, ARRAY['guard']::text[]);
  IF NOT (is_admin_work OR is_guard) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Record search unavailable';
  END IF;
  IF term IS NULL OR char_length(term) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Search with 2 to 60 characters';
  END IF;
  pattern := '%' || term || '%';

  RETURN QUERY
  WITH people AS (
    SELECT
      'person'::text AS kind,
      membership.id AS record_id,
      profile.full_name AS title,
      COALESCE(string_agg(DISTINCT unit.number, ', '), 'Member') AS subtitle,
      '/admin/members'::text AS href
    FROM public.memberships AS membership
    JOIN public.profiles AS profile
      ON profile.id = membership.user_id
    LEFT JOIN public.unit_occupants AS occupant
      ON occupant.society_id = membership.society_id
     AND occupant.membership_id = membership.id
     AND occupant.status = 'active'
    LEFT JOIN public.units AS unit
      ON unit.society_id = occupant.society_id
     AND unit.id = occupant.unit_id
    WHERE is_admin_work
      AND membership.society_id = p_society_id
      AND membership.status = 'active'
      AND profile.full_name ILIKE pattern
    GROUP BY membership.id, profile.full_name
  ),
  flats AS (
    SELECT
      'flat'::text AS kind,
      unit.id AS record_id,
      COALESCE(block.name || ' · ', '') || unit.number AS title,
      'Flat'::text AS subtitle,
      CASE
        WHEN is_admin_work THEN '/admin/structure'
        ELSE '/guard/directory'
      END AS href
    FROM public.units AS unit
    LEFT JOIN public.blocks AS block
      ON block.society_id = unit.society_id
     AND block.id = unit.block_id
    WHERE (is_admin_work OR is_guard)
      AND unit.society_id = p_society_id
      AND unit.active
      AND (
        unit.number ILIKE pattern
        OR COALESCE(block.name, '') ILIKE pattern
      )
  ),
  vehicles AS (
    SELECT
      'vehicle'::text AS kind,
      vehicle.id AS record_id,
      vehicle.registration_number AS title,
      COALESCE(unit.number, 'Vehicle') AS subtitle,
      CASE
        WHEN is_admin_work THEN '/admin/directory'
        ELSE '/guard/directory'
      END AS href
    FROM public.directory_vehicles AS vehicle
    JOIN public.units AS unit
      ON unit.society_id = vehicle.society_id
     AND unit.id = vehicle.unit_id
    WHERE private.module_enabled(p_society_id, 'directory')
      AND (is_admin_work OR is_guard)
      AND vehicle.society_id = p_society_id
      AND vehicle.status = 'active'
      AND vehicle.registration_number ILIKE pattern
  )
  SELECT search.kind, search.record_id, search.title, search.subtitle, search.href
  FROM (
    SELECT * FROM people
    UNION ALL
    SELECT * FROM flats
    UNION ALL
    SELECT * FROM vehicles
  ) AS search
  ORDER BY search.kind, search.title
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_calendar_get(
  p_society_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  source text,
  item_id uuid,
  title text,
  occurs_at timestamptz,
  href text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_resident boolean;
  is_work boolean;
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  IF p_to <= p_from OR p_to - p_from > interval '62 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Choose a valid date range';
  END IF;
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  is_work := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);

  RETURN QUERY
  SELECT 'meeting'::text, meeting.id, meeting.title, meeting.starts_at,
    CASE WHEN is_work
      THEN '/admin/meetings/' || meeting.id::text
      ELSE '/meetings/' || meeting.id::text
    END
  FROM public.meetings AS meeting
  WHERE private.module_enabled(p_society_id, 'meeting')
    AND meeting.society_id = p_society_id
    AND meeting.status = 'scheduled'
    AND meeting.starts_at BETWEEN p_from AND p_to
    AND (meeting.meeting_type <> 'committee' OR is_work)

  UNION ALL

  SELECT 'event'::text, event.id, event.title, event.starts_at,
    CASE WHEN is_work
      THEN '/admin/events/' || event.id::text
      ELSE '/events/' || event.id::text
    END
  FROM public.events AS event
  WHERE private.module_enabled(p_society_id, 'event')
    AND event.society_id = p_society_id
    AND event.status = 'published'
    AND event.starts_at BETWEEN p_from AND p_to
    AND (
      is_work
      OR event.audience_scope = 'all'
      OR EXISTS (
        SELECT 1
        FROM public.event_audience_blocks AS audience
        JOIN public.units AS unit
          ON unit.society_id = audience.society_id
         AND unit.block_id = audience.block_id
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = unit.society_id
         AND occupant.unit_id = unit.id
         AND occupant.status = 'active'
        JOIN public.memberships AS membership
          ON membership.id = occupant.membership_id
         AND membership.user_id = auth.uid()
        WHERE audience.society_id = event.society_id
          AND audience.event_id = event.id
      )
    )

  UNION ALL

  SELECT 'amenity'::text, booking.id, booking.amenity_name, booking.starts_at,
    CASE WHEN is_work
      THEN '/admin/amenities'
      ELSE '/amenities/' || booking.id::text
    END
  FROM public.amenity_bookings AS booking
  WHERE private.module_enabled(p_society_id, 'amenity')
    AND booking.society_id = p_society_id
    AND booking.status = 'confirmed'
    AND booking.starts_at BETWEEN p_from AND p_to
    AND (is_work OR (is_resident AND booking.booked_by = auth.uid()))

  UNION ALL

  SELECT 'bill'::text, bill.id, bill.title,
    bill.due_date::timestamp AT TIME ZONE 'Asia/Kolkata',
    CASE WHEN is_work
      THEN '/admin/billing?tab=charges'
      ELSE '/bills/' || bill.id::text
    END
  FROM public.billing_bills AS bill
  WHERE private.module_enabled(p_society_id, 'billing')
    AND bill.society_id = p_society_id
    AND bill.cancelled_at IS NULL
    AND bill.due_date BETWEEN p_from::date AND p_to::date
    AND (
      is_work
      OR (
        is_resident
        AND EXISTS (
          SELECT 1
          FROM public.unit_occupants AS occupant
          JOIN public.memberships AS membership
            ON membership.id = occupant.membership_id
           AND membership.user_id = auth.uid()
          WHERE occupant.society_id = bill.society_id
            AND occupant.unit_id = bill.unit_id
            AND occupant.status = 'active'
        )
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.society_getting_started_get(
  p_society_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  workspace public.society_workspace_settings%ROWTYPE;
  total_units integer;
  joined_units integer;
  result jsonb;
BEGIN
  IF NOT (
    private.is_developer()
    OR private.has_role(p_society_id, ARRAY['admin']::text[])
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin access required';
  END IF;
  SELECT * INTO workspace
  FROM public.society_workspace_settings
  WHERE society_id = p_society_id;
  SELECT count(*) INTO total_units
  FROM public.units
  WHERE society_id = p_society_id AND active;
  SELECT count(DISTINCT unit.id) INTO joined_units
  FROM public.units AS unit
  JOIN public.unit_occupants AS occupant
    ON occupant.society_id = unit.society_id
   AND occupant.unit_id = unit.id
   AND occupant.status = 'active'
  JOIN public.memberships AS membership
    ON membership.id = occupant.membership_id
   AND membership.status = 'active'
   AND membership.roles @> ARRAY['resident']::text[]
  WHERE unit.society_id = p_society_id
    AND unit.active;

  result := jsonb_build_object(
    'dismissed', COALESCE(workspace.getting_started_dismissed_at IS NOT NULL, false),
    'residents_joined_percent', COALESCE(workspace.residents_joined_percent, 75),
    'total_units', total_units,
    'joined_units', joined_units,
    'steps', jsonb_build_array(
      jsonb_build_object(
        'key', 'society_details',
        'module_key', 'core',
        'title', 'Add society details',
        'href', '/admin/society-profile',
        'complete', EXISTS (
          SELECT 1 FROM public.societies AS society
          WHERE society.id = p_society_id
            AND coalesce(btrim(society.name), '') <> ''
            AND coalesce(btrim(society.address), '') <> ''
            AND coalesce(btrim(society.contact_email), '') <> ''
            AND coalesce(btrim(society.contact_phone), '') <> ''
        )
      ),
      jsonb_build_object(
        'key', 'units',
        'module_key', 'core',
        'title', 'Add towers and flats',
        'href', '/admin/structure',
        'complete', total_units > 0
      ),
      jsonb_build_object(
        'key', 'guard',
        'module_key', 'core',
        'title', 'Add a guard',
        'href', '/admin/guards',
        'complete', EXISTS (
          SELECT 1 FROM public.guard_roster
          WHERE society_id = p_society_id AND active
        )
      ),
      jsonb_build_object(
        'key', 'residents',
        'module_key', 'core',
        'title', 'Invite residents',
        'href', '/admin/members',
        'complete', total_units > 0
          AND joined_units * 100 >=
            total_units * COALESCE(workspace.residents_joined_percent, 75)
      ),
      jsonb_build_object(
        'key', 'payment',
        'module_key', 'billing',
        'title', 'Add UPI payment details',
        'href', '/admin/billing?tab=payment-settings',
        'complete', EXISTS (
          SELECT 1 FROM public.billing_payment_details
          WHERE society_id = p_society_id
        )
      ),
      jsonb_build_object(
        'key', 'committee',
        'module_key', 'core',
        'title', 'Add a committee member',
        'href', '/admin/members',
        'complete', EXISTS (
          SELECT 1 FROM public.memberships
          WHERE society_id = p_society_id
            AND status = 'active'
            AND roles @> ARRAY['committee']::text[]
        )
      ),
      jsonb_build_object(
        'key', 'account',
        'module_key', 'expense',
        'title', 'Add an Accounts opening balance',
        'href', '/admin/expenses/setup',
        'complete', EXISTS (
          SELECT 1 FROM public.expense_accounts
          WHERE society_id = p_society_id AND active
        )
      )
    )
  );
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.society_getting_started_dismiss(
  p_society_id uuid,
  p_dismissed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin access required';
  END IF;
  INSERT INTO public.society_workspace_settings (
    society_id,
    getting_started_dismissed_at,
    getting_started_dismissed_by
  )
  VALUES (
    p_society_id,
    CASE WHEN p_dismissed THEN now() ELSE NULL END,
    CASE WHEN p_dismissed THEN auth.uid() ELSE NULL END
  )
  ON CONFLICT (society_id) DO UPDATE
  SET getting_started_dismissed_at = EXCLUDED.getting_started_dismissed_at,
      getting_started_dismissed_by = EXCLUDED.getting_started_dismissed_by,
      updated_at = now(),
      updated_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.society_residents_joined_percent_set(
  p_society_id uuid,
  p_percent integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_value integer;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  SELECT residents_joined_percent
  INTO previous_value
  FROM public.society_workspace_settings
  WHERE society_id = p_society_id;
  INSERT INTO public.society_workspace_settings (
    society_id,
    residents_joined_percent,
    updated_by
  )
  VALUES (p_society_id, p_percent, auth.uid())
  ON CONFLICT (society_id) DO UPDATE
  SET residents_joined_percent = EXCLUDED.residents_joined_percent,
      updated_at = now(),
      updated_by = auth.uid();
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'developer',
    'workspace.residents_joined_percent.update',
    'society_workspace_settings', p_society_id::text,
    jsonb_build_object('percent', previous_value),
    jsonb_build_object('percent', p_percent)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.society_feature_request_create(
  p_society_id uuid,
  p_module_key text,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_id uuid;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE key = p_module_key AND NOT is_core
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Choose a valid feature';
  END IF;
  INSERT INTO public.society_feature_requests (
    society_id, module_key, note, created_by
  )
  VALUES (
    p_society_id,
    p_module_key,
    NULLIF(btrim(p_note), ''),
    auth.uid()
  )
  RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.society_feature_requests_get(
  p_society_id uuid
)
RETURNS TABLE (
  id uuid,
  module_key text,
  note text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Society role required';
  END IF;
  RETURN QUERY
  SELECT request.id, request.module_key, request.note, request.status,
    request.created_at
  FROM public.society_feature_requests AS request
  WHERE request.society_id = p_society_id
  ORDER BY request.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.developer_feature_requests_get()
RETURNS TABLE (
  id uuid,
  society_id uuid,
  society_name text,
  module_key text,
  note text,
  status text,
  requested_by text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  RETURN QUERY
  SELECT request.id, request.society_id, society.name, request.module_key,
    request.note, request.status, profile.full_name, request.created_at
  FROM public.society_feature_requests AS request
  JOIN public.societies AS society ON society.id = request.society_id
  JOIN public.profiles AS profile ON profile.id = request.created_by
  ORDER BY request.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.developer_feature_request_status_set(
  p_request_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  IF p_status NOT IN ('new', 'agreed', 'declined') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Choose a valid status';
  END IF;
  UPDATE public.society_feature_requests
  SET status = p_status,
      status_updated_at = now(),
      status_updated_by = auth.uid()
  WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.developer_onboarding_record_get(
  p_society_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  record public.society_onboarding_records%ROWTYPE;
  progress jsonb;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  SELECT * INTO record
  FROM public.society_onboarding_records
  WHERE society_id = p_society_id;
  IF p_society_id NOT IN (SELECT id FROM public.societies) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Society not found';
  END IF;
  SELECT public.society_getting_started_get(p_society_id)
  INTO progress;
  RETURN jsonb_build_object(
    'stage', COALESCE(record.stage, 'agreed'),
    'agreed_modules', COALESCE(record.agreed_modules, ARRAY[]::text[]),
    'go_live_on', record.go_live_on,
    'contact_name', record.contact_name,
    'contact_phone', record.contact_phone,
    'contact_email', record.contact_email,
    'notes', record.notes,
    'progress', progress
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.developer_onboarding_record_save(
  p_society_id uuid,
  p_stage text,
  p_agreed_modules text[],
  p_go_live_on date,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_stage text;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_agreed_modules) AS selected(key)
    LEFT JOIN public.modules AS module ON module.key = selected.key
    WHERE module.key IS NULL
  ) OR cardinality(p_agreed_modules) <>
      cardinality(ARRAY(SELECT DISTINCT key FROM unnest(p_agreed_modules) AS key))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Choose valid modules';
  END IF;
  SELECT stage INTO previous_stage
  FROM public.society_onboarding_records
  WHERE society_id = p_society_id;
  INSERT INTO public.society_onboarding_records (
    society_id, stage, agreed_modules, go_live_on,
    contact_name, contact_phone, contact_email, notes, updated_by
  )
  VALUES (
    p_society_id, p_stage, p_agreed_modules, p_go_live_on,
    NULLIF(btrim(p_contact_name), ''),
    NULLIF(btrim(p_contact_phone), ''),
    NULLIF(lower(btrim(p_contact_email)), ''),
    NULLIF(btrim(p_notes), ''),
    auth.uid()
  )
  ON CONFLICT (society_id) DO UPDATE
  SET stage = EXCLUDED.stage,
      agreed_modules = EXCLUDED.agreed_modules,
      go_live_on = EXCLUDED.go_live_on,
      contact_name = EXCLUDED.contact_name,
      contact_phone = EXCLUDED.contact_phone,
      contact_email = EXCLUDED.contact_email,
      notes = EXCLUDED.notes,
      updated_at = now(),
      updated_by = auth.uid();
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'developer',
    'society.onboarding.update',
    'society_onboarding_record', p_society_id::text,
    jsonb_build_object('stage', previous_stage),
    jsonb_build_object(
      'stage', p_stage,
      'module_count', cardinality(p_agreed_modules),
      'go_live_on', p_go_live_on,
      'has_contact', (
        NULLIF(btrim(p_contact_name), '') IS NOT NULL
        OR NULLIF(btrim(p_contact_phone), '') IS NOT NULL
        OR NULLIF(btrim(p_contact_email), '') IS NOT NULL
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_quick_action_pins_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_quick_action_pins_save(uuid, text[])
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_quick_action_pins_reset(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_search_records(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_calendar_get(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_getting_started_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_getting_started_dismiss(uuid, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_residents_joined_percent_set(uuid, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_feature_request_create(uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_feature_requests_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_feature_requests_get()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_feature_request_status_set(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_onboarding_record_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_onboarding_record_save(
  uuid, text, text[], date, text, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.workspace_quick_action_pins_get(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_quick_action_pins_save(uuid, text[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_quick_action_pins_reset(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_search_records(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_calendar_get(uuid, timestamptz, timestamptz)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_getting_started_get(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_getting_started_dismiss(uuid, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_residents_joined_percent_set(uuid, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_feature_request_create(uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_feature_requests_get(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.developer_feature_requests_get()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.developer_feature_request_status_set(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.developer_onboarding_record_get(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.developer_onboarding_record_save(
  uuid, text, text[], date, text, text, text, text
) TO authenticated, service_role;
