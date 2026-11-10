CREATE OR REPLACE FUNCTION private.is_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT false
$$;

CREATE OR REPLACE FUNCTION private.is_member(p_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT false
$$;

CREATE OR REPLACE FUNCTION private.has_role(p_society_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT false
$$;

CREATE OR REPLACE FUNCTION private.module_enabled(
  p_society_id uuid,
  p_module_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(p_module_key = 'core', false)
$$;

CREATE OR REPLACE FUNCTION private.society_writable(p_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT false
$$;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.is_developer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.module_enabled(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.society_writable(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_developer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.module_enabled(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.society_writable(uuid) TO authenticated, service_role;
