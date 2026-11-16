-- Committee analytics (D-62): operations metrics for core, billing, expense, service requests, amenities,
-- visitors, deliveries, staff, housekeeping, AMC and notices. Each function returns aggregates only (no people,
-- no unit labels) and is called by public.analytics_dashboard after it has authorised the caller.

-- Builds a monthly trend: one point per month in p_from..p_to; p_data maps 'YYYY-MM' to partial values and
-- p_defaults supplies the value for months or series without data (0 for counts and sums, null for averages).
CREATE FUNCTION private.analytics_ops_trend(
  p_unit text, p_series jsonb, p_from date, p_to date, p_data jsonb, p_defaults jsonb
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'kind', 'trend',
    'unit', p_unit,
    'series', p_series,
    'points', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', month.period,
        'values', p_defaults || COALESCE(p_data -> month.period, '{}'::jsonb)
      ) ORDER BY month.month_start)
      FROM private.analytics_months(p_from, p_to) AS month
    ), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION private.analytics_ops_trend(text, jsonb, date, date, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Builds a ranked breakdown from p_items ([{label, values}]): first series descending, then label; at most 20
-- items. For additive units the remainder is summed into one "Other" item, otherwise it is cut.
CREATE FUNCTION private.analytics_ops_breakdown(p_unit text, p_series jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH ranked AS (
    SELECT item.value AS item, item.value ->> 'label' AS label,
      row_number() OVER (
        ORDER BY (item.value -> 'values' ->> (p_series -> 0 ->> 'key'))::numeric DESC NULLS LAST,
          item.value ->> 'label'
      ) AS position
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item
  ),
  other AS (
    SELECT jsonb_build_object(
      'label', 'Other',
      'values', (
        SELECT jsonb_object_agg(series.value ->> 'key', (
          SELECT COALESCE(sum((ranked.item -> 'values' ->> (series.value ->> 'key'))::numeric), 0)
          FROM ranked WHERE ranked.position > 20
        ))
        FROM jsonb_array_elements(p_series) AS series
      )
    ) AS item
    WHERE p_unit IN ('count', 'paise', 'quantity')
      AND EXISTS (SELECT 1 FROM ranked WHERE ranked.position > 20)
  )
  SELECT jsonb_build_object(
    'kind', 'breakdown',
    'unit', p_unit,
    'series', p_series,
    'items', COALESCE((SELECT jsonb_agg(ranked.item ORDER BY ranked.position) FROM ranked
      WHERE ranked.position <= 20), '[]'::jsonb)
      || COALESCE((SELECT jsonb_agg(other.item) FROM other), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION private.analytics_ops_breakdown(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.analytics_ops_stat(p_unit text, p_series jsonb, p_values jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('kind', 'stat', 'unit', p_unit, 'series', p_series, 'values', p_values)
$$;
REVOKE ALL ON FUNCTION private.analytics_ops_stat(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;


-- ===== Core =====

-- Active units today. Tenant-occupied: an active tenant occupant; owner-occupied: no active tenant but an active
-- owner or family occupant; occupied = both; vacant = active units with neither.
CREATE FUNCTION private.analytics_metric_core_occupancy(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH unit_state AS (
    SELECT
      COALESCE(bool_or(occupant.relationship = 'tenant'), false) AS has_tenant,
      COALESCE(bool_or(occupant.relationship IN ('owner', 'family')), false) AS has_owner
    FROM public.units AS unit
    LEFT JOIN public.unit_occupants AS occupant
      ON occupant.society_id = p_society_id AND occupant.unit_id = unit.id AND occupant.status = 'active'
    WHERE unit.society_id = p_society_id AND unit.active
    GROUP BY unit.id
  )
  SELECT private.analytics_ops_stat('count',
    '[{"key":"occupied","label":"Occupied"},{"key":"vacant","label":"Vacant"},{"key":"owner_occupied","label":"Owner-occupied"},{"key":"tenant_occupied","label":"Tenant-occupied"}]',
    jsonb_build_object(
      'occupied', count(*) FILTER (WHERE has_tenant OR has_owner),
      'vacant', count(*) FILTER (WHERE NOT has_tenant AND NOT has_owner),
      'owner_occupied', count(*) FILTER (WHERE has_owner AND NOT has_tenant),
      'tenant_occupied', count(*) FILTER (WHERE has_tenant)
    ))
  FROM unit_state
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_core_occupancy(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Memberships of signed-up users that are or were active, by month of joined_at (set on activation) or, when
-- missing, created_at; platform developer accounts are excluded.
CREATE FUNCTION private.analytics_metric_core_members_trend(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object('new_members', grouped.total)) INTO v_data
  FROM (
    SELECT to_char(COALESCE(membership.joined_at, membership.created_at) AT TIME ZONE v_tz, 'YYYY-MM') AS period,
      count(*) AS total
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id IS NOT NULL
      AND (membership.joined_at IS NOT NULL OR membership.status = 'active')
      AND COALESCE(membership.joined_at, membership.created_at) >= v_from_ts
      AND COALESCE(membership.joined_at, membership.created_at) < v_to_ts
      AND NOT EXISTS (SELECT 1 FROM public.developers AS developer WHERE developer.user_id = membership.user_id)
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('count', '[{"key":"new_members","label":"New members"}]',
    p_from, p_to, v_data, '{"new_members":0}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_core_members_trend(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Billing =====

-- Outstanding (total - paid - waived) of non-cancelled bills today by days past due date: not due (due today or
-- later), 1-30, 31-60, 61-90 and over 90 days overdue.
CREATE FUNCTION private.analytics_metric_billing_dues_ageing(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH today AS (SELECT private.analytics_today(p_society_id) AS day),
  outstanding AS (
    SELECT today.day - bill.due_date AS overdue_days,
      bill.total_paise - bill.paid_paise - bill.waived_paise AS amount
    FROM public.billing_bills AS bill CROSS JOIN today
    WHERE bill.society_id = p_society_id
      AND bill.cancelled_at IS NULL
      AND bill.paid_paise + bill.waived_paise < bill.total_paise
  )
  SELECT private.analytics_ops_stat('paise',
    '[{"key":"not_due","label":"Not yet due"},{"key":"d0_30","label":"Up to 30 days"},{"key":"d31_60","label":"31–60 days"},{"key":"d61_90","label":"61–90 days"},{"key":"d90_plus","label":"Over 90 days"}]',
    jsonb_build_object(
      'not_due', COALESCE(sum(amount) FILTER (WHERE overdue_days <= 0), 0)::bigint,
      'd0_30', COALESCE(sum(amount) FILTER (WHERE overdue_days BETWEEN 1 AND 30), 0)::bigint,
      'd31_60', COALESCE(sum(amount) FILTER (WHERE overdue_days BETWEEN 31 AND 60), 0)::bigint,
      'd61_90', COALESCE(sum(amount) FILTER (WHERE overdue_days BETWEEN 61 AND 90), 0)::bigint,
      'd90_plus', COALESCE(sum(amount) FILTER (WHERE overdue_days > 90), 0)::bigint
    ))
  FROM outstanding
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_billing_dues_ageing(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Billed: total of non-cancelled bills by bill period month (period_start). Collected: confirmed payments by
-- paid_on month (billing has no payment reversals; rejected and unconfirmed payments are excluded).
CREATE FUNCTION private.analytics_metric_billing_collection_trend(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('paise',
    '[{"key":"billed","label":"Billed"},{"key":"collected","label":"Collected"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(combined.period, jsonb_build_object(
        'billed', combined.billed::bigint, 'collected', combined.collected::bigint))
      FROM (
        SELECT parts.period, sum(parts.billed) AS billed, sum(parts.collected) AS collected
        FROM (
          SELECT to_char(bill.period_start, 'YYYY-MM') AS period, sum(bill.total_paise) AS billed, 0 AS collected
          FROM public.billing_bills AS bill
          WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
            AND bill.period_start >= date_trunc('month', p_from::timestamp)::date AND bill.period_start <= p_to
          GROUP BY 1
          UNION ALL
          SELECT to_char(payment.paid_on, 'YYYY-MM'), 0, sum(payment.amount_paise)
          FROM public.billing_payments AS payment
          WHERE payment.society_id = p_society_id AND payment.status = 'confirmed'
            AND payment.paid_on >= p_from AND payment.paid_on <= p_to
          GROUP BY 1
        ) AS parts
        GROUP BY parts.period
      ) AS combined
    ),
    '{"billed":0,"collected":0}')
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_billing_collection_trend(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Share of non-cancelled bills of each bill period month (period_start) with nothing outstanding today
-- (paid_paise + waived_paise = total_paise); null for months without bills.
CREATE FUNCTION private.analytics_metric_billing_collection_rate(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('percent', '[{"key":"rate","label":"Settled in full"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(grouped.period, jsonb_build_object(
        'rate', private.analytics_percent(grouped.settled, grouped.total)))
      FROM (
        SELECT to_char(bill.period_start, 'YYYY-MM') AS period,
          count(*) FILTER (WHERE bill.paid_paise + bill.waived_paise = bill.total_paise) AS settled,
          count(*) AS total
        FROM public.billing_bills AS bill
        WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
          AND bill.period_start >= date_trunc('month', p_from::timestamp)::date AND bill.period_start <= p_to
        GROUP BY 1
      ) AS grouped
    ),
    '{"rate":null}')
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_billing_collection_rate(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Expense =====

-- Cash/bank book entries by entry_date month, classified like public.expense_report: entries with a category are
-- expense (out adds, reversal in subtracts); all others are income incl. billing collections (in adds, out
-- subtracts). Reversals net in their own month.
CREATE FUNCTION private.analytics_metric_expense_income_vs_expense(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('paise',
    '[{"key":"income","label":"Income"},{"key":"expense","label":"Expense"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(grouped.period, jsonb_build_object(
        'income', grouped.income::bigint, 'expense', grouped.expense::bigint))
      FROM (
        SELECT to_char(entry.entry_date, 'YYYY-MM') AS period,
          COALESCE(sum(CASE entry.direction WHEN 'in' THEN entry.amount_paise ELSE -entry.amount_paise END)
            FILTER (WHERE entry.category_id IS NULL), 0) AS income,
          COALESCE(sum(CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END)
            FILTER (WHERE entry.category_id IS NOT NULL), 0) AS expense
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id AND entry.entry_date >= p_from AND entry.entry_date <= p_to
        GROUP BY 1
      ) AS grouped
    ),
    '{"income":0,"expense":0}')
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_expense_income_vs_expense(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Net expense (out minus reversals) per expense category from book entries dated in the range; categories that
-- net to zero are left out.
CREATE FUNCTION private.analytics_metric_expense_by_category(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_breakdown('paise', '[{"key":"amount","label":"Spent"}]',
    (
      SELECT jsonb_agg(jsonb_build_object('label', category.name,
        'values', jsonb_build_object('amount', totals.amount::bigint)))
      FROM (
        SELECT entry.category_id,
          sum(CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END) AS amount
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id AND entry.category_id IS NOT NULL
          AND entry.entry_date >= p_from AND entry.entry_date <= p_to
        GROUP BY entry.category_id
        HAVING sum(CASE entry.direction WHEN 'out' THEN entry.amount_paise ELSE -entry.amount_paise END) <> 0
      ) AS totals
      JOIN public.expense_categories AS category
        ON category.society_id = p_society_id AND category.id = totals.category_id
    ))
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_expense_by_category(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Service requests =====

-- Requests currently resolved or closed with resolved_at in the month and an SLA due time: within when
-- resolved_at <= sla_due_at, otherwise breached. Requests without an SLA are not counted.
CREATE FUNCTION private.analytics_metric_service_request_sla(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object(
    'within_sla', grouped.within_sla, 'breached', grouped.breached)) INTO v_data
  FROM (
    SELECT to_char(request.resolved_at AT TIME ZONE v_tz, 'YYYY-MM') AS period,
      count(*) FILTER (WHERE request.resolved_at <= request.sla_due_at) AS within_sla,
      count(*) FILTER (WHERE request.resolved_at > request.sla_due_at) AS breached
    FROM public.service_requests AS request
    WHERE request.society_id = p_society_id AND request.sla_due_at IS NOT NULL
      AND request.resolved_at >= v_from_ts AND request.resolved_at < v_to_ts
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('count',
    '[{"key":"within_sla","label":"Within SLA"},{"key":"breached","label":"Breached"}]',
    p_from, p_to, v_data, '{"within_sla":0,"breached":0}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_service_request_sla(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Requests open today (open, assigned, in progress or reopened) per category.
CREATE FUNCTION private.analytics_metric_service_request_open_by_category(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_breakdown('count', '[{"key":"open","label":"Open"}]',
    (
      SELECT jsonb_agg(jsonb_build_object('label', category.name,
        'values', jsonb_build_object('open', totals.total)))
      FROM (
        SELECT request.category_id, count(*) AS total
        FROM public.service_requests AS request
        WHERE request.society_id = p_society_id
          AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
        GROUP BY request.category_id
      ) AS totals
      JOIN public.service_request_categories AS category
        ON category.society_id = p_society_id AND category.id = totals.category_id
    ))
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_service_request_open_by_category(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Average days from created_at to resolved_at for requests currently resolved or closed, by resolved_at month.
CREATE FUNCTION private.analytics_metric_service_request_resolution_time(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object('average_days', grouped.average_days)) INTO v_data
  FROM (
    SELECT to_char(request.resolved_at AT TIME ZONE v_tz, 'YYYY-MM') AS period,
      round((avg(extract(epoch FROM request.resolved_at - request.created_at)) / 86400)::numeric, 1)
        AS average_days
    FROM public.service_requests AS request
    WHERE request.society_id = p_society_id
      AND request.resolved_at >= v_from_ts AND request.resolved_at < v_to_ts
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('days', '[{"key":"average_days","label":"Average days"}]',
    p_from, p_to, v_data, '{"average_days":null}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_service_request_resolution_time(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Amenities =====

-- Confirmed (not cancelled) bookings per amenity whose slot starts in the range.
CREATE FUNCTION private.analytics_metric_amenity_usage(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_items jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_agg(jsonb_build_object('label', amenity.name,
    'values', jsonb_build_object('bookings', totals.total))) INTO v_items
  FROM (
    SELECT booking.amenity_id, count(*) AS total
    FROM public.amenity_bookings AS booking
    WHERE booking.society_id = p_society_id AND booking.status = 'confirmed'
      AND booking.starts_at >= v_from_ts AND booking.starts_at < v_to_ts
    GROUP BY booking.amenity_id
  ) AS totals
  JOIN public.amenities AS amenity ON amenity.society_id = p_society_id AND amenity.id = totals.amenity_id;
  RETURN private.analytics_ops_breakdown('count', '[{"key":"bookings","label":"Bookings"}]', v_items);
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_amenity_usage(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Bookings by slot start month: still confirmed vs cancelled.
CREATE FUNCTION private.analytics_metric_amenity_cancellations(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object(
    'confirmed', grouped.confirmed, 'cancelled', grouped.cancelled)) INTO v_data
  FROM (
    SELECT to_char(booking.starts_at AT TIME ZONE v_tz, 'YYYY-MM') AS period,
      count(*) FILTER (WHERE booking.status = 'confirmed') AS confirmed,
      count(*) FILTER (WHERE booking.status = 'cancelled') AS cancelled
    FROM public.amenity_bookings AS booking
    WHERE booking.society_id = p_society_id
      AND booking.starts_at >= v_from_ts AND booking.starts_at < v_to_ts
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('count',
    '[{"key":"confirmed","label":"Confirmed"},{"key":"cancelled","label":"Cancelled"}]',
    p_from, p_to, v_data, '{"confirmed":0,"cancelled":0}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_amenity_cancellations(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Visitors =====

-- Visitor entries by checked_in_at month (one per entry, not per person).
CREATE FUNCTION private.analytics_metric_visitor_trend(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object('entries', grouped.total)) INTO v_data
  FROM (
    SELECT to_char(entry.checked_in_at AT TIME ZONE v_tz, 'YYYY-MM') AS period, count(*) AS total
    FROM public.visitor_entries AS entry
    WHERE entry.society_id = p_society_id
      AND entry.checked_in_at >= v_from_ts AND entry.checked_in_at < v_to_ts
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('count', '[{"key":"entries","label":"Entries"}]',
    p_from, p_to, v_data, '{"entries":0}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_visitor_trend(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Visitor entries checked in during the range by society-local hour; always 24 items in hour order.
CREATE FUNCTION private.analytics_metric_visitor_peak_hours(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_items jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_agg(jsonb_build_object('label', lpad(slot.hour_of_day::text, 2, '0'),
    'values', jsonb_build_object('entries', COALESCE(grouped.total, 0))) ORDER BY slot.hour_of_day) INTO v_items
  FROM generate_series(0, 23) AS slot (hour_of_day)
  LEFT JOIN (
    SELECT extract(hour FROM entry.checked_in_at AT TIME ZONE v_tz)::integer AS entry_hour, count(*) AS total
    FROM public.visitor_entries AS entry
    WHERE entry.society_id = p_society_id
      AND entry.checked_in_at >= v_from_ts AND entry.checked_in_at < v_to_ts
    GROUP BY 1
  ) AS grouped ON grouped.entry_hour = slot.hour_of_day;
  RETURN jsonb_build_object('kind', 'breakdown', 'unit', 'count',
    'series', '[{"key":"entries","label":"Entries"}]'::jsonb, 'items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_visitor_peak_hours(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Deliveries =====

-- Deliveries logged at the gate (any outcome) by created_at month.
CREATE FUNCTION private.analytics_metric_delivery_trend(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object('received', grouped.total)) INTO v_data
  FROM (
    SELECT to_char(entry.created_at AT TIME ZONE v_tz, 'YYYY-MM') AS period, count(*) AS total
    FROM public.delivery_entries AS entry
    WHERE entry.society_id = p_society_id
      AND entry.created_at >= v_from_ts AND entry.created_at < v_to_ts
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('count', '[{"key":"received","label":"Received"}]',
    p_from, p_to, v_data, '{"received":0}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_delivery_trend(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Parcels left at the gate and not collected now; older_than_3_days: received more than 72 hours ago.
CREATE FUNCTION private.analytics_metric_delivery_uncollected(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_stat('count',
    '[{"key":"waiting","label":"Waiting"},{"key":"older_than_3_days","label":"Older than 3 days"}]',
    jsonb_build_object(
      'waiting', count(*),
      'older_than_3_days', count(*) FILTER (WHERE entry.received_at < clock_timestamp() - interval '3 days')
    ))
  FROM public.delivery_entries AS entry
  WHERE entry.society_id = p_society_id AND entry.status = 'left_at_gate'
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_delivery_uncollected(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Staff =====

-- Society staff shift attendance by attendance_date month: present ÷ (present + absent); approved leave days are
-- not expected days. Domestic staff visits have no expected days and are not counted.
CREATE FUNCTION private.analytics_metric_staff_attendance_rate(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('percent', '[{"key":"rate","label":"Attendance"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(grouped.period, jsonb_build_object(
        'rate', private.analytics_percent(grouped.present, grouped.expected)))
      FROM (
        SELECT to_char(attendance.attendance_date, 'YYYY-MM') AS period,
          count(*) FILTER (WHERE attendance.status = 'present') AS present,
          count(*) FILTER (WHERE attendance.status IN ('present', 'absent')) AS expected
        FROM public.staff_shift_attendance AS attendance
        WHERE attendance.society_id = p_society_id
          AND attendance.attendance_date >= p_from AND attendance.attendance_date <= p_to
        GROUP BY 1
      ) AS grouped
    ),
    '{"rate":null}')
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_staff_attendance_rate(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Staff with status active today per staff type (domestic or society).
CREATE FUNCTION private.analytics_metric_staff_active_by_type(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_breakdown('count', '[{"key":"staff","label":"Staff"}]',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'label', CASE totals.staff_type WHEN 'domestic' THEN 'Domestic staff' ELSE 'Society staff' END,
        'values', jsonb_build_object('staff', totals.total)))
      FROM (
        SELECT staff.staff_type, count(*) AS total
        FROM public.staff_members AS staff
        WHERE staff.society_id = p_society_id AND staff.status = 'active'
        GROUP BY staff.staff_type
      ) AS totals
    ))
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_staff_active_by_type(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Housekeeping =====

-- Total quantity issued ('out' transactions, all items and units of measure) by effective_date month; issues have
-- no recorded cost, so this is a quantity.
CREATE FUNCTION private.analytics_metric_housekeeping_consumption(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('quantity', '[{"key":"issued","label":"Issued"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(grouped.period, jsonb_build_object('issued', grouped.issued))
      FROM (
        SELECT to_char(movement.effective_date, 'YYYY-MM') AS period, round(-sum(movement.quantity), 2) AS issued
        FROM public.housekeeping_transactions AS movement
        WHERE movement.society_id = p_society_id AND movement.kind = 'out'
          AND movement.effective_date >= p_from AND movement.effective_date <= p_to
        GROUP BY 1
      ) AS grouped
    ),
    '{"issued":0}')
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_housekeeping_consumption(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Active items with current stock (sum of all transactions) at or below minimum_stock (low_stock, includes out of
-- stock) and at or below zero (out_of_stock), matching the module's low-stock rule.
CREATE FUNCTION private.analytics_metric_housekeeping_low_stock(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH stock AS (
    SELECT item.minimum_stock, COALESCE(totals.quantity, 0) AS quantity
    FROM public.housekeeping_items AS item
    LEFT JOIN (
      SELECT movement.item_id, sum(movement.quantity) AS quantity
      FROM public.housekeeping_transactions AS movement
      WHERE movement.society_id = p_society_id
      GROUP BY movement.item_id
    ) AS totals ON totals.item_id = item.id
    WHERE item.society_id = p_society_id AND item.active
  )
  SELECT private.analytics_ops_stat('count',
    '[{"key":"low_stock","label":"Low stock"},{"key":"out_of_stock","label":"Out of stock"}]',
    jsonb_build_object(
      'low_stock', count(*) FILTER (WHERE quantity <= minimum_stock),
      'out_of_stock', count(*) FILTER (WHERE quantity <= 0)
    ))
  FROM stock
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_housekeeping_low_stock(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== AMC =====

-- Contracts already started and not yet renewed (no successor) whose end_date is today or within the next 30 / 60
-- days.
CREATE FUNCTION private.analytics_metric_amc_expiring(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH today AS (SELECT private.analytics_today(p_society_id) AS day)
  SELECT private.analytics_ops_stat('count',
    '[{"key":"next_30_days","label":"Next 30 days"},{"key":"next_60_days","label":"Next 60 days"}]',
    jsonb_build_object(
      'next_30_days', count(*) FILTER (WHERE contract.end_date <= today.day + 30),
      'next_60_days', count(*)
    ))
  FROM public.amc_contracts AS contract CROSS JOIN today
  WHERE contract.society_id = p_society_id
    AND contract.start_date <= today.day
    AND contract.end_date >= today.day AND contract.end_date <= today.day + 60
    AND NOT EXISTS (
      SELECT 1 FROM public.amc_contracts AS successor
      WHERE successor.society_id = p_society_id AND successor.predecessor_id = contract.id
    )
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_amc_expiring(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Recorded AMC visits by visit_date month.
CREATE FUNCTION private.analytics_metric_amc_visits(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_ops_trend('count', '[{"key":"completed","label":"Completed"}]',
    p_from, p_to,
    (
      SELECT jsonb_object_agg(grouped.period, jsonb_build_object('completed', grouped.total))
      FROM (
        SELECT to_char(visit.visit_date, 'YYYY-MM') AS period, count(*) AS total
        FROM public.amc_visits AS visit
        WHERE visit.society_id = p_society_id AND visit.visit_date >= p_from AND visit.visit_date <= p_to
        GROUP BY 1
      ) AS grouped
    ),
    '{"completed":0}')
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_amc_visits(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ===== Notices =====

-- Notices published (created) in the month and not withdrawn since.
CREATE FUNCTION private.analytics_metric_notice_published(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object('published', grouped.total)) INTO v_data
  FROM (
    SELECT to_char(notice.created_at AT TIME ZONE v_tz, 'YYYY-MM') AS period, count(*) AS total
    FROM public.notices AS notice
    WHERE notice.society_id = p_society_id AND notice.status = 'published'
      AND notice.created_at >= v_from_ts AND notice.created_at < v_to_ts
    GROUP BY 1
  ) AS grouped;
  RETURN private.analytics_ops_trend('count', '[{"key":"published","label":"Published"}]',
    p_from, p_to, v_data, '{"published":0}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_notice_published(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- Recipients are not stored, so they are approximated by today's audience: active resident memberships (all),
-- those with an active owner occupancy of an active unit (owners) or any active occupancy of an active unit in a
-- targeted block (blocks). Per notice: min(readers, recipients) ÷ recipients; the month's rate is the average over
-- its non-withdrawn notices with at least one recipient.
CREATE FUNCTION private.analytics_metric_notice_read_rate(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tz text := private.analytics_timezone(p_society_id);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_data jsonb;
BEGIN
  SELECT bounds.from_ts, bounds.to_ts INTO v_from_ts, v_to_ts
  FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds;
  WITH notice_rows AS (
    SELECT notice.id, notice.audience, to_char(notice.created_at AT TIME ZONE v_tz, 'YYYY-MM') AS period
    FROM public.notices AS notice
    WHERE notice.society_id = p_society_id AND notice.status = 'published'
      AND notice.created_at >= v_from_ts AND notice.created_at < v_to_ts
  ),
  residents AS (
    SELECT membership.id, membership.user_id
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND membership.roles @> ARRAY['resident']::text[]
  ),
  resident_units AS (
    SELECT DISTINCT resident.user_id, unit.block_id, occupant.relationship
    FROM residents AS resident
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = p_society_id AND occupant.membership_id = resident.id
      AND occupant.status = 'active'
    JOIN public.units AS unit ON unit.society_id = p_society_id AND unit.id = occupant.unit_id AND unit.active
  ),
  per_notice AS (
    SELECT notice_rows.period,
      CASE notice_rows.audience
        WHEN 'all' THEN (SELECT count(*) FROM residents)
        WHEN 'owners' THEN (
          SELECT count(DISTINCT resident_units.user_id) FROM resident_units
          WHERE resident_units.relationship = 'owner'
        )
        ELSE (
          SELECT count(DISTINCT resident_units.user_id)
          FROM resident_units
          JOIN public.notice_blocks AS target
            ON target.society_id = p_society_id AND target.notice_id = notice_rows.id
            AND target.block_id = resident_units.block_id
        )
      END AS recipients,
      (
        SELECT count(*) FROM public.notice_reads AS reading
        WHERE reading.society_id = p_society_id AND reading.notice_id = notice_rows.id
      ) AS readers
    FROM notice_rows
  )
  SELECT jsonb_object_agg(grouped.period, jsonb_build_object('rate', grouped.rate)) INTO v_data
  FROM (
    SELECT per_notice.period,
      round(avg(least(per_notice.readers, per_notice.recipients)::numeric * 100 / per_notice.recipients), 1)
        AS rate
    FROM per_notice
    WHERE per_notice.recipients > 0
    GROUP BY per_notice.period
  ) AS grouped;
  RETURN private.analytics_ops_trend('percent', '[{"key":"rate","label":"Read rate"}]',
    p_from, p_to, v_data, '{"rate":null}');
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_metric_notice_read_rate(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
