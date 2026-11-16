-- Meetings & AGM (D-61): draft editing, scheduling, notice/quorum snapshots, cancellation, check-in and attendance.

-- JSON argument parsers: every malformed value is a 22023 argument error, never a cast failure.
CREATE FUNCTION private.meeting_json_text(p_value jsonb, p_max integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_result text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_value) <> 'string' THEN
    RAISE EXCEPTION 'A text value is invalid.' USING ERRCODE = '22023';
  END IF;
  v_result := NULLIF(btrim(p_value #>> '{}'), '');
  IF char_length(v_result) > p_max THEN
    RAISE EXCEPTION 'A text value is too long.' USING ERRCODE = '22023';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_json_text(jsonb, integer) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_json_uuid(p_value jsonb)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_value) <> 'string' THEN
    RAISE EXCEPTION 'An id is invalid.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    RETURN (p_value #>> '{}')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'An id is invalid.' USING ERRCODE = '22023';
  END;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_json_uuid(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_json_timestamp(p_value jsonb)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_result timestamptz;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_value) <> 'string' THEN
    RAISE EXCEPTION 'A timestamp is invalid.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_result := (p_value #>> '{}')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'A timestamp is invalid.' USING ERRCODE = '22023';
  END;
  IF NOT isfinite(v_result) THEN
    RAISE EXCEPTION 'A timestamp is invalid.' USING ERRCODE = '22023';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_json_timestamp(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_json_uuid_array(p_value jsonb, p_max integer)
RETURNS uuid[] LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_item jsonb;
  v_id uuid;
  v_result uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN v_result;
  END IF;
  IF jsonb_typeof(p_value) <> 'array' OR jsonb_array_length(p_value) > p_max THEN
    RAISE EXCEPTION 'An id list is invalid.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT element FROM jsonb_array_elements(p_value) AS element LOOP
    v_id := private.meeting_json_uuid(v_item);
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'An id list is invalid.' USING ERRCODE = '22023';
    END IF;
    IF NOT v_id = ANY (v_result) THEN
      v_result := v_result || v_id;
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_json_uuid_array(jsonb, integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- Normalises the full meeting input shape; incomplete drafts are allowed, lengths and types are not.
CREATE FUNCTION private.meeting_parse(p_meeting jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_type text;
  v_title text;
  v_online text;
  v_agenda jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_title text;
  v_invitees jsonb;
  v_scope text;
  v_unit_ids uuid[];
  v_membership_ids uuid[];
BEGIN
  IF p_meeting IS NULL OR jsonb_typeof(p_meeting) <> 'object'
    OR NOT (p_meeting ?& ARRAY['meetingType', 'title', 'agenda', 'invitees'])
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_meeting) AS input_key
      WHERE input_key NOT IN ('meetingType', 'title', 'description', 'startsAt', 'endsAt', 'venue',
        'onlineUrl', 'agenda', 'invitees')
    )
  THEN
    RAISE EXCEPTION 'The meeting details are invalid.' USING ERRCODE = '22023';
  END IF;
  v_type := private.meeting_json_text(p_meeting -> 'meetingType', 20);
  IF v_type IS NULL OR v_type NOT IN ('agm', 'sgm', 'committee') THEN
    RAISE EXCEPTION 'The meeting type is invalid.' USING ERRCODE = '22023';
  END IF;
  v_title := COALESCE(private.meeting_json_text(p_meeting -> 'title', 150), '');
  v_online := private.meeting_json_text(p_meeting -> 'onlineUrl', 500);
  IF v_online IS NOT NULL AND v_online !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'The online meeting link must be an https link.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_meeting -> 'agenda') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_meeting -> 'agenda') > 50
  THEN
    RAISE EXCEPTION 'The agenda is invalid.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT element FROM jsonb_array_elements(p_meeting -> 'agenda') AS element LOOP
    IF jsonb_typeof(v_item) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_item) AS input_key
      WHERE input_key NOT IN ('id', 'title', 'description')
    ) THEN
      RAISE EXCEPTION 'An agenda item is invalid.' USING ERRCODE = '22023';
    END IF;
    v_item_title := private.meeting_json_text(v_item -> 'title', 200);
    IF v_item_title IS NULL THEN
      RAISE EXCEPTION 'Every agenda item needs a title.' USING ERRCODE = '22023';
    END IF;
    v_agenda := v_agenda || jsonb_build_array(jsonb_build_object(
      'id', private.meeting_json_uuid(v_item -> 'id'),
      'title', v_item_title,
      'description', private.meeting_json_text(v_item -> 'description', 2000)
    ));
  END LOOP;

  v_invitees := p_meeting -> 'invitees';
  IF jsonb_typeof(v_invitees) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_invitees) AS input_key
    WHERE input_key NOT IN ('scope', 'unitIds', 'membershipIds')
  ) THEN
    RAISE EXCEPTION 'The invitees are invalid.' USING ERRCODE = '22023';
  END IF;
  v_scope := private.meeting_json_text(v_invitees -> 'scope', 10);
  IF v_scope IS NULL OR v_scope NOT IN ('default', 'custom') THEN
    RAISE EXCEPTION 'The invitee scope is invalid.' USING ERRCODE = '22023';
  END IF;
  v_unit_ids := private.meeting_json_uuid_array(v_invitees -> 'unitIds', 5000);
  v_membership_ids := private.meeting_json_uuid_array(v_invitees -> 'membershipIds', 5000);
  IF v_scope = 'default' THEN
    v_unit_ids := ARRAY[]::uuid[];
    v_membership_ids := ARRAY[]::uuid[];
  ELSIF (v_type = 'committee' AND cardinality(v_unit_ids) > 0)
    OR (v_type <> 'committee' AND cardinality(v_membership_ids) > 0)
  THEN
    RAISE EXCEPTION 'The invitees do not match the meeting type.' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'meeting_type', v_type,
    'title', v_title,
    'description', private.meeting_json_text(p_meeting -> 'description', 4000),
    'starts_at', private.meeting_json_timestamp(p_meeting -> 'startsAt'),
    'ends_at', private.meeting_json_timestamp(p_meeting -> 'endsAt'),
    'venue', private.meeting_json_text(p_meeting -> 'venue', 200),
    'online_url', v_online,
    'agenda', v_agenda,
    'scope', v_scope,
    'unit_ids', to_jsonb(v_unit_ids),
    'membership_ids', to_jsonb(v_membership_ids)
  );
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_parse(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Invitee candidates: default = every active unit / active committee member; custom = the stored selection.
CREATE FUNCTION private.meeting_candidate_units(p_society_id uuid, p_meeting_id uuid, p_scope text)
RETURNS TABLE (unit_id uuid, unit_label text, block_id uuid, block_name text, floor integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT unit.id, left(COALESCE(block.name || '-', '') || unit.number, 100), block.id, block.name, unit.floor
  FROM public.units AS unit
  LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
  WHERE unit.society_id = p_society_id AND unit.active
    AND (unit.block_id IS NULL OR block.active)
    AND (p_scope = 'default' OR EXISTS (
      SELECT 1 FROM public.meeting_invitee_selections AS selection
      WHERE selection.society_id = p_society_id AND selection.meeting_id = p_meeting_id
        AND selection.unit_id = unit.id
    ))
$$;
REVOKE ALL ON FUNCTION private.meeting_candidate_units(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_candidate_members(p_society_id uuid, p_meeting_id uuid, p_scope text)
RETURNS TABLE (membership_id uuid, member_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT membership.id, left(COALESCE(NULLIF(btrim(profile.full_name), ''), 'Member'), 120)
  FROM public.memberships AS membership
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  WHERE membership.society_id = p_society_id AND membership.status = 'active'
    AND 'committee' = ANY (membership.roles)
    AND (p_scope = 'default' OR EXISTS (
      SELECT 1 FROM public.meeting_invitee_selections AS selection
      WHERE selection.society_id = p_society_id AND selection.meeting_id = p_meeting_id
        AND selection.membership_id = membership.id
    ))
$$;
REVOKE ALL ON FUNCTION private.meeting_candidate_members(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_candidate_count(
  p_society_id uuid, p_meeting_id uuid, p_type text, p_scope text
)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_type = 'committee'
    THEN (SELECT count(*)::integer FROM private.meeting_candidate_members(p_society_id, p_meeting_id, p_scope))
    ELSE (SELECT count(*)::integer FROM private.meeting_candidate_units(p_society_id, p_meeting_id, p_scope))
  END
$$;
REVOKE ALL ON FUNCTION private.meeting_candidate_count(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Replaces the agenda (keeping rows whose id is supplied) and the custom invitee selection.
CREATE FUNCTION private.meeting_store_plan(p_society_id uuid, p_meeting_id uuid, p_parsed jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_keep uuid[];
  v_item jsonb;
  v_position integer;
  v_item_id uuid;
  v_unit_ids uuid[];
  v_membership_ids uuid[];
BEGIN
  v_keep := ARRAY(
    SELECT (element ->> 'id')::uuid FROM jsonb_array_elements(p_parsed -> 'agenda') AS element
    WHERE element ->> 'id' IS NOT NULL
  );
  IF cardinality(v_keep) <> (SELECT count(DISTINCT kept) FROM unnest(v_keep) AS kept)
    OR EXISTS (
      SELECT 1 FROM unnest(v_keep) AS kept
      WHERE NOT EXISTS (
        SELECT 1 FROM public.meeting_agenda_items AS agenda
        WHERE agenda.society_id = p_society_id AND agenda.meeting_id = p_meeting_id AND agenda.id = kept
      )
    )
  THEN
    RAISE EXCEPTION 'An agenda item id is invalid.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.meeting_agenda_items AS agenda
  WHERE agenda.society_id = p_society_id AND agenda.meeting_id = p_meeting_id
    AND NOT agenda.id = ANY (v_keep);
  FOR v_item, v_position IN
    SELECT element, ordinality::integer
    FROM jsonb_array_elements(p_parsed -> 'agenda') WITH ORDINALITY AS item(element, ordinality)
  LOOP
    v_item_id := (v_item ->> 'id')::uuid;
    IF v_item_id IS NULL THEN
      INSERT INTO public.meeting_agenda_items (society_id, meeting_id, position, title, description)
      VALUES (p_society_id, p_meeting_id, v_position, v_item ->> 'title', v_item ->> 'description');
    ELSE
      UPDATE public.meeting_agenda_items
      SET position = v_position, title = v_item ->> 'title', description = v_item ->> 'description'
      WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND id = v_item_id;
    END IF;
  END LOOP;

  v_unit_ids := ARRAY(SELECT jsonb_array_elements_text(p_parsed -> 'unit_ids')::uuid);
  v_membership_ids := ARRAY(SELECT jsonb_array_elements_text(p_parsed -> 'membership_ids')::uuid);
  IF EXISTS (
    SELECT 1 FROM unnest(v_unit_ids) AS chosen
    WHERE NOT EXISTS (
      SELECT 1 FROM private.meeting_candidate_units(p_society_id, p_meeting_id, 'default') AS candidate
      WHERE candidate.unit_id = chosen
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_membership_ids) AS chosen
    WHERE NOT EXISTS (
      SELECT 1 FROM private.meeting_candidate_members(p_society_id, p_meeting_id, 'default') AS candidate
      WHERE candidate.membership_id = chosen
    )
  ) THEN
    RAISE EXCEPTION 'An invitee is not an active unit or committee member.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.meeting_invitee_selections
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
  INSERT INTO public.meeting_invitee_selections (society_id, meeting_id, unit_id)
  SELECT p_society_id, p_meeting_id, chosen FROM unnest(v_unit_ids) AS chosen;
  INSERT INTO public.meeting_invitee_selections (society_id, meeting_id, membership_id)
  SELECT p_society_id, p_meeting_id, chosen FROM unnest(v_membership_ids) AS chosen;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_store_plan(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_readiness(
  p_title text, p_starts timestamptz, p_ends timestamptz, p_venue text, p_online text,
  p_agenda_count integer, p_invitee_count integer, p_check_past boolean
)
RETURNS text[] LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN COALESCE(p_title, '') = '' THEN 'title_missing' END,
    CASE WHEN p_starts IS NULL OR p_ends IS NULL OR p_ends <= p_starts
      OR p_ends > p_starts + interval '24 hours'
      OR (p_check_past AND p_starts <= clock_timestamp()) THEN 'time_invalid' END,
    CASE WHEN p_venue IS NULL AND p_online IS NULL THEN 'place_missing' END,
    CASE WHEN COALESCE(p_agenda_count, 0) = 0 THEN 'agenda_missing' END,
    CASE WHEN COALESCE(p_invitee_count, 0) = 0 THEN 'invitees_empty' END
  ]::text[], NULL)
$$;
REVOKE ALL ON FUNCTION private.meeting_readiness(text, timestamptz, timestamptz, text, text, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- Notice = whole society-local calendar days from today to the meeting date (warning only).
CREATE FUNCTION private.meeting_notice(p_society_id uuid, p_type text, p_starts timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('requiredDays', notice.required, 'givenDays', notice.given,
    'short', notice.given < notice.required)
  FROM (
    SELECT (private.meeting_settings(p_society_id) ->> ('notice_days_' || p_type))::integer AS required,
      GREATEST(0, (p_starts AT TIME ZONE COALESCE((
        SELECT society.timezone FROM public.societies AS society WHERE society.id = p_society_id
      ), 'Asia/Kolkata'))::date - private.meeting_today(p_society_id)) AS given
  ) AS notice
$$;
REVOKE ALL ON FUNCTION private.meeting_notice(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- Re-materialises invited rows from the current candidates (meeting must be scheduled).
-- Attendance for invitees who drop out is removed and audited row by row (attendance.remove).
CREATE FUNCTION private.meeting_materialise(p_society_id uuid, p_meeting_id uuid, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_type text;
  v_scope text;
  v_removed jsonb;
BEGIN
  SELECT meeting_type, invitee_scope INTO v_type, v_scope FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id;
  IF v_type = 'committee' THEN
    FOR v_removed IN
      DELETE FROM public.meeting_attendance AS attendance
      WHERE attendance.society_id = p_society_id AND attendance.meeting_id = p_meeting_id
        AND attendance.membership_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM private.meeting_candidate_members(p_society_id, p_meeting_id, v_scope) AS candidate
          WHERE candidate.membership_id = attendance.membership_id
        )
      RETURNING jsonb_build_object('attendeeId', attendance.membership_id, 'mode', attendance.mode,
        'proxyName', attendance.proxy_name, 'cause', 'invitee_removed')
    LOOP
      PERFORM private.meeting_audit(p_society_id, 'attendance.remove', 'meeting', p_meeting_id,
        v_removed, p_request_id);
    END LOOP;
    DELETE FROM public.meeting_invited_members AS invited
    WHERE invited.society_id = p_society_id AND invited.meeting_id = p_meeting_id
      AND NOT EXISTS (
        SELECT 1 FROM private.meeting_candidate_members(p_society_id, p_meeting_id, v_scope) AS candidate
        WHERE candidate.membership_id = invited.membership_id
      );
    INSERT INTO public.meeting_invited_members (society_id, meeting_id, membership_id, member_name)
    SELECT p_society_id, p_meeting_id, candidate.membership_id, candidate.member_name
    FROM private.meeting_candidate_members(p_society_id, p_meeting_id, v_scope) AS candidate
    ON CONFLICT DO NOTHING;
  ELSE
    FOR v_removed IN
      DELETE FROM public.meeting_attendance AS attendance
      WHERE attendance.society_id = p_society_id AND attendance.meeting_id = p_meeting_id
        AND attendance.unit_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM private.meeting_candidate_units(p_society_id, p_meeting_id, v_scope) AS candidate
          WHERE candidate.unit_id = attendance.unit_id
        )
      RETURNING jsonb_build_object('attendeeId', attendance.unit_id, 'mode', attendance.mode,
        'proxyName', attendance.proxy_name, 'cause', 'invitee_removed')
    LOOP
      PERFORM private.meeting_audit(p_society_id, 'attendance.remove', 'meeting', p_meeting_id,
        v_removed, p_request_id);
    END LOOP;
    DELETE FROM public.meeting_invited_units AS invited
    WHERE invited.society_id = p_society_id AND invited.meeting_id = p_meeting_id
      AND NOT EXISTS (
        SELECT 1 FROM private.meeting_candidate_units(p_society_id, p_meeting_id, v_scope) AS candidate
        WHERE candidate.unit_id = invited.unit_id
      );
    INSERT INTO public.meeting_invited_units (society_id, meeting_id, unit_id, unit_label)
    SELECT p_society_id, p_meeting_id, candidate.unit_id, candidate.unit_label
    FROM private.meeting_candidate_units(p_society_id, p_meeting_id, v_scope) AS candidate
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_materialise(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Fan-out to invitees (unit meetings: active occupants of invited units; committee: invited members), capped.
CREATE FUNCTION private.meeting_notify_invitees(
  p_society_id uuid, p_meeting_id uuid, p_type text, p_title text, p_request_id text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_body text;
  v_recipient record;
  v_sent integer := 0;
BEGIN
  SELECT left(meeting.title || COALESCE(' on ' || to_char(meeting.starts_at AT TIME ZONE
      COALESCE(society.timezone, 'Asia/Kolkata'), 'DD Mon YYYY, HH24:MI'), ''), 300)
  INTO v_body
  FROM public.meetings AS meeting
  JOIN public.societies AS society ON society.id = meeting.society_id
  WHERE meeting.society_id = p_society_id AND meeting.id = p_meeting_id;

  FOR v_recipient IN
    SELECT recipient.user_id, bool_or(recipient.management) AS management
    FROM (
      SELECT membership.user_id, membership.roles && ARRAY['admin', 'committee']::text[] AS management
      FROM public.meeting_invited_units AS invited
      JOIN public.unit_occupants AS occupant
        ON occupant.society_id = invited.society_id AND occupant.unit_id = invited.unit_id
        AND occupant.status = 'active'
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
        AND membership.status = 'active' AND membership.user_id IS NOT NULL
      WHERE invited.society_id = p_society_id AND invited.meeting_id = p_meeting_id
      UNION ALL
      SELECT membership.user_id, true
      FROM public.meeting_invited_members AS invited
      JOIN public.memberships AS membership
        ON membership.society_id = invited.society_id AND membership.id = invited.membership_id
        AND membership.status = 'active' AND membership.user_id IS NOT NULL
      WHERE invited.society_id = p_society_id AND invited.meeting_id = p_meeting_id
    ) AS recipient
    GROUP BY recipient.user_id
    ORDER BY recipient.user_id
    LIMIT 2000
  LOOP
    PERFORM private.create_notification(
      p_society_id, v_recipient.user_id, p_type, p_title, v_body,
      CASE WHEN v_recipient.management THEN 'meeting_admin' ELSE 'meeting' END,
      p_meeting_id, p_request_id
    );
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_notify_invitees(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meeting_create(
  p_society_id uuid, p_client_request_id text, p_meeting jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_parsed jsonb;
  v_id uuid;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_client_request_id IS NULL OR char_length(btrim(p_client_request_id)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'The client request id is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT id, version INTO v_id, v_version FROM public.meetings
  WHERE society_id = p_society_id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('meetingId', v_id, 'version', v_version);
  END IF;
  v_parsed := private.meeting_parse(p_meeting);
  INSERT INTO public.meetings (
    society_id, meeting_type, title, description, starts_at, ends_at, venue, online_url,
    invitee_scope, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, v_parsed ->> 'meeting_type', v_parsed ->> 'title', v_parsed ->> 'description',
    (v_parsed ->> 'starts_at')::timestamptz, (v_parsed ->> 'ends_at')::timestamptz,
    v_parsed ->> 'venue', v_parsed ->> 'online_url', v_parsed ->> 'scope', p_client_request_id,
    auth.uid(), auth.uid()
  )
  ON CONFLICT ON CONSTRAINT meetings_client_request_key DO NOTHING
  RETURNING id, version INTO v_id, v_version;
  IF v_id IS NULL THEN
    SELECT id, version INTO v_id, v_version FROM public.meetings
    WHERE society_id = p_society_id AND client_request_id = p_client_request_id;
    RETURN jsonb_build_object('meetingId', v_id, 'version', v_version);
  END IF;
  PERFORM private.meeting_store_plan(p_society_id, v_id, v_parsed);
  PERFORM private.meeting_audit(p_society_id, 'create', 'meeting', v_id,
    jsonb_build_object('meetingType', v_parsed ->> 'meeting_type', 'title', v_parsed ->> 'title',
      'inviteeScope', v_parsed ->> 'scope'), p_request_id);
  RETURN jsonb_build_object('meetingId', v_id, 'version', v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_update(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_meeting jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_parsed jsonb;
  v_starts timestamptz;
  v_ends timestamptz;
  v_keys text[];
  v_changed boolean := false;
  v_notice jsonb;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The meeting and version are required.' USING ERRCODE = '22023';
  END IF;
  v_parsed := private.meeting_parse(p_meeting);
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_meeting.version <> p_expected_version THEN
    RAISE EXCEPTION 'The meeting changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_meeting.status NOT IN ('draft', 'scheduled')
    OR (v_meeting.status = 'scheduled' AND v_parsed ->> 'meeting_type' <> v_meeting.meeting_type)
  THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only draft or scheduled meetings can be edited, and the type is fixed once scheduled.';
  END IF;
  PERFORM private.meeting_store_plan(p_society_id, p_meeting_id, v_parsed);
  v_starts := (v_parsed ->> 'starts_at')::timestamptz;
  v_ends := (v_parsed ->> 'ends_at')::timestamptz;
  IF v_meeting.status = 'scheduled' THEN
    v_changed := v_starts IS DISTINCT FROM v_meeting.starts_at OR v_ends IS DISTINCT FROM v_meeting.ends_at
      OR (v_parsed ->> 'venue') IS DISTINCT FROM v_meeting.venue
      OR (v_parsed ->> 'online_url') IS DISTINCT FROM v_meeting.online_url;
    v_keys := private.meeting_readiness(
      v_parsed ->> 'title', v_starts, v_ends, v_parsed ->> 'venue', v_parsed ->> 'online_url',
      jsonb_array_length(v_parsed -> 'agenda'),
      private.meeting_candidate_count(p_society_id, p_meeting_id, v_meeting.meeting_type, v_parsed ->> 'scope'),
      v_starts IS DISTINCT FROM v_meeting.starts_at
    );
    IF cardinality(v_keys) > 0 THEN
      RAISE EXCEPTION 'meeting_not_ready' USING ERRCODE = 'P0001', DETAIL = array_to_string(v_keys, ',');
    END IF;
    IF v_changed THEN
      v_notice := private.meeting_notice(p_society_id, v_meeting.meeting_type, v_starts);
    END IF;
  END IF;
  UPDATE public.meetings SET
    meeting_type = v_parsed ->> 'meeting_type',
    title = v_parsed ->> 'title',
    description = v_parsed ->> 'description',
    starts_at = v_starts,
    ends_at = v_ends,
    venue = v_parsed ->> 'venue',
    online_url = v_parsed ->> 'online_url',
    invitee_scope = v_parsed ->> 'scope',
    notice_required_days = COALESCE((v_notice ->> 'requiredDays')::integer, notice_required_days),
    notice_given_days = COALESCE((v_notice ->> 'givenDays')::integer, notice_given_days),
    rescheduled_at = CASE WHEN v_changed THEN clock_timestamp() ELSE rescheduled_at END,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_meeting_id
  RETURNING version INTO v_version;
  IF v_meeting.status = 'scheduled' THEN
    PERFORM private.meeting_materialise(p_society_id, p_meeting_id, p_request_id);
    IF v_changed THEN
      PERFORM private.meeting_notify_invitees(p_society_id, p_meeting_id, 'meeting_rescheduled',
        'Meeting rescheduled', p_request_id);
    END IF;
  END IF;
  PERFORM private.meeting_audit(p_society_id, 'update', 'meeting', p_meeting_id,
    jsonb_build_object('status', v_meeting.status, 'rescheduled', v_changed, 'notice', v_notice), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'version', v_version,
    'rescheduled', v_changed, 'notice', v_notice);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_draft_delete(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The meeting and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_meeting.version <> p_expected_version THEN
    RAISE EXCEPTION 'The meeting changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_meeting.status <> 'draft' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only draft meetings can be deleted; cancel a scheduled meeting instead.';
  END IF;
  -- Actions need a scheduled or held meeting, so a draft never has any; refuse rather than drop them.
  IF EXISTS (SELECT 1 FROM public.meeting_action_items WHERE society_id = p_society_id AND meeting_id = p_meeting_id) THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'A meeting with assigned action items cannot be deleted.';
  END IF;
  DELETE FROM public.meeting_resolutions WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
  DELETE FROM public.meeting_agenda_items WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
  DELETE FROM public.meeting_invitee_selections WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
  DELETE FROM public.meetings WHERE society_id = p_society_id AND id = p_meeting_id;
  PERFORM private.meeting_audit(p_society_id, 'draft_delete', 'meeting', p_meeting_id,
    jsonb_build_object('title', v_meeting.title, 'meetingType', v_meeting.meeting_type), p_request_id);
  RETURN jsonb_build_object('deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_schedule(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_keys text[];
  v_notice jsonb;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The meeting and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_meeting.version <> p_expected_version THEN
    RAISE EXCEPTION 'The meeting changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_meeting.status <> 'draft' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only draft meetings can be scheduled.';
  END IF;
  v_keys := private.meeting_readiness(
    v_meeting.title, v_meeting.starts_at, v_meeting.ends_at, v_meeting.venue, v_meeting.online_url,
    (SELECT count(*)::integer FROM public.meeting_agenda_items
      WHERE society_id = p_society_id AND meeting_id = p_meeting_id),
    private.meeting_candidate_count(p_society_id, p_meeting_id, v_meeting.meeting_type, v_meeting.invitee_scope),
    true
  );
  IF cardinality(v_keys) > 0 THEN
    RAISE EXCEPTION 'meeting_not_ready' USING ERRCODE = 'P0001', DETAIL = array_to_string(v_keys, ',');
  END IF;
  v_notice := private.meeting_notice(p_society_id, v_meeting.meeting_type, v_meeting.starts_at);
  UPDATE public.meetings SET
    status = 'scheduled',
    scheduled_at = clock_timestamp(),
    notice_required_days = (v_notice ->> 'requiredDays')::integer,
    notice_given_days = (v_notice ->> 'givenDays')::integer,
    quorum_percent = (private.meeting_settings(p_society_id) ->> CASE WHEN v_meeting.meeting_type = 'committee'
      THEN 'quorum_percent_committee' ELSE 'quorum_percent_units' END)::integer,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_meeting_id
  RETURNING version INTO v_version;
  PERFORM private.meeting_materialise(p_society_id, p_meeting_id, p_request_id);
  PERFORM private.meeting_notify_invitees(p_society_id, p_meeting_id, 'meeting_scheduled',
    'Meeting scheduled', p_request_id);
  PERFORM private.meeting_audit(p_society_id, 'schedule', 'meeting', p_meeting_id,
    jsonb_build_object('notice', v_notice), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'version', v_version, 'notice', v_notice);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_cancel(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_expected_version IS NULL OR v_reason IS NULL
    OR char_length(v_reason) > 500
  THEN
    RAISE EXCEPTION 'A cancellation reason of 1 to 500 characters is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_meeting.version <> p_expected_version THEN
    RAISE EXCEPTION 'The meeting changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_meeting.status <> 'scheduled' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only scheduled meetings can be cancelled; delete a draft instead.';
  END IF;
  UPDATE public.meetings SET
    status = 'cancelled',
    checkin_open = false,
    checkin_closed_at = CASE WHEN checkin_open THEN clock_timestamp() ELSE checkin_closed_at END,
    cancelled_at = clock_timestamp(),
    cancelled_by = auth.uid(),
    cancellation_reason = v_reason,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_meeting_id
  RETURNING version INTO v_version;
  PERFORM private.meeting_notify_invitees(p_society_id, p_meeting_id, 'meeting_cancelled',
    'Meeting cancelled', p_request_id);
  PERFORM private.meeting_audit(p_society_id, 'cancel', 'meeting', p_meeting_id,
    jsonb_build_object('status', 'cancelled'), p_request_id, v_reason);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'version', v_version);
END;
$$;

-- Toggling check-in does not change the meeting version, so open edit forms are not invalidated.
CREATE OR REPLACE FUNCTION public.meeting_checkin_set(
  p_society_id uuid, p_meeting_id uuid, p_open boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_open IS NULL THEN
    RAISE EXCEPTION 'The meeting and check-in state are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT p_open THEN
    IF v_meeting.checkin_open THEN
      UPDATE public.meetings SET checkin_open = false, checkin_closed_at = v_now,
        updated_by = auth.uid(), updated_at = v_now
      WHERE society_id = p_society_id AND id = p_meeting_id;
      PERFORM private.meeting_audit(p_society_id, 'checkin.close', 'meeting', p_meeting_id,
        jsonb_build_object('checkinOpen', false), p_request_id);
    END IF;
    RETURN jsonb_build_object('meetingId', p_meeting_id, 'checkinOpen', false);
  END IF;
  IF v_meeting.meeting_type = 'committee' OR v_meeting.status <> 'scheduled' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Self check-in is only for scheduled AGM or SGM meetings.';
  END IF;
  IF v_now < v_meeting.starts_at - interval '60 minutes' OR v_now > v_meeting.ends_at THEN
    RAISE EXCEPTION 'meeting_checkin_window' USING ERRCODE = 'P0001',
      DETAIL = 'Check-in opens from one hour before the start until the meeting ends.';
  END IF;
  IF NOT v_meeting.checkin_open THEN
    UPDATE public.meetings SET checkin_open = true, checkin_opened_at = v_now,
      updated_by = auth.uid(), updated_at = v_now
    WHERE society_id = p_society_id AND id = p_meeting_id;
    PERFORM private.meeting_audit(p_society_id, 'checkin.open', 'meeting', p_meeting_id,
      jsonb_build_object('checkinOpen', true), p_request_id);
  END IF;
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'checkinOpen', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_mark_held(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The meeting and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_meeting.version <> p_expected_version THEN
    RAISE EXCEPTION 'The meeting changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF v_meeting.status <> 'scheduled' OR clock_timestamp() < v_meeting.starts_at THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only a scheduled meeting that has started can be marked held.';
  END IF;
  UPDATE public.meetings SET
    status = 'held',
    held_at = clock_timestamp(),
    held_by = auth.uid(),
    checkin_open = false,
    checkin_closed_at = CASE WHEN checkin_open THEN clock_timestamp() ELSE checkin_closed_at END,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_meeting_id
  RETURNING version INTO v_version;
  PERFORM private.meeting_audit(p_society_id, 'mark_held', 'meeting', p_meeting_id,
    jsonb_build_object('status', 'held'), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'version', v_version);
END;
$$;

-- Admin attendance is open from an hour before the start while scheduled, and after the meeting until
-- minutes are published. The meeting row is share-locked so publishing and marking held serialise with it.
CREATE FUNCTION private.meeting_attendance_target(
  p_society_id uuid, p_meeting_id uuid, p_attendee_id uuid
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
BEGIN
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    (v_meeting.status = 'scheduled' AND clock_timestamp() >= v_meeting.starts_at - interval '60 minutes')
    OR (v_meeting.status = 'held' AND NOT EXISTS (
      SELECT 1 FROM public.meeting_minutes AS minutes
      WHERE minutes.society_id = p_society_id AND minutes.meeting_id = p_meeting_id
        AND minutes.status = 'published'
    ))
  ) THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Attendance opens an hour before the start and closes when minutes are published.';
  END IF;
  IF v_meeting.meeting_type = 'committee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.meeting_invited_members
      WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND membership_id = p_attendee_id
    ) THEN
      RAISE EXCEPTION 'meeting_not_invited' USING ERRCODE = 'P0001',
        DETAIL = 'This member is not invited to the meeting.';
    END IF;
    RETURN 'member';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_invited_units
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND unit_id = p_attendee_id
  ) THEN
    RAISE EXCEPTION 'meeting_not_invited' USING ERRCODE = 'P0001',
      DETAIL = 'This unit is not invited to the meeting.';
  END IF;
  RETURN 'unit';
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_attendance_target(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meeting_attendance_set(
  p_society_id uuid, p_meeting_id uuid, p_attendee_id uuid, p_mode text, p_proxy_name text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_proxy text := NULLIF(btrim(p_proxy_name), '');
  v_kind text;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_attendee_id IS NULL OR p_mode IS NULL
    OR p_mode NOT IN ('in_person', 'online', 'proxy')
  THEN
    RAISE EXCEPTION 'The attendance mode is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_mode = 'proxy' THEN
    IF v_proxy IS NULL OR char_length(v_proxy) > 120 THEN
      RAISE EXCEPTION 'A proxy name of 1 to 120 characters is required.' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_proxy := NULL;
  END IF;
  v_kind := private.meeting_attendance_target(p_society_id, p_meeting_id, p_attendee_id);
  IF v_kind = 'unit' THEN
    INSERT INTO public.meeting_attendance (
      society_id, meeting_id, unit_id, mode, proxy_name, checked_in_by, recorded_by, recorded_at
    ) VALUES (
      p_society_id, p_meeting_id, p_attendee_id, p_mode, v_proxy, NULL, auth.uid(), clock_timestamp()
    )
    ON CONFLICT ON CONSTRAINT meeting_attendance_unit_key DO UPDATE SET
      mode = EXCLUDED.mode, proxy_name = EXCLUDED.proxy_name, checked_in_by = NULL,
      recorded_by = EXCLUDED.recorded_by, recorded_at = EXCLUDED.recorded_at;
  ELSE
    INSERT INTO public.meeting_attendance (
      society_id, meeting_id, membership_id, mode, proxy_name, checked_in_by, recorded_by, recorded_at
    ) VALUES (
      p_society_id, p_meeting_id, p_attendee_id, p_mode, v_proxy, NULL, auth.uid(), clock_timestamp()
    )
    ON CONFLICT ON CONSTRAINT meeting_attendance_member_key DO UPDATE SET
      mode = EXCLUDED.mode, proxy_name = EXCLUDED.proxy_name, checked_in_by = NULL,
      recorded_by = EXCLUDED.recorded_by, recorded_at = EXCLUDED.recorded_at;
  END IF;
  PERFORM private.meeting_audit(p_society_id, 'attendance.set', 'meeting', p_meeting_id,
    jsonb_build_object('attendeeId', p_attendee_id, 'mode', p_mode, 'proxyName', v_proxy), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'attendeeId', p_attendee_id, 'mode', p_mode);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_attendance_remove(
  p_society_id uuid, p_meeting_id uuid, p_attendee_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_removed jsonb;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_attendee_id IS NULL THEN
    RAISE EXCEPTION 'The meeting and attendee are required.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.meeting_attendance_target(p_society_id, p_meeting_id, p_attendee_id);
  DELETE FROM public.meeting_attendance
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id
    AND (unit_id = p_attendee_id OR membership_id = p_attendee_id)
  RETURNING jsonb_build_object('attendeeId', p_attendee_id, 'mode', mode, 'proxyName', proxy_name)
  INTO v_removed;
  IF v_removed IS NOT NULL THEN
    PERFORM private.meeting_audit(p_society_id, 'attendance.remove', 'meeting', p_meeting_id,
      v_removed, p_request_id);
  END IF;
  RETURN jsonb_build_object('removed', v_removed IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_self_checkin(
  p_society_id uuid, p_meeting_id uuid, p_unit_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_inserted uuid;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['resident']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_unit_id IS NULL THEN
    RAISE EXCEPTION 'The meeting and unit are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR SHARE;
  -- Callers who cannot see the meeting get the same answer as for a missing one.
  IF NOT FOUND OR v_meeting.status = 'draft' OR v_meeting.meeting_type = 'committee'
    OR NOT private.meeting_member_visible(p_society_id, p_meeting_id)
  THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_invited_units AS invited
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = invited.society_id AND occupant.unit_id = invited.unit_id
      AND occupant.status = 'active' AND occupant.relationship IN ('owner', 'tenant')
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
      AND membership.status = 'active' AND membership.user_id = auth.uid()
    WHERE invited.society_id = p_society_id AND invited.meeting_id = p_meeting_id
      AND invited.unit_id = p_unit_id
  ) THEN
    RAISE EXCEPTION 'meeting_not_invited' USING ERRCODE = 'P0001',
      DETAIL = 'Only an owner or tenant of an invited unit can check that unit in.';
  END IF;
  IF v_meeting.status <> 'scheduled' OR NOT v_meeting.checkin_open
    OR v_now < v_meeting.starts_at - interval '60 minutes' OR v_now > v_meeting.ends_at
  THEN
    RAISE EXCEPTION 'meeting_checkin_closed' USING ERRCODE = 'P0001',
      DETAIL = 'Self check-in is not open for this meeting.';
  END IF;
  INSERT INTO public.meeting_attendance (
    society_id, meeting_id, unit_id, mode, proxy_name, checked_in_by, recorded_by, recorded_at
  ) VALUES (
    p_society_id, p_meeting_id, p_unit_id, 'self', NULL, auth.uid(), auth.uid(), v_now
  )
  ON CONFLICT ON CONSTRAINT meeting_attendance_unit_key DO NOTHING
  RETURNING id INTO v_inserted;
  IF v_inserted IS NOT NULL THEN
    PERFORM private.meeting_audit(p_society_id, 'attendance.self_checkin', 'meeting', p_meeting_id,
      jsonb_build_object('attendeeId', p_unit_id, 'mode', 'self'), p_request_id);
  END IF;
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'unitId', p_unit_id, 'present', true,
    'alreadyPresent', v_inserted IS NULL);
END;
$$;

-- Settings updates merge over the stored object; the full object with defaults is returned.
CREATE OR REPLACE FUNCTION public.meeting_settings_update(p_society_id uuid, p_settings jsonb, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_previous jsonb;
  v_next jsonb;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_settings IS NULL OR NOT private.meeting_settings_valid(p_settings) THEN
    RAISE EXCEPTION 'Meeting settings are invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT settings INTO v_previous FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'meeting' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting settings are unavailable.' USING ERRCODE = 'P0002';
  END IF;
  v_next := COALESCE(v_previous, '{}'::jsonb) || p_settings;
  UPDATE public.module_configs SET settings = v_next, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'meeting';
  PERFORM private.meeting_audit(p_society_id, 'settings.update', 'meeting_settings', NULL,
    v_next, p_request_id);
  RETURN private.meeting_settings(p_society_id);
END;
$$;
