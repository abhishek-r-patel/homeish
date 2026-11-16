-- Register the Meetings & AGM module (disabled by default) and validate its settings (D-61).
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy',
    'document', 'parking', 'sos', 'vendor', 'patrol', 'metering', 'asset',
    'home_services', 'poll', 'meeting')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('meeting', 'Meetings & AGM', false, 22);

CREATE FUNCTION private.meeting_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN ('notice_days_agm', 'notice_days_sgm', 'notice_days_committee',
        'quorum_percent_units', 'quorum_percent_committee', 'action_owner_scope')
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(p_settings) AS setting
      WHERE setting.key IN ('notice_days_agm', 'notice_days_sgm', 'notice_days_committee')
        AND NOT (jsonb_typeof(setting.value) = 'number'
          AND (setting.value #>> '{}')::numeric = trunc((setting.value #>> '{}')::numeric)
          AND (setting.value #>> '{}')::numeric BETWEEN 0 AND 90)
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(p_settings) AS setting
      WHERE setting.key IN ('quorum_percent_units', 'quorum_percent_committee')
        AND NOT (jsonb_typeof(setting.value) = 'number'
          AND (setting.value #>> '{}')::numeric = trunc((setting.value #>> '{}')::numeric)
          AND (setting.value #>> '{}')::numeric BETWEEN 1 AND 100)
    )
    AND (NOT p_settings ? 'action_owner_scope'
      OR p_settings ->> 'action_owner_scope' IN ('any_member', 'management'))
$$;

REVOKE ALL ON FUNCTION private.meeting_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.meeting_settings_valid(jsonb) TO authenticated, service_role;

ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_meeting_settings_check
  CHECK (module_key <> 'meeting' OR private.meeting_settings_valid(settings));
