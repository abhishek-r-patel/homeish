-- Move AMC expiry settings to society-admin-managed Due Soon and Urgent bands.
ALTER TABLE public.module_configs
  DROP CONSTRAINT module_configs_amc_settings_check;

CREATE OR REPLACE FUNCTION private.amc_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE entry jsonb; day_count integer; seen integer[] := '{}';
BEGIN
  IF jsonb_typeof(p_settings) <> 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN ('reminder_days','due_soon_days','urgent_days')
    )
  THEN RETURN false; END IF;

  IF (p_settings ? 'due_soon_days') <> (p_settings ? 'urgent_days') THEN
    RETURN false;
  END IF;
  IF p_settings ? 'due_soon_days' AND (
    jsonb_typeof(p_settings->'due_soon_days') <> 'number'
    OR (p_settings->>'due_soon_days') !~ '^[0-9]{1,3}$'
    OR (p_settings->>'due_soon_days')::integer NOT BETWEEN 2 AND 365
    OR jsonb_typeof(p_settings->'urgent_days') <> 'number'
    OR (p_settings->>'urgent_days') !~ '^[0-9]{1,3}$'
    OR (p_settings->>'urgent_days')::integer NOT BETWEEN 1 AND 364
    OR (p_settings->>'urgent_days')::integer >= (p_settings->>'due_soon_days')::integer
  ) THEN RETURN false; END IF;

  IF p_settings ? 'reminder_days' THEN
    IF jsonb_typeof(p_settings->'reminder_days') <> 'array' THEN RETURN false; END IF;
    IF jsonb_array_length(p_settings->'reminder_days') NOT BETWEEN 1 AND 10 THEN RETURN false; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_settings->'reminder_days') LOOP
      IF jsonb_typeof(entry) <> 'number' OR entry::text !~ '^[0-9]{1,3}$' THEN RETURN false; END IF;
      day_count := entry::text::integer;
      IF day_count NOT BETWEEN 1 AND 365 OR day_count = ANY(seen) THEN RETURN false; END IF;
      seen := array_append(seen, day_count);
    END LOOP;
  END IF;
  RETURN true;
END;
$$;

UPDATE public.module_configs
SET settings = (settings - 'expiring_soon_days') || jsonb_build_object(
  'due_soon_days',
  CASE
    WHEN (settings->>'expiring_soon_days')::integer <= 30 THEN 60
    ELSE (settings->>'expiring_soon_days')::integer
  END,
  'urgent_days',
  CASE
    WHEN (settings->>'expiring_soon_days')::integer <= 30
      THEN (settings->>'expiring_soon_days')::integer
    ELSE 30
  END
)
WHERE module_key = 'amc' AND settings ? 'expiring_soon_days';

ALTER TABLE public.module_configs
  ADD CONSTRAINT module_configs_amc_settings_check
  CHECK (module_key <> 'amc' OR private.amc_settings_valid(settings));

CREATE OR REPLACE FUNCTION public.amc_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE today date; due_soon_days integer; urgent_days integer;
BEGIN
  PERFORM private.amc_authorize(p_society_id,false);
  today := private.housekeeping_local_date(p_society_id);
  SELECT
    COALESCE(max((settings->>'due_soon_days')::integer),60),
    COALESCE(max((settings->>'urgent_days')::integer),30)
  INTO due_soon_days, urgent_days
  FROM public.module_configs
  WHERE society_id=p_society_id AND module_key='amc';
  RETURN jsonb_build_object(
    'today',today,
    'can_manage',private.has_role(p_society_id,ARRAY['admin']::text[]),
    'settings',jsonb_build_object('due_soon_days',due_soon_days,'urgent_days',urgent_days),
    'contracts',COALESCE((SELECT jsonb_agg(to_jsonb(contract)||jsonb_build_object(
      'status',CASE
        WHEN contract.start_date>today THEN 'upcoming'
        WHEN contract.end_date<today THEN 'expired'
        WHEN contract.end_date<=today+urgent_days THEN 'urgent'
        WHEN contract.end_date<=today+due_soon_days THEN 'due_soon'
        ELSE 'active'
      END,
      'successor_id',(SELECT id FROM public.amc_contracts WHERE predecessor_id=contract.id)
    ) ORDER BY contract.end_date,contract.id) FROM public.amc_contracts AS contract WHERE society_id=p_society_id),'[]'::jsonb),
    'visits',COALESCE((SELECT jsonb_agg(to_jsonb(visit) ORDER BY visit_date DESC,id) FROM public.amc_visits AS visit WHERE society_id=p_society_id),'[]'::jsonb),
    'links',COALESCE((SELECT jsonb_agg(jsonb_build_object('request_id',request_id,'contract_id',contract_id)) FROM public.amc_request_links WHERE society_id=p_society_id),'[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.amc_settings_update(
  p_society_id uuid,
  p_due_soon_days integer,
  p_urgent_days integer,
  p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_settings jsonb;
BEGIN
  PERFORM private.amc_authorize(p_society_id,true);
  IF p_due_soon_days IS NULL OR p_urgent_days IS NULL
    OR p_due_soon_days NOT BETWEEN 2 AND 365
    OR p_urgent_days NOT BETWEEN 1 AND 364
    OR p_urgent_days >= p_due_soon_days
  THEN
    RAISE EXCEPTION 'Urgent must be shorter than Due Soon, and both windows must be valid day counts.'
      USING ERRCODE='22023';
  END IF;
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid request trace.' USING ERRCODE='22023';
  END IF;

  SELECT settings INTO old_settings
  FROM public.module_configs
  WHERE society_id=p_society_id AND module_key='amc'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMC configuration not found.' USING ERRCODE='P0002';
  END IF;

  UPDATE public.module_configs
  SET settings=(settings-'expiring_soon_days')||jsonb_build_object(
        'due_soon_days',p_due_soon_days,
        'urgent_days',p_urgent_days
      ),
      updated_by=auth.uid(),
      updated_at=clock_timestamp()
  WHERE society_id=p_society_id AND module_key='amc';

  INSERT INTO public.audit_logs(
    society_id,actor_id,actor_role,action,entity_type,entity_id,"before","after",request_id
  )
  VALUES(
    p_society_id,auth.uid(),'admin','amc.settings.update','amc_settings',p_society_id::text,
    jsonb_build_object(
      'due_soon_days',COALESCE((old_settings->>'due_soon_days')::integer,60),
      'urgent_days',COALESCE((old_settings->>'urgent_days')::integer,30)
    ),
    jsonb_build_object('due_soon_days',p_due_soon_days,'urgent_days',p_urgent_days),
    p_request_trace
  );
END;
$$;

REVOKE ALL ON FUNCTION public.amc_settings_update(uuid,integer,integer,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.amc_settings_update(uuid,integer,integer,text)
  TO authenticated;