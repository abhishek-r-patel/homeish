-- P43.2 monthly collection report and P43.3 admin dues follow-up list.
-- Both are read-only and built live; nothing is stored except audit rows for exports and follow-up views.

-- P43.2: per bill month, Billed (regular, fine and late-fee bills, cancelled bills excluded), Waived and the
-- confirmed payments allocated so far to those bills, using the same paid-and-confirmed rule as P38.4.
CREATE OR REPLACE FUNCTION public.billing_monthly_collection(
  p_society_id uuid,
  p_from_month date,
  p_to_month date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  first_month date;
  last_month date;
  result_rows jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing') THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  first_month := date_trunc('month', p_from_month)::date;
  last_month := date_trunc('month', p_to_month)::date;
  IF first_month IS NULL OR last_month IS NULL OR first_month > last_month
    OR last_month > (first_month + interval '23 months')::date
  THEN
    RAISE EXCEPTION 'Choose up to 24 months.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(month.start, 'YYYY-MM-DD'),
      'bill_count', coalesce(billed.bill_count, 0),
      'billed_paise', coalesce(billed.total, 0)::text,
      'waived_paise', coalesce(billed.waived, 0)::text,
      'net_billed_paise', (coalesce(billed.total, 0) - coalesce(billed.waived, 0))::text,
      'collected_paise', coalesce(collected.amount, 0)::text,
      'collection_percent', CASE
        WHEN coalesce(billed.total, 0) - coalesce(billed.waived, 0) = 0 THEN NULL
        ELSE round(
          coalesce(collected.amount, 0) * 100
            / (billed.total - billed.waived),
          1
        )
      END
    ) ORDER BY month.start), '[]'::jsonb)
  INTO result_rows
  FROM generate_series(first_month, last_month, interval '1 month') AS month_start
  CROSS JOIN LATERAL (SELECT month_start::date AS start) month
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS bill_count,
      sum(bill.total_paise)::numeric AS total,
      sum(bill.waived_paise)::numeric AS waived
    FROM public.billing_bills bill
    WHERE bill.society_id = p_society_id
      AND bill.cancelled_at IS NULL
      AND bill.period_start >= month.start
      AND bill.period_start < (month.start + interval '1 month')::date
  ) billed ON true
  LEFT JOIN LATERAL (
    SELECT sum(allocation.amount_paise)::numeric AS amount
    FROM public.billing_payment_allocations allocation
    JOIN public.billing_bills bill
      ON bill.society_id = allocation.society_id AND bill.id = allocation.bill_id
    JOIN public.billing_payments payment
      ON payment.society_id = allocation.society_id AND payment.id = allocation.payment_id
    WHERE allocation.society_id = p_society_id
      AND payment.status = 'confirmed'
      AND bill.cancelled_at IS NULL
      AND bill.period_start >= month.start
      AND bill.period_start < (month.start + interval '1 month')::date
  ) collected ON true;

  RETURN jsonb_build_object(
    'today', private.billing_society_today(p_society_id),
    'rows', result_rows
  );
END;
$$;

-- Admin-only audit record written before the monthly collection CSV is built.
CREATE OR REPLACE FUNCTION public.billing_monthly_collection_export_record(
  p_society_id uuid,
  p_from_month date,
  p_to_month date,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing') THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin']::text[], false);
  IF p_from_month IS NULL OR p_to_month IS NULL OR p_from_month > p_to_month
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid export.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.monthly_collection.export', 'report', NULL,
    jsonb_build_object(
      'from_month', date_trunc('month', p_from_month)::date,
      'to_month', date_trunc('month', p_to_month)::date
    ),
    p_request_id
  );
END;
$$;

-- P43.3: admin-only dues follow-up list. Every unit with any unpaid amount, its primary active owner or tenant
-- and that person's contact details. Every call is audited as a view or an export (row count only).
CREATE OR REPLACE FUNCTION public.billing_dues_follow_up(
  p_society_id uuid,
  p_purpose text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  today date;
  result_rows jsonb;
  row_total integer;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing') THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin']::text[], false);
  IF p_purpose IS NULL OR p_purpose NOT IN ('view', 'export')
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid request.' USING ERRCODE = '22023';
  END IF;
  today := private.billing_society_today(p_society_id);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', item.unit_id,
      'unit_number', item.unit_number,
      'name', item.full_name,
      'relationship', item.relationship,
      'phone', item.phone,
      'email', item.email,
      'outstanding_paise', item.outstanding::text,
      'oldest_due_date', item.oldest_due,
      'months_overdue', CASE
        WHEN item.oldest_overdue IS NULL THEN 0
        ELSE (
          extract(year FROM age(today, item.oldest_overdue)) * 12
            + extract(month FROM age(today, item.oldest_overdue))
        )::integer
      END,
      'last_payment_on', item.last_paid_on,
      'last_payment_paise', item.last_paid_paise::text,
      'awaiting_confirmation', item.awaiting
    ) ORDER BY item.outstanding DESC, item.unit_number), '[]'::jsonb),
    count(*)::integer
  INTO result_rows, row_total
  FROM (
    SELECT unit.id AS unit_id, unit.number AS unit_number,
      dues.outstanding, dues.oldest_due, dues.oldest_overdue,
      person.full_name, person.relationship, person.phone, person.email,
      last_payment.paid_on AS last_paid_on, last_payment.amount_paise AS last_paid_paise,
      EXISTS (
        SELECT 1 FROM public.billing_payments pending
        WHERE pending.society_id = p_society_id AND pending.unit_id = unit.id
          AND pending.status = 'awaiting_confirmation'
      ) AS awaiting
    FROM (
      SELECT bill.unit_id,
        sum(bill.total_paise - bill.paid_paise - bill.waived_paise)::numeric AS outstanding,
        min(bill.due_date) AS oldest_due,
        min(bill.due_date) FILTER (WHERE bill.due_date < today) AS oldest_overdue
      FROM public.billing_bills bill
      WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
        AND bill.paid_paise + bill.waived_paise < bill.total_paise
      GROUP BY bill.unit_id
    ) dues
    JOIN public.units unit ON unit.society_id = p_society_id AND unit.id = dues.unit_id
    LEFT JOIN LATERAL (
      SELECT profile.full_name, occupant.relationship,
        CASE WHEN profile.status = 'anonymized' THEN NULL ELSE profile.phone END AS phone,
        CASE WHEN profile.status = 'anonymized' THEN NULL ELSE profile.email::text END AS email
      FROM public.unit_occupants occupant
      JOIN public.memberships membership
        ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
      JOIN public.profiles profile ON profile.id = membership.user_id
      WHERE occupant.society_id = p_society_id AND occupant.unit_id = unit.id
        AND occupant.status = 'active' AND occupant.relationship IN ('owner', 'tenant')
      ORDER BY occupant.is_primary DESC, (occupant.relationship = 'owner') DESC, occupant.started_at
      LIMIT 1
    ) person ON true
    LEFT JOIN LATERAL (
      SELECT payment.paid_on, payment.amount_paise
      FROM public.billing_payments payment
      WHERE payment.society_id = p_society_id AND payment.unit_id = unit.id
        AND payment.status = 'confirmed'
      ORDER BY payment.paid_on DESC, payment.confirmed_at DESC
      LIMIT 1
    ) last_payment ON true
  ) item;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE p_purpose WHEN 'view' THEN 'billing.dues_follow_up.view' ELSE 'billing.dues_follow_up.export' END,
    'report', NULL, jsonb_build_object('row_count', row_total), p_request_id
  );

  RETURN jsonb_build_object('today', today, 'rows', result_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.billing_monthly_collection(uuid, date, date),
  public.billing_monthly_collection_export_record(uuid, date, date, text),
  public.billing_dues_follow_up(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_monthly_collection(uuid, date, date),
  public.billing_monthly_collection_export_record(uuid, date, date, text),
  public.billing_dues_follow_up(uuid, text, text)
  TO authenticated;
