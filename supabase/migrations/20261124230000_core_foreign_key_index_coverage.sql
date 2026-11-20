-- Complete foreign-key lookup coverage without changing records, constraints or access rules.
CREATE INDEX expense_statement_items_entry_idx
  ON public.expense_statement_items (society_id, account_id, matched_entry_id)
  WHERE society_id IS NOT NULL AND account_id IS NOT NULL AND matched_entry_id IS NOT NULL;

-- Keep the existing index names and row coverage while spelling out the required FK predicate.
DROP INDEX public.service_requests_vendor_same_society_idx;
CREATE INDEX service_requests_vendor_same_society_idx
  ON public.service_requests (society_id, assigned_vendor_id)
  WHERE society_id IS NOT NULL AND assigned_vendor_id IS NOT NULL;

DROP INDEX public.service_request_round_checks_request_idx;
CREATE INDEX service_request_round_checks_request_idx
  ON public.service_request_round_checks (society_id, request_id)
  WHERE society_id IS NOT NULL AND request_id IS NOT NULL;
