-- Add P40.1a fund setup, opening allocations and acknowledged activation.
CREATE TABLE public.expense_funds (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX expense_funds_name_key
  ON public.expense_funds (society_id, lower(name));
CREATE INDEX expense_funds_active_idx
  ON public.expense_funds (society_id, active, lower(name));
CREATE INDEX expense_funds_created_by_idx ON public.expense_funds (created_by);
CREATE INDEX expense_funds_updated_by_idx ON public.expense_funds (updated_by);
CREATE TRIGGER expense_funds_set_updated_at
  BEFORE UPDATE ON public.expense_funds
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_fund_openings (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  cutover_on date NOT NULL CHECK (extract(day FROM cutover_on) = 1),
  accounts_total_paise bigint NOT NULL
    CHECK (accounts_total_paise BETWEEN -9007199254740991 AND 9007199254740991),
  allocated_total_paise bigint NOT NULL
    CHECK (allocated_total_paise >= 0 AND allocated_total_paise <= 9007199254740991),
  warning_acknowledged_text text NOT NULL
    CHECK (char_length(warning_acknowledged_text) BETWEEN 1 AND 2000),
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id),
  UNIQUE (society_id, id),
  UNIQUE (society_id, activated_by, client_request_id)
);
CREATE INDEX expense_fund_openings_activated_by_idx
  ON public.expense_fund_openings (activated_by);

CREATE TABLE public.expense_fund_opening_allocations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  opening_id uuid NOT NULL,
  allocation_version_id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
  fund_id uuid NOT NULL,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 0 AND 9007199254740991),
  accounts_total_paise bigint NOT NULL
    CHECK (accounts_total_paise BETWEEN 0 AND 9007199254740991),
  reason text
    CHECK (reason IS NULL OR (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 1000)),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_fund_opening_allocations_opening_fkey
    FOREIGN KEY (society_id, opening_id)
    REFERENCES public.expense_fund_openings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_opening_allocations_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, opening_id, allocation_version_id, fund_id),
  UNIQUE (society_id, id)
);
CREATE INDEX expense_fund_opening_allocations_opening_idx
  ON public.expense_fund_opening_allocations (society_id, opening_id);
CREATE INDEX expense_fund_opening_allocations_fund_idx
  ON public.expense_fund_opening_allocations (society_id, fund_id);
CREATE INDEX expense_fund_opening_allocations_created_by_idx
  ON public.expense_fund_opening_allocations (created_by);
CREATE INDEX expense_fund_opening_allocations_request_idx
  ON public.expense_fund_opening_allocations
  (society_id, created_by, client_request_id);

ALTER TABLE public.expense_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_fund_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_fund_opening_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.expense_funds,
  public.expense_fund_openings,
  public.expense_fund_opening_allocations
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_funds_no_direct_access
  ON public.expense_funds FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_fund_openings_no_direct_access
  ON public.expense_fund_openings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_fund_opening_allocations_no_direct_access
  ON public.expense_fund_opening_allocations FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER expense_fund_openings_append_only
  BEFORE UPDATE OR DELETE ON public.expense_fund_openings
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_openings_no_truncate
  BEFORE TRUNCATE ON public.expense_fund_openings
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_opening_allocations_append_only
  BEFORE UPDATE OR DELETE ON public.expense_fund_opening_allocations
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_opening_allocations_no_truncate
  BEFORE TRUNCATE ON public.expense_fund_opening_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.expense_accounts_total(
  p_society_id uuid,
  p_as_of date
)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  total numeric;
BEGIN
  SELECT COALESCE(sum(
    private.expense_balance(p_society_id, account.id, p_as_of)
  ), 0) INTO total
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id;
  IF total NOT BETWEEN -9007199254740991 AND 9007199254740991 THEN
    RAISE EXCEPTION 'The Accounts total is outside the supported safe range.'
      USING ERRCODE = '22023';
  END IF;
  RETURN total::bigint;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_accounts_total(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_fund_latest_opening_version(p_opening_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT allocation_version_id
  FROM public.expense_fund_opening_allocations
  WHERE opening_id = p_opening_id
  ORDER BY created_at DESC, allocation_version_id DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.expense_fund_latest_opening_version(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_fund_save(
  p_society_id uuid,
  p_fund_id uuid,
  p_name text,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_funds;
  saved_id uuid;
  clean_name text := NULLIF(btrim(p_name), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) > 120 OR p_active IS NULL THEN
    RAISE EXCEPTION 'Check the fund name.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_fund_id IS NULL THEN
    SELECT * INTO previous FROM public.expense_funds
    WHERE society_id = p_society_id AND lower(name) = lower(clean_name);
    IF previous.id IS NOT NULL THEN
      IF previous.created_by = auth.uid() AND previous.name = clean_name
        AND previous.active = p_active
      THEN
        RETURN previous.id;
      END IF;
      RAISE EXCEPTION 'A fund with this name already exists.' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.expense_funds (
      society_id, name, active, created_by
    ) VALUES (
      p_society_id, clean_name, p_active, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_funds
    WHERE society_id = p_society_id AND id = p_fund_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fund not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The fund changed. Refresh before saving.' USING ERRCODE = '23505';
    END IF;
    UPDATE public.expense_funds
    SET name = clean_name, active = p_active
    WHERE society_id = p_society_id AND id = p_fund_id;
    saved_id := p_fund_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund.save', 'expense_fund',
    saved_id::text,
    CASE WHEN p_fund_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', previous.name, 'active', previous.active
    ) END,
    jsonb_build_object('name', clean_name, 'active', p_active),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_funds_activate(
  p_society_id uuid,
  p_cutover_on date,
  p_allocations jsonb,
  p_acknowledged boolean,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  warning_text constant text :=
    'Fund tracking allocates the existing Accounts total for reference. It does not move cash, create a bill or prove financial, legal or statutory authority.';
  existing public.expense_fund_openings;
  opening_id uuid;
  allocation jsonb;
  fund_id uuid;
  amount_paise bigint;
  accounts_total bigint;
  allocated_total bigint := 0;
  normalized jsonb := '[]'::jsonb;
  normalized_sorted jsonb;
  existing_sorted jsonb;
  seen_funds uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_cutover_on IS NULL OR extract(day FROM p_cutover_on) <> 1
    OR NOT p_acknowledged OR p_client_request_id IS NULL
    OR jsonb_typeof(p_allocations) <> 'array'
    OR jsonb_array_length(p_allocations) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Check the fund opening and acknowledge the warning.'
      USING ERRCODE = '22023';
  END IF;
  FOR allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF jsonb_typeof(allocation) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(allocation)) <> 2
      OR NOT (allocation ? 'fund_id') OR NOT (allocation ? 'amount_paise')
      OR jsonb_typeof(allocation -> 'fund_id') <> 'string'
      OR (allocation ->> 'fund_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR jsonb_typeof(allocation -> 'amount_paise') <> 'number'
      OR (allocation ->> 'amount_paise') !~ '^[0-9]{1,16}$'
    THEN
      RAISE EXCEPTION 'Check the fund allocations.' USING ERRCODE = '22023';
    END IF;
    fund_id := (allocation ->> 'fund_id')::uuid;
    amount_paise := (allocation ->> 'amount_paise')::bigint;
    IF amount_paise > 9007199254740991 OR fund_id = ANY(seen_funds) THEN
      RAISE EXCEPTION 'Check the fund allocations.' USING ERRCODE = '22023';
    END IF;
    seen_funds := array_append(seen_funds, fund_id);
    allocated_total := allocated_total + amount_paise;
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'fund_id', fund_id,
      'amount_paise', amount_paise
    ));
  END LOOP;

  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO existing FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  SELECT jsonb_agg(value ORDER BY value ->> 'fund_id')
  INTO normalized_sorted
  FROM jsonb_array_elements(normalized);
  IF existing.id IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'fund_id', allocation.fund_id,
        'amount_paise', allocation.amount_paise
      ) ORDER BY allocation.fund_id
    ) INTO existing_sorted
    FROM public.expense_fund_opening_allocations AS allocation
    WHERE allocation.society_id = p_society_id
      AND allocation.opening_id = existing.id;
    IF existing.activated_by = auth.uid()
      AND existing.client_request_id = p_client_request_id
      AND existing.cutover_on = p_cutover_on
      AND existing.allocated_total_paise = allocated_total
      AND existing_sorted = normalized_sorted
    THEN
      RETURN existing.id;
    END IF;
    RAISE EXCEPTION 'Fund tracking is already active.' USING ERRCODE = '23505';
  END IF;
  IF NOT private.expense_month_closed(
    p_society_id,
    (p_cutover_on - interval '1 month')::date
  ) THEN
    RAISE EXCEPTION 'Close the previous month before activating fund tracking.'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(normalized) AS item(fund_id uuid, amount_paise bigint)
    LEFT JOIN public.expense_funds AS fund
      ON fund.society_id = p_society_id AND fund.id = item.fund_id
    WHERE fund.id IS NULL OR NOT fund.active
  ) THEN
    RAISE EXCEPTION 'Use active funds from this society.' USING ERRCODE = '22023';
  END IF;
  accounts_total := private.expense_accounts_total(
    p_society_id,
    (p_cutover_on - interval '1 day')::date
  );
  IF accounts_total < 0 THEN
    RAISE EXCEPTION 'Reconcile a negative Accounts total before activation.'
      USING ERRCODE = '23514';
  END IF;
  IF allocated_total > accounts_total THEN
    RAISE EXCEPTION 'Fund openings cannot exceed the Accounts total.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_fund_openings (
    society_id, cutover_on, accounts_total_paise, allocated_total_paise,
    warning_acknowledged_text, activated_by, client_request_id
  ) VALUES (
    p_society_id, p_cutover_on, accounts_total, allocated_total,
    warning_text, auth.uid(), p_client_request_id
  ) RETURNING id INTO opening_id;
  INSERT INTO public.expense_fund_opening_allocations (
    society_id, opening_id, allocation_version_id, fund_id, amount_paise,
    accounts_total_paise, created_by, client_request_id
  )
  SELECT p_society_id, opening_id, opening_id, item.fund_id, item.amount_paise,
    accounts_total, auth.uid(), p_client_request_id
  FROM jsonb_to_recordset(normalized)
    AS item(fund_id uuid, amount_paise bigint);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.funds.activate',
    'expense_fund_opening', opening_id::text, NULL,
    jsonb_build_object(
      'cutover_on', p_cutover_on,
      'accounts_total_paise', accounts_total,
      'allocated_total_paise', allocated_total,
      'unallocated_paise', accounts_total - allocated_total,
      'allocations', normalized,
      'warning_acknowledged_text', warning_text
    ),
    p_request_trace
  );
  RETURN opening_id;
END;
$$;

CREATE FUNCTION public.expense_funds_workspace(
  p_society_id uuid,
  p_cutover_on date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
  selected_cutover date;
  opening public.expense_fund_openings;
  opening_review_at timestamptz;
  opening_current_total bigint;
  opening_review_reasons jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO opening FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  IF opening.id IS NOT NULL THEN
    SELECT max(allocation.created_at) INTO opening_review_at
    FROM public.expense_fund_opening_allocations AS allocation
    WHERE allocation.opening_id = opening.id
      AND allocation.allocation_version_id =
        private.expense_fund_latest_opening_version(opening.id);
    opening_current_total := private.expense_accounts_total(
      p_society_id,
      (opening.cutover_on - interval '1 day')::date
    );
    SELECT COALESCE(jsonb_agg(reason), '[]'::jsonb)
    INTO opening_review_reasons
    FROM (
      SELECT 'previous_month_reopened'::text AS reason
      WHERE EXISTS (
        SELECT 1
        FROM public.audit_logs AS audit
        WHERE audit.society_id = p_society_id
          AND audit.action = 'expense.month.reopen'
          AND audit.entity_id =
            (opening.cutover_on - interval '1 month')::date::text
          AND audit.created_at > opening_review_at
      )
      UNION ALL
      SELECT 'accounts_total_changed'
      WHERE opening_current_total <> (
        SELECT allocation.accounts_total_paise
        FROM public.expense_fund_opening_allocations AS allocation
        WHERE allocation.opening_id = opening.id
          AND allocation.allocation_version_id =
            private.expense_fund_latest_opening_version(opening.id)
        LIMIT 1
      )
      UNION ALL
      SELECT 'backdated_entry_added'
      WHERE EXISTS (
        SELECT 1
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id
          AND entry.entry_date < opening.cutover_on
          AND entry.created_at > opening_review_at
      )
      UNION ALL
      SELECT 'opening_account_changed'
      WHERE EXISTS (
        SELECT 1
        FROM public.audit_logs AS audit
        WHERE audit.society_id = p_society_id
          AND audit.action = 'expense.account.save'
          AND audit.created_at > opening_review_at
          AND (
            (audit."before" ->> 'opening_on')::date < opening.cutover_on
            OR (audit.after ->> 'opening_on')::date < opening.cutover_on
          )
          AND (
            audit."before" ->> 'opening_balance_paise'
              IS DISTINCT FROM audit.after ->> 'opening_balance_paise'
            OR audit."before" ->> 'opening_on'
              IS DISTINCT FROM audit.after ->> 'opening_on'
          )
      )
    ) AS reasons;
  END IF;
  SELECT cutover_on INTO selected_cutover
  FROM (
    SELECT (month + interval '1 month')::date AS cutover_on
    FROM public.expense_month_locks
    WHERE society_id = p_society_id
      AND (p_cutover_on IS NULL OR p_cutover_on = (month + interval '1 month')::date)
    ORDER BY month DESC
    LIMIT 1
  ) AS eligible;
  IF selected_cutover IS NULL THEN
    SELECT (month + interval '1 month')::date INTO selected_cutover
    FROM public.expense_month_locks
    WHERE society_id = p_society_id
    ORDER BY month DESC
    LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'today', today,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'funds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fund.id,
        'name', fund.name,
        'active', fund.active,
        'updated_at', fund.updated_at
      ) ORDER BY fund.active DESC, lower(fund.name))
      FROM public.expense_funds AS fund
      WHERE fund.society_id = p_society_id
    ), '[]'::jsonb),
    'eligible_cutovers', COALESCE((
      SELECT jsonb_agg((month + interval '1 month')::date ORDER BY month DESC)
      FROM public.expense_month_locks
      WHERE society_id = p_society_id
    ), '[]'::jsonb),
    'opening', CASE WHEN opening.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', opening.id,
      'cutover_on', opening.cutover_on,
      'accounts_total_paise', (
        SELECT latest.accounts_total_paise
        FROM public.expense_fund_opening_allocations AS latest
        WHERE latest.opening_id = opening.id
          AND latest.allocation_version_id =
            private.expense_fund_latest_opening_version(opening.id)
        ORDER BY latest.fund_id
        LIMIT 1
      ),
      'allocated_total_paise', (
        SELECT sum(latest.amount_paise)
        FROM public.expense_fund_opening_allocations AS latest
        WHERE latest.opening_id = opening.id
          AND latest.allocation_version_id =
            private.expense_fund_latest_opening_version(opening.id)
      ),
      'unallocated_paise',
        (
          SELECT latest.accounts_total_paise - sum(latest.amount_paise)
          FROM public.expense_fund_opening_allocations AS latest
          WHERE latest.opening_id = opening.id
            AND latest.allocation_version_id =
              private.expense_fund_latest_opening_version(opening.id)
          GROUP BY latest.accounts_total_paise
          LIMIT 1
        ),
      'warning_acknowledged_text', opening.warning_acknowledged_text,
      'activated_at', opening.activated_at,
      'activated_by_name', (
        SELECT profile.full_name
        FROM public.profiles AS profile
        WHERE profile.id = opening.activated_by
      ),
      'allocations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'fund_id', fund.id,
          'fund_name', fund.name,
          'amount_paise', allocation.amount_paise
        ) ORDER BY lower(fund.name))
        FROM public.expense_fund_opening_allocations AS allocation
        JOIN public.expense_funds AS fund
          ON fund.society_id = allocation.society_id
          AND fund.id = allocation.fund_id
        WHERE allocation.society_id = p_society_id
          AND allocation.opening_id = opening.id
          AND allocation.allocation_version_id =
            private.expense_fund_latest_opening_version(opening.id)
      ), '[]'::jsonb)
    , 'review_required', jsonb_array_length(opening_review_reasons) > 0,
      'review_reasons', opening_review_reasons,
      'current_accounts_total_paise', opening_current_total,
      'reviewed_at', opening_review_at
    ) END,
    'preview', CASE WHEN opening.id IS NOT NULL OR selected_cutover IS NULL
      THEN NULL ELSE jsonb_build_object(
        'cutover_on', selected_cutover,
        'as_of', (selected_cutover - interval '1 day')::date,
        'accounts_total_paise', private.expense_accounts_total(
          p_society_id,
          (selected_cutover - interval '1 day')::date
        ),
        'previous_month_closed', private.expense_month_closed(
          p_society_id,
          (selected_cutover - interval '1 month')::date
        )
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_save(uuid, uuid, text, boolean, timestamptz, text),
  public.expense_funds_activate(uuid, date, jsonb, boolean, uuid, text),
  public.expense_funds_workspace(uuid, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_save(uuid, uuid, text, boolean, timestamptz, text),
  public.expense_funds_activate(uuid, date, jsonb, boolean, uuid, text),
  public.expense_funds_workspace(uuid, date)
  TO authenticated;
