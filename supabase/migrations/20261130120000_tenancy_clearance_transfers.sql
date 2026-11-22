-- Add the P51 transfer tracker, conditional handovers and permanent numbered certificates.
CREATE OR REPLACE FUNCTION private.tenancy_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN (
        'police_verification_required',
        'clearance_handover_basis',
        'clearance_agreement_evidence'
      )
    )
    AND (NOT p_settings ? 'police_verification_required'
      OR jsonb_typeof(p_settings -> 'police_verification_required') = 'boolean')
    AND (NOT p_settings ? 'clearance_handover_basis'
      OR p_settings ->> 'clearance_handover_basis' IN ('bills', 'total'))
    AND (NOT p_settings ? 'clearance_agreement_evidence'
      OR p_settings ->> 'clearance_agreement_evidence' IN (
        'admin_note', 'signed_upload', 'in_app_and_upload'
      ))
$$;

CREATE TABLE public.tenancy_clearance_acknowledgements (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  warning_text text NOT NULL CHECK (
    warning_text = btrim(warning_text) AND char_length(warning_text) BETWEEN 1 AND 1000
    AND position('not legal advice' IN lower(warning_text)) > 0
    AND position('not proof of title transfer' IN lower(warning_text)) > 0
    AND position('state act or bye-laws' IN lower(warning_text)) > 0
  ),
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  acknowledged_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id, acknowledged_by, client_request_id)
);

CREATE TABLE public.tenancy_transfer_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN (
    'received', 'documents_checked', 'committee_decision', 'dues_settled',
    'completed', 'rejected', 'withdrawn'
  )),
  received_on date NOT NULL,
  documents_checked_on date,
  committee_decision_on date,
  dues_settled_on date,
  completed_on date,
  rejected_on date,
  withdrawn_on date,
  closing_reason text CHECK (
    char_length(btrim(closing_reason)) BETWEEN 1 AND 500
  ),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  certificate_preparation jsonb,
  CONSTRAINT tenancy_transfer_cases_unit_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_transfer_cases_stage_dates_check CHECK (
    (stage = 'rejected') = (rejected_on IS NOT NULL)
    AND (stage = 'withdrawn') = (withdrawn_on IS NOT NULL)
    AND ((stage IN ('rejected', 'withdrawn')) = (closing_reason IS NOT NULL))
    AND (documents_checked_on IS NULL OR documents_checked_on >= received_on)
    AND (committee_decision_on IS NULL OR committee_decision_on >= received_on)
    AND (dues_settled_on IS NULL OR dues_settled_on >= received_on)
    AND (completed_on IS NULL OR completed_on >= received_on)
  ),
  CONSTRAINT tenancy_transfer_cases_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT tenancy_transfer_cases_client_request_key
    UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX tenancy_transfer_cases_open_unit_idx
  ON public.tenancy_transfer_cases (society_id, unit_id)
  WHERE stage NOT IN ('completed', 'rejected', 'withdrawn');
CREATE INDEX tenancy_transfer_cases_scope_idx
  ON public.tenancy_transfer_cases (society_id, stage, received_on DESC, id);
CREATE INDEX tenancy_transfer_cases_created_by_idx
  ON public.tenancy_transfer_cases (created_by);
CREATE INDEX tenancy_transfer_cases_updated_by_idx
  ON public.tenancy_transfer_cases (updated_by);

CREATE TABLE public.tenancy_transfer_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  case_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('seller', 'buyer')),
  membership_id uuid,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 200),
  phone text CHECK (phone IS NULL OR (phone = btrim(phone) AND char_length(phone) BETWEEN 7 AND 30)),
  email text CHECK (email IS NULL OR (
    email = btrim(email) AND lower(email) = email AND char_length(email) BETWEEN 3 AND 254
    AND position('@' IN email) > 1
  )),
  active boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_transfer_parties_case_fkey
    FOREIGN KEY (society_id, case_id)
    REFERENCES public.tenancy_transfer_cases (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_transfer_parties_membership_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_transfer_parties_contact_check
    CHECK (role = 'seller' OR phone IS NOT NULL OR email IS NOT NULL OR membership_id IS NOT NULL
      OR name IS NOT NULL),
  CONSTRAINT tenancy_transfer_parties_supersede_check
    CHECK ((active) = (superseded_at IS NULL)),
  UNIQUE (society_id, id),
  UNIQUE (society_id, case_id, id)
);
CREATE UNIQUE INDEX tenancy_transfer_parties_one_buyer_idx
  ON public.tenancy_transfer_parties (society_id, case_id)
  WHERE role = 'buyer' AND active;
CREATE UNIQUE INDEX tenancy_transfer_parties_member_idx
  ON public.tenancy_transfer_parties (society_id, case_id, membership_id, role)
  WHERE membership_id IS NOT NULL AND active;
CREATE INDEX tenancy_transfer_parties_case_idx
  ON public.tenancy_transfer_parties (society_id, case_id, role, id);
CREATE INDEX tenancy_transfer_parties_membership_idx
  ON public.tenancy_transfer_parties (society_id, membership_id);

CREATE TABLE public.tenancy_transfer_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  case_id uuid NOT NULL UNIQUE,
  decision text NOT NULL CHECK (
    decision IN ('approved', 'approved_with_conditions', 'rejected', 'deferred')
  ),
  resolution_reference text NOT NULL CHECK (
    resolution_reference = btrim(resolution_reference) AND char_length(resolution_reference) BETWEEN 1 AND 120
  ),
  resolution_date date NOT NULL,
  meeting_id uuid,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT tenancy_transfer_decisions_case_fkey
    FOREIGN KEY (society_id, case_id)
    REFERENCES public.tenancy_transfer_cases (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_transfer_decisions_meeting_fkey
    FOREIGN KEY (society_id, meeting_id)
    REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, case_id, id),
  UNIQUE (society_id, updated_by, client_request_id),
  CONSTRAINT tenancy_transfer_decisions_conditions_check
    CHECK (jsonb_typeof(conditions) = 'array')
);
CREATE INDEX tenancy_transfer_decisions_meeting_idx
  ON public.tenancy_transfer_decisions (society_id, meeting_id);

CREATE TABLE public.tenancy_clearance_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  move_id uuid,
  case_id uuid,
  unit_id uuid NOT NULL,
  basis text NOT NULL CHECK (basis IN ('bills', 'total')),
  evidence_mode text NOT NULL CHECK (
    evidence_mode IN ('admin_note', 'signed_upload', 'in_app_and_upload')
  ),
  dues_snapshot jsonb NOT NULL CHECK (jsonb_typeof(dues_snapshot) = 'object'),
  responsible_transfer_party_id uuid,
  responsible_membership_id uuid,
  responsible_role text NOT NULL CHECK (responsible_role IN ('tenant', 'owner', 'seller', 'buyer')),
  admin_note text CHECK (
    admin_note IS NULL OR (admin_note = btrim(admin_note) AND char_length(admin_note) BETWEEN 1 AND 2000)
  ),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'replaced')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  approval_reference text CHECK (
    approval_reference IS NULL OR (
      approval_reference = btrim(approval_reference) AND char_length(approval_reference) BETWEEN 1 AND 120
    )
  ),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_handovers_target_check CHECK (
    (move_id IS NULL) <> (case_id IS NULL)
  ),
  CONSTRAINT tenancy_clearance_handovers_responsible_check CHECK (
    (responsible_transfer_party_id IS NULL) <> (responsible_membership_id IS NULL)
    AND (move_id IS NULL OR (
      responsible_transfer_party_id IS NULL AND responsible_membership_id IS NOT NULL
      AND responsible_role IN ('tenant', 'owner')
    ))
    AND (case_id IS NULL OR (
      responsible_transfer_party_id IS NOT NULL AND responsible_membership_id IS NULL
      AND responsible_role IN ('seller', 'buyer')
    ))
  ),
  CONSTRAINT tenancy_clearance_handovers_approval_check CHECK (
    (status IN ('approved', 'replaced') AND approved_at IS NOT NULL
      AND approved_by IS NOT NULL AND approval_reference IS NOT NULL)
    OR (status = 'draft' AND approved_at IS NULL
      AND approved_by IS NULL AND approval_reference IS NULL)
  ),
  CONSTRAINT tenancy_clearance_handovers_move_fkey
    FOREIGN KEY (society_id, move_id)
    REFERENCES public.tenancy_moves (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_handovers_case_fkey
    FOREIGN KEY (society_id, case_id)
    REFERENCES public.tenancy_transfer_cases (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_handovers_unit_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_handovers_responsible_party_fkey
    FOREIGN KEY (society_id, case_id, responsible_transfer_party_id)
    REFERENCES public.tenancy_transfer_parties (society_id, case_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_handovers_responsible_member_fkey
    FOREIGN KEY (society_id, responsible_membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX tenancy_clearance_handovers_target_idx
  ON public.tenancy_clearance_handovers (society_id, move_id, case_id, status, created_at DESC);
CREATE INDEX tenancy_clearance_handovers_unit_idx
  ON public.tenancy_clearance_handovers (society_id, unit_id);
CREATE INDEX tenancy_clearance_handovers_created_by_idx
  ON public.tenancy_clearance_handovers (created_by);
CREATE INDEX tenancy_clearance_handovers_approved_by_idx
  ON public.tenancy_clearance_handovers (approved_by);

CREATE TABLE public.tenancy_clearance_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  transfer_party_id uuid,
  membership_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('tenant', 'owner', 'seller', 'buyer')),
  expected_version integer NOT NULL CHECK (expected_version > 0),
  consented_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consented_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_consents_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.tenancy_clearance_handovers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_consents_party_fkey
    FOREIGN KEY (society_id, transfer_party_id)
    REFERENCES public.tenancy_transfer_parties (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_consents_member_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, handover_id, membership_id, role)
);
CREATE INDEX tenancy_clearance_consents_handover_idx
  ON public.tenancy_clearance_consents (society_id, handover_id, consented_at, id);
CREATE INDEX tenancy_clearance_consents_member_idx
  ON public.tenancy_clearance_consents (society_id, membership_id);

CREATE TABLE public.tenancy_clearance_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  transfer_party_id uuid,
  membership_id uuid,
  path text NOT NULL UNIQUE CHECK (
    path = btrim(path) AND char_length(path) BETWEEN 1 AND 500
  ),
  content_type text NOT NULL CHECK (content_type IN (
    'application/pdf', 'image/jpeg', 'image/png'
  )),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_files_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.tenancy_clearance_handovers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_files_party_fkey
    FOREIGN KEY (society_id, transfer_party_id)
    REFERENCES public.tenancy_transfer_parties (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_files_member_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_clearance_files_covered_party_check CHECK (
    (transfer_party_id IS NULL) <> (membership_id IS NULL)
  ),
  UNIQUE (society_id, id)
);
CREATE INDEX tenancy_clearance_files_handover_idx
  ON public.tenancy_clearance_files (society_id, handover_id, created_at, id);
CREATE INDEX tenancy_clearance_files_created_by_idx
  ON public.tenancy_clearance_files (created_by);

CREATE TABLE public.tenancy_certificate_counters (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  financial_year text NOT NULL CHECK (
    financial_year ~ '^[0-9]{4}-[0-9]{2}$'
  ),
  last_sequence integer NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  PRIMARY KEY (society_id, financial_year)
);

CREATE TABLE public.tenancy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  move_id uuid,
  case_id uuid,
  kind text NOT NULL CHECK (kind IN ('clearance', 'conditional', 'not_checked')),
  financial_year text NOT NULL CHECK (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  source_version integer NOT NULL CHECK (source_version > 0),
  number text NOT NULL CHECK (
    number = btrim(number) AND number ~ '^NOC/[0-9]{4}-[0-9]{2}/[0-9]{4,}$'
  ),
  handover_id uuid,
  dues_snapshot jsonb NOT NULL CHECK (jsonb_typeof(dues_snapshot) = 'object'),
  parties_snapshot jsonb NOT NULL CHECK (jsonb_typeof(parties_snapshot) = 'array'),
  unit_snapshot jsonb NOT NULL CHECK (jsonb_typeof(unit_snapshot) = 'object'),
  purpose text NOT NULL CHECK (purpose = btrim(purpose) AND char_length(purpose) BETWEEN 1 AND 500),
  signatory_name text NOT NULL CHECK (
    signatory_name = btrim(signatory_name) AND char_length(signatory_name) BETWEEN 1 AND 200
  ),
  signatory_designation text NOT NULL CHECK (
    signatory_designation = btrim(signatory_designation) AND char_length(signatory_designation) BETWEEN 1 AND 200
  ),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  issued_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  path text NOT NULL UNIQUE CHECK (
    path = btrim(path) AND char_length(path) BETWEEN 1 AND 500
  ),
  byte_hash text NOT NULL CHECK (byte_hash ~ '^[0-9a-f]{64}$'),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  superseded_by uuid,
  supersede_reason text CHECK (
    supersede_reason IS NULL OR (
      supersede_reason = btrim(supersede_reason) AND char_length(supersede_reason) BETWEEN 1 AND 500
    )
  ),
  client_request_id uuid NOT NULL,
  CONSTRAINT tenancy_certificates_target_check CHECK (
    (move_id IS NULL) <> (case_id IS NULL)
  ),
  CONSTRAINT tenancy_certificates_handover_kind_check CHECK (
    (kind = 'conditional') = (handover_id IS NOT NULL)
  ),
  CONSTRAINT tenancy_certificates_supersede_check CHECK (
    (superseded_by IS NULL) = (supersede_reason IS NULL)
  ),
  CONSTRAINT tenancy_certificates_move_fkey
    FOREIGN KEY (society_id, move_id)
    REFERENCES public.tenancy_moves (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_certificates_case_fkey
    FOREIGN KEY (society_id, case_id)
    REFERENCES public.tenancy_transfer_cases (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_certificates_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.tenancy_clearance_handovers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_certificates_superseded_fkey
    FOREIGN KEY (society_id, superseded_by)
    REFERENCES public.tenancy_certificates (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, number),
  UNIQUE (society_id, financial_year, sequence_number),
  UNIQUE (society_id, issued_by, client_request_id)
);
CREATE INDEX tenancy_certificates_target_idx
  ON public.tenancy_certificates (society_id, case_id, move_id, issued_at DESC, id);
CREATE INDEX tenancy_certificates_handover_idx
  ON public.tenancy_certificates (society_id, handover_id);
CREATE INDEX tenancy_certificates_issued_by_idx
  ON public.tenancy_certificates (issued_by);

CREATE TABLE public.tenancy_transfer_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN (
    'transfer_case', 'transfer_decision', 'clearance_handover'
  )),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  previous_values jsonb NOT NULL CHECK (jsonb_typeof(previous_values) = 'object'),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  reason text CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT
);
CREATE INDEX tenancy_transfer_revisions_entity_idx
  ON public.tenancy_transfer_revisions (society_id, entity_type, entity_id, created_at DESC, id);
CREATE INDEX tenancy_transfer_revisions_created_by_idx
  ON public.tenancy_transfer_revisions (created_by);

ALTER TABLE public.tenancy_moves
  ADD COLUMN certificate_preparation jsonb,
  ADD CONSTRAINT tenancy_moves_certificate_preparation_check CHECK (
    certificate_preparation IS NULL OR jsonb_typeof(certificate_preparation) = 'object'
  );

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenancy_clearance_acknowledgements', 'tenancy_transfer_cases',
    'tenancy_transfer_parties', 'tenancy_transfer_decisions',
    'tenancy_clearance_handovers', 'tenancy_clearance_consents',
    'tenancy_clearance_files', 'tenancy_certificate_counters',
    'tenancy_certificates', 'tenancy_transfer_revisions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      table_name || '_no_direct_access', table_name
    );
  END LOOP;
END
$$;

CREATE FUNCTION private.tenancy_certificate_supersede_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.society_id, NEW.move_id, NEW.case_id, NEW.kind, NEW.financial_year,
      NEW.sequence_number, NEW.number, NEW.handover_id, NEW.dues_snapshot,
      NEW.source_version,
      NEW.parties_snapshot, NEW.unit_snapshot, NEW.purpose, NEW.signatory_name,
      NEW.signatory_designation, NEW.issued_at, NEW.issued_by, NEW.path,
      NEW.byte_hash, NEW.size_bytes, NEW.client_request_id)
    IS DISTINCT FROM
    (OLD.society_id, OLD.move_id, OLD.case_id, OLD.kind, OLD.financial_year,
      OLD.sequence_number, OLD.number, OLD.handover_id, OLD.dues_snapshot,
      OLD.source_version,
      OLD.parties_snapshot, OLD.unit_snapshot, OLD.purpose, OLD.signatory_name,
      OLD.signatory_designation, OLD.issued_at, OLD.issued_by, OLD.path,
      OLD.byte_hash, OLD.size_bytes, OLD.client_request_id)
    OR OLD.superseded_by IS NOT NULL
  THEN
    RAISE EXCEPTION 'Issued tenancy certificates are append-only.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_certificate_supersede_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER tenancy_certificates_immutable
  BEFORE UPDATE ON public.tenancy_certificates
  FOR EACH ROW EXECUTE FUNCTION private.tenancy_certificate_supersede_guard();
CREATE TRIGGER tenancy_clearance_acknowledgements_immutable
  BEFORE UPDATE OR DELETE ON public.tenancy_clearance_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_clearance_acknowledgements_append_only_no_truncate
  BEFORE TRUNCATE ON public.tenancy_clearance_acknowledgements
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_clearance_consents_immutable
  BEFORE UPDATE OR DELETE ON public.tenancy_clearance_consents
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_clearance_consents_append_only_no_truncate
  BEFORE TRUNCATE ON public.tenancy_clearance_consents
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_clearance_files_immutable
  BEFORE UPDATE OR DELETE ON public.tenancy_clearance_files
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_clearance_files_append_only_no_truncate
  BEFORE TRUNCATE ON public.tenancy_clearance_files
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_transfer_parties_no_delete
  BEFORE DELETE ON public.tenancy_transfer_parties
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_transfer_parties_no_truncate
  BEFORE TRUNCATE ON public.tenancy_transfer_parties
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenancy_clearance_acknowledgements', 'tenancy_transfer_cases',
    'tenancy_transfer_decisions', 'tenancy_clearance_handovers',
    'tenancy_clearance_consents', 'tenancy_clearance_files',
    'tenancy_certificates'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_no_delete BEFORE DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation()',
      table_name, table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I_no_truncate BEFORE TRUNCATE ON public.%I
       FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation()',
      table_name, table_name
    );
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['tenancy_transfer_revisions'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation()',
      table_name, table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I_no_truncate BEFORE TRUNCATE ON public.%I
       FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation()',
      table_name, table_name
    );
  END LOOP;
END
$$;

CREATE FUNCTION private.tenancy_clearance_acknowledged(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenancy_clearance_acknowledgements
    WHERE society_id = p_society_id
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_clearance_acknowledged(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_require_clearance(p_society_id uuid, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], p_write);
  IF p_write AND NOT private.tenancy_clearance_acknowledged(p_society_id) THEN
    RAISE EXCEPTION 'Acknowledge the clearance warning before continuing.'
      USING ERRCODE = '23505';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_require_clearance(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_transfer_can_read(p_society_id uuid, p_case_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenancy_transfer_cases AS transfer
    WHERE transfer.society_id = p_society_id AND transfer.id = p_case_id
      AND (
        private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
        OR EXISTS (
          SELECT 1 FROM public.tenancy_transfer_parties AS party
          JOIN public.memberships AS membership
            ON membership.society_id = party.society_id
           AND membership.id = party.membership_id
          WHERE party.society_id = p_society_id AND party.case_id = transfer.id
            AND party.active AND membership.user_id = auth.uid()
            AND membership.status = 'active' AND 'resident' = ANY(membership.roles)
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_transfer_can_read(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_clearance_can_read(p_society_id uuid, p_handover_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenancy_clearance_handovers AS handover
    WHERE handover.society_id = p_society_id AND handover.id = p_handover_id
      AND (
        private.has_role(p_society_id, ARRAY['admin']::text[])
        OR (handover.case_id IS NOT NULL
          AND private.tenancy_transfer_can_read(p_society_id, handover.case_id)
          AND EXISTS (
            SELECT 1 FROM public.tenancy_transfer_parties AS party
            JOIN public.memberships AS membership
              ON membership.society_id = party.society_id
             AND membership.id = party.membership_id
            WHERE party.society_id = p_society_id AND party.case_id = handover.case_id
              AND party.active AND membership.user_id = auth.uid()
          ))
        OR (handover.move_id IS NOT NULL
          AND private.tenancy_can_read_move(p_society_id, handover.move_id))
      )
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_clearance_can_read(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_transfer_revision(
  p_society_id uuid, p_entity_type text, p_entity_id uuid, p_action text,
  p_previous jsonb, p_changed_fields text[], p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.tenancy_transfer_revisions (
    society_id, entity_type, entity_id, action, previous_values,
    changed_fields, reason, request_id, created_by
  ) VALUES (
    p_society_id, p_entity_type, p_entity_id, p_action, p_previous,
    COALESCE(p_changed_fields, ARRAY[]::text[]), p_reason, p_request_id, auth.uid()
  );
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_transfer_revision(
  uuid, text, uuid, text, jsonb, text[], text, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_conditions_valid(p_conditions jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_conditions) = 'array'
    AND jsonb_array_length(p_conditions) <= 20
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_conditions) AS item
      WHERE jsonb_typeof(item.value) <> 'object'
        OR EXISTS (
          SELECT 1 FROM jsonb_object_keys(item.value) AS key
          WHERE key NOT IN ('text', 'responsible', 'follow_up_on', 'done')
        )
        OR NOT (item.value ?& ARRAY['text', 'responsible', 'done'])
        OR char_length(btrim(item.value ->> 'text')) NOT BETWEEN 1 AND 500
        OR char_length(btrim(item.value ->> 'responsible')) NOT BETWEEN 1 AND 120
        OR jsonb_typeof(item.value -> 'done') <> 'boolean'
        OR (item.value ? 'follow_up_on'
          AND (item.value ->> 'follow_up_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    )
$$;
REVOKE ALL ON FUNCTION private.tenancy_conditions_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_dues_check(p_society_id uuid, p_unit_id uuid, p_lock boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base_dues jsonb;
  bills jsonb;
BEGIN
  base_dues := private.tenancy_dues(p_society_id, p_unit_id, p_lock);
  IF base_dues ->> 'status' = 'not_checked' THEN
    RETURN jsonb_build_object(
      'status', 'not_checked', 'bills', '[]'::jsonb,
      'total_paise', NULL, 'checked_at', NULL
    );
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'bill_id', bill.id, 'number', bill.id::text, 'title', bill.title,
    'outstanding_paise', (bill.total_paise - bill.paid_paise - bill.waived_paise)::text
  ) ORDER BY bill.due_date, bill.id), '[]'::jsonb) INTO bills
  FROM public.billing_bills AS bill
  WHERE bill.society_id = p_society_id AND bill.unit_id = p_unit_id
    AND bill.cancelled_at IS NULL
    AND bill.total_paise - bill.paid_paise - bill.waived_paise > 0;
  RETURN jsonb_build_object(
    'status', CASE WHEN (base_dues ->> 'balance_paise')::numeric > 0
      THEN 'owed' ELSE 'cleared' END,
    'bills', bills,
    'total_paise', base_dues ->> 'balance_paise',
    'checked_at', base_dues -> 'checked_at'
  );
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_dues_check(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_assert_dues_snapshot(
  p_current jsonb, p_approved jsonb, p_basis text
)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  bill_item jsonb;
  approved_amount bigint;
BEGIN
  IF p_current ->> 'status' = 'not_checked' OR p_approved ->> 'status' = 'not_checked' THEN
    IF p_current ->> 'status' IS DISTINCT FROM p_approved ->> 'status' THEN
      RAISE EXCEPTION 'Billing availability changed. Check dues again.'
        USING ERRCODE = '23505';
    END IF;
    RETURN;
  END IF;
  IF p_basis = 'total' THEN
    IF (p_current ->> 'total_paise')::bigint >
       (p_approved ->> 'total_paise')::bigint THEN
      RAISE EXCEPTION 'Outstanding dues increased. Obtain a new handover approval.'
        USING ERRCODE = '23505';
    END IF;
    RETURN;
  END IF;
  FOR bill_item IN SELECT value FROM jsonb_array_elements(
    COALESCE(p_current -> 'bills', '[]'::jsonb)
  ) LOOP
    SELECT max((item ->> 'outstanding_paise')::bigint) INTO approved_amount
    FROM jsonb_array_elements(COALESCE(p_approved -> 'bills', '[]'::jsonb)) AS item
    WHERE item ->> 'bill_id' = bill_item ->> 'bill_id';
    IF approved_amount IS NULL
      OR (bill_item ->> 'outstanding_paise')::bigint > approved_amount THEN
      RAISE EXCEPTION 'Outstanding bills changed. Obtain a new handover approval.'
        USING ERRCODE = '23505';
    END IF;
  END LOOP;
  IF (p_current ->> 'total_paise')::bigint >
      (p_approved ->> 'total_paise')::bigint THEN
    RAISE EXCEPTION 'Outstanding dues increased. Obtain a new handover approval.'
      USING ERRCODE = '23505';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_assert_dues_snapshot(jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tenancy_settings_update(
  p_society_id uuid, p_police_verification_required boolean, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  next_settings jsonb;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_police_verification_required IS NULL THEN
    RAISE EXCEPTION 'Choose whether police proof is required.' USING ERRCODE = '22023';
  END IF;
  SELECT settings || jsonb_build_object(
    'police_verification_required', p_police_verification_required
  ) INTO next_settings FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'tenancy';
  UPDATE public.module_configs
  SET settings = next_settings, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'tenancy';
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.settings.update', 'module', 'tenancy',
    next_settings, p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_settings_update(
  p_society_id uuid, p_police_verification_required boolean,
  p_clearance_handover_basis text, p_clearance_agreement_evidence text,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  next_settings jsonb;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_police_verification_required IS NULL
    OR p_clearance_handover_basis IS NULL
    OR p_clearance_handover_basis NOT IN ('bills', 'total')
    OR p_clearance_agreement_evidence IS NULL
    OR p_clearance_agreement_evidence NOT IN (
      'admin_note', 'signed_upload', 'in_app_and_upload'
    )
  THEN RAISE EXCEPTION 'Choose valid Tenancy clearance settings.' USING ERRCODE = '22023'; END IF;
  SELECT settings || jsonb_build_object(
    'police_verification_required', p_police_verification_required,
    'clearance_handover_basis', p_clearance_handover_basis,
    'clearance_agreement_evidence', p_clearance_agreement_evidence
  ) INTO next_settings FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'tenancy';
  UPDATE public.module_configs SET settings = next_settings,
    updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'tenancy';
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.settings.update', 'module', 'tenancy',
    next_settings, p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_clearance_acknowledge(
  p_society_id uuid, p_warning_text text, p_client_request_id uuid, p_request_id text
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  acknowledged_at timestamptz;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_warning_text IS NULL OR char_length(btrim(p_warning_text)) NOT BETWEEN 1 AND 1000
    OR p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Acknowledge the exact clearance warning.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'tenancy-clearance-ack:' || p_society_id::text, 0
  ));
  SELECT row.acknowledged_at INTO acknowledged_at
  FROM public.tenancy_clearance_acknowledgements AS row
  WHERE row.society_id = p_society_id;
  IF FOUND THEN RETURN acknowledged_at; END IF;
  INSERT INTO public.tenancy_clearance_acknowledgements (
    society_id, warning_text, acknowledged_by, client_request_id
  ) VALUES (p_society_id, btrim(p_warning_text), auth.uid(), p_client_request_id)
  RETURNING tenancy_clearance_acknowledgements.acknowledged_at INTO acknowledged_at;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.clearance.acknowledge',
    'tenancy_clearance', p_society_id::text,
    jsonb_build_object('acknowledged_at', acknowledged_at), p_request_id
  );
  RETURN acknowledged_at;
END;
$$;

CREATE FUNCTION public.tenancy_clearance_acknowledgement_get(
  p_society_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  acknowledged_at timestamptz;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], false);
  SELECT acknowledgement.acknowledged_at INTO acknowledged_at
  FROM public.tenancy_clearance_acknowledgements AS acknowledgement
  WHERE acknowledgement.society_id = p_society_id;
  RETURN jsonb_build_object(
    'acknowledged', acknowledged_at IS NOT NULL,
    'acknowledged_at', acknowledged_at
  );
END;
$$;

CREATE FUNCTION public.tenancy_transfer_case_save(
  p_society_id uuid, p_case_id uuid, p_unit_id uuid, p_received_on date,
  p_sellers jsonb, p_buyer jsonb, p_expected_version integer,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  transfer public.tenancy_transfer_cases;
  previous_values jsonb;
  seller jsonb;
  result_id uuid;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  IF p_client_request_id IS NULL OR p_sellers IS NULL
    OR jsonb_typeof(p_sellers) <> 'array' OR jsonb_array_length(p_sellers) = 0
    OR p_buyer IS NULL OR jsonb_typeof(p_buyer) <> 'object'
    OR p_received_on IS NULL OR NOT isfinite(p_received_on)
  THEN RAISE EXCEPTION 'Enter the unit, received date, seller and buyer.' USING ERRCODE = '22023'; END IF;
  IF p_case_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'tenancy-transfer-create:' || p_society_id::text || ':' || auth.uid()::text
        || ':' || p_client_request_id::text, 0
    ));
    SELECT id INTO result_id FROM public.tenancy_transfer_cases
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN result_id; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.units WHERE society_id = p_society_id
      AND id = p_unit_id AND active) THEN
      RAISE EXCEPTION 'Transfer unit not found.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.tenancy_transfer_cases (
      society_id, unit_id, stage, received_on, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, p_unit_id, 'received', p_received_on, p_client_request_id,
      auth.uid(), auth.uid()
    ) RETURNING * INTO transfer;
  ELSE
    SELECT * INTO transfer FROM public.tenancy_transfer_cases
    WHERE society_id = p_society_id AND id = p_case_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer case not found.' USING ERRCODE = 'P0002'; END IF;
    IF transfer.stage NOT IN ('received', 'documents_checked') THEN
      RAISE EXCEPTION 'This transfer case can no longer be edited.' USING ERRCODE = '23505';
    END IF;
    PERFORM private.tenancy_assert_version(transfer.version, p_expected_version);
    previous_values := to_jsonb(transfer) || jsonb_build_object(
      'parties', COALESCE((
        SELECT jsonb_agg(to_jsonb(party)) FROM public.tenancy_transfer_parties AS party
        WHERE party.case_id = transfer.id AND party.active
      ), '[]'::jsonb)
    );
    UPDATE public.tenancy_transfer_cases
    SET unit_id = p_unit_id, received_on = p_received_on, version = version + 1,
      updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE id = transfer.id;
    UPDATE public.tenancy_transfer_parties
    SET active = false, superseded_at = clock_timestamp()
    WHERE society_id = p_society_id AND case_id = transfer.id AND active;
  END IF;
  IF p_unit_id <> transfer.unit_id AND EXISTS (
    SELECT 1 FROM public.tenancy_transfer_parties
    WHERE case_id = transfer.id AND active
  ) THEN RAISE EXCEPTION 'The transfer unit cannot be changed after parties are added.'
    USING ERRCODE = '23505'; END IF;
  FOR seller IN SELECT value FROM jsonb_array_elements(p_sellers)
  LOOP
    IF jsonb_typeof(seller) <> 'object'
      OR NOT seller ? 'membership_id'
      OR (seller ->> 'membership_id')::uuid IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.unit_occupants AS occupant
        JOIN public.memberships AS membership
          ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
        JOIN public.profiles AS profile ON profile.id = membership.user_id
        WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
          AND occupant.membership_id = (seller ->> 'membership_id')::uuid
          AND occupant.relationship = 'owner' AND occupant.status = 'active'
          AND membership.status = 'active' AND 'resident' = ANY(membership.roles)
      )
    THEN RAISE EXCEPTION 'Every seller must be a current active owner.' USING ERRCODE = '23514'; END IF;
    INSERT INTO public.tenancy_transfer_parties (
      society_id, case_id, role, membership_id, name, created_by
    ) SELECT p_society_id, transfer.id, 'seller', membership.id, profile.full_name, auth.uid()
    FROM public.memberships AS membership
    JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE membership.society_id = p_society_id
      AND membership.id = (seller ->> 'membership_id')::uuid;
  END LOOP;
  IF p_buyer ->> 'name' IS NULL OR char_length(btrim(p_buyer ->> 'name')) NOT BETWEEN 1 AND 200
    OR (p_buyer ? 'membership_id' AND (
      NOT EXISTS (SELECT 1 FROM public.memberships AS membership
        WHERE membership.society_id = p_society_id
          AND membership.id = (p_buyer ->> 'membership_id')::uuid
          AND membership.status IN ('invited', 'pending_approval', 'active')
          AND 'resident' = ANY(membership.roles))
    ))
  THEN RAISE EXCEPTION 'Enter a valid buyer and optional invited member.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.tenancy_transfer_parties (
    society_id, case_id, role, membership_id, name, phone, email, created_by
  ) VALUES (
    p_society_id, transfer.id, 'buyer',
    NULLIF(p_buyer ->> 'membership_id', '')::uuid, btrim(p_buyer ->> 'name'),
    NULLIF(btrim(p_buyer ->> 'phone'), ''), NULLIF(lower(btrim(p_buyer ->> 'email')), ''),
    auth.uid()
  );
  IF p_case_id IS NOT NULL THEN
    PERFORM private.tenancy_transfer_revision(
      p_society_id, 'transfer_case', transfer.id, 'updated', previous_values,
      ARRAY['unit_id', 'received_on', 'parties'], NULL, p_request_id
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_case_id IS NULL THEN 'tenancy.transfer.create' ELSE 'tenancy.transfer.update' END,
    'tenancy_transfer_case', transfer.id::text,
    jsonb_build_object('stage', transfer.stage, 'unit_id', p_unit_id), p_request_id
  );
  RETURN transfer.id;
END;
$$;

CREATE FUNCTION public.tenancy_transfer_case_advance(
  p_society_id uuid, p_case_id uuid, p_expected_version integer,
  p_next_stage text, p_reason text, p_request_id text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  transfer public.tenancy_transfer_cases;
  decision public.tenancy_transfer_decisions;
  dues jsonb;
  handover public.tenancy_clearance_handovers;
  rank integer;
  next_rank integer;
  previous_values jsonb;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  SELECT * INTO transfer FROM public.tenancy_transfer_cases
  WHERE society_id = p_society_id AND id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer case not found.' USING ERRCODE = 'P0002'; END IF;
  IF transfer.stage = p_next_stage THEN RETURN transfer.stage; END IF;
  PERFORM private.tenancy_assert_version(transfer.version, p_expected_version);
  rank := CASE transfer.stage
    WHEN 'received' THEN 1 WHEN 'documents_checked' THEN 2
    WHEN 'committee_decision' THEN 3 WHEN 'dues_settled' THEN 4
    WHEN 'completed' THEN 5 ELSE 99 END;
  next_rank := CASE p_next_stage
    WHEN 'documents_checked' THEN 2 WHEN 'committee_decision' THEN 3
    WHEN 'dues_settled' THEN 4 WHEN 'completed' THEN 5
    WHEN 'rejected' THEN 98 WHEN 'withdrawn' THEN 98 ELSE 0 END;
  IF next_rank = 0 OR next_rank < 98 AND next_rank <> rank + 1
    OR rank >= 98 OR (p_next_stage IN ('rejected', 'withdrawn')
      AND (p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500))
  THEN RAISE EXCEPTION 'Transfer stages only move forward.' USING ERRCODE = '23505'; END IF;
  IF p_next_stage = 'dues_settled' THEN
    SELECT * INTO decision FROM public.tenancy_transfer_decisions WHERE case_id = transfer.id;
    IF NOT FOUND OR decision.decision NOT IN ('approved', 'approved_with_conditions') THEN
      RAISE EXCEPTION 'An approved committee decision is required.' USING ERRCODE = '23514';
    END IF;
    dues := private.tenancy_dues_check(p_society_id, transfer.unit_id, true);
    IF dues ->> 'status' = 'owed' THEN
      SELECT * INTO handover FROM public.tenancy_clearance_handovers
      WHERE society_id = p_society_id AND case_id = p_case_id AND status = 'approved'
      ORDER BY approved_at DESC, id DESC LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Approve a handover or clear the outstanding dues.'
          USING ERRCODE = '23514';
      END IF;
      PERFORM private.tenancy_assert_dues_snapshot(dues, handover.dues_snapshot, handover.basis);
    END IF;
  END IF;
  previous_values := to_jsonb(transfer);
  UPDATE public.tenancy_transfer_cases
  SET stage = p_next_stage, version = version + 1,
    documents_checked_on = CASE WHEN p_next_stage = 'documents_checked'
      THEN (clock_timestamp() AT TIME ZONE (
        SELECT timezone FROM public.societies WHERE id = p_society_id
      ))::date ELSE documents_checked_on END,
    committee_decision_on = CASE WHEN p_next_stage = 'committee_decision'
      THEN (clock_timestamp() AT TIME ZONE (
        SELECT timezone FROM public.societies WHERE id = p_society_id
      ))::date ELSE committee_decision_on END,
    dues_settled_on = CASE WHEN p_next_stage = 'dues_settled'
      THEN (clock_timestamp() AT TIME ZONE (
        SELECT timezone FROM public.societies WHERE id = p_society_id
      ))::date ELSE dues_settled_on END,
    completed_on = CASE WHEN p_next_stage = 'completed'
      THEN (clock_timestamp() AT TIME ZONE (
        SELECT timezone FROM public.societies WHERE id = p_society_id
      ))::date ELSE completed_on END,
    rejected_on = CASE WHEN p_next_stage = 'rejected'
      THEN (clock_timestamp() AT TIME ZONE (
        SELECT timezone FROM public.societies WHERE id = p_society_id
      ))::date ELSE rejected_on END,
    withdrawn_on = CASE WHEN p_next_stage = 'withdrawn'
      THEN (clock_timestamp() AT TIME ZONE (
        SELECT timezone FROM public.societies WHERE id = p_society_id
      ))::date ELSE withdrawn_on END,
    closing_reason = CASE WHEN p_next_stage IN ('rejected', 'withdrawn')
      THEN btrim(p_reason) ELSE closing_reason END,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_case_id;
  PERFORM private.tenancy_transfer_revision(
    p_society_id, 'transfer_case', p_case_id, 'stage_changed', previous_values,
    ARRAY['stage'], p_reason, p_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.transfer.stage',
    'tenancy_transfer_case', p_case_id::text,
    jsonb_build_object('stage', p_next_stage), p_request_id
  );
  RETURN p_next_stage;
END;
$$;

CREATE FUNCTION public.tenancy_transfer_decision_record(
  p_society_id uuid, p_case_id uuid, p_decision text, p_resolution_reference text,
  p_resolution_date date, p_meeting_id uuid, p_conditions jsonb,
  p_expected_version integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  transfer public.tenancy_transfer_cases;
  current_decision public.tenancy_transfer_decisions;
  decision_id uuid;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  SELECT * INTO transfer FROM public.tenancy_transfer_cases
  WHERE society_id = p_society_id AND id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer case not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN (
    'approved', 'approved_with_conditions', 'rejected', 'deferred'
  ) OR p_resolution_reference IS NULL
    OR char_length(btrim(p_resolution_reference)) NOT BETWEEN 1 AND 120
    OR p_resolution_date IS NULL OR NOT isfinite(p_resolution_date)
    OR NOT private.tenancy_conditions_valid(COALESCE(p_conditions, '[]'::jsonb))
    OR p_client_request_id IS NULL
    OR (p_decision = 'approved_with_conditions' AND jsonb_array_length(p_conditions) = 0)
  THEN RAISE EXCEPTION 'Enter a valid committee decision and conditions.' USING ERRCODE = '22023'; END IF;
  IF p_meeting_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meetings
    WHERE society_id = p_society_id AND id = p_meeting_id
  ) THEN RAISE EXCEPTION 'Committee meeting not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO current_decision FROM public.tenancy_transfer_decisions
  WHERE society_id = p_society_id AND case_id = p_case_id FOR UPDATE;
  IF FOUND THEN
    SELECT id INTO decision_id FROM public.tenancy_transfer_decisions
    WHERE society_id = p_society_id AND updated_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN decision_id; END IF;
    PERFORM private.tenancy_assert_version(current_decision.version, p_expected_version);
    PERFORM private.tenancy_transfer_revision(
      p_society_id, 'transfer_decision', current_decision.id, 'updated',
      to_jsonb(current_decision), ARRAY['decision', 'resolution', 'conditions'],
      NULL, p_request_id
    );
    UPDATE public.tenancy_transfer_decisions
    SET decision = p_decision, resolution_reference = btrim(p_resolution_reference),
      resolution_date = p_resolution_date, meeting_id = p_meeting_id,
      conditions = COALESCE(p_conditions, '[]'::jsonb), version = version + 1,
      updated_at = clock_timestamp(), updated_by = auth.uid(),
      client_request_id = p_client_request_id
    WHERE id = current_decision.id RETURNING id INTO decision_id;
  ELSE
    INSERT INTO public.tenancy_transfer_decisions (
      society_id, case_id, decision, resolution_reference, resolution_date,
      meeting_id, conditions, created_by, updated_by, client_request_id
    ) VALUES (
      p_society_id, p_case_id, p_decision, btrim(p_resolution_reference),
      p_resolution_date, p_meeting_id, COALESCE(p_conditions, '[]'::jsonb),
      auth.uid(), auth.uid(), p_client_request_id
    ) RETURNING id INTO decision_id;
  END IF;
  IF p_decision = 'rejected' AND transfer.stage NOT IN ('rejected', 'withdrawn') THEN
    UPDATE public.tenancy_transfer_cases
    SET stage = 'rejected', rejected_on = p_resolution_date,
      closing_reason = 'Committee decision rejected the transfer',
      version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE id = p_case_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.transfer.decision',
    'tenancy_transfer_case', p_case_id::text,
    jsonb_build_object('decision', p_decision), p_request_id
  );
  RETURN decision_id;
END;
$$;

CREATE FUNCTION public.tenancy_clearance_dues_check(
  p_society_id uuid, p_move_id uuid DEFAULT NULL, p_case_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_id uuid;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], false);
  IF (p_move_id IS NULL) = (p_case_id IS NULL) THEN
    RAISE EXCEPTION 'Choose one move or transfer case.' USING ERRCODE = '22023';
  END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT move.unit_id INTO unit_id FROM public.tenancy_moves AS move
    WHERE move.society_id = p_society_id AND move.id = p_move_id AND move.kind = 'move_out';
  ELSE
    SELECT transfer.unit_id INTO unit_id FROM public.tenancy_transfer_cases AS transfer
    WHERE transfer.society_id = p_society_id AND transfer.id = p_case_id;
  END IF;
  IF unit_id IS NULL THEN RAISE EXCEPTION 'Clearance target not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN private.tenancy_dues_check(p_society_id, unit_id, false);
END;
$$;

CREATE FUNCTION public.tenancy_clearance_handover_draft(
  p_society_id uuid, p_move_id uuid, p_case_id uuid,
  p_responsible_party_id uuid, p_responsible_membership_id uuid,
  p_responsible_role text, p_admin_note text, p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_unit_id uuid;
  handover_id uuid;
  dues jsonb;
  settings jsonb;
  basis text;
  evidence_mode text;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  IF (p_move_id IS NULL) = (p_case_id IS NULL)
    OR (p_responsible_party_id IS NULL) = (p_responsible_membership_id IS NULL)
    OR (p_move_id IS NOT NULL AND (
      p_responsible_membership_id IS NULL OR p_responsible_role NOT IN ('tenant', 'owner')
    ))
    OR (p_case_id IS NOT NULL AND (
      p_responsible_party_id IS NULL OR p_responsible_role NOT IN ('seller', 'buyer')
    ))
    OR p_responsible_role IS NULL
    OR p_responsible_role NOT IN ('tenant', 'owner', 'seller', 'buyer')
    OR p_client_request_id IS NULL
  THEN RAISE EXCEPTION 'Choose the clearance target and responsible party.' USING ERRCODE = '22023'; END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT move.unit_id INTO target_unit_id FROM public.tenancy_moves AS move
    WHERE move.society_id = p_society_id AND move.id = p_move_id
      AND move.kind = 'move_out' AND move.status IN ('approved', 'completed')
    FOR UPDATE;
  ELSE
    SELECT transfer.unit_id INTO target_unit_id FROM public.tenancy_transfer_cases AS transfer
    WHERE transfer.society_id = p_society_id AND transfer.id = p_case_id
      AND transfer.stage NOT IN ('rejected', 'withdrawn', 'completed')
    FOR UPDATE;
  END IF;
  IF target_unit_id IS NULL THEN
    RAISE EXCEPTION 'Clearance target not found or closed.' USING ERRCODE = 'P0002';
  END IF;
  SELECT id INTO handover_id FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN handover_id; END IF;
  SELECT config.settings INTO settings FROM public.module_configs AS config
  WHERE config.society_id = p_society_id AND config.module_key = 'tenancy';
  basis := COALESCE(settings ->> 'clearance_handover_basis', 'bills');
  evidence_mode := COALESCE(settings ->> 'clearance_agreement_evidence', 'admin_note');
  dues := private.tenancy_dues_check(p_society_id, target_unit_id, true);
  IF dues ->> 'status' <> 'owed' THEN
    RAISE EXCEPTION 'A conditional handover is only for verified outstanding dues.'
      USING ERRCODE = '23514';
  END IF;
  IF p_responsible_party_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenancy_transfer_parties AS party
    WHERE party.society_id = p_society_id AND party.case_id = p_case_id
      AND party.id = p_responsible_party_id AND party.active
      AND party.role = p_responsible_role
  ) THEN RAISE EXCEPTION 'The responsible transfer party is unavailable.'
    USING ERRCODE = 'P0002'; END IF;
  IF p_responsible_membership_id IS NOT NULL AND NOT (
    (p_move_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenancy_moves AS move
      WHERE move.society_id = p_society_id AND move.id = p_move_id
        AND ((p_responsible_role = 'tenant' AND move.tenant_membership_id = p_responsible_membership_id)
          OR (p_responsible_role = 'owner' AND EXISTS (
            SELECT 1 FROM public.unit_occupants AS occupant
            WHERE occupant.society_id = p_society_id AND occupant.unit_id = target_unit_id
              AND occupant.membership_id = p_responsible_membership_id
              AND occupant.relationship = 'owner' AND occupant.status = 'active'
          )))
    ))
    OR (p_case_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenancy_transfer_parties AS party
      WHERE party.society_id = p_society_id AND party.case_id = p_case_id
        AND party.membership_id = p_responsible_membership_id AND party.role = p_responsible_role
        AND party.active
    ))
  ) THEN RAISE EXCEPTION 'The responsible member is not a party to this clearance.'
    USING ERRCODE = 'P0002'; END IF;
  IF evidence_mode = 'admin_note' AND (
    p_admin_note IS NULL OR char_length(btrim(p_admin_note)) NOT BETWEEN 1 AND 2000
  ) THEN RAISE EXCEPTION 'Record the agreement evidence note.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.tenancy_clearance_handovers (
    society_id, move_id, case_id, unit_id, basis, evidence_mode, dues_snapshot,
    responsible_transfer_party_id, responsible_membership_id, responsible_role,
    admin_note, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, p_move_id, p_case_id, target_unit_id, basis, evidence_mode, dues,
    p_responsible_party_id, p_responsible_membership_id, p_responsible_role,
    NULLIF(btrim(p_admin_note), ''), p_client_request_id, auth.uid(), auth.uid()
  ) RETURNING id INTO handover_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.handover.draft',
    'tenancy_clearance_handover', handover_id::text,
    jsonb_build_object('basis', basis, 'evidence_mode', evidence_mode), p_request_id
  );
  RETURN handover_id;
END;
$$;

CREATE FUNCTION public.tenancy_clearance_file_upload_path(
  p_society_id uuid, p_handover_id uuid, p_covered_party_id uuid,
  p_covered_membership_id uuid, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.tenancy_clearance_handovers;
  path text;
  extension text;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  IF (p_covered_party_id IS NULL) = (p_covered_membership_id IS NULL)
    OR p_content_type IS NULL OR p_content_type NOT IN (
      'application/pdf', 'image/jpeg', 'image/png'
    ) OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Choose a party and PDF, JPG or PNG up to 5 MiB.'
    USING ERRCODE = '22023'; END IF;
  SELECT * INTO handover FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND id = p_handover_id AND status = 'draft'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft handover not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_covered_party_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenancy_transfer_parties AS party
    WHERE party.society_id = p_society_id AND party.case_id = handover.case_id
      AND party.id = p_covered_party_id AND party.active
  ) OR p_covered_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenancy_transfer_parties AS party
    WHERE party.society_id = p_society_id AND party.case_id = handover.case_id
      AND party.membership_id = p_covered_membership_id AND party.active
    UNION ALL
    SELECT 1 FROM public.tenancy_moves AS move
    WHERE handover.move_id IS NOT NULL AND move.society_id = p_society_id
      AND move.id = handover.move_id
      AND (move.tenant_membership_id = p_covered_membership_id OR EXISTS (
        SELECT 1 FROM public.unit_occupants AS occupant
        WHERE occupant.society_id = p_society_id AND occupant.unit_id = handover.unit_id
          AND occupant.membership_id = p_covered_membership_id
          AND occupant.relationship = 'owner' AND occupant.status = 'active'
      ))
  ) THEN RAISE EXCEPTION 'The agreement party is unavailable.' USING ERRCODE = 'P0002'; END IF;
  extension := CASE p_content_type
    WHEN 'application/pdf' THEN '.pdf' WHEN 'image/jpeg' THEN '.jpg' ELSE '.png' END;
  path := p_society_id::text || '/tenancy-clearance/' || p_handover_id::text
    || '/' || gen_random_uuid()::text || extension;
  RETURN path;
END;
$$;

CREATE FUNCTION public.tenancy_clearance_file_attach(
  p_society_id uuid, p_handover_id uuid, p_covered_party_id uuid,
  p_covered_membership_id uuid, p_path text, p_expected_version integer,
  p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.tenancy_clearance_handovers;
  object_metadata jsonb;
  file_id uuid;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  SELECT * INTO handover FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT id INTO file_id FROM public.tenancy_clearance_files
  WHERE society_id = p_society_id AND handover_id = p_handover_id AND path = p_path;
  IF FOUND THEN RETURN file_id; END IF;
  PERFORM private.tenancy_assert_version(handover.version, p_expected_version);
  IF handover.status <> 'draft'
    OR split_part(p_path, '/', 1) <> p_society_id::text
    OR split_part(p_path, '/', 2) <> 'tenancy-clearance'
    OR split_part(p_path, '/', 3) <> p_handover_id::text
    OR (p_covered_party_id IS NULL) = (p_covered_membership_id IS NULL)
  THEN RAISE EXCEPTION 'The agreement upload is not available.' USING ERRCODE = '42501'; END IF;
  IF p_covered_party_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenancy_transfer_parties AS party
    WHERE party.society_id = p_society_id AND party.case_id = handover.case_id
      AND party.id = p_covered_party_id AND party.active
  ) OR p_covered_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenancy_transfer_parties AS party
    WHERE party.society_id = p_society_id AND party.case_id = handover.case_id
      AND party.membership_id = p_covered_membership_id AND party.active
    UNION ALL
    SELECT 1 FROM public.tenancy_moves AS move
    WHERE handover.move_id IS NOT NULL AND move.society_id = p_society_id
      AND move.id = handover.move_id
      AND (
        move.tenant_membership_id = p_covered_membership_id
        OR EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = p_society_id
            AND occupant.unit_id = handover.unit_id
            AND occupant.membership_id = p_covered_membership_id
            AND occupant.relationship = 'owner' AND occupant.status = 'active'
        )
      )
  ) THEN RAISE EXCEPTION 'The agreement party is unavailable.' USING ERRCODE = 'P0002'; END IF;
  SELECT metadata INTO object_metadata FROM storage.objects
  WHERE bucket_id = 'tenancy-files' AND name = p_path
    AND created_at > clock_timestamp() - interval '24 hours';
  IF NOT FOUND THEN RAISE EXCEPTION 'Agreement upload not found or expired.' USING ERRCODE = 'P0002'; END IF;
  IF object_metadata ->> 'mimetype' NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
    OR (object_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880
    OR (object_metadata ->> 'mimetype' = 'application/pdf' AND right(p_path, 4) <> '.pdf')
    OR (object_metadata ->> 'mimetype' = 'image/jpeg' AND right(p_path, 4) <> '.jpg')
    OR (object_metadata ->> 'mimetype' = 'image/png' AND right(p_path, 4) <> '.png')
  THEN RAISE EXCEPTION 'Use a PDF, JPG or PNG up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.tenancy_clearance_files (
    society_id, handover_id, transfer_party_id, membership_id, path,
    content_type, size_bytes, created_by
  ) VALUES (
    p_society_id, p_handover_id, p_covered_party_id, p_covered_membership_id, p_path,
    object_metadata ->> 'mimetype', (object_metadata ->> 'size')::integer, auth.uid()
  ) RETURNING id INTO file_id;
  UPDATE public.tenancy_clearance_handovers
  SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_handover_id;
  PERFORM private.tenancy_transfer_revision(
    p_society_id, 'clearance_handover', p_handover_id, 'file_attached',
    to_jsonb(handover), ARRAY['files'], NULL, p_request_id
  );
  RETURN file_id;
END;
$$;

CREATE FUNCTION public.tenancy_clearance_handover_consent(
  p_society_id uuid, p_handover_id uuid, p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.tenancy_clearance_handovers;
  party public.tenancy_transfer_parties;
  v_membership_id uuid;
  v_party_id uuid;
  v_role text;
  consent_id uuid;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['resident']::text[], true);
  SELECT * INTO handover FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND id = p_handover_id AND status = 'draft'
  FOR UPDATE;
  IF NOT FOUND OR handover.evidence_mode <> 'in_app_and_upload' THEN
    RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.tenancy_assert_version(handover.version, p_expected_version);
  IF handover.case_id IS NOT NULL THEN
    SELECT candidate.* INTO party FROM public.tenancy_transfer_parties AS candidate
    JOIN public.memberships AS membership
      ON membership.society_id = candidate.society_id
     AND membership.id = candidate.membership_id
    WHERE candidate.society_id = p_society_id AND candidate.case_id = handover.case_id
      AND candidate.active AND membership.user_id = auth.uid()
      AND membership.status = 'active' AND 'resident' = ANY(membership.roles)
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002'; END IF;
    v_membership_id := party.membership_id;
    v_party_id := party.id;
    v_role := party.role;
  ELSE
    SELECT membership.id, CASE WHEN membership.id = move.tenant_membership_id
      THEN 'tenant' ELSE 'owner' END
      INTO v_membership_id, v_role
    FROM public.tenancy_moves AS move
    JOIN public.memberships AS membership ON membership.society_id = move.society_id
      AND (membership.id = move.tenant_membership_id OR EXISTS (
        SELECT 1 FROM public.unit_occupants AS occupant
        WHERE occupant.society_id = move.society_id AND occupant.unit_id = move.unit_id
          AND occupant.membership_id = membership.id AND occupant.relationship = 'owner'
          AND occupant.status = 'active'
      ))
    WHERE move.society_id = p_society_id AND move.id = handover.move_id
      AND membership.user_id = auth.uid() AND membership.status = 'active'
      AND 'resident' = ANY(membership.roles) LIMIT 1;
    IF v_membership_id IS NULL THEN
      RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  INSERT INTO public.tenancy_clearance_consents (
    society_id, handover_id, transfer_party_id, membership_id, role,
    expected_version, consented_by
  ) VALUES (
    p_society_id, p_handover_id, v_party_id, v_membership_id, v_role,
    p_expected_version, auth.uid()
  ) ON CONFLICT (society_id, handover_id, membership_id, role) DO NOTHING
  RETURNING id INTO consent_id;
  IF consent_id IS NULL THEN
    SELECT id INTO consent_id FROM public.tenancy_clearance_consents
    WHERE society_id = p_society_id AND handover_id = p_handover_id
      AND membership_id = v_membership_id AND role = v_role;
  END IF;
  RETURN consent_id;
END;
$$;

CREATE FUNCTION private.tenancy_handover_evidence_complete(
  p_handover public.tenancy_clearance_handovers
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE p_handover.evidence_mode
    WHEN 'admin_note' THEN p_handover.admin_note IS NOT NULL
    WHEN 'signed_upload' THEN EXISTS (
      SELECT 1 FROM public.tenancy_clearance_files AS file
      WHERE file.society_id = p_handover.society_id
        AND file.handover_id = p_handover.id
      UNION ALL
      SELECT 1 FROM public.tenancy_clearance_files AS file
      WHERE file.society_id = p_handover.society_id
        AND file.handover_id = p_handover.id
    )
    ELSE NOT EXISTS (
      SELECT 1 FROM public.tenancy_transfer_parties AS party
      WHERE p_handover.case_id IS NOT NULL AND party.society_id = p_handover.society_id
        AND party.case_id = p_handover.case_id AND party.active
        AND party.membership_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.tenancy_clearance_consents AS consent
          WHERE consent.society_id = p_handover.society_id
            AND consent.handover_id = p_handover.id
            AND consent.membership_id = party.membership_id
        )
    ) AND NOT EXISTS (
      SELECT 1 FROM public.tenancy_transfer_parties AS party
      WHERE p_handover.case_id IS NOT NULL AND party.society_id = p_handover.society_id
        AND party.case_id = p_handover.case_id AND party.active
        AND party.membership_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.tenancy_clearance_files AS file
          WHERE file.society_id = p_handover.society_id
            AND file.handover_id = p_handover.id AND file.transfer_party_id = party.id
        )
    ) AND (
      p_handover.move_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM (
          SELECT move.tenant_membership_id AS membership_id
          FROM public.tenancy_moves AS move WHERE move.id = p_handover.move_id
          UNION
          SELECT occupant.membership_id
          FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = p_handover.society_id
            AND occupant.unit_id = p_handover.unit_id
            AND occupant.relationship = 'owner' AND occupant.status = 'active'
        ) AS required_party
        WHERE NOT EXISTS (
          SELECT 1 FROM public.tenancy_clearance_consents AS consent
          WHERE consent.society_id = p_handover.society_id
            AND consent.handover_id = p_handover.id
            AND consent.membership_id = required_party.membership_id
        )
      )
    )
  END
$$;
REVOKE ALL ON FUNCTION private.tenancy_handover_evidence_complete(public.tenancy_clearance_handovers)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_clearance_handover_approve(
  p_society_id uuid, p_handover_id uuid, p_expected_version integer,
  p_approval_reference text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.tenancy_clearance_handovers;
  current_dues jsonb;
  previous_approved public.tenancy_clearance_handovers;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  SELECT * INTO handover FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002'; END IF;
  IF handover.status = 'approved' THEN RETURN; END IF;
  PERFORM private.tenancy_assert_version(handover.version, p_expected_version);
  IF handover.status <> 'draft' OR p_approval_reference IS NULL
    OR char_length(btrim(p_approval_reference)) NOT BETWEEN 1 AND 120
  THEN RAISE EXCEPTION 'Enter a valid handover approval reference.' USING ERRCODE = '22023'; END IF;
  current_dues := private.tenancy_dues_check(p_society_id, handover.unit_id, true);
  IF current_dues ->> 'status' <> 'owed' THEN
    RAISE EXCEPTION 'Refresh the clearance target; dues are no longer outstanding.'
      USING ERRCODE = '23505';
  END IF;
  PERFORM private.tenancy_assert_dues_snapshot(current_dues, handover.dues_snapshot, handover.basis);
  IF NOT private.tenancy_handover_evidence_complete(handover) THEN
    RAISE EXCEPTION 'Complete the configured handover agreement evidence.'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO previous_approved FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND status = 'approved'
    AND id <> p_handover_id
    AND ((handover.move_id IS NOT NULL AND move_id = handover.move_id)
      OR (handover.case_id IS NOT NULL AND case_id = handover.case_id))
  ORDER BY approved_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.tenancy_clearance_handovers SET status = 'replaced',
    updated_at = clock_timestamp(), updated_by = auth.uid(), version = version + 1
    WHERE id = previous_approved.id;
    PERFORM private.tenancy_transfer_revision(
      p_society_id, 'clearance_handover', previous_approved.id, 'replaced',
      to_jsonb(previous_approved), ARRAY['status'], NULL, p_request_id
    );
  END IF;
  UPDATE public.tenancy_clearance_handovers
  SET status = 'approved', approved_at = clock_timestamp(), approved_by = auth.uid(),
    approval_reference = btrim(p_approval_reference), version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_handover_id;
  PERFORM private.tenancy_transfer_revision(
    p_society_id, 'clearance_handover', p_handover_id, 'approved',
    to_jsonb(handover), ARRAY['status', 'approval_reference'], NULL, p_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.handover.approve',
    'tenancy_clearance_handover', p_handover_id::text,
    jsonb_build_object('approval_reference', btrim(p_approval_reference)), p_request_id
  );
END;
$$;

CREATE FUNCTION private.tenancy_financial_year(p_society_id uuid, p_at timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN extract(month FROM local.day) >= 4
    THEN extract(year FROM local.day)::integer::text || '-'
      || substr((extract(year FROM local.day)::integer + 1)::text, 3, 2)
    ELSE (extract(year FROM local.day)::integer - 1)::text || '-'
      || substr(extract(year FROM local.day)::integer::text, 3, 2)
    END
  FROM (
    SELECT (p_at AT TIME ZONE society.timezone)::date AS day
    FROM public.societies AS society WHERE society.id = p_society_id
  ) AS local
$$;
REVOKE ALL ON FUNCTION private.tenancy_financial_year(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_certificate_prepare(
  p_society_id uuid, p_move_id uuid, p_case_id uuid, p_purpose text,
  p_signatory_designation text, p_client_request_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  transfer public.tenancy_transfer_cases;
  current_version integer;
  target_unit_id uuid;
  prepared_at timestamptz := clock_timestamp();
  dues jsonb;
  handover public.tenancy_clearance_handovers;
  kind text;
  path text;
  issuer_name text;
  preparation jsonb;
  certificate_id uuid;
  parties_snapshot jsonb;
  unit_snapshot jsonb;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  IF (p_move_id IS NULL) = (p_case_id IS NULL)
    OR p_purpose IS NULL OR char_length(btrim(p_purpose)) NOT BETWEEN 1 AND 500
    OR p_signatory_designation IS NULL
    OR char_length(btrim(p_signatory_designation)) NOT BETWEEN 1 AND 200
    OR p_client_request_id IS NULL
  THEN RAISE EXCEPTION 'Enter the certificate target, purpose and signatory designation.'
    USING ERRCODE = '22023'; END IF;
  SELECT full_name INTO issuer_name FROM public.profiles WHERE id = auth.uid();
  IF issuer_name IS NULL OR btrim(issuer_name) = '' THEN
    RAISE EXCEPTION 'The issuing administrator must have a name.' USING ERRCODE = '23514';
  END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
    IF NOT FOUND OR move.kind <> 'move_out' OR move.status <> 'completed' THEN
      RAISE EXCEPTION 'Only a completed move-out can receive a certificate.' USING ERRCODE = '23514';
    END IF;
    current_version := move.version;
    target_unit_id := move.unit_id;
    preparation := move.certificate_preparation;
  ELSE
    SELECT * INTO transfer FROM public.tenancy_transfer_cases
    WHERE society_id = p_society_id AND id = p_case_id FOR UPDATE;
    IF NOT FOUND OR transfer.stage <> 'completed' THEN
      RAISE EXCEPTION 'Only a completed transfer case can receive a certificate.'
        USING ERRCODE = '23514';
    END IF;
    current_version := transfer.version;
    target_unit_id := transfer.unit_id;
    preparation := transfer.certificate_preparation;
  END IF;
  IF preparation ->> 'issued_by' = auth.uid()::text
    AND (preparation ->> 'client_request_id')::uuid = p_client_request_id
  THEN
    RETURN preparation || jsonb_build_object('status', 'prepared');
  END IF;
  IF preparation ->> 'issued_by' IS NOT NULL
    AND preparation ->> 'issued_by' <> auth.uid()::text
    AND (preparation ->> 'prepared_at')::timestamptz >
      prepared_at - interval '10 minutes'
  THEN
    RAISE EXCEPTION 'Another administrator is preparing this certificate. Refresh and retry.'
      USING ERRCODE = '23505';
  END IF;
  SELECT certificate.id INTO certificate_id FROM public.tenancy_certificates AS certificate
  WHERE certificate.society_id = p_society_id
    AND certificate.issued_by = auth.uid()
    AND certificate.client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'issued', 'certificate_id', certificate_id);
  END IF;
  SELECT jsonb_build_object(
    'society_id', unit.society_id, 'unit_id', unit.id, 'number', unit.number
  ) INTO unit_snapshot
  FROM public.units AS unit
  WHERE unit.society_id = p_society_id AND unit.id = target_unit_id;
  IF p_case_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'role', party.role, 'name', party.name, 'membership_id', party.membership_id
    ) ORDER BY party.role, party.id), '[]'::jsonb) INTO parties_snapshot
    FROM public.tenancy_transfer_parties AS party
    WHERE party.society_id = p_society_id AND party.case_id = p_case_id AND party.active;
  ELSE
    SELECT jsonb_agg(jsonb_build_object(
      'role', party.role, 'name', party.name, 'membership_id', party.membership_id
    ) ORDER BY party.role, party.membership_id) INTO parties_snapshot
    FROM (
      SELECT 'tenant'::text AS role, profile.full_name AS name,
        source_move.tenant_membership_id AS membership_id
      FROM public.tenancy_moves AS source_move
      JOIN public.memberships AS membership
        ON membership.society_id = source_move.society_id
       AND membership.id = source_move.tenant_membership_id
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE source_move.society_id = p_society_id
        AND source_move.id = p_move_id
      UNION ALL
      SELECT 'owner'::text, profile.full_name, occupant.membership_id
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
       AND membership.id = occupant.membership_id
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE occupant.society_id = p_society_id AND occupant.unit_id = target_unit_id
        AND occupant.relationship = 'owner' AND occupant.status = 'active'
    ) AS party;
  END IF;
  dues := private.tenancy_dues_check(p_society_id, target_unit_id, true);
  IF dues ->> 'status' = 'owed' THEN
    SELECT * INTO handover FROM public.tenancy_clearance_handovers
    WHERE society_id = p_society_id AND status = 'approved'
      AND ((p_move_id IS NOT NULL AND move_id = p_move_id)
        OR (p_case_id IS NOT NULL AND case_id = p_case_id))
    ORDER BY approved_at DESC, id DESC LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Clear the dues or approve a conditional handover first.'
        USING ERRCODE = '23514';
    END IF;
    PERFORM private.tenancy_assert_dues_snapshot(dues, handover.dues_snapshot, handover.basis);
    kind := 'conditional';
  ELSIF dues ->> 'status' = 'cleared' THEN
    kind := 'clearance';
  ELSE
    kind := 'not_checked';
  END IF;
  path := p_society_id::text || '/tenancy-certificates/' || gen_random_uuid()::text || '.pdf';
  preparation := jsonb_build_object(
    'status', 'prepared', 'path', path, 'issued_by', auth.uid(),
    'source_version', current_version, 'prepared_at', prepared_at,
    'purpose', btrim(p_purpose), 'kind', kind,
    'signatory_name', btrim(issuer_name),
    'signatory_designation', btrim(p_signatory_designation),
    'handover_id', handover.id, 'dues', dues,
    'parties', parties_snapshot, 'unit', unit_snapshot,
    'expected_version', current_version + 1,
    'client_request_id', p_client_request_id, 'artifact_hash', NULL,
    'artifact_verified_at', NULL
  );
  IF p_move_id IS NOT NULL THEN
    UPDATE public.tenancy_moves
    SET certificate_preparation = preparation, version = version + 1,
      updated_at = prepared_at, updated_by = auth.uid()
    WHERE id = p_move_id;
  ELSE
    UPDATE public.tenancy_transfer_cases
    SET certificate_preparation = preparation, version = version + 1,
      updated_at = prepared_at, updated_by = auth.uid()
    WHERE id = p_case_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.certificate.prepare',
    CASE WHEN p_move_id IS NOT NULL THEN 'tenancy_move' ELSE 'tenancy_transfer_case' END,
    COALESCE(p_move_id, p_case_id)::text,
    jsonb_build_object('kind', kind, 'path', path), p_request_id
  );
  RETURN preparation;
END;
$$;

CREATE FUNCTION public.tenancy_certificate_attest(
  p_society_id uuid, p_move_id uuid, p_case_id uuid, p_issuer_id uuid,
  p_path text, p_byte_hash text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  preparation jsonb;
  verified_at timestamptz := clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF (p_move_id IS NULL) = (p_case_id IS NULL)
    OR p_byte_hash IS NULL OR p_byte_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'Invalid certificate attestation.' USING ERRCODE = '22023'; END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT move.certificate_preparation INTO preparation FROM public.tenancy_moves AS move
    WHERE move.society_id = p_society_id AND move.id = p_move_id FOR UPDATE;
  ELSE
    SELECT transfer.certificate_preparation INTO preparation
    FROM public.tenancy_transfer_cases AS transfer
    WHERE transfer.society_id = p_society_id AND transfer.id = p_case_id FOR UPDATE;
  END IF;
  IF preparation IS NULL OR preparation ->> 'issued_by' IS DISTINCT FROM p_issuer_id::text
    OR preparation ->> 'path' IS DISTINCT FROM p_path
    OR (preparation ->> 'prepared_at')::timestamptz <= verified_at - interval '10 minutes'
    OR NOT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE society_id = p_society_id AND user_id = p_issuer_id
        AND status = 'active' AND 'admin' = ANY(roles)
    )
  THEN RAISE EXCEPTION 'The certificate preparation changed or expired.'
    USING ERRCODE = '23505'; END IF;
  preparation := preparation || jsonb_build_object(
    'artifact_hash', p_byte_hash, 'artifact_verified_at', verified_at
  );
  IF p_move_id IS NOT NULL THEN
    UPDATE public.tenancy_moves SET certificate_preparation = preparation WHERE id = p_move_id;
  ELSE
    UPDATE public.tenancy_transfer_cases
    SET certificate_preparation = preparation WHERE id = p_case_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, request_id
  ) VALUES (
    p_society_id, p_issuer_id, 'admin', 'tenancy.certificate.verify',
    CASE WHEN p_move_id IS NOT NULL THEN 'tenancy_move' ELSE 'tenancy_transfer_case' END,
    COALESCE(p_move_id, p_case_id)::text, p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_certificate_issue(
  p_society_id uuid, p_move_id uuid, p_case_id uuid,
  p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  preparation jsonb;
  current_version integer;
  target_unit_id uuid;
  kind text;
  dues jsonb;
  handover public.tenancy_clearance_handovers;
  issued_at timestamptz := clock_timestamp();
  certificate_financial_year text;
  certificate_sequence integer;
  certificate_id uuid;
  preparation_client_request_id uuid;
  storage_metadata jsonb;
  certificate_number text;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  IF (p_move_id IS NULL) = (p_case_id IS NULL) THEN
    RAISE EXCEPTION 'Choose one certificate target.' USING ERRCODE = '22023';
  END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT move.version, move.unit_id, move.certificate_preparation
      INTO current_version, target_unit_id, preparation
    FROM public.tenancy_moves AS move
    WHERE move.society_id = p_society_id AND move.id = p_move_id
      AND move.kind = 'move_out' AND move.status = 'completed' FOR UPDATE;
  ELSE
    SELECT transfer.version, transfer.unit_id, transfer.certificate_preparation
      INTO current_version, target_unit_id, preparation
    FROM public.tenancy_transfer_cases AS transfer
    WHERE transfer.society_id = p_society_id AND transfer.id = p_case_id
      AND transfer.stage = 'completed' FOR UPDATE;
  END IF;
  SELECT certificate.id INTO certificate_id
  FROM public.tenancy_certificates AS certificate
  WHERE certificate.society_id = p_society_id
    AND certificate.issued_by = auth.uid()
    AND certificate.source_version = p_expected_version
    AND ((p_move_id IS NOT NULL AND certificate.move_id = p_move_id)
      OR (p_case_id IS NOT NULL AND certificate.case_id = p_case_id))
  ORDER BY certificate.issued_at DESC, certificate.id DESC
  LIMIT 1;
  IF FOUND THEN RETURN certificate_id; END IF;
  IF preparation IS NULL THEN
    RAISE EXCEPTION 'Prepare the certificate before issuing it.' USING ERRCODE = '23505';
  END IF;
  preparation_client_request_id :=
    (preparation ->> 'client_request_id')::uuid;
  SELECT certificate.id INTO certificate_id
  FROM public.tenancy_certificates AS certificate
  WHERE certificate.society_id = p_society_id
    AND certificate.issued_by = auth.uid()
    AND certificate.client_request_id = preparation_client_request_id;
  IF FOUND THEN RETURN certificate_id; END IF;
  PERFORM private.tenancy_assert_version(current_version, p_expected_version);
  IF preparation ->> 'issued_by' IS DISTINCT FROM auth.uid()::text
    OR (preparation ->> 'prepared_at')::timestamptz <= issued_at - interval '10 minutes'
    OR preparation ->> 'artifact_hash' IS NULL
    OR preparation ->> 'artifact_verified_at' IS NULL
  THEN RAISE EXCEPTION 'The verified certificate preparation expired or changed.'
    USING ERRCODE = '23505'; END IF;
  dues := private.tenancy_dues_check(p_society_id, target_unit_id, true);
  IF preparation ->> 'kind' = 'conditional' THEN
    SELECT * INTO handover FROM public.tenancy_clearance_handovers
    WHERE society_id = p_society_id AND id = (preparation ->> 'handover_id')::uuid
      AND status = 'approved';
    IF NOT FOUND OR dues ->> 'status' <> 'owed' THEN
      RAISE EXCEPTION 'The conditional handover or dues snapshot changed.'
        USING ERRCODE = '23505';
    END IF;
    PERFORM private.tenancy_assert_dues_snapshot(dues, handover.dues_snapshot, handover.basis);
  ELSIF dues ->> 'status' IS DISTINCT FROM preparation -> 'dues' ->> 'status' THEN
    RAISE EXCEPTION 'Dues changed after certificate preparation. Prepare again.'
      USING ERRCODE = '23505';
  END IF;
  kind := dues ->> 'status';
  kind := CASE kind WHEN 'cleared' THEN 'clearance'
    WHEN 'not_checked' THEN 'not_checked' ELSE 'conditional' END;
  SELECT metadata INTO storage_metadata FROM storage.objects
  WHERE bucket_id = 'tenancy-files' AND name = preparation ->> 'path';
  IF storage_metadata IS NULL
    OR storage_metadata ->> 'mimetype' IS DISTINCT FROM 'application/pdf'
    OR COALESCE(storage_metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
    OR (storage_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Upload the prepared certificate PDF first.' USING ERRCODE = '22023'; END IF;
  certificate_financial_year :=
    private.tenancy_financial_year(p_society_id, issued_at);
  INSERT INTO public.tenancy_certificate_counters (
    society_id, financial_year, last_sequence
  ) VALUES (p_society_id, certificate_financial_year, 1)
  ON CONFLICT (society_id, financial_year) DO UPDATE
  SET last_sequence = tenancy_certificate_counters.last_sequence + 1
  RETURNING last_sequence INTO certificate_sequence;
  certificate_number := 'NOC/' || certificate_financial_year || '/' ||
    lpad(certificate_sequence::text, 4, '0');
  INSERT INTO public.tenancy_certificates (
    society_id, move_id, case_id, kind, financial_year, sequence_number,
    source_version, number,
    handover_id, dues_snapshot, parties_snapshot, unit_snapshot,
    purpose, signatory_name, signatory_designation,
    issued_at, issued_by, path, byte_hash, size_bytes, client_request_id
  ) VALUES (
    p_society_id, p_move_id, p_case_id, kind,
    certificate_financial_year, certificate_sequence,
    current_version, certificate_number,
    CASE WHEN kind = 'conditional' THEN handover.id END, dues,
    preparation -> 'parties', preparation -> 'unit',
    preparation ->> 'purpose', preparation ->> 'signatory_name',
    preparation ->> 'signatory_designation', issued_at, auth.uid(),
    preparation ->> 'path', preparation ->> 'artifact_hash',
    (storage_metadata ->> 'size')::integer, preparation_client_request_id
  ) RETURNING id INTO certificate_id;
  IF p_move_id IS NOT NULL THEN
    UPDATE public.tenancy_moves SET certificate_preparation = NULL,
      version = version + 1, updated_at = issued_at, updated_by = auth.uid()
    WHERE id = p_move_id;
  ELSE
    UPDATE public.tenancy_transfer_cases SET certificate_preparation = NULL,
      version = version + 1, updated_at = issued_at, updated_by = auth.uid()
    WHERE id = p_case_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.certificate.issue',
    'tenancy_certificate', certificate_id::text,
    jsonb_build_object('number', certificate_number, 'kind', kind), p_request_id
  );
  RETURN certificate_id;
END;
$$;

CREATE FUNCTION public.tenancy_certificate_supersede(
  p_society_id uuid, p_certificate_id uuid, p_replacement_certificate_id uuid,
  p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  certificate public.tenancy_certificates;
BEGIN
  PERFORM private.tenancy_require_clearance(p_society_id, true);
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Enter why the certificate is superseded.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO certificate FROM public.tenancy_certificates
  WHERE society_id = p_society_id AND id = p_certificate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Certificate not found.' USING ERRCODE = 'P0002'; END IF;
  IF certificate.superseded_by = p_replacement_certificate_id
    AND certificate.supersede_reason = btrim(p_reason) THEN RETURN; END IF;
  IF certificate.superseded_by IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenancy_certificates AS replacement
    WHERE replacement.society_id = p_society_id
      AND replacement.id = p_replacement_certificate_id
      AND replacement.issued_at >= certificate.issued_at
      AND replacement.move_id IS NOT DISTINCT FROM certificate.move_id
      AND replacement.case_id IS NOT DISTINCT FROM certificate.case_id
  ) THEN RAISE EXCEPTION 'The replacement certificate is not valid.' USING ERRCODE = '23505'; END IF;
  UPDATE public.tenancy_certificates
  SET superseded_by = p_replacement_certificate_id, supersede_reason = btrim(p_reason)
  WHERE id = p_certificate_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'tenancy.certificate.supersede',
    'tenancy_certificate', p_certificate_id::text,
    jsonb_build_object('replacement', p_replacement_certificate_id), p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.tenancy_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  target_move_id uuid;
  file_kind text;
  move public.tenancy_moves;
  handover public.tenancy_clearance_handovers;
  preparation jsonb;
BEGIN
  IF p_path IS NULL THEN RETURN false; END IF;
  BEGIN
    target_society_id := split_part(p_path, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(target_society_id, 'tenancy')
    OR NOT private.is_member(target_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = target_society_id AND status <> 'archived'
    )
  THEN RETURN false; END IF;
  IF split_part(p_path, '/', 2) = 'moves' THEN
    IF p_path !~ (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
      '/moves/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
      '/(rental_agreement|police_verification|noc)/[0-9a-f-]+\.(jpg|png|pdf)$'
    ) THEN RETURN false; END IF;
    IF split_part(p_path, '/', 3) !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN RETURN false; END IF;
    target_move_id := split_part(p_path, '/', 3)::uuid;
    file_kind := split_part(p_path, '/', 4);
    IF NOT private.tenancy_can_read_move(target_society_id, target_move_id)
    THEN RETURN false; END IF;
    SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = target_society_id AND id = target_move_id;
    IF p_write THEN
      RETURN private.society_writable(target_society_id) AND (
        (file_kind <> 'noc' AND move.kind = 'move_in'
          AND move.status IN ('awaiting_consent', 'pending_review', 'approved')
          AND EXISTS (
            SELECT 1 FROM public.unit_occupants AS occupant
            WHERE occupant.society_id = target_society_id AND occupant.id = move.occupancy_id
              AND occupant.status <> 'ended'
          ) AND NOT EXISTS (
            SELECT 1 FROM public.tenancy_documents AS document
            WHERE document.society_id = target_society_id
              AND document.move_id = target_move_id AND document.kind = file_kind
          ))
        OR (file_kind = 'noc' AND p_path = move.noc_prepared_path
          AND move.noc_prepared_by = auth.uid()
          AND move.noc_prepared_at > clock_timestamp() - interval '10 minutes'
          AND private.has_role(target_society_id, ARRAY['admin']::text[])
          AND private.tenancy_noc_deadline(move) > clock_timestamp())
      );
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.tenancy_documents AS document
      WHERE document.society_id = target_society_id AND document.move_id = target_move_id
        AND document.path = p_path AND document.deleted_at IS NULL
        AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
    ) OR private.tenancy_file_access(p_path, true);
  END IF;
  IF split_part(p_path, '/', 2) = 'tenancy-clearance' THEN
    IF split_part(p_path, '/', 3) !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN RETURN false; END IF;
    SELECT * INTO handover FROM public.tenancy_clearance_handovers
    WHERE society_id = target_society_id AND id = split_part(p_path, '/', 3)::uuid;
    IF NOT FOUND OR NOT private.tenancy_clearance_can_read(
      target_society_id, handover.id
    ) THEN RETURN false; END IF;
    IF p_write THEN
      RETURN private.has_role(target_society_id, ARRAY['admin']::text[])
        AND private.society_writable(target_society_id) AND handover.status = 'draft'
        AND split_part(p_path, '/', 4) ~
          '^[0-9a-f-]+\.(pdf|jpg|png)$';
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.tenancy_clearance_files AS file
      WHERE file.society_id = target_society_id AND file.handover_id = handover.id
        AND file.path = p_path
    ) OR private.tenancy_file_access(p_path, true);
  END IF;
  IF split_part(p_path, '/', 2) = 'tenancy-certificates' THEN
    IF split_part(p_path, '/', 3) !~
      '^[0-9a-f-]+\.pdf$' THEN RETURN false; END IF;
    IF p_write THEN
      RETURN private.has_role(target_society_id, ARRAY['admin']::text[])
        AND private.society_writable(target_society_id)
        AND (
          EXISTS (
            SELECT 1 FROM public.tenancy_moves AS item
            WHERE item.society_id = target_society_id
              AND item.certificate_preparation ->> 'path' = p_path
              AND item.certificate_preparation ->> 'issued_by' = auth.uid()::text
          )
          OR EXISTS (
            SELECT 1 FROM public.tenancy_transfer_cases AS item
            WHERE item.society_id = target_society_id
              AND item.certificate_preparation ->> 'path' = p_path
              AND item.certificate_preparation ->> 'issued_by' = auth.uid()::text
          )
        );
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.tenancy_certificates AS certificate
      WHERE certificate.society_id = target_society_id AND certificate.path = p_path
        AND (
          private.has_role(target_society_id, ARRAY['admin']::text[])
          OR (certificate.case_id IS NOT NULL
            AND private.tenancy_transfer_can_read(
              target_society_id, certificate.case_id
            ) AND NOT private.has_role(
              target_society_id, ARRAY['committee']::text[]
            ))
          OR (certificate.move_id IS NOT NULL AND
            private.tenancy_can_read_move(target_society_id, certificate.move_id))
        )
    ) OR private.tenancy_file_access(p_path, true);
  END IF;
  RETURN false;
END;
$$;

CREATE FUNCTION public.tenancy_transfer_cases_page(
  p_society_id uuid, p_stage text DEFAULT NULL,
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0
    OR (p_stage IS NOT NULL AND p_stage NOT IN (
      'received', 'documents_checked', 'committee_decision', 'dues_settled',
      'completed', 'rejected', 'withdrawn'
    ))
  THEN RAISE EXCEPTION 'Choose a valid transfer stage and page.' USING ERRCODE = '22023'; END IF;
  RETURN (
    WITH visible AS (
      SELECT transfer.* FROM public.tenancy_transfer_cases AS transfer
      WHERE transfer.society_id = p_society_id
        AND (p_stage IS NULL OR transfer.stage = p_stage)
        AND private.tenancy_transfer_can_read(p_society_id, transfer.id)
    ), page AS (
      SELECT * FROM visible ORDER BY received_on DESC, id LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', page.id, 'unit_id', page.unit_id,
          'unit_number', (SELECT number FROM public.units
            WHERE society_id = p_society_id AND id = page.unit_id),
          'stage', page.stage, 'received_on', page.received_on,
          'version', page.version,
          'buyers', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', party.id, 'name', party.name)
              ORDER BY party.id)
            FROM public.tenancy_transfer_parties AS party
            WHERE party.society_id = p_society_id AND party.case_id = page.id
              AND party.role = 'buyer' AND party.active
          ), '[]'::jsonb)
        ) ORDER BY page.received_on DESC, page.id) FROM page
      ), '[]'::jsonb),
      'total', (SELECT count(*) FROM visible), 'limit', p_limit, 'offset', p_offset
    )
  );
END;
$$;

CREATE FUNCTION public.tenancy_transfer_case_get(p_society_id uuid, p_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  transfer public.tenancy_transfer_cases;
  is_admin boolean;
  committee_only boolean;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  SELECT * INTO transfer FROM public.tenancy_transfer_cases
  WHERE society_id = p_society_id AND id = p_case_id;
  IF NOT FOUND OR NOT private.tenancy_transfer_can_read(p_society_id, p_case_id) THEN
    RAISE EXCEPTION 'Transfer case not found.' USING ERRCODE = 'P0002';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  committee_only := private.has_role(p_society_id, ARRAY['committee']::text[]) AND NOT is_admin;
  RETURN jsonb_build_object(
    'case', to_jsonb(transfer) - 'certificate_preparation',
    'parties', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', party.id, 'role', party.role, 'membership_id', party.membership_id,
          'name', party.name,
          'phone', CASE WHEN is_admin THEN party.phone END,
          'email', CASE WHEN is_admin THEN party.email END,
          'active', party.active
        ) ORDER BY party.role, party.created_at, party.id
      ) FROM public.tenancy_transfer_parties AS party
      WHERE party.society_id = p_society_id AND party.case_id = p_case_id
    ), '[]'::jsonb),
    'decision', CASE WHEN committee_only OR is_admin OR private.tenancy_transfer_can_read(
      p_society_id, p_case_id
    ) THEN (
      SELECT to_jsonb(decision) - 'client_request_id'
      FROM public.tenancy_transfer_decisions AS decision
      WHERE decision.society_id = p_society_id AND decision.case_id = p_case_id
    ) END,
    'handovers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', handover.id, 'basis', handover.basis,
        'evidence_mode', handover.evidence_mode,
        'dues_snapshot', handover.dues_snapshot,
        'responsible_transfer_party_id', handover.responsible_transfer_party_id,
        'responsible_membership_id', handover.responsible_membership_id,
        'responsible_role', handover.responsible_role,
        'admin_note', CASE WHEN NOT committee_only THEN handover.admin_note END,
        'status', handover.status, 'version', handover.version,
        'approved_at', handover.approved_at, 'approval_reference',
          handover.approval_reference
      ) ORDER BY handover.created_at, handover.id)
      FROM public.tenancy_clearance_handovers AS handover
      WHERE handover.society_id = p_society_id AND handover.case_id = p_case_id
        AND (is_admin OR private.tenancy_clearance_can_read(
          p_society_id, handover.id
        ))
    ), '[]'::jsonb),
    'certificates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', certificate.id, 'number', certificate.number,
        'kind', certificate.kind, 'issued_at', certificate.issued_at,
        'superseded_by', certificate.superseded_by,
        'path', CASE WHEN NOT committee_only THEN certificate.path END
      ) ORDER BY certificate.issued_at, certificate.id)
      FROM public.tenancy_certificates AS certificate
      WHERE certificate.society_id = p_society_id AND certificate.case_id = p_case_id
    ), '[]'::jsonb),
    'revisions', CASE WHEN committee_only THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(to_jsonb(revision) - 'request_id'
        ORDER BY revision.created_at DESC, revision.id)
      FROM public.tenancy_transfer_revisions AS revision
      WHERE revision.society_id = p_society_id
        AND (revision.entity_type = 'transfer_case' AND revision.entity_id = p_case_id
          OR revision.entity_type = 'transfer_decision' AND revision.entity_id = (
            SELECT id FROM public.tenancy_transfer_decisions
            WHERE society_id = p_society_id AND case_id = p_case_id
          )
          OR revision.entity_type = 'clearance_handover' AND revision.entity_id IN (
            SELECT id FROM public.tenancy_clearance_handovers
            WHERE society_id = p_society_id AND case_id = p_case_id
          ))
    ), '[]'::jsonb) END
  );
END;
$$;

CREATE FUNCTION public.tenancy_certificates_page(
  p_society_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_committee boolean;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset < 0
  THEN RAISE EXCEPTION 'Choose a valid certificate page.' USING ERRCODE = '22023'; END IF;
  is_committee := private.has_role(p_society_id, ARRAY['committee']::text[])
    AND NOT private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN (
    WITH visible AS (
      SELECT certificate.* FROM public.tenancy_certificates AS certificate
      WHERE certificate.society_id = p_society_id AND (
        private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
        OR (certificate.case_id IS NOT NULL
          AND private.tenancy_transfer_can_read(
            p_society_id, certificate.case_id
          ))
        OR (certificate.move_id IS NOT NULL
          AND private.tenancy_can_read_move(p_society_id, certificate.move_id))
      )
    ), page AS (
      SELECT * FROM visible ORDER BY issued_at DESC, id LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', page.id, 'number', page.number, 'kind', page.kind,
          'handover_id', page.handover_id,
          'issued_at', page.issued_at, 'superseded_by', page.superseded_by,
          'path', CASE WHEN NOT is_committee THEN page.path END
        ) ORDER BY page.issued_at DESC, page.id) FROM page
      ), '[]'::jsonb),
      'total', (SELECT count(*) FROM visible), 'limit', p_limit, 'offset', p_offset
    )
  );
END;
$$;

CREATE FUNCTION public.tenancy_clearance_handovers_page(
  p_society_id uuid, p_move_id uuid DEFAULT NULL, p_case_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'resident']::text[], false
  );
  IF (p_move_id IS NULL) = (p_case_id IS NULL)
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset < 0
  THEN RAISE EXCEPTION 'Choose one clearance target and a valid page.'
    USING ERRCODE = '22023'; END IF;
  RETURN (
    WITH visible AS (
      SELECT handover.* FROM public.tenancy_clearance_handovers AS handover
      WHERE handover.society_id = p_society_id
        AND (
          (p_move_id IS NOT NULL AND handover.move_id = p_move_id)
          OR (p_case_id IS NOT NULL AND handover.case_id = p_case_id)
        )
        AND private.tenancy_clearance_can_read(p_society_id, handover.id)
    ), page AS (
      SELECT * FROM visible ORDER BY created_at DESC, id LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', page.id, 'basis', page.basis,
          'evidence_mode', page.evidence_mode,
          'dues_snapshot', page.dues_snapshot,
          'responsible_transfer_party_id', page.responsible_transfer_party_id,
          'responsible_membership_id', page.responsible_membership_id,
          'responsible_role', page.responsible_role,
          'admin_note', page.admin_note, 'status', page.status,
          'version', page.version, 'approved_at', page.approved_at,
          'approval_reference', page.approval_reference
        ) ORDER BY page.created_at DESC, page.id) FROM page
      ), '[]'::jsonb),
      'total', (SELECT count(*) FROM visible),
      'limit', p_limit, 'offset', p_offset
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tenancy_move_complete(
  p_society_id uuid, p_move_id uuid, p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  occupant public.unit_occupants;
  local_today date;
  dues jsonb;
  handover public.tenancy_clearance_handovers;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  SELECT * INTO move FROM public.tenancy_moves
  WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002'; END IF;
  IF move.status = 'completed' THEN RETURN move.occupancy_id; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF move.status <> 'approved' OR move.starts_at > clock_timestamp() THEN
    RAISE EXCEPTION 'Only an approved move that has started can complete.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'tenancy' FOR SHARE;
  PERFORM private.tenancy_assert_ready(move);
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND id = move.tenant_membership_id
      AND status = 'active' AND user_id IS NOT NULL AND 'resident' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'The tenant must complete their Core invitation first.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.units
  WHERE society_id = p_society_id AND id = move.unit_id FOR UPDATE;
  SELECT * INTO occupant FROM public.unit_occupants
  WHERE society_id = p_society_id AND id = move.occupancy_id
    AND unit_id = move.unit_id AND membership_id = move.tenant_membership_id
    AND relationship = 'tenant' FOR UPDATE;
  IF NOT FOUND OR occupant.status <>
    (CASE move.kind WHEN 'move_in' THEN 'pending' ELSE 'active' END)
  THEN RAISE EXCEPTION 'The tenant occupancy has changed.' USING ERRCODE = '23505'; END IF;
  SELECT (clock_timestamp() AT TIME ZONE timezone)::date INTO local_today
  FROM public.societies WHERE id = p_society_id;
  IF move.kind = 'move_in' THEN
    UPDATE public.tenancy_moves SET completion_in_progress = true WHERE id = p_move_id;
    UPDATE public.unit_occupants
    SET status = 'active', started_at = local_today, is_approver = true
    WHERE id = move.occupancy_id;
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin', 'members.unit.assign',
      'unit_occupant', move.occupancy_id::text,
      jsonb_build_object(
        'relationship', 'tenant', 'startedAt', local_today, 'moveId', move.id
      ), p_request_id
    );
  ELSE
    dues := private.tenancy_dues_check(p_society_id, move.unit_id, true);
    IF dues ->> 'status' = 'owed' THEN
      SELECT * INTO handover FROM public.tenancy_clearance_handovers
      WHERE society_id = p_society_id AND move_id = move.id
        AND status = 'approved'
      ORDER BY approved_at DESC, id DESC LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Clear outstanding unit dues or approve a conditional handover.'
          USING ERRCODE = '23514';
      END IF;
      PERFORM private.tenancy_assert_dues_snapshot(
        dues, handover.dues_snapshot, handover.basis
      );
    END IF;
    PERFORM public.end_unit_occupancy(
      p_society_id, move.occupancy_id, local_today, p_request_id
    );
  END IF;
  UPDATE public.tenancy_moves
  SET status = 'completed', completed_at = clock_timestamp(),
    completed_by = auth.uid(), completion_in_progress = false, version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_move_id;
  PERFORM private.tenancy_event(p_move_id, 'completed', NULL, p_request_id);
  RETURN move.occupancy_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenancy_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
  target_society_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  FOR target_society_id IN
    SELECT DISTINCT society.id
    FROM storage.objects AS object
    JOIN public.societies AS society ON society.id::text = split_part(object.name, '/', 1)
    WHERE object.bucket_id = 'tenancy-files'
      AND object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_documents AS document WHERE document.path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_clearance_files AS file WHERE file.path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_certificates AS certificate
        WHERE certificate.path = object.name
      )
    ORDER BY society.id
  LOOP
    PERFORM 1 FROM public.societies WHERE id = target_society_id FOR KEY SHARE;
    PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || target_society_id::text, 0));
  END LOOP;
  RETURN QUERY
  SELECT 'tenancy-files'::text, object.name
  FROM storage.objects AS object
  WHERE object.bucket_id = 'tenancy-files' AND (
    EXISTS (
      SELECT 1 FROM public.tenancy_documents AS document
      WHERE document.path = object.name
        AND (document.deleted_at IS NOT NULL OR document.purge_after <= cutoff)
    )
    OR (
      object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_documents AS document WHERE document.path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_clearance_files AS file WHERE file.path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_certificates AS certificate
        WHERE certificate.path = object.name
      )
    )
  )
  ORDER BY object.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenancy_transfer_case_get(p_society_id uuid, p_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  transfer public.tenancy_transfer_cases;
  is_admin boolean;
  committee_only boolean;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  SELECT * INTO transfer FROM public.tenancy_transfer_cases
  WHERE society_id = p_society_id AND id = p_case_id;
  IF NOT FOUND OR NOT private.tenancy_transfer_can_read(p_society_id, p_case_id) THEN
    RAISE EXCEPTION 'Transfer case not found.' USING ERRCODE = 'P0002';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  committee_only := private.has_role(p_society_id, ARRAY['committee']::text[]) AND NOT is_admin;
  RETURN jsonb_build_object(
    'case', to_jsonb(transfer) - 'certificate_preparation',
    'parties', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', party.id, 'role', party.role, 'membership_id', party.membership_id,
        'name', party.name, 'phone', CASE WHEN is_admin THEN party.phone END,
        'email', CASE WHEN is_admin THEN party.email END, 'active', party.active
      ) ORDER BY party.role, party.created_at, party.id)
      FROM public.tenancy_transfer_parties AS party
      WHERE party.society_id = p_society_id AND party.case_id = p_case_id
    ), '[]'::jsonb),
    'decision', (
      SELECT to_jsonb(decision) - 'client_request_id'
      FROM public.tenancy_transfer_decisions AS decision
      WHERE decision.society_id = p_society_id AND decision.case_id = p_case_id
    ),
    'handovers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', handover.id, 'basis', handover.basis,
        'evidence_mode', handover.evidence_mode,
        'dues_snapshot', handover.dues_snapshot,
        'responsible_transfer_party_id', handover.responsible_transfer_party_id,
        'responsible_membership_id', handover.responsible_membership_id,
        'responsible_role', handover.responsible_role,
        'admin_note', handover.admin_note, 'status', handover.status,
        'version', handover.version, 'approved_at', handover.approved_at,
        'approval_reference', handover.approval_reference
      ) ORDER BY handover.created_at, handover.id)
      FROM public.tenancy_clearance_handovers AS handover
      WHERE handover.society_id = p_society_id AND handover.case_id = p_case_id
        AND (is_admin OR NOT committee_only)
    ), '[]'::jsonb),
    'files', CASE WHEN committee_only THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', file.id, 'path', file.path, 'handover_id', file.handover_id
      ) ORDER BY file.created_at, file.id)
      FROM public.tenancy_clearance_files AS file
      JOIN public.tenancy_clearance_handovers AS handover
        ON handover.society_id = file.society_id AND handover.id = file.handover_id
      WHERE handover.case_id = p_case_id
    ), '[]'::jsonb) END,
    'certificates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', certificate.id, 'number', certificate.number,
        'kind', certificate.kind, 'issued_at', certificate.issued_at,
        'superseded_by', certificate.superseded_by,
        'path', CASE WHEN NOT committee_only THEN certificate.path END
      ) ORDER BY certificate.issued_at, certificate.id)
      FROM public.tenancy_certificates AS certificate
      WHERE certificate.society_id = p_society_id AND certificate.case_id = p_case_id
    ), '[]'::jsonb),
    'revisions', CASE WHEN committee_only THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(to_jsonb(revision) - 'request_id'
        ORDER BY revision.created_at DESC, revision.id)
      FROM public.tenancy_transfer_revisions AS revision
      WHERE revision.society_id = p_society_id
        AND (revision.entity_type = 'transfer_case' AND revision.entity_id = p_case_id
          OR revision.entity_type = 'transfer_decision' AND revision.entity_id = (
            SELECT id FROM public.tenancy_transfer_decisions
            WHERE society_id = p_society_id AND case_id = p_case_id
          )
          OR revision.entity_type = 'clearance_handover' AND revision.entity_id IN (
            SELECT id FROM public.tenancy_clearance_handovers
            WHERE society_id = p_society_id AND case_id = p_case_id
          ))
    ), '[]'::jsonb) END
  );
END;
$$;

CREATE FUNCTION public.tenancy_clearance_handover_get(
  p_society_id uuid, p_handover_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.tenancy_clearance_handovers;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id, ARRAY['admin', 'resident']::text[], false
  );
  SELECT * INTO handover FROM public.tenancy_clearance_handovers
  WHERE society_id = p_society_id AND id = p_handover_id;
  IF NOT FOUND OR NOT private.tenancy_clearance_can_read(p_society_id, p_handover_id) THEN
    RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'handover', to_jsonb(handover) - 'client_request_id',
    'files', COALESCE((
      SELECT jsonb_agg(to_jsonb(file) ORDER BY file.created_at, file.id)
      FROM public.tenancy_clearance_files AS file
      WHERE file.society_id = p_society_id AND file.handover_id = p_handover_id
    ), '[]'::jsonb),
    'consents', COALESCE((
      SELECT jsonb_agg(to_jsonb(consent) ORDER BY consent.consented_at, consent.id)
      FROM public.tenancy_clearance_consents AS consent
      WHERE consent.society_id = p_society_id AND consent.handover_id = p_handover_id
    ), '[]'::jsonb)
  );
END;
$$;

ALTER TABLE public.tenancy_transfer_decisions
  ADD CONSTRAINT tenancy_transfer_decisions_condition_shape_check
  CHECK (private.tenancy_conditions_valid(conditions));

ALTER TABLE public.tenancy_transfer_cases
  ADD CONSTRAINT tenancy_transfer_cases_required_dates_check CHECK (
    (stage NOT IN ('documents_checked', 'committee_decision', 'dues_settled', 'completed')
      OR documents_checked_on IS NOT NULL)
    AND (stage NOT IN ('committee_decision', 'dues_settled', 'completed')
      OR committee_decision_on IS NOT NULL)
    AND (stage NOT IN ('dues_settled', 'completed') OR dues_settled_on IS NOT NULL)
    AND (stage <> 'completed' OR (
      documents_checked_on IS NOT NULL AND committee_decision_on IS NOT NULL
      AND dues_settled_on IS NOT NULL AND completed_on IS NOT NULL
    ))
  );

REVOKE ALL ON FUNCTION public.tenancy_settings_update(uuid, boolean, text),
  public.tenancy_settings_update(uuid, boolean, text, text, text),
  public.tenancy_clearance_acknowledge(uuid, text, uuid, text),
  public.tenancy_clearance_acknowledgement_get(uuid),
  public.tenancy_transfer_case_save(uuid, uuid, uuid, date, jsonb, jsonb, integer, uuid, text),
  public.tenancy_transfer_case_advance(uuid, uuid, integer, text, text, text),
  public.tenancy_transfer_decision_record(uuid, uuid, text, text, date, uuid, jsonb, integer, uuid, text),
  public.tenancy_clearance_dues_check(uuid, uuid, uuid),
  public.tenancy_clearance_handover_draft(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text),
  public.tenancy_clearance_file_upload_path(uuid, uuid, uuid, uuid, text, integer),
  public.tenancy_clearance_file_attach(uuid, uuid, uuid, uuid, text, integer, text),
  public.tenancy_clearance_handover_consent(uuid, uuid, integer, text),
  public.tenancy_clearance_handover_approve(uuid, uuid, integer, text, text),
  public.tenancy_certificate_prepare(uuid, uuid, uuid, text, text, uuid, text),
  public.tenancy_certificate_issue(uuid, uuid, uuid, integer, text),
  public.tenancy_certificate_supersede(uuid, uuid, uuid, text, text),
  public.tenancy_transfer_cases_page(uuid, text, integer, integer),
  public.tenancy_transfer_case_get(uuid, uuid),
  public.tenancy_certificates_page(uuid, integer, integer),
  public.tenancy_clearance_handovers_page(uuid, uuid, uuid, integer, integer),
  public.tenancy_clearance_handover_get(uuid, uuid),
  public.tenancy_certificate_attest(uuid, uuid, uuid, uuid, text, text, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.tenancy_settings_update(uuid, boolean, text),
  public.tenancy_settings_update(uuid, boolean, text, text, text),
  public.tenancy_clearance_acknowledge(uuid, text, uuid, text),
  public.tenancy_clearance_acknowledgement_get(uuid),
  public.tenancy_transfer_case_save(uuid, uuid, uuid, date, jsonb, jsonb, integer, uuid, text),
  public.tenancy_transfer_case_advance(uuid, uuid, integer, text, text, text),
  public.tenancy_transfer_decision_record(uuid, uuid, text, text, date, uuid, jsonb, integer, uuid, text),
  public.tenancy_clearance_dues_check(uuid, uuid, uuid),
  public.tenancy_clearance_handover_draft(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text),
  public.tenancy_clearance_file_upload_path(uuid, uuid, uuid, uuid, text, integer),
  public.tenancy_clearance_file_attach(uuid, uuid, uuid, uuid, text, integer, text),
  public.tenancy_clearance_handover_consent(uuid, uuid, integer, text),
  public.tenancy_clearance_handover_approve(uuid, uuid, integer, text, text),
  public.tenancy_certificate_prepare(uuid, uuid, uuid, text, text, uuid, text),
  public.tenancy_certificate_issue(uuid, uuid, uuid, integer, text),
  public.tenancy_certificate_supersede(uuid, uuid, uuid, text, text),
  public.tenancy_transfer_cases_page(uuid, text, integer, integer),
  public.tenancy_transfer_case_get(uuid, uuid),
  public.tenancy_certificates_page(uuid, integer, integer),
  public.tenancy_clearance_handovers_page(uuid, uuid, uuid, integer, integer),
  public.tenancy_clearance_handover_get(uuid, uuid)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenancy_certificate_attest(
  uuid, uuid, uuid, uuid, text, text, text
) TO service_role;
