-- P59 tenant-safe change history, committee visibility, settings undo and audit access boundary.
ALTER TABLE public.society_workspace_settings
  ADD COLUMN committee_change_history_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.expense_settings_update(
  p_society_id uuid,
  p_approval_threshold_paise bigint,
  p_billing_income_account_id uuid,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.module_configs;
  saved public.module_configs;
  next_settings jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_approval_threshold_paise IS NULL
    OR p_approval_threshold_paise NOT BETWEEN 0 AND 999999999999999
  THEN
    RAISE EXCEPTION 'The approval threshold is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_billing_income_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_accounts
    WHERE society_id = p_society_id
      AND id = p_billing_income_account_id
      AND active
      AND account_type = 'bank'
  ) THEN
    RAISE EXCEPTION 'Choose an active bank account.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense'
  FOR UPDATE;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Expense settings changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  next_settings := previous.settings || jsonb_build_object(
    'approval_threshold_paise', p_approval_threshold_paise,
    'billing_income_account_id', p_billing_income_account_id
  );
  IF next_settings = previous.settings THEN
    RETURN jsonb_build_object('updated_at', previous.updated_at);
  END IF;
  UPDATE public.module_configs
  SET settings = next_settings, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'expense'
  RETURNING * INTO saved;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.settings.update',
    'module_config', 'expense',
    jsonb_build_object('settings', previous.settings),
    jsonb_build_object('settings', saved.settings),
    p_request_trace
  );
  RETURN jsonb_build_object('updated_at', saved.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.tenancy_settings_update(
  p_society_id uuid,
  p_police_verification_required boolean,
  p_clearance_handover_basis text,
  p_clearance_agreement_evidence text,
  p_verification_tracking_enabled boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_settings jsonb;
  next_settings jsonb;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin']::text[],
    true
  );
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  IF p_police_verification_required IS NULL
    OR p_clearance_handover_basis IS NULL
    OR p_clearance_handover_basis NOT IN ('bills', 'total')
    OR p_clearance_agreement_evidence IS NULL
    OR p_clearance_agreement_evidence NOT IN (
      'admin_note', 'signed_upload', 'in_app_and_upload'
    )
    OR p_verification_tracking_enabled IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose valid Tenancy settings.'
      USING ERRCODE = '22023';
  END IF;
  SELECT settings, settings || jsonb_build_object(
    'police_verification_required', p_police_verification_required,
    'clearance_handover_basis', p_clearance_handover_basis,
    'clearance_agreement_evidence', p_clearance_agreement_evidence,
    'verification_tracking_enabled', p_verification_tracking_enabled
  )
  INTO previous_settings, next_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'tenancy'
  FOR UPDATE;
  UPDATE public.module_configs
  SET settings = next_settings,
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'tenancy';
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.settings.update',
    'module', 'tenancy', previous_settings, next_settings, p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sos_settings_update(
  p_society_id uuid,
  p_notify_guards boolean,
  p_notify_admins boolean,
  p_notify_committee boolean,
  p_resident_scope text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_settings jsonb;
  next_settings jsonb;
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  IF p_notify_guards IS NULL OR p_notify_admins IS NULL OR p_notify_committee IS NULL
    OR p_resident_scope IS NULL
    OR p_resident_scope NOT IN ('off', 'floor', 'block', 'society')
    OR NOT (p_notify_guards OR p_notify_admins OR p_notify_committee)
  THEN
    RAISE EXCEPTION 'Choose at least one responder group and a resident scope.'
      USING ERRCODE = '22023';
  END IF;
  SELECT settings INTO previous_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'sos'
  FOR UPDATE;
  next_settings := jsonb_build_object(
    'notify_guards', p_notify_guards,
    'notify_admins', p_notify_admins,
    'notify_committee', p_notify_committee,
    'resident_scope', p_resident_scope
  );
  UPDATE public.module_configs
  SET settings = next_settings,
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'sos';
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'sos.settings.update',
    'module', 'sos', previous_settings, next_settings, p_request_id
  );
END;
$$;

DROP POLICY IF EXISTS audit_logs_read_admin_or_developer ON public.audit_logs;
CREATE POLICY audit_logs_read_developer
  ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_developer());

CREATE FUNCTION private.audit_history_redact(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  output_value jsonb;
  item record;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_value) = 'object' THEN
    output_value := '{}'::jsonb;
    FOR item IN SELECT key, value FROM jsonb_each(p_value)
    LOOP
      IF item.key ~* '(email|phone|mobile|upi|qr|gstin|pan|aadhaar|identity|document|path|notes?|reason|message|comment|body|address|token|secret|password|contact|name)'
        AND item.key !~* '^(module|setting|action|role|status)_?name$'
      THEN
        output_value := output_value || jsonb_build_object(item.key, 'Hidden');
      ELSE
        output_value := output_value || jsonb_build_object(
          item.key,
          private.audit_history_redact(item.value)
        );
      END IF;
    END LOOP;
    RETURN output_value;
  END IF;
  IF jsonb_typeof(p_value) = 'array' THEN
    RETURN (
      SELECT COALESCE(
        jsonb_agg(private.audit_history_redact(element)),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(p_value) AS element
    );
  END IF;
  RETURN p_value;
END;
$$;

CREATE FUNCTION private.audit_history_module(p_action text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_action LIKE 'billing.%' THEN 'Billing'
    WHEN p_action LIKE 'visitor.%' THEN 'Visitors'
    WHEN p_action LIKE 'delivery.%' THEN 'Deliveries'
    WHEN p_action LIKE 'notice.%' THEN 'Notices'
    WHEN p_action LIKE 'request.%' THEN 'Requests'
    WHEN p_action LIKE 'service_request.%' THEN 'Requests'
    WHEN p_action LIKE 'members.%' OR p_action LIKE 'registration.%'
      OR p_action LIKE 'directory.%' OR p_action LIKE 'household.%'
      THEN 'People and roles'
    WHEN p_action LIKE 'expense.%' OR p_action LIKE 'fund.%'
      OR p_action LIKE 'budget.%' OR p_action LIKE 'payee_mapping.%'
      THEN 'Accounts and expenses'
    WHEN p_action LIKE 'society.%' OR p_action LIKE 'society_%'
      OR p_action LIKE 'workspace.%' OR p_action LIKE 'building_%'
      THEN 'Society settings'
    WHEN p_action LIKE 'amc.%' THEN 'AMC'
    WHEN p_action LIKE 'amenity.%' THEN 'Amenities'
    WHEN p_action LIKE 'community.%' OR p_action LIKE 'post.%'
      OR p_action LIKE 'group.%' OR p_action LIKE 'reply.%'
      THEN 'Community'
    WHEN p_action LIKE 'document.%' OR p_action LIKE 'official_case.%'
      THEN 'Documents'
    WHEN p_action LIKE 'event.%' THEN 'Events'
    WHEN p_action LIKE 'meeting.%' OR p_action LIKE 'minutes.%'
      OR p_action LIKE 'attendance.%' OR p_action LIKE 'resolution.%'
      THEN 'Meetings'
    WHEN p_action LIKE 'poll.%' OR p_action LIKE 'official_%'
      THEN 'Polls and elections'
    WHEN p_action LIKE 'staff.%' OR p_action LIKE 'staff_day_check.%'
      OR p_action LIKE 'guards.%' THEN 'Staff and guards'
    WHEN p_action LIKE 'tenancy.%' THEN 'Tenancy'
    WHEN p_action LIKE 'vendor.%' OR p_action LIKE 'contract.%'
      OR p_action LIKE 'provider.%' THEN 'Vendors'
    WHEN p_action LIKE 'vehicle.%' OR p_action LIKE 'parking.%'
      OR p_action LIKE 'pass.%' THEN 'Vehicles and parking'
    WHEN p_action LIKE 'major_works.%' THEN 'Major works'
    WHEN p_action LIKE 'meter%' OR p_action LIKE 'reading.%' THEN 'Metering'
    WHEN p_action LIKE 'sos.%' THEN 'Emergency'
    ELSE 'Other operations'
  END
$$;

CREATE FUNCTION private.audit_history_detail_allowed(p_action text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_action <> 'billing.paymentDetails.update'
    AND (
      p_action LIKE '%.settings.update'
      OR p_action LIKE '%.settings_update'
      OR p_action = 'settings.update'
      OR p_action LIKE 'society.update_%'
      OR p_action = 'society_profile.update'
      OR p_action = 'workspace.residents_joined_percent.update'
    )
$$;

CREATE FUNCTION private.audit_history_settings(p_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_value) = 'object' AND jsonb_typeof(p_value -> 'settings') = 'object'
      THEN p_value -> 'settings'
    WHEN jsonb_typeof(p_value) = 'object' THEN p_value
    ELSE NULL
  END
$$;

CREATE FUNCTION private.audit_history_action_module(p_action text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_action = 'amc.settings.update' THEN 'amc'
    WHEN p_action = 'billing.settings.update' THEN 'billing'
    WHEN p_action = 'delivery.settings.update' THEN 'delivery'
    WHEN p_action = 'expense.settings.update' THEN 'expense'
    WHEN p_action = 'sos.settings.update' THEN 'sos'
    WHEN p_action = 'staff.settings.update' THEN 'staff'
    WHEN p_action = 'tenancy.settings.update' THEN 'tenancy'
    WHEN p_action = 'visitor.settings.update' THEN 'visitor'
    WHEN p_action = 'developer.modules.updateSettings'
      THEN NULL
    ELSE NULL
  END
$$;

CREATE FUNCTION private.audit_history_complete_settings(
  p_module text,
  p_value jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_module
    WHEN 'amc' THEN
      p_value ? 'due_soon_days' AND p_value ? 'urgent_days'
    WHEN 'billing' THEN
      p_value ? 'due_day_of_month'
      AND p_value ? 'rounding'
      AND p_value ? 'bill_email_on_publish'
    WHEN 'delivery' THEN
      p_value ? 'response_timeout_minutes'
      AND p_value ? 'uncollected_days'
      AND p_value ? 'leave_at_gate_enabled'
    WHEN 'expense' THEN
      p_value ? 'approval_threshold_paise'
      AND p_value ? 'billing_income_account_id'
    WHEN 'sos' THEN
      p_value ? 'notify_guards'
      AND p_value ? 'notify_admins'
      AND p_value ? 'notify_committee'
      AND p_value ? 'resident_scope'
    WHEN 'staff' THEN
      p_value ? 'resident_approval_required'
    WHEN 'tenancy' THEN
      p_value ? 'police_verification_required'
      AND p_value ? 'clearance_handover_basis'
      AND p_value ? 'clearance_agreement_evidence'
      AND p_value ? 'verification_tracking_enabled'
    WHEN 'visitor' THEN
      p_value ? 'approval_timeout_minutes'
      AND p_value ? 'overstay_hours'
      AND p_value ? 'photo_required'
      AND p_value ? 'guard_override_allowed'
      AND p_value ? 'phone_required'
    ELSE false
  END
$$;

CREATE FUNCTION private.audit_history_can_undo(
  p_society_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_created_at timestamptz,
  p_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_module text;
  current_settings jsonb;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR p_created_at < now() - interval '30 days'
    OR NOT private.audit_history_detail_allowed(p_action)
    OR p_action = 'billing.paymentDetails.update'
    OR jsonb_typeof(private.audit_history_settings(p_before)) <> 'object'
    OR jsonb_typeof(private.audit_history_settings(p_after)) <> 'object'
  THEN
    RETURN false;
  END IF;
  target_module := private.audit_history_action_module(p_action);
  IF target_module NOT IN (
    'amc', 'billing', 'delivery', 'expense', 'sos', 'staff', 'tenancy', 'visitor'
  ) THEN
    RETURN false;
  END IF;
  IF NOT private.audit_history_complete_settings(
    target_module, private.audit_history_settings(p_before)
  ) OR NOT private.audit_history_complete_settings(
    target_module, private.audit_history_settings(p_after)
  ) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.audit_logs AS newer
    WHERE newer.society_id = p_society_id
      AND (newer.created_at, newer.id) > (p_created_at, p_id)
      AND (
        private.audit_history_action_module(newer.action) = target_module
        OR (
          newer.action = 'developer.modules.updateSettings'
          AND newer.entity_id = target_module
        )
      )
  ) THEN
    RETURN false;
  END IF;
  SELECT settings INTO current_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = target_module;
  IF current_settings IS DISTINCT FROM private.audit_history_settings(p_after) THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_each(
      current_settings || private.audit_history_settings(p_before)
    ) AS value(key, ignored)
    LEFT JOIN public.module_setting_access AS access
      ON access.society_id = p_society_id
        AND access.module_key = target_module
        AND access.setting_key = value.key
    WHERE (current_settings -> value.key)
        IS DISTINCT FROM (
          private.audit_history_settings(p_before) -> value.key
        )
      AND (access.setting_key IS NULL OR NOT access.admin_can_edit)
  );
END;
$$;

CREATE FUNCTION private.audit_history_authorize(p_society_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT (
      private.is_developer()
      OR private.has_role(p_society_id, ARRAY['admin']::text[])
      OR (
        private.has_role(p_society_id, ARRAY['committee']::text[])
        AND EXISTS (
          SELECT 1
          FROM public.society_workspace_settings AS settings
          WHERE settings.society_id = p_society_id
            AND settings.committee_change_history_enabled
        )
      )
    )
  THEN
    RAISE EXCEPTION 'Change history is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION public.audit_history_access_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (
    private.is_developer()
    OR private.has_role(
      p_society_id,
      ARRAY['admin', 'committee']::text[]
    )
  ) THEN
    RAISE EXCEPTION 'Society role required.' USING ERRCODE = '42501';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'isAdmin', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'canView',
      private.is_developer()
      OR private.has_role(p_society_id, ARRAY['admin']::text[])
      OR (
        private.has_role(p_society_id, ARRAY['committee']::text[])
        AND COALESCE((
          SELECT committee_change_history_enabled
          FROM public.society_workspace_settings
          WHERE society_id = p_society_id
        ), false)
      ),
    'committeeEnabled', COALESCE((
      SELECT committee_change_history_enabled
      FROM public.society_workspace_settings
      WHERE society_id = p_society_id
    ), false)
  );
END;
$$;

CREATE FUNCTION public.audit_history_get(
  p_society_id uuid,
  p_from timestamptz,
  p_before timestamptz,
  p_category text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
BEGIN
  PERFORM private.audit_history_authorize(p_society_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
    OR (p_from IS NOT NULL AND p_before IS NOT NULL AND p_from >= p_before)
  THEN
    RAISE EXCEPTION 'The change-history filters are invalid.' USING ERRCODE = '22023';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', entry.id::text,
        'action', entry.action,
        'category', private.audit_history_module(entry.action),
        'actorName', COALESCE(profile.full_name, 'Homeish system'),
        'actorRole', entry.actor_role,
        'createdAt', entry.created_at,
        'before', CASE
          WHEN private.audit_history_detail_allowed(entry.action)
            THEN private.audit_history_redact(entry."before")
          ELSE NULL
        END,
        'after', CASE
          WHEN private.audit_history_detail_allowed(entry.action)
            THEN private.audit_history_redact(entry."after")
          ELSE NULL
        END,
        'canUndo', private.audit_history_can_undo(
          entry.society_id,
          entry.action,
          entry.entity_type,
          entry.entity_id,
          entry."before",
          entry."after",
          entry.created_at,
          entry.id
        ),
        'undoReason', CASE
          WHEN private.audit_history_can_undo(
            entry.society_id, entry.action, entry.entity_type, entry.entity_id,
            entry."before", entry."after", entry.created_at, entry.id
          ) THEN NULL
          WHEN NOT private.has_role(p_society_id, ARRAY['admin']::text[])
            THEN 'Admin access is required.'
          WHEN entry.action = 'billing.paymentDetails.update'
            THEN 'UPI and payment details cannot be undone.'
          WHEN NOT private.audit_history_detail_allowed(entry.action)
            OR jsonb_typeof(private.audit_history_settings(entry."before")) <> 'object'
            OR jsonb_typeof(private.audit_history_settings(entry."after")) <> 'object'
            THEN 'This change is not an undoable setting.'
          WHEN entry.created_at < now() - interval '30 days'
            THEN 'This change is older than 30 days.'
          ELSE 'This setting is no longer eligible for undo.'
        END
      )
      ORDER BY entry.created_at DESC, entry.id DESC
    )
    FROM (
      SELECT audit.*
      FROM public.audit_logs AS audit
      WHERE audit.society_id = p_society_id
        AND audit.actor_role IS NOT NULL
        AND (p_from IS NULL OR audit.created_at >= p_from)
        AND (p_before IS NULL OR audit.created_at < p_before)
        AND (
          p_category IS NULL
          OR p_category = ''
          OR private.audit_history_module(audit.action) = p_category
        )
      ORDER BY audit.created_at DESC, audit.id DESC
      LIMIT p_limit OFFSET p_offset
    ) AS entry
    LEFT JOIN public.profiles AS profile ON profile.id = entry.actor_id
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.audit_setting_undo(
  p_society_id uuid,
  p_audit_id bigint,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source public.audit_logs;
  target_module text;
  current_config public.module_configs;
  previous_settings jsonb;
  changed_keys text[];
  blocked_key text;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO source FROM public.audit_logs
  WHERE society_id = p_society_id AND id = p_audit_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The change was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF source.created_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'This change is older than 30 days.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.audit_history_detail_allowed(source.action)
    OR source.action = 'billing.paymentDetails.update'
    OR jsonb_typeof(private.audit_history_settings(source."before")) <> 'object'
    OR jsonb_typeof(private.audit_history_settings(source."after")) <> 'object'
  THEN
    RAISE EXCEPTION 'This change cannot be undone.' USING ERRCODE = '22023';
  END IF;
  target_module := private.audit_history_action_module(source.action);
  IF target_module NOT IN (
    'amc', 'billing', 'delivery', 'expense', 'sos', 'staff', 'tenancy', 'visitor'
  ) THEN
    RAISE EXCEPTION 'This setting type cannot be undone.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.audit_logs AS newer
    WHERE newer.society_id = source.society_id
      AND (newer.created_at, newer.id) > (source.created_at, source.id)
      AND (
        private.audit_history_action_module(newer.action) = target_module
        OR (
          newer.action = 'developer.modules.updateSettings'
          AND newer.entity_id = target_module
        )
      )
  ) THEN
    RAISE EXCEPTION 'A newer change must be undone first.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO current_config
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = target_module
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The setting is unavailable.' USING ERRCODE = 'P0002';
  END IF;
  IF current_config.settings
    IS DISTINCT FROM private.audit_history_settings(source."after")
  THEN
    RAISE EXCEPTION 'The setting changed again. Refresh first.' USING ERRCODE = '23505';
  END IF;
  previous_settings := private.audit_history_settings(source."before");
  IF NOT private.audit_history_complete_settings(
    target_module, previous_settings
  ) OR NOT private.audit_history_complete_settings(
    target_module, private.audit_history_settings(source."after")
  ) THEN
    RAISE EXCEPTION 'The old setting is incomplete.' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(key) INTO changed_keys
  FROM jsonb_each(current_config.settings || previous_settings) AS value(key, ignored)
  WHERE (current_config.settings -> key) IS DISTINCT FROM (previous_settings -> key);
  SELECT key INTO blocked_key
  FROM unnest(COALESCE(changed_keys, ARRAY[]::text[])) AS key
  LEFT JOIN public.module_setting_access AS access
    ON access.society_id = p_society_id
      AND access.module_key = target_module
      AND access.setting_key = key
  WHERE access.setting_key IS NULL OR NOT access.admin_can_edit
  LIMIT 1;
  IF blocked_key IS NOT NULL THEN
    RAISE EXCEPTION 'The developer controls this setting.' USING ERRCODE = '42501';
  END IF;
  CASE target_module
    WHEN 'billing' THEN
      PERFORM public.billing_settings_update(
        p_society_id,
        previous_settings ->> 'due_day_of_month',
        previous_settings ->> 'rounding',
        (previous_settings ->> 'bill_email_on_publish')::boolean,
        current_config.updated_at,
        p_request_id
      );
    WHEN 'delivery' THEN
      PERFORM public.delivery_settings_update(
        p_society_id, previous_settings, p_request_id
      );
    WHEN 'visitor' THEN
      PERFORM public.visitor_update_settings(
        p_society_id, previous_settings, p_request_id
      );
    WHEN 'staff' THEN
      PERFORM public.staff_settings_update(
        p_society_id,
        (previous_settings ->> 'resident_approval_required')::boolean,
        p_request_id
      );
    WHEN 'tenancy' THEN
      PERFORM public.tenancy_settings_update(
        p_society_id,
        (previous_settings ->> 'police_verification_required')::boolean,
        previous_settings ->> 'clearance_handover_basis',
        previous_settings ->> 'clearance_agreement_evidence',
        (previous_settings ->> 'verification_tracking_enabled')::boolean,
        p_request_id
      );
    WHEN 'sos' THEN
      PERFORM public.sos_settings_update(
        p_society_id,
        (previous_settings ->> 'notify_guards')::boolean,
        (previous_settings ->> 'notify_admins')::boolean,
        (previous_settings ->> 'notify_committee')::boolean,
        previous_settings ->> 'resident_scope',
        p_request_id
      );
    WHEN 'expense' THEN
      PERFORM public.expense_settings_update(
        p_society_id,
        (previous_settings ->> 'approval_threshold_paise')::bigint,
        NULLIF(previous_settings ->> 'billing_income_account_id', '')::uuid,
        current_config.updated_at,
        p_request_id
      );
    WHEN 'amc' THEN
      PERFORM public.amc_settings_update(
        p_society_id,
        (previous_settings ->> 'due_soon_days')::integer,
        (previous_settings ->> 'urgent_days')::integer,
        p_request_id
      );
    ELSE
      RAISE EXCEPTION 'This setting type cannot be undone.' USING ERRCODE = '22023';
  END CASE;
  IF (
    SELECT settings
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = target_module
  ) IS DISTINCT FROM previous_settings THEN
    RAISE EXCEPTION 'The setting could not be restored exactly.'
      USING ERRCODE = '23514';
  END IF;
  RETURN jsonb_build_object('undoneAuditId', source.id::text);
END;
$$;

CREATE FUNCTION public.developer_committee_history_set(
  p_society_id uuid,
  p_enabled boolean,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous boolean;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Choose On or Off.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.society_workspace_settings (society_id)
  VALUES (p_society_id)
  ON CONFLICT (society_id) DO NOTHING;
  SELECT committee_change_history_enabled INTO previous
  FROM public.society_workspace_settings
  WHERE society_id = p_society_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF previous <> p_enabled THEN
    UPDATE public.society_workspace_settings
    SET committee_change_history_enabled = p_enabled,
        updated_at = clock_timestamp(),
        updated_by = (SELECT auth.uid())
    WHERE society_id = p_society_id;
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, (SELECT auth.uid()), 'developer',
      'society.committee_history.update', 'society_workspace_settings',
      p_society_id::text,
      jsonb_build_object('committee_change_history_enabled', previous),
      jsonb_build_object('committee_change_history_enabled', p_enabled),
      p_request_id
    );
  END IF;
  RETURN jsonb_build_object('enabled', p_enabled);
END;
$$;

REVOKE ALL ON FUNCTION private.audit_history_redact(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_module(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_detail_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_settings(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_action_module(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_complete_settings(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_can_undo(
  uuid, text, text, text, jsonb, jsonb, timestamptz, bigint
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_history_authorize(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.audit_history_access_get(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.audit_history_get(uuid, timestamptz, timestamptz, text, integer, integer)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.audit_setting_undo(uuid, bigint, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.developer_committee_history_set(uuid, boolean, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.audit_history_access_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_history_get(uuid, timestamptz, timestamptz, text, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_setting_undo(uuid, bigint, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_committee_history_set(uuid, boolean, text)
  TO authenticated;
