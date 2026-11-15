-- Store private P16 accounts, categories and expenses awaiting or after approval.
CREATE TABLE public.expense_accounts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  account_type text NOT NULL CHECK (account_type IN ('cash', 'bank')),
  opening_balance_paise bigint NOT NULL DEFAULT 0
    CHECK (opening_balance_paise BETWEEN -9007199254740991 AND 9007199254740991),
  opening_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX expense_accounts_name_key
  ON public.expense_accounts (society_id, lower(name));
CREATE UNIQUE INDEX expense_accounts_one_active_cash_key
  ON public.expense_accounts (society_id)
  WHERE account_type = 'cash' AND active;
CREATE INDEX expense_accounts_created_by_idx ON public.expense_accounts (created_by);
CREATE INDEX expense_accounts_updated_by_idx ON public.expense_accounts (updated_by);
CREATE TRIGGER expense_accounts_set_updated_at
  BEFORE UPDATE ON public.expense_accounts
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX expense_categories_name_key
  ON public.expense_categories (society_id, lower(name));
CREATE INDEX expense_categories_created_by_idx ON public.expense_categories (created_by);
CREATE INDEX expense_categories_updated_by_idx ON public.expense_categories (updated_by);
CREATE TRIGGER expense_categories_set_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  category_id uuid NOT NULL,
  spent_on date NOT NULL,
  payee text NOT NULL CHECK (payee = btrim(payee) AND char_length(payee) BETWEEN 1 AND 120),
  amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  payment_mode text NOT NULL CHECK (payment_mode IN ('cash', 'bank', 'upi', 'cheque')),
  reference text CHECK (reference = btrim(reference) AND char_length(reference) BETWEEN 1 AND 120),
  description text CHECK (char_length(description) BETWEEN 1 AND 2000),
  receipt_path text CHECK (char_length(receipt_path) BETWEEN 1 AND 500),
  approval_required boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_approval', 'posted', 'rejected')),
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decided_at timestamptz,
  decision_note text CHECK (
    decision_note = btrim(decision_note) AND char_length(decision_note) BETWEEN 1 AND 1000
  ),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expenses_account_same_society_fkey
    FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expenses_category_same_society_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  -- Pending and directly posted expenses have no decision; approved or
  -- rejected expenses were decided by someone other than their recorder.
  CONSTRAINT expenses_decision_check CHECK (
    (status = 'pending_approval' AND approval_required
      AND decided_by IS NULL AND decided_at IS NULL AND decision_note IS NULL)
    OR (status = 'posted' AND NOT approval_required
      AND decided_by IS NULL AND decided_at IS NULL AND decision_note IS NULL)
    OR (status IN ('posted', 'rejected') AND approval_required
      AND decided_by IS NOT NULL AND decided_at IS NOT NULL
      AND decided_by <> created_by
      AND (status = 'posted' OR decision_note IS NOT NULL))
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expenses_account_idx ON public.expenses (society_id, account_id);
CREATE INDEX expenses_category_idx ON public.expenses (society_id, category_id);
CREATE INDEX expenses_date_idx ON public.expenses (society_id, spent_on DESC, id);
CREATE INDEX expenses_pending_idx ON public.expenses (society_id, created_at)
  WHERE status = 'pending_approval';
CREATE INDEX expenses_created_by_idx ON public.expenses (created_by);
CREATE INDEX expenses_updated_by_idx ON public.expenses (updated_by);
CREATE INDEX expenses_decided_by_idx ON public.expenses (decided_by);
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.expense_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_accounts,
  public.expense_categories, public.expenses
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_accounts_no_direct_access
  ON public.expense_accounts FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_categories_no_direct_access
  ON public.expense_categories FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expenses_no_direct_access
  ON public.expenses FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
