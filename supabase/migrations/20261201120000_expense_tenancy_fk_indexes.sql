-- Restore required leading indexes for P41 audit and P51 clearance foreign keys.

CREATE INDEX expense_audit_acknowledgements_acknowledged_by_idx
  ON public.expense_audit_acknowledgements (acknowledged_by);
CREATE INDEX expense_audit_years_created_by_idx
  ON public.expense_audit_years (created_by);
CREATE INDEX expense_audit_years_updated_by_idx
  ON public.expense_audit_years (updated_by);
CREATE INDEX expense_audit_years_document_idx
  ON public.expense_audit_years (society_id, appointment_document_id);
CREATE INDEX expense_audit_queries_created_by_idx
  ON public.expense_audit_queries (created_by);
CREATE INDEX expense_audit_queries_updated_by_idx
  ON public.expense_audit_queries (updated_by);
CREATE INDEX expense_audit_objections_created_by_idx
  ON public.expense_audit_objections (created_by);
CREATE INDEX expense_audit_objections_updated_by_idx
  ON public.expense_audit_objections (updated_by);
CREATE INDEX expense_audit_objections_document_idx
  ON public.expense_audit_objections (society_id, evidence_document_id);
CREATE INDEX expense_audit_revisions_created_by_idx
  ON public.expense_audit_revisions (created_by);
CREATE INDEX expense_agm_drafts_created_by_idx
  ON public.expense_agm_drafts (created_by);
CREATE INDEX expense_agm_drafts_updated_by_idx
  ON public.expense_agm_drafts (updated_by);

CREATE INDEX tenancy_transfer_cases_unit_idx
  ON public.tenancy_transfer_cases (society_id, unit_id);
CREATE INDEX tenancy_transfer_parties_created_by_idx
  ON public.tenancy_transfer_parties (created_by);
CREATE INDEX tenancy_transfer_decisions_created_by_idx
  ON public.tenancy_transfer_decisions (created_by);
CREATE INDEX tenancy_transfer_decisions_updated_by_idx
  ON public.tenancy_transfer_decisions (updated_by);
CREATE INDEX tenancy_clearance_handovers_case_idx
  ON public.tenancy_clearance_handovers (society_id, case_id);
CREATE INDEX tenancy_clearance_handovers_responsible_party_idx
  ON public.tenancy_clearance_handovers (
    society_id,
    case_id,
    responsible_transfer_party_id
  );
CREATE INDEX tenancy_clearance_handovers_responsible_member_idx
  ON public.tenancy_clearance_handovers (society_id, responsible_membership_id);
CREATE INDEX tenancy_clearance_handovers_updated_by_idx
  ON public.tenancy_clearance_handovers (updated_by);
CREATE INDEX tenancy_clearance_consents_party_idx
  ON public.tenancy_clearance_consents (society_id, transfer_party_id);
CREATE INDEX tenancy_clearance_consents_consented_by_idx
  ON public.tenancy_clearance_consents (consented_by);
CREATE INDEX tenancy_clearance_files_party_idx
  ON public.tenancy_clearance_files (society_id, transfer_party_id);
CREATE INDEX tenancy_clearance_files_member_idx
  ON public.tenancy_clearance_files (society_id, membership_id);
CREATE INDEX tenancy_certificates_move_idx
  ON public.tenancy_certificates (society_id, move_id);
CREATE INDEX tenancy_certificates_superseded_idx
  ON public.tenancy_certificates (society_id, superseded_by);
CREATE INDEX tenancy_clearance_acknowledgements_acknowledged_by_idx
  ON public.tenancy_clearance_acknowledgements (acknowledged_by);
