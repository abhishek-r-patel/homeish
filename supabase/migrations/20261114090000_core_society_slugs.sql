-- Society host addresses (slugs) for the create-society script and host-page lookup (D-34).
ALTER TABLE public.societies
  ADD COLUMN slug text,
  ADD CONSTRAINT societies_slug_key UNIQUE (slug),
  ADD CONSTRAINT societies_slug_check CHECK (
    slug IS NULL OR (
      slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
      AND slug NOT IN ('www', 'demo', 'beta', 'admin', 'api')
    )
  );

-- A society host is pinned in code to its slug, so an assigned slug never changes.
CREATE OR REPLACE FUNCTION private.societies_keep_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.slug IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'The society address cannot be changed.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.societies_keep_slug() FROM PUBLIC, anon;

CREATE TRIGGER societies_keep_slug
  BEFORE UPDATE OF slug ON public.societies
  FOR EACH ROW EXECUTE FUNCTION private.societies_keep_slug();

CREATE OR REPLACE FUNCTION public.developer_set_society_slug(
  p_society_id uuid,
  p_slug text,
  p_request_id text
)
RETURNS public.societies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_slug text;
  after_row public.societies;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_slug IS NULL
    OR p_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    OR p_slug IN ('www', 'demo', 'beta', 'admin', 'api')
  THEN
    RAISE EXCEPTION 'The society address is not supported.'
      USING ERRCODE = '22023';
  END IF;

  SELECT slug INTO before_slug
  FROM public.societies
  WHERE id = p_society_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF before_slug = p_slug THEN
    SELECT * INTO after_row FROM public.societies WHERE id = p_society_id;
    RETURN after_row;
  END IF;
  IF before_slug IS NOT NULL THEN
    RAISE EXCEPTION 'The society address is already set.'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.societies WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'The society address is already in use.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.societies
  SET slug = p_slug, updated_by = current_user_id
  WHERE id = p_society_id
  RETURNING * INTO after_row;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "before",
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    current_user_id,
    'developer',
    'developer.societies.setSlug',
    'society',
    p_society_id::text,
    pg_catalog.jsonb_build_object('slug', before_slug),
    pg_catalog.jsonb_build_object('slug', p_slug),
    p_request_id
  );
  RETURN after_row;
END
$$;

-- Creating with a slug is one transaction, so a retry never leaves an unaddressed duplicate.
CREATE OR REPLACE FUNCTION public.developer_create_society_with_slug(
  p_slug text,
  p_name text,
  p_address text,
  p_city text,
  p_contact_email text,
  p_contact_phone text,
  p_timezone text,
  p_currency text,
  p_unit_label text,
  p_plan text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_society_id uuid;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.societies WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'The society address is already in use.'
      USING ERRCODE = '23505';
  END IF;

  new_society_id := public.developer_create_society(
    p_name,
    p_address,
    p_city,
    p_contact_email,
    p_contact_phone,
    p_timezone,
    p_currency,
    p_unit_label,
    p_plan,
    p_request_id
  );
  PERFORM public.developer_set_society_slug(
    new_society_id,
    p_slug,
    p_request_id
  );
  RETURN new_society_id;
END
$$;

-- Read-only state the create-society script needs to decide what to create or reuse.
CREATE OR REPLACE FUNCTION public.developer_society_onboarding_status(
  p_slug text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  found_society public.societies;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO found_society
  FROM public.societies
  WHERE slug = p_slug;

  RETURN pg_catalog.jsonb_build_object(
    'society', CASE WHEN found_society.id IS NULL THEN NULL ELSE
      pg_catalog.jsonb_build_object(
        'id', found_society.id,
        'name', found_society.name,
        'slug', found_society.slug,
        'status', found_society.status,
        'admins', (
          SELECT COALESCE(
            pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'email', COALESCE(profile.email, membership.invited_email),
                'status', membership.status
              )
              ORDER BY membership.created_at
            ),
            '[]'::jsonb
          )
          FROM public.memberships AS membership
          LEFT JOIN public.profiles AS profile
            ON profile.id = membership.user_id
          WHERE membership.society_id = found_society.id
            AND 'admin' = ANY(membership.roles)
            AND membership.status <> 'deactivated'
        ),
        'enabledModules', (
          SELECT COALESCE(
            pg_catalog.jsonb_agg(config.module_key ORDER BY config.module_key),
            '[]'::jsonb
          )
          FROM public.module_configs AS config
          WHERE config.society_id = found_society.id
            AND config.enabled
        )
      )
    END,
    'unaddressedNameMatches', (
      SELECT COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', society.id,
            'name', society.name,
            'status', society.status
          )
          ORDER BY society.created_at
        ),
        '[]'::jsonb
      )
      FROM public.societies AS society
      WHERE society.slug IS NULL
        AND pg_catalog.lower(pg_catalog.btrim(society.name))
          = pg_catalog.lower(pg_catalog.btrim(p_name))
    )
  );
END
$$;

-- Server-only host lookup: the society page shows sign-in only when the slug matches a record.
CREATE OR REPLACE FUNCTION public.society_host_lookup(p_slug text)
RETURNS TABLE (id uuid, name text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT society.id, society.name, society.status
  FROM public.societies AS society
  WHERE society.slug = p_slug
    AND society.status <> 'archived'
$$;

REVOKE ALL ON FUNCTION public.developer_set_society_slug(uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_create_society_with_slug(
  text, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_society_onboarding_status(text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.society_host_lookup(text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.developer_set_society_slug(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_create_society_with_slug(
  text, text, text, text, text, text, text, text, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_society_onboarding_status(text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.society_host_lookup(text)
  TO service_role;
