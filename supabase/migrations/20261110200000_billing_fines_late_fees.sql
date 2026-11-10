-- System-generated late fees have no human actor; every other bill keeps one.
ALTER TABLE public.billing_bills ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.billing_bills
  ADD CONSTRAINT billing_bills_created_by_check
  CHECK (created_by IS NOT NULL OR kind = 'late_fee');
ALTER TABLE public.billing_bill_lines ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.billing_bill_lines
  ADD CONSTRAINT billing_bill_lines_created_by_check
  CHECK (created_by IS NOT NULL OR charge_type_id IS NULL);

CREATE OR REPLACE FUNCTION private.billing_society_today(p_society_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (now() AT TIME ZONE coalesce(society.timezone, 'Asia/Kolkata'))::date
  FROM public.societies society
  WHERE society.id = p_society_id
$$;

CREATE OR REPLACE FUNCTION private.billing_notify_unit(
  p_society_id uuid,
  p_unit_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid,
  p_request_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient record;
  sent integer := 0;
BEGIN
  FOR recipient IN
    SELECT DISTINCT membership.user_id
    FROM public.unit_occupants occupant
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND membership.status = 'active'
      AND membership.user_id IS NOT NULL
    ORDER BY membership.user_id
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, p_type, p_title, p_body,
      p_entity_type, p_entity_id, p_request_id
    );
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_fine_add(
  p_society_id uuid,
  p_unit_id uuid,
  p_amount_paise bigint,
  p_reason text,
  p_fine_date date,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  today date;
  reason text := btrim(p_reason);
  bill public.billing_bills;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  today := private.billing_society_today(p_society_id);
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR reason IS NULL OR char_length(reason) NOT BETWEEN 2 AND 160
    OR p_fine_date IS NULL OR p_fine_date > today
    OR p_fine_date < today - 366
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The fine details are invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
      AND unit.active
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected unit is not available.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.billing_bills (
    society_id, unit_id, kind, title, period_start, due_date, total_paise,
    created_by
  ) VALUES (
    p_society_id, p_unit_id, 'fine', reason,
    date_trunc('month', p_fine_date)::date, today, p_amount_paise, auth.uid()
  )
  RETURNING * INTO bill;
  INSERT INTO public.billing_bill_lines (
    society_id, bill_id, unit_id, period_start, charge_type_id, description,
    amount_paise, created_by
  ) VALUES (
    p_society_id, bill.id, bill.unit_id, bill.period_start, NULL, reason,
    p_amount_paise, auth.uid()
  );
  INSERT INTO public.billing_ledger_entries (
    society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
  ) VALUES (
    p_society_id, bill.unit_id, 'bill', 'debit', p_amount_paise, bill.id,
    auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.fine.add', 'billing_bill',
    bill.id::text, NULL,
    jsonb_build_object(
      'unit_id', bill.unit_id, 'amount_paise', p_amount_paise,
      'fine_date', p_fine_date
    ), reason, p_request_id
  );
  PERFORM private.billing_notify_unit(
    p_society_id, bill.unit_id, 'billing_fine_added', 'A fine was added',
    'A fine was added to your unit. View Billing for details.',
    'billing_bill', bill.id, p_request_id
  );
  SELECT * INTO bill FROM public.billing_bills
    WHERE society_id = p_society_id AND id = bill.id;
  RETURN to_jsonb(bill) || jsonb_build_object(
    'outstanding_paise', bill.total_paise - bill.paid_paise - bill.waived_paise
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bill_waive(
  p_society_id uuid,
  p_bill_id uuid,
  p_amount_paise bigint,
  p_reason text,
  p_cancel boolean,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bill public.billing_bills;
  previous public.billing_bills;
  bill_unit_id uuid;
  reason text := btrim(p_reason);
  outstanding bigint;
  waive_amount bigint;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF reason IS NULL OR char_length(reason) NOT BETWEEN 2 AND 500
    OR p_cancel IS NULL
    OR (p_amount_paise IS NOT NULL
      AND p_amount_paise NOT BETWEEN 1 AND 9007199254740991)
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a valid amount and reason.' USING ERRCODE = '22023';
  END IF;
  SELECT bill_row.unit_id INTO bill_unit_id
    FROM public.billing_bills bill_row
    WHERE bill_row.society_id = p_society_id AND bill_row.id = p_bill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = bill_unit_id
    FOR UPDATE;
  SELECT * INTO previous FROM public.billing_bills
    WHERE society_id = p_society_id AND id = p_bill_id FOR UPDATE;
  outstanding := previous.total_paise - previous.paid_paise - previous.waived_paise;
  IF previous.cancelled_at IS NOT NULL OR outstanding = 0 THEN
    RAISE EXCEPTION 'This bill has no outstanding amount.'
      USING ERRCODE = '23505';
  END IF;
  IF p_cancel AND previous.paid_paise > 0 THEN
    RAISE EXCEPTION 'Only unpaid bills can be cancelled.'
      USING ERRCODE = '23505', HINT = 'not_unpaid';
  END IF;
  waive_amount := coalesce(p_amount_paise, outstanding);
  IF waive_amount > outstanding OR (p_cancel AND waive_amount <> outstanding) THEN
    RAISE EXCEPTION 'The waiver cannot exceed the outstanding amount.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('homeish.billing_mutation', 'on', true);
  UPDATE public.billing_bills
    SET waived_paise = waived_paise + waive_amount,
        cancelled_at = CASE WHEN p_cancel THEN now() ELSE NULL END,
        cancelled_by = CASE WHEN p_cancel THEN auth.uid() ELSE NULL END,
        cancel_reason = CASE WHEN p_cancel THEN reason ELSE NULL END
    WHERE society_id = p_society_id AND id = p_bill_id
    RETURNING * INTO bill;
  INSERT INTO public.billing_ledger_entries (
    society_id, unit_id, kind, direction, amount_paise, bill_id, reason,
    created_by
  ) VALUES (
    p_society_id, bill.unit_id, 'waiver', 'credit', waive_amount, bill.id,
    reason, auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_cancel THEN 'billing.bill.cancel' ELSE 'billing.bill.waive' END,
    'billing_bill', bill.id::text,
    jsonb_build_object(
      'status', previous.status, 'waived_paise', previous.waived_paise
    ),
    jsonb_build_object(
      'status', bill.status, 'waived_paise', bill.waived_paise,
      'amount_paise', waive_amount
    ), left(reason, 500), p_request_id
  );
  PERFORM private.billing_notify_unit(
    p_society_id, bill.unit_id, 'billing_bill_waived',
    CASE WHEN p_cancel THEN 'A bill was cancelled' ELSE 'A bill was waived' END,
    CASE WHEN p_cancel
      THEN 'A bill for your unit was cancelled. View Billing for details.'
      ELSE 'Part or all of a bill for your unit was waived. View Billing for details.'
    END,
    'billing_bill', bill.id, p_request_id
  );
  RETURN to_jsonb(bill) || jsonb_build_object(
    'outstanding_paise', bill.total_paise - bill.paid_paise - bill.waived_paise
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_late_fees_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings jsonb;
  fee jsonb;
  grace integer;
  rounding text;
  period date;
  candidate record;
  current_bill public.billing_bills;
  outstanding bigint;
  amount numeric;
  new_bill_id uuid;
  charged integer := 0;
  charged_total numeric := 0;
BEGIN
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The late fee run is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN jsonb_build_object('charged_count', 0, 'total_paise', '0');
  END IF;
  SELECT config.settings INTO settings FROM public.module_configs config
    WHERE config.society_id = p_society_id AND config.module_key = 'billing'
    FOR SHARE;
  fee := settings->'late_fee';
  IF fee IS NULL OR jsonb_typeof(fee) <> 'object'
    OR NOT private.billing_settings_valid(settings)
  THEN
    RETURN jsonb_build_object('charged_count', 0, 'total_paise', '0');
  END IF;
  grace := coalesce((settings->>'grace_days')::integer, 5);
  rounding := coalesce(settings->>'rounding', 'rupee');
  period := date_trunc('month', p_today)::date;
  FOR candidate IN
    SELECT bill.id, bill.unit_id
    FROM public.billing_bills bill
    WHERE bill.society_id = p_society_id
      AND bill.kind IN ('regular', 'fine')
      AND bill.cancelled_at IS NULL
      AND bill.paid_paise + bill.waived_paise < bill.total_paise
      AND bill.due_date + grace < p_today
      AND NOT EXISTS (
        SELECT 1 FROM public.billing_bills existing
        WHERE existing.society_id = bill.society_id
          AND existing.related_bill_id = bill.id
          AND existing.kind = 'late_fee'
          AND existing.period_start = period
      )
    ORDER BY bill.unit_id, bill.due_date, bill.id
  LOOP
    PERFORM 1 FROM public.units unit
      WHERE unit.society_id = p_society_id AND unit.id = candidate.unit_id
      FOR UPDATE;
    SELECT * INTO current_bill FROM public.billing_bills
      WHERE society_id = p_society_id AND id = candidate.id FOR UPDATE;
    outstanding := current_bill.total_paise - current_bill.paid_paise
      - current_bill.waived_paise;
    CONTINUE WHEN current_bill.cancelled_at IS NOT NULL OR outstanding <= 0;
    IF fee->>'type' = 'flat' THEN
      amount := (fee->>'value')::numeric;
    ELSE
      amount := round(outstanding * (fee->>'value')::numeric / 100);
      IF rounding = 'rupee' THEN
        amount := round(amount / 100) * 100;
      END IF;
    END IF;
    CONTINUE WHEN amount < 1;
    new_bill_id := NULL;
    INSERT INTO public.billing_bills (
      society_id, unit_id, kind, title, period_start, due_date, total_paise,
      related_bill_id, created_by
    ) VALUES (
      p_society_id, current_bill.unit_id, 'late_fee',
      btrim(left('Late fee - ' || current_bill.title, 160)), period, p_today,
      private.billing_checked_amount(amount), current_bill.id, NULL
    )
    ON CONFLICT (society_id, related_bill_id, period_start)
      WHERE kind = 'late_fee'
    DO NOTHING
    RETURNING id INTO new_bill_id;
    CONTINUE WHEN new_bill_id IS NULL;
    INSERT INTO public.billing_bill_lines (
      society_id, bill_id, unit_id, period_start, charge_type_id, description,
      amount_paise, created_by
    ) VALUES (
      p_society_id, new_bill_id, current_bill.unit_id, period, NULL,
      btrim(left('Late fee - ' || current_bill.title, 160)), amount::bigint,
      NULL
    );
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
    ) VALUES (
      p_society_id, current_bill.unit_id, 'bill', 'debit', amount::bigint,
      new_bill_id, NULL
    );
    PERFORM private.billing_notify_unit(
      p_society_id, current_bill.unit_id, 'billing_late_fee_added',
      'A late fee was added',
      'A late fee was added because a bill is overdue. View Billing for details.',
      'billing_bill', new_bill_id, p_request_id
    );
    charged := charged + 1;
    charged_total := charged_total + amount;
  END LOOP;
  IF charged > 0 THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, NULL, 'system', 'billing.late_fees.apply',
      'billing_late_fee_run', p_today::text, NULL,
      jsonb_build_object(
        'period_start', period, 'charged_count', charged,
        'total_paise', charged_total::text
      ), p_request_id
    );
  END IF;
  RETURN jsonb_build_object(
    'charged_count', charged, 'total_paise', charged_total::text
  );
END;
$$;

REVOKE ALL ON FUNCTION private.billing_society_today(uuid),
  private.billing_notify_unit(uuid, uuid, text, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_fine_add(uuid, uuid, bigint, text, date, text),
  public.billing_bill_waive(uuid, uuid, bigint, text, boolean, text),
  public.billing_late_fees_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_fine_add(uuid, uuid, bigint, text, date, text),
  public.billing_bill_waive(uuid, uuid, bigint, text, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_late_fees_run(uuid, date, text)
  TO service_role;
