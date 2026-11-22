-- Add P40.7 bank-provided interest/TDS records and Accounts comparison.
CREATE TABLE public.expense_fund_interest_records (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  fund_id uuid NOT NULL,
  fixed_deposit_id uuid,
  income_entry_id uuid,
  source_label text NOT NULL
    CHECK (source_label = btrim(source_label) AND char_length(source_label) BETWEEN 1 AND 120),
  period_from date NOT NULL,
  period_to date NOT NULL CHECK (period_to > period_from),
  gross_interest_paise bigint
    CHECK (gross_interest_paise BETWEEN 0 AND 9007199254740991),
  tax_withheld_paise bigint
    CHECK (tax_withheld_paise BETWEEN 0 AND 9007199254740991),
  actual_credit_paise bigint
    CHECK (actual_credit_paise BETWEEN 0 AND 9007199254740991),
  average_balance_paise bigint
    CHECK (average_balance_paise BETWEEN 1 AND 9007199254740991),
  note text CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_interest_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_interest_deposit_fkey
    FOREIGN KEY (society_id, fixed_deposit_id)
    REFERENCES public.expense_fixed_deposits (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_interest_entry_fkey
    FOREIGN KEY (society_id, income_entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_interest_amounts_check CHECK (
    tax_withheld_paise IS NULL OR gross_interest_paise IS NULL
      OR tax_withheld_paise <= gross_interest_paise
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, income_entry_id)
);
CREATE INDEX expense_fund_interest_fund_idx
  ON public.expense_fund_interest_records (society_id, fund_id, period_to DESC);
CREATE INDEX expense_fund_interest_deposit_idx
  ON public.expense_fund_interest_records (society_id, fixed_deposit_id);
CREATE INDEX expense_fund_interest_created_by_idx
  ON public.expense_fund_interest_records (created_by);
CREATE INDEX expense_fund_interest_updated_by_idx
  ON public.expense_fund_interest_records (updated_by);
CREATE TRIGGER expense_fund_interest_set_updated_at
  BEFORE UPDATE ON public.expense_fund_interest_records
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.expense_fund_interest_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_fund_interest_records
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_fund_interest_records_no_direct_access
  ON public.expense_fund_interest_records FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION public.expense_fund_interest_save(
  p_society_id uuid,
  p_record_id uuid,
  p_fund_id uuid,
  p_fixed_deposit_id uuid,
  p_income_entry_id uuid,
  p_source_label text,
  p_period_from date,
  p_period_to date,
  p_gross_interest_paise bigint,
  p_tax_withheld_paise bigint,
  p_actual_credit_paise bigint,
  p_average_balance_paise bigint,
  p_note text,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_interest_records;
  saved_id uuid;
  clean_source text := btrim(p_source_label);
  clean_note text := NULLIF(btrim(p_note), '');
  linked_entry public.expense_book_entries;
  linked_deposit public.expense_fixed_deposits;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_source IS NULL OR char_length(clean_source) NOT BETWEEN 1 AND 120
    OR char_length(clean_note) > 2000
    OR p_period_from IS NULL OR p_period_to IS NULL OR p_period_to <= p_period_from
    OR p_gross_interest_paise IS NOT NULL
      AND p_gross_interest_paise NOT BETWEEN 0 AND 9007199254740991
    OR p_tax_withheld_paise IS NOT NULL
      AND p_tax_withheld_paise NOT BETWEEN 0 AND 9007199254740991
    OR p_actual_credit_paise IS NOT NULL
      AND p_actual_credit_paise NOT BETWEEN 0 AND 9007199254740991
    OR p_average_balance_paise IS NOT NULL
      AND p_average_balance_paise NOT BETWEEN 1 AND 9007199254740991
    OR (p_tax_withheld_paise IS NOT NULL AND p_gross_interest_paise IS NOT NULL
      AND p_tax_withheld_paise > p_gross_interest_paise)
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    )
  THEN
    RAISE EXCEPTION 'Check the interest and TDS details.' USING ERRCODE = '22023';
  END IF;
  IF p_fixed_deposit_id IS NOT NULL THEN
    SELECT * INTO linked_deposit FROM public.expense_fixed_deposits
    WHERE society_id = p_society_id AND id = p_fixed_deposit_id;
    IF NOT FOUND OR linked_deposit.fund_id <> p_fund_id THEN
      RAISE EXCEPTION 'Choose a deposit from the same fund.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_income_entry_id IS NOT NULL THEN
    SELECT * INTO linked_entry FROM public.expense_book_entries
    WHERE society_id = p_society_id AND id = p_income_entry_id;
    IF NOT FOUND OR linked_entry.source <> 'income'
      OR linked_entry.income_kind <> 'interest'
      OR linked_entry.direction <> 'in'
    THEN
      RAISE EXCEPTION 'Link a posted Accounts interest income.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_record_id IS NULL THEN
    INSERT INTO public.expense_fund_interest_records (
      society_id, fund_id, fixed_deposit_id, income_entry_id, source_label,
      period_from, period_to, gross_interest_paise, tax_withheld_paise,
      actual_credit_paise, average_balance_paise, note, created_by
    ) VALUES (
      p_society_id, p_fund_id, p_fixed_deposit_id, p_income_entry_id,
      clean_source, p_period_from, p_period_to, p_gross_interest_paise,
      p_tax_withheld_paise, p_actual_credit_paise, p_average_balance_paise,
      clean_note, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_fund_interest_records
    WHERE society_id = p_society_id AND id = p_record_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Interest record not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The interest record changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.expense_fund_interest_records
    SET fund_id = p_fund_id, fixed_deposit_id = p_fixed_deposit_id,
      income_entry_id = p_income_entry_id, source_label = clean_source,
      period_from = p_period_from, period_to = p_period_to,
      gross_interest_paise = p_gross_interest_paise,
      tax_withheld_paise = p_tax_withheld_paise,
      actual_credit_paise = p_actual_credit_paise,
      average_balance_paise = p_average_balance_paise, note = clean_note
    WHERE society_id = p_society_id AND id = p_record_id;
    saved_id := p_record_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_interest.save',
    'expense_fund_interest', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object(
      'gross_interest_paise', previous.gross_interest_paise,
      'tax_withheld_paise', previous.tax_withheld_paise,
      'actual_credit_paise', previous.actual_credit_paise,
      'income_entry_id', previous.income_entry_id
    ) END,
    jsonb_build_object(
      'fund_id', p_fund_id, 'fixed_deposit_id', p_fixed_deposit_id,
      'income_entry_id', p_income_entry_id, 'source_label', clean_source,
      'period_from', p_period_from, 'period_to', p_period_to,
      'gross_interest_paise', p_gross_interest_paise,
      'tax_withheld_paise', p_tax_withheld_paise,
      'actual_credit_paise', p_actual_credit_paise,
      'average_balance_paise', p_average_balance_paise
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_interest_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'interest_entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entry_id', entry.id,
        'voucher_no', private.expense_voucher_label(
          voucher.voucher_type, voucher.financial_year, voucher.sequence
        ),
        'entry_date', entry.entry_date,
        'counterparty', entry.counterparty,
        'amount_paise', entry.amount_paise
      ) ORDER BY entry.entry_date DESC, entry.created_at DESC)
      FROM public.expense_book_entries AS entry
      JOIN public.expense_vouchers AS voucher
        ON voucher.society_id = entry.society_id AND voucher.entry_id = entry.id
      WHERE entry.society_id = p_society_id
        AND entry.source = 'income' AND entry.income_kind = 'interest'
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_book_entries AS reversal
          WHERE reversal.society_id = entry.society_id
            AND reversal.reverses_entry_id = entry.id
        )
    ), '[]'::jsonb),
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', record.id,
        'fund_id', record.fund_id,
        'fund_name', fund.name,
        'fixed_deposit_id', record.fixed_deposit_id,
        'income_entry_id', record.income_entry_id,
        'source_label', record.source_label,
        'period_from', record.period_from,
        'period_to', record.period_to,
        'gross_interest_paise', record.gross_interest_paise,
        'tax_withheld_paise', record.tax_withheld_paise,
        'net_interest_paise', CASE WHEN record.gross_interest_paise IS NULL
            OR record.tax_withheld_paise IS NULL THEN NULL
          ELSE record.gross_interest_paise - record.tax_withheld_paise END,
        'actual_credit_paise', record.actual_credit_paise,
        'average_balance_paise', record.average_balance_paise,
        'accounts_income_paise', CASE WHEN record.income_entry_id IS NULL THEN NULL ELSE
          income.amount_paise - COALESCE((
            SELECT sum(reversal.amount_paise)
            FROM public.expense_book_entries AS reversal
            WHERE reversal.society_id = income.society_id
              AND reversal.reverses_entry_id = income.id
          ), 0)::bigint END,
        'credit_difference_paise', CASE
          WHEN record.actual_credit_paise IS NULL OR record.income_entry_id IS NULL THEN NULL
          ELSE record.actual_credit_paise - (
            income.amount_paise - COALESCE((
              SELECT sum(reversal.amount_paise)
              FROM public.expense_book_entries AS reversal
              WHERE reversal.society_id = income.society_id
                AND reversal.reverses_entry_id = income.id
            ), 0)::bigint
          ) END,
        'whole_months', (
          extract(year FROM age(record.period_to, record.period_from))::integer * 12
          + extract(month FROM age(record.period_to, record.period_from))::integer
        ),
        'annualised_yield_percent', CASE
          WHEN record.gross_interest_paise IS NULL
            OR record.average_balance_paise IS NULL
            OR extract(year FROM age(record.period_to, record.period_from)) * 12
              + extract(month FROM age(record.period_to, record.period_from)) < 1
          THEN NULL
          ELSE (
            record.gross_interest_paise::numeric / record.average_balance_paise
            * 12 / (
              extract(year FROM age(record.period_to, record.period_from)) * 12
              + extract(month FROM age(record.period_to, record.period_from))
            ) * 100
          )::numeric(10,4)
        END,
        'note', record.note,
        'updated_at', record.updated_at
      ) ORDER BY record.period_to DESC, record.created_at DESC)
      FROM public.expense_fund_interest_records AS record
      JOIN public.expense_funds AS fund
        ON fund.society_id = record.society_id AND fund.id = record.fund_id
      LEFT JOIN public.expense_book_entries AS income
        ON income.society_id = record.society_id AND income.id = record.income_entry_id
      WHERE record.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_interest_save(
    uuid, uuid, uuid, uuid, uuid, text, date, date, bigint, bigint, bigint,
    bigint, text, timestamptz, text
  ),
  public.expense_fund_interest_list(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_interest_save(
    uuid, uuid, uuid, uuid, uuid, text, date, date, bigint, bigint, bigint,
    bigint, text, timestamptz, text
  ),
  public.expense_fund_interest_list(uuid)
  TO authenticated;
