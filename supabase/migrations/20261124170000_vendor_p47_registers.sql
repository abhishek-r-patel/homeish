-- P47 vendor registers: contracts, AMC schedule, staff-day checks, work orders, bills and the vendor summary.

-- Shared helpers ---------------------------------------------------------------

CREATE FUNCTION private.vendor_audit_change(
  target_society_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_reason text,
  p_request_id text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", reason, request_id
  ) VALUES (
    target_society_id, auth.uid(), private.vendor_actor_role(target_society_id),
    'vendor.' || p_action, p_entity_type, p_entity_id::text,
    p_before, p_after, p_reason, p_request_id
  );
$$;

CREATE FUNCTION private.vendor_expiry_windows(
  target_society_id uuid,
  OUT due_soon_days integer,
  OUT urgent_days integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(max((config.settings ->> 'due_soon_days')::integer), 60),
    COALESCE(max((config.settings ->> 'urgent_days')::integer), 30)
  FROM public.module_configs AS config
  WHERE config.society_id = target_society_id AND config.module_key = 'amc';
$$;

CREATE FUNCTION private.vendor_term_status(
  p_start date,
  p_end date,
  p_terminated_on date,
  p_today date,
  p_due_soon integer,
  p_urgent integer
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_terminated_on IS NOT NULL THEN 'terminated'
    WHEN p_start > p_today THEN 'upcoming'
    WHEN p_end < p_today THEN 'expired'
    WHEN p_end <= p_today + p_urgent THEN 'urgent'
    WHEN p_end <= p_today + p_due_soon THEN 'due_soon'
    ELSE 'active'
  END;
$$;

-- P47.2 general vendor contracts ---------------------------------------------

CREATE TABLE public.vendor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope = btrim(scope) AND char_length(scope) BETWEEN 1 AND 500),
  start_date date NOT NULL,
  end_date date NOT NULL,
  annual_value_paise bigint NOT NULL CHECK (annual_value_paise BETWEEN 0 AND 999999999999999),
  payment_frequency text NOT NULL CHECK (
    payment_frequency IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time')
  ),
  auto_renew boolean NOT NULL DEFAULT false,
  notice_days integer CHECK (notice_days IS NULL OR notice_days BETWEEN 0 AND 365),
  document_path text UNIQUE,
  document_content_type text,
  document_size_bytes integer,
  default_sanctioned_days integer CHECK (
    default_sanctioned_days IS NULL OR default_sanctioned_days BETWEEN 1 AND 31
  ),
  deduction_per_day_paise bigint CHECK (
    deduction_per_day_paise IS NULL OR deduction_per_day_paise BETWEEN 1 AND 999999999999999
  ),
  predecessor_id uuid UNIQUE,
  terminated_on date,
  termination_reason text CHECK (
    termination_reason IS NULL OR char_length(termination_reason) BETWEEN 1 AND 500
  ),
  terminated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  terminated_at timestamptz,
  last_reminder_days integer,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT vendor_contracts_vendor_same_society_fkey
    FOREIGN KEY (society_id, vendor_id) REFERENCES public.vendors(society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_contracts_predecessor_same_society_fkey
    FOREIGN KEY (society_id, predecessor_id)
    REFERENCES public.vendor_contracts(society_id, id) ON DELETE RESTRICT,
  CHECK (end_date >= start_date),
  CHECK (predecessor_id IS NULL OR predecessor_id <> id),
  CHECK (
    (document_path IS NULL AND document_content_type IS NULL AND document_size_bytes IS NULL)
    OR (
      document_path IS NOT NULL
      AND document_content_type IN ('application/pdf', 'image/jpeg', 'image/png')
      AND document_size_bytes BETWEEN 1 AND 5242880
    )
  ),
  CHECK (
    (terminated_on IS NULL AND termination_reason IS NULL AND terminated_by IS NULL AND terminated_at IS NULL)
    OR (terminated_on IS NOT NULL AND termination_reason IS NOT NULL
      AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL)
  )
);

CREATE INDEX vendor_contracts_vendor_idx ON public.vendor_contracts (society_id, vendor_id, end_date);
CREATE INDEX vendor_contracts_predecessor_idx ON public.vendor_contracts (society_id, predecessor_id);
CREATE INDEX vendor_contracts_created_by_idx ON public.vendor_contracts (created_by);
CREATE INDEX vendor_contracts_updated_by_idx ON public.vendor_contracts (updated_by);
CREATE INDEX vendor_contracts_terminated_by_idx ON public.vendor_contracts (terminated_by)
  WHERE terminated_by IS NOT NULL;

ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_contracts FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY vendor_contracts_no_direct_access ON public.vendor_contracts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER vendor_contracts_reject_delete BEFORE DELETE ON public.vendor_contracts
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_contracts_reject_truncate BEFORE TRUNCATE ON public.vendor_contracts
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.vendor_contract_check(
  p_start date,
  p_end date,
  p_annual_value_paise bigint,
  p_payment_frequency text,
  p_notice_days integer,
  p_default_sanctioned_days integer,
  p_deduction_per_day_paise bigint
) RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RAISE EXCEPTION 'Enter a valid contract period.' USING ERRCODE = '22023';
  END IF;
  IF p_annual_value_paise IS NULL OR p_annual_value_paise NOT BETWEEN 0 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid annual value.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_frequency IS NULL
    OR p_payment_frequency NOT IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time') THEN
    RAISE EXCEPTION 'Choose a payment frequency.' USING ERRCODE = '22023';
  END IF;
  IF p_notice_days IS NOT NULL AND p_notice_days NOT BETWEEN 0 AND 365 THEN
    RAISE EXCEPTION 'Notice period must be 0 to 365 days.' USING ERRCODE = '22023';
  END IF;
  IF p_default_sanctioned_days IS NOT NULL AND p_default_sanctioned_days NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'Sanctioned days must be 1 to 31.' USING ERRCODE = '22023';
  END IF;
  IF p_deduction_per_day_paise IS NOT NULL AND p_deduction_per_day_paise NOT BETWEEN 1 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid deduction per day.' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION private.vendor_contract_json(target public.vendor_contracts)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT to_jsonb(target) - 'client_request_id' - 'last_reminder_days';
$$;

CREATE FUNCTION private.vendor_contract_insert(
  target_society_id uuid,
  target_vendor_id uuid,
  target_predecessor_id uuid,
  p_scope text,
  p_start_date date,
  p_end_date date,
  p_annual_value_paise bigint,
  p_payment_frequency text,
  p_auto_renew boolean,
  p_notice_days integer,
  p_document_path text,
  p_default_sanctioned_days integer,
  p_deduction_per_day_paise bigint,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  existing_id uuid;
  new_row public.vendor_contracts;
  file_type text;
  file_size integer;
  clean_scope text;
BEGIN
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO existing_id FROM public.vendor_contracts
  WHERE society_id = target_society_id AND created_by = actor_id
    AND client_request_id = p_client_request_id;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  PERFORM 1 FROM public.vendors
  WHERE society_id = target_society_id AND id = target_vendor_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002';
  END IF;

  clean_scope := private.vendor_clean_text(p_scope, 500, 'Scope', true);
  PERFORM private.vendor_contract_check(
    p_start_date, p_end_date, p_annual_value_paise, p_payment_frequency,
    p_notice_days, p_default_sanctioned_days, p_deduction_per_day_paise
  );

  IF p_document_path IS NOT NULL THEN
    SELECT uploaded.content_type, uploaded.size_bytes INTO file_type, file_size
    FROM private.vendor_uploaded_file(target_society_id, p_document_path) AS uploaded;
  END IF;

  INSERT INTO public.vendor_contracts (
    society_id, vendor_id, scope, start_date, end_date, annual_value_paise,
    payment_frequency, auto_renew, notice_days, document_path, document_content_type,
    document_size_bytes, default_sanctioned_days, deduction_per_day_paise, predecessor_id,
    client_request_id, created_by, updated_by
  ) VALUES (
    target_society_id, target_vendor_id, clean_scope, p_start_date, p_end_date,
    p_annual_value_paise, p_payment_frequency, COALESCE(p_auto_renew, false), p_notice_days,
    p_document_path, file_type, file_size, p_default_sanctioned_days,
    p_deduction_per_day_paise, target_predecessor_id, p_client_request_id, actor_id, actor_id
  ) RETURNING * INTO new_row;

  PERFORM private.vendor_audit_change(
    target_society_id,
    CASE WHEN target_predecessor_id IS NULL THEN 'contract.create' ELSE 'contract.renew' END,
    'vendor_contract', new_row.id, NULL, private.vendor_contract_json(new_row), NULL, p_request_id
  );
  RETURN new_row.id;
END;
$$;

CREATE FUNCTION public.vendor_contract_save(
  p_society_id uuid,
  p_contract_id uuid,
  p_vendor_id uuid,
  p_scope text,
  p_start_date date,
  p_end_date date,
  p_annual_value_paise bigint,
  p_payment_frequency text,
  p_auto_renew boolean,
  p_notice_days integer,
  p_document_path text,
  p_default_sanctioned_days integer,
  p_deduction_per_day_paise bigint,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vendor_contracts;
  new_row public.vendor_contracts;
  file_type text;
  file_size integer;
  clean_scope text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);

  IF p_contract_id IS NULL THEN
    RETURN private.vendor_contract_insert(
      p_society_id, p_vendor_id, NULL, p_scope, p_start_date, p_end_date,
      p_annual_value_paise, p_payment_frequency, p_auto_renew, p_notice_days,
      p_document_path, p_default_sanctioned_days, p_deduction_per_day_paise,
      p_client_request_id, p_request_id
    );
  END IF;

  SELECT * INTO current_row FROM public.vendor_contracts
  WHERE society_id = p_society_id AND id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Contract changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF p_vendor_id IS NOT NULL AND p_vendor_id <> current_row.vendor_id THEN
    RAISE EXCEPTION 'A contract cannot move to another vendor.' USING ERRCODE = '22023';
  END IF;
  IF current_row.terminated_on IS NOT NULL THEN
    RAISE EXCEPTION 'A terminated contract cannot be edited.' USING ERRCODE = '22023';
  END IF;

  clean_scope := private.vendor_clean_text(p_scope, 500, 'Scope', true);
  PERFORM private.vendor_contract_check(
    p_start_date, p_end_date, p_annual_value_paise, p_payment_frequency,
    p_notice_days, p_default_sanctioned_days, p_deduction_per_day_paise
  );

  IF p_document_path IS NULL THEN
    file_type := NULL;
    file_size := NULL;
  ELSIF p_document_path IS NOT DISTINCT FROM current_row.document_path THEN
    file_type := current_row.document_content_type;
    file_size := current_row.document_size_bytes;
  ELSE
    SELECT uploaded.content_type, uploaded.size_bytes INTO file_type, file_size
    FROM private.vendor_uploaded_file(p_society_id, p_document_path) AS uploaded;
  END IF;

  UPDATE public.vendor_contracts SET
    scope = clean_scope,
    start_date = p_start_date,
    end_date = p_end_date,
    annual_value_paise = p_annual_value_paise,
    payment_frequency = p_payment_frequency,
    auto_renew = COALESCE(p_auto_renew, false),
    notice_days = p_notice_days,
    document_path = p_document_path,
    document_content_type = file_type,
    document_size_bytes = file_size,
    default_sanctioned_days = p_default_sanctioned_days,
    deduction_per_day_paise = p_deduction_per_day_paise,
    last_reminder_days = CASE
      WHEN p_end_date IS DISTINCT FROM current_row.end_date
        OR p_notice_days IS DISTINCT FROM current_row.notice_days THEN NULL
      ELSE current_row.last_reminder_days
    END,
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  PERFORM private.vendor_audit_change(
    p_society_id, 'contract.update', 'vendor_contract', new_row.id,
    private.vendor_contract_json(current_row), private.vendor_contract_json(new_row),
    NULL, p_request_id
  );
  RETURN new_row.id;
END;
$$;

CREATE FUNCTION public.vendor_contract_renew(
  p_society_id uuid,
  p_predecessor_id uuid,
  p_scope text,
  p_start_date date,
  p_end_date date,
  p_annual_value_paise bigint,
  p_payment_frequency text,
  p_auto_renew boolean,
  p_notice_days integer,
  p_document_path text,
  p_default_sanctioned_days integer,
  p_deduction_per_day_paise bigint,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  predecessor public.vendor_contracts;
  existing_id uuid;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);

  SELECT id INTO existing_id FROM public.vendor_contracts
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  SELECT * INTO predecessor FROM public.vendor_contracts
  WHERE society_id = p_society_id AND id = p_predecessor_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
  END IF;
  IF predecessor.terminated_on IS NOT NULL THEN
    RAISE EXCEPTION 'A terminated contract cannot be renewed.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendor_contracts
    WHERE society_id = p_society_id AND predecessor_id = predecessor.id
  ) THEN
    RAISE EXCEPTION 'This contract has already been renewed.' USING ERRCODE = '23505';
  END IF;

  RETURN private.vendor_contract_insert(
    p_society_id, predecessor.vendor_id, predecessor.id, p_scope, p_start_date, p_end_date,
    p_annual_value_paise, p_payment_frequency, p_auto_renew, p_notice_days, p_document_path,
    p_default_sanctioned_days, p_deduction_per_day_paise, p_client_request_id, p_request_id
  );
END;
$$;

CREATE FUNCTION public.vendor_contract_terminate(
  p_society_id uuid,
  p_contract_id uuid,
  p_terminated_on date,
  p_reason text,
  p_expected_version integer,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vendor_contracts;
  new_row public.vendor_contracts;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);

  SELECT * INTO current_row FROM public.vendor_contracts
  WHERE society_id = p_society_id AND id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Contract changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF current_row.terminated_on IS NOT NULL THEN
    RAISE EXCEPTION 'This contract is already terminated.' USING ERRCODE = '22023';
  END IF;
  clean_reason := private.vendor_clean_text(p_reason, 500, 'Reason', true);
  IF p_terminated_on IS NULL
    OR p_terminated_on NOT BETWEEN current_row.start_date AND current_row.end_date THEN
    RAISE EXCEPTION 'Termination date must fall within the contract period.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vendor_contracts SET
    terminated_on = p_terminated_on,
    termination_reason = clean_reason,
    terminated_by = auth.uid(),
    terminated_at = now(),
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  PERFORM private.vendor_audit_change(
    p_society_id, 'contract.terminate', 'vendor_contract', new_row.id,
    private.vendor_contract_json(current_row), private.vendor_contract_json(new_row),
    clean_reason, p_request_id
  );
END;
$$;

CREATE FUNCTION public.vendor_contracts_get(p_society_id uuid, p_vendor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_today date;
  windows record;
  general_contracts jsonb;
  amc_rows jsonb := '[]'::jsonb;
  target_vendor_name text;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  local_today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO windows FROM private.vendor_expiry_windows(p_society_id);

  IF p_vendor_id IS NOT NULL THEN
    SELECT name INTO target_vendor_name FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', contract.id,
      'vendor_id', contract.vendor_id,
      'vendor_name', vendor.name,
      'scope', contract.scope,
      'start_date', contract.start_date,
      'end_date', contract.end_date,
      'annual_value_paise', contract.annual_value_paise,
      'payment_frequency', contract.payment_frequency,
      'auto_renew', contract.auto_renew,
      'notice_days', contract.notice_days,
      'notice_deadline', contract.end_date - COALESCE(contract.notice_days, 0),
      'document_path', contract.document_path,
      'document_content_type', contract.document_content_type,
      'document_size_bytes', contract.document_size_bytes,
      'default_sanctioned_days', contract.default_sanctioned_days,
      'deduction_per_day_paise', contract.deduction_per_day_paise,
      'predecessor_id', contract.predecessor_id,
      'successor_id', successor.id,
      'terminated_on', contract.terminated_on,
      'termination_reason', contract.termination_reason,
      'terminated_by_name', private.vendor_person(contract.terminated_by),
      'terminated_at', contract.terminated_at,
      'status', private.vendor_term_status(
        contract.start_date, contract.end_date, contract.terminated_on, local_today,
        windows.due_soon_days, windows.urgent_days
      ),
      'version', contract.version,
      'created_at', contract.created_at,
      'created_by_name', private.vendor_person(contract.created_by),
      'updated_at', contract.updated_at,
      'updated_by_name', private.vendor_person(contract.updated_by)
    ) ORDER BY contract.end_date, contract.created_at), '[]'::jsonb)
  INTO general_contracts
  FROM public.vendor_contracts AS contract
  JOIN public.vendors AS vendor
    ON vendor.society_id = contract.society_id AND vendor.id = contract.vendor_id
  LEFT JOIN public.vendor_contracts AS successor
    ON successor.society_id = contract.society_id AND successor.predecessor_id = contract.id
  WHERE contract.society_id = p_society_id
    AND (p_vendor_id IS NULL OR contract.vendor_id = p_vendor_id);

  IF private.module_enabled(p_society_id, 'amc') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', amc.id,
        'asset_label', amc.asset_label,
        'vendor_name', amc.vendor_name,
        'start_date', amc.start_date,
        'end_date', amc.end_date,
        'status', private.vendor_term_status(
          amc.start_date, amc.end_date, NULL, local_today,
          windows.due_soon_days, windows.urgent_days
        ),
        'successor_id', successor.id
      ) ORDER BY amc.end_date, amc.id), '[]'::jsonb)
    INTO amc_rows
    FROM public.amc_contracts AS amc
    LEFT JOIN public.amc_contracts AS successor
      ON successor.society_id = amc.society_id AND successor.predecessor_id = amc.id
    WHERE amc.society_id = p_society_id
      AND (target_vendor_name IS NULL
        OR lower(btrim(amc.vendor_name)) = lower(btrim(target_vendor_name)));
  END IF;

  RETURN jsonb_build_object(
    'today', local_today,
    'can_manage', private.vendor_is_admin(p_society_id),
    'settings', jsonb_build_object(
      'due_soon_days', windows.due_soon_days,
      'urgent_days', windows.urgent_days
    ),
    'contracts', general_contracts,
    'amc_contracts', amc_rows
  );
END;
$$;

CREATE FUNCTION public.vendor_contract_reminders_run(p_society_id uuid, p_request_trace text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_today date;
  reminder_steps integer[];
  contract record;
  due_threshold integer;
  days_left integer;
  member record;
  sent integer := 0;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'vendor')
    OR NOT private.society_writable(p_society_id) THEN
    RETURN 0;
  END IF;
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid reminder trace.' USING ERRCODE = '22023';
  END IF;

  local_today := private.housekeeping_local_date(p_society_id);
  SELECT COALESCE(
      (SELECT array_agg(value::integer ORDER BY value::integer)
       FROM jsonb_array_elements_text(config.settings -> 'reminder_days') AS value),
      ARRAY[60, 30, 7])
  INTO reminder_steps
  FROM (SELECT 1) AS seed
  LEFT JOIN public.module_configs AS config
    ON config.society_id = p_society_id AND config.module_key = 'amc';
  IF reminder_steps IS NULL OR cardinality(reminder_steps) = 0 THEN
    reminder_steps := ARRAY[60, 30, 7];
  END IF;

  FOR contract IN
    SELECT target.*, vendor.name AS target_vendor_name
    FROM public.vendor_contracts AS target
    JOIN public.vendors AS vendor
      ON vendor.society_id = target.society_id AND vendor.id = target.vendor_id
    WHERE target.society_id = p_society_id
      AND target.terminated_on IS NULL
      AND target.end_date >= local_today
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_contracts AS successor
        WHERE successor.society_id = target.society_id AND successor.predecessor_id = target.id
      )
    FOR UPDATE OF target
  LOOP
    days_left := (contract.end_date - COALESCE(contract.notice_days, 0)) - local_today;
    SELECT min(step) INTO due_threshold FROM unnest(reminder_steps) AS step WHERE step >= days_left;
    IF due_threshold IS NULL
      OR (contract.last_reminder_days IS NOT NULL AND contract.last_reminder_days <= due_threshold) THEN
      CONTINUE;
    END IF;

    UPDATE public.vendor_contracts SET last_reminder_days = due_threshold WHERE id = contract.id;

    FOR member IN
      SELECT membership.user_id FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.roles && ARRAY['admin', 'committee']::text[]
    LOOP
      PERFORM private.create_notification(
        p_society_id, member.user_id, 'vendor_contract_expiry',
        'Vendor contract renewal due',
        left(
          contract.target_vendor_name || ': ' || contract.scope || '. '
          || CASE WHEN contract.notice_days IS NULL
            THEN 'Contract ends on ' || to_char(contract.end_date, 'DD Mon YYYY') || '.'
            ELSE 'Notice deadline is '
              || to_char(contract.end_date - contract.notice_days, 'DD Mon YYYY') || '.'
          END,
          300
        ),
        'vendor_contract', contract.id, p_request_trace
      );
      sent := sent + 1;
    END LOOP;
  END LOOP;

  RETURN sent;
END;
$$;

REVOKE ALL ON FUNCTION
  private.vendor_audit_change(uuid, text, text, uuid, jsonb, jsonb, text, text),
  private.vendor_expiry_windows(uuid),
  private.vendor_term_status(date, date, date, date, integer, integer),
  private.vendor_contract_check(date, date, bigint, text, integer, integer, bigint),
  private.vendor_contract_json(public.vendor_contracts),
  private.vendor_contract_insert(uuid, uuid, uuid, text, date, date, bigint, text, boolean, integer, text, integer, bigint, uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.vendor_contract_save(uuid, uuid, uuid, text, date, date, bigint, text, boolean, integer, text, integer, bigint, integer, uuid, text),
  public.vendor_contract_renew(uuid, uuid, text, date, date, bigint, text, boolean, integer, text, integer, bigint, uuid, text),
  public.vendor_contract_terminate(uuid, uuid, date, text, integer, text),
  public.vendor_contracts_get(uuid, uuid)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.vendor_contract_save(uuid, uuid, uuid, text, date, date, bigint, text, boolean, integer, text, integer, bigint, integer, uuid, text),
  public.vendor_contract_renew(uuid, uuid, text, date, date, bigint, text, boolean, integer, text, integer, bigint, uuid, text),
  public.vendor_contract_terminate(uuid, uuid, date, text, integer, text),
  public.vendor_contracts_get(uuid, uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.vendor_contract_reminders_run(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_contract_reminders_run(uuid, text) TO service_role;

-- Contract documents share the private vendor-files bucket and its download audit rule.
CREATE OR REPLACE FUNCTION private.vendor_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  uploader_id uuid;
  attached_ids text[];
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/vendors/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$'
  ) OR auth.uid() IS NULL THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  uploader_id := split_part(p_path, '/', 3)::uuid;
  IF NOT private.module_enabled(target_society_id, 'vendor')
    OR NOT private.has_role(target_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived'
    )
  THEN RETURN false; END IF;
  SELECT array_agg(id::text) INTO attached_ids FROM (
    SELECT id FROM public.vendor_documents WHERE society_id = target_society_id AND path = p_path
    UNION ALL
    SELECT id FROM public.vendor_quotes WHERE society_id = target_society_id AND file_path = p_path
    UNION ALL
    SELECT id FROM public.vendor_contracts
    WHERE society_id = target_society_id AND document_path = p_path
  ) AS attached;
  IF p_write THEN
    RETURN uploader_id = auth.uid() AND attached_ids IS NULL
      AND private.society_writable(target_society_id);
  END IF;
  IF attached_ids IS NULL THEN RETURN uploader_id = auth.uid(); END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.society_id = target_society_id AND audit.action = 'vendor.file.download'
      AND audit.entity_id = ANY(attached_ids) AND audit.actor_id = auth.uid()
      AND audit.created_at > clock_timestamp() - interval '5 minutes'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_file_issue(p_society_id uuid, p_path text, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  entity_kind text;
  entity uuid;
  file_name text;
  file_type text;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT 'vendor_document', document.id, document.title, document.content_type
    INTO entity_kind, entity, file_name, file_type
    FROM public.vendor_documents AS document
    WHERE document.society_id = p_society_id AND document.path = p_path;
  IF NOT FOUND THEN
    SELECT 'vendor_quote', quote.id, 'Quote from ' || vendor.name, quote.file_content_type
      INTO entity_kind, entity, file_name, file_type
      FROM public.vendor_quotes AS quote
      JOIN public.vendors AS vendor
        ON vendor.society_id = quote.society_id AND vendor.id = quote.vendor_id
      WHERE quote.society_id = p_society_id AND quote.file_path = p_path;
  END IF;
  IF entity IS NULL THEN
    SELECT 'vendor_contract', contract.id, 'Contract - ' || vendor.name,
        contract.document_content_type
      INTO entity_kind, entity, file_name, file_type
      FROM public.vendor_contracts AS contract
      JOIN public.vendors AS vendor
        ON vendor.society_id = contract.society_id AND vendor.id = contract.vendor_id
      WHERE contract.society_id = p_society_id AND contract.document_path = p_path;
  END IF;
  IF entity IS NULL THEN RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.vendor_audit(p_society_id, 'file.download', entity_kind, entity,
    jsonb_build_object('path', p_path), NULL, p_request_id);
  RETURN jsonb_build_object(
    'path', p_path,
    'file_name', left(regexp_replace(file_name, '[^A-Za-z0-9 ._-]', '', 'g'), 100)
      || CASE file_type WHEN 'application/pdf' THEN '.pdf' WHEN 'image/png' THEN '.png' ELSE '.jpg' END,
    'content_type', file_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  RETURN QUERY
    SELECT 'vendor-files'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'vendor-files'
      AND object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.vendor_documents AS document WHERE document.path = object.name)
      AND NOT EXISTS (SELECT 1 FROM public.vendor_quotes AS quote WHERE quote.file_path = object.name)
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_contracts AS contract WHERE contract.document_path = object.name
      )
    ORDER BY object.name;
END;
$$;

-- P47.3 structured AMC schedule ----------------------------------------------

ALTER TABLE public.amc_contracts
  ADD COLUMN amc_type text,
  ADD COLUMN asset_category_id uuid,
  ADD COLUMN services_per_year integer,
  ADD CONSTRAINT amc_contracts_amc_type_check
    CHECK (amc_type IS NULL OR amc_type IN ('comprehensive', 'non_comprehensive')),
  ADD CONSTRAINT amc_contracts_services_per_year_check
    CHECK (services_per_year IS NULL OR services_per_year BETWEEN 1 AND 12),
  ADD CONSTRAINT amc_contracts_asset_category_same_society_fkey
    FOREIGN KEY (society_id, asset_category_id)
    REFERENCES public.asset_categories (society_id, id) ON DELETE RESTRICT;
CREATE INDEX amc_contracts_asset_category_idx ON public.amc_contracts (society_id, asset_category_id);

CREATE FUNCTION public.amc_schedule_save(
  p_society_id uuid,
  p_contract_id uuid,
  p_amc_type text,
  p_asset_category_id uuid,
  p_services_per_year integer,
  p_expected_updated_at timestamptz,
  p_request_trace text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.amc_contracts;
  new_row public.amc_contracts;
BEGIN
  PERFORM private.amc_authorize(p_society_id, true);
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid request trace.' USING ERRCODE = '22023';
  END IF;
  IF p_amc_type IS NOT NULL AND p_amc_type NOT IN ('comprehensive', 'non_comprehensive') THEN
    RAISE EXCEPTION 'Choose a valid AMC type.' USING ERRCODE = '22023';
  END IF;
  IF p_services_per_year IS NOT NULL AND p_services_per_year NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Services per year must be 1 to 12.' USING ERRCODE = '22023';
  END IF;
  IF p_asset_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.asset_categories
    WHERE society_id = p_society_id AND id = p_asset_category_id
  ) THEN
    RAISE EXCEPTION 'Choose a valid asset type.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.amc_contracts
  WHERE society_id = p_society_id AND id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_updated_at IS NULL OR current_row.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Contract changed. Refresh.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.amc_contracts SET
    amc_type = p_amc_type,
    asset_category_id = p_asset_category_id,
    services_per_year = p_services_per_year,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'amc.schedule.save', 'amc_contract', new_row.id::text,
    jsonb_build_object('amc_type', current_row.amc_type,
      'asset_category_id', current_row.asset_category_id,
      'services_per_year', current_row.services_per_year),
    jsonb_build_object('amc_type', new_row.amc_type,
      'asset_category_id', new_row.asset_category_id,
      'services_per_year', new_row.services_per_year),
    p_request_trace
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amc_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  local_today date;
  windows record;
BEGIN
  PERFORM private.amc_authorize(p_society_id, false);
  local_today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO windows FROM private.vendor_expiry_windows(p_society_id);
  RETURN jsonb_build_object(
    'today', local_today,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'settings', jsonb_build_object(
      'due_soon_days', windows.due_soon_days,
      'urgent_days', windows.urgent_days
    ),
    'contracts', COALESCE((
      SELECT jsonb_agg(to_jsonb(contract) || jsonb_build_object(
        'status', private.vendor_term_status(
          contract.start_date, contract.end_date, NULL, local_today,
          windows.due_soon_days, windows.urgent_days
        ),
        'successor_id', (
          SELECT successor.id FROM public.amc_contracts AS successor
          WHERE successor.predecessor_id = contract.id
        ),
        'asset_category_name', category.name,
        'last_visit_date', visits.last_visit_date,
        'next_service_date', schedule.next_service_date,
        'service_overdue', COALESCE(schedule.next_service_date < local_today, false)
      ) ORDER BY contract.end_date, contract.id)
      FROM public.amc_contracts AS contract
      LEFT JOIN public.asset_categories AS category
        ON category.society_id = contract.society_id AND category.id = contract.asset_category_id
      LEFT JOIN LATERAL (
        SELECT max(visit.visit_date) AS last_visit_date FROM public.amc_visits AS visit
        WHERE visit.society_id = contract.society_id AND visit.contract_id = contract.id
      ) AS visits ON true
      CROSS JOIN LATERAL (
        SELECT visits.last_visit_date
          + round(365.0 / contract.services_per_year)::integer AS next_service_date
      ) AS schedule
      WHERE contract.society_id = p_society_id
    ), '[]'::jsonb),
    'visits', COALESCE((
      SELECT jsonb_agg(to_jsonb(visit) ORDER BY visit.visit_date DESC, visit.id)
      FROM public.amc_visits AS visit WHERE visit.society_id = p_society_id
    ), '[]'::jsonb),
    'links', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('request_id', link.request_id, 'contract_id', link.contract_id))
      FROM public.amc_request_links AS link WHERE link.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.amc_schedule_save(uuid, uuid, text, uuid, integer, timestamptz, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.amc_schedule_save(uuid, uuid, text, uuid, integer, timestamptz, text)
  TO authenticated;

-- P47.5 monthly agency staff-day checks ---------------------------------------

CREATE TABLE public.vendor_staff_day_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL,
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  sanctioned_days integer NOT NULL CHECK (sanctioned_days BETWEEN 1 AND 31),
  actual_days integer NOT NULL CHECK (actual_days BETWEEN 0 AND 31),
  contracted_amount_paise bigint NOT NULL
    CHECK (contracted_amount_paise BETWEEN 0 AND 999999999999999),
  rate_paise bigint CHECK (rate_paise IS NULL OR rate_paise BETWEEN 1 AND 999999999999999),
  manual_deduction_paise bigint CHECK (
    manual_deduction_paise IS NULL OR manual_deduction_paise BETWEEN 1 AND 999999999999999
  ),
  manual_deduction_reason text CHECK (
    manual_deduction_reason IS NULL OR (
      char_length(manual_deduction_reason) BETWEEN 1 AND 500
      AND manual_deduction_reason = btrim(manual_deduction_reason)
    )
  ),
  bill_raised_paise bigint CHECK (
    bill_raised_paise IS NULL OR bill_raised_paise BETWEEN 0 AND 999999999999999
  ),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, contract_id, month),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT vendor_staff_day_checks_contract_same_society_fkey
    FOREIGN KEY (society_id, contract_id)
    REFERENCES public.vendor_contracts(society_id, id) ON DELETE RESTRICT,
  CHECK ((manual_deduction_paise IS NULL) = (manual_deduction_reason IS NULL)),
  CHECK (rate_paise IS NULL OR manual_deduction_paise IS NULL)
);
CREATE INDEX vendor_staff_day_checks_created_by_idx ON public.vendor_staff_day_checks (created_by);
CREATE INDEX vendor_staff_day_checks_updated_by_idx ON public.vendor_staff_day_checks (updated_by);

ALTER TABLE public.vendor_staff_day_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_staff_day_checks FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY vendor_staff_day_checks_no_direct_access ON public.vendor_staff_day_checks
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER vendor_staff_day_checks_reject_delete BEFORE DELETE ON public.vendor_staff_day_checks
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_staff_day_checks_reject_truncate BEFORE TRUNCATE ON public.vendor_staff_day_checks
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION public.vendor_staff_day_check_save(
  p_society_id uuid,
  p_check_id uuid,
  p_contract_id uuid,
  p_month date,
  p_sanctioned_days integer,
  p_actual_days integer,
  p_contracted_amount_paise bigint,
  p_rate_paise bigint,
  p_manual_deduction_paise bigint,
  p_manual_deduction_reason text,
  p_bill_raised_paise bigint,
  p_edit_reason text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  contract public.vendor_contracts;
  current_row public.vendor_staff_day_checks;
  new_row public.vendor_staff_day_checks;
  target_month date;
  sanctioned integer;
  rate bigint;
  clean_manual_reason text;
  clean_edit_reason text;
  existing_id uuid;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);

  IF p_check_id IS NOT NULL THEN
    SELECT * INTO current_row FROM public.vendor_staff_day_checks
    WHERE society_id = p_society_id AND id = p_check_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staff-day check not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
      RAISE EXCEPTION 'Staff-day check changed. Refresh.' USING ERRCODE = '40001';
    END IF;
    clean_edit_reason := private.vendor_clean_text(p_edit_reason, 500, 'an edit reason', true);
    IF (p_contract_id IS NOT NULL AND p_contract_id <> current_row.contract_id)
      OR (p_month IS NOT NULL AND date_trunc('month', p_month)::date <> current_row.month) THEN
      RAISE EXCEPTION 'The contract and month of a saved check cannot change.' USING ERRCODE = '22023';
    END IF;
    target_month := current_row.month;
    SELECT * INTO contract FROM public.vendor_contracts
    WHERE society_id = p_society_id AND id = current_row.contract_id;
  ELSE
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'Request id is required.' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO existing_id FROM public.vendor_staff_day_checks
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
    SELECT * INTO contract FROM public.vendor_contracts
    WHERE society_id = p_society_id AND id = p_contract_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_month IS NULL THEN
      RAISE EXCEPTION 'Choose a month.' USING ERRCODE = '22023';
    END IF;
    target_month := date_trunc('month', p_month)::date;
    IF target_month > contract.end_date
      OR (target_month + interval '1 month' - interval '1 day')::date < contract.start_date THEN
      RAISE EXCEPTION 'The month must fall within the contract period.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.vendor_staff_day_checks
      WHERE society_id = p_society_id AND contract_id = contract.id AND month = target_month
    ) THEN
      RAISE EXCEPTION 'A check already exists for this contract and month.' USING ERRCODE = '23505';
    END IF;
  END IF;

  sanctioned := COALESCE(
    p_sanctioned_days,
    CASE WHEN p_check_id IS NULL THEN contract.default_sanctioned_days
      ELSE current_row.sanctioned_days END
  );
  IF sanctioned IS NULL OR sanctioned NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'Sanctioned days must be 1 to 31.' USING ERRCODE = '22023';
  END IF;
  IF p_actual_days IS NULL OR p_actual_days NOT BETWEEN 0 AND 31 THEN
    RAISE EXCEPTION 'Actual days must be 0 to 31.' USING ERRCODE = '22023';
  END IF;
  IF p_contracted_amount_paise IS NULL
    OR p_contracted_amount_paise NOT BETWEEN 0 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid contracted amount.' USING ERRCODE = '22023';
  END IF;
  IF p_bill_raised_paise IS NOT NULL AND p_bill_raised_paise NOT BETWEEN 0 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid billed amount.' USING ERRCODE = '22023';
  END IF;
  rate := p_rate_paise;
  IF rate IS NOT NULL AND rate NOT BETWEEN 1 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid deduction per day.' USING ERRCODE = '22023';
  END IF;
  IF p_manual_deduction_paise IS NOT NULL THEN
    IF rate IS NOT NULL THEN
      RAISE EXCEPTION 'Use either a per-day rate or a manual deduction.' USING ERRCODE = '22023';
    END IF;
    IF p_manual_deduction_paise NOT BETWEEN 1 AND 999999999999999 THEN
      RAISE EXCEPTION 'Enter a valid manual deduction.' USING ERRCODE = '22023';
    END IF;
    clean_manual_reason := private.vendor_clean_text(
      p_manual_deduction_reason, 500, 'a deduction reason', true
    );
  ELSIF p_manual_deduction_reason IS NOT NULL AND btrim(p_manual_deduction_reason) <> '' THEN
    RAISE EXCEPTION 'A deduction reason needs a manual deduction amount.' USING ERRCODE = '22023';
  END IF;

  IF p_check_id IS NULL THEN
    INSERT INTO public.vendor_staff_day_checks (
      society_id, contract_id, month, sanctioned_days, actual_days, contracted_amount_paise,
      rate_paise, manual_deduction_paise, manual_deduction_reason, bill_raised_paise,
      client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, contract.id, target_month, sanctioned, p_actual_days,
      p_contracted_amount_paise, rate, p_manual_deduction_paise, clean_manual_reason,
      p_bill_raised_paise, p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO new_row;
    PERFORM private.vendor_audit_change(
      p_society_id, 'staff_day_check.create', 'vendor_staff_day_check', new_row.id, NULL,
      to_jsonb(new_row) - 'client_request_id', NULL, p_request_id
    );
  ELSE
    UPDATE public.vendor_staff_day_checks SET
      sanctioned_days = sanctioned,
      actual_days = p_actual_days,
      contracted_amount_paise = p_contracted_amount_paise,
      rate_paise = rate,
      manual_deduction_paise = p_manual_deduction_paise,
      manual_deduction_reason = clean_manual_reason,
      bill_raised_paise = p_bill_raised_paise,
      version = current_row.version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = current_row.id
    RETURNING * INTO new_row;
    PERFORM private.vendor_audit_change(
      p_society_id, 'staff_day_check.update', 'vendor_staff_day_check', new_row.id,
      to_jsonb(current_row) - 'client_request_id', to_jsonb(new_row) - 'client_request_id',
      clean_edit_reason, p_request_id
    );
  END IF;
  RETURN new_row.id;
END;
$$;

CREATE FUNCTION public.vendor_staff_day_checks_get(p_society_id uuid, p_vendor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  RETURN jsonb_build_object(
    'can_manage', private.vendor_is_admin(p_society_id),
    'checks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', target.id,
          'contract_id', target.contract_id,
          'contract_scope', contract.scope,
          'vendor_id', contract.vendor_id,
          'vendor_name', vendor.name,
          'month', target.month,
          'sanctioned_days', target.sanctioned_days,
          'actual_days', target.actual_days,
          'contracted_amount_paise', target.contracted_amount_paise,
          'rate_paise', target.rate_paise,
          'manual_deduction_paise', target.manual_deduction_paise,
          'manual_deduction_reason', target.manual_deduction_reason,
          'bill_raised_paise', target.bill_raised_paise,
          'shortfall_days', math.shortfall_days,
          'deduction_paise', math.deduction_paise,
          'payable_paise', target.contracted_amount_paise - math.deduction_paise,
          'variance_paise',
            target.bill_raised_paise - (target.contracted_amount_paise - math.deduction_paise),
          'flagged', COALESCE(
            target.bill_raised_paise <> target.contracted_amount_paise - math.deduction_paise,
            false
          ),
          'version', target.version,
          'created_at', target.created_at,
          'updated_at', target.updated_at,
          'updated_by_name', private.vendor_person(target.updated_by)
        ) ORDER BY target.month DESC, vendor.name, contract.scope)
      FROM public.vendor_staff_day_checks AS target
      JOIN public.vendor_contracts AS contract
        ON contract.society_id = target.society_id AND contract.id = target.contract_id
      JOIN public.vendors AS vendor
        ON vendor.society_id = contract.society_id AND vendor.id = contract.vendor_id
      CROSS JOIN LATERAL (
        SELECT
          greatest(0, target.sanctioned_days - target.actual_days) AS shortfall_days,
          CASE
            WHEN target.rate_paise IS NOT NULL THEN least(
              target.contracted_amount_paise,
              greatest(0, target.sanctioned_days - target.actual_days)::bigint * target.rate_paise
            )
            ELSE least(target.contracted_amount_paise, COALESCE(target.manual_deduction_paise, 0))
          END AS deduction_paise
      ) AS math
      WHERE target.society_id = p_society_id
        AND (p_vendor_id IS NULL OR contract.vendor_id = p_vendor_id)
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.vendor_staff_day_check_save(uuid, uuid, uuid, date, integer, integer, bigint, bigint, bigint, text, bigint, text, integer, uuid, text),
  public.vendor_staff_day_checks_get(uuid, uuid)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.vendor_staff_day_check_save(uuid, uuid, uuid, date, integer, integer, bigint, bigint, bigint, text, bigint, text, integer, uuid, text),
  public.vendor_staff_day_checks_get(uuid, uuid)
TO authenticated;

-- P47.6 work orders -------------------------------------------------------------

CREATE TABLE public.vendor_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  number text NOT NULL CHECK (number ~ '^WO-[0-9]{4}-[0-9]{4,}$'),
  order_year integer NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  purchase_request_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  description text NOT NULL
    CHECK (description = btrim(description) AND char_length(description) BETWEEN 1 AND 2000),
  value_paise bigint NOT NULL CHECK (value_paise BETWEEN 1 AND 999999999999999),
  issued_on date NOT NULL,
  due_on date,
  completed_on date,
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'in_progress', 'completed', 'cancelled')),
  cancel_reason text CHECK (
    cancel_reason IS NULL OR (char_length(cancel_reason) BETWEEN 1 AND 500
      AND cancel_reason = btrim(cancel_reason))
  ),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, number),
  UNIQUE (society_id, order_year, sequence),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT vendor_work_orders_request_same_society_fkey
    FOREIGN KEY (society_id, purchase_request_id)
    REFERENCES public.vendor_purchase_requests(society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_work_orders_vendor_same_society_fkey
    FOREIGN KEY (society_id, vendor_id) REFERENCES public.vendors(society_id, id) ON DELETE RESTRICT,
  CHECK (order_year = extract(year FROM issued_on)::integer),
  CHECK (due_on IS NULL OR due_on >= issued_on),
  CHECK ((status = 'completed') = (completed_on IS NOT NULL)),
  CHECK (completed_on IS NULL OR completed_on >= issued_on),
  CHECK (
    (status = 'cancelled' AND cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL
      AND cancelled_by IS NOT NULL)
    OR (status <> 'cancelled' AND cancel_reason IS NULL AND cancelled_at IS NULL
      AND cancelled_by IS NULL)
  )
);
CREATE INDEX vendor_work_orders_request_idx ON public.vendor_work_orders (society_id, purchase_request_id);
CREATE UNIQUE INDEX vendor_work_orders_open_request_key ON public.vendor_work_orders (society_id, purchase_request_id)
  WHERE status <> 'cancelled';
CREATE INDEX vendor_work_orders_vendor_idx ON public.vendor_work_orders (society_id, vendor_id, status);
CREATE INDEX vendor_work_orders_cancelled_by_idx ON public.vendor_work_orders (cancelled_by)
  WHERE cancelled_by IS NOT NULL;
CREATE INDEX vendor_work_orders_created_by_idx ON public.vendor_work_orders (created_by);
CREATE INDEX vendor_work_orders_updated_by_idx ON public.vendor_work_orders (updated_by);

ALTER TABLE public.vendor_work_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_work_orders FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY vendor_work_orders_no_direct_access ON public.vendor_work_orders
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER vendor_work_orders_reject_delete BEFORE DELETE ON public.vendor_work_orders
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_work_orders_reject_truncate BEFORE TRUNCATE ON public.vendor_work_orders
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION public.vendor_work_order_create(
  p_society_id uuid,
  p_purchase_request_id uuid,
  p_description text,
  p_value_paise bigint,
  p_issued_on date,
  p_due_on date,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request public.vendor_purchase_requests;
  quote public.vendor_quotes;
  existing_id uuid;
  issue_date date;
  issue_year integer;
  next_sequence integer;
  clean_description text;
  order_value bigint;
  new_row public.vendor_work_orders;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO existing_id FROM public.vendor_work_orders
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  SELECT * INTO request FROM public.vendor_purchase_requests
  WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF request.status <> 'approved' OR request.selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'Only an approved purchase request can get a work order.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendor_work_orders
    WHERE society_id = p_society_id AND purchase_request_id = request.id AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'This purchase request already has a work order.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO quote FROM public.vendor_quotes
  WHERE society_id = p_society_id AND id = request.selected_quote_id;

  clean_description := private.vendor_clean_text(
    COALESCE(p_description, request.title), 2000, 'a description', true
  );
  order_value := COALESCE(p_value_paise, quote.amount_paise);
  IF order_value IS NULL OR order_value NOT BETWEEN 1 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid work-order value.' USING ERRCODE = '22023';
  END IF;
  issue_date := COALESCE(p_issued_on, private.housekeeping_local_date(p_society_id));
  IF p_due_on < issue_date THEN
    RAISE EXCEPTION 'The due date must be on or after the issue date.' USING ERRCODE = '22023';
  END IF;
  issue_year := extract(year FROM issue_date)::integer;

  -- Serialise numbering per society and year so concurrent issues never share a number.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('vendor-work-orders:' || p_society_id::text || ':' || issue_year::text, 0)
  );
  SELECT COALESCE(max(sequence), 0) + 1 INTO next_sequence FROM public.vendor_work_orders
  WHERE society_id = p_society_id AND order_year = issue_year;

  INSERT INTO public.vendor_work_orders (
    society_id, number, order_year, sequence, purchase_request_id, vendor_id, description,
    value_paise, issued_on, due_on, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, 'WO-' || issue_year::text || '-' || lpad(next_sequence::text, 4, '0'),
    issue_year, next_sequence, request.id, quote.vendor_id, clean_description, order_value,
    issue_date, p_due_on, p_client_request_id, auth.uid(), auth.uid()
  ) RETURNING * INTO new_row;

  PERFORM private.vendor_audit_change(
    p_society_id, 'work_order.create', 'vendor_work_order', new_row.id, NULL,
    to_jsonb(new_row) - 'client_request_id', NULL, p_request_id
  );
  RETURN new_row.id;
END;
$$;

CREATE FUNCTION public.vendor_work_order_update(
  p_society_id uuid,
  p_work_order_id uuid,
  p_description text,
  p_due_on date,
  p_expected_version integer,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vendor_work_orders;
  new_row public.vendor_work_orders;
  clean_description text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  SELECT * INTO current_row FROM public.vendor_work_orders
  WHERE society_id = p_society_id AND id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Work order changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF current_row.status NOT IN ('issued', 'in_progress') THEN
    RAISE EXCEPTION 'Only an open work order can be edited.' USING ERRCODE = '22023';
  END IF;
  clean_description := private.vendor_clean_text(p_description, 2000, 'a description', true);
  IF p_due_on < current_row.issued_on THEN
    RAISE EXCEPTION 'The due date must be on or after the issue date.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vendor_work_orders SET
    description = clean_description,
    due_on = p_due_on,
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  PERFORM private.vendor_audit_change(
    p_society_id, 'work_order.update', 'vendor_work_order', new_row.id,
    jsonb_build_object('description', current_row.description, 'due_on', current_row.due_on),
    jsonb_build_object('description', new_row.description, 'due_on', new_row.due_on),
    NULL, p_request_id
  );
END;
$$;

CREATE FUNCTION public.vendor_work_order_set_status(
  p_society_id uuid,
  p_work_order_id uuid,
  p_status text,
  p_completed_on date,
  p_reason text,
  p_expected_version integer,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vendor_work_orders;
  new_row public.vendor_work_orders;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  SELECT * INTO current_row FROM public.vendor_work_orders
  WHERE society_id = p_society_id AND id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Work order changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF NOT (
    (current_row.status = 'issued' AND p_status IN ('in_progress', 'completed', 'cancelled'))
    OR (current_row.status = 'in_progress' AND p_status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Work-order status can only move forward.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'completed' AND (
    p_completed_on IS NULL OR p_completed_on < current_row.issued_on
    OR p_completed_on > private.housekeeping_local_date(p_society_id)
  ) THEN
    RAISE EXCEPTION 'Enter a completion date between the issue date and today.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'cancelled' THEN
    clean_reason := private.vendor_clean_text(p_reason, 500, 'a cancellation reason', true);
  END IF;

  UPDATE public.vendor_work_orders SET
    status = p_status,
    completed_on = CASE WHEN p_status = 'completed' THEN p_completed_on END,
    cancel_reason = clean_reason,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() END,
    cancelled_by = CASE WHEN p_status = 'cancelled' THEN auth.uid() END,
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  PERFORM private.vendor_audit_change(
    p_society_id, 'work_order.status', 'vendor_work_order', new_row.id,
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', new_row.status, 'completed_on', new_row.completed_on),
    clean_reason, p_request_id
  );
END;
$$;

CREATE FUNCTION public.vendor_work_orders_get(p_society_id uuid, p_vendor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_today date;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  local_today := private.housekeeping_local_date(p_society_id);
  RETURN jsonb_build_object(
    'today', local_today,
    'can_manage', private.vendor_is_admin(p_society_id),
    'work_orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', work_order.id,
          'number', work_order.number,
          'purchase_request_id', work_order.purchase_request_id,
          'request_title', request.title,
          'vendor_id', work_order.vendor_id,
          'vendor_name', vendor.name,
          'description', work_order.description,
          'value_paise', work_order.value_paise,
          'issued_on', work_order.issued_on,
          'due_on', work_order.due_on,
          'completed_on', work_order.completed_on,
          'status', work_order.status,
          'cancel_reason', work_order.cancel_reason,
          'cancelled_at', work_order.cancelled_at,
          'cancelled_by_name', private.vendor_person(work_order.cancelled_by),
          'days_open', CASE work_order.status
            WHEN 'cancelled' THEN NULL
            WHEN 'completed' THEN work_order.completed_on - work_order.issued_on
            ELSE local_today - work_order.issued_on
          END,
          'delay_days', CASE
            WHEN work_order.status = 'cancelled' OR work_order.due_on IS NULL THEN NULL
            ELSE greatest(0, COALESCE(work_order.completed_on, local_today) - work_order.due_on)
          END,
          'version', work_order.version,
          'created_at', work_order.created_at,
          'created_by_name', private.vendor_person(work_order.created_by),
          'updated_at', work_order.updated_at
        ) ORDER BY work_order.order_year DESC, work_order.sequence DESC)
      FROM public.vendor_work_orders AS work_order
      JOIN public.vendor_purchase_requests AS request
        ON request.society_id = work_order.society_id AND request.id = work_order.purchase_request_id
      JOIN public.vendors AS vendor
        ON vendor.society_id = work_order.society_id AND vendor.id = work_order.vendor_id
      WHERE work_order.society_id = p_society_id
        AND (p_vendor_id IS NULL OR work_order.vendor_id = p_vendor_id)
    ), '[]'::jsonb),
    'approved_requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', request.id,
          'title', request.title,
          'vendor_id', quote.vendor_id,
          'vendor_name', vendor.name,
          'amount_paise', quote.amount_paise
        ) ORDER BY request.decided_at DESC, request.id)
      FROM public.vendor_purchase_requests AS request
      JOIN public.vendor_quotes AS quote
        ON quote.society_id = request.society_id AND quote.id = request.selected_quote_id
      JOIN public.vendors AS vendor
        ON vendor.society_id = quote.society_id AND vendor.id = quote.vendor_id
      WHERE request.society_id = p_society_id AND request.status = 'approved'
        AND (p_vendor_id IS NULL OR quote.vendor_id = p_vendor_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.vendor_work_orders AS work_order
          WHERE work_order.society_id = request.society_id
            AND work_order.purchase_request_id = request.id AND work_order.status <> 'cancelled'
        )
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.vendor_work_order_create(uuid, uuid, text, bigint, date, date, uuid, text),
  public.vendor_work_order_update(uuid, uuid, text, date, integer, text),
  public.vendor_work_order_set_status(uuid, uuid, text, date, text, integer, text),
  public.vendor_work_orders_get(uuid, uuid)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.vendor_work_order_create(uuid, uuid, text, bigint, date, date, uuid, text),
  public.vendor_work_order_update(uuid, uuid, text, date, integer, text),
  public.vendor_work_order_set_status(uuid, uuid, text, date, text, integer, text),
  public.vendor_work_orders_get(uuid, uuid)
TO authenticated;

-- P47.7 vendor bills owed and links to P16 money-out entries -----------------------

CREATE TABLE public.vendor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL,
  invoice_number text NOT NULL
    CHECK (invoice_number = btrim(invoice_number) AND char_length(invoice_number) BETWEEN 1 AND 60),
  invoice_date date NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 1 AND 999999999999999),
  effective_terms_days integer NOT NULL CHECK (effective_terms_days BETWEEN 0 AND 365),
  due_date date NOT NULL,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancel_reason text CHECK (
    cancel_reason IS NULL OR (char_length(cancel_reason) BETWEEN 1 AND 500
      AND cancel_reason = btrim(cancel_reason))
  ),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT vendor_bills_vendor_same_society_fkey
    FOREIGN KEY (society_id, vendor_id) REFERENCES public.vendors(society_id, id) ON DELETE RESTRICT,
  CHECK (due_date = invoice_date + effective_terms_days),
  CHECK (
    (cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL)
    OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL)
  )
);
CREATE INDEX vendor_bills_vendor_idx ON public.vendor_bills (society_id, vendor_id, due_date);
CREATE UNIQUE INDEX vendor_bills_invoice_key
  ON public.vendor_bills (society_id, vendor_id, lower(invoice_number))
  WHERE cancelled_at IS NULL;
CREATE INDEX vendor_bills_cancelled_by_idx ON public.vendor_bills (cancelled_by)
  WHERE cancelled_by IS NOT NULL;
CREATE INDEX vendor_bills_created_by_idx ON public.vendor_bills (created_by);
CREATE INDEX vendor_bills_updated_by_idx ON public.vendor_bills (updated_by);

CREATE TABLE public.vendor_bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  bill_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 1 AND 999999999999999),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  unlinked_at timestamptz,
  unlinked_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  unlink_reason text CHECK (
    unlink_reason IS NULL OR (
      char_length(unlink_reason) BETWEEN 1 AND 500 AND unlink_reason = btrim(unlink_reason)
    )
  ),
  CHECK (
    (unlinked_at IS NULL AND unlinked_by IS NULL AND unlink_reason IS NULL)
    OR (unlinked_at IS NOT NULL AND unlinked_by IS NOT NULL AND unlink_reason IS NOT NULL)
  ),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT vendor_bill_payments_bill_same_society_fkey
    FOREIGN KEY (society_id, bill_id) REFERENCES public.vendor_bills(society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_bill_payments_entry_same_society_fkey
    FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries(society_id, id) ON DELETE RESTRICT
);
-- An unlinked entry may be linked to the same bill again later.
CREATE UNIQUE INDEX vendor_bill_payments_active_key
  ON public.vendor_bill_payments (society_id, bill_id, entry_id) WHERE unlinked_at IS NULL;
CREATE INDEX vendor_bill_payments_bill_idx ON public.vendor_bill_payments (society_id, bill_id);
CREATE INDEX vendor_bill_payments_entry_idx ON public.vendor_bill_payments (society_id, entry_id);
CREATE INDEX vendor_bill_payments_created_by_idx ON public.vendor_bill_payments (created_by);
CREATE INDEX vendor_bill_payments_unlinked_by_idx ON public.vendor_bill_payments (unlinked_by);

ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bill_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_bills, public.vendor_bill_payments
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY vendor_bills_no_direct_access ON public.vendor_bills
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY vendor_bill_payments_no_direct_access ON public.vendor_bill_payments
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER vendor_bills_reject_delete BEFORE DELETE ON public.vendor_bills
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_bills_reject_truncate BEFORE TRUNCATE ON public.vendor_bills
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
-- Payment links are history: a reversed or unlinked link stays but stops counting.
-- The only allowed update is the one-time unlink stamp.
CREATE FUNCTION private.vendor_bill_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.unlinked_at IS NULL AND NEW.unlinked_at IS NOT NULL
    AND (to_jsonb(NEW) - ARRAY['unlinked_at', 'unlinked_by', 'unlink_reason'])
      = (to_jsonb(OLD) - ARRAY['unlinked_at', 'unlinked_by', 'unlink_reason']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Payment links are permanent; unlink them instead.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_bill_payments_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER vendor_bill_payments_reject_change BEFORE UPDATE OR DELETE ON public.vendor_bill_payments
  FOR EACH ROW EXECUTE FUNCTION private.vendor_bill_payments_guard();
CREATE TRIGGER vendor_bill_payments_reject_truncate BEFORE TRUNCATE ON public.vendor_bill_payments
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.vendor_entry_reversed(target_society_id uuid, target_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_book_entries AS reversal
    WHERE reversal.society_id = target_society_id AND reversal.reverses_entry_id = target_entry_id
  );
$$;

CREATE FUNCTION private.vendor_bill_paid(target_society_id uuid, target_bill_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(sum(link.amount_paise), 0)::bigint
  FROM public.vendor_bill_payments AS link
  WHERE link.society_id = target_society_id AND link.bill_id = target_bill_id
    AND link.unlinked_at IS NULL
    AND NOT private.vendor_entry_reversed(target_society_id, link.entry_id);
$$;

CREATE FUNCTION private.vendor_entry_linked(target_society_id uuid, target_entry_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(sum(link.amount_paise), 0)::bigint
  FROM public.vendor_bill_payments AS link
  WHERE link.society_id = target_society_id AND link.entry_id = target_entry_id
    AND link.unlinked_at IS NULL;
$$;

CREATE FUNCTION public.vendor_bill_save(
  p_society_id uuid,
  p_bill_id uuid,
  p_vendor_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_amount_paise bigint,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vendor_bills;
  new_row public.vendor_bills;
  existing_id uuid;
  terms integer;
  target_vendor_id uuid;
  clean_invoice text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  clean_invoice := private.vendor_clean_text(p_invoice_number, 60, 'an invoice number', true);
  IF p_invoice_date IS NULL THEN
    RAISE EXCEPTION 'Enter the invoice date.' USING ERRCODE = '22023';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid bill amount.' USING ERRCODE = '22023';
  END IF;

  IF p_bill_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'Request id is required.' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO existing_id FROM public.vendor_bills
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
    SELECT id, COALESCE(payment_terms_days, 5) INTO target_vendor_id, terms
    FROM public.vendors WHERE society_id = p_society_id AND id = p_vendor_id FOR SHARE;
    IF target_vendor_id IS NULL THEN
      RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT * INTO current_row FROM public.vendor_bills
    WHERE society_id = p_society_id AND id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bill not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
      RAISE EXCEPTION 'Bill changed. Refresh.' USING ERRCODE = '40001';
    END IF;
    IF current_row.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'A cancelled bill cannot be edited.' USING ERRCODE = '22023';
    END IF;
    IF p_vendor_id IS NOT NULL AND p_vendor_id <> current_row.vendor_id THEN
      RAISE EXCEPTION 'A bill cannot move to another vendor.' USING ERRCODE = '22023';
    END IF;
    IF private.vendor_bill_paid(p_society_id, current_row.id) > 0 THEN
      RAISE EXCEPTION 'A bill with linked payments cannot be edited.' USING ERRCODE = '22023';
    END IF;
    target_vendor_id := current_row.vendor_id;
    terms := current_row.effective_terms_days;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_bills
    WHERE society_id = p_society_id AND vendor_id = target_vendor_id
      AND lower(invoice_number) = lower(clean_invoice) AND cancelled_at IS NULL
      AND id IS DISTINCT FROM p_bill_id
  ) THEN
    RAISE EXCEPTION 'This vendor already has a bill with that invoice number.' USING ERRCODE = '23505';
  END IF;

  IF p_bill_id IS NULL THEN
    INSERT INTO public.vendor_bills (
      society_id, vendor_id, invoice_number, invoice_date, amount_paise, effective_terms_days,
      due_date, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, target_vendor_id, clean_invoice, p_invoice_date, p_amount_paise, terms,
      p_invoice_date + terms, p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO new_row;
    PERFORM private.vendor_audit_change(
      p_society_id, 'bill.create', 'vendor_bill', new_row.id, NULL,
      to_jsonb(new_row) - 'client_request_id', NULL, p_request_id
    );
  ELSE
    UPDATE public.vendor_bills SET
      invoice_number = clean_invoice,
      invoice_date = p_invoice_date,
      amount_paise = p_amount_paise,
      due_date = p_invoice_date + current_row.effective_terms_days,
      version = current_row.version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = current_row.id
    RETURNING * INTO new_row;
    PERFORM private.vendor_audit_change(
      p_society_id, 'bill.update', 'vendor_bill', new_row.id,
      to_jsonb(current_row) - 'client_request_id', to_jsonb(new_row) - 'client_request_id',
      NULL, p_request_id
    );
  END IF;
  RETURN new_row.id;
END;
$$;

CREATE FUNCTION public.vendor_bill_cancel(
  p_society_id uuid,
  p_bill_id uuid,
  p_reason text,
  p_expected_version integer,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vendor_bills;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  clean_reason := private.vendor_clean_text(p_reason, 500, 'a cancellation reason', true);
  SELECT * INTO current_row FROM public.vendor_bills
  WHERE society_id = p_society_id AND id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Bill changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF current_row.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is already cancelled.' USING ERRCODE = '22023';
  END IF;
  IF private.vendor_bill_paid(p_society_id, current_row.id) > 0 THEN
    RAISE EXCEPTION 'A bill with linked payments cannot be cancelled.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vendor_bills SET
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancel_reason = clean_reason,
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id;

  PERFORM private.vendor_audit_change(
    p_society_id, 'bill.cancel', 'vendor_bill', current_row.id,
    jsonb_build_object('cancelled', false), jsonb_build_object('cancelled', true),
    clean_reason, p_request_id
  );
END;
$$;

CREATE FUNCTION public.vendor_bill_payment_link(
  p_society_id uuid,
  p_bill_id uuid,
  p_entry_id uuid,
  p_amount_paise bigint,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bill public.vendor_bills;
  entry public.expense_book_entries;
  expense_status text;
  existing_id uuid;
  outstanding bigint;
  unlinked bigint;
  new_id uuid;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO existing_id FROM public.vendor_bill_payments
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a valid payment amount.' USING ERRCODE = '22023';
  END IF;

  -- The book lock blocks a concurrent reversal; the bill lock blocks concurrent links.
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO bill FROM public.vendor_bills
  WHERE society_id = p_society_id AND id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found.' USING ERRCODE = 'P0002';
  END IF;
  IF bill.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'A cancelled bill cannot take payments.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO entry FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash-book entry not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT expense.status INTO expense_status FROM public.expenses AS expense
  WHERE expense.society_id = p_society_id AND expense.id = entry.expense_id;
  IF entry.direction <> 'out' OR entry.source <> 'expense'
    OR expense_status IS DISTINCT FROM 'posted'
    OR private.vendor_entry_reversed(p_society_id, entry.id) THEN
    RAISE EXCEPTION 'Choose an unreversed money-out entry from a posted expense.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendor_bill_payments
    WHERE society_id = p_society_id AND bill_id = bill.id AND entry_id = entry.id
      AND unlinked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This entry is already linked to the bill.' USING ERRCODE = '23505';
  END IF;

  outstanding := bill.amount_paise - private.vendor_bill_paid(p_society_id, bill.id);
  IF p_amount_paise > outstanding THEN
    RAISE EXCEPTION 'The amount is more than the bill''s outstanding balance.' USING ERRCODE = '22023';
  END IF;
  unlinked := entry.amount_paise - private.vendor_entry_linked(p_society_id, entry.id);
  IF p_amount_paise > unlinked THEN
    RAISE EXCEPTION 'The amount is more than the entry''s unlinked balance.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vendor_bill_payments (
    society_id, bill_id, entry_id, amount_paise, client_request_id, created_by
  ) VALUES (
    p_society_id, bill.id, entry.id, p_amount_paise, p_client_request_id, auth.uid()
  ) RETURNING id INTO new_id;

  PERFORM private.vendor_audit_change(
    p_society_id, 'bill.payment_link', 'vendor_bill', bill.id, NULL,
    jsonb_build_object('payment_id', new_id, 'entry_id', entry.id, 'amount_paise', p_amount_paise),
    NULL, p_request_id
  );
  RETURN new_id;
END;
$$;

CREATE FUNCTION public.vendor_bill_payment_unlink(
  p_society_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  link public.vendor_bill_payments;
  bill public.vendor_bills;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']);
  clean_reason := private.vendor_clean_text(p_reason, 500, 'an unlink reason', true);

  -- Same lock order as linking: books, then bill, then the payment row.
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO link FROM public.vendor_bill_payments
  WHERE society_id = p_society_id AND id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment link not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO bill FROM public.vendor_bills
  WHERE society_id = p_society_id AND id = link.bill_id FOR UPDATE;
  SELECT * INTO link FROM public.vendor_bill_payments
  WHERE society_id = p_society_id AND id = p_payment_id FOR UPDATE;
  IF link.unlinked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This payment is already unlinked.' USING ERRCODE = '22023';
  END IF;
  IF bill.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'A cancelled bill cannot change.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vendor_bill_payments SET
    unlinked_at = now(),
    unlinked_by = auth.uid(),
    unlink_reason = clean_reason
  WHERE id = link.id;
  UPDATE public.vendor_bills SET
    version = bill.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = bill.id;

  PERFORM private.vendor_audit_change(
    p_society_id, 'bill.payment_unlink', 'vendor_bill', bill.id,
    jsonb_build_object('payment_id', link.id, 'entry_id', link.entry_id,
      'amount_paise', link.amount_paise, 'linked', true),
    jsonb_build_object('payment_id', link.id, 'entry_id', link.entry_id,
      'amount_paise', link.amount_paise, 'linked', false),
    clean_reason, p_request_id
  );
END;
$$;

CREATE FUNCTION public.vendor_bills_get(p_society_id uuid, p_vendor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_today date;
  is_admin boolean;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  local_today := private.housekeeping_local_date(p_society_id);
  is_admin := private.vendor_is_admin(p_society_id);
  RETURN jsonb_build_object(
    'today', local_today,
    'can_manage', is_admin,
    'bills', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', bill.id,
          'vendor_id', bill.vendor_id,
          'vendor_name', vendor.name,
          'invoice_number', bill.invoice_number,
          'invoice_date', bill.invoice_date,
          'amount_paise', bill.amount_paise,
          'effective_terms_days', bill.effective_terms_days,
          'due_date', bill.due_date,
          'paid_paise', totals.paid_paise,
          'outstanding_paise', bill.amount_paise - totals.paid_paise,
          'payment_status', CASE
            WHEN totals.paid_paise >= bill.amount_paise THEN 'paid'
            WHEN totals.paid_paise > 0 THEN 'partly_paid'
            ELSE 'pending'
          END,
          'due_state', CASE
            WHEN bill.cancelled_at IS NOT NULL OR totals.paid_paise >= bill.amount_paise THEN NULL
            WHEN local_today > bill.due_date THEN 'overdue'
            WHEN local_today >= bill.due_date - 6 THEN 'due_soon'
          END,
          'cancelled_at', bill.cancelled_at,
          'cancel_reason', bill.cancel_reason,
          'cancelled_by_name', private.vendor_person(bill.cancelled_by),
          'version', bill.version,
          'created_at', bill.created_at,
          'created_by_name', private.vendor_person(bill.created_by),
          'updated_at', bill.updated_at,
          'payments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', link.id,
                'entry_id', link.entry_id,
                'amount_paise', link.amount_paise,
                'counting', link.unlinked_at IS NULL
                  AND NOT private.vendor_entry_reversed(link.society_id, link.entry_id),
                'unlinked_at', link.unlinked_at,
                'unlink_reason', link.unlink_reason,
                'unlinked_by_name', private.vendor_person(link.unlinked_by),
                'entry_date', entry.entry_date,
                'payee', entry.counterparty,
                'reference', entry.reference,
                'entry_amount_paise', entry.amount_paise,
                'created_at', link.created_at
              ) ORDER BY entry.entry_date, link.created_at)
            FROM public.vendor_bill_payments AS link
            JOIN public.expense_book_entries AS entry
              ON entry.society_id = link.society_id AND entry.id = link.entry_id
            WHERE link.society_id = bill.society_id AND link.bill_id = bill.id
          ), '[]'::jsonb)
        ) ORDER BY bill.due_date DESC, bill.created_at DESC)
      FROM public.vendor_bills AS bill
      JOIN public.vendors AS vendor
        ON vendor.society_id = bill.society_id AND vendor.id = bill.vendor_id
      CROSS JOIN LATERAL (
        SELECT private.vendor_bill_paid(bill.society_id, bill.id) AS paid_paise
      ) AS totals
      WHERE bill.society_id = p_society_id
        AND (p_vendor_id IS NULL OR bill.vendor_id = p_vendor_id)
    ), '[]'::jsonb),
    'linkable_entries', CASE WHEN NOT is_admin THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', candidate.id,
          'entry_date', candidate.entry_date,
          'amount_paise', candidate.amount_paise,
          'unlinked_paise', candidate.unlinked_paise,
          'payee', candidate.counterparty,
          'reference', candidate.reference,
          'description', candidate.description
        ) ORDER BY candidate.entry_date DESC, candidate.created_at DESC)
      FROM (
        SELECT entry.*, entry.amount_paise
          - private.vendor_entry_linked(entry.society_id, entry.id) AS unlinked_paise
        FROM public.expense_book_entries AS entry
        JOIN public.expenses AS expense
          ON expense.society_id = entry.society_id AND expense.id = entry.expense_id
        WHERE entry.society_id = p_society_id AND entry.direction = 'out'
          AND entry.source = 'expense' AND expense.status = 'posted'
          AND NOT private.vendor_entry_reversed(entry.society_id, entry.id)
          AND entry.amount_paise > private.vendor_entry_linked(entry.society_id, entry.id)
        ORDER BY entry.entry_date DESC, entry.created_at DESC
        LIMIT 200
      ) AS candidate
    ), '[]'::jsonb) END
  );
END;
$$;

REVOKE ALL ON FUNCTION
  private.vendor_entry_reversed(uuid, uuid),
  private.vendor_bill_paid(uuid, uuid),
  private.vendor_entry_linked(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.vendor_bill_save(uuid, uuid, uuid, text, date, bigint, integer, uuid, text),
  public.vendor_bill_cancel(uuid, uuid, text, integer, text),
  public.vendor_bill_payment_link(uuid, uuid, uuid, bigint, uuid, text),
  public.vendor_bill_payment_unlink(uuid, uuid, text, text),
  public.vendor_bills_get(uuid, uuid)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.vendor_bill_save(uuid, uuid, uuid, text, date, bigint, integer, uuid, text),
  public.vendor_bill_cancel(uuid, uuid, text, integer, text),
  public.vendor_bill_payment_link(uuid, uuid, uuid, bigint, uuid, text),
  public.vendor_bill_payment_unlink(uuid, uuid, text, text),
  public.vendor_bills_get(uuid, uuid)
TO authenticated;

-- P47.8 vendor summary -----------------------------------------------------------

CREATE FUNCTION public.vendor_summary_get(p_society_id uuid, p_vendor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_today date;
  windows record;
  target_vendor_name text;
  amc_enabled boolean;
  result jsonb;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  local_today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO windows FROM private.vendor_expiry_windows(p_society_id);
  amc_enabled := private.module_enabled(p_society_id, 'amc');
  IF p_vendor_id IS NOT NULL THEN
    SELECT name INTO target_vendor_name FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  WITH general_due AS (
    SELECT count(*) AS total FROM public.vendor_contracts AS contract
    WHERE contract.society_id = p_society_id
      AND (p_vendor_id IS NULL OR contract.vendor_id = p_vendor_id)
      AND private.vendor_term_status(contract.start_date, contract.end_date, contract.terminated_on,
        local_today, windows.due_soon_days, windows.urgent_days) IN ('urgent', 'due_soon')
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_contracts AS successor
        WHERE successor.society_id = contract.society_id AND successor.predecessor_id = contract.id
      )
  ),
  amc_scope AS (
    SELECT amc.*, (
        SELECT max(visit.visit_date) FROM public.amc_visits AS visit
        WHERE visit.society_id = amc.society_id AND visit.contract_id = amc.id
      ) + round(365.0 / amc.services_per_year)::integer AS next_service_date,
      NOT EXISTS (
        SELECT 1 FROM public.amc_contracts AS successor
        WHERE successor.society_id = amc.society_id AND successor.predecessor_id = amc.id
      ) AS unrenewed
    FROM public.amc_contracts AS amc
    WHERE amc_enabled AND amc.society_id = p_society_id
      AND (target_vendor_name IS NULL
        OR lower(btrim(amc.vendor_name)) = lower(btrim(target_vendor_name)))
  ),
  bill_totals AS (
    SELECT bill.amount_paise - private.vendor_bill_paid(bill.society_id, bill.id) AS outstanding
    FROM public.vendor_bills AS bill
    WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
      AND (p_vendor_id IS NULL OR bill.vendor_id = p_vendor_id)
  )
  SELECT jsonb_build_object(
    'vendor_id', p_vendor_id,
    'active_vendors', CASE WHEN p_vendor_id IS NULL THEN (
      SELECT count(*) FROM public.vendors AS vendor
      WHERE vendor.society_id = p_society_id AND vendor.active AND NOT vendor.blacklisted
    ) END,
    'active_contract_value_paise', (
      SELECT COALESCE(sum(contract.annual_value_paise), 0) FROM public.vendor_contracts AS contract
      WHERE contract.society_id = p_society_id
        AND (p_vendor_id IS NULL OR contract.vendor_id = p_vendor_id)
        AND contract.terminated_on IS NULL
        AND contract.start_date <= local_today AND contract.end_date >= local_today
    ),
    'renewals_due', (SELECT total FROM general_due) + (
      SELECT count(*) FROM amc_scope
      WHERE unrenewed AND start_date <= local_today AND end_date >= local_today
        AND end_date <= local_today + windows.due_soon_days
    ),
    'renewals_due_general', (SELECT total FROM general_due),
    'renewals_due_amc', (
      SELECT count(*) FROM amc_scope
      WHERE unrenewed AND start_date <= local_today AND end_date >= local_today
        AND end_date <= local_today + windows.due_soon_days
    ),
    'rating_average', (
      SELECT round(avg(rating.stars), 1) FROM public.vendor_ratings AS rating
      WHERE rating.society_id = p_society_id
        AND (p_vendor_id IS NULL OR rating.vendor_id = p_vendor_id)
    ),
    'rating_count', (
      SELECT count(*) FROM public.vendor_ratings AS rating
      WHERE rating.society_id = p_society_id
        AND (p_vendor_id IS NULL OR rating.vendor_id = p_vendor_id)
    ),
    'open_work_orders', (
      SELECT count(*) FROM public.vendor_work_orders AS work_order
      WHERE work_order.society_id = p_society_id
        AND (p_vendor_id IS NULL OR work_order.vendor_id = p_vendor_id)
        AND work_order.status IN ('issued', 'in_progress')
    ),
    'overdue_amc_services', (
      SELECT count(*) FROM amc_scope
      WHERE next_service_date < local_today AND end_date >= local_today
    ),
    'bills_owed_paise', (SELECT COALESCE(sum(outstanding), 0) FROM bill_totals WHERE outstanding > 0),
    'bills_owed_count', (SELECT count(*) FROM bill_totals WHERE outstanding > 0)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_summary_get(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_summary_get(uuid, uuid) TO authenticated;

-- Analytics: AMC renewal bands follow the society's Urgent and Due Soon windows ----

CREATE OR REPLACE FUNCTION private.analytics_catalogue()
RETURNS TABLE (metric_key text, module_key text, sort_position integer, default_on boolean, money boolean)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT catalogue.metric_key, catalogue.module_key, catalogue.sort_position, catalogue.default_on, catalogue.money
  FROM (VALUES
    ('core.occupancy', 'core', 1, false, false),
    ('core.members_trend', 'core', 2, false, false),
    ('billing.dues_ageing', 'billing', 3, true, false),
    ('billing.collection_trend', 'billing', 4, true, true),
    ('billing.collection_rate', 'billing', 5, false, true),
    ('expense.income_vs_expense', 'expense', 6, true, true),
    ('expense.by_category', 'expense', 7, false, true),
    ('service_request.sla', 'service_request', 8, true, false),
    ('service_request.open_by_category', 'service_request', 9, false, false),
    ('service_request.resolution_time', 'service_request', 10, false, false),
    ('amenity.usage', 'amenity', 11, true, false),
    ('amenity.cancellations', 'amenity', 12, false, false),
    ('visitor.trend', 'visitor', 13, true, false),
    ('visitor.peak_hours', 'visitor', 14, false, false),
    ('delivery.trend', 'delivery', 15, false, false),
    ('delivery.uncollected', 'delivery', 16, false, false),
    ('staff.attendance_rate', 'staff', 17, false, false),
    ('staff.active_by_type', 'staff', 18, false, false),
    ('housekeeping.consumption', 'housekeeping', 19, false, false),
    ('housekeeping.low_stock', 'housekeeping', 20, false, false),
    ('amc.expiring', 'amc', 21, false, false),
    ('amc.expiry_bands', 'amc', 22, false, false),
    ('amc.visits', 'amc', 23, false, false),
    ('notice.published', 'notice', 24, false, false),
    ('notice.read_rate', 'notice', 25, false, false),
    ('directory.vehicles', 'directory', 26, false, false),
    ('directory.pending_verification', 'directory', 27, false, false),
    ('tenancy.moves', 'tenancy', 28, false, false),
    ('tenancy.pending', 'tenancy', 29, false, false),
    ('document.published', 'document', 30, false, false),
    ('document.downloads', 'document', 31, false, false),
    ('parking.occupancy', 'parking', 32, false, false),
    ('parking.reports', 'parking', 33, false, false),
    ('sos.alerts', 'sos', 34, false, false),
    ('sos.response_time', 'sos', 35, false, false),
    ('vendor.requests', 'vendor', 36, false, false),
    ('vendor.approved_spend', 'vendor', 37, false, true),
    ('patrol.completion', 'patrol', 38, false, false),
    ('patrol.incidents', 'patrol', 39, false, false),
    ('metering.consumption', 'metering', 40, false, false),
    ('metering.pending_readings', 'metering', 41, false, false),
    ('asset.by_category', 'asset', 42, false, false),
    ('asset.warranty_expiring', 'asset', 43, false, false),
    ('home_services.providers', 'home_services', 44, false, false),
    ('home_services.ratings', 'home_services', 45, false, false),
    ('poll.completed', 'poll', 46, false, false),
    ('poll.turnout', 'poll', 47, false, false),
    ('meeting.held', 'meeting', 48, false, false),
    ('meeting.attendance', 'meeting', 49, false, false),
    ('meeting.actions', 'meeting', 50, false, false)
  ) AS catalogue (metric_key, module_key, sort_position, default_on, money)
$$;
REVOKE ALL ON FUNCTION private.analytics_catalogue() FROM PUBLIC, anon, authenticated, service_role;

-- Started, unexpired, unrenewed AMC contracts inside the Urgent window and the rest of Due Soon.
CREATE FUNCTION private.analytics_metric_amc_expiry_bands(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH today AS (SELECT private.analytics_today(p_society_id) AS day),
  windows AS (
    SELECT
      COALESCE(max((config.settings ->> 'due_soon_days')::integer), 60) AS due_soon_days,
      COALESCE(max((config.settings ->> 'urgent_days')::integer), 30) AS urgent_days
    FROM public.module_configs AS config
    WHERE config.society_id = p_society_id AND config.module_key = 'amc'
  )
  SELECT private.analytics_ops_stat('count',
    '[{"key":"urgent","label":"Urgent"},{"key":"due_soon","label":"Due Soon"}]',
    jsonb_build_object(
      'urgent', count(*) FILTER (WHERE contract.end_date <= today.day + windows.urgent_days),
      'due_soon', count(*) FILTER (WHERE contract.end_date > today.day + windows.urgent_days)
    ))
  FROM public.amc_contracts AS contract CROSS JOIN today CROSS JOIN windows
  WHERE contract.society_id = p_society_id
    AND contract.start_date <= today.day
    AND contract.end_date >= today.day
    AND contract.end_date <= today.day + windows.due_soon_days
    AND NOT EXISTS (
      SELECT 1 FROM public.amc_contracts AS successor
      WHERE successor.society_id = p_society_id AND successor.predecessor_id = contract.id
    )
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_amc_expiry_bands(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
