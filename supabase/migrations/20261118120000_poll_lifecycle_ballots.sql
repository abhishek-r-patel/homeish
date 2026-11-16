-- Polls & Voting: draft, electorate, lifecycle and ballot operations.
CREATE OR REPLACE FUNCTION private.poll_readiness(
  p_society_id uuid, p_vote_id uuid, p_open_at timestamptz, p_activation boolean
)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  issues text[] := ARRAY[]::text[];
  eligible_count integer;
  unit_count integer;
  office_count integer;
  bad_office_count integer;
BEGIN
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF char_length(btrim(vote.title)) = 0 THEN issues := array_append(issues, 'title_missing'); END IF;
  IF vote.closes_at IS NULL THEN
    issues := array_append(issues, 'closes_at_missing');
  ELSIF p_open_at IS NOT NULL AND vote.closes_at < p_open_at + interval '5 minutes' THEN
    issues := array_append(issues, 'closes_at_too_soon');
  ELSIF p_open_at IS NOT NULL AND vote.closes_at > p_open_at + interval '1 year' THEN
    issues := array_append(issues, 'closes_at_too_far');
  END IF;
  IF p_open_at IS NULL OR (NOT p_activation AND p_open_at <= clock_timestamp())
    OR (vote.closes_at IS NOT NULL AND p_open_at >= vote.closes_at)
  THEN
    issues := array_append(issues, 'opens_at_invalid');
  END IF;
  IF vote.voting_type = 'public' THEN
    IF (SELECT count(*) FROM public.poll_options AS option
        WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id) < 2
    THEN
      issues := array_append(issues, 'options_too_few');
    END IF;
    IF (vote.selection_mode = 'single' AND vote.selection_limit IS DISTINCT FROM 1)
      OR (vote.selection_mode = 'multiple'
        AND vote.selection_limit IS NOT NULL AND vote.selection_limit NOT BETWEEN 2 AND 100)
    THEN
      issues := array_append(issues, 'option_limit_invalid');
    END IF;
  ELSE
    SELECT count(*) INTO office_count FROM public.poll_offices
    WHERE society_id = p_society_id AND vote_id = p_vote_id;
    IF office_count = 0 THEN issues := array_append(issues, 'offices_missing'); END IF;
    SELECT count(*) INTO bad_office_count FROM public.poll_offices AS office
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id
      AND NOT EXISTS (
        SELECT 1 FROM public.poll_candidates AS candidate
        WHERE candidate.society_id = office.society_id AND candidate.vote_id = office.vote_id
          AND candidate.office_id = office.id
      );
    IF bad_office_count > 0 THEN issues := array_append(issues, 'office_without_candidates'); END IF;
    IF char_length(btrim(COALESCE(vote.instructions, ''))) = 0 THEN
      issues := array_append(issues, 'instructions_missing');
    END IF;
  END IF;
  SELECT count(*) INTO unit_count FROM public.units AS unit
  WHERE unit.society_id = p_society_id AND unit.active
    AND (
      NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
        AND vote_id = p_vote_id)
      OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
        WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
          AND selected.block_id = unit.block_id)
    );
  SELECT count(*) INTO eligible_count
  FROM public.units AS unit
  CROSS JOIN LATERAL private.poll_effective_representative(
    p_society_id, unit.id, COALESCE(vote.tenant_voting_override,
      (SELECT COALESCE((config.settings ->> 'tenant_voting_default')::boolean, false)
       FROM public.module_configs AS config
       WHERE config.society_id = p_society_id AND config.module_key = 'poll'))
  ) AS representative
  WHERE unit.society_id = p_society_id AND unit.active
    AND (
      NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
        AND vote_id = p_vote_id)
      OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
        WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
          AND selected.block_id = unit.block_id)
    );
  IF unit_count = 0 OR eligible_count = 0 THEN issues := array_append(issues, 'electorate_empty'); END IF;
  RETURN issues;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_readiness(uuid, uuid, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.poll_freeze_electorate(
  p_society_id uuid, p_vote_id uuid, p_tenant_voting boolean
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inserted_count integer;
BEGIN
  PERFORM 1 FROM public.units AS unit
  WHERE unit.society_id = p_society_id AND unit.active
    AND (
      NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
        AND vote_id = p_vote_id)
      OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
        WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
          AND selected.block_id = unit.block_id)
    )
  ORDER BY unit.id FOR UPDATE;
  PERFORM 1 FROM public.blocks AS block
  WHERE block.society_id = p_society_id AND block.active
    AND EXISTS (
      SELECT 1 FROM public.poll_vote_blocks AS selected
      WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
        AND selected.block_id = block.id
    )
  ORDER BY block.id FOR SHARE;
  PERFORM 1 FROM public.unit_occupants AS occupant
  WHERE occupant.society_id = p_society_id AND occupant.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.society_id = p_society_id AND unit.id = occupant.unit_id AND unit.active
        AND (NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
              AND vote_id = p_vote_id)
          OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
              WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
                AND selected.block_id = unit.block_id))
    )
  ORDER BY occupant.unit_id, occupant.id FOR UPDATE;
  PERFORM 1 FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id AND membership.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      JOIN public.units AS unit ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id
      WHERE occupant.society_id = p_society_id AND occupant.membership_id = membership.id
        AND occupant.status = 'active' AND unit.active
    )
  ORDER BY membership.id FOR SHARE;
  PERFORM 1 FROM public.poll_unit_representatives AS representative
  WHERE representative.society_id = p_society_id
    AND EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.society_id = p_society_id AND unit.id = representative.unit_id AND unit.active
    )
  ORDER BY representative.unit_id FOR UPDATE;
  INSERT INTO public.poll_electorate (
    society_id, vote_id, unit_id, membership_id, user_id, representative_name, unit_label, block_id
  )
  SELECT p_society_id, p_vote_id, unit.id, representative.membership_id, representative.user_id,
    representative.representative_name,
    COALESCE(block.name || '-', '') || unit.number, unit.block_id
  FROM public.units AS unit
  LEFT JOIN public.blocks AS block
    ON block.society_id = unit.society_id AND block.id = unit.block_id
  CROSS JOIN LATERAL private.poll_effective_representative(
    p_society_id, unit.id, p_tenant_voting
  ) AS representative
  WHERE unit.society_id = p_society_id AND unit.active
    AND (unit.block_id IS NULL OR block.active)
    AND (
      NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
        AND vote_id = p_vote_id)
      OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
        WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
          AND selected.block_id = unit.block_id)
    );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_freeze_electorate(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.poll_notify_representatives(
  p_society_id uuid, p_vote_id uuid, p_type text, p_title text, p_body text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  recipient uuid;
  sent integer := 0;
BEGIN
  FOR recipient IN
    SELECT DISTINCT electorate.user_id FROM public.poll_electorate AS electorate
    JOIN public.memberships AS membership
      ON membership.society_id = electorate.society_id
      AND membership.user_id = electorate.user_id AND membership.status = 'active'
    WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id
    ORDER BY electorate.user_id
    LIMIT 2000
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient, p_type, p_title, left(p_body, 300),
      'poll', p_vote_id, 'poll-' || p_vote_id::text || '-' || p_type
    );
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_notify_representatives(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.poll_complete_locked(
  p_society_id uuid, p_vote_id uuid, p_mode text, p_reason text, p_completed_at timestamptz
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  eligible_count integer;
  submitted_count integer;
  office record;
  actual_count bigint;
  expected_count bigint;
BEGIN
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status <> 'active' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  SELECT count(*)::integer INTO eligible_count FROM public.poll_electorate
  WHERE society_id = p_society_id AND vote_id = p_vote_id;
  SELECT count(*)::integer INTO submitted_count FROM public.poll_participation
  WHERE society_id = p_society_id AND vote_id = p_vote_id;
  IF vote.voting_type = 'public' THEN
    PERFORM set_config('poll.finalize', 'on', true);
    UPDATE public.poll_options AS option SET final_count = (
      SELECT count(*) FROM public.poll_public_responses AS response
      WHERE response.society_id = p_society_id AND response.vote_id = p_vote_id
        AND response.option_id = option.id
    )
    WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id;
    PERFORM set_config('poll.finalize', 'off', true);
  ELSE
    FOR office IN
      SELECT id FROM public.poll_offices
      WHERE society_id = p_society_id AND vote_id = p_vote_id
      ORDER BY id
    LOOP
      SELECT COALESCE(sum(accepted_count), 0) INTO actual_count
      FROM public.poll_private_tallies
      WHERE society_id = p_society_id AND vote_id = p_vote_id AND office_id = office.id;
      expected_count := submitted_count;
      IF actual_count <> expected_count THEN
        RAISE EXCEPTION 'poll_results_mismatch' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;
  PERFORM set_config('poll.lifecycle_write', 'on', true);
  UPDATE public.poll_votes SET status = 'completed', completed_at = p_completed_at,
    completion_mode = p_mode, completion_reason = p_reason,
    final_eligible_count = eligible_count, final_submitted_count = submitted_count,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vote_id;
  PERFORM set_config('poll.lifecycle_write', 'off', true);
  PERFORM private.poll_audit(p_society_id, 'complete', 'poll_vote', p_vote_id,
    jsonb_build_object('mode', p_mode, 'eligible', eligible_count, 'submitted', submitted_count),
    p_reason);
  RETURN submitted_count;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_complete_locked(uuid, uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.poll_reconcile_locked(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  now_at timestamptz := clock_timestamp();
  opened integer := 0;
  completed integer := 0;
  notified integer := 0;
BEGIN
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('opened', 0, 'completed', 0, 'notified', 0); END IF;
  IF vote.status = 'scheduled' AND vote.opens_at <= now_at THEN
    PERFORM set_config('poll.lifecycle_write', 'on', true);
    UPDATE public.poll_votes SET status = 'active', activated_at = opens_at,
      updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_vote_id;
    PERFORM set_config('poll.lifecycle_write', 'off', true);
    opened := 1;
    UPDATE public.poll_votes SET opened_notified_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_vote_id AND opened_notified_at IS NULL;
    IF FOUND THEN
      notified := notified + private.poll_notify_representatives(
        p_society_id, p_vote_id, 'poll_opened', 'Poll is open',
        'Voting is now open. Submit your vote before the closing time.'
      );
    END IF;
    SELECT * INTO vote FROM public.poll_votes
    WHERE society_id = p_society_id AND id = p_vote_id;
  END IF;
  IF vote.status = 'active' AND vote.closes_at <= now_at THEN
    PERFORM private.poll_complete_locked(p_society_id, p_vote_id, 'deadline', NULL, vote.closes_at);
    completed := 1;
    UPDATE public.poll_votes SET results_notified_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_vote_id AND results_notified_at IS NULL;
    IF FOUND THEN
      notified := notified + private.poll_notify_representatives(
        p_society_id, p_vote_id, 'poll_results', 'Poll results are ready',
        'The poll has closed. Results are now available.'
      );
    END IF;
  END IF;
  RETURN jsonb_build_object('opened', opened, 'completed', completed, 'notified', notified);
END;
$$;
REVOKE ALL ON FUNCTION private.poll_reconcile_locked(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.poll_draft_create(
  p_society_id uuid, p_client_request_id text, p_voting_type text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_client_request_id IS NULL OR char_length(btrim(p_client_request_id)) NOT BETWEEN 1 AND 120
    OR p_voting_type NOT IN ('public', 'private')
  THEN
    RAISE EXCEPTION 'Poll draft details are invalid.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.poll_votes (society_id, voting_type, client_request_id, created_by, updated_by)
  VALUES (p_society_id, p_voting_type, btrim(p_client_request_id), auth.uid(), auth.uid())
  ON CONFLICT ON CONSTRAINT poll_votes_client_request_key DO NOTHING
  RETURNING * INTO vote;
  IF NOT FOUND THEN
    SELECT * INTO STRICT vote FROM public.poll_votes
    WHERE society_id = p_society_id AND client_request_id = btrim(p_client_request_id);
    IF vote.voting_type <> p_voting_type THEN
      RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('voteId', vote.id, 'revision', vote.revision);
  END IF;
  PERFORM private.poll_audit(p_society_id, 'draft.create', 'poll_vote', vote.id,
    jsonb_build_object('votingType', vote.voting_type, 'revision', vote.revision));
  RETURN jsonb_build_object('voteId', vote.id, 'revision', vote.revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_draft_save(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer, p_draft jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  clean_title text;
  clean_instructions text;
  open_at timestamptz;
  close_at timestamptz;
  mode text;
  draft_selection_limit integer;
  tenant_override boolean;
  item jsonb;
  child jsonb;
  block_id uuid;
  item_position integer;
  office_id uuid;
  allowed_keys text[] := ARRAY[
    'title', 'instructions', 'opensAt', 'closesAt', 'selectionMode', 'selectionLimit',
    'tenantVotingOverride', 'blockIds', 'options', 'offices'
  ];
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'This poll draft changed. Refresh before saving.' USING ERRCODE = '40001';
  END IF;
  IF vote.status <> 'draft' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  IF p_draft IS NULL OR jsonb_typeof(p_draft) <> 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_draft) AS keys(key) WHERE key <> ALL(allowed_keys))
    OR NOT (p_draft ?& ARRAY[
      'title', 'instructions', 'opensAt', 'closesAt', 'selectionMode', 'selectionLimit',
      'tenantVotingOverride', 'blockIds', 'options', 'offices'
    ])
    OR jsonb_typeof(p_draft -> 'title') <> 'string'
    OR jsonb_typeof(p_draft -> 'selectionMode') <> 'string'
    OR jsonb_typeof(p_draft -> 'blockIds') <> 'array'
    OR jsonb_typeof(p_draft -> 'options') <> 'array'
    OR jsonb_typeof(p_draft -> 'offices') <> 'array'
    OR jsonb_typeof(p_draft -> 'instructions') NOT IN ('string', 'null')
    OR jsonb_typeof(p_draft -> 'opensAt') NOT IN ('string', 'null')
    OR jsonb_typeof(p_draft -> 'closesAt') NOT IN ('string', 'null')
    OR jsonb_typeof(p_draft -> 'tenantVotingOverride') NOT IN ('boolean', 'null')
    OR jsonb_typeof(p_draft -> 'selectionLimit') NOT IN ('number', 'null')
  THEN
    RAISE EXCEPTION 'Poll draft fields are invalid.' USING ERRCODE = '22023';
  END IF;
  clean_title := btrim(p_draft ->> 'title');
  clean_instructions := NULLIF(btrim(p_draft ->> 'instructions'), '');
  mode := p_draft ->> 'selectionMode';
  IF char_length(clean_title) > 150 OR char_length(clean_instructions) > 2000
    OR mode NOT IN ('single', 'multiple')
    OR (vote.voting_type = 'private' AND mode <> 'single')
  THEN
    RAISE EXCEPTION 'Poll draft fields are invalid.' USING ERRCODE = '22023';
  END IF;
  tenant_override := CASE WHEN jsonb_typeof(p_draft -> 'tenantVotingOverride') = 'null'
    THEN NULL ELSE (p_draft ->> 'tenantVotingOverride')::boolean END;
  draft_selection_limit := CASE WHEN jsonb_typeof(p_draft -> 'selectionLimit') = 'null'
    THEN NULL ELSE (p_draft ->> 'selectionLimit')::integer END;
  IF (mode = 'single' AND draft_selection_limit IS DISTINCT FROM 1)
    OR (mode = 'multiple' AND draft_selection_limit IS NOT NULL
      AND draft_selection_limit NOT BETWEEN 2 AND 100)
    OR (vote.voting_type = 'public' AND jsonb_array_length(p_draft -> 'options') > 100)
    OR (vote.voting_type = 'private' AND jsonb_array_length(p_draft -> 'offices') > 20)
    OR (vote.voting_type = 'public' AND jsonb_array_length(p_draft -> 'offices') > 0)
    OR (vote.voting_type = 'private' AND jsonb_array_length(p_draft -> 'options') > 0)
  THEN
    RAISE EXCEPTION 'Poll selection settings are invalid.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    open_at := NULLIF(p_draft ->> 'opensAt', '')::timestamptz;
    close_at := NULLIF(p_draft ->> 'closesAt', '')::timestamptz;
    IF jsonb_typeof(p_draft -> 'opensAt') = 'null' THEN open_at := NULL; END IF;
    IF jsonb_typeof(p_draft -> 'closesAt') = 'null' THEN close_at := NULL; END IF;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Poll dates are invalid.' USING ERRCODE = '22023';
  END;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_draft -> 'blockIds') AS selected(value)
    GROUP BY value HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_draft -> 'blockIds') AS selected(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.blocks AS block
      WHERE block.society_id = p_society_id AND block.id = value::uuid AND block.active
    )
  ) THEN
    RAISE EXCEPTION 'Selected blocks are not available.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('poll.allow_delete', 'on', true);
  DELETE FROM public.poll_vote_blocks WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_candidates WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_offices WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_options WHERE society_id = p_society_id AND vote_id = p_vote_id;
  PERFORM set_config('poll.allow_delete', 'off', true);
  UPDATE public.poll_votes SET title = clean_title, instructions = clean_instructions,
    opens_at = open_at, closes_at = close_at, selection_mode = mode,
    selection_limit = draft_selection_limit, tenant_voting_override = tenant_override,
    revision = revision + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vote_id RETURNING * INTO vote;
  FOR item IN SELECT value FROM jsonb_array_elements(p_draft -> 'blockIds') AS items(value)
  LOOP
    block_id := (item #>> '{}')::uuid;
    INSERT INTO public.poll_vote_blocks (society_id, vote_id, block_id)
    VALUES (p_society_id, p_vote_id, block_id);
  END LOOP;
  item_position := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(p_draft -> 'options') AS items(value)
  LOOP
    item_position := item_position + 1;
    IF jsonb_typeof(item) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(item) AS keys(key) WHERE key <> 'label'
    ) OR jsonb_typeof(item -> 'label') <> 'string'
    THEN RAISE EXCEPTION 'Poll option fields are invalid.' USING ERRCODE = '22023'; END IF;
    clean_title := btrim(item ->> 'label');
    IF char_length(clean_title) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Poll option fields are invalid.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.poll_options (society_id, vote_id, label, position)
    VALUES (p_society_id, p_vote_id, clean_title, item_position);
  END LOOP;
  item_position := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(p_draft -> 'offices') AS items(value)
  LOOP
    item_position := item_position + 1;
    IF jsonb_typeof(item) <> 'object'
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) AS keys(key) WHERE key <> ALL(ARRAY['name', 'candidates']))
      OR NOT (item ?& ARRAY['name', 'candidates'])
      OR jsonb_typeof(item -> 'name') <> 'string'
      OR jsonb_typeof(item -> 'candidates') <> 'array'
      OR jsonb_array_length(item -> 'candidates') > 50
    THEN RAISE EXCEPTION 'Poll office fields are invalid.' USING ERRCODE = '22023'; END IF;
    clean_title := btrim(item ->> 'name');
    IF char_length(clean_title) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Poll office fields are invalid.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.poll_offices (society_id, vote_id, name, position)
    VALUES (p_society_id, p_vote_id, clean_title, item_position)
    RETURNING id INTO office_id;
    item_position := 0;
    FOR child IN SELECT value FROM jsonb_array_elements(item -> 'candidates') AS candidates(value)
    LOOP
      item_position := item_position + 1;
      IF jsonb_typeof(child) <> 'object' OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(child) AS keys(key) WHERE key <> 'name'
      ) OR jsonb_typeof(child -> 'name') <> 'string'
      THEN RAISE EXCEPTION 'Poll candidate fields are invalid.' USING ERRCODE = '22023'; END IF;
      clean_title := btrim(child ->> 'name');
      IF char_length(clean_title) NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Poll candidate fields are invalid.' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.poll_candidates (
        society_id, vote_id, office_id, name, position
      ) VALUES (p_society_id, p_vote_id, office_id, clean_title, item_position);
    END LOOP;
  END LOOP;
  PERFORM private.poll_audit(p_society_id, 'draft.save', 'poll_vote', vote.id,
    jsonb_build_object('revision', vote.revision, 'title', vote.title,
      'votingType', vote.voting_type));
  RETURN jsonb_build_object('voteId', vote.id, 'revision', vote.revision);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Poll draft contains duplicate labels or names.' USING ERRCODE = '22023';
WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'Poll draft fields are invalid.' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_draft_delete(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'This poll draft changed. Refresh before deleting.' USING ERRCODE = '40001';
  END IF;
  IF vote.status <> 'draft' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.poll_audit(p_society_id, 'draft.delete', 'poll_vote', vote.id,
    jsonb_build_object('votingType', vote.voting_type, 'revision', vote.revision));
  PERFORM set_config('poll.allow_delete', 'on', true);
  DELETE FROM public.poll_candidates WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_offices WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_options WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_vote_blocks WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_votes WHERE society_id = p_society_id AND id = p_vote_id;
  PERFORM set_config('poll.allow_delete', 'off', true);
  RETURN jsonb_build_object('deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_settings_update(p_society_id uuid, p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous_settings jsonb;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_settings IS NULL OR NOT private.poll_settings_valid(p_settings) THEN
    RAISE EXCEPTION 'Poll settings are invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT settings INTO previous_settings FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll settings are unavailable.' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.module_configs SET settings = p_settings, updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'poll';
  PERFORM private.poll_audit(p_society_id, 'settings.update', 'poll_settings', NULL,
    p_settings, NULL);
  RETURN jsonb_build_object('settings', p_settings);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_representative_set(
  p_society_id uuid, p_unit_id uuid, p_membership_id uuid, p_expected_version integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_version integer;
  new_version integer;
  is_admin boolean;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin', 'resident']::text[]);
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  PERFORM 1 FROM public.units WHERE society_id = p_society_id AND id = p_unit_id AND active
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT is_admin AND NOT EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND occupant.relationship = 'owner'
      AND membership.status = 'active' AND membership.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only an owner of this unit can change its representative.'
      USING ERRCODE = '42501';
  END IF;
  IF p_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
      AND occupant.membership_id = p_membership_id AND occupant.status = 'active'
      AND occupant.relationship IN ('owner', 'tenant') AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND 'resident' = ANY(membership.roles)
  ) THEN
    RAISE EXCEPTION 'The selected representative is not eligible for this unit.'
      USING ERRCODE = '22023';
  END IF;
  SELECT version INTO current_version FROM public.poll_unit_representatives
  WHERE society_id = p_society_id AND unit_id = p_unit_id FOR UPDATE;
  current_version := COALESCE(current_version, 0);
  IF p_expected_version IS NULL OR p_expected_version <> current_version THEN
    RAISE EXCEPTION 'This representative changed. Refresh before saving.' USING ERRCODE = '40001';
  END IF;
  new_version := current_version + 1;
  INSERT INTO public.poll_unit_representatives (
    society_id, unit_id, membership_id, version, updated_at, updated_by
  ) VALUES (p_society_id, p_unit_id, p_membership_id, new_version, clock_timestamp(), auth.uid())
  ON CONFLICT (society_id, unit_id) DO UPDATE SET membership_id = EXCLUDED.membership_id,
    version = EXCLUDED.version, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  PERFORM private.poll_audit(p_society_id, 'representative.set', 'poll_unit_representative',
    p_unit_id, jsonb_build_object('membershipId', p_membership_id, 'version', new_version));
  RETURN jsonb_build_object('unitId', p_unit_id, 'version', new_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_activate(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  open_at timestamptz := clock_timestamp();
  effective_tenant_voting boolean;
  issues text[];
  eligible integer;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'This poll draft changed. Refresh before activating.' USING ERRCODE = '40001';
  END IF;
  IF vote.status <> 'draft' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE((config.settings ->> 'tenant_voting_default')::boolean, false)
  INTO effective_tenant_voting FROM public.module_configs AS config
  WHERE config.society_id = p_society_id AND config.module_key = 'poll';
  effective_tenant_voting := COALESCE(vote.tenant_voting_override, effective_tenant_voting, false);
  issues := private.poll_readiness(p_society_id, p_vote_id, open_at, true);
  IF cardinality(issues) > 0 THEN
    RAISE EXCEPTION 'poll_not_ready' USING ERRCODE = 'P0001', DETAIL = array_to_string(issues, ',');
  END IF;
  eligible := private.poll_freeze_electorate(p_society_id, p_vote_id, effective_tenant_voting);
  IF eligible = 0 THEN
    RAISE EXCEPTION 'poll_not_ready' USING ERRCODE = 'P0001', DETAIL = 'electorate_empty';
  END IF;
  IF vote.voting_type = 'private' THEN
    INSERT INTO public.poll_private_tallies (society_id, vote_id, office_id, candidate_id)
    SELECT p_society_id, p_vote_id, office.id, candidate.id
    FROM public.poll_offices AS office
    JOIN public.poll_candidates AS candidate ON candidate.society_id = office.society_id
      AND candidate.vote_id = office.vote_id AND candidate.office_id = office.id
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id;
    INSERT INTO public.poll_private_tallies (society_id, vote_id, office_id, candidate_id)
    SELECT p_society_id, p_vote_id, office.id, NULL FROM public.poll_offices AS office
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id;
  END IF;
  PERFORM set_config('poll.lifecycle_write', 'on', true);
  UPDATE public.poll_votes SET status = 'active', tenant_voting = effective_tenant_voting,
    opens_at = open_at, activated_at = open_at, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vote_id;
  PERFORM set_config('poll.lifecycle_write', 'off', true);
  PERFORM private.poll_audit(p_society_id, 'activate', 'poll_vote', p_vote_id,
    jsonb_build_object('eligible', eligible, 'tenantVoting', effective_tenant_voting));
  PERFORM private.poll_notify_representatives(p_society_id, p_vote_id, 'poll_opened',
    'Poll is open', 'Voting is now open. Submit your vote before the closing time.');
  UPDATE public.poll_votes SET opened_notified_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_vote_id;
  RETURN jsonb_build_object('voteId', p_vote_id, 'status', 'active');
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_schedule(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer, p_opens_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  effective_tenant_voting boolean;
  issues text[];
  eligible integer;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'This poll draft changed. Refresh before scheduling.' USING ERRCODE = '40001';
  END IF;
  IF vote.status <> 'draft' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE((config.settings ->> 'tenant_voting_default')::boolean, false)
  INTO effective_tenant_voting FROM public.module_configs AS config
  WHERE config.society_id = p_society_id AND config.module_key = 'poll';
  effective_tenant_voting := COALESCE(vote.tenant_voting_override, effective_tenant_voting, false);
  issues := private.poll_readiness(p_society_id, p_vote_id, p_opens_at, false);
  IF cardinality(issues) > 0 THEN
    RAISE EXCEPTION 'poll_not_ready' USING ERRCODE = 'P0001', DETAIL = array_to_string(issues, ',');
  END IF;
  eligible := private.poll_freeze_electorate(p_society_id, p_vote_id, effective_tenant_voting);
  IF eligible = 0 THEN
    RAISE EXCEPTION 'poll_not_ready' USING ERRCODE = 'P0001', DETAIL = 'electorate_empty';
  END IF;
  IF vote.voting_type = 'private' THEN
    INSERT INTO public.poll_private_tallies (society_id, vote_id, office_id, candidate_id)
    SELECT p_society_id, p_vote_id, office.id, candidate.id
    FROM public.poll_offices AS office
    JOIN public.poll_candidates AS candidate ON candidate.society_id = office.society_id
      AND candidate.vote_id = office.vote_id AND candidate.office_id = office.id
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id;
    INSERT INTO public.poll_private_tallies (society_id, vote_id, office_id, candidate_id)
    SELECT p_society_id, p_vote_id, office.id, NULL FROM public.poll_offices AS office
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id;
  END IF;
  PERFORM set_config('poll.lifecycle_write', 'on', true);
  UPDATE public.poll_votes SET status = 'scheduled', tenant_voting = effective_tenant_voting,
    opens_at = p_opens_at, scheduled_at = clock_timestamp(), updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vote_id;
  PERFORM set_config('poll.lifecycle_write', 'off', true);
  PERFORM private.poll_audit(p_society_id, 'schedule', 'poll_vote', p_vote_id,
    jsonb_build_object('opensAt', p_opens_at, 'eligible', eligible,
      'tenantVoting', effective_tenant_voting));
  RETURN jsonb_build_object('voteId', p_vote_id, 'status', 'scheduled');
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_schedule_withdraw(
  p_society_id uuid, p_vote_id uuid, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status <> 'scheduled' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  IF vote.opens_at <= clock_timestamp() THEN
    PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
    RAISE EXCEPTION 'poll_closed' USING ERRCODE = 'P0001';
  END IF;
  IF clean_reason IS NULL OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'A withdrawal reason is required.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('poll.allow_delete', 'on', true);
  DELETE FROM public.poll_private_tallies WHERE society_id = p_society_id AND vote_id = p_vote_id;
  DELETE FROM public.poll_electorate WHERE society_id = p_society_id AND vote_id = p_vote_id;
  PERFORM set_config('poll.allow_delete', 'off', true);
  PERFORM set_config('poll.schedule_withdraw', 'on', true);
  PERFORM set_config('poll.lifecycle_write', 'on', true);
  UPDATE public.poll_votes SET status = 'draft', tenant_voting = NULL, opens_at = NULL,
    scheduled_at = NULL, withdrawn_at = clock_timestamp(), withdrawal_reason = clean_reason,
    revision = revision + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vote_id RETURNING * INTO vote;
  PERFORM set_config('poll.lifecycle_write', 'off', true);
  PERFORM set_config('poll.schedule_withdraw', 'off', true);
  PERFORM private.poll_audit(p_society_id, 'schedule.withdraw', 'poll_vote', p_vote_id,
    jsonb_build_object('revision', vote.revision), clean_reason);
  RETURN jsonb_build_object('voteId', p_vote_id, 'status', 'draft', 'revision', vote.revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_deadline_extend(
  p_society_id uuid, p_vote_id uuid, p_closes_at timestamptz, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status <> 'active' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  IF vote.closes_at <= clock_timestamp() THEN
    PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
    RETURN jsonb_build_object('voteId', p_vote_id, 'closesAt', vote.closes_at, 'outcome', 'completed');
  END IF;
  IF clean_reason IS NULL OR char_length(clean_reason) > 500
    OR p_closes_at IS NULL OR p_closes_at <= vote.closes_at
    OR p_closes_at < clock_timestamp() + interval '5 minutes'
    OR p_closes_at > vote.opens_at + interval '1 year'
  THEN
    RAISE EXCEPTION 'The new deadline or reason is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('poll.deadline_extension', 'on', true);
  UPDATE public.poll_votes SET closes_at = p_closes_at, updated_at = clock_timestamp(),
    updated_by = auth.uid() WHERE society_id = p_society_id AND id = p_vote_id;
  PERFORM set_config('poll.deadline_extension', 'off', true);
  PERFORM private.poll_audit(p_society_id, 'deadline.extend', 'poll_vote', p_vote_id,
    jsonb_build_object('closesAt', p_closes_at), clean_reason);
  RETURN jsonb_build_object('voteId', p_vote_id, 'closesAt', p_closes_at, 'outcome', 'extended');
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_complete_early(
  p_society_id uuid, p_vote_id uuid, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status <> 'active' THEN RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001'; END IF;
  IF vote.closes_at <= clock_timestamp() THEN
    PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
    RAISE EXCEPTION 'poll_closed' USING ERRCODE = 'P0001';
  END IF;
  IF clean_reason IS NULL OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'A completion reason is required.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.poll_complete_locked(p_society_id, p_vote_id, 'early', clean_reason, clock_timestamp());
  UPDATE public.poll_votes SET results_notified_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_vote_id AND results_notified_at IS NULL;
  IF FOUND THEN
    PERFORM private.poll_notify_representatives(p_society_id, p_vote_id, 'poll_results',
      'Poll results are ready', 'The poll has closed. Results are now available.');
  END IF;
  RETURN jsonb_build_object('voteId', p_vote_id, 'status', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_cancel(p_society_id uuid, p_vote_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status NOT IN ('scheduled', 'active') THEN
    RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
  END IF;
  IF (vote.status = 'scheduled' AND vote.opens_at <= clock_timestamp())
    OR (vote.status = 'active' AND vote.closes_at <= clock_timestamp())
  THEN
    PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
    RAISE EXCEPTION 'poll_closed' USING ERRCODE = 'P0001';
  END IF;
  IF clean_reason IS NULL OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'A cancellation reason is required.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('poll.lifecycle_write', 'on', true);
  UPDATE public.poll_votes SET status = 'cancelled', cancelled_at = clock_timestamp(),
    cancellation_reason = clean_reason, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_vote_id;
  PERFORM set_config('poll.lifecycle_write', 'off', true);
  PERFORM private.poll_audit(p_society_id, 'cancel', 'poll_vote', p_vote_id,
    jsonb_build_object('status', 'cancelled'), clean_reason);
  PERFORM private.poll_notify_representatives(p_society_id, p_vote_id, 'poll_cancelled',
    'Poll cancelled', 'This poll was cancelled.');
  UPDATE public.poll_votes SET cancel_notified_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_vote_id;
  RETURN jsonb_build_object('voteId', p_vote_id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_ballot_submit(
  p_society_id uuid, p_vote_id uuid, p_unit_id uuid, p_submission jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  elector public.poll_electorate;
  item jsonb;
  option_id uuid;
  selected_office_id uuid;
  selected_candidate_id uuid;
  choice_count integer;
  accepted_count integer;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'poll_not_open' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO elector FROM public.poll_electorate
  WHERE society_id = p_society_id AND vote_id = p_vote_id AND unit_id = p_unit_id
  FOR UPDATE;
  IF NOT FOUND OR elector.user_id <> auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.id = elector.membership_id
      AND membership.user_id = auth.uid() AND membership.status = 'active'
      AND 'resident' = ANY(membership.roles)
  ) THEN
    RAISE EXCEPTION 'poll_not_eligible' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id;
  IF vote.status IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'poll_not_open' USING ERRCODE = 'P0001';
  END IF;
  IF vote.status = 'completed' OR vote.status = 'cancelled'
    OR clock_timestamp() >= vote.closes_at
  THEN
    RAISE EXCEPTION 'poll_closed' USING ERRCODE = 'P0001';
  END IF;
  IF p_submission IS NULL OR jsonb_typeof(p_submission) <> 'object' THEN
    RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF vote.voting_type = 'public' THEN
    IF (SELECT array_agg(key) FROM jsonb_object_keys(p_submission) AS keys(key))
      IS DISTINCT FROM ARRAY['optionIds']::text[]
      OR jsonb_typeof(p_submission -> 'optionIds') <> 'array'
      OR jsonb_array_length(p_submission -> 'optionIds') < 1
      OR (vote.selection_limit IS NOT NULL
        AND jsonb_array_length(p_submission -> 'optionIds') > vote.selection_limit)
    THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    SELECT count(*) INTO choice_count FROM jsonb_array_elements(p_submission -> 'optionIds') AS items(value);
    IF choice_count <> (SELECT count(DISTINCT items.value #>> '{}')
      FROM jsonb_array_elements(p_submission -> 'optionIds') AS items(value))
    THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    PERFORM set_config('poll.allow_delete', 'on', true);
    DELETE FROM public.poll_public_responses
    WHERE society_id = p_society_id AND vote_id = p_vote_id AND unit_id = p_unit_id;
    PERFORM set_config('poll.allow_delete', 'off', true);
    INSERT INTO public.poll_participation (society_id, vote_id, unit_id)
    VALUES (p_society_id, p_vote_id, p_unit_id)
    ON CONFLICT (society_id, vote_id, unit_id) DO NOTHING;
    FOR item IN SELECT value FROM jsonb_array_elements(p_submission -> 'optionIds') AS items(value)
    LOOP
      BEGIN
        option_id := (item #>> '{}')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001';
      END;
      INSERT INTO public.poll_public_responses (society_id, vote_id, unit_id, option_id)
      SELECT p_society_id, p_vote_id, p_unit_id, option.id
      FROM public.poll_options AS option
      WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id
        AND option.id = option_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    END LOOP;
  ELSE
    IF (SELECT array_agg(key) FROM jsonb_object_keys(p_submission) AS keys(key))
      IS DISTINCT FROM ARRAY['choices']::text[]
      OR jsonb_typeof(p_submission -> 'choices') <> 'array'
    THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.poll_participation
      WHERE society_id = p_society_id AND vote_id = p_vote_id AND unit_id = p_unit_id
    ) THEN RAISE EXCEPTION 'poll_already_submitted' USING ERRCODE = 'P0001'; END IF;
    SELECT count(*) INTO choice_count FROM jsonb_array_elements(p_submission -> 'choices') AS items(value);
    IF choice_count <> (SELECT count(*) FROM public.poll_offices
      WHERE society_id = p_society_id AND vote_id = p_vote_id)
    THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_submission -> 'choices') AS items(value)
    LOOP
      IF jsonb_typeof(item) <> 'object'
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) AS keys(key)
          WHERE key <> ALL(ARRAY['officeId', 'candidateId']))
        OR NOT (item ?& ARRAY['officeId', 'candidateId'])
      THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
      BEGIN
        selected_office_id := (item ->> 'officeId')::uuid;
        selected_candidate_id := CASE WHEN jsonb_typeof(item -> 'candidateId') = 'null'
          THEN NULL ELSE (item ->> 'candidateId')::uuid END;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001';
      END;
      IF jsonb_typeof(item -> 'candidateId') NOT IN ('string', 'null')
        OR NOT EXISTS (SELECT 1 FROM public.poll_offices AS ballot_office
          WHERE ballot_office.society_id = p_society_id
            AND ballot_office.vote_id = p_vote_id AND ballot_office.id = selected_office_id)
        OR (selected_candidate_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.poll_candidates AS candidate
          WHERE candidate.society_id = p_society_id AND candidate.vote_id = p_vote_id
            AND candidate.office_id = selected_office_id
            AND candidate.id = selected_candidate_id
        ))
        OR (SELECT count(*) FROM jsonb_array_elements(p_submission -> 'choices') AS choices(choice)
          WHERE choice ->> 'officeId' = selected_office_id::text) <> 1
      THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    END LOOP;
    INSERT INTO public.poll_participation (society_id, vote_id, unit_id)
    VALUES (p_society_id, p_vote_id, p_unit_id);
    PERFORM set_config('poll.allow_tally_write', 'on', true);
    FOR item IN SELECT value FROM jsonb_array_elements(p_submission -> 'choices') AS items(value)
    LOOP
      selected_office_id := (item ->> 'officeId')::uuid;
      selected_candidate_id := CASE WHEN jsonb_typeof(item -> 'candidateId') = 'null'
        THEN NULL ELSE (item ->> 'candidateId')::uuid END;
      UPDATE public.poll_private_tallies AS tally SET accepted_count = tally.accepted_count + 1
      WHERE tally.society_id = p_society_id AND tally.vote_id = p_vote_id
        AND tally.office_id = selected_office_id
        AND tally.candidate_id IS NOT DISTINCT FROM selected_candidate_id;
      GET DIAGNOSTICS accepted_count = ROW_COUNT;
      IF accepted_count <> 1 THEN RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001'; END IF;
    END LOOP;
    PERFORM set_config('poll.allow_tally_write', 'off', true);
  END IF;
  RETURN jsonb_build_object('voteId', p_vote_id, 'unitId', p_unit_id, 'submitted', true);
END;
$$;

REVOKE ALL ON FUNCTION
  public.poll_draft_create(uuid, text, text),
  public.poll_draft_save(uuid, uuid, integer, jsonb),
  public.poll_draft_delete(uuid, uuid, integer),
  public.poll_activate(uuid, uuid, integer),
  public.poll_schedule(uuid, uuid, integer, timestamptz),
  public.poll_schedule_withdraw(uuid, uuid, text),
  public.poll_deadline_extend(uuid, uuid, timestamptz, text),
  public.poll_complete_early(uuid, uuid, text),
  public.poll_cancel(uuid, uuid, text),
  public.poll_settings_update(uuid, jsonb),
  public.poll_representative_set(uuid, uuid, uuid, integer),
  public.poll_ballot_submit(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.poll_draft_create(uuid, text, text),
  public.poll_draft_save(uuid, uuid, integer, jsonb),
  public.poll_draft_delete(uuid, uuid, integer),
  public.poll_activate(uuid, uuid, integer),
  public.poll_schedule(uuid, uuid, integer, timestamptz),
  public.poll_schedule_withdraw(uuid, uuid, text),
  public.poll_deadline_extend(uuid, uuid, timestamptz, text),
  public.poll_complete_early(uuid, uuid, text),
  public.poll_cancel(uuid, uuid, text),
  public.poll_settings_update(uuid, jsonb),
  public.poll_representative_set(uuid, uuid, uuid, integer),
  public.poll_ballot_submit(uuid, uuid, uuid, jsonb)
  TO authenticated;
