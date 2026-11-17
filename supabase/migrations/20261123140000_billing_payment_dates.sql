-- Validate payment dates against the society day, not the database session day.
ALTER TABLE public.billing_payments
  DROP CONSTRAINT billing_payments_paid_on_check,
  ADD CONSTRAINT billing_payments_paid_on_check
    CHECK (paid_on <= private.billing_society_today(society_id));

CREATE OR REPLACE FUNCTION public.billing_payment_submit(
  p_society_id uuid,
  p_unit_id uuid,
  p_amount_paise bigint,
  p_reference text,
  p_paid_on date,
  p_proof_path text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved public.billing_payments;
  recipient record;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
    OR NOT private.occupies_unit(p_unit_id)
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Resident billing access is required.'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
      AND unit.active FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected unit is not available.'
      USING ERRCODE = '22023';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_reference IS NULL OR upper(p_reference) !~ '^[A-Z0-9]{6,30}$'
    OR p_paid_on IS NULL OR p_paid_on > private.billing_society_today(p_society_id)
    OR p_client_request_id IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR (p_proof_path IS NOT NULL AND p_proof_path !~ (
      '^' || p_society_id::text || '/' || p_unit_id::text ||
      '/payments/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    ))
  THEN
    RAISE EXCEPTION 'The payment submission is invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF p_proof_path IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects object
    WHERE object.bucket_id = 'payment-proofs' AND object.name = p_proof_path
      AND object.metadata->>'mimetype' IN ('image/jpeg', 'image/png')
      AND CASE WHEN object.metadata->>'size' ~ '^[0-9]+$'
        THEN (object.metadata->>'size')::numeric BETWEEN 1 AND 5242880
        ELSE false END
      AND (
        (object.metadata->>'mimetype' = 'image/jpeg' AND p_proof_path LIKE '%.jpg')
        OR (object.metadata->>'mimetype' = 'image/png' AND p_proof_path LIKE '%.png')
      )
  ) THEN
    RAISE EXCEPTION 'The uploaded payment proof is not available.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.billing_payments (
    society_id, unit_id, amount_paise, mode, source, reference, paid_on,
    proof_path, status, submitted_by, client_request_id, created_by
  ) VALUES (
    p_society_id, p_unit_id, p_amount_paise, 'upi', 'resident_submitted',
    upper(p_reference), p_paid_on, p_proof_path, 'awaiting_confirmation',
    auth.uid(), p_client_request_id, auth.uid()
  )
  ON CONFLICT (society_id, submitted_by, client_request_id) DO NOTHING
  RETURNING * INTO saved;
  IF NOT FOUND THEN
    SELECT * INTO saved FROM public.billing_payments
    WHERE society_id = p_society_id AND submitted_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF (saved.unit_id, saved.amount_paise, saved.reference, saved.paid_on,
        saved.proof_path)
      IS DISTINCT FROM
       (p_unit_id, p_amount_paise, upper(p_reference), p_paid_on, p_proof_path)
    THEN
      RAISE EXCEPTION 'The payment request was already used with different details.'
        USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(saved);
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'resident', 'billing.payment.submit',
    'billing_payment', saved.id::text, NULL,
    jsonb_build_object('status', saved.status, 'amount_paise', saved.amount_paise),
    p_request_id
  );
  FOR recipient IN
    SELECT DISTINCT membership.user_id
    FROM public.memberships membership
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND membership.user_id IS NOT NULL
      AND membership.roles && ARRAY['admin', 'committee']::text[]
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, 'billing_payment_submitted',
      'Payment submitted for review',
      'A resident submitted a payment for confirmation.',
      'billing_payment_review', saved.id, p_request_id
    );
  END LOOP;
  RETURN to_jsonb(saved);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_record(
  p_society_id uuid, p_unit_id uuid, p_amount_paise bigint, p_mode text,
  p_reference text, p_paid_on date, p_client_request_id uuid, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment public.billing_payments;
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_mode IS NULL OR p_mode NOT IN ('upi', 'cash', 'cheque', 'bank_transfer')
    OR (p_mode = 'cash' AND p_reference IS NOT NULL)
    OR (p_mode <> 'cash' AND (
      p_reference IS NULL OR upper(p_reference) !~ '^[A-Z0-9]{6,30}$'
    ))
    OR p_paid_on IS NULL OR p_paid_on > private.billing_society_today(p_society_id)
    OR p_client_request_id IS NULL OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The recorded payment is invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO payment FROM public.billing_payments
    WHERE society_id = p_society_id AND submitted_by = auth.uid()
      AND client_request_id = p_client_request_id
    FOR UPDATE;
  IF FOUND THEN
    IF (payment.unit_id, payment.amount_paise, payment.mode, payment.reference,
        payment.paid_on)
      IS DISTINCT FROM
       (p_unit_id, p_amount_paise, p_mode, upper(p_reference), p_paid_on)
    THEN
      RAISE EXCEPTION 'The payment request was already used with different details.'
        USING ERRCODE = '23505';
    END IF;
    RETURN public.billing_payment_get(p_society_id, payment.id);
  END IF;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
      AND unit.active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected unit is not available.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.billing_payments (
    society_id, unit_id, amount_paise, mode, source, reference, paid_on,
    status, submitted_by, client_request_id, created_by
  ) VALUES (
    p_society_id, p_unit_id, p_amount_paise, p_mode, 'admin_recorded',
    upper(p_reference), p_paid_on, 'awaiting_confirmation',
    auth.uid(), p_client_request_id, auth.uid()
  )
  RETURNING * INTO payment;
  result := private.billing_payment_apply(
    p_society_id, payment.id, NULL, p_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.payment.record',
    'billing_payment', payment.id::text, NULL,
    jsonb_build_object(
      'mode', payment.mode, 'status', 'confirmed',
      'amount_paise', payment.amount_paise
    ), p_request_id
  );
  RETURN result;
END;
$$;