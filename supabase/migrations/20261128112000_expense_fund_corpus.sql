-- Add P40.3 manual corpus records and capped links to confirmed Accounts receipts.
CREATE TABLE public.expense_fund_corpus_records (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  unit_label_snapshot text NOT NULL
    CHECK (
      unit_label_snapshot = btrim(unit_label_snapshot)
      AND char_length(unit_label_snapshot) BETWEEN 1 AND 160
    ),
  fund_id uuid NOT NULL,
  event_description text NOT NULL
    CHECK (
      event_description = btrim(event_description)
      AND char_length(event_description) BETWEEN 1 AND 1000
    ),
  event_on date NOT NULL,
  reported_amount_paise bigint NOT NULL
    CHECK (reported_amount_paise BETWEEN 1 AND 9007199254740991),
  concession_paise bigint NOT NULL DEFAULT 0
    CHECK (concession_paise BETWEEN 0 AND 9007199254740991),
  concession_reason text
    CHECK (
      concession_reason IS NULL
      OR (
        concession_reason = btrim(concession_reason)
        AND char_length(concession_reason) BETWEEN 1 AND 1000
      )
    ),
  decision_reference text NOT NULL
    CHECK (
      decision_reference = btrim(decision_reference)
      AND char_length(decision_reference) BETWEEN 1 AND 120
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_corpus_unit_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_corpus_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_corpus_concession_check CHECK (
    concession_paise <= reported_amount_paise
    AND (
      (concession_paise = 0 AND concession_reason IS NULL)
      OR (concession_paise > 0 AND concession_reason IS NOT NULL)
    )
  ),
  UNIQUE (society_id, id)
);
CREATE INDEX expense_fund_corpus_unit_idx
  ON public.expense_fund_corpus_records (society_id, unit_id, event_on DESC);
CREATE INDEX expense_fund_corpus_fund_idx
  ON public.expense_fund_corpus_records (society_id, fund_id);
CREATE INDEX expense_fund_corpus_created_by_idx
  ON public.expense_fund_corpus_records (created_by);
CREATE INDEX expense_fund_corpus_updated_by_idx
  ON public.expense_fund_corpus_records (updated_by);
CREATE TRIGGER expense_fund_corpus_set_updated_at
  BEFORE UPDATE ON public.expense_fund_corpus_records
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_fund_receipt_links (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  corpus_record_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  reverses_link_id uuid,
  reason text
    CHECK (
      reason IS NULL
      OR (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 1000)
    ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_fund_receipt_corpus_fkey
    FOREIGN KEY (society_id, corpus_record_id)
    REFERENCES public.expense_fund_corpus_records (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_receipt_entry_fkey
    FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_receipt_reverses_fkey
    FOREIGN KEY (society_id, reverses_link_id)
    REFERENCES public.expense_fund_receipt_links (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, reverses_link_id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_fund_receipt_corpus_idx
  ON public.expense_fund_receipt_links (society_id, corpus_record_id);
CREATE INDEX expense_fund_receipt_entry_idx
  ON public.expense_fund_receipt_links (society_id, entry_id);
CREATE INDEX expense_fund_receipt_created_by_idx
  ON public.expense_fund_receipt_links (created_by);

ALTER TABLE public.expense_fund_corpus_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_fund_receipt_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_fund_corpus_records, public.expense_fund_receipt_links
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_fund_corpus_records_no_direct_access
  ON public.expense_fund_corpus_records FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_fund_receipt_links_no_direct_access
  ON public.expense_fund_receipt_links FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE TRIGGER expense_fund_receipt_links_append_only
  BEFORE UPDATE OR DELETE ON public.expense_fund_receipt_links
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_receipt_links_no_truncate
  BEFORE TRUNCATE ON public.expense_fund_receipt_links
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.expense_receipt_link_amount(
  p_entry_id uuid,
  p_fund_id uuid
)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(sum(
    CASE WHEN link.reverses_link_id IS NULL THEN link.amount_paise
      ELSE -link.amount_paise END
  ), 0)::bigint
  FROM public.expense_fund_receipt_links AS link
  JOIN public.expense_fund_corpus_records AS corpus
    ON corpus.society_id = link.society_id AND corpus.id = link.corpus_record_id
  JOIN public.expense_book_entries AS entry
    ON entry.society_id = link.society_id AND entry.id = link.entry_id
  WHERE link.entry_id = p_entry_id AND corpus.fund_id = p_fund_id
    AND NOT EXISTS (
      SELECT 1 FROM public.expense_book_entries AS reversal
      WHERE reversal.society_id = entry.society_id
        AND reversal.reverses_entry_id = entry.id
    )
$$;
REVOKE ALL ON FUNCTION private.expense_receipt_link_amount(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_fund_corpus_save(
  p_society_id uuid,
  p_record_id uuid,
  p_unit_id uuid,
  p_fund_id uuid,
  p_event_description text,
  p_event_on date,
  p_reported_amount_paise bigint,
  p_concession_paise bigint,
  p_concession_reason text,
  p_decision_reference text,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_corpus_records;
  unit_label text;
  saved_id uuid;
  clean_description text := btrim(p_event_description);
  clean_concession_reason text := NULLIF(btrim(p_concession_reason), '');
  clean_reference text := btrim(p_decision_reference);
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_description IS NULL OR char_length(clean_description) NOT BETWEEN 1 AND 1000
    OR clean_reference IS NULL OR char_length(clean_reference) NOT BETWEEN 1 AND 120
    OR p_event_on IS NULL OR p_reported_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_concession_paise IS NULL
      OR p_concession_paise NOT BETWEEN 0 AND p_reported_amount_paise
    OR (p_concession_paise = 0) IS DISTINCT FROM (clean_concession_reason IS NULL)
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    )
  THEN
    RAISE EXCEPTION 'Check the corpus record.' USING ERRCODE = '22023';
  END IF;
  SELECT unit.number INTO unit_label
  FROM public.units AS unit
  WHERE unit.society_id = p_society_id AND unit.id = p_unit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose a unit from this society.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_record_id IS NULL THEN
    INSERT INTO public.expense_fund_corpus_records (
      society_id, unit_id, unit_label_snapshot, fund_id, event_description,
      event_on, reported_amount_paise, concession_paise, concession_reason,
      decision_reference, created_by
    ) VALUES (
      p_society_id, p_unit_id, unit_label, p_fund_id, clean_description,
      p_event_on, p_reported_amount_paise, p_concession_paise,
      clean_concession_reason, clean_reference, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_fund_corpus_records
    WHERE society_id = p_society_id AND id = p_record_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Corpus record not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The corpus record changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF p_fund_id <> previous.fund_id AND EXISTS (
      SELECT 1 FROM public.expense_fund_receipt_links AS link
      WHERE link.society_id = p_society_id
        AND link.corpus_record_id = previous.id
        AND link.reverses_link_id IS NULL
    ) THEN
      RAISE EXCEPTION 'The fund cannot change after a receipt is linked.'
        USING ERRCODE = '23514';
    END IF;
    IF p_reported_amount_paise - p_concession_paise < COALESCE((
      SELECT sum(link.amount_paise)
      FROM public.expense_fund_receipt_links AS link
      JOIN public.expense_book_entries AS entry
        ON entry.society_id = link.society_id AND entry.id = link.entry_id
      WHERE link.society_id = p_society_id
        AND link.corpus_record_id = previous.id
        AND link.reverses_link_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_book_entries AS reversal
          WHERE reversal.society_id = entry.society_id
            AND reversal.reverses_entry_id = entry.id
        )
    ), 0) THEN
      RAISE EXCEPTION 'The corpus cap cannot fall below linked receipts.'
        USING ERRCODE = '23514';
    END IF;
    UPDATE public.expense_fund_corpus_records
    SET unit_id = p_unit_id, unit_label_snapshot = unit_label,
      fund_id = p_fund_id, event_description = clean_description,
      event_on = p_event_on, reported_amount_paise = p_reported_amount_paise,
      concession_paise = p_concession_paise,
      concession_reason = clean_concession_reason,
      decision_reference = clean_reference
    WHERE society_id = p_society_id AND id = p_record_id;
    saved_id := p_record_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_corpus.save',
    'expense_fund_corpus', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object(
      'unit_id', previous.unit_id, 'fund_id', previous.fund_id,
      'reported_amount_paise', previous.reported_amount_paise,
      'concession_paise', previous.concession_paise
    ) END,
    jsonb_build_object(
      'unit_id', p_unit_id, 'unit_label_snapshot', unit_label,
      'fund_id', p_fund_id, 'reported_amount_paise', p_reported_amount_paise,
      'concession_paise', p_concession_paise,
      'decision_reference', clean_reference
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_receipt_link(
  p_society_id uuid,
  p_corpus_record_id uuid,
  p_entry_id uuid,
  p_amount_paise bigint,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  record public.expense_fund_corpus_records;
  entry public.expense_book_entries;
  previous public.expense_fund_receipt_links;
  saved_id uuid;
  allocated bigint;
  available bigint;
  already_linked bigint;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the receipt link amount.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-corpus-link:' || p_society_id::text || auth.uid()::text
      || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_fund_receipt_links
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.corpus_record_id, previous.entry_id, previous.amount_paise)
      IS DISTINCT FROM ROW(p_corpus_record_id, p_entry_id, p_amount_paise)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO record FROM public.expense_fund_corpus_records
  WHERE society_id = p_society_id AND id = p_corpus_record_id FOR UPDATE;
  SELECT * INTO entry FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id FOR UPDATE;
  IF record.id IS NULL OR entry.id IS NULL THEN
    RAISE EXCEPTION 'Corpus record or Accounts receipt not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF entry.source NOT IN ('income', 'billing_payment')
    OR entry.direction <> 'in'
    OR EXISTS (
      SELECT 1 FROM public.expense_book_entries AS reversal
      WHERE reversal.society_id = entry.society_id
        AND reversal.reverses_entry_id = entry.id
    )
  THEN
    RAISE EXCEPTION 'Choose an unreversed Accounts receipt.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(sum(allocation.amount_paise), 0) INTO allocated
  FROM public.expense_fund_entry_allocations AS allocation
  WHERE allocation.society_id = p_society_id
    AND allocation.entry_id = entry.id
    AND allocation.fund_id = record.fund_id
    AND allocation.allocation_version_id =
      private.expense_fund_latest_allocation_version(entry.id);
  available := allocated - private.expense_receipt_link_amount(entry.id, record.fund_id);
  already_linked := COALESCE((
    SELECT sum(
      CASE WHEN link.reverses_link_id IS NULL THEN link.amount_paise
        ELSE -link.amount_paise END
    )
    FROM public.expense_fund_receipt_links AS link
    JOIN public.expense_book_entries AS linked_entry
      ON linked_entry.society_id = link.society_id
      AND linked_entry.id = link.entry_id
    WHERE link.society_id = p_society_id
      AND link.corpus_record_id = record.id
      AND NOT EXISTS (
        SELECT 1 FROM public.expense_book_entries AS reversal
        WHERE reversal.society_id = linked_entry.society_id
          AND reversal.reverses_entry_id = linked_entry.id
      )
  ), 0);
  IF p_amount_paise > available
    OR p_amount_paise > (
      record.reported_amount_paise - record.concession_paise - already_linked
    )
  THEN
    RAISE EXCEPTION 'The receipt exceeds its fund allocation or the remaining corpus amount.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_fund_receipt_links (
    society_id, corpus_record_id, entry_id, amount_paise,
    created_by, client_request_id
  ) VALUES (
    p_society_id, record.id, entry.id, p_amount_paise, auth.uid(),
    p_client_request_id
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_receipt.link',
    'expense_fund_receipt_link', saved_id::text, NULL,
    jsonb_build_object(
      'corpus_record_id', record.id, 'entry_id', entry.id,
      'amount_paise', p_amount_paise, 'fund_id', record.fund_id
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_corpus_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'label', unit.number)
        ORDER BY lower(unit.number))
      FROM public.units AS unit WHERE unit.society_id = p_society_id
    ), '[]'::jsonb),
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', record.id,
        'unit_id', record.unit_id,
        'unit_label_snapshot', record.unit_label_snapshot,
        'fund_id', record.fund_id,
        'fund_name', fund.name,
        'event_description', record.event_description,
        'event_on', record.event_on,
        'reported_amount_paise', record.reported_amount_paise,
        'concession_paise', record.concession_paise,
        'concession_reason', record.concession_reason,
        'decision_reference', record.decision_reference,
        'linked_receipts_paise', COALESCE((
          SELECT sum(
            CASE WHEN link.reverses_link_id IS NULL
                AND NOT EXISTS (
                  SELECT 1 FROM public.expense_book_entries AS reversal
                  WHERE reversal.society_id = entry.society_id
                    AND reversal.reverses_entry_id = entry.id
                )
              THEN link.amount_paise ELSE 0 END
          )
          FROM public.expense_fund_receipt_links AS link
          JOIN public.expense_book_entries AS entry
            ON entry.society_id = link.society_id AND entry.id = link.entry_id
          WHERE link.society_id = record.society_id
            AND link.corpus_record_id = record.id
            AND link.reverses_link_id IS NULL
        ), 0),
        'remaining_paise',
          record.reported_amount_paise - record.concession_paise - COALESCE((
            SELECT sum(
              CASE WHEN NOT EXISTS (
                SELECT 1 FROM public.expense_book_entries AS reversal
                WHERE reversal.society_id = entry.society_id
                  AND reversal.reverses_entry_id = entry.id
              ) THEN link.amount_paise ELSE 0 END
            )
            FROM public.expense_fund_receipt_links AS link
            JOIN public.expense_book_entries AS entry
              ON entry.society_id = link.society_id AND entry.id = link.entry_id
            WHERE link.society_id = record.society_id
              AND link.corpus_record_id = record.id
              AND link.reverses_link_id IS NULL
          ), 0),
        'updated_at', record.updated_at
      ) ORDER BY record.event_on DESC, record.created_at DESC)
      FROM public.expense_fund_corpus_records AS record
      JOIN public.expense_funds AS fund
        ON fund.society_id = record.society_id AND fund.id = record.fund_id
      WHERE record.society_id = p_society_id
    ), '[]'::jsonb),
    'eligible_receipts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entry_id', entry.id,
        'fund_id', allocation.fund_id,
        'voucher_no', private.expense_voucher_label(
          voucher.voucher_type, voucher.financial_year, voucher.sequence
        ),
        'entry_date', entry.entry_date,
        'counterparty', entry.counterparty,
        'amount_paise', allocation.amount_paise
          - private.expense_receipt_link_amount(entry.id, allocation.fund_id)
      ) ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id)
      FROM public.expense_fund_entry_allocations AS allocation
      JOIN public.expense_book_entries AS entry
        ON entry.society_id = allocation.society_id AND entry.id = allocation.entry_id
      JOIN public.expense_vouchers AS voucher
        ON voucher.society_id = entry.society_id AND voucher.entry_id = entry.id
      WHERE entry.society_id = p_society_id
        AND entry.source IN ('income', 'billing_payment')
        AND allocation.fund_id IS NOT NULL
        AND allocation.allocation_version_id =
          private.expense_fund_latest_allocation_version(entry.id)
        AND allocation.amount_paise >
          private.expense_receipt_link_amount(entry.id, allocation.fund_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_book_entries AS reversal
          WHERE reversal.society_id = entry.society_id
            AND reversal.reverses_entry_id = entry.id
        )
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_corpus_save(
    uuid, uuid, uuid, uuid, text, date, bigint, bigint, text, text,
    timestamptz, text
  ),
  public.expense_fund_receipt_link(uuid, uuid, uuid, bigint, uuid, text),
  public.expense_fund_corpus_list(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_corpus_save(
    uuid, uuid, uuid, uuid, text, date, bigint, bigint, text, text,
    timestamptz, text
  ),
  public.expense_fund_receipt_link(uuid, uuid, uuid, bigint, uuid, text),
  public.expense_fund_corpus_list(uuid)
  TO authenticated;
