-- Add P40.5 configured allocation-pair rules and immutable fund-to-fund transfers.
CREATE TABLE public.expense_fund_transfer_rules (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  from_fund_id uuid NOT NULL,
  to_fund_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_transfer_rules_from_fkey
    FOREIGN KEY (society_id, from_fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_transfer_rules_to_fkey
    FOREIGN KEY (society_id, to_fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_transfer_rules_distinct_check
    CHECK (from_fund_id <> to_fund_id),
  UNIQUE (society_id, from_fund_id, to_fund_id),
  UNIQUE (society_id, id)
);
CREATE INDEX expense_fund_transfer_rules_society_idx
  ON public.expense_fund_transfer_rules (society_id, active);
CREATE INDEX expense_fund_transfer_rules_created_by_idx
  ON public.expense_fund_transfer_rules (created_by);
CREATE INDEX expense_fund_transfer_rules_updated_by_idx
  ON public.expense_fund_transfer_rules (updated_by);
CREATE TRIGGER expense_fund_transfer_rules_set_updated_at
  BEFORE UPDATE ON public.expense_fund_transfer_rules
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_fund_transfers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  from_fund_id uuid NOT NULL,
  to_fund_id uuid NOT NULL,
  transfer_on date NOT NULL,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  reason text NOT NULL
    CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 1000),
  decision_reference text NOT NULL
    CHECK (
      decision_reference = btrim(decision_reference)
      AND char_length(decision_reference) BETWEEN 1 AND 120
    ),
  reverses_transfer_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_fund_transfers_from_fkey
    FOREIGN KEY (society_id, from_fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_transfers_to_fkey
    FOREIGN KEY (society_id, to_fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_transfers_reverses_fkey
    FOREIGN KEY (society_id, reverses_transfer_id)
    REFERENCES public.expense_fund_transfers (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, reverses_transfer_id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_fund_transfers_funds_idx
  ON public.expense_fund_transfers
  (society_id, transfer_on, from_fund_id, to_fund_id);
CREATE INDEX expense_fund_transfers_created_by_idx
  ON public.expense_fund_transfers (created_by);

ALTER TABLE public.expense_fund_transfer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_fund_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_fund_transfer_rules, public.expense_fund_transfers
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_fund_transfer_rules_no_direct_access
  ON public.expense_fund_transfer_rules FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_fund_transfers_no_direct_access
  ON public.expense_fund_transfers FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE TRIGGER expense_fund_transfers_append_only
  BEFORE UPDATE OR DELETE ON public.expense_fund_transfers
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_transfers_no_truncate
  BEFORE TRUNCATE ON public.expense_fund_transfers
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.expense_fund_available_balance(
  p_society_id uuid,
  p_fund_id uuid,
  p_as_of date
)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT latest.amount_paise
    FROM public.expense_fund_openings AS opening
    JOIN public.expense_fund_opening_allocations AS latest
      ON latest.society_id = opening.society_id
      AND latest.opening_id = opening.id
      AND latest.fund_id = p_fund_id
      AND latest.allocation_version_id =
        private.expense_fund_latest_opening_version(opening.id)
    WHERE opening.society_id = p_society_id
  ), 0)::bigint
  + COALESCE((
    SELECT sum(CASE entry.direction WHEN 'in'
      THEN allocation.amount_paise ELSE -allocation.amount_paise END)
    FROM public.expense_fund_entry_allocations AS allocation
    JOIN public.expense_book_entries AS entry
      ON entry.society_id = allocation.society_id AND entry.id = allocation.entry_id
    WHERE allocation.society_id = p_society_id
      AND allocation.fund_id = p_fund_id
      AND entry.entry_date <= p_as_of
      AND allocation.allocation_version_id =
        private.expense_fund_latest_allocation_version(entry.id)
  ), 0)::bigint
  + COALESCE((
    SELECT sum(
      CASE
        WHEN transfer.from_fund_id = p_fund_id THEN -transfer.amount_paise
        WHEN transfer.to_fund_id = p_fund_id THEN transfer.amount_paise
        ELSE 0
      END
    )
    FROM public.expense_fund_transfers AS transfer
    WHERE transfer.society_id = p_society_id
      AND transfer.transfer_on <= p_as_of
      AND (transfer.from_fund_id = p_fund_id OR transfer.to_fund_id = p_fund_id)
  ), 0)::bigint
  - COALESCE((
    SELECT sum(private.expense_balance(
      p_society_id, deposit.account_id, p_as_of
    ))
    FROM public.expense_fixed_deposits AS deposit
    WHERE deposit.society_id = p_society_id
      AND deposit.fund_id = p_fund_id
      AND deposit.account_id IS NOT NULL
      AND deposit.deposit_on <= p_as_of
      AND deposit.id = (
        SELECT current.id
        FROM public.expense_fixed_deposits AS current
        WHERE current.society_id = deposit.society_id
          AND current.account_id = deposit.account_id
          AND current.deposit_on <= p_as_of
        ORDER BY current.deposit_on DESC, current.id DESC
        LIMIT 1
      )
      AND (
        deposit.principal_paise IS NULL
        OR private.expense_balance(
          p_society_id, deposit.account_id, p_as_of
        ) <> deposit.principal_paise
      )
  ), 0)::bigint
$$;
REVOKE ALL ON FUNCTION private.expense_fund_available_balance(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_funds_activity_transfers(
  p_society_id uuid,
  p_limit integer,
  p_offset integer
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH base AS (
    SELECT public.expense_funds_activity(
      p_society_id, p_limit, p_offset
    ) AS value
  )
  SELECT jsonb_set(
    base.value,
    '{balances}',
    COALESCE((
      SELECT jsonb_agg(jsonb_set(
        balance.value,
        '{balance_paise}',
        to_jsonb(private.expense_fund_available_balance(
          p_society_id,
          (balance.value ->> 'fund_id')::uuid,
          private.housekeeping_local_date(p_society_id)
        ))
      ) ORDER BY lower(balance.value ->> 'fund_name'))
      FROM base,
        lateral jsonb_array_elements(base.value -> 'balances') AS balance(value)
    ), '[]'::jsonb)
  )
  FROM base
$$;

CREATE FUNCTION public.expense_fund_transfer_rule_save(
  p_society_id uuid,
  p_rule_id uuid,
  p_from_fund_id uuid,
  p_to_fund_id uuid,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_transfer_rules;
  saved_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_from_fund_id IS NULL OR p_to_fund_id IS NULL
    OR p_from_fund_id = p_to_fund_id OR p_active IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id IN (p_from_fund_id, p_to_fund_id)
        AND active
      HAVING count(*) = 2
    )
  THEN
    RAISE EXCEPTION 'Choose two active funds.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_rule_id IS NULL THEN
    INSERT INTO public.expense_fund_transfer_rules (
      society_id, from_fund_id, to_fund_id, active, created_by
    ) VALUES (
      p_society_id, p_from_fund_id, p_to_fund_id, p_active, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_fund_transfer_rules
    WHERE society_id = p_society_id AND id = p_rule_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transfer rule not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The transfer rule changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF previous.from_fund_id <> p_from_fund_id
      OR previous.to_fund_id <> p_to_fund_id
    THEN
      RAISE EXCEPTION 'A transfer pair cannot change; deactivate and add another.'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.expense_fund_transfer_rules
    SET active = p_active WHERE society_id = p_society_id AND id = p_rule_id;
    saved_id := p_rule_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_transfer_rule.save',
    'expense_fund_transfer_rule', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object(
      'active', previous.active
    ) END,
    jsonb_build_object(
      'from_fund_id', p_from_fund_id, 'to_fund_id', p_to_fund_id,
      'active', p_active
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_transfer_record(
  p_society_id uuid,
  p_from_fund_id uuid,
  p_to_fund_id uuid,
  p_transfer_on date,
  p_amount_paise bigint,
  p_reason text,
  p_decision_reference text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_transfers;
  saved_id uuid;
  clean_reason text := NULLIF(btrim(p_reason), '');
  clean_reference text := NULLIF(btrim(p_decision_reference), '');
  available bigint;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_from_fund_id IS NULL OR p_to_fund_id IS NULL
    OR p_from_fund_id = p_to_fund_id
    OR p_transfer_on IS NULL
    OR p_transfer_on > private.housekeeping_local_date(p_society_id)
    OR p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR clean_reason IS NULL OR char_length(clean_reason) > 1000
    OR clean_reference IS NULL OR char_length(clean_reference) > 120
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the fund transfer details.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-fund-transfer:' || p_society_id::text || auth.uid()::text
      || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_fund_transfers
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF previous.reverses_transfer_id IS NOT NULL
      OR ROW(
        previous.from_fund_id, previous.to_fund_id, previous.transfer_on,
        previous.amount_paise, previous.reason, previous.decision_reference
      ) IS DISTINCT FROM ROW(
        p_from_fund_id, p_to_fund_id, p_transfer_on, p_amount_paise,
        clean_reason, clean_reference
      )
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_fund_openings
    WHERE society_id = p_society_id AND cutover_on <= p_transfer_on
  ) THEN
    RAISE EXCEPTION 'Activate fund tracking before transferring allocations.'
      USING ERRCODE = '23514';
  END IF;
  IF private.expense_month_closed(p_society_id, p_transfer_on) THEN
    RAISE EXCEPTION 'Reopen the month before transferring fund allocations.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_fund_transfer_rules
    WHERE society_id = p_society_id
      AND from_fund_id = p_from_fund_id AND to_fund_id = p_to_fund_id
      AND active
      AND EXISTS (
        SELECT 1 FROM public.expense_funds AS source
        WHERE source.society_id = p_society_id
          AND source.id = p_from_fund_id AND source.active
      )
      AND EXISTS (
        SELECT 1 FROM public.expense_funds AS target
        WHERE target.society_id = p_society_id
          AND target.id = p_to_fund_id AND target.active
      )
  ) THEN
    RAISE EXCEPTION 'This fund transfer pair is not configured.' USING ERRCODE = '23514';
  END IF;
  available := private.expense_fund_available_balance(
    p_society_id, p_from_fund_id, p_transfer_on
  );
  IF available < 0 OR p_amount_paise > available THEN
    RAISE EXCEPTION 'The available source-fund balance is not sufficient.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_fund_transfers (
    society_id, from_fund_id, to_fund_id, transfer_on, amount_paise,
    reason, decision_reference, created_by, client_request_id
  ) VALUES (
    p_society_id, p_from_fund_id, p_to_fund_id, p_transfer_on,
    p_amount_paise, clean_reason, clean_reference, auth.uid(),
    p_client_request_id
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_transfer.record',
    'expense_fund_transfer', saved_id::text, NULL,
    jsonb_build_object(
      'from_fund_id', p_from_fund_id, 'to_fund_id', p_to_fund_id,
      'amount_paise', p_amount_paise, 'transfer_on', p_transfer_on,
      'reason', clean_reason, 'decision_reference', clean_reference
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_transfer_reverse(
  p_society_id uuid,
  p_transfer_id uuid,
  p_reverse_on date,
  p_reason text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  original public.expense_fund_transfers;
  previous public.expense_fund_transfers;
  clean_reason text := NULLIF(btrim(p_reason), '');
  saved_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_transfer_id IS NULL OR p_reverse_on IS NULL
    OR p_reverse_on > private.housekeeping_local_date(p_society_id)
    OR clean_reason IS NULL OR char_length(clean_reason) > 1000
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the fund-transfer reversal.' USING ERRCODE = '22023';
  END IF;
  IF private.expense_month_closed(p_society_id, p_reverse_on) THEN
    RAISE EXCEPTION 'Reopen the month before reversing a fund transfer.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-fund-transfer-reverse:' || p_society_id::text || auth.uid()::text
      || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_fund_transfers
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF previous.reverses_transfer_id IS DISTINCT FROM p_transfer_id
      OR previous.transfer_on <> p_reverse_on OR previous.reason <> clean_reason
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO original FROM public.expense_fund_transfers
  WHERE society_id = p_society_id AND id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fund transfer not found.' USING ERRCODE = 'P0002';
  END IF;
  IF original.reverses_transfer_id IS NOT NULL
    OR p_reverse_on < original.transfer_on
    OR EXISTS (
      SELECT 1 FROM public.expense_fund_transfers AS reversal
      WHERE reversal.society_id = p_society_id
        AND reversal.reverses_transfer_id = original.id
    )
  THEN
    RAISE EXCEPTION 'The fund transfer was already reversed.'
      USING ERRCODE = '23505';
  END IF;
  IF private.expense_month_closed(p_society_id, p_reverse_on) THEN
    RAISE EXCEPTION 'Reopen the month before reversing a fund transfer.'
      USING ERRCODE = '23514';
  END IF;
  IF private.expense_fund_available_balance(
    p_society_id, original.to_fund_id, p_reverse_on
  ) < original.amount_paise THEN
    RAISE EXCEPTION 'The target fund no longer has enough available balance to reverse.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_fund_transfers (
    society_id, from_fund_id, to_fund_id, transfer_on, amount_paise,
    reason, decision_reference, reverses_transfer_id, created_by,
    client_request_id
  ) VALUES (
    p_society_id, original.to_fund_id, original.from_fund_id, p_reverse_on,
    original.amount_paise, clean_reason, original.decision_reference,
    original.id, auth.uid(), p_client_request_id
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_transfer.reverse',
    'expense_fund_transfer', saved_id::text, NULL,
    jsonb_build_object(
      'reverses_transfer_id', original.id, 'transfer_on', p_reverse_on,
      'reason', clean_reason
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_transfers_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'rules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rule.id,
        'from_fund_id', rule.from_fund_id,
        'from_fund_name', source.name,
        'to_fund_id', rule.to_fund_id,
        'to_fund_name', target.name,
        'active', rule.active,
        'updated_at', rule.updated_at
      ) ORDER BY lower(source.name), lower(target.name))
      FROM public.expense_fund_transfer_rules AS rule
      JOIN public.expense_funds AS source
        ON source.society_id = rule.society_id AND source.id = rule.from_fund_id
      JOIN public.expense_funds AS target
        ON target.society_id = rule.society_id AND target.id = rule.to_fund_id
      WHERE rule.society_id = p_society_id
    ), '[]'::jsonb),
    'transfers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', transfer.id,
        'from_fund_id', transfer.from_fund_id,
        'from_fund_name', source.name,
        'to_fund_id', transfer.to_fund_id,
        'to_fund_name', target.name,
        'transfer_on', transfer.transfer_on,
        'amount_paise', transfer.amount_paise,
        'reason', transfer.reason,
        'decision_reference', transfer.decision_reference,
        'reverses_transfer_id', transfer.reverses_transfer_id
      ) ORDER BY transfer.transfer_on DESC, transfer.created_at DESC, transfer.id)
      FROM public.expense_fund_transfers AS transfer
      JOIN public.expense_funds AS source
        ON source.society_id = transfer.society_id AND source.id = transfer.from_fund_id
      JOIN public.expense_funds AS target
        ON target.society_id = transfer.society_id AND target.id = transfer.to_fund_id
      WHERE transfer.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_transfer_rule_save(
    uuid, uuid, uuid, uuid, boolean, timestamptz, text
  ),
  public.expense_fund_transfer_record(
    uuid, uuid, uuid, date, bigint, text, text, uuid, text
  ),
  public.expense_fund_transfer_reverse(uuid, uuid, date, text, uuid, text),
  public.expense_fund_transfers_list(uuid),
  public.expense_funds_activity_transfers(uuid, integer, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_transfer_rule_save(
    uuid, uuid, uuid, uuid, boolean, timestamptz, text
  ),
  public.expense_fund_transfer_record(
    uuid, uuid, uuid, date, bigint, text, text, uuid, text
  ),
  public.expense_fund_transfer_reverse(uuid, uuid, date, text, uuid, text),
  public.expense_fund_transfers_list(uuid),
  public.expense_funds_activity_transfers(uuid, integer, integer)
  TO authenticated;
