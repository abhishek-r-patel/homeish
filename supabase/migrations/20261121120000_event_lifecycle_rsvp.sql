-- Events & RSVPs (D-63): drafting, publishing, editing, cancellation with refunds, and unit RSVPs with
-- capacity limits and contribution charges on the billing ledger.

-- Strict draft payload parser: every malformed value is a 22023 argument error, never a cast failure.
-- Returns the normalised payload with snake_case keys; drafts may be incomplete but lengths are enforced.
CREATE FUNCTION private.event_parse(p_society_id uuid, p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key text;
  v_title text;
  v_description text;
  v_venue text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_deadline timestamptz;
  v_capacity integer;
  v_max integer;
  v_type text;
  v_paise bigint;
  v_audience jsonb;
  v_scope text;
  v_blocks uuid[] := ARRAY[]::uuid[];
  v_item jsonb;
  v_block uuid;
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
    RAISE EXCEPTION 'The event details are invalid.' USING ERRCODE = '22023';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_event) LOOP
    IF v_key NOT IN ('title', 'description', 'venue', 'startsAt', 'endsAt', 'rsvpDeadline', 'capacity',
      'maxPerUnit', 'contributionType', 'contributionPaise', 'audience')
    THEN
      RAISE EXCEPTION 'Unknown event field: %', left(v_key, 40) USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOREACH v_key IN ARRAY ARRAY['title', 'description', 'venue'] LOOP
    IF p_event ? v_key AND jsonb_typeof(p_event -> v_key) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'A text value is invalid.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  v_title := COALESCE(btrim(p_event ->> 'title'), '');
  v_description := NULLIF(btrim(p_event ->> 'description'), '');
  v_venue := NULLIF(btrim(p_event ->> 'venue'), '');
  IF char_length(v_title) > 150 OR char_length(v_description) > 4000 OR char_length(v_venue) > 200 THEN
    RAISE EXCEPTION 'A text value is too long.' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['startsAt', 'endsAt', 'rsvpDeadline'] LOOP
    IF p_event ? v_key AND jsonb_typeof(p_event -> v_key) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'A timestamp is invalid.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  BEGIN
    v_starts := (p_event ->> 'startsAt')::timestamptz;
    v_ends := (p_event ->> 'endsAt')::timestamptz;
    v_deadline := (p_event ->> 'rsvpDeadline')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'A timestamp is invalid.' USING ERRCODE = '22023';
  END;
  IF v_starts IS NULL OR v_ends IS NULL OR NOT isfinite(v_starts) OR NOT isfinite(v_ends)
    OR (v_deadline IS NOT NULL AND NOT isfinite(v_deadline))
  THEN
    RAISE EXCEPTION 'Start and end times are required.' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['capacity', 'maxPerUnit', 'contributionPaise'] LOOP
    IF COALESCE(jsonb_typeof(p_event -> v_key), 'null') NOT IN ('null', 'number') THEN
      RAISE EXCEPTION 'A number is invalid.' USING ERRCODE = '22023';
    ELSIF jsonb_typeof(p_event -> v_key) = 'number' THEN
      IF (p_event ->> v_key)::numeric <> trunc((p_event ->> v_key)::numeric)
        OR abs((p_event ->> v_key)::numeric) > 9007199254740991
      THEN
        RAISE EXCEPTION 'A number is invalid.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;
  IF (p_event ->> 'capacity')::numeric NOT BETWEEN 1 AND 100000
    OR (p_event ->> 'maxPerUnit')::numeric NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Capacity or per-flat limit is out of range.' USING ERRCODE = '22023';
  END IF;
  v_capacity := (p_event ->> 'capacity')::integer;
  v_max := (p_event ->> 'maxPerUnit')::integer;

  IF p_event ? 'contributionType' AND jsonb_typeof(p_event -> 'contributionType') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'The contribution type is invalid.' USING ERRCODE = '22023';
  END IF;
  v_type := COALESCE(p_event ->> 'contributionType', 'none');
  v_paise := COALESCE((p_event ->> 'contributionPaise')::numeric, 0)::bigint;
  IF v_type NOT IN ('none', 'per_unit', 'per_head')
    OR (v_type = 'none' AND v_paise <> 0)
    OR (v_type <> 'none' AND v_paise NOT BETWEEN 1 AND 10000000)
  THEN
    RAISE EXCEPTION 'The contribution is invalid.' USING ERRCODE = '22023';
  END IF;

  v_audience := COALESCE(p_event -> 'audience', '{"scope":"all"}'::jsonb);
  IF jsonb_typeof(v_audience) = 'null' THEN
    v_audience := '{"scope":"all"}'::jsonb;
  END IF;
  IF jsonb_typeof(v_audience) <> 'object' THEN
    RAISE EXCEPTION 'The audience is invalid.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_audience) AS k WHERE k NOT IN ('scope', 'blockIds'))
    OR jsonb_typeof(v_audience -> 'scope') IS DISTINCT FROM 'string'
    OR (v_audience ? 'blockIds' AND jsonb_typeof(v_audience -> 'blockIds') NOT IN ('array', 'null'))
  THEN
    RAISE EXCEPTION 'The audience is invalid.' USING ERRCODE = '22023';
  END IF;
  v_scope := v_audience ->> 'scope';
  IF v_scope NOT IN ('all', 'blocks') THEN
    RAISE EXCEPTION 'The audience is invalid.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_audience -> 'blockIds') = 'array' THEN
    IF jsonb_array_length(v_audience -> 'blockIds') > 500 THEN
      RAISE EXCEPTION 'Too many blocks were chosen.' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT element FROM jsonb_array_elements(v_audience -> 'blockIds') AS element LOOP
      IF jsonb_typeof(v_item) <> 'string' THEN
        RAISE EXCEPTION 'A block id is invalid.' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_block := (v_item #>> '{}')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'A block id is invalid.' USING ERRCODE = '22023';
      END;
      IF NOT (v_block = ANY (v_blocks)) THEN
        v_blocks := v_blocks || v_block;
      END IF;
    END LOOP;
  END IF;
  IF v_scope = 'all' AND cardinality(v_blocks) > 0 THEN
    RAISE EXCEPTION 'Blocks can only be chosen for a block audience.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_blocks) AS chosen(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.blocks AS block WHERE block.society_id = p_society_id AND block.id = chosen.id)
  ) THEN
    RAISE EXCEPTION 'A chosen block does not exist.' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'title', v_title, 'description', v_description, 'venue', v_venue,
    'starts_at', v_starts, 'ends_at', v_ends, 'rsvp_deadline', v_deadline,
    'capacity', v_capacity, 'max_per_unit', v_max,
    'contribution_type', v_type, 'contribution_paise', v_paise,
    'scope', v_scope, 'block_ids', to_jsonb(v_blocks)
  );
END;
$$;
REVOKE ALL ON FUNCTION private.event_parse(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.event_block_ids(p_society_id uuid, p_event_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(array_agg(block_id ORDER BY block_id), ARRAY[]::uuid[])
  FROM public.event_audience_blocks WHERE society_id = p_society_id AND event_id = p_event_id
$$;
REVOKE ALL ON FUNCTION private.event_block_ids(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Publish readiness. Start/deadline "not in the past" only applies when they are new or changed.
CREATE FUNCTION private.event_readiness(
  p_society_id uuid, p_title text, p_venue text, p_starts timestamptz, p_ends timestamptz,
  p_deadline timestamptz, p_scope text, p_block_ids uuid[], p_check_start boolean, p_check_deadline boolean
)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_keys text[] := ARRAY[]::text[];
BEGIN
  IF COALESCE(p_title, '') = '' THEN
    v_keys := v_keys || 'title_missing'::text;
  END IF;
  IF p_venue IS NULL THEN
    v_keys := v_keys || 'venue_missing'::text;
  END IF;
  IF p_starts IS NULL OR p_ends IS NULL OR p_ends <= p_starts OR p_ends > p_starts + interval '14 days'
    OR (p_check_start AND p_starts < clock_timestamp())
  THEN
    v_keys := v_keys || 'time_invalid'::text;
  END IF;
  IF p_deadline IS NOT NULL AND (p_deadline > p_starts OR (p_check_deadline AND p_deadline < clock_timestamp())) THEN
    v_keys := v_keys || 'deadline_invalid'::text;
  END IF;
  IF p_scope = 'blocks' AND NOT EXISTS (
    SELECT 1 FROM public.blocks AS block
    WHERE block.society_id = p_society_id AND block.active AND block.id = ANY (p_block_ids)
  ) THEN
    v_keys := v_keys || 'audience_empty'::text;
  END IF;
  RETURN v_keys;
END;
$$;
REVOKE ALL ON FUNCTION private.event_readiness(uuid, text, text, timestamptz, timestamptz, timestamptz, text, uuid[], boolean, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.event_store_audience(p_society_id uuid, p_event_id uuid, p_block_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.event_audience_blocks
  WHERE society_id = p_society_id AND event_id = p_event_id AND NOT (block_id = ANY (p_block_ids));
  INSERT INTO public.event_audience_blocks (society_id, event_id, block_id)
  SELECT p_society_id, p_event_id, chosen.id FROM unnest(p_block_ids) AS chosen(id)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.event_store_audience(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated, service_role;

-- Audience (D-63 §2): active units, either all of them or those in the chosen blocks.
CREATE FUNCTION private.event_audience_units(p_society_id uuid, p_event_id uuid)
RETURNS TABLE (unit_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT unit.id
  FROM public.events AS event
  JOIN public.units AS unit ON unit.society_id = event.society_id AND unit.active
  WHERE event.society_id = p_society_id AND event.id = p_event_id
    AND (event.audience_scope = 'all' OR EXISTS (
      SELECT 1 FROM public.event_audience_blocks AS chosen
      WHERE chosen.society_id = event.society_id AND chosen.event_id = event.id
        AND chosen.block_id = unit.block_id
    ))
$$;
REVOKE ALL ON FUNCTION private.event_audience_units(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Fan-out to active occupants of audience units (optionally plus units with an RSVP, or only going units).
CREATE FUNCTION private.event_notify(
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
        AND (p_with_rsvp_units OR (p_going_only AND rsvp.status = 'going'))
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
REVOKE ALL ON FUNCTION private.event_notify(uuid, uuid, text, text, boolean, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.event_rsvp_net(p_society_id uuid, p_rsvp_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(sum(CASE WHEN direction = 'debit' THEN amount_paise ELSE -amount_paise END), 0)::bigint
  FROM public.event_rsvp_charges WHERE society_id = p_society_id AND rsvp_id = p_rsvp_id
$$;
REVOKE ALL ON FUNCTION private.event_rsvp_net(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- One ledger entry plus its matching charge row; both always written together.
CREATE FUNCTION private.event_post_charge(
  p_society_id uuid, p_event_id uuid, p_rsvp_id uuid, p_unit_id uuid, p_direction text,
  p_amount bigint, p_reason text, p_title text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ledger_id bigint;
BEGIN
  INSERT INTO public.billing_ledger_entries (society_id, unit_id, kind, direction, amount_paise, reason, created_by)
  VALUES (p_society_id, p_unit_id, 'adjustment', p_direction, p_amount,
    CASE WHEN p_direction = 'debit' THEN 'Event contribution: ' ELSE 'Event refund: ' END || p_title,
    auth.uid())
  RETURNING id INTO v_ledger_id;
  INSERT INTO public.event_rsvp_charges (
    society_id, event_id, rsvp_id, unit_id, ledger_entry_id, direction, amount_paise, reason, created_by
  ) VALUES (
    p_society_id, p_event_id, p_rsvp_id, p_unit_id, v_ledger_id, p_direction, p_amount, p_reason, auth.uid()
  );
END;
$$;
REVOKE ALL ON FUNCTION private.event_post_charge(uuid, uuid, uuid, uuid, text, bigint, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.event_create(
  p_society_id uuid, p_client_request_id uuid, p_event jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_parsed jsonb;
  v_id uuid;
  v_version integer;
BEGIN
  PERFORM private.event_write_begin(p_society_id, ARRAY['admin', 'committee']::text[], p_request_id);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'The client request id is required.' USING ERRCODE = '22023';
  END IF;
  SELECT id, version INTO v_id, v_version FROM public.events
  WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('eventId', v_id, 'version', v_version);
  END IF;
  v_parsed := private.event_parse(p_society_id, p_event);
  INSERT INTO public.events (
    society_id, title, description, venue, starts_at, ends_at, rsvp_deadline, capacity, max_per_unit,
    contribution_type, contribution_paise, audience_scope, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, v_parsed ->> 'title', v_parsed ->> 'description', v_parsed ->> 'venue',
    (v_parsed ->> 'starts_at')::timestamptz, (v_parsed ->> 'ends_at')::timestamptz,
    (v_parsed ->> 'rsvp_deadline')::timestamptz, (v_parsed ->> 'capacity')::integer,
    (v_parsed ->> 'max_per_unit')::integer, v_parsed ->> 'contribution_type',
    (v_parsed ->> 'contribution_paise')::bigint, v_parsed ->> 'scope', p_client_request_id,
    auth.uid(), auth.uid()
  )
  ON CONFLICT ON CONSTRAINT events_client_request_key DO NOTHING
  RETURNING id, version INTO v_id, v_version;
  IF v_id IS NULL THEN
    SELECT id, version INTO v_id, v_version FROM public.events
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
    RETURN jsonb_build_object('eventId', v_id, 'version', v_version);
  END IF;
  PERFORM private.event_store_audience(p_society_id, v_id,
    ARRAY(SELECT jsonb_array_elements_text(v_parsed -> 'block_ids')::uuid));
  PERFORM private.event_audit(p_society_id, 'create', 'event', v_id,
    jsonb_build_object('title', v_parsed ->> 'title', 'audienceScope', v_parsed ->> 'scope',
      'contributionType', v_parsed ->> 'contribution_type'), p_request_id);
  RETURN jsonb_build_object('eventId', v_id, 'version', v_version);
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
      SELECT COALESCE(sum(headcount), 0) INTO v_going FROM public.event_rsvps
      WHERE society_id = p_society_id AND event_id = p_event_id AND status = 'going';
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
  IF v_changed THEN
    PERFORM private.event_notify(p_society_id, p_event_id, 'event_updated', 'Event updated', true, false,
      p_request_id);
  END IF;
  PERFORM private.event_audit(p_society_id, 'update', 'event', p_event_id,
    jsonb_build_object('status', v_event.status, 'materialChange', v_changed), p_request_id);
  RETURN jsonb_build_object('eventId', p_event_id, 'version', v_version, 'notified', v_changed);
END;
$$;

CREATE OR REPLACE FUNCTION public.event_draft_delete(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
BEGIN
  PERFORM private.event_write_begin(p_society_id, ARRAY['admin', 'committee']::text[], p_request_id);
  IF p_event_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The event and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_event FROM public.events
  WHERE society_id = p_society_id AND id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.version <> p_expected_version THEN
    RAISE EXCEPTION 'The event changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_event.status <> 'draft' THEN
    RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only draft events can be deleted; cancel a published event instead.';
  END IF;
  DELETE FROM public.event_audience_blocks WHERE society_id = p_society_id AND event_id = p_event_id;
  DELETE FROM public.events WHERE society_id = p_society_id AND id = p_event_id;
  PERFORM private.event_audit(p_society_id, 'draft_delete', 'event', p_event_id,
    jsonb_build_object('title', v_event.title), p_request_id);
  RETURN jsonb_build_object('deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.event_publish(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_keys text[];
  v_version integer;
  v_notified integer;
BEGIN
  PERFORM private.event_write_begin(p_society_id, ARRAY['admin', 'committee']::text[], p_request_id);
  IF p_event_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The event and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_event FROM public.events
  WHERE society_id = p_society_id AND id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.version <> p_expected_version THEN
    RAISE EXCEPTION 'The event changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_event.status <> 'draft' THEN
    RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001', DETAIL = 'Only draft events can be published.';
  END IF;
  v_keys := private.event_readiness(p_society_id, v_event.title, v_event.venue, v_event.starts_at,
    v_event.ends_at, v_event.rsvp_deadline, v_event.audience_scope,
    private.event_block_ids(p_society_id, p_event_id), true, true);
  IF cardinality(v_keys) > 0 THEN
    RAISE EXCEPTION 'event_not_ready' USING ERRCODE = 'P0001', DETAIL = array_to_string(v_keys, ',');
  END IF;
  IF v_event.contribution_type <> 'none' AND NOT private.module_enabled(p_society_id, 'billing') THEN
    RAISE EXCEPTION 'event_billing_required' USING ERRCODE = 'P0001',
      DETAIL = 'Contributions need the billing module to be turned on.';
  END IF;
  UPDATE public.events SET
    status = 'published',
    published_at = clock_timestamp(),
    published_by = auth.uid(),
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_event_id
  RETURNING version INTO v_version;
  v_notified := private.event_notify(p_society_id, p_event_id, 'event_published', 'New event', false, false,
    p_request_id);
  PERFORM private.event_audit(p_society_id, 'publish', 'event', p_event_id,
    jsonb_build_object('notified', v_notified), p_request_id);
  RETURN jsonb_build_object('eventId', p_event_id, 'version', v_version, 'notified', v_notified);
END;
$$;

CREATE OR REPLACE FUNCTION public.event_cancel(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_rsvp record;
  v_refunded integer := 0;
  v_version integer;
BEGIN
  PERFORM private.event_write_begin(p_society_id, ARRAY['admin', 'committee']::text[], p_request_id);
  IF p_event_id IS NULL OR p_expected_version IS NULL OR v_reason IS NULL OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'A cancellation reason of 1 to 500 characters is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_event FROM public.events
  WHERE society_id = p_society_id AND id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.version <> p_expected_version THEN
    RAISE EXCEPTION 'The event changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_event.status <> 'published' OR v_event.ends_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only published events that have not ended can be cancelled; delete a draft instead.';
  END IF;
  -- Refunds are credited even if billing was turned off since, so no flat is left out of pocket.
  FOR v_rsvp IN
    SELECT rsvp.id, rsvp.unit_id, private.event_rsvp_net(p_society_id, rsvp.id) AS net
    FROM public.event_rsvps AS rsvp
    WHERE rsvp.society_id = p_society_id AND rsvp.event_id = p_event_id
    ORDER BY rsvp.unit_id, rsvp.id
    FOR UPDATE OF rsvp
  LOOP
    IF v_rsvp.net > 0 THEN
      PERFORM private.event_post_charge(p_society_id, p_event_id, v_rsvp.id, v_rsvp.unit_id, 'credit',
        v_rsvp.net, 'event_cancelled', v_event.title);
      v_refunded := v_refunded + 1;
    END IF;
  END LOOP;
  UPDATE public.events SET
    status = 'cancelled',
    cancelled_at = clock_timestamp(),
    cancelled_by = auth.uid(),
    cancellation_reason = v_reason,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_event_id
  RETURNING version INTO v_version;
  PERFORM private.event_notify(p_society_id, p_event_id, 'event_cancelled', 'Event cancelled', true, false,
    p_request_id);
  PERFORM private.event_audit(p_society_id, 'cancel', 'event', p_event_id,
    jsonb_build_object('refundedUnits', v_refunded), p_request_id, v_reason);
  RETURN jsonb_build_object('eventId', p_event_id, 'version', v_version, 'refundedUnits', v_refunded);
END;
$$;

-- Visible to a resident: published/cancelled, and one of their actively occupied units is in the audience
-- or already holds an RSVP (kept after the audience is narrowed).
CREATE FUNCTION private.event_member_units(p_society_id uuid, p_event_id uuid)
RETURNS TABLE (unit_id uuid, unit_label text, in_audience boolean, rsvp_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT unit.id, left(COALESCE(block.name || '-', '') || unit.number, 100),
    unit.active AND (event.audience_scope = 'all' OR EXISTS (
      SELECT 1 FROM public.event_audience_blocks AS chosen
      WHERE chosen.society_id = event.society_id AND chosen.event_id = event.id AND chosen.block_id = unit.block_id
    )),
    rsvp.id
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
    AND (rsvp.id IS NOT NULL OR (unit.active AND (event.audience_scope = 'all' OR EXISTS (
      SELECT 1 FROM public.event_audience_blocks AS chosen
      WHERE chosen.society_id = event.society_id AND chosen.event_id = event.id AND chosen.block_id = unit.block_id
    ))))
$$;
REVOKE ALL ON FUNCTION private.event_member_units(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.event_rsvp_set(
  p_society_id uuid, p_event_id uuid, p_unit_id uuid, p_status text, p_headcount integer,
  p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_rsvp public.event_rsvps%ROWTYPE;
  v_exists boolean;
  v_headcount integer;
  v_old_going integer := 0;
  v_going bigint;
  v_net bigint := 0;
  v_target bigint := 0;
  v_id uuid;
  v_version integer;
BEGIN
  PERFORM private.event_write_begin(p_society_id, ARRAY['resident']::text[], p_request_id);
  IF p_event_id IS NULL OR p_unit_id IS NULL OR p_status IS NULL OR p_status NOT IN ('going', 'not_going')
    OR (p_status = 'going' AND (p_headcount IS NULL OR p_headcount NOT BETWEEN 1 AND 100))
    OR (p_status = 'not_going' AND COALESCE(p_headcount, 0) <> 0)
  THEN
    RAISE EXCEPTION 'Choose going with 1 to 100 people, or not going.' USING ERRCODE = '22023';
  END IF;
  v_headcount := CASE WHEN p_status = 'going' THEN p_headcount ELSE 0 END;
  -- The event row lock serialises every RSVP for this event so capacity is never overbooked.
  SELECT * INTO v_event FROM public.events
  WHERE society_id = p_society_id AND id = p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM private.event_member_units(p_society_id, p_event_id)) THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.event_member_units(p_society_id, p_event_id) AS mine WHERE mine.unit_id = p_unit_id
  ) THEN
    RAISE EXCEPTION 'event_not_in_audience' USING ERRCODE = 'P0001',
      DETAIL = 'You can only reply for a flat you live in that is invited to this event.';
  END IF;
  IF v_event.status <> 'published' OR clock_timestamp() >= COALESCE(v_event.rsvp_deadline, v_event.starts_at) THEN
    RAISE EXCEPTION 'event_rsvp_closed' USING ERRCODE = 'P0001', DETAIL = 'Replies for this event are closed.';
  END IF;
  SELECT * INTO v_rsvp FROM public.event_rsvps
  WHERE society_id = p_society_id AND event_id = p_event_id AND unit_id = p_unit_id FOR UPDATE;
  v_exists := FOUND;
  IF (v_exists AND v_rsvp.version IS DISTINCT FROM p_expected_version)
    OR (NOT v_exists AND p_expected_version IS NOT NULL)
  THEN
    RAISE EXCEPTION 'This reply changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_exists THEN
    v_net := private.event_rsvp_net(p_society_id, v_rsvp.id);
    IF v_rsvp.status = p_status AND v_rsvp.headcount = v_headcount THEN
      RETURN jsonb_build_object('rsvpId', v_rsvp.id, 'status', v_rsvp.status, 'headcount', v_rsvp.headcount,
        'version', v_rsvp.version, 'chargedPaise', v_net);
    END IF;
    IF v_rsvp.status = 'going' THEN
      v_old_going := v_rsvp.headcount;
    END IF;
  END IF;
  IF p_status = 'going' THEN
    IF v_event.max_per_unit IS NOT NULL AND v_headcount > v_event.max_per_unit THEN
      RAISE EXCEPTION 'event_headcount_limit' USING ERRCODE = 'P0001',
        DETAIL = format('Each flat can bring at most %s people.', v_event.max_per_unit);
    END IF;
    IF v_event.capacity IS NOT NULL AND v_headcount > v_old_going THEN
      SELECT COALESCE(sum(headcount), 0) INTO v_going FROM public.event_rsvps
      WHERE society_id = p_society_id AND event_id = p_event_id AND status = 'going';
      IF v_going - v_old_going + v_headcount > v_event.capacity THEN
        RAISE EXCEPTION 'event_full' USING ERRCODE = 'P0001', DETAIL = 'There are not enough spots left.';
      END IF;
    END IF;
    IF v_event.contribution_type <> 'none' AND NOT private.module_enabled(p_society_id, 'billing') THEN
      RAISE EXCEPTION 'event_billing_required' USING ERRCODE = 'P0001',
        DETAIL = 'Contributions need the billing module to be turned on.';
    END IF;
    v_target := CASE v_event.contribution_type
      WHEN 'per_unit' THEN v_event.contribution_paise
      WHEN 'per_head' THEN v_event.contribution_paise * v_headcount
      ELSE 0 END;
  END IF;

  IF v_exists THEN
    UPDATE public.event_rsvps SET
      status = p_status, headcount = v_headcount, responded_by = auth.uid(), responded_at = clock_timestamp(),
      version = version + 1
    WHERE society_id = p_society_id AND id = v_rsvp.id
    RETURNING id, version INTO v_id, v_version;
  ELSE
    INSERT INTO public.event_rsvps (society_id, event_id, unit_id, status, headcount, responded_by)
    VALUES (p_society_id, p_event_id, p_unit_id, p_status, v_headcount, auth.uid())
    RETURNING id, version INTO v_id, v_version;
  END IF;

  -- Replace the outstanding charge in full: credit what was charged, then debit the new amount.
  IF v_net <> v_target THEN
    IF v_net > 0 THEN
      PERFORM private.event_post_charge(p_society_id, p_event_id, v_id, p_unit_id, 'credit', v_net,
        CASE WHEN p_status = 'going' THEN 'headcount_change' ELSE 'withdrawn' END, v_event.title);
    END IF;
    IF v_target > 0 THEN
      PERFORM private.event_post_charge(p_society_id, p_event_id, v_id, p_unit_id, 'debit', v_target,
        CASE WHEN v_old_going > 0 THEN 'headcount_change' ELSE 'rsvp' END, v_event.title);
    END IF;
  END IF;
  PERFORM private.event_audit(p_society_id, 'rsvp_set', 'event_rsvp', v_id,
    jsonb_build_object('eventId', p_event_id, 'unitId', p_unit_id, 'status', p_status,
      'headcount', v_headcount, 'chargedPaise', v_target), p_request_id);
  RETURN jsonb_build_object('rsvpId', v_id, 'status', p_status, 'headcount', v_headcount,
    'version', v_version, 'chargedPaise', v_target);
END;
$$;
