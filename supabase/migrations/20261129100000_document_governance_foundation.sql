-- P44 factual document-governance records, private history, source authorization and expiry settings.

ALTER TABLE public.module_configs
  DROP CONSTRAINT module_configs_document_settings_check;
CREATE OR REPLACE FUNCTION private.document_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key <> 'expiry_reminders_enabled'
    )
    AND (NOT p_settings ? 'expiry_reminders_enabled'
      OR jsonb_typeof(p_settings -> 'expiry_reminders_enabled') = 'boolean')
$$;
REVOKE ALL ON FUNCTION private.document_settings_valid(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.document_settings_valid(jsonb)
  TO authenticated, service_role;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_document_settings_check
  CHECK (module_key <> 'document' OR private.document_settings_valid(settings));

CREATE TABLE public.document_governance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('validity', 'register', 'amendment', 'house_rule')),
  title text NOT NULL CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 160),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'verified', 'needs_review')),
  source_document_version_id uuid,
  source_tenancy_document_id uuid,
  source_resolution_id uuid,
  source_kind text CHECK (source_kind IS NULL OR source_kind IN ('document_version', 'tenancy_noc', 'meeting_resolution')),
  source_version integer CHECK (source_version IS NULL OR source_version >= 1),
  source_outcome text CHECK (source_outcome IS NULL OR source_outcome IN ('pending', 'passed', 'failed', 'deferred')),
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_unavailable_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT document_governance_source_check CHECK (
    num_nonnulls(source_document_version_id, source_tenancy_document_id, source_resolution_id) <= 1
    AND (source_kind IS NOT NULL OR (
      source_document_version_id IS NULL
      AND source_tenancy_document_id IS NULL
      AND source_resolution_id IS NULL
    ))
    AND (source_kind IS NULL OR (
      source_document_version_id IS NOT NULL
      OR source_tenancy_document_id IS NOT NULL
      OR source_resolution_id IS NOT NULL
      OR source_unavailable_at IS NOT NULL
    ))
    AND (source_kind <> 'document_version' OR source_document_version_id IS NOT NULL)
    AND ((source_kind = 'tenancy_noc') = (source_tenancy_document_id IS NOT NULL)
      OR source_kind IS NULL)
    AND (source_kind <> 'meeting_resolution'
      OR source_resolution_id IS NOT NULL
      OR source_unavailable_at IS NOT NULL)
    AND (source_unavailable_at IS NULL
      OR source_kind IS NOT NULL
      AND source_kind IN ('meeting_resolution'))
  ),
  CONSTRAINT document_governance_document_fkey
    FOREIGN KEY (society_id, source_document_version_id)
    REFERENCES public.document_versions (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT document_governance_noc_fkey
    FOREIGN KEY (society_id, source_tenancy_document_id)
    REFERENCES public.tenancy_documents (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT document_governance_resolution_fkey
    FOREIGN KEY (society_id, source_resolution_id)
    REFERENCES public.meeting_resolutions (society_id, id)
    ON DELETE SET NULL (source_resolution_id),
  CONSTRAINT document_governance_archive_check CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX document_governance_records_scope_idx
  ON public.document_governance_records (society_id, kind, archived_at, updated_at DESC, id);
CREATE INDEX document_governance_records_document_idx
  ON public.document_governance_records (society_id, source_document_version_id);
CREATE INDEX document_governance_records_noc_idx
  ON public.document_governance_records (society_id, source_tenancy_document_id);
CREATE INDEX document_governance_records_resolution_idx
  ON public.document_governance_records (society_id, source_resolution_id);
CREATE INDEX document_governance_records_created_by_idx
  ON public.document_governance_records (created_by);
CREATE INDEX document_governance_records_updated_by_idx
  ON public.document_governance_records (updated_by);
CREATE INDEX document_governance_records_archived_by_idx
  ON public.document_governance_records (archived_by);

CREATE TABLE public.document_validities (
  society_id uuid NOT NULL,
  record_id uuid NOT NULL,
  issuing_authority text CHECK (
    issuing_authority IS NULL
    OR (issuing_authority = btrim(issuing_authority) AND char_length(issuing_authority) BETWEEN 1 AND 200)
  ),
  reference text CHECK (
    reference IS NULL
    OR (reference = btrim(reference) AND char_length(reference) BETWEEN 1 AND 200)
  ),
  issue_date date,
  expiry_kind text NOT NULL CHECK (expiry_kind IN ('unknown', 'dated', 'perpetual')),
  expiry_date date,
  reminder_cycle_date date,
  reminder_last_milestone integer CHECK (reminder_last_milestone IN (30, 7, 0)),
  CONSTRAINT document_validities_record_fkey FOREIGN KEY (society_id, record_id)
    REFERENCES public.document_governance_records (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT document_validities_expiry_check CHECK (
    (expiry_kind = 'dated' AND expiry_date IS NOT NULL)
    OR (expiry_kind IN ('unknown', 'perpetual') AND expiry_date IS NULL)
  ),
  CONSTRAINT document_validities_reminder_check CHECK (
    (reminder_cycle_date IS NULL) = (reminder_last_milestone IS NULL)
  ),
  PRIMARY KEY (society_id, record_id)
);
CREATE INDEX document_validities_reminder_idx
  ON public.document_validities (society_id, expiry_date, record_id)
  WHERE expiry_kind = 'dated';

CREATE TABLE public.document_register_indexes (
  society_id uuid NOT NULL,
  record_id uuid NOT NULL,
  register_name text CHECK (
    register_name IS NULL
    OR (register_name = btrim(register_name) AND char_length(register_name) BETWEEN 1 AND 160)
  ),
  register_type text CHECK (
    register_type IS NULL
    OR (register_type = btrim(register_type) AND char_length(register_type) BETWEEN 1 AND 120)
  ),
  applicability_basis text CHECK (
    applicability_basis IS NULL
    OR (applicability_basis = btrim(applicability_basis) AND char_length(applicability_basis) BETWEEN 1 AND 500)
  ),
  maintenance_state text CHECK (
    maintenance_state IS NULL
    OR maintenance_state IN ('not_started', 'maintained', 'needs_review', 'not_applicable')
  ),
  clause_or_page text CHECK (
    clause_or_page IS NULL
    OR (clause_or_page = btrim(clause_or_page) AND char_length(clause_or_page) BETWEEN 1 AND 200)
  ),
  format text CHECK (
    format IS NULL OR (format = btrim(format) AND char_length(format) BETWEEN 1 AND 200)
  ),
  physical_location text CHECK (
    physical_location IS NULL
    OR (physical_location = btrim(physical_location) AND char_length(physical_location) BETWEEN 1 AND 200)
  ),
  custodian text CHECK (
    custodian IS NULL OR (custodian = btrim(custodian) AND char_length(custodian) BETWEEN 1 AND 200)
  ),
  review_date date,
  CONSTRAINT document_register_indexes_record_fkey FOREIGN KEY (society_id, record_id)
    REFERENCES public.document_governance_records (society_id, id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, record_id)
);

CREATE TABLE public.document_amendment_milestones (
  society_id uuid NOT NULL,
  record_id uuid NOT NULL,
  milestone_type text NOT NULL CHECK (milestone_type IN ('meeting', 'filing', 'registrar_approval')),
  milestone_date date,
  note text CHECK (
    note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500)
  ),
  historical_evidence boolean NOT NULL DEFAULT false,
  CONSTRAINT document_amendments_record_fkey FOREIGN KEY (society_id, record_id)
    REFERENCES public.document_governance_records (society_id, id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, record_id)
);

CREATE TABLE public.document_house_rules (
  society_id uuid NOT NULL,
  record_id uuid NOT NULL,
  rule_text text CHECK (
    rule_text IS NULL OR (rule_text = btrim(rule_text) AND char_length(rule_text) BETWEEN 1 AND 5000)
  ),
  approval_date date,
  effective_date date,
  approving_resolution_id uuid,
  approving_resolution_version integer CHECK (
    approving_resolution_version IS NULL OR approving_resolution_version >= 1
  ),
  approving_resolution_outcome text CHECK (
    approving_resolution_outcome IS NULL
    OR approving_resolution_outcome IN ('pending', 'passed', 'failed', 'deferred')
  ),
  approving_resolution_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  approving_resolution_unavailable_at timestamptz,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'withdrawn', 'superseded')),
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  gate_locked boolean NOT NULL DEFAULT true CHECK (gate_locked = true),
  CONSTRAINT document_house_rules_record_fkey FOREIGN KEY (society_id, record_id)
    REFERENCES public.document_governance_records (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT document_house_rules_resolution_fkey FOREIGN KEY (society_id, approving_resolution_id)
    REFERENCES public.meeting_resolutions (society_id, id)
    ON DELETE SET NULL (approving_resolution_id),
  CONSTRAINT document_house_rules_publication_check CHECK (
    gate_locked
    AND publication_state <> 'published'
    AND published_at IS NULL
    AND published_by IS NULL
  ),
  CONSTRAINT document_house_rules_date_check CHECK (
    effective_date IS NULL OR approval_date IS NULL OR effective_date >= approval_date
  ),
  PRIMARY KEY (society_id, record_id)
);
CREATE INDEX document_house_rules_resolution_idx
  ON public.document_house_rules (society_id, approving_resolution_id);
CREATE INDEX document_house_rules_published_by_idx
  ON public.document_house_rules (published_by);

CREATE TABLE public.document_governance_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'verify', 'archive', 'restore')),
  previous_values jsonb NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  source_kinds_before text[] NOT NULL DEFAULT '{}'::text[],
  source_kinds_after text[] NOT NULL DEFAULT '{}'::text[],
  reason text CHECK (
    reason IS NULL OR (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 500)
  ),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT document_governance_revisions_record_fkey FOREIGN KEY (society_id, record_id)
    REFERENCES public.document_governance_records (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX document_governance_revisions_record_idx
  ON public.document_governance_revisions (society_id, record_id, created_at DESC, id);
CREATE INDEX document_governance_revisions_created_by_idx
  ON public.document_governance_revisions (created_by);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'document_governance_records', 'document_validities', 'document_register_indexes',
    'document_amendment_milestones', 'document_house_rules', 'document_governance_revisions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      table_name || '_no_direct_access', table_name
    );
  END LOOP;
END;
$$;

CREATE TRIGGER document_governance_records_no_delete BEFORE DELETE
  ON public.document_governance_records
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER document_governance_records_no_truncate BEFORE TRUNCATE
  ON public.document_governance_records
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER document_governance_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.document_governance_revisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER document_governance_revisions_no_truncate
  BEFORE TRUNCATE ON public.document_governance_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.document_governance_resolution_unavailable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.document_governance_records
  SET source_unavailable_at = COALESCE(source_unavailable_at, clock_timestamp())
  WHERE society_id = OLD.society_id
    AND source_resolution_id = OLD.id
    AND source_kind = 'meeting_resolution';
  UPDATE public.document_house_rules
  SET approving_resolution_unavailable_at = COALESCE(
    approving_resolution_unavailable_at, clock_timestamp()
  )
  WHERE society_id = OLD.society_id AND approving_resolution_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_resolution_unavailable()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER document_governance_resolution_unavailable
  BEFORE DELETE ON public.meeting_resolutions
  FOR EACH ROW EXECUTE FUNCTION private.document_governance_resolution_unavailable();

CREATE FUNCTION private.document_governance_authorize(p_society_id uuid, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'document')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR (p_write AND NOT private.has_role(p_society_id, ARRAY['admin']::text[]))
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived')
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Document governance access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_authorize(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_write_begin(
  p_society_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.document_governance_authorize(p_society_id, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.document_governance_authorize(p_society_id, true);
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request id is invalid.' USING ERRCODE = '22023';
  END IF;
  SET LOCAL lock_timeout = '5s';
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_write_begin(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_clean_text(
  p_value text, p_max integer, p_label text, p_required boolean
)
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
REVOKE ALL ON FUNCTION private.document_governance_clean_text(text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_date(
  p_value text, p_label text, p_required boolean
)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  clean text := NULLIF(btrim(COALESCE(p_value, '')), '');
  parsed date;
BEGIN
  IF clean IS NULL THEN
    IF p_required THEN
      RAISE EXCEPTION 'Enter %.', p_label USING ERRCODE = '22023';
    END IF;
    RETURN NULL;
  END IF;
  IF clean !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Use a YYYY-MM-DD date for %.', p_label USING ERRCODE = '22023';
  END IF;
  BEGIN
    parsed := clean::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Use a valid date for %.', p_label USING ERRCODE = '22023';
  END;
  RETURN parsed;
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_date(text, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_today(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (clock_timestamp() AT TIME ZONE society.timezone)::date
  FROM public.societies AS society WHERE society.id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.document_governance_today(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_user_can_read_noc(
  p_society_id uuid, p_user_id uuid, p_tenancy_document_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL
    AND private.module_enabled(p_society_id, 'tenancy')
    AND EXISTS (
      SELECT 1
      FROM public.tenancy_documents AS document
      JOIN public.tenancy_moves AS move
        ON move.society_id = document.society_id AND move.id = document.move_id
      WHERE document.society_id = p_society_id
        AND document.id = p_tenancy_document_id
        AND document.kind = 'noc'
        AND document.deleted_at IS NULL
        AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
        AND (
          EXISTS (
            SELECT 1 FROM public.memberships AS membership
            WHERE membership.society_id = p_society_id
              AND membership.user_id = p_user_id
              AND membership.status = 'active'
              AND 'admin' = ANY(membership.roles)
          )
          OR EXISTS (
            SELECT 1 FROM public.memberships AS membership
            JOIN public.unit_occupants AS occupant
              ON occupant.society_id = membership.society_id
              AND occupant.membership_id = membership.id
            WHERE membership.society_id = p_society_id
              AND membership.user_id = p_user_id
              AND membership.status = 'active'
              AND 'resident' = ANY(membership.roles)
              AND occupant.unit_id = move.unit_id
              AND occupant.relationship = 'owner'
              AND occupant.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM public.memberships AS tenant_membership
            WHERE tenant_membership.society_id = p_society_id
              AND tenant_membership.id = move.tenant_membership_id
              AND tenant_membership.user_id = p_user_id
              AND tenant_membership.status = 'active'
              AND 'resident' = ANY(tenant_membership.roles)
          )
        )
    )
$$;
REVOKE ALL ON FUNCTION private.document_governance_user_can_read_noc(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_user_can_read_record(
  p_society_id uuid, p_user_id uuid, p_record_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_governance_records AS record
    WHERE record.society_id = p_society_id
      AND record.id = p_record_id
      AND private.module_enabled(p_society_id, 'document')
      AND (
        record.source_tenancy_document_id IS NULL
        OR record.source_kind <> 'tenancy_noc'
        OR private.module_enabled(p_society_id, 'tenancy')
      )
      AND (
        record.source_kind <> 'meeting_resolution'
        OR private.module_enabled(p_society_id, 'meeting')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.document_house_rules AS rule
        WHERE rule.society_id = record.society_id AND rule.record_id = record.id
          AND NOT private.module_enabled(p_society_id, 'meeting')
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = p_society_id
            AND membership.user_id = p_user_id
            AND membership.status = 'active'
            AND 'admin' = ANY(membership.roles)
        )
        OR EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = p_society_id
            AND membership.user_id = p_user_id
            AND membership.status = 'active'
            AND 'committee' = ANY(membership.roles)
        ) AND (
          (
            record.source_kind IS NULL
            OR (record.source_kind = 'document_version'
              AND record.source_document_version_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.document_versions AS version
                WHERE version.society_id = p_society_id
                  AND version.id = record.source_document_version_id
                  AND private.document_user_can_see(p_society_id, p_user_id, version.document_id)
              ))
            OR (record.source_kind = 'tenancy_noc'
              AND private.document_governance_user_can_read_noc(
                p_society_id, p_user_id, record.source_tenancy_document_id
              ))
            OR (record.source_kind = 'meeting_resolution'
              AND record.source_resolution_id IS NOT NULL
              AND private.module_enabled(p_society_id, 'meeting'))
          ) AND (
            record.kind <> 'house_rule' OR EXISTS (
              SELECT 1 FROM public.document_house_rules AS rule
              JOIN public.meeting_resolutions AS resolution
                ON resolution.society_id = rule.society_id
                AND resolution.id = rule.approving_resolution_id
              WHERE rule.society_id = record.society_id
                AND rule.record_id = record.id
                AND rule.approving_resolution_unavailable_at IS NULL
            )
          )
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.document_governance_user_can_read_record(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_snapshot(
  p_society_id uuid, p_record_id uuid
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'record', to_jsonb(record),
    'validity', CASE WHEN record.kind = 'validity' THEN to_jsonb(validity) END,
    'register', CASE WHEN record.kind = 'register' THEN to_jsonb(register_index) END,
    'amendment', CASE WHEN record.kind = 'amendment' THEN to_jsonb(amendment) END,
    'houseRule', CASE WHEN record.kind = 'house_rule' THEN to_jsonb(house_rule) END
  )
  FROM public.document_governance_records AS record
  LEFT JOIN public.document_validities AS validity
    ON validity.society_id = record.society_id AND validity.record_id = record.id
  LEFT JOIN public.document_register_indexes AS register_index
    ON register_index.society_id = record.society_id AND register_index.record_id = record.id
  LEFT JOIN public.document_amendment_milestones AS amendment
    ON amendment.society_id = record.society_id AND amendment.record_id = record.id
  LEFT JOIN public.document_house_rules AS house_rule
    ON house_rule.society_id = record.society_id AND house_rule.record_id = record.id
  WHERE record.society_id = p_society_id AND record.id = p_record_id
$$;
REVOKE ALL ON FUNCTION private.document_governance_snapshot(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_source_snapshot(
  p_society_id uuid, p_kind text, p_document_version_id uuid,
  p_tenancy_document_id uuid, p_resolution_id uuid, p_details jsonb
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
BEGIN
  IF num_nonnulls(p_document_version_id, p_tenancy_document_id, p_resolution_id) > 1 THEN
    RAISE EXCEPTION 'Choose at most one evidence source.' USING ERRCODE = '22023';
  END IF;
  IF p_document_version_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'kind', 'document_version',
      'versionId', version.id,
      'documentId', document.id,
      'title', document.title,
      'versionNumber', version.version_number,
      'fileName', version.file_name,
      'historical', COALESCE((p_details ->> 'historicalEvidence')::boolean, false),
      'archived', document.archived_at IS NOT NULL OR version.archived_at IS NOT NULL,
      'folderArchived', folder.archived_at IS NOT NULL
    ) INTO result
    FROM public.document_versions AS version
    JOIN public.documents AS document
      ON document.society_id = version.society_id AND document.id = version.document_id
    LEFT JOIN public.document_folders AS folder
      ON folder.society_id = document.society_id AND folder.id = document.folder_id
    WHERE version.society_id = p_society_id AND version.id = p_document_version_id
      AND private.document_user_can_see_version(p_society_id, auth.uid(), version.id);
    IF result IS NULL THEN RAISE EXCEPTION 'Source not found.' USING ERRCODE = 'P0002'; END IF;
    IF p_kind = 'house_rule' AND EXISTS (
      SELECT 1 FROM public.documents WHERE society_id = p_society_id AND id = (result ->> 'documentId')::uuid
        AND folder_id IS NULL
    ) THEN
      RAISE EXCEPTION 'House rules require a society-folder source.' USING ERRCODE = '22023';
    END IF;
    IF p_kind <> 'amendment' OR NOT COALESCE(
      (p_details ->> 'historicalEvidence')::boolean, false
    ) THEN
      IF (result ->> 'archived')::boolean
        OR (result ->> 'folderArchived')::boolean
        OR (result ->> 'versionId')::uuid <> (
          SELECT private.document_current_version_id(
            p_society_id, (result ->> 'documentId')::uuid
          )
        )
      THEN
        RAISE EXCEPTION 'Choose the active current document version.' USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN result;
  END IF;
  IF p_tenancy_document_id IS NOT NULL THEN
    IF NOT private.module_enabled(p_society_id, 'tenancy') THEN
      RAISE EXCEPTION 'Tenancy is disabled.' USING ERRCODE = '42501';
    END IF;
    SELECT jsonb_build_object(
      'kind', 'tenancy_noc',
      'documentId', document.id,
      'moveId', document.move_id,
      'issuedAt', document.created_at
    ) INTO result
    FROM public.tenancy_documents AS document
    WHERE document.society_id = p_society_id
      AND document.id = p_tenancy_document_id
      AND document.kind = 'noc'
      AND document.deleted_at IS NULL
      AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
      AND private.document_governance_user_can_read_noc(p_society_id, auth.uid(), document.id);
    IF result IS NULL THEN RAISE EXCEPTION 'NOC source not found.' USING ERRCODE = 'P0002'; END IF;
    IF p_kind = 'house_rule' THEN
      RAISE EXCEPTION 'House rules require a society-folder document.' USING ERRCODE = '22023';
    END IF;
    RETURN result;
  END IF;
  IF p_resolution_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'kind', 'meeting_resolution',
      'resolutionId', resolution.id,
      'meetingId', resolution.meeting_id,
      'title', resolution.title,
      'version', resolution.version,
      'outcome', resolution.outcome
    ) INTO result
    FROM public.meeting_resolutions AS resolution
    WHERE resolution.society_id = p_society_id AND resolution.id = p_resolution_id
      AND private.module_enabled(p_society_id, 'meeting');
    IF result IS NULL THEN RAISE EXCEPTION 'Meeting source not found.' USING ERRCODE = 'P0002'; END IF;
    IF p_kind <> 'amendment' THEN
      RAISE EXCEPTION 'This record kind does not accept meeting evidence.' USING ERRCODE = '22023';
    END IF;
    RETURN result;
  END IF;
  RETURN '{}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_source_snapshot(uuid, text, uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_source_json(
  p_society_id uuid, record public.document_governance_records
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF record.source_kind IS NULL THEN
    RETURN jsonb_build_object('state', 'unlinked', 'label', 'No linked evidence');
  END IF;
  IF record.source_kind = 'document_version' THEN
    RETURN jsonb_build_object(
      'state', CASE
        WHEN record.source_unavailable_at IS NOT NULL OR NOT private.document_user_can_see_version(
          p_society_id, auth.uid(), record.source_document_version_id
        ) THEN 'needs_review'
        WHEN record.kind = 'amendment'
          AND COALESCE((record.source_snapshot ->> 'historical')::boolean, false)
          THEN 'available'
        WHEN EXISTS (
          SELECT 1
          FROM public.document_versions AS version
          JOIN public.documents AS document
            ON document.society_id = version.society_id
            AND document.id = version.document_id
          LEFT JOIN public.document_folders AS folder
            ON folder.society_id = document.society_id AND folder.id = document.folder_id
          WHERE version.society_id = p_society_id
            AND version.id = record.source_document_version_id
            AND document.archived_at IS NULL
            AND version.archived_at IS NULL
            AND (document.folder_id IS NULL OR folder.archived_at IS NULL)
            AND version.id = private.document_current_version_id(
              p_society_id, document.id
            )
        ) THEN CASE WHEN record.state = 'needs_review' THEN 'needs_review' ELSE 'available' END
        ELSE 'needs_review'
      END,
      'kind', 'document_version',
      'id', record.source_document_version_id,
      'label', record.source_snapshot ->> 'title',
      'versionNumber', record.source_snapshot ->> 'versionNumber'
    );
  END IF;
  IF record.source_kind = 'tenancy_noc' THEN
    RETURN jsonb_build_object(
      'state', CASE WHEN private.document_governance_user_can_read_noc(
        p_society_id, auth.uid(), record.source_tenancy_document_id
      ) AND record.source_unavailable_at IS NULL THEN 'available' ELSE 'needs_review' END,
      'kind', 'tenancy_noc',
      'id', record.source_tenancy_document_id,
      'label', 'Tenancy NOC'
    );
  END IF;
  RETURN jsonb_build_object(
    'state', CASE WHEN EXISTS (
      SELECT 1 FROM public.meeting_resolutions AS resolution
      WHERE resolution.society_id = p_society_id
        AND resolution.id = record.source_resolution_id
        AND resolution.version::text = record.source_snapshot ->> 'version'
        AND resolution.outcome = record.source_snapshot ->> 'outcome'
    ) AND record.source_unavailable_at IS NULL THEN 'available' ELSE 'needs_review' END,
    'kind', 'meeting_resolution',
    'id', record.source_resolution_id,
    'label', COALESCE(record.source_snapshot ->> 'title', 'Meeting decision')
  );
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_source_json(uuid, public.document_governance_records)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_governance_json(
  p_society_id uuid, record public.document_governance_records
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'id', record.id,
    'kind', record.kind,
    'title', record.title,
    'state', record.state,
    'source', private.document_governance_source_json(p_society_id, record),
    'version', record.version,
    'archivedAt', record.archived_at,
    'createdAt', record.created_at,
    'updatedAt', record.updated_at,
    'validity', CASE WHEN record.kind = 'validity' THEN (
      SELECT jsonb_build_object(
        'issuingAuthority', validity.issuing_authority,
        'reference', validity.reference,
        'issueDate', validity.issue_date,
        'expiryKind', validity.expiry_kind,
        'expiryDate', validity.expiry_date,
        'dateState', CASE
          WHEN validity.expiry_kind = 'unknown' THEN 'unknown'
          WHEN validity.expiry_kind = 'perpetual' THEN 'perpetual'
          WHEN validity.expiry_date < private.document_governance_today(p_society_id) THEN 'past_date'
          WHEN validity.expiry_date = private.document_governance_today(p_society_id) THEN 'due_today'
          ELSE 'upcoming'
        END
      ) FROM public.document_validities AS validity
      WHERE validity.society_id = p_society_id AND validity.record_id = record.id
    ) END,
    'register', CASE WHEN record.kind = 'register' THEN (
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'name', register_index.register_name,
        'type', register_index.register_type,
        'basis', register_index.applicability_basis,
        'maintenanceState', register_index.maintenance_state,
        'clauseOrPage', register_index.clause_or_page,
        'format', register_index.format,
        'physicalLocation', CASE WHEN private.has_role(
          p_society_id, ARRAY['admin']::text[]
        ) THEN register_index.physical_location END,
        'custodian', CASE WHEN private.has_role(
          p_society_id, ARRAY['admin']::text[]
        ) THEN register_index.custodian END,
        'reviewDate', register_index.review_date
      )) FROM public.document_register_indexes AS register_index
      WHERE register_index.society_id = p_society_id AND register_index.record_id = record.id
    ) END,
    'amendment', CASE WHEN record.kind = 'amendment' THEN (
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'milestoneType', amendment.milestone_type,
        'milestoneDate', amendment.milestone_date,
        'note', amendment.note,
        'historicalEvidence', amendment.historical_evidence
      )) FROM public.document_amendment_milestones AS amendment
      WHERE amendment.society_id = p_society_id AND amendment.record_id = record.id
    ) END,
    'houseRule', CASE WHEN record.kind = 'house_rule' THEN (
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'text', rule.rule_text,
        'approvalDate', rule.approval_date,
        'effectiveDate', rule.effective_date,
        'approvingResolutionId', rule.approving_resolution_id,
        'approvingResolutionLabel', rule.approving_resolution_snapshot ->> 'title',
        'publicationState', rule.publication_state,
        'gateLocked', rule.gate_locked,
        'decisionState', CASE WHEN rule.approving_resolution_id IS NULL
          OR rule.approving_resolution_unavailable_at IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.meeting_resolutions AS resolution
            WHERE resolution.society_id = rule.society_id
              AND resolution.id = rule.approving_resolution_id
              AND resolution.version = rule.approving_resolution_version
              AND resolution.outcome = rule.approving_resolution_outcome
          ) THEN 'needs_review' ELSE 'available' END
      )) FROM public.document_house_rules AS rule
      WHERE rule.society_id = p_society_id AND rule.record_id = record.id
    ) END
  ));
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_json(uuid, public.document_governance_records)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.document_governance_sources_list(
  p_society_id uuid, p_kind text, p_source_type text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  items jsonb;
  total integer;
BEGIN
  PERFORM private.document_governance_authorize(p_society_id, true);
  IF p_kind IS NULL OR p_kind NOT IN ('validity', 'register', 'amendment', 'house_rule')
    OR p_source_type IS NULL OR p_source_type NOT IN ('document_version', 'tenancy_noc', 'meeting_resolution')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR COALESCE(p_offset, 0) < 0
  THEN
    RAISE EXCEPTION 'The source filter is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_source_type = 'document_version' THEN
    SELECT count(*)::integer INTO total
    FROM public.document_versions AS version
    JOIN public.documents AS document
      ON document.society_id = version.society_id AND document.id = version.document_id
    LEFT JOIN public.document_folders AS folder
      ON folder.society_id = document.society_id AND folder.id = document.folder_id
    WHERE version.society_id = p_society_id
      AND private.document_user_can_see_version(p_society_id, auth.uid(), version.id)
      AND (p_kind <> 'house_rule' OR document.folder_id IS NOT NULL)
      AND (
        p_kind = 'amendment'
        OR (
          document.archived_at IS NULL
          AND version.archived_at IS NULL
          AND (document.folder_id IS NULL OR folder.archived_at IS NULL)
          AND version.id = private.document_current_version_id(p_society_id, document.id)
        )
      );
    SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinal), '[]'::jsonb) INTO items
    FROM (
      SELECT row_number() OVER (
        ORDER BY document.updated_at DESC, version.version_number DESC, version.id
      ) AS ordinal,
      jsonb_build_object(
        'kind', 'document_version',
        'id', version.id,
        'documentId', document.id,
        'title', document.title,
        'fileName', version.file_name,
        'versionNumber', version.version_number,
        'scope', CASE WHEN document.folder_id IS NULL THEN 'unit' ELSE 'society_folder' END,
        'historical', document.archived_at IS NOT NULL OR version.archived_at IS NOT NULL
      ) AS value
      FROM public.document_versions AS version
      JOIN public.documents AS document
        ON document.society_id = version.society_id AND document.id = version.document_id
      LEFT JOIN public.document_folders AS folder
        ON folder.society_id = document.society_id AND folder.id = document.folder_id
      WHERE version.society_id = p_society_id
        AND private.document_user_can_see_version(p_society_id, auth.uid(), version.id)
        AND (p_kind <> 'house_rule' OR document.folder_id IS NOT NULL)
        AND (
          p_kind = 'amendment'
          OR (
            document.archived_at IS NULL
            AND version.archived_at IS NULL
            AND (document.folder_id IS NULL OR folder.archived_at IS NULL)
            AND version.id = private.document_current_version_id(p_society_id, document.id)
          )
        )
      ORDER BY document.updated_at DESC, version.version_number DESC, version.id
      LIMIT p_limit OFFSET COALESCE(p_offset, 0)
    ) AS item;
  ELSIF p_source_type = 'tenancy_noc' THEN
    IF NOT private.module_enabled(p_society_id, 'tenancy') OR p_kind = 'house_rule' THEN
      RAISE EXCEPTION 'This source is unavailable.' USING ERRCODE = '42501';
    END IF;
    SELECT count(*)::integer INTO total
    FROM public.tenancy_documents AS document
    WHERE document.society_id = p_society_id
      AND document.kind = 'noc'
      AND document.deleted_at IS NULL
      AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
      AND private.document_governance_user_can_read_noc(p_society_id, auth.uid(), document.id);
    SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinal), '[]'::jsonb) INTO items
    FROM (
      SELECT row_number() OVER (ORDER BY document.created_at DESC, document.id) AS ordinal,
        jsonb_build_object(
          'kind', 'tenancy_noc',
          'id', document.id,
          'moveId', document.move_id,
          'title', 'Tenancy NOC',
          'issuedAt', document.created_at,
          'historical', false
        ) AS value
      FROM public.tenancy_documents AS document
      WHERE document.society_id = p_society_id
        AND document.kind = 'noc'
        AND document.deleted_at IS NULL
        AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
        AND private.document_governance_user_can_read_noc(p_society_id, auth.uid(), document.id)
      ORDER BY document.created_at DESC, document.id
      LIMIT p_limit OFFSET COALESCE(p_offset, 0)
    ) AS item;
  ELSE
    IF NOT private.module_enabled(p_society_id, 'meeting') OR p_kind NOT IN ('amendment', 'house_rule') THEN
      RAISE EXCEPTION 'This source is unavailable.' USING ERRCODE = '42501';
    END IF;
    SELECT count(*)::integer INTO total
    FROM public.meeting_resolutions AS resolution
    WHERE resolution.society_id = p_society_id;
    SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinal), '[]'::jsonb) INTO items
    FROM (
      SELECT row_number() OVER (ORDER BY resolution.updated_at DESC, resolution.id) AS ordinal,
        jsonb_build_object(
          'kind', 'meeting_resolution',
          'id', resolution.id,
          'meetingId', resolution.meeting_id,
          'title', resolution.title,
          'outcome', resolution.outcome,
          'versionNumber', resolution.version,
          'historical', false
        ) AS value
      FROM public.meeting_resolutions AS resolution
      WHERE resolution.society_id = p_society_id
      ORDER BY resolution.updated_at DESC, resolution.id
      LIMIT p_limit OFFSET COALESCE(p_offset, 0)
    ) AS item;
  END IF;
  RETURN jsonb_build_object('total', COALESCE(total, 0), 'items', items);
END;
$$;

CREATE FUNCTION public.document_governance_list(
  p_society_id uuid, p_kind text, p_include_archived boolean, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  items jsonb;
  total integer;
BEGIN
  PERFORM private.document_governance_authorize(p_society_id, false);
  IF (p_kind IS NOT NULL AND p_kind NOT IN ('validity', 'register', 'amendment', 'house_rule'))
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR COALESCE(p_offset, 0) < 0
  THEN
    RAISE EXCEPTION 'The governance list filter is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT count(*)::integer INTO total
  FROM public.document_governance_records AS record
  WHERE record.society_id = p_society_id
    AND (p_kind IS NULL OR record.kind = p_kind)
    AND (COALESCE(p_include_archived, false) OR record.archived_at IS NULL)
    AND private.document_governance_user_can_read_record(p_society_id, auth.uid(), record.id);
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinal), '[]'::jsonb) INTO items
  FROM (
    SELECT row_number() OVER (ORDER BY record.updated_at DESC, record.id) AS ordinal,
      private.document_governance_json(p_society_id, record) AS value
    FROM public.document_governance_records AS record
    WHERE record.society_id = p_society_id
      AND (p_kind IS NULL OR record.kind = p_kind)
      AND (COALESCE(p_include_archived, false) OR record.archived_at IS NULL)
      AND private.document_governance_user_can_read_record(p_society_id, auth.uid(), record.id)
    ORDER BY record.updated_at DESC, record.id
    LIMIT p_limit OFFSET COALESCE(p_offset, 0)
  ) AS item;
  RETURN jsonb_build_object(
    'total', COALESCE(total, 0),
    'items', items,
    'settings', jsonb_build_object(
      'expiryRemindersEnabled', COALESCE((
        SELECT (config.settings ->> 'expiry_reminders_enabled')::boolean
        FROM public.module_configs AS config
        WHERE config.society_id = p_society_id AND config.module_key = 'document'
      ), false)
    ),
    'tenancyEnabled', private.module_enabled(p_society_id, 'tenancy'),
    'meetingEnabled', private.module_enabled(p_society_id, 'meeting')
  );
END;
$$;

CREATE FUNCTION public.document_governance_get(p_society_id uuid, p_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  record public.document_governance_records;
BEGIN
  PERFORM private.document_governance_authorize(p_society_id, false);
  SELECT * INTO record FROM public.document_governance_records
  WHERE society_id = p_society_id AND id = p_record_id;
  IF NOT FOUND OR NOT private.document_governance_user_can_read_record(
    p_society_id, auth.uid(), p_record_id
  ) THEN
    RAISE EXCEPTION 'Governance record not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN private.document_governance_json(p_society_id, record);
END;
$$;

CREATE FUNCTION private.document_governance_assert_edit(
  p_kind text, p_state text, p_source jsonb, p_details jsonb, p_record_id uuid
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  child_count integer;
BEGIN
  IF jsonb_typeof(p_details) <> 'object' THEN
    RAISE EXCEPTION 'The record details are invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_state NOT IN ('draft', 'verified') THEN
    RAISE EXCEPTION 'Choose draft or verified.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'house_rule' AND jsonb_typeof(p_details -> 'text') = 'string'
    AND char_length(p_details ->> 'text') > 5000
  THEN
    RAISE EXCEPTION 'House-rule text is limited to 5,000 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_state = 'verified' AND (
    p_source IS NULL OR p_source = '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Verified records need authorized evidence.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'house_rule' AND COALESCE(p_source ->> 'kind', '') <> 'document_version'
    AND p_state = 'verified'
  THEN
    RAISE EXCEPTION 'House rules need a society-folder document.' USING ERRCODE = '22023';
  END IF;
  IF p_record_id IS NOT NULL THEN
    SELECT count(*)::integer INTO child_count
    FROM public.document_governance_revisions
    WHERE record_id = p_record_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.document_governance_assert_edit(text, text, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.document_governance_save(
  p_society_id uuid, p_record_id uuid, p_kind text, p_title text, p_state text,
  p_document_version_id uuid, p_tenancy_document_id uuid, p_resolution_id uuid,
  p_approving_resolution_id uuid, p_details jsonb, p_expected_version integer, p_reason text,
  p_client_request_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  record public.document_governance_records;
  previous_values jsonb;
  source jsonb;
  approving_resolution jsonb;
  v_id uuid;
  changed_fields text[] := ARRAY['title', 'state', 'source', 'details'];
  before_source text[];
  after_source text[];
  action text := 'update';
BEGIN
  PERFORM private.document_governance_write_begin(p_society_id, p_request_id);
  IF p_kind IS NULL OR p_kind NOT IN ('validity', 'register', 'amendment', 'house_rule')
    OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 160
    OR p_client_request_id IS NULL OR jsonb_typeof(p_details) <> 'object'
    OR (p_record_id IS NULL) <> (p_expected_version IS NULL)
  THEN
    RAISE EXCEPTION 'The governance record is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_approving_resolution_id IS NOT NULL AND p_kind <> 'house_rule' THEN
    RAISE EXCEPTION 'Only house rules accept an approving decision.' USING ERRCODE = '22023';
  END IF;
  IF p_record_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'document-governance-create:' || p_society_id::text || ':' || auth.uid()::text
        || ':' || p_client_request_id::text, 0
    ));
    SELECT * INTO record FROM public.document_governance_records
    WHERE society_id = p_society_id
      AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF FOUND THEN
      RETURN private.document_governance_json(p_society_id, record);
    END IF;
  END IF;
  source := private.document_governance_source_snapshot(
    p_society_id, p_kind, p_document_version_id, p_tenancy_document_id, p_resolution_id, p_details
  );
  PERFORM private.document_governance_assert_edit(
    p_kind, p_state, source, p_details, p_record_id
  );
  IF p_kind = 'house_rule' AND p_approving_resolution_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'resolutionId', resolution.id,
      'meetingId', resolution.meeting_id,
      'title', resolution.title,
      'version', resolution.version,
      'outcome', resolution.outcome
    ) INTO approving_resolution
    FROM public.meeting_resolutions AS resolution
    WHERE resolution.society_id = p_society_id
      AND resolution.id = p_approving_resolution_id
      AND private.module_enabled(p_society_id, 'meeting');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Approving decision not found.' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_kind = 'house_rule' AND p_state = 'verified' THEN
    RAISE EXCEPTION 'Choose the approving meeting decision before verifying.' USING ERRCODE = '22023';
  END IF;
  IF p_record_id IS NULL THEN
    action := 'create';
    v_id := gen_random_uuid();
    INSERT INTO public.document_governance_records (
      id, society_id, kind, title, state, source_document_version_id,
      source_tenancy_document_id, source_resolution_id, source_kind,
      source_version, source_outcome, source_snapshot, source_unavailable_at,
      client_request_id, created_by, updated_by
    ) VALUES (
      v_id, p_society_id, p_kind, btrim(p_title), p_state,
      p_document_version_id, p_tenancy_document_id, p_resolution_id,
      NULLIF(source ->> 'kind', ''),
      COALESCE(NULLIF(source ->> 'versionNumber', '')::integer,
        NULLIF(source ->> 'version', '')::integer),
      NULLIF(source ->> 'outcome', ''),
      source, NULL, p_client_request_id, auth.uid(), auth.uid()
    );
  ELSE
    SELECT * INTO record FROM public.document_governance_records
    WHERE society_id = p_society_id AND id = p_record_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Governance record not found.' USING ERRCODE = 'P0002';
    END IF;
    IF record.kind <> p_kind THEN
      RAISE EXCEPTION 'The record kind cannot change.' USING ERRCODE = '23514';
    END IF;
    IF record.version <> p_expected_version THEN
      RAISE EXCEPTION 'This governance record changed. Refresh and retry.' USING ERRCODE = '40001';
    END IF;
    IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Give a reason for the correction.' USING ERRCODE = '22023';
    END IF;
    IF p_state <> record.state THEN action := CASE WHEN p_state = 'verified' THEN 'verify' ELSE 'update' END; END IF;
    previous_values := private.document_governance_snapshot(p_society_id, p_record_id);
    before_source := ARRAY[record.source_kind]::text[];
    after_source := ARRAY[source ->> 'kind']::text[];
    IF p_kind = 'house_rule' AND EXISTS (
      SELECT 1 FROM public.document_house_rules
      WHERE society_id = p_society_id AND record_id = record.id
        AND approving_resolution_id IS NOT NULL
    ) THEN
      before_source := array_append(before_source, 'meeting_resolution');
    END IF;
    IF p_approving_resolution_id IS NOT NULL THEN
      after_source := array_append(after_source, 'meeting_resolution');
    END IF;
    v_id := record.id;
    UPDATE public.document_governance_records
    SET title = btrim(p_title), state = p_state,
      source_document_version_id = p_document_version_id,
      source_tenancy_document_id = p_tenancy_document_id,
      source_resolution_id = p_resolution_id,
      source_kind = NULLIF(source ->> 'kind', ''),
      source_version = COALESCE(NULLIF(source ->> 'versionNumber', '')::integer,
        NULLIF(source ->> 'version', '')::integer),
      source_outcome = NULLIF(source ->> 'outcome', ''),
      source_snapshot = source, source_unavailable_at = NULL,
      version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE id = p_record_id;
  END IF;

  IF p_kind = 'validity' THEN
    INSERT INTO public.document_validities (
      society_id, record_id, issuing_authority, reference, issue_date, expiry_kind, expiry_date
    ) VALUES (
      p_society_id, v_id,
      private.document_governance_clean_text(p_details ->> 'issuingAuthority', 200, 'an issuing authority', false),
      private.document_governance_clean_text(p_details ->> 'reference', 200, 'a reference', false),
      private.document_governance_date(p_details ->> 'issueDate', 'issue date', false),
      COALESCE(NULLIF(p_details ->> 'expiryKind', ''), 'unknown'),
      private.document_governance_date(
        p_details ->> 'expiryDate', 'expiry date',
        p_state = 'verified' AND p_details ->> 'expiryKind' = 'dated'
      )
    )
    ON CONFLICT (society_id, record_id) DO UPDATE SET
      issuing_authority = EXCLUDED.issuing_authority,
      reference = EXCLUDED.reference,
      issue_date = EXCLUDED.issue_date,
      expiry_kind = EXCLUDED.expiry_kind,
      expiry_date = EXCLUDED.expiry_date,
      reminder_cycle_date = CASE
        WHEN public.document_validities.expiry_date IS DISTINCT FROM EXCLUDED.expiry_date THEN NULL
        ELSE public.document_validities.reminder_cycle_date END,
      reminder_last_milestone = CASE
        WHEN public.document_validities.expiry_date IS DISTINCT FROM EXCLUDED.expiry_date THEN NULL
        ELSE public.document_validities.reminder_last_milestone END;
  ELSIF p_kind = 'register' THEN
    INSERT INTO public.document_register_indexes (
      society_id, record_id, register_name, register_type, applicability_basis,
      maintenance_state, clause_or_page, format, physical_location, custodian, review_date
    ) VALUES (
      p_society_id, v_id,
      private.document_governance_clean_text(p_details ->> 'name', 160, 'a register name', p_state = 'verified'),
      private.document_governance_clean_text(p_details ->> 'type', 120, 'a register type', p_state = 'verified'),
      private.document_governance_clean_text(p_details ->> 'basis', 500, 'a source or applicability basis', p_state = 'verified'),
      CASE WHEN NULLIF(p_details ->> 'maintenanceState', '') IS NULL THEN NULL
        ELSE p_details ->> 'maintenanceState' END,
      private.document_governance_clean_text(p_details ->> 'clauseOrPage', 200, 'a clause or page', false),
      private.document_governance_clean_text(p_details ->> 'format', 200, 'a format', false),
      private.document_governance_clean_text(p_details ->> 'physicalLocation', 200, 'a physical location', false),
      private.document_governance_clean_text(p_details ->> 'custodian', 200, 'a custodian', false),
      private.document_governance_date(p_details ->> 'reviewDate', 'review date', false)
    )
    ON CONFLICT (society_id, record_id) DO UPDATE SET
      register_name = EXCLUDED.register_name, register_type = EXCLUDED.register_type,
      applicability_basis = EXCLUDED.applicability_basis, maintenance_state = EXCLUDED.maintenance_state,
      clause_or_page = EXCLUDED.clause_or_page, format = EXCLUDED.format,
      physical_location = EXCLUDED.physical_location, custodian = EXCLUDED.custodian,
      review_date = EXCLUDED.review_date;
  ELSIF p_kind = 'amendment' THEN
    INSERT INTO public.document_amendment_milestones (
      society_id, record_id, milestone_type, milestone_date, note, historical_evidence
    ) VALUES (
      p_society_id, v_id,
      COALESCE(NULLIF(p_details ->> 'milestoneType', ''), 'meeting'),
      private.document_governance_date(p_details ->> 'milestoneDate', 'milestone date', p_state = 'verified'),
      private.document_governance_clean_text(p_details ->> 'note', 500, 'a note', false),
      COALESCE((p_details ->> 'historicalEvidence')::boolean, false)
    )
    ON CONFLICT (society_id, record_id) DO UPDATE SET
      milestone_type = EXCLUDED.milestone_type, milestone_date = EXCLUDED.milestone_date,
      note = EXCLUDED.note, historical_evidence = EXCLUDED.historical_evidence;
  ELSE
    INSERT INTO public.document_house_rules (
      society_id, record_id, rule_text, approval_date, effective_date,
      approving_resolution_id, approving_resolution_version,
      approving_resolution_outcome, approving_resolution_snapshot,
      approving_resolution_unavailable_at
    ) VALUES (
      p_society_id, v_id,
      private.document_governance_clean_text(p_details ->> 'text', 5000, 'house-rule text', p_state = 'verified'),
      private.document_governance_date(p_details ->> 'approvalDate', 'approval date', false),
      private.document_governance_date(p_details ->> 'effectiveDate', 'effective date', false),
      p_approving_resolution_id,
      (approving_resolution ->> 'version')::integer,
      approving_resolution ->> 'outcome',
      COALESCE(approving_resolution, '{}'::jsonb),
      NULL
    )
    ON CONFLICT (society_id, record_id) DO UPDATE SET
      rule_text = EXCLUDED.rule_text, approval_date = EXCLUDED.approval_date,
      effective_date = EXCLUDED.effective_date,
      approving_resolution_id = EXCLUDED.approving_resolution_id,
      approving_resolution_version = EXCLUDED.approving_resolution_version,
      approving_resolution_outcome = EXCLUDED.approving_resolution_outcome,
      approving_resolution_snapshot = EXCLUDED.approving_resolution_snapshot,
      approving_resolution_unavailable_at = NULL;
  END IF;

  IF action = 'create' THEN
    previous_values := '{}'::jsonb;
    before_source := '{}'::text[];
    after_source := ARRAY[source ->> 'kind']::text[];
    IF p_approving_resolution_id IS NOT NULL THEN
      after_source := array_append(after_source, 'meeting_resolution');
    END IF;
  END IF;
  INSERT INTO public.document_governance_revisions (
    society_id, record_id, action, previous_values, changed_fields,
    source_kinds_before, source_kinds_after, reason, request_id, created_by
  ) VALUES (
    p_society_id, v_id, action, previous_values, changed_fields,
    array_remove(before_source, NULL), array_remove(after_source, NULL),
    CASE WHEN action IN ('update', 'verify') THEN btrim(p_reason) END,
    p_request_id, auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE action
      WHEN 'create' THEN 'document.governance_create'
      WHEN 'verify' THEN 'document.governance_verify'
      ELSE 'document.governance_update'
    END,
    'document_governance_record', v_id::text,
    jsonb_build_object('kind', p_kind, 'state', p_state, 'changedFields', changed_fields),
    NULL, p_request_id
  );
  SELECT * INTO record FROM public.document_governance_records
  WHERE society_id = p_society_id AND id = v_id;
  RETURN private.document_governance_json(p_society_id, record);
END;
$$;

CREATE FUNCTION public.document_governance_set_archived(
  p_society_id uuid, p_record_id uuid, p_archived boolean,
  p_expected_version integer, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  record public.document_governance_records;
  previous_values jsonb;
  action text;
BEGIN
  PERFORM private.document_governance_write_begin(p_society_id, p_request_id);
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Give a reason for the archive change.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO record FROM public.document_governance_records
  WHERE society_id = p_society_id AND id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Governance record not found.' USING ERRCODE = 'P0002'; END IF;
  IF record.version <> p_expected_version THEN
    RAISE EXCEPTION 'This governance record changed. Refresh and retry.' USING ERRCODE = '40001';
  END IF;
  IF (record.archived_at IS NOT NULL) = p_archived THEN
    RETURN private.document_governance_json(p_society_id, record);
  END IF;
  previous_values := private.document_governance_snapshot(p_society_id, p_record_id);
  action := CASE WHEN p_archived THEN 'archive' ELSE 'restore' END;
  UPDATE public.document_governance_records
  SET archived_at = CASE WHEN p_archived THEN clock_timestamp() END,
    archived_by = CASE WHEN p_archived THEN auth.uid() END,
    state = CASE
      WHEN NOT p_archived AND record.state = 'needs_review' THEN 'needs_review'
      WHEN NOT p_archived THEN 'draft'
      ELSE record.state
    END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_record_id;
  INSERT INTO public.document_governance_revisions (
    society_id, record_id, action, previous_values, changed_fields,
    source_kinds_before, source_kinds_after, reason, request_id, created_by
  ) VALUES (
    p_society_id, p_record_id, action, previous_values, ARRAY['archivedAt'],
    CASE WHEN record.source_kind IS NULL THEN '{}'::text[] ELSE ARRAY[record.source_kind] END,
    CASE WHEN record.source_kind IS NULL THEN '{}'::text[] ELSE ARRAY[record.source_kind] END,
    btrim(p_reason), p_request_id, auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    'document.governance_' || action, 'document_governance_record', p_record_id::text,
    jsonb_build_object('archived', p_archived), p_request_id
  );
  SELECT * INTO record FROM public.document_governance_records
  WHERE society_id = p_society_id AND id = p_record_id;
  RETURN private.document_governance_json(p_society_id, record);
END;
$$;

CREATE FUNCTION public.document_house_rule_publish(
  p_society_id uuid, p_record_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  record public.document_governance_records;
  rule public.document_house_rules;
  previous_values jsonb;
BEGIN
  PERFORM private.document_governance_write_begin(p_society_id, p_request_id);
  SELECT * INTO record FROM public.document_governance_records
  WHERE society_id = p_society_id AND id = p_record_id AND kind = 'house_rule'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'House rule not found.' USING ERRCODE = 'P0002'; END IF;
  IF record.version <> p_expected_version THEN
    RAISE EXCEPTION 'This house rule changed. Refresh and retry.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO rule FROM public.document_house_rules
  WHERE society_id = p_society_id AND record_id = p_record_id FOR UPDATE;
  IF rule.gate_locked THEN
    RAISE EXCEPTION 'House-rule publication is locked pending qualified review.'
      USING ERRCODE = '23514';
  END IF;
  IF record.archived_at IS NOT NULL OR record.state <> 'verified'
    OR rule.rule_text IS NULL OR rule.approval_date IS NULL OR rule.effective_date IS NULL
    OR rule.approving_resolution_id IS NULL
    OR record.source_kind <> 'document_version'
    OR record.source_document_version_id IS NULL
  THEN
    RAISE EXCEPTION 'Complete and verify the source-backed rule before publishing.'
      USING ERRCODE = '23514';
  END IF;
  IF private.document_governance_source_json(p_society_id, record) ->> 'state' <> 'available'
    OR NOT EXISTS (
      SELECT 1 FROM public.meeting_resolutions AS resolution
      WHERE resolution.society_id = p_society_id
        AND resolution.id = rule.approving_resolution_id
        AND resolution.version = rule.approving_resolution_version
        AND resolution.outcome = 'passed'
        AND resolution.outcome = rule.approving_resolution_outcome
        AND resolution.body = rule.rule_text
    )
  THEN
    RAISE EXCEPTION 'Review the house-rule source and passed decision before publishing.'
      USING ERRCODE = '23514';
  END IF;
  previous_values := private.document_governance_snapshot(p_society_id, p_record_id);
  UPDATE public.document_house_rules
  SET publication_state = 'published', published_at = clock_timestamp(),
    published_by = auth.uid()
  WHERE society_id = p_society_id AND record_id = p_record_id;
  UPDATE public.document_governance_records
  SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_record_id;
  INSERT INTO public.document_governance_revisions (
    society_id, record_id, action, previous_values, changed_fields,
    source_kinds_before, source_kinds_after, reason, request_id, created_by
  ) VALUES (
    p_society_id, p_record_id, 'update',
    previous_values,
    ARRAY['publicationState'], ARRAY['document_version', 'meeting_resolution'],
    ARRAY['document_version', 'meeting_resolution'], NULL, p_request_id, auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'document.house_rule_publish',
    'document_governance_record', p_record_id::text,
    jsonb_build_object('publicationState', 'published'), p_request_id
  );
  SELECT * INTO record FROM public.document_governance_records
  WHERE society_id = p_society_id AND id = p_record_id;
  RETURN private.document_governance_json(p_society_id, record);
END;
$$;

CREATE FUNCTION public.document_house_rules_published_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  items jsonb;
BEGIN
  PERFORM private.document_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  IF NOT private.module_enabled(p_society_id, 'meeting') THEN
    RETURN jsonb_build_object('items', '[]'::jsonb);
  END IF;
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinal), '[]'::jsonb) INTO items
  FROM (
    SELECT row_number() OVER (ORDER BY rule.effective_date DESC, record.id) AS ordinal,
      jsonb_build_object(
        'id', record.id,
        'title', record.title,
        'text', rule.rule_text,
        'approvalDate', rule.approval_date,
        'effectiveDate', rule.effective_date,
        'sourceTitle', record.source_snapshot ->> 'title'
      ) AS value
    FROM public.document_house_rules AS rule
    JOIN public.document_governance_records AS record
      ON record.society_id = rule.society_id AND record.id = rule.record_id
    JOIN public.document_versions AS source_version
      ON source_version.society_id = record.society_id
      AND source_version.id = record.source_document_version_id
    JOIN public.documents AS source_document
      ON source_document.society_id = source_version.society_id
      AND source_document.id = source_version.document_id
    JOIN public.document_folders AS source_folder
      ON source_folder.society_id = source_document.society_id
      AND source_folder.id = source_document.folder_id
    JOIN public.meeting_resolutions AS resolution
      ON resolution.society_id = rule.society_id
      AND resolution.id = rule.approving_resolution_id
    WHERE rule.society_id = p_society_id
      AND rule.gate_locked = false
      AND rule.publication_state = 'published'
      AND record.archived_at IS NULL
      AND record.state = 'verified'
      AND record.source_kind = 'document_version'
      AND source_document.folder_id IS NOT NULL
      AND source_document.archived_at IS NULL
      AND source_folder.archived_at IS NULL
      AND source_version.archived_at IS NULL
      AND source_version.id = private.document_current_version_id(
        p_society_id, source_document.id
      )
      AND private.document_user_can_see(
        p_society_id, auth.uid(), source_document.id
      )
      AND resolution.version = rule.approving_resolution_version
      AND resolution.outcome = 'passed'
      AND resolution.outcome = rule.approving_resolution_outcome
      AND resolution.body = rule.rule_text
      AND rule.approving_resolution_unavailable_at IS NULL
    ORDER BY rule.effective_date DESC, record.id
  ) AS item;
  RETURN jsonb_build_object('items', items);
END;
$$;

CREATE FUNCTION public.document_governance_history(
  p_society_id uuid, p_record_id uuid, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  total integer;
  items jsonb;
BEGIN
  PERFORM private.document_governance_authorize(p_society_id, true);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR COALESCE(p_offset, 0) < 0 THEN
    RAISE EXCEPTION 'The history page is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.document_governance_records
    WHERE society_id = p_society_id AND id = p_record_id
      AND (source_tenancy_document_id IS NULL OR private.module_enabled(p_society_id, 'tenancy'))
      AND (source_kind <> 'meeting_resolution' OR private.module_enabled(p_society_id, 'meeting'))
      AND NOT EXISTS (
        SELECT 1 FROM public.document_house_rules AS rule
        WHERE rule.society_id = document_governance_records.society_id
          AND rule.record_id = document_governance_records.id
          AND NOT private.module_enabled(p_society_id, 'meeting')
      )
  ) OR NOT private.module_enabled(p_society_id, 'tenancy') AND EXISTS (
    SELECT 1 FROM public.document_governance_revisions AS revision
    WHERE revision.society_id = p_society_id AND revision.record_id = p_record_id
      AND 'tenancy_noc' = ANY(revision.source_kinds_before || revision.source_kinds_after)
  ) OR NOT private.module_enabled(p_society_id, 'meeting') AND EXISTS (
    SELECT 1 FROM public.document_governance_revisions AS revision
    WHERE revision.society_id = p_society_id AND revision.record_id = p_record_id
      AND 'meeting_resolution' = ANY(revision.source_kinds_before || revision.source_kinds_after)
  ) THEN
    RAISE EXCEPTION 'Governance history not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT count(*)::integer INTO total
  FROM public.document_governance_revisions
  WHERE society_id = p_society_id AND record_id = p_record_id;
  SELECT COALESCE(jsonb_agg(page.value ORDER BY page.ordinal), '[]'::jsonb) INTO items
  FROM (
    SELECT row_number() OVER (ORDER BY revision.created_at DESC, revision.id) AS ordinal,
      jsonb_build_object(
        'id', revision.id, 'action', revision.action, 'changedFields', revision.changed_fields,
        'reason', revision.reason, 'createdAt', revision.created_at,
        'actorName', NULLIF(btrim(profile.full_name), ''),
        'previousValues', revision.previous_values
      ) AS value
    FROM public.document_governance_revisions AS revision
    LEFT JOIN public.profiles AS profile ON profile.id = revision.created_by
    WHERE revision.society_id = p_society_id AND revision.record_id = p_record_id
    ORDER BY revision.created_at DESC, revision.id
    LIMIT p_limit OFFSET COALESCE(p_offset, 0)
  ) AS page;
  RETURN jsonb_build_object('total', total, 'items', items);
END;
$$;

CREATE FUNCTION public.document_settings_update(
  p_society_id uuid, p_expiry_reminders_enabled boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  next_settings jsonb;
BEGIN
  PERFORM private.document_governance_write_begin(p_society_id, p_request_id);
  SELECT settings || jsonb_build_object(
    'expiry_reminders_enabled', COALESCE(p_expiry_reminders_enabled, false)
  ) INTO next_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'document';
  IF next_settings IS NULL THEN
    RAISE EXCEPTION 'Documents are disabled.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.module_configs
  SET settings = next_settings, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'document';
  IF NOT FOUND THEN RAISE EXCEPTION 'Documents are disabled.' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'document.settings_update',
    'module_config', 'document', next_settings, p_request_id
  );
  RETURN next_settings;
END;
$$;

CREATE FUNCTION public.document_expiry_reminders_run(
  p_society_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target record;
  recipient record;
  local_today date;
  milestone integer;
  previous_rank integer;
  next_rank integer;
  recipient_count integer;
  sent_count integer := 0;
BEGIN
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
    OR NOT private.module_enabled(p_society_id, 'document')
    OR NOT private.society_writable(p_society_id)
    OR NOT COALESCE((
      SELECT (config.settings ->> 'expiry_reminders_enabled')::boolean
      FROM public.module_configs AS config
      WHERE config.society_id = p_society_id AND config.module_key = 'document'
    ), false)
  THEN
    RETURN 0;
  END IF;
  SELECT (clock_timestamp() AT TIME ZONE society.timezone)::date INTO local_today
  FROM public.societies AS society WHERE society.id = p_society_id;
  FOR target IN
    SELECT record, validity
    FROM public.document_governance_records AS record
    JOIN public.document_validities AS validity
      ON validity.society_id = record.society_id AND validity.record_id = record.id
    WHERE record.society_id = p_society_id
      AND record.state = 'verified'
      AND record.archived_at IS NULL
      AND validity.expiry_kind = 'dated'
      AND validity.expiry_date <= local_today + 30
    ORDER BY validity.expiry_date, record.id
    LIMIT 2000
    FOR UPDATE OF validity SKIP LOCKED
  LOOP
    milestone := CASE
      WHEN (target.validity).expiry_date <= local_today THEN 0
      WHEN (target.validity).expiry_date <= local_today + 7 THEN 7
      ELSE 30
    END;
    previous_rank := CASE (target.validity).reminder_last_milestone
      WHEN 30 THEN 1 WHEN 7 THEN 2 WHEN 0 THEN 3 ELSE 0 END;
    next_rank := CASE milestone WHEN 30 THEN 1 WHEN 7 THEN 2 WHEN 0 THEN 3 END;
    IF (target.validity).reminder_cycle_date = (target.validity).expiry_date
      AND previous_rank >= next_rank
    THEN
      CONTINUE;
    END IF;
    recipient_count := 0;
    FOR recipient IN
      SELECT membership.user_id
      FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND membership.user_id IS NOT NULL
        AND 'admin' = ANY(membership.roles)
        AND CASE (target.record).source_kind
          WHEN 'tenancy_noc' THEN private.document_governance_user_can_read_noc(
            p_society_id, membership.user_id, (target.record).source_tenancy_document_id
          )
          WHEN 'document_version' THEN private.document_user_can_see_version(
            p_society_id, membership.user_id, (target.record).source_document_version_id
          )
          ELSE false
        END
      ORDER BY membership.id
      LIMIT 5000
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient.user_id, 'document_expiry_reminder',
        'Document date needs attention',
        'Review the sourced document date in Documents. This is a factual date, not a legal-compliance finding.',
        'document_governance_record', (target.record).id, p_request_trace
      );
      recipient_count := recipient_count + 1;
    END LOOP;
    IF recipient_count = 0 THEN CONTINUE; END IF;
    UPDATE public.document_validities
    SET reminder_cycle_date = expiry_date,
      reminder_last_milestone = milestone
    WHERE society_id = p_society_id AND record_id = (target.record).id;
    sent_count := sent_count + recipient_count;
  END LOOP;
  RETURN sent_count;
END;
$$;
REVOKE ALL ON FUNCTION public.document_expiry_reminders_run(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.document_expiry_reminders_run(uuid, text)
  TO service_role;

DO $$
DECLARE
  function_signature record;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'document_governance_sources_list', 'document_governance_list',
        'document_governance_get', 'document_governance_save',
        'document_governance_set_archived', 'document_house_rule_publish',
        'document_house_rules_published_list',
        'document_governance_history',
        'document_settings_update'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', function_signature.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_signature.signature);
  END LOOP;
END;
$$;
