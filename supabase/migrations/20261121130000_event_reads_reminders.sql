-- Events & RSVPs (D-63): manager and resident reads, and the day-before reminder job.

CREATE OR REPLACE FUNCTION public.event_admin_list(
  p_society_id uuid, p_filter text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_filter text := COALESCE(p_filter, 'upcoming');
  v_now timestamptz := clock_timestamp();
  v_items jsonb;
  v_total integer;
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR COALESCE(p_offset, 0) < 0
    OR v_filter NOT IN ('upcoming', 'past', 'drafts', 'cancelled', 'all')
  THEN
    RAISE EXCEPTION 'The list filter is invalid.' USING ERRCODE = '22023';
  END IF;
  WITH filtered AS (
    SELECT event.* FROM public.events AS event
    WHERE event.society_id = p_society_id
      AND CASE v_filter
        WHEN 'upcoming' THEN event.status IN ('draft', 'published') AND event.ends_at > v_now
        WHEN 'past' THEN event.status = 'published' AND event.ends_at <= v_now
        WHEN 'drafts' THEN event.status = 'draft'
        WHEN 'cancelled' THEN event.status = 'cancelled'
        ELSE true END
  ),
  page AS (
    SELECT filtered.*,
      row_number() OVER (ORDER BY
        CASE WHEN v_filter = 'upcoming' THEN filtered.starts_at END ASC,
        CASE WHEN v_filter <> 'upcoming' THEN filtered.starts_at END DESC,
        filtered.created_at DESC, filtered.id) AS ordinal
    FROM filtered
  )
  SELECT (SELECT count(*)::integer FROM filtered),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', page.id, 'title', page.title, 'status', page.status, 'startsAt', page.starts_at,
      'endsAt', page.ends_at, 'venue', page.venue, 'past', page.ends_at <= v_now,
      'goingUnits', COALESCE(going.units, 0), 'goingHeadcount', COALESCE(going.headcount, 0),
      'capacity', page.capacity, 'contributionType', page.contribution_type,
      'contributionPaise', page.contribution_paise
    ) ORDER BY page.ordinal) FILTER (WHERE page.id IS NOT NULL), '[]'::jsonb)
  INTO v_total, v_items
  FROM (
    SELECT * FROM page ORDER BY ordinal OFFSET COALESCE(p_offset, 0) LIMIT p_limit
  ) AS page
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS units, COALESCE(sum(rsvp.headcount), 0)::integer AS headcount
    FROM public.event_rsvps AS rsvp
    WHERE rsvp.society_id = p_society_id AND rsvp.event_id = page.id AND rsvp.status = 'going'
  ) AS going ON true;
  RETURN jsonb_build_object('items', v_items, 'total', COALESCE(v_total, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.event_admin_get(p_society_id uuid, p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_totals jsonb;
  v_rsvps jsonb;
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'The event is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_event FROM public.events WHERE society_id = p_society_id AND id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT jsonb_build_object(
    'goingUnits', count(*) FILTER (WHERE rsvp.status = 'going'),
    'goingHeadcount', COALESCE(sum(rsvp.headcount) FILTER (WHERE rsvp.status = 'going'), 0),
    'notGoingUnits', count(*) FILTER (WHERE rsvp.status = 'not_going'),
    'audienceUnits', (SELECT count(*) FROM private.event_audience_units(p_society_id, p_event_id)),
    'collectedPaise', (
      SELECT COALESCE(sum(CASE WHEN charge.direction = 'debit' THEN charge.amount_paise ELSE -charge.amount_paise END), 0)
      FROM public.event_rsvp_charges AS charge
      WHERE charge.society_id = p_society_id AND charge.event_id = p_event_id
    )
  ) INTO v_totals
  FROM public.event_rsvps AS rsvp
  WHERE rsvp.society_id = p_society_id AND rsvp.event_id = p_event_id;
  SELECT COALESCE(jsonb_agg(entry.value ORDER BY entry.label, entry.unit_id), '[]'::jsonb) INTO v_rsvps
  FROM (
    SELECT left(COALESCE(block.name || '-', '') || unit.number, 100) AS label, unit.id AS unit_id,
      jsonb_build_object(
        'rsvpId', rsvp.id, 'unitId', rsvp.unit_id,
        'unitLabel', left(COALESCE(block.name || '-', '') || unit.number, 100),
        'status', rsvp.status, 'headcount', rsvp.headcount,
        'respondedByName', left(COALESCE(NULLIF(btrim(profile.full_name), ''), 'Resident'), 120),
        'respondedAt', rsvp.responded_at,
        'netChargePaise', private.event_rsvp_net(p_society_id, rsvp.id)
      ) AS value
    FROM public.event_rsvps AS rsvp
    JOIN public.units AS unit ON unit.society_id = rsvp.society_id AND unit.id = rsvp.unit_id
    LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
    LEFT JOIN public.profiles AS profile ON profile.id = rsvp.responded_by
    WHERE rsvp.society_id = p_society_id AND rsvp.event_id = p_event_id
    ORDER BY 1, 2
    LIMIT 5000
  ) AS entry;
  RETURN jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id, 'status', v_event.status, 'title', v_event.title,
      'description', v_event.description, 'venue', v_event.venue,
      'startsAt', v_event.starts_at, 'endsAt', v_event.ends_at, 'rsvpDeadline', v_event.rsvp_deadline,
      'rsvpClosesAt', COALESCE(v_event.rsvp_deadline, v_event.starts_at),
      'capacity', v_event.capacity, 'maxPerUnit', v_event.max_per_unit,
      'contributionType', v_event.contribution_type, 'contributionPaise', v_event.contribution_paise,
      'audience', jsonb_build_object('scope', v_event.audience_scope,
        'blockIds', to_jsonb(private.event_block_ids(p_society_id, p_event_id))),
      'version', v_event.version, 'past', v_event.ends_at <= v_now,
      'createdAt', v_event.created_at, 'updatedAt', v_event.updated_at,
      'publishedAt', v_event.published_at, 'cancelledAt', v_event.cancelled_at,
      'cancellationReason', v_event.cancellation_reason, 'reminderSentAt', v_event.reminder_sent_at
    ),
    'totals', v_totals,
    'rsvps', v_rsvps,
    'billingEnabled', private.module_enabled(p_society_id, 'billing')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.event_block_options(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RETURN jsonb_build_object('blocks', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('blockId', block.id, 'name', block.name) ORDER BY block.name, block.id)
    FROM public.blocks AS block
    WHERE block.society_id = p_society_id AND block.active
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.event_member_list(p_society_id uuid, p_filter text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_filter text := COALESCE(p_filter, 'upcoming');
  v_now timestamptz := clock_timestamp();
  v_items jsonb;
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['resident']::text[], false);
  IF v_filter NOT IN ('upcoming', 'past') THEN
    RAISE EXCEPTION 'The list filter is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinal), '[]'::jsonb) INTO v_items
  FROM (
    SELECT row_number() OVER (ORDER BY
        CASE WHEN v_filter = 'upcoming' THEN event.starts_at END ASC,
        CASE WHEN v_filter = 'past' THEN event.starts_at END DESC, event.id) AS ordinal,
      jsonb_build_object(
        'id', event.id, 'title', event.title, 'status', event.status, 'startsAt', event.starts_at,
        'endsAt', event.ends_at, 'venue', event.venue, 'past', event.ends_at <= v_now,
        'rsvpClosesAt', COALESCE(event.rsvp_deadline, event.starts_at),
        'contributionType', event.contribution_type, 'contributionPaise', event.contribution_paise,
        'myRsvp', (
          SELECT CASE WHEN rsvp.id IS NULL THEN NULL ELSE jsonb_build_object(
            'unitId', rsvp.unit_id, 'status', rsvp.status, 'headcount', rsvp.headcount) END
          FROM private.event_member_units(p_society_id, event.id) AS mine
          LEFT JOIN public.event_rsvps AS rsvp ON rsvp.society_id = p_society_id AND rsvp.id = mine.rsvp_id
          ORDER BY mine.unit_label, mine.unit_id
          LIMIT 1
        )
      ) AS value
    FROM public.events AS event
    WHERE event.society_id = p_society_id AND event.status IN ('published', 'cancelled')
      AND CASE WHEN v_filter = 'upcoming' THEN event.ends_at > v_now ELSE event.ends_at <= v_now END
      AND EXISTS (SELECT 1 FROM private.event_member_units(p_society_id, event.id))
    ORDER BY 1
    LIMIT 100
  ) AS item;
  RETURN jsonb_build_object('items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.event_member_get(p_society_id uuid, p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_open boolean;
  v_going integer;
  v_units jsonb;
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['resident']::text[], false);
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'The event is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_event FROM public.events WHERE society_id = p_society_id AND id = p_event_id;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM private.event_member_units(p_society_id, p_event_id)) THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  v_open := v_event.status = 'published' AND v_now < COALESCE(v_event.rsvp_deadline, v_event.starts_at);
  SELECT COALESCE(sum(headcount), 0)::integer INTO v_going FROM public.event_rsvps
  WHERE society_id = p_society_id AND event_id = p_event_id AND status = 'going';
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'unitId', mine.unit_id, 'label', mine.unit_label,
      'rsvp', CASE WHEN rsvp.id IS NULL THEN NULL ELSE jsonb_build_object(
        'rsvpId', rsvp.id, 'status', rsvp.status, 'headcount', rsvp.headcount, 'version', rsvp.version,
        'netChargePaise', private.event_rsvp_net(p_society_id, rsvp.id)) END,
      'canRsvp', v_open
    ) ORDER BY mine.unit_label, mine.unit_id), '[]'::jsonb) INTO v_units
  FROM private.event_member_units(p_society_id, p_event_id) AS mine
  LEFT JOIN public.event_rsvps AS rsvp ON rsvp.society_id = p_society_id AND rsvp.id = mine.rsvp_id;
  RETURN jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id, 'title', v_event.title, 'description', v_event.description, 'status', v_event.status,
      'venue', v_event.venue, 'startsAt', v_event.starts_at, 'endsAt', v_event.ends_at,
      'rsvpDeadline', v_event.rsvp_deadline, 'rsvpClosesAt', COALESCE(v_event.rsvp_deadline, v_event.starts_at),
      'rsvpOpen', v_open, 'capacity', v_event.capacity, 'maxPerUnit', v_event.max_per_unit,
      'contributionType', v_event.contribution_type, 'contributionPaise', v_event.contribution_paise,
      'cancellationReason', v_event.cancellation_reason, 'past', v_event.ends_at <= v_now
    ),
    'spotsLeft', CASE WHEN v_event.capacity IS NULL THEN NULL ELSE greatest(v_event.capacity - v_going, 0) END,
    'goingHeadcount', v_going,
    'myUnits', v_units,
    'billingEnabled', private.module_enabled(p_society_id, 'billing')
  );
END;
$$;

-- Daily job: one day-before reminder per event to active occupants of going flats.
CREATE OR REPLACE FUNCTION public.event_reminders_run(p_society_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_zone text;
  v_tomorrow date;
  v_event record;
  v_events integer := 0;
  v_sent integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Event maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  IF p_society_id IS NULL OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The society and request id are invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'event') OR NOT private.society_writable(p_society_id) THEN
    RETURN jsonb_build_object('events', 0, 'notified', 0);
  END IF;
  SET LOCAL lock_timeout = '5s';
  SELECT COALESCE(society.timezone, 'Asia/Kolkata') INTO v_zone FROM public.societies AS society
  WHERE society.id = p_society_id;
  v_tomorrow := (clock_timestamp() AT TIME ZONE v_zone)::date + 1;
  FOR v_event IN
    SELECT event.id FROM public.events AS event
    WHERE event.society_id = p_society_id AND event.status = 'published' AND event.reminder_sent_at IS NULL
      AND (event.starts_at AT TIME ZONE v_zone)::date = v_tomorrow
    ORDER BY event.starts_at, event.id
    FOR UPDATE SKIP LOCKED
  LOOP
    v_sent := v_sent + private.event_notify(p_society_id, v_event.id, 'event_reminder', 'Event tomorrow',
      false, true, p_request_id);
    -- A system field: the manager's edit version is deliberately not bumped.
    UPDATE public.events SET reminder_sent_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = v_event.id;
    v_events := v_events + 1;
  END LOOP;
  IF v_events > 0 THEN
    PERFORM private.event_audit(p_society_id, 'reminders', 'event', NULL,
      jsonb_build_object('events', v_events, 'notified', v_sent, 'day', v_tomorrow), p_request_id);
  END IF;
  RETURN jsonb_build_object('events', v_events, 'notified', v_sent);
END;
$$;
