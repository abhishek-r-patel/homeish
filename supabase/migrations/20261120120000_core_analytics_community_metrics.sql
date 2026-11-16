-- Committee analytics (D-62): community metrics for directory, tenancy, document, parking, SOS, vendor, patrol,
-- metering, asset, home services, poll and meeting. Each function is called only by public.analytics_dashboard
-- after it has checked the caller, returns totals and buckets only, and reads one society's rows.

-- Shapes a trend: one point per month of p_from..p_to, filled from p_rows ({"YYYY-MM": {series: value}}).
-- Missing values are 0 for additive units and null for averages and percentages.
CREATE FUNCTION private.analytics_community_trend(
  p_from date, p_to date, p_unit text, p_series jsonb, p_rows jsonb
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'kind', 'trend',
    'unit', p_unit,
    'series', p_series,
    'points', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', month.period,
        'values', (
          SELECT jsonb_object_agg(
            series.value ->> 'key',
            COALESCE(
              p_rows -> month.period -> (series.value ->> 'key'),
              CASE WHEN p_unit IN ('count', 'paise', 'quantity') THEN to_jsonb(0) ELSE 'null'::jsonb END
            )
          )
          FROM jsonb_array_elements(p_series) AS series
        )
      ) ORDER BY month.month_start)
      FROM private.analytics_months(p_from, p_to) AS month
    ), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION private.analytics_community_trend(date, date, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Shapes a breakdown from p_items ([{label, values}]): sorted by the first series value descending, then label;
-- at most 20 items, the rest summed into "Other" for additive units or dropped otherwise.
CREATE FUNCTION private.analytics_community_breakdown(p_unit text, p_series jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH ranked AS (
    SELECT item.value AS item,
      row_number() OVER (
        ORDER BY (item.value -> 'values' ->> (p_series -> 0 ->> 'key'))::numeric DESC NULLS LAST,
          item.value ->> 'label'
      ) AS position
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item
  ),
  rest AS (
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
    WHERE p_unit IN ('count', 'paise', 'quantity') AND EXISTS (SELECT 1 FROM ranked WHERE position > 20)
  )
  SELECT jsonb_build_object(
    'kind', 'breakdown',
    'unit', p_unit,
    'series', p_series,
    'items', COALESCE(
      (SELECT jsonb_agg(ranked.item ORDER BY ranked.position) FROM ranked WHERE ranked.position <= 20),
      '[]'::jsonb
    ) || COALESCE((SELECT jsonb_agg(rest.item) FROM rest), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION private.analytics_community_breakdown(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Shapes a stat snapshot.
CREATE FUNCTION private.analytics_community_stat(p_unit text, p_series jsonb, p_values jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('kind', 'stat', 'unit', p_unit, 'series', p_series, 'values', p_values)
$$;
REVOKE ALL ON FUNCTION private.analytics_community_stat(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Plain-word label for a home-services provider type.
CREATE FUNCTION private.analytics_community_service_type(p_service_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_service_type WHEN 'plumber' THEN 'Plumber' WHEN 'electrician' THEN 'Electrician'
    WHEN 'carpenter' THEN 'Carpenter' WHEN 'painter' THEN 'Painter' WHEN 'pest_control' THEN 'Pest control'
    WHEN 'appliance_repair' THEN 'Appliance repair' WHEN 'cleaning' THEN 'Cleaning' ELSE 'Other service' END
$$;
REVOKE ALL ON FUNCTION private.analytics_community_service_type(text) FROM PUBLIC, anon, authenticated, service_role;

-- Directory: active vehicles today by vehicle type.
CREATE FUNCTION private.analytics_metric_directory_vehicles(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_breakdown('count', '[{"key":"vehicles","label":"Vehicles"}]',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', CASE grouped.vehicle_type WHEN 'car' THEN 'Car' WHEN 'two_wheeler' THEN 'Two-wheeler'
          ELSE 'Other vehicle' END,
        'values', jsonb_build_object('vehicles', grouped.total)
      ))
      FROM (
        SELECT vehicle.vehicle_type, count(*) AS total
        FROM public.directory_vehicles AS vehicle
        WHERE vehicle.society_id = p_society_id AND vehicle.status = 'active'
        GROUP BY vehicle.vehicle_type
      ) AS grouped
    ), '[]'::jsonb))
$$;

-- Directory: active vehicles not yet verified by the society today.
CREATE FUNCTION private.analytics_metric_directory_pending_verification(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_stat('count', '[{"key":"pending","label":"Awaiting verification"}]',
    jsonb_build_object('pending', (
      SELECT count(*) FROM public.directory_vehicles AS vehicle
      WHERE vehicle.society_id = p_society_id AND vehicle.status = 'active' AND vehicle.verified_at IS NULL
    )))
$$;

-- Tenancy: moves completed per society-local month of completed_at, split by move-in and move-out.
CREATE FUNCTION private.analytics_metric_tenancy_moves(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', move.completed_at AT TIME ZONE settings.tz) AS month,
      count(*) FILTER (WHERE move.kind = 'move_in') AS move_ins,
      count(*) FILTER (WHERE move.kind = 'move_out') AS move_outs
    FROM settings
    JOIN public.tenancy_moves AS move
      ON move.society_id = p_society_id AND move.status = 'completed'
      AND move.completed_at >= settings.from_ts AND move.completed_at < settings.to_ts
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count',
    '[{"key":"move_ins","label":"Move-ins"},{"key":"move_outs","label":"Move-outs"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('move_ins', grouped.move_ins, 'move_outs', grouped.move_outs)) FROM grouped), '{}'::jsonb))
$$;

-- Tenancy: move requests not yet decided today (awaiting the owner's consent or the society's review).
CREATE FUNCTION private.analytics_metric_tenancy_pending(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_stat('count', '[{"key":"pending","label":"Awaiting decision"}]',
    jsonb_build_object('pending', (
      SELECT count(*) FROM public.tenancy_moves AS move
      WHERE move.society_id = p_society_id AND move.status IN ('awaiting_consent', 'pending_review')
    )))
$$;

-- Document: documents created (published with their first version) per society-local month, archived or not.
CREATE FUNCTION private.analytics_metric_document_published(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', document.created_at AT TIME ZONE settings.tz) AS month, count(*) AS published
    FROM settings
    JOIN public.documents AS document
      ON document.society_id = p_society_id
      AND document.created_at >= settings.from_ts AND document.created_at < settings.to_ts
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count', '[{"key":"published","label":"Published"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('published', grouped.published)) FROM grouped), '{}'::jsonb))
$$;

-- Document: download links issued per society-local month (audit action document.download).
CREATE FUNCTION private.analytics_metric_document_downloads(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', audit.created_at AT TIME ZONE settings.tz) AS month, count(*) AS downloads
    FROM settings
    JOIN public.audit_logs AS audit
      ON audit.society_id = p_society_id AND audit.action = 'document.download'
      AND audit.created_at >= settings.from_ts AND audit.created_at < settings.to_ts
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count', '[{"key":"downloads","label":"Downloads"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('downloads', grouped.downloads)) FROM grouped), '{}'::jsonb))
$$;

-- Parking: unarchived resident slots (visitor slots are never allocated) today, allocated when an
-- allocation is open on the slot.
CREATE FUNCTION private.analytics_metric_parking_occupancy(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_stat('count',
    '[{"key":"allocated","label":"Allocated"},{"key":"free","label":"Free"}]',
    jsonb_build_object('allocated', counted.allocated, 'free', counted.total - counted.allocated))
  FROM (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.parking_allocations AS allocation
        WHERE allocation.society_id = p_society_id AND allocation.slot_id = slot.id
          AND allocation.ended_at IS NULL
      )) AS allocated
    FROM public.parking_slots AS slot
    WHERE slot.society_id = p_society_id AND slot.archived_at IS NULL AND slot.slot_type <> 'visitor'
  ) AS counted
$$;

-- Parking: wrong-parking reports raised (by created_at) and resolved (by resolved_at) per society-local month.
CREATE FUNCTION private.analytics_metric_parking_reports(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  events AS (
    SELECT date_trunc('month', report.created_at AT TIME ZONE settings.tz) AS month, 'raised' AS kind
    FROM settings
    JOIN public.parking_reports AS report
      ON report.society_id = p_society_id
      AND report.created_at >= settings.from_ts AND report.created_at < settings.to_ts
    UNION ALL
    SELECT date_trunc('month', report.resolved_at AT TIME ZONE settings.tz), 'resolved'
    FROM settings
    JOIN public.parking_reports AS report
      ON report.society_id = p_society_id AND report.status = 'resolved'
      AND report.resolved_at >= settings.from_ts AND report.resolved_at < settings.to_ts
  ),
  grouped AS (
    SELECT events.month, count(*) FILTER (WHERE events.kind = 'raised') AS raised,
      count(*) FILTER (WHERE events.kind = 'resolved') AS resolved
    FROM events GROUP BY events.month
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count',
    '[{"key":"raised","label":"Raised"},{"key":"resolved","label":"Resolved"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('raised', grouped.raised, 'resolved', grouped.resolved)) FROM grouped), '{}'::jsonb))
$$;

-- SOS: alerts raised per society-local month, excluding alerts closed as a test and alerts the raiser
-- cancelled as raised by mistake.
CREATE FUNCTION private.analytics_metric_sos_alerts(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', alert.raised_at AT TIME ZONE settings.tz) AS month, count(*) AS alerts
    FROM settings
    JOIN public.sos_alerts AS alert
      ON alert.society_id = p_society_id
      AND alert.raised_at >= settings.from_ts AND alert.raised_at < settings.to_ts
      AND COALESCE(alert.close_reason, '') NOT IN ('test', 'raised_by_mistake')
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count', '[{"key":"alerts","label":"Alerts"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('alerts', grouped.alerts)) FROM grouped), '{}'::jsonb))
$$;

-- SOS: average minutes from raised_at to the alert's first acknowledgement (acknowledged_at), for the same
-- alerts as sos.alerts, by month raised; null when no alert in the month was acknowledged.
CREATE FUNCTION private.analytics_metric_sos_response_time(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', alert.raised_at AT TIME ZONE settings.tz) AS month,
      round((avg(extract(epoch FROM alert.acknowledged_at - alert.raised_at)) / 60)::numeric, 1) AS average_minutes
    FROM settings
    JOIN public.sos_alerts AS alert
      ON alert.society_id = p_society_id
      AND alert.raised_at >= settings.from_ts AND alert.raised_at < settings.to_ts
      AND COALESCE(alert.close_reason, '') NOT IN ('test', 'raised_by_mistake')
      AND alert.acknowledged_at IS NOT NULL
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'minutes',
    '[{"key":"average_minutes","label":"Average response"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('average_minutes', grouped.average_minutes)) FROM grouped), '{}'::jsonb))
$$;

-- Vendor: purchase requests created in the range, by their current status.
CREATE FUNCTION private.analytics_metric_vendor_requests(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT bounds.from_ts, bounds.to_ts FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  )
  SELECT private.analytics_community_breakdown('count', '[{"key":"requests","label":"Requests"}]',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', CASE grouped.status WHEN 'draft' THEN 'Draft' WHEN 'submitted' THEN 'Awaiting approval'
          WHEN 'approved' THEN 'Approved' WHEN 'rejected' THEN 'Rejected' ELSE 'Cancelled' END,
        'values', jsonb_build_object('requests', grouped.total)
      ))
      FROM (
        SELECT request.status, count(*) AS total
        FROM settings
        JOIN public.vendor_purchase_requests AS request
          ON request.society_id = p_society_id
          AND request.created_at >= settings.from_ts AND request.created_at < settings.to_ts
        GROUP BY request.status
      ) AS grouped
    ), '[]'::jsonb))
$$;

-- Vendor: selected-quote amount of purchase requests approved (status approved, by decided_at) per month.
CREATE FUNCTION private.analytics_metric_vendor_approved_spend(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', request.decided_at AT TIME ZONE settings.tz) AS month,
      sum(quote.amount_paise) AS approved
    FROM settings
    JOIN public.vendor_purchase_requests AS request
      ON request.society_id = p_society_id AND request.status = 'approved'
      AND request.decided_at >= settings.from_ts AND request.decided_at < settings.to_ts
    JOIN public.vendor_quotes AS quote
      ON quote.society_id = p_society_id AND quote.id = request.selected_quote_id
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'paise', '[{"key":"approved","label":"Approved"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('approved', grouped.approved)) FROM grouped), '{}'::jsonb))
$$;

-- Patrol: per round window (active schedules, windows starting in the month at or after effective_from, deadline
-- = window end + grace already passed) and per active checkpoint included before the window started: scanned
-- when any scan of that checkpoint falls in [window start, deadline), otherwise missed. Unlike the screen's
-- greedy matching, one scan inside two overlapping grace periods counts for both windows.
CREATE FUNCTION private.analytics_metric_patrol_completion(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts, clock_timestamp() AS now_at
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  schedules AS MATERIALIZED (
    SELECT schedule.id, schedule.shift_start, schedule.effective_from,
      make_interval(mins => schedule.interval_minutes) AS step,
      make_interval(mins => schedule.grace_minutes) AS grace,
      make_interval(mins => private.patrol_shift_minutes(schedule.shift_start, schedule.shift_end)) AS length
    FROM public.patrol_schedules AS schedule
    WHERE schedule.society_id = p_society_id AND schedule.active
  ),
  windows AS MATERIALIZED (
    SELECT schedule.id AS schedule_id, round.round_start,
      date_trunc('month', round.round_start AT TIME ZONE settings.tz) AS month,
      least(round.round_start + schedule.step, shift.shift_end) + schedule.grace AS deadline
    FROM settings
    CROSS JOIN schedules AS schedule
    CROSS JOIN LATERAL generate_series((p_from - 1)::timestamp, p_to::timestamp, interval '1 day') AS local_day (day)
    CROSS JOIN LATERAL (
      SELECT (local_day.day + schedule.shift_start) AT TIME ZONE settings.tz AS shift_start,
        (local_day.day + schedule.shift_start + schedule.length) AT TIME ZONE settings.tz AS shift_end
    ) AS shift
    CROSS JOIN LATERAL generate_series(shift.shift_start, shift.shift_end - interval '1 microsecond', schedule.step)
      AS round (round_start)
    WHERE round.round_start >= schedule.effective_from
      AND round.round_start >= settings.from_ts AND round.round_start < settings.to_ts
      AND least(round.round_start + schedule.step, shift.shift_end) + schedule.grace <= settings.now_at
  ),
  checks AS MATERIALIZED (
    SELECT window_row.month,
      EXISTS (
        SELECT 1 FROM public.patrol_scans AS scan
        WHERE scan.society_id = p_society_id AND scan.checkpoint_id = link.checkpoint_id
          AND scan.scanned_at >= window_row.round_start AND scan.scanned_at < window_row.deadline
      ) AS scanned
    FROM windows AS window_row
    JOIN public.patrol_schedule_checkpoints AS link
      ON link.society_id = p_society_id AND link.schedule_id = window_row.schedule_id
      AND link.created_at <= window_row.round_start
    JOIN public.patrol_checkpoints AS checkpoint
      ON checkpoint.society_id = p_society_id AND checkpoint.id = link.checkpoint_id AND checkpoint.active
  ),
  grouped AS (
    SELECT checks.month, count(*) FILTER (WHERE checks.scanned) AS scanned,
      count(*) FILTER (WHERE NOT checks.scanned) AS missed
    FROM checks GROUP BY checks.month
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count',
    '[{"key":"scanned","label":"Scanned"},{"key":"missed","label":"Missed"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('scanned', grouped.scanned, 'missed', grouped.missed)) FROM grouped), '{}'::jsonb))
$$;

-- Patrol: incidents reported per society-local month of created_at, one series per fixed severity.
CREATE FUNCTION private.analytics_metric_patrol_incidents(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', incident.created_at AT TIME ZONE settings.tz) AS month,
      count(*) FILTER (WHERE incident.severity = 'low') AS low,
      count(*) FILTER (WHERE incident.severity = 'medium') AS medium,
      count(*) FILTER (WHERE incident.severity = 'high') AS high,
      count(*) FILTER (WHERE incident.severity = 'critical') AS critical
    FROM settings
    JOIN public.patrol_incidents AS incident
      ON incident.society_id = p_society_id
      AND incident.created_at >= settings.from_ts AND incident.created_at < settings.to_ts
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count',
    '[{"key":"low","label":"Low"},{"key":"medium","label":"Medium"},{"key":"high","label":"High"},{"key":"critical","label":"Critical"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'), jsonb_build_object(
      'low', grouped.low, 'medium', grouped.medium, 'high', grouped.high, 'critical', grouped.critical
    )) FROM grouped), '{}'::jsonb))
$$;

-- Metering: total consumption of approved readings dated in the range, by meter type (each type in its own
-- physical unit; resets consume 0).
CREATE FUNCTION private.analytics_metric_metering_consumption(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_breakdown('quantity', '[{"key":"consumption","label":"Consumption"}]',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', CASE grouped.meter_type WHEN 'water' THEN 'Water' WHEN 'electricity' THEN 'Electricity'
          WHEN 'dg' THEN 'Diesel generator' ELSE 'Gas' END,
        'values', jsonb_build_object('consumption', round(grouped.total, 2))
      ))
      FROM (
        SELECT meter.meter_type, sum(reading.consumption) AS total
        FROM public.metering_readings AS reading
        JOIN public.metering_meters AS meter
          ON meter.society_id = p_society_id AND meter.id = reading.meter_id
        WHERE reading.society_id = p_society_id AND reading.status = 'approved'
          AND reading.reading_date >= p_from AND reading.reading_date <= p_to
        GROUP BY meter.meter_type
      ) AS grouped
    ), '[]'::jsonb))
$$;

-- Metering: readings submitted by residents still awaiting review today.
CREATE FUNCTION private.analytics_metric_metering_pending_readings(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_stat('count', '[{"key":"pending","label":"Awaiting approval"}]',
    jsonb_build_object('pending', (
      SELECT count(*) FROM public.metering_readings AS reading
      WHERE reading.society_id = p_society_id AND reading.status = 'pending' AND reading.source = 'resident'
    )))
$$;

-- Asset: assets in service today (status active or under repair; retired excluded) by category name.
CREATE FUNCTION private.analytics_metric_asset_by_category(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_breakdown('count', '[{"key":"assets","label":"Assets"}]',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', grouped.name,
        'values', jsonb_build_object('assets', grouped.total)))
      FROM (
        SELECT category.name, count(*) AS total
        FROM public.assets AS asset
        JOIN public.asset_categories AS category
          ON category.society_id = p_society_id AND category.id = asset.category_id
        WHERE asset.society_id = p_society_id AND asset.status <> 'retired'
        GROUP BY category.id, category.name
      ) AS grouped
    ), '[]'::jsonb))
$$;

-- Asset: in-service assets whose warranty ends between today and today + 30 / + 90 days (90 includes 30).
CREATE FUNCTION private.analytics_metric_asset_warranty_expiring(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_stat('count',
    '[{"key":"next_30_days","label":"Next 30 days"},{"key":"next_90_days","label":"Next 90 days"}]',
    jsonb_build_object('next_30_days', counted.next_30_days, 'next_90_days', counted.next_90_days))
  FROM (
    SELECT count(*) FILTER (WHERE asset.warranty_end_date <= today.day + 30) AS next_30_days,
      count(*) AS next_90_days
    FROM (SELECT private.analytics_today(p_society_id) AS day) AS today
    JOIN public.assets AS asset
      ON asset.society_id = p_society_id AND asset.status <> 'retired'
      AND asset.warranty_end_date >= today.day AND asset.warranty_end_date <= today.day + 90
  ) AS counted
$$;

-- Home services: providers residents can see today (approved and not archived) by service type.
CREATE FUNCTION private.analytics_metric_home_services_providers(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_breakdown('count', '[{"key":"providers","label":"Providers"}]',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', private.analytics_community_service_type(grouped.service_type),
        'values', jsonb_build_object('providers', grouped.total)))
      FROM (
        SELECT provider.service_type, count(*) AS total
        FROM public.home_services_providers AS provider
        WHERE provider.society_id = p_society_id AND provider.status = 'approved'
          AND provider.archived_at IS NULL
        GROUP BY provider.service_type
      ) AS grouped
    ), '[]'::jsonb))
$$;

-- Home services: average stars (1 decimal) and number of ratings per service type, over every rating of a
-- visible provider (hiding a comment never hides its stars). Unit is rating; the "ratings" series is a count.
CREATE FUNCTION private.analytics_metric_home_services_ratings(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_breakdown('rating',
    '[{"key":"average","label":"Average rating"},{"key":"ratings","label":"Ratings"}]',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', private.analytics_community_service_type(grouped.service_type),
        'values', jsonb_build_object('average', grouped.average, 'ratings', grouped.total)))
      FROM (
        SELECT provider.service_type, round(avg(rating.stars), 1) AS average, count(*) AS total
        FROM public.home_services_providers AS provider
        JOIN public.home_services_ratings AS rating
          ON rating.society_id = p_society_id AND rating.provider_id = provider.id
        WHERE provider.society_id = p_society_id AND provider.status = 'approved'
          AND provider.archived_at IS NULL
        GROUP BY provider.service_type
      ) AS grouped
    ), '[]'::jsonb))
$$;

-- Poll: votes completed (status completed, by completed_at) per society-local month; drafts and cancelled
-- votes never complete.
CREATE FUNCTION private.analytics_metric_poll_completed(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', vote.completed_at AT TIME ZONE settings.tz) AS month, count(*) AS completed
    FROM settings
    JOIN public.poll_votes AS vote
      ON vote.society_id = p_society_id AND vote.status = 'completed'
      AND vote.completed_at >= settings.from_ts AND vote.completed_at < settings.to_ts
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count', '[{"key":"completed","label":"Completed"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('completed', grouped.completed)) FROM grouped), '{}'::jsonb))
$$;

-- Poll: average over votes completed in the month of final_submitted_count / final_eligible_count (units that
-- took part / units entitled to vote); votes with no eligible units are skipped; null when none.
CREATE FUNCTION private.analytics_metric_poll_turnout(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', vote.completed_at AT TIME ZONE settings.tz) AS month,
      round(avg(vote.final_submitted_count::numeric / vote.final_eligible_count) * 100, 1) AS turnout
    FROM settings
    JOIN public.poll_votes AS vote
      ON vote.society_id = p_society_id AND vote.status = 'completed'
      AND vote.completed_at >= settings.from_ts AND vote.completed_at < settings.to_ts
      AND vote.final_eligible_count > 0
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'percent', '[{"key":"turnout","label":"Turnout"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('turnout', grouped.turnout)) FROM grouped), '{}'::jsonb))
$$;

-- Meeting: meetings marked held, by society-local month of starts_at, one series per meeting type.
CREATE FUNCTION private.analytics_metric_meeting_held(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  grouped AS (
    SELECT date_trunc('month', meeting.starts_at AT TIME ZONE settings.tz) AS month,
      count(*) FILTER (WHERE meeting.meeting_type = 'agm') AS agm,
      count(*) FILTER (WHERE meeting.meeting_type = 'sgm') AS sgm,
      count(*) FILTER (WHERE meeting.meeting_type = 'committee') AS committee
    FROM settings
    JOIN public.meetings AS meeting
      ON meeting.society_id = p_society_id AND meeting.status = 'held'
      AND meeting.starts_at >= settings.from_ts AND meeting.starts_at < settings.to_ts
    GROUP BY 1
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'count',
    '[{"key":"agm","label":"AGM"},{"key":"sgm","label":"SGM"},{"key":"committee","label":"Committee"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('agm', grouped.agm, 'sgm', grouped.sgm, 'committee', grouped.committee)) FROM grouped),
      '{}'::jsonb))
$$;

-- Meeting: average over held meetings (by starts_at month) of present / invited, counted as the module's quorum
-- does: committee meetings by invited members, AGM and SGM by invited units; meetings with no invitees skipped.
CREATE FUNCTION private.analytics_metric_meeting_attendance(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH settings AS (
    SELECT private.analytics_timezone(p_society_id) AS tz, bounds.from_ts, bounds.to_ts
    FROM private.analytics_bounds(p_society_id, p_from, p_to) AS bounds
  ),
  rates AS (
    SELECT date_trunc('month', meeting.starts_at AT TIME ZONE settings.tz) AS month,
      counted.present::numeric / counted.invited AS rate
    FROM settings
    JOIN public.meetings AS meeting
      ON meeting.society_id = p_society_id AND meeting.status = 'held'
      AND meeting.starts_at >= settings.from_ts AND meeting.starts_at < settings.to_ts
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN meeting.meeting_type = 'committee' THEN (
          SELECT count(*) FROM public.meeting_invited_members AS invited
          WHERE invited.society_id = p_society_id AND invited.meeting_id = meeting.id
        ) ELSE (
          SELECT count(*) FROM public.meeting_invited_units AS invited
          WHERE invited.society_id = p_society_id AND invited.meeting_id = meeting.id
        ) END AS invited,
        (
          SELECT count(*) FROM public.meeting_attendance AS attendance
          WHERE attendance.society_id = p_society_id AND attendance.meeting_id = meeting.id
            AND CASE WHEN meeting.meeting_type = 'committee' THEN attendance.membership_id IS NOT NULL
              ELSE attendance.unit_id IS NOT NULL END
        ) AS present
    ) AS counted
    WHERE counted.invited > 0
  ),
  grouped AS (
    SELECT rates.month, round(avg(rates.rate) * 100, 1) AS rate FROM rates GROUP BY rates.month
  )
  SELECT private.analytics_community_trend(p_from, p_to, 'percent', '[{"key":"rate","label":"Attendance"}]',
    COALESCE((SELECT jsonb_object_agg(to_char(grouped.month, 'YYYY-MM'),
      jsonb_build_object('rate', grouped.rate)) FROM grouped), '{}'::jsonb))
$$;

-- Meeting: action items today: open, overdue (open and due before today) and done.
CREATE FUNCTION private.analytics_metric_meeting_actions(p_society_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.analytics_community_stat('count',
    '[{"key":"open","label":"Open"},{"key":"overdue","label":"Overdue"},{"key":"done","label":"Done"}]',
    jsonb_build_object('open', counted.open, 'overdue', counted.overdue, 'done', counted.done))
  FROM (
    SELECT count(*) FILTER (WHERE item.status = 'open') AS open,
      count(*) FILTER (WHERE item.status = 'open' AND item.due_on < today.day) AS overdue,
      count(*) FILTER (WHERE item.status = 'done') AS done
    FROM (SELECT private.analytics_today(p_society_id) AS day) AS today
    LEFT JOIN public.meeting_action_items AS item ON item.society_id = p_society_id
  ) AS counted
$$;

REVOKE ALL ON FUNCTION private.analytics_metric_directory_vehicles(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_directory_pending_verification(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_tenancy_moves(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_tenancy_pending(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_document_published(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_document_downloads(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_parking_occupancy(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_parking_reports(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_sos_alerts(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_sos_response_time(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_vendor_requests(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_vendor_approved_spend(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_patrol_completion(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_patrol_incidents(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_metering_consumption(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_metering_pending_readings(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_asset_by_category(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_asset_warranty_expiring(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_home_services_providers(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_home_services_ratings(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_poll_completed(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_poll_turnout(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_meeting_held(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_meeting_attendance(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.analytics_metric_meeting_actions(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
