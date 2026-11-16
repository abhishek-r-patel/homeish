-- Register the Polls & Voting module (disabled by default) and validate its settings.
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos', 'vendor', 'patrol', 'metering', 'asset',
    'home_services', 'poll')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('poll', 'Polls & Voting', false, 21);

CREATE FUNCTION private.poll_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN ('tenant_voting_default')
    )
    AND (NOT p_settings ? 'tenant_voting_default'
      OR jsonb_typeof(p_settings -> 'tenant_voting_default') = 'boolean')
$$;

REVOKE ALL ON FUNCTION private.poll_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.poll_settings_valid(jsonb) TO authenticated, service_role;

ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_poll_settings_check
  CHECK (module_key <> 'poll' OR private.poll_settings_valid(settings));
