CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  invited_email extensions.citext,
  roles text[] NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_identity_check
    CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL),
  CONSTRAINT memberships_invited_email_check
    CHECK (
      invited_email IS NULL
      OR char_length(btrim(invited_email::text)) BETWEEN 3 AND 254
    ),
  CONSTRAINT memberships_roles_check
    CHECK (
      cardinality(roles) > 0
      AND roles <@ ARRAY[
        'admin',
        'committee',
        'guard',
        'hk_supervisor',
        'resident'
      ]::text[]
    ),
  CONSTRAINT memberships_status_check
    CHECK (status IN ('invited', 'pending_approval', 'active', 'deactivated')),
  CONSTRAINT memberships_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT memberships_society_user_id_key UNIQUE (society_id, user_id)
);

CREATE UNIQUE INDEX memberships_society_invited_email_key
  ON public.memberships (society_id, invited_email)
  WHERE user_id IS NULL;

CREATE INDEX memberships_society_id_idx
  ON public.memberships (society_id);

CREATE INDEX memberships_user_id_idx
  ON public.memberships (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX memberships_invited_by_idx
  ON public.memberships (invited_by)
  WHERE invited_by IS NOT NULL;

CREATE INDEX memberships_approved_by_idx
  ON public.memberships (approved_by)
  WHERE approved_by IS NOT NULL;

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_read_self_or_managers
  ON public.memberships FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );

REVOKE ALL ON TABLE public.memberships FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.memberships TO authenticated;

CREATE OR REPLACE FUNCTION private.is_member(p_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(p_society_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
      AND membership.roles && p_roles
  )
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
  SELECT COALESCE(
    p_module_key = 'core'
    OR EXISTS (
      SELECT 1
      FROM public.module_configs AS module_config
      WHERE module_config.society_id = p_society_id
        AND module_config.module_key = p_module_key
        AND module_config.enabled
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION private.society_writable(p_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.societies AS society
    WHERE society.id = p_society_id
      AND society.status IN ('trial', 'active')
  )
$$;

REVOKE ALL ON FUNCTION private.is_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.module_enabled(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.society_writable(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.module_enabled(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.society_writable(uuid) TO authenticated, service_role;
