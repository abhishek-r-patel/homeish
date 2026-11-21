-- P43.1 admin home (A-01): counts and lists for the /admin dashboard, plus the admin-only audit feed.
-- Each section reuses the owning module's existing rule and is computed in its own block, so one failing
-- section is reported as unavailable instead of failing the page or showing zero.

-- Admins and committee members only. Returns one jsonb value per section: NULL when the module is off,
-- {"status":"unavailable"} when it could not be computed, otherwise {"status":"ok", ...}.
CREATE FUNCTION public.admin_home_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_today date;
  day_start timestamptz;
  day_end timestamptz;
  metric jsonb;
  unavailable constant jsonb := '{"status":"unavailable"}'::jsonb;
  visitors jsonb;
  requests jsonb;
  billing jsonb;
  amc jsonb;
  stock jsonb;
  tenancy jsonb;
  registrations jsonb;
  meeting jsonb;
  activity jsonb;
BEGIN
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);

  local_today := private.analytics_today(p_society_id);
  SELECT bounds.from_ts, bounds.to_ts INTO day_start, day_end
  FROM private.analytics_bounds(p_society_id, local_today, local_today) AS bounds;

  -- Visitors: checked in today (society-local day) and still inside (the visitor log's "Inside" status).
  IF private.module_enabled(p_society_id, 'visitor') THEN
    BEGIN
      SELECT jsonb_build_object(
        'status', 'ok',
        'today', count(*) FILTER (
          WHERE entry.checked_in_at >= day_start AND entry.checked_in_at < day_end
        ),
        'inside', count(*) FILTER (WHERE entry.status = 'checked_in')
      )
      INTO visitors
      FROM public.visitor_entries AS entry
      WHERE entry.society_id = p_society_id
        AND (entry.status = 'checked_in'
          OR (entry.checked_in_at >= day_start AND entry.checked_in_at < day_end));
    EXCEPTION WHEN OTHERS THEN
      visitors := unavailable;
    END;
  END IF;

  -- Requests: the request workspace's own open and overdue counts.
  IF private.module_enabled(p_society_id, 'service_request') THEN
    BEGIN
      metric := public.request_dashboard(p_society_id);
      requests := jsonb_build_object(
        'status', 'ok',
        'open', (metric ->> 'total_open')::integer,
        'overdue', (metric ->> 'overdue')::integer
      );
    EXCEPTION WHEN OTHERS THEN
      requests := unavailable;
    END;
  END IF;

  -- Billing: collected this month and outstanding come from the analytics billing metrics; overdue units use
  -- the billing dashboard's defaulter rule; pending payments are the review queue.
  IF private.module_enabled(p_society_id, 'billing') THEN
    BEGIN
      billing := jsonb_build_object(
        'status', 'ok',
        'collected_month_paise', (
          SELECT COALESCE(sum((point.value -> 'values' ->> 'collected')::bigint), 0)::text
          FROM jsonb_array_elements(
            private.analytics_metric_billing_collection_trend(
              p_society_id, date_trunc('month', local_today)::date, local_today
            ) -> 'points'
          ) AS point
        ),
        'outstanding_paise', (
          SELECT COALESCE(sum(bucket.value::bigint), 0)::text
          FROM jsonb_each_text(
            private.analytics_metric_billing_dues_ageing(p_society_id, local_today, local_today)
              -> 'values'
          ) AS bucket
        ),
        'overdue_units', (
          SELECT count(DISTINCT bill.unit_id)
          FROM public.billing_bills AS bill
          WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
            AND bill.paid_paise + bill.waived_paise < bill.total_paise
            AND bill.due_date < private.billing_society_today(p_society_id)
        ),
        'pending_payments', (
          SELECT count(*) FROM public.billing_payments AS payment
          WHERE payment.society_id = p_society_id AND payment.status = 'awaiting_confirmation'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      billing := unavailable;
    END;
  END IF;

  -- AMC: the AMC register's "Urgent" band (ends within the society's urgent window, not yet renewed).
  IF private.module_enabled(p_society_id, 'amc') THEN
    BEGIN
      metric := private.analytics_metric_amc_expiry_bands(p_society_id, local_today, local_today);
      amc := jsonb_build_object(
        'status', 'ok', 'urgent', (metric -> 'values' ->> 'urgent')::integer
      );
    EXCEPTION WHEN OTHERS THEN
      amc := unavailable;
    END;
  END IF;

  -- Housekeeping: active items at or below their minimum stock (includes out of stock).
  IF private.module_enabled(p_society_id, 'housekeeping') THEN
    BEGIN
      metric := private.analytics_metric_housekeeping_low_stock(p_society_id, local_today, local_today);
      stock := jsonb_build_object(
        'status', 'ok',
        'low', (metric -> 'values' ->> 'low_stock')::integer,
        'out', (metric -> 'values' ->> 'out_of_stock')::integer
      );
    EXCEPTION WHEN OTHERS THEN
      stock := unavailable;
    END;
  END IF;

  -- Tenancy: move requests awaiting the owner's consent or the society's review.
  IF private.module_enabled(p_society_id, 'tenancy') THEN
    BEGIN
      metric := private.analytics_metric_tenancy_pending(p_society_id, local_today, local_today);
      tenancy := jsonb_build_object(
        'status', 'ok', 'pending', (metric -> 'values' ->> 'pending')::integer
      );
    EXCEPTION WHEN OTHERS THEN
      tenancy := unavailable;
    END;
  END IF;

  -- Registrations awaiting approval (Members screen "pending approval").
  BEGIN
    SELECT jsonb_build_object('status', 'ok', 'pending', count(*))
    INTO registrations
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'pending_approval';
  EXCEPTION WHEN OTHERS THEN
    registrations := unavailable;
  END;

  -- Next scheduled meeting that has not started yet.
  IF private.module_enabled(p_society_id, 'meeting') THEN
    BEGIN
      SELECT jsonb_build_object(
        'status', 'ok',
        'next', (
          SELECT jsonb_build_object(
            'id', item.id, 'title', item.title, 'starts_at', item.starts_at, 'venue', item.venue
          )
          FROM public.meetings AS item
          WHERE item.society_id = p_society_id AND item.status = 'scheduled'
            AND item.starts_at >= now()
          ORDER BY item.starts_at, item.id
          LIMIT 1
        )
      )
      INTO meeting;
    EXCEPTION WHEN OTHERS THEN
      meeting := unavailable;
    END;
  END IF;

  -- Society activity: the 8 newest events of the last 30 days from enabled modules. Titles only; no money,
  -- no people's names.
  BEGIN
    SELECT jsonb_build_object(
      'status', 'ok',
      'items', COALESCE(
        jsonb_agg(to_jsonb(recent) ORDER BY recent.occurred_at DESC, recent.kind, recent.id),
        '[]'::jsonb
      )
    )
    INTO activity
    FROM (
      SELECT candidates.*
      FROM (
        SELECT request.id, 'request_opened'::text AS kind, category.name AS title,
          unit.number AS unit_number, request.created_at AS occurred_at
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id AND category.id = request.category_id
        LEFT JOIN public.units AS unit
          ON unit.society_id = request.society_id AND unit.id = request.unit_id
        WHERE private.module_enabled(p_society_id, 'service_request')
          AND request.society_id = p_society_id
          AND request.created_at >= now() - interval '30 days'
        UNION ALL
        SELECT request.id, 'request_resolved', category.name, unit.number, request.resolved_at
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id AND category.id = request.category_id
        LEFT JOIN public.units AS unit
          ON unit.society_id = request.society_id AND unit.id = request.unit_id
        WHERE private.module_enabled(p_society_id, 'service_request')
          AND request.society_id = p_society_id
          AND request.resolved_at >= now() - interval '30 days'
        UNION ALL
        SELECT notice.id, 'notice_published', notice.title, NULL,
          COALESCE(notice.published_at, notice.created_at)
        FROM public.notices AS notice
        WHERE private.module_enabled(p_society_id, 'notice')
          AND notice.society_id = p_society_id AND notice.status = 'published'
          AND COALESCE(notice.published_at, notice.created_at) >= now() - interval '30 days'
          AND COALESCE(notice.published_at, notice.created_at) <= now()
        UNION ALL
        SELECT item.id, 'meeting_scheduled', item.title, NULL, item.scheduled_at
        FROM public.meetings AS item
        WHERE private.module_enabled(p_society_id, 'meeting')
          AND item.society_id = p_society_id
          AND item.scheduled_at >= now() - interval '30 days'
        UNION ALL
        SELECT item.id, 'meeting_held', item.title, NULL, item.held_at
        FROM public.meetings AS item
        WHERE private.module_enabled(p_society_id, 'meeting')
          AND item.society_id = p_society_id
          AND item.held_at >= now() - interval '30 days'
        UNION ALL
        SELECT membership.id, 'registration', NULL, NULL, membership.created_at
        FROM public.memberships AS membership
        WHERE membership.society_id = p_society_id
          AND membership.status = 'pending_approval'
          AND membership.created_at >= now() - interval '30 days'
      ) AS candidates
      ORDER BY candidates.occurred_at DESC, candidates.kind, candidates.id
      LIMIT 8
    ) AS recent;
  EXCEPTION WHEN OTHERS THEN
    activity := unavailable;
  END;

  RETURN jsonb_build_object(
    'timezone', private.analytics_timezone(p_society_id),
    'server_now', now(),
    'visitors', visitors,
    'requests', requests,
    'billing', billing,
    'amc', amc,
    'stock', stock,
    'tenancy', tenancy,
    'registrations', registrations,
    'meeting', meeting,
    'activity', activity
  );
END;
$$;

-- Admin-only feed of the last 7 days of allow-listed society actions by admins or committee members. Returns
-- the action, the actor's role and the time only: never the person, before/after values or reasons.
CREATE FUNCTION public.admin_home_admin_actions(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  allowed constant text[] := ARRAY[
    'billing.payment.confirm', 'billing.payment.reject', 'billing.bills.generate',
    'notice.publish',
    'members.approve', 'members.reject', 'members.deactivate', 'members.changeRoles',
    'building_layout.save',
    'society_profile.update', 'society.update_gate_settings', 'society.update_language_availability',
    'settings.update', 'amc.settings.update', 'billing.settings.update', 'delivery.settings.update',
    'expense.settings.update', 'sos.settings.update', 'staff.settings.update', 'tenancy.settings.update',
    'visitor.settings.update'
  ]::text[];
BEGIN
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin']::text[], false);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
        'id', recent.id::text, 'action', recent.action,
        'actor_role', recent.actor_role, 'created_at', recent.created_at
      ) ORDER BY recent.created_at DESC, recent.id DESC)
    FROM (
      SELECT entry.id, entry.action, entry.actor_role, entry.created_at
      FROM public.audit_logs AS entry
      WHERE entry.society_id = p_society_id
        AND entry.created_at >= now() - interval '7 days'
        AND entry.actor_role IN ('admin', 'committee')
        AND entry.action = ANY (allowed)
      ORDER BY entry.created_at DESC, entry.id DESC
      LIMIT 10
    ) AS recent
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_home_get(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_home_admin_actions(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_home_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_home_admin_actions(uuid) TO authenticated;
