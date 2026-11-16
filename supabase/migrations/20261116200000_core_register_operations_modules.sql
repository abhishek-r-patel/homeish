-- Register the Vendors, Guard Patrol and Utility Metering modules (disabled by default).
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos', 'vendor', 'patrol', 'metering')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES
  ('vendor', 'Vendors & Purchases', false, 16),
  ('patrol', 'Guard Patrol', false, 17),
  ('metering', 'Utility Metering', false, 18);

CREATE FUNCTION private.vendor_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN (
        'quote_threshold_paise', 'quotes_above_threshold', 'approvals_required'
      )
    )
    AND (NOT p_settings ? 'quote_threshold_paise'
      OR (jsonb_typeof(p_settings -> 'quote_threshold_paise') = 'number'
        AND (p_settings ->> 'quote_threshold_paise') ~ '^[0-9]{1,12}$'
        AND (p_settings ->> 'quote_threshold_paise')::bigint
          BETWEEN 0 AND 100000000000))
    AND (NOT p_settings ? 'quotes_above_threshold'
      OR (jsonb_typeof(p_settings -> 'quotes_above_threshold') = 'number'
        AND (p_settings ->> 'quotes_above_threshold') ~ '^[0-9]+$'
        AND (p_settings ->> 'quotes_above_threshold')::integer BETWEEN 1 AND 5))
    AND (NOT p_settings ? 'approvals_required'
      OR (jsonb_typeof(p_settings -> 'approvals_required') = 'number'
        AND (p_settings ->> 'approvals_required') ~ '^[0-9]+$'
        AND (p_settings ->> 'approvals_required')::integer BETWEEN 0 AND 5))
$$;

CREATE FUNCTION private.patrol_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key <> 'photo_retention_days'
    )
    AND (NOT p_settings ? 'photo_retention_days'
      OR (jsonb_typeof(p_settings -> 'photo_retention_days') = 'number'
        AND (p_settings ->> 'photo_retention_days') ~ '^[0-9]+$'
        AND (p_settings ->> 'photo_retention_days')::integer BETWEEN 30 AND 365))
$$;

CREATE FUNCTION private.metering_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object' AND p_settings = '{}'::jsonb
$$;

REVOKE ALL ON FUNCTION private.vendor_settings_valid(jsonb),
  private.patrol_settings_valid(jsonb),
  private.metering_settings_valid(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vendor_settings_valid(jsonb),
  private.patrol_settings_valid(jsonb),
  private.metering_settings_valid(jsonb)
  TO authenticated, service_role;

ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_vendor_settings_check
  CHECK (module_key <> 'vendor' OR private.vendor_settings_valid(settings));
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_patrol_settings_check
  CHECK (module_key <> 'patrol' OR private.patrol_settings_valid(settings));
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_metering_settings_check
  CHECK (module_key <> 'metering' OR private.metering_settings_valid(settings));
