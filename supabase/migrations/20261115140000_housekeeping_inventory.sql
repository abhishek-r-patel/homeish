CREATE TABLE public.housekeeping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  unit_of_measure text NOT NULL CHECK (char_length(btrim(unit_of_measure)) BETWEEN 1 AND 30),
  category text NOT NULL CHECK (category IN ('cleaning', 'tools', 'consumables', 'other')),
  minimum_stock numeric(16,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_low_alert_date date,
  CONSTRAINT housekeeping_items_society_id_id_key UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX housekeeping_items_name_idx
  ON public.housekeeping_items (society_id, lower(name));
CREATE INDEX housekeeping_items_created_by_idx ON public.housekeeping_items (created_by);
CREATE INDEX housekeeping_items_updated_by_idx ON public.housekeeping_items (updated_by);

CREATE TABLE public.housekeeping_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  item_id uuid NOT NULL,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  kind text NOT NULL CHECK (kind IN ('in', 'out', 'adjustment')),
  quantity numeric(16,3) NOT NULL CHECK (quantity <> 0),
  effective_date date NOT NULL,
  vendor text CHECK (char_length(vendor) BETWEEN 1 AND 120),
  purpose text CHECK (char_length(purpose) BETWEEN 1 AND 500),
  cost_paise bigint CHECK (cost_paise >= 0),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  CONSTRAINT housekeeping_transactions_item_same_society_fkey
    FOREIGN KEY (society_id, item_id)
    REFERENCES public.housekeeping_items (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT housekeeping_transactions_direction_check CHECK (
    (kind = 'in' AND quantity > 0)
    OR (kind = 'out' AND quantity < 0 AND purpose IS NOT NULL)
    OR (kind = 'adjustment' AND purpose IS NOT NULL)
  ),
  CONSTRAINT housekeeping_transactions_cost_check
    CHECK (kind = 'in' OR cost_paise IS NULL),
  CONSTRAINT housekeeping_transactions_retry_key
    UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX housekeeping_transactions_ledger_idx
  ON public.housekeeping_transactions (society_id, item_id, effective_date, sequence);
CREATE INDEX housekeeping_transactions_created_by_idx
  ON public.housekeeping_transactions (created_by);

ALTER TABLE public.housekeeping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.housekeeping_items, public.housekeeping_transactions
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.housekeeping_transactions_sequence_seq
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY housekeeping_items_no_direct_access
  ON public.housekeeping_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY housekeeping_transactions_no_direct_access
  ON public.housekeeping_transactions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION private.housekeeping_reject_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Stock transactions are immutable; add an adjustment with a reason.'
    USING ERRCODE = '23514';
END;
$$;
REVOKE ALL ON FUNCTION private.housekeeping_reject_history_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER housekeeping_transactions_immutable
  BEFORE UPDATE OR DELETE ON public.housekeeping_transactions
  FOR EACH ROW EXECUTE FUNCTION private.housekeeping_reject_history_mutation();

CREATE OR REPLACE FUNCTION private.housekeeping_authorize(
  p_society_id uuid, p_write boolean
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id,
      CASE WHEN p_write THEN ARRAY['admin', 'hk_supervisor']::text[]
        ELSE ARRAY['admin', 'hk_supervisor', 'committee']::text[] END)
    OR NOT private.module_enabled(p_society_id, 'housekeeping')
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Inventory access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.housekeeping_authorize(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.housekeeping_local_date(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE society.timezone)::date
  FROM public.societies AS society WHERE society.id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.housekeeping_local_date(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.housekeeping_notify_low(
  p_society_id uuid, p_item_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  item_row public.housekeeping_items;
  current_stock numeric;
  local_day date := private.housekeeping_local_date(p_society_id);
  recipient record;
  sent_count integer := 0;
BEGIN
  SELECT * INTO item_row FROM public.housekeeping_items
  WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
  IF NOT FOUND OR NOT item_row.active
    OR item_row.last_low_alert_date = local_day THEN RETURN 0; END IF;
  SELECT COALESCE(sum(quantity), 0) INTO current_stock
  FROM public.housekeeping_transactions
  WHERE society_id = p_society_id AND item_id = p_item_id;
  IF current_stock > item_row.minimum_stock THEN RETURN 0; END IF;
  UPDATE public.housekeeping_items SET last_low_alert_date = local_day
  WHERE society_id = p_society_id AND id = p_item_id;
  FOR recipient IN
    SELECT user_id FROM public.memberships
    WHERE society_id = p_society_id AND status = 'active'
      AND roles && ARRAY['admin', 'hk_supervisor']::text[]
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, 'inventory_low_stock', 'Low inventory stock',
      left(item_row.name || ' is at or below its minimum stock level.', 300),
      'housekeeping', p_item_id, p_request_trace
    );
    sent_count := sent_count + 1;
  END LOOP;
  RETURN sent_count;
END;
$$;
REVOKE ALL ON FUNCTION private.housekeeping_notify_low(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.housekeeping_items_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.housekeeping_authorize(p_society_id, false);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', item.id, 'name', item.name, 'unit_of_measure', item.unit_of_measure,
      'category', item.category, 'minimum_stock', item.minimum_stock::text,
      'active', item.active, 'updated_at', item.updated_at,
      'stock', COALESCE(stock.quantity, 0)::text,
      'low_stock', item.active AND COALESCE(stock.quantity, 0) <= item.minimum_stock
    ) ORDER BY lower(item.name))
    FROM public.housekeeping_items AS item
    LEFT JOIN (
      SELECT item_id, sum(quantity) AS quantity
      FROM public.housekeeping_transactions WHERE society_id = p_society_id
      GROUP BY item_id
    ) AS stock ON stock.item_id = item.id
    WHERE item.society_id = p_society_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.housekeeping_item_save(
  p_society_id uuid, p_item_id uuid, p_name text, p_unit_of_measure text,
  p_category text, p_minimum_stock numeric, p_active boolean,
  p_expected_updated_at timestamptz, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  item_row public.housekeeping_items;
  saved_id uuid;
BEGIN
  PERFORM private.housekeeping_authorize(p_society_id, true);
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120
    OR p_unit_of_measure IS NULL OR char_length(btrim(p_unit_of_measure)) NOT BETWEEN 1 AND 30
    OR p_category IS NULL OR p_category NOT IN ('cleaning', 'tools', 'consumables', 'other')
    OR p_minimum_stock IS NULL OR p_minimum_stock < 0
    OR p_minimum_stock <> round(p_minimum_stock, 3)
    OR p_minimum_stock >= 10000000000000 OR p_active IS NULL
    OR p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'Check the inventory item details.' USING ERRCODE = '22023'; END IF;
  IF p_item_id IS NULL THEN
    INSERT INTO public.housekeeping_items (
      society_id, name, unit_of_measure, category, minimum_stock, active,
      created_by, updated_by
    ) VALUES (
      p_society_id, btrim(p_name), btrim(p_unit_of_measure), p_category,
      p_minimum_stock, p_active, auth.uid(), auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO item_row FROM public.housekeeping_items
    WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found.' USING ERRCODE = 'P0002'; END IF;
    IF p_expected_updated_at IS DISTINCT FROM item_row.updated_at THEN
      RAISE EXCEPTION 'The inventory item changed; refresh and retry.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    IF btrim(p_unit_of_measure) <> item_row.unit_of_measure AND EXISTS (
      SELECT 1 FROM public.housekeeping_transactions
      WHERE society_id = p_society_id AND item_id = p_item_id
    ) THEN
      RAISE EXCEPTION 'The unit of measure cannot change after stock is recorded.'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.housekeeping_items SET name = btrim(p_name),
      unit_of_measure = btrim(p_unit_of_measure), category = p_category,
      minimum_stock = p_minimum_stock, active = p_active,
      updated_by = auth.uid(), updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_item_id;
    saved_id := p_item_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin' ELSE 'hk_supervisor' END,
    'inventory.item.save', 'housekeeping_item', saved_id::text,
    jsonb_build_object('active', p_active, 'minimum_stock', p_minimum_stock), p_request_trace
  );
  PERFORM private.housekeeping_notify_low(p_society_id, saved_id, p_request_trace);
  RETURN saved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.housekeeping_stock_record(
  p_society_id uuid, p_item_id uuid, p_kind text, p_quantity numeric,
  p_effective_date date, p_vendor text, p_purpose text, p_cost_paise bigint,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  item_row public.housekeeping_items;
  existing_id uuid;
  saved_id uuid;
  minimum_balance numeric;
BEGIN
  PERFORM private.housekeeping_authorize(p_society_id, true);
  IF p_client_request_id IS NULL OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'A stock request identifier is required.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_society_id::text || ':' || auth.uid()::text || ':' || p_client_request_id::text, 0
  ));
  SELECT id INTO existing_id FROM public.housekeeping_transactions
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN existing_id; END IF;
  SELECT * INTO item_row FROM public.housekeeping_items
  WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
  IF NOT FOUND OR NOT item_row.active THEN
    RAISE EXCEPTION 'Active inventory item not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('in', 'out', 'adjustment')
    OR p_quantity IS NULL OR p_quantity = 0 OR abs(p_quantity) >= 10000000000000
    OR p_quantity <> round(p_quantity, 3)
    OR (p_kind IN ('in', 'out') AND p_quantity < 0)
    OR p_effective_date IS NULL OR p_effective_date > private.housekeeping_local_date(p_society_id)
    OR (p_kind IN ('out', 'adjustment') AND
      (p_purpose IS NULL OR char_length(btrim(p_purpose)) NOT BETWEEN 1 AND 500))
    OR (p_purpose IS NOT NULL AND char_length(btrim(p_purpose)) NOT BETWEEN 1 AND 500)
    OR (p_vendor IS NOT NULL AND char_length(btrim(p_vendor)) NOT BETWEEN 1 AND 120)
    OR (p_cost_paise IS NOT NULL AND (p_kind <> 'in' OR p_cost_paise < 0))
  THEN RAISE EXCEPTION 'Check the stock transaction details.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.housekeeping_transactions (
    society_id, item_id, kind, quantity, effective_date, vendor, purpose,
    cost_paise, created_by, client_request_id
  ) VALUES (
    p_society_id, p_item_id, p_kind,
    CASE WHEN p_kind = 'out' THEN -p_quantity ELSE p_quantity END,
    p_effective_date, btrim(p_vendor), btrim(p_purpose), p_cost_paise,
    auth.uid(), p_client_request_id
  ) RETURNING id INTO saved_id;
  -- An item lock serializes writes; backdated entries must also preserve every historical balance.
  SELECT min(balance) INTO minimum_balance FROM (
    SELECT sum(quantity) OVER (ORDER BY effective_date, sequence ROWS UNBOUNDED PRECEDING) AS balance
    FROM public.housekeeping_transactions
    WHERE society_id = p_society_id AND item_id = p_item_id
  ) AS ledger;
  IF minimum_balance < 0 THEN
    RAISE EXCEPTION 'This entry would make stock negative on its date or a later date.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin' ELSE 'hk_supervisor' END,
    'inventory.stock.record', 'housekeeping_transaction', saved_id::text,
    jsonb_build_object('kind', p_kind, 'quantity', p_quantity, 'effective_date', p_effective_date),
    p_request_trace
  );
  PERFORM private.housekeeping_notify_low(p_society_id, p_item_id, p_request_trace);
  RETURN saved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.housekeeping_transactions_list(
  p_society_id uuid, p_item_id uuid, p_from date, p_to date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.housekeeping_authorize(p_society_id, false);
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Choose a valid stock report date range.' USING ERRCODE = '22023';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', transaction.id, 'item_id', item.id, 'item_name', item.name,
      'unit_of_measure', item.unit_of_measure, 'kind', transaction.kind,
      'quantity', transaction.quantity::text, 'effective_date', transaction.effective_date,
      'vendor', transaction.vendor, 'purpose', transaction.purpose,
      'cost_paise', transaction.cost_paise::text
    ) ORDER BY transaction.effective_date DESC, transaction.sequence DESC)
    FROM public.housekeeping_transactions AS transaction
    JOIN public.housekeeping_items AS item
      ON item.society_id = transaction.society_id AND item.id = transaction.item_id
    WHERE transaction.society_id = p_society_id
      AND (p_item_id IS NULL OR transaction.item_id = p_item_id)
      AND transaction.effective_date BETWEEN p_from AND p_to
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.housekeeping_low_stock_run(
  p_society_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item_record record; sent_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid reminder request.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'housekeeping')
    OR NOT private.society_writable(p_society_id) THEN RETURN 0; END IF;
  FOR item_record IN SELECT id FROM public.housekeeping_items
    WHERE society_id = p_society_id AND active ORDER BY id
  LOOP
    sent_count := sent_count + private.housekeeping_notify_low(
      p_society_id, item_record.id, p_request_trace
    );
  END LOOP;
  RETURN sent_count;
END;
$$;

REVOKE ALL ON FUNCTION public.housekeeping_items_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.housekeeping_item_save(uuid, uuid, text, text, text, numeric, boolean, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.housekeeping_stock_record(uuid, uuid, text, numeric, date, text, text, bigint, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.housekeeping_transactions_list(uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.housekeeping_low_stock_run(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping_items_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping_item_save(uuid, uuid, text, text, text, numeric, boolean, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping_stock_record(uuid, uuid, text, numeric, date, text, text, bigint, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping_transactions_list(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping_low_stock_run(uuid, text) TO service_role;
