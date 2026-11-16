-- Vendor directory, private vendor files, ratings, purchase requests, quotes and approvals.
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  category text NOT NULL,
  contact_person text,
  phone text,
  email text,
  gstin text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT vendors_name_check CHECK (char_length(name) BETWEEN 1 AND 120 AND name = btrim(name)),
  CONSTRAINT vendors_category_check
    CHECK (char_length(category) BETWEEN 1 AND 60 AND category = btrim(category)),
  CONSTRAINT vendors_contact_person_check CHECK (contact_person IS NULL OR (
    char_length(contact_person) BETWEEN 1 AND 120 AND contact_person = btrim(contact_person)
  )),
  CONSTRAINT vendors_phone_check CHECK (phone IS NULL OR phone ~ '^\+?[0-9][0-9 -]{4,18}[0-9]$'),
  CONSTRAINT vendors_email_check CHECK (email IS NULL OR (
    char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )),
  CONSTRAINT vendors_gstin_check
    CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT vendors_notes_check
    CHECK (notes IS NULL OR (char_length(notes) BETWEEN 1 AND 1000 AND notes = btrim(notes))),
  CONSTRAINT vendors_version_check CHECK (version >= 1),
  CONSTRAINT vendors_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT vendors_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX vendors_name_key ON public.vendors (society_id, lower(name));
CREATE INDEX vendors_created_by_idx ON public.vendors (created_by);
CREATE INDEX vendors_updated_by_idx ON public.vendors (updated_by);

CREATE TABLE public.vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL,
  title text NOT NULL,
  path text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT vendor_documents_title_check
    CHECK (char_length(title) BETWEEN 1 AND 120 AND title = btrim(title)),
  CONSTRAINT vendor_documents_path_check CHECK (char_length(path) BETWEEN 1 AND 300),
  CONSTRAINT vendor_documents_type_check
    CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT vendor_documents_size_check CHECK (size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT vendor_documents_archive_check CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CONSTRAINT vendor_documents_vendor_same_society_fkey
    FOREIGN KEY (society_id, vendor_id) REFERENCES public.vendors (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_documents_path_key UNIQUE (path),
  CONSTRAINT vendor_documents_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT vendor_documents_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX vendor_documents_vendor_idx ON public.vendor_documents (society_id, vendor_id, created_at);
CREATE INDEX vendor_documents_created_by_idx ON public.vendor_documents (created_by);
CREATE INDEX vendor_documents_archived_by_idx ON public.vendor_documents (archived_by);

CREATE TABLE public.vendor_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL,
  rater_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  stars smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_ratings_stars_check CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT vendor_ratings_comment_check
    CHECK (comment IS NULL OR (char_length(comment) BETWEEN 1 AND 500 AND comment = btrim(comment))),
  CONSTRAINT vendor_ratings_vendor_same_society_fkey
    FOREIGN KEY (society_id, vendor_id) REFERENCES public.vendors (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_ratings_one_per_rater_key UNIQUE (society_id, vendor_id, rater_id)
);
CREATE INDEX vendor_ratings_rater_idx ON public.vendor_ratings (rater_id);

CREATE TABLE public.vendor_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  category text,
  estimated_amount_paise bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  selected_quote_id uuid,
  quote_override_reason text,
  quote_override_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  quote_override_at timestamptz,
  quotes_required smallint,
  approvals_required smallint,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  rejection_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancel_reason text,
  expense_id uuid,
  expense_draft_status text,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT vendor_purchase_requests_title_check
    CHECK (char_length(title) BETWEEN 1 AND 120 AND title = btrim(title)),
  CONSTRAINT vendor_purchase_requests_description_check CHECK (description IS NULL OR (
    char_length(description) BETWEEN 1 AND 2000 AND description = btrim(description)
  )),
  CONSTRAINT vendor_purchase_requests_category_check
    CHECK (category IS NULL OR (char_length(category) BETWEEN 1 AND 60 AND category = btrim(category))),
  CONSTRAINT vendor_purchase_requests_amount_check
    CHECK (estimated_amount_paise BETWEEN 1 AND 999999999999999),
  CONSTRAINT vendor_purchase_requests_status_check
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT vendor_purchase_requests_override_check CHECK (
    (quote_override_reason IS NULL AND quote_override_by IS NULL AND quote_override_at IS NULL)
    OR (quote_override_reason IS NOT NULL AND quote_override_by IS NOT NULL
      AND quote_override_at IS NOT NULL AND char_length(quote_override_reason) BETWEEN 5 AND 500
      AND quote_override_reason = btrim(quote_override_reason))
  ),
  CONSTRAINT vendor_purchase_requests_rules_check CHECK (
    (quotes_required IS NULL OR quotes_required BETWEEN 1 AND 5)
    AND (approvals_required IS NULL OR approvals_required BETWEEN 0 AND 5)
  ),
  CONSTRAINT vendor_purchase_requests_reason_check CHECK (
    (rejection_reason IS NULL OR (char_length(rejection_reason) BETWEEN 1 AND 500
      AND rejection_reason = btrim(rejection_reason)))
    AND (cancel_reason IS NULL OR (char_length(cancel_reason) BETWEEN 1 AND 500
      AND cancel_reason = btrim(cancel_reason)))
  ),
  -- Each status carries exactly the timestamps and actors of the steps that led to it.
  CONSTRAINT vendor_purchase_requests_lifecycle_check CHECK (
    ((submitted_at IS NULL) = (submitted_by IS NULL))
    AND ((decided_at IS NULL) = (decided_by IS NULL))
    AND ((cancelled_at IS NULL) = (cancelled_by IS NULL))
    AND (
      (status = 'draft' AND submitted_at IS NULL AND decided_at IS NULL AND cancelled_at IS NULL
        AND quotes_required IS NULL AND approvals_required IS NULL)
      OR (status = 'submitted' AND submitted_at IS NOT NULL AND decided_at IS NULL
        AND cancelled_at IS NULL AND selected_quote_id IS NOT NULL
        AND quotes_required IS NOT NULL AND approvals_required IS NOT NULL)
      OR (status = 'approved' AND submitted_at IS NOT NULL AND decided_at IS NOT NULL
        AND cancelled_at IS NULL AND rejection_reason IS NULL AND selected_quote_id IS NOT NULL)
      OR (status = 'rejected' AND submitted_at IS NOT NULL AND decided_at IS NOT NULL
        AND cancelled_at IS NULL AND rejection_reason IS NOT NULL)
      OR (status = 'cancelled' AND decided_at IS NULL AND cancelled_at IS NOT NULL)
    )
    AND (rejection_reason IS NULL OR status = 'rejected')
    AND (cancel_reason IS NULL OR status = 'cancelled')
    AND (expense_id IS NULL OR status = 'approved')
    AND (expense_draft_status IS NULL OR status = 'approved')
  ),
  CONSTRAINT vendor_purchase_requests_expense_status_check CHECK (
    expense_draft_status IS NULL OR expense_draft_status IN (
      'created', 'skipped_disabled', 'skipped_no_account', 'skipped_no_category',
      'skipped_month_closed'
    )
  ),
  CONSTRAINT vendor_purchase_requests_expense_link_check
    CHECK ((expense_id IS NOT NULL) = (expense_draft_status IS NOT DISTINCT FROM 'created')),
  CONSTRAINT vendor_purchase_requests_expense_same_society_fkey
    FOREIGN KEY (society_id, expense_id) REFERENCES public.expenses (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_purchase_requests_version_check CHECK (version >= 1),
  CONSTRAINT vendor_purchase_requests_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT vendor_purchase_requests_actor_request_key
    UNIQUE (society_id, created_by, client_request_id)
);
-- One expense draft per purchase request, and never one expense for two requests.
CREATE UNIQUE INDEX vendor_purchase_requests_expense_key
  ON public.vendor_purchase_requests (society_id, expense_id);
CREATE INDEX vendor_purchase_requests_status_idx
  ON public.vendor_purchase_requests (society_id, status, created_at DESC);
CREATE INDEX vendor_purchase_requests_selected_quote_idx
  ON public.vendor_purchase_requests (society_id, id, selected_quote_id);
CREATE INDEX vendor_purchase_requests_created_by_idx ON public.vendor_purchase_requests (created_by);
CREATE INDEX vendor_purchase_requests_updated_by_idx ON public.vendor_purchase_requests (updated_by);
CREATE INDEX vendor_purchase_requests_override_by_idx
  ON public.vendor_purchase_requests (quote_override_by);
CREATE INDEX vendor_purchase_requests_submitted_by_idx ON public.vendor_purchase_requests (submitted_by);
CREATE INDEX vendor_purchase_requests_decided_by_idx ON public.vendor_purchase_requests (decided_by);
CREATE INDEX vendor_purchase_requests_cancelled_by_idx ON public.vendor_purchase_requests (cancelled_by);

CREATE TABLE public.vendor_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  amount_paise bigint NOT NULL,
  note text,
  file_path text,
  file_content_type text,
  file_size_bytes integer,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT vendor_quotes_amount_check CHECK (amount_paise BETWEEN 1 AND 999999999999999),
  CONSTRAINT vendor_quotes_note_check
    CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 500 AND note = btrim(note))),
  CONSTRAINT vendor_quotes_file_check CHECK (
    (file_path IS NULL AND file_content_type IS NULL AND file_size_bytes IS NULL)
    OR (char_length(file_path) BETWEEN 1 AND 300
      AND file_content_type IN ('application/pdf', 'image/jpeg', 'image/png')
      AND file_size_bytes BETWEEN 1 AND 5242880)
  ),
  CONSTRAINT vendor_quotes_removed_check CHECK ((removed_at IS NULL) = (removed_by IS NULL)),
  CONSTRAINT vendor_quotes_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.vendor_purchase_requests (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_quotes_vendor_same_society_fkey
    FOREIGN KEY (society_id, vendor_id) REFERENCES public.vendors (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_quotes_file_path_key UNIQUE (file_path),
  CONSTRAINT vendor_quotes_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT vendor_quotes_request_id_key UNIQUE (society_id, request_id, id),
  CONSTRAINT vendor_quotes_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
-- Quotes count by distinct vendor, so a vendor can hold one live quote per request.
CREATE UNIQUE INDEX vendor_quotes_live_vendor_key
  ON public.vendor_quotes (society_id, request_id, vendor_id) WHERE removed_at IS NULL;
CREATE INDEX vendor_quotes_vendor_idx ON public.vendor_quotes (society_id, vendor_id);
CREATE INDEX vendor_quotes_created_by_idx ON public.vendor_quotes (created_by);
CREATE INDEX vendor_quotes_removed_by_idx ON public.vendor_quotes (removed_by);

ALTER TABLE public.vendor_purchase_requests
  ADD CONSTRAINT vendor_purchase_requests_selected_quote_fkey
  FOREIGN KEY (society_id, id, selected_quote_id)
  REFERENCES public.vendor_quotes (society_id, request_id, id) ON DELETE RESTRICT;

CREATE TABLE public.vendor_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  approver_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  approver_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_approvals_role_check CHECK (approver_role IN ('admin', 'committee')),
  CONSTRAINT vendor_approvals_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.vendor_purchase_requests (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT vendor_approvals_once_key UNIQUE (society_id, request_id, approver_id)
);
CREATE INDEX vendor_approvals_approver_idx ON public.vendor_approvals (approver_id);

-- Whoever raised, submitted or overrode the quote rule on a request can never approve it.
CREATE FUNCTION private.vendor_approval_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vendor_purchase_requests
    WHERE society_id = NEW.society_id AND id = NEW.request_id
      AND NEW.approver_id IN (created_by, submitted_by, quote_override_by)
  ) THEN
    RAISE EXCEPTION 'Whoever raised, submitted or overrode a request cannot approve it.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_approval_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER vendor_approvals_guard BEFORE INSERT ON public.vendor_approvals
  FOR EACH ROW EXECUTE FUNCTION private.vendor_approval_guard();
CREATE TRIGGER vendor_approvals_append_only BEFORE UPDATE OR DELETE ON public.vendor_approvals
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TRIGGER vendors_no_delete BEFORE DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_documents_no_delete BEFORE DELETE ON public.vendor_documents
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_ratings_no_delete BEFORE DELETE ON public.vendor_ratings
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_purchase_requests_no_delete BEFORE DELETE ON public.vendor_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_quotes_no_delete BEFORE DELETE ON public.vendor_quotes
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendors_no_truncate BEFORE TRUNCATE ON public.vendors
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_documents_no_truncate BEFORE TRUNCATE ON public.vendor_documents
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_ratings_no_truncate BEFORE TRUNCATE ON public.vendor_ratings
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_purchase_requests_no_truncate BEFORE TRUNCATE ON public.vendor_purchase_requests
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_quotes_no_truncate BEFORE TRUNCATE ON public.vendor_quotes
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER vendor_approvals_no_truncate BEFORE TRUNCATE ON public.vendor_approvals
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendors, public.vendor_documents, public.vendor_ratings,
  public.vendor_purchase_requests, public.vendor_quotes, public.vendor_approvals
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY vendors_no_direct_access ON public.vendors
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY vendor_documents_no_direct_access ON public.vendor_documents
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY vendor_ratings_no_direct_access ON public.vendor_ratings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY vendor_purchase_requests_no_direct_access ON public.vendor_purchase_requests
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY vendor_quotes_no_direct_access ON public.vendor_quotes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY vendor_approvals_no_direct_access ON public.vendor_approvals
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.vendor_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'vendor')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Vendor access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.vendor_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.vendor_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.vendor_authorize(p_society_id, p_roles, true);
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_write_begin(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.vendor_actor_role(p_society_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'system'
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    ELSE 'committee' END
$$;
REVOKE ALL ON FUNCTION private.vendor_actor_role(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.vendor_audit(
  p_society_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(), private.vendor_actor_role(p_society_id),
    'vendor.' || p_action, p_entity_type, p_entity_id::text, p_after, p_reason, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_audit(uuid, text, text, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.vendor_settings(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'quote_threshold_paise', COALESCE((config.settings ->> 'quote_threshold_paise')::bigint, 2500000),
    'quotes_above_threshold', COALESCE((config.settings ->> 'quotes_above_threshold')::integer, 3),
    'approvals_required', COALESCE((config.settings ->> 'approvals_required')::integer, 1)
  )
  FROM (SELECT 1) AS one
  LEFT JOIN public.module_configs AS config
    ON config.society_id = p_society_id AND config.module_key = 'vendor'
$$;
REVOKE ALL ON FUNCTION private.vendor_settings(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.vendor_clean_text(p_value text, p_max integer, p_label text, p_required boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  clean text := NULLIF(btrim(COALESCE(p_value, '')), '');
BEGIN
  IF (clean IS NULL AND p_required) OR char_length(clean) > p_max THEN
    RAISE EXCEPTION 'Enter % up to % characters.', p_label, p_max USING ERRCODE = '22023';
  END IF;
  RETURN clean;
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_clean_text(text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- Private vendor documents and quote files: <society>/vendors/<uploader>/<uuid>.<ext>.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vendor-files', 'vendor-files', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']);

-- Uploads: administrators and committee members into their own folder. Reads: an
-- attached file whose download was audited in the last five minutes, or the uploader's
-- own file before it is attached.
CREATE FUNCTION private.vendor_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  uploader_id uuid;
  attached_ids text[];
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/vendors/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$'
  ) OR auth.uid() IS NULL THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  uploader_id := split_part(p_path, '/', 3)::uuid;
  IF NOT private.module_enabled(target_society_id, 'vendor')
    OR NOT private.has_role(target_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived'
    )
  THEN RETURN false; END IF;
  SELECT array_agg(id::text) INTO attached_ids FROM (
    SELECT id FROM public.vendor_documents WHERE society_id = target_society_id AND path = p_path
    UNION ALL
    SELECT id FROM public.vendor_quotes WHERE society_id = target_society_id AND file_path = p_path
  ) AS attached;
  IF p_write THEN
    RETURN uploader_id = auth.uid() AND attached_ids IS NULL
      AND private.society_writable(target_society_id);
  END IF;
  IF attached_ids IS NULL THEN RETURN uploader_id = auth.uid(); END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.society_id = target_society_id AND audit.action = 'vendor.file.download'
      AND audit.entity_id = ANY(attached_ids) AND audit.actor_id = auth.uid()
      AND audit.created_at > clock_timestamp() - interval '5 minutes'
  );
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vendor_file_access(text, boolean) TO authenticated;
CREATE POLICY vendor_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-files' AND private.vendor_file_access(name, false));
CREATE POLICY vendor_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-files' AND private.vendor_file_access(name, true));

-- Validate the caller's fresh, unattached upload before a row points at it.
CREATE FUNCTION private.vendor_uploaded_file(p_society_id uuid, p_path text)
RETURNS TABLE (content_type text, size_bytes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  object_metadata jsonb;
BEGIN
  IF p_path IS NULL OR split_part(p_path, '/', 1) <> p_society_id::text
    OR NOT private.vendor_file_access(p_path, true)
  THEN
    RAISE EXCEPTION 'The uploaded file is not available.' USING ERRCODE = '22023';
  END IF;
  SELECT object.metadata INTO object_metadata FROM storage.objects AS object
    WHERE object.bucket_id = 'vendor-files' AND object.name = p_path
      AND object.created_at > clock_timestamp() - interval '24 hours';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Uploaded file not found or the upload expired. Upload it again.'
      USING ERRCODE = 'P0002';
  END IF;
  content_type := object_metadata ->> 'mimetype';
  IF COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'The uploaded file size is invalid.' USING ERRCODE = '22023';
  END IF;
  size_bytes := (object_metadata ->> 'size')::integer;
  IF size_bytes NOT BETWEEN 1 AND 5242880 OR content_type IS NULL OR NOT (
    (content_type = 'application/pdf' AND right(p_path, 4) = '.pdf')
    OR (content_type = 'image/jpeg' AND right(p_path, 4) = '.jpg')
    OR (content_type = 'image/png' AND right(p_path, 4) = '.png')
  ) THEN
    RAISE EXCEPTION 'Use a PDF, JPG or PNG up to 5 MiB.' USING ERRCODE = '22023';
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION private.vendor_uploaded_file(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.vendor_settings_update(
  p_society_id uuid, p_quote_threshold_paise bigint, p_quotes_above_threshold integer,
  p_approvals_required integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  next_settings jsonb;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_quote_threshold_paise IS NULL OR p_quote_threshold_paise NOT BETWEEN 0 AND 100000000000
    OR p_quotes_above_threshold IS NULL OR p_quotes_above_threshold NOT BETWEEN 1 AND 5
    OR p_approvals_required IS NULL OR p_approvals_required NOT BETWEEN 0 AND 5
  THEN
    RAISE EXCEPTION 'Use a threshold up to ₹100 crore, 1 to 5 quotes and 0 to 5 approvals.'
      USING ERRCODE = '22023';
  END IF;
  next_settings := jsonb_build_object(
    'quote_threshold_paise', p_quote_threshold_paise,
    'quotes_above_threshold', p_quotes_above_threshold,
    'approvals_required', p_approvals_required
  );
  UPDATE public.module_configs
  SET settings = next_settings, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'vendor';
  PERFORM private.vendor_audit(p_society_id, 'settings.update', 'module', NULL, next_settings,
    NULL, p_request_id);
END;
$$;

CREATE FUNCTION public.vendor_save(
  p_society_id uuid, p_vendor_id uuid, p_name text, p_category text, p_contact_person text,
  p_phone text, p_email text, p_gstin text, p_notes text, p_expected_version integer,
  p_client_request_id uuid, p_request_id text
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
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  clean_name := private.vendor_clean_text(p_name, 120, 'a vendor name', true);
  clean_category := private.vendor_clean_text(p_category, 60, 'a category', true);
  clean_contact := private.vendor_clean_text(p_contact_person, 120, 'a contact person', false);
  clean_phone := private.vendor_clean_text(p_phone, 20, 'a phone number', false);
  clean_email := lower(private.vendor_clean_text(p_email, 254, 'an email', false));
  clean_gstin := upper(private.vendor_clean_text(p_gstin, 15, 'a GST number', false));
  clean_notes := private.vendor_clean_text(p_notes, 1000, 'notes', false);
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
      client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, clean_name, clean_category, clean_contact, clean_phone, clean_email,
      clean_gstin, clean_notes, p_client_request_id, auth.uid(), auth.uid()
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
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = vendor.id RETURNING * INTO vendor;
  PERFORM private.vendor_audit(p_society_id, 'vendor.update', 'vendor', vendor.id,
    jsonb_build_object('name', vendor.name, 'category', vendor.category,
      'gstin', vendor.gstin, 'version', vendor.version), NULL, p_request_id);
  RETURN vendor.id;
END;
$$;

CREATE FUNCTION public.vendor_set_active(
  p_society_id uuid, p_vendor_id uuid, p_active boolean, p_expected_version integer,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vendor public.vendors;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Choose active or inactive.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO vendor FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR vendor.version <> p_expected_version THEN
    RAISE EXCEPTION 'This vendor changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF vendor.active = p_active THEN RETURN; END IF;
  UPDATE public.vendors
  SET active = p_active, version = version + 1, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE id = vendor.id;
  PERFORM private.vendor_audit(p_society_id,
    CASE WHEN p_active THEN 'vendor.activate' ELSE 'vendor.deactivate' END,
    'vendor', vendor.id, jsonb_build_object('name', vendor.name, 'active', p_active),
    NULL, p_request_id);
END;
$$;

CREATE FUNCTION public.vendor_document_add(
  p_society_id uuid, p_vendor_id uuid, p_title text, p_path text,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.vendor_documents;
  clean_title text;
  file_type text;
  file_size integer;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  clean_title := private.vendor_clean_text(p_title, 120, 'a document title', true);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO document FROM public.vendor_documents
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN document.id; END IF;
  PERFORM 1 FROM public.vendors WHERE society_id = p_society_id AND id = p_vendor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT uploaded.content_type, uploaded.size_bytes INTO file_type, file_size
    FROM private.vendor_uploaded_file(p_society_id, p_path) AS uploaded;
  INSERT INTO public.vendor_documents (
    society_id, vendor_id, title, path, content_type, size_bytes, client_request_id, created_by
  ) VALUES (
    p_society_id, p_vendor_id, clean_title, p_path, file_type, file_size, p_client_request_id,
    auth.uid()
  ) RETURNING * INTO document;
  PERFORM private.vendor_audit(p_society_id, 'document.add', 'vendor_document', document.id,
    jsonb_build_object('vendor_id', p_vendor_id, 'title', clean_title,
      'content_type', file_type, 'size_bytes', file_size), NULL, p_request_id);
  RETURN document.id;
END;
$$;

CREATE FUNCTION public.vendor_document_archive(
  p_society_id uuid, p_document_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.vendor_documents;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO document FROM public.vendor_documents
    WHERE society_id = p_society_id AND id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;
  IF document.archived_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.vendor_documents
  SET archived_at = clock_timestamp(), archived_by = auth.uid()
  WHERE id = document.id;
  PERFORM private.vendor_audit(p_society_id, 'document.archive', 'vendor_document', document.id,
    jsonb_build_object('vendor_id', document.vendor_id, 'title', document.title), NULL,
    p_request_id);
END;
$$;

-- Issuing a file link is audited; the storage read policy requires this audit row.
CREATE FUNCTION public.vendor_file_issue(p_society_id uuid, p_path text, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  entity_kind text;
  entity uuid;
  file_name text;
  file_type text;
BEGIN
  PERFORM private.vendor_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT 'vendor_document', document.id, document.title, document.content_type
    INTO entity_kind, entity, file_name, file_type
    FROM public.vendor_documents AS document
    WHERE document.society_id = p_society_id AND document.path = p_path;
  IF NOT FOUND THEN
    SELECT 'vendor_quote', quote.id, 'Quote from ' || vendor.name, quote.file_content_type
      INTO entity_kind, entity, file_name, file_type
      FROM public.vendor_quotes AS quote
      JOIN public.vendors AS vendor
        ON vendor.society_id = quote.society_id AND vendor.id = quote.vendor_id
      WHERE quote.society_id = p_society_id AND quote.file_path = p_path;
  END IF;
  IF entity IS NULL THEN RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.vendor_audit(p_society_id, 'file.download', entity_kind, entity,
    jsonb_build_object('path', p_path), NULL, p_request_id);
  RETURN jsonb_build_object(
    'path', p_path,
    'file_name', left(regexp_replace(file_name, '[^A-Za-z0-9 ._-]', '', 'g'), 100)
      || CASE file_type WHEN 'application/pdf' THEN '.pdf' WHEN 'image/png' THEN '.png' ELSE '.jpg' END,
    'content_type', file_type
  );
END;
$$;

CREATE FUNCTION public.vendor_rating_save(
  p_society_id uuid, p_vendor_id uuid, p_stars integer, p_comment text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_comment text;
BEGIN
  PERFORM private.vendor_write_begin(p_society_id, ARRAY['admin', 'committee']::text[]);
  clean_comment := private.vendor_clean_text(p_comment, 500, 'a comment', false);
  IF p_stars IS NULL OR p_stars NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Choose 1 to 5 stars.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.vendors WHERE society_id = p_society_id AND id = p_vendor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found.' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.vendor_ratings (society_id, vendor_id, rater_id, stars, comment)
  VALUES (p_society_id, p_vendor_id, auth.uid(), p_stars, clean_comment)
  ON CONFLICT (society_id, vendor_id, rater_id) DO UPDATE
    SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, updated_at = clock_timestamp();
  PERFORM private.vendor_audit(p_society_id, 'rating.save', 'vendor', p_vendor_id,
    jsonb_build_object('stars', p_stars, 'has_comment', clean_comment IS NOT NULL), NULL,
    p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_settings_update(uuid, bigint, integer, integer, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_save(uuid, uuid, text, text, text, text, text, text, text, integer, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_set_active(uuid, uuid, boolean, integer, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_document_add(uuid, uuid, text, text, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_document_archive(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_file_issue(uuid, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.vendor_rating_save(uuid, uuid, integer, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_settings_update(uuid, bigint, integer, integer, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_save(uuid, uuid, text, text, text, text, text, text, text, integer, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_set_active(uuid, uuid, boolean, integer, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_document_add(uuid, uuid, text, text, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_document_archive(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_file_issue(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_rating_save(uuid, uuid, integer, text, text)
  TO authenticated;

-- List vendor uploads that were never attached within the 24-hour upload window.
CREATE FUNCTION public.vendor_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  RETURN QUERY
    SELECT 'vendor-files'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'vendor-files'
      AND object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.vendor_documents AS document WHERE document.path = object.name)
      AND NOT EXISTS (SELECT 1 FROM public.vendor_quotes AS quote WHERE quote.file_path = object.name)
    ORDER BY object.name;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_retention_files_list(date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_retention_files_list(date) TO service_role;
