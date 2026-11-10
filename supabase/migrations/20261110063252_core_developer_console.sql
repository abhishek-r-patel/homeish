CREATE POLICY module_configs_read_developer
  ON public.module_configs FOR SELECT TO authenticated
  USING (private.is_developer());

CREATE OR REPLACE FUNCTION public.developer_create_society(
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
  current_user_id uuid := (SELECT auth.uid());
  new_society_id uuid;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'A signed-in developer is required.'
      USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names
    WHERE name = p_timezone
  ) THEN
    RAISE EXCEPTION 'The timezone is not supported.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.societies (
    name,
    address,
    city,
    contact_email,
    contact_phone,
    timezone,
    currency,
    unit_label,
    plan,
    created_by,
    updated_by
  )
  VALUES (
    p_name,
    NULLIF(p_address, ''),
    NULLIF(p_city, ''),
    NULLIF(p_contact_email, '')::extensions.citext,
    NULLIF(p_contact_phone, ''),
    p_timezone,
    p_currency,
    p_unit_label,
    NULLIF(p_plan, ''),
    current_user_id,
    current_user_id
  )
  RETURNING id INTO new_society_id;

  INSERT INTO public.module_configs (
    society_id,
    module_key,
    enabled,
    settings,
    updated_by
  )
  VALUES (new_society_id, 'core', true, '{}'::jsonb, current_user_id);

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    new_society_id,
    current_user_id,
    'developer',
    'developer.societies.create',
    'society',
    new_society_id::text,
    pg_catalog.jsonb_build_object(
      'name', p_name,
      'address', NULLIF(p_address, ''),
      'city', NULLIF(p_city, ''),
      'contact_email', NULLIF(p_contact_email, ''),
      'contact_phone', NULLIF(p_contact_phone, ''),
      'timezone', p_timezone,
      'currency', p_currency,
      'unit_label', p_unit_label,
      'plan', NULLIF(p_plan, ''),
      'status', 'trial'
    ),
    p_request_id
  );
  RETURN new_society_id;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_update_society(
  p_society_id uuid,
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
RETURNS public.societies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_row public.societies;
  after_row public.societies;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names
    WHERE name = p_timezone
  ) THEN
    RAISE EXCEPTION 'The timezone is not supported.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before_row
  FROM public.societies
  WHERE id = p_society_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.societies
  SET name = p_name,
      address = NULLIF(p_address, ''),
      city = NULLIF(p_city, ''),
      contact_email = NULLIF(p_contact_email, '')::extensions.citext,
      contact_phone = NULLIF(p_contact_phone, ''),
      timezone = p_timezone,
      currency = p_currency,
      unit_label = p_unit_label,
      plan = NULLIF(p_plan, ''),
      updated_by = current_user_id
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
    'developer.societies.update',
    'society',
    p_society_id::text,
    pg_catalog.jsonb_build_object(
      'name', before_row.name,
      'address', before_row.address,
      'city', before_row.city,
      'contact_email', before_row.contact_email,
      'contact_phone', before_row.contact_phone,
      'timezone', before_row.timezone,
      'currency', before_row.currency,
      'unit_label', before_row.unit_label,
      'plan', before_row.plan
    ),
    pg_catalog.jsonb_build_object(
      'name', after_row.name,
      'address', after_row.address,
      'city', after_row.city,
      'contact_email', after_row.contact_email,
      'contact_phone', after_row.contact_phone,
      'timezone', after_row.timezone,
      'currency', after_row.currency,
      'unit_label', after_row.unit_label,
      'plan', after_row.plan
    ),
    p_request_id
  );
  RETURN after_row;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_set_society_status(
  p_society_id uuid,
  p_status text,
  p_request_id text
)
RETURNS public.societies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_status text;
  after_row public.societies;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('trial', 'active', 'suspended', 'archived') THEN
    RAISE EXCEPTION 'The society status is not supported.'
      USING ERRCODE = '22023';
  END IF;

  SELECT status INTO before_status
  FROM public.societies
  WHERE id = p_society_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.societies
  SET status = p_status, updated_by = current_user_id
  WHERE id = p_society_id
  RETURNING * INTO after_row;

  IF before_status IS DISTINCT FROM p_status THEN
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
      'developer.societies.setStatus',
      'society',
      p_society_id::text,
      pg_catalog.jsonb_build_object('status', before_status),
      pg_catalog.jsonb_build_object('status', p_status),
      p_request_id
    );
  END IF;
  RETURN after_row;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_toggle_module(
  p_society_id uuid,
  p_module_key text,
  p_enabled boolean,
  p_request_id text
)
RETURNS public.module_configs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_row public.module_configs;
  after_row public.module_configs;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_module_key = 'core' THEN
    RAISE EXCEPTION 'The core module is always enabled.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.societies WHERE id = p_society_id
  ) THEN
    RAISE EXCEPTION 'The society was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE key = p_module_key
  ) THEN
    RAISE EXCEPTION 'The module was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO before_row
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = p_module_key
  FOR UPDATE;

  INSERT INTO public.module_configs (
    society_id,
    module_key,
    enabled,
    settings,
    updated_by
  )
  VALUES (
    p_society_id,
    p_module_key,
    p_enabled,
    COALESCE(before_row.settings, '{}'::jsonb),
    current_user_id
  )
  ON CONFLICT (society_id, module_key) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_by = EXCLUDED.updated_by
  RETURNING * INTO after_row;

  IF before_row.enabled IS DISTINCT FROM p_enabled THEN
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
      'developer.modules.toggle',
      'module_config',
      p_module_key,
      pg_catalog.jsonb_build_object(
        'enabled', COALESCE(before_row.enabled, false)
      ),
      pg_catalog.jsonb_build_object('enabled', p_enabled),
      p_request_id
    );
  END IF;
  RETURN after_row;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_update_module_settings(
  p_society_id uuid,
  p_module_key text,
  p_settings jsonb,
  p_request_id text
)
RETURNS public.module_configs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_row public.module_configs;
  after_row public.module_configs;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_module_key = 'core' OR pg_catalog.jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'The module settings are not supported.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before_row
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = p_module_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The module configuration was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.module_configs
  SET settings = p_settings, updated_by = current_user_id
  WHERE society_id = p_society_id AND module_key = p_module_key
  RETURNING * INTO after_row;

  IF before_row.settings IS DISTINCT FROM p_settings THEN
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
      'developer.modules.updateSettings',
      'module_config',
      p_module_key,
      pg_catalog.jsonb_build_object('settings', before_row.settings),
      pg_catalog.jsonb_build_object('settings', p_settings),
      p_request_id
    );
  END IF;
  RETURN after_row;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_create_first_admin(
  p_society_id uuid,
  p_email text,
  p_request_id text
)
RETURNS public.memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  new_membership public.memberships;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.societies
  WHERE id = p_society_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id
      AND 'admin' = ANY(roles)
      AND status <> 'deactivated'
  ) THEN
    RAISE EXCEPTION 'An administrator already exists.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.memberships (
    society_id,
    invited_email,
    roles,
    status,
    invited_by
  )
  VALUES (
    p_society_id,
    pg_catalog.lower(pg_catalog.btrim(p_email))::extensions.citext,
    ARRAY['admin']::text[],
    'invited',
    current_user_id
  )
  RETURNING * INTO new_membership;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    current_user_id,
    'developer',
    'developer.members.createFirstAdmin',
    'membership',
    new_membership.id::text,
    pg_catalog.jsonb_build_object(
      'invited_email', new_membership.invited_email,
      'roles', new_membership.roles,
      'status', new_membership.status
    ),
    p_request_id
  );
  RETURN new_membership;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_set_error_status(
  p_error_id uuid,
  p_status text,
  p_note text,
  p_request_id text
)
RETURNS public.error_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_row public.error_logs;
  after_row public.error_logs;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('resolved', 'ignored') THEN
    RAISE EXCEPTION 'The error status is not supported.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before_row
  FROM public.error_logs
  WHERE id = p_error_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The error was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.error_logs
  SET status = p_status,
      resolved_by = current_user_id,
      resolved_at = now(),
      resolve_note = NULLIF(p_note, '')
  WHERE id = p_error_id
  RETURNING * INTO after_row;

  IF before_row.status IS DISTINCT FROM p_status
    OR before_row.resolve_note IS DISTINCT FROM NULLIF(p_note, '')
  THEN
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
      before_row.society_id,
      current_user_id,
      'developer',
      'developer.errors.' || p_status,
      'error_log',
      p_error_id::text,
      pg_catalog.jsonb_build_object(
        'status', before_row.status,
        'resolve_note', before_row.resolve_note
      ),
      pg_catalog.jsonb_build_object(
        'status', p_status,
        'resolve_note', NULLIF(p_note, '')
      ),
      p_request_id
    );
  END IF;
  RETURN after_row;
END
$$;

CREATE OR REPLACE FUNCTION public.developer_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'last24HoursBySeverity', (
      SELECT COALESCE(
        pg_catalog.jsonb_object_agg(severity, total),
        '{}'::jsonb
      )
      FROM (
        SELECT severity, count(*) AS total
        FROM public.error_logs
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY severity
      ) AS counts
    ),
    'topRoutes', (
      SELECT COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('route', route, 'total', total)
          ORDER BY total DESC, route
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT route, count(*) AS total
        FROM public.error_logs
        WHERE created_at >= now() - interval '24 hours'
          AND route IS NOT NULL
        GROUP BY route
        ORDER BY count(*) DESC, route
        LIMIT 5
      ) AS routes
    ),
    'societyErrors', (
      SELECT COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'societyId', society_id,
            'societyName', society_name,
            'total', total
          )
          ORDER BY total DESC, society_name
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          errors.society_id,
          society.name AS society_name,
          count(*) AS total
        FROM public.error_logs AS errors
        JOIN public.societies AS society ON society.id = errors.society_id
        WHERE errors.created_at >= now() - interval '24 hours'
        GROUP BY errors.society_id, society.name
        ORDER BY count(*) DESC, society.name
        LIMIT 5
      ) AS societies
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.developer_create_society(
  text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_update_society(
  uuid, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_set_society_status(uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_toggle_module(uuid, text, boolean, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_update_module_settings(
  uuid, text, jsonb, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_create_first_admin(uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_set_error_status(
  uuid, text, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_health_summary()
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.developer_create_society(
  text, text, text, text, text, text, text, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_update_society(
  uuid, text, text, text, text, text, text, text, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_set_society_status(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_toggle_module(uuid, text, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_update_module_settings(
  uuid, text, jsonb, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_create_first_admin(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_set_error_status(
  uuid, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_health_summary()
  TO authenticated;