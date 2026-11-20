-- P39 accounts additions (D-69): voucher numbers, running balances, bank reconciliation,
-- petty cash custody and financial-year net flow. Nothing here posts a book entry.

-- Hold back new postings while existing entries are numbered.
LOCK TABLE public.expense_book_entries IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION private.expense_financial_year(p_day date)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT extract(year FROM p_day)::integer
    - CASE WHEN extract(month FROM p_day) < 4 THEN 1 ELSE 0 END
$$;
REVOKE ALL ON FUNCTION private.expense_financial_year(date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_voucher_label(
  p_type text, p_financial_year integer, p_sequence integer
)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT upper(p_type) || '/' || p_financial_year::text || '-'
    || lpad(((p_financial_year + 1) % 100)::text, 2, '0') || '/' || p_sequence::text
$$;
REVOKE ALL ON FUNCTION private.expense_voucher_label(text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- EXP-8: one permanent voucher per book entry, numbered per type and financial year.
CREATE TABLE public.expense_vouchers (
  entry_id uuid PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  voucher_type text NOT NULL CHECK (voucher_type IN ('rv', 'pv')),
  financial_year integer NOT NULL CHECK (financial_year BETWEEN 2000 AND 2999),
  sequence integer NOT NULL CHECK (sequence >= 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT expense_vouchers_entry_fkey FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, entry_id),
  UNIQUE (society_id, voucher_type, financial_year, sequence)
);
ALTER TABLE public.expense_vouchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_vouchers
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_vouchers_no_direct_access
  ON public.expense_vouchers FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

INSERT INTO public.expense_vouchers (
  entry_id, society_id, voucher_type, financial_year, sequence
)
SELECT numbered.id, numbered.society_id, numbered.voucher_type, numbered.financial_year,
  row_number() OVER (
    PARTITION BY numbered.society_id, numbered.voucher_type, numbered.financial_year
    ORDER BY numbered.entry_date, numbered.created_at, numbered.id
  )::integer
FROM (
  SELECT entry.id, entry.society_id, entry.entry_date, entry.created_at,
    CASE entry.direction WHEN 'in' THEN 'rv' ELSE 'pv' END AS voucher_type,
    private.expense_financial_year(entry.entry_date) AS financial_year
  FROM public.expense_book_entries AS entry
) AS numbered;

CREATE FUNCTION private.expense_vouchers_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Voucher numbers are permanent.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.expense_vouchers_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_vouchers_guard
  BEFORE UPDATE OR DELETE ON public.expense_vouchers
  FOR EACH ROW EXECUTE FUNCTION private.expense_vouchers_guard();
CREATE TRIGGER expense_vouchers_no_truncate
  BEFORE TRUNCATE ON public.expense_vouchers
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_vouchers_guard();

-- The BEFORE INSERT guard already holds the society's posting lock.
CREATE FUNCTION private.expense_assign_voucher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  kind text := CASE NEW.direction WHEN 'in' THEN 'rv' ELSE 'pv' END;
  entry_year integer := private.expense_financial_year(NEW.entry_date);
BEGIN
  INSERT INTO public.expense_vouchers (
    entry_id, society_id, voucher_type, financial_year, sequence
  )
  SELECT NEW.id, NEW.society_id, kind, entry_year, COALESCE(max(voucher.sequence), 0) + 1
  FROM public.expense_vouchers AS voucher
  WHERE voucher.society_id = NEW.society_id AND voucher.voucher_type = kind
    AND voucher.financial_year = entry_year;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_assign_voucher()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_book_entries_voucher
  AFTER INSERT ON public.expense_book_entries
  FOR EACH ROW EXECUTE FUNCTION private.expense_assign_voucher();

-- Lets statement matches require an entry on the same account.
ALTER TABLE public.expense_book_entries
  ADD CONSTRAINT expense_book_entries_account_entry_key UNIQUE (society_id, account_id, id);

-- EXP-9: manually entered bank statement lines. They never post entries.
CREATE TABLE public.expense_statement_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  statement_date date NOT NULL,
  reference text
    CHECK (reference = btrim(reference) AND char_length(reference) BETWEEN 1 AND 80),
  party text CHECK (party = btrim(party) AND char_length(party) BETWEEN 1 AND 120),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  status text NOT NULL DEFAULT 'unmatched'
    CHECK (status IN ('unmatched', 'matched', 'cancelled')),
  matched_entry_id uuid,
  cancel_reason text
    CHECK (cancel_reason = btrim(cancel_reason) AND char_length(cancel_reason) BETWEEN 1 AND 1000),
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decided_at timestamptz,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_statement_items_account_fkey FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_statement_items_entry_fkey
    FOREIGN KEY (society_id, account_id, matched_entry_id)
    REFERENCES public.expense_book_entries (society_id, account_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_statement_items_state_check CHECK (
    (status = 'unmatched' AND matched_entry_id IS NULL AND cancel_reason IS NULL
      AND decided_by IS NULL AND decided_at IS NULL)
    OR (status = 'matched' AND matched_entry_id IS NOT NULL AND cancel_reason IS NULL
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    OR (status = 'cancelled' AND matched_entry_id IS NULL AND cancel_reason IS NOT NULL
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_statement_items_account_idx
  ON public.expense_statement_items (society_id, account_id, statement_date DESC);
CREATE UNIQUE INDEX expense_statement_items_matched_entry_key
  ON public.expense_statement_items (society_id, matched_entry_id)
  WHERE status = 'matched';
CREATE INDEX expense_statement_items_created_by_idx
  ON public.expense_statement_items (created_by);
CREATE INDEX expense_statement_items_updated_by_idx
  ON public.expense_statement_items (updated_by);
CREATE INDEX expense_statement_items_decided_by_idx
  ON public.expense_statement_items (decided_by);
CREATE TRIGGER expense_statement_items_set_updated_at
  BEFORE UPDATE ON public.expense_statement_items
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE FUNCTION private.expense_statement_items_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Statement items are kept. Cancel an item instead.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.expense_statement_items_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_statement_items_no_delete
  BEFORE DELETE ON public.expense_statement_items
  FOR EACH ROW EXECUTE FUNCTION private.expense_statement_items_guard();
CREATE TRIGGER expense_statement_items_no_truncate
  BEFORE TRUNCATE ON public.expense_statement_items
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_statement_items_guard();

-- EXP-10: one petty-cash account, its custodian history and physical cash counts.
ALTER TABLE public.expense_accounts
  ADD COLUMN is_petty_cash boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT expense_accounts_petty_cash_check
    CHECK (NOT is_petty_cash OR account_type = 'cash');
CREATE UNIQUE INDEX expense_accounts_one_petty_cash_key
  ON public.expense_accounts (society_id) WHERE is_petty_cash;

CREATE TABLE public.expense_cash_counts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  count_date date NOT NULL,
  counted_paise bigint NOT NULL CHECK (counted_paise BETWEEN 0 AND 9007199254740991),
  book_paise bigint NOT NULL
    CHECK (book_paise BETWEEN -9007199254740991 AND 9007199254740991),
  note text CHECK (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500),
  kind text NOT NULL CHECK (kind IN ('routine', 'handover')),
  counted_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT expense_cash_counts_account_fkey FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, counted_by, client_request_id)
);
CREATE INDEX expense_cash_counts_account_idx
  ON public.expense_cash_counts (society_id, account_id, count_date DESC, created_at DESC);
CREATE INDEX expense_cash_counts_counted_by_idx ON public.expense_cash_counts (counted_by);

CREATE FUNCTION private.expense_cash_counts_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Cash counts are permanent. Record a new count instead.'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.expense_cash_counts_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_cash_counts_guard
  BEFORE UPDATE OR DELETE ON public.expense_cash_counts
  FOR EACH ROW EXECUTE FUNCTION private.expense_cash_counts_guard();
CREATE TRIGGER expense_cash_counts_no_truncate
  BEFORE TRUNCATE ON public.expense_cash_counts
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_cash_counts_guard();

CREATE TABLE public.expense_petty_cash_custodians (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  custodian_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ended_at timestamptz,
  count_id uuid,
  CONSTRAINT expense_petty_cash_custodians_account_fkey FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_petty_cash_custodians_count_fkey FOREIGN KEY (society_id, count_id)
    REFERENCES public.expense_cash_counts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_petty_cash_custodians_dates_check
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX expense_petty_cash_custodians_open_key
  ON public.expense_petty_cash_custodians (society_id) WHERE ended_at IS NULL;
CREATE INDEX expense_petty_cash_custodians_history_idx
  ON public.expense_petty_cash_custodians (society_id, started_at DESC);
CREATE INDEX expense_petty_cash_custodians_account_idx
  ON public.expense_petty_cash_custodians (society_id, account_id);
CREATE INDEX expense_petty_cash_custodians_user_idx
  ON public.expense_petty_cash_custodians (custodian_user_id);
CREATE INDEX expense_petty_cash_custodians_started_by_idx
  ON public.expense_petty_cash_custodians (started_by);
CREATE INDEX expense_petty_cash_custodians_count_idx
  ON public.expense_petty_cash_custodians (society_id, count_id);

ALTER TABLE public.expense_statement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_petty_cash_custodians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_statement_items, public.expense_cash_counts,
  public.expense_petty_cash_custodians
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_statement_items_no_direct_access
  ON public.expense_statement_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_cash_counts_no_direct_access
  ON public.expense_cash_counts FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_petty_cash_custodians_no_direct_access
  ON public.expense_petty_cash_custodians FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- The custodian must still be an active member for custody rights to apply.
CREATE FUNCTION private.expense_is_custodian(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.expense_petty_cash_custodians AS custodian
    JOIN public.memberships AS membership
      ON membership.society_id = custodian.society_id
      AND membership.user_id = custodian.custodian_user_id
      AND membership.status = 'active'
    WHERE custodian.society_id = p_society_id AND custodian.ended_at IS NULL
      AND custodian.custodian_user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION private.expense_is_custodian(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- EXP-7: running balances are calculated per request from the whole account history.
CREATE OR REPLACE FUNCTION public.expense_entries_page(
  p_society_id uuid, p_from date, p_to date, p_account_id uuid,
  p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
  THEN
    RAISE EXCEPTION 'Check the page request.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.expense_book_entries
      WHERE society_id = p_society_id AND entry_date BETWEEN p_from AND p_to
        AND (p_account_id IS NULL OR account_id = p_account_id)
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC, sort_id)
      FROM (
        WITH running AS (
          SELECT entry.id,
            account.opening_balance_paise + sum(
              CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END
            ) OVER (
              ORDER BY entry.entry_date, entry.created_at, entry.id
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS balance_paise
          FROM public.expense_book_entries AS entry
          JOIN public.expense_accounts AS account
            ON account.society_id = entry.society_id AND account.id = entry.account_id
          WHERE p_account_id IS NOT NULL AND entry.society_id = p_society_id
            AND entry.account_id = p_account_id
        )
        SELECT entry.entry_date AS sort_date, entry.created_at AS sort_created,
          entry.id AS sort_id,
          jsonb_build_object(
            'id', entry.id, 'entry_date', entry.entry_date, 'direction', entry.direction,
            'amount_paise', entry.amount_paise, 'source', entry.source,
            'account_id', entry.account_id, 'account_name', account.name,
            'category_name', category.name, 'income_kind', entry.income_kind,
            'counterparty', entry.counterparty, 'reference', entry.reference,
            'description', entry.description, 'expense_id', entry.expense_id,
            'receipt_path', expense.receipt_path,
            'reverses_entry_id', entry.reverses_entry_id,
            'reversed_by_entry_id', reversal.id,
            'month_closed', private.expense_month_closed(p_society_id, entry.entry_date),
            'voucher_no', private.expense_voucher_label(
              voucher.voucher_type, voucher.financial_year, voucher.sequence
            ),
            'running_balance_paise', running.balance_paise::bigint
          ) AS row_data
        FROM public.expense_book_entries AS entry
        JOIN public.expense_accounts AS account
          ON account.society_id = entry.society_id AND account.id = entry.account_id
        JOIN public.expense_vouchers AS voucher
          ON voucher.society_id = entry.society_id AND voucher.entry_id = entry.id
        LEFT JOIN running ON running.id = entry.id
        LEFT JOIN public.expense_categories AS category
          ON category.society_id = entry.society_id AND category.id = entry.category_id
        LEFT JOIN public.expenses AS expense
          ON expense.society_id = entry.society_id AND expense.id = entry.expense_id
        LEFT JOIN public.expense_book_entries AS reversal
          ON reversal.society_id = entry.society_id AND reversal.reverses_entry_id = entry.id
        WHERE entry.society_id = p_society_id
          AND entry.entry_date BETWEEN p_from AND p_to
          AND (p_account_id IS NULL OR entry.account_id = p_account_id)
        ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb)
  );
END;
$$;

-- EXP-11: every month in the range, with net flow and the financial-year-to-date net.
CREATE OR REPLACE FUNCTION public.expense_report(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  billing_enabled boolean;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731 THEN
    RAISE EXCEPTION 'Choose a valid date range.' USING ERRCODE = '22023';
  END IF;
  billing_enabled := private.module_enabled(p_society_id, 'billing');
  RETURN (
    WITH classified AS (
      SELECT entry.entry_date,
        (entry.entry_date - (extract(day FROM entry.entry_date)::integer - 1)) AS month,
        entry.category_id,
        CASE
          WHEN entry.category_id IS NOT NULL THEN NULL
          WHEN entry.source = 'billing_payment' THEN 'billing'
          ELSE entry.income_kind
        END AS income_kind,
        CASE WHEN entry.category_id IS NOT NULL THEN
          CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END
        ELSE 0 END AS expense_paise,
        CASE WHEN entry.category_id IS NULL THEN
          CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END
        ELSE 0 END AS income_paise
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id AND entry.entry_date BETWEEN p_from AND p_to
    ),
    month_list AS (
      SELECT series::date AS month,
        make_date(private.expense_financial_year(series::date), 4, 1) AS year_start
      FROM generate_series(
        date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp),
        interval '1 month'
      ) AS series
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'income_paise', COALESCE((SELECT sum(income_paise) FROM classified), 0)::bigint,
      'expense_paise', COALESCE((SELECT sum(expense_paise) FROM classified), 0)::bigint,
      'months', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month_list.month,
          'income_paise', COALESCE(by_month.income, 0)::bigint,
          'expense_paise', COALESCE(by_month.expense, 0)::bigint,
          'net_paise', (COALESCE(by_month.income, 0) - COALESCE(by_month.expense, 0))::bigint,
          -- Counted from the financial-year start even when the range starts later.
          'cumulative_net_paise', COALESCE((
            SELECT sum(CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END)
            FROM public.expense_book_entries AS entry
            WHERE entry.society_id = p_society_id
              AND entry.entry_date >= month_list.year_start
              AND entry.entry_date < (month_list.month + interval '1 month')::date
              AND entry.entry_date <= p_to
          ), 0)::bigint
        ) ORDER BY month_list.month)
        FROM month_list
        LEFT JOIN (
          SELECT month, sum(income_paise) AS income, sum(expense_paise) AS expense
          FROM classified GROUP BY month
        ) AS by_month ON by_month.month = month_list.month
      ), '[]'::jsonb),
      'categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'category', category.name, 'expense_paise', totals.expense::bigint
        ) ORDER BY totals.expense DESC, lower(category.name))
        FROM (
          SELECT category_id, sum(expense_paise) AS expense
          FROM classified WHERE category_id IS NOT NULL GROUP BY category_id
        ) AS totals
        JOIN public.expense_categories AS category
          ON category.society_id = p_society_id AND category.id = totals.category_id
      ), '[]'::jsonb),
      'income_sources', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'source', income_kind, 'income_paise', income::bigint
        ) ORDER BY income_kind)
        FROM (
          SELECT income_kind, sum(income_paise) AS income
          FROM classified WHERE income_kind IS NOT NULL GROUP BY income_kind
        ) AS sources
      ), '[]'::jsonb),
      'balances', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'account', account.name, 'account_type', account.account_type,
          'active', account.active,
          'balance_paise', private.expense_balance(p_society_id, account.id, p_to)
        ) ORDER BY account.account_type, lower(account.name))
        FROM public.expense_accounts AS account WHERE account.society_id = p_society_id
      ), '[]'::jsonb),
      'billing_enabled', billing_enabled,
      'outstanding_dues_paise', CASE WHEN billing_enabled THEN COALESCE((
        SELECT sum(bill.total_paise - bill.paid_paise - bill.waived_paise)
        FROM public.billing_bills AS bill
        WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
          AND bill.period_start <= p_to
      ), 0)::bigint END
    )
  );
END;
$$;

CREATE FUNCTION public.expense_statement_item_record(
  p_society_id uuid,
  p_account_id uuid,
  p_statement_date date,
  p_reference text,
  p_party text,
  p_direction text,
  p_amount_paise bigint,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_statement_items;
  saved_id uuid;
  clean_reference text := NULLIF(btrim(p_reference), '');
  clean_party text := NULLIF(btrim(p_party), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR p_statement_date IS NULL
    OR p_statement_date > private.housekeeping_local_date(p_society_id)
    OR p_direction NOT IN ('in', 'out')
    OR p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999
    OR char_length(clean_reference) > 80 OR char_length(clean_party) > 120
  THEN
    RAISE EXCEPTION 'Check the statement item.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_accounts
    WHERE society_id = p_society_id AND id = p_account_id AND account_type = 'bank'
  ) THEN
    RAISE EXCEPTION 'Choose a bank account.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-statement:' || p_society_id::text || auth.uid()::text
      || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_statement_items
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.account_id, previous.statement_date, previous.reference, previous.party,
        previous.direction, previous.amount_paise)
      IS DISTINCT FROM ROW(p_account_id, p_statement_date, clean_reference, clean_party,
        p_direction, p_amount_paise)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  INSERT INTO public.expense_statement_items (
    society_id, account_id, statement_date, reference, party, direction, amount_paise,
    client_request_id, created_by
  ) VALUES (
    p_society_id, p_account_id, p_statement_date, clean_reference, clean_party,
    p_direction, p_amount_paise, p_client_request_id, auth.uid()
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.statement_item.record',
    'expense_statement_item', saved_id::text, NULL,
    jsonb_build_object(
      'account_id', p_account_id, 'statement_date', p_statement_date,
      'direction', p_direction, 'amount_paise', p_amount_paise
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_statement_item_match(
  p_society_id uuid, p_item_id uuid, p_entry_id uuid, p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  item public.expense_statement_items;
  entry public.expense_book_entries;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO item FROM public.expense_statement_items
  WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement item not found.' USING ERRCODE = 'P0002';
  END IF;
  IF item.status = 'matched' AND item.matched_entry_id = p_entry_id THEN
    RETURN;
  END IF;
  IF item.status <> 'unmatched' THEN
    RAISE EXCEPTION 'This statement item is already settled.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO entry FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found.' USING ERRCODE = 'P0002';
  END IF;
  IF entry.account_id <> item.account_id OR entry.direction <> item.direction
    OR entry.amount_paise <> item.amount_paise
  THEN
    RAISE EXCEPTION 'Match an entry on the same account with the same amount and direction.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.expense_statement_items
  SET status = 'matched', matched_entry_id = p_entry_id, decided_by = auth.uid(),
    decided_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_item_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.statement_item.match',
    'expense_statement_item', p_item_id::text,
    jsonb_build_object('status', item.status),
    jsonb_build_object('status', 'matched', 'entry_id', p_entry_id),
    p_request_trace
  );
END;
$$;

CREATE FUNCTION public.expense_statement_item_cancel(
  p_society_id uuid, p_item_id uuid, p_reason text, p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  item public.expense_statement_items;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_reason IS NULL OR char_length(clean_reason) > 1000 THEN
    RAISE EXCEPTION 'Give a reason for cancelling.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO item FROM public.expense_statement_items
  WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement item not found.' USING ERRCODE = 'P0002';
  END IF;
  IF item.status = 'cancelled' AND item.cancel_reason = clean_reason THEN
    RETURN;
  END IF;
  IF item.status <> 'unmatched' THEN
    RAISE EXCEPTION 'This statement item is already settled.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.expense_statement_items
  SET status = 'cancelled', cancel_reason = clean_reason, decided_by = auth.uid(),
    decided_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_item_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.statement_item.cancel',
    'expense_statement_item', p_item_id::text,
    jsonb_build_object('status', item.status),
    jsonb_build_object('status', 'cancelled', 'reason', clean_reason),
    p_request_trace
  );
END;
$$;

CREATE FUNCTION public.expense_reconciliation_page(
  p_society_id uuid, p_account_id uuid, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
  THEN
    RAISE EXCEPTION 'Check the page request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_accounts
    WHERE society_id = p_society_id AND id = p_account_id AND account_type = 'bank'
  ) THEN
    RAISE EXCEPTION 'Choose a bank account.' USING ERRCODE = '22023';
  END IF;
  today := private.housekeeping_local_date(p_society_id);
  RETURN jsonb_build_object(
    'today', today,
    'total', (
      SELECT count(*) FROM public.expense_statement_items
      WHERE society_id = p_society_id AND account_id = p_account_id
    ),
    'old_total', (
      SELECT count(*) FROM public.expense_statement_items
      WHERE society_id = p_society_id AND account_id = p_account_id
        AND status = 'unmatched' AND statement_date < today - 30
    ),
    'items', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC, sort_id)
      FROM (
        SELECT item.statement_date AS sort_date, item.created_at AS sort_created,
          item.id AS sort_id,
          jsonb_build_object(
            'id', item.id, 'statement_date', item.statement_date,
            'reference', item.reference, 'party', item.party,
            'direction', item.direction, 'amount_paise', item.amount_paise,
            'status', item.status, 'matched_entry_id', item.matched_entry_id,
            'matched_voucher_no', private.expense_voucher_label(
              voucher.voucher_type, voucher.financial_year, voucher.sequence
            ),
            'cancel_reason', item.cancel_reason,
            'decided_by_name', decider.full_name, 'decided_at', item.decided_at,
            'is_old', item.status = 'unmatched' AND item.statement_date < today - 30
          ) AS row_data
        FROM public.expense_statement_items AS item
        LEFT JOIN public.expense_vouchers AS voucher
          ON voucher.society_id = item.society_id AND voucher.entry_id = item.matched_entry_id
        LEFT JOIN public.profiles AS decider ON decider.id = item.decided_by
        WHERE item.society_id = p_society_id AND item.account_id = p_account_id
        ORDER BY item.statement_date DESC, item.created_at DESC, item.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb),
    'unmatched_entries_total', (
      SELECT count(*) FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id AND entry.account_id = p_account_id
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_statement_items AS item
          WHERE item.society_id = entry.society_id AND item.matched_entry_id = entry.id
            AND item.status = 'matched'
        )
    ),
    'unmatched_entries', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC, sort_id)
      FROM (
        SELECT entry.entry_date AS sort_date, entry.created_at AS sort_created,
          entry.id AS sort_id,
          jsonb_build_object(
            'id', entry.id, 'entry_date', entry.entry_date,
            'direction', entry.direction, 'amount_paise', entry.amount_paise,
            'counterparty', entry.counterparty, 'reference', entry.reference,
            'voucher_no', private.expense_voucher_label(
              voucher.voucher_type, voucher.financial_year, voucher.sequence
            )
          ) AS row_data
        FROM public.expense_book_entries AS entry
        JOIN public.expense_vouchers AS voucher
          ON voucher.society_id = entry.society_id AND voucher.entry_id = entry.id
        WHERE entry.society_id = p_society_id AND entry.account_id = p_account_id
          AND NOT EXISTS (
            SELECT 1 FROM public.expense_statement_items AS item
            WHERE item.society_id = entry.society_id AND item.matched_entry_id = entry.id
              AND item.status = 'matched'
          )
        ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id
        LIMIT 200
      ) AS page
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_petty_cash_assign(
  p_society_id uuid,
  p_account_id uuid,
  p_custodian_user_id uuid,
  p_handover_count_paise bigint,
  p_handover_note text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account public.expense_accounts;
  active_custody public.expense_petty_cash_custodians;
  previous_count public.expense_cash_counts;
  today date;
  new_count_id uuid;
  saved_id uuid;
  book bigint;
  clean_note text := NULLIF(btrim(p_handover_note), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR p_account_id IS NULL OR p_custodian_user_id IS NULL
    OR p_handover_count_paise NOT BETWEEN 0 AND 999999999999999
    OR char_length(clean_note) > 500
  THEN
    RAISE EXCEPTION 'Check the petty cash details.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO previous_count FROM public.expense_cash_counts
  WHERE society_id = p_society_id AND counted_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    SELECT id INTO saved_id FROM public.expense_petty_cash_custodians
    WHERE society_id = p_society_id AND count_id = previous_count.id
      AND account_id = p_account_id AND custodian_user_id = p_custodian_user_id;
    IF saved_id IS NULL OR previous_count.counted_paise IS DISTINCT FROM p_handover_count_paise
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN saved_id;
  END IF;
  SELECT * INTO account FROM public.expense_accounts
  WHERE society_id = p_society_id AND id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found.' USING ERRCODE = 'P0002';
  END IF;
  IF account.account_type <> 'cash' OR NOT account.active THEN
    RAISE EXCEPTION 'Choose the active cash account.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = p_custodian_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose an active member as custodian.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO active_custody FROM public.expense_petty_cash_custodians
  WHERE society_id = p_society_id AND ended_at IS NULL FOR UPDATE;
  IF FOUND AND active_custody.account_id = p_account_id
    AND active_custody.custodian_user_id = p_custodian_user_id
  THEN
    RETURN active_custody.id;
  END IF;
  IF FOUND AND p_handover_count_paise IS NULL THEN
    RAISE EXCEPTION 'Record the handover count to change the custodian.'
      USING ERRCODE = '22023';
  END IF;
  today := private.housekeeping_local_date(p_society_id);
  IF p_handover_count_paise IS NOT NULL THEN
    book := private.expense_balance(
      p_society_id, COALESCE(active_custody.account_id, p_account_id), today
    );
    INSERT INTO public.expense_cash_counts (
      society_id, account_id, count_date, counted_paise, book_paise, note, kind,
      counted_by, client_request_id
    ) VALUES (
      p_society_id, COALESCE(active_custody.account_id, p_account_id), today,
      p_handover_count_paise, book, clean_note, 'handover', auth.uid(), p_client_request_id
    ) RETURNING id INTO new_count_id;
  END IF;
  IF active_custody.id IS NOT NULL THEN
    UPDATE public.expense_petty_cash_custodians SET ended_at = clock_timestamp()
    WHERE id = active_custody.id;
  END IF;
  UPDATE public.expense_accounts SET is_petty_cash = false
  WHERE society_id = p_society_id AND is_petty_cash AND id <> p_account_id;
  UPDATE public.expense_accounts SET is_petty_cash = true
  WHERE society_id = p_society_id AND id = p_account_id AND NOT is_petty_cash;
  INSERT INTO public.expense_petty_cash_custodians (
    society_id, account_id, custodian_user_id, started_by, count_id
  ) VALUES (
    p_society_id, p_account_id, p_custodian_user_id, auth.uid(), new_count_id
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.petty_cash.assign',
    'expense_petty_cash_custodian', saved_id::text,
    CASE WHEN active_custody.id IS NULL THEN NULL ELSE jsonb_build_object(
      'account_id', active_custody.account_id, 'custodian_user_id', active_custody.custodian_user_id
    ) END,
    jsonb_build_object(
      'account_id', p_account_id, 'custodian_user_id', p_custodian_user_id,
      'count_id', new_count_id, 'counted_paise', p_handover_count_paise, 'book_paise', book
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_cash_count_record(
  p_society_id uuid,
  p_count_date date,
  p_counted_paise bigint,
  p_note text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account public.expense_accounts;
  previous public.expense_cash_counts;
  is_admin boolean;
  saved_id uuid;
  book bigint;
  clean_note text := NULLIF(btrim(p_note), '');
BEGIN
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'expense')
    OR NOT private.society_writable(p_society_id)
    OR NOT (is_admin OR private.expense_is_custodian(p_society_id))
  THEN
    RAISE EXCEPTION 'Petty cash access is not available.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO account FROM public.expense_accounts
  WHERE society_id = p_society_id AND is_petty_cash;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No petty cash account is set up.' USING ERRCODE = '22023';
  END IF;
  IF p_client_request_id IS NULL OR p_count_date IS NULL
    OR p_count_date > private.housekeeping_local_date(p_society_id)
    OR p_count_date < account.opening_on
    OR p_counted_paise IS NULL OR p_counted_paise NOT BETWEEN 0 AND 999999999999999
    OR char_length(clean_note) > 500
  THEN
    RAISE EXCEPTION 'Check the cash count.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-count:' || p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_cash_counts
  WHERE society_id = p_society_id AND counted_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.kind, previous.count_date, previous.counted_paise, previous.note)
      IS DISTINCT FROM ROW('routine'::text, p_count_date, p_counted_paise, clean_note)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  book := private.expense_balance(p_society_id, account.id, p_count_date);
  INSERT INTO public.expense_cash_counts (
    society_id, account_id, count_date, counted_paise, book_paise, note, kind,
    counted_by, client_request_id
  ) VALUES (
    p_society_id, account.id, p_count_date, p_counted_paise, book, clean_note, 'routine',
    auth.uid(), p_client_request_id
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), CASE WHEN is_admin THEN 'admin' ELSE 'custodian' END,
    'expense.cash_count.record', 'expense_cash_count', saved_id::text, NULL,
    jsonb_build_object(
      'account_id', account.id, 'count_date', p_count_date,
      'counted_paise', p_counted_paise, 'book_paise', book
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_petty_cash_view(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_admin boolean;
  is_committee boolean;
  is_custodian boolean;
  writable boolean;
  today date;
  account public.expense_accounts;
  cash_account public.expense_accounts;
BEGIN
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  is_committee := private.has_role(p_society_id, ARRAY['committee']::text[]);
  is_custodian := private.expense_is_custodian(p_society_id);
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'expense')
    OR NOT (is_admin OR is_committee OR is_custodian)
  THEN
    RAISE EXCEPTION 'Petty cash access is not available.' USING ERRCODE = '42501';
  END IF;
  writable := private.society_writable(p_society_id);
  today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO account FROM public.expense_accounts
  WHERE society_id = p_society_id AND is_petty_cash;
  SELECT * INTO cash_account FROM public.expense_accounts
  WHERE society_id = p_society_id AND account_type = 'cash' AND active;
  RETURN jsonb_build_object(
    'today', today,
    'can_assign', is_admin AND writable,
    'can_record', (is_admin OR is_custodian) AND writable AND account.id IS NOT NULL,
    'is_custodian', is_custodian,
    'account', CASE WHEN account.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', account.id, 'name', account.name, 'active', account.active,
      'opening_on', account.opening_on
    ) END,
    'book_paise', CASE WHEN account.id IS NULL THEN NULL
      ELSE private.expense_balance(p_society_id, account.id, today) END,
    'custodian', (
      SELECT jsonb_build_object(
        'user_id', custodian.custodian_user_id, 'full_name', person.full_name,
        'started_at', custodian.started_at
      )
      FROM public.expense_petty_cash_custodians AS custodian
      JOIN public.profiles AS person ON person.id = custodian.custodian_user_id
      WHERE custodian.society_id = p_society_id AND custodian.ended_at IS NULL
    ),
    'counts', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC)
      FROM (
        SELECT count_row.count_date AS sort_date, count_row.created_at AS sort_created,
          jsonb_build_object(
            'id', count_row.id, 'count_date', count_row.count_date,
            'counted_paise', count_row.counted_paise, 'book_paise', count_row.book_paise,
            'difference_paise', count_row.counted_paise - count_row.book_paise,
            'note', count_row.note, 'kind', count_row.kind,
            'counted_by_name', counter.full_name, 'created_at', count_row.created_at
          ) AS row_data
        FROM public.expense_cash_counts AS count_row
        JOIN public.profiles AS counter ON counter.id = count_row.counted_by
        WHERE count_row.society_id = p_society_id
        ORDER BY count_row.count_date DESC, count_row.created_at DESC
        LIMIT 50
      ) AS page
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', custodian.id, 'full_name', person.full_name,
        'started_at', custodian.started_at, 'ended_at', custodian.ended_at,
        'started_by_name', starter.full_name,
        'handover_counted_paise', handover.counted_paise,
        'handover_book_paise', handover.book_paise
      ) ORDER BY custodian.started_at DESC)
      FROM public.expense_petty_cash_custodians AS custodian
      JOIN public.profiles AS person ON person.id = custodian.custodian_user_id
      JOIN public.profiles AS starter ON starter.id = custodian.started_by
      LEFT JOIN public.expense_cash_counts AS handover
        ON handover.society_id = custodian.society_id AND handover.id = custodian.count_id
      WHERE custodian.society_id = p_society_id
    ), '[]'::jsonb),
    'cash_account', CASE WHEN is_admin AND cash_account.id IS NOT NULL THEN jsonb_build_object(
      'id', cash_account.id, 'name', cash_account.name
    ) END,
    'members', CASE WHEN is_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', member.user_id, 'full_name', person.full_name
      ) ORDER BY lower(person.full_name), member.user_id)
      FROM public.memberships AS member
      JOIN public.profiles AS person ON person.id = member.user_id
      WHERE member.society_id = p_society_id AND member.status = 'active'
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

-- Cheap check for showing the petty-cash link; never raises.
CREATE FUNCTION public.expense_petty_cash_custodian_check(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND private.module_enabled(p_society_id, 'expense')
    AND private.expense_is_custodian(p_society_id)
$$;

REVOKE ALL ON FUNCTION
  public.expense_statement_item_record(uuid, uuid, date, text, text, text, bigint, uuid, text),
  public.expense_statement_item_match(uuid, uuid, uuid, text),
  public.expense_statement_item_cancel(uuid, uuid, text, text),
  public.expense_reconciliation_page(uuid, uuid, integer, integer),
  public.expense_petty_cash_assign(uuid, uuid, uuid, bigint, text, uuid, text),
  public.expense_cash_count_record(uuid, date, bigint, text, uuid, text),
  public.expense_petty_cash_view(uuid),
  public.expense_petty_cash_custodian_check(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_statement_item_record(uuid, uuid, date, text, text, text, bigint, uuid, text),
  public.expense_statement_item_match(uuid, uuid, uuid, text),
  public.expense_statement_item_cancel(uuid, uuid, text, text),
  public.expense_reconciliation_page(uuid, uuid, integer, integer),
  public.expense_petty_cash_assign(uuid, uuid, uuid, bigint, text, uuid, text),
  public.expense_cash_count_record(uuid, date, bigint, text, uuid, text),
  public.expense_petty_cash_view(uuid),
  public.expense_petty_cash_custodian_check(uuid)
  TO authenticated;
