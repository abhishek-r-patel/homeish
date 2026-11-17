-- Register the Resident Community & Marketplace module (disabled by default; no society settings) (D-64).
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos', 'vendor', 'patrol', 'metering', 'asset',
    'home_services', 'poll', 'meeting', 'event', 'community')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('community', 'Community & Marketplace', false, 24);

CREATE FUNCTION private.community_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object' AND p_settings = '{}'::jsonb
$$;

REVOKE ALL ON FUNCTION private.community_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.community_settings_valid(jsonb) TO authenticated, service_role;

ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_community_settings_check
  CHECK (module_key <> 'community' OR private.community_settings_valid(settings));
