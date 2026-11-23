-- Add permanent yearly expense budget plans and approved change history.
CREATE OR REPLACE FUNCTION private.expense_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_settings) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_settings) AS key
    WHERE key NOT IN (
      'approval_threshold_paise', 'billing_income_account_id',
      'agm_report_sections', 'budget_forecast_method',
      'budget_watch_percent', 'budget_resident_summary'
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
  IF p_settings ? 'budget_forecast_method'
    AND (
      jsonb_typeof(p_settings -> 'budget_forecast_method') <> 'string'
      OR p_settings ->> 'budget_forecast_method' NOT IN (
        'budget', 'average_3_months', 'none'
      )
    )
  THEN
    RETURN false;
  END IF;
  IF p_settings ? 'budget_watch_percent'
    AND (
      jsonb_typeof(p_settings -> 'budget_watch_percent') <> 'number'
      OR (p_settings ->> 'budget_watch_percent')::integer NOT BETWEEN 50 AND 100
    )
  THEN
    RETURN false;
  END IF;
  IF p_settings ? 'budget_resident_summary'
    AND jsonb_typeof(p_settings -> 'budget_resident_summary') <> 'boolean'
  THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_settings_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.expense_settings_valid(jsonb)
  TO authenticated, service_role;

CREATE FUNCTION private.expense_budget_today(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE coalesce(society.timezone, 'Asia/Kolkata'))::date
  FROM public.societies AS society
  WHERE society.id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.expense_budget_today(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_budget_spread(
  p_amount_paise bigint, p_phasing text, p_month_paise bigint[]
)
RETURNS bigint[] LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  amount_units bigint;
  slots integer[];
  result bigint[] := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::bigint[];
  base_units bigint;
  remainder_units bigint;
  slot integer;
BEGIN
  IF p_amount_paise IS NULL OR p_amount_paise < 0 OR p_amount_paise % 100 <> 0
    OR p_phasing NOT IN (
      'equal_monthly', 'quarterly', 'half_yearly', 'first_month', 'custom'
    )
  THEN
    RAISE EXCEPTION 'Invalid budget spread.' USING ERRCODE = '22023';
  END IF;
  IF p_phasing = 'custom' THEN
    IF cardinality(p_month_paise) <> 12
      OR EXISTS (
        SELECT 1
        FROM unnest(p_month_paise) AS month_value
        WHERE month_value < 0 OR month_value % 100 <> 0
      )
      OR (
        SELECT coalesce(sum(month_value), 0)
        FROM unnest(p_month_paise) AS month_value
      ) <> p_amount_paise
    THEN
      RAISE EXCEPTION 'Custom months must add up to the budget.' USING ERRCODE = '22023';
    END IF;
    RETURN p_month_paise;
  END IF;
  slots := CASE p_phasing
    WHEN 'equal_monthly' THEN ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]
    WHEN 'quarterly' THEN ARRAY[1,4,7,10]
    WHEN 'half_yearly' THEN ARRAY[1,7]
    ELSE ARRAY[1]
  END;
  amount_units := p_amount_paise / 100;
  base_units := amount_units / cardinality(slots);
  remainder_units := amount_units % cardinality(slots);
  FOREACH slot IN ARRAY slots LOOP
    result[slot] := base_units * 100;
  END LOOP;
  result[slots[cardinality(slots)]] :=
    result[slots[cardinality(slots)]] + remainder_units * 100;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_budget_spread(bigint, text, bigint[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_budget_change_spread(
  p_amount_paise bigint, p_effective_month integer
)
RETURNS bigint[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(
    array_agg(
      CASE
        WHEN month_number < p_effective_month THEN 0
        WHEN month_number = 12 THEN
          (p_amount_paise / 100 / (13 - p_effective_month)) * 100
            + (p_amount_paise / 100 % (13 - p_effective_month)) * 100
        ELSE (p_amount_paise / 100 / (13 - p_effective_month)) * 100
      END
      ORDER BY month_number
    ),
    ARRAY[]::bigint[]
  )
  FROM generate_series(1, 12) AS month_number
$$;
REVOKE ALL ON FUNCTION private.expense_budget_change_spread(bigint, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.expense_budgets (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  financial_year integer NOT NULL
    CHECK (financial_year BETWEEN 2000 AND 2100),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'discarded')),
  copy_source_year integer
    CHECK (copy_source_year BETWEEN 2000 AND 2100),
  copy_percent_bp integer
    CHECK (copy_percent_bp BETWEEN -5000 AND 10000),
  approved_body text CHECK (approved_body IN ('committee', 'general_body')),
  approved_on date,
  approval_meeting_id uuid,
  approval_document_id uuid,
  approval_note text
    CHECK (approval_note IS NULL OR (
      approval_note = btrim(approval_note)
      AND char_length(approval_note) BETWEEN 1 AND 500
    )),
  approved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  approved_at timestamptz,
  discarded_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  discarded_at timestamptz,
  discard_reason text
    CHECK (discard_reason IS NULL OR (
      discard_reason = btrim(discard_reason)
      AND char_length(discard_reason) BETWEEN 5 AND 500
    )),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_budgets_approval_meeting_fkey
    FOREIGN KEY (society_id, approval_meeting_id)
    REFERENCES public.meeting_resolutions (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budgets_approval_document_fkey
    FOREIGN KEY (society_id, approval_document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budgets_approval_check CHECK (
    (
      status = 'approved'
      AND approved_body IS NOT NULL
      AND approved_on IS NOT NULL
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
      AND approval_meeting_id IS NULL
      AND approval_document_id IS NULL
      AND discarded_by IS NULL
      AND discarded_at IS NULL
      AND discard_reason IS NULL
    )
    OR (
      status = 'approved'
      AND approved_body IS NOT NULL
      AND approved_on IS NOT NULL
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
      AND (
        (approval_meeting_id IS NOT NULL AND approval_document_id IS NULL)
        OR (approval_meeting_id IS NULL AND approval_document_id IS NOT NULL)
      )
      AND discarded_by IS NULL
      AND discarded_at IS NULL
      AND discard_reason IS NULL
    )
    OR (
      status = 'draft'
      AND approved_body IS NULL
      AND approved_on IS NULL
      AND approval_meeting_id IS NULL
      AND approval_document_id IS NULL
      AND approval_note IS NULL
      AND approved_by IS NULL
      AND approved_at IS NULL
      AND discarded_by IS NULL
      AND discarded_at IS NULL
      AND discard_reason IS NULL
    )
    OR (
      status = 'discarded'
      AND approved_body IS NULL
      AND approved_on IS NULL
      AND approval_meeting_id IS NULL
      AND approval_document_id IS NULL
      AND approval_note IS NULL
      AND approved_by IS NULL
      AND approved_at IS NULL
      AND discarded_by IS NOT NULL
      AND discarded_at IS NOT NULL
      AND discard_reason IS NOT NULL
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX expense_budgets_current_year_idx
  ON public.expense_budgets (society_id, financial_year)
  WHERE status <> 'discarded';
CREATE INDEX expense_budgets_status_idx
  ON public.expense_budgets (society_id, status, financial_year DESC);
CREATE INDEX expense_budgets_approval_meeting_idx
  ON public.expense_budgets (society_id, approval_meeting_id);
CREATE INDEX expense_budgets_approval_document_idx
  ON public.expense_budgets (society_id, approval_document_id);
CREATE INDEX expense_budgets_created_by_idx ON public.expense_budgets (created_by);
CREATE INDEX expense_budgets_updated_by_idx ON public.expense_budgets (updated_by);
CREATE INDEX expense_budgets_approved_by_idx ON public.expense_budgets (approved_by);
CREATE INDEX expense_budgets_discarded_by_idx
  ON public.expense_budgets (discarded_by) WHERE discarded_by IS NOT NULL;
CREATE TRIGGER expense_budgets_set_updated_at
  BEFORE UPDATE ON public.expense_budgets
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_budget_lines (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  category_id uuid,
  income_type text CHECK (income_type IN ('billing', 'donation', 'interest', 'other')),
  phasing text NOT NULL
    CHECK (phasing IN (
      'equal_monthly', 'quarterly', 'half_yearly', 'first_month', 'custom'
    )),
  annual_paise bigint NOT NULL
    CHECK (annual_paise BETWEEN 0 AND 999999999999999 AND annual_paise % 100 = 0),
  month_paise bigint[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_lines_budget_fkey
    FOREIGN KEY (society_id, budget_id)
    REFERENCES public.expense_budgets (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_lines_category_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_lines_head_check CHECK (
    (category_id IS NOT NULL AND income_type IS NULL)
    OR (category_id IS NULL AND income_type IS NOT NULL)
  ),
  CONSTRAINT expense_budget_lines_months_check CHECK (
    month_paise = private.expense_budget_spread(
      annual_paise, phasing, month_paise
    )
  ),
  UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX expense_budget_lines_category_idx
  ON public.expense_budget_lines (society_id, budget_id, category_id)
  WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX expense_budget_lines_income_idx
  ON public.expense_budget_lines (society_id, budget_id, income_type)
  WHERE income_type IS NOT NULL;
CREATE INDEX expense_budget_lines_created_by_idx
  ON public.expense_budget_lines (created_by);
CREATE INDEX expense_budget_lines_budget_idx
  ON public.expense_budget_lines (society_id, budget_id);
CREATE INDEX expense_budget_lines_category_fkey_idx
  ON public.expense_budget_lines (society_id, category_id);

CREATE TABLE public.expense_budget_changes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  category_id uuid,
  income_type text CHECK (income_type IN ('billing', 'donation', 'interest', 'other')),
  direction text NOT NULL CHECK (direction IN ('increase', 'decrease')),
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 100 AND 999999999999999 AND amount_paise % 100 = 0),
  effective_month integer NOT NULL CHECK (effective_month BETWEEN 1 AND 12),
  month_paise bigint[] NOT NULL,
  reason text NOT NULL
    CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 5 AND 500),
  approved_body text NOT NULL CHECK (approved_body IN ('committee', 'general_body')),
  approved_on date NOT NULL,
  approval_meeting_id uuid,
  approval_document_id uuid,
  approval_note text
    CHECK (approval_note IS NULL OR (
      approval_note = btrim(approval_note)
      AND char_length(approval_note) BETWEEN 1 AND 500
    )),
  approved_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  pair_id uuid,
  voided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  voided_at timestamptz,
  void_reason text
    CHECK (void_reason IS NULL OR (
      void_reason = btrim(void_reason)
      AND char_length(void_reason) BETWEEN 5 AND 500
    )),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_changes_budget_fkey
    FOREIGN KEY (society_id, budget_id)
    REFERENCES public.expense_budgets (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_changes_category_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_changes_approval_meeting_fkey
    FOREIGN KEY (society_id, approval_meeting_id)
    REFERENCES public.meeting_resolutions (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_changes_approval_document_fkey
    FOREIGN KEY (society_id, approval_document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_budget_changes_head_check CHECK (
    (category_id IS NOT NULL AND income_type IS NULL)
    OR (category_id IS NULL AND income_type IS NOT NULL)
  ),
  CONSTRAINT expense_budget_changes_approval_link_check CHECK (
    approval_meeting_id IS NULL OR approval_document_id IS NULL
  ),
  CONSTRAINT expense_budget_changes_void_check CHECK (
    (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL)
  ),
  CONSTRAINT expense_budget_changes_months_check CHECK (
    month_paise = private.expense_budget_change_spread(
      amount_paise, effective_month
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id, direction)
);
CREATE INDEX expense_budget_changes_budget_idx
  ON public.expense_budget_changes (
    society_id, budget_id, effective_month, created_at
  );
CREATE INDEX expense_budget_changes_category_idx
  ON public.expense_budget_changes (society_id, category_id)
  WHERE category_id IS NOT NULL;
CREATE INDEX expense_budget_changes_income_idx
  ON public.expense_budget_changes (society_id, income_type)
  WHERE income_type IS NOT NULL;
CREATE INDEX expense_budget_changes_pair_idx
  ON public.expense_budget_changes (society_id, pair_id) WHERE pair_id IS NOT NULL;
CREATE INDEX expense_budget_changes_approved_by_idx
  ON public.expense_budget_changes (approved_by);
CREATE INDEX expense_budget_changes_voided_by_idx
  ON public.expense_budget_changes (voided_by) WHERE voided_by IS NOT NULL;
CREATE INDEX expense_budget_changes_meeting_idx
  ON public.expense_budget_changes (society_id, approval_meeting_id);
CREATE INDEX expense_budget_changes_document_idx
  ON public.expense_budget_changes (society_id, approval_document_id);
CREATE INDEX expense_budget_changes_category_fkey_idx
  ON public.expense_budget_changes (society_id, category_id);
CREATE INDEX expense_budget_changes_created_by_idx
  ON public.expense_budget_changes (created_by);

ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_budget_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_budgets, public.expense_budget_lines,
  public.expense_budget_changes
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_budgets_no_direct_access
  ON public.expense_budgets FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_budget_lines_no_direct_access
  ON public.expense_budget_lines FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_budget_changes_no_direct_access
  ON public.expense_budget_changes FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.expense_budget_validate_approval(
  p_society_id uuid,
  p_approved_body text,
  p_approved_on date,
  p_approval_meeting_id uuid,
  p_approval_document_id uuid,
  p_approval_note text
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_approved_body NOT IN ('committee', 'general_body')
    OR p_approved_on IS NULL
    OR p_approved_on > private.expense_budget_today(p_society_id)
    OR (
      p_approval_meeting_id IS NOT NULL
      AND p_approval_document_id IS NOT NULL
    )
    OR (
      p_approval_note IS NOT NULL
      AND (
        p_approval_note <> btrim(p_approval_note)
        OR char_length(p_approval_note) NOT BETWEEN 1 AND 500
      )
    )
  THEN
    RAISE EXCEPTION 'Record valid budget approval details.' USING ERRCODE = '22023';
  END IF;
  IF p_approval_meeting_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meeting_resolutions
    WHERE society_id = p_society_id AND id = p_approval_meeting_id
  ) THEN
    RAISE EXCEPTION 'Meeting resolution not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_approval_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE society_id = p_society_id AND id = p_approval_document_id
      AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_budget_validate_approval(
  uuid, text, date, uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_budget_head_actuals(
  p_society_id uuid, p_from date, p_to date
)
RETURNS TABLE (
  category_id uuid,
  income_type text,
  month date,
  amount_paise bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH roots AS (
    SELECT
      entry.entry_date,
      entry.direction,
      entry.amount_paise,
      coalesce(entry.reverses_entry_id, entry.id) AS root_entry_id
    FROM public.expense_book_entries AS entry
    WHERE entry.society_id = p_society_id
      AND entry.entry_date BETWEEN p_from AND p_to
      AND entry.transfer_pair_id IS NULL
  ), classified AS (
    SELECT
      root.category_id,
      CASE WHEN root.source = 'billing_payment' THEN 'billing'
        ELSE root.income_kind END AS income_type,
      (roots.entry_date
        - (extract(day FROM roots.entry_date)::integer - 1))::date AS month,
      CASE
        WHEN root.category_id IS NOT NULL
          THEN CASE WHEN roots.direction = 'out'
            THEN roots.amount_paise ELSE -roots.amount_paise END
        ELSE CASE WHEN roots.direction = 'in'
          THEN roots.amount_paise ELSE -roots.amount_paise END
      END AS signed_amount
    FROM roots
    JOIN public.expense_book_entries AS root
      ON root.society_id = p_society_id AND root.id = roots.root_entry_id
    WHERE root.category_id IS NOT NULL
      OR root.source IN ('income', 'billing_payment')
  )
  SELECT category_id, income_type, month, sum(signed_amount)::bigint
  FROM classified
  GROUP BY category_id, income_type, month
$$;
REVOKE ALL ON FUNCTION private.expense_budget_head_actuals(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_budget_copy_preview(
  p_society_id uuid, p_financial_year integer, p_percent_bp integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source_year integer := p_financial_year - 1;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_financial_year NOT BETWEEN 2000 AND 2100
    OR (p_percent_bp IS NOT NULL AND p_percent_bp NOT BETWEEN -5000 AND 10000)
  THEN
    RAISE EXCEPTION 'Choose a valid budget year and percentage.'
      USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH heads AS (
      SELECT id AS category_id, NULL::text AS income_type, name
      FROM public.expense_categories WHERE society_id = p_society_id
      UNION ALL
      SELECT NULL::uuid, kind, label
      FROM (VALUES
        ('billing', 'Maintenance collections'),
        ('donation', 'Donations'),
        ('interest', 'Interest'),
        ('other', 'Other income')
      ) AS income(kind, label)
    ), actuals AS (
      SELECT category_id, income_type, sum(amount_paise)::bigint AS amount_paise
      FROM private.expense_budget_head_actuals(
        p_society_id,
        make_date(source_year, 4, 1),
        make_date(source_year + 1, 3, 31)
      )
      GROUP BY category_id, income_type
    ), preview AS (
      SELECT
        heads.category_id, heads.income_type, heads.name,
        (
          round(
            greatest(coalesce(actuals.amount_paise, 0), 0)::numeric
              * (10000 + coalesce(p_percent_bp, 0))
              / 1000000
          )::bigint * 100
        ) AS annual_paise
      FROM heads
      LEFT JOIN actuals
        ON actuals.category_id IS NOT DISTINCT FROM heads.category_id
        AND actuals.income_type IS NOT DISTINCT FROM heads.income_type
    )
    SELECT jsonb_build_object(
      'source_financial_year', source_year,
      'percent_bp', coalesce(p_percent_bp, 0),
      'lines', coalesce(jsonb_agg(jsonb_build_object(
        'category_id', category_id,
        'income_type', income_type,
        'name', name,
        'annual_paise', annual_paise,
        'phasing', 'equal_monthly',
        'month_paise', to_jsonb(private.expense_budget_spread(
          annual_paise, 'equal_monthly', NULL
        ))
      ) ORDER BY category_id NULLS LAST, income_type), '[]'::jsonb)
    )
    FROM preview
  );
END;
$$;

CREATE FUNCTION public.expense_budget_get(
  p_society_id uuid, p_financial_year integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_financial_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Choose a valid financial year.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id
    AND financial_year = p_financial_year
    AND status <> 'discarded';
  RETURN (
    WITH heads AS (
      SELECT category.id AS category_id, NULL::text AS income_type,
        category.name, 'spending'::text AS kind
      FROM public.expense_categories AS category
      WHERE category.society_id = p_society_id
      UNION ALL
      SELECT NULL::uuid, income.kind, income.label, 'income'
      FROM (VALUES
        ('billing', 'Maintenance collections'),
        ('donation', 'Donations'),
        ('interest', 'Interest'),
        ('other', 'Other income')
      ) AS income(kind, label)
    ), line_heads AS (
      SELECT
        heads.*,
        line.id AS line_id, coalesce(line.annual_paise, 0) AS original_paise,
        line.phasing,
        coalesce(
          line.month_paise,
          ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::bigint[]
        ) AS original_months
      FROM heads
      LEFT JOIN public.expense_budget_lines AS line
        ON line.budget_id = budget.id
        AND line.category_id IS NOT DISTINCT FROM heads.category_id
        AND line.income_type IS NOT DISTINCT FROM heads.income_type
    ), changes_by_head AS (
      SELECT
        category_id, income_type,
        sum(
          CASE WHEN direction = 'increase' THEN amount_paise
            ELSE -amount_paise END
        )::bigint AS changed_paise,
        ARRAY[
          sum(CASE WHEN direction = 'increase' THEN month_paise[1]
            ELSE -month_paise[1] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[2]
            ELSE -month_paise[2] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[3]
            ELSE -month_paise[3] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[4]
            ELSE -month_paise[4] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[5]
            ELSE -month_paise[5] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[6]
            ELSE -month_paise[6] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[7]
            ELSE -month_paise[7] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[8]
            ELSE -month_paise[8] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[9]
            ELSE -month_paise[9] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[10]
            ELSE -month_paise[10] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[11]
            ELSE -month_paise[11] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[12]
            ELSE -month_paise[12] END)::bigint
        ]::bigint[] AS changed_months
      FROM public.expense_budget_changes
      WHERE budget_id = budget.id AND voided_at IS NULL
      GROUP BY category_id, income_type
    ), current_plan AS (
      SELECT
        line_heads.*,
        coalesce(changes.changed_paise, 0)::bigint AS changes_paise,
        (line_heads.original_paise + coalesce(changes.changed_paise, 0))::bigint
          AS current_paise,
        ARRAY(
          SELECT line_heads.original_months[month_number]
            + coalesce(changes.changed_months[month_number], 0)
          FROM generate_series(1, 12) AS month_number
        )::bigint[] AS current_months
      FROM line_heads
      LEFT JOIN changes_by_head AS changes
        ON changes.category_id IS NOT DISTINCT FROM line_heads.category_id
        AND changes.income_type IS NOT DISTINCT FROM line_heads.income_type
    )
    SELECT jsonb_build_object(
      'financial_year', p_financial_year,
      'today', private.expense_budget_today(p_society_id),
      'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
        AND private.society_writable(p_society_id),
      'settings', (
        SELECT jsonb_build_object(
          'budget_forecast_method', coalesce(
            config.settings ->> 'budget_forecast_method', 'budget'
          ),
          'budget_watch_percent', coalesce(
            (config.settings ->> 'budget_watch_percent')::integer, 90
          ),
          'budget_resident_summary', coalesce(
            (config.settings ->> 'budget_resident_summary')::boolean, true
          ),
          'updated_at', config.updated_at
        )
        FROM public.module_configs AS config
        WHERE config.society_id = p_society_id
          AND config.module_key = 'expense'
      ),
      'budget', CASE WHEN budget.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', budget.id,
        'financial_year', budget.financial_year,
        'status', budget.status,
        'copy_source_year', budget.copy_source_year,
        'copy_percent_bp', budget.copy_percent_bp,
        'approved_body', budget.approved_body,
        'approved_on', budget.approved_on,
        'approval_meeting_id', budget.approval_meeting_id,
        'approval_document_id', budget.approval_document_id,
        'approval_note', budget.approval_note,
        'approved_by', budget.approved_by,
        'approved_at', budget.approved_at,
        'version', budget.version,
        'created_at', budget.created_at,
        'updated_at', budget.updated_at
      ) END,
      'heads', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'category_id', category_id,
          'income_type', income_type,
          'name', name,
          'kind', kind
        ) ORDER BY kind, lower(name))
        FROM heads
      ), '[]'::jsonb),
      'lines', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', line.id,
          'category_id', line.category_id,
          'income_type', line.income_type,
          'name', head.name,
          'phasing', line.phasing,
          'annual_paise', line.annual_paise,
          'month_paise', to_jsonb(line.month_paise)
        ) ORDER BY head.kind, lower(head.name))
        FROM public.expense_budget_lines AS line
        JOIN heads AS head
          ON head.category_id IS NOT DISTINCT FROM line.category_id
          AND head.income_type IS NOT DISTINCT FROM line.income_type
        WHERE line.budget_id = budget.id
      ), '[]'::jsonb),
      'changes', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', change.id,
          'category_id', change.category_id,
          'income_type', change.income_type,
          'name', head.name,
          'direction', change.direction,
          'amount_paise', change.amount_paise,
          'effective_month', change.effective_month,
          'month_paise', to_jsonb(change.month_paise),
          'reason', change.reason,
          'approved_body', change.approved_body,
          'approved_on', change.approved_on,
          'approval_meeting_id', change.approval_meeting_id,
          'approval_document_id', change.approval_document_id,
          'approval_note', change.approval_note,
          'pair_id', change.pair_id,
          'voided_at', change.voided_at,
          'void_reason', change.void_reason,
          'created_at', change.created_at
        ) ORDER BY change.created_at DESC, change.id)
        FROM public.expense_budget_changes AS change
        JOIN heads AS head
          ON head.category_id IS NOT DISTINCT FROM change.category_id
          AND head.income_type IS NOT DISTINCT FROM change.income_type
        WHERE change.budget_id = budget.id
      ), '[]'::jsonb),
      'current_plan', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'category_id', category_id,
          'income_type', income_type,
          'name', name,
          'kind', kind,
          'line_id', line_id,
          'original_paise', original_paise,
          'changes_paise', changes_paise,
          'current_paise', current_paise,
          'original_month_paise', to_jsonb(original_months),
          'current_month_paise', to_jsonb(current_months)
        ) ORDER BY kind, lower(name))
        FROM current_plan
      ), '[]'::jsonb),
      'approval_choices', jsonb_build_object(
        'meetings', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', resolution.id, 'label', resolution.title
          ) ORDER BY resolution.updated_at DESC, resolution.id)
          FROM (
            SELECT id, title, updated_at
            FROM public.meeting_resolutions
            WHERE society_id = p_society_id AND outcome = 'passed'
              AND private.module_enabled(p_society_id, 'meeting')
            ORDER BY updated_at DESC, id
            LIMIT 200
          ) AS resolution
        ), '[]'::jsonb),
        'documents', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', document.id, 'label', document.title
          ) ORDER BY document.updated_at DESC, document.id)
          FROM (
            SELECT id, title, updated_at
            FROM public.documents
            WHERE society_id = p_society_id AND archived_at IS NULL
              AND private.module_enabled(p_society_id, 'document')
            ORDER BY updated_at DESC, id
            LIMIT 200
          ) AS document
        ), '[]'::jsonb)
      )
    )
  );
END;
$$;

CREATE FUNCTION public.expense_budget_report(
  p_society_id uuid, p_financial_year integer, p_as_of date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  year_start date;
  year_end date;
  elapsed_months integer;
  forecast_method text;
  opening_money_paise bigint;
  accounts_added_paise bigint;
  today date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.expense_budget_today(p_society_id);
  IF p_financial_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Choose a valid financial year.' USING ERRCODE = '22023';
  END IF;
  year_start := make_date(p_financial_year, 4, 1);
  year_end := make_date(p_financial_year + 1, 3, 31);
  IF p_as_of IS NULL OR p_as_of NOT BETWEEN year_start AND year_end
    OR p_as_of > today
  THEN
    RAISE EXCEPTION 'Choose an as-of date inside the financial year.'
      USING ERRCODE = '22023';
  END IF;
  elapsed_months := (
    (
      extract(year FROM p_as_of)::integer * 12
      + extract(month FROM p_as_of)::integer
    ) - (
      p_financial_year * 12 + 4
    ) + 1
  );
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id
    AND financial_year = p_financial_year
    AND status = 'approved';
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'financial_year', p_financial_year,
      'from', year_start,
      'to', year_end,
      'as_of', p_as_of,
      'approved', false,
      'forecast_method', coalesce((
        SELECT settings ->> 'budget_forecast_method'
        FROM public.module_configs
        WHERE society_id = p_society_id AND module_key = 'expense'
      ), 'budget'),
      'months_averaged', 0,
      'summary', '[]'::jsonb,
      'months', '[]'::jsonb,
      'cash_flow', '[]'::jsonb,
      'opening_money_paise', 0,
      'accounts_added_opening_paise', 0
    );
  END IF;
  SELECT coalesce(settings ->> 'budget_forecast_method', 'budget')
  INTO forecast_method
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense';
  SELECT coalesce(sum(private.expense_balance(
    p_society_id, account.id, year_start - 1
  )), 0)::bigint
  INTO opening_money_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id
    AND account.opening_on < year_start;
  SELECT coalesce(sum(account.opening_balance_paise), 0)::bigint
  INTO accounts_added_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id
    AND account.opening_on BETWEEN year_start AND year_end;
  RETURN (
    WITH RECURSIVE heads AS (
      SELECT category.id AS category_id, NULL::text AS income_type,
        category.name, 'spending'::text AS kind
      FROM public.expense_categories AS category
      WHERE category.society_id = p_society_id
      UNION ALL
      SELECT NULL::uuid, income.kind, income.label, 'income'
      FROM (VALUES
        ('billing', 'Maintenance collections'),
        ('donation', 'Donations'),
        ('interest', 'Interest'),
        ('other', 'Other income')
      ) AS income(kind, label)
    ), changes_by_head AS (
      SELECT
        category_id, income_type,
        sum(
          CASE WHEN direction = 'increase' THEN amount_paise
            ELSE -amount_paise END
        )::bigint AS changes_paise,
        ARRAY[
          sum(CASE WHEN direction = 'increase' THEN month_paise[1]
            ELSE -month_paise[1] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[2]
            ELSE -month_paise[2] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[3]
            ELSE -month_paise[3] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[4]
            ELSE -month_paise[4] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[5]
            ELSE -month_paise[5] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[6]
            ELSE -month_paise[6] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[7]
            ELSE -month_paise[7] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[8]
            ELSE -month_paise[8] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[9]
            ELSE -month_paise[9] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[10]
            ELSE -month_paise[10] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[11]
            ELSE -month_paise[11] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[12]
            ELSE -month_paise[12] END)::bigint
        ]::bigint[] AS changed_months
      FROM public.expense_budget_changes
      WHERE society_id = p_society_id
        AND budget_id = budget.id
        AND voided_at IS NULL
      GROUP BY category_id, income_type
    ), plan AS (
      SELECT
        heads.*,
        line.id AS line_id,
        coalesce(line.annual_paise, 0)::bigint AS original_paise,
        coalesce(changes.changes_paise, 0)::bigint AS changes_paise,
        (
          coalesce(line.annual_paise, 0)
          + coalesce(changes.changes_paise, 0)
        )::bigint AS current_paise,
        coalesce(
          line.month_paise,
          ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::bigint[]
        ) AS original_months,
        coalesce(
          changes.changed_months,
          ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::bigint[]
        ) AS changed_months
      FROM heads
      LEFT JOIN public.expense_budget_lines AS line
        ON line.budget_id = budget.id
        AND line.category_id IS NOT DISTINCT FROM heads.category_id
        AND line.income_type IS NOT DISTINCT FROM heads.income_type
      LEFT JOIN changes_by_head AS changes
        ON changes.category_id IS NOT DISTINCT FROM heads.category_id
        AND changes.income_type IS NOT DISTINCT FROM heads.income_type
    ), month_plan AS (
      SELECT
        plan.*,
        month_number,
        (year_start + (month_number - 1) * interval '1 month')::date AS month_start,
        (
          plan.original_months[month_number]
          + plan.changed_months[month_number]
        )::bigint AS budget_paise
      FROM plan
      CROSS JOIN generate_series(1, 12) AS month_number
    ), actuals AS (
      SELECT *
      FROM private.expense_budget_head_actuals(
        p_society_id, year_start, p_as_of
      )
    ), monthly_actual AS (
      SELECT category_id, income_type, month, sum(amount_paise)::bigint
        AS actual_paise
      FROM actuals
      GROUP BY category_id, income_type, month
    ), actual_totals AS (
      SELECT category_id, income_type, sum(amount_paise)::bigint AS actual_paise
      FROM actuals
      GROUP BY category_id, income_type
    ), plan_actual AS (
      SELECT
        plan.*,
        coalesce(actual.actual_paise, 0)::bigint AS actual_to_date_paise,
        (
          SELECT sum(plan.original_months[month_number]
            + plan.changed_months[month_number])
          FROM generate_series(1, elapsed_months) AS month_number
        )::bigint AS plan_to_date_paise
      FROM plan
      LEFT JOIN actual_totals AS actual
        ON actual.category_id IS NOT DISTINCT FROM plan.category_id
        AND actual.income_type IS NOT DISTINCT FROM plan.income_type
    ), summary AS (
      SELECT
        plan_actual.*,
        CASE WHEN kind = 'income'
          THEN actual_to_date_paise - plan_to_date_paise
          ELSE plan_to_date_paise - actual_to_date_paise
        END AS difference_paise,
        CASE
          WHEN plan_to_date_paise > 0
            THEN round(actual_to_date_paise::numeric * 10000 / plan_to_date_paise)::integer
          ELSE NULL
        END AS percent_used_bp,
        line_id IS NOT NULL OR changes_paise <> 0 AS budgeted
      FROM plan_actual
    ), cash_actual AS (
      SELECT
        (entry.entry_date
          - (extract(day FROM entry.entry_date)::integer - 1))::date AS month,
        sum(CASE WHEN entry.direction = 'in'
          THEN entry.amount_paise ELSE 0 END)::bigint AS money_in_paise,
        sum(CASE WHEN entry.direction = 'out'
          THEN entry.amount_paise ELSE 0 END)::bigint AS money_out_paise
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id
        AND entry.entry_date BETWEEN year_start AND p_as_of
        AND entry.transfer_pair_id IS NULL
      GROUP BY (
        entry.entry_date
          - (extract(day FROM entry.entry_date)::integer - 1)
      )::date
    ), cash_plan AS (
      SELECT
        month_plan.month_start,
        sum(CASE WHEN kind = 'income' THEN budget_paise ELSE 0 END)::bigint
          AS budget_in_paise,
        sum(CASE WHEN kind = 'spending' THEN budget_paise ELSE 0 END)::bigint
          AS budget_out_paise
      FROM month_plan
      GROUP BY month_plan.month_start
    ), average_input AS (
      SELECT
        month_start,
        coalesce(cash_actual.money_in_paise, 0)::bigint AS money_in_paise,
        coalesce(cash_actual.money_out_paise, 0)::bigint AS money_out_paise
      FROM (
        SELECT (year_start + (month_number - 1) * interval '1 month')::date
          AS month_start
        FROM generate_series(1, 12) AS month_number
      ) AS calendar
      LEFT JOIN cash_actual ON cash_actual.month = calendar.month_start
      WHERE (
        calendar.month_start + interval '1 month' - interval '1 day'
      )::date <= p_as_of
    ), averages AS (
      SELECT
        count(*)::integer AS months_averaged,
        coalesce(round(avg(money_in_paise))::bigint, 0) AS money_in_paise,
        coalesce(round(avg(money_out_paise))::bigint, 0) AS money_out_paise
      FROM (
        SELECT * FROM average_input ORDER BY month_start DESC LIMIT 3
      ) AS recent
    ), cash_months AS (
      SELECT
        calendar.month_start,
        calendar.month_number,
        CASE
          WHEN calendar.month_end <= p_as_of
            THEN coalesce(cash_actual.money_in_paise, 0)
          WHEN forecast_method = 'budget'
            THEN coalesce(cash_plan.budget_in_paise, 0)
          WHEN forecast_method = 'average_3_months' AND averages.months_averaged > 0
            THEN averages.money_in_paise
          ELSE 0
        END::bigint AS money_in_paise,
        CASE
          WHEN calendar.month_end <= p_as_of
            THEN coalesce(cash_actual.money_out_paise, 0)
          WHEN forecast_method = 'budget'
            THEN coalesce(cash_plan.budget_out_paise, 0)
          WHEN forecast_method = 'average_3_months' AND averages.months_averaged > 0
            THEN averages.money_out_paise
          ELSE 0
        END::bigint AS money_out_paise,
        calendar.month_end > p_as_of
          AND forecast_method <> 'none' AS is_estimate,
        calendar.month_end <= p_as_of
          OR forecast_method = 'budget'
          OR (
            forecast_method = 'average_3_months'
            AND averages.months_averaged > 0
          ) AS forecast_available,
        averages.months_averaged
      FROM (
        SELECT
          month_number,
          (year_start + (month_number - 1) * interval '1 month')::date
            AS month_start,
          (
            year_start + month_number * interval '1 month'
              - interval '1 day'
          )::date AS month_end
        FROM generate_series(1, 12) AS month_number
      ) AS calendar
      LEFT JOIN cash_actual ON cash_actual.month = calendar.month_start
      LEFT JOIN cash_plan ON cash_plan.month_start = calendar.month_start
      CROSS JOIN averages
    ), cash_running(month_number, month_start, money_in_paise, money_out_paise,
      net_paise, running_paise, is_estimate, forecast_available,
      months_averaged) AS (
      SELECT
        month_number, month_start, money_in_paise, money_out_paise,
        money_in_paise - money_out_paise,
        opening_money_paise + accounts_added_paise
          + money_in_paise - money_out_paise,
        is_estimate, forecast_available, months_averaged
      FROM cash_months WHERE month_number = 1
      UNION ALL
      SELECT
        current.month_number, current.month_start,
        current.money_in_paise, current.money_out_paise,
        current.money_in_paise - current.money_out_paise,
        previous.running_paise
          + current.money_in_paise - current.money_out_paise,
        current.is_estimate, current.forecast_available,
        current.months_averaged
      FROM cash_running AS previous
      JOIN cash_months AS current
        ON current.month_number = previous.month_number + 1
    )
    SELECT jsonb_build_object(
      'financial_year', p_financial_year,
      'from', year_start,
      'to', year_end,
      'as_of', p_as_of,
      'approved', true,
      'forecast_method', forecast_method,
      'months_averaged', (
        SELECT months_averaged FROM averages
      ),
      'summary', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'category_id', category_id,
          'income_type', income_type,
          'name', name,
          'kind', kind,
          'budgeted', budgeted,
          'original_paise', original_paise,
          'changes_paise', changes_paise,
          'current_paise', current_paise,
          'plan_to_date_paise', plan_to_date_paise,
          'actual_to_date_paise', actual_to_date_paise,
          'difference_paise', difference_paise,
          'difference_label', CASE
            WHEN kind = 'income' AND difference_paise > 0 THEN 'Better than budget'
            WHEN kind = 'spending' AND difference_paise < 0 THEN 'Over budget'
            ELSE 'Below budget'
          END,
          'percent_used_bp', percent_used_bp
        ) ORDER BY kind, lower(name))
        FROM summary
      ), '[]'::jsonb),
      'months', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'month', calendar.month_start,
          'heads', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
              'category_id', month_plan.category_id,
              'income_type', month_plan.income_type,
              'name', month_plan.name,
              'kind', month_plan.kind,
              'budget_paise', month_plan.budget_paise,
              'actual_paise', coalesce(monthly_actual.actual_paise, 0)
            ) ORDER BY month_plan.kind, lower(month_plan.name)), '[]'::jsonb)
            FROM month_plan
            LEFT JOIN monthly_actual
              ON monthly_actual.category_id IS NOT DISTINCT FROM month_plan.category_id
              AND monthly_actual.income_type IS NOT DISTINCT FROM month_plan.income_type
              AND monthly_actual.month = month_plan.month_start
            WHERE month_plan.month_number = calendar.month_number
          )
        ) ORDER BY calendar.month_number)
        FROM (
          SELECT
            month_number,
            (year_start + (month_number - 1) * interval '1 month')::date
              AS month_start
          FROM generate_series(1, 12) AS month_number
        ) AS calendar
      ), '[]'::jsonb),
      'cash_flow', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month_start,
          'money_in_paise', money_in_paise,
          'money_out_paise', money_out_paise,
          'net_paise', net_paise,
          'running_paise', running_paise,
          'is_estimate', is_estimate,
          'forecast_available', forecast_available
        ) ORDER BY month_number)
        FROM cash_running
      ), '[]'::jsonb),
      'opening_money_paise', opening_money_paise,
      'accounts_added_opening_paise', accounts_added_paise
    )
  );
END;
$$;

CREATE FUNCTION public.expense_budget_resident_summary(
  p_society_id uuid, p_financial_year integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  today date;
  as_of date;
  shared boolean;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'expense')
    OR NOT EXISTS (
      SELECT 1
      FROM public.memberships AS membership
      JOIN public.unit_occupants AS occupant
        ON occupant.society_id = membership.society_id
        AND occupant.membership_id = membership.id
      WHERE membership.society_id = p_society_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND membership.roles && ARRAY['resident']::text[]
        AND occupant.status = 'active'
        AND occupant.relationship IN ('owner', 'tenant', 'family')
    )
  THEN
    RAISE EXCEPTION 'Budget summary access denied.' USING ERRCODE = '42501';
  END IF;
  IF p_financial_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Choose a valid financial year.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(
    (settings ->> 'budget_resident_summary')::boolean, true
  ) INTO shared
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense';
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id
    AND financial_year = p_financial_year
    AND status = 'approved';
  IF NOT coalesce(shared, false) OR NOT FOUND THEN
    RETURN jsonb_build_object(
      'shared', false, 'financial_year', p_financial_year,
      'approved_on', NULL, 'rows', '[]'::jsonb,
      'totals', jsonb_build_object('income_paise', 0, 'spending_paise', 0)
    );
  END IF;
  today := private.expense_budget_today(p_society_id);
  as_of := least(
    today,
    make_date(p_financial_year + 1, 3, 31)
  );
  RETURN (
    WITH heads AS (
      SELECT category.id AS category_id, NULL::text AS income_type,
        category.name, 'spending'::text AS kind
      FROM public.expense_categories AS category
      WHERE category.society_id = p_society_id
      UNION ALL
      SELECT NULL::uuid, income.kind, income.label, 'income'
      FROM (VALUES
        ('billing', 'Maintenance collections'),
        ('donation', 'Donations'),
        ('interest', 'Interest'),
        ('other', 'Other income')
      ) AS income(kind, label)
    ), actuals AS (
      SELECT category_id, income_type, sum(amount_paise)::bigint AS amount_paise
      FROM private.expense_budget_head_actuals(
        p_society_id,
        make_date(p_financial_year, 4, 1),
        as_of
      )
      GROUP BY category_id, income_type
    ), current_plan AS (
      SELECT
        heads.*,
        coalesce(line.annual_paise, 0)::bigint + coalesce((
          SELECT sum(
            CASE WHEN change.direction = 'increase'
              THEN change.amount_paise ELSE -change.amount_paise END
          )
          FROM public.expense_budget_changes AS change
          WHERE change.society_id = p_society_id
            AND change.budget_id = budget.id
            AND change.category_id IS NOT DISTINCT FROM heads.category_id
            AND change.income_type IS NOT DISTINCT FROM heads.income_type
            AND change.voided_at IS NULL
        ), 0)::bigint AS current_paise
      FROM heads
      LEFT JOIN public.expense_budget_lines AS line
        ON line.budget_id = budget.id
        AND line.category_id IS NOT DISTINCT FROM heads.category_id
        AND line.income_type IS NOT DISTINCT FROM heads.income_type
    ), rows AS (
      SELECT
        plan.*,
        coalesce(actuals.amount_paise, 0)::bigint AS actual_to_date_paise,
        CASE WHEN plan.current_paise > 0
          THEN round(
            coalesce(actuals.amount_paise, 0)::numeric
              * 10000 / plan.current_paise
          )::integer
          ELSE NULL
        END AS percent_used_bp
      FROM current_plan AS plan
      LEFT JOIN actuals
        ON actuals.category_id IS NOT DISTINCT FROM plan.category_id
        AND actuals.income_type IS NOT DISTINCT FROM plan.income_type
    )
    SELECT jsonb_build_object(
      'shared', true,
      'financial_year', p_financial_year,
      'approved_on', budget.approved_on,
      'rows', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'category_id', category_id,
          'income_type', income_type,
          'name', name,
          'kind', kind,
          'current_paise', current_paise,
          'actual_to_date_paise', actual_to_date_paise,
          'percent_used_bp', percent_used_bp
        ) ORDER BY kind, lower(name))
        FROM rows
      ), '[]'::jsonb),
      'totals', jsonb_build_object(
        'income_paise', (
          SELECT coalesce(sum(current_paise), 0)
          FROM rows WHERE kind = 'income'
        ),
        'spending_paise', (
          SELECT coalesce(sum(current_paise), 0)
          FROM rows WHERE kind = 'spending'
        )
      )
    )
  );
END;
$$;

CREATE FUNCTION public.expense_budget_settings_update(
  p_society_id uuid,
  p_forecast_method text,
  p_watch_percent integer,
  p_resident_summary boolean,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.module_configs;
  saved public.module_configs;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_forecast_method NOT IN ('budget', 'average_3_months', 'none')
    OR p_watch_percent NOT BETWEEN 50 AND 100
    OR p_resident_summary IS NULL
  THEN
    RAISE EXCEPTION 'Choose valid budget settings.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense' FOR UPDATE;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Expense settings changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  UPDATE public.module_configs SET
    settings = settings || jsonb_build_object(
      'budget_forecast_method', p_forecast_method,
      'budget_watch_percent', p_watch_percent,
      'budget_resident_summary', p_resident_summary
    ),
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'expense'
  RETURNING * INTO saved;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.settings.update',
    'module_config', 'expense',
    jsonb_build_object(
      'budget_forecast_method',
      coalesce(previous.settings ->> 'budget_forecast_method', 'budget'),
      'budget_resident_summary',
      coalesce((previous.settings ->> 'budget_resident_summary')::boolean, true),
      'budget_watch_percent',
      coalesce((previous.settings ->> 'budget_watch_percent')::integer, 90)
    ),
    jsonb_build_object(
      'budget_forecast_method', p_forecast_method,
      'budget_resident_summary', p_resident_summary,
      'budget_watch_percent', p_watch_percent
    ),
    p_request_trace
  );
  RETURN jsonb_build_object('updated_at', saved.updated_at);
END;
$$;

CREATE FUNCTION public.expense_budget_save_draft(
  p_society_id uuid,
  p_financial_year integer,
  p_lines jsonb,
  p_copy_source_year integer,
  p_copy_percent_bp integer,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  previous_id uuid;
  line record;
  payload jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  payload := jsonb_build_object(
    'financial_year', p_financial_year,
    'lines', p_lines,
    'copy_source_year', p_copy_source_year,
    'copy_percent_bp', p_copy_percent_bp,
    'expected_version', p_expected_version
  );
  SELECT private.expense_control_request_result(
    p_society_id, 'budget.save_draft', payload, p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  IF p_financial_year NOT BETWEEN 2000 AND 2100
    OR jsonb_typeof(p_lines) <> 'array'
    OR jsonb_array_length(p_lines) > 500
    OR (p_copy_source_year IS NOT NULL AND p_copy_source_year <> p_financial_year - 1)
    OR (p_copy_percent_bp IS NOT NULL
      AND p_copy_percent_bp NOT BETWEEN -5000 AND 10000)
  THEN
    RAISE EXCEPTION 'Check the budget lines and year.' USING ERRCODE = '22023';
  END IF;
  IF (p_copy_source_year IS NULL) <> (p_copy_percent_bp IS NULL) THEN
    RAISE EXCEPTION 'Copy details are incomplete.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id AND financial_year = p_financial_year
    AND status <> 'discarded'
  FOR UPDATE;
  IF FOUND THEN
    IF budget.status <> 'draft' THEN
      RAISE EXCEPTION 'An approved budget cannot be edited.' USING ERRCODE = '55000';
    END IF;
    IF budget.version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Budget changed. Refresh before saving.' USING ERRCODE = '23505';
    END IF;
  ELSIF p_expected_version IS NOT NULL THEN
    RAISE EXCEPTION 'Refresh the budget before saving.' USING ERRCODE = '23505';
  END IF;
  FOR line IN
    SELECT
      CASE WHEN item ->> 'category_id' = '' THEN NULL
        ELSE (item ->> 'category_id')::uuid END AS category_id,
      nullif(item ->> 'income_type', '') AS income_type,
      item ->> 'phasing' AS phasing,
      (item ->> 'annual_paise')::bigint AS annual_paise,
      ARRAY(
        SELECT value::bigint
        FROM jsonb_array_elements_text(item -> 'month_paise') AS value
      )::bigint[] AS month_paise
    FROM jsonb_array_elements(p_lines) AS item
  LOOP
    IF ((line.category_id IS NULL) = (line.income_type IS NULL))
      OR (line.income_type IS NOT NULL AND line.income_type NOT IN (
        'billing', 'donation', 'interest', 'other'
      ))
      OR line.phasing NOT IN (
        'equal_monthly', 'quarterly', 'half_yearly', 'first_month', 'custom'
      )
      OR private.expense_budget_spread(
        line.annual_paise, line.phasing, line.month_paise
      ) IS NULL
      OR (line.category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.expense_categories
        WHERE society_id = p_society_id AND id = line.category_id
      ))
    THEN
      RAISE EXCEPTION 'A budget line is invalid.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (
    SELECT count(*)
    FROM (
      SELECT
        (item ->> 'category_id') AS category_id,
        (item ->> 'income_type') AS income_type
      FROM jsonb_array_elements(p_lines) AS item
    ) AS submitted
  ) <> (
    SELECT count(*)
    FROM (
      SELECT DISTINCT
        (item ->> 'category_id') AS category_id,
        (item ->> 'income_type') AS income_type
      FROM jsonb_array_elements(p_lines) AS item
    ) AS distinct_submitted
  ) THEN
    RAISE EXCEPTION 'A budget head appears more than once.' USING ERRCODE = '22023';
  END IF;
  IF budget.id IS NULL THEN
    INSERT INTO public.expense_budgets (
      society_id, financial_year, copy_source_year, copy_percent_bp,
      client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, p_financial_year, p_copy_source_year, p_copy_percent_bp,
      p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO budget;
  ELSE
    DELETE FROM public.expense_budget_lines
    WHERE society_id = p_society_id AND budget_id = budget.id;
    UPDATE public.expense_budgets SET
      copy_source_year = p_copy_source_year,
      copy_percent_bp = p_copy_percent_bp,
      version = version + 1,
      updated_by = auth.uid()
    WHERE id = budget.id
    RETURNING * INTO budget;
  END IF;
  INSERT INTO public.expense_budget_lines (
    society_id, budget_id, category_id, income_type, phasing,
    annual_paise, month_paise, created_by
  )
  SELECT
    p_society_id,
    budget.id,
    CASE WHEN item ->> 'category_id' = '' THEN NULL
      ELSE (item ->> 'category_id')::uuid END,
    nullif(item ->> 'income_type', ''),
    item ->> 'phasing',
    (item ->> 'annual_paise')::bigint,
    ARRAY(
      SELECT value::bigint
      FROM jsonb_array_elements_text(item -> 'month_paise') AS value
    ),
    auth.uid()
  FROM jsonb_array_elements(p_lines) AS item;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.budget.save',
    'expense_budget', budget.id,
    jsonb_build_object(
      'financial_year', p_financial_year,
      'line_count', jsonb_array_length(p_lines),
      'version', budget.version
    ),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'budget.save_draft', payload, p_client_request_id, budget.id
  );
  RETURN budget.id;
END;
$$;

CREATE FUNCTION public.expense_budget_discard(
  p_society_id uuid,
  p_budget_id uuid,
  p_reason text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  previous_id uuid;
  payload jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  payload := jsonb_build_object(
    'budget_id', p_budget_id, 'reason', p_reason,
    'expected_version', p_expected_version
  );
  SELECT private.expense_control_request_result(
    p_society_id, 'budget.discard', payload, p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id AND id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget not found.' USING ERRCODE = 'P0002';
  END IF;
  IF budget.status <> 'draft' OR budget.version IS DISTINCT FROM p_expected_version
    OR p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 5 AND 500
  THEN
    RAISE EXCEPTION 'Only an unchanged draft can be discarded with a reason.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.expense_budgets SET
    status = 'discarded',
    discarded_by = auth.uid(),
    discarded_at = clock_timestamp(),
    discard_reason = p_reason,
    version = version + 1,
    updated_by = auth.uid()
  WHERE id = p_budget_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.budget.discard',
    'expense_budget', p_budget_id,
    jsonb_build_object('status', 'draft', 'version', budget.version),
    jsonb_build_object('status', 'discarded', 'reason', p_reason),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'budget.discard', payload, p_client_request_id, p_budget_id
  );
  RETURN p_budget_id;
END;
$$;

CREATE FUNCTION public.expense_budget_approve(
  p_society_id uuid,
  p_budget_id uuid,
  p_approved_body text,
  p_approved_on date,
  p_approval_meeting_id uuid,
  p_approval_document_id uuid,
  p_approval_note text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  previous_id uuid;
  payload jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  payload := jsonb_build_object(
    'budget_id', p_budget_id,
    'approved_body', p_approved_body,
    'approved_on', p_approved_on,
    'approval_meeting_id', p_approval_meeting_id,
    'approval_document_id', p_approval_document_id,
    'approval_note', p_approval_note,
    'expected_version', p_expected_version
  );
  SELECT private.expense_control_request_result(
    p_society_id, 'budget.approve', payload, p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  PERFORM private.expense_budget_validate_approval(
    p_society_id, p_approved_body, p_approved_on,
    p_approval_meeting_id, p_approval_document_id, p_approval_note
  );
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id AND id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget not found.' USING ERRCODE = 'P0002';
  END IF;
  IF budget.status <> 'draft' OR budget.version IS DISTINCT FROM p_expected_version
  THEN
    RAISE EXCEPTION 'Only an unchanged draft can be approved.'
      USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_budget_lines
    WHERE society_id = p_society_id AND budget_id = p_budget_id
  ) THEN
    RAISE EXCEPTION 'Add at least one budget line before approval.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.expense_budgets SET
    status = 'approved',
    approved_body = p_approved_body,
    approved_on = p_approved_on,
    approval_meeting_id = p_approval_meeting_id,
    approval_document_id = p_approval_document_id,
    approval_note = p_approval_note,
    approved_by = auth.uid(),
    approved_at = clock_timestamp(),
    version = version + 1,
    updated_by = auth.uid()
  WHERE id = p_budget_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.budget.approve',
    'expense_budget', p_budget_id,
    jsonb_build_object('status', 'draft', 'version', budget.version),
    jsonb_build_object(
      'status', 'approved', 'approved_body', p_approved_body,
      'approved_on', p_approved_on
    ),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'budget.approve', payload, p_client_request_id, p_budget_id
  );
  RETURN p_budget_id;
END;
$$;

CREATE FUNCTION public.expense_budget_change_record(
  p_society_id uuid,
  p_budget_id uuid,
  p_change_kind text,
  p_category_id uuid,
  p_income_type text,
  p_to_category_id uuid,
  p_to_income_type text,
  p_amount_paise bigint,
  p_effective_month integer,
  p_reason text,
  p_approved_body text,
  p_approved_on date,
  p_approval_meeting_id uuid,
  p_approval_document_id uuid,
  p_approval_note text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  previous_id uuid;
  payload jsonb;
  pair_id uuid;
  result_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  payload := jsonb_build_object(
    'budget_id', p_budget_id,
    'change_kind', p_change_kind,
    'category_id', p_category_id,
    'income_type', p_income_type,
    'to_category_id', p_to_category_id,
    'to_income_type', p_to_income_type,
    'amount_paise', p_amount_paise,
    'effective_month', p_effective_month,
    'reason', p_reason,
    'approved_body', p_approved_body,
    'approved_on', p_approved_on,
    'approval_meeting_id', p_approval_meeting_id,
    'approval_document_id', p_approval_document_id,
    'approval_note', p_approval_note,
    'expected_version', p_expected_version
  );
  SELECT private.expense_control_request_result(
    p_society_id, 'budget.change_record', payload, p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  PERFORM private.expense_budget_validate_approval(
    p_society_id, p_approved_body, p_approved_on,
    p_approval_meeting_id, p_approval_document_id, p_approval_note
  );
  IF p_change_kind NOT IN ('increase', 'decrease', 'move')
    OR ((p_category_id IS NULL) = (p_income_type IS NULL))
    OR (p_income_type IS NOT NULL AND p_income_type NOT IN (
      'billing', 'donation', 'interest', 'other'
    ))
    OR (p_change_kind = 'move'
      AND ((p_to_category_id IS NULL) = (p_to_income_type IS NULL)))
    OR (
      p_change_kind = 'move'
      AND p_category_id IS NOT DISTINCT FROM p_to_category_id
      AND p_income_type IS NOT DISTINCT FROM p_to_income_type
    )
    OR (p_to_income_type IS NOT NULL AND p_to_income_type NOT IN (
      'billing', 'donation', 'interest', 'other'
    ))
    OR (p_change_kind <> 'move'
      AND (p_to_category_id IS NOT NULL OR p_to_income_type IS NOT NULL))
    OR p_amount_paise IS NULL OR p_amount_paise < 100
      OR p_amount_paise > 999999999999999 OR p_amount_paise % 100 <> 0
    OR p_effective_month NOT BETWEEN 1 AND 12
    OR p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 5 AND 500
  THEN
    RAISE EXCEPTION 'Record a valid budget change.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id AND id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget not found.' USING ERRCODE = 'P0002';
  END IF;
  IF budget.status <> 'approved'
    OR budget.version IS DISTINCT FROM p_expected_version
  THEN
    RAISE EXCEPTION 'Only an unchanged approved budget accepts changes.'
      USING ERRCODE = '23505';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories
    WHERE society_id = p_society_id AND id = p_category_id
  ) OR p_to_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories
    WHERE society_id = p_society_id AND id = p_to_category_id
  ) THEN
    RAISE EXCEPTION 'Budget category not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_change_kind IN ('decrease', 'move') THEN
    IF EXISTS (
      SELECT 1
      FROM generate_series(p_effective_month, 12) AS month_number
      LEFT JOIN public.expense_budget_lines AS line
        ON line.society_id = p_society_id
        AND line.budget_id = p_budget_id
        AND line.category_id IS NOT DISTINCT FROM p_category_id
        AND line.income_type IS NOT DISTINCT FROM p_income_type
      WHERE coalesce(line.month_paise[month_number], 0)
        + coalesce((
          SELECT sum(
            CASE WHEN change.direction = 'increase'
              THEN change.month_paise[month_number]
              ELSE -change.month_paise[month_number]
            END
          )
          FROM public.expense_budget_changes AS change
          WHERE change.society_id = p_society_id
            AND change.budget_id = p_budget_id
            AND change.category_id IS NOT DISTINCT FROM p_category_id
            AND change.income_type IS NOT DISTINCT FROM p_income_type
            AND change.voided_at IS NULL
        ), 0)
        < (
          private.expense_budget_change_spread(
            p_amount_paise, p_effective_month
          )
        )[month_number]
    ) THEN
      RAISE EXCEPTION 'The decrease would leave a budget month below zero.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  pair_id := CASE WHEN p_change_kind = 'move'
    THEN extensions.gen_random_uuid() ELSE NULL END;
  INSERT INTO public.expense_budget_changes (
    society_id, budget_id, category_id, income_type, direction,
    amount_paise, effective_month, month_paise, reason,
    approved_body, approved_on, approval_meeting_id, approval_document_id,
    approval_note, approved_by, pair_id, client_request_id, created_by
  ) VALUES (
    p_society_id, p_budget_id, p_category_id, p_income_type,
    CASE WHEN p_change_kind IN ('increase') THEN 'increase' ELSE 'decrease' END,
    p_amount_paise, p_effective_month,
    private.expense_budget_change_spread(p_amount_paise, p_effective_month),
    p_reason, p_approved_body, p_approved_on,
    p_approval_meeting_id, p_approval_document_id, p_approval_note,
    auth.uid(), pair_id, p_client_request_id, auth.uid()
  ) RETURNING id INTO result_id;
  IF p_change_kind = 'move' THEN
    INSERT INTO public.expense_budget_changes (
      society_id, budget_id, category_id, income_type, direction,
      amount_paise, effective_month, month_paise, reason,
      approved_body, approved_on, approval_meeting_id, approval_document_id,
      approval_note, approved_by, pair_id, client_request_id, created_by
    ) VALUES (
      p_society_id, p_budget_id, p_to_category_id, p_to_income_type, 'increase',
      p_amount_paise, p_effective_month,
      private.expense_budget_change_spread(p_amount_paise, p_effective_month),
      p_reason, p_approved_body, p_approved_on,
      p_approval_meeting_id, p_approval_document_id, p_approval_note,
      auth.uid(), pair_id, p_client_request_id, auth.uid()
    );
  END IF;
  UPDATE public.expense_budgets SET
    version = version + 1, updated_by = auth.uid()
  WHERE id = p_budget_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.budget.change',
    'expense_budget_change', result_id,
    jsonb_build_object(
      'budget_id', p_budget_id,
      'change_kind', p_change_kind,
      'amount_paise', p_amount_paise,
      'pair_id', pair_id
    ),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'budget.change_record', payload,
    p_client_request_id, result_id
  );
  RETURN result_id;
END;
$$;

CREATE FUNCTION public.expense_budget_change_void(
  p_society_id uuid,
  p_change_id uuid,
  p_reason text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  selected public.expense_budget_changes;
  budget public.expense_budgets;
  previous_id uuid;
  payload jsonb;
  affected_change public.expense_budget_changes;
  remaining bigint;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  payload := jsonb_build_object(
    'change_id', p_change_id, 'reason', p_reason,
    'expected_version', p_expected_version
  );
  SELECT private.expense_control_request_result(
    p_society_id, 'budget.change_void', payload, p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  SELECT * INTO selected FROM public.expense_budget_changes
  WHERE society_id = p_society_id AND id = p_change_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget change not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id AND id = selected.budget_id FOR UPDATE;
  IF budget.status <> 'approved'
    OR budget.version IS DISTINCT FROM p_expected_version
    OR selected.voided_at IS NOT NULL
    OR p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 5 AND 500
  THEN
    RAISE EXCEPTION 'Only an unchanged active change can be cancelled.'
      USING ERRCODE = '23505';
  END IF;
  FOR affected_change IN
    SELECT change.* FROM public.expense_budget_changes AS change
    WHERE change.society_id = p_society_id
      AND (
        (selected.pair_id IS NULL AND change.id = selected.id)
        OR (selected.pair_id IS NOT NULL AND change.pair_id = selected.pair_id)
      )
      AND change.voided_at IS NULL
  LOOP
    SELECT min(
      coalesce(line.month_paise[month_number], 0)
      + coalesce((
        SELECT sum(
          CASE WHEN active.direction = 'increase'
            THEN active.month_paise[month_number]
            ELSE -active.month_paise[month_number]
          END
        )
        FROM public.expense_budget_changes AS active
        WHERE active.society_id = p_society_id
          AND active.budget_id = budget.id
          AND active.category_id IS NOT DISTINCT FROM affected_change.category_id
          AND active.income_type IS NOT DISTINCT FROM affected_change.income_type
          AND active.voided_at IS NULL
          AND (
            selected.pair_id IS NULL AND active.id <> selected.id
            OR selected.pair_id IS NOT NULL
              AND active.pair_id IS DISTINCT FROM selected.pair_id
          )
      ), 0)
    )
    INTO remaining
    FROM generate_series(1, 12) AS month_number
    LEFT JOIN public.expense_budget_lines AS line
      ON line.society_id = p_society_id
      AND line.budget_id = budget.id
      AND line.category_id IS NOT DISTINCT FROM affected_change.category_id
      AND line.income_type IS NOT DISTINCT FROM affected_change.income_type;
    IF remaining < 0 AND affected_change.direction = 'increase' THEN
      RAISE EXCEPTION 'Cancelling the change would leave a head below zero.'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  UPDATE public.expense_budget_changes SET
    voided_by = auth.uid(), voided_at = clock_timestamp(), void_reason = p_reason
  WHERE society_id = p_society_id
    AND (
      (selected.pair_id IS NULL AND id = selected.id)
      OR (selected.pair_id IS NOT NULL AND pair_id = selected.pair_id)
    )
    AND voided_at IS NULL;
  UPDATE public.expense_budgets SET
    version = version + 1, updated_by = auth.uid()
  WHERE id = budget.id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.budget.change_void',
    'expense_budget_change', p_change_id,
    jsonb_build_object('voided', false, 'pair_id', selected.pair_id),
    jsonb_build_object('voided', true, 'reason', p_reason),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'budget.change_void', payload, p_client_request_id, p_change_id
  );
  RETURN p_change_id;
END;
$$;

REVOKE ALL ON FUNCTION public.expense_budget_copy_preview(uuid, integer, integer),
  public.expense_budget_get(uuid, integer),
  public.expense_budget_report(uuid, integer, date),
  public.expense_budget_resident_summary(uuid, integer),
  public.expense_budget_settings_update(
    uuid, text, integer, boolean, timestamptz, text
  ),
  public.expense_budget_save_draft(uuid, integer, jsonb, integer, integer, integer, uuid, text),
  public.expense_budget_discard(uuid, uuid, text, integer, uuid, text),
  public.expense_budget_approve(uuid, uuid, text, date, uuid, uuid, text, integer, uuid, text),
  public.expense_budget_change_record(
    uuid, uuid, text, uuid, text, uuid, text, bigint, integer, text,
    text, date, uuid, uuid, text, integer, uuid, text
  ),
  public.expense_budget_change_void(uuid, uuid, text, integer, uuid, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.expense_budget_copy_preview(uuid, integer, integer),
  public.expense_budget_get(uuid, integer),
  public.expense_budget_report(uuid, integer, date),
  public.expense_budget_resident_summary(uuid, integer),
  public.expense_budget_settings_update(
    uuid, text, integer, boolean, timestamptz, text
  ),
  public.expense_budget_save_draft(uuid, integer, jsonb, integer, integer, integer, uuid, text),
  public.expense_budget_discard(uuid, uuid, text, integer, uuid, text),
  public.expense_budget_approve(uuid, uuid, text, date, uuid, uuid, text, integer, uuid, text),
  public.expense_budget_change_record(
    uuid, uuid, text, uuid, text, uuid, text, bigint, integer, text,
    text, date, uuid, uuid, text, integer, uuid, text
  ),
  public.expense_budget_change_void(uuid, uuid, text, integer, uuid, text)
TO authenticated;
