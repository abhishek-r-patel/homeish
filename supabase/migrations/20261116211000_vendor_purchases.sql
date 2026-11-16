-- Purchase requests, quotes, approvals, the expense draft hand-off and vendor read models.
CREATE FUNCTION private.vendor_is_admin(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.has_role(p_society_id, ARRAY['admin']::text[])
$$;
REVOKE ALL ON FUNCTION private.vendor_is_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Separation of duties: whoever raised, submitted or overrode the quote rule on a request
-- never approves or rejects it. Returns why the user is barred, or null.
CREATE FUNCTION private.vendor_conflict_reason(
  p_request public.vendor_purchase_requests, p_user_id uuid
)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN NULL
    WHEN p_request.created_by = p_user_id THEN 'You raised this request'
    WHEN p_request.submitted_by = p_user_id THEN 'You submitted this request'
    WHEN p_request.quote_override_by = p_user_id THEN 'You overrode its quote rule'
  END
$$;
REVOKE ALL ON FUNCTION private.vendor_conflict_reason(public.vendor_purchase_requests, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- An override waives the rule for the quotes and estimate it was given for; any change to
-- them clears it (audited) so the rule must be met or overridden again.
CREATE FUNCTION private.vendor_clear_stale_override(
  p_society_id uuid, p_purchase_request_id uuid, p_cause text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous_reason text;
  previous_by uuid;
BEGIN
  SELECT quote_override_reason, quote_override_by INTO previous_reason, previous_by
    FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id
      AND quote_override_reason IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.vendor_purchase_requests
  SET quote_override_reason = NULL, quote_override_by = NULL, quote_override_at = NULL
  WHERE society_id = p_society_id AND id = p_purchase_request_id;
  PERFORM private.vendor_audit(p_society_id, 'quote_rule.override_cleared',
    'vendor_purchase_request', p_purchase_request_id,
    jsonb_build_object('cause', p_cause, 'previous_reason', previous_reason,
      'previous_override_by', previous_by),
    'The quotes or estimate changed after the override.', p_request_id);
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_clear_stale_override(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- The quote rule: below the threshold one quote is enough; at or above it the configured
-- number is needed. The basis is the selected quote, else the estimate. Submitted requests
-- use the numbers captured at submission.
CREATE FUNCTION private.vendor_quote_rule(p_request public.vendor_purchase_requests)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  settings jsonb := private.vendor_settings(p_request.society_id);
  basis bigint;
  quote_count integer;
  required integer;
BEGIN
  SELECT count(*) INTO quote_count FROM public.vendor_quotes
    WHERE society_id = p_request.society_id AND request_id = p_request.id AND removed_at IS NULL;
  SELECT COALESCE(
    (SELECT amount_paise FROM public.vendor_quotes
      WHERE society_id = p_request.society_id AND id = p_request.selected_quote_id),
    p_request.estimated_amount_paise
  ) INTO basis;
  required := COALESCE(p_request.quotes_required::integer, CASE
    WHEN basis < (settings ->> 'quote_threshold_paise')::bigint THEN 1
    ELSE (settings ->> 'quotes_above_threshold')::integer END);
  RETURN jsonb_build_object(
    'basis_amount_paise', basis,
    'threshold_paise', (settings ->> 'quote_threshold_paise')::bigint,
    'quote_count', quote_count,
    'quotes_required', required,
    'overridden', p_request.quote_override_reason IS NOT NULL,
    'met', quote_count >= required OR p_request.quote_override_reason IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_quote_rule(public.vendor_purchase_requests)
  FROM PUBLIC, anon, authenticated, service_role;

-- Lock a draft the caller may change: its requester or an administrator.
CREATE FUNCTION private.vendor_lock_draft(
  p_society_id uuid, p_purchase_request_id uuid, p_expected_version integer
)
RETURNS public.vendor_purchase_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
BEGIN
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002'; END IF;
  IF request.created_by <> auth.uid() AND NOT private.vendor_is_admin(p_society_id) THEN
    RAISE EXCEPTION 'Only the requester or an administrator can change this request.'
      USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NOT NULL AND request.version <> p_expected_version THEN
    RAISE EXCEPTION 'This request changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF request.status <> 'draft' THEN
    RAISE EXCEPTION 'Quotes and details are locked once a request is submitted. Cancel it and raise a new one.'
      USING ERRCODE = '23514';
  END IF;
  RETURN request;
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_lock_draft(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.vendor_notify(
  p_society_id uuid, p_user_id uuid, p_type text, p_title text, p_body text,
  p_purchase_request_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = p_user_id AND status = 'active'
  ) THEN
    PERFORM private.create_notification(p_society_id, p_user_id, p_type, p_title,
      left(p_body, 300), 'vendor_purchase_request', p_purchase_request_id, p_request_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_notify(uuid, uuid, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.vendor_request_save(
  p_society_id uuid, p_purchase_request_id uuid, p_title text, p_description text,
  p_category text, p_estimated_amount_paise bigint, p_expected_version integer,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  clean_title text;
  clean_description text;
  clean_category text;
  previous_estimate bigint;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  clean_title := private.vendor_clean_text(p_title, 120, 'a title', true);
  clean_description := private.vendor_clean_text(p_description, 2000, 'a description', false);
  clean_category := private.vendor_clean_text(p_category, 60, 'a category', false);
  IF p_estimated_amount_paise IS NULL OR p_estimated_amount_paise NOT BETWEEN 1 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter an estimated amount above zero.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_request_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO request FROM public.vendor_purchase_requests
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN request.id; END IF;
    INSERT INTO public.vendor_purchase_requests (
      society_id, title, description, category, estimated_amount_paise, client_request_id,
      created_by, updated_by
    ) VALUES (
      p_society_id, clean_title, clean_description, clean_category, p_estimated_amount_paise,
      p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO request;
    PERFORM private.vendor_audit(p_society_id, 'request.create', 'vendor_purchase_request',
      request.id, jsonb_build_object('title', request.title,
        'estimated_amount_paise', request.estimated_amount_paise), NULL, p_request_id);
    RETURN request.id;
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  request := private.vendor_lock_draft(p_society_id, p_purchase_request_id, p_expected_version);
  previous_estimate := request.estimated_amount_paise;
  UPDATE public.vendor_purchase_requests
  SET title = clean_title, description = clean_description, category = clean_category,
    estimated_amount_paise = p_estimated_amount_paise, version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = request.id RETURNING * INTO request;
  IF p_estimated_amount_paise IS DISTINCT FROM previous_estimate THEN
    PERFORM private.vendor_clear_stale_override(p_society_id, request.id, 'estimate_changed',
      p_request_id);
  END IF;
  PERFORM private.vendor_audit(p_society_id, 'request.update', 'vendor_purchase_request',
    request.id, jsonb_build_object('title', request.title,
      'estimated_amount_paise', request.estimated_amount_paise, 'version', request.version),
    NULL, p_request_id);
  RETURN request.id;
END;
$$;

CREATE FUNCTION public.vendor_quote_add(
  p_society_id uuid, p_purchase_request_id uuid, p_vendor_id uuid, p_amount_paise bigint,
  p_note text, p_file_path text, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  quote public.vendor_quotes;
  clean_note text;
  file_type text;
  file_size integer;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  clean_note := private.vendor_clean_text(p_note, 500, 'a note', false);
  IF p_client_request_id IS NULL OR p_amount_paise IS NULL
    OR p_amount_paise NOT BETWEEN 1 AND 999999999999999
  THEN
    RAISE EXCEPTION 'Enter a quote amount above zero.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO quote FROM public.vendor_quotes
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN quote.id; END IF;
  request := private.vendor_lock_draft(p_society_id, p_purchase_request_id, NULL);
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors WHERE society_id = p_society_id AND id = p_vendor_id AND active
  ) THEN
    RAISE EXCEPTION 'Choose an active vendor.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendor_quotes
    WHERE society_id = p_society_id AND request_id = request.id AND vendor_id = p_vendor_id
      AND removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This vendor already has a quote on this request. Remove it first.'
      USING ERRCODE = '23505';
  END IF;
  IF p_file_path IS NOT NULL THEN
    SELECT uploaded.content_type, uploaded.size_bytes INTO file_type, file_size
      FROM private.vendor_uploaded_file(p_society_id, p_file_path) AS uploaded;
  END IF;
  INSERT INTO public.vendor_quotes (
    society_id, request_id, vendor_id, amount_paise, note, file_path, file_content_type,
    file_size_bytes, client_request_id, created_by
  ) VALUES (
    p_society_id, request.id, p_vendor_id, p_amount_paise, clean_note, p_file_path, file_type,
    file_size, p_client_request_id, auth.uid()
  ) RETURNING * INTO quote;
  UPDATE public.vendor_purchase_requests
  SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = request.id;
  PERFORM private.vendor_clear_stale_override(p_society_id, request.id, 'quote_added', p_request_id);
  PERFORM private.vendor_audit(p_society_id, 'quote.add', 'vendor_quote', quote.id,
    jsonb_build_object('request_id', request.id, 'vendor_id', p_vendor_id,
      'amount_paise', p_amount_paise, 'has_file', p_file_path IS NOT NULL), NULL, p_request_id);
  RETURN quote.id;
END;
$$;

CREATE FUNCTION public.vendor_quote_remove(p_society_id uuid, p_quote_id uuid, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  quote public.vendor_quotes;
  request public.vendor_purchase_requests;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  SELECT * INTO quote FROM public.vendor_quotes WHERE society_id = p_society_id AND id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found.' USING ERRCODE = 'P0002'; END IF;
  request := private.vendor_lock_draft(p_society_id, quote.request_id, NULL);
  SELECT * INTO quote FROM public.vendor_quotes WHERE id = quote.id FOR UPDATE;
  IF quote.removed_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.vendor_quotes SET removed_at = clock_timestamp(), removed_by = auth.uid()
    WHERE id = quote.id;
  UPDATE public.vendor_purchase_requests
  SET selected_quote_id = CASE WHEN selected_quote_id = quote.id THEN NULL ELSE selected_quote_id END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = request.id;
  PERFORM private.vendor_clear_stale_override(p_society_id, request.id, 'quote_removed',
    p_request_id);
  PERFORM private.vendor_audit(p_society_id, 'quote.remove', 'vendor_quote', quote.id,
    jsonb_build_object('request_id', request.id, 'vendor_id', quote.vendor_id), NULL, p_request_id);
END;
$$;

CREATE FUNCTION public.vendor_quote_select(
  p_society_id uuid, p_purchase_request_id uuid, p_quote_id uuid, p_expected_version integer,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  request := private.vendor_lock_draft(p_society_id, p_purchase_request_id, p_expected_version);
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_quotes
    WHERE society_id = p_society_id AND request_id = request.id AND id = p_quote_id
      AND removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Quote not found.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.vendor_purchase_requests
  SET selected_quote_id = p_quote_id, version = version + 1, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE id = request.id;
  IF request.selected_quote_id IS DISTINCT FROM p_quote_id THEN
    PERFORM private.vendor_clear_stale_override(p_society_id, request.id, 'quote_selected',
      p_request_id);
  END IF;
  PERFORM private.vendor_audit(p_society_id, 'quote.select', 'vendor_purchase_request', request.id,
    jsonb_build_object('quote_id', p_quote_id), NULL, p_request_id);
END;
$$;

-- An administrator may waive the quote count with an audited reason; a null reason clears it.
CREATE FUNCTION public.vendor_quote_override(
  p_society_id uuid, p_purchase_request_id uuid, p_reason text, p_expected_version integer,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  clean_reason := private.vendor_clean_text(p_reason, 500, 'a reason', false);
  IF clean_reason IS NOT NULL AND char_length(clean_reason) < 5 THEN
    RAISE EXCEPTION 'Explain the override in at least 5 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  request := private.vendor_lock_draft(p_society_id, p_purchase_request_id, p_expected_version);
  UPDATE public.vendor_purchase_requests
  SET quote_override_reason = clean_reason,
    quote_override_by = CASE WHEN clean_reason IS NULL THEN NULL ELSE auth.uid() END,
    quote_override_at = CASE WHEN clean_reason IS NULL THEN NULL ELSE clock_timestamp() END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = request.id;
  PERFORM private.vendor_audit(p_society_id,
    CASE WHEN clean_reason IS NULL THEN 'quote_rule.override_clear' ELSE 'quote_rule.override' END,
    'vendor_purchase_request', request.id,
    jsonb_build_object('rule', private.vendor_quote_rule(request)), clean_reason, p_request_id);
END;
$$;

CREATE FUNCTION public.vendor_request_submit(
  p_society_id uuid, p_purchase_request_id uuid, p_expected_version integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  rule jsonb;
  required_approvals integer;
  recipient uuid;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  request := private.vendor_lock_draft(p_society_id, p_purchase_request_id, p_expected_version);
  IF request.selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'Select the quote to go ahead with before submitting.' USING ERRCODE = '23514';
  END IF;
  rule := private.vendor_quote_rule(request);
  IF NOT (rule ->> 'met')::boolean THEN
    RAISE EXCEPTION 'This amount needs % quotes; % added.', rule ->> 'quotes_required',
      rule ->> 'quote_count' USING ERRCODE = '23514';
  END IF;
  required_approvals := (private.vendor_settings(p_society_id) ->> 'approvals_required')::integer;
  UPDATE public.vendor_purchase_requests
  SET status = 'submitted', submitted_at = clock_timestamp(), submitted_by = auth.uid(),
    quotes_required = (rule ->> 'quotes_required')::smallint,
    approvals_required = required_approvals, version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = request.id;
  -- Notify the people who can approve; with no committee approvals only administrators can.
  FOR recipient IN
    SELECT membership.user_id FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL
      AND membership.user_id NOT IN (auth.uid(), request.created_by)
      AND membership.user_id IS DISTINCT FROM request.quote_override_by
      AND membership.roles && CASE WHEN required_approvals = 0 THEN ARRAY['admin']::text[]
        ELSE ARRAY['admin', 'committee']::text[] END
    ORDER BY membership.id LIMIT 50
  LOOP
    PERFORM private.vendor_notify(p_society_id, recipient, 'vendor_approval_needed',
      'Purchase request awaiting approval',
      'Purchase request "' || request.title || '" needs your approval.', request.id, p_request_id);
  END LOOP;
  PERFORM private.vendor_audit(p_society_id, 'request.submit', 'vendor_purchase_request',
    request.id, jsonb_build_object('rule', rule, 'approvals_required', required_approvals),
    NULL, p_request_id);
END;
$$;

-- Create a pending-approval expense from the approved quote, at most once per request.
CREATE FUNCTION private.vendor_expense_draft(
  p_society_id uuid, p_purchase_request_id uuid, p_request_id text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  quote public.vendor_quotes;
  vendor_name text;
  account public.expense_accounts;
  chosen_category_id uuid;
  today date;
  result text;
  draft_expense_id uuid;
  recipient uuid;
BEGIN
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND OR request.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved requests create expense drafts.' USING ERRCODE = '23514';
  END IF;
  IF request.expense_id IS NOT NULL THEN RETURN 'created'; END IF;
  today := private.housekeeping_local_date(p_society_id);
  IF NOT private.module_enabled(p_society_id, 'expense') THEN
    result := 'skipped_disabled';
  ELSIF private.expense_month_closed(p_society_id, today) THEN
    result := 'skipped_month_closed';
  ELSE
    SELECT * INTO account FROM public.expense_accounts
      WHERE society_id = p_society_id AND active AND opening_on <= today
      ORDER BY (account_type = 'bank') DESC, created_at, id LIMIT 1;
    IF NOT FOUND THEN
      result := 'skipped_no_account';
    ELSE
      SELECT category.id INTO chosen_category_id FROM public.expense_categories AS category
        WHERE category.society_id = p_society_id AND category.active
        ORDER BY (lower(category.name) = lower(COALESCE(request.category, ''))) DESC,
          (lower(category.name) = 'other') DESC, lower(category.name), category.id
        LIMIT 1;
      IF chosen_category_id IS NULL THEN result := 'skipped_no_category'; END IF;
    END IF;
  END IF;
  IF result IS NOT NULL THEN
    UPDATE public.vendor_purchase_requests SET expense_draft_status = result WHERE id = request.id;
    RETURN result;
  END IF;
  SELECT * INTO STRICT quote FROM public.vendor_quotes
    WHERE society_id = p_society_id AND id = request.selected_quote_id;
  SELECT name INTO STRICT vendor_name FROM public.vendors
    WHERE society_id = p_society_id AND id = quote.vendor_id;
  INSERT INTO public.expenses (
    society_id, account_id, category_id, spent_on, payee, amount_paise, payment_mode,
    reference, description, approval_required, status, client_request_id, created_by
  ) VALUES (
    p_society_id, account.id, chosen_category_id, today, left(vendor_name, 120), quote.amount_paise,
    CASE WHEN account.account_type = 'cash' THEN 'cash' ELSE 'bank' END,
    'Purchase request ' || left(request.id::text, 8),
    left('Purchase request: ' || request.title
      || COALESCE(E'\n' || request.description, ''), 2000),
    true, 'pending_approval', request.id, auth.uid()
  ) RETURNING id INTO draft_expense_id;
  UPDATE public.vendor_purchase_requests
  SET expense_id = draft_expense_id, expense_draft_status = 'created'
  WHERE id = request.id;
  PERFORM private.vendor_audit(p_society_id, 'expense_draft.create', 'expense', draft_expense_id,
    jsonb_build_object('purchase_request_id', request.id, 'amount_paise', quote.amount_paise,
      'account_id', account.id, 'category_id', chosen_category_id), NULL, p_request_id);
  FOR recipient IN
    SELECT membership.user_id FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND membership.user_id <> auth.uid()
      AND membership.roles && ARRAY['committee']::text[]
    ORDER BY membership.id LIMIT 50
  LOOP
    PERFORM private.create_notification(p_society_id, recipient, 'expense_approval_needed',
      'Expense awaiting approval',
      left('An expense to ' || vendor_name || ' from an approved purchase request needs committee approval.', 300),
      'expense', draft_expense_id, p_request_id);
  END LOOP;
  RETURN 'created';
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_expense_draft(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.vendor_request_approve(
  p_society_id uuid, p_purchase_request_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  approval_count integer;
  draft_status text;
  conflict text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002'; END IF;
  conflict := private.vendor_conflict_reason(request, auth.uid());
  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION '%, so someone else must approve it.', conflict USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendor_approvals
    WHERE society_id = p_society_id AND request_id = request.id AND approver_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You have already approved this request.' USING ERRCODE = '23505';
  END IF;
  IF request.status <> 'submitted' THEN
    RAISE EXCEPTION 'This request is not awaiting approval.' USING ERRCODE = '23505';
  END IF;
  IF request.approvals_required = 0 AND NOT private.vendor_is_admin(p_society_id) THEN
    RAISE EXCEPTION 'No committee approvals are required, so an administrator approves this request.'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.vendor_approvals (society_id, request_id, approver_id, approver_role)
  VALUES (p_society_id, request.id, auth.uid(), private.vendor_actor_role(p_society_id));
  SELECT count(*) INTO approval_count FROM public.vendor_approvals
    WHERE society_id = p_society_id AND request_id = request.id;
  PERFORM private.vendor_audit(p_society_id,
    CASE WHEN request.approvals_required = 0 THEN 'request.approve_alone' ELSE 'request.approve' END,
    'vendor_purchase_request', request.id,
    jsonb_build_object('approvals', approval_count, 'approvals_required', request.approvals_required),
    NULL, p_request_id);
  IF approval_count < GREATEST(request.approvals_required, 1) THEN
    UPDATE public.vendor_purchase_requests
    SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE id = request.id;
    RETURN jsonb_build_object('status', 'submitted', 'approvals', approval_count,
      'approvals_required', request.approvals_required, 'expense_draft_status', NULL);
  END IF;
  UPDATE public.vendor_purchase_requests
  SET status = 'approved', decided_at = clock_timestamp(), decided_by = auth.uid(),
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = request.id;
  draft_status := private.vendor_expense_draft(p_society_id, request.id, p_request_id);
  PERFORM private.vendor_notify(p_society_id, request.created_by, 'vendor_request_approved',
    'Purchase request approved',
    'Your purchase request "' || request.title || '" was approved.', request.id, p_request_id);
  RETURN jsonb_build_object('status', 'approved', 'approvals', approval_count,
    'approvals_required', request.approvals_required, 'expense_draft_status', draft_status);
END;
$$;

CREATE FUNCTION public.vendor_request_reject(
  p_society_id uuid, p_purchase_request_id uuid, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  clean_reason text;
  conflict text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  clean_reason := private.vendor_clean_text(p_reason, 500, 'a reason for rejecting', true);
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002'; END IF;
  IF request.created_by = auth.uid() THEN
    RAISE EXCEPTION 'You raised this request. Cancel it instead of rejecting it.'
      USING ERRCODE = '42501';
  END IF;
  conflict := private.vendor_conflict_reason(request, auth.uid());
  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION '%, so someone else must decide on it.', conflict USING ERRCODE = '42501';
  END IF;
  IF request.status <> 'submitted' THEN
    RAISE EXCEPTION 'This request is not awaiting approval.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.vendor_purchase_requests
  SET status = 'rejected', decided_at = clock_timestamp(), decided_by = auth.uid(),
    rejection_reason = clean_reason, version = version + 1, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE id = request.id;
  PERFORM private.vendor_notify(p_society_id, request.created_by, 'vendor_request_rejected',
    'Purchase request rejected',
    'Your purchase request "' || request.title || '" was rejected: ' || clean_reason,
    request.id, p_request_id);
  PERFORM private.vendor_audit(p_society_id, 'request.reject', 'vendor_purchase_request',
    request.id, jsonb_build_object('status', 'rejected'), clean_reason, p_request_id);
END;
$$;

CREATE FUNCTION public.vendor_request_cancel(
  p_society_id uuid, p_purchase_request_id uuid, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  clean_reason := private.vendor_clean_text(p_reason, 500, 'a reason', false);
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002'; END IF;
  IF request.created_by <> auth.uid() AND NOT private.vendor_is_admin(p_society_id) THEN
    RAISE EXCEPTION 'Only the requester or an administrator can cancel this request.'
      USING ERRCODE = '42501';
  END IF;
  IF request.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Only draft or submitted requests can be cancelled.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.vendor_purchase_requests
  SET status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = auth.uid(),
    cancel_reason = clean_reason, version = version + 1, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE id = request.id;
  PERFORM private.vendor_audit(p_society_id, 'request.cancel', 'vendor_purchase_request',
    request.id, jsonb_build_object('previous_status', request.status), clean_reason, p_request_id);
END;
$$;

-- Retry the expense hand-off after an administrator fixes what was missing.
CREATE FUNCTION public.vendor_expense_draft_retry(
  p_society_id uuid, p_purchase_request_id uuid, p_request_id text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002'; END IF;
  IF request.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved requests create expense drafts.' USING ERRCODE = '23514';
  END IF;
  RETURN private.vendor_expense_draft(p_society_id, request.id, p_request_id);
END;
$$;

CREATE FUNCTION private.vendor_person(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT full_name FROM public.profiles WHERE id = p_user_id
$$;
REVOKE ALL ON FUNCTION private.vendor_person(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.vendor_workspace_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_admin boolean;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  is_admin := private.vendor_is_admin(p_society_id);
  RETURN jsonb_build_object(
    'can_manage', is_admin,
    'expense_enabled', private.module_enabled(p_society_id, 'expense'),
    'settings', private.vendor_settings(p_society_id),
    'vendors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', vendor.id, 'name', vendor.name, 'category', vendor.category,
        'contact_person', vendor.contact_person, 'phone', vendor.phone, 'email', vendor.email,
        'gstin', vendor.gstin, 'active', vendor.active, 'version', vendor.version,
        'rating_average', rating.average, 'rating_count', COALESCE(rating.total, 0)
      ) ORDER BY vendor.active DESC, lower(vendor.name))
      FROM (
        SELECT * FROM public.vendors WHERE society_id = p_society_id
        ORDER BY active DESC, lower(name) LIMIT 500
      ) AS vendor
      LEFT JOIN LATERAL (
        SELECT round(avg(stars), 1) AS average, count(*)::integer AS total
        FROM public.vendor_ratings
        WHERE society_id = p_society_id AND vendor_id = vendor.id
      ) AS rating ON true
    ), '[]'::jsonb),
    'requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', request.id, 'title', request.title, 'category', request.category,
        'status', request.status, 'estimated_amount_paise', request.estimated_amount_paise,
        'selected_amount_paise', selected.amount_paise, 'selected_vendor_name', selected.vendor_name,
        'rule', private.vendor_quote_rule(request),
        'approvals', (SELECT count(*) FROM public.vendor_approvals AS approval
          WHERE approval.society_id = p_society_id AND approval.request_id = request.id),
        'approvals_required', COALESCE(request.approvals_required::integer,
          (private.vendor_settings(p_society_id) ->> 'approvals_required')::integer),
        'created_by_name', private.vendor_person(request.created_by),
        'mine', request.created_by = auth.uid(),
        'created_at', request.created_at, 'submitted_at', request.submitted_at,
        'decided_at', request.decided_at
      ) ORDER BY (request.status = 'submitted') DESC, (request.status = 'draft') DESC,
        request.created_at DESC, request.id)
      FROM (
        SELECT * FROM public.vendor_purchase_requests WHERE society_id = p_society_id
        ORDER BY (status = 'submitted') DESC, (status = 'draft') DESC, created_at DESC, id LIMIT 200
      ) AS request
      LEFT JOIN LATERAL (
        SELECT quote.amount_paise, vendor.name AS vendor_name FROM public.vendor_quotes AS quote
        JOIN public.vendors AS vendor
          ON vendor.society_id = quote.society_id AND vendor.id = quote.vendor_id
        WHERE quote.society_id = p_society_id AND quote.id = request.selected_quote_id
      ) AS selected ON true
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.vendor_get(p_society_id uuid, p_vendor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor public.vendors;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT * INTO vendor FROM public.vendors WHERE society_id = p_society_id AND id = p_vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'can_manage', private.vendor_is_admin(p_society_id),
    'vendor', jsonb_build_object(
      'id', vendor.id, 'name', vendor.name, 'category', vendor.category,
      'contact_person', vendor.contact_person, 'phone', vendor.phone, 'email', vendor.email,
      'gstin', vendor.gstin, 'notes', vendor.notes, 'active', vendor.active,
      'version', vendor.version, 'created_at', vendor.created_at
    ),
    'rating_average', (SELECT round(avg(stars), 1) FROM public.vendor_ratings
      WHERE society_id = p_society_id AND vendor_id = vendor.id),
    'rating_count', (SELECT count(*) FROM public.vendor_ratings
      WHERE society_id = p_society_id AND vendor_id = vendor.id),
    'my_rating', (SELECT jsonb_build_object('stars', stars, 'comment', comment)
      FROM public.vendor_ratings
      WHERE society_id = p_society_id AND vendor_id = vendor.id AND rater_id = auth.uid()),
    'ratings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rating.id, 'stars', rating.stars, 'comment', rating.comment,
        'rater_name', private.vendor_person(rating.rater_id), 'mine', rating.rater_id = auth.uid(),
        'updated_at', rating.updated_at
      ) ORDER BY rating.updated_at DESC, rating.id)
      FROM (
        SELECT * FROM public.vendor_ratings
        WHERE society_id = p_society_id AND vendor_id = vendor.id
        ORDER BY updated_at DESC, id LIMIT 100
      ) AS rating
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', document.id, 'title', document.title, 'path', document.path,
        'content_type', document.content_type, 'size_bytes', document.size_bytes,
        'archived_at', document.archived_at, 'created_at', document.created_at
      ) ORDER BY document.archived_at NULLS FIRST, document.created_at DESC, document.id)
      FROM public.vendor_documents AS document
      WHERE document.society_id = p_society_id AND document.vendor_id = vendor.id
    ), '[]'::jsonb),
    'quotes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', quote.id, 'request_id', quote.request_id, 'request_title', request.title,
        'request_status', request.status, 'amount_paise', quote.amount_paise,
        'selected', request.selected_quote_id IS NOT DISTINCT FROM quote.id, 'created_at', quote.created_at
      ) ORDER BY quote.created_at DESC, quote.id)
      FROM (
        SELECT * FROM public.vendor_quotes
        WHERE society_id = p_society_id AND vendor_id = vendor.id AND removed_at IS NULL
        ORDER BY created_at DESC, id LIMIT 50
      ) AS quote
      JOIN public.vendor_purchase_requests AS request
        ON request.society_id = quote.society_id AND request.id = quote.request_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.vendor_request_get(p_society_id uuid, p_purchase_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.vendor_purchase_requests;
  is_admin boolean;
  is_requester boolean;
  approved_by_me boolean;
  required_approvals integer;
  conflict text;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT * INTO request FROM public.vendor_purchase_requests
    WHERE society_id = p_society_id AND id = p_purchase_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE = 'P0002'; END IF;
  is_admin := private.vendor_is_admin(p_society_id);
  is_requester := request.created_by = auth.uid();
  conflict := private.vendor_conflict_reason(request, auth.uid());
  approved_by_me := EXISTS (
    SELECT 1 FROM public.vendor_approvals
    WHERE society_id = p_society_id AND request_id = request.id AND approver_id = auth.uid()
  );
  required_approvals := COALESCE(request.approvals_required::integer,
    (private.vendor_settings(p_society_id) ->> 'approvals_required')::integer);
  RETURN jsonb_build_object(
    'request', jsonb_build_object(
      'id', request.id, 'title', request.title, 'description', request.description,
      'category', request.category, 'status', request.status,
      'estimated_amount_paise', request.estimated_amount_paise,
      'selected_quote_id', request.selected_quote_id, 'version', request.version,
      'created_by_name', private.vendor_person(request.created_by), 'created_at', request.created_at,
      'submitted_at', request.submitted_at,
      'decided_by_name', private.vendor_person(request.decided_by), 'decided_at', request.decided_at,
      'rejection_reason', request.rejection_reason,
      'cancelled_by_name', private.vendor_person(request.cancelled_by),
      'cancelled_at', request.cancelled_at, 'cancel_reason', request.cancel_reason,
      'quote_override_reason', request.quote_override_reason,
      'quote_override_by_name', private.vendor_person(request.quote_override_by),
      'quote_override_at', request.quote_override_at,
      'expense_id', request.expense_id, 'expense_draft_status', request.expense_draft_status,
      'expense_status', (SELECT status FROM public.expenses
        WHERE society_id = p_society_id AND id = request.expense_id)
    ),
    'rule', private.vendor_quote_rule(request),
    'approvals_required', required_approvals,
    'expense_enabled', private.module_enabled(p_society_id, 'expense'),
    'quotes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', quote.id, 'vendor_id', quote.vendor_id, 'vendor_name', vendor.name,
        'amount_paise', quote.amount_paise, 'note', quote.note, 'file_path', quote.file_path,
        'file_content_type', quote.file_content_type,
        'selected', quote.id IS NOT DISTINCT FROM request.selected_quote_id,
        'created_by_name', private.vendor_person(quote.created_by), 'created_at', quote.created_at
      ) ORDER BY quote.amount_paise, quote.created_at, quote.id)
      FROM public.vendor_quotes AS quote
      JOIN public.vendors AS vendor
        ON vendor.society_id = quote.society_id AND vendor.id = quote.vendor_id
      WHERE quote.society_id = p_society_id AND quote.request_id = request.id
        AND quote.removed_at IS NULL
    ), '[]'::jsonb),
    'approvals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'approver_name', private.vendor_person(approval.approver_id),
        'approver_role', approval.approver_role, 'created_at', approval.created_at
      ) ORDER BY approval.created_at, approval.id)
      FROM public.vendor_approvals AS approval
      WHERE approval.society_id = p_society_id AND approval.request_id = request.id
    ), '[]'::jsonb),
    'vendors', CASE WHEN request.status = 'draft' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', vendor.id, 'name', vendor.name)
        ORDER BY lower(vendor.name))
      FROM public.vendors AS vendor
      WHERE vendor.society_id = p_society_id AND vendor.active
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'can_edit', request.status = 'draft' AND (is_requester OR is_admin),
    'can_override', request.status = 'draft' AND is_admin,
    'can_approve', request.status = 'submitted' AND conflict IS NULL AND NOT approved_by_me
      AND (required_approvals > 0 OR is_admin),
    'can_reject', request.status = 'submitted' AND conflict IS NULL,
    'approval_blocked_reason', CASE
      WHEN request.status <> 'submitted' OR conflict IS NULL THEN NULL
      WHEN required_approvals = 0 THEN conflict
        || ', so a different administrator must approve it. If no other administrator can, cancel it.'
      ELSE conflict || ', so someone else must approve or reject it.'
    END,
    'can_cancel', request.status IN ('draft', 'submitted') AND (is_requester OR is_admin),
    'can_retry_expense', request.status = 'approved' AND request.expense_id IS NULL AND is_admin
      AND private.module_enabled(p_society_id, 'expense'),
    'is_requester', is_requester,
    'approved_by_me', approved_by_me
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_request_save(uuid, uuid, text, text, text, bigint, integer, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_quote_add(uuid, uuid, uuid, bigint, text, text, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_quote_remove(uuid, uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_quote_select(uuid, uuid, uuid, integer, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_quote_override(uuid, uuid, text, integer, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_request_submit(uuid, uuid, integer, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_request_approve(uuid, uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_request_reject(uuid, uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_request_cancel(uuid, uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_expense_draft_retry(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_workspace_get(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_get(uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_request_get(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_request_save(uuid, uuid, text, text, text, bigint, integer, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_quote_add(uuid, uuid, uuid, bigint, text, text, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_quote_remove(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_quote_select(uuid, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_quote_override(uuid, uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_request_submit(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_request_approve(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_request_reject(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_request_cancel(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_expense_draft_retry(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_workspace_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_get(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_request_get(uuid, uuid) TO authenticated;
