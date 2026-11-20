CREATE TABLE public.billing_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  plan_date date NOT NULL,
  down_payment_paise bigint NOT NULL,
  installment_count integer NOT NULL,
  first_due_date date NOT NULL,
  remarks text,
  status text NOT NULL DEFAULT 'active',
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_payment_plans_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT billing_payment_plans_society_id_id_unit_key
    UNIQUE (society_id, id, unit_id),
  CONSTRAINT billing_payment_plans_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_payment_plans_amount_check
    CHECK (down_payment_paise BETWEEN 0 AND 9007199254740991),
  CONSTRAINT billing_payment_plans_installment_count_check
    CHECK (installment_count > 0),
  CONSTRAINT billing_payment_plans_remarks_check
    CHECK (remarks IS NULL OR char_length(btrim(remarks)) <= 500),
  CONSTRAINT billing_payment_plans_status_check
    CHECK (status IN ('active', 'cancelled')),
  CONSTRAINT billing_payment_plans_cancellation_check
    CHECK (
      (status = 'active' AND cancelled_at IS NULL
        AND cancelled_by IS NULL AND cancel_reason IS NULL)
      OR (status = 'cancelled' AND cancelled_at IS NOT NULL
        AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL
        AND char_length(btrim(cancel_reason)) BETWEEN 2 AND 500)
    )
);
CREATE INDEX billing_payment_plans_unit_created_idx
  ON public.billing_payment_plans (society_id, unit_id, created_at DESC);
CREATE INDEX billing_payment_plans_created_by_idx
  ON public.billing_payment_plans (created_by);
CREATE INDEX billing_payment_plans_updated_by_idx
  ON public.billing_payment_plans (updated_by);
CREATE INDEX billing_payment_plans_cancelled_by_idx
  ON public.billing_payment_plans (cancelled_by);

CREATE TABLE public.billing_payment_plan_bills (
  society_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  bill_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  snapshot_remaining_paise bigint NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_payment_plan_bills_pkey
    PRIMARY KEY (society_id, plan_id, bill_id),
  CONSTRAINT billing_payment_plan_bills_plan_same_unit_fkey
    FOREIGN KEY (society_id, plan_id, unit_id)
    REFERENCES public.billing_payment_plans (society_id, id, unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT billing_payment_plan_bills_bill_same_unit_fkey
    FOREIGN KEY (society_id, bill_id, unit_id)
    REFERENCES public.billing_bills (society_id, id, unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT billing_payment_plan_bills_snapshot_check
    CHECK (snapshot_remaining_paise BETWEEN 1 AND 9007199254740991)
);
CREATE UNIQUE INDEX billing_payment_plan_bills_active_bill_key
  ON public.billing_payment_plan_bills (society_id, bill_id)
  WHERE released_at IS NULL;
CREATE INDEX billing_payment_plan_bills_plan_idx
  ON public.billing_payment_plan_bills (society_id, plan_id, bill_id);
CREATE INDEX billing_payment_plan_bills_bill_idx
  ON public.billing_payment_plan_bills (society_id, bill_id);
CREATE INDEX billing_payment_plan_bills_plan_unit_idx
  ON public.billing_payment_plan_bills (society_id, plan_id, unit_id);
CREATE INDEX billing_payment_plan_bills_bill_unit_idx
  ON public.billing_payment_plan_bills (society_id, bill_id, unit_id);

CREATE TABLE public.billing_recovery_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  action_date date NOT NULL,
  action_type text NOT NULL,
  outcome text NOT NULL,
  next_action_date date NOT NULL,
  assigned_admin_user_id uuid,
  status text NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT billing_recovery_actions_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT billing_recovery_actions_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT billing_recovery_actions_assignee_membership_fkey
    FOREIGN KEY (society_id, assigned_admin_user_id)
    REFERENCES public.memberships (society_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT billing_recovery_actions_type_check
    CHECK (action_type IN (
      'phone_call', 'in_person_discussion', 'meeting', 'other_internal'
    )),
  CONSTRAINT billing_recovery_actions_outcome_check
    CHECK (outcome IN (
      'reached', 'no_response', 'follow_up_needed', 'resolved', 'other'
    )),
  CONSTRAINT billing_recovery_actions_status_check
    CHECK (
      (status = 'open' AND closed_at IS NULL)
      OR (status = 'closed' AND closed_at IS NOT NULL)
    )
);
CREATE INDEX billing_recovery_actions_unit_action_idx
  ON public.billing_recovery_actions (society_id, unit_id, action_date DESC);
CREATE INDEX billing_recovery_actions_follow_up_idx
  ON public.billing_recovery_actions (society_id, status, next_action_date);
CREATE INDEX billing_recovery_actions_assignee_idx
  ON public.billing_recovery_actions (society_id, assigned_admin_user_id);
CREATE INDEX billing_recovery_actions_created_by_idx
  ON public.billing_recovery_actions (created_by);
CREATE INDEX billing_recovery_actions_updated_by_idx
  ON public.billing_recovery_actions (updated_by);

CREATE OR REPLACE FUNCTION private.billing_payment_plan_bill_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payment-plan bill history is retained.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.society_id, NEW.plan_id, NEW.bill_id, NEW.unit_id,
        NEW.snapshot_remaining_paise, NEW.created_at)
      IS DISTINCT FROM
       (OLD.society_id, OLD.plan_id, OLD.bill_id, OLD.unit_id,
        OLD.snapshot_remaining_paise, OLD.created_at)
      OR (OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at)
      OR (OLD.released_at IS DISTINCT FROM NEW.released_at
        AND current_setting('homeish.billing_payment_plan_mutation', true)
          IS DISTINCT FROM 'on')
    THEN
      RAISE EXCEPTION 'Payment-plan bill links are immutable.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_payment_plan_bills_immutable
  BEFORE UPDATE OR DELETE ON public.billing_payment_plan_bills
  FOR EACH ROW EXECUTE FUNCTION private.billing_payment_plan_bill_guard();

CREATE TRIGGER billing_payment_plans_no_delete
  BEFORE DELETE ON public.billing_payment_plans
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();
CREATE TRIGGER billing_recovery_actions_no_delete
  BEFORE DELETE ON public.billing_recovery_actions
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();

ALTER TABLE public.billing_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_plan_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_recovery_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_payment_plans,
  public.billing_payment_plan_bills, public.billing_recovery_actions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.billing_payment_plans,
  public.billing_payment_plan_bills, public.billing_recovery_actions
  TO authenticated;

CREATE POLICY billing_payment_plans_read
  ON public.billing_payment_plans FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
    AND private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );
CREATE POLICY billing_payment_plan_bills_read
  ON public.billing_payment_plan_bills FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
    AND private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );
CREATE POLICY billing_recovery_actions_read
  ON public.billing_recovery_actions FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'billing')
    AND EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = society_id AND society.status <> 'archived'
    )
    AND private.has_role(society_id, ARRAY['admin', 'committee']::text[])
  );

CREATE OR REPLACE FUNCTION public.billing_payment_plans_list(
  p_society_id uuid
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
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(plan_row)
    ORDER BY plan_row.plan_date DESC, plan_row.created_at DESC), '[]'::jsonb)
    INTO result
  FROM (
    SELECT plan.id, plan.unit_id, unit.number AS unit_number,
      plan.plan_date, plan.down_payment_paise, plan.installment_count,
      plan.first_due_date, plan.remarks, plan.status, plan.cancelled_at,
      plan.cancel_reason, plan.created_at, plan_total.total_paise,
      progress.progress_paise,
      least(progress.progress_paise, plan.down_payment_paise)
        AS down_payment_paid_paise,
      greatest(progress.progress_paise - plan.down_payment_paise, 0)
        AS installments_paid_paise,
      (plan_total.total_paise - plan.down_payment_paise)
        / plan.installment_count AS installment_paise,
      (plan_total.total_paise - plan.down_payment_paise)
        - ((plan_total.total_paise - plan.down_payment_paise)
          / plan.installment_count) * plan.installment_count
        AS final_installment_paise,
      plan_bills.bills
    FROM public.billing_payment_plans plan
    JOIN public.units unit
      ON unit.society_id = plan.society_id AND unit.id = plan.unit_id
    CROSS JOIN LATERAL (
      SELECT coalesce(sum(link.snapshot_remaining_paise), 0)::bigint
        AS total_paise
      FROM public.billing_payment_plan_bills link
      WHERE link.society_id = plan.society_id AND link.plan_id = plan.id
    ) plan_total
    CROSS JOIN LATERAL (
      SELECT least(
        coalesce(sum(allocation.amount_paise), 0),
        plan_total.total_paise
      )::bigint AS progress_paise
      FROM public.billing_payment_plan_bills link
      JOIN public.billing_payment_allocations allocation
        ON allocation.society_id = link.society_id
        AND allocation.bill_id = link.bill_id
      JOIN public.billing_payments payment
        ON payment.society_id = allocation.society_id
        AND payment.id = allocation.payment_id
        AND payment.unit_id = link.unit_id
      WHERE link.society_id = plan.society_id
        AND link.plan_id = plan.id
        AND payment.status = 'confirmed'
        AND payment.paid_on >= plan.plan_date
        AND payment.confirmed_at > plan.created_at
        AND payment.confirmed_at <= coalesce(plan.cancelled_at, now())
    ) progress
    CROSS JOIN LATERAL (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'bill_id', bill.id,
        'title', bill.title,
        'due_date', bill.due_date,
        'snapshot_remaining_paise', link.snapshot_remaining_paise
      ) ORDER BY bill.due_date, bill.id), '[]'::jsonb) AS bills
      FROM public.billing_payment_plan_bills link
      JOIN public.billing_bills bill
        ON bill.society_id = link.society_id AND bill.id = link.bill_id
      WHERE link.society_id = plan.society_id AND link.plan_id = plan.id
    ) plan_bills
    WHERE plan.society_id = p_society_id
  ) plan_row;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_plan_open_bills(
  p_society_id uuid
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
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Administrator billing access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(bill_row)
    ORDER BY bill_row.unit_number, bill_row.due_date, bill_row.id), '[]'::jsonb)
    INTO result
  FROM (
    SELECT bill.id, bill.unit_id, unit.number AS unit_number, bill.title,
      bill.due_date,
      bill.total_paise - bill.paid_paise - bill.waived_paise
        AS outstanding_paise
    FROM public.billing_bills bill
    JOIN public.units unit
      ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
    WHERE bill.society_id = p_society_id
      AND bill.cancelled_at IS NULL
      AND bill.total_paise > bill.paid_paise + bill.waived_paise
      AND NOT EXISTS (
        SELECT 1 FROM public.billing_payment_plan_bills link
        WHERE link.society_id = bill.society_id
          AND link.bill_id = bill.id AND link.released_at IS NULL
      )
  ) bill_row;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_plan_save(
  p_society_id uuid,
  p_plan_id uuid,
  p_bill_ids uuid[],
  p_down_payment_paise bigint,
  p_installment_count integer,
  p_first_due_date date,
  p_remarks text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved public.billing_payment_plans;
  selected_unit_id uuid;
  expected_count integer;
  selected_count integer;
  all_bills_open boolean;
  total_paise numeric;
  plan_day date;
  old_values jsonb;
  new_values jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Administrator billing access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_bill_ids IS NULL OR cardinality(p_bill_ids) < 1
    OR cardinality(p_bill_ids) > 100
    OR cardinality(p_bill_ids) <> (
      SELECT count(DISTINCT value)::integer FROM unnest(p_bill_ids) value
    )
    OR p_down_payment_paise < 0
    OR p_down_payment_paise > 9007199254740991
    OR p_installment_count < 1
    OR p_first_due_date IS NULL
    OR p_remarks IS NOT NULL AND char_length(btrim(p_remarks)) > 500
    OR p_request_id IS NULL OR p_request_id = ''
  THEN
    RAISE EXCEPTION 'Check the payment-plan details.'
      USING ERRCODE = '22023';
  END IF;

  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO saved
    FROM public.billing_payment_plans
    WHERE society_id = p_society_id AND id = p_plan_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment plan not found.' USING ERRCODE = 'P0002';
    END IF;
    IF saved.status <> 'active' THEN
      RAISE EXCEPTION 'A cancelled plan cannot be changed.'
        USING ERRCODE = '23514';
    END IF;
    SELECT count(*)::integer,
      count(*) FILTER (WHERE link.bill_id = ANY(p_bill_ids))::integer,
      coalesce(sum(link.snapshot_remaining_paise), 0)
      INTO expected_count, selected_count, total_paise
    FROM public.billing_payment_plan_bills link
    WHERE link.society_id = p_society_id AND link.plan_id = p_plan_id;
    IF expected_count <> cardinality(p_bill_ids)
      OR selected_count <> expected_count
    THEN
      RAISE EXCEPTION 'Plan bill links cannot be changed. Cancel and replace the plan.'
        USING ERRCODE = '23514';
    END IF;
    selected_unit_id := saved.unit_id;
    plan_day := saved.plan_date;
    old_values := jsonb_build_object(
      'down_payment_paise', saved.down_payment_paise,
      'installment_count', saved.installment_count,
      'first_due_date', saved.first_due_date,
      'remarks', saved.remarks
    );
    UPDATE public.billing_payment_plans
    SET down_payment_paise = p_down_payment_paise,
        installment_count = p_installment_count,
        first_due_date = p_first_due_date,
        remarks = nullif(btrim(p_remarks), ''),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_plan_id
    RETURNING * INTO saved;
  ELSE
    PERFORM bill.id
    FROM public.billing_bills bill
    WHERE bill.society_id = p_society_id AND bill.id = ANY(p_bill_ids)
    ORDER BY bill.id
    FOR UPDATE;
    SELECT count(*)::integer, count(DISTINCT bill.unit_id)::integer,
      (array_agg(DISTINCT bill.unit_id))[1], coalesce(sum(
        bill.total_paise - bill.paid_paise - bill.waived_paise
      ), 0), bool_and(
        bill.cancelled_at IS NULL
        AND bill.total_paise > bill.paid_paise + bill.waived_paise
      )
      INTO selected_count, expected_count, selected_unit_id, total_paise,
        all_bills_open
    FROM public.billing_bills bill
    WHERE bill.society_id = p_society_id AND bill.id = ANY(p_bill_ids);
    IF selected_count <> cardinality(p_bill_ids)
      OR expected_count <> 1 OR selected_unit_id IS NULL
      OR selected_count IS NULL
    THEN
      RAISE EXCEPTION 'Select open bills from one unit.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT coalesce(all_bills_open, false) THEN
      RAISE EXCEPTION 'Only open bills can be added to a plan.'
        USING ERRCODE = '23514';
    END IF;
    IF total_paise > 9007199254740991 THEN
      RAISE EXCEPTION 'The selected bill total exceeds the supported range.'
        USING ERRCODE = '22023';
    END IF;
    SELECT (now() AT TIME ZONE society.timezone)::date INTO plan_day
    FROM public.societies society WHERE society.id = p_society_id;
    IF p_first_due_date < plan_day THEN
      RAISE EXCEPTION 'The first installment date cannot be before the plan date.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.billing_payment_plans (
      society_id, unit_id, plan_date, down_payment_paise,
      installment_count, first_due_date, remarks, created_by, updated_by
    ) VALUES (
      p_society_id, selected_unit_id, plan_day, p_down_payment_paise,
      p_installment_count, p_first_due_date, nullif(btrim(p_remarks), ''),
      auth.uid(), auth.uid()
    ) RETURNING * INTO saved;
    INSERT INTO public.billing_payment_plan_bills (
      society_id, plan_id, bill_id, unit_id, snapshot_remaining_paise
    )
    SELECT p_society_id, saved.id, bill.id, selected_unit_id,
      bill.total_paise - bill.paid_paise - bill.waived_paise
    FROM public.billing_bills bill
    WHERE bill.society_id = p_society_id AND bill.id = ANY(p_bill_ids)
    ORDER BY bill.id;
  END IF;

  IF total_paise IS NULL OR total_paise <= p_down_payment_paise
    OR total_paise - p_down_payment_paise < p_installment_count
  THEN
    RAISE EXCEPTION 'The down payment and installments must fit the selected bill balance.'
      USING ERRCODE = '23514';
  END IF;
  IF p_first_due_date < plan_day THEN
    RAISE EXCEPTION 'The first installment date cannot be before the plan date.'
      USING ERRCODE = '23514';
  END IF;

  new_values := jsonb_build_object(
    'down_payment_paise', saved.down_payment_paise,
    'installment_count', saved.installment_count,
    'first_due_date', saved.first_due_date,
    'remarks', saved.remarks
  );
  IF p_plan_id IS NULL OR old_values IS DISTINCT FROM new_values THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin',
      CASE WHEN p_plan_id IS NULL
        THEN 'billing.paymentPlan.create'
        ELSE 'billing.paymentPlan.update'
      END,
      'billing_payment_plan', saved.id::text, old_values, new_values,
      p_request_id
    );
  END IF;
  RETURN jsonb_build_object('id', saved.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payment_plan_cancel(
  p_society_id uuid,
  p_plan_id uuid,
  p_reason text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved public.billing_payment_plans;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Administrator billing access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 500
    OR p_request_id IS NULL OR p_request_id = ''
  THEN
    RAISE EXCEPTION 'A cancellation reason is required.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO saved
  FROM public.billing_payment_plans
  WHERE society_id = p_society_id AND id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment plan not found.' USING ERRCODE = 'P0002';
  END IF;
  IF saved.status <> 'active' THEN
    RAISE EXCEPTION 'The payment plan is already cancelled.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.billing_payment_plans
  SET status = 'cancelled', cancelled_at = now(),
      cancelled_by = auth.uid(), cancel_reason = btrim(p_reason),
      updated_at = now(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_plan_id
  RETURNING * INTO saved;
  PERFORM set_config('homeish.billing_payment_plan_mutation', 'on', true);
  UPDATE public.billing_payment_plan_bills
  SET released_at = saved.cancelled_at
  WHERE society_id = p_society_id AND plan_id = p_plan_id
    AND released_at IS NULL;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.paymentPlan.cancel',
    'billing_payment_plan', saved.id::text,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'cancelled'),
    btrim(p_reason), p_request_id
  );
  RETURN jsonb_build_object('id', saved.id, 'status', saved.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_recovery_actions_list(
  p_society_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  admins jsonb;
  today date;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT (now() AT TIME ZONE society.timezone)::date INTO today
  FROM public.societies society WHERE society.id = p_society_id;
  SELECT coalesce(jsonb_agg(to_jsonb(action_row)
    ORDER BY action_row.action_date DESC, action_row.created_at DESC), '[]'::jsonb)
    INTO result
  FROM (
    SELECT action.id, action.unit_id, unit.number AS unit_number,
      action.action_date, action.action_type, action.outcome,
      action.next_action_date, action.assigned_admin_user_id,
      coalesce(profile.full_name, 'Administrator') AS assigned_admin_name,
      action.status,
      CASE
        WHEN action.status = 'closed' THEN 'closed'
        WHEN action.next_action_date < today THEN 'overdue'
        WHEN action.next_action_date <= today + 7 THEN 'due_soon'
        ELSE 'scheduled'
      END AS follow_up_state,
      action.created_at
    FROM public.billing_recovery_actions action
    JOIN public.units unit
      ON unit.society_id = action.society_id AND unit.id = action.unit_id
    LEFT JOIN public.profiles profile
      ON profile.id = action.assigned_admin_user_id
    WHERE action.society_id = p_society_id
  ) action_row;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', membership.user_id,
    'name', coalesce(profile.full_name, 'Administrator')
  ) ORDER BY profile.full_name, membership.user_id), '[]'::jsonb)
    INTO admins
  FROM public.memberships membership
  JOIN public.profiles profile ON profile.id = membership.user_id
  WHERE membership.society_id = p_society_id
    AND membership.status = 'active'
    AND 'admin' = ANY(membership.roles);
  RETURN jsonb_build_object('actions', result, 'admins', admins);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_recovery_action_save(
  p_society_id uuid,
  p_action_id uuid,
  p_unit_id uuid,
  p_action_date date,
  p_action_type text,
  p_outcome text,
  p_next_action_date date,
  p_assigned_admin_user_id uuid,
  p_status text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved public.billing_recovery_actions;
  old_values jsonb;
  new_values jsonb;
  closure_time timestamptz;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Administrator billing access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_unit_id IS NULL OR p_action_date IS NULL
    OR p_action_type NOT IN (
      'phone_call', 'in_person_discussion', 'meeting', 'other_internal'
    )
    OR p_outcome NOT IN (
      'reached', 'no_response', 'follow_up_needed', 'resolved', 'other'
    )
    OR p_next_action_date IS NULL
    OR p_status NOT IN ('open', 'closed')
    OR p_request_id IS NULL OR p_request_id = ''
  THEN
    RAISE EXCEPTION 'Check the recovery-action details.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
  ) THEN
    RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_assigned_admin_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = p_assigned_admin_user_id
      AND membership.status = 'active'
      AND 'admin' = ANY(membership.roles)
  ) THEN
    RAISE EXCEPTION 'Choose an active administrator in this society.'
      USING ERRCODE = '23514';
  END IF;

  IF p_action_id IS NULL THEN
    INSERT INTO public.billing_recovery_actions (
      society_id, unit_id, action_date, action_type, outcome,
      next_action_date, assigned_admin_user_id, status, closed_at,
      created_by, updated_by
    ) VALUES (
      p_society_id, p_unit_id, p_action_date, p_action_type, p_outcome,
      p_next_action_date, p_assigned_admin_user_id, p_status,
      CASE WHEN p_status = 'closed' THEN now() END, auth.uid(), auth.uid()
    ) RETURNING * INTO saved;
  ELSE
    SELECT * INTO saved
    FROM public.billing_recovery_actions
    WHERE society_id = p_society_id AND id = p_action_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recovery action not found.' USING ERRCODE = 'P0002';
    END IF;
    old_values := jsonb_build_object(
      'unit_id', saved.unit_id, 'action_date', saved.action_date,
      'action_type', saved.action_type, 'outcome', saved.outcome,
      'next_action_date', saved.next_action_date,
      'assigned_admin_user_id', saved.assigned_admin_user_id,
      'status', saved.status
    );
    closure_time := CASE
      WHEN p_status = 'closed' THEN coalesce(saved.closed_at, now())
      ELSE NULL
    END;
    UPDATE public.billing_recovery_actions
    SET unit_id = p_unit_id, action_date = p_action_date,
        action_type = p_action_type, outcome = p_outcome,
        next_action_date = p_next_action_date,
        assigned_admin_user_id = p_assigned_admin_user_id,
        status = p_status, closed_at = closure_time,
        updated_at = now(), updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_action_id
    RETURNING * INTO saved;
  END IF;

  new_values := jsonb_build_object(
    'unit_id', saved.unit_id, 'action_date', saved.action_date,
    'action_type', saved.action_type, 'outcome', saved.outcome,
    'next_action_date', saved.next_action_date,
    'assigned_admin_user_id', saved.assigned_admin_user_id,
    'status', saved.status
  );
  IF p_action_id IS NULL OR old_values IS DISTINCT FROM new_values THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin',
      CASE WHEN p_action_id IS NULL
        THEN 'billing.recoveryAction.create'
        ELSE 'billing.recoveryAction.update'
      END,
      'billing_recovery_action', saved.id::text, old_values, new_values,
      p_request_id
    );
  END IF;
  RETURN jsonb_build_object('id', saved.id, 'status', saved.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_collection_efficiency(
  p_society_id uuid,
  p_as_of_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  day_end timestamptz;
  society_timezone text;
  collected numeric;
  billed numeric;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'Choose an as-of date.' USING ERRCODE = '22023';
  END IF;
  SELECT society.timezone INTO society_timezone
  FROM public.societies society WHERE society.id = p_society_id;
  day_end := (
    (p_as_of_date::timestamp + interval '1 day') AT TIME ZONE society_timezone
  );

  SELECT coalesce(sum(least(
    bill.total_paise,
    greatest(bill.total_paise - coalesce(waivers.amount_paise, 0), 0)
  )), 0)
  INTO billed
  FROM public.billing_bills bill
  LEFT JOIN LATERAL (
    SELECT sum(entry.amount_paise) AS amount_paise
    FROM public.billing_ledger_entries entry
    WHERE entry.society_id = bill.society_id
      AND entry.bill_id = bill.id AND entry.kind = 'waiver'
      AND entry.created_at < day_end
  ) waivers ON true
  WHERE bill.society_id = p_society_id AND bill.due_date <= p_as_of_date;

  SELECT coalesce(sum(allocation.amount_paise), 0)
  INTO collected
  FROM public.billing_payment_allocations allocation
  JOIN public.billing_bills bill
    ON bill.society_id = allocation.society_id
    AND bill.id = allocation.bill_id
  JOIN public.billing_payments payment
    ON payment.society_id = allocation.society_id
    AND payment.id = allocation.payment_id
  WHERE allocation.society_id = p_society_id
    AND bill.due_date <= p_as_of_date
    AND payment.status = 'confirmed'
    AND payment.paid_on <= p_as_of_date
    AND payment.confirmed_at < day_end;

  result := jsonb_build_object(
    'as_of_date', p_as_of_date,
    'collected_paise', collected::text,
    'billed_paise', billed::text,
    'collection_percent',
      CASE WHEN billed = 0 THEN NULL
        ELSE round(collected * 100 / billed, 1)
      END
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION private.billing_payment_plan_bill_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_payment_plans_list(uuid),
  public.billing_payment_plan_open_bills(uuid),
  public.billing_payment_plan_save(uuid, uuid, uuid[], bigint, integer, date, text, text),
  public.billing_payment_plan_cancel(uuid, uuid, text, text),
  public.billing_recovery_actions_list(uuid),
  public.billing_recovery_action_save(uuid, uuid, uuid, date, text, text, date, uuid, text, text),
  public.billing_collection_efficiency(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_payment_plans_list(uuid),
  public.billing_payment_plan_open_bills(uuid),
  public.billing_payment_plan_save(uuid, uuid, uuid[], bigint, integer, date, text, text),
  public.billing_payment_plan_cancel(uuid, uuid, text, text),
  public.billing_recovery_actions_list(uuid),
  public.billing_recovery_action_save(uuid, uuid, uuid, date, text, text, date, uuid, text, text),
  public.billing_collection_efficiency(uuid, date)
  TO authenticated;
