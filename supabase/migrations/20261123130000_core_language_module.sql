-- Add society-controlled Hindi availability behind the developer Language module.
ALTER TABLE public.societies
  ADD COLUMN hindi_available boolean NOT NULL DEFAULT false;

GRANT SELECT (hindi_available) ON public.societies TO authenticated;

ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos', 'vendor', 'patrol', 'metering', 'asset',
    'home_services', 'poll', 'meeting', 'event', 'community', 'language')
);

INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('language', 'Language Support', false, 25);

CREATE FUNCTION public.admin_set_hindi_availability(
  p_society_id uuid,
  p_hindi_available boolean,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.societies;
  after_row public.societies;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'language')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_hindi_available IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Choose a Hindi availability setting.'
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
  IF before_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The society settings changed.'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.societies
  SET hindi_available = p_hindi_available,
      updated_by = current_user_id
  WHERE id = p_society_id
  RETURNING * INTO after_row;

  IF before_row.hindi_available IS DISTINCT FROM after_row.hindi_available THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    )
    VALUES (
      p_society_id, current_user_id, 'admin', 'society.update_language_availability',
      'society', p_society_id::text,
      pg_catalog.jsonb_build_object(
        'hindi_available', before_row.hindi_available
      ),
      pg_catalog.jsonb_build_object(
        'hindi_available', after_row.hindi_available
      ),
      p_request_id
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'hindi_available', after_row.hindi_available,
    'updated_at', after_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_hindi_availability(
  uuid, boolean, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_hindi_availability(
  uuid, boolean, timestamptz, text
) TO authenticated;