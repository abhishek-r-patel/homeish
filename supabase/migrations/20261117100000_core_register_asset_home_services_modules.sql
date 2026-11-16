-- Register the Asset Register and Home-Services Directory modules (disabled by default).
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos', 'vendor', 'patrol', 'metering', 'asset',
    'home_services')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES
  ('asset', 'Asset Register', false, 19),
  ('home_services', 'Home Services', false, 20);

CREATE FUNCTION private.asset_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object' AND p_settings = '{}'::jsonb
$$;

CREATE FUNCTION private.home_services_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object' AND p_settings = '{}'::jsonb
$$;

REVOKE ALL ON FUNCTION private.asset_settings_valid(jsonb),
  private.home_services_settings_valid(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.asset_settings_valid(jsonb),
  private.home_services_settings_valid(jsonb)
  TO authenticated, service_role;

ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_asset_settings_check
  CHECK (module_key <> 'asset' OR private.asset_settings_valid(settings));
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_home_services_settings_check
  CHECK (module_key <> 'home_services'
    OR private.home_services_settings_valid(settings));
