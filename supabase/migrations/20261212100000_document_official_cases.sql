-- Add private-from-creation official case evidence and the admin-only case log.
ALTER TABLE public.document_folders
  DROP CONSTRAINT document_folders_audience_check,
  ADD CONSTRAINT document_folders_audience_check CHECK (
    audience IN ('all_residents', 'owners_only', 'committee_admins', 'admin_only')
  ),
  ADD COLUMN case_evidence_eligible boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.document_in_folder_audience(
  p_society_id uuid, p_user_id uuid, p_audience text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_audience
    WHEN 'all_residents' THEN private.document_user_has_role(
      p_society_id, p_user_id, ARRAY['resident']::text[]
    )
    WHEN 'owners_only' THEN private.document_user_is_owner(p_society_id, p_user_id)
    WHEN 'committee_admins' THEN private.document_user_has_role(
      p_society_id, p_user_id, ARRAY['admin', 'committee']::text[]
    )
    WHEN 'admin_only' THEN private.document_user_has_role(
      p_society_id, p_user_id, ARRAY['admin']::text[]
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION private.document_user_can_see_folder(
  p_society_id uuid, p_user_id uuid, p_folder_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.document_available(p_society_id) AND EXISTS (
    SELECT 1 FROM public.document_folders folder
    WHERE folder.society_id = p_society_id
      AND folder.id = p_folder_id
      AND (
        (
          folder.audience = 'admin_only'
          AND private.document_user_has_role(
            p_society_id, p_user_id, ARRAY['admin']::text[]
          )
        )
        OR (
          folder.audience <> 'admin_only'
          AND (
            private.document_user_is_staff(p_society_id, p_user_id)
            OR (
              folder.archived_at IS NULL
              AND private.document_in_folder_audience(
                p_society_id, p_user_id, folder.audience
              )
            )
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.document_user_can_see(
  p_society_id uuid, p_user_id uuid, p_document_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.document_available(p_society_id) AND EXISTS (
    SELECT 1
    FROM public.documents document
    LEFT JOIN public.document_folders folder
      ON folder.society_id = document.society_id
      AND folder.id = document.folder_id
    WHERE document.society_id = p_society_id
      AND document.id = p_document_id
      AND (
        (
          document.folder_id IS NOT NULL
          AND private.document_user_can_see_folder(
            p_society_id, p_user_id, document.folder_id
          )
          AND (
            document.archived_at IS NULL
            OR private.document_user_is_staff(p_society_id, p_user_id)
          )
        )
        OR (
          document.unit_id IS NOT NULL
          AND (
            private.document_user_is_staff(p_society_id, p_user_id)
            OR (
              document.archived_at IS NULL
              AND private.document_in_unit_audience(
                p_society_id, p_user_id, document.unit_id, document.unit_audience
              )
            )
          )
        )
      )
      AND (
        document.unit_id IS NOT NULL
        OR document.archived_at IS NULL
        OR private.document_user_is_staff(p_society_id, p_user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.document_folder_save(
  p_society_id uuid,
  p_folder_id uuid,
  p_name text,
  p_audience text,
  p_expected_version integer,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  folder public.document_folders;
  clean_name text;
  previous_audience text;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  clean_name := private.document_clean_text(p_name, 80, 'folder name', true);
  IF p_audience IS NULL OR p_audience NOT IN (
    'all_residents', 'owners_only', 'committee_admins', 'admin_only'
  ) THEN
    RAISE EXCEPTION 'Choose who can see this folder.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'document_folders:' || p_society_id::text, 0
  ));
  IF EXISTS (
    SELECT 1
    FROM public.document_folders
    WHERE society_id = p_society_id
      AND archived_at IS NULL
      AND lower(name) = lower(clean_name)
      AND id IS DISTINCT FROM p_folder_id
  ) THEN
    RAISE EXCEPTION 'A folder with this name already exists.' USING ERRCODE = '23514';
  END IF;
  IF p_folder_id IS NULL THEN
    IF (
      SELECT count(*)
      FROM public.document_folders
      WHERE society_id = p_society_id AND archived_at IS NULL
    ) >= 50 THEN
      RAISE EXCEPTION 'A society can have up to 50 active folders. Archive one first.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.document_folders (
      society_id, name, audience, case_evidence_eligible,
      sort_order, created_by, updated_by
    ) VALUES (
      p_society_id,
      clean_name,
      p_audience,
      p_audience = 'admin_only',
      least(coalesce((
        SELECT max(sort_order)
        FROM public.document_folders
        WHERE society_id = p_society_id
      ), 0) + 10, 100000),
      auth.uid(),
      auth.uid()
    ) RETURNING * INTO folder;
    PERFORM private.document_audit(
      p_society_id, 'document.folder_create', 'document_folder', folder.id,
      jsonb_build_object(
        'name', folder.name,
        'audience', folder.audience,
        'case_evidence_eligible', folder.case_evidence_eligible
      ),
      p_request_id
    );
  ELSE
    SELECT * INTO folder
    FROM public.document_folders
    WHERE society_id = p_society_id AND id = p_folder_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Folder not found.' USING ERRCODE = 'P0002';
    END IF;
    PERFORM private.document_assert_version(
      folder.version, p_expected_version, 'folder'
    );
    IF folder.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Restore this folder before editing it.'
        USING ERRCODE = '23514';
    END IF;
    IF folder.audience = 'admin_only'
      AND p_audience <> 'admin_only'
      AND EXISTS (
        SELECT 1
        FROM public.document_official_case_evidence evidence
        JOIN public.document_versions version
          ON version.society_id = evidence.society_id
          AND version.id = evidence.version_id
        JOIN public.documents document
          ON document.society_id = version.society_id
          AND document.id = version.document_id
        WHERE document.society_id = p_society_id
          AND document.folder_id = folder.id
      )
    THEN
      RAISE EXCEPTION 'A case-evidence folder cannot be widened.'
        USING ERRCODE = '23514';
    END IF;
    previous_audience := folder.audience;
    UPDATE public.document_folders
    SET name = clean_name,
      audience = p_audience,
      case_evidence_eligible =
        CASE WHEN p_audience <> 'admin_only' THEN false
          ELSE case_evidence_eligible END,
      version = version + 1,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
    WHERE id = folder.id
    RETURNING * INTO folder;
    PERFORM private.document_audit(
      p_society_id, 'document.folder_update', 'document_folder', folder.id,
      jsonb_build_object(
        'name', folder.name,
        'audience', folder.audience,
        'previous_audience', previous_audience,
        'case_evidence_eligible', folder.case_evidence_eligible
      ),
      p_request_id
    );
  END IF;
  RETURN private.document_folder_json(folder, auth.uid());
END;
$$;

CREATE TABLE public.document_official_case_settings (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  reminders_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT
);

CREATE TABLE public.document_official_cases (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  authority text NOT NULL CHECK (char_length(btrim(authority)) BETWEEN 1 AND 120),
  reference text NOT NULL CHECK (char_length(btrim(reference)) BETWEEN 1 AND 120),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200),
  relevant_period text NOT NULL DEFAULT ''
    CHECK (char_length(relevant_period) <= 120),
  received_on date,
  filed_on date,
  filing_mode text CHECK (char_length(btrim(filing_mode)) BETWEEN 1 AND 120),
  filing_acknowledgement text
    CHECK (char_length(btrim(filing_acknowledgement)) BETWEEN 1 AND 200),
  reply_due_on date,
  hearing_on date,
  response_on date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  reviewer_membership_id uuid,
  compliance_entry_id uuid,
  closed_on date,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  reminder_30_sent_on date,
  reminder_7_sent_on date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  FOREIGN KEY (society_id, reviewer_membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, compliance_entry_id)
    REFERENCES public.compliance_entries (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CHECK (
    (status = 'open' AND closed_on IS NULL)
    OR (status = 'closed' AND closed_on IS NOT NULL)
  )
);

CREATE TABLE public.document_official_case_evidence (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  case_id uuid NOT NULL,
  version_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  FOREIGN KEY (society_id, case_id)
    REFERENCES public.document_official_cases (society_id, id) ON DELETE CASCADE,
  FOREIGN KEY (society_id, version_id)
    REFERENCES public.document_versions (society_id, id) ON DELETE CASCADE,
  UNIQUE (society_id, case_id, version_id)
);

CREATE TABLE public.document_official_case_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  case_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  before jsonb,
  after jsonb NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  FOREIGN KEY (society_id, case_id)
    REFERENCES public.document_official_cases (society_id, id) ON DELETE CASCADE,
  UNIQUE (society_id, case_id, revision)
);

CREATE INDEX document_official_cases_due_idx
  ON public.document_official_cases (
    society_id, status, reply_due_on, hearing_on
  );
CREATE INDEX document_official_case_evidence_version_idx
  ON public.document_official_case_evidence (society_id, version_id);
CREATE INDEX document_official_case_revisions_case_idx
  ON public.document_official_case_revisions (society_id, case_id, revision);

ALTER TABLE public.document_official_case_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_official_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_official_case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_official_case_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_official_case_settings,
  public.document_official_cases, public.document_official_case_evidence,
  public.document_official_case_revisions
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY document_official_case_settings_no_direct_access
  ON public.document_official_case_settings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY document_official_cases_no_direct_access
  ON public.document_official_cases
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY document_official_case_evidence_no_direct_access
  ON public.document_official_case_evidence
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY document_official_case_revisions_no_direct_access
  ON public.document_official_case_revisions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.document_official_case_authorize(
  p_society_id uuid, p_write boolean
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'document')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Official case access is not available.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.document_official_case_authorize(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.document_official_case_save(
  p_society_id uuid,
  p_id uuid,
  p_authority text,
  p_reference text,
  p_subject text,
  p_relevant_period text,
  p_received_on date,
  p_filed_on date,
  p_filing_mode text,
  p_filing_acknowledgement text,
  p_reply_due_on date,
  p_hearing_on date,
  p_response_on date,
  p_status text,
  p_reviewer_membership_id uuid,
  p_compliance_entry_id uuid,
  p_closed_on date,
  p_note text,
  p_expected_version integer,
  p_reason text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.document_official_cases;
  saved_id uuid;
  next_version integer;
BEGIN
  PERFORM private.document_official_case_authorize(p_society_id, true);
  IF NOT EXISTS (
    SELECT 1 FROM public.compliance_acknowledgements
    WHERE society_id = p_society_id
  ) THEN
    RAISE EXCEPTION 'Acknowledge the compliance register warning first.'
      USING ERRCODE = '42501';
  END IF;
  IF p_authority IS NULL OR char_length(btrim(p_authority)) NOT BETWEEN 1 AND 120
    OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 1 AND 120
    OR p_subject IS NULL OR char_length(btrim(p_subject)) NOT BETWEEN 1 AND 200
    OR p_relevant_period IS NULL OR char_length(p_relevant_period) > 120
    OR p_status IS NULL OR p_status NOT IN ('open', 'closed')
    OR (p_status = 'closed' AND p_closed_on IS NULL)
    OR p_note IS NULL OR char_length(p_note) > 5000
    OR p_client_request_id IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter valid official case facts.' USING ERRCODE = '22023';
  END IF;
  IF p_filing_mode IS NOT NULL
    AND char_length(btrim(p_filing_mode)) NOT BETWEEN 1 AND 120
    OR p_filing_acknowledgement IS NOT NULL
    AND char_length(btrim(p_filing_acknowledgement)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Enter valid filing facts.' USING ERRCODE = '22023';
  END IF;
  IF p_reviewer_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.society_id = p_society_id
      AND membership.id = p_reviewer_membership_id
      AND membership.status = 'active'
      AND membership.roles && ARRAY['admin', 'committee']::text[]
  ) THEN
    RAISE EXCEPTION 'Choose an active administrator or committee reviewer.'
      USING ERRCODE = '23514';
  END IF;
  IF p_compliance_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.compliance_entries
    WHERE society_id = p_society_id AND id = p_compliance_entry_id
  ) THEN
    RAISE EXCEPTION 'Choose an existing compliance record.'
      USING ERRCODE = '23514';
  END IF;
  SELECT id INTO saved_id
  FROM public.document_official_cases
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF saved_id IS NOT NULL THEN RETURN saved_id; END IF;
  IF p_id IS NULL THEN
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid official case version.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.document_official_cases (
      society_id, authority, reference, subject, relevant_period,
      received_on, filed_on, filing_mode, filing_acknowledgement,
      reply_due_on, hearing_on, response_on, status,
      reviewer_membership_id, compliance_entry_id, closed_on,
      note, created_by, updated_by, client_request_id
    ) VALUES (
      p_society_id, btrim(p_authority), btrim(p_reference), btrim(p_subject),
      p_relevant_period, p_received_on, p_filed_on,
      nullif(btrim(p_filing_mode), ''), nullif(btrim(p_filing_acknowledgement), ''),
      p_reply_due_on, p_hearing_on, p_response_on, p_status,
      p_reviewer_membership_id, p_compliance_entry_id, p_closed_on,
      p_note, auth.uid(), auth.uid(), p_client_request_id
    ) RETURNING id INTO saved_id;
  ELSE
    IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'A reason is required to change an official case.'
        USING ERRCODE = '22023';
    END IF;
    SELECT * INTO previous
    FROM public.document_official_cases
    WHERE society_id = p_society_id AND id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Official case not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Official case changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    next_version := previous.version + 1;
    UPDATE public.document_official_cases
    SET authority = btrim(p_authority),
      reference = btrim(p_reference),
      subject = btrim(p_subject),
      relevant_period = p_relevant_period,
      received_on = p_received_on,
      filed_on = p_filed_on,
      filing_mode = nullif(btrim(p_filing_mode), ''),
      filing_acknowledgement = nullif(btrim(p_filing_acknowledgement), ''),
      reply_due_on = p_reply_due_on,
      hearing_on = p_hearing_on,
      response_on = p_response_on,
      status = p_status,
      reviewer_membership_id = p_reviewer_membership_id,
      compliance_entry_id = p_compliance_entry_id,
      closed_on = p_closed_on,
      note = p_note,
      version = next_version,
      reminder_30_sent_on = CASE
        WHEN row(reply_due_on, hearing_on) IS DISTINCT FROM
          row(p_reply_due_on, p_hearing_on)
        THEN NULL ELSE reminder_30_sent_on END,
      reminder_7_sent_on = CASE
        WHEN row(reply_due_on, hearing_on) IS DISTINCT FROM
          row(p_reply_due_on, p_hearing_on)
        THEN NULL ELSE reminder_7_sent_on END,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_id;
    INSERT INTO public.document_official_case_revisions (
      society_id, case_id, revision, before, after, reason, created_by, request_id
    ) VALUES (
      p_society_id, p_id, next_version, to_jsonb(previous),
      (
        SELECT to_jsonb(item)
        FROM public.document_official_cases item
        WHERE item.society_id = p_society_id AND item.id = p_id
      ),
      btrim(p_reason), auth.uid(), p_request_id
    );
    saved_id := p_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_id IS NULL THEN 'official_case.create' ELSE 'official_case.update' END,
    'document_official_case', saved_id::text,
    jsonb_build_object(
      'authority', btrim(p_authority),
      'reference', btrim(p_reference),
      'status', p_status
    ),
    p_request_id
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.document_official_case_evidence_link(
  p_society_id uuid,
  p_case_id uuid,
  p_version_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  evidence_id uuid;
  source record;
BEGIN
  PERFORM private.document_official_case_authorize(p_society_id, true);
  PERFORM private.document_lock_writer(p_society_id);
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request trace is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.document_official_cases
  WHERE society_id = p_society_id AND id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Official case not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT version.id, folder.id AS folder_id, folder.case_evidence_eligible
  INTO source
  FROM public.document_versions version
  JOIN public.documents document
    ON document.society_id = version.society_id
    AND document.id = version.document_id
  JOIN public.document_folders folder
    ON folder.society_id = document.society_id
    AND folder.id = document.folder_id
  WHERE version.society_id = p_society_id
    AND version.id = p_version_id
  FOR UPDATE OF folder;
  IF NOT FOUND
    OR source.case_evidence_eligible IS NOT TRUE
    OR NOT private.document_user_can_see_version(
      p_society_id, auth.uid(), p_version_id
    )
  THEN
    RAISE EXCEPTION 'Use a document from a folder created admin-only for case evidence.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.document_official_case_evidence (
    society_id, case_id, version_id, created_by, request_id
  ) VALUES (
    p_society_id, p_case_id, p_version_id, auth.uid(), p_request_id
  ) ON CONFLICT (society_id, case_id, version_id)
  DO UPDATE SET version_id = excluded.version_id
  RETURNING id INTO evidence_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'official_case.evidence.link',
    'document_official_case', p_case_id::text,
    jsonb_build_object('version_id', p_version_id), p_request_id
  );
  RETURN evidence_id;
END;
$$;

CREATE FUNCTION public.document_official_case_workspace(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  today date;
BEGIN
  PERFORM private.document_official_case_authorize(p_society_id, false);
  IF NOT EXISTS (
    SELECT 1 FROM public.compliance_acknowledgements
    WHERE society_id = p_society_id
  ) THEN
    RETURN jsonb_build_object(
      'warning', 'These records are not legal advice or certification.',
      'acknowledged', false,
      'reminders_enabled', false,
      'cases', '[]'::jsonb,
      'evidence_choices', '[]'::jsonb,
      'reviewer_choices', '[]'::jsonb,
      'compliance_choices', '[]'::jsonb
    );
  END IF;
  today := private.housekeeping_local_date(p_society_id);
  RETURN jsonb_build_object(
    'warning', 'These records are not legal advice or certification.',
    'acknowledged', true,
    'reminders_enabled', coalesce((
      SELECT settings.reminders_enabled
      FROM public.document_official_case_settings settings
      WHERE settings.society_id = p_society_id
    ), false),
    'reviewer_choices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'membership_id', membership.id,
        'name', profile.full_name
      ) ORDER BY lower(profile.full_name))
      FROM public.memberships membership
      JOIN public.profiles profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND membership.roles && ARRAY['admin', 'committee']::text[]
    ), '[]'::jsonb),
    'compliance_choices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', entry.id, 'title', entry.title
      ) ORDER BY lower(entry.title))
      FROM public.compliance_entries entry
      WHERE entry.society_id = p_society_id
    ), '[]'::jsonb),
    'evidence_choices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'version_id', version.id,
        'document_title', document.title,
        'file_name', version.file_name
      ) ORDER BY lower(document.title), version.version_number DESC)
      FROM public.document_versions version
      JOIN public.documents document
        ON document.society_id = version.society_id
        AND document.id = version.document_id
      JOIN public.document_folders folder
        ON folder.society_id = document.society_id
        AND folder.id = document.folder_id
      WHERE version.society_id = p_society_id
        AND version.archived_at IS NULL
        AND folder.audience = 'admin_only'
        AND folder.case_evidence_eligible
        AND version.id = private.document_current_version_id(
          version.society_id, version.document_id
        )
        AND private.document_user_can_see_version(
          p_society_id, auth.uid(), version.id
        )
    ), '[]'::jsonb),
    'cases', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'authority', item.authority,
        'reference', item.reference,
        'subject', item.subject,
        'relevant_period', item.relevant_period,
        'received_on', item.received_on,
        'filed_on', item.filed_on,
        'filing_mode', item.filing_mode,
        'filing_acknowledgement', item.filing_acknowledgement,
        'reply_due_on', item.reply_due_on,
        'hearing_on', item.hearing_on,
        'response_on', item.response_on,
        'status', item.status,
        'reviewer_membership_id', item.reviewer_membership_id,
        'reviewer_name', reviewer_profile.full_name,
        'compliance_entry_id', item.compliance_entry_id,
        'compliance_title', compliance.title,
        'closed_on', item.closed_on,
        'note', item.note,
        'version', item.version,
        'updated_at', item.updated_at,
        'next_date', least(
          coalesce(item.reply_due_on, 'infinity'::date),
          coalesce(item.hearing_on, 'infinity'::date)
        ),
        'due_state', CASE
          WHEN item.status = 'closed' THEN 'closed'
          WHEN least(
            coalesce(item.reply_due_on, 'infinity'::date),
            coalesce(item.hearing_on, 'infinity'::date)
          ) < today THEN 'overdue'
          WHEN least(
            coalesce(item.reply_due_on, 'infinity'::date),
            coalesce(item.hearing_on, 'infinity'::date)
          ) = today THEN 'due_today'
          ELSE 'upcoming'
        END,
        'evidence', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'version_id', version.id,
            'document_title', document.title,
            'file_name', version.file_name
          ) ORDER BY lower(document.title), version.version_number DESC)
          FROM public.document_official_case_evidence evidence
          JOIN public.document_versions version
            ON version.society_id = evidence.society_id
            AND version.id = evidence.version_id
          JOIN public.documents document
            ON document.society_id = version.society_id
            AND document.id = version.document_id
          WHERE evidence.society_id = item.society_id
            AND evidence.case_id = item.id
        ), '[]'::jsonb)
      ) ORDER BY item.status = 'open' DESC, item.hearing_on NULLS LAST,
        item.reply_due_on NULLS LAST, lower(item.subject))
      FROM public.document_official_cases item
      LEFT JOIN public.memberships reviewer
        ON reviewer.society_id = item.society_id
        AND reviewer.id = item.reviewer_membership_id
      LEFT JOIN public.profiles reviewer_profile
        ON reviewer_profile.id = reviewer.user_id
      LEFT JOIN public.compliance_entries compliance
        ON compliance.society_id = item.society_id
        AND compliance.id = item.compliance_entry_id
      WHERE item.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.document_official_case_reminders_save(
  p_society_id uuid, p_enabled boolean, p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.document_official_case_authorize(p_society_id, true);
  IF p_enabled IS NULL OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid case reminder setting.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.document_official_case_settings (
    society_id, reminders_enabled, updated_by
  ) VALUES (p_society_id, p_enabled, auth.uid())
  ON CONFLICT (society_id) DO UPDATE
    SET reminders_enabled = excluded.reminders_enabled,
      updated_by = auth.uid(),
      updated_at = clock_timestamp();
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'official_case.reminders.update',
    'official_case_settings', p_society_id::text,
    jsonb_build_object('enabled', p_enabled), p_request_id
  );
END;
$$;

CREATE FUNCTION public.document_official_case_reminders_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item public.document_official_cases;
  next_date date;
  recipient_user_id uuid;
  sent integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.document_official_case_settings
    WHERE society_id = p_society_id AND reminders_enabled
  ) THEN
    RETURN jsonb_build_object('sent', 0);
  END IF;
  FOR item IN
    SELECT * FROM public.document_official_cases
    WHERE society_id = p_society_id AND status = 'open'
      AND (
        (least(
          coalesce(reply_due_on, 'infinity'::date),
          coalesce(hearing_on, 'infinity'::date)
        ) = p_today + 30 AND reminder_30_sent_on IS NULL)
        OR (least(
          coalesce(reply_due_on, 'infinity'::date),
          coalesce(hearing_on, 'infinity'::date)
        ) = p_today + 7 AND reminder_7_sent_on IS NULL)
      )
    FOR UPDATE
  LOOP
    next_date := least(
      coalesce(item.reply_due_on, 'infinity'::date),
      coalesce(item.hearing_on, 'infinity'::date)
    );
    FOR recipient_user_id IN
      SELECT DISTINCT member.user_id
      FROM public.memberships member
      WHERE member.society_id = p_society_id
        AND member.status = 'active'
        AND member.user_id IS NOT NULL
        AND 'admin' = ANY(member.roles)
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient_user_id, 'official_case_due',
        'Official case date reminder',
        left(item.subject || ': recorded date ' || next_date::text, 300),
        'document_official_case', item.id, p_request_id
      );
    END LOOP;
    UPDATE public.document_official_cases
    SET reminder_30_sent_on = CASE
          WHEN next_date = p_today + 30 THEN p_today
          ELSE reminder_30_sent_on END,
        reminder_7_sent_on = CASE
          WHEN next_date = p_today + 7 THEN p_today
          ELSE reminder_7_sent_on END
    WHERE society_id = p_society_id AND id = item.id;
    sent := sent + 1;
  END LOOP;
  RETURN jsonb_build_object('sent', sent);
END;
$$;

CREATE FUNCTION public.document_official_case_cleanup_candidates(
  p_society_id uuid, p_today date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rule public.data_cleanup_rules;
BEGIN
  SELECT * INTO rule
  FROM public.data_cleanup_rules
  WHERE society_id = p_society_id
    AND record_kind = 'official_case'
    AND enabled;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'case_id', item.id,
      'version_ids', coalesce((
        SELECT jsonb_agg(evidence.version_id)
        FROM public.document_official_case_evidence evidence
        WHERE evidence.society_id = item.society_id
          AND evidence.case_id = item.id
      ), '[]'::jsonb),
      'paths', coalesce((
        SELECT jsonb_agg(version.path)
        FROM public.document_official_case_evidence evidence
        JOIN public.document_versions version
          ON version.society_id = evidence.society_id
          AND version.id = evidence.version_id
        JOIN public.documents document
          ON document.society_id = version.society_id
          AND document.id = version.document_id
        JOIN public.document_folders folder
          ON folder.society_id = document.society_id
          AND folder.id = document.folder_id
        WHERE evidence.society_id = item.society_id
          AND evidence.case_id = item.id
          AND folder.audience = 'admin_only'
          AND folder.case_evidence_eligible
          AND NOT EXISTS (
            SELECT 1
            FROM public.document_official_case_evidence retained
            JOIN public.document_official_cases retained_case
              ON retained_case.society_id = retained.society_id
              AND retained_case.id = retained.case_id
            WHERE retained.society_id = evidence.society_id
              AND retained.version_id = evidence.version_id
              AND retained.case_id <> item.id
              AND (
                retained_case.status <> 'closed'
                OR retained_case.closed_on > (
                  p_today - make_interval(years => rule.older_than_years)
                )::date
              )
          )
      ), '[]'::jsonb)
    ))
    FROM public.document_official_cases item
    WHERE item.society_id = p_society_id
      AND item.status = 'closed'
      AND item.closed_on <= (
        p_today - make_interval(years => rule.older_than_years)
      )::date
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION private.document_case_cleanup_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('homeish.case_evidence_cleanup', true) = 'on' THEN
    IF TG_TABLE_NAME = 'document_versions' AND EXISTS (
      SELECT 1
      FROM public.document_official_case_evidence evidence
      WHERE evidence.society_id = OLD.society_id
        AND evidence.version_id = OLD.id
    ) THEN
      RETURN OLD;
    END IF;
    IF TG_TABLE_NAME = 'documents'
      AND EXISTS (
        SELECT 1
        FROM public.document_folders folder
        WHERE folder.society_id = OLD.society_id
          AND folder.id = OLD.folder_id
          AND folder.audience = 'admin_only'
          AND folder.case_evidence_eligible
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.document_versions version
        WHERE version.society_id = OLD.society_id
          AND version.document_id = OLD.id
      )
    THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'Document history is permanent outside approved case cleanup.'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.document_case_cleanup_guard()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER documents_no_delete ON public.documents;
DROP TRIGGER document_versions_no_delete ON public.document_versions;
CREATE TRIGGER documents_no_delete
  BEFORE DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.document_case_cleanup_guard();
CREATE TRIGGER document_versions_no_delete
  BEFORE DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION private.document_case_cleanup_guard();

CREATE FUNCTION public.document_official_case_cleanup_finalize(
  p_society_id uuid, p_case_ids uuid[], p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_cases integer;
  deleted_files integer := 0;
  doomed_version_ids uuid[];
BEGIN
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request trace is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('homeish.case_evidence_cleanup', 'on', true);
  SELECT coalesce(array_agg(DISTINCT evidence.version_id), ARRAY[]::uuid[])
  INTO doomed_version_ids
  FROM public.document_official_case_evidence evidence
  WHERE evidence.society_id = p_society_id
    AND evidence.case_id = ANY(p_case_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.document_official_case_evidence retained
      WHERE retained.society_id = evidence.society_id
        AND retained.version_id = evidence.version_id
        AND NOT (retained.case_id = ANY(p_case_ids))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.compliance_entries entry
      WHERE entry.society_id = evidence.society_id
        AND entry.evidence_version_id = evidence.version_id
    );
  DELETE FROM public.document_versions version
  WHERE version.society_id = p_society_id
    AND version.id = ANY(doomed_version_ids);
  GET DIAGNOSTICS deleted_files = ROW_COUNT;
  DELETE FROM public.document_official_case_evidence
  WHERE society_id = p_society_id AND case_id = ANY(p_case_ids);
  DELETE FROM public.documents document
  WHERE document.society_id = p_society_id
    AND EXISTS (
      SELECT 1
      FROM public.document_folders folder
      WHERE folder.society_id = document.society_id
        AND folder.id = document.folder_id
        AND folder.audience = 'admin_only'
        AND folder.case_evidence_eligible
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.document_versions version
      WHERE version.society_id = document.society_id
        AND version.document_id = document.id
    );
  DELETE FROM public.document_official_cases
  WHERE society_id = p_society_id AND id = ANY(p_case_ids);
  GET DIAGNOSTICS deleted_cases = ROW_COUNT;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, NULL, 'system', 'data_cleanup.run',
    'official_case', p_society_id::text,
    jsonb_build_object(
      'cases_deleted', deleted_cases,
      'files_deleted', deleted_files
    ),
    p_request_id
  );
  RETURN jsonb_build_object(
    'official_cases_deleted', deleted_cases,
    'files_deleted', deleted_files
  );
END;
$$;

REVOKE ALL ON FUNCTION public.document_official_case_save(
  uuid, uuid, text, text, text, text, date, date, text, text, date, date,
  date, text, uuid, uuid, date, text, integer, text, uuid, text
), public.document_official_case_evidence_link(uuid, uuid, uuid, text),
  public.document_official_case_workspace(uuid),
  public.document_official_case_reminders_save(uuid, boolean, text),
  public.document_official_case_reminders_run(uuid, date, text),
  public.document_official_case_cleanup_candidates(uuid, date),
  public.document_official_case_cleanup_finalize(uuid, uuid[], text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.document_official_case_save(
  uuid, uuid, text, text, text, text, date, date, text, text, date, date,
  date, text, uuid, uuid, date, text, integer, text, uuid, text
), public.document_official_case_evidence_link(uuid, uuid, uuid, text),
  public.document_official_case_workspace(uuid),
  public.document_official_case_reminders_save(uuid, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_official_case_reminders_run(
  uuid, date, text
), public.document_official_case_cleanup_candidates(uuid, date),
  public.document_official_case_cleanup_finalize(uuid, uuid[], text)
  TO service_role;
