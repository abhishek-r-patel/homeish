-- Add P40.4 sanctioned-work records and capped utilization links to Accounts expenses.
CREATE TABLE public.expense_fund_works (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  fund_id uuid NOT NULL,
  title text NOT NULL CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 200),
  sanctioned_amount_paise bigint NOT NULL
    CHECK (sanctioned_amount_paise BETWEEN 1 AND 9007199254740991),
  sanctioned_on date NOT NULL,
  valid_until date CHECK (valid_until IS NULL OR valid_until >= sanctioned_on),
  meeting_resolution_id uuid,
  resolution_version_snapshot integer,
  resolution_outcome_snapshot text,
  resolution_title_snapshot text,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_works_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_works_authority_check CHECK (
    (meeting_resolution_id IS NOT NULL
      AND resolution_version_snapshot IS NOT NULL
      AND resolution_outcome_snapshot = 'passed'
      AND resolution_title_snapshot IS NOT NULL
      AND external_reference IS NULL)
    OR (meeting_resolution_id IS NULL
      AND resolution_version_snapshot IS NULL
      AND resolution_outcome_snapshot IS NULL
      AND resolution_title_snapshot IS NULL
      AND external_reference IS NOT NULL
      AND external_reference = btrim(external_reference)
      AND char_length(external_reference) BETWEEN 1 AND 120)
  ),
  UNIQUE (society_id, id)
);
CREATE INDEX expense_fund_works_fund_idx
  ON public.expense_fund_works (society_id, fund_id, sanctioned_on DESC);
CREATE INDEX expense_fund_works_resolution_idx
  ON public.expense_fund_works (society_id, meeting_resolution_id);
CREATE INDEX expense_fund_works_created_by_idx
  ON public.expense_fund_works (created_by);
CREATE INDEX expense_fund_works_updated_by_idx
  ON public.expense_fund_works (updated_by);
CREATE TRIGGER expense_fund_works_set_updated_at
  BEFORE UPDATE ON public.expense_fund_works
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_fund_work_links (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  work_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_fund_work_links_work_fkey
    FOREIGN KEY (society_id, work_id)
    REFERENCES public.expense_fund_works (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_fund_work_links_entry_fkey
    FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_fund_work_links_work_idx
  ON public.expense_fund_work_links (society_id, work_id);
CREATE INDEX expense_fund_work_links_entry_idx
  ON public.expense_fund_work_links (society_id, entry_id);
CREATE INDEX expense_fund_work_links_created_by_idx
  ON public.expense_fund_work_links (created_by);

ALTER TABLE public.expense_fund_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_fund_work_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_fund_works, public.expense_fund_work_links
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_fund_works_no_direct_access
  ON public.expense_fund_works FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_fund_work_links_no_direct_access
  ON public.expense_fund_work_links FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE TRIGGER expense_fund_work_links_append_only
  BEFORE UPDATE OR DELETE ON public.expense_fund_work_links
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_fund_work_links_no_truncate
  BEFORE TRUNCATE ON public.expense_fund_work_links
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION public.expense_fund_work_save(
  p_society_id uuid,
  p_work_id uuid,
  p_fund_id uuid,
  p_title text,
  p_sanctioned_amount_paise bigint,
  p_sanctioned_on date,
  p_valid_until date,
  p_meeting_resolution_id uuid,
  p_external_reference text,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_works;
  resolution public.meeting_resolutions;
  saved_id uuid;
  clean_title text := btrim(p_title);
  clean_reference text := NULLIF(btrim(p_external_reference), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_title IS NULL OR char_length(clean_title) NOT BETWEEN 1 AND 200
    OR p_sanctioned_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_sanctioned_on IS NULL
    OR (p_valid_until IS NOT NULL AND p_valid_until < p_sanctioned_on)
    OR char_length(clean_reference) > 120
    OR (
      (p_meeting_resolution_id IS NULL) = (clean_reference IS NULL)
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    )
  THEN
    RAISE EXCEPTION 'Check the sanctioned-work details.' USING ERRCODE = '22023';
  END IF;
  IF p_meeting_resolution_id IS NOT NULL THEN
    SELECT * INTO resolution FROM public.meeting_resolutions
    WHERE society_id = p_society_id AND id = p_meeting_resolution_id;
    IF NOT FOUND OR resolution.outcome <> 'passed'
      OR NOT private.module_enabled(p_society_id, 'meeting')
    THEN
      RAISE EXCEPTION 'Choose a currently passed Homeish resolution.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_work_id IS NULL THEN
    INSERT INTO public.expense_fund_works (
      society_id, fund_id, title, sanctioned_amount_paise, sanctioned_on,
      valid_until, meeting_resolution_id, resolution_version_snapshot,
      resolution_outcome_snapshot, resolution_title_snapshot,
      external_reference, created_by
    ) VALUES (
      p_society_id, p_fund_id, clean_title, p_sanctioned_amount_paise,
      p_sanctioned_on, p_valid_until, p_meeting_resolution_id,
      CASE WHEN resolution.id IS NULL THEN NULL ELSE resolution.version END,
      CASE WHEN resolution.id IS NULL THEN NULL ELSE resolution.outcome END,
      CASE WHEN resolution.id IS NULL THEN NULL ELSE resolution.title END,
      clean_reference, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_fund_works
    WHERE society_id = p_society_id AND id = p_work_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sanctioned work not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The sanctioned work changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF p_fund_id <> previous.fund_id AND EXISTS (
      SELECT 1 FROM public.expense_fund_work_links
      WHERE society_id = p_society_id AND work_id = previous.id
    ) THEN
      RAISE EXCEPTION 'The fund cannot change after an expense is linked.'
        USING ERRCODE = '23514';
    END IF;
    IF p_sanctioned_amount_paise < COALESCE((
      SELECT sum(link.amount_paise)
      FROM public.expense_fund_work_links AS link
      JOIN public.expense_book_entries AS entry
        ON entry.society_id = link.society_id AND entry.id = link.entry_id
      WHERE link.society_id = p_society_id
        AND link.work_id = previous.id
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_book_entries AS reversal
          WHERE reversal.society_id = entry.society_id
            AND reversal.reverses_entry_id = entry.id
        )
    ), 0) THEN
      RAISE EXCEPTION 'The sanctioned amount cannot fall below linked utilization.'
        USING ERRCODE = '23514';
    END IF;
    UPDATE public.expense_fund_works
    SET fund_id = p_fund_id, title = clean_title,
      sanctioned_amount_paise = p_sanctioned_amount_paise,
      sanctioned_on = p_sanctioned_on, valid_until = p_valid_until,
      meeting_resolution_id = p_meeting_resolution_id,
      resolution_version_snapshot =
        CASE WHEN resolution.id IS NULL THEN NULL ELSE resolution.version END,
      resolution_outcome_snapshot =
        CASE WHEN resolution.id IS NULL THEN NULL ELSE resolution.outcome END,
      resolution_title_snapshot =
        CASE WHEN resolution.id IS NULL THEN NULL ELSE resolution.title END,
      external_reference = clean_reference
    WHERE society_id = p_society_id AND id = p_work_id;
    saved_id := p_work_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_work.save',
    'expense_fund_work', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object(
      'fund_id', previous.fund_id,
      'sanctioned_amount_paise', previous.sanctioned_amount_paise
    ) END,
    jsonb_build_object(
      'fund_id', p_fund_id, 'title', clean_title,
      'sanctioned_amount_paise', p_sanctioned_amount_paise,
      'sanctioned_on', p_sanctioned_on, 'valid_until', p_valid_until,
      'meeting_resolution_id', p_meeting_resolution_id,
      'resolution_version', resolution.version,
      'resolution_outcome', resolution.outcome,
      'external_reference', clean_reference
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_work_link(
  p_society_id uuid,
  p_work_id uuid,
  p_entry_id uuid,
  p_amount_paise bigint,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  work public.expense_fund_works;
  entry public.expense_book_entries;
  previous public.expense_fund_work_links;
  source_available bigint;
  work_available bigint;
  saved_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the utilization link.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense-work-link:' || p_society_id::text || auth.uid()::text
      || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_fund_work_links
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.work_id, previous.entry_id, previous.amount_paise)
      IS DISTINCT FROM ROW(p_work_id, p_entry_id, p_amount_paise)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO work FROM public.expense_fund_works
  WHERE society_id = p_society_id AND id = p_work_id FOR UPDATE;
  SELECT * INTO entry FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR work.id IS NULL THEN
    RAISE EXCEPTION 'Work or Accounts expense not found.' USING ERRCODE = 'P0002';
  END IF;
  IF entry.source <> 'expense' OR entry.direction <> 'out'
    OR EXISTS (
      SELECT 1 FROM public.expense_book_entries AS reversal
      WHERE reversal.society_id = entry.society_id
        AND reversal.reverses_entry_id = entry.id
    )
  THEN
    RAISE EXCEPTION 'Link an unreversed posted Accounts expense.'
      USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(sum(allocation.amount_paise), 0) INTO source_available
  FROM public.expense_fund_entry_allocations AS allocation
  WHERE allocation.society_id = p_society_id
    AND allocation.entry_id = entry.id
    AND allocation.fund_id = work.fund_id
    AND allocation.allocation_version_id =
      private.expense_fund_latest_allocation_version(entry.id);
  source_available := source_available - COALESCE((
    SELECT sum(link.amount_paise)
    FROM public.expense_fund_work_links AS link
    JOIN public.expense_fund_works AS linked_work
      ON linked_work.society_id = link.society_id
      AND linked_work.id = link.work_id
    WHERE link.society_id = p_society_id
      AND link.entry_id = entry.id
      AND linked_work.fund_id = work.fund_id
  ), 0);
  work_available := work.sanctioned_amount_paise - COALESCE((
    SELECT sum(link.amount_paise)
    FROM public.expense_fund_work_links AS link
    JOIN public.expense_book_entries AS linked_entry
      ON linked_entry.society_id = link.society_id
      AND linked_entry.id = link.entry_id
    WHERE link.society_id = p_society_id
      AND link.work_id = work.id
      AND NOT EXISTS (
        SELECT 1 FROM public.expense_book_entries AS reversal
        WHERE reversal.society_id = linked_entry.society_id
          AND reversal.reverses_entry_id = linked_entry.id
      )
  ), 0);
  IF p_amount_paise > source_available OR p_amount_paise > work_available THEN
    RAISE EXCEPTION 'The link exceeds the entry allocation or sanctioned work amount.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_fund_work_links (
    society_id, work_id, entry_id, amount_paise, created_by, client_request_id
  ) VALUES (
    p_society_id, work.id, entry.id, p_amount_paise, auth.uid(),
    p_client_request_id
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_work.link',
    'expense_fund_work_link', saved_id::text, NULL,
    jsonb_build_object(
      'work_id', work.id, 'entry_id', entry.id, 'amount_paise', p_amount_paise
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_works_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.housekeeping_local_date(p_society_id);
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'resolutions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', resolution.id, 'title', resolution.title,
        'version', resolution.version, 'outcome', resolution.outcome
      ) ORDER BY resolution.title)
      FROM public.meeting_resolutions AS resolution
      WHERE resolution.society_id = p_society_id
        AND resolution.outcome = 'passed'
        AND private.module_enabled(p_society_id, 'meeting')
    ), '[]'::jsonb),
    'works', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', work.id,
        'fund_id', work.fund_id,
        'fund_name', fund.name,
        'title', work.title,
        'sanctioned_amount_paise', work.sanctioned_amount_paise,
        'sanctioned_on', work.sanctioned_on,
        'valid_until', work.valid_until,
        'meeting_resolution_id', work.meeting_resolution_id,
        'resolution_title_snapshot', work.resolution_title_snapshot,
        'external_reference', work.external_reference,
        'authority_status', CASE
          WHEN work.meeting_resolution_id IS NULL THEN 'external'
          WHEN NOT private.module_enabled(p_society_id, 'meeting')
            THEN 'meeting_unavailable'
          WHEN resolution.id IS NULL THEN 'resolution_removed'
          WHEN resolution.version <> work.resolution_version_snapshot
            OR resolution.outcome <> work.resolution_outcome_snapshot
            THEN 'changed'
          ELSE 'current'
        END,
        'utilized_paise', COALESCE((
          SELECT sum(link.amount_paise)
          FROM public.expense_fund_work_links AS link
          JOIN public.expense_book_entries AS entry
            ON entry.society_id = link.society_id AND entry.id = link.entry_id
          WHERE link.society_id = work.society_id
            AND link.work_id = work.id
            AND NOT EXISTS (
              SELECT 1 FROM public.expense_book_entries AS reversal
              WHERE reversal.society_id = entry.society_id
                AND reversal.reverses_entry_id = entry.id
            )
        ), 0),
        'expired', work.valid_until IS NOT NULL AND work.valid_until < today,
        'overrun', COALESCE((
          SELECT sum(link.amount_paise)
          FROM public.expense_fund_work_links AS link
          JOIN public.expense_book_entries AS entry
            ON entry.society_id = link.society_id AND entry.id = link.entry_id
          WHERE link.society_id = work.society_id
            AND link.work_id = work.id
            AND NOT EXISTS (
              SELECT 1 FROM public.expense_book_entries AS reversal
              WHERE reversal.society_id = entry.society_id
                AND reversal.reverses_entry_id = entry.id
            )
        ), 0) > work.sanctioned_amount_paise,
        'updated_at', work.updated_at
      ) ORDER BY work.sanctioned_on DESC, work.created_at DESC)
      FROM public.expense_fund_works AS work
      JOIN public.expense_funds AS fund
        ON fund.society_id = work.society_id AND fund.id = work.fund_id
      LEFT JOIN public.meeting_resolutions AS resolution
        ON resolution.society_id = work.society_id
        AND resolution.id = work.meeting_resolution_id
      WHERE work.society_id = p_society_id
    ), '[]'::jsonb),
    'eligible_expenses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entry_id', entry.id,
        'fund_id', allocation.fund_id,
        'voucher_no', private.expense_voucher_label(
          voucher.voucher_type, voucher.financial_year, voucher.sequence
        ),
        'entry_date', entry.entry_date,
        'payee', entry.counterparty,
        'amount_paise', allocation.amount_paise - COALESCE((
          SELECT sum(link.amount_paise)
          FROM public.expense_fund_work_links AS link
          JOIN public.expense_fund_works AS linked_work
            ON linked_work.society_id = link.society_id
            AND linked_work.id = link.work_id
          WHERE link.society_id = entry.society_id
            AND link.entry_id = entry.id
            AND linked_work.fund_id = allocation.fund_id
        ), 0)
      ) ORDER BY entry.entry_date DESC, entry.created_at DESC)
      FROM public.expense_fund_entry_allocations AS allocation
      JOIN public.expense_book_entries AS entry
        ON entry.society_id = allocation.society_id
        AND entry.id = allocation.entry_id
      JOIN public.expense_vouchers AS voucher
        ON voucher.society_id = entry.society_id AND voucher.entry_id = entry.id
      WHERE entry.society_id = p_society_id
        AND entry.source = 'expense' AND entry.direction = 'out'
        AND allocation.fund_id IS NOT NULL
        AND allocation.allocation_version_id =
          private.expense_fund_latest_allocation_version(entry.id)
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
  public.expense_fund_work_save(
    uuid, uuid, uuid, text, bigint, date, date, uuid, text, timestamptz, text
  ),
  public.expense_fund_work_link(uuid, uuid, uuid, bigint, uuid, text),
  public.expense_fund_works_list(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_work_save(
    uuid, uuid, uuid, text, bigint, date, date, uuid, text, timestamptz, text
  ),
  public.expense_fund_work_link(uuid, uuid, uuid, bigint, uuid, text),
  public.expense_fund_works_list(uuid)
  TO authenticated;
