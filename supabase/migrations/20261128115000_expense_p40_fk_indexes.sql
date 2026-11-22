-- Index every P40 foreign key at the leading tenant/source columns.
CREATE INDEX expense_fund_mappings_billing_charge_idx
  ON public.expense_fund_mappings (society_id, billing_charge_type_id);
CREATE INDEX expense_fund_mappings_category_idx
  ON public.expense_fund_mappings (society_id, expense_category_id);
CREATE INDEX expense_fund_transfer_rules_target_idx
  ON public.expense_fund_transfer_rules (society_id, to_fund_id);
CREATE INDEX expense_fund_transfers_from_idx
  ON public.expense_fund_transfers (society_id, from_fund_id);
CREATE INDEX expense_fund_transfers_to_idx
  ON public.expense_fund_transfers (society_id, to_fund_id);
