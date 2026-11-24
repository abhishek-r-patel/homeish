-- Add opt-in simple annual interest with an acknowledgement gate and immutable bills.
ALTER TABLE public.billing_bills
  DROP CONSTRAINT billing_bills_kind_check,
  DROP CONSTRAINT billing_bills_created_by_check,
  ADD CONSTRAINT billing_bills_kind_check
    CHECK (kind IN ('regular', 'fine', 'late_fee', 'interest')),
  ADD CONSTRAINT billing_bills_created_by_check
    CHECK (created_by IS NOT NULL OR kind IN ('late_fee', 'interest'));

CREATE TABLE public.billing_interest_acknowledgements (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  acknowledged_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  statement_version integer NOT NULL DEFAULT 1 CHECK (statement_version = 1),
  statement text NOT NULL CHECK (
    statement = 'Interest is not legal, tax or accounting advice. Review the rate and treatment with an accountant before live use.'
  )
);

CREATE TABLE public.billing_interest_rates (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('late_fee', 'interest', 'both')),
  rate_basis_points integer
    CHECK (
      rate_basis_points IS NULL
      OR rate_basis_points BETWEEN 1 AND 2400
    ),
  effective_on date NOT NULL,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  UNIQUE (society_id, effective_on),
  UNIQUE (society_id, created_by, client_request_id),
  CHECK (mode = 'late_fee' OR rate_basis_points IS NOT NULL)
);

CREATE INDEX billing_interest_rates_society_effective_idx
  ON public.billing_interest_rates (society_id, effective_on DESC);
CREATE UNIQUE INDEX billing_bills_interest_unit_period_idx
  ON public.billing_bills (society_id, unit_id, period_start)
  WHERE kind = 'interest' AND cancelled_at IS NULL;

ALTER TABLE public.billing_interest_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_interest_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_interest_acknowledgements,
  public.billing_interest_rates
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY billing_interest_acknowledgements_no_direct_access
  ON public.billing_interest_acknowledgements
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY billing_interest_rates_no_direct_access
  ON public.billing_interest_rates
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.billing_interest_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Billing interest history is append-only.'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.billing_interest_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER billing_interest_rates_no_update
  BEFORE UPDATE OR DELETE ON public.billing_interest_rates
  FOR EACH ROW EXECUTE FUNCTION private.billing_interest_guard();
CREATE TRIGGER billing_interest_rates_no_truncate
  BEFORE TRUNCATE ON public.billing_interest_rates
  FOR EACH STATEMENT EXECUTE FUNCTION private.billing_interest_guard();

CREATE FUNCTION public.billing_interest_acknowledge(
  p_society_id uuid, p_request_id text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acknowledged_at timestamptz;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request trace is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT acknowledgement.acknowledged_at INTO acknowledged_at
  FROM public.billing_interest_acknowledgements acknowledgement
  WHERE acknowledgement.society_id = p_society_id;
  IF acknowledged_at IS NOT NULL THEN RETURN acknowledged_at; END IF;
  INSERT INTO public.billing_interest_acknowledgements (
    society_id, acknowledged_by, statement
  ) VALUES (
    p_society_id, auth.uid(),
    'Interest is not legal, tax or accounting advice. Review the rate and treatment with an accountant before live use.'
  ) RETURNING billing_interest_acknowledgements.acknowledged_at
    INTO acknowledged_at;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.interest.acknowledge',
    'billing_interest_acknowledgement', p_society_id::text,
    jsonb_build_object('statement_version', 1), p_request_id
  );
  RETURN acknowledged_at;
END;
$$;

CREATE FUNCTION public.billing_interest_rate_save(
  p_society_id uuid,
  p_mode text,
  p_rate_basis_points integer,
  p_effective_on date,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retry_id uuid;
  saved_id uuid;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_interest_acknowledgements
    WHERE society_id = p_society_id
  ) THEN
    RAISE EXCEPTION 'Acknowledge the interest warning before saving settings.'
      USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('late_fee', 'interest', 'both')
    OR (
      p_mode <> 'late_fee'
      AND (p_rate_basis_points IS NULL
        OR p_rate_basis_points NOT BETWEEN 1 AND 2400)
    )
    OR (p_mode = 'late_fee' AND p_rate_basis_points IS NOT NULL)
    OR p_effective_on IS NULL
    OR p_client_request_id IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a valid interest mode, rate and effective date.'
      USING ERRCODE = '22023';
  END IF;
  SELECT id INTO retry_id
  FROM public.billing_interest_rates
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF retry_id IS NOT NULL THEN RETURN retry_id; END IF;
  INSERT INTO public.billing_interest_rates (
    society_id, mode, rate_basis_points, effective_on,
    client_request_id, created_by
  ) VALUES (
    p_society_id, p_mode, p_rate_basis_points, p_effective_on,
    p_client_request_id, auth.uid()
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.interest.rate.save',
    'billing_interest_rate', saved_id::text,
    jsonb_build_object(
      'mode', p_mode,
      'rate_basis_points', p_rate_basis_points,
      'effective_on', p_effective_on
    ),
    p_request_id
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.billing_interest_settings_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  today date;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  today := private.billing_society_today(p_society_id);
  RETURN jsonb_build_object(
    'acknowledged_at', (
      SELECT acknowledged_at
      FROM public.billing_interest_acknowledgements
      WHERE society_id = p_society_id
    ),
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'current', (
      SELECT jsonb_build_object(
        'id', rate.id,
        'mode', rate.mode,
        'rate_basis_points', rate.rate_basis_points,
        'effective_on', rate.effective_on
      )
      FROM public.billing_interest_rates rate
      WHERE rate.society_id = p_society_id
        AND rate.effective_on <= today
      ORDER BY rate.effective_on DESC, rate.created_at DESC
      LIMIT 1
    ),
    'history', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rate.id,
        'mode', rate.mode,
        'rate_basis_points', rate.rate_basis_points,
        'effective_on', rate.effective_on,
        'created_at', rate.created_at,
        'created_by_name', profile.full_name
      ) ORDER BY rate.effective_on DESC, rate.created_at DESC, rate.id)
      FROM public.billing_interest_rates rate
      JOIN public.profiles profile ON profile.id = rate.created_by
      WHERE rate.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

ALTER FUNCTION public.billing_late_fees_run(uuid, date, text)
  RENAME TO billing_late_fees_run_p38_base;
ALTER FUNCTION public.billing_late_fees_run_p38_base(uuid, date, text)
  SET SCHEMA private;
REVOKE ALL ON FUNCTION private.billing_late_fees_run_p38_base(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.billing_late_fees_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mode text;
BEGIN
  SELECT rate.mode INTO mode
  FROM public.billing_interest_rates rate
  WHERE rate.society_id = p_society_id
    AND rate.effective_on <= p_today
  ORDER BY rate.effective_on DESC, rate.created_at DESC
  LIMIT 1;
  IF mode = 'interest' THEN
    RETURN jsonb_build_object('charged_count', 0, 'total_paise', '0');
  END IF;
  RETURN private.billing_late_fees_run_p38_base(
    p_society_id, p_today, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.billing_late_fees_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_late_fees_run(uuid, date, text)
  TO service_role;

CREATE FUNCTION public.billing_interest_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  period date;
  period_end date;
  grace integer;
  item record;
  unit_item record;
  interest_amount bigint;
  new_bill_id uuid;
  charged_count integer := 0;
  charged_total bigint := 0;
BEGIN
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The interest run is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN jsonb_build_object('charged_count', 0, 'total_paise', '0');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.billing_interest_rates rate
    WHERE rate.society_id = p_society_id
      AND rate.effective_on <= p_today
      AND rate.mode IN ('interest', 'both')
  ) THEN
    RETURN jsonb_build_object('charged_count', 0, 'total_paise', '0');
  END IF;
  period := date_trunc('month', p_today)::date - interval '1 month';
  period_end := period + interval '1 month - 1 day';
  SELECT coalesce((config.settings ->> 'grace_days')::integer, 5)
  INTO grace
  FROM public.module_configs config
  WHERE config.society_id = p_society_id
    AND config.module_key = 'billing';

  FOR unit_item IN
    WITH eligible_days AS (
      SELECT
        bill.unit_id,
        bill.id AS bill_id,
        bill.due_date,
        bill.total_paise - bill.paid_paise - bill.waived_paise AS principal_paise,
        day.day::date
      FROM public.billing_bills bill
      CROSS JOIN LATERAL generate_series(
        greatest(
          period,
          bill.due_date + grace + 1
        )::date,
        period_end,
        interval '1 day'
      ) day(day)
      WHERE bill.society_id = p_society_id
        AND bill.kind = 'regular'
        AND bill.cancelled_at IS NULL
        AND bill.paid_paise + bill.waived_paise < bill.total_paise
        AND bill.due_date >= (
          SELECT min(rate.effective_on)
          FROM public.billing_interest_rates rate
          WHERE rate.society_id = p_society_id
            AND rate.mode IN ('interest', 'both')
        )
        AND bill.due_date + grace < period_end
    ),
    calculated AS (
      SELECT
        days.unit_id,
        days.principal_paise::numeric
          * rate.rate_basis_points::numeric / 10000 / 365 AS daily_interest
      FROM eligible_days days
      JOIN LATERAL (
        SELECT mode, rate_basis_points
        FROM public.billing_interest_rates rate
        WHERE rate.society_id = p_society_id
          AND rate.effective_on <= days.day
        ORDER BY rate.effective_on DESC, rate.created_at DESC
        LIMIT 1
      ) rate ON rate.mode IN ('interest', 'both')
        AND rate.rate_basis_points IS NOT NULL
    )
    SELECT unit_id, round(sum(daily_interest))::bigint AS amount_paise
    FROM calculated
    GROUP BY unit_id
    HAVING round(sum(daily_interest))::bigint > 0
    ORDER BY unit_id
  LOOP
    PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = unit_item.unit_id
    FOR UPDATE;
    interest_amount := unit_item.amount_paise;
    new_bill_id := NULL;
    INSERT INTO public.billing_bills (
      society_id, unit_id, kind, title, period_start, due_date,
      total_paise, created_by
    ) VALUES (
      p_society_id, unit_item.unit_id, 'interest',
      'Interest - ' || to_char(period, 'Mon YYYY'),
      period, p_today, private.billing_checked_amount(interest_amount), NULL
    )
    ON CONFLICT (society_id, unit_id, period_start)
      WHERE kind = 'interest' AND cancelled_at IS NULL
    DO NOTHING
    RETURNING id INTO new_bill_id;
    CONTINUE WHEN new_bill_id IS NULL;
    INSERT INTO public.billing_bill_lines (
      society_id, bill_id, unit_id, period_start, charge_type_id,
      description, amount_paise, created_by
    ) VALUES (
      p_society_id, new_bill_id, unit_item.unit_id, period, NULL,
      'Simple interest at the recorded yearly rates',
      interest_amount, NULL
    );
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
    ) VALUES (
      p_society_id, unit_item.unit_id, 'bill', 'debit', interest_amount,
      new_bill_id, NULL
    );
    PERFORM private.billing_notify_unit(
      p_society_id, unit_item.unit_id, 'billing_interest_added',
      'Interest was added',
      'A separate interest bill is available in Billing for the previous month.',
      'billing_bill', new_bill_id, p_request_id
    );
    charged_count := charged_count + 1;
    charged_total := charged_total + interest_amount;
  END LOOP;
  IF charged_count > 0 THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "after", request_id
    ) VALUES (
      p_society_id, NULL, 'system', 'billing.interest.apply',
      'billing_interest_run', period::text,
      jsonb_build_object(
        'charged_count', charged_count,
        'total_paise', charged_total::text
      ),
      p_request_id
    );
  END IF;
  RETURN jsonb_build_object(
    'charged_count', charged_count,
    'total_paise', charged_total::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.billing_interest_acknowledge(uuid, text),
  public.billing_interest_rate_save(uuid, text, integer, date, uuid, text),
  public.billing_interest_settings_get(uuid),
  public.billing_interest_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_interest_acknowledge(uuid, text),
  public.billing_interest_rate_save(uuid, text, integer, date, uuid, text),
  public.billing_interest_settings_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_interest_run(uuid, date, text)
  TO service_role;
