CREATE OR REPLACE FUNCTION private.billing_rupees(p_paise numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_paise < 0 THEN '-' ELSE '' END
    || (trunc(abs(p_paise) / 100))::text || '.'
    || lpad((abs(p_paise) % 100)::text, 2, '0')
$$;

CREATE OR REPLACE FUNCTION public.billing_reminders_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings jsonb;
  before_days integer;
  on_due boolean;
  overdue_every integer;
  item record;
  unit_count integer := 0;
  sent integer := 0;
BEGIN
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The reminder run is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN jsonb_build_object('unit_count', 0, 'notification_count', 0);
  END IF;
  SELECT config.settings INTO settings FROM public.module_configs config
    WHERE config.society_id = p_society_id AND config.module_key = 'billing';
  IF settings IS NULL OR NOT private.billing_settings_valid(settings) THEN
    RETURN jsonb_build_object('unit_count', 0, 'notification_count', 0);
  END IF;
  before_days := coalesce((settings #>> '{reminders,before_due_days}')::integer, 3);
  on_due := coalesce((settings #>> '{reminders,on_due}')::boolean, true);
  overdue_every := coalesce(
    (settings #>> '{reminders,overdue_every_days}')::integer, 7
  );
  FOR item IN
    WITH open_bills AS (
      SELECT bill.id, bill.unit_id, bill.due_date,
        bill.total_paise - bill.paid_paise - bill.waived_paise AS outstanding,
        CASE
          WHEN before_days > 0 AND bill.due_date - p_today = before_days
            THEN 'before_due'
          WHEN on_due AND bill.due_date = p_today THEN 'on_due'
          WHEN p_today > bill.due_date
            AND (p_today - bill.due_date) % overdue_every = 0
            THEN 'overdue'
        END AS reminder
      FROM public.billing_bills bill
      WHERE bill.society_id = p_society_id
        AND bill.cancelled_at IS NULL
        AND bill.paid_paise + bill.waived_paise < bill.total_paise
    )
    SELECT open_bills.unit_id, open_bills.reminder,
      sum(open_bills.outstanding) AS outstanding,
      min(open_bills.due_date) AS due_date,
      (array_agg(open_bills.id ORDER BY open_bills.due_date, open_bills.id))[1]
        AS bill_id
    FROM open_bills
    WHERE open_bills.reminder IS NOT NULL
    GROUP BY open_bills.unit_id, open_bills.reminder
    ORDER BY open_bills.unit_id, open_bills.reminder
  LOOP
    unit_count := unit_count + 1;
    sent := sent + private.billing_notify_unit(
      p_society_id, item.unit_id, 'billing_reminder_' || item.reminder,
      CASE item.reminder
        WHEN 'before_due' THEN 'Society dues are due soon'
        WHEN 'on_due' THEN 'Society dues are due today'
        ELSE 'Society dues are overdue'
      END,
      CASE item.reminder
        WHEN 'overdue' THEN 'Rs. ' || private.billing_rupees(item.outstanding)
          || ' was due on ' || to_char(item.due_date, 'DD Mon YYYY')
          || '. Open Billing to pay.'
        ELSE 'Rs. ' || private.billing_rupees(item.outstanding)
          || ' is due on ' || to_char(item.due_date, 'DD Mon YYYY')
          || '. Open Billing to pay.'
      END,
      'billing_bill', item.bill_id, p_request_id
    );
  END LOOP;
  RETURN jsonb_build_object(
    'unit_count', unit_count, 'notification_count', sent
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_stale_payments_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alert_days integer;
  zone text;
  stale_count integer;
  recipient record;
  sent integer := 0;
BEGIN
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The stale payment run is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN jsonb_build_object('stale_count', 0, 'notification_count', 0);
  END IF;
  SELECT coalesce(
      (config.settings->>'pending_confirmation_alert_days')::integer, 3
    ), society.timezone
    INTO alert_days, zone
  FROM public.societies society
  LEFT JOIN public.module_configs config
    ON config.society_id = society.id AND config.module_key = 'billing'
  WHERE society.id = p_society_id;
  -- Alert once, on the day a submission crosses the threshold.
  SELECT count(*)::integer INTO stale_count
  FROM public.billing_payments payment
  WHERE payment.society_id = p_society_id
    AND payment.status = 'awaiting_confirmation'
    AND p_today - (payment.created_at AT TIME ZONE zone)::date = alert_days;
  IF stale_count > 0 THEN
    FOR recipient IN
      SELECT DISTINCT membership.user_id
      FROM public.memberships membership
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND membership.user_id IS NOT NULL
        AND membership.roles && ARRAY['admin']::text[]
      ORDER BY membership.user_id
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient.user_id, 'billing_payments_stale',
        'Payments are waiting for review',
        stale_count::text || CASE WHEN stale_count = 1
          THEN ' payment has' ELSE ' payments have' END
          || ' been awaiting confirmation for ' || alert_days::text
          || ' days. Review them in Billing.',
        'billing_payment_review', NULL, p_request_id
      );
      sent := sent + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object(
    'stale_count', stale_count, 'notification_count', sent
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_dashboard(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  totals record;
  received numeric;
  defaulters jsonb;
  today date;
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
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to
    OR p_to - p_from > 731
  THEN
    RAISE EXCEPTION 'Choose a valid date range.' USING ERRCODE = '22023';
  END IF;
  today := private.billing_society_today(p_society_id);
  SELECT
    coalesce(sum(bill.total_paise), 0) AS billed,
    coalesce(sum(bill.paid_paise), 0) AS collected,
    coalesce(sum(bill.waived_paise), 0) AS waived,
    coalesce(sum(bill.total_paise - bill.paid_paise - bill.waived_paise), 0)
      AS outstanding,
    count(*) AS bill_count
  INTO totals
  FROM public.billing_bills bill
  WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
    AND bill.period_start BETWEEN date_trunc('month', p_from)::date AND p_to;
  SELECT coalesce(sum(payment.amount_paise), 0) INTO received
  FROM public.billing_payments payment
  WHERE payment.society_id = p_society_id AND payment.status = 'confirmed'
    AND payment.paid_on BETWEEN p_from AND p_to;
  SELECT coalesce(jsonb_agg(to_jsonb(item) ORDER BY item.rank), '[]'::jsonb)
    INTO defaulters
  FROM (
    SELECT row_number() OVER (
        ORDER BY sum(bill.total_paise - bill.paid_paise - bill.waived_paise) DESC,
          unit.number
      ) AS rank,
      unit.id AS unit_id, unit.number AS unit_number,
      count(*)::integer AS overdue_bill_count,
      min(bill.due_date) AS oldest_due_date,
      sum(bill.total_paise - bill.paid_paise - bill.waived_paise)::text
        AS overdue_paise
    FROM public.billing_bills bill
    JOIN public.units unit
      ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
    WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
      AND bill.paid_paise + bill.waived_paise < bill.total_paise
      AND bill.due_date < today
    GROUP BY unit.id, unit.number
    ORDER BY rank
    LIMIT 10
  ) item;
  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'bill_count', totals.bill_count,
    'billed_paise', totals.billed::text,
    'collected_paise', totals.collected::text,
    'waived_paise', totals.waived::text,
    'outstanding_paise', totals.outstanding::text,
    'received_paise', received::text,
    'collection_percent', CASE
      WHEN totals.billed - totals.waived > 0
        THEN round(totals.collected * 100 / (totals.billed - totals.waived), 1)
      ELSE NULL
    END,
    'top_defaulters', defaulters
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_report_export(
  p_society_id uuid,
  p_report text,
  p_from date,
  p_to date,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  report_columns jsonb;
  report_rows jsonb;
  row_count integer;
  job_id uuid;
  actor_role text;
  today date;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing report access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_report IS NULL
    OR p_report NOT IN ('dues_by_unit', 'collections', 'defaulters')
    OR p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid report and date range.'
      USING ERRCODE = '22023';
  END IF;
  today := private.billing_society_today(p_society_id);
  actor_role := CASE
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    ELSE 'committee'
  END;
  IF p_report = 'dues_by_unit' THEN
    report_columns := '["Unit","Bills","Billed (Rs.)","Paid (Rs.)","Waived (Rs.)","Outstanding (Rs.)","Oldest unpaid due date"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        item.number, item.bill_count, private.billing_rupees(item.billed),
        private.billing_rupees(item.paid), private.billing_rupees(item.waived),
        private.billing_rupees(item.outstanding), item.oldest_due
      ) ORDER BY item.number), '[]'::jsonb)
      INTO report_rows
    FROM (
      SELECT unit.number, count(*)::integer AS bill_count,
        sum(bill.total_paise) AS billed, sum(bill.paid_paise) AS paid,
        sum(bill.waived_paise) AS waived,
        sum(bill.total_paise - bill.paid_paise - bill.waived_paise) AS outstanding,
        min(bill.due_date) FILTER (
          WHERE bill.paid_paise + bill.waived_paise < bill.total_paise
        )::text AS oldest_due
      FROM public.billing_bills bill
      JOIN public.units unit
        ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
      WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
        AND bill.period_start BETWEEN date_trunc('month', p_from)::date AND p_to
      GROUP BY unit.number
      LIMIT 10000
    ) item;
  ELSIF p_report = 'collections' THEN
    report_columns := '["Receipt","Unit","Paid on","Mode","Reference","Amount (Rs.)","Source","Confirmed at"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        item.receipt_no, item.number, item.paid_on::text, item.mode,
        item.reference, private.billing_rupees(item.amount_paise),
        item.source, item.confirmed_at
      ) ORDER BY item.paid_on, item.receipt_no), '[]'::jsonb)
      INTO report_rows
    FROM (
      SELECT payment.receipt_no, unit.number, payment.paid_on, payment.mode,
        payment.reference, payment.amount_paise, payment.source,
        to_char(
          payment.confirmed_at AT TIME ZONE society.timezone,
          'YYYY-MM-DD HH24:MI'
        ) AS confirmed_at
      FROM public.billing_payments payment
      JOIN public.units unit
        ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
      JOIN public.societies society ON society.id = payment.society_id
      WHERE payment.society_id = p_society_id
        AND payment.status = 'confirmed'
        AND payment.paid_on BETWEEN p_from AND p_to
      ORDER BY payment.paid_on, payment.receipt_no
      LIMIT 10000
    ) item;
  ELSE
    report_columns := '["Unit","Overdue bills","Overdue (Rs.)","Oldest due date","Days overdue"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        item.number, item.bill_count, private.billing_rupees(item.overdue),
        item.oldest_due::text, today - item.oldest_due
      ) ORDER BY item.overdue DESC, item.number), '[]'::jsonb)
      INTO report_rows
    FROM (
      SELECT unit.number, count(*)::integer AS bill_count,
        sum(bill.total_paise - bill.paid_paise - bill.waived_paise) AS overdue,
        min(bill.due_date) AS oldest_due
      FROM public.billing_bills bill
      JOIN public.units unit
        ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
      WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
        AND bill.paid_paise + bill.waived_paise < bill.total_paise
        AND bill.due_date < least(today, p_to + 1)
      GROUP BY unit.number
      LIMIT 10000
    ) item;
  END IF;
  row_count := jsonb_array_length(report_rows);
  INSERT INTO public.jobs (
    society_id, created_by, type, status, progress, summary, finished_at
  ) VALUES (
    p_society_id, auth.uid(), 'export', 'succeeded', 100,
    jsonb_build_object(
      'module', 'billing', 'report', p_report, 'from', p_from, 'to', p_to,
      'row_count', row_count, 'columns', report_columns, 'rows', report_rows
    ), now()
  ) RETURNING id INTO job_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), actor_role, 'billing.reports.export', 'job',
    job_id::text, NULL,
    jsonb_build_object(
      'report', p_report, 'from', p_from, 'to', p_to, 'row_count', row_count
    ), p_request_id
  );
  RETURN jsonb_build_object(
    'job_id', job_id, 'report', p_report, 'row_count', row_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.export_job_get(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  job public.jobs;
BEGIN
  SELECT * INTO job FROM public.jobs WHERE id = p_job_id AND type = 'export';
  IF NOT FOUND
    OR NOT private.is_member(job.society_id)
    OR NOT (
      job.created_by = auth.uid()
      OR private.has_role(job.society_id, ARRAY['admin', 'committee']::text[])
    )
  THEN
    RAISE EXCEPTION 'Export not found.' USING ERRCODE = 'P0002';
  END IF;
  IF job.status <> 'succeeded' THEN
    RAISE EXCEPTION 'This export is not ready.' USING ERRCODE = '23505';
  END IF;
  RETURN jsonb_build_object(
    'id', job.id, 'society_id', job.society_id, 'created_at', job.created_at,
    'summary', job.summary
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_receipt_get(
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
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'payment_id', payment.id,
    'receipt_no', payment.receipt_no,
    'amount_paise', payment.amount_paise,
    'mode', payment.mode,
    'source', payment.source,
    'reference', payment.reference,
    'paid_on', payment.paid_on,
    'confirmed_at', payment.confirmed_at,
    'unit_id', unit.id,
    'unit_number', unit.number,
    'unit_label', society.unit_label,
    'society_name', society.name,
    'society_address', concat_ws(', ', society.address, society.city),
    'timezone', society.timezone,
    'payer_name', CASE WHEN payment.source = 'resident_submitted'
      THEN submitter.full_name ELSE NULL END,
    'confirmed_by_name', confirmer.full_name,
    'allocations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'bill_id', bill.id, 'title', bill.title,
        'period_start', bill.period_start, 'due_date', bill.due_date,
        'amount_paise', allocation.amount_paise
      ) ORDER BY bill.due_date, bill.id)
      FROM public.billing_payment_allocations allocation
      JOIN public.billing_bills bill
        ON bill.society_id = allocation.society_id
        AND bill.id = allocation.bill_id
      WHERE allocation.society_id = payment.society_id
        AND allocation.payment_id = payment.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.billing_payments payment
  JOIN public.units unit
    ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
  JOIN public.societies society ON society.id = payment.society_id
  JOIN public.profiles submitter ON submitter.id = payment.submitted_by
  LEFT JOIN public.profiles confirmer ON confirmer.id = payment.confirmed_by
  WHERE payment.society_id = p_society_id AND payment.id = p_payment_id
    AND payment.status = 'confirmed'
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR (
        private.has_role(p_society_id, ARRAY['resident']::text[])
        AND (
          payment.submitted_by = auth.uid()
          OR private.occupies_unit(payment.unit_id)
        )
      )
    );
  IF result IS NULL THEN
    RAISE EXCEPTION 'Receipt not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_receipt_email_recipients(
  p_society_id uuid, p_payment_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'email', recipient.email, 'name', recipient.full_name
    ) ORDER BY recipient.email), '[]'::jsonb)
  FROM (
    SELECT DISTINCT profile.email::text AS email, profile.full_name
    FROM public.billing_payments payment
    JOIN public.memberships membership
      ON membership.society_id = payment.society_id
      AND membership.status = 'active' AND membership.user_id IS NOT NULL
    JOIN public.profiles profile
      ON profile.id = membership.user_id AND profile.status = 'active'
    WHERE payment.society_id = p_society_id AND payment.id = p_payment_id
      AND payment.status = 'confirmed'
      AND (
        (payment.source = 'resident_submitted'
          AND membership.user_id = payment.submitted_by)
        OR (payment.source = 'admin_recorded' AND EXISTS (
          SELECT 1 FROM public.unit_occupants occupant
          WHERE occupant.society_id = payment.society_id
            AND occupant.unit_id = payment.unit_id
            AND occupant.membership_id = membership.id
            AND occupant.status = 'active'
        ))
      )
    LIMIT 5
  ) recipient
$$;

REVOKE ALL ON FUNCTION private.billing_rupees(numeric)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_reminders_run(uuid, date, text),
  public.billing_stale_payments_run(uuid, date, text),
  public.billing_dashboard(uuid, date, date),
  public.billing_report_export(uuid, text, date, date, text),
  public.export_job_get(uuid),
  public.billing_receipt_get(uuid, uuid),
  public.billing_receipt_email_recipients(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_dashboard(uuid, date, date),
  public.billing_report_export(uuid, text, date, date, text),
  public.export_job_get(uuid),
  public.billing_receipt_get(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_reminders_run(uuid, date, text),
  public.billing_stale_payments_run(uuid, date, text),
  public.billing_receipt_email_recipients(uuid, uuid)
  TO service_role;
