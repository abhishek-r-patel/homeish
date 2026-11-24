ALTER TABLE public.society_reference_profiles
  ADD COLUMN managing_body_name text;

ALTER TABLE public.society_reference_profiles
  ADD CONSTRAINT society_reference_profiles_managing_body_name_check
  CHECK (
    managing_body_name IS NULL
    OR (
      managing_body_name = btrim(managing_body_name)
      AND managing_body_name ~ '^[A-Za-z ]{1,24}$'
    )
  );

CREATE TABLE public.person_workspace_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE CASCADE,
  starting_place text NOT NULL DEFAULT 'last_used',
  resident_graph_mode text NOT NULL DEFAULT 'water',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, society_id),
  CONSTRAINT person_workspace_preferences_starting_place_check
    CHECK (
      starting_place IN (
        'last_used',
        'home',
        'work',
        'gate',
        'housekeeping'
      )
    ),
  CONSTRAINT person_workspace_preferences_graph_check
    CHECK (resident_graph_mode IN ('water', 'bills'))
);

CREATE INDEX person_workspace_preferences_society_idx
  ON public.person_workspace_preferences (society_id);

CREATE TABLE public.workspace_quick_action_defaults (
  society_id uuid REFERENCES public.societies (id) ON DELETE CASCADE,
  role text NOT NULL,
  action_keys text[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  scope_key uuid GENERATED ALWAYS AS (
    COALESCE(society_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED,
  CONSTRAINT workspace_quick_action_defaults_role_check
    CHECK (role IN ('admin', 'committee', 'resident', 'guard', 'hk_supervisor')),
  CONSTRAINT workspace_quick_action_defaults_actions_check
    CHECK (
      cardinality(action_keys) BETWEEN 1 AND 12
      AND array_position(action_keys, '') IS NULL
      AND action_keys <@ ARRAY[
        'notice.create',
        'billing.payment',
        'billing.generate',
        'expense.create',
        'poll.create',
        'request.review',
        'billing.view',
        'meeting.view',
        'visitor.preapprove',
        'request.create',
        'household.view',
        'visitor.manage',
        'delivery.manage',
        'rounds.manage',
        'staff.entry',
        'request.log',
        'inventory.manage',
        'petty_cash.view'
      ]::text[]
    ),
  UNIQUE (scope_key, role)
);

CREATE TABLE public.module_setting_access (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE CASCADE,
  module_key text NOT NULL,
  setting_key text NOT NULL,
  admin_can_edit boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, module_key, setting_key),
  CONSTRAINT module_setting_access_key_check
    CHECK (
      char_length(module_key) BETWEEN 1 AND 60
      AND char_length(setting_key) BETWEEN 1 AND 120
    )
);

CREATE INDEX module_setting_access_society_idx
  ON public.module_setting_access (society_id, module_key);

ALTER TABLE public.person_workspace_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_quick_action_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_setting_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_workspace_preferences_own_read
  ON public.person_workspace_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY person_workspace_preferences_own_write
  ON public.person_workspace_preferences
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_member(society_id)
  );

CREATE POLICY person_workspace_preferences_own_update
  ON public.person_workspace_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_member(society_id)
  );

CREATE POLICY person_workspace_preferences_own_delete
  ON public.person_workspace_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY workspace_quick_action_defaults_developer_read
  ON public.workspace_quick_action_defaults FOR SELECT TO authenticated
  USING (private.is_developer());

CREATE POLICY workspace_quick_action_defaults_developer_write
  ON public.workspace_quick_action_defaults
  FOR ALL TO authenticated
  USING (private.is_developer())
  WITH CHECK (private.is_developer());

CREATE POLICY module_setting_access_read
  ON public.module_setting_access FOR SELECT TO authenticated
  USING (
    private.is_developer()
    OR private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );

CREATE POLICY module_setting_access_developer_write
  ON public.module_setting_access
  FOR ALL TO authenticated
  USING (private.is_developer())
  WITH CHECK (private.is_developer());

REVOKE ALL ON TABLE public.person_workspace_preferences
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.workspace_quick_action_defaults
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.module_setting_access
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.person_workspace_preferences TO authenticated;
GRANT SELECT ON public.workspace_quick_action_defaults TO authenticated;
GRANT SELECT ON public.module_setting_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.person_workspace_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.workspace_quick_action_defaults TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.module_setting_access TO service_role;

INSERT INTO public.workspace_quick_action_defaults (role, action_keys)
VALUES
  ('admin', ARRAY['notice.create', 'billing.payment', 'billing.generate', 'expense.create', 'poll.create']),
  ('committee', ARRAY['notice.create', 'request.review', 'billing.view', 'meeting.view']),
  ('resident', ARRAY['visitor.preapprove', 'billing.view', 'request.create', 'household.view']),
  ('guard', ARRAY['visitor.manage', 'delivery.manage', 'rounds.manage', 'staff.entry']),
  ('hk_supervisor', ARRAY['request.log', 'rounds.manage', 'inventory.manage', 'petty_cash.view']);

INSERT INTO public.module_setting_access (
  society_id,
  module_key,
  setting_key,
  admin_can_edit
)
SELECT
  config.society_id,
  config.module_key,
  setting.key,
  CASE
    WHEN config.module_key IN ('visitor', 'delivery') THEN true
    WHEN config.module_key = 'billing'
      THEN setting.key IN ('due_day_of_month', 'rounding')
    WHEN config.module_key = 'amc'
      THEN setting.key IN ('due_soon_days', 'urgent_days')
    WHEN config.module_key = 'amenity'
      THEN setting.key = 'resident_calendar_identity'
    WHEN config.module_key = 'tenancy'
      THEN setting.key IN (
        'police_verification_required',
        'verification_tracking_enabled',
        'clearance_handover_basis',
        'clearance_agreement_evidence'
      )
    WHEN config.module_key = 'parking'
      THEN setting.key = 'photo_retention_days'
    WHEN config.module_key = 'sos'
      THEN setting.key IN (
        'notify_guards',
        'notify_admins',
        'notify_committee',
        'resident_scope'
      )
    WHEN config.module_key = 'vendor'
      THEN setting.key IN (
        'quote_threshold_paise',
        'quotes_above_threshold',
        'approvals_required'
      )
    WHEN config.module_key = 'patrol'
      THEN setting.key = 'photo_retention_days'
    WHEN config.module_key = 'poll' THEN true
    WHEN config.module_key = 'meeting' THEN true
    WHEN config.module_key = 'community'
      THEN setting.key IN (
        'muted_can_edit_pending',
        'muted_can_report',
        'muted_can_renew'
      )
    WHEN config.module_key = 'major_works'
      THEN setting.key = 'consent_method'
    ELSE false
  END
FROM public.module_configs AS config
CROSS JOIN LATERAL jsonb_object_keys(config.settings) AS setting(key)
ON CONFLICT (society_id, module_key, setting_key) DO NOTHING;

INSERT INTO public.module_setting_access (
  society_id,
  module_key,
  setting_key,
  admin_can_edit
)
SELECT
  society.id,
  setting.module_key,
  setting.setting_key,
  setting.admin_can_edit
FROM public.societies AS society
CROSS JOIN (
  VALUES
    ('visitor', 'approval_timeout_minutes', true),
    ('visitor', 'overstay_hours', true),
    ('visitor', 'photo_required', true),
    ('visitor', 'guard_override_allowed', true),
    ('visitor', 'phone_required', true),
    ('delivery', 'response_timeout_minutes', true),
    ('delivery', 'uncollected_days', true),
    ('delivery', 'leave_at_gate_enabled', true),
    ('billing', 'due_day_of_month', true),
    ('billing', 'rounding', true),
    ('billing', 'grace_days', false),
    ('billing', 'late_fee', false),
    ('billing', 'reminders', false),
    ('billing', 'pending_confirmation_alert_days', false),
    ('billing', 'bill_email_on_publish', false),
    ('service_request', 'auto_close_days', false),
    ('staff', 'resident_approval_required', false),
    ('amc', 'reminder_days', false),
    ('amc', 'due_soon_days', true),
    ('amc', 'urgent_days', true),
    ('amenity', 'resident_calendar_identity', true),
    ('amenity', 'deposit_confirmation_policy', false),
    ('expense', 'approval_threshold_paise', false),
    ('expense', 'billing_income_account_id', false),
    ('expense', 'budget_forecast_method', false),
    ('expense', 'budget_watch_percent', false),
    ('expense', 'budget_resident_summary', false),
    ('tenancy', 'police_verification_required', true),
    ('tenancy', 'verification_tracking_enabled', true),
    ('tenancy', 'clearance_handover_basis', true),
    ('tenancy', 'clearance_agreement_evidence', true),
    ('document', 'expiry_reminders_enabled', false),
    ('parking', 'photo_retention_days', true),
    ('sos', 'notify_guards', true),
    ('sos', 'notify_admins', true),
    ('sos', 'notify_committee', true),
    ('sos', 'resident_scope', true),
    ('vendor', 'quote_threshold_paise', true),
    ('vendor', 'quotes_above_threshold', true),
    ('vendor', 'approvals_required', true),
    ('patrol', 'photo_retention_days', true),
    ('poll', 'tenant_voting_default', true),
    ('poll', 'official_voting_enabled', true),
    ('poll', 'official_legal_type', true),
    ('poll', 'dispute_window_days', true),
    ('poll', 'nomination_supporters_enabled', true),
    ('poll', 'multi_post_win_rule', true),
    ('meeting', 'notice_days_agm', true),
    ('meeting', 'notice_days_sgm', true),
    ('meeting', 'notice_days_committee', true),
    ('meeting', 'quorum_percent_units', true),
    ('meeting', 'quorum_percent_committee', true),
    ('meeting', 'action_owner_scope', true),
    ('community', 'muted_can_edit_pending', true),
    ('community', 'muted_can_report', true),
    ('community', 'muted_can_renew', true),
    ('major_works', 'consent_method', true)
) AS setting(module_key, setting_key, admin_can_edit)
ON CONFLICT (society_id, module_key, setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.seed_module_setting_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  setting_key text;
BEGIN
  INSERT INTO public.module_setting_access (
    society_id,
    module_key,
    setting_key,
    admin_can_edit
  )
  SELECT NEW.society_id, setting.module_key, setting.setting_key, setting.admin_can_edit
  FROM (
    VALUES
      ('visitor', 'approval_timeout_minutes', true),
      ('visitor', 'overstay_hours', true),
      ('visitor', 'photo_required', true),
      ('visitor', 'guard_override_allowed', true),
      ('visitor', 'phone_required', true),
      ('delivery', 'response_timeout_minutes', true),
      ('delivery', 'uncollected_days', true),
      ('delivery', 'leave_at_gate_enabled', true),
      ('billing', 'due_day_of_month', true),
      ('billing', 'rounding', true),
      ('billing', 'grace_days', false),
      ('billing', 'late_fee', false),
      ('billing', 'reminders', false),
      ('billing', 'pending_confirmation_alert_days', false),
      ('billing', 'bill_email_on_publish', false),
      ('service_request', 'auto_close_days', false),
      ('staff', 'resident_approval_required', false),
      ('amc', 'reminder_days', false),
      ('amc', 'due_soon_days', true),
      ('amc', 'urgent_days', true),
      ('amenity', 'resident_calendar_identity', true),
      ('amenity', 'deposit_confirmation_policy', false),
      ('expense', 'approval_threshold_paise', false),
      ('expense', 'billing_income_account_id', false),
      ('expense', 'budget_forecast_method', false),
      ('expense', 'budget_watch_percent', false),
      ('expense', 'budget_resident_summary', false),
      ('tenancy', 'police_verification_required', true),
      ('tenancy', 'verification_tracking_enabled', true),
      ('tenancy', 'clearance_handover_basis', true),
      ('tenancy', 'clearance_agreement_evidence', true),
      ('document', 'expiry_reminders_enabled', false),
      ('parking', 'photo_retention_days', true),
      ('sos', 'notify_guards', true),
      ('sos', 'notify_admins', true),
      ('sos', 'notify_committee', true),
      ('sos', 'resident_scope', true),
      ('vendor', 'quote_threshold_paise', true),
      ('vendor', 'quotes_above_threshold', true),
      ('vendor', 'approvals_required', true),
      ('patrol', 'photo_retention_days', true),
      ('poll', 'tenant_voting_default', true),
      ('poll', 'official_voting_enabled', true),
      ('poll', 'official_legal_type', true),
      ('poll', 'dispute_window_days', true),
      ('poll', 'nomination_supporters_enabled', true),
      ('poll', 'multi_post_win_rule', true),
      ('meeting', 'notice_days_agm', true),
      ('meeting', 'notice_days_sgm', true),
      ('meeting', 'notice_days_committee', true),
      ('meeting', 'quorum_percent_units', true),
      ('meeting', 'quorum_percent_committee', true),
      ('meeting', 'action_owner_scope', true),
      ('community', 'muted_can_edit_pending', true),
      ('community', 'muted_can_report', true),
      ('community', 'muted_can_renew', true),
      ('major_works', 'consent_method', true)
  ) AS setting(module_key, setting_key, admin_can_edit)
  WHERE setting.module_key = NEW.module_key
  ON CONFLICT DO NOTHING;

  FOR setting_key IN
    SELECT key FROM jsonb_object_keys(NEW.settings) AS setting(key)
  LOOP
    INSERT INTO public.module_setting_access (
      society_id,
      module_key,
      setting_key,
      admin_can_edit
    )
    VALUES (
      NEW.society_id,
      NEW.module_key,
      setting_key,
      CASE
        WHEN NEW.module_key IN ('visitor', 'delivery') THEN true
        WHEN NEW.module_key = 'billing'
          THEN setting_key IN ('due_day_of_month', 'rounding')
        WHEN NEW.module_key = 'amc'
          THEN setting_key IN ('due_soon_days', 'urgent_days')
        WHEN NEW.module_key = 'amenity'
          THEN setting_key = 'resident_calendar_identity'
        WHEN NEW.module_key = 'tenancy'
          THEN setting_key IN (
            'police_verification_required',
            'verification_tracking_enabled',
            'clearance_handover_basis',
            'clearance_agreement_evidence'
          )
        WHEN NEW.module_key = 'parking'
          THEN setting_key = 'photo_retention_days'
        WHEN NEW.module_key = 'sos'
          THEN setting_key IN (
            'notify_guards',
            'notify_admins',
            'notify_committee',
            'resident_scope'
          )
        WHEN NEW.module_key = 'vendor'
          THEN setting_key IN (
            'quote_threshold_paise',
            'quotes_above_threshold',
            'approvals_required'
          )
        WHEN NEW.module_key = 'patrol'
          THEN setting_key = 'photo_retention_days'
        WHEN NEW.module_key IN ('poll', 'meeting') THEN true
        WHEN NEW.module_key = 'community'
          THEN setting_key IN (
            'muted_can_edit_pending',
            'muted_can_report',
            'muted_can_renew'
          )
        WHEN NEW.module_key = 'major_works'
          THEN setting_key = 'consent_method'
        ELSE false
      END
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER module_configs_seed_setting_access
  AFTER INSERT OR UPDATE OF settings ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION private.seed_module_setting_access();

CREATE OR REPLACE FUNCTION private.audit_managing_body_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.managing_body_name IS NOT DISTINCT FROM OLD.managing_body_name
  THEN
    RETURN NEW;
  END IF;

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
    NEW.society_id,
    auth.uid(),
    (
      SELECT role
      FROM unnest(
        COALESCE(
          (
            SELECT roles
            FROM public.memberships
            WHERE society_id = NEW.society_id
              AND user_id = auth.uid()
              AND status = 'active'
            LIMIT 1
          ),
          ARRAY[]::text[]
        )
      ) AS role
      ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'committee' THEN 2 ELSE 3 END
      LIMIT 1
    ),
    'society.managing_body_name.update',
    'society_reference_profile',
    NEW.society_id::text,
    CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('managing_body_name', OLD.managing_body_name)
      ELSE NULL
    END,
    jsonb_build_object('managing_body_name', NEW.managing_body_name)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER society_reference_profiles_audit_managing_body
  AFTER INSERT OR UPDATE OF managing_body_name
  ON public.society_reference_profiles
  FOR EACH ROW
  WHEN (NEW.managing_body_name IS NOT NULL)
  EXECUTE FUNCTION private.audit_managing_body_name();

CREATE OR REPLACE FUNCTION private.enforce_module_setting_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_key text;
BEGIN
  IF NEW.settings IS NOT DISTINCT FROM OLD.settings THEN
    RETURN NEW;
  END IF;
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
    OR (
      auth.uid() IS NULL
      AND current_user IN ('postgres', 'supabase_admin')
    )
    OR private.is_developer()
  THEN
    RETURN NEW;
  END IF;
  IF NOT private.has_role(NEW.society_id, ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not allowed to change module settings';
  END IF;

  FOR changed_key IN
    SELECT COALESCE(next_values.key, old_values.key)
    FROM jsonb_each(COALESCE(NEW.settings, '{}'::jsonb))
      AS next_values(key, value)
    FULL JOIN jsonb_each(COALESCE(OLD.settings, '{}'::jsonb))
      AS old_values(key, value)
      ON next_values.key = old_values.key
    WHERE next_values.value IS DISTINCT FROM old_values.value
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.module_setting_access
      WHERE society_id = NEW.society_id
        AND module_key = NEW.module_key
        AND setting_key = changed_key
        AND admin_can_edit
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'This setting is managed by the developer';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER module_configs_enforce_setting_access
  BEFORE UPDATE OF settings ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION private.enforce_module_setting_access();

CREATE OR REPLACE FUNCTION public.person_workspace_preferences_get(
  p_society_id uuid
)
RETURNS TABLE (
  starting_place text,
  resident_graph_mode text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  RETURN QUERY
  SELECT preference.starting_place, preference.resident_graph_mode
  FROM public.person_workspace_preferences AS preference
  WHERE preference.user_id = auth.uid()
    AND preference.society_id = p_society_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.person_workspace_preferences_save(
  p_society_id uuid,
  p_starting_place text,
  p_resident_graph_mode text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  INSERT INTO public.person_workspace_preferences (
    user_id,
    society_id,
    starting_place,
    resident_graph_mode
  )
  VALUES (
    auth.uid(),
    p_society_id,
    p_starting_place,
    COALESCE(p_resident_graph_mode, 'water')
  )
  ON CONFLICT (user_id, society_id) DO UPDATE
  SET starting_place = EXCLUDED.starting_place,
      resident_graph_mode = COALESCE(
        p_resident_graph_mode,
        person_workspace_preferences.resident_graph_mode
      ),
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_quick_action_defaults_get(
  p_society_id uuid,
  p_role text
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  defaults text[];
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY[p_role]::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Role is not active';
  END IF;

  SELECT action_keys
  INTO defaults
  FROM public.workspace_quick_action_defaults
  WHERE role = p_role
    AND (society_id = p_society_id OR society_id IS NULL)
  ORDER BY society_id NULLS LAST
  LIMIT 1;

  RETURN COALESCE(defaults, ARRAY[]::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_quick_action_defaults_save(
  p_society_id uuid,
  p_role text,
  p_action_keys text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  INSERT INTO public.workspace_quick_action_defaults (
    society_id,
    role,
    action_keys,
    updated_by
  )
  VALUES (
    p_society_id,
    p_role,
    p_action_keys,
    auth.uid()
  )
  ON CONFLICT (scope_key, role) DO UPDATE
  SET action_keys = EXCLUDED.action_keys,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_quick_action_defaults_reset(
  p_society_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  IF p_society_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'All-society defaults cannot be reset';
  END IF;
  DELETE FROM public.workspace_quick_action_defaults
  WHERE society_id = p_society_id
    AND role = p_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.module_setting_access_list(
  p_society_id uuid
)
RETURNS TABLE (
  module_key text,
  setting_key text,
  admin_can_edit boolean
)
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
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Society role required';
  END IF;
  RETURN QUERY
  SELECT access.module_key, access.setting_key, access.admin_can_edit
  FROM public.module_setting_access AS access
  WHERE access.society_id = p_society_id
  ORDER BY access.module_key, access.setting_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.module_setting_access_set(
  p_society_id uuid,
  p_module_key text,
  p_setting_key text,
  p_admin_can_edit boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_value boolean;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Developer access required';
  END IF;
  SELECT admin_can_edit
  INTO previous_value
  FROM public.module_setting_access
  WHERE society_id = p_society_id
    AND module_key = p_module_key
    AND setting_key = p_setting_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Setting not found';
  END IF;

  UPDATE public.module_setting_access
  SET admin_can_edit = p_admin_can_edit,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE society_id = p_society_id
    AND module_key = p_module_key
    AND setting_key = p_setting_key;

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
    p_society_id,
    auth.uid(),
    'developer',
    'module_setting_access.update',
    'module_setting',
    p_module_key || '.' || p_setting_key,
    jsonb_build_object('admin_can_edit', previous_value),
    jsonb_build_object('admin_can_edit', p_admin_can_edit)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.society_managing_body_name_get(
  p_society_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result text;
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  SELECT profile.managing_body_name
  INTO result
  FROM public.society_reference_profiles AS profile
  WHERE profile.society_id = p_society_id;
  RETURN COALESCE(result, 'Association');
END;
$$;

CREATE OR REPLACE FUNCTION public.society_managing_body_name_save(
  p_society_id uuid,
  p_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin access required';
  END IF;
  INSERT INTO public.society_reference_profiles (
    society_id,
    managing_body_name
  )
  VALUES (
    p_society_id,
    p_name
  )
  ON CONFLICT (society_id) DO UPDATE
  SET managing_body_name = EXCLUDED.managing_body_name;
END;
$$;

REVOKE ALL ON FUNCTION public.person_workspace_preferences_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.person_workspace_preferences_save(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_workspace_preferences_get(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.person_workspace_preferences_save(uuid, text, text)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_quick_action_defaults_get(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_quick_action_defaults_save(uuid, text, text[])
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_quick_action_defaults_reset(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_setting_access_list(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_setting_access_set(uuid, text, text, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_managing_body_name_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.society_managing_body_name_save(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_quick_action_defaults_get(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_quick_action_defaults_save(uuid, text, text[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_quick_action_defaults_reset(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.module_setting_access_list(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.module_setting_access_set(uuid, text, text, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_managing_body_name_get(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.society_managing_body_name_save(uuid, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.audit_managing_body_name()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_module_setting_access()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.seed_module_setting_access()
  FROM PUBLIC, anon, authenticated;
