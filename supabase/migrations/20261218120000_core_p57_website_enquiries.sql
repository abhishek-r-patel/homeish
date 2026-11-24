-- P57 public website contact settings and private enquiries. RLS denies every direct table operation.
CREATE TABLE public.platform_website_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  contact_email extensions.citext,
  enquiry_hourly_limit integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT platform_website_settings_singleton_check CHECK (id = 1),
  CONSTRAINT platform_website_settings_limit_check
    CHECK (enquiry_hourly_limit BETWEEN 1 AND 100)
);

INSERT INTO public.platform_website_settings (id)
VALUES (1);

CREATE TABLE public.website_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  full_name text NOT NULL,
  society_name text,
  city text,
  flat_count integer,
  email extensions.citext,
  phone text,
  message text,
  status text NOT NULL DEFAULT 'new',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT website_enquiries_request_id_check
    CHECK (char_length(request_id) BETWEEN 1 AND 128),
  CONSTRAINT website_enquiries_name_check
    CHECK (
      char_length(btrim(full_name)) BETWEEN 1 AND 120
      AND full_name = btrim(full_name)
    ),
  CONSTRAINT website_enquiries_society_name_check
    CHECK (
      society_name IS NULL
      OR char_length(btrim(society_name)) BETWEEN 1 AND 160
    ),
  CONSTRAINT website_enquiries_city_check
    CHECK (city IS NULL OR char_length(btrim(city)) BETWEEN 1 AND 120),
  CONSTRAINT website_enquiries_flat_count_check
    CHECK (flat_count IS NULL OR flat_count BETWEEN 1 AND 100000),
  CONSTRAINT website_enquiries_email_check
    CHECK (email IS NULL OR char_length(email::text) <= 254),
  CONSTRAINT website_enquiries_phone_check
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{10,15}$'),
  CONSTRAINT website_enquiries_contact_check
    CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT website_enquiries_message_check
    CHECK (message IS NULL OR char_length(btrim(message)) BETWEEN 1 AND 2000),
  CONSTRAINT website_enquiries_status_check
    CHECK (status IN ('new', 'handled')),
  CONSTRAINT website_enquiries_handled_check
    CHECK (
      (status = 'new' AND handled_at IS NULL AND handled_by IS NULL)
      OR (
        status = 'handled'
        AND handled_at IS NOT NULL
        AND handled_by IS NOT NULL
      )
    ),
  UNIQUE (request_id)
);

CREATE INDEX website_enquiries_status_submitted_idx
  ON public.website_enquiries (status, submitted_at DESC);

ALTER TABLE public.platform_website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_website_settings_no_direct_access
  ON public.platform_website_settings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY website_enquiries_no_direct_access
  ON public.website_enquiries FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.platform_website_settings, public.website_enquiries
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.website_public_settings_get()
RETURNS TABLE (
  contact_email text,
  enquiry_hourly_limit integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT settings.contact_email::text, settings.enquiry_hourly_limit
  FROM public.platform_website_settings AS settings
  WHERE settings.id = 1
$$;

CREATE FUNCTION public.website_enquiry_create(
  p_request_id text,
  p_full_name text,
  p_society_name text,
  p_city text,
  p_flat_count integer,
  p_email text,
  p_phone text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  enquiry_id uuid;
BEGIN
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_full_name IS NULL
    OR char_length(btrim(p_full_name)) NOT BETWEEN 1 AND 120
    OR (
      p_society_name IS NOT NULL
      AND char_length(btrim(p_society_name)) NOT BETWEEN 1 AND 160
    )
    OR (p_city IS NOT NULL AND char_length(btrim(p_city)) NOT BETWEEN 1 AND 120)
    OR (p_flat_count IS NOT NULL AND p_flat_count NOT BETWEEN 1 AND 100000)
    OR (p_email IS NULL AND p_phone IS NULL)
    OR (
      p_email IS NOT NULL
      AND (
        char_length(btrim(p_email)) NOT BETWEEN 3 AND 254
        OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
    OR (
      p_phone IS NOT NULL
      AND btrim(p_phone) !~ '^\+?[0-9]{10,15}$'
    )
    OR (
      p_message IS NOT NULL
      AND char_length(btrim(p_message)) NOT BETWEEN 1 AND 2000
    )
  THEN
    RAISE EXCEPTION 'The enquiry details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.website_enquiries (
    request_id,
    full_name,
    society_name,
    city,
    flat_count,
    email,
    phone,
    message
  )
  VALUES (
    p_request_id,
    btrim(p_full_name),
    NULLIF(btrim(p_society_name), ''),
    NULLIF(btrim(p_city), ''),
    p_flat_count,
    NULLIF(lower(btrim(p_email)), '')::extensions.citext,
    NULLIF(btrim(p_phone), ''),
    NULLIF(btrim(p_message), '')
  )
  ON CONFLICT (request_id) DO UPDATE
  SET request_id = EXCLUDED.request_id
  RETURNING id INTO enquiry_id;
  RETURN enquiry_id;
END;
$$;

CREATE FUNCTION public.developer_website_settings_get()
RETURNS TABLE (
  contact_email text,
  enquiry_hourly_limit integer,
  updated_at timestamptz,
  updated_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer MFA access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    settings.contact_email::text,
    settings.enquiry_hourly_limit,
    settings.updated_at,
    settings.updated_by
  FROM public.platform_website_settings AS settings
  WHERE settings.id = 1;
END;
$$;

CREATE FUNCTION public.developer_website_settings_save(
  p_contact_email text,
  p_enquiry_hourly_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_email text;
  previous_limit integer;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer MFA access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_enquiry_hourly_limit NOT BETWEEN 1 AND 100
    OR (
      p_contact_email IS NOT NULL
      AND (
        char_length(btrim(p_contact_email)) NOT BETWEEN 3 AND 254
        OR lower(btrim(p_contact_email)) !~
          '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
  THEN
    RAISE EXCEPTION 'The website settings are invalid.' USING ERRCODE = '22023';
  END IF;

  SELECT settings.contact_email::text, settings.enquiry_hourly_limit
  INTO previous_email, previous_limit
  FROM public.platform_website_settings AS settings
  WHERE settings.id = 1;

  UPDATE public.platform_website_settings
  SET
    contact_email = NULLIF(lower(btrim(p_contact_email)), '')::extensions.citext,
    enquiry_hourly_limit = p_enquiry_hourly_limit,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "before",
    "after"
  )
  VALUES (
    NULL,
    auth.uid(),
    'developer',
    'website.settings.save',
    'platform_website_settings',
    '1',
    jsonb_build_object(
      'contactEmailSet', previous_email IS NOT NULL,
      'enquiryHourlyLimit', previous_limit
    ),
    jsonb_build_object(
      'contactEmailSet',
        NULLIF(lower(btrim(p_contact_email)), '') IS NOT NULL,
      'enquiryHourlyLimit', p_enquiry_hourly_limit
    )
  );
END;
$$;

CREATE FUNCTION public.developer_website_enquiries_get()
RETURNS TABLE (
  id uuid,
  full_name text,
  society_name text,
  city text,
  flat_count integer,
  email text,
  phone text,
  message text,
  status text,
  submitted_at timestamptz,
  handled_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer MFA access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    enquiry.id,
    enquiry.full_name,
    enquiry.society_name,
    enquiry.city,
    enquiry.flat_count,
    enquiry.email::text,
    enquiry.phone,
    enquiry.message,
    enquiry.status,
    enquiry.submitted_at,
    enquiry.handled_at
  FROM public.website_enquiries AS enquiry
  ORDER BY enquiry.status = 'handled', enquiry.submitted_at DESC
  LIMIT 500;
END;
$$;

CREATE FUNCTION public.developer_website_enquiry_handle(p_enquiry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer MFA access is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.website_enquiries
  SET status = 'handled', handled_at = now(), handled_by = auth.uid()
  WHERE id = p_enquiry_id AND status = 'new';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The enquiry is unavailable or already handled.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE FUNCTION public.developer_website_enquiry_delete(p_enquiry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_status text;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer MFA access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT enquiry.status
  INTO previous_status
  FROM public.website_enquiries AS enquiry
  WHERE enquiry.id = p_enquiry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The enquiry was not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "before"
  )
  VALUES (
    NULL,
    auth.uid(),
    'developer',
    'website.enquiry.delete',
    'website_enquiry',
    p_enquiry_id::text,
    jsonb_build_object('status', previous_status)
  );
  DELETE FROM public.website_enquiries WHERE id = p_enquiry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.website_public_settings_get()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.website_enquiry_create(
  text, text, text, text, integer, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.developer_website_settings_get()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_website_settings_save(text, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_website_enquiries_get()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_website_enquiry_handle(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.developer_website_enquiry_delete(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.website_public_settings_get()
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_enquiry_create(
  text, text, text, text, integer, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.developer_website_settings_get()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_website_settings_save(text, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_website_enquiries_get()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_website_enquiry_handle(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_website_enquiry_delete(uuid)
  TO authenticated;
