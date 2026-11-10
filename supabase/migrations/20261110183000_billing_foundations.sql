CREATE TABLE public.billing_charge_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  method text NOT NULL,
  amount_paise bigint,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_charge_types_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT billing_charge_types_society_name_key UNIQUE (society_id, name),
  CONSTRAINT billing_charge_types_name_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT billing_charge_types_method_check
    CHECK (method IN ('fixed', 'per_sqft', 'custom')),
  CONSTRAINT billing_charge_types_amount_check CHECK (
    (method = 'custom' AND amount_paise IS NULL)
    OR (method IN ('fixed', 'per_sqft')
      AND amount_paise IS NOT NULL
      AND amount_paise BETWEEN 1 AND 9007199254740991)
  )
);
CREATE INDEX billing_charge_types_created_by_idx
  ON public.billing_charge_types (created_by);
CREATE INDEX billing_charge_types_updated_by_idx
  ON public.billing_charge_types (updated_by);
CREATE TRIGGER billing_charge_types_set_updated_at
  BEFORE UPDATE ON public.billing_charge_types
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.billing_payment_details (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  upi_id text NOT NULL,
  payee_name text NOT NULL,
  qr_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_payment_details_upi_check CHECK (
    char_length(upi_id) BETWEEN 5 AND 100
    AND upi_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$'
  ),
  CONSTRAINT billing_payment_details_payee_check
    CHECK (payee_name = btrim(payee_name) AND char_length(payee_name) BETWEEN 2 AND 100),
  CONSTRAINT billing_payment_details_qr_check CHECK (
    qr_path IS NULL OR qr_path ~ (
      '^' || society_id::text ||
      '/billing-qr/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    )
  )
);
CREATE INDEX billing_payment_details_updated_by_idx
  ON public.billing_payment_details (updated_by);
CREATE TRIGGER billing_payment_details_set_updated_at
  BEFORE UPDATE ON public.billing_payment_details
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.billing_receipt_counters (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  year integer NOT NULL CHECK (year BETWEEN 1 AND 9999),
  last_no integer NOT NULL DEFAULT 0 CHECK (last_no >= 0),
  PRIMARY KEY (society_id, year)
);

ALTER TABLE public.billing_charge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_receipt_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_charge_types,
  public.billing_payment_details, public.billing_receipt_counters
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.billing_charge_types, public.billing_payment_details
  TO authenticated;

CREATE POLICY billing_charge_types_read
  ON public.billing_charge_types FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
    AND private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );
CREATE POLICY billing_payment_details_read
  ON public.billing_payment_details FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND private.is_member(society_id)
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
  );
CREATE POLICY billing_receipt_counters_no_api_access
  ON public.billing_receipt_counters FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

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
    IF item.key IN (
      'due_day_of_month', 'grace_days', 'pending_confirmation_alert_days'
    ) THEN
      IF jsonb_typeof(item.value) <> 'number'
        OR item.value::text !~ '^[0-9]+$'
        OR item.value::numeric > 2147483647
        OR (item.key <> 'grace_days' AND item.value::numeric < 1)
        OR (item.key = 'due_day_of_month' AND item.value::numeric > 31)
      THEN RETURN false; END IF;
    ELSIF item.key NOT IN ('late_fee', 'reminders') THEN
      RETURN false;
    END IF;
  END LOOP;
  IF fee IS NOT NULL AND fee <> 'null'::jsonb THEN
    IF jsonb_typeof(fee) <> 'object'
      OR NOT (fee ?& ARRAY['type', 'value'])
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(fee) AS property(key) WHERE key NOT IN ('type', 'value')
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
REVOKE ALL ON FUNCTION private.billing_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.billing_settings_valid(jsonb)
  TO authenticated, service_role;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_billing_settings_check
  CHECK (module_key <> 'billing' OR private.billing_settings_valid(settings));

CREATE OR REPLACE FUNCTION public.billing_charges_list(p_society_id uuid)
RETURNS SETOF public.billing_charge_types
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.billing_charge_types
    WHERE society_id = p_society_id ORDER BY active DESC, name, id;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_charge_save(
  p_society_id uuid,
  p_id uuid,
  p_name text,
  p_method text,
  p_amount_paise bigint,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS public.billing_charge_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.billing_charge_types;
  result public.billing_charge_types;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request ID is required.' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'The charge details are invalid.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.billing_charge_types (
      society_id, name, method, amount_paise, active, created_by, updated_by
    ) VALUES (
      p_society_id, p_name, p_method, p_amount_paise, p_active, auth.uid(), auth.uid()
    ) RETURNING * INTO result;
  ELSE
    SELECT * INTO previous FROM public.billing_charge_types
      WHERE society_id = p_society_id AND id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The charge was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The charge has changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF (previous.name, previous.method, previous.amount_paise, previous.active)
      IS NOT DISTINCT FROM (p_name, p_method, p_amount_paise, p_active)
    THEN RETURN previous; END IF;
    UPDATE public.billing_charge_types
      SET name = p_name, method = p_method, amount_paise = p_amount_paise,
          active = p_active
      WHERE society_id = p_society_id AND id = p_id RETURNING * INTO result;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_id IS NULL THEN 'billing.charges.create'
      WHEN NOT p_active AND previous.active THEN 'billing.charges.deactivate'
      ELSE 'billing.charges.update' END,
    'billing_charge_type', result.id::text,
    CASE WHEN p_id IS NULL THEN NULL ELSE to_jsonb(previous) END,
    to_jsonb(result), p_request_id
  );
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_details_get(p_society_id uuid)
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
    OR NOT private.is_member(p_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(details) || jsonb_build_object('updated_by_name', profile.full_name)
    INTO result
    FROM public.billing_payment_details details
    JOIN public.profiles profile ON profile.id = details.updated_by
    WHERE details.society_id = p_society_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_details_update(
  p_society_id uuid,
  p_upi_id text,
  p_payee_name text,
  p_qr_path text,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.billing_payment_details;
  result public.billing_payment_details;
  recipient record;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request ID is required.' USING ERRCODE = '22023';
  END IF;
  -- The society lock also serializes the first save, before a details row exists.
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR UPDATE;
  SELECT * INTO previous FROM public.billing_payment_details
    WHERE society_id = p_society_id FOR UPDATE;
  IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Payment details have changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF previous.society_id IS NOT NULL
    AND (previous.upi_id, previous.payee_name, previous.qr_path)
      IS NOT DISTINCT FROM (p_upi_id, p_payee_name, p_qr_path)
  THEN RETURN public.billing_payment_details_get(p_society_id); END IF;
  IF p_qr_path IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects object
    WHERE object.bucket_id = 'society-assets' AND object.name = p_qr_path
      AND object.metadata->>'mimetype' IN ('image/jpeg', 'image/png')
      AND CASE WHEN object.metadata->>'size' ~ '^[0-9]+$'
        THEN (object.metadata->>'size')::numeric BETWEEN 1 AND 5242880
        ELSE false END
      AND (
        (object.metadata->>'mimetype' = 'image/jpeg' AND p_qr_path LIKE '%.jpg')
        OR (object.metadata->>'mimetype' = 'image/png' AND p_qr_path LIKE '%.png')
      )
  ) THEN
    RAISE EXCEPTION 'The uploaded QR image is not available.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.billing_payment_details (
    society_id, upi_id, payee_name, qr_path, updated_by
  ) VALUES (p_society_id, p_upi_id, p_payee_name, p_qr_path, auth.uid())
  ON CONFLICT (society_id) DO UPDATE SET
    upi_id = EXCLUDED.upi_id, payee_name = EXCLUDED.payee_name,
    qr_path = EXCLUDED.qr_path, updated_by = auth.uid()
  RETURNING * INTO result;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.paymentDetails.update',
    'billing_payment_details', p_society_id::text,
    CASE WHEN previous.society_id IS NULL THEN NULL ELSE to_jsonb(previous) END,
    to_jsonb(result), p_request_id
  );
  FOR recipient IN
    SELECT user_id FROM public.memberships
    WHERE society_id = p_society_id AND status = 'active'
      AND roles && ARRAY['admin', 'committee']::text[]
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, 'billing_payment_details_changed',
      'Society payment details changed',
      'An administrator changed the society payment details. Review Payment Settings before making or confirming a payment.',
      'billing_payment_details', p_society_id, p_request_id
    );
  END LOOP;
  RETURN public.billing_payment_details_get(p_society_id);
END;
$$;

REVOKE ALL ON FUNCTION public.billing_charges_list(uuid),
  public.billing_charge_save(uuid, uuid, text, text, bigint, boolean, timestamptz, text),
  public.billing_payment_details_get(uuid),
  public.billing_payment_details_update(uuid, text, text, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_charges_list(uuid),
  public.billing_charge_save(uuid, uuid, text, text, bigint, boolean, timestamptz, text),
  public.billing_payment_details_get(uuid),
  public.billing_payment_details_update(uuid, text, text, text, timestamptz, text)
  TO authenticated;

CREATE POLICY billing_qr_read
  ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id <> 'society-assets' OR split_part(name, '/', 2) <> 'billing-qr'
    OR (
      private.module_enabled(private.file_society_id(name), 'billing')
      AND private.is_member(private.file_society_id(name))
      AND EXISTS (
        SELECT 1 FROM public.societies society
        WHERE society.id = private.file_society_id(storage.objects.name) AND society.status <> 'archived'
      )
      AND (
        private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
        OR EXISTS (
          SELECT 1 FROM public.billing_payment_details details
          WHERE details.society_id = private.file_society_id(storage.objects.name)
            AND details.qr_path = storage.objects.name
        )
      )
    )
  );
CREATE POLICY billing_qr_insert
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id <> 'society-assets' OR split_part(name, '/', 2) <> 'billing-qr'
    OR (
      private.module_enabled(private.file_society_id(name), 'billing')
      AND private.society_writable(private.file_society_id(name))
      AND private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      AND name ~ (
        '^' || private.file_society_id(name)::text ||
        '/billing-qr/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
        '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
      )
    )
  );
CREATE POLICY billing_qr_no_update
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'society-assets' OR split_part(name, '/', 2) <> 'billing-qr')
  WITH CHECK (bucket_id <> 'society-assets' OR split_part(name, '/', 2) <> 'billing-qr');
CREATE POLICY billing_qr_delete_unused
  ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id <> 'society-assets' OR split_part(name, '/', 2) <> 'billing-qr'
    OR (
      private.module_enabled(private.file_society_id(name), 'billing')
      AND private.society_writable(private.file_society_id(name))
      AND private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      AND NOT EXISTS (
        SELECT 1 FROM public.billing_payment_details details
        WHERE details.society_id = private.file_society_id(storage.objects.name)
          AND details.qr_path = storage.objects.name
      )
    )
  );
