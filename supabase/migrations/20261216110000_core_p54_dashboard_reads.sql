CREATE OR REPLACE FUNCTION public.workspace_coming_up_get(
  p_society_id uuid
)
RETURNS TABLE (
  source text,
  item_id uuid,
  title text,
  occurs_at timestamptz,
  href text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_resident boolean;
  is_work_member boolean;
  end_at timestamptz;
  local_timezone text;
BEGIN
  IF NOT private.is_member(p_society_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not a society member';
  END IF;
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  is_work_member := private.has_role(
    p_society_id,
    ARRAY['admin', 'committee']::text[]
  );
  SELECT society.timezone
  INTO local_timezone
  FROM public.societies AS society
  WHERE society.id = p_society_id;
  IF local_timezone IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Society not found';
  END IF;
  end_at := now() + interval '7 days';

  RETURN QUERY
  WITH upcoming AS (
    SELECT
      'meeting'::text AS source,
      meeting.id AS item_id,
      meeting.title,
      meeting.starts_at AS occurs_at,
      CASE
        WHEN is_work_member THEN '/admin/meetings/' || meeting.id::text
        ELSE '/meetings/' || meeting.id::text
      END AS href
    FROM public.meetings AS meeting
    WHERE private.module_enabled(p_society_id, 'meeting')
      AND meeting.society_id = p_society_id
      AND meeting.status = 'scheduled'
      AND meeting.starts_at BETWEEN now() AND end_at
      AND (
        meeting.meeting_type <> 'committee'
        OR is_work_member
      )

    UNION ALL

    SELECT
      'event'::text,
      event.id,
      event.title,
      event.starts_at,
      CASE
        WHEN is_work_member THEN '/admin/events/' || event.id::text
        ELSE '/events/' || event.id::text
      END
    FROM public.events AS event
    WHERE private.module_enabled(p_society_id, 'event')
      AND event.society_id = p_society_id
      AND event.status = 'published'
      AND event.starts_at BETWEEN now() AND end_at
      AND (
        NOT is_resident
        OR event.audience_scope = 'all'
        OR EXISTS (
          SELECT 1
          FROM public.event_audience_blocks AS audience
          JOIN public.units AS unit
            ON unit.society_id = event.society_id
           AND unit.block_id = audience.block_id
          JOIN public.unit_occupants AS occupant
            ON occupant.society_id = unit.society_id
           AND occupant.unit_id = unit.id
           AND occupant.status = 'active'
          JOIN public.memberships AS membership
            ON membership.id = occupant.membership_id
           AND membership.society_id = event.society_id
           AND membership.user_id = auth.uid()
          WHERE audience.society_id = event.society_id
            AND audience.event_id = event.id
        )
      )

    UNION ALL

    SELECT
      'bill'::text,
      bill.id,
      bill.title,
      bill.due_date::timestamp AT TIME ZONE local_timezone,
      CASE
        WHEN is_work_member THEN '/admin/billing?tab=charges'
        ELSE '/bills/' || bill.id::text
      END
    FROM public.billing_bills AS bill
    WHERE private.module_enabled(p_society_id, 'billing')
      AND bill.society_id = p_society_id
      AND bill.cancelled_at IS NULL
      AND bill.paid_paise + bill.waived_paise < bill.total_paise
      AND bill.due_date BETWEEN (now() AT TIME ZONE local_timezone)::date
        AND ((now() AT TIME ZONE local_timezone)::date + 7)
      AND (
        is_work_member
        OR (
          is_resident
          AND EXISTS (
            SELECT 1
            FROM public.unit_occupants AS occupant
            JOIN public.memberships AS membership
              ON membership.id = occupant.membership_id
             AND membership.society_id = bill.society_id
             AND membership.user_id = auth.uid()
            WHERE occupant.society_id = bill.society_id
              AND occupant.unit_id = bill.unit_id
              AND occupant.status = 'active'
          )
        )
      )

    UNION ALL

    SELECT
      'amenity'::text,
      booking.id,
      booking.amenity_name,
      booking.starts_at,
      CASE
        WHEN is_work_member THEN '/admin/amenities'
        ELSE '/amenities/' || booking.id::text
      END
    FROM public.amenity_bookings AS booking
    WHERE private.module_enabled(p_society_id, 'amenity')
      AND booking.society_id = p_society_id
      AND booking.status = 'confirmed'
      AND booking.starts_at BETWEEN now() AND end_at
      AND (
        is_work_member
        OR (is_resident AND booking.booked_by = auth.uid())
      )

    UNION ALL

    SELECT
      'amc'::text,
      contract.id,
      contract.asset_label || ' renewal',
      contract.end_date::timestamp AT TIME ZONE local_timezone,
      '/admin/amc/' || contract.id::text
    FROM public.amc_contracts AS contract
    WHERE private.module_enabled(p_society_id, 'amc')
      AND is_work_member
      AND contract.society_id = p_society_id
      AND contract.end_date BETWEEN (now() AT TIME ZONE local_timezone)::date
        AND ((now() AT TIME ZONE local_timezone)::date + 7)

    UNION ALL

    SELECT
      'poll'::text,
      poll.id,
      poll.title,
      poll.closes_at,
      CASE
        WHEN is_work_member THEN '/admin/polls/' || poll.id::text
        ELSE '/polls/' || poll.id::text
      END
    FROM public.poll_votes AS poll
    WHERE private.module_enabled(p_society_id, 'poll')
      AND poll.society_id = p_society_id
      AND poll.status IN ('scheduled', 'active')
      AND poll.closes_at BETWEEN now() AND end_at
  )
  SELECT
    upcoming.source,
    upcoming.item_id,
    upcoming.title,
    upcoming.occurs_at,
    upcoming.href
  FROM upcoming
  ORDER BY upcoming.occurs_at, upcoming.title, upcoming.item_id
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_coming_up_get(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_coming_up_get(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resident_dashboard_graph_get(
  p_society_id uuid,
  p_mode text
)
RETURNS TABLE (
  month_start date,
  amount numeric,
  has_data boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  first_month date;
  local_timezone text;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['resident']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Resident access required';
  END IF;
  IF p_mode NOT IN ('water', 'bills') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Choose a supported graph';
  END IF;
  SELECT society.timezone
  INTO local_timezone
  FROM public.societies AS society
  WHERE society.id = p_society_id;
  first_month := date_trunc(
    'month',
    now() AT TIME ZONE COALESCE(local_timezone, 'Asia/Kolkata')
  )::date - interval '5 months';

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      first_month,
      date_trunc(
        'month',
        now() AT TIME ZONE COALESCE(local_timezone, 'Asia/Kolkata')
      )::date,
      interval '1 month'
    )::date AS month_start
  ),
  own_units AS (
    SELECT DISTINCT occupant.unit_id
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.id = occupant.membership_id
     AND membership.society_id = occupant.society_id
     AND membership.user_id = auth.uid()
    WHERE occupant.society_id = p_society_id
      AND occupant.status = 'active'
  )
  SELECT
    month.month_start,
    CASE
      WHEN p_mode = 'water' THEN COALESCE((
        SELECT sum(reading.consumption)
        FROM public.metering_readings AS reading
        JOIN public.metering_meters AS meter
          ON meter.society_id = reading.society_id
         AND meter.id = reading.meter_id
        JOIN own_units
          ON own_units.unit_id = reading.unit_id
        WHERE private.module_enabled(p_society_id, 'metering')
          AND reading.society_id = p_society_id
          AND reading.status = 'approved'
          AND meter.meter_type = 'water'
          AND date_trunc('month', reading.reading_date)::date = month.month_start
      ), 0)::numeric
      ELSE COALESCE((
        SELECT sum(bill.total_paise)::numeric / 100
        FROM public.billing_bills AS bill
        JOIN own_units ON own_units.unit_id = bill.unit_id
        WHERE private.module_enabled(p_society_id, 'billing')
          AND bill.society_id = p_society_id
          AND bill.cancelled_at IS NULL
          AND bill.period_start = month.month_start
      ), 0)::numeric
    END,
    CASE
      WHEN p_mode = 'water' THEN EXISTS (
        SELECT 1
        FROM public.metering_readings AS reading
        JOIN public.metering_meters AS meter
          ON meter.society_id = reading.society_id
         AND meter.id = reading.meter_id
        JOIN own_units
          ON own_units.unit_id = reading.unit_id
        WHERE private.module_enabled(p_society_id, 'metering')
          AND reading.society_id = p_society_id
          AND reading.status = 'approved'
          AND meter.meter_type = 'water'
          AND date_trunc('month', reading.reading_date)::date = month.month_start
      )
      ELSE EXISTS (
        SELECT 1
        FROM public.billing_bills AS bill
        JOIN own_units ON own_units.unit_id = bill.unit_id
        WHERE private.module_enabled(p_society_id, 'billing')
          AND bill.society_id = p_society_id
          AND bill.cancelled_at IS NULL
          AND bill.period_start = month.month_start
      )
    END
  FROM months AS month
  ORDER BY month.month_start;
END;
$$;

REVOKE ALL ON FUNCTION public.resident_dashboard_graph_get(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resident_dashboard_graph_get(uuid, text)
  TO authenticated, service_role;
