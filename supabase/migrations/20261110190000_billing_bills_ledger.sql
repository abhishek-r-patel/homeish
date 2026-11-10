CREATE OR REPLACE FUNCTION private.billing_settings_valid(p_settings jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  item record;
  fee jsonb := p_settings->'late_fee';
  reminders jsonb := p_settings->'reminders';
BEGIN
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RETURN false;
  END IF;
  FOR item IN SELECT key, value FROM jsonb_each(p_settings) LOOP
    IF item.key = 'due_day_of_month' THEN
      IF NOT (
        (jsonb_typeof(item.value) = 'number'
          AND item.value::text ~ '^[0-9]+$'
          AND item.value::numeric BETWEEN 1 AND 31)
        OR item.value = '"last_day"'::jsonb
      ) THEN RETURN false; END IF;
    ELSIF item.key = 'rounding' THEN
      IF item.value NOT IN ('"rupee"'::jsonb, '"paise"'::jsonb) THEN
        RETURN false;
      END IF;
    ELSIF item.key IN ('grace_days', 'pending_confirmation_alert_days') THEN
      IF jsonb_typeof(item.value) <> 'number'
        OR item.value::text !~ '^[0-9]+$'
        OR item.value::numeric > 2147483647
        OR (item.key = 'pending_confirmation_alert_days'
          AND item.value::numeric < 1)
      THEN RETURN false; END IF;
    ELSIF item.key NOT IN ('late_fee', 'reminders') THEN
      RETURN false;
    END IF;
  END LOOP;
  IF fee IS NOT NULL AND fee <> 'null'::jsonb THEN
    IF jsonb_typeof(fee) <> 'object'
      OR NOT (fee ?& ARRAY['type', 'value'])
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(fee) AS property(key)
        WHERE key NOT IN ('type', 'value')
      )
      OR fee->>'type' IS NULL OR fee->>'type' NOT IN ('flat', 'percent')
      OR jsonb_typeof(fee->'value') <> 'number'
    THEN RETURN false; END IF;
    IF (fee->>'value')::numeric <= 0 THEN RETURN false; END IF;
    IF fee->>'type' = 'flat' AND (
      (fee->>'value') !~ '^[0-9]+$'
      OR (fee->>'value')::numeric > 9007199254740991
    ) THEN RETURN false; END IF;
    IF fee->>'type' = 'percent' AND (
      (fee->>'value')::numeric > 100
      OR (fee->>'value')::numeric * 100 <> trunc((fee->>'value')::numeric * 100)
    ) THEN RETURN false; END IF;
  END IF;
  IF reminders IS NOT NULL THEN
    IF jsonb_typeof(reminders) <> 'object'
      OR NOT (reminders ?& ARRAY['before_due_days', 'on_due', 'overdue_every_days'])
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(reminders) AS property(key)
        WHERE key NOT IN ('before_due_days', 'on_due', 'overdue_every_days')
      )
      OR jsonb_typeof(reminders->'on_due') <> 'boolean'
    THEN RETURN false; END IF;
    FOR item IN
      SELECT key, value FROM jsonb_each(reminders) WHERE key <> 'on_due'
    LOOP
      IF jsonb_typeof(item.value) <> 'number'
        OR item.value::text !~ '^[0-9]+$'
        OR item.value::numeric > 2147483647
        OR (item.key = 'overdue_every_days' AND item.value::numeric < 1)
      THEN RETURN false; END IF;
    END LOOP;
  END IF;
  RETURN true;
END;
$$;

CREATE TABLE public.billing_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'regular',
  title text NOT NULL,
  period_start date NOT NULL,
  due_date date NOT NULL,
  total_paise bigint NOT NULL,
  paid_paise bigint NOT NULL DEFAULT 0,
  waived_paise bigint NOT NULL DEFAULT 0,
  related_bill_id uuid,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status text GENERATED ALWAYS AS (
    CASE
      WHEN cancelled_at IS NOT NULL THEN 'cancelled'
      WHEN paid_paise = total_paise THEN 'paid'
      WHEN waived_paise = total_paise THEN 'waived'
      WHEN paid_paise > 0 OR waived_paise > 0 THEN 'partially_paid'
      ELSE 'due'
    END
  ) STORED,
  CONSTRAINT billing_bills_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT billing_bills_id_unit_period_key
    UNIQUE (id, unit_id, period_start),
  CONSTRAINT billing_bills_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_bills_related_same_society_fkey
    FOREIGN KEY (society_id, related_bill_id)
    REFERENCES public.billing_bills (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_bills_kind_check
    CHECK (kind IN ('regular', 'fine', 'late_fee')),
  CONSTRAINT billing_bills_title_check
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT billing_bills_period_check
    CHECK (period_start = date_trunc('month', period_start)::date),
  CONSTRAINT billing_bills_due_date_check CHECK (due_date >= period_start),
  CONSTRAINT billing_bills_total_check
    CHECK (total_paise BETWEEN 1 AND 9007199254740991),
  CONSTRAINT billing_bills_settled_check
    CHECK (
      paid_paise >= 0 AND waived_paise >= 0
      AND paid_paise + waived_paise <= total_paise
    ),
  CONSTRAINT billing_bills_late_fee_check
    CHECK (kind <> 'late_fee' OR related_bill_id IS NOT NULL),
  CONSTRAINT billing_bills_cancel_check
    CHECK (
      (cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL)
      OR (
        cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
        AND cancel_reason IS NOT NULL
        AND char_length(btrim(cancel_reason)) BETWEEN 2 AND 500
        AND paid_paise = 0 AND waived_paise = total_paise
      )
    )
);
CREATE UNIQUE INDEX billing_bills_late_fee_period_key
  ON public.billing_bills (society_id, related_bill_id, period_start)
  WHERE kind = 'late_fee';
CREATE INDEX billing_bills_unit_due_date_idx
  ON public.billing_bills (society_id, unit_id, due_date DESC);
CREATE INDEX billing_bills_outstanding_due_date_idx
  ON public.billing_bills (society_id, due_date)
  WHERE cancelled_at IS NULL AND paid_paise + waived_paise < total_paise;
CREATE INDEX billing_bills_created_by_idx
  ON public.billing_bills (created_by);
CREATE INDEX billing_bills_cancelled_by_idx
  ON public.billing_bills (cancelled_by);
CREATE INDEX billing_bills_related_same_society_idx
  ON public.billing_bills (society_id, related_bill_id);

CREATE TABLE public.billing_bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  bill_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  period_start date NOT NULL,
  charge_type_id uuid,
  description text NOT NULL,
  amount_paise bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_bill_lines_bill_unit_period_fkey
    FOREIGN KEY (bill_id, unit_id, period_start)
    REFERENCES public.billing_bills (id, unit_id, period_start) ON DELETE RESTRICT,
  CONSTRAINT billing_bill_lines_charge_same_society_fkey
    FOREIGN KEY (society_id, charge_type_id)
    REFERENCES public.billing_charge_types (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_bill_lines_description_check
    CHECK (description = btrim(description) AND char_length(description) BETWEEN 1 AND 160),
  CONSTRAINT billing_bill_lines_amount_check
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991)
);
CREATE INDEX billing_bill_lines_bill_idx
  ON public.billing_bill_lines (bill_id, unit_id, period_start);
CREATE INDEX billing_bill_lines_charge_same_society_idx
  ON public.billing_bill_lines (society_id, charge_type_id);
CREATE UNIQUE INDEX billing_bill_lines_unit_period_charge_key
  ON public.billing_bill_lines (society_id, unit_id, period_start, charge_type_id)
  WHERE charge_type_id IS NOT NULL;
CREATE INDEX billing_bill_lines_created_by_idx
  ON public.billing_bill_lines (created_by);

CREATE TABLE public.billing_ledger_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  kind text NOT NULL,
  direction text NOT NULL,
  amount_paise bigint NOT NULL,
  bill_id uuid,
  payment_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_ledger_entries_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_ledger_entries_bill_same_society_fkey
    FOREIGN KEY (society_id, bill_id)
    REFERENCES public.billing_bills (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_ledger_entries_kind_check
    CHECK (kind IN ('bill', 'payment', 'waiver', 'adjustment')),
  CONSTRAINT billing_ledger_entries_direction_check
    CHECK (direction IN ('debit', 'credit')),
  CONSTRAINT billing_ledger_entries_amount_check
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  CONSTRAINT billing_ledger_entries_reason_check
    CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 2 AND 500),
  CONSTRAINT billing_ledger_entries_source_check
    CHECK (
      (kind = 'bill' AND direction = 'debit' AND bill_id IS NOT NULL
        AND payment_id IS NULL AND reason IS NULL)
      OR (kind = 'payment' AND direction = 'credit' AND bill_id IS NULL
        AND payment_id IS NOT NULL AND reason IS NULL)
      OR (kind = 'waiver' AND direction = 'credit' AND bill_id IS NOT NULL
        AND payment_id IS NULL AND reason IS NOT NULL)
      OR (kind = 'adjustment' AND reason IS NOT NULL
        AND bill_id IS NULL AND payment_id IS NULL)
    )
);
CREATE INDEX billing_ledger_entries_unit_id_idx
  ON public.billing_ledger_entries (society_id, unit_id, id);
CREATE INDEX billing_ledger_entries_created_by_idx
  ON public.billing_ledger_entries (created_by);
CREATE INDEX billing_ledger_entries_bill_same_society_idx
  ON public.billing_ledger_entries (society_id, bill_id);

CREATE OR REPLACE FUNCTION private.reject_billing_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Billing history is immutable.'
    USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER billing_bill_lines_immutable
  BEFORE UPDATE OR DELETE ON public.billing_bill_lines
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();
CREATE TRIGGER billing_ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON public.billing_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();

CREATE OR REPLACE FUNCTION private.billing_bill_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.id, NEW.society_id, NEW.unit_id, NEW.kind, NEW.title,
      NEW.period_start, NEW.due_date, NEW.total_paise, NEW.related_bill_id,
      NEW.created_at, NEW.created_by)
    IS DISTINCT FROM
     (OLD.id, OLD.society_id, OLD.unit_id, OLD.kind, OLD.title,
      OLD.period_start, OLD.due_date, OLD.total_paise, OLD.related_bill_id,
      OLD.created_at, OLD.created_by)
  THEN
    RAISE EXCEPTION 'Published bills are immutable.'
      USING ERRCODE = '42501';
  END IF;
  IF (NEW.paid_paise, NEW.waived_paise, NEW.cancelled_at,
      NEW.cancelled_by, NEW.cancel_reason)
    IS DISTINCT FROM
     (OLD.paid_paise, OLD.waived_paise, OLD.cancelled_at,
      OLD.cancelled_by, OLD.cancel_reason)
    AND current_setting('homeish.billing_mutation', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Bill balances can only change through billing functions.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_bills_immutable
  BEFORE UPDATE ON public.billing_bills
  FOR EACH ROW EXECUTE FUNCTION private.billing_bill_immutable();
CREATE TRIGGER billing_bills_no_delete
  BEFORE DELETE ON public.billing_bills
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();

ALTER TABLE public.billing_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_ledger_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_bills, public.billing_bill_lines,
  public.billing_ledger_entries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.billing_bills, public.billing_bill_lines,
  public.billing_ledger_entries TO authenticated;
CREATE POLICY billing_bills_read
  ON public.billing_bills FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee']::text[])
      OR (
        private.has_role(society_id, ARRAY['resident']::text[])
        AND private.occupies_unit(unit_id)
      )
    )
  );
CREATE POLICY billing_bill_lines_read
  ON public.billing_bill_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_bills bill
      WHERE bill.society_id = society_id AND bill.id = bill_id
    )
  );
CREATE POLICY billing_ledger_entries_read
  ON public.billing_ledger_entries FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee']::text[])
      OR (
        private.has_role(society_id, ARRAY['resident']::text[])
        AND private.occupies_unit(unit_id)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.billing_settings_update(
  p_society_id uuid,
  p_due_day text,
  p_rounding text,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.module_configs;
  result public.module_configs;
  next_settings jsonb;
  due_value jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_due_day IS NULL OR p_rounding IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR (p_due_day <> 'last_day' AND p_due_day !~ '^(?:[1-9]|[12][0-9]|3[01])$')
    OR p_rounding NOT IN ('rupee', 'paise')
  THEN
    RAISE EXCEPTION 'The billing preferences are invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'billing' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing settings were not found.' USING ERRCODE = 'P0002';
  END IF;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Billing settings have changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  due_value := CASE
    WHEN p_due_day = 'last_day' THEN '"last_day"'::jsonb
    ELSE to_jsonb(p_due_day::integer)
  END;
  next_settings := previous.settings || jsonb_build_object(
    'due_day_of_month', due_value, 'rounding', p_rounding
  );
  IF next_settings = previous.settings THEN
    RETURN jsonb_build_object(
      'settings', previous.settings, 'updated_at', previous.updated_at
    );
  END IF;
  IF NOT private.billing_settings_valid(next_settings) THEN
    RAISE EXCEPTION 'Billing settings are invalid.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.module_configs
    SET settings = next_settings, updated_by = auth.uid()
    WHERE society_id = p_society_id AND module_key = 'billing'
    RETURNING * INTO result;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.settings.update',
    'module_config', p_society_id::text,
    jsonb_build_object('settings', previous.settings),
    jsonb_build_object('settings', result.settings), p_request_id
  );
  RETURN jsonb_build_object(
    'settings', result.settings, 'updated_at', result.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.billing_due_date(
  p_society_id uuid, p_period_start date
)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  configured jsonb;
  selected_day integer;
  last_day integer;
BEGIN
  SELECT settings->'due_day_of_month' INTO configured
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'billing';
  last_day := extract(day FROM (
    date_trunc('month', p_period_start) + interval '1 month - 1 day'
  ))::integer;
  IF configured = '"last_day"'::jsonb THEN
    selected_day := last_day;
  ELSE
    selected_day := least(coalesce((configured #>> '{}')::integer, 10), last_day);
  END IF;
  RETURN date_trunc('month', p_period_start)::date + selected_day - 1;
END;
$$;

CREATE OR REPLACE FUNCTION private.billing_checked_amount(p_amount numeric)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 9007199254740991 THEN
    RAISE EXCEPTION 'A calculated charge is outside the supported paise range.'
      USING ERRCODE = '22023';
  END IF;
  RETURN p_amount::bigint;
END;
$$;

CREATE OR REPLACE FUNCTION private.billing_calculate_lines(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb
)
RETURNS TABLE (
  unit_id uuid,
  unit_number text,
  charge_type_id uuid,
  charge_name text,
  method text,
  amount_paise bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  custom_count integer;
  unit_count integer;
  charge_count integer;
  configured_rounding text;
  missing_area text;
BEGIN
  IF p_period_start IS NULL
    OR p_period_start <> date_trunc('month', p_period_start)::date
    OR p_unit_ids IS NULL OR cardinality(p_unit_ids) NOT BETWEEN 1 AND 1000
    OR p_charge_type_ids IS NULL
    OR cardinality(p_charge_type_ids) NOT BETWEEN 1 AND 100
    OR cardinality(p_unit_ids) <> (
      SELECT count(DISTINCT value) FROM unnest(p_unit_ids) AS value
    )
    OR cardinality(p_charge_type_ids) <> (
      SELECT count(DISTINCT value) FROM unnest(p_charge_type_ids) AS value
    )
  THEN
    RAISE EXCEPTION 'Select a valid billing period, units and charges.'
      USING ERRCODE = '22023';
  END IF;
  IF p_custom_amounts IS NULL THEN p_custom_amounts := '[]'::jsonb; END IF;
  IF jsonb_typeof(p_custom_amounts) <> 'array'
    OR jsonb_array_length(p_custom_amounts) > 100000
  THEN
    RAISE EXCEPTION 'Custom charge amounts are invalid.'
      USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_custom_amounts) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(item)) <> 3
      OR NOT (item ?& ARRAY['unit_id', 'charge_type_id', 'amount_paise'])
      OR jsonb_typeof(item->'unit_id') <> 'string'
      OR item->>'unit_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(item->'charge_type_id') <> 'string'
      OR item->>'charge_type_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(item->'amount_paise') <> 'number'
      OR item->>'amount_paise' !~ '^[1-9][0-9]*$'
      OR (item->>'amount_paise')::numeric > 9007199254740991
    THEN
      RAISE EXCEPTION 'Custom charge amounts are invalid.'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_custom_amounts)
      AS custom(unit_id uuid, charge_type_id uuid, amount_paise bigint)
    GROUP BY custom.unit_id, custom.charge_type_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Custom charge amounts contain duplicates.'
      USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO unit_count FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = ANY(p_unit_ids)
      AND unit.active;
  SELECT count(*) INTO charge_count FROM public.billing_charge_types charge
    WHERE charge.society_id = p_society_id
      AND charge.id = ANY(p_charge_type_ids) AND charge.active;
  IF unit_count <> cardinality(p_unit_ids)
    OR charge_count <> cardinality(p_charge_type_ids)
  THEN
    RAISE EXCEPTION 'Some selected units or charges are no longer available.'
      USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(settings->>'rounding', 'rupee') INTO configured_rounding
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'billing';
  IF configured_rounding NOT IN ('rupee', 'paise') THEN
    RAISE EXCEPTION 'Billing rounding settings are invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO custom_count
    FROM public.billing_charge_types charge
    WHERE charge.society_id = p_society_id
      AND charge.id = ANY(p_charge_type_ids)
      AND charge.method = 'custom';
  IF (
    SELECT count(*) FROM jsonb_to_recordset(p_custom_amounts)
      AS custom(unit_id uuid, charge_type_id uuid, amount_paise bigint)
  ) <> custom_count * unit_count
    OR EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_custom_amounts)
        AS custom(unit_id uuid, charge_type_id uuid, amount_paise bigint)
      LEFT JOIN public.units unit
        ON unit.society_id = p_society_id AND unit.id = custom.unit_id
          AND unit.id = ANY(p_unit_ids) AND unit.active
      LEFT JOIN public.billing_charge_types charge
        ON charge.society_id = p_society_id
          AND charge.id = custom.charge_type_id
          AND charge.id = ANY(p_charge_type_ids)
          AND charge.active AND charge.method = 'custom'
      WHERE unit.id IS NULL OR charge.id IS NULL
    )
  THEN
    RAISE EXCEPTION 'Enter one amount for every custom charge and selected unit.'
      USING ERRCODE = '22023';
  END IF;
  SELECT unit.number INTO missing_area
  FROM public.units unit
  JOIN public.billing_charge_types charge
    ON charge.society_id = unit.society_id
  WHERE unit.society_id = p_society_id
    AND unit.id = ANY(p_unit_ids) AND unit.active
    AND charge.id = ANY(p_charge_type_ids) AND charge.active
    AND charge.method = 'per_sqft' AND unit.area_sqft IS NULL
  LIMIT 1;
  IF missing_area IS NOT NULL THEN
    RAISE EXCEPTION 'Unit % needs a recorded area before billing.', missing_area
      USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH custom AS MATERIALIZED (
    SELECT item.unit_id, item.charge_type_id, item.amount_paise
    FROM jsonb_to_recordset(p_custom_amounts)
      AS item(unit_id uuid, charge_type_id uuid, amount_paise bigint)
  ),
  selected_units AS MATERIALIZED (
    SELECT unit.id, unit.number, unit.area_sqft
    FROM public.units unit
    WHERE unit.society_id = p_society_id
      AND unit.id = ANY(p_unit_ids) AND unit.active
  ),
  selected_charges AS MATERIALIZED (
    SELECT charge.id, charge.name, charge.method, charge.amount_paise
    FROM public.billing_charge_types charge
    WHERE charge.society_id = p_society_id
      AND charge.id = ANY(p_charge_type_ids) AND charge.active
  )
  SELECT unit.id, unit.number, charge.id, charge.name, charge.method,
    private.billing_checked_amount(
      CASE
        WHEN charge.method = 'custom' THEN custom.amount_paise::numeric
        WHEN charge.method = 'per_sqft' AND configured_rounding = 'rupee'
          THEN round(charge.amount_paise * unit.area_sqft / 100) * 100
        WHEN charge.method = 'per_sqft'
          THEN round(charge.amount_paise * unit.area_sqft)
        ELSE charge.amount_paise::numeric
      END
    )
  FROM selected_units unit
  CROSS JOIN selected_charges charge
  LEFT JOIN custom
    ON custom.unit_id = unit.id AND custom.charge_type_id = charge.id
  ORDER BY unit.id, charge.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bills_preview(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  line_data jsonb;
  line_count integer;
  new_count integer;
  total_paise numeric;
  due_date date;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin']::text[])
      OR private.has_role(p_society_id, ARRAY['committee']::text[])
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  due_date := private.billing_due_date(p_society_id, p_period_start);
  SELECT
    coalesce(jsonb_agg(
      to_jsonb(line) || jsonb_build_object('already_generated', EXISTS (
        SELECT 1 FROM public.billing_bill_lines existing
        WHERE existing.society_id = p_society_id
          AND existing.unit_id = line.unit_id
          AND existing.period_start = p_period_start
          AND existing.charge_type_id = line.charge_type_id
      ))
      ORDER BY line.unit_id, line.charge_type_id
    ), '[]'::jsonb),
    count(*)::integer,
    count(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM public.billing_bill_lines existing
      WHERE existing.society_id = p_society_id
        AND existing.unit_id = line.unit_id
        AND existing.period_start = p_period_start
        AND existing.charge_type_id = line.charge_type_id
    ))::integer,
    coalesce(sum(line.amount_paise) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM public.billing_bill_lines existing
      WHERE existing.society_id = p_society_id
        AND existing.unit_id = line.unit_id
        AND existing.period_start = p_period_start
        AND existing.charge_type_id = line.charge_type_id
    )), 0)
  INTO line_data, line_count, new_count, total_paise
  FROM private.billing_calculate_lines(
    p_society_id, p_period_start, p_unit_ids, p_charge_type_ids,
    p_custom_amounts
  ) line;
  result := jsonb_build_object(
    'society_id', p_society_id,
    'period_start', p_period_start,
    'due_date', due_date,
    'unit_count', cardinality(p_unit_ids),
    'line_count', line_count,
    'new_line_count', new_count,
    'new_total_paise', total_paise::text,
    'lines', line_data
  );
  result := result || jsonb_build_object(
    'preview_hash', md5(result::text)
  );
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bills_generate(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb,
  p_preview_hash text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  preview jsonb;
  generated_count integer := 0;
  generated_line_count integer := 0;
  new_total numeric := 0;
  job_id uuid;
  bill_ids uuid[] := ARRAY[]::uuid[];
  request_id text := p_request_id;
  recipient record;
  ledger_count integer := 0;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF request_id IS NULL OR char_length(request_id) NOT BETWEEN 1 AND 128
    OR p_preview_hash IS NULL OR p_preview_hash !~ '^[0-9a-f]{32}$'
  THEN
    RAISE EXCEPTION 'The billing preview is invalid.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.module_configs config
    WHERE config.society_id = p_society_id AND config.module_key = 'billing'
    FOR SHARE;
  PERFORM 1 FROM public.billing_charge_types charge
    WHERE charge.society_id = p_society_id
      AND charge.id = ANY(p_charge_type_ids)
    ORDER BY charge.id FOR SHARE;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = ANY(p_unit_ids)
    ORDER BY unit.id FOR UPDATE;
  preview := public.billing_bills_preview(
    p_society_id, p_period_start, p_unit_ids, p_charge_type_ids,
    p_custom_amounts
  );
  IF preview->>'preview_hash' IS DISTINCT FROM p_preview_hash THEN
    RAISE EXCEPTION 'The billing preview has changed. Review it before generating.'
      USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.jobs (
    society_id, created_by, type, status, progress, summary, finished_at
  ) VALUES (
    p_society_id, auth.uid(), 'bill_generation', 'running', 0,
    jsonb_build_object(    'period_start', p_period_start), NULL
  ) RETURNING id INTO job_id;
  IF EXISTS (
    SELECT line.unit_id
    FROM private.billing_calculate_lines(
    p_society_id, p_period_start, p_unit_ids, p_charge_type_ids,
    p_custom_amounts
    ) line
    WHERE NOT EXISTS (
      SELECT 1 FROM public.billing_bill_lines existing
      WHERE existing.society_id = p_society_id
        AND existing.unit_id = line.unit_id
        AND existing.period_start = p_period_start
        AND existing.charge_type_id = line.charge_type_id
    )
    GROUP BY line.unit_id
    HAVING sum(line.amount_paise) > 9007199254740991
  ) THEN
    RAISE EXCEPTION 'The bill total is outside the supported paise range.'
      USING ERRCODE = '22023';
  END IF;
  WITH candidates AS MATERIALIZED (
    SELECT line.*
    FROM private.billing_calculate_lines(
      p_society_id, p_period_start, p_unit_ids, p_charge_type_ids,
      p_custom_amounts
    ) line
  ),
  new_lines AS MATERIALIZED (
    SELECT line.*
    FROM candidates line
    WHERE NOT EXISTS (
      SELECT 1 FROM public.billing_bill_lines existing
      WHERE existing.society_id = p_society_id
        AND existing.unit_id = line.unit_id
        AND existing.period_start = p_period_start
        AND existing.charge_type_id = line.charge_type_id
    )
  ),
  totals AS (
    SELECT line.unit_id, sum(line.amount_paise) AS total_paise
    FROM new_lines line
    GROUP BY line.unit_id
  ),
  new_bills AS (
    INSERT INTO public.billing_bills (
      society_id, unit_id, kind, title, period_start, due_date,
      total_paise, created_by
    )
    SELECT
      p_society_id, totals.unit_id, 'regular',
      'Society charges - ' || to_char(p_period_start, 'Mon YYYY'),
      p_period_start, (preview->>'due_date')::date,
      totals.total_paise::bigint, auth.uid()
    FROM totals
    RETURNING id, unit_id
  ),
  new_bill_lines AS (
    INSERT INTO public.billing_bill_lines (
      society_id, bill_id, unit_id, period_start, charge_type_id,
      description, amount_paise, created_by
    )
    SELECT
      p_society_id, bill.id, line.unit_id, p_period_start,
      line.charge_type_id, line.charge_name, line.amount_paise, auth.uid()
    FROM new_bills bill
    JOIN new_lines line ON line.unit_id = bill.unit_id
    RETURNING bill_id, unit_id, amount_paise
  ),
  new_ledger_entries AS (
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
    )
    SELECT
      p_society_id, bill.unit_id, 'bill', 'debit',
      totals.total_paise::bigint, bill.id, auth.uid()
    FROM new_bills bill
    JOIN totals ON totals.unit_id = bill.unit_id
    RETURNING id
  )
  SELECT
    (SELECT count(*)::integer FROM new_bills),
    (SELECT count(*)::integer FROM new_bill_lines),
    coalesce((SELECT sum(amount_paise) FROM new_bill_lines), 0),
    coalesce((SELECT array_agg(id) FROM new_bills), ARRAY[]::uuid[]),
    (SELECT count(*)::integer FROM new_ledger_entries)
  INTO generated_count, generated_line_count, new_total, bill_ids, ledger_count;
  IF ledger_count <> generated_count THEN
    RAISE EXCEPTION 'Billing ledger entries could not be created.'
      USING ERRCODE = '23514';
  END IF;
  FOR recipient IN
    SELECT DISTINCT bill.id AS bill_id, membership.user_id
    FROM public.billing_bills bill
    JOIN public.unit_occupants occupant
      ON occupant.society_id = bill.society_id
      AND occupant.unit_id = bill.unit_id AND occupant.status = 'active'
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
      AND membership.status = 'active' AND membership.user_id IS NOT NULL
    WHERE bill.society_id = p_society_id AND bill.id = ANY(bill_ids)
    ORDER BY bill.id, membership.user_id
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, 'billing_bill_generated',
      'A new society bill is available',
      'A bill for ' || to_char(p_period_start, 'Mon YYYY') || ' is available in Billing.',
      'billing_bill', recipient.bill_id, request_id
    );
  END LOOP;
  UPDATE public.jobs
    SET status = 'succeeded', progress = 100,
        summary = jsonb_build_object(
          'period_start', p_period_start,
          'generated_bill_count', generated_count,
          'generated_line_count', generated_line_count,
          'already_generated_count',
            (preview->>'line_count')::integer - generated_line_count,
          'total_paise', new_total::text
        ),
        finished_at = now()
    WHERE id = job_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.bills.generate',
    'billing_job', job_id::text, NULL,
    jsonb_build_object(
      'period_start', p_period_start,
      'generated_bill_count', generated_count,
      'generated_line_count', generated_line_count,
      'total_paise', new_total::text
    ), request_id
  );
  RETURN jsonb_build_object(
    'job_id', job_id,
    'period_start', p_period_start,
    'due_date', preview->'due_date',
    'generated_bill_count', generated_count,
    'generated_line_count', generated_line_count,
    'already_generated_count',
      (preview->>'line_count')::integer - generated_line_count,
    'total_paise', new_total::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bills_list(
  p_society_id uuid, p_limit integer, p_offset integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin', 'committee', 'resident']::text[])
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) INTO result
  FROM (
    SELECT bill.id, bill.unit_id, unit.number AS unit_number, bill.kind,
      bill.title, bill.period_start,
      bill.due_date, bill.total_paise, bill.paid_paise, bill.waived_paise,
      bill.status, bill.cancelled_at,
      bill.total_paise - bill.paid_paise - bill.waived_paise AS outstanding_paise,
      EXISTS (
        SELECT 1 FROM public.billing_bill_lines line
        WHERE line.society_id = bill.society_id AND line.bill_id = bill.id
      ) AS has_lines
    FROM public.billing_bills bill
    JOIN public.units unit
      ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
    WHERE bill.society_id = p_society_id
      AND (
        private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
        OR (
          private.has_role(p_society_id, ARRAY['resident']::text[])
          AND private.occupies_unit(bill.unit_id)
        )
      )
    ORDER BY bill.due_date DESC, bill.id DESC
    LIMIT p_limit OFFSET p_offset
  ) item;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bill_get(
  p_society_id uuid, p_bill_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(bill) || jsonb_build_object(
    'outstanding_paise', bill.total_paise - bill.paid_paise - bill.waived_paise,
    'unit_number', unit.number,
    'unit_label', society.unit_label,
    'society_name', society.name,
    'society_address', concat_ws(', ', society.address, society.city),
    'lines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', line.id, 'charge_type_id', line.charge_type_id,
        'description', line.description, 'amount_paise', line.amount_paise
      ) ORDER BY line.id)
      FROM public.billing_bill_lines line
      WHERE line.society_id = bill.society_id AND line.bill_id = bill.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.billing_bills bill
  JOIN public.units unit
    ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
  JOIN public.societies society ON society.id = bill.society_id
  WHERE bill.society_id = p_society_id AND bill.id = p_bill_id
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR (
        private.has_role(p_society_id, ARRAY['resident']::text[])
        AND private.occupies_unit(bill.unit_id)
      )
    );
  IF result IS NULL THEN
    RAISE EXCEPTION 'Bill not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_ledger_get(
  p_society_id uuid, p_unit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR (
        private.has_role(p_society_id, ARRAY['resident']::text[])
        AND private.occupies_unit(p_unit_id)
      )
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(entry) ORDER BY entry.id), '[]'::jsonb)
    INTO result
  FROM (
    SELECT ledger.id::text AS id, ledger.unit_id, ledger.kind, ledger.direction,
      ledger.amount_paise, ledger.bill_id, ledger.payment_id, ledger.reason,
      ledger.created_at,
      (sum(CASE WHEN ledger.direction = 'debit'
        THEN ledger.amount_paise ELSE -ledger.amount_paise END)
        OVER (ORDER BY ledger.id ROWS UNBOUNDED PRECEDING))::text AS balance_paise
    FROM public.billing_ledger_entries ledger
    WHERE ledger.society_id = p_society_id AND ledger.unit_id = p_unit_id
  ) entry;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION private.billing_due_date(uuid, date),
  private.billing_checked_amount(numeric),
  private.billing_calculate_lines(uuid, date, uuid[], uuid[], jsonb),
  private.reject_billing_history_mutation(),
  private.billing_bill_immutable()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_settings_update(uuid, text, text, timestamptz, text),
  public.billing_bills_preview(uuid, date, uuid[], uuid[], jsonb),
  public.billing_bills_generate(uuid, date, uuid[], uuid[], jsonb, text, text),
  public.billing_bills_list(uuid, integer, integer),
  public.billing_bill_get(uuid, uuid),
  public.billing_ledger_get(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_settings_update(uuid, text, text, timestamptz, text),
  public.billing_bills_preview(uuid, date, uuid[], uuid[], jsonb),
  public.billing_bills_generate(uuid, date, uuid[], uuid[], jsonb, text, text),
  public.billing_bills_list(uuid, integer, integer),
  public.billing_bill_get(uuid, uuid),
  public.billing_ledger_get(uuid, uuid)
  TO authenticated;
