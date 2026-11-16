-- Metering RPCs: meters, rates, readings and review, utility billing, read models and photo cleanup.
CREATE FUNCTION public.metering_meter_save(
  p_society_id uuid, p_meter_id uuid, p_meter_type text, p_scope text, p_unit_id uuid, p_label text,
  p_serial_number text, p_initial_reading numeric, p_active boolean, p_expected_version integer,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  meter public.metering_meters;
  clean_label text := btrim(COALESCE(p_label, ''));
  clean_serial text := NULLIF(btrim(COALESCE(p_serial_number, '')), '');
BEGIN
  PERFORM private.metering_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF char_length(clean_label) NOT BETWEEN 1 AND 60
    OR (clean_serial IS NOT NULL AND char_length(clean_serial) > 60)
    OR p_initial_reading IS NULL OR p_initial_reading < 0 OR p_initial_reading > 99999999999.999
    OR p_initial_reading <> round(p_initial_reading, 3) OR p_active IS NULL
  THEN
    RAISE EXCEPTION 'Enter a meter label and serial up to 60 characters and an initial reading of 0 or more.'
      USING ERRCODE = '22023';
  END IF;
  IF p_meter_id IS NULL THEN
    IF p_client_request_id IS NULL OR p_meter_type IS NULL
      OR p_meter_type NOT IN ('water', 'electricity', 'dg', 'gas')
      OR p_scope IS NULL OR p_scope NOT IN ('unit', 'common')
      OR (p_scope = 'unit') <> (p_unit_id IS NOT NULL)
    THEN
      RAISE EXCEPTION 'Choose a meter type, and a unit for a unit meter.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO meter FROM public.metering_meters
      WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN meter.id; END IF;
    IF p_unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units WHERE society_id = p_society_id AND id = p_unit_id AND active
    ) THEN
      RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.metering_meters WHERE society_id = p_society_id AND lower(label) = lower(clean_label)
    ) THEN
      RAISE EXCEPTION 'Another meter already uses that label.' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.metering_meters (
      society_id, meter_type, scope, unit_id, label, serial_number, initial_reading, active,
      client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, p_meter_type, p_scope, p_unit_id, clean_label, clean_serial, p_initial_reading, p_active,
      p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO meter;
    PERFORM private.metering_audit(p_society_id, 'admin', 'meter.create', 'metering_meter', meter.id,
      jsonb_build_object('meter_type', meter.meter_type, 'scope', meter.scope, 'unit_id', meter.unit_id,
        'label', meter.label, 'serial_number', meter.serial_number,
        'initial_reading', meter.initial_reading, 'active', meter.active), p_request_id);
    RETURN meter.id;
  END IF;
  SELECT * INTO meter FROM public.metering_meters
    WHERE society_id = p_society_id AND id = p_meter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR meter.version <> p_expected_version THEN
    RAISE EXCEPTION 'This meter changed. Refresh and try again.' USING ERRCODE = '23505';
  END IF;
  IF p_meter_type IS DISTINCT FROM meter.meter_type OR p_scope IS DISTINCT FROM meter.scope
    OR p_unit_id IS DISTINCT FROM meter.unit_id
  THEN
    RAISE EXCEPTION 'A meter type, scope and unit cannot change. Add a new meter instead.' USING ERRCODE = '22023';
  END IF;
  IF p_initial_reading <> meter.initial_reading AND EXISTS (
    SELECT 1 FROM public.metering_readings WHERE society_id = p_society_id AND meter_id = meter.id
  ) THEN
    RAISE EXCEPTION 'The initial reading cannot change after readings exist.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.metering_meters
    WHERE society_id = p_society_id AND lower(label) = lower(clean_label) AND id <> meter.id
  ) THEN
    RAISE EXCEPTION 'Another meter already uses that label.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.metering_meters
  SET label = clean_label, serial_number = clean_serial, initial_reading = p_initial_reading,
    active = p_active, version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = meter.id RETURNING * INTO meter;
  PERFORM private.metering_audit(p_society_id, 'admin', 'meter.update', 'metering_meter', meter.id,
    jsonb_build_object('label', meter.label, 'serial_number', meter.serial_number,
      'initial_reading', meter.initial_reading, 'active', meter.active, 'version', meter.version), p_request_id);
  RETURN meter.id;
END;
$$;

CREATE FUNCTION public.metering_rate_set(
  p_society_id uuid, p_meter_type text, p_rate_paise integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rate public.metering_rates;
BEGIN
  PERFORM private.metering_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_client_request_id IS NULL OR p_meter_type IS NULL
    OR p_meter_type NOT IN ('water', 'electricity', 'dg', 'gas')
    OR p_rate_paise IS NULL OR p_rate_paise NOT BETWEEN 0 AND 10000000
  THEN
    RAISE EXCEPTION 'Choose a meter type and a rate from Rs 0 to Rs 1,00,000 per unit.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO rate FROM public.metering_rates
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN rate.id; END IF;
  INSERT INTO public.metering_rates (society_id, meter_type, rate_paise, client_request_id, created_by)
  VALUES (p_society_id, p_meter_type, p_rate_paise, p_client_request_id, auth.uid())
  RETURNING * INTO rate;
  PERFORM private.metering_audit(p_society_id, 'admin', 'rate.set', 'metering_rate', rate.id,
    jsonb_build_object('meter_type', rate.meter_type, 'rate_paise', rate.rate_paise), p_request_id);
  RETURN rate.id;
END;
$$;

-- Shared by staff recording (approved at once) and resident submission (pending review).
-- The caller has already authorised the actor for p_source.
CREATE FUNCTION private.metering_reading_insert(
  p_society_id uuid, p_meter_id uuid, p_value numeric, p_reading_date date, p_lower_reason text,
  p_photo_path text, p_client_request_id uuid, p_source text, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  meter public.metering_meters;
  head public.metering_readings;
  reading public.metering_readings;
  today date := private.metering_today(p_society_id);
  clean_reason text := NULLIF(btrim(COALESCE(p_lower_reason, '')), '');
  photo_type text;
  photo_size integer;
  base_value numeric(14, 3);
  recipient uuid;
BEGIN
  IF p_client_request_id IS NULL OR p_value IS NULL OR p_value < 0 OR p_value > 99999999999.999
    OR p_value <> round(p_value, 3) OR p_reading_date IS NULL
    OR (clean_reason IS NOT NULL AND char_length(clean_reason) NOT BETWEEN 3 AND 300)
  THEN
    RAISE EXCEPTION 'Enter a reading of 0 or more with up to 3 decimals and a reason of 3 to 300 characters.'
      USING ERRCODE = '22023';
  END IF;
  IF p_reading_date > today THEN
    RAISE EXCEPTION 'A reading date cannot be in the future.' USING ERRCODE = '22023';
  END IF;
  IF p_reading_date < today - 366 THEN
    RAISE EXCEPTION 'Enter a reading taken within the last year.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO reading FROM public.metering_readings
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF reading.meter_id <> p_meter_id OR reading.reading_value <> p_value
      OR reading.reading_date <> p_reading_date
    THEN
      RAISE EXCEPTION 'The retried reading changed. Refresh and try again.' USING ERRCODE = '23505';
    END IF;
    RETURN reading.id;
  END IF;
  SELECT * INTO meter FROM public.metering_meters
    WHERE society_id = p_society_id AND id = p_meter_id FOR UPDATE;
  IF NOT FOUND OR NOT meter.active OR (p_source = 'resident' AND (
    meter.scope <> 'unit' OR NOT private.metering_is_unit_resident(p_society_id, meter.unit_id)
  )) THEN
    RAISE EXCEPTION 'Meter not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO head FROM private.metering_head(p_society_id, meter.id);
  base_value := COALESCE(head.reading_value, meter.initial_reading);
  IF head.id IS NOT NULL AND p_reading_date <= head.reading_date THEN
    RAISE EXCEPTION 'This meter already has a reading on % or later. Use a later date.', head.reading_date
      USING ERRCODE = '23514';
  END IF;
  IF p_value < base_value AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'This reading is lower than the last one (%). Say why, for example the meter was replaced.',
      trim_scale(base_value) USING ERRCODE = '22023';
  END IF;
  IF p_source = 'resident' THEN
    IF EXISTS (
      SELECT 1 FROM public.metering_readings
      WHERE society_id = p_society_id AND meter_id = meter.id AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'A reading for this meter is already waiting for review.' USING ERRCODE = '23505';
    END IF;
    IF p_photo_path IS NULL THEN
      RAISE EXCEPTION 'Add a photo of the meter.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_photo_path IS NOT NULL THEN
    SELECT check_result.content_type, check_result.size_bytes INTO photo_type, photo_size
      FROM private.metering_photo_check(p_society_id, p_photo_path) AS check_result;
  END IF;
  IF p_source = 'resident' THEN
    INSERT INTO public.metering_readings (
      society_id, meter_id, unit_id, reading_value, reading_date, source, status, lower_reason,
      photo_path, photo_content_type, photo_size_bytes, client_request_id, created_by
    ) VALUES (
      p_society_id, meter.id, meter.unit_id, p_value, p_reading_date, p_source, 'pending', clean_reason,
      p_photo_path, photo_type, photo_size, p_client_request_id, auth.uid()
    ) RETURNING * INTO reading;
  ELSE
    INSERT INTO public.metering_readings (
      society_id, meter_id, unit_id, reading_value, reading_date, source, status, lower_reason,
      photo_path, photo_content_type, photo_size_bytes, previous_reading_id, previous_value, consumption,
      is_reset, reviewed_at, reviewed_by, client_request_id, created_by
    ) VALUES (
      p_society_id, meter.id, meter.unit_id, p_value, p_reading_date, p_source, 'approved', clean_reason,
      p_photo_path, photo_type, photo_size, head.id, base_value, GREATEST(p_value - base_value, 0),
      p_value < base_value, clock_timestamp(), auth.uid(), p_client_request_id, auth.uid()
    ) RETURNING * INTO reading;
    PERFORM private.metering_charge_create(reading);
  END IF;
  PERFORM private.metering_audit(p_society_id, p_source,
    CASE WHEN p_source = 'resident' THEN 'reading.submit' ELSE 'reading.record' END,
    'metering_reading', reading.id,
    jsonb_build_object('meter_id', reading.meter_id, 'unit_id', reading.unit_id,
      'reading_value', reading.reading_value, 'reading_date', reading.reading_date,
      'status', reading.status, 'consumption', reading.consumption, 'is_reset', reading.is_reset,
      'lower_reason', reading.lower_reason, 'has_photo', reading.photo_path IS NOT NULL), p_request_id);
  IF p_source = 'resident' THEN
    FOR recipient IN SELECT DISTINCT membership.user_id FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.user_id IS NOT NULL AND 'admin' = ANY(membership.roles)
        AND membership.user_id IS DISTINCT FROM auth.uid()
      ORDER BY membership.user_id LIMIT 50
    LOOP
      PERFORM private.create_notification(p_society_id, recipient, 'metering_reading_submitted',
        'Meter reading to review', left('A reading for meter ' || meter.label || ' is waiting for approval.', 300),
        'metering_admin', reading.id, p_request_id);
    END LOOP;
  END IF;
  RETURN reading.id;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_reading_insert(uuid, uuid, numeric, date, text, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.metering_reading_record(
  p_society_id uuid, p_meter_id uuid, p_reading_value numeric, p_reading_date date, p_lower_reason text,
  p_photo_path text, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.metering_write_begin(p_society_id, ARRAY['admin', 'guard']::text[]);
  RETURN private.metering_reading_insert(p_society_id, p_meter_id, p_reading_value, p_reading_date,
    p_lower_reason, p_photo_path, p_client_request_id,
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin' ELSE 'guard' END,
    p_request_id);
END;
$$;

CREATE FUNCTION public.metering_reading_submit(
  p_society_id uuid, p_meter_id uuid, p_reading_value numeric, p_reading_date date, p_lower_reason text,
  p_photo_path text, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.metering_write_begin(p_society_id, ARRAY['resident']::text[]);
  RETURN private.metering_reading_insert(p_society_id, p_meter_id, p_reading_value, p_reading_date,
    p_lower_reason, p_photo_path, p_client_request_id, 'resident', p_request_id);
END;
$$;

CREATE FUNCTION public.metering_reading_review(
  p_society_id uuid, p_reading_id uuid, p_decision text, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reading public.metering_readings;
  meter public.metering_meters;
  head public.metering_readings;
  base_value numeric(14, 3);
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  approved_reason text;
BEGIN
  PERFORM private.metering_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject')
    OR (clean_reason IS NOT NULL AND char_length(clean_reason) NOT BETWEEN 3 AND 300)
    OR (p_decision = 'reject' AND clean_reason IS NULL)
  THEN
    RAISE EXCEPTION 'Choose approve or reject, and give a reason of 3 to 300 characters to reject.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO reading FROM public.metering_readings WHERE society_id = p_society_id AND id = p_reading_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reading not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO meter FROM public.metering_meters
    WHERE society_id = p_society_id AND id = reading.meter_id FOR UPDATE;
  SELECT * INTO reading FROM public.metering_readings WHERE id = reading.id FOR UPDATE;
  IF reading.status <> 'pending' THEN
    IF (p_decision = 'approve' AND reading.status = 'approved')
      OR (p_decision = 'reject' AND reading.status = 'rejected')
    THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'This reading was already reviewed.' USING ERRCODE = '23505';
  END IF;
  IF p_decision = 'reject' THEN
    UPDATE public.metering_readings
    SET status = 'rejected', rejection_reason = clean_reason, reviewed_at = clock_timestamp(),
      reviewed_by = auth.uid()
    WHERE id = reading.id RETURNING * INTO reading;
  ELSE
    IF NOT meter.active THEN
      RAISE EXCEPTION 'Reactivate the meter before approving its readings.' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO head FROM private.metering_head(p_society_id, meter.id);
    base_value := COALESCE(head.reading_value, meter.initial_reading);
    IF head.id IS NOT NULL AND reading.reading_date <= head.reading_date THEN
      RAISE EXCEPTION 'A reading on the same day or later was approved after this one. Reject it instead.' USING ERRCODE = '23514';
    END IF;
    approved_reason := COALESCE(reading.lower_reason, clean_reason);
    IF reading.reading_value < base_value AND approved_reason IS NULL THEN
      RAISE EXCEPTION 'This reading is lower than the last one (%). Give the reason to approve it.',
        trim_scale(base_value) USING ERRCODE = '22023';
    END IF;
    UPDATE public.metering_readings
    SET status = 'approved', lower_reason = CASE WHEN reading.reading_value < base_value
        THEN approved_reason ELSE reading.lower_reason END,
      previous_reading_id = head.id, previous_value = base_value,
      consumption = GREATEST(reading.reading_value - base_value, 0),
      is_reset = reading.reading_value < base_value,
      reviewed_at = clock_timestamp(), reviewed_by = auth.uid()
    WHERE id = reading.id RETURNING * INTO reading;
    PERFORM private.metering_charge_create(reading);
  END IF;
  PERFORM private.metering_audit(p_society_id, 'admin', 'reading.' || p_decision, 'metering_reading', reading.id,
    jsonb_build_object('meter_id', reading.meter_id, 'status', reading.status,
      'consumption', reading.consumption, 'is_reset', reading.is_reset,
      'rejection_reason', reading.rejection_reason), p_request_id);
  IF reading.created_by IS DISTINCT FROM auth.uid() AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = reading.created_by AND status = 'active'
  ) THEN
    PERFORM private.create_notification(p_society_id, reading.created_by, 'metering_reading_reviewed',
      CASE WHEN reading.status = 'approved' THEN 'Meter reading approved' ELSE 'Meter reading rejected' END,
      left(CASE WHEN reading.status = 'approved'
        THEN 'Your reading for meter ' || meter.label || ' was approved.'
        ELSE 'Your reading for meter ' || meter.label || ' was rejected: ' || reading.rejection_reason END, 300),
      'metering', reading.id, p_request_id);
  END IF;
END;
$$;

-- Bills every pending unit-meter charge with a reading on or before p_bill_date, once. Per unit it adds
-- one regular "Utility charges" bill (period p_period_start, default the month of p_bill_date) with a
-- line per reading, a ledger debit and a notification. amount_paise = consumption x current rate,
-- rounded half up to whole paise (the exact charge); billed_paise applies billing's rounding setting the
-- way billing does (rounding = 'rupee': round(amount / 100) * 100, else the exact paise). Charges whose
-- type has no rate stay pending; charges whose billed amount is 0 are closed as no_charge. Each unit row
-- is locked (FOR UPDATE, in unit id order, like billing generation) before its pending charges are read
-- and locked, so repeated, concurrent and generation-plus-manual runs bill each charge once without
-- deadlocking. p_unit_ids limits the run to those units (bill generation passes its own units).
CREATE FUNCTION private.metering_billing_post(
  p_society_id uuid,
  p_bill_date date,
  p_request_id text,
  p_period_start date DEFAULT NULL,
  p_unit_ids uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  period date;
  due date;
  rounding text;
  target record;
  charge record;
  rate public.metering_rates;
  amount numeric;
  line_amount numeric;
  total numeric;
  bill public.billing_bills;
  ids uuid[];
  rate_ids uuid[];
  rate_values integer[];
  exact_amounts bigint[];
  amounts bigint[];
  descriptions text[];
  unit_name text;
  idx integer;
  units_seen integer := 0;
  bills_created integer := 0;
  charges_billed integer := 0;
  charges_zero integer := 0;
  charges_unpriced integer := 0;
  billed_paise numeric := 0;
  has_more boolean := false;
BEGIN
  IF auth.uid() IS NULL OR p_bill_date IS NULL THEN
    RAISE EXCEPTION 'Utility billing needs an administrator and a bill date.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'billing') THEN
    RETURN jsonb_build_object('billing_enabled', false, 'bills_created', 0, 'charges_billed', 0,
      'charges_no_charge', 0, 'charges_without_rate', 0, 'billed_paise', 0, 'has_more', false);
  END IF;
  period := COALESCE(p_period_start, date_trunc('month', p_bill_date)::date);
  IF period <> date_trunc('month', period)::date THEN
    RAISE EXCEPTION 'The billing period must start on the first of a month.' USING ERRCODE = '22023';
  END IF;
  -- Cheap exit so bill generation is not slowed when there is nothing to bill.
  IF NOT EXISTS (
    SELECT 1 FROM public.metering_charges AS item
    WHERE item.society_id = p_society_id AND item.status = 'pending' AND item.reading_date <= p_bill_date
      AND (p_unit_ids IS NULL OR item.unit_id = ANY(p_unit_ids))
  ) THEN
    RETURN jsonb_build_object('billing_enabled', true, 'bills_created', 0, 'charges_billed', 0,
      'charges_no_charge', 0, 'charges_without_rate', 0, 'billed_paise', 0, 'has_more', false);
  END IF;
  SELECT COALESCE(config.settings ->> 'rounding', 'rupee') INTO rounding
    FROM public.module_configs AS config
    WHERE config.society_id = p_society_id AND config.module_key = 'billing';
  rounding := COALESCE(rounding, 'rupee');
  IF rounding NOT IN ('rupee', 'paise') THEN
    RAISE EXCEPTION 'Billing rounding settings are invalid.' USING ERRCODE = '22023';
  END IF;
  due := GREATEST(private.billing_due_date(p_society_id, period), private.metering_today(p_society_id));
  FOR target IN
    SELECT unit.id, unit.number FROM public.units AS unit
    WHERE unit.society_id = p_society_id AND unit.active
      AND (p_unit_ids IS NULL OR unit.id = ANY(p_unit_ids))
      AND EXISTS (
        SELECT 1 FROM public.metering_charges AS item
        WHERE item.society_id = p_society_id AND item.unit_id = unit.id AND item.status = 'pending'
          AND item.reading_date <= p_bill_date
      )
    ORDER BY unit.id
  LOOP
    units_seen := units_seen + 1;
    IF units_seen > 1000 THEN has_more := true; EXIT; END IF;
    PERFORM 1 FROM public.units WHERE society_id = p_society_id AND id = target.id FOR UPDATE;
    ids := ARRAY[]::uuid[]; rate_ids := ARRAY[]::uuid[]; rate_values := ARRAY[]::integer[];
    exact_amounts := ARRAY[]::bigint[]; amounts := ARRAY[]::bigint[]; descriptions := ARRAY[]::text[];
    total := 0;
    FOR charge IN
      SELECT item.id, item.meter_type, item.consumption, item.reading_date, meter.label
      FROM public.metering_charges AS item
      JOIN public.metering_meters AS meter ON meter.society_id = item.society_id AND meter.id = item.meter_id
      WHERE item.society_id = p_society_id AND item.unit_id = target.id AND item.status = 'pending'
        AND item.reading_date <= p_bill_date
      ORDER BY item.reading_date, item.created_at, item.id
      FOR UPDATE OF item
    LOOP
      SELECT * INTO rate FROM public.metering_rates
        WHERE society_id = p_society_id AND meter_type = charge.meter_type
        ORDER BY created_at DESC, id DESC LIMIT 1;
      IF NOT FOUND THEN
        charges_unpriced := charges_unpriced + 1;
        CONTINUE;
      END IF;
      amount := round(charge.consumption * rate.rate_paise, 0);
      line_amount := CASE WHEN rounding = 'rupee' THEN round(amount / 100) * 100 ELSE amount END;
      IF amount > 9007199254740991 OR line_amount > 9007199254740991 THEN
        RAISE EXCEPTION 'A utility charge is outside the supported paise range.' USING ERRCODE = '22023';
      END IF;
      IF line_amount = 0 THEN
        UPDATE public.metering_charges
        SET status = 'no_charge', rate_id = rate.id, rate_paise = rate.rate_paise, amount_paise = amount::bigint,
          billed_paise = 0, billed_at = clock_timestamp(), billed_by = auth.uid()
        WHERE id = charge.id;
        charges_zero := charges_zero + 1;
        CONTINUE;
      END IF;
      unit_name := CASE charge.meter_type WHEN 'water' THEN 'kL' WHEN 'gas' THEN 'SCM' ELSE 'kWh' END;
      ids := ids || charge.id;
      rate_ids := rate_ids || rate.id;
      rate_values := rate_values || rate.rate_paise;
      exact_amounts := exact_amounts || amount::bigint;
      amounts := amounts || line_amount::bigint;
      descriptions := descriptions || left(format('%s meter %s: %s %s at Rs %s/%s to %s',
        CASE charge.meter_type WHEN 'water' THEN 'Water' WHEN 'electricity' THEN 'Electricity'
          WHEN 'dg' THEN 'DG' ELSE 'Gas' END,
        charge.label, trim_scale(charge.consumption), unit_name,
        to_char(rate.rate_paise / 100.0, 'FM99999990.00'), unit_name,
        to_char(charge.reading_date, 'DD Mon YYYY')), 160);
      total := total + line_amount;
    END LOOP;
    IF cardinality(ids) = 0 THEN CONTINUE; END IF;
    IF total > 9007199254740991 THEN
      RAISE EXCEPTION 'The utility bill total is outside the supported paise range.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.billing_bills (
      society_id, unit_id, kind, title, period_start, due_date, total_paise, created_by
    ) VALUES (
      p_society_id, target.id, 'regular', 'Utility charges - ' || to_char(period, 'Mon YYYY'),
      period, due, total::bigint, auth.uid()
    ) RETURNING * INTO bill;
    FOR idx IN 1 .. cardinality(ids) LOOP
      INSERT INTO public.billing_bill_lines (
        society_id, bill_id, unit_id, period_start, charge_type_id, description, amount_paise, created_by
      ) VALUES (
        p_society_id, bill.id, target.id, period, NULL, descriptions[idx], amounts[idx], auth.uid()
      );
      UPDATE public.metering_charges
      SET status = 'billed', rate_id = rate_ids[idx], rate_paise = rate_values[idx],
        amount_paise = exact_amounts[idx], billed_paise = amounts[idx], bill_id = bill.id,
        billed_at = clock_timestamp(), billed_by = auth.uid()
      WHERE id = ids[idx];
    END LOOP;
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
    ) VALUES (p_society_id, target.id, 'bill', 'debit', total::bigint, bill.id, auth.uid());
    PERFORM private.billing_notify_unit(p_society_id, target.id, 'billing_bill_generated',
      'Utility bill ready', 'Utility charges for ' || to_char(period, 'Mon YYYY') || ' were added. View Billing for details.',
      'billing_bill', bill.id, p_request_id);
    bills_created := bills_created + 1;
    charges_billed := charges_billed + cardinality(ids);
    billed_paise := billed_paise + total;
  END LOOP;
  RETURN jsonb_build_object('billing_enabled', true, 'bills_created', bills_created,
    'charges_billed', charges_billed, 'charges_no_charge', charges_zero,
    'charges_without_rate', charges_unpriced, 'billed_paise', billed_paise, 'has_more', has_more);
END;
$$;
REVOKE ALL ON FUNCTION private.metering_billing_post(uuid, date, text, date, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.metering_billing_run(p_society_id uuid, p_bill_date date, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
  today date;
BEGIN
  PERFORM private.metering_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF NOT private.module_enabled(p_society_id, 'billing') THEN
    RAISE EXCEPTION 'Turn on Billing to bill utility charges.' USING ERRCODE = '23514';
  END IF;
  today := private.metering_today(p_society_id);
  IF p_bill_date IS NULL OR p_bill_date > today OR p_bill_date < today - 366 THEN
    RAISE EXCEPTION 'Choose a bill date within the last year, not in the future.' USING ERRCODE = '22023';
  END IF;
  result := private.metering_billing_post(p_society_id, p_bill_date, p_request_id);
  PERFORM private.metering_audit(p_society_id, 'admin', 'billing.run', 'module', NULL,
    result || jsonb_build_object('bill_date', p_bill_date), p_request_id);
  RETURN result;
END;
$$;

CREATE FUNCTION public.metering_photo_upload_path(
  p_society_id uuid, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  path text;
BEGIN
  PERFORM private.metering_authorize(p_society_id, ARRAY['admin', 'guard', 'resident']::text[], true);
  IF p_content_type IS NULL OR p_content_type NOT IN ('image/jpeg', 'image/png')
    OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Use a JPG or PNG photo up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  path := p_society_id::text || '/readings/' || auth.uid()::text || '/' || gen_random_uuid()::text
    || CASE p_content_type WHEN 'image/jpeg' THEN '.jpg' ELSE '.png' END;
  IF NOT COALESCE(private.metering_file_access(path, true), false) THEN
    RAISE EXCEPTION 'Meter photo upload is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN path;
END;
$$;

CREATE FUNCTION public.metering_photo_access(p_society_id uuid, p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.metering_authorize(p_society_id, ARRAY['admin', 'committee', 'guard', 'resident']::text[], false);
  RETURN split_part(COALESCE(p_path, ''), '/', 1) = p_society_id::text
    AND COALESCE(private.metering_file_access(p_path, false), false);
END;
$$;

-- Current rate per meter type.
CREATE FUNCTION private.metering_current_rates(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('meter_type', rate.meter_type, 'rate_paise', rate.rate_paise,
    'set_at', rate.created_at) ORDER BY rate.meter_type), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (item.meter_type) item.meter_type, item.rate_paise, item.created_at
    FROM public.metering_rates AS item WHERE item.society_id = p_society_id
    ORDER BY item.meter_type, item.created_at DESC, item.id DESC
  ) AS rate
$$;
REVOKE ALL ON FUNCTION private.metering_current_rates(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Meter summary with its last approved reading and the baseline the next reading is compared with.
CREATE FUNCTION private.metering_meter_json(p_meter public.metering_meters)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  head public.metering_readings;
BEGIN
  SELECT * INTO head FROM private.metering_head(p_meter.society_id, p_meter.id);
  RETURN jsonb_build_object(
    'id', p_meter.id, 'meter_type', p_meter.meter_type, 'scope', p_meter.scope,
    'unit_id', p_meter.unit_id,
    'unit_number', (SELECT number FROM public.units WHERE society_id = p_meter.society_id AND id = p_meter.unit_id),
    'label', p_meter.label, 'serial_number', p_meter.serial_number, 'active', p_meter.active,
    'last_reading_value', head.reading_value::text, 'last_reading_date', head.reading_date,
    'base_value', COALESCE(head.reading_value, p_meter.initial_reading)::text,
    'has_pending', EXISTS (
      SELECT 1 FROM public.metering_readings
      WHERE society_id = p_meter.society_id AND meter_id = p_meter.id AND status = 'pending'
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION private.metering_meter_json(public.metering_meters)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.metering_resident_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_ids uuid[];
BEGIN
  PERFORM private.metering_authorize(p_society_id, ARRAY['resident']::text[], false);
  SELECT COALESCE(array_agg(DISTINCT unit.id), ARRAY[]::uuid[]) INTO unit_ids
  FROM public.units AS unit
  WHERE unit.society_id = p_society_id AND private.metering_is_unit_resident(p_society_id, unit.id);
  RETURN jsonb_build_object(
    'billing_enabled', private.module_enabled(p_society_id, 'billing'),
    'today', private.metering_today(p_society_id),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'number', unit.number) ORDER BY unit.number)
      FROM public.units AS unit WHERE unit.society_id = p_society_id AND unit.id = ANY(unit_ids)
    ), '[]'::jsonb),
    'rates', private.metering_current_rates(p_society_id),
    'meters', COALESCE((
      SELECT jsonb_agg(private.metering_meter_json(found.meter) ORDER BY (found.meter).label)
      FROM (
        SELECT item AS meter FROM public.metering_meters AS item
        WHERE item.society_id = p_society_id AND item.unit_id = ANY(unit_ids) AND item.active
        ORDER BY item.label LIMIT 50
      ) AS found
    ), '[]'::jsonb),
    'readings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reading.id, 'meter_id', reading.meter_id, 'meter_label', meter.label,
        'meter_type', meter.meter_type, 'reading_value', reading.reading_value::text,
        'reading_date', reading.reading_date, 'status', reading.status, 'source', reading.source,
        'consumption', reading.consumption::text, 'is_reset', reading.is_reset,
        'lower_reason', reading.lower_reason, 'rejection_reason', reading.rejection_reason,
        'photo_path', CASE WHEN reading.created_by = auth.uid() THEN reading.photo_path END,
        'is_mine', reading.created_by = auth.uid(), 'created_at', reading.created_at,
        'charge_status', charge.status, 'charge_amount_paise', charge.billed_paise,
        'bill_id', charge.bill_id
      ) ORDER BY reading.reading_date DESC, reading.created_at DESC)
      FROM (
        SELECT * FROM public.metering_readings
        WHERE society_id = p_society_id AND unit_id = ANY(unit_ids)
        ORDER BY reading_date DESC, created_at DESC LIMIT 100
      ) AS reading
      JOIN public.metering_meters AS meter ON meter.society_id = reading.society_id AND meter.id = reading.meter_id
      LEFT JOIN public.metering_charges AS charge
        ON charge.society_id = reading.society_id AND charge.reading_id = reading.id
    ), '[]'::jsonb)
  );
END;
$$;

-- Monthly approved consumption per meter for the last 9 months (6 shown, 3 more for the usage average).
CREATE FUNCTION private.metering_report(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH months AS (
    SELECT (date_trunc('month', private.metering_today(p_society_id)) - make_interval(months => step))::date AS month
    FROM generate_series(0, 8) AS step
  ),
  totals AS (
    SELECT reading.meter_id, date_trunc('month', reading.reading_date)::date AS month,
      sum(reading.consumption) AS consumption, count(*) AS readings,
      count(*) FILTER (WHERE reading.is_reset) AS resets
    FROM public.metering_readings AS reading
    WHERE reading.society_id = p_society_id AND reading.status = 'approved'
      AND reading.reading_date >= (SELECT min(month) FROM months)
    GROUP BY reading.meter_id, date_trunc('month', reading.reading_date)
  ),
  meters AS (
    SELECT meter.* FROM public.metering_meters AS meter
    WHERE meter.society_id = p_society_id AND EXISTS (SELECT 1 FROM totals WHERE totals.meter_id = meter.id)
    ORDER BY meter.label LIMIT 500
  )
  SELECT jsonb_build_object(
    'months', (SELECT jsonb_agg(month ORDER BY month) FROM months),
    'meters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'meter_id', meter.id, 'label', meter.label, 'meter_type', meter.meter_type, 'scope', meter.scope,
        'unit_number', (SELECT number FROM public.units WHERE society_id = p_society_id AND id = meter.unit_id),
        'unit_occupied', meter.unit_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = p_society_id AND occupant.unit_id = meter.unit_id
            AND occupant.status = 'active'
        ),
        'periods', (
          SELECT jsonb_agg(jsonb_build_object('month', months.month,
            'consumption', COALESCE(totals.consumption, 0)::text,
            'readings', COALESCE(totals.readings, 0), 'resets', COALESCE(totals.resets, 0))
            ORDER BY months.month)
          FROM months LEFT JOIN totals ON totals.meter_id = meter.id AND totals.month = months.month
        )
      ) ORDER BY meter.label)
      FROM meters AS meter
    ), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION private.metering_report(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.metering_admin_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.metering_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'billing_enabled', private.module_enabled(p_society_id, 'billing'),
    'today', private.metering_today(p_society_id),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'number', unit.number) ORDER BY unit.number)
      FROM (
        SELECT id, number FROM public.units WHERE society_id = p_society_id AND active
        ORDER BY number LIMIT 1000
      ) AS unit
    ), '[]'::jsonb),
    'meters', COALESCE((
      SELECT jsonb_agg(private.metering_meter_json(found.meter) || jsonb_build_object(
        'initial_reading', (found.meter).initial_reading::text, 'version', (found.meter).version,
        'has_readings', EXISTS (
          SELECT 1 FROM public.metering_readings
          WHERE society_id = p_society_id AND meter_id = (found.meter).id
        )) ORDER BY (found.meter).active DESC, (found.meter).label)
      FROM (
        SELECT item AS meter FROM public.metering_meters AS item WHERE item.society_id = p_society_id
        ORDER BY item.active DESC, item.label LIMIT 500
      ) AS found
    ), '[]'::jsonb),
    'rates', private.metering_current_rates(p_society_id),
    'rate_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', rate.id, 'meter_type', rate.meter_type,
        'rate_paise', rate.rate_paise, 'set_at', rate.created_at) ORDER BY rate.created_at DESC, rate.id DESC)
      FROM (
        SELECT * FROM public.metering_rates WHERE society_id = p_society_id
        ORDER BY created_at DESC, id DESC LIMIT 20
      ) AS rate
    ), '[]'::jsonb),
    'queue', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reading.id, 'meter_id', meter.id, 'meter_label', meter.label, 'meter_type', meter.meter_type,
        'unit_number', unit.number, 'reading_value', reading.reading_value::text,
        'reading_date', reading.reading_date,
        'base_value', (private.metering_meter_json(meter) ->> 'base_value'),
        'lower_reason', reading.lower_reason, 'photo_path', reading.photo_path,
        'submitted_by', profile.full_name, 'created_at', reading.created_at
      ) ORDER BY reading.created_at, reading.id)
      FROM (
        SELECT * FROM public.metering_readings WHERE society_id = p_society_id AND status = 'pending'
        ORDER BY created_at, id LIMIT 100
      ) AS reading
      JOIN public.metering_meters AS meter ON meter.society_id = reading.society_id AND meter.id = reading.meter_id
      LEFT JOIN public.units AS unit ON unit.society_id = reading.society_id AND unit.id = reading.unit_id
      LEFT JOIN public.profiles AS profile ON profile.id = reading.created_by
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reading.id, 'meter_id', meter.id, 'meter_label', meter.label, 'meter_type', meter.meter_type,
        'unit_number', unit.number, 'reading_value', reading.reading_value::text,
        'reading_date', reading.reading_date, 'status', reading.status, 'source', reading.source,
        'consumption', reading.consumption::text, 'is_reset', reading.is_reset,
        'lower_reason', reading.lower_reason, 'rejection_reason', reading.rejection_reason,
        'photo_path', reading.photo_path, 'created_at', reading.created_at,
        'charge_status', charge.status, 'charge_amount_paise', charge.billed_paise
      ) ORDER BY reading.reviewed_at DESC, reading.id DESC)
      FROM (
        SELECT * FROM public.metering_readings WHERE society_id = p_society_id AND status <> 'pending'
        ORDER BY reviewed_at DESC, id DESC LIMIT 30
      ) AS reading
      JOIN public.metering_meters AS meter ON meter.society_id = reading.society_id AND meter.id = reading.meter_id
      LEFT JOIN public.units AS unit ON unit.society_id = reading.society_id AND unit.id = reading.unit_id
      LEFT JOIN public.metering_charges AS charge
        ON charge.society_id = reading.society_id AND charge.reading_id = reading.id
    ), '[]'::jsonb),
    'charges', (
      SELECT jsonb_build_object(
        'pending_count', count(*) FILTER (WHERE charge.status = 'pending'),
        'pending_without_rate', count(*) FILTER (WHERE charge.status = 'pending' AND NOT EXISTS (
          SELECT 1 FROM public.metering_rates AS rate
          WHERE rate.society_id = p_society_id AND rate.meter_type = charge.meter_type
        )),
        'billed_count', count(*) FILTER (WHERE charge.status = 'billed'),
        'no_charge_count', count(*) FILTER (WHERE charge.status = 'no_charge'),
        'billed_paise', COALESCE(sum(charge.billed_paise) FILTER (WHERE charge.status = 'billed'), 0),
        'last_billed_at', max(charge.billed_at)
      )
      FROM public.metering_charges AS charge WHERE charge.society_id = p_society_id
    ),
    'report', private.metering_report(p_society_id)
  );
END;
$$;

CREATE FUNCTION public.metering_guard_board(p_society_id uuid, p_query text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_query text := lower(NULLIF(btrim(COALESCE(p_query, '')), ''));
BEGIN
  PERFORM private.metering_authorize(p_society_id, ARRAY['admin', 'guard']::text[], false);
  IF clean_query IS NOT NULL AND char_length(clean_query) > 40 THEN
    RAISE EXCEPTION 'Search with up to 40 characters.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'query', clean_query,
    'today', private.metering_today(p_society_id),
    'meters', COALESCE((
      SELECT jsonb_agg(private.metering_meter_json(found.meter)
        ORDER BY found.unit_number NULLS LAST, (found.meter).label)
      FROM (
        SELECT item AS meter, unit.number AS unit_number FROM public.metering_meters AS item
        LEFT JOIN public.units AS unit ON unit.society_id = item.society_id AND unit.id = item.unit_id
        WHERE item.society_id = p_society_id AND item.active AND (
          clean_query IS NULL OR position(clean_query IN lower(item.label)) > 0
          OR position(clean_query IN lower(COALESCE(item.serial_number, ''))) > 0
          OR position(clean_query IN lower(COALESCE(unit.number, ''))) > 0
        )
        ORDER BY unit.number NULLS LAST, item.label LIMIT 30
      ) AS found
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reading.id, 'meter_label', meter.label, 'meter_type', meter.meter_type,
        'unit_number', unit.number, 'reading_value', reading.reading_value::text,
        'reading_date', reading.reading_date, 'consumption', reading.consumption::text,
        'is_reset', reading.is_reset, 'created_at', reading.created_at
      ) ORDER BY reading.created_at DESC)
      FROM (
        SELECT * FROM public.metering_readings
        WHERE society_id = p_society_id AND created_by = auth.uid()
        ORDER BY created_at DESC LIMIT 10
      ) AS reading
      JOIN public.metering_meters AS meter ON meter.society_id = reading.society_id AND meter.id = reading.meter_id
      LEFT JOIN public.units AS unit ON unit.society_id = reading.society_id AND unit.id = reading.unit_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Attached reading photos are kept with the reading; only never-attached uploads are listed (after 24 h).
CREATE FUNCTION public.metering_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  RETURN QUERY
    SELECT 'metering-photos'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'metering-photos' AND object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.metering_readings AS reading WHERE reading.photo_path = object.name)
    ORDER BY object.name;
END;
$$;

REVOKE ALL ON FUNCTION
  public.metering_meter_save(uuid, uuid, text, text, uuid, text, text, numeric, boolean, integer, uuid, text),
  public.metering_rate_set(uuid, text, integer, uuid, text),
  public.metering_reading_record(uuid, uuid, numeric, date, text, text, uuid, text),
  public.metering_reading_submit(uuid, uuid, numeric, date, text, text, uuid, text),
  public.metering_reading_review(uuid, uuid, text, text, text),
  public.metering_billing_run(uuid, date, text),
  public.metering_photo_upload_path(uuid, text, integer),
  public.metering_photo_access(uuid, text),
  public.metering_resident_workspace(uuid),
  public.metering_admin_workspace(uuid),
  public.metering_guard_board(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.metering_meter_save(uuid, uuid, text, text, uuid, text, text, numeric, boolean, integer, uuid, text),
  public.metering_rate_set(uuid, text, integer, uuid, text),
  public.metering_reading_record(uuid, uuid, numeric, date, text, text, uuid, text),
  public.metering_reading_submit(uuid, uuid, numeric, date, text, text, uuid, text),
  public.metering_reading_review(uuid, uuid, text, text, text),
  public.metering_billing_run(uuid, date, text),
  public.metering_photo_upload_path(uuid, text, integer),
  public.metering_photo_access(uuid, text),
  public.metering_resident_workspace(uuid),
  public.metering_admin_workspace(uuid),
  public.metering_guard_board(uuid, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.metering_retention_files_list(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.metering_retention_files_list(date) TO service_role;
