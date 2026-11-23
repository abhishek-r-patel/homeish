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
    ELSIF item.key = 'bill_email_on_publish' THEN
      IF jsonb_typeof(item.value) <> 'boolean' THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION public.billing_settings_update(
  p_society_id uuid,
  p_due_day text,
  p_rounding text,
  p_bill_email_on_publish boolean,
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
    OR p_bill_email_on_publish IS NULL
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
    'due_day_of_month', due_value,
    'rounding', p_rounding,
    'bill_email_on_publish', p_bill_email_on_publish
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
  selected boolean;
BEGIN
  SELECT coalesce((settings->>'bill_email_on_publish')::boolean, true)
    INTO selected
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'billing';
  RETURN public.billing_settings_update(
    p_society_id, p_due_day, p_rounding, selected,
    p_expected_updated_at, p_request_id
  );
END;
$$;

ALTER TABLE public.jobs
  DROP CONSTRAINT jobs_type_check,
  ADD CONSTRAINT jobs_type_check CHECK (type IN (
    'bill_generation',
    'bill_email',
    'csv_import_units',
    'csv_import_residents',
    'export'
  ));

UPDATE public.module_configs
SET settings = settings || '{"bill_email_on_publish":true}'::jsonb
WHERE module_key = 'billing'
  AND NOT (settings ? 'bill_email_on_publish');

CREATE OR REPLACE FUNCTION private.billing_bill_email_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce((
    SELECT (config.settings->>'bill_email_on_publish')::boolean
    FROM public.module_configs config
    WHERE config.society_id = NEW.society_id
      AND config.module_key = 'billing'
  ), true) THEN
    INSERT INTO public.jobs (
      society_id, created_by, type, status, progress, summary
    ) VALUES (
      NEW.society_id, NEW.created_by, 'bill_email', 'queued', 0,
      jsonb_build_object('bill_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER billing_bills_email_enqueue
  AFTER INSERT ON public.billing_bills
  FOR EACH ROW EXECUTE FUNCTION private.billing_bill_email_enqueue();

CREATE OR REPLACE FUNCTION public.billing_bill_email_payload(
  p_society_id uuid, p_bill_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'bill', to_jsonb(bill) || jsonb_build_object(
      'outstanding_paise', bill.total_paise - bill.paid_paise - bill.waived_paise,
      'unit_number', unit.number,
      'unit_label', society.unit_label,
      'society_name', society.name,
      'society_address', concat_ws(', ', society.address, society.city),
      'lines', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', line.id,
          'charge_type_id', line.charge_type_id,
          'description', line.description,
          'amount_paise', line.amount_paise
        ) ORDER BY line.id)
        FROM public.billing_bill_lines line
        WHERE line.society_id = bill.society_id AND line.bill_id = bill.id
      ), '[]'::jsonb)
    ),
    'recipients', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'email', recipient.email,
        'name', recipient.full_name
      ) ORDER BY recipient.email)
      FROM (
        SELECT DISTINCT profile.email::text AS email, profile.full_name
        FROM public.unit_occupants occupant
        JOIN public.memberships membership
          ON membership.society_id = occupant.society_id
          AND membership.id = occupant.membership_id
          AND membership.status = 'active'
          AND membership.user_id IS NOT NULL
        JOIN public.profiles profile
          ON profile.id = membership.user_id
          AND profile.status = 'active'
        WHERE occupant.society_id = bill.society_id
          AND occupant.unit_id = bill.unit_id
          AND occupant.status = 'active'
          AND profile.email IS NOT NULL
      ) recipient
    ), '[]'::jsonb)
  )
  FROM public.billing_bills bill
  JOIN public.units unit
    ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
  JOIN public.societies society ON society.id = bill.society_id
  WHERE bill.society_id = p_society_id AND bill.id = p_bill_id
$$;

CREATE OR REPLACE FUNCTION public.billing_bill_share_start(
  p_society_id uuid,
  p_bill_id uuid,
  p_channel text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bill_unit_id uuid;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'resident']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('native', 'whatsapp', 'email')
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The bill share is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT bill.unit_id INTO bill_unit_id
  FROM public.billing_bills bill
  WHERE bill.society_id = p_society_id AND bill.id = p_bill_id;
  IF bill_unit_id IS NULL THEN
    RAISE EXCEPTION 'Bill not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND NOT (
      private.has_role(p_society_id, ARRAY['resident']::text[])
      AND private.occupies_unit(bill_unit_id)
    )
  THEN
    RAISE EXCEPTION 'Bill access is required.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
      THEN 'admin' ELSE 'resident' END,
    'billing.bill.share_started', 'billing_bill', p_bill_id::text,
    NULL, jsonb_build_object('channel', p_channel), p_request_id
  );
  RETURN p_bill_id;
END;
$$;

REVOKE ALL ON FUNCTION private.billing_bill_email_enqueue()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_settings_update(
  uuid, text, text, boolean, timestamptz, text
), public.billing_bill_email_payload(uuid, uuid),
  public.billing_bill_share_start(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_settings_update(
  uuid, text, text, boolean, timestamptz, text
), public.billing_bill_share_start(uuid, uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_bill_email_payload(uuid, uuid)
  TO service_role;
