-- Add P40.1c reasoned fund corrections and opening re-confirmation.
CREATE FUNCTION public.expense_fund_opening_correct(
  p_society_id uuid,
  p_allocations jsonb,
  p_reason text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  opening public.expense_fund_openings;
  clean_reason text := NULLIF(btrim(p_reason), '');
  allocation jsonb;
  fund_id uuid;
  amount_paise bigint;
  allocated_total bigint := 0;
  accounts_total bigint;
  version_id uuid := extensions.gen_random_uuid();
  previous_version_id uuid;
  seen_funds uuid[] := ARRAY[]::uuid[];
  existing_audit public.audit_logs;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_reason IS NULL OR char_length(clean_reason) > 1000
    OR p_client_request_id IS NULL
    OR jsonb_typeof(p_allocations) <> 'array'
    OR jsonb_array_length(p_allocations) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Give a reason and check the opening allocations.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO opening FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  IF opening.id IS NULL THEN
    RAISE EXCEPTION 'Activate fund tracking first.' USING ERRCODE = '23514';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO existing_audit FROM public.audit_logs
  WHERE society_id = p_society_id
    AND actor_id = auth.uid()
    AND action = 'expense.fund_opening.correct'
    AND entity_id = p_client_request_id::text
  ORDER BY created_at DESC
  LIMIT 1;
  IF existing_audit.id IS NOT NULL THEN
    IF existing_audit.after ->> 'reason' IS DISTINCT FROM clean_reason
      OR existing_audit.after -> 'allocations' IS DISTINCT FROM p_allocations
    THEN
      RAISE EXCEPTION 'This request was already used with a different correction.'
        USING ERRCODE = '23505';
    END IF;
    RETURN (existing_audit.after ->> 'allocation_version_id')::uuid;
  END IF;
  IF NOT private.expense_month_closed(
    p_society_id,
    (opening.cutover_on - interval '1 month')::date
  ) THEN
    RAISE EXCEPTION 'Close the previous month before re-confirming the opening.'
      USING ERRCODE = '23514';
  END IF;
  accounts_total := private.expense_accounts_total(
    p_society_id,
    (opening.cutover_on - interval '1 day')::date
  );
  IF accounts_total < 0 THEN
    RAISE EXCEPTION 'Reconcile the negative opening before re-confirming it.'
      USING ERRCODE = '23514';
  END IF;
  FOR allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF jsonb_typeof(allocation) <> 'object'
      OR jsonb_typeof(allocation -> 'fund_id') <> 'string'
      OR (allocation ->> 'fund_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR jsonb_typeof(allocation -> 'amount_paise') <> 'number'
      OR (allocation ->> 'amount_paise') !~ '^[0-9]{1,16}$'
    THEN
      RAISE EXCEPTION 'Check the opening allocations.' USING ERRCODE = '22023';
    END IF;
    fund_id := (allocation ->> 'fund_id')::uuid;
    amount_paise := (allocation ->> 'amount_paise')::bigint;
    IF amount_paise > 9007199254740991 OR fund_id = ANY(seen_funds)
      OR NOT EXISTS (
        SELECT 1 FROM public.expense_funds
        WHERE society_id = p_society_id AND id = fund_id AND active
      )
    THEN
      RAISE EXCEPTION 'Use each active fund at most once.' USING ERRCODE = '22023';
    END IF;
    seen_funds := array_append(seen_funds, fund_id);
    allocated_total := allocated_total + amount_paise;
  END LOOP;
  IF allocated_total > accounts_total THEN
    RAISE EXCEPTION 'Opening allocations cannot exceed the Accounts total.'
      USING ERRCODE = '23514';
  END IF;
  previous_version_id := private.expense_fund_latest_opening_version(opening.id);
  INSERT INTO public.expense_fund_opening_allocations (
    society_id, opening_id, allocation_version_id, fund_id, amount_paise,
    accounts_total_paise, reason, created_by, client_request_id
  )
  SELECT p_society_id, opening.id, version_id, item.fund_id,
    item.amount_paise, accounts_total, clean_reason, auth.uid(),
    p_client_request_id
  FROM jsonb_to_recordset(p_allocations)
    AS item(fund_id uuid, amount_paise bigint);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_opening.correct',
    'expense_fund_opening', p_client_request_id::text,
    jsonb_build_object(
      'allocation_version_id', previous_version_id
    ),
    jsonb_build_object(
      'opening_id', opening.id,
      'allocation_version_id', version_id,
      'accounts_total_paise', accounts_total,
      'allocated_total_paise', allocated_total,
      'allocations', p_allocations,
      'reason', clean_reason
    ),
    p_request_trace
  );
  RETURN version_id;
END;
$$;

CREATE FUNCTION public.expense_fund_allocation_correct(
  p_society_id uuid,
  p_entry_id uuid,
  p_allocations jsonb,
  p_reason text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  entry public.expense_book_entries;
  clean_reason text := NULLIF(btrim(p_reason), '');
  allocation jsonb;
  allocation_version_id uuid := extensions.gen_random_uuid();
  amount_paise bigint;
  allocated_total bigint := 0;
  fund_id uuid;
  seen_funds uuid[] := ARRAY[]::uuid[];
  previous_version_id uuid;
  previous_allocations jsonb;
  existing_audit public.audit_logs;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_entry_id IS NULL OR clean_reason IS NULL
    OR char_length(clean_reason) > 1000
    OR p_client_request_id IS NULL
    OR jsonb_typeof(p_allocations) <> 'array'
    OR jsonb_array_length(p_allocations) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Give a reason and check the allocation correction.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO existing_audit FROM public.audit_logs
  WHERE society_id = p_society_id
    AND actor_id = auth.uid()
    AND action = 'expense.fund_allocation.correct'
    AND entity_id = p_client_request_id::text
  ORDER BY created_at DESC
  LIMIT 1;
  IF existing_audit.id IS NOT NULL THEN
    IF existing_audit.after ->> 'reason' IS DISTINCT FROM clean_reason
      OR existing_audit.after -> 'entry_id' IS DISTINCT FROM to_jsonb(p_entry_id)
      OR existing_audit.after -> 'allocations' IS DISTINCT FROM p_allocations
    THEN
      RAISE EXCEPTION 'This request was already used with a different correction.'
        USING ERRCODE = '23505';
    END IF;
    RETURN (existing_audit.after ->> 'allocation_version_id')::uuid;
  END IF;
  SELECT * INTO entry FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accounts entry not found.' USING ERRCODE = 'P0002';
  END IF;
  IF entry.source NOT IN ('expense', 'income', 'billing_payment') THEN
    RAISE EXCEPTION 'Correct original entries; transfers have no fund effect and reversals follow them.'
      USING ERRCODE = '22023';
  END IF;
  IF private.expense_month_closed(p_society_id, entry.entry_date) THEN
    RAISE EXCEPTION 'Reopen the month before correcting its allocation.'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.expense_book_entries AS reversal
    WHERE reversal.society_id = p_society_id
      AND reversal.reverses_entry_id = entry.id
      AND private.expense_month_closed(p_society_id, reversal.entry_date)
  ) THEN
    RAISE EXCEPTION 'Reopen the reversal month before correcting this allocation.'
      USING ERRCODE = '23514';
  END IF;
  previous_version_id := private.expense_fund_latest_allocation_version(entry.id);
  IF previous_version_id IS NULL THEN
    RAISE EXCEPTION 'Confirm the entry allocation before correcting it.'
      USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fund_id', previous.fund_id,
    'amount_paise', previous.amount_paise
  ) ORDER BY previous.fund_id NULLS LAST), '[]'::jsonb)
  INTO previous_allocations
  FROM public.expense_fund_entry_allocations AS previous
  WHERE previous.entry_id = entry.id
    AND previous.allocation_version_id = previous_version_id;
  IF (
    SELECT count(*)
    FROM jsonb_array_elements(p_allocations) AS candidate
    WHERE candidate ->> 'fund_id' IS NULL
  ) > 1 THEN
    RAISE EXCEPTION 'Use one Unallocated line.' USING ERRCODE = '22023';
  END IF;
  FOR allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF jsonb_typeof(allocation) <> 'object'
      OR jsonb_typeof(allocation -> 'amount_paise') <> 'number'
      OR (allocation ->> 'amount_paise') !~ '^[0-9]{1,16}$'
      OR (allocation ? 'fund_id'
        AND jsonb_typeof(allocation -> 'fund_id') NOT IN ('string', 'null'))
    THEN
      RAISE EXCEPTION 'Check the allocation correction.' USING ERRCODE = '22023';
    END IF;
    fund_id := NULLIF(allocation ->> 'fund_id', '')::uuid;
    amount_paise := (allocation ->> 'amount_paise')::bigint;
    IF amount_paise NOT BETWEEN 1 AND 9007199254740991
      OR (fund_id IS NOT NULL AND fund_id = ANY(seen_funds))
      OR (fund_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.expense_funds
        WHERE society_id = p_society_id AND id = fund_id AND active
      ))
    THEN
      RAISE EXCEPTION 'Use active funds at most once.' USING ERRCODE = '22023';
    END IF;
    IF fund_id IS NOT NULL THEN
      seen_funds := array_append(seen_funds, fund_id);
    END IF;
    allocated_total := allocated_total + amount_paise;
  END LOOP;
  IF allocated_total <> entry.amount_paise THEN
    RAISE EXCEPTION 'Allocations must equal the entry amount.'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT CASE
        WHEN proposed_item ->> 'fund_id' IS NULL THEN NULL
        ELSE (proposed_item ->> 'fund_id')::uuid
      END AS fund_id,
        (proposed_item ->> 'amount_paise')::bigint AS amount_paise
      FROM jsonb_array_elements(p_allocations) AS proposed_item
    ) AS proposed
    WHERE COALESCE((
      SELECT sum(link.amount_paise)
      FROM public.expense_fund_receipt_links AS link
      JOIN public.expense_fund_corpus_records AS corpus
        ON corpus.society_id = link.society_id
        AND corpus.id = link.corpus_record_id
      JOIN public.expense_book_entries AS linked_entry
        ON linked_entry.society_id = link.society_id
        AND linked_entry.id = link.entry_id
      WHERE link.society_id = p_society_id
        AND link.entry_id = entry.id
        AND corpus.fund_id = proposed.fund_id
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_book_entries AS reversal
          WHERE reversal.society_id = linked_entry.society_id
            AND reversal.reverses_entry_id = linked_entry.id
        )
    ), 0)
    + COALESCE((
      SELECT sum(link.amount_paise)
      FROM public.expense_fund_work_links AS link
      JOIN public.expense_fund_works AS work
        ON work.society_id = link.society_id AND work.id = link.work_id
      JOIN public.expense_book_entries AS linked_entry
        ON linked_entry.society_id = link.society_id
        AND linked_entry.id = link.entry_id
      WHERE link.society_id = p_society_id
        AND link.entry_id = entry.id
        AND work.fund_id = proposed.fund_id
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_book_entries AS reversal
          WHERE reversal.society_id = linked_entry.society_id
            AND reversal.reverses_entry_id = linked_entry.id
        )
    ), 0) > proposed.amount_paise
  ) THEN
    RAISE EXCEPTION 'The corrected allocation cannot fall below linked corpus or work amounts.'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT corpus.fund_id, sum(link.amount_paise) AS linked_paise
      FROM public.expense_fund_receipt_links AS link
      JOIN public.expense_fund_corpus_records AS corpus
        ON corpus.society_id = link.society_id AND corpus.id = link.corpus_record_id
      WHERE link.society_id = p_society_id AND link.entry_id = entry.id
      GROUP BY corpus.fund_id
      UNION ALL
      SELECT work.fund_id, sum(link.amount_paise) AS linked_paise
      FROM public.expense_fund_work_links AS link
      JOIN public.expense_fund_works AS work
        ON work.society_id = link.society_id AND work.id = link.work_id
      WHERE link.society_id = p_society_id AND link.entry_id = entry.id
      GROUP BY work.fund_id
    ) AS linked
    WHERE linked.linked_paise > COALESCE((
      SELECT sum((proposed_item ->> 'amount_paise')::bigint)
      FROM jsonb_array_elements(p_allocations) AS proposed_item
      WHERE (proposed_item ->> 'fund_id')::uuid = linked.fund_id
    ), 0)
  ) THEN
    RAISE EXCEPTION 'The corrected allocation cannot remove linked corpus or work amounts.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_fund_entry_allocations (
    society_id, entry_id, allocation_version_id, fund_id, amount_paise,
    created_by, client_request_id, reason
  )
  SELECT p_society_id, entry.id, allocation_version_id,
    NULLIF(item ->> 'fund_id', '')::uuid,
    (item ->> 'amount_paise')::bigint,
    auth.uid(), p_client_request_id, clean_reason
  FROM jsonb_array_elements(p_allocations) AS item;
  PERFORM private.expense_fund_copy_allocation_version(
    entry.id, reversal.id, auth.uid(), p_client_request_id
  )
  FROM public.expense_book_entries AS reversal
  WHERE reversal.society_id = p_society_id
    AND reversal.reverses_entry_id = entry.id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_allocation.correct',
    'expense_fund_allocation', p_client_request_id::text,
    jsonb_build_object(
      'entry_id', entry.id,
      'allocation_version_id', previous_version_id,
      'allocations', previous_allocations
    ),
    jsonb_build_object(
      'entry_id', entry.id,
      'allocation_version_id', allocation_version_id,
      'allocations', p_allocations,
      'reason', clean_reason
    ),
    p_request_trace
  );
  RETURN allocation_version_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_opening_correct(uuid, jsonb, text, uuid, text),
  public.expense_fund_allocation_correct(uuid, uuid, jsonb, text, uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_opening_correct(uuid, jsonb, text, uuid, text),
  public.expense_fund_allocation_correct(uuid, uuid, jsonb, text, uuid, text)
  TO authenticated;
