CREATE TABLE public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  amount_paise bigint NOT NULL,
  mode text NOT NULL,
  source text NOT NULL,
  reference text,
  paid_on date NOT NULL,
  proof_path text,
  status text NOT NULL,
  submitted_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  confirmed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  receipt_no text,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_payments_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT billing_payments_society_id_id_unit_key
    UNIQUE (society_id, id, unit_id),
  CONSTRAINT billing_payments_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_payments_amount_check
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  CONSTRAINT billing_payments_mode_check
    CHECK (mode IN ('upi', 'cash', 'cheque', 'bank_transfer')),
  CONSTRAINT billing_payments_source_check
    CHECK (source IN ('resident_submitted', 'admin_recorded')),
  CONSTRAINT billing_payments_reference_check
    CHECK (
      (mode IN ('upi', 'cheque', 'bank_transfer')
        AND reference IS NOT NULL
        AND reference ~ '^[A-Z0-9]{6,30}$')
      OR (mode = 'cash' AND reference IS NULL)
    ),
  CONSTRAINT billing_payments_proof_path_check CHECK (
    proof_path IS NULL OR proof_path ~ (
      '^' || society_id::text || '/' || unit_id::text ||
      '/payments/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    )
  ),
  CONSTRAINT billing_payments_status_check CHECK (
    (status = 'awaiting_confirmation'
      AND confirmed_by IS NULL AND confirmed_at IS NULL
      AND rejected_at IS NULL AND reject_reason IS NULL AND receipt_no IS NULL)
    OR (status = 'confirmed'
      AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL
      AND rejected_at IS NULL AND reject_reason IS NULL
      AND receipt_no IS NOT NULL
      AND receipt_no ~ '^R-[0-9]{4}-[0-9]{6}$')
    OR (status = 'rejected'
      AND source = 'resident_submitted'
      AND confirmed_by IS NULL AND confirmed_at IS NULL
      AND rejected_at IS NOT NULL
      AND reject_reason IS NOT NULL
      AND char_length(btrim(reject_reason)) BETWEEN 2 AND 500
      AND receipt_no IS NULL)
  ),
  CONSTRAINT billing_payments_paid_on_check CHECK (paid_on <= current_date)
);

CREATE UNIQUE INDEX billing_payments_client_request_key
  ON public.billing_payments (society_id, submitted_by, client_request_id);
CREATE UNIQUE INDEX billing_payments_active_upi_reference_key
  ON public.billing_payments (society_id, reference)
  WHERE mode = 'upi' AND status IN ('awaiting_confirmation', 'confirmed');
CREATE UNIQUE INDEX billing_payments_receipt_key
  ON public.billing_payments (society_id, receipt_no)
  WHERE receipt_no IS NOT NULL;
CREATE INDEX billing_payments_unit_created_idx
  ON public.billing_payments (society_id, unit_id, created_at DESC);
CREATE INDEX billing_payments_review_queue_idx
  ON public.billing_payments (society_id, created_at, id)
  WHERE status = 'awaiting_confirmation';
CREATE INDEX billing_payments_submitted_by_idx
  ON public.billing_payments (submitted_by);
CREATE INDEX billing_payments_confirmed_by_idx
  ON public.billing_payments (confirmed_by);
CREATE INDEX billing_payments_created_by_idx
  ON public.billing_payments (created_by);

ALTER TABLE public.billing_bills
  ADD CONSTRAINT billing_bills_society_id_id_unit_key
  UNIQUE (society_id, id, unit_id);

CREATE TABLE public.billing_payment_allocations (
  society_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  bill_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  amount_paise bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_id, bill_id),
  CONSTRAINT billing_payment_allocations_payment_same_unit_fkey
    FOREIGN KEY (society_id, payment_id, unit_id)
    REFERENCES public.billing_payments (society_id, id, unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT billing_payment_allocations_bill_same_unit_fkey
    FOREIGN KEY (society_id, bill_id, unit_id)
    REFERENCES public.billing_bills (society_id, id, unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT billing_payment_allocations_amount_check
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991)
);
CREATE INDEX billing_payment_allocations_bill_idx
  ON public.billing_payment_allocations (society_id, bill_id);
CREATE INDEX billing_payment_allocations_unit_idx
  ON public.billing_payment_allocations (society_id, unit_id);
CREATE INDEX billing_payment_allocations_payment_same_unit_idx
  ON public.billing_payment_allocations (society_id, payment_id, unit_id);
CREATE INDEX billing_payment_allocations_bill_same_unit_idx
  ON public.billing_payment_allocations (society_id, bill_id, unit_id);

CREATE OR REPLACE FUNCTION private.billing_apply_credit_to_new_bill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment record;
  remaining bigint := NEW.total_paise - NEW.paid_paise - NEW.waived_paise;
  allocation bigint;
  previous_mutation text := current_setting('homeish.billing_mutation', true);
BEGIN
  IF remaining <= 0 THEN RETURN NEW; END IF;
  FOR payment IN
    SELECT current_payment.id,
      current_payment.amount_paise - coalesce((
        SELECT sum(existing.amount_paise)
        FROM public.billing_payment_allocations existing
        WHERE existing.society_id = current_payment.society_id
          AND existing.payment_id = current_payment.id
      ), 0)::bigint AS available_paise
    FROM public.billing_payments current_payment
    WHERE current_payment.society_id = NEW.society_id
      AND current_payment.unit_id = NEW.unit_id
      AND current_payment.status = 'confirmed'
      AND current_payment.amount_paise > coalesce((
        SELECT sum(existing.amount_paise)
        FROM public.billing_payment_allocations existing
        WHERE existing.society_id = current_payment.society_id
          AND existing.payment_id = current_payment.id
      ), 0)
    ORDER BY current_payment.confirmed_at, current_payment.id
    FOR UPDATE OF current_payment
  LOOP
    EXIT WHEN remaining = 0;
    allocation := least(remaining, payment.available_paise);
    INSERT INTO public.billing_payment_allocations (
      society_id, payment_id, bill_id, unit_id, amount_paise
    ) VALUES (
      NEW.society_id, payment.id, NEW.id, NEW.unit_id, allocation
    );
    PERFORM set_config('homeish.billing_mutation', 'on', true);
    UPDATE public.billing_bills
      SET paid_paise = paid_paise + allocation
      WHERE society_id = NEW.society_id AND id = NEW.id;
    PERFORM set_config(
      'homeish.billing_mutation', coalesce(previous_mutation, ''), true
    );
    remaining := remaining - allocation;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_bills_apply_credit
  AFTER INSERT ON public.billing_bills
  FOR EACH ROW EXECUTE FUNCTION private.billing_apply_credit_to_new_bill();

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_payments,
  public.billing_payment_allocations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.billing_payments,
  public.billing_payment_allocations TO authenticated;

CREATE POLICY billing_payments_read
  ON public.billing_payments FOR SELECT TO authenticated
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
CREATE POLICY billing_payment_allocations_read
  ON public.billing_payment_allocations FOR SELECT TO authenticated
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

CREATE OR REPLACE FUNCTION private.billing_payment_mutation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('homeish.billing_payment_mutation', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Payment history can only be changed through billing functions.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' OR OLD.status <> 'awaiting_confirmation'
    OR (NEW.id, NEW.society_id, NEW.unit_id, NEW.mode, NEW.source,
        NEW.reference, NEW.paid_on, NEW.proof_path, NEW.submitted_by,
        NEW.client_request_id, NEW.created_at, NEW.created_by)
       IS DISTINCT FROM
       (OLD.id, OLD.society_id, OLD.unit_id, OLD.mode, OLD.source,
        OLD.reference, OLD.paid_on, OLD.proof_path, OLD.submitted_by,
        OLD.client_request_id, OLD.created_at, OLD.created_by)
    OR NEW.status NOT IN ('confirmed', 'rejected')
  THEN
    RAISE EXCEPTION 'Payment history is immutable.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_payments_immutable
  BEFORE UPDATE OR DELETE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION private.billing_payment_mutation_guard();

CREATE TRIGGER billing_payment_allocations_immutable
  BEFORE UPDATE OR DELETE ON public.billing_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();

CREATE OR REPLACE FUNCTION private.billing_payment_apply(
  p_society_id uuid,
  p_payment_id uuid,
  p_corrected_amount bigint,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment public.billing_payments;
  unit_society_id uuid;
  receipt_year integer;
  receipt_number integer;
  payment_amount bigint;
  original_amount bigint;
  remaining bigint;
  bill record;
  allocation bigint;
  result jsonb;
  recipient record;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT unit.society_id INTO unit_society_id
  FROM public.billing_payments current_payment
  JOIN public.units unit ON unit.society_id = current_payment.society_id
    AND unit.id = current_payment.unit_id
  WHERE current_payment.society_id = p_society_id
    AND current_payment.id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = unit_society_id
      AND unit.id = (
        SELECT current_payment.unit_id
        FROM public.billing_payments current_payment
        WHERE current_payment.society_id = p_society_id
          AND current_payment.id = p_payment_id
      )
    FOR UPDATE;
  SELECT * INTO payment
  FROM public.billing_payments current_payment
  WHERE current_payment.society_id = p_society_id
    AND current_payment.id = p_payment_id
  FOR UPDATE;
  IF payment.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'This payment is no longer awaiting confirmation.'
      USING ERRCODE = '23505';
  END IF;
  payment_amount := coalesce(p_corrected_amount, payment.amount_paise);
  original_amount := payment.amount_paise;
  IF payment_amount < 1 OR payment_amount > 9007199254740991
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The confirmed amount or request is invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT extract(year FROM now() AT TIME ZONE society.timezone)::integer
    INTO receipt_year
  FROM public.societies society WHERE society.id = p_society_id;
  INSERT INTO public.billing_receipt_counters (society_id, year, last_no)
  VALUES (p_society_id, receipt_year, 1)
  ON CONFLICT (society_id, year)
  DO UPDATE SET last_no = public.billing_receipt_counters.last_no + 1
  RETURNING last_no INTO receipt_number;
  IF receipt_number > 999999 THEN
    RAISE EXCEPTION 'The annual receipt limit has been reached.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('homeish.billing_payment_mutation', 'on', true);
  UPDATE public.billing_payments
  SET amount_paise = payment_amount,
      status = 'confirmed',
      confirmed_by = auth.uid(),
      confirmed_at = now(),
      receipt_no = 'R-' || receipt_year::text || '-' ||
        lpad(receipt_number::text, 6, '0')
  WHERE society_id = p_society_id AND id = p_payment_id
  RETURNING * INTO payment;
  PERFORM set_config('homeish.billing_mutation', 'on', true);
  remaining := payment.amount_paise;
  FOR bill IN
    SELECT current_bill.id, current_bill.total_paise,
      current_bill.paid_paise, current_bill.waived_paise
    FROM public.billing_bills current_bill
    WHERE current_bill.society_id = p_society_id
      AND current_bill.unit_id = payment.unit_id
      AND current_bill.cancelled_at IS NULL
      AND current_bill.paid_paise + current_bill.waived_paise
        < current_bill.total_paise
    ORDER BY current_bill.due_date, current_bill.period_start, current_bill.id
    FOR UPDATE
  LOOP
    EXIT WHEN remaining = 0;
    allocation := least(
      remaining,
      bill.total_paise - bill.paid_paise - bill.waived_paise
    );
    INSERT INTO public.billing_payment_allocations (
      society_id, payment_id, bill_id, unit_id, amount_paise
    ) VALUES (
      p_society_id, payment.id, bill.id, payment.unit_id, allocation
    );
    UPDATE public.billing_bills
    SET paid_paise = paid_paise + allocation
    WHERE society_id = p_society_id AND id = bill.id;
    remaining := remaining - allocation;
  END LOOP;
  INSERT INTO public.billing_ledger_entries (
    society_id, unit_id, kind, direction, amount_paise, payment_id, created_by
  ) VALUES (
    p_society_id, payment.unit_id, 'payment', 'credit',
    payment.amount_paise, payment.id, auth.uid()
  );
  IF p_corrected_amount IS NOT NULL
    AND p_corrected_amount <> original_amount
  THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin', 'billing.payment.amount_correct',
      'billing_payment', payment.id::text,
      jsonb_build_object('amount_paise', original_amount),
      jsonb_build_object('amount_paise', p_corrected_amount), p_request_id
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.payment.confirm',
    'billing_payment', payment.id::text, NULL,
    jsonb_build_object(
      'status', 'confirmed', 'receipt_no', payment.receipt_no,
      'amount_paise', payment.amount_paise
    ), p_request_id
  );
  IF payment.source = 'resident_submitted' THEN
    IF EXISTS (
      SELECT 1 FROM public.memberships membership
      WHERE membership.society_id = p_society_id
        AND membership.user_id = payment.submitted_by
        AND membership.status = 'active'
    ) THEN
      PERFORM private.create_notification(
        p_society_id, payment.submitted_by, 'billing_payment_confirmed',
        'Payment confirmed',
        'Your payment has been confirmed. Your receipt is available in Billing.',
        'billing_payment', payment.id, p_request_id
      );
    END IF;
  ELSE
    FOR recipient IN
      SELECT DISTINCT membership.user_id
      FROM public.unit_occupants occupant
      JOIN public.memberships membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.society_id = p_society_id
        AND occupant.unit_id = payment.unit_id
        AND occupant.status = 'active' AND membership.status = 'active'
        AND membership.user_id IS NOT NULL
      ORDER BY membership.user_id
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient.user_id, 'billing_payment_recorded',
        'Payment recorded',
        'A payment for your unit has been recorded. View Billing for details.',
        'billing_payment', payment.id, p_request_id
      );
    END LOOP;
  END IF;
  result := to_jsonb(payment) || jsonb_build_object(
    'unallocated_paise', remaining::text
  );
  RETURN result;
END;
$$;

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
    OR p_paid_on IS NULL OR p_paid_on > current_date
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

CREATE OR REPLACE FUNCTION public.billing_payment_confirm(
  p_society_id uuid, p_payment_id uuid, p_corrected_amount bigint,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.billing_payment_apply(
    p_society_id, p_payment_id, p_corrected_amount, p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_reject(
  p_society_id uuid, p_payment_id uuid, p_reason text, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment public.billing_payments;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 500
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a reason for rejecting this payment.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO payment FROM public.billing_payments
    WHERE society_id = p_society_id AND id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found.' USING ERRCODE = 'P0002';
  END IF;
  IF payment.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'This payment is no longer awaiting confirmation.'
      USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('homeish.billing_payment_mutation', 'on', true);
  UPDATE public.billing_payments
    SET status = 'rejected', reject_reason = btrim(p_reason), rejected_at = now()
    WHERE society_id = p_society_id AND id = p_payment_id
    RETURNING * INTO payment;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.payment.reject',
    'billing_payment', payment.id::text,
    jsonb_build_object('status', 'awaiting_confirmation'),
    jsonb_build_object('status', payment.status, 'reason', payment.reject_reason),
    p_request_id
  );
  IF EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = payment.submitted_by
      AND membership.status = 'active'
  ) THEN
    PERFORM private.create_notification(
      p_society_id, payment.submitted_by, 'billing_payment_rejected',
      'Payment needs correction',
      'Your payment could not be confirmed. Review the reason in Billing and resubmit.',
      'billing_payment', payment.id, p_request_id
    );
  END IF;
  RETURN to_jsonb(payment);
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
    OR p_paid_on IS NULL OR p_paid_on > current_date
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

CREATE OR REPLACE FUNCTION public.billing_payments_list(
  p_society_id uuid, p_limit integer, p_offset integer, p_status text DEFAULT NULL
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
      SELECT 1 FROM public.societies society
      WHERE society.id = p_society_id AND society.status <> 'archived'
    )
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset < 0
    OR (p_status IS NOT NULL AND p_status NOT IN (
      'awaiting_confirmation', 'confirmed', 'rejected'
    ))
  THEN
    RAISE EXCEPTION 'Billing payment access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) INTO result
  FROM (
    SELECT payment.id, payment.unit_id, unit.number AS unit_number,
      payment.amount_paise, payment.mode, payment.source, payment.reference,
      payment.paid_on, payment.status, payment.submitted_by,
      profile.full_name AS submitted_by_name, payment.confirmed_by,
      payment.confirmed_at, payment.rejected_at, payment.reject_reason,
      payment.receipt_no,
      CASE
        WHEN private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
          THEN payment.proof_path
        ELSE NULL
      END AS proof_path,
      payment.created_at,
      coalesce(allocations.allocated_paise, 0) AS allocated_paise,
      (payment.amount_paise - coalesce(allocations.allocated_paise, 0))::text
        AS unallocated_paise
    FROM public.billing_payments payment
    JOIN public.units unit
      ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
    JOIN public.profiles profile ON profile.id = payment.submitted_by
    LEFT JOIN LATERAL (
      SELECT sum(allocation.amount_paise)::bigint AS allocated_paise
      FROM public.billing_payment_allocations allocation
      WHERE allocation.society_id = payment.society_id
        AND allocation.payment_id = payment.id
    ) allocations ON true
    WHERE payment.society_id = p_society_id
      AND (p_status IS NULL OR payment.status = p_status)
      AND (
        private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
        OR (
          private.has_role(p_society_id, ARRAY['resident']::text[])
          AND private.occupies_unit(payment.unit_id)
        )
      )
    ORDER BY payment.created_at DESC, payment.id DESC
    LIMIT p_limit OFFSET p_offset
  ) item;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_get(
  p_society_id uuid, p_payment_id uuid
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
      SELECT 1 FROM public.societies society
      WHERE society.id = p_society_id AND society.status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing payment access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(payment) || jsonb_build_object(
    'unit_number', unit.number,
    'submitted_by_name', profile.full_name,
    'proof_path', CASE
      WHEN private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
        THEN payment.proof_path
      ELSE NULL
    END,
    'allocations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'bill_id', allocation.bill_id,
        'amount_paise', allocation.amount_paise
      ) ORDER BY bill.due_date, bill.id)
      FROM public.billing_payment_allocations allocation
      JOIN public.billing_bills bill
        ON bill.society_id = allocation.society_id
        AND bill.id = allocation.bill_id
      WHERE allocation.society_id = payment.society_id
        AND allocation.payment_id = payment.id
    ), '[]'::jsonb),
    'allocated_paise', coalesce((
      SELECT sum(allocation.amount_paise)
      FROM public.billing_payment_allocations allocation
      WHERE allocation.society_id = payment.society_id
        AND allocation.payment_id = payment.id
    ), 0)::bigint,
    'unallocated_paise', (
      payment.amount_paise - coalesce((
        SELECT sum(allocation.amount_paise)
        FROM public.billing_payment_allocations allocation
        WHERE allocation.society_id = payment.society_id
          AND allocation.payment_id = payment.id
      ), 0)
    )::text
  ) INTO result
  FROM public.billing_payments payment
  JOIN public.units unit
    ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
  JOIN public.profiles profile ON profile.id = payment.submitted_by
  WHERE payment.society_id = p_society_id AND payment.id = p_payment_id
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR (
        private.has_role(p_society_id, ARRAY['resident']::text[])
        AND private.occupies_unit(payment.unit_id)
      )
    );
  IF result IS NULL THEN
    RAISE EXCEPTION 'Payment not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.file_unit_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  segment text := pg_catalog.split_part(p_name, '/', 2);
BEGIN
  IF segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;
  RETURN segment::uuid;
END;
$$;
REVOKE ALL ON FUNCTION private.file_unit_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.file_unit_id(text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.billing_payment_mutation_guard(),
  private.billing_payment_apply(uuid, uuid, bigint, text),
  private.billing_apply_credit_to_new_bill()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_payment_submit(
  uuid, uuid, bigint, text, date, text, uuid, text
), public.billing_payment_confirm(uuid, uuid, bigint, text),
  public.billing_payment_reject(uuid, uuid, text, text),
  public.billing_payment_record(uuid, uuid, bigint, text, text, date, uuid, text),
  public.billing_payments_list(uuid, integer, integer, text),
  public.billing_payment_get(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_payment_submit(
  uuid, uuid, bigint, text, date, text, uuid, text
), public.billing_payment_confirm(uuid, uuid, bigint, text),
  public.billing_payment_reject(uuid, uuid, text, text),
public.billing_payment_record(uuid, uuid, bigint, text, text, date, uuid, text),
public.billing_payments_list(uuid, integer, integer, text),
public.billing_payment_get(uuid, uuid)
  TO authenticated;

CREATE POLICY billing_payment_proofs_resident_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND private.module_enabled(private.file_society_id(name), 'billing')
    AND private.society_writable(private.file_society_id(name))
    AND name ~* (
      '^' || private.file_society_id(name)::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}/payments/' ||
      '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    )
    AND private.has_role(
      private.file_society_id(name), ARRAY['resident']::text[]
    )
    AND private.occupies_unit(private.file_unit_id(name))
    AND EXISTS (
      SELECT 1 FROM public.units unit
      WHERE unit.society_id = private.file_society_id(name)
        AND unit.id = private.file_unit_id(name)
        AND unit.active
    )
  );

CREATE POLICY billing_payment_proofs_insert_guard
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id <> 'payment-proofs'
    OR (
      private.module_enabled(private.file_society_id(name), 'billing')
      AND private.society_writable(private.file_society_id(name))
      AND name ~* (
        '^' || private.file_society_id(name)::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
        '[89ab][0-9a-f]{3}-[0-9a-f]{12}/payments/' ||
        '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
        '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
      )
      AND EXISTS (
        SELECT 1 FROM public.units unit
        WHERE unit.society_id = private.file_society_id(name)
          AND unit.id = private.file_unit_id(name)
          AND unit.active
      )
      AND private.has_role(
        private.file_society_id(name), ARRAY['resident']::text[]
      )
      AND private.occupies_unit(private.file_unit_id(name))
    )
  );

CREATE POLICY billing_payment_proofs_read_guard
  ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id <> 'payment-proofs'
    OR (
      private.module_enabled(private.file_society_id(name), 'billing')
      AND EXISTS (
        SELECT 1 FROM public.societies society
        WHERE society.id = private.file_society_id(name)
          AND society.status <> 'archived'
      )
      AND name ~* (
        '^' || private.file_society_id(name)::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
        '[89ab][0-9a-f]{3}-[0-9a-f]{12}/payments/' ||
        '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
        '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
      )
      AND private.has_role(
        private.file_society_id(name), ARRAY['admin', 'committee']::text[]
      )
      AND EXISTS (
        SELECT 1 FROM public.billing_payments payment
        WHERE payment.society_id = private.file_society_id(name)
          AND payment.proof_path = name
      )
      OR (
        private.has_role(
          private.file_society_id(name), ARRAY['resident']::text[]
        )
        AND private.occupies_unit(private.file_unit_id(name))
        AND EXISTS (
          SELECT 1 FROM public.units unit
          WHERE unit.society_id = private.file_society_id(name)
            AND unit.id = private.file_unit_id(name)
            AND unit.active
        )
      )
    )
  );

CREATE POLICY billing_payment_proofs_resident_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND private.module_enabled(private.file_society_id(name), 'billing')
    AND private.has_role(
      private.file_society_id(name), ARRAY['resident']::text[]
    )
    AND private.occupies_unit(private.file_unit_id(name))
    AND name ~* (
      '^' || private.file_society_id(name)::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}/payments/' ||
      '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    )
  );
