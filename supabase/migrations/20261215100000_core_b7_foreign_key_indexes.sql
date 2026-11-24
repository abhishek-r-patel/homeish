-- Index every leading foreign-key column added by the B7 follow-up phases.
CREATE INDEX amenity_booking_deposit_events_created_by_idx
  ON public.amenity_booking_deposit_events (created_by);
CREATE INDEX amenity_booking_deposit_events_account_idx
  ON public.amenity_booking_deposit_events (society_id, account_id);
CREATE INDEX amenity_booking_deposit_events_book_entry_idx
  ON public.amenity_booking_deposit_events (society_id, book_entry_id);
CREATE INDEX amenity_booking_deposit_events_voids_event_idx
  ON public.amenity_booking_deposit_events (society_id, voids_event_id);
CREATE INDEX amenity_booking_deposits_created_by_idx
  ON public.amenity_booking_deposits (created_by);
CREATE INDEX amenity_booking_deposits_updated_by_idx
  ON public.amenity_booking_deposits (updated_by);

CREATE INDEX billing_interest_acknowledgements_by_idx
  ON public.billing_interest_acknowledgements (acknowledged_by);
CREATE INDEX billing_interest_rates_created_by_idx
  ON public.billing_interest_rates (created_by);

CREATE INDEX compliance_acknowledgements_by_idx
  ON public.compliance_acknowledgements (acknowledged_by);
CREATE INDEX compliance_entries_created_by_idx
  ON public.compliance_entries (created_by);
CREATE INDEX compliance_entries_evidence_idx
  ON public.compliance_entries (society_id, evidence_version_id);
CREATE INDEX compliance_entries_responsible_member_idx
  ON public.compliance_entries (society_id, responsible_membership_id);
CREATE INDEX compliance_entries_updated_by_idx
  ON public.compliance_entries (updated_by);
CREATE INDEX compliance_revisions_created_by_idx
  ON public.compliance_revisions (created_by);
CREATE INDEX compliance_settings_updated_by_idx
  ON public.compliance_settings (updated_by);
CREATE INDEX data_cleanup_rules_updated_by_idx
  ON public.data_cleanup_rules (updated_by);

CREATE INDEX document_official_case_evidence_created_by_idx
  ON public.document_official_case_evidence (created_by);
CREATE INDEX document_official_case_revisions_created_by_idx
  ON public.document_official_case_revisions (created_by);
CREATE INDEX document_official_case_settings_updated_by_idx
  ON public.document_official_case_settings (updated_by);
CREATE INDEX document_official_cases_created_by_idx
  ON public.document_official_cases (created_by);
CREATE INDEX document_official_cases_compliance_entry_idx
  ON public.document_official_cases (society_id, compliance_entry_id);
CREATE INDEX document_official_cases_reviewer_idx
  ON public.document_official_cases (society_id, reviewer_membership_id);
CREATE INDEX document_official_cases_updated_by_idx
  ON public.document_official_cases (updated_by);

CREATE INDEX unit_handover_acknowledgements_membership_idx
  ON public.unit_handover_acknowledgements (society_id, membership_id);
CREATE INDEX unit_handover_photos_added_by_idx
  ON public.unit_handover_photos (added_by);
CREATE INDEX unit_handover_photos_handover_idx
  ON public.unit_handover_photos (society_id, handover_id);
CREATE INDEX unit_handover_readings_added_by_idx
  ON public.unit_handover_readings (added_by);
CREATE INDEX unit_handover_readings_reading_idx
  ON public.unit_handover_readings (society_id, reading_id);
CREATE INDEX unit_handover_revisions_changed_by_idx
  ON public.unit_handover_revisions (changed_by);
CREATE INDEX unit_handover_templates_created_by_idx
  ON public.unit_handover_templates (created_by);
CREATE INDEX unit_handover_templates_updated_by_idx
  ON public.unit_handover_templates (updated_by);
CREATE INDEX unit_handovers_closed_by_idx
  ON public.unit_handovers (closed_by);
CREATE INDEX unit_handovers_created_by_idx
  ON public.unit_handovers (created_by);
CREATE INDEX unit_handovers_updated_by_idx
  ON public.unit_handovers (updated_by);
