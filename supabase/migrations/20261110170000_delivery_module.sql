CREATE TABLE public.delivery_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  company text NOT NULL,
  delivery_person text,
  delivery_type text NOT NULL,
  photo_path text,
  status text NOT NULL DEFAULT 'pending_response',
  client_request_id uuid NOT NULL,
  respond_by timestamptz,
  decision_source text,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decided_at timestamptz,
  override_reason text,
  handled_by_guard_id uuid NOT NULL,
  received_at timestamptz,
  collected_at timestamptz,
  collected_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT delivery_entries_company_check
    CHECK (char_length(btrim(company)) BETWEEN 1 AND 60),
  CONSTRAINT delivery_entries_person_check
    CHECK (delivery_person IS NULL OR char_length(btrim(delivery_person)) <= 120),
  CONSTRAINT delivery_entries_type_check
    CHECK (delivery_type IN ('food', 'parcel', 'grocery', 'other')),
  CONSTRAINT delivery_entries_status_check
    CHECK (status IN (
      'pending_response', 'allowed', 'left_at_gate', 'denied', 'collected', 'closed'
    )),
  CONSTRAINT delivery_entries_decision_source_check
    CHECK (decision_source IS NULL OR decision_source IN (
      'resident', 'preference', 'guard_override'
    )),
  CONSTRAINT delivery_entries_decision_source_required_check
    CHECK (
      (status IN ('allowed', 'left_at_gate', 'denied', 'collected'))
      = (decision_source IS NOT NULL)
      OR (
        status = 'closed'
        AND decision_source IN ('guard_override')
      )
    ),
  CONSTRAINT delivery_entries_respond_by_check
    CHECK (status <> 'pending_response' OR respond_by IS NOT NULL),
  CONSTRAINT delivery_entries_decided_at_check
    CHECK (status NOT IN ('allowed', 'left_at_gate', 'denied', 'collected', 'closed')
      OR decided_at IS NOT NULL),
  CONSTRAINT delivery_entries_override_reason_check
    CHECK (
      (decision_source = 'guard_override'
        AND char_length(btrim(override_reason)) BETWEEN 1 AND 500)
      OR (decision_source IS DISTINCT FROM 'guard_override'
        AND override_reason IS NULL)
    ),
  CONSTRAINT delivery_entries_received_at_check
    CHECK (
      (status IN ('left_at_gate', 'collected')) = (received_at IS NOT NULL)
    ),
  CONSTRAINT delivery_entries_collected_check
    CHECK (
      (status = 'collected'
        AND collected_at IS NOT NULL AND collected_by IS NOT NULL)
      OR (status <> 'collected'
        AND collected_at IS NULL AND collected_by IS NULL)
    ),
  CONSTRAINT delivery_entries_collected_time_check
    CHECK (collected_at IS NULL OR collected_at >= received_at),
  CONSTRAINT delivery_entries_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT delivery_entries_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT delivery_entries_guard_same_society_fkey
    FOREIGN KEY (society_id, handled_by_guard_id)
    REFERENCES public.guard_roster (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT delivery_entries_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE INDEX delivery_entries_society_status_created_idx
  ON public.delivery_entries (society_id, status, created_at DESC);
CREATE INDEX delivery_entries_society_unit_created_idx
  ON public.delivery_entries (society_id, unit_id, created_at DESC);
CREATE INDEX delivery_entries_society_created_idx
  ON public.delivery_entries (society_id, created_at DESC);
CREATE INDEX delivery_entries_uncollected_idx
  ON public.delivery_entries (society_id, received_at)
  WHERE status = 'left_at_gate';
CREATE INDEX delivery_entries_guard_fk_idx
  ON public.delivery_entries (society_id, handled_by_guard_id);
CREATE INDEX delivery_entries_created_by_idx
  ON public.delivery_entries (created_by);
CREATE INDEX delivery_entries_updated_by_idx
  ON public.delivery_entries (updated_by);
CREATE INDEX delivery_entries_decided_by_idx
  ON public.delivery_entries (decided_by)
  WHERE decided_by IS NOT NULL;
CREATE INDEX delivery_entries_collected_by_idx
  ON public.delivery_entries (collected_by)
  WHERE collected_by IS NOT NULL;

CREATE TABLE public.delivery_preferences (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  rule text NOT NULL DEFAULT 'ask',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT delivery_preferences_pkey PRIMARY KEY (society_id, unit_id),
  CONSTRAINT delivery_preferences_rule_check
    CHECK (rule IN ('ask', 'always_allow', 'always_leave_at_gate')),
  CONSTRAINT delivery_preferences_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE CASCADE
);
CREATE INDEX delivery_preferences_updated_by_idx
  ON public.delivery_preferences (updated_by);

CREATE TRIGGER delivery_entries_set_updated_at
  BEFORE UPDATE ON public.delivery_entries
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER delivery_preferences_set_updated_at
  BEFORE UPDATE ON public.delivery_preferences
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.delivery_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_entries, public.delivery_preferences
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (
  id, society_id, created_at, unit_id, company, delivery_type, status,
  client_request_id, respond_by, decision_source, decided_at,
  handled_by_guard_id, received_at, collected_at, collected_by
) ON TABLE public.delivery_entries TO authenticated;
GRANT SELECT (society_id, unit_id, rule, updated_at)
  ON TABLE public.delivery_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.delivery_entries, public.delivery_preferences TO service_role;

CREATE POLICY delivery_entries_read
  ON public.delivery_entries FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'delivery')
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee', 'guard']::text[])
      OR private.occupies_unit(unit_id)
    )
  );
CREATE POLICY delivery_preferences_read
  ON public.delivery_preferences FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'delivery')
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee']::text[])
      OR private.occupies_unit(unit_id)
    )
  );

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
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
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
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
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

CREATE OR REPLACE FUNCTION public.delivery_settings_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'delivery')
     OR NOT private.has_role(
       p_society_id, ARRAY['admin', 'committee', 'guard', 'resident']::text[]
     ) THEN
    RAISE EXCEPTION 'Delivery settings access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'response_timeout_minutes', 3,
    'uncollected_days', 3,
    'leave_at_gate_enabled', true
  ) || COALESCE(settings, '{}'::jsonb)
  INTO result
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'delivery';
  RETURN COALESCE(result, jsonb_build_object(
    'response_timeout_minutes', 3,
    'uncollected_days', 3,
    'leave_at_gate_enabled', true
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_settings_update(
  p_society_id uuid,
  p_settings jsonb,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before_settings jsonb;
  after_settings jsonb;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'delivery') THEN
    RAISE EXCEPTION 'The delivery module is disabled.' USING ERRCODE = '42501';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object'
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_settings) AS item(key)
       WHERE item.key NOT IN (
         'response_timeout_minutes', 'uncollected_days',
         'leave_at_gate_enabled'
       )
     ) THEN
    RAISE EXCEPTION 'Delivery settings are invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_settings ? 'response_timeout_minutes' AND (
    jsonb_typeof(p_settings->'response_timeout_minutes') <> 'number'
    OR (p_settings->>'response_timeout_minutes')::numeric <>
       trunc((p_settings->>'response_timeout_minutes')::numeric)
    OR (p_settings->>'response_timeout_minutes')::numeric NOT BETWEEN 1 AND 30
  ) THEN
    RAISE EXCEPTION 'Delivery response timeout is invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF p_settings ? 'uncollected_days' AND (
    jsonb_typeof(p_settings->'uncollected_days') <> 'number'
    OR (p_settings->>'uncollected_days')::numeric <>
       trunc((p_settings->>'uncollected_days')::numeric)
    OR (p_settings->>'uncollected_days')::numeric NOT BETWEEN 1 AND 90
  ) THEN
    RAISE EXCEPTION 'Uncollected days must be between 1 and 90.'
      USING ERRCODE = '22023';
  END IF;
  IF p_settings ? 'leave_at_gate_enabled'
     AND jsonb_typeof(p_settings->'leave_at_gate_enabled') <> 'boolean' THEN
    RAISE EXCEPTION 'Leave-at-gate setting is invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT settings INTO before_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'delivery'
  FOR UPDATE;
  INSERT INTO public.module_configs (
    society_id, module_key, enabled, settings, updated_by
  )
  VALUES (
    p_society_id, 'delivery', false,
    jsonb_build_object(
      'response_timeout_minutes', 3,
      'uncollected_days', 3,
      'leave_at_gate_enabled', true
    ) || COALESCE(before_settings, '{}'::jsonb) || p_settings,
    auth.uid()
  )
  ON CONFLICT (society_id, module_key) DO UPDATE
  SET settings = EXCLUDED.settings, updated_by = auth.uid()
  RETURNING settings INTO after_settings;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'delivery.settings.update',
    'module_config', p_society_id::text,
    COALESCE(before_settings, '{}'::jsonb), after_settings, p_request_id
  );
  RETURN after_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_preference_get(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS TABLE (
  society_id uuid,
  unit_id uuid,
  rule text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.module_enabled(p_society_id, 'delivery')
     OR NOT (
       private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
       OR private.occupies_unit(p_unit_id)
     ) THEN
    RAISE EXCEPTION 'Delivery preference access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units unit
    WHERE unit.society_id = p_society_id
      AND unit.id = p_unit_id
      AND unit.active
  ) THEN
    RAISE EXCEPTION 'The unit was not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT preference.society_id, preference.unit_id, preference.rule,
    preference.updated_at
  FROM public.delivery_preferences preference
  WHERE preference.society_id = p_society_id
    AND preference.unit_id = p_unit_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT p_society_id, p_unit_id, 'ask'::text, NULL::timestamptz;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_preference_set(
  p_unit_id uuid,
  p_rule text,
  p_request_id text
)
RETURNS public.delivery_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  society uuid;
  before_rule text;
  leave_enabled boolean;
  saved public.delivery_preferences;
BEGIN
  SELECT unit.society_id INTO society
  FROM public.units unit
  WHERE unit.id = p_unit_id AND unit.active;
  IF society IS NULL
     OR NOT private.module_enabled(society, 'delivery')
     OR NOT private.society_writable(society)
     OR NOT EXISTS (
       SELECT 1 FROM public.unit_occupants occupant
       JOIN public.memberships membership
         ON membership.society_id = occupant.society_id
         AND membership.id = occupant.membership_id
       WHERE occupant.society_id = society
         AND occupant.unit_id = p_unit_id
         AND occupant.status = 'active' AND occupant.is_approver
         AND membership.user_id = actor_id
         AND membership.status = 'active'
         AND membership.roles @> ARRAY['resident']::text[]
     ) THEN
    RAISE EXCEPTION 'A unit approver is required.' USING ERRCODE = '42501';
  END IF;
  IF p_rule IS NULL
     OR p_rule NOT IN ('ask', 'always_allow', 'always_leave_at_gate') THEN
    RAISE EXCEPTION 'Delivery preference is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(
    (settings->>'leave_at_gate_enabled')::boolean, true
  ) INTO leave_enabled
  FROM public.module_configs
  WHERE society_id = society AND module_key = 'delivery';
  IF p_rule = 'always_leave_at_gate' AND NOT COALESCE(leave_enabled, true) THEN
    RAISE EXCEPTION 'Leave at gate is disabled by the society.'
      USING ERRCODE = '22023';
  END IF;
  SELECT rule INTO before_rule
  FROM public.delivery_preferences
  WHERE society_id = society AND unit_id = p_unit_id
  FOR UPDATE;
  INSERT INTO public.delivery_preferences (
    society_id, unit_id, rule, updated_by
  )
  VALUES (society, p_unit_id, p_rule, actor_id)
  ON CONFLICT (society_id, unit_id) DO UPDATE
  SET rule = EXCLUDED.rule, updated_by = EXCLUDED.updated_by
  RETURNING * INTO saved;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    society, actor_id, 'resident', 'delivery.preference.update',
    'delivery_preference', p_unit_id::text,
    jsonb_build_object('rule', before_rule),
    jsonb_build_object('rule', saved.rule), p_request_id
  );
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_create_entry(
  p_actor_id uuid,
  p_society_id uuid,
  p_unit_id uuid,
  p_guard_id uuid,
  p_company text,
  p_delivery_person text,
  p_delivery_type text,
  p_photo_path text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS public.delivery_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings jsonb;
  timeout_minutes integer;
  leave_enabled boolean;
  preference_rule text := 'ask';
  entry public.delivery_entries;
  approver record;
  initial_status text;
  decision text;
  received timestamptz;
BEGIN
  IF p_actor_id IS NULL
     OR NOT private.user_has_role(
       p_society_id, ARRAY['guard', 'admin']::text[], p_actor_id
     )
     OR NOT private.module_enabled(p_society_id, 'delivery')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Delivery gate access is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guard_roster guard_row
    WHERE guard_row.society_id = p_society_id
      AND guard_row.id = p_guard_id AND guard_row.active
      AND (
        guard_row.membership_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.id = guard_row.membership_id
            AND membership.user_id = p_actor_id
            AND membership.status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'An identified active guard is required.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units unit
    WHERE unit.id = p_unit_id AND unit.society_id = p_society_id
      AND unit.active
  ) THEN
    RAISE EXCEPTION 'The unit was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.unit_occupants occupant
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND occupant.is_approver
      AND membership.status = 'active'
      AND membership.roles @> ARRAY['resident']::text[]
  ) THEN
    RAISE EXCEPTION 'The unit has no active delivery approver.'
      USING ERRCODE = '23514';
  END IF;
  IF p_company IS NULL OR char_length(btrim(p_company)) NOT BETWEEN 1 AND 60
     OR p_delivery_type IS NULL
     OR p_delivery_type NOT IN ('food', 'parcel', 'grocery', 'other')
     OR (p_delivery_person IS NOT NULL
       AND char_length(btrim(p_delivery_person)) > 120) THEN
    RAISE EXCEPTION 'Delivery details are invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_photo_path IS NOT NULL AND p_photo_path !~ (
    '^' || p_society_id::text || '/' || p_unit_id::text ||
    '/deliveries/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
    '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
  ) THEN
    RAISE EXCEPTION 'The delivery photo path is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO entry
  FROM public.delivery_entries
  WHERE society_id = p_society_id
    AND created_by = p_actor_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN entry; END IF;

  SELECT config.settings INTO settings
  FROM public.module_configs config
  WHERE society_id = p_society_id AND module_key = 'delivery';
  timeout_minutes := COALESCE(
    (settings->>'response_timeout_minutes')::integer, 3
  );
  leave_enabled := COALESCE(
    (settings->>'leave_at_gate_enabled')::boolean, true
  );
  SELECT preference.rule INTO preference_rule
  FROM public.delivery_preferences preference
  WHERE preference.society_id = p_society_id
    AND preference.unit_id = p_unit_id;
  IF preference_rule = 'always_leave_at_gate' AND NOT leave_enabled THEN
    preference_rule := 'ask';
  END IF;
  IF preference_rule = 'always_allow' THEN
    initial_status := 'allowed';
    decision := 'preference';
  ELSIF preference_rule = 'always_leave_at_gate' THEN
    initial_status := 'left_at_gate';
    decision := 'preference';
    received := clock_timestamp();
  ELSE
    initial_status := 'pending_response';
    decision := NULL;
  END IF;

  INSERT INTO public.delivery_entries (
    society_id, unit_id, company, delivery_person, delivery_type,
    photo_path, status, client_request_id, respond_by, decision_source,
    decided_by, decided_at, handled_by_guard_id, received_at, created_by
  )
  VALUES (
    p_society_id, p_unit_id, btrim(p_company),
    NULLIF(btrim(COALESCE(p_delivery_person, '')), ''),
    p_delivery_type, p_photo_path, initial_status, p_client_request_id,
    CASE WHEN initial_status = 'pending_response'
      THEN clock_timestamp() + make_interval(mins => timeout_minutes)
      ELSE NULL END,
    decision,
    CASE WHEN decision IS NOT NULL THEN p_actor_id ELSE NULL END,
    CASE WHEN decision IS NOT NULL THEN clock_timestamp() ELSE NULL END,
    p_guard_id, received, p_actor_id
  )
  RETURNING * INTO entry;

  FOR approver IN
    SELECT DISTINCT membership.user_id
    FROM public.unit_occupants occupant
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND occupant.is_approver
      AND membership.status = 'active'
      AND membership.roles @> ARRAY['resident']::text[]
  LOOP
    PERFORM private.create_notification(
      p_society_id, approver.user_id,
      CASE WHEN initial_status = 'pending_response'
        THEN 'delivery_pending' ELSE 'delivery_decided' END,
      CASE WHEN initial_status = 'pending_response'
        THEN 'Delivery at the gate' ELSE 'Delivery preference applied' END,
      CASE initial_status
        WHEN 'allowed' THEN 'Your delivery was allowed to go inside.'
        WHEN 'left_at_gate' THEN 'Your delivery was left at the security desk.'
        ELSE 'A delivery is waiting for your response.'
      END,
      'delivery_entry', entry.id, p_request_id
    );
  END LOOP;
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_respond(
  p_entry_id uuid,
  p_decision text,
  p_request_id text
)
RETURNS public.delivery_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  entry public.delivery_entries;
  leave_enabled boolean;
BEGIN
  SELECT * INTO entry FROM public.delivery_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT private.module_enabled(entry.society_id, 'delivery')
     OR NOT private.society_writable(entry.society_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.unit_occupants occupant
       JOIN public.memberships membership
         ON membership.society_id = occupant.society_id
         AND membership.id = occupant.membership_id
       WHERE occupant.society_id = entry.society_id
         AND occupant.unit_id = entry.unit_id
         AND occupant.status = 'active' AND occupant.is_approver
         AND membership.user_id = actor_id
         AND membership.status = 'active'
         AND membership.roles @> ARRAY['resident']::text[]
     ) THEN
    RAISE EXCEPTION 'Delivery response access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL
     OR p_decision NOT IN ('allowed', 'left_at_gate', 'denied') THEN
    RAISE EXCEPTION 'Delivery decision is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(
    (settings->>'leave_at_gate_enabled')::boolean, true
  ) INTO leave_enabled
  FROM public.module_configs
  WHERE society_id = entry.society_id AND module_key = 'delivery';
  IF p_decision = 'left_at_gate' AND NOT COALESCE(leave_enabled, true) THEN
    RAISE EXCEPTION 'Leave at gate is disabled by the society.'
      USING ERRCODE = '22023';
  END IF;
  IF entry.status <> 'pending_response'
     OR entry.respond_by <= clock_timestamp() THEN
    RAISE EXCEPTION 'The delivery request has closed.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.delivery_entries
  SET status = p_decision,
      decision_source = 'resident',
      decided_by = actor_id,
      decided_at = clock_timestamp(),
      received_at = CASE WHEN p_decision = 'left_at_gate'
        THEN clock_timestamp() ELSE NULL END
  WHERE id = p_entry_id
  RETURNING * INTO entry;
  PERFORM private.create_notification(
    entry.society_id, entry.created_by, 'delivery_decided',
    'Resident responded to delivery',
    'The unit resident has responded to the delivery request.',
    'delivery_entry', entry.id, p_request_id
  );
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_override(
  p_actor_id uuid,
  p_entry_id uuid,
  p_guard_id uuid,
  p_decision text,
  p_reason text,
  p_request_id text
)
RETURNS public.delivery_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.delivery_entries;
  leave_enabled boolean;
  approver record;
BEGIN
  SELECT * INTO entry FROM public.delivery_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT private.user_has_role(
       entry.society_id, ARRAY['guard']::text[], p_actor_id
     )
     OR NOT private.module_enabled(entry.society_id, 'delivery')
     OR NOT private.society_writable(entry.society_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.guard_roster guard_row
       WHERE guard_row.society_id = entry.society_id
         AND guard_row.id = p_guard_id AND guard_row.active
         AND (guard_row.membership_id IS NULL OR EXISTS (
           SELECT 1 FROM public.memberships membership
           WHERE membership.id = guard_row.membership_id
             AND membership.user_id = p_actor_id
             AND membership.status = 'active'
         ))
     ) THEN
    RAISE EXCEPTION 'Delivery gate access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL
     OR p_decision NOT IN (
       'allowed', 'left_at_gate', 'denied', 'closed'
     )
     OR p_reason IS NULL
     OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'A decision and reason are required.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(
    (settings->>'leave_at_gate_enabled')::boolean, true
  ) INTO leave_enabled
  FROM public.module_configs
  WHERE society_id = entry.society_id AND module_key = 'delivery';
  IF p_decision = 'left_at_gate' AND NOT COALESCE(leave_enabled, true) THEN
    RAISE EXCEPTION 'Leave at gate is disabled by the society.'
      USING ERRCODE = '22023';
  END IF;
  IF entry.status <> 'pending_response'
     OR entry.respond_by > clock_timestamp() THEN
    RAISE EXCEPTION 'The delivery cannot be overridden yet.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.delivery_entries
  SET status = p_decision,
      decision_source = 'guard_override',
      decided_by = p_actor_id,
      decided_at = clock_timestamp(),
      override_reason = btrim(p_reason),
      handled_by_guard_id = p_guard_id,
      received_at = CASE WHEN p_decision = 'left_at_gate'
        THEN clock_timestamp() ELSE NULL END
  WHERE id = p_entry_id
  RETURNING * INTO entry;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    entry.society_id, p_actor_id, 'guard', 'delivery.override',
    'delivery_entry', entry.id::text,
    jsonb_build_object('decision', p_decision, 'reason', btrim(p_reason)),
    p_request_id
  );
  FOR approver IN
    SELECT DISTINCT membership.user_id
    FROM public.unit_occupants occupant
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.society_id = entry.society_id
      AND occupant.unit_id = entry.unit_id
      AND occupant.status = 'active' AND occupant.is_approver
      AND membership.status = 'active'
      AND membership.roles @> ARRAY['resident']::text[]
  LOOP
    PERFORM private.create_notification(
      entry.society_id, approver.user_id, 'delivery_decided',
      'Guard handled the delivery',
      'The guard recorded a delivery decision after the response window.',
      'delivery_entry', entry.id, p_request_id
    );
  END LOOP;
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION private.delivery_mark_collected(
  p_actor_id uuid,
  p_entry_id uuid,
  p_guard_id uuid,
  p_request_id text
)
RETURNS public.delivery_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.delivery_entries;
  actor_role text;
BEGIN
  SELECT * INTO entry FROM public.delivery_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND
     OR NOT private.module_enabled(entry.society_id, 'delivery')
     OR NOT private.society_writable(entry.society_id) THEN
    RAISE EXCEPTION 'Delivery was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_guard_id IS NOT NULL THEN
    actor_role := 'guard';
    IF NOT private.user_has_role(
      entry.society_id, ARRAY['guard']::text[], p_actor_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.guard_roster guard_row
      WHERE guard_row.society_id = entry.society_id
        AND guard_row.id = p_guard_id AND guard_row.active
        AND (guard_row.membership_id IS NULL OR EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.id = guard_row.membership_id
            AND membership.user_id = p_actor_id
            AND membership.status = 'active'
        ))
    ) THEN
      RAISE EXCEPTION 'An identified active guard is required.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    actor_role := 'resident';
    IF NOT private.user_has_role(
      entry.society_id, ARRAY['resident']::text[], p_actor_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.unit_occupants occupant
      JOIN public.memberships membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.society_id = entry.society_id
        AND occupant.unit_id = entry.unit_id
        AND occupant.status = 'active'
        AND membership.user_id = p_actor_id
        AND membership.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Unit resident access is required.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF entry.status <> 'left_at_gate' THEN
    RAISE EXCEPTION 'Only deliveries left at the gate can be collected.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.delivery_entries
  SET status = 'collected',
      collected_at = clock_timestamp(),
      collected_by = p_actor_id
  WHERE id = p_entry_id
  RETURNING * INTO entry;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    entry.society_id, p_actor_id, actor_role, 'delivery.collect',
    'delivery_entry', entry.id::text,
    jsonb_build_object('status', entry.status), p_request_id
  );
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_mark_collected_resident(
  p_entry_id uuid,
  p_request_id text
)
RETURNS public.delivery_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.delivery_mark_collected(
    auth.uid(), p_entry_id, NULL, p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_mark_collected_guard(
  p_actor_id uuid,
  p_entry_id uuid,
  p_guard_id uuid,
  p_request_id text
)
RETURNS public.delivery_entries
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.delivery_mark_collected(
    p_actor_id, p_entry_id, p_guard_id, p_request_id
  )
$$;

CREATE OR REPLACE FUNCTION public.delivery_list_entries(
  p_society_id uuid,
  p_unit_id uuid,
  p_scope text
)
RETURNS TABLE (
  id uuid,
  unit_id uuid,
  company text,
  delivery_person text,
  delivery_type text,
  photo_path text,
  status text,
  created_at timestamptz,
  respond_by timestamptz,
  is_response_overdue boolean,
  decision_source text,
  decided_at timestamptz,
  handled_by_guard_id uuid,
  received_at timestamptz,
  collected_at timestamptz,
  collected_by uuid,
  is_uncollected_overdue boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resident_view boolean;
  threshold_days integer;
  society_timezone text;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'delivery') THEN
    RAISE EXCEPTION 'Delivery module is disabled.' USING ERRCODE = '42501';
  END IF;
  resident_view :=
    private.has_role(p_society_id, ARRAY['resident']::text[])
    AND NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'guard']::text[]
    );
  IF resident_view AND (
    p_unit_id IS NULL OR NOT private.occupies_unit(p_unit_id)
  ) THEN
    RAISE EXCEPTION 'Unit delivery access is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT resident_view AND NOT private.has_role(
    p_society_id, ARRAY['admin', 'committee', 'guard']::text[]
  ) THEN
    RAISE EXCEPTION 'Delivery list access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_scope IS NULL
     OR p_scope NOT IN ('all', 'waiting', 'uncollected', 'today') THEN
    RAISE EXCEPTION 'Delivery list scope is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT
    COALESCE((config.settings->>'uncollected_days')::integer, 3),
    society.timezone
  INTO threshold_days, society_timezone
  FROM public.societies society
  LEFT JOIN public.module_configs config
    ON config.society_id = society.id AND config.module_key = 'delivery'
  WHERE society.id = p_society_id;
  IF threshold_days IS NULL THEN threshold_days := 3; END IF;
  society_timezone := COALESCE(society_timezone, 'Asia/Kolkata');

  RETURN QUERY
  SELECT entry.id, entry.unit_id, entry.company, entry.delivery_person,
    entry.delivery_type, entry.photo_path, entry.status, entry.created_at,
    entry.respond_by,
    entry.status = 'pending_response'
      AND entry.respond_by <= clock_timestamp(),
    entry.decision_source, entry.decided_at,
    entry.handled_by_guard_id, entry.received_at, entry.collected_at,
    entry.collected_by,
    entry.status = 'left_at_gate'
      AND entry.received_at <= clock_timestamp()
        - make_interval(days => threshold_days)
  FROM public.delivery_entries entry
  WHERE entry.society_id = p_society_id
    AND (NOT resident_view OR entry.unit_id = p_unit_id)
    AND (
      p_scope = 'all'
      OR (p_scope = 'waiting' AND entry.status = 'pending_response')
      OR (p_scope = 'uncollected' AND entry.status = 'left_at_gate')
      OR (
        p_scope = 'today'
        AND entry.created_at >= (
          date_trunc('day', clock_timestamp() AT TIME ZONE society_timezone)
          AT TIME ZONE society_timezone
        )
      )
    )
  ORDER BY entry.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_settings_get(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_settings_update(uuid, jsonb, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_preference_get(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_preference_set(uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_create_entry(
  uuid, uuid, uuid, uuid, text, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_respond(uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_override(
  uuid, uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.delivery_mark_collected(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delivery_mark_collected_resident(uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_mark_collected_guard(
  uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_list_entries(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.delivery_settings_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_settings_update(uuid, jsonb, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_preference_get(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_preference_set(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_create_entry(
  uuid, uuid, uuid, uuid, text, text, text, text, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.delivery_respond(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_override(
  uuid, uuid, uuid, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION private.delivery_mark_collected(
  uuid, uuid, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.delivery_mark_collected_resident(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_mark_collected_guard(
  uuid, uuid, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.delivery_list_entries(uuid, uuid, text)
  TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'delivery_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_entries;
  END IF;
END;
$$;
