-- Add P42 category metadata, vendor spend reporting and savings follow-up.
ALTER TABLE public.expense_categories
  ADD COLUMN detail_group text
    CHECK (detail_group IS NULL OR (
      detail_group = btrim(detail_group) AND char_length(detail_group) BETWEEN 1 AND 60
    )),
  ADD COLUMN cost_nature text CHECK (cost_nature IN ('fixed', 'variable', 'periodic')),
  ADD COLUMN owner_user_id uuid,
  ADD COLUMN detail_description text
    CHECK (detail_description IS NULL OR (
      detail_description = btrim(detail_description)
      AND char_length(detail_description) BETWEEN 1 AND 500
    )),
  ADD COLUMN detail_version integer NOT NULL DEFAULT 1
    CHECK (detail_version >= 1),
  ADD CONSTRAINT expense_categories_owner_same_society_fkey
    FOREIGN KEY (society_id, owner_user_id)
    REFERENCES public.memberships (society_id, user_id) ON DELETE RESTRICT;

CREATE INDEX expense_categories_owner_idx
  ON public.expense_categories (society_id, owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE TABLE public.expense_category_detail_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  previous_group text,
  previous_cost_nature text,
  previous_owner_user_id uuid,
  previous_description text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_category_revisions_category_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, category_id, revision_number),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_category_revisions_category_idx
  ON public.expense_category_detail_revisions (society_id, category_id, revision_number DESC);
CREATE INDEX expense_category_revisions_created_by_idx
  ON public.expense_category_detail_revisions (created_by);

CREATE TABLE public.expense_payee_vendor_mappings (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  payee_key text NOT NULL
    CHECK (payee_key = lower(btrim(payee_key))
      AND payee_key = regexp_replace(payee_key, '\s+', ' ', 'g')
      AND char_length(payee_key) BETWEEN 1 AND 120),
  vendor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  removal_reason text
    CHECK (removal_reason IS NULL OR (
      removal_reason = btrim(removal_reason)
      AND char_length(removal_reason) BETWEEN 1 AND 500
    )),
  CONSTRAINT expense_payee_mappings_vendor_fkey
    FOREIGN KEY (society_id, vendor_id)
    REFERENCES public.vendors (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_payee_mappings_removal_check CHECK (
    (removed_at IS NULL AND removed_by IS NULL AND removal_reason IS NULL)
    OR (removed_at IS NOT NULL AND removed_by IS NOT NULL AND removal_reason IS NOT NULL)
  )
);
CREATE UNIQUE INDEX expense_payee_vendor_mappings_active_key
  ON public.expense_payee_vendor_mappings (society_id, payee_key)
  WHERE removed_at IS NULL;
CREATE INDEX expense_payee_vendor_mappings_vendor_idx
  ON public.expense_payee_vendor_mappings (society_id, vendor_id);
CREATE INDEX expense_payee_vendor_mappings_created_by_idx
  ON public.expense_payee_vendor_mappings (created_by);
CREATE INDEX expense_payee_vendor_mappings_removed_by_idx
  ON public.expense_payee_vendor_mappings (removed_by)
  WHERE removed_by IS NOT NULL;

CREATE TABLE public.expense_savings_initiatives (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  title text NOT NULL
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL
    CHECK (description = btrim(description) AND char_length(description) BETWEEN 1 AND 4000),
  kind text NOT NULL CHECK (kind IN (
    'renegotiation', 'energy_saving', 'reduced_consumption',
    'vendor_change', 'process_change', 'other'
  )),
  owner_user_id uuid,
  category_id uuid,
  vendor_id uuid,
  baseline_annual_paise bigint NOT NULL
    CHECK (baseline_annual_paise BETWEEN 0 AND 999999999999999),
  expected_annual_paise bigint NOT NULL
    CHECK (expected_annual_paise BETWEEN 0 AND 999999999999999),
  status text NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea', 'approved', 'implementing', 'realised', 'dropped')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_owner_fkey
    FOREIGN KEY (society_id, owner_user_id)
    REFERENCES public.memberships (society_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_category_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_vendor_fkey
    FOREIGN KEY (society_id, vendor_id)
    REFERENCES public.vendors (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_savings_status_idx
  ON public.expense_savings_initiatives (society_id, status, updated_at DESC);
CREATE INDEX expense_savings_owner_idx
  ON public.expense_savings_initiatives (owner_user_id);
CREATE INDEX expense_savings_category_idx
  ON public.expense_savings_initiatives (category_id);
CREATE INDEX expense_savings_vendor_idx
  ON public.expense_savings_initiatives (vendor_id);
CREATE TRIGGER expense_savings_set_updated_at
  BEFORE UPDATE ON public.expense_savings_initiatives
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_savings_status_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  initiative_id uuid NOT NULL,
  from_status text NOT NULL
    CHECK (from_status IN ('idea', 'approved', 'implementing', 'realised', 'dropped')),
  to_status text NOT NULL
    CHECK (to_status IN ('idea', 'approved', 'implementing', 'realised', 'dropped')),
  reason text
    CHECK (reason IS NULL OR (
      reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 500
    )),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_savings_status_initiative_fkey
    FOREIGN KEY (society_id, initiative_id)
    REFERENCES public.expense_savings_initiatives (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_savings_status_events_initiative_idx
  ON public.expense_savings_status_events (society_id, initiative_id, created_at DESC);

CREATE TABLE public.expense_savings_evidence (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  initiative_id uuid NOT NULL,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 999999999999999),
  evidenced_on date NOT NULL CHECK (evidenced_on <= current_date),
  note text NOT NULL
    CHECK (note = btrim(note) AND char_length(note) BETWEEN 1 AND 2000),
  entry_id uuid,
  vendor_bill_id uuid,
  vendor_contract_id uuid,
  file_path text
    CHECK (file_path IS NULL OR char_length(file_path) BETWEEN 1 AND 500),
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  void_reason text
    CHECK (void_reason IS NULL OR (
      void_reason = btrim(void_reason) AND char_length(void_reason) BETWEEN 1 AND 500
    )),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_evidence_initiative_fkey
    FOREIGN KEY (society_id, initiative_id)
    REFERENCES public.expense_savings_initiatives (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_evidence_entry_fkey
    FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_evidence_bill_fkey
    FOREIGN KEY (society_id, vendor_bill_id)
    REFERENCES public.vendor_bills (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_evidence_contract_fkey
    FOREIGN KEY (society_id, vendor_contract_id)
    REFERENCES public.vendor_contracts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_savings_evidence_link_check CHECK (
    (entry_id IS NOT NULL)::integer + (vendor_bill_id IS NOT NULL)::integer
      + (vendor_contract_id IS NOT NULL)::integer <= 1
  ),
  CONSTRAINT expense_savings_evidence_void_check CHECK (
    (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL)
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_savings_evidence_initiative_idx
  ON public.expense_savings_evidence (society_id, initiative_id, evidenced_on DESC);
CREATE INDEX expense_savings_evidence_entry_idx
  ON public.expense_savings_evidence (entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX expense_savings_evidence_bill_idx
  ON public.expense_savings_evidence (vendor_bill_id) WHERE vendor_bill_id IS NOT NULL;
CREATE INDEX expense_savings_evidence_contract_idx
  ON public.expense_savings_evidence (vendor_contract_id) WHERE vendor_contract_id IS NOT NULL;
CREATE UNIQUE INDEX expense_savings_evidence_file_key
  ON public.expense_savings_evidence (file_path) WHERE file_path IS NOT NULL;

CREATE TABLE public.expense_control_requests (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  operation text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  result_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (society_id, actor_id, client_request_id)
);
CREATE INDEX expense_control_requests_result_idx
  ON public.expense_control_requests (society_id, operation, result_id);

ALTER TABLE public.expense_category_detail_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_payee_vendor_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_savings_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_savings_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_savings_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_control_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_category_detail_revisions,
  public.expense_payee_vendor_mappings, public.expense_savings_initiatives,
  public.expense_savings_status_events, public.expense_savings_evidence,
  public.expense_control_requests
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_category_detail_revisions_deny
  ON public.expense_category_detail_revisions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_payee_vendor_mappings_deny
  ON public.expense_payee_vendor_mappings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_savings_initiatives_deny
  ON public.expense_savings_initiatives FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_savings_status_events_deny
  ON public.expense_savings_status_events FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_savings_evidence_deny
  ON public.expense_savings_evidence FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_control_requests_deny
  ON public.expense_control_requests FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.expense_control_append_only_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'P42 history is append-only.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_control_append_only_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_category_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.expense_category_detail_revisions
  FOR EACH ROW EXECUTE FUNCTION private.expense_control_append_only_guard();
CREATE TRIGGER expense_category_revisions_no_truncate
  BEFORE TRUNCATE ON public.expense_category_detail_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_control_append_only_guard();
CREATE TRIGGER expense_savings_events_append_only
  BEFORE UPDATE OR DELETE ON public.expense_savings_status_events
  FOR EACH ROW EXECUTE FUNCTION private.expense_control_append_only_guard();
CREATE TRIGGER expense_savings_events_no_truncate
  BEFORE TRUNCATE ON public.expense_savings_status_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_control_append_only_guard();
CREATE TRIGGER expense_control_requests_append_only
  BEFORE UPDATE OR DELETE ON public.expense_control_requests
  FOR EACH ROW EXECUTE FUNCTION private.expense_control_append_only_guard();
CREATE TRIGGER expense_control_requests_no_truncate
  BEFORE TRUNCATE ON public.expense_control_requests
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_control_append_only_guard();

CREATE FUNCTION private.expense_savings_no_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Savings records are retained permanently.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.expense_savings_no_delete()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_savings_no_delete
  BEFORE DELETE ON public.expense_savings_initiatives
  FOR EACH ROW EXECUTE FUNCTION private.expense_savings_no_delete();
CREATE TRIGGER expense_savings_no_truncate
  BEFORE TRUNCATE ON public.expense_savings_initiatives
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_savings_no_delete();

CREATE FUNCTION private.expense_payee_mapping_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Payee mappings are retained; only one removal is allowed.'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.removed_at IS NOT NULL
    OR NEW.removed_at IS NULL OR NEW.removed_by IS NULL OR NEW.removal_reason IS NULL
    OR NEW.society_id IS DISTINCT FROM OLD.society_id
    OR NEW.payee_key IS DISTINCT FROM OLD.payee_key
    OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Payee mappings are retained; only one removal is allowed.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_payee_mapping_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_payee_mapping_guard
  BEFORE UPDATE OR DELETE ON public.expense_payee_vendor_mappings
  FOR EACH ROW EXECUTE FUNCTION private.expense_payee_mapping_guard();
CREATE TRIGGER expense_payee_mapping_no_truncate
  BEFORE TRUNCATE ON public.expense_payee_vendor_mappings
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_payee_mapping_guard();

CREATE FUNCTION private.expense_savings_evidence_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Savings evidence is retained; only one reasoned void is allowed.'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.voided_at IS NOT NULL
    OR NEW.voided_at IS NULL OR NEW.voided_by IS NULL OR NEW.void_reason IS NULL
    OR to_jsonb(NEW) - ARRAY['voided_at', 'voided_by', 'void_reason']
      IS DISTINCT FROM to_jsonb(OLD) - ARRAY['voided_at', 'voided_by', 'void_reason']
  THEN
    RAISE EXCEPTION 'Savings evidence is retained; only one reasoned void is allowed.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_savings_evidence_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_savings_evidence_guard
  BEFORE UPDATE OR DELETE ON public.expense_savings_evidence
  FOR EACH ROW EXECUTE FUNCTION private.expense_savings_evidence_guard();
CREATE TRIGGER expense_savings_evidence_no_truncate
  BEFORE TRUNCATE ON public.expense_savings_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_savings_evidence_guard();

CREATE FUNCTION private.expense_control_request_lock(
  p_society_id uuid, p_client_request_id uuid
)
RETURNS void LANGUAGE sql SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    'expense-control:' || p_society_id::text || ':' || auth.uid()::text || ':' ||
      p_client_request_id::text, 0
  ))
$$;
REVOKE ALL ON FUNCTION private.expense_control_request_lock(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_control_request_result(
  p_society_id uuid, p_operation text, p_payload jsonb, p_client_request_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_control_requests;
BEGIN
  SELECT * INTO previous FROM public.expense_control_requests
  WHERE society_id = p_society_id AND actor_id = auth.uid()
    AND client_request_id = p_client_request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF previous.operation IS DISTINCT FROM p_operation
    OR previous.payload IS DISTINCT FROM p_payload
  THEN
    RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
  END IF;
  RETURN previous.result_id;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_control_request_result(uuid, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_control_request_record(
  p_society_id uuid, p_operation text, p_payload jsonb, p_client_request_id uuid,
  p_result_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.expense_control_requests (
    society_id, actor_id, client_request_id, operation, payload, result_id
  ) VALUES (
    p_society_id, auth.uid(), p_client_request_id, p_operation, p_payload, p_result_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.expense_control_request_record(
  uuid, text, jsonb, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_payee_key(p_payee text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(regexp_replace(btrim(p_payee), '\s+', ' ', 'g'))
$$;
REVOKE ALL ON FUNCTION private.expense_payee_key(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_staff_current(p_society_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = p_user_id
      AND membership.status = 'active'
      AND membership.roles && ARRAY['admin', 'committee']::text[]
  )
$$;
REVOKE ALL ON FUNCTION private.expense_staff_current(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.expense_file_scope(p_path text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_path IS NULL OR NOT (
    p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/expense/[0-9a-f-]{36}\.(jpg|png|pdf)$'
    OR p_path ~ '^[0-9a-f-]{36}/savings/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|pdf)$'
  ) THEN
    RETURN NULL;
  END IF;
  IF split_part(p_path, '/', 1)
    !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;
  RETURN split_part(p_path, '/', 1)::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION private.expense_file_readable(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.module_enabled(private.expense_file_scope(p_path), 'expense')
    AND private.has_role(private.expense_file_scope(p_path), ARRAY['admin', 'committee']::text[])
    AND (
      (
        split_part(p_path, '/', 3) = 'expense'
        AND split_part(p_path, '/', 2) = auth.uid()::text
        AND private.has_role(private.expense_file_scope(p_path), ARRAY['admin']::text[])
      )
      OR EXISTS (
        SELECT 1 FROM public.expenses
        WHERE society_id = private.expense_file_scope(p_path) AND receipt_path = p_path
      )
      OR EXISTS (
        SELECT 1 FROM public.expense_savings_evidence
        WHERE society_id = private.expense_file_scope(p_path) AND file_path = p_path
      )
    )
$$;

CREATE OR REPLACE FUNCTION private.expense_verify_file(p_society_id uuid, p_path text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  metadata jsonb;
  mime text;
BEGIN
  IF p_path IS NULL THEN
    RETURN;
  END IF;
  IF private.expense_file_scope(p_path) IS DISTINCT FROM p_society_id
    OR (
      split_part(p_path, '/', 3) = 'expense'
      AND split_part(p_path, '/', 2) <> auth.uid()::text
    )
  THEN
    RAISE EXCEPTION 'The attachment is not available.' USING ERRCODE = '42501';
  END IF;
  SELECT object.metadata INTO metadata FROM storage.objects AS object
  WHERE bucket_id = 'expense-files' AND name = p_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment not found.' USING ERRCODE = 'P0002';
  END IF;
  mime := metadata ->> 'mimetype';
  IF COALESCE(metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
    OR (metadata ->> 'size')::numeric NOT BETWEEN 1 AND 5242880
    OR mime IS NULL
    OR NOT (
      (mime = 'image/jpeg' AND right(p_path, 4) = '.jpg')
      OR (mime = 'image/png' AND right(p_path, 4) = '.png')
      OR (mime = 'application/pdf' AND right(p_path, 4) = '.pdf')
    )
  THEN
    RAISE EXCEPTION 'Invalid attachment.' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION private.expense_savings_verify_file(
  p_society_id uuid, p_initiative_id uuid, p_path text
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  metadata jsonb;
  mime text;
BEGIN
  IF p_path IS NULL THEN RETURN; END IF;
  IF split_part(p_path, '/', 1) <> p_society_id::text
    OR split_part(p_path, '/', 2) <> 'savings'
    OR split_part(p_path, '/', 3) <> p_initiative_id::text
    OR p_path !~ '^[0-9a-f-]{36}/savings/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|pdf)$'
  THEN
    RAISE EXCEPTION 'The savings evidence attachment is not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT object.metadata INTO metadata FROM storage.objects AS object
  WHERE bucket_id = 'expense-files' AND name = p_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings evidence attachment not found.' USING ERRCODE = 'P0002';
  END IF;
  mime := metadata ->> 'mimetype';
  IF COALESCE(metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
    OR (metadata ->> 'size')::numeric NOT BETWEEN 1 AND 5242880
    OR mime IS NULL
    OR NOT (
      (mime = 'image/jpeg' AND right(p_path, 4) = '.jpg')
      OR (mime = 'image/png' AND right(p_path, 4) = '.png')
      OR (mime = 'application/pdf' AND right(p_path, 4) = '.pdf')
    )
  THEN
    RAISE EXCEPTION 'Invalid savings evidence attachment.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_savings_verify_file(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_savings_upload_allowed(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT split_part(p_path, '/', 2) = 'savings'
    AND EXISTS (
      SELECT 1 FROM public.expense_savings_initiatives AS initiative
      WHERE initiative.society_id = private.expense_file_scope(p_path)
        AND initiative.id::text = split_part(p_path, '/', 3)
    )
$$;
REVOKE ALL ON FUNCTION private.expense_savings_upload_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.expense_savings_upload_allowed(text)
  TO authenticated, service_role;

DROP POLICY IF EXISTS expense_files_insert ON storage.objects;
CREATE POLICY expense_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-files'
    AND private.expense_file_scope(name) IS NOT NULL
    AND private.module_enabled(private.expense_file_scope(name), 'expense')
    AND private.society_writable(private.expense_file_scope(name))
    AND private.has_role(private.expense_file_scope(name), ARRAY['admin']::text[])
    AND (
      split_part(name, '/', 3) = 'expense'
      AND split_part(name, '/', 2) = auth.uid()::text
      OR private.expense_savings_upload_allowed(name)
    )
  );

CREATE OR REPLACE FUNCTION public.expense_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
  config public.module_configs;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense';
  RETURN jsonb_build_object(
    'today', today,
    'actor_id', auth.uid(),
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'can_approve', private.has_role(p_society_id, ARRAY['committee']::text[])
      AND private.society_writable(p_society_id),
    'billing_enabled', private.module_enabled(p_society_id, 'billing'),
    'vendor_enabled', private.module_enabled(p_society_id, 'vendor'),
    'settings', jsonb_build_object(
      'approval_threshold_paise', private.expense_threshold(p_society_id),
      'billing_income_account_id', config.settings -> 'billing_income_account_id',
      'updated_at', config.updated_at
    ),
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', account.id, 'name', account.name, 'account_type', account.account_type,
        'opening_balance_paise', account.opening_balance_paise,
        'opening_on', account.opening_on, 'active', account.active,
        'updated_at', account.updated_at,
        'balance_paise', private.expense_balance(p_society_id, account.id, today),
        'has_entries', EXISTS (
          SELECT 1 FROM public.expense_book_entries AS entry
          WHERE entry.society_id = p_society_id AND entry.account_id = account.id
        )
      ) ORDER BY account.active DESC, account.account_type, lower(account.name))
      FROM public.expense_accounts AS account WHERE account.society_id = p_society_id
    ), '[]'::jsonb),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', category.id, 'name', category.name, 'active', category.active,
        'detail_group', category.detail_group, 'cost_nature', category.cost_nature,
        'owner_user_id', category.owner_user_id,
        'owner_name', owner.full_name,
        'owner_is_current', CASE WHEN category.owner_user_id IS NULL THEN NULL
          ELSE private.expense_staff_current(p_society_id, category.owner_user_id) END,
        'detail_description', category.detail_description,
        'detail_version', category.detail_version,
        'updated_at', category.updated_at,
        'detail_revisions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'revision_number', revision.revision_number,
            'created_at', revision.created_at,
            'created_by_name', actor.full_name
          ) ORDER BY revision.revision_number DESC)
          FROM public.expense_category_detail_revisions AS revision
          JOIN public.profiles AS actor ON actor.id = revision.created_by
          WHERE revision.society_id = p_society_id
            AND revision.category_id = category.id
        ), '[]'::jsonb)
      ) ORDER BY category.active DESC, lower(category.name))
      FROM public.expense_categories AS category
      LEFT JOIN public.profiles AS owner ON owner.id = category.owner_user_id
      WHERE category.society_id = p_society_id
    ), '[]'::jsonb),
    'group_suggestions', COALESCE((
      SELECT jsonb_agg(group_value ORDER BY lower(group_value))
      FROM (
        SELECT min(category.detail_group) AS group_value
        FROM public.expense_categories AS category
        WHERE category.society_id = p_society_id
          AND category.detail_group IS NOT NULL
        GROUP BY lower(category.detail_group)
      ) AS groups
    ), '[]'::jsonb),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id, 'full_name', profile.full_name
      ) ORDER BY lower(profile.full_name))
      FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.roles && ARRAY['admin', 'committee']::text[]
    ), '[]'::jsonb),
    'closed_months', COALESCE((
      SELECT jsonb_agg(month ORDER BY month DESC)
      FROM public.expense_month_locks WHERE society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_category_details_save(
  p_society_id uuid, p_category_id uuid, p_detail_group text, p_cost_nature text,
  p_owner_user_id uuid, p_detail_description text, p_expected_version integer,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.expense_categories;
  previous_request uuid;
  clean_group text;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'category.details.save', jsonb_build_object(
      'category_id', p_category_id, 'detail_group', p_detail_group,
      'cost_nature', p_cost_nature, 'owner_user_id', p_owner_user_id,
      'detail_description', p_detail_description,
      'expected_version', p_expected_version
    ), p_client_request_id
  ) INTO previous_request;
  IF previous_request IS NOT NULL THEN RETURN previous_request; END IF;
  SELECT * INTO current_row FROM public.expense_categories
  WHERE society_id = p_society_id AND id = p_category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002'; END IF;
  IF current_row.detail_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Category details changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF (p_detail_group IS NOT NULL AND (btrim(p_detail_group) = ''
      OR char_length(p_detail_group) > 60))
    OR (p_cost_nature IS NOT NULL
      AND p_cost_nature NOT IN ('fixed', 'variable', 'periodic'))
    OR (p_detail_description IS NOT NULL
      AND (btrim(p_detail_description) = '' OR char_length(p_detail_description) > 500))
  THEN
    RAISE EXCEPTION 'Check the category details.' USING ERRCODE = '22023';
  END IF;
  IF p_owner_user_id IS NOT NULL AND NOT private.expense_staff_current(
    p_society_id, p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Choose an active admin or committee member.'
      USING ERRCODE = '22023';
  END IF;
  clean_group := nullif(btrim(p_detail_group), '');
  IF clean_group IS NOT NULL THEN
    SELECT min(category.detail_group) INTO clean_group
    FROM public.expense_categories AS category
    WHERE category.society_id = p_society_id
      AND lower(category.detail_group) = lower(clean_group);
    clean_group := COALESCE(clean_group, nullif(btrim(p_detail_group), ''));
  END IF;
  IF current_row.detail_group IS NOT DISTINCT FROM clean_group
    AND current_row.cost_nature IS NOT DISTINCT FROM p_cost_nature
    AND current_row.owner_user_id IS NOT DISTINCT FROM p_owner_user_id
    AND current_row.detail_description IS NOT DISTINCT FROM
      nullif(btrim(p_detail_description), '')
  THEN
    PERFORM private.expense_control_request_record(
      p_society_id, 'category.details.save', jsonb_build_object(
        'category_id', p_category_id, 'detail_group', p_detail_group,
        'cost_nature', p_cost_nature, 'owner_user_id', p_owner_user_id,
        'detail_description', p_detail_description,
        'expected_version', p_expected_version
      ), p_client_request_id, p_category_id
    );
    RETURN p_category_id;
  END IF;
  INSERT INTO public.expense_category_detail_revisions (
    society_id, category_id, revision_number, previous_group,
    previous_cost_nature, previous_owner_user_id, previous_description,
    created_by, client_request_id
  ) VALUES (
    p_society_id, p_category_id, current_row.detail_version,
    current_row.detail_group, current_row.cost_nature, current_row.owner_user_id,
    current_row.detail_description, auth.uid(), p_client_request_id
  );
  UPDATE public.expense_categories SET
    detail_group = clean_group,
    cost_nature = p_cost_nature,
    owner_user_id = p_owner_user_id,
    detail_description = nullif(btrim(p_detail_description), ''),
    detail_version = detail_version + 1,
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_category_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.category.details.update',
    'expense_category', p_category_id,
    jsonb_build_object(
      'detail_group', current_row.detail_group,
      'cost_nature', current_row.cost_nature,
      'owner_user_id', current_row.owner_user_id,
      'detail_description', current_row.detail_description
    ),
    jsonb_build_object(
      'detail_group', clean_group,
      'cost_nature', p_cost_nature, 'owner_user_id', p_owner_user_id,
      'detail_description', nullif(btrim(p_detail_description), '')
    ),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'category.details.save', jsonb_build_object(
      'category_id', p_category_id, 'detail_group', p_detail_group,
      'cost_nature', p_cost_nature, 'owner_user_id', p_owner_user_id,
      'detail_description', p_detail_description,
      'expected_version', p_expected_version
    ), p_client_request_id, p_category_id
  );
  RETURN p_category_id;
END;
$$;

CREATE FUNCTION public.expense_payee_mapping_save(
  p_society_id uuid, p_payee text, p_vendor_id uuid, p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_key text;
  mapping_id uuid;
  previous_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'payee_mapping.save', jsonb_build_object(
      'payee', p_payee, 'vendor_id', p_vendor_id
    ), p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  IF NOT private.module_enabled(p_society_id, 'vendor') THEN
    RAISE EXCEPTION 'The Vendor module is not enabled.' USING ERRCODE = '42501';
  END IF;
  clean_key := private.expense_payee_key(p_payee);
  IF clean_key IS NULL OR clean_key = '' OR char_length(clean_key) > 120 THEN
    RAISE EXCEPTION 'Choose a valid payee.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Choose an active vendor.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO mapping_id FROM public.expense_payee_vendor_mappings
  WHERE society_id = p_society_id AND payee_key = clean_key AND removed_at IS NULL;
  IF mapping_id IS NOT NULL THEN
    IF (SELECT vendor_id FROM public.expense_payee_vendor_mappings
      WHERE id = mapping_id) IS DISTINCT FROM p_vendor_id
    THEN
      RAISE EXCEPTION 'Remove the current mapping before choosing another vendor.'
        USING ERRCODE = '23505';
    END IF;
    PERFORM private.expense_control_request_record(
      p_society_id, 'payee_mapping.save',
      jsonb_build_object('payee', p_payee, 'vendor_id', p_vendor_id),
      p_client_request_id, mapping_id
    );
    RETURN mapping_id;
  END IF;
  INSERT INTO public.expense_payee_vendor_mappings (
    society_id, payee_key, vendor_id, created_by
  ) VALUES (p_society_id, clean_key, p_vendor_id, auth.uid())
  RETURNING id INTO mapping_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.payee_mapping.create',
    'expense_payee_mapping', mapping_id,
    jsonb_build_object('payee_key', clean_key, 'vendor_id', p_vendor_id),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'payee_mapping.save',
    jsonb_build_object('payee', p_payee, 'vendor_id', p_vendor_id),
    p_client_request_id, mapping_id
  );
  RETURN mapping_id;
END;
$$;

CREATE FUNCTION public.expense_payee_mapping_remove(
  p_society_id uuid, p_mapping_id uuid, p_reason text, p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.expense_payee_vendor_mappings;
  previous_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'payee_mapping.remove',
    jsonb_build_object('mapping_id', p_mapping_id, 'reason', p_reason),
    p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  IF NOT private.module_enabled(p_society_id, 'vendor') THEN
    RAISE EXCEPTION 'The Vendor module is not enabled.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_row FROM public.expense_payee_vendor_mappings
  WHERE society_id = p_society_id AND id = p_mapping_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mapping not found.' USING ERRCODE = 'P0002'; END IF;
  IF current_row.removed_at IS NOT NULL THEN
    PERFORM private.expense_control_request_record(
      p_society_id, 'payee_mapping.remove',
      jsonb_build_object('mapping_id', p_mapping_id, 'reason', p_reason),
      p_client_request_id, p_mapping_id
    );
    RETURN p_mapping_id;
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' OR char_length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason for removing the mapping.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.expense_payee_vendor_mappings SET
    removed_at = clock_timestamp(), removed_by = auth.uid(),
    removal_reason = btrim(p_reason)
  WHERE society_id = p_society_id AND id = p_mapping_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.payee_mapping.remove',
    'expense_payee_mapping', p_mapping_id,
    jsonb_build_object(
      'payee_key', current_row.payee_key, 'vendor_id', current_row.vendor_id
    ),
    jsonb_build_object('reason', btrim(p_reason)), p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'payee_mapping.remove',
    jsonb_build_object('mapping_id', p_mapping_id, 'reason', p_reason),
    p_client_request_id, p_mapping_id
  );
  RETURN p_mapping_id;
END;
$$;

CREATE FUNCTION public.expense_vendor_spend_report(
  p_society_id uuid, p_from date, p_to date, p_category_id uuid,
  p_group text, p_cost_nature text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor_enabled boolean;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  vendor_enabled := private.module_enabled(p_society_id, 'vendor');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731
    OR (p_cost_nature IS NOT NULL
      AND p_cost_nature NOT IN ('fixed', 'variable', 'periodic'))
  THEN
    RAISE EXCEPTION 'Choose a valid vendor-spend range and filters.'
      USING ERRCODE = '22023';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories
    WHERE society_id = p_society_id AND id = p_category_id
  ) THEN
    RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN (
    WITH entry_roots AS (
      SELECT COALESCE(entry.reverses_entry_id, entry.id) AS root_entry_id,
        (entry.entry_date - (extract(day FROM entry.entry_date)::integer - 1))::date AS month,
        entry.category_id,
        sum(CASE entry.direction WHEN 'out' THEN entry.amount_paise
          ELSE -entry.amount_paise END)::bigint AS amount_paise
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id
        AND entry.entry_date BETWEEN p_from AND p_to
        AND entry.transfer_pair_id IS NULL
        AND entry.category_id IS NOT NULL
      GROUP BY COALESCE(entry.reverses_entry_id, entry.id),
        (entry.entry_date - (extract(day FROM entry.entry_date)::integer - 1))::date,
        entry.category_id
    ), classified AS (
      SELECT roots.root_entry_id, roots.month, roots.amount_paise, roots.category_id,
        expense.payee, private.expense_payee_key(expense.payee) AS payee_key,
        mapping.vendor_id AS mapped_vendor_id
      FROM entry_roots AS roots
      JOIN public.expense_book_entries AS root
        ON root.society_id = p_society_id AND root.id = roots.root_entry_id
      JOIN public.expenses AS expense
        ON expense.society_id = root.society_id AND expense.id = root.expense_id
      JOIN public.expense_categories AS category
        ON category.society_id = p_society_id AND category.id = roots.category_id
      LEFT JOIN public.expense_payee_vendor_mappings AS mapping
        ON vendor_enabled AND mapping.society_id = p_society_id
        AND mapping.payee_key = private.expense_payee_key(expense.payee)
        AND mapping.removed_at IS NULL
      WHERE (p_category_id IS NULL OR roots.category_id = p_category_id)
        AND (p_group IS NULL
          OR lower(category.detail_group) IS NOT DISTINCT FROM lower(p_group))
        AND (p_cost_nature IS NULL OR category.cost_nature = p_cost_nature)
    ), link_totals AS (
      SELECT classified.root_entry_id, classified.month, bill.vendor_id,
        sum(payment.amount_paise)::bigint AS linked_paise
      FROM classified
      JOIN public.vendor_bill_payments AS payment
        ON vendor_enabled AND payment.society_id = p_society_id
        AND payment.entry_id = classified.root_entry_id
        AND payment.unlinked_at IS NULL
      JOIN public.vendor_bills AS bill
        ON bill.society_id = payment.society_id AND bill.id = payment.bill_id
      GROUP BY classified.root_entry_id, classified.month, bill.vendor_id
    ), ordered_links AS (
      SELECT link_totals.*, classified.amount_paise,
        sum(link_totals.linked_paise) OVER (
          PARTITION BY classified.root_entry_id, classified.month
          ORDER BY link_totals.vendor_id
        ) AS cumulative_paise,
        classified.category_id, classified.payee, classified.mapped_vendor_id
      FROM link_totals
      JOIN classified
        ON classified.root_entry_id = link_totals.root_entry_id
        AND classified.month = link_totals.month
    ), allocated_links AS (
      SELECT root_entry_id, month, category_id, payee, vendor_id,
        CASE WHEN amount_paise < 0 THEN -1 ELSE 1 END *
          greatest(0::bigint, least(
            linked_paise,
            abs(amount_paise) - (cumulative_paise - linked_paise)
          ))::bigint AS amount_paise
      FROM ordered_links
    ), segments AS (
      SELECT root_entry_id, month, category_id, payee, vendor_id, amount_paise
      FROM allocated_links WHERE amount_paise <> 0
      UNION ALL
      SELECT classified.root_entry_id, classified.month, classified.category_id,
        classified.payee, classified.mapped_vendor_id,
        classified.amount_paise - COALESCE((
          SELECT sum(allocated.amount_paise)
          FROM allocated_links AS allocated
          WHERE allocated.root_entry_id = classified.root_entry_id
            AND allocated.month = classified.month
        ), 0)::bigint AS amount_paise
      FROM classified
      WHERE classified.amount_paise <> COALESCE((
        SELECT sum(allocated.amount_paise)
        FROM allocated_links AS allocated
        WHERE allocated.root_entry_id = classified.root_entry_id
          AND allocated.month = classified.month
      ), 0)::bigint
    ), filtered_accounts_total AS (
      SELECT COALESCE(sum(amount_paise), 0)::bigint AS amount_paise
      FROM classified
    ), totals AS (
      SELECT COALESCE(vendor_id::text, 'payee:' || payee_key) AS report_key,
        vendor_id, min(CASE WHEN vendor_id IS NULL THEN payee END) AS payee,
        sum(amount_paise)::bigint AS total_paise
      FROM (
        SELECT segments.*, private.expense_payee_key(payee) AS payee_key FROM segments
      ) AS grouped
      GROUP BY COALESCE(vendor_id::text, 'payee:' || payee_key), vendor_id
      HAVING sum(amount_paise) <> 0
    ), grand_total AS (
      SELECT COALESCE(sum(total_paise), 0)::bigint AS amount_paise FROM totals
    ), accounts_total AS (
      SELECT COALESCE((
        public.expense_report(p_society_id, p_from, p_to) ->> 'expense_paise'
      )::bigint, 0) AS amount_paise
    ), quotes AS (
      SELECT quote.vendor_id, sum(quote.amount_paise)::bigint AS amount_paise
      FROM public.vendor_quotes AS quote
      JOIN public.vendor_purchase_requests AS request
        ON request.society_id = quote.society_id
        AND request.id = quote.request_id
      WHERE vendor_enabled AND quote.society_id = p_society_id
        AND request.status = 'approved'
        AND quote.id = request.selected_quote_id
        AND request.decided_at::date BETWEEN p_from AND p_to
      GROUP BY quote.vendor_id
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'vendor_enabled', vendor_enabled,
      'total_expense_paise', grand_total.amount_paise,
      'accounts_expense_paise', accounts_total.amount_paise,
      'reconciles_to_accounts', grand_total.amount_paise =
        (SELECT amount_paise FROM filtered_accounts_total),
      'rows', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', totals.report_key,
          'vendor_id', totals.vendor_id,
          'vendor_name', vendor.name,
          'payee', totals.payee,
          'total_paise', totals.total_paise,
          'share_bp', CASE WHEN grand_total.amount_paise = 0 THEN 0
            ELSE round(totals.total_paise::numeric * 10000 / grand_total.amount_paise)
          END::integer,
          'high_share', grand_total.amount_paise <> 0
            AND totals.total_paise::numeric * 100 / grand_total.amount_paise >= 40,
          'active_months', (
            SELECT count(DISTINCT segment.month) FROM segments AS segment
            WHERE COALESCE(segment.vendor_id::text, 'payee:' ||
              private.expense_payee_key(segment.payee)) = totals.report_key
              AND segment.amount_paise <> 0
          ),
          'average_per_active_month_paise', CASE WHEN (
            SELECT count(DISTINCT segment.month) FROM segments AS segment
            WHERE COALESCE(segment.vendor_id::text, 'payee:' ||
              private.expense_payee_key(segment.payee)) = totals.report_key
              AND segment.amount_paise <> 0
          ) = 0 THEN 0 ELSE (
            totals.total_paise / (
              SELECT count(DISTINCT segment.month) FROM segments AS segment
              WHERE COALESCE(segment.vendor_id::text, 'payee:' ||
                private.expense_payee_key(segment.payee)) = totals.report_key
                AND segment.amount_paise <> 0
            )
          ) END::bigint,
          'months', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'month', by_month.month, 'amount_paise', by_month.amount_paise::bigint
            ) ORDER BY by_month.month)
            FROM (
              SELECT segment.month, sum(segment.amount_paise) AS amount_paise
              FROM segments AS segment
              WHERE COALESCE(segment.vendor_id::text, 'payee:' ||
                private.expense_payee_key(segment.payee)) = totals.report_key
              GROUP BY segment.month
            ) AS by_month
          ), '[]'::jsonb),
          'categories', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'category_id', category.id, 'category_name', category.name,
              'amount_paise', by_category.amount_paise::bigint
            ) ORDER BY lower(category.name))
            FROM (
              SELECT segment.category_id, sum(segment.amount_paise) AS amount_paise
              FROM segments AS segment
              WHERE COALESCE(segment.vendor_id::text, 'payee:' ||
                private.expense_payee_key(segment.payee)) = totals.report_key
              GROUP BY segment.category_id
            ) AS by_category
            JOIN public.expense_categories AS category
              ON category.society_id = p_society_id
              AND category.id = by_category.category_id
          ), '[]'::jsonb),
          'approved_quote_paise', CASE WHEN vendor_enabled
            THEN COALESCE(quotes.amount_paise, 0)::bigint ELSE NULL END
        ) ORDER BY totals.total_paise DESC, lower(COALESCE(vendor.name, totals.payee)))
        FROM totals
        LEFT JOIN public.vendors AS vendor
          ON vendor.society_id = p_society_id AND vendor.id = totals.vendor_id
        LEFT JOIN quotes ON quotes.vendor_id = totals.vendor_id
        CROSS JOIN grand_total
      ), '[]'::jsonb),
      'mapping_suggestions', CASE WHEN vendor_enabled THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'payee', suggestion.payee, 'payee_key', suggestion.payee_key,
          'vendor_id', vendor.id, 'vendor_name', vendor.name
        ) ORDER BY lower(suggestion.payee))
        FROM (
          SELECT DISTINCT classified.payee, classified.payee_key
          FROM classified
          WHERE classified.mapped_vendor_id IS NULL
        ) AS suggestion
        JOIN public.vendors AS vendor
          ON vendor.society_id = p_society_id AND vendor.active IS TRUE
          AND lower(btrim(vendor.name)) = suggestion.payee_key
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'mappings', CASE WHEN vendor_enabled THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', mapping.id, 'payee_key', mapping.payee_key,
          'vendor_id', mapping.vendor_id, 'vendor_name', vendor.name
        ) ORDER BY mapping.payee_key)
        FROM public.expense_payee_vendor_mappings AS mapping
        JOIN public.vendors AS vendor
          ON vendor.society_id = mapping.society_id AND vendor.id = mapping.vendor_id
        WHERE mapping.society_id = p_society_id AND mapping.removed_at IS NULL
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'vendors', CASE WHEN vendor_enabled THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
        FROM public.vendors
        WHERE society_id = p_society_id AND active IS TRUE
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', category.id, 'name', category.name,
          'detail_group', category.detail_group,
          'cost_nature', category.cost_nature
        ) ORDER BY lower(category.name))
        FROM public.expense_categories AS category
        WHERE category.society_id = p_society_id
      ), '[]'::jsonb)
    )
    FROM grand_total
    CROSS JOIN accounts_total
    CROSS JOIN filtered_accounts_total
  );
END;
$$;

CREATE FUNCTION public.expense_savings_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'vendor_enabled', private.module_enabled(p_society_id, 'vendor'),
    'initiatives', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', initiative.id, 'title', initiative.title,
        'description', initiative.description, 'kind', initiative.kind,
        'owner_user_id', initiative.owner_user_id,
        'owner_name', owner.full_name,
        'owner_is_current', CASE WHEN initiative.owner_user_id IS NULL THEN NULL
          ELSE private.expense_staff_current(p_society_id, initiative.owner_user_id) END,
        'category_id', initiative.category_id, 'category_name', category.name,
        'vendor_id', initiative.vendor_id, 'vendor_name', vendor.name,
        'baseline_annual_paise', initiative.baseline_annual_paise,
        'expected_annual_paise', initiative.expected_annual_paise,
        'status', initiative.status, 'version', initiative.version,
        'realised_to_date_paise', COALESCE((
          SELECT sum(evidence.amount_paise)
          FROM public.expense_savings_evidence AS evidence
          WHERE evidence.society_id = p_society_id
            AND evidence.initiative_id = initiative.id
            AND evidence.voided_at IS NULL
        ), 0),
        'updated_at', initiative.updated_at
      ) ORDER BY initiative.updated_at DESC, initiative.id)
      FROM public.expense_savings_initiatives AS initiative
      LEFT JOIN public.profiles AS owner ON owner.id = initiative.owner_user_id
      LEFT JOIN public.expense_categories AS category
        ON category.society_id = p_society_id AND category.id = initiative.category_id
      LEFT JOIN public.vendors AS vendor
        ON vendor.society_id = p_society_id AND vendor.id = initiative.vendor_id
      WHERE initiative.society_id = p_society_id
    ), '[]'::jsonb),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id, 'full_name', profile.full_name
      ) ORDER BY lower(profile.full_name))
      FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.roles && ARRAY['admin', 'committee']::text[]
    ), '[]'::jsonb),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
      FROM public.expense_categories WHERE society_id = p_society_id
    ), '[]'::jsonb),
    'vendors', CASE WHEN private.module_enabled(p_society_id, 'vendor') THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
      FROM public.vendors
      WHERE society_id = p_society_id AND active IS TRUE
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'source_choices', jsonb_build_object(
      'entries', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', entry.id, 'label',
          entry.entry_date || ' · ' ||
            entry.counterparty || ' · Rs. ' ||
            (entry.amount_paise::numeric / 100)::text
        ) ORDER BY entry.entry_date DESC, entry.created_at DESC)
        FROM (
          SELECT * FROM public.expense_book_entries
          WHERE society_id = p_society_id
            AND source = 'expense' AND transfer_pair_id IS NULL
          ORDER BY entry_date DESC, created_at DESC, id
          LIMIT 200
        ) AS entry
      ), '[]'::jsonb),
      'vendor_bills', CASE WHEN private.module_enabled(p_society_id, 'vendor')
        THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', bill.id,
            'label', bill.vendor_name || ' · ' || bill.invoice_number || ' · ' ||
              bill.invoice_date
          ) ORDER BY bill.invoice_date DESC, bill.id)
          FROM (
            SELECT bill.*, vendor.name AS vendor_name
            FROM public.vendor_bills AS bill
            JOIN public.vendors AS vendor
              ON vendor.society_id = bill.society_id AND vendor.id = bill.vendor_id
            WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
            ORDER BY bill.invoice_date DESC, bill.id
            LIMIT 200
          ) AS bill
        ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'vendor_contracts', CASE WHEN private.module_enabled(p_society_id, 'vendor')
        THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', contract.id,
            'label', contract.vendor_name || ' · ' || contract.scope
          ) ORDER BY contract.start_date DESC, contract.id)
          FROM (
            SELECT contract.*, vendor.name AS vendor_name
            FROM public.vendor_contracts AS contract
            JOIN public.vendors AS vendor
              ON vendor.society_id = contract.society_id
              AND vendor.id = contract.vendor_id
            WHERE contract.society_id = p_society_id
              AND contract.terminated_at IS NULL
            ORDER BY contract.start_date DESC, contract.id
            LIMIT 200
          ) AS contract
        ), '[]'::jsonb) ELSE '[]'::jsonb END
    )
  );
END;
$$;

CREATE FUNCTION public.expense_savings_get(
  p_society_id uuid, p_initiative_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  SELECT jsonb_build_object(
    'id', initiative.id, 'title', initiative.title,
    'description', initiative.description, 'kind', initiative.kind,
    'owner_user_id', initiative.owner_user_id, 'owner_name', owner.full_name,
    'owner_is_current', CASE WHEN initiative.owner_user_id IS NULL THEN NULL
      ELSE private.expense_staff_current(p_society_id, initiative.owner_user_id) END,
    'category_id', initiative.category_id, 'category_name', category.name,
    'vendor_id', initiative.vendor_id, 'vendor_name', vendor.name,
    'baseline_annual_paise', initiative.baseline_annual_paise,
    'expected_annual_paise', initiative.expected_annual_paise,
    'status', initiative.status, 'version', initiative.version,
    'created_at', initiative.created_at, 'updated_at', initiative.updated_at,
    'realised_to_date_paise', COALESCE((
      SELECT sum(evidence.amount_paise)
      FROM public.expense_savings_evidence AS evidence
      WHERE evidence.society_id = p_society_id
        AND evidence.initiative_id = initiative.id AND evidence.voided_at IS NULL
    ), 0),
    'status_events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id, 'from_status', event.from_status,
        'to_status', event.to_status, 'reason', event.reason,
        'created_at', event.created_at, 'created_by_name', actor.full_name
      ) ORDER BY event.created_at DESC, event.id)
      FROM public.expense_savings_status_events AS event
      JOIN public.profiles AS actor ON actor.id = event.created_by
      WHERE event.society_id = p_society_id AND event.initiative_id = initiative.id
    ), '[]'::jsonb),
    'evidence', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', evidence.id, 'amount_paise', evidence.amount_paise,
        'evidenced_on', evidence.evidenced_on, 'note', evidence.note,
        'entry_id', evidence.entry_id, 'vendor_bill_id', evidence.vendor_bill_id,
        'vendor_contract_id', evidence.vendor_contract_id,
        'source_label', CASE
          WHEN evidence.entry_id IS NOT NULL THEN (
            SELECT entry.entry_date || ' · ' || entry.counterparty
            FROM public.expense_book_entries AS entry
            WHERE entry.society_id = p_society_id AND entry.id = evidence.entry_id
          )
          WHEN evidence.vendor_bill_id IS NOT NULL THEN (
            SELECT vendor.name || ' · ' || bill.invoice_number
            FROM public.vendor_bills AS bill
            JOIN public.vendors AS vendor
              ON vendor.society_id = bill.society_id AND vendor.id = bill.vendor_id
            WHERE bill.society_id = p_society_id AND bill.id = evidence.vendor_bill_id
          )
          WHEN evidence.vendor_contract_id IS NOT NULL THEN (
            SELECT vendor.name || ' · ' || contract.scope
            FROM public.vendor_contracts AS contract
            JOIN public.vendors AS vendor
              ON vendor.society_id = contract.society_id
              AND vendor.id = contract.vendor_id
            WHERE contract.society_id = p_society_id
              AND contract.id = evidence.vendor_contract_id
          )
        END,
        'file_path', evidence.file_path, 'voided_at', evidence.voided_at,
        'void_reason', evidence.void_reason, 'created_at', evidence.created_at,
        'created_by_name', actor.full_name
      ) ORDER BY evidence.evidenced_on DESC, evidence.created_at DESC)
      FROM public.expense_savings_evidence AS evidence
      JOIN public.profiles AS actor ON actor.id = evidence.created_by
      WHERE evidence.society_id = p_society_id
        AND evidence.initiative_id = initiative.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.expense_savings_initiatives AS initiative
  LEFT JOIN public.profiles AS owner ON owner.id = initiative.owner_user_id
  LEFT JOIN public.expense_categories AS category
    ON category.society_id = p_society_id AND category.id = initiative.category_id
  LEFT JOIN public.vendors AS vendor
    ON vendor.society_id = p_society_id AND vendor.id = initiative.vendor_id
  WHERE initiative.society_id = p_society_id AND initiative.id = p_initiative_id;
  IF result IS NULL THEN
    RAISE EXCEPTION 'Savings initiative not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.expense_savings_save(
  p_society_id uuid, p_initiative_id uuid, p_title text, p_description text,
  p_kind text, p_owner_user_id uuid, p_category_id uuid, p_vendor_id uuid,
  p_baseline_annual_paise bigint, p_expected_annual_paise bigint,
  p_expected_version integer, p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.expense_savings_initiatives;
  previous_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'savings.save', jsonb_build_object(
      'initiative_id', p_initiative_id, 'title', p_title,
      'description', p_description, 'kind', p_kind,
      'owner_user_id', p_owner_user_id, 'category_id', p_category_id,
      'vendor_id', p_vendor_id,
      'baseline_annual_paise', p_baseline_annual_paise,
      'expected_annual_paise', p_expected_annual_paise,
      'expected_version', p_expected_version
    ), p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  IF p_title IS NULL OR p_title <> btrim(p_title) OR char_length(p_title) NOT BETWEEN 1 AND 120
    OR p_description IS NULL OR p_description <> btrim(p_description)
      OR char_length(p_description) NOT BETWEEN 1 AND 4000
    OR p_kind NOT IN (
      'renegotiation', 'energy_saving', 'reduced_consumption',
      'vendor_change', 'process_change', 'other'
    )
    OR p_baseline_annual_paise NOT BETWEEN 0 AND 999999999999999
    OR p_expected_annual_paise NOT BETWEEN 0 AND 999999999999999
  THEN
    RAISE EXCEPTION 'Check the savings initiative.' USING ERRCODE = '22023';
  END IF;
  IF p_owner_user_id IS NOT NULL AND NOT private.expense_staff_current(
    p_society_id, p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Choose an active admin or committee member.'
      USING ERRCODE = '22023';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories
    WHERE society_id = p_society_id AND id = p_category_id
  ) THEN
    RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_vendor_id IS NOT NULL AND (
    NOT private.module_enabled(p_society_id, 'vendor') OR NOT EXISTS (
      SELECT 1 FROM public.vendors
      WHERE society_id = p_society_id AND id = p_vendor_id AND active IS TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Choose an active vendor.' USING ERRCODE = '22023';
  END IF;
  IF p_initiative_id IS NULL THEN
    INSERT INTO public.expense_savings_initiatives (
      society_id, title, description, kind, owner_user_id, category_id, vendor_id,
      baseline_annual_paise, expected_annual_paise, client_request_id,
      created_by, updated_by
    ) VALUES (
      p_society_id, p_title, p_description, p_kind, p_owner_user_id,
      p_category_id, p_vendor_id, p_baseline_annual_paise,
      p_expected_annual_paise, p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO current_row;
  ELSE
    SELECT * INTO current_row FROM public.expense_savings_initiatives
    WHERE society_id = p_society_id AND id = p_initiative_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Savings initiative not found.' USING ERRCODE = 'P0002';
    END IF;
    IF current_row.version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Savings initiative changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.expense_savings_initiatives SET
      title = p_title, description = p_description, kind = p_kind,
      owner_user_id = p_owner_user_id, category_id = p_category_id,
      vendor_id = p_vendor_id, baseline_annual_paise = p_baseline_annual_paise,
      expected_annual_paise = p_expected_annual_paise,
      version = version + 1, updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_initiative_id
    RETURNING * INTO current_row;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_initiative_id IS NULL THEN 'expense.savings.create'
      ELSE 'expense.savings.update' END,
    'expense_savings_initiative', current_row.id,
    jsonb_build_object(
      'title', p_title, 'kind', p_kind, 'status', current_row.status,
      'baseline_annual_paise', p_baseline_annual_paise,
      'expected_annual_paise', p_expected_annual_paise
    ), p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'savings.save', jsonb_build_object(
      'initiative_id', p_initiative_id, 'title', p_title,
      'description', p_description, 'kind', p_kind,
      'owner_user_id', p_owner_user_id, 'category_id', p_category_id,
      'vendor_id', p_vendor_id,
      'baseline_annual_paise', p_baseline_annual_paise,
      'expected_annual_paise', p_expected_annual_paise,
      'expected_version', p_expected_version
    ), p_client_request_id, current_row.id
  );
  RETURN current_row.id;
END;
$$;

CREATE FUNCTION public.expense_savings_status_change(
  p_society_id uuid, p_initiative_id uuid, p_to_status text, p_reason text,
  p_expected_version integer, p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.expense_savings_initiatives;
  previous_id uuid;
  allowed boolean;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'savings.status', jsonb_build_object(
      'initiative_id', p_initiative_id, 'status', p_to_status,
      'reason', p_reason, 'expected_version', p_expected_version
    ), p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  SELECT * INTO current_row FROM public.expense_savings_initiatives
  WHERE society_id = p_society_id AND id = p_initiative_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings initiative not found.' USING ERRCODE = 'P0002';
  END IF;
  IF current_row.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Savings initiative changed. Refresh before changing status.'
      USING ERRCODE = '23505';
  END IF;
  allowed := p_to_status = current_row.status
    OR (
      current_row.status <> 'dropped'
      AND p_to_status IN ('idea', 'approved', 'implementing', 'realised', 'dropped')
    )
    OR (current_row.status = 'dropped' AND p_to_status = 'idea');
  IF NOT allowed THEN
    RAISE EXCEPTION 'That savings status change is not allowed.' USING ERRCODE = '22023';
  END IF;
  IF current_row.status = p_to_status THEN
    PERFORM private.expense_control_request_record(
      p_society_id, 'savings.status', jsonb_build_object(
        'initiative_id', p_initiative_id, 'status', p_to_status,
        'reason', p_reason, 'expected_version', p_expected_version
      ), p_client_request_id, p_initiative_id
    );
    RETURN p_initiative_id;
  END IF;
  IF (p_to_status = 'dropped' OR current_row.status = 'dropped')
    AND (p_reason IS NULL OR btrim(p_reason) = '' OR char_length(p_reason) > 500)
  THEN
    RAISE EXCEPTION 'Give a reason for dropping or restoring the initiative.'
      USING ERRCODE = '22023';
  END IF;
  IF p_to_status = 'realised' AND NOT EXISTS (
    SELECT 1 FROM public.expense_savings_evidence
    WHERE society_id = p_society_id AND initiative_id = p_initiative_id
      AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Add evidence before marking the initiative realised.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.expense_savings_status_events (
    society_id, initiative_id, from_status, to_status, reason,
    created_by, client_request_id
  ) VALUES (
    p_society_id, p_initiative_id, current_row.status, p_to_status,
    nullif(btrim(p_reason), ''), auth.uid(), p_client_request_id
  );
  UPDATE public.expense_savings_initiatives SET
    status = p_to_status, version = version + 1, updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_initiative_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.savings.status_change',
    'expense_savings_initiative', p_initiative_id,
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', p_to_status, 'reason', nullif(btrim(p_reason), '')),
    p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'savings.status', jsonb_build_object(
      'initiative_id', p_initiative_id, 'status', p_to_status,
      'reason', p_reason, 'expected_version', p_expected_version
    ), p_client_request_id, p_initiative_id
  );
  RETURN p_initiative_id;
END;
$$;

CREATE FUNCTION public.expense_savings_evidence_add(
  p_society_id uuid, p_initiative_id uuid, p_amount_paise bigint, p_evidenced_on date,
  p_note text, p_entry_id uuid, p_vendor_bill_id uuid, p_vendor_contract_id uuid,
  p_file_path text, p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  evidence_id uuid;
  previous_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'savings.evidence.add', jsonb_build_object(
      'initiative_id', p_initiative_id, 'amount_paise', p_amount_paise,
      'evidenced_on', p_evidenced_on, 'note', p_note, 'entry_id', p_entry_id,
      'vendor_bill_id', p_vendor_bill_id, 'vendor_contract_id', p_vendor_contract_id,
      'file_path', p_file_path
    ), p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_savings_initiatives
    WHERE society_id = p_society_id AND id = p_initiative_id
  ) THEN
    RAISE EXCEPTION 'Savings initiative not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_amount_paise NOT BETWEEN 1 AND 999999999999999
    OR p_evidenced_on IS NULL OR p_evidenced_on > private.housekeeping_local_date(p_society_id)
    OR p_note IS NULL OR btrim(p_note) = '' OR char_length(p_note) > 2000
    OR (p_entry_id IS NOT NULL)::integer + (p_vendor_bill_id IS NOT NULL)::integer
      + (p_vendor_contract_id IS NOT NULL)::integer > 1
  THEN
    RAISE EXCEPTION 'Check the savings evidence.' USING ERRCODE = '22023';
  END IF;
  IF p_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_book_entries
    WHERE society_id = p_society_id AND id = p_entry_id
  ) THEN RAISE EXCEPTION 'Accounts entry not found.' USING ERRCODE = 'P0002'; END IF;
  IF (p_vendor_bill_id IS NOT NULL OR p_vendor_contract_id IS NOT NULL)
    AND NOT private.module_enabled(p_society_id, 'vendor')
  THEN
    RAISE EXCEPTION 'The Vendor module is not enabled.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.expense_savings_verify_file(
    p_society_id, p_initiative_id, p_file_path
  );
  INSERT INTO public.expense_savings_evidence (
    society_id, initiative_id, amount_paise, evidenced_on, note,
    entry_id, vendor_bill_id, vendor_contract_id, file_path,
    client_request_id, created_by
  ) VALUES (
    p_society_id, p_initiative_id, p_amount_paise, p_evidenced_on, btrim(p_note),
    p_entry_id, p_vendor_bill_id, p_vendor_contract_id, p_file_path,
    p_client_request_id, auth.uid()
  ) RETURNING id INTO evidence_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.savings_evidence.create',
    'expense_savings_evidence', evidence_id,
    jsonb_build_object(
      'initiative_id', p_initiative_id, 'amount_paise', p_amount_paise,
      'evidenced_on', p_evidenced_on, 'file_path', p_file_path
    ), p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'savings.evidence.add', jsonb_build_object(
      'initiative_id', p_initiative_id, 'amount_paise', p_amount_paise,
      'evidenced_on', p_evidenced_on, 'note', p_note, 'entry_id', p_entry_id,
      'vendor_bill_id', p_vendor_bill_id, 'vendor_contract_id', p_vendor_contract_id,
      'file_path', p_file_path
    ), p_client_request_id, evidence_id
  );
  RETURN evidence_id;
END;
$$;

CREATE FUNCTION public.expense_savings_evidence_void(
  p_society_id uuid, p_evidence_id uuid, p_reason text,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.expense_savings_evidence;
  initiative_row public.expense_savings_initiatives;
  previous_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  PERFORM private.expense_control_request_lock(p_society_id, p_client_request_id);
  SELECT private.expense_control_request_result(
    p_society_id, 'savings.evidence.void',
    jsonb_build_object('evidence_id', p_evidence_id, 'reason', p_reason),
    p_client_request_id
  ) INTO previous_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  SELECT * INTO current_row FROM public.expense_savings_evidence
  WHERE society_id = p_society_id AND id = p_evidence_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Savings evidence not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO initiative_row FROM public.expense_savings_initiatives
  WHERE society_id = p_society_id AND id = current_row.initiative_id FOR UPDATE;
  IF current_row.voided_at IS NOT NULL THEN
    PERFORM private.expense_control_request_record(
      p_society_id, 'savings.evidence.void',
      jsonb_build_object('evidence_id', p_evidence_id, 'reason', p_reason),
      p_client_request_id, p_evidence_id
    );
    RETURN p_evidence_id;
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' OR char_length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason for voiding the evidence.'
      USING ERRCODE = '22023';
  END IF;
  IF initiative_row.status = 'realised' AND NOT EXISTS (
    SELECT 1 FROM public.expense_savings_evidence AS evidence
    WHERE evidence.society_id = p_society_id
      AND evidence.initiative_id = current_row.initiative_id
      AND evidence.id <> p_evidence_id AND evidence.voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Change the initiative from Realised before voiding its last evidence.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.expense_savings_evidence SET
    voided_at = clock_timestamp(), voided_by = auth.uid(),
    void_reason = btrim(p_reason)
  WHERE society_id = p_society_id AND id = p_evidence_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.savings_evidence.void',
    'expense_savings_evidence', p_evidence_id,
    jsonb_build_object('reason', btrim(p_reason)), p_request_trace
  );
  PERFORM private.expense_control_request_record(
    p_society_id, 'savings.evidence.void',
    jsonb_build_object('evidence_id', p_evidence_id, 'reason', p_reason),
    p_client_request_id, p_evidence_id
  );
  RETURN p_evidence_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_workspace(uuid),
  public.expense_category_details_save(uuid, uuid, text, text, uuid, text, integer, uuid, text),
  public.expense_payee_mapping_save(uuid, text, uuid, uuid, text),
  public.expense_payee_mapping_remove(uuid, uuid, text, uuid, text),
  public.expense_vendor_spend_report(uuid, date, date, uuid, text, text),
  public.expense_savings_list(uuid),
  public.expense_savings_get(uuid, uuid),
  public.expense_savings_save(
    uuid, uuid, text, text, text, uuid, uuid, uuid, bigint, bigint, integer, uuid, text
  ),
  public.expense_savings_status_change(
    uuid, uuid, text, text, integer, uuid, text
  ),
  public.expense_savings_evidence_add(
    uuid, uuid, bigint, date, text, uuid, uuid, uuid, text, uuid, text
  ),
  public.expense_savings_evidence_void(uuid, uuid, text, uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.expense_workspace(uuid),
  public.expense_vendor_spend_report(uuid, date, date, uuid, text, text),
  public.expense_savings_list(uuid),
  public.expense_savings_get(uuid, uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.expense_category_details_save(uuid, uuid, text, text, uuid, text, integer, uuid, text),
  public.expense_payee_mapping_save(uuid, text, uuid, uuid, text),
  public.expense_payee_mapping_remove(uuid, uuid, text, uuid, text),
  public.expense_savings_save(
    uuid, uuid, text, text, text, uuid, uuid, uuid, bigint, bigint, integer, uuid, text
  ),
  public.expense_savings_status_change(
    uuid, uuid, text, text, integer, uuid, text
  ),
  public.expense_savings_evidence_add(
    uuid, uuid, bigint, date, text, uuid, uuid, uuid, text, uuid, text
  ),
  public.expense_savings_evidence_void(uuid, uuid, text, uuid, text)
TO authenticated;
