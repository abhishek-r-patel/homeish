CREATE OR REPLACE FUNCTION public.has_signin_access(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email text;
BEGIN
  IF p_email IS NULL
     OR char_length(btrim(p_email)) NOT BETWEEN 3 AND 254
  THEN
    RAISE EXCEPTION 'Invalid sign-in email.'
      USING ERRCODE = '22023';
  END IF;

  normalized_email := lower(btrim(p_email));

  RETURN EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.status = 'invited'
      AND membership.user_id IS NULL
      AND lower(membership.invited_email::text) = normalized_email
  ) OR EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    JOIN public.profiles AS profile
      ON profile.id = membership.user_id
    WHERE membership.status IN ('active', 'pending_approval')
      AND profile.status = 'active'
      AND lower(profile.email::text) = normalized_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_signin_access(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_signin_access(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_memberships()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  verified_email text;
  claimed_count integer;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'A verified sign-in session is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT lower(auth_user.email)
    INTO verified_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = current_user_id
    AND auth_user.email_confirmed_at IS NOT NULL;

  IF verified_email IS NULL THEN
    RAISE EXCEPTION 'A verified sign-in session is required.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.memberships AS membership
  SET user_id = current_user_id,
      invited_email = NULL,
      status = 'active',
      joined_at = COALESCE(membership.joined_at, now()),
      left_at = NULL
  WHERE membership.status = 'invited'
    AND membership.user_id IS NULL
    AND lower(membership.invited_email::text) = verified_email
    AND NOT EXISTS (
      SELECT 1
      FROM public.memberships AS existing_membership
      WHERE existing_membership.society_id = membership.society_id
        AND existing_membership.user_id = current_user_id
    );

  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_memberships()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_memberships() TO authenticated;