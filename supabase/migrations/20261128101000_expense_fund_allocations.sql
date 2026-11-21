-- Add P40.1b mappings, append-only entry allocation versions and derived fund balances.
CREATE TABLE public.expense_fund_mappings (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  fund_id uuid NOT NULL,
  source_kind text NOT NULL
    CHECK (source_kind IN ('expense_category', 'income_kind', 'billing_charge')),
  expense_category_id uuid,
  income_kind text,
  billing_charge_type_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_mappings_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_mappings_category_fkey
    FOREIGN KEY (society_id, expense_category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_mappings_billing_charge_fkey
    FOREIGN KEY (society_id, billing_charge_type_id)
    REFERENCES public.billing_charge_types (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_mappings_shape_check CHECK (
    (source_kind = 'expense_category' AND expense_category_id IS NOT NULL
      AND income_kind IS NULL AND billing_charge_type_id IS NULL)
    OR (source_kind = 'income_kind' AND expense_category_id IS NULL
      AND income_kind IN ('donation', 'interest', 'other')
      AND billing_charge_type_id IS NULL)
    OR (source_kind = 'billing_charge' AND expense_category_id IS NULL
      AND income_kind IS NULL AND billing_charge_type_id IS NOT NULL)
  ),
  UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX expense_fund_mappings_category_key
  ON public.expense_fund_mappings (society_id, expense_category_id)
  WHERE expense_category_id IS NOT NULL;
CREATE UNIQUE INDEX expense_fund_mappings_income_key
  ON public.expense_fund_mappings (society_id, income_kind)
  WHERE income_kind IS NOT NULL;
CREATE UNIQUE INDEX expense_fund_mappings_billing_charge_key
  ON public.expense_fund_mappings (society_id, billing_charge_type_id)
  WHERE billing_charge_type_id IS NOT NULL;
CREATE INDEX expense_fund_mappings_fund_idx
  ON public.expense_fund_mappings (society_id, fund_id);
CREATE INDEX expense_fund_mappings_created_by_idx
  ON public.expense_fund_mappings (created_by);
CREATE INDEX expense_fund_mappings_updated_by_idx
  ON public.expense_fund_mappings (updated_by);
CREATE TRIGGER expense_fund_mappings_set_updated_at
  BEFORE UPDATE ON public.expense_fund_mappings
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_fund_entry_allocations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  entry_id uuid NOT NULL,
  allocation_version_id uuid NOT NULL,
  fund_id uuid,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  reason text CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 1000),
  CONSTRAINT expense_fund_entry_allocations_entry_fkey
    FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_entry_allocations_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, allocation_version_id, fund_id),
  UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX expense_fund_entry_allocations_unallocated_key
  ON public.expense_fund_entry_allocations
  (society_id, allocation_version_id)
  WHERE fund_id IS NULL;
CREATE INDEX expense_fund_entry_allocations_request_idx
  ON public.expense_fund_entry_allocations
  (society_id, created_by, client_request_id);
CREATE INDEX expense_fund_entry_allocations_entry_idx
  ON public.expense_fund_entry_allocations
  (society_id, entry_id, created_at DESC, allocation_version_id);
CREATE INDEX expense_fund_entry_allocations_fund_idx
  ON public.expense_fund_entry_allocations (society_id, fund_id);
CREATE INDEX expense_fund_entry_allocations_created_by_idx
  ON public.expense_fund_entry_allocations (created_by);

ALTER TABLE public.expense_fund_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_fund_entry_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.expense_fund_mappings,
  public.expense_fund_entry_allocations
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_fund_mappings_no_direct_access
  ON public.expense_fund_mappings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_fund_entry_allocations_no_direct_access
  ON public.expense_fund_entry_allocations FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE TRIGGER expense_fund_entry_allocations_append_only
  BEFORE UPDATE OR DELETE ON public.expense_fund_entry_allocations
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_entry_allocations_no_truncate
  BEFORE TRUNCATE ON public.expense_fund_entry_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.expense_fund_latest_allocation_version(p_entry_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT allocation_version_id
  FROM public.expense_fund_entry_allocations
  WHERE entry_id = p_entry_id
  ORDER BY created_at DESC, allocation_version_id DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.expense_fund_latest_allocation_version(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_fund_copy_allocation_version(
  p_source_entry_id uuid,
  p_target_entry_id uuid,
  p_created_by uuid,
  p_client_request_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source_version_id uuid;
  target_version_id uuid := extensions.gen_random_uuid();
BEGIN
  source_version_id := private.expense_fund_latest_allocation_version(
    p_source_entry_id
  );
  IF source_version_id IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.expense_fund_entry_allocations (
    society_id, entry_id, allocation_version_id, fund_id, amount_paise,
    created_by, client_request_id, reason
  )
  SELECT allocation.society_id, p_target_entry_id, target_version_id,
    allocation.fund_id, allocation.amount_paise, p_created_by,
    p_client_request_id, 'Follow original entry allocation'
  FROM public.expense_fund_entry_allocations AS allocation
  WHERE allocation.entry_id = p_source_entry_id
    AND allocation.allocation_version_id = source_version_id;
  RETURN target_version_id;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_fund_copy_allocation_version(
  uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_fund_follow_reversal()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.source = 'reversal' THEN
    PERFORM private.expense_fund_copy_allocation_version(
      NEW.reverses_entry_id, NEW.id, NEW.created_by, NEW.client_request_id
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_fund_follow_reversal()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_book_entries_fund_follow_reversal
  AFTER INSERT ON public.expense_book_entries
  FOR EACH ROW EXECUTE FUNCTION private.expense_fund_follow_reversal();

CREATE FUNCTION public.expense_fund_mapping_save(
  p_society_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_income_kind text,
  p_fund_id uuid,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_mappings;
  saved_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_source_kind NOT IN ('expense_category', 'income_kind')
    OR (p_source_kind = 'expense_category'
      AND (p_source_id IS NULL OR p_income_kind IS NOT NULL))
    OR (p_source_kind = 'income_kind'
      AND (p_source_id IS NOT NULL OR p_income_kind NOT IN ('donation', 'interest', 'other')))
    OR (p_fund_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    ))
  THEN
    RAISE EXCEPTION 'Check the fund suggestion mapping.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO previous FROM public.expense_fund_mappings
  WHERE society_id = p_society_id
    AND (
      (p_source_kind = 'expense_category' AND expense_category_id = p_source_id)
      OR (p_source_kind = 'income_kind' AND income_kind = p_income_kind)
    ) FOR UPDATE;
  IF previous.id IS NOT NULL THEN
    IF p_expected_updated_at IS NOT NULL
      AND previous.updated_at IS DISTINCT FROM p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The mapping changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF p_fund_id IS NULL THEN
      DELETE FROM public.expense_fund_mappings WHERE id = previous.id;
      INSERT INTO public.audit_logs (
        society_id, actor_id, actor_role, action, entity_type, entity_id,
        "before", "after", request_id
      ) VALUES (
        p_society_id, auth.uid(), 'admin', 'expense.fund_mapping.remove',
        'expense_fund_mapping', previous.id::text,
        jsonb_build_object('fund_id', previous.fund_id),
        jsonb_build_object('fund_id', null), p_request_trace
      );
      RETURN previous.id;
    END IF;
    UPDATE public.expense_fund_mappings
    SET fund_id = p_fund_id
    WHERE id = previous.id;
    saved_id := previous.id;
  ELSE
    IF p_fund_id IS NULL THEN
      RAISE EXCEPTION 'No mapping exists to remove.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.expense_fund_mappings (
      society_id, fund_id, source_kind, expense_category_id,
      income_kind, created_by
    ) VALUES (
      p_society_id, p_fund_id, p_source_kind,
      CASE WHEN p_source_kind = 'expense_category' THEN p_source_id END,
      CASE WHEN p_source_kind = 'income_kind' THEN p_income_kind END,
      auth.uid()
    ) RETURNING id INTO saved_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_mapping.save',
    'expense_fund_mapping', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL
      ELSE jsonb_build_object('fund_id', previous.fund_id) END,
    jsonb_build_object(
      'source_kind', p_source_kind,
      'expense_category_id', CASE WHEN p_source_kind = 'expense_category' THEN p_source_id END,
      'income_kind', CASE WHEN p_source_kind = 'income_kind' THEN p_income_kind END,
      'fund_id', p_fund_id
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_allocations_confirm(
  p_society_id uuid,
  p_items jsonb,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  opening public.expense_fund_openings;
  item jsonb;
  allocation jsonb;
  entry public.expense_book_entries;
  item_entry_id uuid;
  allocation_version_id uuid;
  allocated_total bigint;
  seen_entries uuid[] := ARRAY[]::uuid[];
  seen_funds uuid[];
  fund_id uuid;
  amount_paise bigint;
  confirmed_count integer := 0;
  skipped jsonb := '[]'::jsonb;
  existing_items jsonb;
  existing_confirmed_count integer;
  existing_skipped jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Confirm between 1 and 200 entries at once.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO opening FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  IF opening.id IS NULL THEN
    RAISE EXCEPTION 'Activate fund tracking first.' USING ERRCODE = '23514';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT (audit.after ->> 'confirmed_count')::integer,
    audit.after -> 'skipped', audit.after -> 'items'
  INTO existing_confirmed_count, existing_skipped, existing_items
  FROM public.audit_logs AS audit
  WHERE audit.society_id = p_society_id
    AND audit.actor_id = auth.uid()
    AND audit.action = 'expense.fund_allocations.confirm'
    AND audit.entity_id = p_client_request_id::text
  ORDER BY audit.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    IF existing_items IS DISTINCT FROM p_items THEN
      RAISE EXCEPTION 'This request was already used with different allocations.'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'confirmed_count', existing_confirmed_count,
      'skipped', existing_skipped
    );
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item -> 'entry_id') <> 'string'
      OR (item ->> 'entry_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR jsonb_typeof(item -> 'allocations') <> 'array'
      OR jsonb_array_length(item -> 'allocations') NOT BETWEEN 1 AND 200
    THEN
      RAISE EXCEPTION 'Check the allocation request.' USING ERRCODE = '22023';
    END IF;
    item_entry_id := (item ->> 'entry_id')::uuid;
    IF item_entry_id = ANY(seen_entries) THEN
      RAISE EXCEPTION 'An entry appears more than once.' USING ERRCODE = '22023';
    END IF;
    seen_entries := array_append(seen_entries, item_entry_id);
    SELECT * INTO entry FROM public.expense_book_entries
    WHERE society_id = p_society_id AND id = item_entry_id FOR UPDATE;
    IF NOT FOUND OR entry.entry_date < opening.cutover_on THEN
      RAISE EXCEPTION 'Choose an entry on or after fund activation.'
        USING ERRCODE = '22023';
    END IF;
    IF entry.source NOT IN ('expense', 'income', 'billing_payment') THEN
      RAISE EXCEPTION 'Allocate original entries; transfers have no fund effect and reversals follow them.'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.expense_book_entries AS reversal
      WHERE reversal.society_id = p_society_id
        AND reversal.reverses_entry_id = entry.id
        AND private.expense_month_closed(p_society_id, reversal.entry_date)
    ) THEN
      RAISE EXCEPTION 'Reopen the reversal month before confirming this allocation.'
        USING ERRCODE = '23514';
    END IF;
    IF private.expense_month_closed(p_society_id, entry.entry_date) THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object(
        'entry_id', entry.id,
        'voucher', NULL,
        'reason', 'month_closed'
      ));
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.expense_fund_entry_allocations AS existing
      WHERE existing.society_id = p_society_id
        AND existing.entry_id = entry.id
    ) THEN
      RAISE EXCEPTION 'This entry is already allocated. Use a reasoned correction.'
        USING ERRCODE = '23505';
    END IF;
    allocation_version_id := extensions.gen_random_uuid();
    allocated_total := 0;
    seen_funds := ARRAY[]::uuid[];
    FOR allocation IN SELECT value FROM jsonb_array_elements(item -> 'allocations')
    LOOP
      IF jsonb_typeof(allocation) <> 'object'
        OR jsonb_typeof(allocation -> 'amount_paise') <> 'number'
        OR (allocation ->> 'amount_paise') !~ '^[0-9]{1,16}$'
        OR (allocation ? 'fund_id'
          AND jsonb_typeof(allocation -> 'fund_id') NOT IN ('string', 'null'))
      THEN
        RAISE EXCEPTION 'Check the allocation amounts.' USING ERRCODE = '22023';
      END IF;
      fund_id := NULLIF(allocation ->> 'fund_id', '')::uuid;
      amount_paise := (allocation ->> 'amount_paise')::bigint;
      IF amount_paise NOT BETWEEN 1 AND 9007199254740991
        OR (fund_id IS NOT NULL AND fund_id = ANY(seen_funds))
        OR (fund_id IS NULL AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(item -> 'allocations') AS candidate
          WHERE candidate ->> 'fund_id' IS NULL
          OFFSET 1
        ))
        OR (fund_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.expense_funds
          WHERE society_id = p_society_id AND id = fund_id AND active
        ))
      THEN
        RAISE EXCEPTION 'Check the allocation funds.' USING ERRCODE = '22023';
      END IF;
      IF fund_id IS NOT NULL THEN
        seen_funds := array_append(seen_funds, fund_id);
      END IF;
      allocated_total := allocated_total + amount_paise;
      IF allocated_total > 9007199254740991 THEN
        RAISE EXCEPTION 'The allocated total is outside the supported range.'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF allocated_total <> entry.amount_paise THEN
      RAISE EXCEPTION 'Allocations must equal the entry amount.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.expense_fund_entry_allocations (
      society_id, entry_id, allocation_version_id, fund_id, amount_paise,
      created_by, client_request_id
    )
    SELECT p_society_id, entry.id, allocation_version_id,
      NULLIF(value ->> 'fund_id', '')::uuid,
      (value ->> 'amount_paise')::bigint,
      auth.uid(), p_client_request_id
    FROM jsonb_array_elements(item -> 'allocations') AS value;
    confirmed_count := confirmed_count + 1;
    PERFORM private.expense_fund_copy_allocation_version(
      entry.id,
      reversal.id,
      auth.uid(),
      p_client_request_id
    )
    FROM public.expense_book_entries AS reversal
    WHERE reversal.society_id = p_society_id
      AND reversal.reverses_entry_id = entry.id
      AND NOT EXISTS (
        SELECT 1 FROM public.expense_fund_entry_allocations AS current
        WHERE current.society_id = p_society_id
          AND current.entry_id = reversal.id
      );
  END LOOP;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_allocations.confirm',
    'expense_fund_allocations', p_client_request_id::text, NULL,
    jsonb_build_object('items', p_items, 'confirmed_count', confirmed_count, 'skipped', skipped),
    p_request_trace
  );
  RETURN jsonb_build_object(
    'confirmed_count', confirmed_count,
    'skipped', skipped
  );
END;
$$;

CREATE FUNCTION public.expense_funds_activity(
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
        ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb) END
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_mapping_save(uuid, text, uuid, text, uuid, timestamptz, text),
  public.expense_fund_allocations_confirm(uuid, jsonb, uuid, text),
  public.expense_funds_activity(uuid, integer, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_mapping_save(uuid, text, uuid, text, uuid, timestamptz, text),
  public.expense_fund_allocations_confirm(uuid, jsonb, uuid, text),
  public.expense_funds_activity(uuid, integer, integer)
  TO authenticated;
