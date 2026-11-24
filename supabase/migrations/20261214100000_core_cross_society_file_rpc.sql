-- Refuse cross-society file access before resolving private D-85/D-84 paths.
CREATE OR REPLACE FUNCTION public.unit_handover_file_access(
  p_society_id uuid, p_path text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'core')
    OR NOT private.is_member(p_society_id)
  THEN
    RAISE EXCEPTION 'Handover access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN split_part(coalesce(p_path, ''), '/', 1) = p_society_id::text
    AND private.unit_handover_file_access(p_path, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_deposit_file_access(
  p_society_id uuid, p_booking_id uuid, p_upload boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  booking public.amenity_bookings;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, false);
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = p_society_id AND id = p_booking_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF p_upload THEN
    RETURN private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id);
  END IF;
  RETURN private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    )
    OR (
      private.has_role(p_society_id, ARRAY['resident']::text[])
      AND private.occupies_unit(booking.unit_id)
    );
END;
$$;
