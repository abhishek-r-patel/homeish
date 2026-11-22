-- Add P41 read-only financial reports, audit tracking and AGM report drafts.
ALTER TABLE public.module_configs
  DROP CONSTRAINT module_configs_expense_settings_check;

CREATE OR REPLACE FUNCTION private.expense_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_settings) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_settings) AS key
    WHERE key NOT IN (
      'approval_threshold_paise', 'billing_income_account_id',
      'agm_report_sections'
    )
  ) THEN
    RETURN false;
  END IF;
  IF p_settings ? 'approval_threshold_paise' AND (
    jsonb_typeof(p_settings -> 'approval_threshold_paise') <> 'number'
    OR (p_settings ->> 'approval_threshold_paise') !~ '^[0-9]{1,15}$'
  ) THEN
    RETURN false;
  END IF;
  IF p_settings ? 'billing_income_account_id'
    AND jsonb_typeof(p_settings -> 'billing_income_account_id') <> 'null'
    AND (
      jsonb_typeof(p_settings -> 'billing_income_account_id') <> 'string'
      OR (p_settings ->> 'billing_income_account_id')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  THEN
    RETURN false;
  END IF;
  IF p_settings ? 'agm_report_sections' THEN
    IF jsonb_typeof(p_settings -> 'agm_report_sections') <> 'object'
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_settings -> 'agm_report_sections') AS key
        WHERE key NOT IN (
          'finances', 'comparison', 'funds', 'audit', 'position', 'written'
        )
      )
      OR NOT ((p_settings -> 'agm_report_sections') ?& ARRAY[
        'finances', 'comparison', 'funds', 'audit', 'position', 'written'
      ])
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(p_settings -> 'agm_report_sections') AS setting
        WHERE jsonb_typeof(setting.value) <> 'boolean'
      )
    THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$$;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_expense_settings_check
  CHECK (module_key <> 'expense' OR private.expense_settings_valid(settings));

CREATE OR REPLACE FUNCTION public.expense_settings_update(
  p_society_id uuid,
  p_approval_threshold_paise bigint,
  p_billing_income_account_id uuid,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    WHERE society_id = p_society_id AND id = p_billing_income_account_id
      AND active AND account_type = 'bank'
  ) THEN
    RAISE EXCEPTION 'Choose an active bank account.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense' FOR UPDATE;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Expense settings changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  next_settings := jsonb_build_object(
    'approval_threshold_paise', p_approval_threshold_paise,
    'billing_income_account_id', p_billing_income_account_id
  );
  IF previous.settings ? 'agm_report_sections' THEN
    next_settings := next_settings || jsonb_build_object(
      'agm_report_sections', previous.settings -> 'agm_report_sections'
    );
  END IF;
  IF next_settings = previous.settings THEN
    RETURN jsonb_build_object('updated_at', previous.updated_at);
  END IF;
  UPDATE public.module_configs SET settings = next_settings, updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'expense'
  RETURNING * INTO saved;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.settings.update', 'module_config',
    'expense', jsonb_build_object('settings', previous.settings),
    jsonb_build_object('settings', saved.settings), p_request_trace
  );
  RETURN jsonb_build_object('updated_at', saved.updated_at);
END;
$$;

CREATE TABLE public.expense_audit_acknowledgements (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  warning_acknowledged_text text NOT NULL
    CHECK (char_length(warning_acknowledged_text) BETWEEN 1 AND 2000),
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  acknowledged_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id, acknowledged_by, client_request_id)
);

CREATE TABLE public.expense_audit_years (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  financial_year_start date NOT NULL
    CHECK (extract(month FROM financial_year_start) = 4
      AND extract(day FROM financial_year_start) = 1),
  auditor_name text NOT NULL
    CHECK (auditor_name = btrim(auditor_name) AND char_length(auditor_name) BETWEEN 1 AND 120),
  auditor_firm text NOT NULL
    CHECK (auditor_firm = btrim(auditor_firm) AND char_length(auditor_firm) BETWEEN 1 AND 160),
  appointed_on date NOT NULL,
  appointment_reference text
    CHECK (appointment_reference = btrim(appointment_reference)
      AND char_length(appointment_reference) BETWEEN 1 AND 160),
  appointment_document_id uuid,
  report_received_on date,
  placed_before_agm_on date,
  filed_on date,
  opinion text CHECK (opinion IN (
    'unmodified', 'qualified', 'adverse', 'disclaimer', 'other'
  )),
  opinion_text text
    CHECK (opinion_text = btrim(opinion_text) AND char_length(opinion_text) BETWEEN 1 AND 4000),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_years_document_fkey
    FOREIGN KEY (society_id, appointment_document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_years_source_check
    CHECK (appointment_reference IS NOT NULL OR appointment_document_id IS NOT NULL),
  CONSTRAINT expense_audit_years_dates_check CHECK (
    report_received_on IS NULL OR report_received_on >= appointed_on
  ),
  CONSTRAINT expense_audit_years_opinion_pair_check CHECK (
    opinion IS NULL AND opinion_text IS NULL OR
    opinion IS NOT NULL AND opinion_text IS NOT NULL
  ),
  UNIQUE (society_id, financial_year_start),
  UNIQUE (society_id, id)
);

CREATE TABLE public.expense_audit_queries (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  audit_year_id uuid NOT NULL,
  query_number integer NOT NULL CHECK (query_number BETWEEN 1 AND 999999),
  query_date date NOT NULL,
  area text NOT NULL
    CHECK (area = btrim(area) AND char_length(area) BETWEEN 1 AND 120),
  question text NOT NULL
    CHECK (question = btrim(question) AND char_length(question) BETWEEN 1 AND 4000),
  assignee_user_id uuid NOT NULL,
  due_date date NOT NULL CHECK (due_date >= query_date),
  response text
    CHECK (response = btrim(response) AND char_length(response) BETWEEN 1 AND 4000),
  response_date date,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_queries_year_fkey
    FOREIGN KEY (society_id, audit_year_id)
    REFERENCES public.expense_audit_years (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_queries_assignee_fkey
    FOREIGN KEY (society_id, assignee_user_id)
    REFERENCES public.memberships (society_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_queries_response_pair_check CHECK (
    response IS NULL AND response_date IS NULL OR
    response IS NOT NULL AND response_date IS NOT NULL
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, audit_year_id, query_number)
);

CREATE TABLE public.expense_audit_objections (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  audit_year_id uuid NOT NULL,
  description text NOT NULL
    CHECK (description = btrim(description) AND char_length(description) BETWEEN 1 AND 4000),
  owner_user_id uuid NOT NULL,
  due_date date NOT NULL,
  correction_note text
    CHECK (correction_note = btrim(correction_note)
      AND char_length(correction_note) BETWEEN 1 AND 4000),
  corrected_on date,
  evidence_document_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_objections_year_fkey
    FOREIGN KEY (society_id, audit_year_id)
    REFERENCES public.expense_audit_years (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_objections_owner_fkey
    FOREIGN KEY (society_id, owner_user_id)
    REFERENCES public.memberships (society_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_objections_document_fkey
    FOREIGN KEY (society_id, evidence_document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_audit_objections_resolution_check CHECK (
    correction_note IS NULL AND corrected_on IS NULL OR
    correction_note IS NOT NULL AND corrected_on IS NOT NULL
  ),
  UNIQUE (society_id, id)
);

CREATE TABLE public.expense_audit_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  entity_type text NOT NULL
    CHECK (entity_type IN ('audit_year', 'query', 'objection', 'agm_draft')),
  entity_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  before_data jsonb,
  after_data jsonb NOT NULL CHECK (jsonb_typeof(after_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id, entity_type, entity_id, revision_number),
  UNIQUE (society_id, created_by, client_request_id)
);

CREATE TABLE public.expense_agm_drafts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  financial_year_start date NOT NULL
    CHECK (extract(month FROM financial_year_start) = 4
      AND extract(day FROM financial_year_start) = 1),
  written_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  UNIQUE (society_id, financial_year_start),
  UNIQUE (society_id, id)
);

CREATE INDEX expense_audit_years_society_year_idx
  ON public.expense_audit_years (society_id, financial_year_start);
CREATE INDEX expense_audit_queries_year_idx
  ON public.expense_audit_queries (society_id, audit_year_id, query_date);
CREATE INDEX expense_audit_queries_assignee_idx
  ON public.expense_audit_queries (society_id, assignee_user_id, due_date);
CREATE INDEX expense_audit_objections_year_idx
  ON public.expense_audit_objections (society_id, audit_year_id, due_date);
CREATE INDEX expense_audit_objections_owner_idx
  ON public.expense_audit_objections (society_id, owner_user_id, due_date);
CREATE INDEX expense_audit_revisions_entity_idx
  ON public.expense_audit_revisions (society_id, entity_type, entity_id, revision_number);
CREATE INDEX expense_agm_drafts_society_year_idx
  ON public.expense_agm_drafts (society_id, financial_year_start);
CREATE TRIGGER expense_audit_years_set_updated_at
  BEFORE UPDATE ON public.expense_audit_years
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER expense_audit_queries_set_updated_at
  BEFORE UPDATE ON public.expense_audit_queries
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER expense_audit_objections_set_updated_at
  BEFORE UPDATE ON public.expense_audit_objections
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER expense_agm_drafts_set_updated_at
  BEFORE UPDATE ON public.expense_agm_drafts
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.expense_audit_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_agm_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.expense_audit_acknowledgements,
  public.expense_audit_years,
  public.expense_audit_queries,
  public.expense_audit_objections,
  public.expense_audit_revisions,
  public.expense_agm_drafts
  FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY expense_audit_acknowledgements_no_direct_access
  ON public.expense_audit_acknowledgements FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_audit_years_no_direct_access
  ON public.expense_audit_years FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_audit_queries_no_direct_access
  ON public.expense_audit_queries FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_audit_objections_no_direct_access
  ON public.expense_audit_objections FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_audit_revisions_no_direct_access
  ON public.expense_audit_revisions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_agm_drafts_no_direct_access
  ON public.expense_agm_drafts FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.expense_report_record_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'P41 report records are permanent.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.expense_report_record_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_audit_acknowledgements_guard
  BEFORE UPDATE OR DELETE ON public.expense_audit_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_acknowledgements_no_truncate
  BEFORE TRUNCATE ON public.expense_audit_acknowledgements
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_years_guard
  BEFORE DELETE ON public.expense_audit_years
  FOR EACH ROW EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_years_no_truncate
  BEFORE TRUNCATE ON public.expense_audit_years
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_queries_guard
  BEFORE DELETE ON public.expense_audit_queries
  FOR EACH ROW EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_queries_no_truncate
  BEFORE TRUNCATE ON public.expense_audit_queries
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_objections_guard
  BEFORE DELETE ON public.expense_audit_objections
  FOR EACH ROW EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_objections_no_truncate
  BEFORE TRUNCATE ON public.expense_audit_objections
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_revisions_guard
  BEFORE UPDATE OR DELETE ON public.expense_audit_revisions
  FOR EACH ROW EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_audit_revisions_no_truncate
  BEFORE TRUNCATE ON public.expense_audit_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_agm_drafts_guard
  BEFORE DELETE ON public.expense_agm_drafts
  FOR EACH ROW EXECUTE FUNCTION private.expense_report_record_guard();
CREATE TRIGGER expense_agm_drafts_no_truncate
  BEFORE TRUNCATE ON public.expense_agm_drafts
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_report_record_guard();

CREATE FUNCTION public.expense_statements(
  p_society_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
  books_started_on date;
  opening_paise bigint;
  added_paise bigint;
  closing_paise bigint;
  receipts_paise bigint;
  payments_paise bigint;
  average_expense_paise bigint;
  average_months integer;
  cash_cover numeric;
  prior_income numeric;
  prior_expense numeric;
  prior_from date;
  prior_to date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731 THEN
    RAISE EXCEPTION 'Choose a valid date range.' USING ERRCODE = '22023';
  END IF;
  today := private.housekeeping_local_date(p_society_id);
  SELECT min(opening_on) INTO books_started_on
  FROM public.expense_accounts WHERE society_id = p_society_id;
  SELECT COALESCE(sum(private.expense_balance(
    p_society_id, account.id, p_from - 1
  )), 0)::bigint INTO opening_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id AND account.opening_on < p_from;
  SELECT COALESCE(sum(account.opening_balance_paise), 0)::bigint INTO added_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id
    AND account.opening_on BETWEEN p_from AND p_to;
  SELECT COALESCE(sum(private.expense_balance(
    p_society_id, account.id, p_to
  )), 0)::bigint INTO closing_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id AND account.opening_on <= p_to;
  SELECT
    COALESCE(sum(CASE WHEN entry.category_id IS NULL
      THEN CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END
      ELSE 0 END), 0)::bigint,
    COALESCE(sum(CASE WHEN entry.category_id IS NOT NULL
      THEN CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END
      ELSE 0 END), 0)::bigint
  INTO receipts_paise, payments_paise
  FROM public.expense_book_entries AS entry
  WHERE entry.society_id = p_society_id
    AND entry.entry_date BETWEEN p_from AND p_to
    AND entry.transfer_pair_id IS NULL;

  WITH metric_months AS (
    SELECT month::date
    FROM generate_series(
      greatest(
        date_trunc('month', books_started_on::timestamp),
        date_trunc('month', today::timestamp) - interval '12 months'
      ),
      date_trunc('month', today::timestamp) - interval '1 month',
      interval '1 month'
    ) AS month
    WHERE books_started_on IS NOT NULL
  ),
  metric_amounts AS (
    SELECT month.month,
      COALESCE(sum(CASE entry.direction
        WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END), 0) AS amount
    FROM metric_months AS month
    LEFT JOIN public.expense_book_entries AS entry
      ON entry.society_id = p_society_id
      AND entry.category_id IS NOT NULL
      AND entry.transfer_pair_id IS NULL
      AND entry.entry_date >= month.month
      AND entry.entry_date < (month.month + interval '1 month')::date
    GROUP BY month.month
  )
  SELECT
    CASE WHEN count(*) > 0 THEN round(avg(amount))::bigint ELSE 0 END,
    count(*)::integer
  INTO average_expense_paise, average_months
  FROM metric_amounts;

  SELECT CASE WHEN average_expense_paise = 0 THEN NULL ELSE round(
    (
      SELECT COALESCE(sum(private.expense_balance(
        p_society_id, account.id, today
      )), 0)
      FROM public.expense_accounts AS account
      WHERE account.society_id = p_society_id
        AND account.account_type IN ('cash', 'bank')
    )::numeric / average_expense_paise::numeric, 2
  ) END INTO cash_cover;

  prior_from := p_from - interval '1 year';
  prior_to := p_to - interval '1 year';
  SELECT COALESCE(sum(CASE WHEN category_id IS NULL
    THEN CASE direction WHEN 'in' THEN amount_paise ELSE -amount_paise END ELSE 0 END), 0),
    COALESCE(sum(CASE WHEN category_id IS NOT NULL
      THEN CASE direction WHEN 'out' THEN amount_paise ELSE -amount_paise END ELSE 0 END), 0)
  INTO prior_income, prior_expense
  FROM public.expense_book_entries
  WHERE society_id = p_society_id
    AND entry_date BETWEEN prior_from AND prior_to
    AND transfer_pair_id IS NULL;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'opening_money_paise', opening_paise,
    'accounts_added_opening_paise', added_paise,
    'receipts_paise', receipts_paise,
    'payments_paise', payments_paise,
    'closing_money_paise', closing_paise,
    'identity_matches', (
      opening_paise + added_paise + receipts_paise - payments_paise = closing_paise
    ),
    'accounts_added', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'account', account.name,
        'account_type', account.account_type,
        'opening_on', account.opening_on,
        'opening_balance_paise', account.opening_balance_paise
      ) ORDER BY account.opening_on, lower(account.name))
      FROM public.expense_accounts AS account
      WHERE account.society_id = p_society_id
        AND account.opening_on BETWEEN p_from AND p_to
    ), '[]'::jsonb),
    'receipt_heads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', grouped.income_kind,
        'label', grouped.income_kind,
        'amount_paise', grouped.amount::bigint
      ) ORDER BY grouped.income_kind)
      FROM (
        SELECT CASE WHEN source = 'billing_payment'
            THEN 'billing' ELSE income_kind END AS income_kind,
          sum(CASE direction WHEN 'in' THEN amount_paise ELSE -amount_paise END) AS amount
        FROM public.expense_book_entries
        WHERE society_id = p_society_id
          AND entry_date BETWEEN p_from AND p_to
          AND category_id IS NULL
          AND transfer_pair_id IS NULL
        GROUP BY 1
      ) AS grouped
      WHERE grouped.income_kind IS NOT NULL
    ), '[]'::jsonb),
    'payment_heads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', grouped.category_id,
        'label', category.name,
        'amount_paise', grouped.amount::bigint
      ) ORDER BY lower(category.name))
      FROM (
        SELECT category_id,
          sum(CASE direction WHEN 'out' THEN amount_paise ELSE -amount_paise END) AS amount
        FROM public.expense_book_entries
        WHERE society_id = p_society_id
          AND entry_date BETWEEN p_from AND p_to
          AND category_id IS NOT NULL
          AND transfer_pair_id IS NULL
        GROUP BY category_id
      ) AS grouped
      JOIN public.expense_categories AS category
        ON category.society_id = p_society_id AND category.id = grouped.category_id
    ), '[]'::jsonb),
    'months', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', month.month::date,
        'heads', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'kind', CASE WHEN head.category_id IS NULL THEN 'receipt' ELSE 'payment' END,
            'key', CASE WHEN head.category_id IS NULL THEN head.income_kind ELSE head.category_id::text END,
            'label', CASE WHEN head.category_id IS NULL THEN head.income_kind ELSE category.name END,
            'amount_paise', head.amount::bigint
          ) ORDER BY head.kind, lower(CASE WHEN head.category_id IS NULL
            THEN head.income_kind ELSE category.name END))
          FROM (
            SELECT 1 AS kind, entry.category_id,
              CASE WHEN entry.source = 'billing_payment' THEN 'billing'
                ELSE entry.income_kind END AS income_kind,
              sum(CASE entry.direction WHEN 'in' THEN entry.amount_paise
                ELSE -entry.amount_paise END) AS amount
            FROM public.expense_book_entries AS entry
            WHERE entry.society_id = p_society_id
              AND entry.category_id IS NULL
              AND entry.transfer_pair_id IS NULL
              AND date_trunc('month', entry.entry_date)::date = month.month
            GROUP BY entry.category_id,
              CASE WHEN entry.source = 'billing_payment' THEN 'billing' ELSE entry.income_kind END
            UNION ALL
            SELECT 2 AS kind, entry.category_id, NULL::text,
              sum(CASE entry.direction WHEN 'out' THEN entry.amount_paise
                ELSE -entry.amount_paise END)
            FROM public.expense_book_entries AS entry
            WHERE entry.society_id = p_society_id
              AND entry.category_id IS NOT NULL
              AND entry.transfer_pair_id IS NULL
              AND date_trunc('month', entry.entry_date)::date = month.month
            GROUP BY entry.category_id
          ) AS head
          LEFT JOIN public.expense_categories AS category
            ON category.society_id = p_society_id
            AND category.id = head.category_id
          WHERE head.income_kind IS NOT NULL OR category.id IS NOT NULL
        ), '[]'::jsonb)
      ) ORDER BY month.month)
      FROM generate_series(
        date_trunc('month', p_from::timestamp)::date,
        date_trunc('month', p_to::timestamp)::date,
        interval '1 month'
      ) AS month
    ), '[]'::jsonb),
    'figures', jsonb_build_object(
      'average_monthly_expense_paise', average_expense_paise,
      'average_months', average_months,
      'cash_cover_months', cash_cover,
      'category_shares', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'category', grouped.label,
          'expense_paise', grouped.amount::bigint,
          'share_percent', CASE WHEN payments_paise > 0
            THEN round(grouped.amount::numeric / payments_paise * 100, 2)
            ELSE NULL END
        ) ORDER BY grouped.amount DESC, lower(grouped.label))
        FROM (
          SELECT category.name AS label,
            sum(CASE entry.direction WHEN 'out' THEN entry.amount_paise
              ELSE -entry.amount_paise END) AS amount
          FROM public.expense_book_entries AS entry
          JOIN public.expense_categories AS category
            ON category.society_id = entry.society_id
            AND category.id = entry.category_id
          WHERE entry.society_id = p_society_id
            AND entry.entry_date BETWEEN p_from AND p_to
            AND entry.transfer_pair_id IS NULL
          GROUP BY category.name
        ) AS grouped
      ), '[]'::jsonb),
      'comparison_from', prior_from,
      'comparison_to', prior_to,
      'income_change_percent', CASE
        WHEN books_started_on > prior_to OR prior_income <= 0 THEN NULL
        ELSE round((receipts_paise - prior_income) / prior_income * 100, 2)
      END,
      'expenditure_change_percent', CASE
        WHEN books_started_on > prior_to OR prior_expense <= 0 THEN NULL
        ELSE round((payments_paise - prior_expense) / prior_expense * 100, 2)
      END
    )
  );
END;
$$;

CREATE FUNCTION public.expense_financial_position(
  p_society_id uuid,
  p_as_of date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
  admin_view boolean;
  billing_enabled boolean;
  vendor_enabled boolean;
  funds_active boolean;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.housekeeping_local_date(p_society_id);
  IF p_as_of IS NULL OR p_as_of > today THEN
    RAISE EXCEPTION 'Choose today or an earlier date.' USING ERRCODE = '22023';
  END IF;
  admin_view := private.has_role(p_society_id, ARRAY['admin']::text[]);
  billing_enabled := private.module_enabled(p_society_id, 'billing');
  vendor_enabled := private.module_enabled(p_society_id, 'vendor');
  SELECT EXISTS (
    SELECT 1 FROM public.expense_fund_openings
    WHERE society_id = p_society_id AND cutover_on <= p_as_of
  ) INTO funds_active;
  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'billing_enabled', billing_enabled,
    'vendor_enabled', vendor_enabled,
    'funds_enabled', funds_active,
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', account.id,
        'account', account.name,
        'account_type', account.account_type,
        'active', account.active,
        'available', account.opening_on <= p_as_of,
        'balance_paise', CASE WHEN account.opening_on <= p_as_of
          THEN private.expense_balance(p_society_id, account.id, p_as_of) END
      ) ORDER BY account.account_type, lower(account.name))
      FROM public.expense_accounts AS account
      WHERE account.society_id = p_society_id
        AND account.account_type IN ('cash', 'bank')
    ), '[]'::jsonb),
    'accounts_total_paise', COALESCE((
      SELECT sum(private.expense_balance(p_society_id, account.id, p_as_of))::bigint
      FROM public.expense_accounts AS account
      WHERE account.society_id = p_society_id AND account.opening_on <= p_as_of
        AND account.account_type IN ('cash', 'bank')
    ), 0),
    'funds', CASE WHEN NOT funds_active THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fund', fund.name,
        'balance_paise', private.expense_fund_balance(
          p_society_id, fund.id, p_as_of
        )
      ) ORDER BY lower(fund.name))
      FROM public.expense_funds AS fund
      WHERE fund.society_id = p_society_id
    ), '[]'::jsonb) END,
    'unallocated_paise', CASE WHEN NOT funds_active THEN NULL ELSE
      private.expense_accounts_total(p_society_id, p_as_of) - COALESCE((
        SELECT sum(private.expense_fund_balance(
          p_society_id, fund.id, p_as_of
        ))
        FROM public.expense_funds AS fund
        WHERE fund.society_id = p_society_id
      ), 0)::bigint
    END,
    'member_dues_paise', CASE WHEN billing_enabled AND p_as_of = today THEN COALESCE((
      SELECT sum(bill.total_paise - bill.paid_paise - bill.waived_paise)::bigint
      FROM public.billing_bills AS bill
      WHERE bill.society_id = p_society_id
        AND bill.cancelled_at IS NULL
        AND bill.period_start <= p_as_of
    ), 0) END,
    'vendor_bills_paise', CASE WHEN vendor_enabled AND p_as_of = today THEN COALESCE((
      SELECT sum(bill.amount_paise
        - private.vendor_bill_paid(bill.society_id, bill.id))::bigint
      FROM public.vendor_bills AS bill
      WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
    ), 0) END,
    'fixed_deposits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'bank_name', deposit.bank_name,
        'reference', CASE WHEN admin_view THEN deposit.reference END,
        'principal_paise', deposit.principal_paise,
        'account_balance_paise', CASE WHEN deposit.account_id IS NOT NULL
          AND account.opening_on <= p_as_of THEN private.expense_balance(
            p_society_id, deposit.account_id, p_as_of
          ) END,
        'maturity_on', deposit.maturity_on
      ) ORDER BY deposit.maturity_on, lower(deposit.bank_name))
      FROM public.expense_fixed_deposits AS deposit
      LEFT JOIN public.expense_accounts AS account
        ON account.society_id = deposit.society_id
        AND account.id = deposit.account_id
      WHERE deposit.society_id = p_society_id AND deposit.deposit_on <= p_as_of
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_multi_year(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
  current_start date;
  books_started_on date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.housekeeping_local_date(p_society_id);
  current_start := make_date(private.expense_financial_year(today), 4, 1);
  SELECT min(opening_on) INTO books_started_on
  FROM public.expense_accounts WHERE society_id = p_society_id;
  RETURN (
    WITH years AS (
      SELECT current_start - ((year_offset - 1) * interval '1 year')
          AS financial_year_start,
        year_offset = 1 AS is_current
      FROM generate_series(1, 5) AS offsets(year_offset)
    ),
    bounded_years AS (
      SELECT financial_year_start::date,
        is_current,
        (financial_year_start::date + interval '1 year' - interval '1 day')::date AS full_end,
        CASE WHEN is_current THEN today
          ELSE (financial_year_start::date + interval '1 year' - interval '1 day')::date
        END AS report_end,
        books_started_on IS NULL OR books_started_on >
          financial_year_start::date + interval '1 year' - interval '1 day'
          AS not_available,
        books_started_on IS NOT NULL
          AND books_started_on > financial_year_start::date
          AND books_started_on <= financial_year_start::date + interval '1 year' - interval '1 day'
          AS part_year
      FROM years
    ),
    heads AS (
      SELECT 'payment'::text AS kind, category.id::text AS key, category.name AS label
      FROM public.expense_categories AS category
      WHERE category.society_id = p_society_id
      UNION
      SELECT DISTINCT 'receipt', income_kind, income_kind
      FROM (
        SELECT CASE WHEN entry.source = 'billing_payment'
          THEN 'billing' ELSE entry.income_kind END AS income_kind
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id
          AND entry.category_id IS NULL
          AND entry.transfer_pair_id IS NULL
      ) AS income
      WHERE income_kind IS NOT NULL
      UNION
      SELECT 'receipt', kind, kind FROM unnest(ARRAY[
        'billing', 'donation', 'interest', 'other'
      ]) AS kind
    ),
    year_heads AS (
      SELECT year.financial_year_start, year.is_current, year.not_available,
        year.part_year, head.kind, head.key, head.label,
        CASE WHEN year.not_available THEN 0 ELSE COALESCE((
          SELECT sum(
            CASE WHEN head.kind = 'payment'
              THEN CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END
              ELSE CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END
            END
          ) FROM public.expense_book_entries AS entry
          WHERE entry.society_id = p_society_id
            AND entry.entry_date BETWEEN year.financial_year_start AND year.report_end
            AND entry.transfer_pair_id IS NULL
            AND CASE WHEN head.kind = 'payment'
              THEN entry.category_id::text = head.key
              ELSE entry.category_id IS NULL AND CASE
                WHEN entry.source = 'billing_payment' THEN 'billing'
                ELSE entry.income_kind END = head.key
            END
        ), 0) END::bigint AS amount_paise
      FROM bounded_years AS year
      CROSS JOIN heads AS head
    ),
    changed AS (
      SELECT current.*,
        previous.amount_paise AS previous_amount_paise,
        previous.not_available AS previous_not_available,
        previous.part_year AS previous_part_year
      FROM year_heads AS current
      LEFT JOIN year_heads AS previous
        ON previous.kind = current.kind
        AND previous.key = current.key
        AND previous.financial_year_start =
          current.financial_year_start - interval '1 year'
    )
    SELECT jsonb_build_object(
      'current_financial_year_start', current_start,
      'books_started_on', books_started_on,
      'years', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'financial_year_start', financial_year_start::date,
          'from', financial_year_start::date,
          'to', full_end::date,
          'report_end', report_end::date,
          'is_current', is_current,
          'not_available', not_available,
          'part_year', part_year,
          'income_paise', COALESCE((
            SELECT sum(amount_paise) FROM changed
            WHERE changed.financial_year_start = bounded_years.financial_year_start
              AND changed.kind = 'receipt'
          ), 0)::bigint,
          'expense_paise', COALESCE((
            SELECT sum(amount_paise) FROM changed
            WHERE changed.financial_year_start = bounded_years.financial_year_start
              AND changed.kind = 'payment'
          ), 0)::bigint,
          'heads', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'kind', row.kind,
              'key', row.key,
              'label', row.label,
              'amount_paise', row.amount_paise,
              'change_percent', CASE
                WHEN row.is_current OR row.not_available
                  OR row.previous_not_available OR row.previous_part_year
                  OR row.previous_amount_paise IS NULL
                  OR row.previous_amount_paise <= 0
                THEN NULL
                ELSE round(
                  (row.amount_paise - row.previous_amount_paise)::numeric
                  / row.previous_amount_paise * 100, 2
                )
              END
            ) ORDER BY row.kind, lower(row.label))
            FROM changed AS row
            WHERE row.financial_year_start = bounded_years.financial_year_start
          ), '[]'::jsonb)
        ) ORDER BY financial_year_start DESC)
        FROM bounded_years
      ), '[]'::jsonb)
    )
  );
END;
$$;

CREATE FUNCTION private.expense_audit_warning_on(p_society_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT acknowledged_at FROM public.expense_audit_acknowledgements
  WHERE society_id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.expense_audit_warning_on(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_audit_staff(p_society_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = p_user_id
      AND status = 'active'
      AND roles && ARRAY['admin', 'committee']::text[]
  )
$$;
REVOKE ALL ON FUNCTION private.expense_audit_staff(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_audit_warning_acknowledge(
  p_society_id uuid,
  p_acknowledged boolean,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  acknowledged timestamptz;
  warning_text constant text :=
    'The audit tracker and AGM draft do not replace an auditor, accountant or legal advice. They record society-entered facts and are not a statutory report, certification or submission.';
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF NOT p_acknowledged OR p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Acknowledge the audit and AGM warning.' USING ERRCODE = '22023';
  END IF;
  SELECT acknowledged_at INTO acknowledged
  FROM public.expense_audit_acknowledgements
  WHERE society_id = p_society_id;
  IF acknowledged IS NOT NULL THEN RETURN acknowledged; END IF;
  INSERT INTO public.expense_audit_acknowledgements (
    society_id, warning_acknowledged_text, acknowledged_by, client_request_id
  ) VALUES (
    p_society_id, warning_text, auth.uid(), p_client_request_id
  ) RETURNING acknowledged_at INTO acknowledged;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.audit_warning.acknowledge',
    'expense_audit_acknowledgement', p_society_id::text, NULL,
    jsonb_build_object('warning_acknowledged_text', warning_text),
    p_request_trace
  );
  RETURN acknowledged;
END;
$$;

CREATE FUNCTION private.expense_audit_checks(p_society_id uuid, p_year_start date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  year_end date;
  closed_count integer;
  old_unmatched integer;
  bad_deposits integer;
  cash_count_found boolean;
BEGIN
  IF p_year_start IS NULL THEN RETURN '[]'::jsonb; END IF;
  year_end := (p_year_start + interval '1 year' - interval '1 day')::date;
  SELECT count(*)::integer INTO closed_count
  FROM public.expense_month_locks
  WHERE society_id = p_society_id
    AND month BETWEEN p_year_start AND year_end;
  SELECT count(*)::integer INTO old_unmatched
  FROM public.expense_statement_items
  WHERE society_id = p_society_id AND status = 'unmatched'
    AND statement_date <= year_end
    AND statement_date < least(year_end, private.housekeeping_local_date(p_society_id)) - 30;
  SELECT count(*)::integer INTO bad_deposits
  FROM public.expense_fixed_deposits AS deposit
  WHERE deposit.society_id = p_society_id AND deposit.deposit_on <= year_end
    AND (
      deposit.account_id IS NULL OR deposit.principal_paise IS NULL OR
      private.expense_balance(p_society_id, deposit.account_id, year_end)
        <> deposit.principal_paise
    );
  SELECT EXISTS (
    SELECT 1 FROM public.expense_cash_counts
    WHERE society_id = p_society_id
      AND count_date BETWEEN (year_end - interval '6 days')::date
        AND (year_end + interval '7 days')::date
  ) INTO cash_count_found;
  RETURN jsonb_build_array(
    jsonb_build_object(
      'key', 'months_closed',
      'status', CASE WHEN closed_count = 12 THEN 'pass' ELSE 'attention' END,
      'detail', closed_count || ' of 12 months closed'
    ),
    jsonb_build_object(
      'key', 'bank_unmatched',
      'status', CASE WHEN old_unmatched = 0 THEN 'pass' ELSE 'attention' END,
      'detail', old_unmatched || ' bank statement items older than 30 days'
    ),
    jsonb_build_object(
      'key', 'fixed_deposits',
      'status', CASE WHEN bad_deposits = 0 THEN 'pass' ELSE 'attention' END,
      'detail', bad_deposits || ' deposits not linked or reconciled'
    ),
    jsonb_build_object(
      'key', 'petty_cash_count',
      'status', CASE WHEN cash_count_found THEN 'pass' ELSE 'attention' END,
      'detail', CASE WHEN cash_count_found
        THEN 'A petty-cash count is recorded from 25 March to 7 April'
        ELSE 'No petty-cash count is recorded from 25 March to 7 April' END
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION private.expense_audit_checks(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_audit_get(
  p_society_id uuid,
  p_financial_year_start date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  audit_year public.expense_audit_years;
  today date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_financial_year_start IS NULL
    OR extract(month FROM p_financial_year_start) <> 4
    OR extract(day FROM p_financial_year_start) <> 1
  THEN
    RAISE EXCEPTION 'Choose an April-to-March financial year.' USING ERRCODE = '22023';
  END IF;
  today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO audit_year FROM public.expense_audit_years
  WHERE society_id = p_society_id
    AND financial_year_start = p_financial_year_start;
  RETURN jsonb_build_object(
    'financial_year_start', p_financial_year_start,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'warning_acknowledged_at', private.expense_audit_warning_on(p_society_id),
    'year', CASE WHEN audit_year.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', audit_year.id,
      'auditor_name', audit_year.auditor_name,
      'auditor_firm', audit_year.auditor_firm,
      'appointed_on', audit_year.appointed_on,
      'appointment_reference', audit_year.appointment_reference,
      'appointment_document_id', audit_year.appointment_document_id,
      'report_received_on', audit_year.report_received_on,
      'placed_before_agm_on', audit_year.placed_before_agm_on,
      'filed_on', audit_year.filed_on,
      'opinion', audit_year.opinion,
      'opinion_text', audit_year.opinion_text,
      'version', audit_year.version,
      'updated_at', audit_year.updated_at
    ) END,
    'queries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', query.id,
        'query_number', query.query_number,
        'query_date', query.query_date,
        'area', query.area,
        'question', query.question,
        'assignee_user_id', query.assignee_user_id,
        'assignee_name', profile.full_name,
        'due_date', query.due_date,
        'response', query.response,
        'response_date', query.response_date,
        'status', CASE WHEN query.response IS NOT NULL THEN 'answered'
          WHEN query.due_date < today THEN 'overdue' ELSE 'open' END,
        'version', query.version,
        'updated_at', query.updated_at
      ) ORDER BY query.query_date, query.query_number)
      FROM public.expense_audit_queries AS query
      JOIN public.profiles AS profile ON profile.id = query.assignee_user_id
      WHERE query.society_id = p_society_id
        AND query.audit_year_id = audit_year.id
    ), '[]'::jsonb),
    'objections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', objection.id,
        'description', objection.description,
        'owner_user_id', objection.owner_user_id,
        'owner_name', profile.full_name,
        'due_date', objection.due_date,
        'correction_note', objection.correction_note,
        'corrected_on', objection.corrected_on,
        'evidence_document_id', objection.evidence_document_id,
        'status', CASE WHEN objection.correction_note IS NOT NULL THEN 'resolved'
          WHEN objection.due_date < today THEN 'overdue' ELSE 'open' END,
        'version', objection.version,
        'updated_at', objection.updated_at
      ) ORDER BY objection.due_date, objection.id)
      FROM public.expense_audit_objections AS objection
      JOIN public.profiles AS profile ON profile.id = objection.owner_user_id
      WHERE objection.society_id = p_society_id
        AND objection.audit_year_id = audit_year.id
    ), '[]'::jsonb),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id, 'full_name', profile.full_name
      ) ORDER BY lower(profile.full_name))
      FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND membership.roles && ARRAY['admin', 'committee']::text[]
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', document.id,
        'title', document.title
      ) ORDER BY lower(document.title), document.id)
      FROM public.documents AS document
      WHERE document.society_id = p_society_id
        AND document.archived_at IS NULL
        AND private.document_user_can_see(
          p_society_id, auth.uid(), document.id
        )
    ), '[]'::jsonb),
    'checks', private.expense_audit_checks(
      p_society_id, p_financial_year_start
    ),
    'revisions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', revision.id,
        'entity_type', revision.entity_type,
        'entity_id', revision.entity_id,
        'revision_number', revision.revision_number,
        'created_at', revision.created_at,
        'created_by_name', profile.full_name
      ) ORDER BY revision.created_at DESC, revision.id DESC)
      FROM public.expense_audit_revisions AS revision
      JOIN public.profiles AS profile ON profile.id = revision.created_by
      WHERE revision.society_id = p_society_id
        AND (
          revision.entity_id = audit_year.id
          OR revision.entity_id IN (
            SELECT id FROM public.expense_audit_queries
            WHERE society_id = p_society_id AND audit_year_id = audit_year.id
            UNION
            SELECT id FROM public.expense_audit_objections
            WHERE society_id = p_society_id AND audit_year_id = audit_year.id
          )
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_audit_year_save(
  p_society_id uuid,
  p_year_id uuid,
  p_financial_year_start date,
  p_auditor_name text,
  p_auditor_firm text,
  p_appointed_on date,
  p_appointment_reference text,
  p_appointment_document_id uuid,
  p_report_received_on date,
  p_placed_before_agm_on date,
  p_filed_on date,
  p_opinion text,
  p_opinion_text text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current public.expense_audit_years;
  saved public.expense_audit_years;
  idempotent_id uuid;
  clean_reference text := NULLIF(btrim(p_appointment_reference), '');
  clean_opinion text := NULLIF(btrim(p_opinion_text), '');
  next_revision integer;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF private.expense_audit_warning_on(p_society_id) IS NULL
    OR p_financial_year_start IS NULL
    OR extract(month FROM p_financial_year_start) <> 4
    OR extract(day FROM p_financial_year_start) <> 1
    OR btrim(p_auditor_name) = '' OR char_length(btrim(p_auditor_name)) > 120
    OR btrim(p_auditor_firm) = '' OR char_length(btrim(p_auditor_firm)) > 160
    OR p_appointed_on IS NULL
    OR (clean_reference IS NULL AND p_appointment_document_id IS NULL)
    OR char_length(clean_reference) > 160
    OR p_opinion IS DISTINCT FROM NULL
      AND p_opinion NOT IN ('unmodified', 'qualified', 'adverse', 'disclaimer', 'other')
    OR ((p_opinion IS NULL) <> (clean_opinion IS NULL))
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the audit year details and acknowledgement.'
      USING ERRCODE = '22023';
  END IF;
  IF p_appointment_document_id IS NOT NULL
    AND NOT private.document_user_can_see(
      p_society_id, auth.uid(), p_appointment_document_id
    )
  THEN
    RAISE EXCEPTION 'Choose a document you can access.' USING ERRCODE = '22023';
  END IF;
  SELECT entity_id INTO idempotent_id
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id
    AND entity_type = 'audit_year'
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF idempotent_id IS NOT NULL THEN RETURN idempotent_id; END IF;
  IF p_year_id IS NULL THEN
    INSERT INTO public.expense_audit_years (
      society_id, financial_year_start, auditor_name, auditor_firm,
      appointed_on, appointment_reference, appointment_document_id,
      report_received_on, placed_before_agm_on, filed_on, opinion,
      opinion_text, created_by, updated_by
    ) VALUES (
      p_society_id, p_financial_year_start, btrim(p_auditor_name),
      btrim(p_auditor_firm), p_appointed_on, clean_reference,
      p_appointment_document_id, p_report_received_on,
      p_placed_before_agm_on, p_filed_on, p_opinion, clean_opinion,
      auth.uid(), auth.uid()
    ) RETURNING * INTO saved;
  ELSE
    SELECT * INTO current FROM public.expense_audit_years
    WHERE society_id = p_society_id AND id = p_year_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audit year not found.' USING ERRCODE = 'P0002';
    END IF;
    IF current.version <> p_expected_version
      OR current.financial_year_start <> p_financial_year_start
    THEN
      RAISE EXCEPTION 'The audit year changed. Refresh before saving.'
        USING ERRCODE = '40001';
    END IF;
    UPDATE public.expense_audit_years SET
      auditor_name = btrim(p_auditor_name),
      auditor_firm = btrim(p_auditor_firm),
      appointed_on = p_appointed_on,
      appointment_reference = clean_reference,
      appointment_document_id = p_appointment_document_id,
      report_received_on = p_report_received_on,
      placed_before_agm_on = p_placed_before_agm_on,
      filed_on = p_filed_on,
      opinion = p_opinion,
      opinion_text = clean_opinion,
      version = version + 1
    WHERE society_id = p_society_id AND id = p_year_id
    RETURNING * INTO saved;
  END IF;
  SELECT COALESCE(max(revision_number), 0) + 1 INTO next_revision
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'audit_year'
    AND entity_id = saved.id;
  INSERT INTO public.expense_audit_revisions (
    society_id, entity_type, entity_id, revision_number, before_data,
    after_data, created_by, client_request_id
  ) VALUES (
    p_society_id, 'audit_year', saved.id, next_revision,
    CASE WHEN current.id IS NULL THEN NULL ELSE to_jsonb(current) END,
    to_jsonb(saved), auth.uid(), p_client_request_id
  );
  RETURN saved.id;
END;
$$;

CREATE FUNCTION public.expense_audit_query_save(
  p_society_id uuid,
  p_query_id uuid,
  p_audit_year_id uuid,
  p_query_number integer,
  p_query_date date,
  p_area text,
  p_question text,
  p_assignee_user_id uuid,
  p_due_date date,
  p_response text,
  p_response_date date,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current public.expense_audit_queries;
  saved public.expense_audit_queries;
  idempotent_id uuid;
  next_revision integer;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF private.expense_audit_warning_on(p_society_id) IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_audit_years
      WHERE society_id = p_society_id AND id = p_audit_year_id
    )
    OR p_query_number NOT BETWEEN 1 AND 999999
    OR p_query_date IS NULL OR p_due_date < p_query_date
    OR btrim(p_area) = '' OR char_length(btrim(p_area)) > 120
    OR btrim(p_question) = '' OR char_length(btrim(p_question)) > 4000
    OR NOT private.expense_audit_staff(p_society_id, p_assignee_user_id)
    OR ((NULLIF(btrim(p_response), '') IS NULL) <> (p_response_date IS NULL))
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the audit query details.' USING ERRCODE = '22023';
  END IF;
  SELECT entity_id INTO idempotent_id
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'query'
    AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF idempotent_id IS NOT NULL THEN RETURN idempotent_id; END IF;
  IF p_query_id IS NULL THEN
    INSERT INTO public.expense_audit_queries (
      society_id, audit_year_id, query_number, query_date, area, question,
      assignee_user_id, due_date, response, response_date, created_by, updated_by
    ) VALUES (
      p_society_id, p_audit_year_id, p_query_number, p_query_date,
      btrim(p_area), btrim(p_question), p_assignee_user_id, p_due_date,
      NULLIF(btrim(p_response), ''), p_response_date, auth.uid(), auth.uid()
    ) RETURNING * INTO saved;
  ELSE
    SELECT * INTO current FROM public.expense_audit_queries
    WHERE society_id = p_society_id AND id = p_query_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Audit query not found.' USING ERRCODE = 'P0002'; END IF;
    IF current.version <> p_expected_version
      OR current.audit_year_id <> p_audit_year_id
    THEN
      RAISE EXCEPTION 'The audit query changed. Refresh before saving.'
        USING ERRCODE = '40001';
    END IF;
    UPDATE public.expense_audit_queries SET
      query_number = p_query_number, query_date = p_query_date,
      area = btrim(p_area), question = btrim(p_question),
      assignee_user_id = p_assignee_user_id, due_date = p_due_date,
      response = NULLIF(btrim(p_response), ''), response_date = p_response_date,
      version = version + 1
    WHERE society_id = p_society_id AND id = p_query_id
    RETURNING * INTO saved;
  END IF;
  SELECT COALESCE(max(revision_number), 0) + 1 INTO next_revision
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'query' AND entity_id = saved.id;
  INSERT INTO public.expense_audit_revisions (
    society_id, entity_type, entity_id, revision_number, before_data,
    after_data, created_by, client_request_id
  ) VALUES (
    p_society_id, 'query', saved.id, next_revision,
    CASE WHEN current.id IS NULL THEN NULL ELSE to_jsonb(current) END,
    to_jsonb(saved), auth.uid(), p_client_request_id
  );
  RETURN saved.id;
END;
$$;

CREATE FUNCTION public.expense_audit_objection_save(
  p_society_id uuid,
  p_objection_id uuid,
  p_audit_year_id uuid,
  p_description text,
  p_owner_user_id uuid,
  p_due_date date,
  p_correction_note text,
  p_corrected_on date,
  p_evidence_document_id uuid,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current public.expense_audit_objections;
  saved public.expense_audit_objections;
  idempotent_id uuid;
  next_revision integer;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF private.expense_audit_warning_on(p_society_id) IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_audit_years
      WHERE society_id = p_society_id AND id = p_audit_year_id
    )
    OR btrim(p_description) = '' OR char_length(btrim(p_description)) > 4000
    OR NOT private.expense_audit_staff(p_society_id, p_owner_user_id)
    OR p_due_date IS NULL
    OR ((NULLIF(btrim(p_correction_note), '') IS NULL) <> (p_corrected_on IS NULL))
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the audit objection details.' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_document_id IS NOT NULL
    AND NOT private.document_user_can_see(
      p_society_id, auth.uid(), p_evidence_document_id
    )
  THEN
    RAISE EXCEPTION 'Choose an evidence document you can access.' USING ERRCODE = '22023';
  END IF;
  SELECT entity_id INTO idempotent_id
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'objection'
    AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF idempotent_id IS NOT NULL THEN RETURN idempotent_id; END IF;
  IF p_objection_id IS NULL THEN
    INSERT INTO public.expense_audit_objections (
      society_id, audit_year_id, description, owner_user_id, due_date,
      correction_note, corrected_on, evidence_document_id, created_by, updated_by
    ) VALUES (
      p_society_id, p_audit_year_id, btrim(p_description), p_owner_user_id,
      p_due_date, NULLIF(btrim(p_correction_note), ''), p_corrected_on,
      p_evidence_document_id, auth.uid(), auth.uid()
    ) RETURNING * INTO saved;
  ELSE
    SELECT * INTO current FROM public.expense_audit_objections
    WHERE society_id = p_society_id AND id = p_objection_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audit objection not found.' USING ERRCODE = 'P0002';
    END IF;
    IF current.version <> p_expected_version
      OR current.audit_year_id <> p_audit_year_id
    THEN
      RAISE EXCEPTION 'The audit objection changed. Refresh before saving.'
        USING ERRCODE = '40001';
    END IF;
    UPDATE public.expense_audit_objections SET
      description = btrim(p_description),
      owner_user_id = p_owner_user_id,
      due_date = p_due_date,
      correction_note = NULLIF(btrim(p_correction_note), ''),
      corrected_on = p_corrected_on,
      evidence_document_id = p_evidence_document_id,
      version = version + 1
    WHERE society_id = p_society_id AND id = p_objection_id
    RETURNING * INTO saved;
  END IF;
  SELECT COALESCE(max(revision_number), 0) + 1 INTO next_revision
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'objection'
    AND entity_id = saved.id;
  INSERT INTO public.expense_audit_revisions (
    society_id, entity_type, entity_id, revision_number, before_data,
    after_data, created_by, client_request_id
  ) VALUES (
    p_society_id, 'objection', saved.id, next_revision,
    CASE WHEN current.id IS NULL THEN NULL ELSE to_jsonb(current) END,
    to_jsonb(saved), auth.uid(), p_client_request_id
  );
  RETURN saved.id;
END;
$$;

CREATE FUNCTION public.expense_agm_draft(
  p_society_id uuid,
  p_financial_year_start date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  draft public.expense_agm_drafts;
  settings jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_financial_year_start IS NULL
    OR extract(month FROM p_financial_year_start) <> 4
    OR extract(day FROM p_financial_year_start) <> 1
  THEN
    RAISE EXCEPTION 'Choose an April-to-March financial year.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO draft FROM public.expense_agm_drafts
  WHERE society_id = p_society_id
    AND financial_year_start = p_financial_year_start;
  SELECT config.settings INTO settings FROM public.module_configs AS config
  WHERE config.society_id = p_society_id AND config.module_key = 'expense';
  RETURN jsonb_build_object(
    'financial_year_start', p_financial_year_start,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'warning_acknowledged_at', private.expense_audit_warning_on(p_society_id),
    'sections', COALESCE(
      settings -> 'agm_report_sections',
      '{"finances":true,"comparison":true,"funds":true,"audit":true,"position":true,"written":true}'::jsonb
    ),
    'settings_updated_at', (
      SELECT updated_at FROM public.module_configs
      WHERE society_id = p_society_id AND module_key = 'expense'
    ),
    'draft', CASE WHEN draft.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', draft.id,
      'written_sections', draft.written_sections,
      'version', draft.version,
      'updated_at', draft.updated_at
    ) END,
    'revisions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', revision.id,
        'revision_number', revision.revision_number,
        'created_at', revision.created_at,
        'created_by_name', profile.full_name
      ) ORDER BY revision.created_at DESC, revision.id DESC)
      FROM public.expense_audit_revisions AS revision
      JOIN public.profiles AS profile ON profile.id = revision.created_by
      WHERE revision.society_id = p_society_id
        AND revision.entity_type = 'agm_draft'
        AND revision.entity_id = draft.id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_agm_draft_save(
  p_society_id uuid,
  p_draft_id uuid,
  p_financial_year_start date,
  p_written_sections jsonb,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current public.expense_agm_drafts;
  saved public.expense_agm_drafts;
  section jsonb;
  idempotent_id uuid;
  next_revision integer;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF private.expense_audit_warning_on(p_society_id) IS NULL
    OR p_financial_year_start IS NULL
    OR extract(month FROM p_financial_year_start) <> 4
    OR extract(day FROM p_financial_year_start) <> 1
    OR jsonb_typeof(p_written_sections) <> 'array'
    OR jsonb_array_length(p_written_sections) > 10
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the AGM draft sections and acknowledgement.'
      USING ERRCODE = '22023';
  END IF;
  FOR section IN SELECT value FROM jsonb_array_elements(p_written_sections)
  LOOP
    IF jsonb_typeof(section) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(section)) <> 2
      OR NOT (section ?& ARRAY['title', 'body'])
      OR jsonb_typeof(section -> 'title') <> 'string'
      OR jsonb_typeof(section -> 'body') <> 'string'
      OR char_length(btrim(section ->> 'title')) NOT BETWEEN 1 AND 120
      OR char_length(btrim(section ->> 'body')) NOT BETWEEN 1 AND 10000
    THEN
      RAISE EXCEPTION 'Check each AGM section title and text.'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  SELECT entity_id INTO idempotent_id
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'agm_draft'
    AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF idempotent_id IS NOT NULL THEN RETURN idempotent_id; END IF;
  IF p_draft_id IS NULL THEN
    INSERT INTO public.expense_agm_drafts (
      society_id, financial_year_start, written_sections, created_by, updated_by
    ) VALUES (
      p_society_id, p_financial_year_start, p_written_sections, auth.uid(), auth.uid()
    ) RETURNING * INTO saved;
  ELSE
    SELECT * INTO current FROM public.expense_agm_drafts
    WHERE society_id = p_society_id AND id = p_draft_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AGM draft not found.' USING ERRCODE = 'P0002'; END IF;
    IF current.version <> p_expected_version
      OR current.financial_year_start <> p_financial_year_start
    THEN
      RAISE EXCEPTION 'The AGM draft changed. Refresh before saving.'
        USING ERRCODE = '40001';
    END IF;
    UPDATE public.expense_agm_drafts
    SET written_sections = p_written_sections, version = version + 1
    WHERE society_id = p_society_id AND id = p_draft_id
    RETURNING * INTO saved;
  END IF;
  SELECT COALESCE(max(revision_number), 0) + 1 INTO next_revision
  FROM public.expense_audit_revisions
  WHERE society_id = p_society_id AND entity_type = 'agm_draft'
    AND entity_id = saved.id;
  INSERT INTO public.expense_audit_revisions (
    society_id, entity_type, entity_id, revision_number, before_data,
    after_data, created_by, client_request_id
  ) VALUES (
    p_society_id, 'agm_draft', saved.id, next_revision,
    CASE WHEN current.id IS NULL THEN NULL ELSE to_jsonb(current) END,
    to_jsonb(saved), auth.uid(), p_client_request_id
  );
  RETURN saved.id;
END;
$$;

CREATE FUNCTION public.expense_agm_settings_save(
  p_society_id uuid,
  p_sections jsonb,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.module_configs;
  saved_at timestamptz;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF jsonb_typeof(p_sections) <> 'object'
    OR NOT (p_sections ?& ARRAY[
      'finances', 'comparison', 'funds', 'audit', 'position', 'written'
    ])
    OR (SELECT count(*) FROM jsonb_object_keys(p_sections)) <> 6
    OR EXISTS (
      SELECT 1 FROM jsonb_each(p_sections) AS setting
      WHERE jsonb_typeof(setting.value) <> 'boolean'
    )
  THEN
    RAISE EXCEPTION 'Choose which AGM sections are included.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense' FOR UPDATE;
  IF config.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Expense settings changed. Refresh before saving.'
      USING ERRCODE = '40001';
  END IF;
  UPDATE public.module_configs
  SET settings = settings || jsonb_build_object('agm_report_sections', p_sections),
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'expense'
  RETURNING updated_at INTO saved_at;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.agm_settings.update',
    'module_config', 'expense', config.settings -> 'agm_report_sections',
    p_sections, p_request_trace
  );
  RETURN saved_at;
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_statements(uuid, date, date),
  public.expense_financial_position(uuid, date),
  public.expense_multi_year(uuid),
  public.expense_audit_warning_acknowledge(uuid, boolean, uuid, text),
  public.expense_audit_get(uuid, date),
  public.expense_audit_year_save(
    uuid, uuid, date, text, text, date, text, uuid, date, date, date,
    text, text, integer, uuid, text
  ),
  public.expense_audit_query_save(
    uuid, uuid, uuid, integer, date, text, text, uuid, date, text, date,
    integer, uuid, text
  ),
  public.expense_audit_objection_save(
    uuid, uuid, uuid, text, uuid, date, text, date, uuid, integer, uuid, text
  ),
  public.expense_agm_draft(uuid, date),
  public.expense_agm_draft_save(
    uuid, uuid, date, jsonb, integer, uuid, text
  ),
  public.expense_agm_settings_save(uuid, jsonb, timestamptz, text)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
  public.expense_statements(uuid, date, date),
  public.expense_financial_position(uuid, date),
  public.expense_multi_year(uuid),
  public.expense_audit_warning_acknowledge(uuid, boolean, uuid, text),
  public.expense_audit_get(uuid, date),
  public.expense_audit_year_save(
    uuid, uuid, date, text, text, date, text, uuid, date, date, date,
    text, text, integer, uuid, text
  ),
  public.expense_audit_query_save(
    uuid, uuid, uuid, integer, date, text, text, uuid, date, text, date,
    integer, uuid, text
  ),
  public.expense_audit_objection_save(
    uuid, uuid, uuid, text, uuid, date, text, date, uuid, integer, uuid, text
  ),
  public.expense_agm_draft(uuid, date),
  public.expense_agm_draft_save(
    uuid, uuid, date, jsonb, integer, uuid, text
  ),
  public.expense_agm_settings_save(uuid, jsonb, timestamptz, text)
TO authenticated;
