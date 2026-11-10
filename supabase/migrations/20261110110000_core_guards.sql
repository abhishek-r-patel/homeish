CREATE TABLE public.guard_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  name text NOT NULL,
  membership_id uuid,
  pin_hash text,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT guard_roster_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT guard_roster_pin_hash_check
    CHECK (pin_hash IS NULL OR char_length(pin_hash) = 60),
  CONSTRAINT guard_roster_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT guard_roster_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX guard_roster_active_name_key
  ON public.guard_roster (society_id, lower(name))
  WHERE active;
CREATE UNIQUE INDEX guard_roster_membership_key
  ON public.guard_roster (society_id, membership_id)
  WHERE membership_id IS NOT NULL;
CREATE INDEX guard_roster_society_membership_idx
  ON public.guard_roster (society_id, membership_id);
CREATE INDEX guard_roster_society_active_idx
  ON public.guard_roster (society_id, name)
  WHERE active;
CREATE INDEX guard_roster_created_by_idx ON public.guard_roster (created_by);
CREATE INDEX guard_roster_updated_by_idx ON public.guard_roster (updated_by);

CREATE TRIGGER guard_roster_set_updated_at
  BEFORE UPDATE ON public.guard_roster
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.guard_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guard_roster
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (
  id, society_id, created_at, created_by, updated_at, updated_by,
  name, membership_id, active
) ON TABLE public.guard_roster TO authenticated;

CREATE POLICY guard_roster_read
  ON public.guard_roster FOR SELECT TO authenticated
  USING (
    private.has_role(society_id, ARRAY['admin', 'committee', 'guard']::text[])
    AND private.module_enabled(society_id, 'core')
  );

CREATE OR REPLACE FUNCTION public.admin_add_guard(
  p_society_id uuid,
  p_name text,
  p_membership_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  society_mode text;
  new_guard_id uuid;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'core')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT gate_login_mode INTO society_mode
  FROM public.societies WHERE id = p_society_id;
  IF society_mode = 'individual' THEN
    IF p_membership_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id
        AND membership.id = p_membership_id
        AND membership.status = 'active'
        AND membership.roles @> ARRAY['guard']::text[]
    ) THEN
      RAISE EXCEPTION 'Choose an active guard membership.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF p_membership_id IS NOT NULL THEN
    RAISE EXCEPTION 'Shared gate guards must not be linked to a membership.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.guard_roster (
    society_id, name, membership_id, created_by, updated_by
  )
  VALUES (p_society_id, p_name, p_membership_id, current_user_id, current_user_id)
  RETURNING id INTO new_guard_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'guards.add', 'guard',
    new_guard_id::text,
    pg_catalog.jsonb_build_object(
      'name', p_name, 'membership_id', p_membership_id, 'active', true
    ),
    p_request_id
  );
  RETURN new_guard_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_guard(
  p_society_id uuid,
  p_guard_id uuid,
  p_name text,
  p_active boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.guard_roster;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'core')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO before_row
  FROM public.guard_roster
  WHERE society_id = p_society_id AND id = p_guard_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The guard was not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.guard_roster
  SET name = p_name, active = p_active, updated_by = current_user_id
  WHERE society_id = p_society_id AND id = p_guard_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin',
    CASE WHEN p_active THEN 'guards.update' ELSE 'guards.deactivate' END,
    'guard', p_guard_id::text,
    pg_catalog.jsonb_build_object('name', before_row.name, 'active', before_row.active),
    pg_catalog.jsonb_build_object('name', p_name, 'active', p_active),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_guard_pin(
  p_society_id uuid,
  p_guard_id uuid,
  p_pin text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'core')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must contain 4 to 6 digits.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.guard_roster
  SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
      updated_by = current_user_id
  WHERE society_id = p_society_id AND id = p_guard_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The active guard was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'guards.set_pin',
    'guard', p_guard_id::text, p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_gate_settings(
  p_society_id uuid,
  p_gate_login_mode text,
  p_guard_identification text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.societies;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'core')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_gate_login_mode IS NULL
     OR p_gate_login_mode NOT IN ('individual', 'shared')
     OR p_guard_identification IS NULL
     OR p_guard_identification NOT IN ('pick_name', 'pin') THEN
    RAISE EXCEPTION 'Choose valid gate identification settings.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before_row
  FROM public.societies WHERE id = p_society_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_gate_login_mode = 'individual' AND EXISTS (
    SELECT 1 FROM public.guard_roster AS guard
    WHERE guard.society_id = p_society_id AND guard.active
      AND (
        guard.membership_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = p_society_id
            AND membership.id = guard.membership_id
            AND membership.status = 'active'
            AND membership.roles @> ARRAY['guard']::text[]
        )
      )
  ) THEN
    RAISE EXCEPTION 'Link every active guard to an active guard membership first.'
      USING ERRCODE = '23514';
  END IF;

  IF p_gate_login_mode = 'shared'
     AND p_guard_identification = 'pin'
     AND EXISTS (
       SELECT 1 FROM public.guard_roster AS guard
       WHERE guard.society_id = p_society_id AND guard.active
         AND guard.pin_hash IS NULL
     ) THEN
    RAISE EXCEPTION 'Set a PIN for every active guard first.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.societies
  SET gate_login_mode = p_gate_login_mode,
      guard_identification = p_guard_identification,
      updated_by = current_user_id
  WHERE id = p_society_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'society.update_gate_settings',
    'society', p_society_id::text,
    pg_catalog.jsonb_build_object(
      'gate_login_mode', before_row.gate_login_mode,
      'guard_identification', before_row.guard_identification
    ),
    pg_catalog.jsonb_build_object(
      'gate_login_mode', p_gate_login_mode,
      'guard_identification', p_guard_identification
    ),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_identify(
  p_society_id uuid,
  p_guard_id uuid DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS TABLE (
  guard_id uuid,
  guard_name text,
  locked boolean,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  login_mode text;
  identification_mode text;
  candidate public.guard_roster;
  rate_key text;
  rate_window_started timestamptz;
  failures integer;
BEGIN
  IF caller_id IS NULL
     OR NOT private.has_role(p_society_id, ARRAY['guard']::text[])
     OR NOT private.module_enabled(p_society_id, 'core') THEN
    RAISE EXCEPTION 'Guard access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT society.gate_login_mode, society.guard_identification
  INTO login_mode, identification_mode
  FROM public.societies AS society WHERE society.id = p_society_id;

  IF login_mode = 'individual' THEN
    SELECT guard.id, guard.name INTO guard_id, guard_name
    FROM public.guard_roster AS guard
    JOIN public.memberships AS membership
      ON membership.society_id = guard.society_id
      AND membership.id = guard.membership_id
    WHERE guard.society_id = p_society_id
      AND guard.active
      AND membership.user_id = caller_id
      AND membership.status = 'active';
    IF guard_id IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, false, 0;
      RETURN;
    END IF;
    RETURN QUERY SELECT guard_id, guard_name, false, 0;
    RETURN;
  END IF;

  IF p_guard_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 0;
    RETURN;
  END IF;

  SELECT * INTO candidate
  FROM public.guard_roster
  WHERE society_id = p_society_id AND id = p_guard_id AND active;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 0;
    RETURN;
  END IF;

  IF identification_mode = 'pick_name' THEN
    IF p_pin IS NOT NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, false, 0;
      RETURN;
    END IF;
    RETURN QUERY SELECT candidate.id, candidate.name, false, 0;
    RETURN;
  END IF;

  rate_key := 'guard-pin:' || pg_catalog.encode(
    extensions.digest(p_guard_id::text, 'sha256'), 'hex'
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(rate_key, 0)
  );
  SELECT rate_limits.window_start, rate_limits.count
  INTO rate_window_started, failures
  FROM public.rate_limits
  WHERE key = rate_key
  ORDER BY rate_limits.window_start DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND AND failures >= 5
     AND rate_window_started + interval '15 minutes' > clock_timestamp() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, true,
      GREATEST(
        1,
        pg_catalog.ceil(
          extract(epoch FROM (
            rate_window_started + interval '15 minutes' - clock_timestamp()
          ))
        )::integer
      );
    RETURN;
  END IF;

  IF NOT FOUND
     OR rate_window_started + interval '15 minutes' <= clock_timestamp() THEN
    DELETE FROM public.rate_limits WHERE key = rate_key;
    rate_window_started := clock_timestamp();
    failures := 0;
  END IF;

  IF p_pin ~ '^[0-9]{4,6}$' AND candidate.pin_hash IS NOT NULL
     AND extensions.crypt(p_pin, candidate.pin_hash) = candidate.pin_hash THEN
    DELETE FROM public.rate_limits WHERE key = rate_key;
    RETURN QUERY SELECT candidate.id, candidate.name, false, 0;
    RETURN;
  END IF;

  IF failures >= 4 THEN
    DELETE FROM public.rate_limits WHERE key = rate_key;
    rate_window_started := clock_timestamp();
    INSERT INTO public.rate_limits (key, window_start, count)
    VALUES (rate_key, rate_window_started, 5);
    RETURN QUERY SELECT NULL::uuid, NULL::text, true,
      GREATEST(
        1,
        pg_catalog.ceil(
          extract(epoch FROM (
            rate_window_started + interval '15 minutes' - clock_timestamp()
          ))
        )::integer
      );
    RETURN;
  END IF;

  INSERT INTO public.rate_limits AS current_limit (key, window_start, count)
  VALUES (rate_key, rate_window_started, failures + 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = current_limit.count + 1;
  RETURN QUERY SELECT NULL::uuid, NULL::text, false, 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_unit_contacts(p_unit_id uuid)
RETURNS TABLE (full_name text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  unit_society_id uuid;
BEGIN
  SELECT unit.society_id INTO unit_society_id
  FROM public.units AS unit
  WHERE unit.id = p_unit_id AND unit.active;
  IF unit_society_id IS NULL THEN
    RAISE EXCEPTION 'The unit was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_role(unit_society_id, ARRAY['guard', 'admin']::text[])
     OR NOT private.module_enabled(unit_society_id, 'core') THEN
    RAISE EXCEPTION 'Guard access is required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT profile.full_name, profile.phone
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  WHERE occupant.unit_id = p_unit_id
    AND occupant.society_id = unit_society_id
    AND occupant.status = 'active'
    AND occupant.is_approver
    AND membership.status = 'active'
    AND profile.status = 'active'
  ORDER BY occupant.is_primary DESC, profile.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_guard(uuid, text, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_guard(uuid, uuid, text, boolean, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_guard_pin(uuid, uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_gate_settings(uuid, text, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_identify(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_unit_contacts(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_guard(uuid, text, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_guard(uuid, uuid, text, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_guard_pin(uuid, uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_gate_settings(uuid, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_identify(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_unit_contacts(uuid)
  TO authenticated;
