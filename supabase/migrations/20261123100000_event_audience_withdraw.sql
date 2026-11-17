-- Events & RSVPs (D-63) follow-up: narrowing a published event's audience withdraws the replies of flats
-- that are no longer invited (refunding their full contribution), residents only see events open to their
-- flats, and the resident list reports the caller's reply for every flat.

ALTER TABLE public.event_rsvp_charges DROP CONSTRAINT event_rsvp_charges_reason_check;
ALTER TABLE public.event_rsvp_charges ADD CONSTRAINT event_rsvp_charges_reason_check CHECK (
  reason IN ('rsvp', 'headcount_change', 'withdrawn', 'event_cancelled', 'audience_removed')
);

-- Visible to a resident: published/cancelled, and one of their actively occupied units is in the audience.
-- in_audience and rsvp_id keep the original shape; in_audience is now always true.
CREATE OR REPLACE FUNCTION private.event_member_units(p_society_id uuid, p_event_id uuid)
RETURNS TABLE (unit_id uuid, unit_label text, in_audience boolean, rsvp_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT unit.id, left(COALESCE(block.name || '-', '') || unit.number, 100), true, rsvp.id
  FROM public.events AS event
  JOIN public.unit_occupants AS occupant ON occupant.society_id = event.society_id AND occupant.status = 'active'
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    AND membership.status = 'active' AND membership.user_id = auth.uid()
  JOIN public.units AS unit ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id
  LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
  LEFT JOIN public.event_rsvps AS rsvp
    ON rsvp.society_id = event.society_id AND rsvp.event_id = event.id AND rsvp.unit_id = unit.id
  WHERE event.society_id = p_society_id AND event.id = p_event_id
    AND event.status IN ('published', 'cancelled')
    AND unit.active AND (event.audience_scope = 'all' OR EXISTS (
      SELECT 1 FROM public.event_audience_blocks AS chosen
      WHERE chosen.society_id = event.society_id AND chosen.event_id = event.id AND chosen.block_id = unit.block_id
    ))
$$;

-- Fan-out to active occupants of audience units, optionally plus going units outside the audience (a
-- deactivated flat that still holds a charge), or only going units. Withdrawn flats are never targeted.
CREATE OR REPLACE FUNCTION private.event_notify(
  p_society_id uuid, p_event_id uuid, p_type text, p_title text, p_with_rsvp_units boolean,
  p_going_only boolean, p_request_id text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_body text;
  v_recipient record;
  v_sent integer := 0;
BEGIN
  SELECT left(event.title || ' on ' || to_char(event.starts_at AT TIME ZONE
      COALESCE(society.timezone, 'Asia/Kolkata'), 'DD Mon YYYY, HH24:MI'), 300)
  INTO v_body
  FROM public.events AS event
  JOIN public.societies AS society ON society.id = event.society_id
  WHERE event.society_id = p_society_id AND event.id = p_event_id;

  FOR v_recipient IN
    SELECT membership.user_id, bool_or('resident' = ANY (membership.roles)) AS resident
    FROM (
      SELECT audience.unit_id FROM private.event_audience_units(p_society_id, p_event_id) AS audience
      WHERE NOT p_going_only
      UNION
      SELECT rsvp.unit_id FROM public.event_rsvps AS rsvp
      WHERE rsvp.society_id = p_society_id AND rsvp.event_id = p_event_id
        AND (p_with_rsvp_units OR p_going_only) AND rsvp.status = 'going'
    ) AS target
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = p_society_id AND occupant.unit_id = target.unit_id AND occupant.status = 'active'
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
      AND membership.status = 'active' AND membership.user_id IS NOT NULL
    GROUP BY membership.user_id
    ORDER BY membership.user_id
    LIMIT 2000
  LOOP
    PERFORM private.create_notification(
      p_society_id, v_recipient.user_id, p_type, p_title, v_body,
      CASE WHEN v_recipient.resident THEN 'event' ELSE 'event_admin' END,
      p_event_id, p_request_id
    );
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_update(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_event jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_parsed jsonb;
  v_blocks uuid[];
  v_starts timestamptz;
  v_ends timestamptz;
  v_deadline timestamptz;
  v_capacity integer;
  v_keys text[];
  v_going bigint;
  v_changed boolean := false;
  v_version integer;
  v_rsvp record;
  v_withdrawn_units uuid[] := ARRAY[]::uuid[];
  v_refunded_units uuid[] := ARRAY[]::uuid[];
  v_recipient record;
BEGIN
  PERFORM private.event_write_begin(p_society_id, ARRAY['admin', 'committee']::text[], p_request_id);
  IF p_event_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The event and version are required.' USING ERRCODE = '22023';
  END IF;
  v_parsed := private.event_parse(p_society_id, p_event);
  v_blocks := ARRAY(SELECT jsonb_array_elements_text(v_parsed -> 'block_ids')::uuid);
  v_starts := (v_parsed ->> 'starts_at')::timestamptz;
  v_ends := (v_parsed ->> 'ends_at')::timestamptz;
  v_deadline := (v_parsed ->> 'rsvp_deadline')::timestamptz;
  v_capacity := (v_parsed ->> 'capacity')::integer;
  SELECT * INTO v_event FROM public.events
  WHERE society_id = p_society_id AND id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.version <> p_expected_version THEN
    RAISE EXCEPTION 'The event changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_event.status = 'cancelled' OR (v_event.status = 'published' AND v_event.ends_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only draft events and published events that have not ended can be edited.';
  END IF;
  IF v_event.status = 'published' THEN
    IF v_parsed ->> 'contribution_type' <> v_event.contribution_type
      OR (v_parsed ->> 'contribution_paise')::bigint <> v_event.contribution_paise
    THEN
      RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001',
        DETAIL = 'The contribution cannot change once the event is published.';
    END IF;
    v_keys := private.event_readiness(p_society_id, v_parsed ->> 'title', v_parsed ->> 'venue',
      v_starts, v_ends, v_deadline, v_parsed ->> 'scope', v_blocks,
      v_starts IS DISTINCT FROM v_event.starts_at, v_deadline IS DISTINCT FROM v_event.rsvp_deadline);
    IF cardinality(v_keys) > 0 THEN
      RAISE EXCEPTION 'event_not_ready' USING ERRCODE = 'P0001', DETAIL = array_to_string(v_keys, ',');
    END IF;
    IF v_event.contribution_type <> 'none' AND NOT private.module_enabled(p_society_id, 'billing') THEN
      RAISE EXCEPTION 'event_billing_required' USING ERRCODE = 'P0001',
        DETAIL = 'Contributions need the billing module to be turned on.';
    END IF;
    IF v_capacity IS NOT NULL THEN
      -- Only flats that stay in the new audience count; the others are withdrawn below.
      SELECT COALESCE(sum(rsvp.headcount), 0) INTO v_going
      FROM public.event_rsvps AS rsvp
      JOIN public.units AS unit ON unit.society_id = rsvp.society_id AND unit.id = rsvp.unit_id
      WHERE rsvp.society_id = p_society_id AND rsvp.event_id = p_event_id AND rsvp.status = 'going'
        AND unit.active AND (v_parsed ->> 'scope' = 'all' OR unit.block_id = ANY (v_blocks));
      IF v_going > v_capacity THEN
        RAISE EXCEPTION 'event_capacity_below_going' USING ERRCODE = 'P0001',
          DETAIL = format('Capacity cannot go below the %s people already going.', v_going);
      END IF;
    END IF;
    v_changed := v_starts IS DISTINCT FROM v_event.starts_at OR v_ends IS DISTINCT FROM v_event.ends_at
      OR (v_parsed ->> 'venue') IS DISTINCT FROM v_event.venue;
  END IF;
  PERFORM private.event_store_audience(p_society_id, p_event_id, v_blocks);
  UPDATE public.events SET
    title = v_parsed ->> 'title',
    description = v_parsed ->> 'description',
    venue = v_parsed ->> 'venue',
    starts_at = v_starts,
    ends_at = v_ends,
    rsvp_deadline = v_deadline,
    capacity = v_capacity,
    max_per_unit = (v_parsed ->> 'max_per_unit')::integer,
    contribution_type = v_parsed ->> 'contribution_type',
    contribution_paise = (v_parsed ->> 'contribution_paise')::bigint,
    audience_scope = v_parsed ->> 'scope',
    -- A new start date earns a fresh day-before reminder.
    reminder_sent_at = CASE WHEN v_starts IS DISTINCT FROM v_event.starts_at THEN NULL ELSE reminder_sent_at END,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_event_id
  RETURNING version INTO v_version;

  IF v_event.status = 'published' THEN
    -- Flats dropped from the audience lose their reply and get their whole contribution back, whatever the
    -- deadline or billing state: the organiser caused the change. Already-settled replies stay untouched.
    FOR v_rsvp IN
      SELECT rsvp.id, rsvp.unit_id, rsvp.status, private.event_rsvp_net(p_society_id, rsvp.id) AS net
      FROM public.event_rsvps AS rsvp
      WHERE rsvp.society_id = p_society_id AND rsvp.event_id = p_event_id
        AND NOT EXISTS (
          SELECT 1 FROM private.event_audience_units(p_society_id, p_event_id) AS audience
          WHERE audience.unit_id = rsvp.unit_id
        )
      ORDER BY rsvp.unit_id, rsvp.id
      FOR UPDATE OF rsvp
    LOOP
      IF v_rsvp.status = 'going' THEN
        UPDATE public.event_rsvps SET
          status = 'not_going', headcount = 0, responded_by = auth.uid(), responded_at = clock_timestamp(),
          version = version + 1
        WHERE society_id = p_society_id AND id = v_rsvp.id;
        v_withdrawn_units := v_withdrawn_units || v_rsvp.unit_id;
      END IF;
      IF v_rsvp.net > 0 THEN
        PERFORM private.event_post_charge(p_society_id, p_event_id, v_rsvp.id, v_rsvp.unit_id, 'credit',
          v_rsvp.net, 'audience_removed', v_event.title);
        v_refunded_units := v_refunded_units || v_rsvp.unit_id;
      END IF;
    END LOOP;

    -- The link may land on a not-found page if the person has no other invited flat; that page is safe.
    FOR v_recipient IN
      SELECT membership.user_id, bool_or('resident' = ANY (membership.roles)) AS resident,
        bool_or(occupant.unit_id = ANY (v_refunded_units)) AS refunded
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
        AND membership.status = 'active' AND membership.user_id IS NOT NULL
      WHERE occupant.society_id = p_society_id AND occupant.status = 'active'
        AND (occupant.unit_id = ANY (v_withdrawn_units) OR occupant.unit_id = ANY (v_refunded_units))
      GROUP BY membership.user_id
      ORDER BY membership.user_id
      LIMIT 2000
    LOOP
      PERFORM private.create_notification(
        p_society_id, v_recipient.user_id, 'event_updated', 'Event audience changed',
        left((v_parsed ->> 'title') || ' is no longer open to your flat. Your reply was withdrawn'
          || CASE WHEN v_recipient.refunded THEN ' and your contribution refunded' ELSE '' END || '.', 300),
        CASE WHEN v_recipient.resident THEN 'event' ELSE 'event_admin' END,
        p_event_id, p_request_id
      );
    END LOOP;
  END IF;

  IF v_changed THEN
    PERFORM private.event_notify(p_society_id, p_event_id, 'event_updated', 'Event updated', true, false,
      p_request_id);
  END IF;
  PERFORM private.event_audit(p_society_id, 'update', 'event', p_event_id,
    jsonb_build_object('status', v_event.status, 'materialChange', v_changed,
      'withdrawnUnits', cardinality(v_withdrawn_units), 'refundedUnits', cardinality(v_refunded_units)),
    p_request_id);
  RETURN jsonb_build_object('eventId', p_event_id, 'version', v_version, 'notified', v_changed,
    'withdrawnUnits', cardinality(v_withdrawn_units), 'refundedUnits', cardinality(v_refunded_units));
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
        'myRsvps', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'unitId', mine.unit_id, 'label', mine.unit_label,
              'status', rsvp.status, 'headcount', rsvp.headcount
            ) ORDER BY mine.unit_label, mine.unit_id), '[]'::jsonb)
          FROM private.event_member_units(p_society_id, event.id) AS mine
          LEFT JOIN public.event_rsvps AS rsvp ON rsvp.society_id = p_society_id AND rsvp.id = mine.rsvp_id
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
