-- Add the P39.5 bank-confirmed fixed-deposit register linked to Accounts deposit accounts.
CREATE TABLE public.expense_fixed_deposits (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  fund_id uuid NOT NULL,
  account_id uuid,
  predecessor_id uuid,
  bank_name text NOT NULL
    CHECK (bank_name = btrim(bank_name) AND char_length(bank_name) BETWEEN 1 AND 120),
  reference text CHECK (reference = btrim(reference) AND char_length(reference) BETWEEN 1 AND 120),
  principal_paise bigint
    CHECK (principal_paise BETWEEN 1 AND 9007199254740991),
  quoted_rate numeric(7,4) CHECK (quoted_rate BETWEEN 0 AND 100),
  deposit_on date NOT NULL,
  maturity_on date NOT NULL CHECK (maturity_on > deposit_on),
  maturity_value_paise bigint
    CHECK (maturity_value_paise BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_fixed_deposits_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fixed_deposits_account_fkey
    FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fixed_deposits_predecessor_fkey
    FOREIGN KEY (society_id, predecessor_id)
    REFERENCES public.expense_fixed_deposits (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, predecessor_id)
);
CREATE INDEX expense_fixed_deposits_fund_idx
  ON public.expense_fixed_deposits (society_id, fund_id);
CREATE INDEX expense_fixed_deposits_account_idx
  ON public.expense_fixed_deposits (society_id, account_id);
CREATE INDEX expense_fixed_deposits_maturity_idx
  ON public.expense_fixed_deposits (society_id, maturity_on);
CREATE INDEX expense_fixed_deposits_created_by_idx
  ON public.expense_fixed_deposits (created_by);
CREATE INDEX expense_fixed_deposits_updated_by_idx
  ON public.expense_fixed_deposits (updated_by);
CREATE TRIGGER expense_fixed_deposits_set_updated_at
  BEFORE UPDATE ON public.expense_fixed_deposits
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.expense_fixed_deposits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_fixed_deposits
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_fixed_deposits_no_direct_access
  ON public.expense_fixed_deposits FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION public.expense_fixed_deposit_save(
  p_society_id uuid,
  p_deposit_id uuid,
  p_predecessor_id uuid,
  p_fund_id uuid,
  p_account_id uuid,
  p_bank_name text,
  p_reference text,
  p_principal_paise bigint,
  p_quoted_rate numeric,
  p_deposit_on date,
  p_maturity_on date,
  p_maturity_value_paise bigint,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fixed_deposits;
  predecessor public.expense_fixed_deposits;
  saved_id uuid;
  clean_bank text := btrim(p_bank_name);
  clean_reference text := NULLIF(btrim(p_reference), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_bank IS NULL OR char_length(clean_bank) NOT BETWEEN 1 AND 120
    OR char_length(clean_reference) > 120
    OR p_principal_paise IS NOT NULL AND p_principal_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_maturity_value_paise IS NOT NULL
      AND p_maturity_value_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_quoted_rate IS NOT NULL
      AND p_quoted_rate NOT BETWEEN 0 AND 100
    OR p_deposit_on IS NULL OR p_maturity_on IS NULL
    OR p_maturity_on <= p_deposit_on
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    )
    OR (p_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.expense_accounts
      WHERE society_id = p_society_id AND id = p_account_id
        AND account_type = 'deposit'
    ))
  THEN
    RAISE EXCEPTION 'Check the fixed-deposit details.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_predecessor_id IS NOT NULL THEN
    SELECT * INTO predecessor FROM public.expense_fixed_deposits
    WHERE society_id = p_society_id AND id = p_predecessor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Predecessor deposit not found.' USING ERRCODE = 'P0002';
    END IF;
    IF predecessor.fund_id IS DISTINCT FROM p_fund_id
      OR predecessor.account_id IS DISTINCT FROM p_account_id
      OR predecessor.maturity_on > p_deposit_on
    THEN
      RAISE EXCEPTION 'A renewal keeps the same fund and deposit account.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_deposit_id IS NULL THEN
    INSERT INTO public.expense_fixed_deposits (
      society_id, fund_id, account_id, predecessor_id, bank_name, reference,
      principal_paise, quoted_rate, deposit_on, maturity_on,
      maturity_value_paise, created_by
    ) VALUES (
      p_society_id, p_fund_id, p_account_id, p_predecessor_id, clean_bank,
      clean_reference, p_principal_paise, p_quoted_rate, p_deposit_on,
      p_maturity_on, p_maturity_value_paise, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_fixed_deposits
    WHERE society_id = p_society_id AND id = p_deposit_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fixed deposit not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The fixed deposit changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.expense_fixed_deposits
    SET fund_id = p_fund_id, account_id = p_account_id,
      predecessor_id = p_predecessor_id, bank_name = clean_bank,
      reference = clean_reference, principal_paise = p_principal_paise,
      quoted_rate = p_quoted_rate, deposit_on = p_deposit_on,
      maturity_on = p_maturity_on, maturity_value_paise = p_maturity_value_paise
    WHERE society_id = p_society_id AND id = p_deposit_id;
    saved_id := p_deposit_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fixed_deposit.save',
    'expense_fixed_deposit', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object(
      'fund_id', previous.fund_id, 'account_id', previous.account_id,
      'principal_paise', previous.principal_paise,
      'deposit_on', previous.deposit_on, 'maturity_on', previous.maturity_on
    ) END,
    jsonb_build_object(
      'fund_id', p_fund_id, 'account_id', p_account_id,
      'bank_name', clean_bank, 'principal_paise', p_principal_paise,
      'quoted_rate', p_quoted_rate, 'deposit_on', p_deposit_on,
      'maturity_on', p_maturity_on,
      'maturity_value_paise', p_maturity_value_paise,
      'predecessor_id', p_predecessor_id
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fixed_deposits_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  admin_view boolean;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  admin_view := private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN jsonb_build_object(
    'can_manage', admin_view AND private.society_writable(p_society_id),
    'deposits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', deposit.id,
        'fund_id', deposit.fund_id,
        'fund_name', fund.name,
        'account_id', deposit.account_id,
        'account_name', account.name,
        'predecessor_id', deposit.predecessor_id,
        'bank_name', deposit.bank_name,
        'reference', CASE WHEN admin_view THEN deposit.reference END,
        'principal_paise', deposit.principal_paise,
        'quoted_rate', deposit.quoted_rate,
        'deposit_on', deposit.deposit_on,
        'maturity_on', deposit.maturity_on,
        'maturity_value_paise', deposit.maturity_value_paise,
        'account_balance_paise', CASE WHEN deposit.account_id IS NULL
          THEN NULL ELSE private.expense_balance(
            p_society_id, deposit.account_id,
            private.housekeeping_local_date(p_society_id)
          ) END,
        'reconciliation_status', CASE
          WHEN deposit.account_id IS NULL THEN 'not_reconciled'
          WHEN deposit.principal_paise IS NULL THEN 'principal_unknown'
          WHEN private.expense_balance(
            p_society_id, deposit.account_id,
            private.housekeeping_local_date(p_society_id)
          ) = deposit.principal_paise THEN 'matched'
          ELSE 'difference'
        END,
        'days_to_maturity', (deposit.maturity_on
          - private.housekeeping_local_date(p_society_id)),
        'maturity_follow_up', CASE
          WHEN EXISTS (
            SELECT 1 FROM public.expense_fixed_deposits AS successor
            WHERE successor.society_id = deposit.society_id
              AND successor.predecessor_id = deposit.id
          ) THEN false
          ELSE deposit.maturity_on
            <= private.housekeeping_local_date(p_society_id) + 30
        END,
        'updated_at', deposit.updated_at
      ) ORDER BY deposit.maturity_on NULLS LAST, deposit.deposit_on DESC)
      FROM public.expense_fixed_deposits AS deposit
      JOIN public.expense_funds AS fund
        ON fund.society_id = deposit.society_id AND fund.id = deposit.fund_id
      LEFT JOIN public.expense_accounts AS account
        ON account.society_id = deposit.society_id
        AND account.id = deposit.account_id
      WHERE deposit.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fixed_deposit_save(
    uuid, uuid, uuid, uuid, uuid, text, text, bigint, numeric, date, date,
    bigint, timestamptz, text
  ),
  public.expense_fixed_deposits_list(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fixed_deposit_save(
    uuid, uuid, uuid, uuid, uuid, text, text, bigint, numeric, date, date,
    bigint, timestamptz, text
  ),
  public.expense_fixed_deposits_list(uuid)
  TO authenticated;
