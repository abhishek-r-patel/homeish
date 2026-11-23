-- Add P40.8b-c statement reconciliation, fund targets and audited exports.

ALTER TABLE public.expense_funds
  ADD COLUMN target_paise bigint
    CHECK (target_paise IS NULL OR (
      target_paise BETWEEN 0 AND 999999999999999 AND target_paise % 100 = 0
    )),
  ADD COLUMN target_date date,
  ADD CONSTRAINT expense_funds_target_date_requires_amount
    CHECK (target_date IS NULL OR target_paise IS NOT NULL);

CREATE TABLE public.expense_statement_balances (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  closing_paise bigint NOT NULL
    CHECK (closing_paise BETWEEN -999999999999999 AND 999999999999999),
  note text
    CHECK (note IS NULL OR (
      note = btrim(note) AND char_length(note) BETWEEN 1 AND 500
    )),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_statement_balances_account_fkey
    FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, account_id, month)
);
CREATE INDEX expense_statement_balances_society_month_idx
  ON public.expense_statement_balances (society_id, month);
CREATE INDEX expense_statement_balances_created_by_idx
  ON public.expense_statement_balances (created_by);
CREATE INDEX expense_statement_balances_updated_by_idx
  ON public.expense_statement_balances (updated_by);

CREATE TABLE public.expense_statement_balance_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  statement_balance_id uuid NOT NULL,
  previous_closing_paise bigint NOT NULL,
  previous_note text,
  previous_version integer NOT NULL CHECK (previous_version > 0),
  reason text NOT NULL
    CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 5 AND 500),
  changed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT expense_statement_balance_revisions_balance_fkey
    FOREIGN KEY (society_id, statement_balance_id)
    REFERENCES public.expense_statement_balances (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id)
);
CREATE INDEX expense_statement_balance_revisions_balance_idx
  ON public.expense_statement_balance_revisions (
    society_id, statement_balance_id, changed_at
  );
CREATE INDEX expense_statement_balance_revisions_changed_by_idx
  ON public.expense_statement_balance_revisions (changed_by);

ALTER TABLE public.expense_statement_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_statement_balance_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.expense_statement_balances,
  public.expense_statement_balance_revisions
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_statement_balances_no_direct_access
  ON public.expense_statement_balances
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY expense_statement_balance_revisions_no_direct_access
  ON public.expense_statement_balance_revisions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER expense_statement_balances_set_updated_at
  BEFORE UPDATE ON public.expense_statement_balances
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE FUNCTION private.expense_statement_balance_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Statement balances and their history are permanent.'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.expense_statement_balance_delete_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_statement_balances_no_delete
  BEFORE DELETE ON public.expense_statement_balances
  FOR EACH ROW EXECUTE FUNCTION private.expense_statement_balance_delete_guard();
CREATE TRIGGER expense_statement_balances_no_truncate
  BEFORE TRUNCATE ON public.expense_statement_balances
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_statement_balance_delete_guard();
CREATE TRIGGER expense_statement_balance_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.expense_statement_balance_revisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_statement_balance_revisions_no_truncate
  BEFORE TRUNCATE ON public.expense_statement_balance_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION public.expense_fund_target_save(
  p_society_id uuid,
  p_fund_id uuid,
  p_target_paise bigint,
  p_target_date date,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  fund public.expense_funds;
  payload jsonb;
  request_result uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_fund_id IS NULL OR p_target_paise IS NOT NULL AND (
    p_target_paise < 0 OR p_target_paise > 999999999999999
    OR p_target_paise % 100 <> 0
  ) OR p_target_date IS NOT NULL AND p_target_paise IS NULL THEN
    RAISE EXCEPTION 'Check the fund target amount and date.'
      USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object(
    'fund_id', p_fund_id,
    'target_paise', p_target_paise,
    'target_date', p_target_date,
    'expected_updated_at', p_expected_updated_at
  );
  PERFORM private.expense_control_request_lock(
    p_society_id, p_client_request_id
  );
  request_result := private.expense_control_request_result(
    p_society_id, 'fund.target.save', payload, p_client_request_id
  );
  IF request_result IS NOT NULL THEN RETURN request_result; END IF;
  SELECT * INTO fund
  FROM public.expense_funds
  WHERE society_id = p_society_id AND id = p_fund_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fund not found.' USING ERRCODE = 'P0002';
  END IF;
  IF fund.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The fund changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  UPDATE public.expense_funds
  SET target_paise = p_target_paise, target_date = p_target_date
  WHERE society_id = p_society_id AND id = p_fund_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund.target.save',
    'expense_fund', p_fund_id::text,
    jsonb_build_object(
      'target_paise', fund.target_paise, 'target_date', fund.target_date
    ),
    jsonb_build_object(
      'target_paise', p_target_paise, 'target_date', p_target_date
    ),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'fund.target.save', payload, p_client_request_id, p_fund_id
  );
  RETURN p_fund_id;
END;
$$;

CREATE FUNCTION public.expense_statement_balance_save(
  p_society_id uuid,
  p_account_id uuid,
  p_month date,
  p_closing_paise bigint,
  p_note text,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account public.expense_accounts;
  clean_note text := NULLIF(btrim(p_note), '');
  clean_reason text := NULLIF(btrim(p_reason), '');
  existing public.expense_statement_balances;
  payload jsonb;
  request_result uuid;
  saved_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_account_id IS NULL OR p_month IS NULL
    OR extract(day FROM p_month) <> 1
    OR p_month > date_trunc(
      'month', private.housekeeping_local_date(p_society_id)
    )::date
    OR p_closing_paise NOT BETWEEN -999999999999999 AND 999999999999999
    OR clean_note IS NOT NULL AND char_length(clean_note) > 500
    OR clean_reason IS NOT NULL AND char_length(clean_reason) > 500
  THEN
    RAISE EXCEPTION 'Check the account, month and statement balance.'
      USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object(
    'account_id', p_account_id,
    'month', p_month,
    'closing_paise', p_closing_paise,
    'note', clean_note,
    'reason', clean_reason,
    'expected_updated_at', p_expected_updated_at
  );
  PERFORM private.expense_control_request_lock(
    p_society_id, p_client_request_id
  );
  request_result := private.expense_control_request_result(
    p_society_id, 'fund.statement_balance.save', payload, p_client_request_id
  );
  IF request_result IS NOT NULL THEN RETURN request_result; END IF;
  SELECT * INTO account
  FROM public.expense_accounts
  WHERE society_id = p_society_id AND id = p_account_id
    AND account_type = 'bank';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose a bank account.' USING ERRCODE = '22023';
  END IF;
  IF account.opening_on > (p_month + interval '1 month - 1 day')::date THEN
    RAISE EXCEPTION 'Choose a month after this account opened.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO existing
  FROM public.expense_statement_balances
  WHERE society_id = p_society_id
    AND account_id = p_account_id
    AND month = p_month
  FOR UPDATE;
  IF existing.id IS NOT NULL THEN
    IF clean_reason IS NULL OR char_length(clean_reason) < 5 THEN
      RAISE EXCEPTION 'Give a reason for changing the statement balance.'
        USING ERRCODE = '22023';
    END IF;
    IF existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The statement balance changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.expense_statement_balance_revisions (
      society_id, statement_balance_id, previous_closing_paise,
      previous_note, previous_version, reason, changed_by
    ) VALUES (
      p_society_id, existing.id, existing.closing_paise,
      existing.note, existing.version, clean_reason, auth.uid()
    );
    UPDATE public.expense_statement_balances
    SET closing_paise = p_closing_paise,
      note = clean_note,
      version = version + 1
    WHERE id = existing.id;
    saved_id := existing.id;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'Refresh the statement balance before saving.'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.expense_statement_balances (
      society_id, account_id, month, closing_paise, note, created_by,
      updated_by
    ) VALUES (
      p_society_id, p_account_id, p_month, p_closing_paise, clean_note,
      auth.uid(), auth.uid()
    ) RETURNING id INTO saved_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.statement_balance.save',
    'expense_statement_balance', saved_id::text,
    CASE WHEN existing.id IS NULL THEN NULL ELSE jsonb_build_object(
      'closing_paise', existing.closing_paise, 'note', existing.note,
      'version', existing.version
    ) END,
    jsonb_build_object(
      'account_id', p_account_id, 'month', p_month,
      'closing_paise', p_closing_paise, 'note', clean_note
    ),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'fund.statement_balance.save', payload,
    p_client_request_id, saved_id
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_reconciliation(
  p_society_id uuid,
  p_month date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  month_end date;
  opening public.expense_fund_openings;
  pending_splits integer := 0;
  reasons jsonb := '[]'::jsonb;
  workspace jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_month IS NULL OR extract(day FROM p_month) <> 1
    OR p_month > date_trunc('month', private.housekeeping_local_date(p_society_id))::date
  THEN
    RAISE EXCEPTION 'Choose a valid report month.' USING ERRCODE = '22023';
  END IF;
  month_end := (p_month + interval '1 month - 1 day')::date;
  SELECT * INTO opening
  FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  IF opening.id IS NULL THEN
    RAISE EXCEPTION 'Activate fund tracking first.' USING ERRCODE = '23514';
  END IF;
  workspace := public.expense_funds_workspace(p_society_id, null);
  SELECT count(*)::integer INTO pending_splits
  FROM public.expense_book_entries AS entry
  WHERE entry.society_id = p_society_id
    AND entry.entry_date >= opening.cutover_on
    AND NOT EXISTS (
      SELECT 1
      FROM public.expense_fund_entry_allocations AS allocation
      WHERE allocation.society_id = entry.society_id
        AND allocation.entry_id = entry.id
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.expense_fund_mappings AS mapping
        JOIN public.expense_funds AS fund
          ON fund.society_id = mapping.society_id
          AND fund.id = mapping.fund_id AND fund.active
        WHERE mapping.society_id = entry.society_id
          AND (
            mapping.source_kind = 'expense_category'
              AND mapping.expense_category_id = entry.category_id
            OR mapping.source_kind = 'income_kind'
              AND mapping.income_kind = entry.income_kind
          )
      )
      OR entry.source = 'billing_payment' AND EXISTS (
        SELECT 1
        FROM public.billing_payment_allocations AS allocation
        JOIN public.billing_bill_lines AS line
          ON line.society_id = allocation.society_id
          AND line.bill_id = allocation.bill_id
        JOIN public.expense_fund_mappings AS mapping
          ON mapping.society_id = line.society_id
          AND mapping.source_kind = 'billing_charge'
          AND mapping.billing_charge_type_id = line.charge_type_id
        JOIN public.expense_funds AS fund
          ON fund.society_id = mapping.society_id
          AND fund.id = mapping.fund_id AND fund.active
        WHERE allocation.society_id = entry.society_id
          AND allocation.payment_id = entry.billing_payment_id
      )
    );
  reasons := (
    SELECT COALESCE(jsonb_agg(reason ORDER BY ordinal), '[]'::jsonb)
    FROM (
      SELECT 1 AS ordinal, 'month_not_closed'::text AS reason
      WHERE NOT private.expense_month_closed(p_society_id, p_month)
      UNION ALL
      SELECT 2, 'opening_needs_review'
      WHERE (workspace -> 'opening' ->> 'review_required')::boolean
      UNION ALL
      SELECT 3, 'pending_suggested_splits'
      WHERE pending_splits > 0
      UNION ALL
      SELECT 4, 'fixed_deposits_need_review'
      WHERE EXISTS (
        SELECT 1
        FROM public.expense_fixed_deposits AS deposit
        WHERE deposit.society_id = p_society_id
          AND deposit.deposit_on <= month_end
          AND (
            deposit.account_id IS NULL
            OR deposit.principal_paise IS NULL
            OR (
              deposit.id = (
                SELECT latest.id
                FROM public.expense_fixed_deposits AS latest
                WHERE latest.society_id = deposit.society_id
                  AND latest.account_id = deposit.account_id
                  AND latest.deposit_on <= month_end
                ORDER BY latest.deposit_on DESC, latest.id DESC
                LIMIT 1
              )
              AND private.expense_balance(
                p_society_id, deposit.account_id, month_end
              ) <> deposit.principal_paise
            )
          )
      )
    ) AS checks
  );
  RETURN jsonb_build_object(
    'month', p_month,
    'month_end', month_end,
    'status', CASE WHEN jsonb_array_length(reasons) = 0
      THEN 'reconciled' ELSE 'needs_review' END,
    'reasons', reasons,
    'pending_suggested_splits', pending_splits,
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'account_id', account.id,
        'account_name', account.name,
        'account_type', account.account_type,
        'status', CASE WHEN jsonb_array_length(reasons) = 0
          THEN 'reconciled' ELSE 'needs_review' END,
        'reasons', reasons,
        'book_balance_paise',
          private.expense_balance(p_society_id, account.id, month_end),
        'statement_closing_paise', balance.closing_paise,
        'difference_paise', CASE WHEN balance.closing_paise IS NULL THEN NULL
          ELSE balance.closing_paise -
            private.expense_balance(p_society_id, account.id, month_end)
          END,
        'note', balance.note,
        'updated_at', balance.updated_at
      ) ORDER BY account.account_type, lower(account.name))
      FROM public.expense_accounts AS account
      LEFT JOIN public.expense_statement_balances AS balance
        ON balance.society_id = account.society_id
        AND balance.account_id = account.id
        AND balance.month = p_month
      WHERE account.society_id = p_society_id
        AND account.account_type = 'bank'
    ), '[]'::jsonb),
    'funds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fund_id', fund.id,
        'fund_name', fund.name,
        'active', fund.active,
        'balance_paise', private.expense_fund_balance(
          p_society_id, fund.id, month_end
        ),
        'target_paise', fund.target_paise,
        'target_date', fund.target_date,
        'target_progress_bp', CASE
          WHEN fund.target_paise IS NULL OR fund.target_paise = 0 THEN NULL
          ELSE round(
            private.expense_fund_balance(p_society_id, fund.id, month_end)
              ::numeric * 10000 / fund.target_paise
          )::double precision
        END,
        'target_gap_paise', CASE WHEN fund.target_paise IS NULL THEN NULL
          ELSE greatest(
            fund.target_paise -
              private.expense_fund_balance(p_society_id, fund.id, month_end),
            0
          )::bigint
        END,
        'estimated_monthly_paise', CASE
          WHEN fund.target_paise IS NULL OR fund.target_date IS NULL
            OR fund.target_date <= month_end
            OR private.expense_fund_balance(
              p_society_id, fund.id, month_end
            ) >= fund.target_paise
          THEN NULL
          ELSE (
            ceil(greatest(
              fund.target_paise -
                private.expense_fund_balance(p_society_id, fund.id, month_end),
              0
            )::numeric / greatest(1, (
              extract(year FROM fund.target_date)::integer * 12
              + extract(month FROM fund.target_date)::integer
              - extract(year FROM month_end)::integer * 12
              - extract(month FROM month_end)::integer
            )) / 100)::bigint * 100
          )
        END,
        'target_status', CASE
          WHEN private.expense_fund_balance(
            p_society_id, fund.id, month_end
          ) < 0 THEN 'negative_balance'
          WHEN fund.target_paise IS NULL THEN NULL
          WHEN private.expense_fund_balance(
            p_society_id, fund.id, month_end
          ) >= fund.target_paise THEN 'target_met'
          WHEN fund.target_date IS NOT NULL
            AND fund.target_date <= month_end THEN 'behind_schedule'
          ELSE 'below_target'
        END,
        'target_updated_at', fund.updated_at
      ) ORDER BY lower(fund.name))
      FROM public.expense_funds AS fund
      WHERE fund.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_fund_reconciliation_export_record(
  p_society_id uuid, p_month date, p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM public.expense_fund_reconciliation(p_society_id, p_month);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_reconciliation.export',
    'expense_fund_reconciliation', p_month::text, NULL,
    jsonb_build_object('month', p_month, 'format', 'csv'),
    p_request_trace
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_target_save(
    uuid, uuid, bigint, date, timestamptz, uuid, text
  ),
  public.expense_statement_balance_save(
    uuid, uuid, date, bigint, text, text, timestamptz, uuid, text
  ),
  public.expense_fund_reconciliation(uuid, date),
  public.expense_fund_reconciliation_export_record(uuid, date, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_target_save(
    uuid, uuid, bigint, date, timestamptz, uuid, text
  ),
  public.expense_statement_balance_save(
    uuid, uuid, date, bigint, text, text, timestamptz, uuid, text
  ),
  public.expense_fund_reconciliation(uuid, date),
  public.expense_fund_reconciliation_export_record(uuid, date, text)
TO authenticated;
