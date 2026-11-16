-- Polls & Voting: tenant-scoped schema, immutable-data guards and final RPC contracts.
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  voting_type text NOT NULL,
  selection_mode text NOT NULL DEFAULT 'single',
  selection_limit integer DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT '',
  instructions text,
  tenant_voting_override boolean,
  tenant_voting boolean,
  opens_at timestamptz,
  closes_at timestamptz,
  revision integer NOT NULL DEFAULT 1,
  client_request_id text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  scheduled_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  completion_mode text,
  completion_reason text,
  cancelled_at timestamptz,
  cancellation_reason text,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  final_eligible_count integer,
  final_submitted_count integer,
  opened_notified_at timestamptz,
  results_notified_at timestamptz,
  cancel_notified_at timestamptz,
  personal_data_purged_at timestamptz,
  CONSTRAINT poll_votes_type_check CHECK (voting_type IN ('public', 'private')),
  CONSTRAINT poll_votes_selection_mode_check CHECK (selection_mode IN ('single', 'multiple')),
  CONSTRAINT poll_votes_selection_limit_check CHECK (
    (selection_mode = 'single' AND selection_limit = 1)
    OR (selection_mode = 'multiple' AND (selection_limit IS NULL OR selection_limit BETWEEN 2 AND 100))
  ),
  CONSTRAINT poll_votes_private_single_check CHECK (voting_type <> 'private' OR selection_mode = 'single'),
  CONSTRAINT poll_votes_status_check CHECK (
    status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled')
  ),
  CONSTRAINT poll_votes_title_check CHECK (
    title = btrim(title) AND (
      (status = 'draft' AND title = '')
      OR char_length(title) BETWEEN 1 AND 150
    )
  ),
  CONSTRAINT poll_votes_instructions_check CHECK (
    instructions IS NULL OR (char_length(instructions) <= 2000 AND instructions = btrim(instructions))
  ),
  CONSTRAINT poll_votes_revision_check CHECK (revision >= 1),
  CONSTRAINT poll_votes_client_request_id_check CHECK (
    char_length(btrim(client_request_id)) BETWEEN 1 AND 120
  ),
  CONSTRAINT poll_votes_state_check CHECK (
    (status = 'draft' AND tenant_voting IS NULL AND scheduled_at IS NULL AND activated_at IS NULL
      AND completed_at IS NULL AND completion_mode IS NULL AND completion_reason IS NULL
      AND cancelled_at IS NULL AND cancellation_reason IS NULL
      AND final_eligible_count IS NULL AND final_submitted_count IS NULL
      AND personal_data_purged_at IS NULL)
    OR (status = 'scheduled' AND tenant_voting IS NOT NULL AND scheduled_at IS NOT NULL
      AND activated_at IS NULL AND completed_at IS NULL AND completion_mode IS NULL
      AND completion_reason IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL
      AND final_eligible_count IS NULL AND final_submitted_count IS NULL
      AND personal_data_purged_at IS NULL)
    OR (status = 'active' AND tenant_voting IS NOT NULL AND opens_at IS NOT NULL
      AND closes_at IS NOT NULL AND activated_at IS NOT NULL
      AND completed_at IS NULL AND completion_mode IS NULL AND completion_reason IS NULL
      AND cancelled_at IS NULL AND cancellation_reason IS NULL
      AND final_eligible_count IS NULL AND final_submitted_count IS NULL
      AND personal_data_purged_at IS NULL)
    OR (status = 'completed' AND tenant_voting IS NOT NULL AND opens_at IS NOT NULL
      AND closes_at IS NOT NULL AND activated_at IS NOT NULL AND completed_at IS NOT NULL
      AND completion_mode IN ('deadline', 'early')
      AND ((completion_mode = 'deadline' AND completed_at = closes_at AND completion_reason IS NULL)
        OR (completion_mode = 'early' AND completed_at < closes_at
          AND char_length(btrim(completion_reason)) BETWEEN 1 AND 500))
      AND cancelled_at IS NULL AND cancellation_reason IS NULL
      AND final_eligible_count >= 0 AND final_submitted_count >= 0
      AND final_submitted_count <= final_eligible_count)
    OR (status = 'cancelled' AND tenant_voting IS NOT NULL AND cancelled_at IS NOT NULL
      AND char_length(btrim(cancellation_reason)) BETWEEN 1 AND 500
      AND completed_at IS NULL AND completion_mode IS NULL AND completion_reason IS NULL
      AND final_eligible_count IS NULL AND final_submitted_count IS NULL)
  ),
  CONSTRAINT poll_votes_purge_state_check CHECK (
    personal_data_purged_at IS NULL OR status IN ('completed', 'cancelled')
  ),
  CONSTRAINT poll_votes_withdrawal_check CHECK (
    (withdrawn_at IS NULL) = (withdrawal_reason IS NULL)
    AND (withdrawal_reason IS NULL OR char_length(btrim(withdrawal_reason)) BETWEEN 1 AND 500)
  ),
  CONSTRAINT poll_votes_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT poll_votes_client_request_key UNIQUE (society_id, client_request_id)
);
CREATE INDEX poll_votes_society_status_created_idx
  ON public.poll_votes (society_id, status, created_at DESC);
CREATE INDEX poll_votes_created_by_idx ON public.poll_votes (created_by);
CREATE INDEX poll_votes_updated_by_idx ON public.poll_votes (updated_by);

CREATE TABLE public.poll_vote_blocks (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  block_id uuid NOT NULL,
  CONSTRAINT poll_vote_blocks_pkey PRIMARY KEY (society_id, vote_id, block_id),
  CONSTRAINT poll_vote_blocks_vote_same_society_fkey
    FOREIGN KEY (society_id, vote_id) REFERENCES public.poll_votes (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_vote_blocks_block_same_society_fkey
    FOREIGN KEY (society_id, block_id) REFERENCES public.blocks (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX poll_vote_blocks_block_idx ON public.poll_vote_blocks (society_id, block_id);

CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  label text NOT NULL,
  position integer NOT NULL,
  final_count bigint,
  CONSTRAINT poll_options_label_check CHECK (
    char_length(btrim(label)) BETWEEN 1 AND 200 AND label = btrim(label)
  ),
  CONSTRAINT poll_options_position_check CHECK (position BETWEEN 1 AND 100),
  CONSTRAINT poll_options_final_count_check CHECK (final_count IS NULL OR final_count >= 0),
  CONSTRAINT poll_options_vote_same_society_fkey
    FOREIGN KEY (society_id, vote_id) REFERENCES public.poll_votes (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_options_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT poll_options_vote_position_key UNIQUE (society_id, vote_id, position),
  CONSTRAINT poll_options_vote_id_key UNIQUE (society_id, vote_id, id)
);
CREATE UNIQUE INDEX poll_options_distinct_label_key
  ON public.poll_options (society_id, vote_id, lower(btrim(label)));
CREATE INDEX poll_options_vote_idx ON public.poll_options (society_id, vote_id);

CREATE TABLE public.poll_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL,
  CONSTRAINT poll_offices_name_check CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 120 AND name = btrim(name)
  ),
  CONSTRAINT poll_offices_position_check CHECK (position BETWEEN 1 AND 20),
  CONSTRAINT poll_offices_vote_same_society_fkey
    FOREIGN KEY (society_id, vote_id) REFERENCES public.poll_votes (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_offices_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT poll_offices_vote_position_key UNIQUE (society_id, vote_id, position),
  CONSTRAINT poll_offices_vote_id_key UNIQUE (society_id, vote_id, id)
);
CREATE UNIQUE INDEX poll_offices_distinct_name_key
  ON public.poll_offices (society_id, vote_id, lower(btrim(name)));
CREATE INDEX poll_offices_vote_idx ON public.poll_offices (society_id, vote_id);

CREATE TABLE public.poll_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  office_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL,
  CONSTRAINT poll_candidates_name_check CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 120 AND name = btrim(name)
  ),
  CONSTRAINT poll_candidates_position_check CHECK (position BETWEEN 1 AND 50),
  CONSTRAINT poll_candidates_office_same_society_fkey
    FOREIGN KEY (society_id, vote_id, office_id)
    REFERENCES public.poll_offices (society_id, vote_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_candidates_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT poll_candidates_office_position_key UNIQUE (society_id, vote_id, office_id, position),
  CONSTRAINT poll_candidates_office_id_key UNIQUE (society_id, vote_id, office_id, id)
);
CREATE UNIQUE INDEX poll_candidates_distinct_name_key
  ON public.poll_candidates (society_id, vote_id, office_id, lower(btrim(name)));
CREATE INDEX poll_candidates_office_idx
  ON public.poll_candidates (society_id, vote_id, office_id);

CREATE TABLE public.poll_unit_representatives (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  membership_id uuid,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_unit_representatives_pkey PRIMARY KEY (society_id, unit_id),
  CONSTRAINT poll_unit_representatives_version_check CHECK (version >= 1),
  CONSTRAINT poll_unit_representatives_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_unit_representatives_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX poll_unit_representatives_membership_idx
  ON public.poll_unit_representatives (society_id, membership_id);
CREATE INDEX poll_unit_representatives_updated_by_idx ON public.poll_unit_representatives (updated_by);

CREATE TABLE public.poll_electorate (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  representative_name text NOT NULL,
  unit_label text NOT NULL,
  block_id uuid,
  CONSTRAINT poll_electorate_pkey PRIMARY KEY (society_id, vote_id, unit_id),
  CONSTRAINT poll_electorate_representative_name_check
    CHECK (char_length(btrim(representative_name)) BETWEEN 1 AND 120),
  CONSTRAINT poll_electorate_unit_label_check CHECK (char_length(btrim(unit_label)) BETWEEN 1 AND 80),
  CONSTRAINT poll_electorate_vote_same_society_fkey
    FOREIGN KEY (society_id, vote_id) REFERENCES public.poll_votes (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_electorate_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_electorate_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_electorate_block_same_society_fkey
    FOREIGN KEY (society_id, block_id) REFERENCES public.blocks (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX poll_electorate_membership_idx
  ON public.poll_electorate (society_id, membership_id);
CREATE INDEX poll_electorate_user_idx ON public.poll_electorate (society_id, user_id, vote_id);
CREATE INDEX poll_electorate_user_id_fk_idx ON public.poll_electorate (user_id);
CREATE INDEX poll_electorate_unit_fk_idx ON public.poll_electorate (society_id, unit_id);
CREATE INDEX poll_electorate_block_idx ON public.poll_electorate (society_id, block_id);

CREATE TABLE public.poll_participation (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT poll_participation_pkey PRIMARY KEY (society_id, vote_id, unit_id),
  CONSTRAINT poll_participation_electorate_same_society_fkey
    FOREIGN KEY (society_id, vote_id, unit_id)
    REFERENCES public.poll_electorate (society_id, vote_id, unit_id) ON DELETE RESTRICT
);
CREATE INDEX poll_participation_vote_idx ON public.poll_participation (society_id, vote_id);

CREATE TABLE public.poll_public_responses (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  option_id uuid NOT NULL,
  CONSTRAINT poll_public_responses_pkey PRIMARY KEY (society_id, vote_id, unit_id, option_id),
  CONSTRAINT poll_public_responses_participation_same_society_fkey
    FOREIGN KEY (society_id, vote_id, unit_id)
    REFERENCES public.poll_participation (society_id, vote_id, unit_id) ON DELETE RESTRICT,
  CONSTRAINT poll_public_responses_option_same_society_fkey
    FOREIGN KEY (society_id, vote_id, option_id)
    REFERENCES public.poll_options (society_id, vote_id, id) ON DELETE RESTRICT
);
CREATE INDEX poll_public_responses_vote_option_idx
  ON public.poll_public_responses (society_id, vote_id, option_id);

CREATE TABLE public.poll_private_tallies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  vote_id uuid NOT NULL,
  office_id uuid NOT NULL,
  candidate_id uuid,
  accepted_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT poll_private_tallies_count_check CHECK (accepted_count >= 0),
  CONSTRAINT poll_private_tallies_office_same_society_fkey
    FOREIGN KEY (society_id, vote_id, office_id)
    REFERENCES public.poll_offices (society_id, vote_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_private_tallies_candidate_same_society_fkey
    FOREIGN KEY (society_id, vote_id, office_id, candidate_id)
    REFERENCES public.poll_candidates (society_id, vote_id, office_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_private_tallies_society_id_id_key UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX poll_private_tallies_candidate_key
  ON public.poll_private_tallies (society_id, vote_id, office_id, candidate_id)
  WHERE society_id IS NOT NULL AND vote_id IS NOT NULL
    AND office_id IS NOT NULL AND candidate_id IS NOT NULL;
CREATE UNIQUE INDEX poll_private_tallies_nota_key
  ON public.poll_private_tallies (society_id, vote_id, office_id)
  WHERE candidate_id IS NULL;
CREATE INDEX poll_private_tallies_vote_idx
  ON public.poll_private_tallies (society_id, vote_id, office_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_vote_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_unit_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_electorate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_public_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_private_tallies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.poll_votes, public.poll_vote_blocks, public.poll_options,
  public.poll_offices, public.poll_candidates, public.poll_unit_representatives,
  public.poll_electorate, public.poll_participation, public.poll_public_responses,
  public.poll_private_tallies FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY poll_votes_no_direct_access ON public.poll_votes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_vote_blocks_no_direct_access ON public.poll_vote_blocks
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_options_no_direct_access ON public.poll_options
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_offices_no_direct_access ON public.poll_offices
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_candidates_no_direct_access ON public.poll_candidates
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_unit_representatives_no_direct_access ON public.poll_unit_representatives
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_electorate_no_direct_access ON public.poll_electorate
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_participation_no_direct_access ON public.poll_participation
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_public_responses_no_direct_access ON public.poll_public_responses
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_private_tallies_no_direct_access ON public.poll_private_tallies
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.poll_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_society_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'poll')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Poll access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.poll_authorize(p_society_id, p_roles, true);
  SET LOCAL lock_timeout = '5s';
END;
$$;
REVOKE ALL ON FUNCTION private.poll_write_begin(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_audit(
  p_society_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", reason
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN auth.uid() IS NULL THEN 'system'
      WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
      WHEN private.has_role(p_society_id, ARRAY['committee']::text[]) THEN 'committee'
      ELSE 'resident' END,
    'poll.' || p_action, p_entity_type, p_entity_id::text, p_after, p_reason
  );
END;
$$;
REVOKE ALL ON FUNCTION private.poll_audit(uuid, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_effective_representative(
  p_society_id uuid, p_unit_id uuid, p_tenant_voting boolean
)
RETURNS TABLE(membership_id uuid, user_id uuid, representative_name text, relationship text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT occupant.membership_id, membership.user_id, profile.full_name, occupant.relationship
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  LEFT JOIN public.poll_unit_representatives AS designated
    ON designated.society_id = occupant.society_id AND designated.unit_id = occupant.unit_id
  WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
    AND occupant.status = 'active' AND membership.status = 'active'
    AND membership.user_id IS NOT NULL AND 'resident' = ANY(membership.roles)
    AND (occupant.relationship = 'owner' OR (p_tenant_voting AND occupant.relationship = 'tenant'))
  ORDER BY (occupant.membership_id = designated.membership_id) DESC,
    (occupant.is_primary AND occupant.relationship IN ('owner', 'tenant')) DESC,
    (occupant.relationship = 'owner') DESC, occupant.started_at, occupant.created_at, occupant.id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.poll_effective_representative(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_vote_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.society_id IS DISTINCT FROM OLD.society_id
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.voting_type IS DISTINCT FROM OLD.voting_type
      OR (NEW.status IS DISTINCT FROM OLD.status
        AND pg_catalog.current_setting('poll.lifecycle_write', true) IS DISTINCT FROM 'on')
      OR (OLD.status <> 'draft' AND (
      NEW.title IS DISTINCT FROM OLD.title
      OR NEW.instructions IS DISTINCT FROM OLD.instructions
      OR NEW.selection_mode IS DISTINCT FROM OLD.selection_mode
      OR NEW.selection_limit IS DISTINCT FROM OLD.selection_limit
      OR NEW.tenant_voting_override IS DISTINCT FROM OLD.tenant_voting_override
      OR (NEW.opens_at IS DISTINCT FROM OLD.opens_at
        AND pg_catalog.current_setting('poll.schedule_withdraw', true) IS DISTINCT FROM 'on')
      OR (NEW.closes_at IS DISTINCT FROM OLD.closes_at
        AND pg_catalog.current_setting('poll.deadline_extension', true) IS DISTINCT FROM 'on')
      ))
    THEN
      RAISE EXCEPTION 'Poll configuration is frozen.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND pg_catalog.current_setting('poll.allow_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Poll records cannot be deleted.' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_vote_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_votes_guard BEFORE UPDATE OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION private.poll_vote_guard();

CREATE FUNCTION private.poll_config_child_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  parent_society uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.society_id ELSE NEW.society_id END;
  parent_vote uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.vote_id ELSE NEW.vote_id END;
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM public.poll_votes
  WHERE society_id = parent_society AND id = parent_vote;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Poll configuration is frozen.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' AND pg_catalog.current_setting('poll.allow_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Poll records cannot be deleted.' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_config_child_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_vote_blocks_guard BEFORE INSERT OR UPDATE OR DELETE ON public.poll_vote_blocks
  FOR EACH ROW EXECUTE FUNCTION private.poll_config_child_guard();
CREATE TRIGGER poll_options_guard BEFORE INSERT OR DELETE ON public.poll_options
  FOR EACH ROW EXECUTE FUNCTION private.poll_config_child_guard();
CREATE FUNCTION private.poll_option_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM public.poll_votes
  WHERE society_id = OLD.society_id AND id = OLD.vote_id;
  IF parent_status = 'draft' AND NEW.society_id = OLD.society_id
    AND NEW.vote_id = OLD.vote_id AND NEW.id = OLD.id AND NEW.final_count IS NULL
  THEN
    RETURN NEW;
  END IF;
  IF parent_status = 'active'
    AND pg_catalog.current_setting('poll.finalize', true) = 'on'
    AND NEW.society_id = OLD.society_id AND NEW.vote_id = OLD.vote_id AND NEW.id = OLD.id
    AND NEW.label = OLD.label AND NEW.position = OLD.position
    AND NEW.final_count IS NOT NULL AND NEW.final_count >= 0
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Poll configuration is frozen.' USING ERRCODE = '23514';
END;
$$;
REVOKE ALL ON FUNCTION private.poll_option_update_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_options_update_guard BEFORE UPDATE ON public.poll_options
  FOR EACH ROW EXECUTE FUNCTION private.poll_option_update_guard();
CREATE TRIGGER poll_offices_guard BEFORE INSERT OR UPDATE OR DELETE ON public.poll_offices
  FOR EACH ROW EXECUTE FUNCTION private.poll_config_child_guard();
CREATE TRIGGER poll_candidates_guard BEFORE INSERT OR UPDATE OR DELETE ON public.poll_candidates
  FOR EACH ROW EXECUTE FUNCTION private.poll_config_child_guard();

CREATE FUNCTION private.poll_frozen_child_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_catalog.current_setting('poll.allow_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Frozen poll records cannot be changed.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.poll_frozen_child_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_electorate_immutable BEFORE UPDATE OR DELETE ON public.poll_electorate
  FOR EACH ROW EXECUTE FUNCTION private.poll_frozen_child_guard();
CREATE TRIGGER poll_participation_immutable BEFORE UPDATE ON public.poll_participation
  FOR EACH ROW EXECUTE FUNCTION private.poll_frozen_child_guard();
CREATE TRIGGER poll_participation_no_delete BEFORE DELETE ON public.poll_participation
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER poll_public_responses_immutable BEFORE UPDATE OR DELETE ON public.poll_public_responses
  FOR EACH ROW EXECUTE FUNCTION private.poll_frozen_child_guard();
CREATE TRIGGER poll_private_tallies_delete_guard BEFORE DELETE ON public.poll_private_tallies
  FOR EACH ROW EXECUTE FUNCTION private.poll_frozen_child_guard();
CREATE FUNCTION private.poll_tally_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_catalog.current_setting('poll.allow_tally_write', true) = 'on'
    AND NEW.society_id = OLD.society_id AND NEW.vote_id = OLD.vote_id
    AND NEW.office_id = OLD.office_id AND NEW.candidate_id IS NOT DISTINCT FROM OLD.candidate_id
    AND NEW.accepted_count >= OLD.accepted_count
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Private counters cannot be changed directly.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.poll_tally_update_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_private_tallies_update_guard BEFORE UPDATE ON public.poll_private_tallies
  FOR EACH ROW EXECUTE FUNCTION private.poll_tally_update_guard();

CREATE FUNCTION private.poll_reject_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Poll records cannot be truncated.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.poll_reject_truncate() FROM PUBLIC, anon, authenticated, service_role;
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'poll_votes', 'poll_vote_blocks', 'poll_options', 'poll_offices', 'poll_candidates',
    'poll_unit_representatives', 'poll_electorate', 'poll_participation',
    'poll_public_responses', 'poll_private_tallies'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.poll_reject_truncate()',
      table_name || '_no_truncate', table_name);
  END LOOP;
END;
$$;

CREATE FUNCTION private.poll_public_response_constraint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  subject record;
  expected_limit integer;
  response_count integer;
  vote_type text;
BEGIN
  FOR subject IN
    SELECT DISTINCT society_id, vote_id, unit_id FROM (
      SELECT NEW.society_id, NEW.vote_id, NEW.unit_id WHERE TG_OP <> 'DELETE'
      UNION ALL
      SELECT OLD.society_id, OLD.vote_id, OLD.unit_id WHERE TG_OP <> 'INSERT'
    ) AS touched
  LOOP
    SELECT voting_type, selection_limit INTO vote_type, expected_limit FROM public.poll_votes
    WHERE society_id = subject.society_id AND id = subject.vote_id;
    IF vote_type = 'public' AND EXISTS (
      SELECT 1 FROM public.poll_participation AS participation
      WHERE participation.society_id = subject.society_id
        AND participation.vote_id = subject.vote_id AND participation.unit_id = subject.unit_id
    ) THEN
      SELECT count(*) INTO response_count FROM public.poll_public_responses
      WHERE society_id = subject.society_id AND vote_id = subject.vote_id AND unit_id = subject.unit_id;
      IF response_count < 1 OR (expected_limit IS NOT NULL AND response_count > expected_limit) THEN
        RAISE EXCEPTION 'poll_ballot_invalid' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_public_response_constraint() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER poll_public_responses_complete
  AFTER INSERT OR UPDATE OR DELETE ON public.poll_public_responses
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.poll_public_response_constraint();
CREATE CONSTRAINT TRIGGER poll_participation_complete
  AFTER INSERT ON public.poll_participation
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.poll_public_response_constraint();

CREATE FUNCTION private.poll_private_tally_constraint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  subject record;
  expected_count bigint;
  actual_count bigint;
BEGIN
  FOR subject IN
    SELECT DISTINCT society_id, vote_id, office_id FROM (
      SELECT NEW.society_id, NEW.vote_id, NEW.office_id WHERE TG_OP <> 'DELETE'
      UNION ALL
      SELECT OLD.society_id, OLD.vote_id, OLD.office_id WHERE TG_OP <> 'INSERT'
    ) AS touched
  LOOP
    SELECT count(*) INTO expected_count FROM public.poll_participation
    WHERE society_id = subject.society_id AND vote_id = subject.vote_id;
    SELECT COALESCE(sum(accepted_count), 0) INTO actual_count FROM public.poll_private_tallies
    WHERE society_id = subject.society_id AND vote_id = subject.vote_id
      AND office_id = subject.office_id;
    IF actual_count <> expected_count THEN
      RAISE EXCEPTION 'poll_results_mismatch' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_private_tally_constraint() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER poll_private_tallies_consistent
  AFTER INSERT OR UPDATE OR DELETE ON public.poll_private_tallies
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.poll_private_tally_constraint();

-- Public signatures and ACLs are fixed before implementations are filled in.
CREATE FUNCTION public.poll_draft_create(p_society_id uuid, p_client_request_id text, p_voting_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_draft_save(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer, p_draft jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_draft_delete(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_activate(p_society_id uuid, p_vote_id uuid, p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_schedule(
  p_society_id uuid, p_vote_id uuid, p_expected_revision integer, p_opens_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_schedule_withdraw(p_society_id uuid, p_vote_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_deadline_extend(
  p_society_id uuid, p_vote_id uuid, p_closes_at timestamptz, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_complete_early(p_society_id uuid, p_vote_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_cancel(p_society_id uuid, p_vote_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_settings_update(p_society_id uuid, p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_representative_set(
  p_society_id uuid, p_unit_id uuid, p_membership_id uuid, p_expected_version integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_ballot_submit(
  p_society_id uuid, p_vote_id uuid, p_unit_id uuid, p_submission jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['resident']::text[], true);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_member_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['resident']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_member_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['resident']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_results_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['resident', 'admin', 'committee']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_admin_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_admin_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_participation_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_export_get(p_society_id uuid, p_vote_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_representatives_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(p_society_id, ARRAY['admin', 'resident']::text[], false);
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_reconcile_due(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Poll maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.poll_retention_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Poll maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'poll_invalid_state' USING ERRCODE = 'P0001';
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
  public.poll_ballot_submit(uuid, uuid, uuid, jsonb),
  public.poll_member_list(uuid),
  public.poll_member_get(uuid, uuid),
  public.poll_results_get(uuid, uuid),
  public.poll_admin_list(uuid),
  public.poll_admin_get(uuid, uuid),
  public.poll_participation_get(uuid, uuid),
  public.poll_export_get(uuid, uuid),
  public.poll_representatives_get(uuid),
  public.poll_reconcile_due(uuid),
  public.poll_retention_run()
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
  public.poll_ballot_submit(uuid, uuid, uuid, jsonb),
  public.poll_member_list(uuid),
  public.poll_member_get(uuid, uuid),
  public.poll_results_get(uuid, uuid),
  public.poll_admin_list(uuid),
  public.poll_admin_get(uuid, uuid),
  public.poll_participation_get(uuid, uuid),
  public.poll_export_get(uuid, uuid),
  public.poll_representatives_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.poll_reconcile_due(uuid), public.poll_retention_run()
  TO service_role;
