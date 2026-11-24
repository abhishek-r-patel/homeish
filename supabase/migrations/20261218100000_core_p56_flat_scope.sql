-- P56 resident flat scope: one active flat by default, with an own-account all-flats preference.
ALTER TABLE public.person_workspace_preferences
  ADD COLUMN resident_unit_id uuid REFERENCES public.units (id) ON DELETE SET NULL,
  ADD COLUMN resident_all_flats boolean NOT NULL DEFAULT false;

CREATE FUNCTION private.resident_flat_preference_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.resident_unit_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.id = occupant.membership_id
        AND membership.society_id = occupant.society_id
      WHERE occupant.society_id = NEW.society_id
        AND occupant.unit_id = NEW.resident_unit_id
        AND occupant.status = 'active'
        AND membership.user_id = NEW.user_id
        AND membership.status = 'active'
        AND 'resident' = ANY (membership.roles)
    )
  THEN
    RAISE EXCEPTION 'The selected flat is not linked to this resident.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER person_workspace_preferences_validate_flat
  BEFORE INSERT OR UPDATE OF resident_unit_id
  ON public.person_workspace_preferences
  FOR EACH ROW EXECUTE FUNCTION private.resident_flat_preference_validate();
REVOKE ALL ON FUNCTION private.resident_flat_preference_validate()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_unit_ids(p_society_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH own_units AS (
    SELECT DISTINCT occupant.unit_id, block.name AS block_name, unit.number
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    JOIN public.units AS unit
      ON unit.id = occupant.unit_id
      AND unit.society_id = occupant.society_id
      AND unit.active
    LEFT JOIN public.blocks AS block
      ON block.id = unit.block_id
      AND block.society_id = unit.society_id
    WHERE occupant.society_id = p_society_id
      AND occupant.status = 'active'
      AND membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
  ),
  preference AS (
    SELECT resident_unit_id, resident_all_flats
    FROM public.person_workspace_preferences
    WHERE society_id = p_society_id
      AND user_id = (SELECT auth.uid())
  )
  SELECT CASE
    WHEN COALESCE((SELECT resident_all_flats FROM preference), false) THEN
      COALESCE(
        ARRAY(
          SELECT own_units.unit_id
          FROM own_units
          ORDER BY own_units.block_name NULLS FIRST, own_units.number
        ),
        '{}'::uuid[]
      )
    ELSE COALESCE(
      ARRAY(
        SELECT own_units.unit_id
        FROM own_units
        ORDER BY
          own_units.unit_id
            = (SELECT preference.resident_unit_id FROM preference) DESC,
          own_units.block_name NULLS FIRST,
          own_units.number
        LIMIT 1
      ),
      '{}'::uuid[]
    )
  END
$$;

CREATE OR REPLACE FUNCTION private.occupies_unit(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_unit_id = ANY (
    private.current_user_unit_ids(
      (SELECT unit.society_id FROM public.units AS unit WHERE unit.id = p_unit_id)
    )
  )
$$;

CREATE OR REPLACE FUNCTION private.is_household_manager(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.occupies_unit(p_unit_id)
    AND EXISTS (
      SELECT 1
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.unit_id = p_unit_id
        AND occupant.status = 'active'
        AND membership.user_id = (SELECT auth.uid())
        AND membership.status = 'active'
        AND (occupant.relationship = 'owner' OR occupant.is_primary)
    )
$$;

CREATE OR REPLACE FUNCTION private.metering_is_unit_resident(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.has_role(p_society_id, ARRAY['resident']::text[])
    AND private.occupies_unit(p_unit_id)
$$;

CREATE OR REPLACE FUNCTION public.directory_vehicle_list(
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
    SELECT
      vehicle.id,
      vehicle.unit_id,
      vehicle.membership_id,
      vehicle.vehicle_type,
      vehicle.registration_number,
      vehicle.tag_number,
      vehicle.status,
      vehicle.verified_at IS NOT NULL AS is_verified
    FROM public.directory_vehicles AS vehicle
    WHERE vehicle.society_id = p_society_id
      AND (
        is_manager
        OR (
          private.occupies_unit(vehicle.unit_id)
          AND EXISTS (
            SELECT 1
            FROM public.unit_occupants AS owner
            JOIN public.memberships AS membership
              ON membership.society_id = owner.society_id
              AND membership.id = owner.membership_id
            WHERE owner.society_id = vehicle.society_id
              AND owner.membership_id = vehicle.membership_id
              AND owner.unit_id = vehicle.unit_id
              AND owner.status = 'active'
              AND membership.status = 'active'
          )
        )
      )
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

CREATE OR REPLACE FUNCTION public.resident_flat_options_get(
  p_society_id uuid
)
RETURNS TABLE (
  unit_id uuid,
  label text,
  selected boolean,
  all_flats boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_unit_id uuid;
  all_flats_selected boolean;
BEGIN
  IF NOT private.is_member(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN
    RAISE EXCEPTION 'Resident access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT preference.resident_all_flats
  INTO all_flats_selected
  FROM public.person_workspace_preferences AS preference
  WHERE preference.user_id = auth.uid()
    AND preference.society_id = p_society_id;

  SELECT current_unit.unit_id
  INTO effective_unit_id
  FROM unnest(private.current_user_unit_ids(p_society_id)) AS current_unit(unit_id)
  ORDER BY current_unit.unit_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    unit.id,
    CASE
      WHEN block.name IS NULL THEN unit.number
      ELSE block.name || ' · ' || unit.number
    END,
    NOT COALESCE(all_flats_selected, false)
      AND unit.id = effective_unit_id,
    COALESCE(all_flats_selected, false)
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.id = occupant.membership_id
    AND membership.society_id = occupant.society_id
  JOIN public.units AS unit
    ON unit.id = occupant.unit_id
    AND unit.society_id = occupant.society_id
  LEFT JOIN public.blocks AS block
    ON block.id = unit.block_id
    AND block.society_id = unit.society_id
  WHERE occupant.society_id = p_society_id
    AND occupant.status = 'active'
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND unit.active
  GROUP BY unit.id, block.name
  ORDER BY block.name NULLS FIRST, unit.number;
END;
$$;

CREATE OR REPLACE FUNCTION public.resident_flat_selection_save(
  p_society_id uuid,
  p_unit_id uuid,
  p_all_flats boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_member(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN
    RAISE EXCEPTION 'Resident access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_all_flats AND p_unit_id IS NOT NULL THEN
    RAISE EXCEPTION 'All-flats mode cannot select one unit.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT p_all_flats AND NOT EXISTS (
    SELECT 1
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.id = occupant.membership_id
      AND membership.society_id = occupant.society_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active'
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose an active unit linked to this resident.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.person_workspace_preferences (
    user_id,
    society_id,
    resident_unit_id,
    resident_all_flats
  )
  VALUES (
    auth.uid(),
    p_society_id,
    p_unit_id,
    p_all_flats
  )
  ON CONFLICT (user_id, society_id) DO UPDATE
  SET resident_unit_id = EXCLUDED.resident_unit_id,
      resident_all_flats = EXCLUDED.resident_all_flats,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.resident_flat_options_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resident_flat_selection_save(uuid, uuid, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_unit_ids(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.occupies_unit(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_household_manager(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resident_flat_options_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.resident_flat_selection_save(uuid, uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.occupies_unit(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_household_manager(uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.metering_is_unit_resident(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.directory_vehicle_list(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.directory_vehicle_list(uuid, integer, integer)
  TO authenticated;
