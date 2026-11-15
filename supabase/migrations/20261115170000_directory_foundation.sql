ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN (
    'core',
    'visitor',
    'delivery',
    'billing',
    'service_request',
    'staff',
    'housekeeping',
    'amc',
    'notice',
    'amenity',
    'directory'
  )
);

INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('directory', 'Resident & Vehicle Directory', false, 10);

CREATE TABLE public.directory_preferences (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL,
  name_visible boolean NOT NULL DEFAULT true,
  unit_visible boolean NOT NULL DEFAULT true,
  phone_visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, membership_id),
  CONSTRAINT directory_preferences_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX directory_preferences_updated_by_idx
  ON public.directory_preferences (updated_by);

CREATE TABLE public.directory_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  vehicle_type text NOT NULL,
  registration_number text NOT NULL,
  tag_number text,
  status text NOT NULL DEFAULT 'active',
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT directory_vehicles_type_check
    CHECK (vehicle_type IN ('car', 'two_wheeler', 'other')),
  CONSTRAINT directory_vehicles_registration_check
    CHECK (
      char_length(registration_number) BETWEEN 4 AND 16
      AND registration_number = upper(regexp_replace(btrim(registration_number), '[[:space:]-]', '', 'g'))
      AND registration_number ~ '^[A-Z0-9]+$'
    ),
  CONSTRAINT directory_vehicles_tag_check
    CHECK (tag_number IS NULL OR char_length(btrim(tag_number)) BETWEEN 1 AND 40),
  CONSTRAINT directory_vehicles_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT directory_vehicles_verification_check
    CHECK ((verified_at IS NULL) = (verified_by IS NULL)),
  CONSTRAINT directory_vehicles_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT directory_vehicles_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT directory_vehicles_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT directory_vehicles_actor_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE UNIQUE INDEX directory_vehicles_active_registration_key
  ON public.directory_vehicles (society_id, registration_number)
  WHERE status = 'active';
CREATE INDEX directory_vehicles_unit_status_idx
  ON public.directory_vehicles (society_id, unit_id, status);
CREATE INDEX directory_vehicles_membership_idx
  ON public.directory_vehicles (society_id, membership_id);
CREATE INDEX directory_vehicles_created_by_idx
  ON public.directory_vehicles (created_by);
CREATE INDEX directory_vehicles_verified_by_idx
  ON public.directory_vehicles (verified_by);
CREATE INDEX directory_vehicles_updated_by_idx
  ON public.directory_vehicles (updated_by);

CREATE TABLE public.directory_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  full_name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT directory_emergency_contacts_name_check
    CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  CONSTRAINT directory_emergency_contacts_relationship_check
    CHECK (char_length(btrim(relationship)) BETWEEN 1 AND 80),
  CONSTRAINT directory_emergency_contacts_phone_check
    CHECK (phone ~ '^[+]?[0-9]{10,15}$'),
  CONSTRAINT directory_emergency_contacts_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT directory_emergency_contacts_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT directory_emergency_contacts_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT directory_emergency_contacts_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT directory_emergency_contacts_actor_request_key
    UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX directory_emergency_contacts_unit_idx
  ON public.directory_emergency_contacts (society_id, unit_id);
CREATE INDEX directory_emergency_contacts_membership_idx
  ON public.directory_emergency_contacts (society_id, membership_id);
CREATE INDEX directory_emergency_contacts_created_by_idx
  ON public.directory_emergency_contacts (created_by);
CREATE INDEX directory_emergency_contacts_updated_by_idx
  ON public.directory_emergency_contacts (updated_by);

CREATE TRIGGER directory_vehicles_set_updated_at
  BEFORE UPDATE ON public.directory_vehicles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER directory_emergency_contacts_set_updated_at
  BEFORE UPDATE ON public.directory_emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER directory_preferences_set_updated_at
  BEFORE UPDATE ON public.directory_preferences
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.directory_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_emergency_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.directory_preferences,
  public.directory_vehicles,
  public.directory_emergency_contacts
  FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY directory_preferences_no_direct_access
  ON public.directory_preferences FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY directory_vehicles_no_direct_access
  ON public.directory_vehicles FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY directory_emergency_contacts_no_direct_access
  ON public.directory_emergency_contacts FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION public.directory_set_visibility(
  p_society_id uuid,
  p_name_visible boolean,
  p_unit_visible boolean,
  p_phone_visible boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_membership_id uuid;
  before_row public.directory_preferences;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN
    RAISE EXCEPTION 'Directory access is not available.'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.id INTO current_membership_id
  FROM public.memberships AS membership
  JOIN public.unit_occupants AS occupant
    ON occupant.society_id = membership.society_id
    AND occupant.membership_id = membership.id
  WHERE membership.society_id = p_society_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND occupant.status = 'active'
  LIMIT 1;

  IF current_membership_id IS NULL THEN
    RAISE EXCEPTION 'An active unit occupant is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO before_row
  FROM public.directory_preferences
  WHERE society_id = p_society_id
    AND membership_id = current_membership_id;

  INSERT INTO public.directory_preferences (
    society_id,
    membership_id,
    name_visible,
    unit_visible,
    phone_visible,
    updated_by
  )
  VALUES (
    p_society_id,
    current_membership_id,
    p_name_visible,
    p_unit_visible,
    p_phone_visible,
    auth.uid()
  )
  ON CONFLICT (society_id, membership_id) DO UPDATE
    SET name_visible = EXCLUDED.name_visible,
        unit_visible = EXCLUDED.unit_visible,
        phone_visible = EXCLUDED.phone_visible,
        updated_by = EXCLUDED.updated_by;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "before",
    "after"
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'resident',
    'directory.visibility.update',
    'directory_preferences',
    current_membership_id::text,
    CASE WHEN before_row.membership_id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'name_visible', before_row.name_visible,
        'unit_visible', before_row.unit_visible,
        'phone_visible', before_row.phone_visible
      )
    END,
    jsonb_build_object(
      'name_visible', p_name_visible,
      'unit_visible', p_unit_visible,
      'phone_visible', p_phone_visible
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.directory_set_visibility(uuid, boolean, boolean, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_set_visibility(uuid, boolean, boolean, boolean)
  TO authenticated;

CREATE FUNCTION public.directory_resident_list(p_society_id uuid)
RETURNS TABLE (
  membership_id uuid,
  full_name text,
  unit_number text,
  phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_manager boolean;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee', 'resident']::text[])
  THEN
    RAISE EXCEPTION 'Directory access is not available.'
      USING ERRCODE = '42501';
  END IF;

  is_manager := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  IF NOT is_manager AND NOT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = membership.society_id
      AND occupant.membership_id = membership.id
    WHERE membership.society_id = p_society_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND occupant.status = 'active'
  ) THEN
    RAISE EXCEPTION 'An active unit occupant is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    occupant.membership_id,
    profile.full_name,
    CASE
      WHEN is_manager OR COALESCE(preference.unit_visible, true)
      THEN unit.number
      ELSE NULL
    END,
    CASE
      WHEN is_manager OR COALESCE(preference.phone_visible, false)
      THEN profile.phone
      ELSE NULL
    END
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  JOIN public.units AS unit
    ON unit.society_id = occupant.society_id
    AND unit.id = occupant.unit_id
  LEFT JOIN public.directory_preferences AS preference
    ON preference.society_id = occupant.society_id
    AND preference.membership_id = occupant.membership_id
  WHERE occupant.society_id = p_society_id
    AND occupant.status = 'active'
    AND membership.status = 'active'
    AND (is_manager OR COALESCE(preference.name_visible, true));
END;
$$;
REVOKE ALL ON FUNCTION public.directory_resident_list(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_resident_list(uuid)
  TO authenticated;

CREATE FUNCTION public.directory_guard_vehicle_lookup(
  p_society_id uuid,
  p_registration_number text
)
RETURNS TABLE (vehicle_type text, unit_number text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_registration text;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.has_role(p_society_id, ARRAY['guard']::text[])
  THEN
    RAISE EXCEPTION 'Guard directory access is not available.'
      USING ERRCODE = '42501';
  END IF;

  normalized_registration :=
    upper(regexp_replace(btrim(p_registration_number), '[[:space:]-]', '', 'g'));
  IF normalized_registration !~ '^[A-Z0-9]{4,16}$' THEN
    RAISE EXCEPTION 'Enter a valid vehicle registration number.'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT vehicle.vehicle_type, unit.number
  FROM public.directory_vehicles AS vehicle
  JOIN public.memberships AS membership
    ON membership.society_id = vehicle.society_id
    AND membership.id = vehicle.membership_id
  JOIN public.unit_occupants AS occupant
    ON occupant.society_id = vehicle.society_id
    AND occupant.unit_id = vehicle.unit_id
    AND occupant.membership_id = vehicle.membership_id
  JOIN public.units AS unit
    ON unit.society_id = vehicle.society_id
    AND unit.id = vehicle.unit_id
  WHERE vehicle.society_id = p_society_id
    AND vehicle.registration_number = normalized_registration
    AND vehicle.status = 'active'
    AND vehicle.verified_at IS NOT NULL
    AND membership.status = 'active'
    AND occupant.status = 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.directory_guard_vehicle_lookup(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_guard_vehicle_lookup(uuid, text)
  TO authenticated;

CREATE FUNCTION private.directory_target_membership(
  p_society_id uuid,
  p_unit_id uuid,
  p_requested_membership_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_membership_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Directory access is not available.'
      USING ERRCODE = '42501';
  END IF;

  IF private.has_role(p_society_id, ARRAY['admin']::text[]) THEN
    target_membership_id := p_requested_membership_id;
  ELSIF private.has_role(p_society_id, ARRAY['resident']::text[]) THEN
    SELECT membership.id INTO target_membership_id
    FROM public.memberships AS membership
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = membership.society_id
      AND occupant.membership_id = membership.id
    WHERE membership.society_id = p_society_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active'
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Directory management is not available.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM occupant.id
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.membership_id = target_membership_id
      AND occupant.status = 'active'
      AND membership.status = 'active'
    FOR UPDATE OF occupant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active unit occupant is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN target_membership_id;
END;
$$;
REVOKE ALL ON FUNCTION private.directory_target_membership(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.directory_vehicle_save(
  p_society_id uuid,
  p_vehicle_id uuid,
  p_unit_id uuid,
  p_membership_id uuid,
  p_vehicle_type text,
  p_registration_number text,
  p_tag_number text,
  p_client_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_membership_id uuid;
  normalized_registration text;
  vehicle_row public.directory_vehicles;
  result_id uuid;
BEGIN
  target_membership_id := private.directory_target_membership(
    p_society_id, p_unit_id, p_membership_id
  );
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A request ID is required.'
      USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('car', 'two_wheeler', 'other') THEN
    RAISE EXCEPTION 'Choose a valid vehicle type.'
      USING ERRCODE = '22023';
  END IF;
  IF p_registration_number IS NULL THEN
    RAISE EXCEPTION 'Enter a valid vehicle registration number.'
      USING ERRCODE = '22023';
  END IF;
  normalized_registration :=
    upper(regexp_replace(btrim(p_registration_number), '[[:space:]-]', '', 'g'));
  IF normalized_registration !~ '^[A-Z0-9]{4,16}$' THEN
    RAISE EXCEPTION 'Enter a valid vehicle registration number.'
      USING ERRCODE = '22023';
  END IF;
  IF p_tag_number IS NOT NULL
    AND char_length(btrim(p_tag_number)) NOT BETWEEN 1 AND 40
  THEN
    RAISE EXCEPTION 'Check the vehicle tag number.'
      USING ERRCODE = '22023';
  END IF;

  IF p_vehicle_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
    ));
    SELECT * INTO vehicle_row
    FROM public.directory_vehicles
    WHERE society_id = p_society_id
      AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF FOUND THEN
      IF ROW(
        vehicle_row.unit_id,
        vehicle_row.membership_id,
        vehicle_row.vehicle_type,
        vehicle_row.registration_number,
        vehicle_row.tag_number
      ) IS DISTINCT FROM ROW(
        p_unit_id,
        target_membership_id,
        p_vehicle_type,
        normalized_registration,
        NULLIF(btrim(p_tag_number), '')
      ) THEN
        RAISE EXCEPTION 'This request ID was already used for different vehicle details.'
          USING ERRCODE = '23505';
      END IF;
      RETURN vehicle_row.id;
    END IF;

    INSERT INTO public.directory_vehicles (
      society_id,
      unit_id,
      membership_id,
      vehicle_type,
      registration_number,
      tag_number,
      created_by,
      updated_by,
      client_request_id
    )
    VALUES (
      p_society_id,
      p_unit_id,
      target_membership_id,
      p_vehicle_type,
      normalized_registration,
      NULLIF(btrim(p_tag_number), ''),
      auth.uid(),
      auth.uid(),
      p_client_request_id
    )
    RETURNING id INTO result_id;

    INSERT INTO public.audit_logs (
      society_id, actor_id, action, entity_type, entity_id, "after"
    )
    VALUES (
      p_society_id, auth.uid(), 'directory.vehicle.create',
      'directory_vehicles', result_id::text,
      jsonb_build_object('vehicle_type', p_vehicle_type, 'status', 'active')
    );
    RETURN result_id;
  END IF;

  SELECT * INTO vehicle_row
  FROM public.directory_vehicles
  WHERE society_id = p_society_id AND id = p_vehicle_id
  FOR UPDATE;
  IF NOT FOUND
    OR (
      NOT private.has_role(p_society_id, ARRAY['admin']::text[])
      AND vehicle_row.membership_id <> target_membership_id
    )
  THEN
    RAISE EXCEPTION 'The vehicle was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.directory_vehicles
  SET unit_id = p_unit_id,
      membership_id = target_membership_id,
      vehicle_type = p_vehicle_type,
      registration_number = normalized_registration,
      tag_number = NULLIF(btrim(p_tag_number), ''),
      verified_at = CASE
        WHEN vehicle_row.registration_number IS DISTINCT FROM normalized_registration
          OR vehicle_row.vehicle_type IS DISTINCT FROM p_vehicle_type
          OR vehicle_row.status = 'inactive'
          OR vehicle_row.unit_id IS DISTINCT FROM p_unit_id
          OR vehicle_row.membership_id IS DISTINCT FROM target_membership_id
        THEN NULL
        ELSE vehicle_row.verified_at
      END,
      verified_by = CASE
        WHEN vehicle_row.registration_number IS DISTINCT FROM normalized_registration
          OR vehicle_row.vehicle_type IS DISTINCT FROM p_vehicle_type
          OR vehicle_row.status = 'inactive'
          OR vehicle_row.unit_id IS DISTINCT FROM p_unit_id
          OR vehicle_row.membership_id IS DISTINCT FROM target_membership_id
        THEN NULL
        ELSE vehicle_row.verified_by
      END,
      status = 'active',
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vehicle_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, action, entity_type, entity_id, "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'directory.vehicle.update',
    'directory_vehicles', p_vehicle_id::text,
    jsonb_build_object('vehicle_type', vehicle_row.vehicle_type),
    jsonb_build_object('vehicle_type', p_vehicle_type)
  );
  RETURN p_vehicle_id;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_vehicle_save(
  uuid, uuid, uuid, uuid, text, text, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_vehicle_save(
  uuid, uuid, uuid, uuid, text, text, text, uuid
) TO authenticated;

CREATE FUNCTION public.directory_vehicle_verify(
  p_society_id uuid,
  p_vehicle_id uuid,
  p_is_verified boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  vehicle_row public.directory_vehicles;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Directory administration is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_is_verified IS NULL THEN
    RAISE EXCEPTION 'Choose whether the vehicle is verified.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO vehicle_row
  FROM public.directory_vehicles
  WHERE society_id = p_society_id AND id = p_vehicle_id
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The vehicle was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.directory_vehicles
  SET verified_at = CASE WHEN p_is_verified THEN clock_timestamp() ELSE NULL END,
      verified_by = CASE WHEN p_is_verified THEN auth.uid() ELSE NULL END,
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vehicle_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'directory.vehicle.verify',
    'directory_vehicles', p_vehicle_id::text,
    jsonb_build_object('is_verified', vehicle_row.verified_at IS NOT NULL),
    jsonb_build_object('is_verified', p_is_verified)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.directory_vehicle_verify(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_vehicle_verify(uuid, uuid, boolean)
  TO authenticated;

CREATE FUNCTION public.directory_vehicle_list(p_society_id uuid)
RETURNS TABLE (
  id uuid,
  unit_id uuid,
  membership_id uuid,
  vehicle_type text,
  registration_number text,
  tag_number text,
  status text,
  is_verified boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_manager boolean;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
  THEN
    RAISE EXCEPTION 'Directory access is not available.'
      USING ERRCODE = '42501';
  END IF;
  is_manager := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  RETURN QUERY
  SELECT vehicle.id,
         vehicle.unit_id,
         vehicle.membership_id,
         vehicle.vehicle_type,
         vehicle.registration_number,
         vehicle.tag_number,
         vehicle.status,
         vehicle.verified_at IS NOT NULL
  FROM public.directory_vehicles AS vehicle
  WHERE vehicle.society_id = p_society_id
    AND (
      is_manager
      OR EXISTS (
        SELECT 1
        FROM public.memberships AS membership
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = membership.society_id
          AND occupant.membership_id = membership.id
        WHERE membership.society_id = vehicle.society_id
          AND membership.user_id = auth.uid()
          AND membership.status = 'active'
          AND occupant.status = 'active'
          AND occupant.unit_id = vehicle.unit_id
      )
    )
  ORDER BY vehicle.registration_number;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_vehicle_list(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_vehicle_list(uuid)
  TO authenticated;

CREATE FUNCTION public.directory_vehicle_deactivate(
  p_society_id uuid,
  p_vehicle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  vehicle_row public.directory_vehicles;
  target_membership_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'resident']::text[]
    )
  THEN
    RAISE EXCEPTION 'Directory management is not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO vehicle_row
  FROM public.directory_vehicles
  WHERE society_id = p_society_id AND id = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The vehicle was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  target_membership_id := private.directory_target_membership(
    p_society_id, vehicle_row.unit_id, vehicle_row.membership_id
  );
  SELECT * INTO vehicle_row
  FROM public.directory_vehicles
  WHERE society_id = p_society_id AND id = p_vehicle_id
  FOR UPDATE;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND vehicle_row.membership_id <> target_membership_id
  THEN
    RAISE EXCEPTION 'The vehicle was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF vehicle_row.status = 'inactive' THEN
    RETURN;
  END IF;
  UPDATE public.directory_vehicles
  SET status = 'inactive', verified_at = NULL, verified_by = NULL,
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vehicle_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, action, entity_type, entity_id,
    "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'directory.vehicle.deactivate',
    'directory_vehicles', p_vehicle_id::text,
    jsonb_build_object('status', vehicle_row.status),
    jsonb_build_object('status', 'inactive')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.directory_vehicle_deactivate(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_vehicle_deactivate(uuid, uuid)
  TO authenticated;

CREATE FUNCTION public.directory_emergency_contact_save(
  p_society_id uuid,
  p_contact_id uuid,
  p_unit_id uuid,
  p_membership_id uuid,
  p_full_name text,
  p_relationship text,
  p_phone text,
  p_client_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_membership_id uuid;
  contact_row public.directory_emergency_contacts;
  result_id uuid;
  clean_name text := btrim(p_full_name);
  clean_relationship text := btrim(p_relationship);
  clean_phone text := btrim(p_phone);
BEGIN
  target_membership_id := private.directory_target_membership(
    p_society_id, p_unit_id, p_membership_id
  );
  IF p_client_request_id IS NULL
    OR p_full_name IS NULL
    OR p_relationship IS NULL
    OR p_phone IS NULL
    OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR char_length(clean_relationship) NOT BETWEEN 1 AND 80
    OR clean_phone !~ '^[+]?[0-9]{10,15}$'
  THEN
    RAISE EXCEPTION 'Check the emergency contact details.'
      USING ERRCODE = '22023';
  END IF;

  IF p_contact_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
    ));
    SELECT * INTO contact_row
    FROM public.directory_emergency_contacts
    WHERE society_id = p_society_id
      AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF FOUND THEN
      IF ROW(
        contact_row.unit_id,
        contact_row.membership_id,
        contact_row.full_name,
        contact_row.relationship,
        contact_row.phone
      ) IS DISTINCT FROM ROW(
        p_unit_id,
        target_membership_id,
        clean_name,
        clean_relationship,
        clean_phone
      ) THEN
        RAISE EXCEPTION 'This request ID was already used for different contact details.'
          USING ERRCODE = '23505';
      END IF;
      RETURN contact_row.id;
    END IF;

    INSERT INTO public.directory_emergency_contacts (
      society_id, unit_id, membership_id, full_name, relationship, phone,
      created_by, updated_by, client_request_id
    )
    VALUES (
      p_society_id, p_unit_id, target_membership_id, clean_name,
      clean_relationship, clean_phone, auth.uid(), auth.uid(),
      p_client_request_id
    )
    RETURNING id INTO result_id;
    INSERT INTO public.audit_logs (
      society_id, actor_id, action, entity_type, entity_id, "after"
    )
    VALUES (
      p_society_id, auth.uid(), 'directory.emergency_contact.create',
      'directory_emergency_contacts', result_id::text,
      jsonb_build_object('status', 'active')
    );
    RETURN result_id;
  END IF;

  SELECT * INTO contact_row
  FROM public.directory_emergency_contacts
  WHERE society_id = p_society_id AND id = p_contact_id
  FOR UPDATE;
  IF NOT FOUND
    OR (
      NOT private.has_role(p_society_id, ARRAY['admin']::text[])
      AND contact_row.membership_id <> target_membership_id
    )
  THEN
    RAISE EXCEPTION 'The emergency contact was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.directory_emergency_contacts
  SET unit_id = p_unit_id,
      membership_id = target_membership_id,
      full_name = clean_name,
      relationship = clean_relationship,
      phone = clean_phone,
      status = 'active',
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_contact_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, action, entity_type, entity_id, "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'directory.emergency_contact.update',
    'directory_emergency_contacts', p_contact_id::text,
    jsonb_build_object('status', contact_row.status),
    jsonb_build_object('status', 'active')
  );
  RETURN p_contact_id;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_emergency_contact_save(
  uuid, uuid, uuid, uuid, text, text, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_emergency_contact_save(
  uuid, uuid, uuid, uuid, text, text, text, uuid
) TO authenticated;

CREATE FUNCTION public.directory_emergency_contact_deactivate(
  p_society_id uuid,
  p_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  contact_row public.directory_emergency_contacts;
  target_membership_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'resident']::text[]
    )
  THEN
    RAISE EXCEPTION 'Directory management is not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO contact_row
  FROM public.directory_emergency_contacts
  WHERE society_id = p_society_id AND id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The emergency contact was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  target_membership_id := private.directory_target_membership(
    p_society_id, contact_row.unit_id, contact_row.membership_id
  );
  SELECT * INTO contact_row
  FROM public.directory_emergency_contacts
  WHERE society_id = p_society_id AND id = p_contact_id
  FOR UPDATE;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND contact_row.membership_id <> target_membership_id
  THEN
    RAISE EXCEPTION 'The emergency contact was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF contact_row.status = 'inactive' THEN
    RETURN;
  END IF;
  UPDATE public.directory_emergency_contacts
  SET status = 'inactive', updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_contact_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, action, entity_type, entity_id,
    "before", "after"
  )
  VALUES (
    p_society_id, auth.uid(), 'directory.emergency_contact.deactivate',
    'directory_emergency_contacts', p_contact_id::text,
    jsonb_build_object('status', contact_row.status),
    jsonb_build_object('status', 'inactive')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.directory_emergency_contact_deactivate(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_emergency_contact_deactivate(uuid, uuid)
  TO authenticated;

CREATE FUNCTION public.directory_emergency_contacts_list(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS TABLE (
  id uuid,
  membership_id uuid,
  full_name text,
  relationship text,
  phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR EXISTS (
        SELECT 1
        FROM public.memberships AS membership
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = membership.society_id
          AND occupant.membership_id = membership.id
        WHERE membership.society_id = p_society_id
          AND membership.user_id = auth.uid()
          AND membership.status = 'active'
          AND occupant.unit_id = p_unit_id
          AND occupant.status = 'active'
      )
    )
  THEN
    RAISE EXCEPTION 'Emergency contact access is not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT contact.id, contact.membership_id, contact.full_name,
         contact.relationship, contact.phone
  FROM public.directory_emergency_contacts AS contact
  WHERE contact.society_id = p_society_id
    AND contact.unit_id = p_unit_id
    AND contact.status = 'active'
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR EXISTS (
        SELECT 1
        FROM public.memberships AS membership
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = membership.society_id
          AND occupant.membership_id = membership.id
        WHERE membership.society_id = p_society_id
          AND membership.user_id = auth.uid()
          AND membership.status = 'active'
          AND occupant.unit_id = p_unit_id
          AND occupant.status = 'active'
      )
    )
  ORDER BY contact.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_emergency_contacts_list(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_emergency_contacts_list(uuid, uuid)
  TO authenticated;
