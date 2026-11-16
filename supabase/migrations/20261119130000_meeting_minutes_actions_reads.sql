-- Meetings & AGM (D-61): resolutions, minutes, document copy link, action items, reminders and read models.

-- Quorum: drafts preview the would-be invitee count; scheduled and later meetings use the frozen invitee rows
-- and the snapshot percentage. Met when present / invited >= percent, i.e. present * 100 >= percent * invited.
CREATE FUNCTION private.meeting_quorum(p_society_id uuid, p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_invited integer;
  v_present integer := 0;
BEGIN
  SELECT * INTO v_meeting FROM public.meetings WHERE society_id = p_society_id AND id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_meeting.status = 'draft' THEN
    v_invited := private.meeting_candidate_count(p_society_id, p_meeting_id, v_meeting.meeting_type,
      v_meeting.invitee_scope);
  ELSIF v_meeting.meeting_type = 'committee' THEN
    SELECT count(*)::integer INTO v_invited FROM public.meeting_invited_members
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
    SELECT count(*)::integer INTO v_present FROM public.meeting_attendance
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND membership_id IS NOT NULL;
  ELSE
    SELECT count(*)::integer INTO v_invited FROM public.meeting_invited_units
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
    SELECT count(*)::integer INTO v_present FROM public.meeting_attendance
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND unit_id IS NOT NULL;
  END IF;
  RETURN jsonb_build_object(
    'invited', v_invited,
    'present', v_present,
    'percent', v_meeting.quorum_percent,
    'met', v_meeting.quorum_percent IS NOT NULL AND v_invited > 0
      AND v_present * 100 >= v_meeting.quorum_percent * v_invited
  );
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_quorum(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Linked poll summary; hidden (null) while the poll module is disabled, the stored link is kept.
-- Resident reads (p_member) also hide draft polls, which only managers may see.
CREATE FUNCTION private.meeting_poll_json(p_society_id uuid, p_poll_vote_id uuid, p_member boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN p_poll_vote_id IS NULL OR NOT private.module_enabled(p_society_id, 'poll') THEN NULL
    ELSE (
      SELECT jsonb_build_object('id', vote.id, 'title', vote.title, 'status', vote.status)
      FROM public.poll_votes AS vote
      WHERE vote.society_id = p_society_id AND vote.id = p_poll_vote_id
        AND (NOT p_member OR vote.status <> 'draft')
    )
  END
$$;
REVOKE ALL ON FUNCTION private.meeting_poll_json(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_minutes_published(p_society_id uuid, p_meeting_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_minutes AS minutes
    WHERE minutes.society_id = p_society_id AND minutes.meeting_id = p_meeting_id
      AND minutes.status = 'published'
  )
$$;
REVOKE ALL ON FUNCTION private.meeting_minutes_published(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Residents see non-draft AGM/SGM meetings where they actively occupy (owner/tenant/family) an invited unit.
CREATE FUNCTION private.meeting_member_visible(p_society_id uuid, p_meeting_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meetings AS meeting
    JOIN public.meeting_invited_units AS invited
      ON invited.society_id = meeting.society_id AND invited.meeting_id = meeting.id
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = invited.society_id AND occupant.unit_id = invited.unit_id
      AND occupant.status = 'active'
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
      AND membership.status = 'active' AND membership.user_id = auth.uid()
    WHERE meeting.society_id = p_society_id AND meeting.id = p_meeting_id
      AND meeting.status <> 'draft' AND meeting.meeting_type <> 'committee'
  )
$$;
REVOKE ALL ON FUNCTION private.meeting_member_visible(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Roles an action owner needs under the society's action_owner_scope setting.
CREATE FUNCTION private.meeting_owner_roles(p_society_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN private.meeting_settings(p_society_id) ->> 'action_owner_scope' = 'management'
    THEN ARRAY['admin', 'committee']::text[]
    ELSE ARRAY['resident', 'committee', 'admin']::text[]
  END
$$;
REVOKE ALL ON FUNCTION private.meeting_owner_roles(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The caller's own action items (any meeting), open first.
CREATE FUNCTION private.meeting_my_action_items(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.sort_status, item.due_on, item.created_at, item.id), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
        'id', action.id, 'meetingId', action.meeting_id,
        -- Defence in depth: never leak draft or committee meeting titles to non-managers.
        'meetingTitle', CASE
          WHEN (meeting.status = 'draft' OR meeting.meeting_type = 'committee')
            AND NOT membership.roles && ARRAY['admin', 'committee']::text[]
          THEN NULL ELSE meeting.title END,
        'title', action.title, 'dueOn', action.due_on, 'status', action.status,
        'overdue', action.status = 'open' AND action.due_on < private.meeting_today(p_society_id),
        'version', action.version
      ) AS value,
      CASE WHEN action.status = 'open' THEN 0 ELSE 1 END AS sort_status,
      action.due_on, action.created_at, action.id
    FROM public.meeting_action_items AS action
    JOIN public.meetings AS meeting ON meeting.society_id = action.society_id AND meeting.id = action.meeting_id
    JOIN public.memberships AS membership
      ON membership.society_id = action.society_id AND membership.id = action.owner_membership_id
      AND membership.status = 'active' AND membership.user_id = auth.uid()
    WHERE action.society_id = p_society_id
    ORDER BY CASE WHEN action.status = 'open' THEN 0 ELSE 1 END, action.due_on, action.created_at, action.id
    LIMIT 200
  ) AS item
$$;
REVOKE ALL ON FUNCTION private.meeting_my_action_items(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Locks the meeting, then the resolution (the order every resolution write uses).
CREATE FUNCTION private.meeting_resolution_lock(p_society_id uuid, p_resolution_id uuid, p_expected_version integer)
RETURNS public.meeting_resolutions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting_id uuid;
  v_resolution public.meeting_resolutions%ROWTYPE;
BEGIN
  IF p_resolution_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The resolution and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT meeting_id INTO v_meeting_id FROM public.meeting_resolutions
  WHERE society_id = p_society_id AND id = p_resolution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.meetings WHERE society_id = p_society_id AND id = v_meeting_id FOR UPDATE;
  SELECT * INTO v_resolution FROM public.meeting_resolutions
  WHERE society_id = p_society_id AND id = p_resolution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_resolution.version <> p_expected_version THEN
    RAISE EXCEPTION 'The resolution changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  RETURN v_resolution;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_resolution_lock(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meeting_resolution_save(
  p_society_id uuid, p_meeting_id uuid, p_resolution_id uuid, p_expected_version integer,
  p_resolution jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_resolution public.meeting_resolutions%ROWTYPE;
  v_title text;
  v_body text;
  v_agenda_item_id uuid;
  v_id uuid;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_resolution IS NULL OR jsonb_typeof(p_resolution) <> 'object'
    OR NOT (p_resolution ? 'title')
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_resolution) AS input_key
      WHERE input_key NOT IN ('title', 'body', 'agendaItemId')
    )
    OR (p_resolution_id IS NOT NULL AND p_expected_version IS NULL)
  THEN
    RAISE EXCEPTION 'The resolution details are invalid.' USING ERRCODE = '22023';
  END IF;
  v_title := private.meeting_json_text(p_resolution -> 'title', 200);
  v_body := private.meeting_json_text(p_resolution -> 'body', 5000);
  v_agenda_item_id := private.meeting_json_uuid(p_resolution -> 'agendaItemId');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'A resolution title is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_meeting FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_resolution_id IS NOT NULL THEN
    SELECT * INTO v_resolution FROM public.meeting_resolutions
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND id = p_resolution_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Resolution not found.' USING ERRCODE = 'P0002';
    END IF;
    IF v_resolution.version <> p_expected_version THEN
      RAISE EXCEPTION 'The resolution changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF v_meeting.status = 'cancelled' OR private.meeting_minutes_published(p_society_id, p_meeting_id) THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Resolutions are frozen once the meeting is cancelled or its minutes are published.';
  END IF;
  IF v_agenda_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meeting_agenda_items
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND id = v_agenda_item_id
  ) THEN
    RAISE EXCEPTION 'The agenda item is not part of this meeting.' USING ERRCODE = '22023';
  END IF;

  IF p_resolution_id IS NULL THEN
    IF (SELECT count(*) FROM public.meeting_resolutions
        WHERE society_id = p_society_id AND meeting_id = p_meeting_id) >= 50 THEN
      RAISE EXCEPTION 'A meeting can have at most 50 resolutions.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.meeting_resolutions (
      society_id, meeting_id, agenda_item_id, position, title, body, created_by, updated_by
    ) VALUES (
      p_society_id, p_meeting_id, v_agenda_item_id,
      COALESCE((SELECT max(position) FROM public.meeting_resolutions
        WHERE society_id = p_society_id AND meeting_id = p_meeting_id), 0) + 1,
      v_title, v_body, auth.uid(), auth.uid()
    )
    RETURNING id, version INTO v_id, v_version;
    PERFORM private.meeting_audit(p_society_id, 'resolution.create', 'meeting_resolution', v_id,
      jsonb_build_object('meetingId', p_meeting_id, 'title', v_title), p_request_id);
  ELSE
    UPDATE public.meeting_resolutions SET
      agenda_item_id = v_agenda_item_id, title = v_title, body = v_body,
      version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_resolution_id
    RETURNING id, version INTO v_id, v_version;
    PERFORM private.meeting_audit(p_society_id, 'resolution.update', 'meeting_resolution', v_id,
      jsonb_build_object('meetingId', p_meeting_id, 'title', v_title), p_request_id);
  END IF;
  RETURN jsonb_build_object('resolutionId', v_id, 'version', v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_resolution_delete(
  p_society_id uuid, p_resolution_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_resolution public.meeting_resolutions%ROWTYPE;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  v_resolution := private.meeting_resolution_lock(p_society_id, p_resolution_id, p_expected_version);
  IF v_resolution.outcome <> 'pending' OR v_resolution.poll_vote_id IS NOT NULL
    OR private.meeting_minutes_published(p_society_id, v_resolution.meeting_id)
    OR EXISTS (
      SELECT 1 FROM public.meetings
      WHERE society_id = p_society_id AND id = v_resolution.meeting_id AND status = 'cancelled'
    )
  THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only pending resolutions without a linked poll can be deleted before minutes are published.';
  END IF;
  DELETE FROM public.meeting_resolutions WHERE society_id = p_society_id AND id = p_resolution_id;
  PERFORM private.meeting_audit(p_society_id, 'resolution.delete', 'meeting_resolution', p_resolution_id,
    jsonb_build_object('meetingId', v_resolution.meeting_id, 'title', v_resolution.title), p_request_id);
  RETURN jsonb_build_object('deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_resolution_outcome_set(
  p_society_id uuid, p_resolution_id uuid, p_expected_version integer, p_outcome text,
  p_votes_for integer, p_votes_against integer, p_votes_abstain integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_resolution public.meeting_resolutions%ROWTYPE;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_outcome IS NULL OR p_outcome NOT IN ('pending', 'passed', 'failed', 'deferred')
    OR p_votes_for < 0 OR p_votes_against < 0 OR p_votes_abstain < 0
  THEN
    RAISE EXCEPTION 'The outcome or vote counts are invalid.' USING ERRCODE = '22023';
  END IF;
  v_resolution := private.meeting_resolution_lock(p_society_id, p_resolution_id, p_expected_version);
  IF NOT EXISTS (
      SELECT 1 FROM public.meetings
      WHERE society_id = p_society_id AND id = v_resolution.meeting_id AND status = 'held'
    )
    OR private.meeting_minutes_published(p_society_id, v_resolution.meeting_id)
  THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Outcomes are recorded after the meeting is held and before minutes are published.';
  END IF;
  UPDATE public.meeting_resolutions SET
    outcome = p_outcome, votes_for = p_votes_for, votes_against = p_votes_against,
    votes_abstain = p_votes_abstain,
    version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_resolution_id
  RETURNING version INTO v_version;
  PERFORM private.meeting_audit(p_society_id, 'resolution.outcome', 'meeting_resolution', p_resolution_id,
    jsonb_build_object('meetingId', v_resolution.meeting_id, 'outcome', p_outcome, 'votesFor', p_votes_for,
      'votesAgainst', p_votes_against, 'votesAbstain', p_votes_abstain), p_request_id);
  RETURN jsonb_build_object('resolutionId', p_resolution_id, 'version', v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_resolution_poll_link(
  p_society_id uuid, p_resolution_id uuid, p_expected_version integer, p_poll_vote_id uuid,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_resolution public.meeting_resolutions%ROWTYPE;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  v_resolution := private.meeting_resolution_lock(p_society_id, p_resolution_id, p_expected_version);
  IF private.meeting_minutes_published(p_society_id, v_resolution.meeting_id) OR EXISTS (
    SELECT 1 FROM public.meetings
    WHERE society_id = p_society_id AND id = v_resolution.meeting_id AND status = 'cancelled'
  ) THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Poll links are frozen once the meeting is cancelled or its minutes are published.';
  END IF;
  IF p_poll_vote_id IS NOT NULL AND (
    NOT private.module_enabled(p_society_id, 'poll')
    OR NOT EXISTS (
      SELECT 1 FROM public.poll_votes
      WHERE society_id = p_society_id AND id = p_poll_vote_id AND status <> 'cancelled'
    )
  ) THEN
    RAISE EXCEPTION 'meeting_poll_unavailable' USING ERRCODE = 'P0001',
      DETAIL = 'The poll is not available to link.';
  END IF;
  UPDATE public.meeting_resolutions SET
    poll_vote_id = p_poll_vote_id,
    version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_resolution_id
  RETURNING version INTO v_version;
  PERFORM private.meeting_audit(p_society_id,
    CASE WHEN p_poll_vote_id IS NULL THEN 'resolution.poll_unlink' ELSE 'resolution.poll_link' END,
    'meeting_resolution', p_resolution_id,
    jsonb_build_object('meetingId', v_resolution.meeting_id, 'pollVoteId', p_poll_vote_id), p_request_id);
  RETURN jsonb_build_object('resolutionId', p_resolution_id, 'version', v_version, 'pollVoteId', p_poll_vote_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_minutes_save(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_body text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_body text := btrim(p_body);
  v_status text;
  v_minutes public.meeting_minutes%ROWTYPE;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin', 'committee']::text[], p_request_id);
  IF p_meeting_id IS NULL OR v_body IS NULL OR char_length(v_body) NOT BETWEEN 1 AND 50000 THEN
    RAISE EXCEPTION 'Minutes need 1 to 50000 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'held' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Minutes can be written once the meeting is held.';
  END IF;
  SELECT * INTO v_minutes FROM public.meeting_minutes
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id FOR UPDATE;
  IF FOUND THEN
    IF v_minutes.status = 'published' THEN
      RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
        DETAIL = 'Published minutes cannot be edited.';
    END IF;
    IF p_expected_version IS NULL OR v_minutes.version <> p_expected_version THEN
      RAISE EXCEPTION 'The minutes changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.meeting_minutes SET
      body = v_body, version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id
    RETURNING version INTO v_version;
  ELSE
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'The minutes changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.meeting_minutes (society_id, meeting_id, body, drafted_by, updated_by)
    VALUES (p_society_id, p_meeting_id, v_body, auth.uid(), auth.uid())
    ON CONFLICT ON CONSTRAINT meeting_minutes_pkey DO NOTHING
    RETURNING version INTO v_version;
    IF v_version IS NULL THEN
      RAISE EXCEPTION 'The minutes changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
  END IF;
  PERFORM private.meeting_audit(p_society_id, 'minutes.save', 'meeting', p_meeting_id,
    jsonb_build_object('version', v_version, 'length', char_length(v_body)), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'version', v_version, 'status', 'draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_minutes_publish(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status text;
  v_minutes public.meeting_minutes%ROWTYPE;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The meeting and version are required.' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_minutes FROM public.meeting_minutes
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id FOR UPDATE;
  IF v_status <> 'held' OR NOT FOUND OR v_minutes.status <> 'draft' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only draft minutes of a held meeting can be published.';
  END IF;
  IF v_minutes.version <> p_expected_version THEN
    RAISE EXCEPTION 'The minutes changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.meeting_minutes SET
    status = 'published', published_by = auth.uid(), published_at = clock_timestamp(),
    version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id
  RETURNING * INTO v_minutes;
  PERFORM private.meeting_notify_invitees(p_society_id, p_meeting_id, 'meeting_minutes_published',
    'Meeting minutes published', p_request_id);
  PERFORM private.meeting_audit(p_society_id, 'minutes.publish', 'meeting', p_meeting_id,
    jsonb_build_object('version', v_minutes.version), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'version', v_minutes.version,
    'publishedAt', v_minutes.published_at);
END;
$$;

-- Records the Documents copy of published minutes once; repeating the same id is a no-op.
CREATE OR REPLACE FUNCTION public.meeting_minutes_document_link(
  p_society_id uuid, p_meeting_id uuid, p_document_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_type text;
  v_minutes public.meeting_minutes%ROWTYPE;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_document_id IS NULL THEN
    RAISE EXCEPTION 'The meeting and document are required.' USING ERRCODE = '22023';
  END IF;
  SELECT meeting_type INTO v_type FROM public.meetings WHERE society_id = p_society_id AND id = p_meeting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_minutes FROM public.meeting_minutes
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id FOR UPDATE;
  IF NOT FOUND OR v_minutes.status <> 'published' THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Minutes must be published before a document copy is linked.';
  END IF;
  IF v_minutes.document_id = p_document_id THEN
    RETURN jsonb_build_object('meetingId', p_meeting_id, 'documentId', p_document_id);
  END IF;
  IF v_minutes.document_id IS NOT NULL THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'A document copy is already linked to these minutes.';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'document') OR NOT EXISTS (
    SELECT 1
    FROM public.documents AS document
    JOIN public.document_folders AS folder
      ON folder.society_id = document.society_id AND folder.id = document.folder_id
    WHERE document.society_id = p_society_id AND document.id = p_document_id
      AND document.archived_at IS NULL AND folder.archived_at IS NULL
      AND (v_type <> 'committee' OR folder.audience = 'committee_admins')
  ) THEN
    RAISE EXCEPTION 'meeting_document_unavailable' USING ERRCODE = 'P0001',
      DETAIL = 'The document is not available to link.';
  END IF;
  UPDATE public.meeting_minutes SET document_id = p_document_id
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
  PERFORM private.meeting_audit(p_society_id, 'minutes.document_link', 'meeting', p_meeting_id,
    jsonb_build_object('documentId', p_document_id), p_request_id);
  RETURN jsonb_build_object('meetingId', p_meeting_id, 'documentId', p_document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_action_save(
  p_society_id uuid, p_meeting_id uuid, p_action_id uuid, p_expected_version integer,
  p_action jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status text;
  v_meeting_type text;
  v_action public.meeting_action_items%ROWTYPE;
  v_title text;
  v_owner_id uuid;
  v_due_text text;
  v_due date;
  v_resolution_id uuid;
  v_owner_user uuid;
  v_owner_roles text[];
  v_owner_name text;
  v_id uuid;
  v_version integer;
  v_notify boolean;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_meeting_id IS NULL OR p_action IS NULL OR jsonb_typeof(p_action) <> 'object'
    OR NOT (p_action ?& ARRAY['title', 'ownerMembershipId', 'dueOn'])
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_action) AS input_key
      WHERE input_key NOT IN ('title', 'ownerMembershipId', 'dueOn', 'resolutionId')
    )
    OR (p_action_id IS NOT NULL AND p_expected_version IS NULL)
  THEN
    RAISE EXCEPTION 'The action item details are invalid.' USING ERRCODE = '22023';
  END IF;
  v_title := private.meeting_json_text(p_action -> 'title', 300);
  v_owner_id := private.meeting_json_uuid(p_action -> 'ownerMembershipId');
  v_resolution_id := private.meeting_json_uuid(p_action -> 'resolutionId');
  v_due_text := private.meeting_json_text(p_action -> 'dueOn', 10);
  IF v_title IS NULL OR v_owner_id IS NULL OR v_due_text IS NULL
    OR v_due_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  THEN
    RAISE EXCEPTION 'A title, owner and due date are required.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_due := v_due_text::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'The due date is invalid.' USING ERRCODE = '22023';
  END;

  SELECT status, meeting_type INTO v_status, v_meeting_type FROM public.meetings
  WHERE society_id = p_society_id AND id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_action_id IS NOT NULL THEN
    SELECT * INTO v_action FROM public.meeting_action_items
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND id = p_action_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Action item not found.' USING ERRCODE = 'P0002';
    END IF;
    IF v_action.version <> p_expected_version THEN
      RAISE EXCEPTION 'The action item changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
  END IF;
  -- Draft meetings stay invisible to residents, so their actions must not reach owners yet.
  IF v_status NOT IN ('scheduled', 'held') THEN
    RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Action items need a scheduled or held meeting.';
  END IF;
  IF (p_action_id IS NULL OR v_due IS DISTINCT FROM v_action.due_on)
    AND v_due < private.meeting_today(p_society_id)
  THEN
    RAISE EXCEPTION 'The due date cannot be in the past.' USING ERRCODE = '22023';
  END IF;
  IF v_resolution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meeting_resolutions
    WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND id = v_resolution_id
  ) THEN
    RAISE EXCEPTION 'The resolution is not part of this meeting.' USING ERRCODE = '22023';
  END IF;

  SELECT membership.user_id, membership.roles,
    left(COALESCE(NULLIF(btrim(profile.full_name), ''), 'Member'), 120)
  INTO v_owner_user, v_owner_roles, v_owner_name
  FROM public.memberships AS membership
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  WHERE membership.society_id = p_society_id AND membership.id = v_owner_id
    AND membership.status = 'active'
    AND membership.roles && private.meeting_owner_roles(p_society_id)
    AND (v_meeting_type <> 'committee' OR membership.roles && ARRAY['admin', 'committee']::text[]);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting_owner_ineligible' USING ERRCODE = 'P0001',
      DETAIL = 'The owner must be an active member allowed by the action owner setting; committee meetings need an admin or committee owner.';
  END IF;

  IF p_action_id IS NULL THEN
    IF (SELECT count(*) FROM public.meeting_action_items
        WHERE society_id = p_society_id AND meeting_id = p_meeting_id) >= 200 THEN
      RAISE EXCEPTION 'A meeting can have at most 200 action items.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.meeting_action_items (
      society_id, meeting_id, resolution_id, title, owner_membership_id, owner_name, due_on,
      created_by, updated_by
    ) VALUES (
      p_society_id, p_meeting_id, v_resolution_id, v_title, v_owner_id, v_owner_name, v_due,
      auth.uid(), auth.uid()
    )
    RETURNING id, version INTO v_id, v_version;
    v_notify := true;
  ELSE
    v_notify := v_owner_id <> v_action.owner_membership_id;
    UPDATE public.meeting_action_items SET
      resolution_id = v_resolution_id, title = v_title, owner_membership_id = v_owner_id,
      owner_name = CASE WHEN v_notify THEN v_owner_name ELSE owner_name END,
      due_on = v_due,
      last_overdue_notified_on = CASE WHEN v_notify OR v_due <> v_action.due_on
        THEN NULL ELSE last_overdue_notified_on END,
      version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_action_id
    RETURNING id, version INTO v_id, v_version;
  END IF;
  IF v_notify THEN
    PERFORM private.create_notification(
      p_society_id, v_owner_user, 'meeting_action_assigned', 'Meeting action assigned',
      left(v_title || ' (due ' || to_char(v_due, 'DD Mon YYYY') || ')', 300),
      CASE WHEN v_owner_roles && ARRAY['admin', 'committee']::text[]
        THEN 'meeting_action_admin' ELSE 'meeting_action' END,
      v_id, p_request_id
    );
  END IF;
  PERFORM private.meeting_audit(p_society_id,
    CASE WHEN p_action_id IS NULL THEN 'action.create' ELSE 'action.update' END,
    'meeting_action', v_id,
    jsonb_build_object('meetingId', p_meeting_id, 'title', v_title, 'ownerMembershipId', v_owner_id,
      'dueOn', v_due, 'resolutionId', v_resolution_id), p_request_id);
  RETURN jsonb_build_object('actionId', v_id, 'version', v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_action_status_set(
  p_society_id uuid, p_action_id uuid, p_expected_version integer, p_status text, p_note text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note text := NULLIF(btrim(p_note), '');
  v_meeting_id uuid;
  v_owner_id uuid;
  v_action public.meeting_action_items%ROWTYPE;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], p_request_id);
  IF p_action_id IS NULL OR p_expected_version IS NULL OR p_status IS NULL
    OR p_status NOT IN ('open', 'done') OR char_length(v_note) > 500
  THEN
    RAISE EXCEPTION 'The status or note is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT meeting_id, owner_membership_id INTO v_meeting_id, v_owner_id FROM public.meeting_action_items
  WHERE society_id = p_society_id AND id = p_action_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action item not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[]) AND NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND id = v_owner_id AND status = 'active' AND user_id = auth.uid()
  ) THEN
    IF private.has_role(p_society_id, ARRAY['committee']::text[]) THEN
      RAISE EXCEPTION 'Only the admin or the owner can update this action item.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Action item not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.meetings WHERE society_id = p_society_id AND id = v_meeting_id FOR UPDATE;
  SELECT * INTO v_action FROM public.meeting_action_items
  WHERE society_id = p_society_id AND id = p_action_id FOR UPDATE;
  IF v_action.version <> p_expected_version THEN
    RAISE EXCEPTION 'The action item changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.meeting_action_items SET
    status = p_status,
    note = COALESCE(v_note, note),
    completed_at = CASE WHEN p_status = 'done' THEN COALESCE(completed_at, clock_timestamp()) END,
    completed_by = CASE WHEN p_status = 'done' THEN COALESCE(completed_by, auth.uid()) END,
    version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_action_id
  RETURNING version INTO v_version;
  PERFORM private.meeting_audit(p_society_id, 'action.status', 'meeting_action', p_action_id,
    jsonb_build_object('meetingId', v_meeting_id, 'status', p_status, 'note', v_note), p_request_id);
  RETURN jsonb_build_object('actionId', p_action_id, 'version', v_version, 'status', p_status);
END;
$$;

-- Daily job: one overdue reminder per open item per society-local day.
CREATE OR REPLACE FUNCTION public.meeting_action_reminders_run(p_society_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_today date;
  v_item record;
  v_sent integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Meeting maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  IF p_society_id IS NULL OR (p_request_id IS NOT NULL AND char_length(p_request_id) NOT BETWEEN 1 AND 128) THEN
    RAISE EXCEPTION 'The society and request id are invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'meeting') OR NOT private.society_writable(p_society_id) THEN
    RETURN jsonb_build_object('notified', 0);
  END IF;
  SET LOCAL lock_timeout = '5s';
  v_today := private.meeting_today(p_society_id);
  FOR v_item IN
    SELECT action.id, action.title, action.due_on, membership.user_id, membership.roles
    FROM public.meeting_action_items AS action
    JOIN public.memberships AS membership
      ON membership.society_id = action.society_id AND membership.id = action.owner_membership_id
      AND membership.status = 'active' AND membership.user_id IS NOT NULL
    WHERE action.society_id = p_society_id AND action.status = 'open' AND action.due_on < v_today
      AND action.last_overdue_notified_on IS DISTINCT FROM v_today
    ORDER BY action.due_on, action.id
    LIMIT 2000
    FOR UPDATE OF action SKIP LOCKED
  LOOP
    PERFORM private.create_notification(
      p_society_id, v_item.user_id, 'meeting_action_overdue', 'Meeting action overdue',
      left(v_item.title || ' (was due ' || to_char(v_item.due_on, 'DD Mon YYYY') || ')', 300),
      CASE WHEN v_item.roles && ARRAY['admin', 'committee']::text[]
        THEN 'meeting_action_admin' ELSE 'meeting_action' END,
      v_item.id, p_request_id
    );
    UPDATE public.meeting_action_items SET last_overdue_notified_on = v_today
    WHERE society_id = p_society_id AND id = v_item.id;
    v_sent := v_sent + 1;
  END LOOP;
  IF v_sent > 0 THEN
    PERFORM private.meeting_audit(p_society_id, 'action.reminders', 'meeting_action', NULL,
      jsonb_build_object('notified', v_sent, 'day', v_today), p_request_id);
  END IF;
  RETURN jsonb_build_object('notified', v_sent);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_admin_list(
  p_society_id uuid, p_status text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_items jsonb;
  v_total integer;
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR COALESCE(p_offset, 0) < 0
    OR (p_status IS NOT NULL AND p_status NOT IN ('draft', 'scheduled', 'held', 'cancelled'))
  THEN
    RAISE EXCEPTION 'The list filter is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT count(*)::integer INTO v_total FROM public.meetings
  WHERE society_id = p_society_id AND (p_status IS NULL OR status = p_status);
  SELECT COALESCE(jsonb_agg(page.value ORDER BY page.ordinal), '[]'::jsonb) INTO v_items
  FROM (
    SELECT row_number() OVER (ORDER BY meeting.starts_at DESC NULLS LAST, meeting.created_at DESC, meeting.id)
        AS ordinal,
      jsonb_build_object(
        'id', meeting.id, 'meetingType', meeting.meeting_type, 'title', meeting.title,
        'status', meeting.status, 'startsAt', meeting.starts_at, 'endsAt', meeting.ends_at,
        'invitedCount', (quorum.value ->> 'invited')::integer,
        'presentCount', (quorum.value ->> 'present')::integer,
        'quorumPercent', meeting.quorum_percent,
        'quorumMet', CASE WHEN meeting.status = 'draft' THEN NULL ELSE (quorum.value -> 'met') END,
        'minutesStatus', COALESCE(minutes.status, 'none')
      ) AS value
    FROM public.meetings AS meeting
    CROSS JOIN LATERAL (SELECT private.meeting_quorum(meeting.society_id, meeting.id) AS value) AS quorum
    LEFT JOIN public.meeting_minutes AS minutes
      ON minutes.society_id = meeting.society_id AND minutes.meeting_id = meeting.id
    WHERE meeting.society_id = p_society_id AND (p_status IS NULL OR meeting.status = p_status)
    ORDER BY meeting.starts_at DESC NULLS LAST, meeting.created_at DESC, meeting.id
    LIMIT p_limit OFFSET COALESCE(p_offset, 0)
  ) AS page;
  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_admin_get(p_society_id uuid, p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_settings jsonb;
  v_today date;
  v_invited jsonb;
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT * INTO v_meeting FROM public.meetings WHERE society_id = p_society_id AND id = p_meeting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  v_settings := private.meeting_settings(p_society_id);
  v_today := private.meeting_today(p_society_id);

  -- Drafts preview who would be invited; later states show the frozen invitee list.
  IF v_meeting.status = 'draft' THEN
    IF v_meeting.meeting_type = 'committee' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('attendeeId', candidate.membership_id,
          'label', candidate.member_name) ORDER BY candidate.member_name, candidate.membership_id), '[]'::jsonb)
      INTO v_invited
      FROM private.meeting_candidate_members(p_society_id, p_meeting_id, v_meeting.invitee_scope) AS candidate;
    ELSE
      SELECT COALESCE(jsonb_agg(jsonb_build_object('attendeeId', candidate.unit_id,
          'label', candidate.unit_label) ORDER BY candidate.unit_label, candidate.unit_id), '[]'::jsonb)
      INTO v_invited
      FROM private.meeting_candidate_units(p_society_id, p_meeting_id, v_meeting.invitee_scope) AS candidate;
    END IF;
  ELSE
    SELECT COALESCE(jsonb_agg(invitee.value ORDER BY invitee.label, invitee.id), '[]'::jsonb) INTO v_invited
    FROM (
      SELECT jsonb_build_object('attendeeId', unit_id, 'label', unit_label) AS value, unit_label AS label,
        unit_id AS id
      FROM public.meeting_invited_units WHERE society_id = p_society_id AND meeting_id = p_meeting_id
      UNION ALL
      SELECT jsonb_build_object('attendeeId', membership_id, 'label', member_name), member_name, membership_id
      FROM public.meeting_invited_members WHERE society_id = p_society_id AND meeting_id = p_meeting_id
    ) AS invitee;
  END IF;

  RETURN jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', v_meeting.id, 'meetingType', v_meeting.meeting_type, 'status', v_meeting.status,
      'title', v_meeting.title, 'description', v_meeting.description,
      'startsAt', v_meeting.starts_at, 'endsAt', v_meeting.ends_at,
      'venue', v_meeting.venue, 'onlineUrl', v_meeting.online_url,
      'inviteeScope', v_meeting.invitee_scope,
      'noticeRequiredDays', v_meeting.notice_required_days, 'noticeGivenDays', v_meeting.notice_given_days,
      'quorumPercent', v_meeting.quorum_percent,
      'checkinOpen', v_meeting.checkin_open, 'checkinOpenedAt', v_meeting.checkin_opened_at,
      'checkinClosedAt', v_meeting.checkin_closed_at,
      'version', v_meeting.version, 'createdAt', v_meeting.created_at, 'updatedAt', v_meeting.updated_at,
      'scheduledAt', v_meeting.scheduled_at, 'rescheduledAt', v_meeting.rescheduled_at,
      'heldAt', v_meeting.held_at, 'cancelledAt', v_meeting.cancelled_at,
      'cancellationReason', v_meeting.cancellation_reason,
      'canManage', private.has_role(p_society_id, ARRAY['admin']::text[])
    ),
    'agenda', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', item.id, 'title', item.title, 'description', item.description)
        ORDER BY item.position)
      FROM public.meeting_agenda_items AS item
      WHERE item.society_id = p_society_id AND item.meeting_id = p_meeting_id
    ), '[]'::jsonb),
    'invitees', jsonb_build_object(
      'scope', v_meeting.invitee_scope,
      'unitIds', COALESCE((
        SELECT jsonb_agg(selection.unit_id ORDER BY selection.unit_id)
        FROM public.meeting_invitee_selections AS selection
        WHERE selection.society_id = p_society_id AND selection.meeting_id = p_meeting_id
          AND selection.unit_id IS NOT NULL
      ), '[]'::jsonb),
      'membershipIds', COALESCE((
        SELECT jsonb_agg(selection.membership_id ORDER BY selection.membership_id)
        FROM public.meeting_invitee_selections AS selection
        WHERE selection.society_id = p_society_id AND selection.meeting_id = p_meeting_id
          AND selection.membership_id IS NOT NULL
      ), '[]'::jsonb)
    ),
    'invited', v_invited,
    'attendance', COALESCE((
      SELECT jsonb_agg(row_value.value ORDER BY row_value.label, row_value.id)
      FROM (
        SELECT jsonb_build_object(
            'attendeeId', COALESCE(attendance.unit_id, attendance.membership_id),
            'label', COALESCE(unit_invite.unit_label, member_invite.member_name, 'Attendee'),
            'mode', attendance.mode, 'proxyName', attendance.proxy_name,
            'recordedAt', attendance.recorded_at,
            'recordedByName', NULLIF(btrim(recorder.full_name), '')
          ) AS value,
          COALESCE(unit_invite.unit_label, member_invite.member_name, 'Attendee') AS label,
          attendance.id
        FROM public.meeting_attendance AS attendance
        LEFT JOIN public.meeting_invited_units AS unit_invite
          ON unit_invite.society_id = attendance.society_id AND unit_invite.meeting_id = attendance.meeting_id
          AND unit_invite.unit_id = attendance.unit_id
        LEFT JOIN public.meeting_invited_members AS member_invite
          ON member_invite.society_id = attendance.society_id AND member_invite.meeting_id = attendance.meeting_id
          AND member_invite.membership_id = attendance.membership_id
        LEFT JOIN public.profiles AS recorder ON recorder.id = attendance.recorded_by
        WHERE attendance.society_id = p_society_id AND attendance.meeting_id = p_meeting_id
      ) AS row_value
    ), '[]'::jsonb),
    'quorum', private.meeting_quorum(p_society_id, p_meeting_id),
    'resolutions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', resolution.id, 'agendaItemId', resolution.agenda_item_id, 'title', resolution.title,
          'body', resolution.body, 'outcome', resolution.outcome,
          'votesFor', resolution.votes_for, 'votesAgainst', resolution.votes_against,
          'votesAbstain', resolution.votes_abstain, 'version', resolution.version,
          'poll', private.meeting_poll_json(p_society_id, resolution.poll_vote_id, false)
        ) ORDER BY resolution.position, resolution.id)
      FROM public.meeting_resolutions AS resolution
      WHERE resolution.society_id = p_society_id AND resolution.meeting_id = p_meeting_id
    ), '[]'::jsonb),
    'minutes', (
      SELECT jsonb_build_object(
        'status', minutes.status, 'body', minutes.body, 'version', minutes.version,
        'updatedAt', minutes.updated_at, 'updatedByName', NULLIF(btrim(editor.full_name), ''),
        'publishedAt', minutes.published_at, 'documentId', minutes.document_id
      )
      FROM public.meeting_minutes AS minutes
      LEFT JOIN public.profiles AS editor ON editor.id = minutes.updated_by
      WHERE minutes.society_id = p_society_id AND minutes.meeting_id = p_meeting_id
    ),
    'actions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', action.id, 'title', action.title, 'ownerMembershipId', action.owner_membership_id,
          'ownerName', action.owner_name, 'dueOn', action.due_on, 'status', action.status,
          'note', action.note, 'resolutionId', action.resolution_id, 'version', action.version,
          'overdue', action.status = 'open' AND action.due_on < v_today
        ) ORDER BY action.due_on, action.created_at, action.id)
      FROM public.meeting_action_items AS action
      WHERE action.society_id = p_society_id AND action.meeting_id = p_meeting_id
    ), '[]'::jsonb),
    'settings', jsonb_build_object(
      'noticeDaysAgm', (v_settings ->> 'notice_days_agm')::integer,
      'noticeDaysSgm', (v_settings ->> 'notice_days_sgm')::integer,
      'noticeDaysCommittee', (v_settings ->> 'notice_days_committee')::integer,
      'quorumPercentUnits', (v_settings ->> 'quorum_percent_units')::integer,
      'quorumPercentCommittee', (v_settings ->> 'quorum_percent_committee')::integer,
      'actionOwnerScope', v_settings ->> 'action_owner_scope'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_invitee_options(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], false);
  RETURN jsonb_build_object(
    'units', COALESCE((
      SELECT jsonb_agg(option.value ORDER BY option.block_name NULLS FIRST, option.floor NULLS FIRST,
        option.unit_label, option.unit_id)
      FROM (
        SELECT jsonb_build_object('unitId', candidate.unit_id, 'label', candidate.unit_label,
            'blockId', candidate.block_id, 'blockName', candidate.block_name, 'floor', candidate.floor) AS value,
          candidate.block_name, candidate.floor, candidate.unit_label, candidate.unit_id
        FROM private.meeting_candidate_units(p_society_id, NULL, 'default') AS candidate
        ORDER BY candidate.block_name NULLS FIRST, candidate.floor NULLS FIRST, candidate.unit_label,
          candidate.unit_id
        LIMIT 5000
      ) AS option
    ), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('membershipId', candidate.membership_id, 'name', candidate.member_name)
        ORDER BY candidate.member_name, candidate.membership_id)
      FROM private.meeting_candidate_members(p_society_id, NULL, 'default') AS candidate
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_owner_options(p_society_id uuid, p_search text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_search text := NULLIF(btrim(p_search), '');
  v_pattern text;
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], false);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR char_length(v_search) > 100 THEN
    RAISE EXCEPTION 'The owner search is invalid.' USING ERRCODE = '22023';
  END IF;
  v_pattern := '%' || replace(replace(replace(COALESCE(v_search, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(option.value ORDER BY option.name, option.id)
    FROM (
      SELECT jsonb_build_object(
          'membershipId', membership.id,
          'name', left(COALESCE(NULLIF(btrim(profile.full_name), ''), 'Member'), 120),
          'roleLabel', CASE
            WHEN 'admin' = ANY (membership.roles) THEN 'Admin'
            WHEN 'committee' = ANY (membership.roles) THEN 'Committee'
            ELSE 'Resident' END
        ) AS value,
        COALESCE(NULLIF(btrim(profile.full_name), ''), 'Member') AS name, membership.id
      FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.roles && private.meeting_owner_roles(p_society_id)
        AND COALESCE(profile.full_name, '') ILIKE v_pattern
      ORDER BY 2, membership.id
      LIMIT p_limit
    ) AS option
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_member_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['resident']::text[], false);
  RETURN jsonb_build_object(
    'meetings', COALESCE((
      SELECT jsonb_agg(visible.value ORDER BY visible.starts_at DESC, visible.id)
      FROM (
        SELECT jsonb_build_object(
            'id', meeting.id, 'meetingType', meeting.meeting_type, 'title', meeting.title,
            'status', meeting.status, 'startsAt', meeting.starts_at, 'endsAt', meeting.ends_at,
            'venue', meeting.venue, 'onlineUrl', meeting.online_url,
            'minutesPublished', private.meeting_minutes_published(p_society_id, meeting.id)
          ) AS value,
          meeting.starts_at, meeting.id
        FROM public.meetings AS meeting
        WHERE meeting.society_id = p_society_id AND meeting.status <> 'draft'
          AND meeting.meeting_type <> 'committee'
          AND EXISTS (
            SELECT 1
            FROM public.meeting_invited_units AS invited
            JOIN public.unit_occupants AS occupant
              ON occupant.society_id = invited.society_id AND occupant.unit_id = invited.unit_id
              AND occupant.status = 'active'
            JOIN public.memberships AS membership
              ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
              AND membership.status = 'active' AND membership.user_id = auth.uid()
            WHERE invited.society_id = meeting.society_id AND invited.meeting_id = meeting.id
          )
        ORDER BY meeting.starts_at DESC, meeting.id
        LIMIT 100
      ) AS visible
    ), '[]'::jsonb),
    'actions', private.meeting_my_action_items(p_society_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_member_get(p_society_id uuid, p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['resident']::text[], false);
  IF p_meeting_id IS NULL OR NOT private.meeting_member_visible(p_society_id, p_meeting_id) THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_meeting FROM public.meetings WHERE society_id = p_society_id AND id = p_meeting_id;
  RETURN jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', v_meeting.id, 'meetingType', v_meeting.meeting_type, 'title', v_meeting.title,
      'description', v_meeting.description, 'status', v_meeting.status,
      'startsAt', v_meeting.starts_at, 'endsAt', v_meeting.ends_at,
      'venue', v_meeting.venue, 'onlineUrl', v_meeting.online_url,
      'checkinOpen', v_meeting.checkin_open, 'cancellationReason', v_meeting.cancellation_reason
    ),
    'agenda', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', item.id, 'title', item.title, 'description', item.description)
        ORDER BY item.position)
      FROM public.meeting_agenda_items AS item
      WHERE item.society_id = p_society_id AND item.meeting_id = p_meeting_id
    ), '[]'::jsonb),
    'myUnits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'unitId', mine.unit_id, 'label', mine.unit_label, 'present', attendance.id IS NOT NULL,
          'mode', attendance.mode, 'canCheckIn', mine.can_check_in
        ) ORDER BY mine.unit_label, mine.unit_id)
      FROM (
        SELECT invited.unit_id, invited.unit_label,
          bool_or(occupant.relationship IN ('owner', 'tenant')) AS can_check_in
        FROM public.meeting_invited_units AS invited
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = invited.society_id AND occupant.unit_id = invited.unit_id
          AND occupant.status = 'active'
        JOIN public.memberships AS membership
          ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
          AND membership.status = 'active' AND membership.user_id = auth.uid()
        WHERE invited.society_id = p_society_id AND invited.meeting_id = p_meeting_id
        GROUP BY invited.unit_id, invited.unit_label
      ) AS mine
      LEFT JOIN public.meeting_attendance AS attendance
        ON attendance.society_id = p_society_id AND attendance.meeting_id = p_meeting_id
        AND attendance.unit_id = mine.unit_id
    ), '[]'::jsonb),
    'quorum', private.meeting_quorum(p_society_id, p_meeting_id),
    'resolutions', CASE WHEN v_meeting.status = 'held' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'id', resolution.id, 'title', resolution.title, 'body', resolution.body,
          'outcome', resolution.outcome, 'votesFor', resolution.votes_for,
          'votesAgainst', resolution.votes_against, 'votesAbstain', resolution.votes_abstain,
          'poll', private.meeting_poll_json(p_society_id, resolution.poll_vote_id, true)
        ) ORDER BY resolution.position, resolution.id)
      FROM public.meeting_resolutions AS resolution
      WHERE resolution.society_id = p_society_id AND resolution.meeting_id = p_meeting_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'minutes', (
      SELECT jsonb_build_object('body', minutes.body, 'publishedAt', minutes.published_at)
      FROM public.meeting_minutes AS minutes
      WHERE minutes.society_id = p_society_id AND minutes.meeting_id = p_meeting_id
        AND minutes.status = 'published'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_my_actions(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false);
  RETURN jsonb_build_object('items', private.meeting_my_action_items(p_society_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.meeting_settings_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RETURN private.meeting_settings(p_society_id);
END;
$$;
