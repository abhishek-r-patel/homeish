-- Turn P16 storage into audited expenses, income, approvals, books and month close.
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN (
    'core',
    'visitor',
    'delivery',
    'billing',
    'service_request',
    'staff',
    'housekeeping',
    'amc',
    'notice',
    'amenity',
    'directory',
    'expense'
  )
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('expense', 'Society Expenses & Accounts', false, 11);

CREATE FUNCTION private.expense_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_settings) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_settings) AS key
    WHERE key NOT IN ('approval_threshold_paise', 'billing_income_account_id')
  ) THEN
    RETURN false;
  END IF;
  IF p_settings ? 'approval_threshold_paise' AND (
    jsonb_typeof(p_settings -> 'approval_threshold_paise') <> 'number'
    OR (p_settings ->> 'approval_threshold_paise') !~ '^[0-9]{1,15}$'
  ) THEN
    RETURN false;
  END IF;
  IF p_settings ? 'billing_income_account_id'
    AND jsonb_typeof(p_settings -> 'billing_income_account_id') <> 'null'
    AND (
      jsonb_typeof(p_settings -> 'billing_income_account_id') <> 'string'
      OR (p_settings ->> 'billing_income_account_id')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.expense_settings_valid(jsonb)
  TO authenticated, service_role;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_expense_settings_check
  CHECK (module_key <> 'expense' OR private.expense_settings_valid(settings));

-- Append-only cash and bank books. Corrections are reversal entries.
CREATE TABLE public.expense_book_entries (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  entry_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  source text NOT NULL
    CHECK (source IN ('expense', 'income', 'billing_payment', 'reversal')),
  expense_id uuid,
  category_id uuid,
  income_kind text CHECK (income_kind IN ('donation', 'interest', 'other')),
  billing_payment_id uuid,
  reverses_entry_id uuid,
  counterparty text NOT NULL
    CHECK (counterparty = btrim(counterparty) AND char_length(counterparty) BETWEEN 1 AND 120),
  reference text CHECK (char_length(reference) BETWEEN 1 AND 120),
  description text CHECK (char_length(description) BETWEEN 1 AND 2000),
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_book_entries_account_fkey FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_book_entries_category_fkey FOREIGN KEY (society_id, category_id)
    REFERENCES public.expense_categories (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_book_entries_expense_fkey FOREIGN KEY (society_id, expense_id)
    REFERENCES public.expenses (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_book_entries_billing_payment_fkey
    FOREIGN KEY (society_id, billing_payment_id)
    REFERENCES public.billing_payments (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT expense_book_entries_reverses_fkey FOREIGN KEY (society_id, reverses_entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  -- Reversals keep the original category or income kind so reports can net them.
  CONSTRAINT expense_book_entries_shape_check CHECK (
    (source = 'expense' AND direction = 'out' AND expense_id IS NOT NULL
      AND category_id IS NOT NULL AND income_kind IS NULL
      AND billing_payment_id IS NULL AND reverses_entry_id IS NULL)
    OR (source = 'income' AND direction = 'in' AND income_kind IS NOT NULL
      AND client_request_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND billing_payment_id IS NULL
      AND reverses_entry_id IS NULL)
    OR (source = 'billing_payment' AND direction = 'in'
      AND billing_payment_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND income_kind IS NULL
      AND reverses_entry_id IS NULL)
    OR (source = 'reversal' AND reverses_entry_id IS NOT NULL
      AND client_request_id IS NOT NULL AND description IS NOT NULL
      AND expense_id IS NULL AND billing_payment_id IS NULL
      AND (category_id IS NULL OR income_kind IS NULL))
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, expense_id),
  UNIQUE (society_id, billing_payment_id),
  UNIQUE (society_id, reverses_entry_id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX expense_book_entries_date_idx
  ON public.expense_book_entries (society_id, entry_date DESC, created_at DESC, id);
CREATE INDEX expense_book_entries_account_idx
  ON public.expense_book_entries (society_id, account_id, entry_date);
CREATE INDEX expense_book_entries_category_idx
  ON public.expense_book_entries (society_id, category_id);
CREATE INDEX expense_book_entries_created_by_idx
  ON public.expense_book_entries (created_by);

CREATE TABLE public.expense_month_locks (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  locked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  locked_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, month)
);
CREATE INDEX expense_month_locks_locked_by_idx ON public.expense_month_locks (locked_by);

ALTER TABLE public.expense_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_month_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_book_entries, public.expense_month_locks
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_book_entries_no_direct_access
  ON public.expense_book_entries FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_month_locks_no_direct_access
  ON public.expense_month_locks FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.expense_lock_books(p_society_id uuid)
RETURNS void LANGUAGE sql SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('expense-books:' || p_society_id::text, 0))
$$;
REVOKE ALL ON FUNCTION private.expense_lock_books(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_month_closed(p_society_id uuid, p_day date)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_month_locks
    WHERE society_id = p_society_id
      AND month = (p_day - (extract(day FROM p_day)::integer - 1))
  )
$$;
REVOKE ALL ON FUNCTION private.expense_month_closed(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_entries_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  opening date;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Book entries are append-only. Record a reversal instead.'
      USING ERRCODE = '55000';
  END IF;
  PERFORM private.expense_lock_books(NEW.society_id);
  SELECT opening_on INTO opening FROM public.expense_accounts
  WHERE society_id = NEW.society_id AND id = NEW.account_id;
  IF NEW.entry_date < opening THEN
    RAISE EXCEPTION 'Entries cannot precede the account opening date.'
      USING ERRCODE = '23514';
  END IF;
  IF private.expense_month_closed(NEW.society_id, NEW.entry_date) THEN
    RAISE EXCEPTION 'This month is closed.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_entries_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER expense_book_entries_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.expense_book_entries
  FOR EACH ROW EXECUTE FUNCTION private.expense_entries_guard();
CREATE TRIGGER expense_book_entries_no_truncate
  BEFORE TRUNCATE ON public.expense_book_entries
  FOR EACH STATEMENT EXECUTE FUNCTION private.expense_entries_guard();

CREATE FUNCTION private.expense_authorize(p_society_id uuid, p_access text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_access NOT IN ('read', 'manage', 'approve')
    OR NOT private.module_enabled(p_society_id, 'expense')
    OR NOT private.has_role(
      p_society_id,
      CASE p_access
        WHEN 'manage' THEN ARRAY['admin']
        WHEN 'approve' THEN ARRAY['committee']
        ELSE ARRAY['admin', 'committee']
      END::text[]
    )
    OR (p_access <> 'read' AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Expense access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_authorize(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_check_trace(p_request_trace text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request trace is invalid.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_check_trace(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.expense_threshold(p_society_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT (settings ->> 'approval_threshold_paise')::bigint
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'expense'
  ), 5000000)
$$;
REVOKE ALL ON FUNCTION private.expense_threshold(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Seed the approved default categories the first time the module is enabled.
CREATE FUNCTION private.expense_seed_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid;
BEGIN
  IF NEW.module_key <> 'expense' OR NOT NEW.enabled
    OR (TG_OP = 'UPDATE' AND OLD.enabled)
    OR EXISTS (SELECT 1 FROM public.expense_categories WHERE society_id = NEW.society_id)
  THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NEW.updated_by, society.created_by) INTO actor
  FROM public.societies AS society WHERE society.id = NEW.society_id;
  INSERT INTO public.expense_categories (society_id, name, created_by)
  SELECT NEW.society_id, category.name, actor
  FROM unnest(ARRAY[
    'Repairs', 'Utilities', 'Staff', 'Housekeeping', 'Security', 'AMC',
    'Insurance & taxes', 'Administration', 'Events', 'Other'
  ]) AS category(name)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_seed_categories()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER module_configs_expense_seed_categories
  AFTER INSERT OR UPDATE OF enabled ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION private.expense_seed_categories();

-- Confirmed billing payments become income on the chosen bank account. A payment
-- dated in a closed month or before the account opened is booked on the local day.
CREATE FUNCTION private.expense_post_billing_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  income_account public.expense_accounts;
  income_account_id uuid;
  entry_day date;
BEGIN
  IF NEW.status <> 'confirmed'
    OR (TG_OP = 'UPDATE' AND OLD.status = 'confirmed')
    OR NOT private.module_enabled(NEW.society_id, 'expense')
  THEN
    RETURN NEW;
  END IF;
  SELECT (settings ->> 'billing_income_account_id')::uuid INTO income_account_id
  FROM public.module_configs
  WHERE society_id = NEW.society_id AND module_key = 'expense';
  IF income_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO income_account FROM public.expense_accounts
  WHERE society_id = NEW.society_id AND id = income_account_id AND active;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  PERFORM private.expense_lock_books(NEW.society_id);
  entry_day := CASE
    WHEN NEW.paid_on >= income_account.opening_on
      AND NOT private.expense_month_closed(NEW.society_id, NEW.paid_on)
      THEN NEW.paid_on
    ELSE private.housekeeping_local_date(NEW.society_id)
  END;
  IF entry_day < income_account.opening_on
    OR private.expense_month_closed(NEW.society_id, entry_day)
  THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.expense_book_entries (
    society_id, account_id, entry_date, direction, amount_paise, source,
    billing_payment_id, counterparty, reference, created_by
  ) VALUES (
    NEW.society_id, income_account.id, entry_day, 'in', NEW.amount_paise,
    'billing_payment', NEW.id, 'Maintenance collection', left(NEW.receipt_no, 120),
    NEW.confirmed_by
  )
  ON CONFLICT (society_id, billing_payment_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_post_billing_payment()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER billing_payments_expense_income
  AFTER INSERT OR UPDATE OF status ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION private.expense_post_billing_payment();

-- Private receipts: admins upload under their own folder; admins and committee
-- may read receipts that are attached to an expense.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-files', 'expense-files', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
);

CREATE FUNCTION private.expense_file_scope(p_path text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_path IS NULL
    OR p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/expense/[0-9a-f-]{36}\.(jpg|png|pdf)$'
    OR split_part(p_path, '/', 1)
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR split_part(p_path, '/', 2)
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR split_part(p_path, '/', 4)
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
  THEN
    RETURN NULL;
  END IF;
  RETURN split_part(p_path, '/', 1)::uuid;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_file_scope(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.expense_file_scope(text) TO authenticated, service_role;

CREATE FUNCTION private.expense_file_readable(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.module_enabled(private.expense_file_scope(p_path), 'expense')
    AND private.has_role(private.expense_file_scope(p_path), ARRAY['admin', 'committee']::text[])
    AND (
      (split_part(p_path, '/', 2) = auth.uid()::text
        AND private.has_role(private.expense_file_scope(p_path), ARRAY['admin']::text[]))
      OR EXISTS (
        SELECT 1 FROM public.expenses
        WHERE society_id = private.expense_file_scope(p_path) AND receipt_path = p_path
      )
    )
$$;
REVOKE ALL ON FUNCTION private.expense_file_readable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.expense_file_readable(text) TO authenticated, service_role;
CREATE POLICY expense_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-files' AND private.expense_file_readable(name));
CREATE POLICY expense_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-files'
    AND private.expense_file_scope(name) IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
    AND private.module_enabled(private.expense_file_scope(name), 'expense')
    AND private.society_writable(private.expense_file_scope(name))
    AND private.has_role(private.expense_file_scope(name), ARRAY['admin']::text[])
  );

CREATE FUNCTION private.expense_verify_file(p_society_id uuid, p_path text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  metadata jsonb;
  mime text;
BEGIN
  IF p_path IS NULL THEN
    RETURN;
  END IF;
  IF private.expense_file_scope(p_path) IS DISTINCT FROM p_society_id
    OR split_part(p_path, '/', 2) <> auth.uid()::text
  THEN
    RAISE EXCEPTION 'The receipt is not available.' USING ERRCODE = '42501';
  END IF;
  SELECT object.metadata INTO metadata FROM storage.objects AS object
  WHERE bucket_id = 'expense-files' AND name = p_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found.' USING ERRCODE = 'P0002';
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
    RAISE EXCEPTION 'Invalid receipt.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_verify_file(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_settings_update(
  p_society_id uuid,
  p_approval_threshold_paise bigint,
  p_billing_income_account_id uuid,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.module_configs;
  saved public.module_configs;
  next_settings jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_approval_threshold_paise IS NULL
    OR p_approval_threshold_paise NOT BETWEEN 0 AND 999999999999999
  THEN
    RAISE EXCEPTION 'The approval threshold is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_billing_income_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_accounts
    WHERE society_id = p_society_id AND id = p_billing_income_account_id
      AND active AND account_type = 'bank'
  ) THEN
    RAISE EXCEPTION 'Choose an active bank account.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense' FOR UPDATE;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Expense settings changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  next_settings := jsonb_build_object(
    'approval_threshold_paise', p_approval_threshold_paise,
    'billing_income_account_id', p_billing_income_account_id
  );
  IF next_settings = previous.settings THEN
    RETURN jsonb_build_object('updated_at', previous.updated_at);
  END IF;
  UPDATE public.module_configs SET settings = next_settings, updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'expense'
  RETURNING * INTO saved;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.settings.update', 'module_config',
    'expense', jsonb_build_object('settings', previous.settings),
    jsonb_build_object('settings', saved.settings), p_request_trace
  );
  RETURN jsonb_build_object('updated_at', saved.updated_at);
END;
$$;

CREATE FUNCTION public.expense_account_save(
  p_society_id uuid,
  p_account_id uuid,
  p_name text,
  p_account_type text,
  p_opening_balance_paise bigint,
  p_opening_on date,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_accounts;
  saved_id uuid;
  clean_name text := btrim(p_name);
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR p_account_type NOT IN ('cash', 'bank') OR p_active IS NULL
    OR p_opening_on IS NULL OR p_opening_balance_paise IS NULL
    OR p_opening_balance_paise NOT BETWEEN -999999999999999 AND 999999999999999
    OR p_opening_on > private.housekeeping_local_date(p_society_id)
  THEN
    RAISE EXCEPTION 'Check the account details.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF p_account_id IS NULL THEN
    SELECT * INTO previous FROM public.expense_accounts
    WHERE society_id = p_society_id AND lower(name) = lower(clean_name);
    -- A retried create returns the account it already made.
    IF FOUND AND previous.created_by = auth.uid() AND previous.name = clean_name
      AND previous.account_type = p_account_type
      AND previous.opening_balance_paise = p_opening_balance_paise
      AND previous.opening_on = p_opening_on AND previous.active = p_active
    THEN
      RETURN previous.id;
    END IF;
    INSERT INTO public.expense_accounts (
      society_id, name, account_type, opening_balance_paise, opening_on, active, created_by
    ) VALUES (
      p_society_id, clean_name, p_account_type, p_opening_balance_paise,
      p_opening_on, p_active, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_accounts
    WHERE society_id = p_society_id AND id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Account changed. Refresh.' USING ERRCODE = '23505';
    END IF;
    IF previous.account_type <> p_account_type THEN
      RAISE EXCEPTION 'The account type cannot change.' USING ERRCODE = '22023';
    END IF;
    IF (previous.opening_balance_paise <> p_opening_balance_paise
        OR previous.opening_on <> p_opening_on)
      AND (
        EXISTS (
          SELECT 1 FROM public.expense_book_entries
          WHERE society_id = p_society_id AND account_id = p_account_id
        )
        OR EXISTS (
          SELECT 1 FROM public.expenses
          WHERE society_id = p_society_id AND account_id = p_account_id
            AND status = 'pending_approval'
        )
        OR private.expense_month_closed(p_society_id, previous.opening_on)
        OR private.expense_month_closed(p_society_id, p_opening_on)
      )
    THEN
      RAISE EXCEPTION 'Opening details are fixed once the account is used.'
        USING ERRCODE = '22023';
    END IF;
    IF NOT p_active AND EXISTS (
      SELECT 1 FROM public.module_configs
      WHERE society_id = p_society_id AND module_key = 'expense'
        AND settings ->> 'billing_income_account_id' = p_account_id::text
    ) THEN
      RAISE EXCEPTION 'Choose another billing income account first.'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.expense_accounts
    SET name = clean_name, opening_balance_paise = p_opening_balance_paise,
      opening_on = p_opening_on, active = p_active
    WHERE society_id = p_society_id AND id = p_account_id;
    saved_id := p_account_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.account.save', 'expense_account',
    saved_id::text,
    CASE WHEN p_account_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', previous.name, 'opening_balance_paise', previous.opening_balance_paise,
      'opening_on', previous.opening_on, 'active', previous.active
    ) END,
    jsonb_build_object(
      'name', clean_name, 'account_type', p_account_type,
      'opening_balance_paise', p_opening_balance_paise,
      'opening_on', p_opening_on, 'active', p_active
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_category_save(
  p_society_id uuid,
  p_category_id uuid,
  p_name text,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_categories;
  saved_id uuid;
  clean_name text := btrim(p_name);
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR p_active IS NULL
  THEN
    RAISE EXCEPTION 'Check the category details.' USING ERRCODE = '22023';
  END IF;
  IF p_category_id IS NULL THEN
    SELECT * INTO previous FROM public.expense_categories
    WHERE society_id = p_society_id AND lower(name) = lower(clean_name);
    IF FOUND AND previous.created_by = auth.uid() AND previous.name = clean_name
      AND previous.active = p_active
    THEN
      RETURN previous.id;
    END IF;
    INSERT INTO public.expense_categories (society_id, name, active, created_by)
    VALUES (p_society_id, clean_name, p_active, auth.uid())
    RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO previous FROM public.expense_categories
    WHERE society_id = p_society_id AND id = p_category_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Category changed. Refresh.' USING ERRCODE = '23505';
    END IF;
    UPDATE public.expense_categories SET name = clean_name, active = p_active
    WHERE society_id = p_society_id AND id = p_category_id;
    saved_id := p_category_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.category.save', 'expense_category',
    saved_id::text,
    CASE WHEN p_category_id IS NULL THEN NULL
      ELSE jsonb_build_object('name', previous.name, 'active', previous.active) END,
    jsonb_build_object('name', clean_name, 'active', p_active),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION private.expense_check_account(
  p_society_id uuid, p_account_id uuid, p_day date, p_payment_mode text
)
RETURNS public.expense_accounts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account public.expense_accounts;
BEGIN
  SELECT * INTO account FROM public.expense_accounts
  WHERE society_id = p_society_id AND id = p_account_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active account.' USING ERRCODE = '23514';
  END IF;
  IF p_payment_mode IS NOT NULL
    AND (p_payment_mode = 'cash') <> (account.account_type = 'cash')
  THEN
    RAISE EXCEPTION 'Cash payments use the cash account; other modes use a bank.'
      USING ERRCODE = '23514';
  END IF;
  IF p_day < account.opening_on OR private.expense_month_closed(p_society_id, p_day) THEN
    RAISE EXCEPTION 'The date is before the account opened or in a closed month.'
      USING ERRCODE = '23514';
  END IF;
  RETURN account;
END;
$$;
REVOKE ALL ON FUNCTION private.expense_check_account(uuid, uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_record(
  p_society_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_spent_on date,
  p_payee text,
  p_amount_paise bigint,
  p_payment_mode text,
  p_reference text,
  p_description text,
  p_receipt_path text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expenses;
  saved public.expenses;
  needs_approval boolean;
  recipient record;
  clean_payee text := btrim(p_payee);
  clean_reference text := NULLIF(btrim(p_reference), '');
  clean_description text := NULLIF(btrim(p_description), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR p_spent_on IS NULL
    OR p_spent_on > private.housekeeping_local_date(p_society_id)
    OR clean_payee IS NULL OR char_length(clean_payee) NOT BETWEEN 1 AND 120
    OR p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999
    OR p_payment_mode NOT IN ('cash', 'bank', 'upi', 'cheque')
    OR char_length(clean_reference) > 120 OR char_length(clean_description) > 2000
  THEN
    RAISE EXCEPTION 'Check the expense details.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense:' || p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expenses
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.account_id, previous.category_id, previous.spent_on, previous.payee,
        previous.amount_paise, previous.payment_mode, previous.reference,
        previous.description, previous.receipt_path)
      IS DISTINCT FROM ROW(p_account_id, p_category_id, p_spent_on, clean_payee,
        p_amount_paise, p_payment_mode, clean_reference, clean_description, p_receipt_path)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('id', previous.id, 'status', previous.status);
  END IF;
  PERFORM private.expense_check_account(p_society_id, p_account_id, p_spent_on, p_payment_mode);
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_categories
    WHERE society_id = p_society_id AND id = p_category_id AND active
  ) THEN
    RAISE EXCEPTION 'Choose an active category.' USING ERRCODE = '23514';
  END IF;
  PERFORM private.expense_verify_file(p_society_id, p_receipt_path);
  needs_approval := p_amount_paise > private.expense_threshold(p_society_id);
  INSERT INTO public.expenses (
    society_id, account_id, category_id, spent_on, payee, amount_paise,
    payment_mode, reference, description, receipt_path, approval_required, status,
    client_request_id, created_by
  ) VALUES (
    p_society_id, p_account_id, p_category_id, p_spent_on, clean_payee, p_amount_paise,
    p_payment_mode, clean_reference, clean_description, p_receipt_path, needs_approval,
    CASE WHEN needs_approval THEN 'pending_approval' ELSE 'posted' END,
    p_client_request_id, auth.uid()
  ) RETURNING * INTO saved;
  IF NOT needs_approval THEN
    INSERT INTO public.expense_book_entries (
      society_id, account_id, entry_date, direction, amount_paise, source,
      expense_id, category_id, counterparty, reference, description, created_by
    ) VALUES (
      p_society_id, p_account_id, p_spent_on, 'out', p_amount_paise, 'expense',
      saved.id, p_category_id, clean_payee, clean_reference, clean_description, auth.uid()
    );
  ELSE
    FOR recipient IN
      SELECT user_id FROM public.memberships
      WHERE society_id = p_society_id AND status = 'active'
        AND roles && ARRAY['committee']::text[] AND user_id <> auth.uid()
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient.user_id, 'expense_approval_needed',
        'Expense awaiting approval',
        left('An expense to ' || clean_payee || ' needs committee approval.', 300),
        'expense', saved.id, p_request_trace
      );
    END LOOP;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.record', 'expense', saved.id::text, NULL,
    jsonb_build_object(
      'amount_paise', p_amount_paise, 'spent_on', p_spent_on,
      'category_id', p_category_id, 'account_id', p_account_id, 'status', saved.status
    ),
    p_request_trace
  );
  RETURN jsonb_build_object('id', saved.id, 'status', saved.status);
END;
$$;

CREATE FUNCTION public.expense_decide(
  p_society_id uuid,
  p_expense_id uuid,
  p_approve boolean,
  p_note text,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_expense public.expenses;
  clean_note text := NULLIF(btrim(p_note), '');
  next_status text;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'approve');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_approve IS NULL OR char_length(clean_note) > 1000
    OR (NOT p_approve AND clean_note IS NULL)
  THEN
    RAISE EXCEPTION 'Check the decision details.' USING ERRCODE = '22023';
  END IF;
  next_status := CASE WHEN p_approve THEN 'posted' ELSE 'rejected' END;
  SELECT * INTO current_expense FROM public.expenses
  WHERE society_id = p_society_id AND id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found.' USING ERRCODE = 'P0002';
  END IF;
  IF current_expense.created_by = auth.uid() THEN
    RAISE EXCEPTION 'Another committee member must decide this expense.'
      USING ERRCODE = '42501';
  END IF;
  IF current_expense.status <> 'pending_approval' THEN
    -- A retried decision by the same member returns the recorded outcome.
    IF current_expense.decided_by = auth.uid() AND current_expense.status = next_status THEN
      RETURN jsonb_build_object('id', current_expense.id, 'status', current_expense.status);
    END IF;
    RAISE EXCEPTION 'The expense was already decided.' USING ERRCODE = '23505';
  END IF;
  IF p_approve THEN
    PERFORM private.expense_check_account(
      p_society_id, current_expense.account_id, current_expense.spent_on, NULL
    );
  END IF;
  UPDATE public.expenses
  SET status = next_status, decided_by = auth.uid(), decided_at = clock_timestamp(),
    decision_note = clean_note
  WHERE society_id = p_society_id AND id = p_expense_id;
  IF p_approve THEN
    INSERT INTO public.expense_book_entries (
      society_id, account_id, entry_date, direction, amount_paise, source,
      expense_id, category_id, counterparty, reference, description, created_by
    ) VALUES (
      p_society_id, current_expense.account_id, current_expense.spent_on, 'out',
      current_expense.amount_paise, 'expense', current_expense.id,
      current_expense.category_id, current_expense.payee, current_expense.reference,
      current_expense.description, auth.uid()
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = current_expense.created_by
      AND status = 'active'
  ) THEN
    PERFORM private.create_notification(
      p_society_id, current_expense.created_by, 'expense_decided',
      CASE WHEN p_approve THEN 'Expense approved' ELSE 'Expense rejected' END,
      left('The expense to ' || current_expense.payee || ' was '
        || CASE WHEN p_approve THEN 'approved and posted.' ELSE 'rejected.' END, 300),
      'expense', current_expense.id, p_request_trace
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'committee', 'expense.decide', 'expense',
    p_expense_id::text, jsonb_build_object('status', 'pending_approval'),
    jsonb_build_object('status', next_status, 'note', clean_note), p_request_trace
  );
  RETURN jsonb_build_object('id', p_expense_id, 'status', next_status);
END;
$$;

CREATE FUNCTION public.expense_income_record(
  p_society_id uuid,
  p_account_id uuid,
  p_received_on date,
  p_income_kind text,
  p_payer text,
  p_amount_paise bigint,
  p_reference text,
  p_description text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_book_entries;
  saved_id uuid;
  clean_payer text := btrim(p_payer);
  clean_reference text := NULLIF(btrim(p_reference), '');
  clean_description text := NULLIF(btrim(p_description), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR p_received_on IS NULL
    OR p_received_on > private.housekeeping_local_date(p_society_id)
    OR p_income_kind NOT IN ('donation', 'interest', 'other')
    OR clean_payer IS NULL OR char_length(clean_payer) NOT BETWEEN 1 AND 120
    OR p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 999999999999999
    OR char_length(clean_reference) > 120 OR char_length(clean_description) > 2000
  THEN
    RAISE EXCEPTION 'Check the income details.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'expense:' || p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
  ));
  SELECT * INTO previous FROM public.expense_book_entries
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(previous.source, previous.account_id, previous.entry_date, previous.income_kind,
        previous.counterparty, previous.amount_paise, previous.reference, previous.description)
      IS DISTINCT FROM ROW('income'::text, p_account_id, p_received_on, p_income_kind,
        clean_payer, p_amount_paise, clean_reference, clean_description)
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN previous.id;
  END IF;
  PERFORM private.expense_check_account(p_society_id, p_account_id, p_received_on, NULL);
  INSERT INTO public.expense_book_entries (
    society_id, account_id, entry_date, direction, amount_paise, source, income_kind,
    counterparty, reference, description, client_request_id, created_by
  ) VALUES (
    p_society_id, p_account_id, p_received_on, 'in', p_amount_paise, 'income',
    p_income_kind, clean_payer, clean_reference, clean_description,
    p_client_request_id, auth.uid()
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.income.record', 'expense_book_entry',
    saved_id::text, NULL,
    jsonb_build_object(
      'amount_paise', p_amount_paise, 'entry_date', p_received_on,
      'income_kind', p_income_kind, 'account_id', p_account_id
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_entry_reverse(
  p_society_id uuid,
  p_entry_id uuid,
  p_reverse_on date,
  p_reason text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  original public.expense_book_entries;
  previous public.expense_book_entries;
  saved_id uuid;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR p_reverse_on IS NULL
    OR p_reverse_on > private.housekeeping_local_date(p_society_id)
    OR clean_reason IS NULL OR char_length(clean_reason) > 1000
  THEN
    RAISE EXCEPTION 'Check the reversal details.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO original FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO previous FROM public.expense_book_entries
  WHERE society_id = p_society_id AND reverses_entry_id = p_entry_id;
  IF FOUND THEN
    IF previous.created_by = auth.uid() AND previous.client_request_id = p_client_request_id
      AND previous.entry_date = p_reverse_on AND previous.description = clean_reason
    THEN
      RETURN previous.id;
    END IF;
    RAISE EXCEPTION 'The entry was already reversed.' USING ERRCODE = '23505';
  END IF;
  -- Billing collections are corrected in billing; reversals cannot be reversed.
  IF original.source NOT IN ('expense', 'income') OR p_reverse_on < original.entry_date THEN
    RAISE EXCEPTION 'This entry cannot be reversed on that date.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_check_account(p_society_id, original.account_id, p_reverse_on, NULL);
  INSERT INTO public.expense_book_entries (
    society_id, account_id, entry_date, direction, amount_paise, source, category_id,
    income_kind, reverses_entry_id, counterparty, description, client_request_id, created_by
  ) VALUES (
    p_society_id, original.account_id, p_reverse_on,
    CASE original.direction WHEN 'in' THEN 'out' ELSE 'in' END,
    original.amount_paise, 'reversal', original.category_id, original.income_kind,
    original.id, original.counterparty, clean_reason, p_client_request_id, auth.uid()
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.entry.reverse', 'expense_book_entry',
    p_entry_id::text, NULL,
    jsonb_build_object('reversal_id', saved_id, 'entry_date', p_reverse_on, 'reason', clean_reason),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_month_close(
  p_society_id uuid, p_month date, p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  today := private.housekeeping_local_date(p_society_id);
  IF p_month IS NULL OR extract(day FROM p_month) <> 1
    OR p_month > today - extract(day FROM today)::integer
  THEN
    RAISE EXCEPTION 'Only finished months can be closed.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF private.expense_month_closed(p_society_id, p_month) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.expenses
    WHERE society_id = p_society_id AND status = 'pending_approval'
      AND spent_on >= p_month AND spent_on < (p_month + interval '1 month')::date
  ) THEN
    RAISE EXCEPTION 'Decide pending expenses for this month before closing it.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.expense_month_locks (society_id, month, locked_by)
  VALUES (p_society_id, p_month, auth.uid());
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.month.close', 'expense_month',
    p_month::text, jsonb_build_object('closed', false),
    jsonb_build_object('closed', true), p_request_trace
  );
END;
$$;

CREATE FUNCTION public.expense_month_reopen(
  p_society_id uuid, p_month date, p_reason text, p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_month IS NULL OR clean_reason IS NULL OR char_length(clean_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason is required to reopen a month.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  DELETE FROM public.expense_month_locks WHERE society_id = p_society_id AND month = p_month;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The month is not closed.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.month.reopen', 'expense_month',
    p_month::text, jsonb_build_object('closed', true),
    jsonb_build_object('closed', false, 'reason', clean_reason), p_request_trace
  );
END;
$$;

CREATE FUNCTION private.expense_balance(p_society_id uuid, p_account_id uuid, p_as_of date)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN account.opening_on <= p_as_of THEN account.opening_balance_paise ELSE 0 END
    + COALESCE((
      SELECT sum(CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END)
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id AND entry.account_id = p_account_id
        AND entry.entry_date <= p_as_of
    ), 0)::bigint
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id AND account.id = p_account_id
$$;
REVOKE ALL ON FUNCTION private.expense_balance(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_workspace(p_society_id uuid)
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
        'updated_at', category.updated_at
      ) ORDER BY category.active DESC, lower(category.name))
      FROM public.expense_categories AS category WHERE category.society_id = p_society_id
    ), '[]'::jsonb),
    'closed_months', COALESCE((
      SELECT jsonb_agg(month ORDER BY month DESC)
      FROM public.expense_month_locks WHERE society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_expenses_page(
  p_society_id uuid, p_status text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF (p_status IS NOT NULL AND p_status NOT IN ('pending_approval', 'posted', 'rejected'))
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
  THEN
    RAISE EXCEPTION 'Check the page request.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.expenses
      WHERE society_id = p_society_id AND (p_status IS NULL OR status = p_status)
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC, sort_id)
      FROM (
        SELECT expense.spent_on AS sort_date, expense.created_at AS sort_created,
          expense.id AS sort_id,
          jsonb_build_object(
            'id', expense.id, 'spent_on', expense.spent_on, 'payee', expense.payee,
            'amount_paise', expense.amount_paise, 'payment_mode', expense.payment_mode,
            'reference', expense.reference, 'description', expense.description,
            'receipt_path', expense.receipt_path, 'status', expense.status,
            'approval_required', expense.approval_required,
            'decision_note', expense.decision_note, 'decided_at', expense.decided_at,
            'account_name', account.name, 'category_name', category.name,
            'recorded_by', expense.created_by, 'recorded_by_name', recorder.full_name,
            'decided_by_name', decider.full_name, 'created_at', expense.created_at
          ) AS row_data
        FROM public.expenses AS expense
        JOIN public.expense_accounts AS account
          ON account.society_id = expense.society_id AND account.id = expense.account_id
        JOIN public.expense_categories AS category
          ON category.society_id = expense.society_id AND category.id = expense.category_id
        JOIN public.profiles AS recorder ON recorder.id = expense.created_by
        LEFT JOIN public.profiles AS decider ON decider.id = expense.decided_by
        WHERE expense.society_id = p_society_id
          AND (p_status IS NULL OR expense.status = p_status)
        ORDER BY expense.spent_on DESC, expense.created_at DESC, expense.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_entries_page(
  p_society_id uuid, p_from date, p_to date, p_account_id uuid,
  p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
  THEN
    RAISE EXCEPTION 'Check the page request.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.expense_book_entries
      WHERE society_id = p_society_id AND entry_date BETWEEN p_from AND p_to
        AND (p_account_id IS NULL OR account_id = p_account_id)
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY sort_date DESC, sort_created DESC, sort_id)
      FROM (
        SELECT entry.entry_date AS sort_date, entry.created_at AS sort_created,
          entry.id AS sort_id,
          jsonb_build_object(
            'id', entry.id, 'entry_date', entry.entry_date, 'direction', entry.direction,
            'amount_paise', entry.amount_paise, 'source', entry.source,
            'account_id', entry.account_id, 'account_name', account.name,
            'category_name', category.name, 'income_kind', entry.income_kind,
            'counterparty', entry.counterparty, 'reference', entry.reference,
            'description', entry.description, 'expense_id', entry.expense_id,
            'receipt_path', expense.receipt_path,
            'reverses_entry_id', entry.reverses_entry_id,
            'reversed_by_entry_id', reversal.id,
            'month_closed', private.expense_month_closed(p_society_id, entry.entry_date)
          ) AS row_data
        FROM public.expense_book_entries AS entry
        JOIN public.expense_accounts AS account
          ON account.society_id = entry.society_id AND account.id = entry.account_id
        LEFT JOIN public.expense_categories AS category
          ON category.society_id = entry.society_id AND category.id = entry.category_id
        LEFT JOIN public.expenses AS expense
          ON expense.society_id = entry.society_id AND expense.id = entry.expense_id
        LEFT JOIN public.expense_book_entries AS reversal
          ON reversal.society_id = entry.society_id AND reversal.reverses_entry_id = entry.id
        WHERE entry.society_id = p_society_id
          AND entry.entry_date BETWEEN p_from AND p_to
          AND (p_account_id IS NULL OR entry.account_id = p_account_id)
        ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb)
  );
END;
$$;

-- Income and expense are net of reversals; reversals count in their own month.
CREATE FUNCTION public.expense_report(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  billing_enabled boolean;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731 THEN
    RAISE EXCEPTION 'Choose a valid date range.' USING ERRCODE = '22023';
  END IF;
  billing_enabled := private.module_enabled(p_society_id, 'billing');
  RETURN (
    WITH classified AS (
      SELECT entry.entry_date,
        (entry.entry_date - (extract(day FROM entry.entry_date)::integer - 1)) AS month,
        entry.category_id,
        CASE
          WHEN entry.category_id IS NOT NULL THEN NULL
          WHEN entry.source = 'billing_payment' THEN 'billing'
          ELSE entry.income_kind
        END AS income_kind,
        CASE WHEN entry.category_id IS NOT NULL THEN
          CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END
        ELSE 0 END AS expense_paise,
        CASE WHEN entry.category_id IS NULL THEN
          CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END
        ELSE 0 END AS income_paise
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id AND entry.entry_date BETWEEN p_from AND p_to
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'income_paise', COALESCE((SELECT sum(income_paise) FROM classified), 0)::bigint,
      'expense_paise', COALESCE((SELECT sum(expense_paise) FROM classified), 0)::bigint,
      'months', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month, 'income_paise', income::bigint, 'expense_paise', expense::bigint
        ) ORDER BY month)
        FROM (
          SELECT month, sum(income_paise) AS income, sum(expense_paise) AS expense
          FROM classified GROUP BY month
        ) AS by_month
      ), '[]'::jsonb),
      'categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'category', category.name, 'expense_paise', totals.expense::bigint
        ) ORDER BY totals.expense DESC, lower(category.name))
        FROM (
          SELECT category_id, sum(expense_paise) AS expense
          FROM classified WHERE category_id IS NOT NULL GROUP BY category_id
        ) AS totals
        JOIN public.expense_categories AS category
          ON category.society_id = p_society_id AND category.id = totals.category_id
      ), '[]'::jsonb),
      'income_sources', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'source', income_kind, 'income_paise', income::bigint
        ) ORDER BY income_kind)
        FROM (
          SELECT income_kind, sum(income_paise) AS income
          FROM classified WHERE income_kind IS NOT NULL GROUP BY income_kind
        ) AS sources
      ), '[]'::jsonb),
      'balances', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'account', account.name, 'account_type', account.account_type,
          'active', account.active,
          'balance_paise', private.expense_balance(p_society_id, account.id, p_to)
        ) ORDER BY account.account_type, lower(account.name))
        FROM public.expense_accounts AS account WHERE account.society_id = p_society_id
      ), '[]'::jsonb),
      'billing_enabled', billing_enabled,
      'outstanding_dues_paise', CASE WHEN billing_enabled THEN COALESCE((
        SELECT sum(bill.total_paise - bill.paid_paise - bill.waived_paise)
        FROM public.billing_bills AS bill
        WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
          AND bill.period_start <= p_to
      ), 0)::bigint END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_settings_update(uuid, bigint, uuid, timestamptz, text),
  public.expense_account_save(uuid, uuid, text, text, bigint, date, boolean, timestamptz, text),
  public.expense_category_save(uuid, uuid, text, boolean, timestamptz, text),
  public.expense_record(uuid, uuid, uuid, date, text, bigint, text, text, text, text, uuid, text),
  public.expense_decide(uuid, uuid, boolean, text, text),
  public.expense_income_record(uuid, uuid, date, text, text, bigint, text, text, uuid, text),
  public.expense_entry_reverse(uuid, uuid, date, text, uuid, text),
  public.expense_month_close(uuid, date, text),
  public.expense_month_reopen(uuid, date, text, text),
  public.expense_workspace(uuid),
  public.expense_expenses_page(uuid, text, integer, integer),
  public.expense_entries_page(uuid, date, date, uuid, integer, integer),
  public.expense_report(uuid, date, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_settings_update(uuid, bigint, uuid, timestamptz, text),
  public.expense_account_save(uuid, uuid, text, text, bigint, date, boolean, timestamptz, text),
  public.expense_category_save(uuid, uuid, text, boolean, timestamptz, text),
  public.expense_record(uuid, uuid, uuid, date, text, bigint, text, text, text, text, uuid, text),
  public.expense_decide(uuid, uuid, boolean, text, text),
  public.expense_income_record(uuid, uuid, date, text, text, bigint, text, text, uuid, text),
  public.expense_entry_reverse(uuid, uuid, date, text, uuid, text),
  public.expense_month_close(uuid, date, text),
  public.expense_month_reopen(uuid, date, text, text),
  public.expense_workspace(uuid),
  public.expense_expenses_page(uuid, text, integer, integer),
  public.expense_entries_page(uuid, date, date, uuid, integer, integer),
  public.expense_report(uuid, date, date)
  TO authenticated;
