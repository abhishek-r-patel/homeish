-- Add P39.7 paired own-account transfers and fixed-deposit accounts without financial flow.
ALTER TABLE public.expense_accounts DROP CONSTRAINT expense_accounts_account_type_check;
ALTER TABLE public.expense_accounts ADD CONSTRAINT expense_accounts_account_type_check
  CHECK (account_type IN ('cash', 'bank', 'deposit'));

ALTER TABLE public.expense_book_entries
  ADD COLUMN transfer_pair_id uuid,
  ADD COLUMN transfer_request_id uuid;
ALTER TABLE public.expense_book_entries
  DROP CONSTRAINT expense_book_entries_source_check,
  DROP CONSTRAINT expense_book_entries_shape_check;
ALTER TABLE public.expense_book_entries
  ADD CONSTRAINT expense_book_entries_source_check
    CHECK (source IN ('expense', 'income', 'billing_payment', 'reversal', 'transfer')),
  ADD CONSTRAINT expense_book_entries_shape_check CHECK (
    (source = 'expense' AND direction = 'out' AND expense_id IS NOT NULL
      AND category_id IS NOT NULL AND income_kind IS NULL
      AND billing_payment_id IS NULL AND reverses_entry_id IS NULL
      AND transfer_pair_id IS NULL AND transfer_request_id IS NULL)
    OR (source = 'income' AND direction = 'in' AND income_kind IS NOT NULL
      AND client_request_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND billing_payment_id IS NULL
      AND reverses_entry_id IS NULL AND transfer_pair_id IS NULL
      AND transfer_request_id IS NULL)
    OR (source = 'billing_payment' AND direction = 'in'
      AND billing_payment_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND income_kind IS NULL
      AND reverses_entry_id IS NULL AND transfer_pair_id IS NULL
      AND transfer_request_id IS NULL)
    OR (source = 'transfer' AND direction IN ('in', 'out')
      AND transfer_pair_id IS NOT NULL AND transfer_request_id IS NOT NULL
      AND client_request_id IS NULL AND expense_id IS NULL
      AND category_id IS NULL AND income_kind IS NULL
      AND billing_payment_id IS NULL AND reverses_entry_id IS NULL)
    OR (source = 'reversal' AND reverses_entry_id IS NOT NULL
      AND description IS NOT NULL
      AND expense_id IS NULL AND billing_payment_id IS NULL
      AND (category_id IS NULL OR income_kind IS NULL)
      AND (
        (transfer_pair_id IS NULL AND client_request_id IS NOT NULL
          AND transfer_request_id IS NULL)
        OR (transfer_pair_id IS NOT NULL AND client_request_id IS NULL
          AND transfer_request_id IS NOT NULL)
      ))
  );
CREATE UNIQUE INDEX expense_book_entries_transfer_request_direction_key
  ON public.expense_book_entries (society_id, created_by, transfer_request_id, direction)
  WHERE transfer_request_id IS NOT NULL;
CREATE INDEX expense_book_entries_transfer_pair_idx
  ON public.expense_book_entries
  (society_id, transfer_pair_id, source, direction)
  WHERE transfer_pair_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.expense_check_account(
  p_society_id uuid, p_account_id uuid, p_day date, p_payment_mode text
)
RETURNS public.expense_accounts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account public.expense_accounts;
BEGIN
  SELECT * INTO account FROM public.expense_accounts
  WHERE society_id = p_society_id AND id = p_account_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active account.' USING ERRCODE = '23514';
  END IF;
  IF p_payment_mode IS NOT NULL AND account.account_type = 'deposit' THEN
    RAISE EXCEPTION 'Deposit accounts accept transfers and interest only.'
      USING ERRCODE = '23514';
  END IF;
  IF p_payment_mode IS NOT NULL
    AND (p_payment_mode = 'cash') <> (account.account_type = 'cash')
  THEN
    RAISE EXCEPTION 'Cash payments use the cash account; other modes use a bank.'
      USING ERRCODE = '23514';
  END IF;
  IF p_day < account.opening_on OR private.expense_month_closed(p_society_id, p_day) THEN
    RAISE EXCEPTION 'The date is before the account opened or in a closed month.'
      USING ERRCODE = '23514';
  END IF;
  RETURN account;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_check_account(uuid, uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expense_account_save(
  p_society_id uuid,
  p_account_id uuid,
  p_name text,
  p_account_type text,
  p_opening_balance_paise bigint,
  p_opening_on date,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_accounts;
  saved_id uuid;
  clean_name text := btrim(p_name);
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR p_account_type NOT IN ('cash', 'bank', 'deposit') OR p_active IS NULL
    OR p_opening_on IS NULL OR p_opening_balance_paise IS NULL
    OR p_opening_balance_paise NOT BETWEEN -999999999999999 AND 999999999999999
    OR p_opening_on > private.housekeeping_local_date(p_society_id)
  THEN
    RAISE EXCEPTION 'Check the account details.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_account_id IS NULL THEN
    SELECT * INTO previous FROM public.expense_accounts
    WHERE society_id = p_society_id AND lower(name) = lower(clean_name);
    IF FOUND AND previous.created_by = auth.uid() AND previous.name = clean_name
      AND previous.account_type = p_account_type
      AND previous.opening_balance_paise = p_opening_balance_paise
      AND previous.opening_on = p_opening_on AND previous.active = p_active
    THEN
      RETURN previous.id;
    END IF;
    INSERT INTO public.expense_accounts (
      society_id, name, account_type, opening_balance_paise, opening_on, active, created_by
    ) VALUES (
      p_society_id, clean_name, p_account_type, p_opening_balance_paise,
      p_opening_on, p_active, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_accounts
    WHERE society_id = p_society_id AND id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Account changed. Refresh.' USING ERRCODE = '23505';
    END IF;
    IF previous.account_type <> p_account_type THEN
      RAISE EXCEPTION 'The account type cannot change.' USING ERRCODE = '22023';
    END IF;
    IF (previous.opening_balance_paise <> p_opening_balance_paise
        OR previous.opening_on <> p_opening_on)
      AND (
        EXISTS (
          SELECT 1 FROM public.expense_book_entries
          WHERE society_id = p_society_id AND account_id = p_account_id
        )
        OR EXISTS (
          SELECT 1 FROM public.expenses
          WHERE society_id = p_society_id AND account_id = p_account_id
            AND status = 'pending_approval'
        )
        OR private.expense_month_closed(p_society_id, previous.opening_on)
        OR private.expense_month_closed(p_society_id, p_opening_on)
      )
    THEN
      RAISE EXCEPTION 'Opening details are fixed once the account is used.'
        USING ERRCODE = '22023';
    END IF;
    IF NOT p_active AND EXISTS (
      SELECT 1 FROM public.module_configs
      WHERE society_id = p_society_id AND module_key = 'expense'
        AND settings ->> 'billing_income_account_id' = p_account_id::text
    ) THEN
      RAISE EXCEPTION 'Choose another billing income account first.'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.expense_accounts
    SET name = clean_name, opening_balance_paise = p_opening_balance_paise,
      opening_on = p_opening_on, active = p_active
    WHERE society_id = p_society_id AND id = p_account_id;
    saved_id := p_account_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.account.save', 'expense_account',
    saved_id::text,
    CASE WHEN p_account_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', previous.name, 'account_type', previous.account_type,
      'opening_balance_paise', previous.opening_balance_paise,
      'opening_on', previous.opening_on, 'active', previous.active
    ) END,
    jsonb_build_object(
      'name', clean_name, 'account_type', p_account_type,
      'opening_balance_paise', p_opening_balance_paise,
      'opening_on', p_opening_on, 'active', p_active
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expense_income_record(
  p_society_id uuid,
  p_account_id uuid,
  p_received_on date,
  p_income_kind text,
  p_payer text,
  p_amount_paise bigint,
  p_reference text,
  p_description text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_book_entries;
  saved_id uuid;
  account public.expense_accounts;
  clean_payer text := btrim(p_payer);
  clean_reference text := NULLIF(btrim(p_reference), '');
  clean_description text := NULLIF(btrim(p_description), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR p_received_on IS NULL
    OR p_received_on > private.housekeeping_local_date(p_society_id)
    OR p_income_kind NOT IN ('donation', 'interest', 'other')
    OR clean_payer IS NULL OR char_length(clean_payer) NOT BETWEEN 1 AND 120
    OR p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999
    OR char_length(clean_reference) > 120 OR char_length(clean_description) > 2000
  THEN
    RAISE EXCEPTION 'Check the income details.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense:' || p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_book_entries
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.source, previous.account_id, previous.entry_date, previous.income_kind,
        previous.counterparty, previous.amount_paise, previous.reference,
        previous.description)
      IS DISTINCT FROM ROW('income'::text, p_account_id, p_received_on, p_income_kind,
        clean_payer, p_amount_paise, clean_reference, clean_description)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  account := private.expense_check_account(
    p_society_id, p_account_id, p_received_on, NULL
  );
  IF account.account_type = 'deposit' AND p_income_kind <> 'interest' THEN
    RAISE EXCEPTION 'Deposit accounts accept interest income only.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_book_entries (
    society_id, account_id, entry_date, direction, amount_paise, source, income_kind,
    counterparty, reference, description, client_request_id, created_by
  ) VALUES (
    p_society_id, p_account_id, p_received_on, 'in', p_amount_paise, 'income',
    p_income_kind, clean_payer, clean_reference, clean_description,
    p_client_request_id, auth.uid()
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.income.record',
    'expense_book_entry', saved_id::text, NULL,
    jsonb_build_object(
      'amount_paise', p_amount_paise, 'entry_date', p_received_on,
      'income_kind', p_income_kind, 'account_id', p_account_id
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_transfer_record(
  p_society_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_transfer_on date,
  p_amount_paise bigint,
  p_reference text,
  p_note text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_book_entries;
  from_account public.expense_accounts;
  to_account public.expense_accounts;
  pair_id uuid := extensions.gen_random_uuid();
  clean_reference text := NULLIF(btrim(p_reference), '');
  clean_note text := NULLIF(btrim(p_note), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_from_account_id IS NULL OR p_to_account_id IS NULL
    OR p_from_account_id = p_to_account_id
    OR p_transfer_on IS NULL
    OR p_transfer_on > private.housekeeping_local_date(p_society_id)
    OR p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999
    OR p_client_request_id IS NULL
    OR char_length(clean_reference) > 120 OR char_length(clean_note) > 2000
  THEN
    RAISE EXCEPTION 'Check the own-account transfer.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-transfer:' || p_society_id::text || auth.uid()::text
      || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_book_entries
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND transfer_request_id = p_client_request_id
    AND source = 'transfer'
  ORDER BY direction LIMIT 1;
  IF FOUND THEN
    IF previous.entry_date <> p_transfer_on
      OR previous.amount_paise <> p_amount_paise
      OR (
        SELECT count(*)
        FROM public.expense_book_entries AS leg
        WHERE leg.society_id = p_society_id
          AND leg.transfer_request_id = p_client_request_id
          AND leg.source = 'transfer'
          AND leg.created_by = auth.uid()
      ) <> 2
      OR EXISTS (
        SELECT 1 FROM public.expense_book_entries AS leg
        WHERE leg.society_id = p_society_id
          AND leg.transfer_request_id = p_client_request_id
          AND leg.source = 'transfer'
          AND leg.created_by = auth.uid()
          AND (leg.account_id IS DISTINCT FROM CASE leg.direction
            WHEN 'out' THEN p_from_account_id ELSE p_to_account_id END
            OR leg.reference IS DISTINCT FROM clean_reference
            OR leg.description IS DISTINCT FROM clean_note)
      )
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.transfer_pair_id;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  from_account := private.expense_check_account(
    p_society_id, p_from_account_id, p_transfer_on, NULL
  );
  to_account := private.expense_check_account(
    p_society_id, p_to_account_id, p_transfer_on, NULL
  );
  IF from_account.account_type = to_account.account_type
    AND from_account.account_type = 'cash'
  THEN
    RAISE EXCEPTION 'Choose two different active Accounts.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.expense_book_entries (
    society_id, account_id, entry_date, direction, amount_paise, source,
    transfer_pair_id, transfer_request_id, counterparty, reference, description,
    created_by
  ) VALUES
    (
      p_society_id, p_from_account_id, p_transfer_on, 'out', p_amount_paise,
      'transfer', pair_id, p_client_request_id, to_account.name,
      clean_reference, clean_note, auth.uid()
    ),
    (
      p_society_id, p_to_account_id, p_transfer_on, 'in', p_amount_paise,
      'transfer', pair_id, p_client_request_id, from_account.name,
      clean_reference, clean_note, auth.uid()
    );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.transfer.record',
    'expense_transfer', pair_id::text, NULL,
    jsonb_build_object(
      'from_account_id', p_from_account_id, 'to_account_id', p_to_account_id,
      'entry_date', p_transfer_on, 'amount_paise', p_amount_paise,
      'reference', clean_reference, 'note', clean_note
    ),
    p_request_trace
  );
  RETURN pair_id;
END;
$$;

CREATE FUNCTION public.expense_transfer_reverse(
  p_society_id uuid,
  p_transfer_pair_id uuid,
  p_reverse_on date,
  p_reason text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  original record;
  existing public.expense_book_entries;
  reversal_request_id uuid := p_client_request_id;
  clean_reason text := NULLIF(btrim(p_reason), '');
  found_transfer boolean := false;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_transfer_pair_id IS NULL OR p_reverse_on IS NULL
    OR p_reverse_on > private.housekeeping_local_date(p_society_id)
    OR clean_reason IS NULL OR char_length(clean_reason) > 1000
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the transfer reversal.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO existing FROM public.expense_book_entries
  WHERE society_id = p_society_id AND transfer_request_id = p_client_request_id
    AND source = 'reversal' AND transfer_pair_id = p_transfer_pair_id
  LIMIT 1;
  IF FOUND THEN
    IF existing.entry_date <> p_reverse_on OR existing.description <> clean_reason
      OR (
        SELECT count(*)
        FROM public.expense_book_entries AS leg
        WHERE leg.society_id = p_society_id
          AND leg.transfer_request_id = p_client_request_id
          AND leg.source = 'reversal'
          AND leg.transfer_pair_id = p_transfer_pair_id
          AND leg.created_by = auth.uid()
      ) <> 2
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN p_transfer_pair_id;
  END IF;
  FOR original IN
    SELECT entry.*
    FROM public.expense_book_entries AS entry
    WHERE entry.society_id = p_society_id
      AND entry.transfer_pair_id = p_transfer_pair_id
      AND entry.source = 'transfer'
    FOR UPDATE
  LOOP
    found_transfer := true;
    IF original.entry_date > p_reverse_on THEN
      RAISE EXCEPTION 'The transfer cannot be reversed before its date.'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.expense_book_entries AS reversal
      WHERE reversal.society_id = p_society_id
        AND reversal.reverses_entry_id = original.id
    ) THEN
      RAISE EXCEPTION 'The transfer was already reversed.' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  IF NOT found_transfer THEN
    RAISE EXCEPTION 'Transfer not found.' USING ERRCODE = 'P0002';
  END IF;
  IF (
    SELECT count(*) FROM public.expense_book_entries
    WHERE society_id = p_society_id
      AND transfer_pair_id = p_transfer_pair_id
      AND source = 'transfer'
  ) <> 2 THEN
    RAISE EXCEPTION 'The transfer pair is incomplete.' USING ERRCODE = '23514';
  END IF;
  FOR original IN
    SELECT entry.*, account.name AS account_name
    FROM public.expense_book_entries AS entry
    JOIN public.expense_accounts AS account
      ON account.society_id = entry.society_id AND account.id = entry.account_id
    WHERE entry.society_id = p_society_id
      AND entry.transfer_pair_id = p_transfer_pair_id
      AND entry.source = 'transfer'
    ORDER BY entry.direction
  LOOP
    PERFORM private.expense_check_account(
      p_society_id, original.account_id, p_reverse_on, NULL
    );
    INSERT INTO public.expense_book_entries (
      society_id, account_id, entry_date, direction, amount_paise, source,
      transfer_pair_id, transfer_request_id, reverses_entry_id, counterparty,
      description, created_by
    ) VALUES (
      p_society_id, original.account_id, p_reverse_on,
      CASE original.direction WHEN 'in' THEN 'out' ELSE 'in' END,
      original.amount_paise, 'reversal', p_transfer_pair_id, reversal_request_id,
      original.id, original.counterparty, clean_reason, auth.uid()
    );
  END LOOP;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.transfer.reverse',
    'expense_transfer', p_transfer_pair_id::text, NULL,
    jsonb_build_object(
      'entry_date', p_reverse_on, 'reason', clean_reason
    ),
    p_request_trace
  );
  RETURN p_transfer_pair_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expense_report(
  p_society_id uuid, p_from date, p_to date
)
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
      WHERE entry.society_id = p_society_id
        AND entry.entry_date BETWEEN p_from AND p_to
        AND entry.transfer_pair_id IS NULL
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
          'cumulative_net_paise', COALESCE((
            SELECT sum(CASE entry.direction WHEN 'in'
              THEN entry.amount_paise ELSE -entry.amount_paise END)
            FROM public.expense_book_entries AS entry
            WHERE entry.society_id = p_society_id
              AND entry.entry_date >= month_list.year_start
              AND entry.entry_date < (month_list.month + interval '1 month')::date
              AND entry.entry_date <= p_to
              AND entry.transfer_pair_id IS NULL
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

CREATE OR REPLACE FUNCTION private.analytics_metric_expense_income_vs_expense(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('paise',
    '[{"key":"income","label":"Income"},{"key":"expense","label":"Expense"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(grouped.period, jsonb_build_object(
        'income', grouped.income::bigint, 'expense', grouped.expense::bigint))
      FROM (
        SELECT to_char(entry.entry_date, 'YYYY-MM') AS period,
          COALESCE(sum(CASE entry.direction WHEN 'in'
            THEN entry.amount_paise ELSE -entry.amount_paise END)
            FILTER (WHERE entry.category_id IS NULL), 0) AS income,
          COALESCE(sum(CASE entry.direction WHEN 'out'
            THEN entry.amount_paise ELSE -entry.amount_paise END)
            FILTER (WHERE entry.category_id IS NOT NULL), 0) AS expense
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id
          AND entry.entry_date >= p_from AND entry.entry_date <= p_to
          AND entry.transfer_pair_id IS NULL
        GROUP BY 1
      ) AS grouped
    ),
    '{"income":0,"expense":0}')
$$;

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
              CASE entry.direction WHEN 'in'
                THEN entry.amount_paise ELSE -entry.amount_paise END
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
            'transfer_pair_id', entry.transfer_pair_id,
            'transfer_account_name', CASE WHEN entry.source = 'transfer' THEN (
              SELECT paired_account.name
              FROM public.expense_book_entries AS paired
              JOIN public.expense_accounts AS paired_account
                ON paired_account.society_id = paired.society_id
                AND paired_account.id = paired.account_id
              WHERE paired.society_id = entry.society_id
                AND paired.transfer_pair_id = entry.transfer_pair_id
                AND paired.source = 'transfer'
                AND paired.id <> entry.id
              LIMIT 1
            ) END,
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

CREATE OR REPLACE FUNCTION public.expense_funds_activity(
  p_society_id uuid,
  p_limit integer,
  p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  opening public.expense_fund_openings;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
  THEN
    RAISE EXCEPTION 'Check the fund activity page request.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO opening FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  RETURN jsonb_build_object(
    'balances', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fund_id', fund.id,
        'fund_name', fund.name,
        'opening_paise', COALESCE(opening_allocation.amount_paise, 0),
        'balance_paise', COALESCE(opening_allocation.amount_paise, 0) + COALESCE((
          SELECT sum(CASE entry.direction WHEN 'in'
            THEN allocation.amount_paise ELSE -allocation.amount_paise END)
          FROM public.expense_fund_entry_allocations AS allocation
          JOIN public.expense_book_entries AS entry
            ON entry.society_id = allocation.society_id AND entry.id = allocation.entry_id
          WHERE allocation.society_id = p_society_id
            AND allocation.fund_id = fund.id
            AND allocation.allocation_version_id =
              private.expense_fund_latest_allocation_version(entry.id)
        ), 0)
      ) ORDER BY lower(fund.name))
      FROM public.expense_funds AS fund
      LEFT JOIN public.expense_fund_opening_allocations AS opening_allocation
        ON opening_allocation.society_id = fund.society_id
        AND opening_allocation.opening_id = opening.id
        AND opening_allocation.fund_id = fund.id
        AND opening_allocation.allocation_version_id =
          private.expense_fund_latest_opening_version(opening.id)
      WHERE fund.society_id = p_society_id
    ), '[]'::jsonb),
    'unallocated_paise', CASE WHEN opening.id IS NULL THEN NULL ELSE
      (
        SELECT latest.accounts_total_paise - sum(latest.amount_paise)
        FROM public.expense_fund_opening_allocations AS latest
        WHERE latest.opening_id = opening.id
          AND latest.allocation_version_id =
            private.expense_fund_latest_opening_version(opening.id)
        GROUP BY latest.accounts_total_paise
        LIMIT 1
      )
      + COALESCE((
        SELECT sum(CASE entry.direction WHEN 'in'
          THEN allocation.amount_paise ELSE -allocation.amount_paise END)
        FROM public.expense_fund_entry_allocations AS allocation
        JOIN public.expense_book_entries AS entry
          ON entry.society_id = allocation.society_id AND entry.id = allocation.entry_id
        WHERE allocation.society_id = p_society_id
          AND allocation.fund_id IS NULL
          AND allocation.allocation_version_id =
            private.expense_fund_latest_allocation_version(entry.id)
      ), 0)
      + COALESCE((
        SELECT sum(CASE entry.direction WHEN 'in'
          THEN entry.amount_paise ELSE -entry.amount_paise END)
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id
          AND entry.entry_date >= opening.cutover_on
          AND entry.transfer_pair_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.expense_fund_entry_allocations AS allocation
            WHERE allocation.society_id = entry.society_id
              AND allocation.entry_id = entry.id
          )
      ), 0)
      + COALESCE((
        SELECT sum(account.opening_balance_paise)
        FROM public.expense_accounts AS account
        WHERE account.society_id = p_society_id
          AND account.opening_on >= opening.cutover_on
      ), 0)
    END,
    'mappings', jsonb_build_object(
      'expense_categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'category_id', category.id,
          'category_name', category.name,
          'fund_id', mapping.fund_id,
          'updated_at', mapping.updated_at
        ) ORDER BY lower(category.name))
        FROM public.expense_categories AS category
        LEFT JOIN public.expense_fund_mappings AS mapping
          ON mapping.society_id = category.society_id
          AND mapping.source_kind = 'expense_category'
          AND mapping.expense_category_id = category.id
        WHERE category.society_id = p_society_id AND category.active
      ), '[]'::jsonb),
      'income_kinds', (
        SELECT jsonb_agg(jsonb_build_object(
          'income_kind', kind.value,
          'fund_id', mapping.fund_id,
          'updated_at', mapping.updated_at
        ) ORDER BY kind.value)
        FROM (VALUES ('donation'), ('interest'), ('other')) AS kind(value)
        LEFT JOIN public.expense_fund_mappings AS mapping
          ON mapping.society_id = p_society_id
          AND mapping.source_kind = 'income_kind'
          AND mapping.income_kind = kind.value
      )
    ),
    'entries_total', CASE WHEN opening.id IS NULL THEN 0 ELSE (
      SELECT count(*)
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id
        AND entry.entry_date >= opening.cutover_on
        AND entry.transfer_pair_id IS NULL
    ) END,
    'entries', CASE WHEN opening.id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC, sort_id)
      FROM (
        SELECT entry.entry_date AS sort_date, entry.created_at AS sort_created,
          entry.id AS sort_id,
          jsonb_build_object(
            'entry_id', entry.id,
            'entry_date', entry.entry_date,
            'direction', entry.direction,
            'amount_paise', entry.amount_paise,
            'counterparty', entry.counterparty,
            'source', entry.source,
            'category_name', category.name,
            'income_kind', entry.income_kind,
            'voucher_no', private.expense_voucher_label(
              voucher.voucher_type, voucher.financial_year, voucher.sequence
            ),
            'month_closed', private.expense_month_closed(p_society_id, entry.entry_date),
            'allocations', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'fund_id', allocation.fund_id,
                'fund_name', fund.name,
                'amount_paise', allocation.amount_paise
              ) ORDER BY allocation.fund_id NULLS LAST)
              FROM public.expense_fund_entry_allocations AS allocation
              LEFT JOIN public.expense_funds AS fund
                ON fund.society_id = allocation.society_id
                AND fund.id = allocation.fund_id
              WHERE allocation.society_id = entry.society_id
                AND allocation.entry_id = entry.id
                AND allocation.allocation_version_id =
                  private.expense_fund_latest_allocation_version(entry.id)
            ), '[]'::jsonb),
            'suggested_fund_id', CASE
              WHEN entry.category_id IS NOT NULL THEN category_suggestion_fund.id
              WHEN entry.income_kind IS NOT NULL THEN income_suggestion_fund.id
            END
          ) AS row_data
        FROM public.expense_book_entries AS entry
        JOIN public.expense_vouchers AS voucher
          ON voucher.society_id = entry.society_id AND voucher.entry_id = entry.id
        LEFT JOIN public.expense_categories AS category
          ON category.society_id = entry.society_id AND category.id = entry.category_id
        LEFT JOIN public.expense_fund_mappings AS category_mapping
          ON category_mapping.society_id = entry.society_id
          AND category_mapping.source_kind = 'expense_category'
          AND category_mapping.expense_category_id = entry.category_id
        LEFT JOIN public.expense_fund_mappings AS income_mapping
          ON income_mapping.society_id = entry.society_id
          AND income_mapping.source_kind = 'income_kind'
          AND income_mapping.income_kind = entry.income_kind
        LEFT JOIN public.expense_funds AS category_suggestion_fund
          ON category_suggestion_fund.society_id = category_mapping.society_id
          AND category_suggestion_fund.id = category_mapping.fund_id
          AND category_suggestion_fund.active
        LEFT JOIN public.expense_funds AS income_suggestion_fund
          ON income_suggestion_fund.society_id = income_mapping.society_id
          AND income_suggestion_fund.id = income_mapping.fund_id
          AND income_suggestion_fund.active
        WHERE entry.society_id = p_society_id
          AND entry.entry_date >= opening.cutover_on
          AND entry.transfer_pair_id IS NULL
        ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb) END
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_account_save(uuid, uuid, text, text, bigint, date, boolean, timestamptz, text),
  public.expense_income_record(uuid, uuid, date, text, text, bigint, text, text, uuid, text),
  public.expense_transfer_record(uuid, uuid, uuid, date, bigint, text, text, uuid, text),
  public.expense_transfer_reverse(uuid, uuid, date, text, uuid, text),
  public.expense_report(uuid, date, date),
  public.expense_entries_page(uuid, date, date, uuid, integer, integer),
  public.expense_funds_activity(uuid, integer, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_account_save(uuid, uuid, text, text, bigint, date, boolean, timestamptz, text),
  public.expense_income_record(uuid, uuid, date, text, text, bigint, text, text, uuid, text),
  public.expense_transfer_record(uuid, uuid, uuid, date, bigint, text, text, uuid, text),
  public.expense_transfer_reverse(uuid, uuid, date, text, uuid, text),
  public.expense_report(uuid, date, date),
  public.expense_entries_page(uuid, date, date, uuid, integer, integer),
  public.expense_funds_activity(uuid, integer, integer)
  TO authenticated;
