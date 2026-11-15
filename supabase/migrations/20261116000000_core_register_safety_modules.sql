-- Register the Document Repository, Parking and Emergency SOS modules (disabled by default).
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES
  ('document', 'Document Repository', false, 13),
  ('parking', 'Parking', false, 14),
  ('sos', 'Emergency & SOS', false, 15);

CREATE FUNCTION private.document_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object' AND p_settings = '{}'::jsonb
$$;

CREATE FUNCTION private.parking_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key <> 'photo_retention_days'
    )
    AND (NOT p_settings ? 'photo_retention_days'
      OR (jsonb_typeof(p_settings -> 'photo_retention_days') = 'number'
        AND (p_settings ->> 'photo_retention_days') ~ '^[0-9]+$'
        AND (p_settings ->> 'photo_retention_days')::integer BETWEEN 1 AND 90))
$$;

CREATE FUNCTION private.sos_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN (
        'notify_guards', 'notify_admins', 'notify_committee', 'resident_scope'
      )
    )
    AND (NOT p_settings ? 'notify_guards'
      OR jsonb_typeof(p_settings -> 'notify_guards') = 'boolean')
    AND (NOT p_settings ? 'notify_admins'
      OR jsonb_typeof(p_settings -> 'notify_admins') = 'boolean')
    AND (NOT p_settings ? 'notify_committee'
      OR jsonb_typeof(p_settings -> 'notify_committee') = 'boolean')
    AND (NOT p_settings ? 'resident_scope'
      OR (jsonb_typeof(p_settings -> 'resident_scope') = 'string'
        AND p_settings ->> 'resident_scope' IN ('off', 'floor', 'block', 'society')))
$$;

REVOKE ALL ON FUNCTION private.document_settings_valid(jsonb),
  private.parking_settings_valid(jsonb),
  private.sos_settings_valid(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.document_settings_valid(jsonb),
  private.parking_settings_valid(jsonb),
  private.sos_settings_valid(jsonb)
  TO authenticated, service_role;

ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_document_settings_check
  CHECK (module_key <> 'document' OR private.document_settings_valid(settings));
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_parking_settings_check
  CHECK (module_key <> 'parking' OR private.parking_settings_valid(settings));
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_sos_settings_check
  CHECK (module_key <> 'sos' OR private.sos_settings_valid(settings));
