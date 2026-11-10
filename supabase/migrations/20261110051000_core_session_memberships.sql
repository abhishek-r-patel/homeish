CREATE OR REPLACE FUNCTION public.session_memberships()
RETURNS TABLE (
  society_id uuid,
  society_name text,
  society_status text,
  membership_status text,
  roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    membership.society_id,
    society.name,
    society.status,
    membership.status,
    membership.roles
  FROM public.memberships AS membership
  JOIN public.societies AS society
    ON society.id = membership.society_id
  JOIN public.profiles AS profile
    ON profile.id = membership.user_id
  WHERE membership.user_id = (SELECT auth.uid())
    AND profile.status = 'active'
    AND membership.status IN ('active', 'pending_approval')
  ORDER BY society.name, membership.society_id
$$;

REVOKE ALL ON FUNCTION public.session_memberships()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.session_memberships() TO authenticated;
