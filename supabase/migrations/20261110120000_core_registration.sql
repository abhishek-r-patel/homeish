CREATE OR REPLACE FUNCTION public.lookup_registration_society(p_join_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_join_code IS NULL
     OR p_join_code !~ '^[A-HJ-NP-Z2-9]{8}$'
  THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'societyName', society.name,
    'units', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', unit.id,
          'number', unit.number,
          'blockName', block.name
        )
        ORDER BY block.name NULLS FIRST, unit.number
      )
      FROM public.units AS unit
      LEFT JOIN public.blocks AS block
        ON block.society_id = unit.society_id
        AND block.id = unit.block_id
      WHERE unit.society_id = society.id
        AND unit.active
        AND (block.id IS NULL OR block.active)
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.societies AS society
  WHERE society.join_code = p_join_code
    AND society.status IN ('trial', 'active')
    AND private.module_enabled(society.id, 'core');

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_registration_society(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_registration_society(text)
  TO service_role;

REVOKE SELECT ON TABLE public.societies FROM authenticated;
GRANT SELECT (
  id, name, unit_label, address, city, contact_email, contact_phone,
  timezone, currency, logo_path, status, plan, gate_login_mode,
  guard_identification, created_at, created_by, updated_at, updated_by
) ON TABLE public.societies TO authenticated;

CREATE OR REPLACE FUNCTION public.get_society_join_code(p_society_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       private.has_role(p_society_id, ARRAY['admin']::text[])
       OR private.is_developer()
     )
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT society.join_code
    INTO result
  FROM public.societies AS society
  WHERE society.id = p_society_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Society not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_society_join_code(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_society_join_code(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.rotate_society_join_code(
  p_society_id uuid,
  p_request_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  generated_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  updated_rows integer;
BEGIN
  IF actor_id IS NULL
     OR NOT (
       private.has_role(p_society_id, ARRAY['admin']::text[])
       OR private.is_developer()
     )
     OR NOT private.society_writable(p_society_id)
     OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  random_bytes := extensions.gen_random_bytes(8);
  SELECT pg_catalog.string_agg(
    pg_catalog.substr(
      alphabet,
      (pg_catalog.get_byte(random_bytes, index_value) % 32) + 1,
      1
    ),
    '' ORDER BY index_value
  )
  INTO generated_code
  FROM pg_catalog.generate_series(0, 7) AS indices(index_value);

  UPDATE public.societies
  SET join_code = generated_code
  WHERE id = p_society_id;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows = 0 THEN
    RAISE EXCEPTION 'Society not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, actor_id,
    CASE WHEN private.is_developer() THEN 'developer' ELSE 'admin' END,
    'society.rotateJoinCode', 'society', p_society_id::text,
    pg_catalog.jsonb_build_object('joinCodeEnabled', true),
    pg_catalog.jsonb_build_object('joinCodeEnabled', true),
    p_request_id
  );

  RETURN generated_code;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_society_join_code(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rotate_society_join_code(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.disable_society_join_code(
  p_society_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  affected_rows integer;
BEGIN
  IF actor_id IS NULL
     OR NOT (
       private.has_role(p_society_id, ARRAY['admin']::text[])
       OR private.is_developer()
     )
     OR NOT private.society_writable(p_society_id)
     OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.societies
  SET join_code = NULL
  WHERE id = p_society_id
    AND join_code IS NOT NULL;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF NOT EXISTS (
    SELECT 1 FROM public.societies WHERE id = p_society_id
  ) THEN
    RAISE EXCEPTION 'Society not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, actor_id,
    CASE WHEN private.is_developer() THEN 'developer' ELSE 'admin' END,
    'society.disableJoinCode', 'society', p_society_id::text,
    pg_catalog.jsonb_build_object('joinCodeEnabled', affected_rows > 0),
    pg_catalog.jsonb_build_object('joinCodeEnabled', false),
    p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disable_society_join_code(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.disable_society_join_code(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_society_registration(
  p_join_code text,
  p_unit_id uuid,
  p_full_name text,
  p_relationship text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  verified_email text;
  target_society_id uuid;
  membership_id uuid;
  normalized_name text := btrim(p_full_name);
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;
  IF normalized_name IS NULL
     OR char_length(normalized_name) NOT BETWEEN 1 AND 120
     OR p_relationship IS NULL
     OR p_relationship NOT IN ('owner', 'tenant', 'family')
     OR p_join_code IS NULL
     OR p_join_code !~ '^[A-HJ-NP-Z2-9]{8}$'
  THEN
    RAISE EXCEPTION 'Registration details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT lower(auth_user.email)
    INTO verified_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = actor_id
    AND auth_user.email_confirmed_at IS NOT NULL;
  IF verified_email IS NULL THEN
    RAISE EXCEPTION 'A verified email session is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT society.id
    INTO target_society_id
  FROM public.societies AS society
  WHERE society.join_code = p_join_code
    AND society.status IN ('trial', 'active')
    AND private.module_enabled(society.id, 'core')
  FOR UPDATE;
  IF target_society_id IS NULL THEN
    RAISE EXCEPTION 'This society code is not available.'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.units AS unit
    LEFT JOIN public.blocks AS block
      ON block.society_id = unit.society_id
      AND block.id = unit.block_id
    WHERE unit.id = p_unit_id
      AND unit.society_id = target_society_id
      AND unit.active
      AND (block.id IS NULL OR block.active)
  ) THEN
    RAISE EXCEPTION 'The selected unit is unavailable.'
      USING ERRCODE = '23503';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.society_id = target_society_id
      AND (
        membership.user_id = actor_id
        OR lower(membership.invited_email::text) = verified_email
      )
  ) THEN
    RAISE EXCEPTION 'A society membership already exists for this account.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.profiles
  SET full_name = normalized_name
  WHERE id = actor_id
    AND lower(email::text) = verified_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The verified account profile is unavailable.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.memberships (
    society_id, user_id, roles, status
  )
  VALUES (
    target_society_id, actor_id, ARRAY['resident']::text[], 'pending_approval'
  )
  RETURNING id INTO membership_id;

  INSERT INTO public.unit_occupants (
    society_id, unit_id, membership_id, relationship,
    is_primary, is_approver, status
  )
  VALUES (
    target_society_id, p_unit_id, membership_id, p_relationship,
    false,
    false,
    'pending'
  );

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    target_society_id, actor_id, 'resident', 'registration.submit', 'membership',
    membership_id::text,
    pg_catalog.jsonb_build_object(
      'unitId', p_unit_id,
      'relationship', p_relationship,
      'status', 'pending_approval'
    ),
    p_request_id
  );

  PERFORM private.create_notification(
    target_society_id, membership.user_id, 'registration_request',
    'Resident approval required',
    'A new resident has requested access to a unit.',
    'membership', membership_id, p_request_id
  )
  FROM public.memberships AS membership
  WHERE membership.society_id = target_society_id
    AND membership.status = 'active'
    AND membership.roles @> ARRAY['admin']::text[];

  RETURN membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_society_registration(
  text, uuid, text, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_society_registration(
  text, uuid, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_society_registration(
  p_society_id uuid,
  p_membership_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  applicant_id uuid;
BEGIN
  IF actor_id IS NULL
     OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.society_writable(p_society_id)
     OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.user_id INTO applicant_id
  FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id
    AND membership.id = p_membership_id
    AND membership.status = 'pending_approval'
    AND membership.user_id IS NOT NULL
    AND membership.roles @> ARRAY['resident']::text[]
  FOR UPDATE;
  IF applicant_id IS NULL THEN
    RAISE EXCEPTION 'Pending registration not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.memberships
  SET status = 'active',
      approved_by = actor_id,
      joined_at = COALESCE(joined_at, now()),
      left_at = NULL
  WHERE society_id = p_society_id
    AND id = p_membership_id;
  UPDATE public.unit_occupants
  SET is_primary = relationship IN ('owner', 'tenant'),
      is_approver = relationship IN ('owner', 'tenant')
  WHERE society_id = p_society_id
    AND membership_id = p_membership_id
    AND status = 'active';

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, actor_id, 'admin', 'members.approve', 'membership',
    p_membership_id::text,
    pg_catalog.jsonb_build_object('status', 'pending_approval'),
    pg_catalog.jsonb_build_object('status', 'active'),
    p_request_id
  );

  PERFORM private.create_notification(
    p_society_id, applicant_id, 'membership_approved',
    'Registration approved',
    'Your society access is now active.',
    'membership', p_membership_id, p_request_id
  );
  PERFORM private.create_notification(
    p_society_id, membership.user_id, 'registration_approved',
    'Resident registration approved',
    'A resident registration request has been approved.',
    'membership', p_membership_id, p_request_id
  )
  FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id
    AND membership.status = 'active'
    AND membership.roles @> ARRAY['admin']::text[];
END;
$$;

REVOKE ALL ON FUNCTION public.approve_society_registration(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approve_society_registration(uuid, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_society_registration(
  p_society_id uuid,
  p_membership_id uuid,
  p_reason text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  applicant_id uuid;
  rejection_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF actor_id IS NULL
     OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.society_writable(p_society_id)
     OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF rejection_reason IS NOT NULL AND char_length(rejection_reason) > 200 THEN
    RAISE EXCEPTION 'The rejection reason is too long.'
      USING ERRCODE = '22023';
  END IF;

  SELECT membership.user_id INTO applicant_id
  FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id
    AND membership.id = p_membership_id
    AND membership.status = 'pending_approval'
    AND membership.user_id IS NOT NULL
    AND membership.roles @> ARRAY['resident']::text[]
  FOR UPDATE;
  IF applicant_id IS NULL THEN
    RAISE EXCEPTION 'Pending registration not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.memberships
  SET status = 'active'
  WHERE society_id = p_society_id
    AND id = p_membership_id;

  PERFORM private.create_notification(
    p_society_id, applicant_id, 'membership_rejected',
    'Registration not approved',
    COALESCE(
      rejection_reason,
      'Your request to join this society was not approved.'
    ),
    'membership', p_membership_id, p_request_id
  );

  UPDATE public.memberships
  SET status = 'deactivated',
      left_at = now()
  WHERE society_id = p_society_id
    AND id = p_membership_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", reason, request_id
  )
  VALUES (
    p_society_id, actor_id, 'admin', 'members.reject', 'membership',
    p_membership_id::text,
    pg_catalog.jsonb_build_object('status', 'pending_approval'),
    pg_catalog.jsonb_build_object('status', 'deactivated'),
    rejection_reason,
    p_request_id
  );

  PERFORM private.create_notification(
    p_society_id, membership.user_id, 'registration_rejected',
    'Resident registration rejected',
    'A resident registration request was rejected.',
    'membership', p_membership_id, p_request_id
  )
  FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id
    AND membership.status = 'active'
    AND membership.roles @> ARRAY['admin']::text[];
END;
$$;

REVOKE ALL ON FUNCTION public.reject_society_registration(
  uuid, uuid, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reject_society_registration(
  uuid, uuid, text, text
) TO authenticated;
