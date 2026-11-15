-- Expose scoped move targets without turning tenancy into a resident identity directory.
CREATE FUNCTION public.tenancy_workspace_get(p_society_id uuid, p_include_targets boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_admin boolean;
  can_create boolean;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident', 'guard']::text[], false
  );
  IF p_include_targets IS NULL THEN
    RAISE EXCEPTION 'Choose whether move targets are required.' USING ERRCODE = '22023';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  can_create := private.has_role(p_society_id, ARRAY['admin', 'resident']::text[]);
  RETURN (
    WITH eligible_units AS (
      SELECT unit.id, unit.number FROM public.units AS unit
      WHERE unit.society_id = p_society_id AND unit.active AND p_include_targets AND can_create
        AND (is_admin OR private.tenancy_is_owner(p_society_id, unit.id) OR EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          JOIN public.memberships AS membership
            ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
          WHERE occupant.society_id = p_society_id AND occupant.unit_id = unit.id
            AND occupant.relationship = 'tenant' AND occupant.status <> 'ended'
            AND membership.user_id = auth.uid() AND membership.status = 'active'
            AND 'resident' = ANY(membership.roles)
        ))
    ), target_memberships AS (
      SELECT membership.id, membership.status, membership.user_id,
        COALESCE(profile.full_name, membership.invited_email, 'Invited tenant') AS name
      FROM public.memberships AS membership
      LEFT JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND p_include_targets AND can_create
        AND membership.status IN ('active', 'invited', 'pending_approval')
        AND 'resident' = ANY(membership.roles)
        AND (is_admin OR EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          JOIN eligible_units AS unit ON unit.id = occupant.unit_id
          WHERE occupant.society_id = p_society_id AND occupant.membership_id = membership.id
            AND occupant.relationship = 'tenant' AND occupant.status <> 'ended'
            AND (membership.user_id = auth.uid() OR private.tenancy_is_owner(p_society_id, unit.id))
        ))
    )
    SELECT jsonb_build_object(
      'today', (clock_timestamp() AT TIME ZONE society.timezone)::date,
      'timezone', society.timezone, 'unit_label', society.unit_label,
      'can_manage', is_admin, 'can_create', can_create,
      'can_write', private.society_writable(p_society_id),
      'police_verification_required', private.tenancy_police_required(p_society_id),
      'amenity_enabled', private.module_enabled(p_society_id, 'amenity'),
      'units', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'number', unit.number)
          ORDER BY unit.number, unit.id) FROM eligible_units AS unit
      ), '[]'::jsonb),
      'tenants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', membership.id, 'name', membership.name,
          'status', membership.status) ORDER BY membership.name, membership.id)
        FROM target_memberships AS membership
      ), '[]'::jsonb),
      'occupancies', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'unit_id', occupant.unit_id, 'membership_id', occupant.membership_id,
          'is_tenant', occupant.relationship = 'tenant', 'status', occupant.status
        ) ORDER BY occupant.unit_id, occupant.membership_id)
        FROM public.unit_occupants AS occupant
        JOIN eligible_units AS unit ON unit.id = occupant.unit_id
        JOIN target_memberships AS membership ON membership.id = occupant.membership_id
        WHERE occupant.society_id = p_society_id AND occupant.status <> 'ended'
          AND (is_admin OR membership.user_id = auth.uid()
            OR private.tenancy_is_owner(p_society_id, unit.id))
      ), '[]'::jsonb),
      'bookings', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', booking.id, 'unit_id', booking.unit_id, 'name', booking.amenity_name,
          'starts_at', booking.starts_at, 'ends_at', booking.ends_at
        ) ORDER BY booking.starts_at, booking.id)
        FROM public.amenity_bookings AS booking
        JOIN eligible_units AS unit ON unit.id = booking.unit_id
        WHERE booking.society_id = p_society_id AND booking.status = 'confirmed'
          AND booking.ends_at > clock_timestamp() AND private.module_enabled(p_society_id, 'amenity')
      ), '[]'::jsonb)
    ) FROM public.societies AS society WHERE society.id = p_society_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.tenancy_workspace_get(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenancy_workspace_get(uuid, boolean) TO authenticated;
