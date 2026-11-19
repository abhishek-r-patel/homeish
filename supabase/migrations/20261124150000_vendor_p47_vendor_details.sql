-- Add P47 vendor identity, payment-term and warning-only blacklist details.
ALTER TABLE public.vendors
  ADD COLUMN pan text,
  ADD COLUMN payment_terms_days integer,
  ADD COLUMN onboarded_date date,
  ADD COLUMN blacklisted boolean NOT NULL DEFAULT false,
  ADD COLUMN blacklist_reason text,
  ADD COLUMN blacklisted_at timestamptz,
  ADD COLUMN blacklisted_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ADD CONSTRAINT vendors_pan_check
    CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  ADD CONSTRAINT vendors_payment_terms_days_check
    CHECK (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 365),
  ADD CONSTRAINT vendors_blacklist_check CHECK (
    (blacklisted AND blacklist_reason IS NOT NULL AND blacklisted_at IS NOT NULL
      AND blacklisted_by IS NOT NULL)
    OR (NOT blacklisted AND blacklist_reason IS NULL AND blacklisted_at IS NULL
      AND blacklisted_by IS NULL)
  ),
  ADD CONSTRAINT vendors_blacklist_reason_check CHECK (
    blacklist_reason IS NULL OR (
      char_length(blacklist_reason) BETWEEN 1 AND 500
      AND blacklist_reason = btrim(blacklist_reason)
    )
  );
CREATE INDEX vendors_blacklisted_by_idx ON public.vendors (blacklisted_by);

DROP FUNCTION public.vendor_save(
  uuid, uuid, text, text, text, text, text, text, text, integer, uuid, text
);

CREATE FUNCTION public.vendor_save(
  p_society_id uuid,
  p_vendor_id uuid,
  p_name text,
  p_category text,
  p_contact_person text,
  p_phone text,
  p_email text,
  p_gstin text,
  p_notes text,
  p_pan text,
  p_payment_terms_days integer,
  p_onboarded_date date,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor public.vendors;
  clean_name text;
  clean_category text;
  clean_contact text;
  clean_phone text;
  clean_email text;
  clean_gstin text;
  clean_notes text;
  clean_pan text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  clean_name := private.vendor_clean_text(p_name, 120, 'a vendor name', true);
  clean_category := private.vendor_clean_text(p_category, 60, 'a category', true);
  clean_contact := private.vendor_clean_text(p_contact_person, 120, 'a contact person', false);
  clean_phone := private.vendor_clean_text(p_phone, 20, 'a phone number', false);
  clean_email := lower(private.vendor_clean_text(p_email, 254, 'an email', false));
  clean_gstin := upper(private.vendor_clean_text(p_gstin, 15, 'a GST number', false));
  clean_notes := private.vendor_clean_text(p_notes, 1000, 'notes', false);
  clean_pan := upper(private.vendor_clean_text(p_pan, 10, 'a PAN', false));
  IF clean_phone IS NOT NULL AND clean_phone !~ '^\+?[0-9][0-9 -]{4,18}[0-9]$' THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF clean_email IS NOT NULL AND clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF clean_gstin IS NOT NULL
    AND clean_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  THEN
    RAISE EXCEPTION 'Enter a 15-character GSTIN such as 27ABCDE1234F1Z5.' USING ERRCODE = '22023';
  END IF;
  IF clean_pan IS NOT NULL AND clean_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    RAISE EXCEPTION 'Enter a valid 10-character PAN.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_terms_days IS NOT NULL
    AND p_payment_terms_days NOT BETWEEN 0 AND 365
  THEN
    RAISE EXCEPTION 'Payment terms must be between 0 and 365 days.'
      USING ERRCODE = '22023';
  END IF;
  IF p_vendor_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO vendor FROM public.vendors
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN vendor.id; END IF;
    IF EXISTS (
      SELECT 1 FROM public.vendors WHERE society_id = p_society_id AND lower(name) = lower(clean_name)
    ) THEN
      RAISE EXCEPTION 'A vendor with this name already exists.' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.vendors (
      society_id, name, category, contact_person, phone, email, gstin, notes,
      pan, payment_terms_days, onboarded_date, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, clean_name, clean_category, clean_contact, clean_phone, clean_email,
      clean_gstin, clean_notes, clean_pan, p_payment_terms_days, p_onboarded_date,
      p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO vendor;
    PERFORM private.vendor_audit(p_society_id, 'vendor.create', 'vendor', vendor.id,
      jsonb_build_object('name', vendor.name, 'category', vendor.category,
        'gstin', vendor.gstin), NULL, p_request_id);
    RETURN vendor.id;
  END IF;
  SELECT * INTO vendor FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR vendor.version <> p_expected_version THEN
    RAISE EXCEPTION 'This vendor changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendors
    WHERE society_id = p_society_id AND lower(name) = lower(clean_name) AND id <> vendor.id
  ) THEN
    RAISE EXCEPTION 'A vendor with this name already exists.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.vendors
  SET name = clean_name, category = clean_category, contact_person = clean_contact,
    phone = clean_phone, email = clean_email, gstin = clean_gstin, notes = clean_notes,
    pan = clean_pan, payment_terms_days = p_payment_terms_days,
    onboarded_date = p_onboarded_date,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = vendor.id RETURNING * INTO vendor;
  PERFORM private.vendor_audit(p_society_id, 'vendor.update', 'vendor', vendor.id,
    jsonb_build_object('name', vendor.name, 'category', vendor.category,
      'gstin', vendor.gstin, 'version', vendor.version), NULL, p_request_id);
  RETURN vendor.id;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_save(
  uuid, uuid, text, text, text, text, text, text, text, text, integer, date, integer, uuid, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_save(
  uuid, uuid, text, text, text, text, text, text, text, text, integer, date, integer, uuid, text
) TO authenticated;

CREATE FUNCTION public.vendor_save(
  p_society_id uuid,
  p_vendor_id uuid,
  p_name text,
  p_category text,
  p_contact_person text,
  p_phone text,
  p_email text,
  p_gstin text,
  p_notes text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor public.vendors;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_vendor_id IS NOT NULL THEN
    SELECT * INTO vendor FROM public.vendors
      WHERE society_id = p_society_id AND id = p_vendor_id;
  END IF;
  RETURN public.vendor_save(
    p_society_id, p_vendor_id, p_name, p_category, p_contact_person, p_phone,
    p_email, p_gstin, p_notes, vendor.pan, vendor.payment_terms_days,
    vendor.onboarded_date, p_expected_version, p_client_request_id, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_save(
  uuid, uuid, text, text, text, text, text, text, text, integer, uuid, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_save(
  uuid, uuid, text, text, text, text, text, text, text, integer, uuid, text
) TO authenticated;

CREATE FUNCTION public.vendor_set_blacklisted(
  p_society_id uuid,
  p_vendor_id uuid,
  p_blacklisted boolean,
  p_expected_version integer,
  p_reason text,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor public.vendors;
  clean_reason text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_blacklisted IS NULL THEN
    RAISE EXCEPTION 'Choose whether to blacklist this vendor.' USING ERRCODE = '22023';
  END IF;
  clean_reason := private.vendor_clean_text(p_reason, 500, 'a reason', true);
  SELECT * INTO vendor FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR vendor.version <> p_expected_version THEN
    RAISE EXCEPTION 'This vendor changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF vendor.blacklisted = p_blacklisted THEN RETURN; END IF;

  UPDATE public.vendors
  SET blacklisted = p_blacklisted,
      blacklist_reason = CASE WHEN p_blacklisted THEN clean_reason ELSE NULL END,
      blacklisted_at = CASE WHEN p_blacklisted THEN clock_timestamp() ELSE NULL END,
      blacklisted_by = CASE WHEN p_blacklisted THEN auth.uid() ELSE NULL END,
      version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vendor_id;
  PERFORM private.vendor_audit(
    p_society_id,
    CASE WHEN p_blacklisted THEN 'blacklist.add' ELSE 'blacklist.remove' END,
    'vendor',
    vendor.id,
    jsonb_build_object('blacklisted', p_blacklisted),
    clean_reason,
    p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_set_blacklisted(uuid, uuid, boolean, integer, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_set_blacklisted(uuid, uuid, boolean, integer, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_workspace_get(p_society_id uuid)
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
        'gstin', vendor.gstin, 'pan', CASE WHEN is_admin THEN vendor.pan ELSE NULL END,
        'payment_terms_days', vendor.payment_terms_days, 'onboarded_date', vendor.onboarded_date,
        'blacklisted', vendor.blacklisted, 'blacklist_reason', vendor.blacklist_reason,
        'active', vendor.active, 'version', vendor.version,
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

CREATE OR REPLACE FUNCTION public.vendor_get(p_society_id uuid, p_vendor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor public.vendors;
  is_admin boolean;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT * INTO vendor FROM public.vendors WHERE society_id = p_society_id AND id = p_vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  is_admin := private.vendor_is_admin(p_society_id);
  RETURN jsonb_build_object(
    'can_manage', is_admin,
    'vendor', jsonb_build_object(
      'id', vendor.id, 'name', vendor.name, 'category', vendor.category,
      'contact_person', vendor.contact_person, 'phone', vendor.phone, 'email', vendor.email,
      'gstin', vendor.gstin, 'pan', CASE WHEN is_admin THEN vendor.pan ELSE NULL END,
      'payment_terms_days', vendor.payment_terms_days, 'onboarded_date', vendor.onboarded_date,
      'blacklisted', vendor.blacklisted, 'blacklist_reason', vendor.blacklist_reason,
      'notes', vendor.notes, 'active', vendor.active,
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

CREATE OR REPLACE FUNCTION public.vendor_request_get(p_society_id uuid, p_purchase_request_id uuid)
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
        'blacklisted', vendor.blacklisted, 'blacklist_reason', vendor.blacklist_reason,
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
      SELECT jsonb_agg(jsonb_build_object(
        'id', vendor.id, 'name', vendor.name,
        'blacklisted', vendor.blacklisted, 'blacklist_reason', vendor.blacklist_reason
      ) ORDER BY lower(vendor.name))
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
