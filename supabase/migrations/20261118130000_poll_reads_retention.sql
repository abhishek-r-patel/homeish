-- Polls & Voting: authorized snapshots, background reconciliation and retention.
CREATE OR REPLACE FUNCTION public.poll_member_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote_id uuid;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['resident']::text[], false);
  SET LOCAL lock_timeout = '5s';
  FOR vote_id IN
    SELECT vote.id
    FROM public.poll_votes AS vote
    WHERE vote.society_id = p_society_id AND vote.status <> 'draft'
      AND EXISTS (
        SELECT 1 FROM public.poll_electorate AS electorate
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = electorate.society_id
          AND occupant.unit_id = electorate.unit_id AND occupant.status = 'active'
        JOIN public.memberships AS membership
          ON membership.society_id = occupant.society_id
          AND membership.id = occupant.membership_id
        WHERE electorate.society_id = vote.society_id AND electorate.vote_id = vote.id
          AND membership.user_id = auth.uid() AND membership.status = 'active'
      )
    ORDER BY vote.created_at DESC, vote.id DESC LIMIT 200
  LOOP
    PERFORM private.poll_reconcile_locked(p_society_id, vote_id);
  END LOOP;
  RETURN jsonb_build_object('votes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', vote.id, 'title', vote.title, 'votingType', vote.voting_type,
      'status', vote.status, 'opensAt', vote.opens_at, 'closesAt', vote.closes_at,
      'completedAt', vote.completed_at, 'cancelledAt', vote.cancelled_at,
      'units', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'unitId', electorate.unit_id, 'unitLabel', electorate.unit_label,
          'isRepresentative', electorate.user_id = auth.uid(),
          'submitted', EXISTS (
            SELECT 1 FROM public.poll_participation AS participation
            WHERE participation.society_id = electorate.society_id
              AND participation.vote_id = electorate.vote_id
              AND participation.unit_id = electorate.unit_id
          )
        ) ORDER BY electorate.unit_label, electorate.unit_id), '[]'::jsonb)
        FROM public.poll_electorate AS electorate
        JOIN public.unit_occupants AS occupant
          ON occupant.society_id = electorate.society_id AND occupant.unit_id = electorate.unit_id
          AND occupant.status = 'active'
        JOIN public.memberships AS membership
          ON membership.society_id = occupant.society_id
          AND membership.id = occupant.membership_id
        WHERE electorate.society_id = vote.society_id AND electorate.vote_id = vote.id
          AND membership.user_id = auth.uid() AND membership.status = 'active'
      )
    ) ORDER BY vote.created_at DESC, vote.id DESC)
    FROM (
      SELECT DISTINCT vote.* FROM public.poll_votes AS vote
      JOIN public.poll_electorate AS electorate
        ON electorate.society_id = vote.society_id AND electorate.vote_id = vote.id
      JOIN public.unit_occupants AS occupant
        ON occupant.society_id = electorate.society_id AND occupant.unit_id = electorate.unit_id
        AND occupant.status = 'active'
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE vote.society_id = p_society_id AND vote.status <> 'draft'
        AND membership.user_id = auth.uid() AND membership.status = 'active'
      ORDER BY vote.created_at DESC, vote.id DESC LIMIT 200
    ) AS vote
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_member_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['resident']::text[], false);
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_electorate AS electorate
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = electorate.society_id AND occupant.unit_id = electorate.unit_id
      AND occupant.status = 'active'
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id
      AND membership.user_id = auth.uid() AND membership.status = 'active'
  ) THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  SET LOCAL lock_timeout = '5s';
  PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id AND status <> 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'vote', jsonb_build_object(
      'id', vote.id, 'title', vote.title, 'instructions', vote.instructions,
      'votingType', vote.voting_type, 'selectionMode', vote.selection_mode,
      'selectionLimit', vote.selection_limit, 'status', vote.status,
      'opensAt', vote.opens_at, 'closesAt', vote.closes_at,
      'completedAt', vote.completed_at, 'cancelledAt', vote.cancelled_at,
      'cancellationReason', vote.cancellation_reason,
      'completionMode', vote.completion_mode, 'completionReason', vote.completion_reason
    ),
    'options', CASE WHEN vote.status = 'scheduled' OR vote.voting_type <> 'public' THEN NULL
      ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', option.id, 'label', option.label, 'position', option.position
        ) ORDER BY option.position, option.id)
        FROM public.poll_options AS option
        WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id
      ), '[]'::jsonb) END,
    'offices', CASE WHEN vote.status = 'scheduled' OR vote.voting_type <> 'private' THEN NULL
      ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', office.id, 'name', office.name, 'position', office.position,
          'candidates', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'id', candidate.id, 'name', candidate.name, 'position', candidate.position
            ) ORDER BY candidate.position, candidate.id), '[]'::jsonb)
            FROM public.poll_candidates AS candidate
            WHERE candidate.society_id = office.society_id
              AND candidate.vote_id = office.vote_id AND candidate.office_id = office.id
          )
        ) ORDER BY office.position, office.id)
        FROM public.poll_offices AS office
        WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id
      ), '[]'::jsonb) END,
    'units', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'unitId', electorate.unit_id, 'unitLabel', electorate.unit_label,
        'representativeName', electorate.representative_name,
        'isRepresentative', electorate.user_id = auth.uid(),
        'submitted', EXISTS (
          SELECT 1 FROM public.poll_participation AS participation
          WHERE participation.society_id = electorate.society_id
            AND participation.vote_id = electorate.vote_id
            AND participation.unit_id = electorate.unit_id
        ),
        'myOptionIds', CASE WHEN electorate.user_id = auth.uid()
          AND vote.voting_type = 'public' AND vote.status = 'active'
          THEN COALESCE((
            SELECT jsonb_agg(response.option_id ORDER BY response.option_id)
            FROM public.poll_public_responses AS response
            WHERE response.society_id = electorate.society_id
              AND response.vote_id = electorate.vote_id AND response.unit_id = electorate.unit_id
          ), '[]'::jsonb) ELSE NULL END
      ) ORDER BY electorate.unit_label, electorate.unit_id), '[]'::jsonb)
      FROM public.poll_electorate AS electorate
      JOIN public.unit_occupants AS occupant
        ON occupant.society_id = electorate.society_id AND occupant.unit_id = electorate.unit_id
        AND occupant.status = 'active'
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id
        AND membership.user_id = auth.uid() AND membership.status = 'active'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_results_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  management boolean;
  eligible_count integer;
  submitted_count integer;
  results_options jsonb;
  results_offices jsonb;
  responses jsonb;
  tally_sum bigint;
BEGIN
  PERFORM private.poll_authorize(p_society_id,
    ARRAY['resident', 'admin', 'committee']::text[], false);
  management := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  IF NOT management AND NOT EXISTS (
    SELECT 1 FROM public.poll_electorate AS electorate
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = electorate.society_id AND occupant.unit_id = electorate.unit_id
      AND occupant.status = 'active'
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id
      AND membership.user_id = auth.uid() AND membership.status = 'active'
  ) THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  SET LOCAL lock_timeout = '5s';
  PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'poll_not_open' USING ERRCODE = 'P0001';
  END IF;
  IF vote.status = 'cancelled' THEN
    RAISE EXCEPTION 'poll_results_unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF vote.personal_data_purged_at IS NOT NULL THEN
    eligible_count := vote.final_eligible_count;
    submitted_count := vote.final_submitted_count;
  ELSE
    SELECT count(*)::integer INTO eligible_count FROM public.poll_electorate
    WHERE society_id = p_society_id AND vote_id = p_vote_id;
    SELECT count(*)::integer INTO submitted_count FROM public.poll_participation
    WHERE society_id = p_society_id AND vote_id = p_vote_id;
  END IF;
  IF vote.voting_type = 'public' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', option.id, 'label', option.label,
      'count', CASE WHEN vote.status = 'completed' OR vote.personal_data_purged_at IS NOT NULL
        THEN option.final_count ELSE (
          SELECT count(*) FROM public.poll_public_responses AS response
          WHERE response.society_id = p_society_id AND response.vote_id = p_vote_id
            AND response.option_id = option.id
        ) END
    ) ORDER BY option.position, option.id), '[]'::jsonb)
    INTO results_options FROM public.poll_options AS option
    WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id;
    IF vote.status = 'completed' AND vote.personal_data_purged_at IS NULL THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'unitLabel', electorate.unit_label,
        'representativeName', electorate.representative_name,
        'optionIds', (
          SELECT jsonb_agg(response.option_id ORDER BY response.option_id)
          FROM public.poll_public_responses AS response
          WHERE response.society_id = electorate.society_id
            AND response.vote_id = electorate.vote_id AND response.unit_id = electorate.unit_id
        )
      ) ORDER BY electorate.unit_label, electorate.unit_id), '[]'::jsonb)
      INTO responses FROM public.poll_electorate AS electorate
      JOIN public.poll_participation AS participation
        ON participation.society_id = electorate.society_id
        AND participation.vote_id = electorate.vote_id AND participation.unit_id = electorate.unit_id
      WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id;
    END IF;
  ELSIF vote.status = 'completed' THEN
    FOR tally_sum IN
      SELECT COALESCE(sum(tally.accepted_count), 0)
      FROM public.poll_private_tallies AS tally
      WHERE tally.society_id = p_society_id AND tally.vote_id = p_vote_id
      GROUP BY tally.office_id
    LOOP
      IF tally_sum <> submitted_count THEN
        RAISE EXCEPTION 'poll_results_mismatch' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', office.id, 'name', office.name,
      'candidates', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', candidate.id, 'name', candidate.name, 'count', tally.accepted_count
        ) ORDER BY candidate.position, candidate.id), '[]'::jsonb)
        FROM public.poll_candidates AS candidate
        JOIN public.poll_private_tallies AS tally
          ON tally.society_id = candidate.society_id AND tally.vote_id = candidate.vote_id
          AND tally.office_id = candidate.office_id AND tally.candidate_id = candidate.id
        WHERE candidate.society_id = office.society_id AND candidate.vote_id = office.vote_id
          AND candidate.office_id = office.id
      ),
      'notaCount', COALESCE((
        SELECT tally.accepted_count FROM public.poll_private_tallies AS tally
        WHERE tally.society_id = office.society_id AND tally.vote_id = office.vote_id
          AND tally.office_id = office.id AND tally.candidate_id IS NULL
      ), 0)
    ) ORDER BY office.position, office.id), '[]'::jsonb)
    INTO results_offices FROM public.poll_offices AS office
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id;
  END IF;
  RETURN jsonb_build_object(
    'voteId', p_vote_id, 'votingType', vote.voting_type, 'status', vote.status,
    'selectionMode', vote.selection_mode, 'eligible', eligible_count,
    'submitted', submitted_count,
    'options', CASE WHEN vote.voting_type = 'public' THEN results_options ELSE NULL END,
    'offices', CASE WHEN vote.voting_type = 'private' AND vote.status = 'completed'
      THEN results_offices ELSE NULL END,
    'responses', responses
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_admin_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote_id uuid;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SET LOCAL lock_timeout = '5s';
  FOR vote_id IN
    SELECT id FROM public.poll_votes WHERE society_id = p_society_id
      AND status IN ('scheduled', 'active') AND closes_at <= clock_timestamp()
    ORDER BY closes_at, id LIMIT 200
  LOOP
    PERFORM private.poll_reconcile_locked(p_society_id, vote_id);
  END LOOP;
  RETURN jsonb_build_object(
    'canManage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'votes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', vote.id, 'title', vote.title, 'votingType', vote.voting_type,
        'status', vote.status, 'opensAt', vote.opens_at, 'closesAt', vote.closes_at,
        'completedAt', vote.completed_at, 'cancelledAt', vote.cancelled_at,
        'eligible', CASE WHEN vote.status IN ('active', 'completed', 'cancelled')
          AND vote.activated_at IS NOT NULL THEN COALESCE(vote.final_eligible_count,
            (SELECT count(*) FROM public.poll_electorate AS e
             WHERE e.society_id = vote.society_id AND e.vote_id = vote.id)) END,
        'submitted', CASE WHEN vote.status IN ('active', 'completed', 'cancelled')
          AND vote.activated_at IS NOT NULL THEN COALESCE(vote.final_submitted_count,
            (SELECT count(*) FROM public.poll_participation AS p
             WHERE p.society_id = vote.society_id AND p.vote_id = vote.id)) END,
        'updatedAt', vote.updated_at
      ) ORDER BY vote.created_at DESC, vote.id DESC)
      FROM (
        SELECT * FROM public.poll_votes WHERE society_id = p_society_id
        ORDER BY created_at DESC, id DESC LIMIT 500
      ) AS vote
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_admin_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  can_manage boolean;
  effective_tenant_voting boolean;
  issue_keys text[];
  preview jsonb;
  turnout jsonb;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SET LOCAL lock_timeout = '5s';
  PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  can_manage := private.has_role(p_society_id, ARRAY['admin']::text[]);
  SELECT COALESCE((config.settings ->> 'tenant_voting_default')::boolean, false)
  INTO effective_tenant_voting FROM public.module_configs AS config
  WHERE config.society_id = p_society_id AND config.module_key = 'poll';
  effective_tenant_voting := CASE WHEN vote.status = 'draft'
    THEN COALESCE(vote.tenant_voting_override, effective_tenant_voting, false)
    ELSE vote.tenant_voting END;
  IF vote.status = 'draft' THEN
    issue_keys := private.poll_readiness(p_society_id, p_vote_id,
      COALESCE(vote.opens_at, clock_timestamp()), true);
    SELECT jsonb_build_object(
      'eligibleUnits', eligible_count,
      'unitsWithoutVoter', COALESCE(missing.units, '[]'::jsonb)
    ) INTO preview
    FROM (
      SELECT count(*)::integer AS eligible_count
      FROM public.units AS unit
      CROSS JOIN LATERAL private.poll_effective_representative(
        p_society_id, unit.id, effective_tenant_voting
      ) AS representative
      WHERE unit.society_id = p_society_id AND unit.active
        AND (NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
              AND vote_id = p_vote_id)
          OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
              WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
                AND selected.block_id = unit.block_id))
    ) AS count_data
    CROSS JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('unitId', missing_unit.id,
        'unitLabel', COALESCE(block.name || '-', '') || missing_unit.number)
        ORDER BY block.name NULLS FIRST, missing_unit.number, missing_unit.id) AS units
      FROM (
        SELECT unit.id, unit.block_id, unit.number FROM public.units AS unit
        WHERE unit.society_id = p_society_id AND unit.active
          AND (NOT EXISTS (SELECT 1 FROM public.poll_vote_blocks WHERE society_id = p_society_id
                AND vote_id = p_vote_id)
            OR EXISTS (SELECT 1 FROM public.poll_vote_blocks AS selected
                WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
                  AND selected.block_id = unit.block_id))
          AND NOT EXISTS (
            SELECT 1 FROM private.poll_effective_representative(
              p_society_id, unit.id, effective_tenant_voting
            ) AS representative
          )
        ORDER BY unit.number, unit.id LIMIT 200
      ) AS missing_unit
      LEFT JOIN public.blocks AS block
        ON block.society_id = p_society_id AND block.id = missing_unit.block_id
    ) AS missing;
  END IF;
  IF vote.activated_at IS NOT NULL AND vote.status IN ('active', 'completed', 'cancelled') THEN
    turnout := jsonb_build_object(
      'eligible', COALESCE(vote.final_eligible_count, (
        SELECT count(*) FROM public.poll_electorate
        WHERE society_id = p_society_id AND vote_id = p_vote_id
      )),
      'submitted', COALESCE(vote.final_submitted_count, (
        SELECT count(*) FROM public.poll_participation
        WHERE society_id = p_society_id AND vote_id = p_vote_id
      ))
    );
  END IF;
  RETURN jsonb_build_object(
    'canManage', can_manage,
    'vote', jsonb_build_object(
      'id', vote.id, 'title', vote.title, 'instructions', vote.instructions,
      'votingType', vote.voting_type, 'selectionMode', vote.selection_mode,
      'selectionLimit', vote.selection_limit, 'status', vote.status,
      'opensAt', vote.opens_at, 'closesAt', vote.closes_at,
      'completedAt', vote.completed_at, 'cancelledAt', vote.cancelled_at,
      'cancellationReason', vote.cancellation_reason,
      'completionMode', vote.completion_mode, 'completionReason', vote.completion_reason,
      'revision', vote.revision, 'tenantVotingOverride', vote.tenant_voting_override,
      'tenantVoting', vote.tenant_voting, 'tenantVotingEffective', effective_tenant_voting,
      'blockIds', COALESCE((
        SELECT jsonb_agg(selected.block_id ORDER BY selected.block_id)
        FROM public.poll_vote_blocks AS selected
        WHERE selected.society_id = p_society_id AND selected.vote_id = p_vote_id
      ), '[]'::jsonb),
      'createdAt', vote.created_at, 'scheduledAt', vote.scheduled_at,
      'activatedAt', vote.activated_at, 'withdrawnAt', vote.withdrawn_at,
      'withdrawalReason', vote.withdrawal_reason
    ),
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label,
        'position', option.position) ORDER BY option.position, option.id)
      FROM public.poll_options AS option
      WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id
    ), '[]'::jsonb),
    'offices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', office.id, 'name', office.name,
        'position', office.position, 'candidates', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('id', candidate.id,
            'name', candidate.name, 'position', candidate.position)
            ORDER BY candidate.position, candidate.id), '[]'::jsonb)
          FROM public.poll_candidates AS candidate
          WHERE candidate.society_id = office.society_id
            AND candidate.vote_id = office.vote_id AND candidate.office_id = office.id
        )) ORDER BY office.position, office.id)
      FROM public.poll_offices AS office
      WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id
    ), '[]'::jsonb),
    'readiness', jsonb_build_object('ready', COALESCE(cardinality(issue_keys) = 0, true),
      'issues', COALESCE(to_jsonb(issue_keys), '[]'::jsonb)),
    'electoratePreview', preview, 'turnout', turnout
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_participation_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  eligible_count integer;
  submitted_count integer;
  roster jsonb;
  is_admin boolean;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SET LOCAL lock_timeout = '5s';
  PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  IF vote.activated_at IS NULL THEN
    RETURN jsonb_build_object('eligible', NULL, 'submitted', NULL, 'units', NULL);
  END IF;
  eligible_count := COALESCE(vote.final_eligible_count, (
    SELECT count(*) FROM public.poll_electorate
    WHERE society_id = p_society_id AND vote_id = p_vote_id
  ));
  submitted_count := COALESCE(vote.final_submitted_count, (
    SELECT count(*) FROM public.poll_participation
    WHERE society_id = p_society_id AND vote_id = p_vote_id
  ));
  IF (is_admin AND vote.status IN ('active', 'completed', 'cancelled'))
    OR (NOT is_admin AND vote.status = 'completed')
  THEN
    IF vote.personal_data_purged_at IS NULL THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'unitId', electorate.unit_id, 'unitLabel', electorate.unit_label,
        'representativeName', electorate.representative_name,
        'submitted', participation.unit_id IS NOT NULL
      ) ORDER BY electorate.unit_label, electorate.unit_id), '[]'::jsonb)
      INTO roster FROM public.poll_electorate AS electorate
      LEFT JOIN public.poll_participation AS participation
        ON participation.society_id = electorate.society_id
        AND participation.vote_id = electorate.vote_id
        AND participation.unit_id = electorate.unit_id
      WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('eligible', eligible_count, 'submitted', submitted_count, 'units', roster);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_export_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote public.poll_votes;
  options jsonb;
  offices jsonb;
  responses jsonb;
  roster jsonb;
  eligible_count integer;
  submitted_count integer;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SET LOCAL lock_timeout = '5s';
  PERFORM private.poll_reconcile_locked(p_society_id, p_vote_id);
  SELECT * INTO vote FROM public.poll_votes
  WHERE society_id = p_society_id AND id = p_vote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE = 'P0002'; END IF;
  IF vote.status <> 'completed' THEN
    RAISE EXCEPTION 'poll_results_unavailable' USING ERRCODE = 'P0001';
  END IF;
  eligible_count := COALESCE(vote.final_eligible_count, 0);
  submitted_count := COALESCE(vote.final_submitted_count, 0);
  IF vote.voting_type = 'public' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label,
      'count', option.final_count) ORDER BY option.position, option.id), '[]'::jsonb)
    INTO options FROM public.poll_options AS option
    WHERE option.society_id = p_society_id AND option.vote_id = p_vote_id;
    IF vote.personal_data_purged_at IS NULL THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'unitLabel', electorate.unit_label,
        'representativeName', electorate.representative_name,
        'optionIds', (
          SELECT jsonb_agg(response.option_id ORDER BY response.option_id)
          FROM public.poll_public_responses AS response
          WHERE response.society_id = electorate.society_id
            AND response.vote_id = electorate.vote_id AND response.unit_id = electorate.unit_id
        )
      ) ORDER BY electorate.unit_label, electorate.unit_id), '[]'::jsonb)
      INTO responses FROM public.poll_electorate AS electorate
      JOIN public.poll_participation AS participation
        ON participation.society_id = electorate.society_id
        AND participation.vote_id = electorate.vote_id AND participation.unit_id = electorate.unit_id
      WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id;
    END IF;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', office.id, 'name', office.name,
      'candidates', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', candidate.id, 'name', candidate.name,
          'count', tally.accepted_count) ORDER BY candidate.position, candidate.id), '[]'::jsonb)
        FROM public.poll_candidates AS candidate
        JOIN public.poll_private_tallies AS tally
          ON tally.society_id = candidate.society_id AND tally.vote_id = candidate.vote_id
          AND tally.office_id = candidate.office_id AND tally.candidate_id = candidate.id
        WHERE candidate.society_id = office.society_id
          AND candidate.vote_id = office.vote_id AND candidate.office_id = office.id
      ),
      'notaCount', COALESCE((
        SELECT tally.accepted_count FROM public.poll_private_tallies AS tally
        WHERE tally.society_id = office.society_id AND tally.vote_id = office.vote_id
          AND tally.office_id = office.id AND tally.candidate_id IS NULL
      ), 0)
    ) ORDER BY office.position, office.id), '[]'::jsonb)
    INTO offices FROM public.poll_offices AS office
    WHERE office.society_id = p_society_id AND office.vote_id = p_vote_id;
    IF vote.personal_data_purged_at IS NULL THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'unitLabel', electorate.unit_label, 'representativeName', electorate.representative_name
      ) ORDER BY electorate.unit_label, electorate.unit_id), '[]'::jsonb)
      INTO roster FROM public.poll_electorate AS electorate
      JOIN public.poll_participation AS participation
        ON participation.society_id = electorate.society_id
        AND participation.vote_id = electorate.vote_id AND participation.unit_id = electorate.unit_id
      WHERE electorate.society_id = p_society_id AND electorate.vote_id = p_vote_id;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'societyName', (SELECT name FROM public.societies WHERE id = p_society_id),
    'vote', jsonb_build_object('id', vote.id, 'title', vote.title, 'instructions', vote.instructions,
      'votingType', vote.voting_type, 'selectionMode', vote.selection_mode,
      'opensAt', vote.opens_at, 'closesAt', vote.closes_at, 'completedAt', vote.completed_at,
      'completionMode', vote.completion_mode),
    'eligible', eligible_count, 'submitted', submitted_count,
    'options', options, 'offices', offices, 'responses', responses, 'roster', roster
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_representatives_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  can_manage_all boolean;
  tenant_voting boolean;
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'resident']::text[], false);
  can_manage_all := private.has_role(p_society_id, ARRAY['admin']::text[]);
  SELECT COALESCE((settings ->> 'tenant_voting_default')::boolean, false)
  INTO tenant_voting FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll';
  RETURN jsonb_build_object(
    'canManageAll', can_manage_all,
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'unitId', unit.id,
        'unitLabel', COALESCE(block.name || '-', '') || unit.number,
        'blockName', block.name,
        'version', COALESCE(designated.version, 0),
        'designated', CASE WHEN designated.membership_id IS NULL
          OR designated_occupant.id IS NULL OR designated_membership.id IS NULL
          THEN NULL ELSE jsonb_build_object(
          'membershipId', designated_membership.id,
          'name', designated_profile.full_name,
          'relationship', designated_occupant.relationship
        ) END,
        'effective', CASE WHEN effective.membership_id IS NULL THEN NULL ELSE jsonb_build_object(
          'membershipId', effective.membership_id, 'name', effective.representative_name,
          'relationship', effective.relationship
        ) END,
        'options', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'membershipId', occupant.membership_id, 'name', profile.full_name,
            'relationship', occupant.relationship, 'isPrimary', occupant.is_primary
          ) ORDER BY (occupant.is_primary AND occupant.relationship = 'owner') DESC,
            (occupant.relationship = 'owner') DESC, occupant.started_at, occupant.created_at, occupant.id),
            '[]'::jsonb)
          FROM public.unit_occupants AS occupant
          JOIN public.memberships AS membership
            ON membership.society_id = occupant.society_id
            AND membership.id = occupant.membership_id AND membership.status = 'active'
          JOIN public.profiles AS profile ON profile.id = membership.user_id
          WHERE occupant.society_id = p_society_id AND occupant.unit_id = unit.id
            AND occupant.status = 'active' AND occupant.relationship IN ('owner', 'tenant')
            AND 'resident' = ANY(membership.roles)
        )
      ) ORDER BY block.name NULLS FIRST, unit.number, unit.id)
      FROM (
        SELECT * FROM public.units AS unit
        WHERE unit.society_id = p_society_id AND unit.active
          AND (can_manage_all OR EXISTS (
            SELECT 1 FROM public.unit_occupants AS own_occupancy
            JOIN public.memberships AS own_membership
              ON own_membership.society_id = own_occupancy.society_id
              AND own_membership.id = own_occupancy.membership_id
            WHERE own_occupancy.society_id = unit.society_id
              AND own_occupancy.unit_id = unit.id AND own_occupancy.status = 'active'
              AND own_occupancy.relationship = 'owner'
              AND own_membership.status = 'active' AND own_membership.user_id = auth.uid()
          ))
        ORDER BY unit.block_id, unit.number, unit.id LIMIT 2000
      ) AS unit
      LEFT JOIN public.blocks AS block
        ON block.society_id = unit.society_id AND block.id = unit.block_id
      LEFT JOIN public.poll_unit_representatives AS designated
        ON designated.society_id = unit.society_id AND designated.unit_id = unit.id
      LEFT JOIN public.unit_occupants AS designated_occupant
        ON designated_occupant.society_id = designated.society_id
        AND designated_occupant.unit_id = designated.unit_id
        AND designated_occupant.membership_id = designated.membership_id
        AND designated_occupant.status = 'active'
      LEFT JOIN public.memberships AS designated_membership
        ON designated_membership.society_id = designated.society_id
        AND designated_membership.id = designated.membership_id
        AND designated_membership.status = 'active'
      LEFT JOIN public.profiles AS designated_profile
        ON designated_profile.id = designated_membership.user_id
      LEFT JOIN LATERAL private.poll_effective_representative(
        p_society_id, unit.id, tenant_voting
      ) AS effective ON true
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_reconcile_due(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote_id uuid;
  outcome jsonb;
  opened_count integer := 0;
  completed_count integer := 0;
  notified_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Poll maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'poll') THEN
    RETURN jsonb_build_object('opened', 0, 'completed', 0, 'notified', 0);
  END IF;
  SET LOCAL lock_timeout = '5s';
  FOR vote_id IN
    SELECT id FROM public.poll_votes
    WHERE society_id = p_society_id
      AND ((status = 'scheduled' AND opens_at <= clock_timestamp())
        OR (status = 'active' AND closes_at <= clock_timestamp()))
    ORDER BY COALESCE(closes_at, opens_at), id
    LIMIT 100 FOR UPDATE SKIP LOCKED
  LOOP
    outcome := private.poll_reconcile_locked(p_society_id, vote_id);
    opened_count := opened_count + (outcome ->> 'opened')::integer;
    completed_count := completed_count + (outcome ->> 'completed')::integer;
    notified_count := notified_count + (outcome ->> 'notified')::integer;
  END LOOP;
  RETURN jsonb_build_object('opened', opened_count, 'completed', completed_count,
    'notified', notified_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_retention_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  vote record;
  purged integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Poll maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  SET LOCAL lock_timeout = '5s';
  PERFORM set_config('homeish.retention_purge', 'on', true);
  PERFORM set_config('poll.allow_delete', 'on', true);
  FOR vote IN
    SELECT society_id, id, COALESCE(completed_at, cancelled_at) AS ended_at
    FROM public.poll_votes
    WHERE status IN ('completed', 'cancelled') AND personal_data_purged_at IS NULL
      AND COALESCE(completed_at, cancelled_at) <= clock_timestamp() - interval '2 years'
    ORDER BY COALESCE(completed_at, cancelled_at), id
    LIMIT 50 FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.poll_public_responses
    WHERE society_id = vote.society_id AND vote_id = vote.id;
    DELETE FROM public.poll_participation
    WHERE society_id = vote.society_id AND vote_id = vote.id;
    DELETE FROM public.poll_electorate
    WHERE society_id = vote.society_id AND vote_id = vote.id;
    UPDATE public.poll_votes SET personal_data_purged_at = clock_timestamp()
    WHERE society_id = vote.society_id AND id = vote.id AND personal_data_purged_at IS NULL;
    PERFORM private.poll_audit(vote.society_id, 'personal_data_purged', 'poll_vote', vote.id,
      jsonb_build_object('endedAt', vote.ended_at, 'retainedAggregates', true));
    purged := purged + 1;
  END LOOP;
  PERFORM set_config('poll.allow_delete', 'off', true);
  RETURN jsonb_build_object('purgedVotes', purged);
END;
$$;

REVOKE ALL ON FUNCTION
  public.poll_member_list(uuid),
  public.poll_member_get(uuid, uuid),
  public.poll_results_get(uuid, uuid),
  public.poll_admin_list(uuid),
  public.poll_admin_get(uuid, uuid),
  public.poll_participation_get(uuid, uuid),
  public.poll_export_get(uuid, uuid),
  public.poll_representatives_get(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.poll_member_list(uuid),
  public.poll_member_get(uuid, uuid),
  public.poll_results_get(uuid, uuid),
  public.poll_admin_list(uuid),
  public.poll_admin_get(uuid, uuid),
  public.poll_participation_get(uuid, uuid),
  public.poll_export_get(uuid, uuid),
  public.poll_representatives_get(uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.poll_reconcile_due(uuid), public.poll_retention_run()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.poll_reconcile_due(uuid), public.poll_retention_run()
  TO service_role;
