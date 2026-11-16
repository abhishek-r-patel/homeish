-- Utility Metering hook into monthly bill generation (owner decision, PRD D-56).
-- billing_bills_generate below is copied exactly from its latest definition
-- (20261110190000_billing_bills_ledger.sql) with these additions only: when Utility Metering is enabled,
-- the same run bills pending utility charges for the generated units with readings up to the earlier of
-- today and the period's last day, as separate "Utility charges" bills, and writes a
-- metering.billing.generate audit row when it bills or closes charges. The job summary and the
-- billing.bills.generate audit row gain utility: {bills, charges, has_more} (null when Utility Metering
-- is off). metering_billing_post locks each
-- unit before its charges and only bills pending charges, so generation and the manual catch-up run never
-- bill a reading twice. It returns at once when there is nothing to bill. Privileges are unchanged by
-- CREATE OR REPLACE.
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
  utility jsonb;
  utility_summary jsonb;
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
  IF private.module_enabled(p_society_id, 'metering') THEN
    utility := private.metering_billing_post(p_society_id, LEAST(private.metering_today(p_society_id), (p_period_start + interval '1 month' - interval '1 day')::date), request_id, p_period_start, p_unit_ids);
    utility_summary := jsonb_build_object('bills', utility->'bills_created', 'charges', utility->'charges_billed', 'has_more', utility->'has_more');
    IF (utility->>'bills_created')::integer > 0 OR (utility->>'charges_no_charge')::integer > 0 THEN
      PERFORM private.metering_audit(p_society_id, 'admin', 'billing.generate', 'module', NULL,
        utility || jsonb_build_object('period_start', p_period_start, 'billing_job_id', job_id), request_id);
    END IF;
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
          'total_paise', new_total::text,
          'utility', utility_summary
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
      'total_paise', new_total::text,
      'utility', utility_summary
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
