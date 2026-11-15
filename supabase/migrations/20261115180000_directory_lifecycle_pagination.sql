-- Complete directory lifecycle, retention and bounded database reads.
ALTER TABLE public.directory_vehicles
  ADD COLUMN purge_after date;
ALTER TABLE public.directory_emergency_contacts
  ADD COLUMN purge_after date;
ALTER TABLE public.directory_preferences
  ADD COLUMN purge_after date;

CREATE INDEX directory_vehicles_purge_after_idx
  ON public.directory_vehicles (purge_after)
  WHERE purge_after IS NOT NULL;
CREATE INDEX directory_emergency_contacts_purge_after_idx
  ON public.directory_emergency_contacts (purge_after)
  WHERE purge_after IS NOT NULL;
CREATE INDEX directory_preferences_purge_after_idx
  ON public.directory_preferences (purge_after)
  WHERE purge_after IS NOT NULL;

CREATE FUNCTION private.directory_clear_active_retention()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    NEW.purge_after := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.directory_clear_active_retention()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER directory_vehicles_clear_active_retention
  BEFORE INSERT OR UPDATE ON public.directory_vehicles
  FOR EACH ROW EXECUTE FUNCTION private.directory_clear_active_retention();
CREATE TRIGGER directory_contacts_clear_active_retention
  BEFORE INSERT OR UPDATE ON public.directory_emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION private.directory_clear_active_retention();

UPDATE public.directory_vehicles AS vehicle
SET status = 'inactive',
    verified_at = NULL,
    verified_by = NULL,
    purge_after = (
      SELECT max(occupant.ended_at) + interval '1 year'
      FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = vehicle.society_id
        AND occupant.unit_id = vehicle.unit_id
        AND occupant.membership_id = vehicle.membership_id
    )
WHERE NOT EXISTS (
  SELECT 1 FROM public.unit_occupants AS occupant
  WHERE occupant.society_id = vehicle.society_id
    AND occupant.unit_id = vehicle.unit_id
    AND occupant.membership_id = vehicle.membership_id
    AND occupant.status = 'active'
);
UPDATE public.directory_emergency_contacts AS contact
SET status = 'inactive',
    purge_after = (
      SELECT max(occupant.ended_at) + interval '1 year'
      FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = contact.society_id
        AND occupant.unit_id = contact.unit_id
        AND occupant.membership_id = contact.membership_id
    )
WHERE NOT EXISTS (
  SELECT 1 FROM public.unit_occupants AS occupant
  WHERE occupant.society_id = contact.society_id
    AND occupant.unit_id = contact.unit_id
    AND occupant.membership_id = contact.membership_id
    AND occupant.status = 'active'
);
UPDATE public.directory_preferences AS preference
SET purge_after = (
  SELECT max(occupant.ended_at) + interval '1 year'
  FROM public.unit_occupants AS occupant
  WHERE occupant.society_id = preference.society_id
    AND occupant.membership_id = preference.membership_id
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.unit_occupants AS occupant
  WHERE occupant.society_id = preference.society_id
    AND occupant.membership_id = preference.membership_id
    AND occupant.status = 'active'
);

CREATE FUNCTION public.directory_my_preferences(p_society_id uuid)
RETURNS TABLE (
  name_visible boolean,
  unit_visible boolean,
  phone_visible boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_membership_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN
    RAISE EXCEPTION 'Directory preferences are not available.'
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

  RETURN QUERY
  SELECT COALESCE(preference.name_visible, true),
         COALESCE(preference.unit_visible, true),
         COALESCE(preference.phone_visible, false)
  FROM (SELECT current_membership_id AS membership_id) AS current_membership
  LEFT JOIN public.directory_preferences AS preference
    ON preference.society_id = p_society_id
    AND preference.membership_id = current_membership.membership_id;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_my_preferences(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_my_preferences(uuid)
  TO authenticated;

CREATE FUNCTION public.directory_my_households(p_society_id uuid)
RETURNS TABLE (
  unit_id uuid,
  membership_id uuid,
  unit_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'directory')
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN
    RAISE EXCEPTION 'Directory household access is not available.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT occupant.unit_id, membership.id, unit.number
  FROM public.memberships AS membership
  JOIN public.unit_occupants AS occupant
    ON occupant.society_id = membership.society_id
    AND occupant.membership_id = membership.id
  JOIN public.units AS unit
    ON unit.society_id = occupant.society_id
    AND unit.id = occupant.unit_id
  WHERE membership.society_id = p_society_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND occupant.status = 'active'
  ORDER BY unit.number, occupant.unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active unit occupant is required.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_my_households(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_my_households(uuid)
  TO authenticated;

DROP FUNCTION public.directory_resident_list(uuid);
CREATE FUNCTION public.directory_resident_list(
  p_society_id uuid,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_manager boolean;
  normalized_search text := NULLIF(btrim(p_search), '');
  page_limit integer := COALESCE(p_limit, 25);
  page_offset integer := COALESCE(p_offset, 0);
  result jsonb;
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
  IF page_limit NOT BETWEEN 1 AND 100
    OR page_offset < 0
    OR (normalized_search IS NOT NULL AND char_length(normalized_search) > 120)
  THEN
    RAISE EXCEPTION 'Invalid directory page request.'
      USING ERRCODE = '22023';
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

  WITH visible_residents AS (
    SELECT
      occupant.membership_id,
      CASE
        WHEN is_manager OR COALESCE(preference.unit_visible, true)
        THEN occupant.unit_id
        ELSE NULL
      END AS unit_id,
      profile.full_name,
      CASE
        WHEN is_manager OR COALESCE(preference.unit_visible, true)
        THEN unit.number
        ELSE NULL
      END AS unit_number,
      CASE
        WHEN is_manager OR COALESCE(preference.phone_visible, false)
        THEN profile.phone
        ELSE NULL
      END AS phone
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
      AND (is_manager OR COALESCE(preference.name_visible, true))
  ),
  matching_residents AS (
    SELECT *
    FROM visible_residents
    WHERE normalized_search IS NULL
      OR strpos(lower(COALESCE(full_name, '')), lower(normalized_search)) > 0
      OR strpos(lower(COALESCE(unit_number, '')), lower(normalized_search)) > 0
  ),
  page AS (
    SELECT *
    FROM matching_residents
    ORDER BY full_name NULLS LAST, unit_number NULLS LAST, membership_id
    LIMIT page_limit
    OFFSET page_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(page)) FROM page),
      '[]'::jsonb
    ),
    'total', (SELECT count(*) FROM matching_residents),
    'limit', page_limit,
    'offset', page_offset
  )
  INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_resident_list(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_resident_list(uuid, text, integer, integer)
  TO authenticated;

DROP FUNCTION public.directory_vehicle_list(uuid);
CREATE FUNCTION public.directory_vehicle_list(
  p_society_id uuid,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_manager boolean;
  page_limit integer := COALESCE(p_limit, 25);
  page_offset integer := COALESCE(p_offset, 0);
  result jsonb;
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
  IF page_limit NOT BETWEEN 1 AND 100 OR page_offset < 0 THEN
    RAISE EXCEPTION 'Invalid directory page request.'
      USING ERRCODE = '22023';
  END IF;

  is_manager := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  WITH visible_vehicles AS (
    SELECT vehicle.id,
           vehicle.unit_id,
           vehicle.membership_id,
           vehicle.vehicle_type,
           vehicle.registration_number,
           vehicle.tag_number,
           vehicle.status,
           vehicle.verified_at IS NOT NULL AS is_verified
    FROM public.directory_vehicles AS vehicle
    WHERE vehicle.society_id = p_society_id
      AND (is_manager OR EXISTS (
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
      ) AND EXISTS (
        SELECT 1 FROM public.unit_occupants AS owner
        JOIN public.memberships AS membership
          ON membership.society_id = owner.society_id
          AND membership.id = owner.membership_id
        WHERE owner.society_id = vehicle.society_id
          AND owner.membership_id = vehicle.membership_id
          AND owner.unit_id = vehicle.unit_id
          AND owner.status = 'active'
          AND membership.status = 'active'
      ))
  ),
  page AS (
    SELECT *
    FROM visible_vehicles
    ORDER BY registration_number, id
    LIMIT page_limit
    OFFSET page_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(page)) FROM page),
      '[]'::jsonb
    ),
    'total', (SELECT count(*) FROM visible_vehicles),
    'limit', page_limit,
    'offset', page_offset
  )
  INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_vehicle_list(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_vehicle_list(uuid, integer, integer)
  TO authenticated;

DROP FUNCTION public.directory_emergency_contacts_list(uuid, uuid);
CREATE FUNCTION public.directory_emergency_contacts_list(
  p_society_id uuid,
  p_unit_id uuid,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  page_limit integer := COALESCE(p_limit, 25);
  page_offset integer := COALESCE(p_offset, 0);
  result jsonb;
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
  IF page_limit NOT BETWEEN 1 AND 100 OR page_offset < 0 THEN
    RAISE EXCEPTION 'Invalid directory page request.'
      USING ERRCODE = '22023';
  END IF;

  WITH visible_contacts AS (
    SELECT contact.id,
           contact.unit_id,
           contact.membership_id,
           contact.full_name,
           contact.relationship,
           contact.phone
    FROM public.directory_emergency_contacts AS contact
    WHERE contact.society_id = p_society_id
      AND contact.unit_id = p_unit_id
      AND contact.status = 'active'
  ),
  page AS (
    SELECT *
    FROM visible_contacts
    ORDER BY id
    LIMIT page_limit
    OFFSET page_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(page)) FROM page),
      '[]'::jsonb
    ),
    'total', (SELECT count(*) FROM visible_contacts),
    'limit', page_limit,
    'offset', page_offset
  )
  INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.directory_emergency_contacts_list(
  uuid, uuid, integer, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_emergency_contacts_list(
  uuid, uuid, integer, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_unit_occupant(
  p_society_id uuid,
  p_occupant_id uuid,
  p_target_unit_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_occupant public.unit_occupants%ROWTYPE;
  new_occupant_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO old_occupant
  FROM public.unit_occupants
  WHERE id = p_occupant_id
    AND society_id = p_society_id
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.units AS unit
    WHERE unit.id = p_target_unit_id
      AND unit.society_id = p_society_id
      AND unit.active
  ) THEN
    RAISE EXCEPTION 'Occupancy or target unit not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Lifecycle maintenance must also run while the optional module is disabled.
    WITH moved AS (
      UPDATE public.directory_vehicles
      SET unit_id = p_target_unit_id,
          verified_at = NULL,
          verified_by = NULL,
          purge_after = NULL,
          updated_by = auth.uid()
      WHERE society_id = p_society_id
        AND unit_id = old_occupant.unit_id
        AND membership_id = old_occupant.membership_id
        AND status = 'active'
      RETURNING id
    )
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    )
    SELECT p_society_id, auth.uid(), 'admin', 'directory.vehicle.transfer',
           'directory_vehicles', moved.id::text,
           jsonb_build_object('unit_id', old_occupant.unit_id),
           jsonb_build_object('unit_id', p_target_unit_id, 'verification_required', true),
           p_request_id
    FROM moved;

    WITH moved AS (
      UPDATE public.directory_emergency_contacts
      SET unit_id = p_target_unit_id,
          purge_after = NULL,
          updated_by = auth.uid()
      WHERE society_id = p_society_id
        AND unit_id = old_occupant.unit_id
        AND membership_id = old_occupant.membership_id
        AND status = 'active'
      RETURNING id
    )
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    )
    SELECT p_society_id, auth.uid(), 'admin',
           'directory.emergency_contact.transfer',
           'directory_emergency_contacts', moved.id::text,
           jsonb_build_object('unit_id', old_occupant.unit_id),
           jsonb_build_object('unit_id', p_target_unit_id),
           p_request_id
    FROM moved;
  UPDATE public.directory_vehicles
  SET purge_after = current_date + interval '1 year'
  WHERE society_id = p_society_id
    AND unit_id = old_occupant.unit_id
    AND membership_id = old_occupant.membership_id
    AND status = 'inactive';
  UPDATE public.directory_emergency_contacts
  SET purge_after = current_date + interval '1 year'
  WHERE society_id = p_society_id
    AND unit_id = old_occupant.unit_id
    AND membership_id = old_occupant.membership_id
    AND status = 'inactive';

  UPDATE public.unit_occupants
  SET status = 'ended', ended_at = current_date
  WHERE id = old_occupant.id;
  INSERT INTO public.unit_occupants (
    society_id, unit_id, membership_id, relationship, is_primary,
    is_approver, status, started_at
  )
  VALUES (
    p_society_id, p_target_unit_id, old_occupant.membership_id,
    old_occupant.relationship, old_occupant.is_primary,
    old_occupant.is_approver, 'active', current_date
  )
  RETURNING id INTO new_occupant_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.unit.move',
    'unit_occupant', new_occupant_id::text,
    pg_catalog.jsonb_build_object(
      'unitId', old_occupant.unit_id, 'occupantId', old_occupant.id
    ),
    pg_catalog.jsonb_build_object(
      'unitId', p_target_unit_id, 'occupantId', new_occupant_id
    ),
    p_request_id
  );
  RETURN new_occupant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_unit_occupancy(
  p_society_id uuid,
  p_occupant_id uuid,
  p_ended_at date,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_occupant public.unit_occupants%ROWTYPE;
  end_date date := COALESCE(p_ended_at, current_date);
  vehicles_deactivated integer := 0;
  contacts_deactivated integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO old_occupant
  FROM public.unit_occupants
  WHERE id = p_occupant_id
    AND society_id = p_society_id
    AND status <> 'ended'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Occupancy not found.' USING ERRCODE = 'P0002';
  END IF;
  IF end_date < old_occupant.started_at THEN
    RAISE EXCEPTION 'End date cannot precede the occupancy start date.'
      USING ERRCODE = '22023';
  END IF;

    UPDATE public.directory_vehicles
    SET status = 'inactive',
        purge_after = end_date + interval '1 year',
        verified_at = NULL,
        verified_by = NULL,
        updated_by = auth.uid()
    WHERE society_id = p_society_id
      AND unit_id = old_occupant.unit_id
      AND membership_id = old_occupant.membership_id;
    GET DIAGNOSTICS vehicles_deactivated = ROW_COUNT;

    UPDATE public.directory_emergency_contacts
    SET status = 'inactive',
        purge_after = end_date + interval '1 year',
        updated_by = auth.uid()
    WHERE society_id = p_society_id
      AND unit_id = old_occupant.unit_id
      AND membership_id = old_occupant.membership_id;
    GET DIAGNOSTICS contacts_deactivated = ROW_COUNT;

  UPDATE public.unit_occupants
  SET status = 'ended', ended_at = end_date
  WHERE id = p_occupant_id;
  UPDATE public.directory_preferences AS preference
  SET purge_after = end_date + interval '1 year'
  WHERE society_id = p_society_id
    AND membership_id = old_occupant.membership_id
    AND NOT EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = p_society_id
        AND occupant.membership_id = old_occupant.membership_id
        AND occupant.status = 'active'
    );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.unit.end',
    'unit_occupant', p_occupant_id::text,
    pg_catalog.jsonb_build_object('status', old_occupant.status),
    pg_catalog.jsonb_build_object('status', 'ended', 'endedAt', end_date),
    p_request_id
  );
  IF vehicles_deactivated > 0 OR contacts_deactivated > 0 THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "after", request_id
    )
    VALUES (
      p_society_id, auth.uid(), 'admin', 'directory.occupancy.deactivate',
      'unit_occupant', p_occupant_id::text,
      jsonb_build_object(
        'vehicles', vehicles_deactivated,
        'emergency_contacts', contacts_deactivated,
        'purge_after', end_date + interval '1 year'
      ),
      p_request_id
    );
  END IF;
END;
$$;

CREATE FUNCTION public.directory_retention_run(
  p_today date,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  vehicle_count integer := 0;
  contact_count integer := 0;
  preference_count integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Invalid directory retention arguments.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.set_config('homeish.retention_purge', 'on', true);
  DELETE FROM public.directory_vehicles AS vehicle
  WHERE purge_after <= p_today
    AND status = 'inactive'
    AND NOT EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.society_id = vehicle.society_id
        AND occupant.unit_id = vehicle.unit_id
        AND occupant.membership_id = vehicle.membership_id
        AND occupant.status = 'active'
        AND membership.status = 'active'
    );
  GET DIAGNOSTICS vehicle_count = ROW_COUNT;

  DELETE FROM public.directory_emergency_contacts AS contact
  WHERE purge_after <= p_today
    AND status = 'inactive'
    AND NOT EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.society_id = contact.society_id
        AND occupant.unit_id = contact.unit_id
        AND occupant.membership_id = contact.membership_id
        AND occupant.status = 'active'
        AND membership.status = 'active'
    );
  GET DIAGNOSTICS contact_count = ROW_COUNT;

  DELETE FROM public.directory_preferences AS preference
  WHERE purge_after <= p_today
    AND NOT EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.society_id = preference.society_id
        AND occupant.membership_id = preference.membership_id
        AND occupant.status = 'active'
        AND membership.status = 'active'
    );
  GET DIAGNOSTICS preference_count = ROW_COUNT;

  IF vehicle_count > 0 OR contact_count > 0 OR preference_count > 0 THEN
    INSERT INTO public.audit_logs (
      actor_role, action, entity_type, entity_id, "after", request_id
    )
    VALUES (
      'service_role', 'directory.retention.purge', 'retention_run',
      p_today::text,
      jsonb_build_object(
        'vehicles_deleted', vehicle_count,
        'emergency_contacts_deleted', contact_count,
        'preferences_deleted', preference_count
      ),
      p_request_trace
    );
  END IF;

  RETURN jsonb_build_object(
    'vehicles_deleted', vehicle_count,
    'emergency_contacts_deleted', contact_count,
    'preferences_deleted', preference_count
  );
END;
$$;
REVOKE ALL ON FUNCTION public.directory_retention_run(date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_retention_run(date, text)
  TO service_role;

CREATE FUNCTION private.directory_deactivate_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cutoff date := COALESCE(
    (NEW.left_at AT TIME ZONE 'Asia/Kolkata')::date, current_date
  ) + interval '1 year';
  vehicle_count integer;
  contact_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || NEW.society_id::text, 0));
  UPDATE public.directory_vehicles
  SET status = 'inactive', verified_at = NULL, verified_by = NULL,
      purge_after = COALESCE(purge_after, cutoff)
  WHERE society_id = NEW.society_id AND membership_id = NEW.id;
  GET DIAGNOSTICS vehicle_count = ROW_COUNT;
  UPDATE public.directory_emergency_contacts
  SET status = 'inactive', purge_after = COALESCE(purge_after, cutoff)
  WHERE society_id = NEW.society_id AND membership_id = NEW.id;
  GET DIAGNOSTICS contact_count = ROW_COUNT;
  UPDATE public.directory_preferences
  SET purge_after = COALESCE(purge_after, cutoff)
  WHERE society_id = NEW.society_id AND membership_id = NEW.id;
  IF vehicle_count > 0 OR contact_count > 0 THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, action, entity_type, entity_id, "after"
    )
    VALUES (
      NEW.society_id, auth.uid(), 'directory.membership.deactivate',
      'membership', NEW.id::text,
      jsonb_build_object('vehicles', vehicle_count, 'emergency_contacts', contact_count)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.directory_deactivate_membership()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER directory_membership_deactivated
  AFTER UPDATE OF status ON public.memberships
  FOR EACH ROW WHEN (NEW.status = 'deactivated' AND OLD.status <> NEW.status)
  EXECUTE FUNCTION private.directory_deactivate_membership();
