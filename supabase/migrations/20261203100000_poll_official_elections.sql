-- Add P46 official elections beside the unchanged everyday P22 poll workflow.
ALTER TABLE public.module_configs
  DROP CONSTRAINT module_configs_poll_settings_check;

CREATE OR REPLACE FUNCTION private.poll_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN (
        'tenant_voting_default', 'official_voting_enabled',
        'official_legal_type', 'dispute_window_days',
        'nomination_supporters_enabled', 'multi_post_win_rule'
      )
    )
    AND (NOT p_settings ? 'tenant_voting_default'
      OR jsonb_typeof(p_settings -> 'tenant_voting_default') = 'boolean')
    AND (NOT p_settings ? 'official_voting_enabled'
      OR jsonb_typeof(p_settings -> 'official_voting_enabled') = 'boolean')
    AND (NOT p_settings ? 'official_legal_type'
      OR p_settings ->> 'official_legal_type' IN (
        'apartment_association', 'cooperative'
      ))
    AND (NOT p_settings ? 'dispute_window_days'
      OR (jsonb_typeof(p_settings -> 'dispute_window_days') = 'number'
        AND (p_settings ->> 'dispute_window_days') ~ '^[0-9]+$'
        AND (p_settings ->> 'dispute_window_days')::integer BETWEEN 1 AND 30))
    AND (NOT p_settings ? 'nomination_supporters_enabled'
      OR jsonb_typeof(p_settings -> 'nomination_supporters_enabled') = 'boolean')
    AND (NOT p_settings ? 'multi_post_win_rule'
      OR p_settings ->> 'multi_post_win_rule' IN (
        'candidate_choice', 'returning_officer'
      ))
$$;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_poll_settings_check
  CHECK (module_key <> 'poll' OR private.poll_settings_valid(settings));

CREATE OR REPLACE FUNCTION public.poll_settings_update(
  p_society_id uuid, p_settings jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous public.module_configs; next_settings jsonb;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key <> 'tenant_voting_default'
    )
  THEN RAISE EXCEPTION 'Poll settings are invalid.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO previous FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll' FOR UPDATE;
  next_settings := COALESCE(previous.settings, '{}'::jsonb) || p_settings;
  IF NOT private.poll_settings_valid(next_settings) THEN
    RAISE EXCEPTION 'Poll settings are invalid.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.module_configs SET settings = next_settings, updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'poll';
  PERFORM private.poll_audit(
    p_society_id, 'settings.update', 'poll_settings', NULL, p_settings, NULL
  );
  RETURN jsonb_build_object('settings', next_settings);
END;
$$;

CREATE TABLE public.poll_official_settings_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  enabled boolean NOT NULL,
  legal_type text
    CHECK (legal_type IS NULL OR legal_type IN (
      'apartment_association', 'cooperative'
    )),
  confirmation_text text
    CHECK (confirmation_text IS NULL OR (
      confirmation_text = btrim(confirmation_text)
      AND char_length(confirmation_text) BETWEEN 1 AND 500
    )),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CHECK (
    (enabled AND legal_type IS NOT NULL AND confirmation_text IS NOT NULL)
    OR (NOT enabled AND legal_type IS NULL AND confirmation_text IS NULL)
  ),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX poll_official_settings_events_society_idx
  ON public.poll_official_settings_events (society_id, created_at DESC);

CREATE TABLE public.poll_elections (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  title text NOT NULL
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 150),
  legal_type text NOT NULL CHECK (
    legal_type IN ('apartment_association', 'cooperative')
  ),
  stage text NOT NULL DEFAULT 'planning' CHECK (stage IN (
    'planning', 'nominations_open', 'scrutiny', 'candidates_published',
    'voting', 'counted', 'declared', 'closed', 'cancelled'
  )),
  source text NOT NULL DEFAULT 'in_app'
    CHECK (source IN ('in_app', 'outside_app')),
  nominations_open_at timestamptz,
  nominations_close_at timestamptz,
  voting_opens_at timestamptz,
  voting_closes_at timestamptz,
  outside_held_on date,
  dispute_window_days integer NOT NULL
    CHECK (dispute_window_days BETWEEN 1 AND 30),
  multi_post_win_rule text NOT NULL CHECK (
    multi_post_win_rule IN ('candidate_choice', 'returning_officer')
  ),
  nomination_supporters_enabled boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  counted_at timestamptz,
  declared_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  CHECK (
    (cancelled_at IS NULL AND cancellation_reason IS NULL)
    OR (
      cancelled_at IS NOT NULL
      AND cancellation_reason IS NOT NULL
      AND cancellation_reason = btrim(cancellation_reason)
      AND char_length(cancellation_reason) BETWEEN 1 AND 500
    )
  ),
  CHECK (
    (source = 'in_app'
      AND outside_held_on IS NULL
      AND (
        nominations_open_at IS NULL OR nominations_close_at IS NULL
        OR nominations_close_at > nominations_open_at
      )
      AND (
        voting_opens_at IS NULL OR voting_closes_at IS NULL
        OR voting_closes_at > voting_opens_at
      ))
    OR source = 'outside_app'
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX poll_elections_society_stage_idx
  ON public.poll_elections (society_id, stage, updated_at DESC);
CREATE INDEX poll_elections_created_by_idx ON public.poll_elections (created_by);
CREATE TRIGGER poll_elections_set_updated_at
  BEFORE UPDATE ON public.poll_elections
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.poll_election_posts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  seats integer NOT NULL CHECK (seats BETWEEN 1 AND 50),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 50),
  balloted boolean NOT NULL DEFAULT true,
  CONSTRAINT poll_election_posts_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, election_id, id),
  UNIQUE (society_id, election_id, position)
);
CREATE UNIQUE INDEX poll_election_posts_name_key
  ON public.poll_election_posts (society_id, election_id, lower(name));

CREATE TABLE public.poll_election_activities (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  title text NOT NULL
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 150),
  owner_name text
    CHECK (owner_name IS NULL OR (
      owner_name = btrim(owner_name) AND char_length(owner_name) BETWEEN 1 AND 120
    )),
  planned_on date,
  actual_on date,
  status text NOT NULL CHECK (status IN ('to_do', 'done', 'not_needed')),
  note text
    CHECK (note IS NULL OR (
      note = btrim(note) AND char_length(note) BETWEEN 1 AND 1000
    )),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 200),
  client_request_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT poll_election_activities_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, election_id, position)
);

CREATE TABLE public.poll_election_links (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('notice', 'meeting', 'document')),
  notice_id uuid,
  meeting_id uuid,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT poll_election_links_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_links_target_check CHECK (
    (source_type = 'notice' AND notice_id IS NOT NULL
      AND meeting_id IS NULL AND document_id IS NULL)
    OR (source_type = 'meeting' AND meeting_id IS NOT NULL
      AND notice_id IS NULL AND document_id IS NULL)
    OR (source_type = 'document' AND document_id IS NOT NULL
      AND notice_id IS NULL AND meeting_id IS NULL)
  ),
  CONSTRAINT poll_election_links_notice_fkey
    FOREIGN KEY (society_id, notice_id)
    REFERENCES public.notices (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_links_meeting_fkey
    FOREIGN KEY (society_id, meeting_id)
    REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_links_document_fkey
    FOREIGN KEY (society_id, document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, created_by, client_request_id)
);

CREATE TABLE public.poll_election_officers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  invited_email text
    CHECK (invited_email IS NULL OR (
      invited_email = lower(btrim(invited_email))
      AND char_length(invited_email) BETWEEN 3 AND 254
      AND invited_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )),
  invited_user_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  conflict_confirmed_at timestamptz,
  access_ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT poll_election_officers_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  CHECK ((profile_id IS NOT NULL AND invited_email IS NULL AND invited_user_id IS NULL)
    OR (profile_id IS NULL AND invited_email IS NOT NULL)),
  CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL)
    OR (
      revoked_at IS NOT NULL AND revoked_by IS NOT NULL
      AND revoke_reason IS NOT NULL AND revoke_reason = btrim(revoke_reason)
      AND char_length(revoke_reason) BETWEEN 1 AND 500
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, election_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX poll_election_officers_active_key
  ON public.poll_election_officers (society_id, election_id)
  WHERE revoked_at IS NULL;
CREATE INDEX poll_election_officers_invite_idx
  ON public.poll_election_officers (lower(invited_email))
  WHERE revoked_at IS NULL;

CREATE TABLE public.poll_election_helpers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  role_name text NOT NULL
    CHECK (role_name = btrim(role_name) AND char_length(role_name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_helpers_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.poll_election_voters (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  occupancy_id uuid NOT NULL,
  voter_name text NOT NULL
    CHECK (voter_name = btrim(voter_name) AND char_length(voter_name) BETWEEN 1 AND 120),
  unit_label text NOT NULL
    CHECK (unit_label = btrim(unit_label) AND char_length(unit_label) BETWEEN 1 AND 80),
  source text NOT NULL CHECK (source IN ('earliest_owner', 'admin_named')),
  removed_at timestamptz,
  removal_reason text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_voters_pkey PRIMARY KEY (society_id, election_id, unit_id),
  CONSTRAINT poll_election_voters_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_voters_unit_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_voters_membership_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_voters_occupancy_fkey
    FOREIGN KEY (society_id, occupancy_id)
    REFERENCES public.unit_occupants (society_id, id) ON DELETE RESTRICT,
  CHECK (
    (removed_at IS NULL AND removal_reason IS NULL)
    OR (
      removed_at IS NOT NULL AND removal_reason IS NOT NULL
      AND removal_reason = btrim(removal_reason)
      AND char_length(removal_reason) BETWEEN 1 AND 500
    )
  )
);
CREATE INDEX poll_election_voters_user_idx
  ON public.poll_election_voters (society_id, election_id, user_id);

CREATE TABLE public.poll_election_voter_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'created', 'voter_changed', 'removed', 'restored', 'locked'
  )),
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT
);

CREATE TABLE public.poll_election_nominations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  post_id uuid NOT NULL,
  candidate_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT poll_election_nominations_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_nominations_post_fkey
    FOREIGN KEY (society_id, election_id, post_id)
    REFERENCES public.poll_election_posts (society_id, election_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, election_id, post_id, candidate_user_id),
  UNIQUE (society_id, id),
  UNIQUE (society_id, election_id, id)
);

CREATE TABLE public.poll_election_supporters (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  nomination_id uuid NOT NULL,
  supporter_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('proposer', 'seconder')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined')),
  responded_at timestamptz,
  CONSTRAINT poll_election_supporters_nomination_fkey
    FOREIGN KEY (society_id, election_id, nomination_id)
    REFERENCES public.poll_election_nominations (society_id, election_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, nomination_id, kind)
);

CREATE TABLE public.poll_election_scrutiny_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  nomination_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_scrutiny_nomination_fkey
    FOREIGN KEY (society_id, election_id, nomination_id)
    REFERENCES public.poll_election_nominations (society_id, election_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.poll_election_participation (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (society_id, election_id, unit_id),
  CONSTRAINT poll_election_participation_voter_fkey
    FOREIGN KEY (society_id, election_id, unit_id)
    REFERENCES public.poll_election_voters (society_id, election_id, unit_id) ON DELETE RESTRICT
);

CREATE TABLE public.poll_election_tallies (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  post_id uuid NOT NULL,
  candidate_user_id uuid,
  tally bigint NOT NULL DEFAULT 0 CHECK (tally >= 0),
  CONSTRAINT poll_election_tallies_post_fkey
    FOREIGN KEY (society_id, election_id, post_id)
    REFERENCES public.poll_election_posts (society_id, election_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX poll_election_tallies_candidate_key
  ON public.poll_election_tallies (society_id, election_id, post_id, candidate_user_id)
  WHERE candidate_user_id IS NOT NULL;
CREATE UNIQUE INDEX poll_election_tallies_nota_key
  ON public.poll_election_tallies (society_id, election_id, post_id)
  WHERE candidate_user_id IS NULL;

CREATE TABLE public.poll_election_tie_resolutions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  post_id uuid NOT NULL,
  candidate_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  method text NOT NULL
    CHECK (method = btrim(method) AND char_length(method) BETWEEN 1 AND 200),
  reason text NOT NULL
    CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_tie_election_post_fkey
    FOREIGN KEY (society_id, election_id, post_id)
    REFERENCES public.poll_election_posts (society_id, election_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, election_id, post_id, candidate_user_id)
);

CREATE TABLE public.poll_election_post_choices (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  candidate_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  chosen_post_id uuid NOT NULL,
  decided_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('candidate_choice', 'returning_officer')),
  reason text,
  deadline_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT poll_election_post_choices_post_fkey
    FOREIGN KEY (society_id, election_id, chosen_post_id)
    REFERENCES public.poll_election_posts (society_id, election_id, id) ON DELETE RESTRICT,
  CHECK (
    (method = 'candidate_choice' AND reason IS NULL)
    OR (method = 'returning_officer' AND reason IS NOT NULL
      AND char_length(btrim(reason)) BETWEEN 1 AND 1000)
  ),
  UNIQUE (society_id, election_id, candidate_user_id)
);

CREATE TABLE public.poll_election_declarations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  post_id uuid NOT NULL,
  candidate_user_id uuid,
  unopposed boolean NOT NULL DEFAULT false,
  tie_resolved boolean NOT NULL DEFAULT false,
  declared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  declared_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_declarations_election_post_fkey
    FOREIGN KEY (society_id, election_id, post_id)
    REFERENCES public.poll_election_posts (society_id, election_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, election_id, post_id, candidate_user_id)
);

CREATE TABLE public.poll_election_external_results (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  post_id uuid NOT NULL,
  winner_name text NOT NULL
    CHECK (winner_name = btrim(winner_name) AND char_length(winner_name) BETWEEN 1 AND 120),
  votes_count integer CHECK (votes_count >= 0),
  document_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT poll_election_external_election_post_fkey
    FOREIGN KEY (society_id, election_id, post_id)
    REFERENCES public.poll_election_posts (society_id, election_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_external_document_fkey
    FOREIGN KEY (society_id, document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, created_by, client_request_id, post_id)
);

CREATE TABLE public.poll_election_disputes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  raised_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  text text NOT NULL
    CHECK (text = btrim(text) AND char_length(text) BETWEEN 1 AND 2000),
  file_path text
    CHECK (file_path IS NULL OR char_length(file_path) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  CONSTRAINT poll_election_disputes_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  CHECK (
    (status IN ('open', 'under_review')
      AND resolution_note IS NULL AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (
      status IN ('resolved', 'rejected')
      AND resolution_note IS NOT NULL
      AND resolution_note = btrim(resolution_note)
      AND char_length(resolution_note) BETWEEN 1 AND 1000
      AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, election_id, id),
  UNIQUE (society_id, raised_by, client_request_id)
);
CREATE INDEX poll_election_disputes_election_idx
  ON public.poll_election_disputes (society_id, election_id, created_at DESC);

CREATE TABLE public.poll_election_dispute_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  dispute_id uuid NOT NULL,
  from_status text NOT NULL
    CHECK (from_status IN ('open', 'under_review', 'resolved', 'rejected')),
  to_status text NOT NULL
    CHECK (to_status IN ('open', 'under_review', 'resolved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_dispute_events_fkey
    FOREIGN KEY (society_id, election_id, dispute_id)
    REFERENCES public.poll_election_disputes (society_id, election_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE public.poll_election_expense_links (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  election_id uuid NOT NULL,
  expense_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_expense_election_fkey
    FOREIGN KEY (society_id, election_id)
    REFERENCES public.poll_elections (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT poll_election_expense_entry_fkey
    FOREIGN KEY (society_id, expense_id)
    REFERENCES public.expenses (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, election_id, expense_id)
);

ALTER TABLE public.poll_official_settings_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_voter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_supporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_scrutiny_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_tallies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_tie_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_post_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_external_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_dispute_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_election_expense_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poll_official_settings_events, public.poll_elections,
  public.poll_election_posts, public.poll_election_activities,
  public.poll_election_links, public.poll_election_officers,
  public.poll_election_helpers, public.poll_election_voters,
  public.poll_election_voter_events, public.poll_election_nominations,
  public.poll_election_supporters, public.poll_election_scrutiny_events,
  public.poll_election_participation, public.poll_election_tallies,
  public.poll_election_tie_resolutions, public.poll_election_post_choices,
  public.poll_election_declarations, public.poll_election_external_results,
  public.poll_election_disputes, public.poll_election_dispute_events,
  public.poll_election_expense_links
  FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY poll_official_settings_events_deny ON public.poll_official_settings_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_elections_deny ON public.poll_elections
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_posts_deny ON public.poll_election_posts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_activities_deny ON public.poll_election_activities
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_links_deny ON public.poll_election_links
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_officers_deny ON public.poll_election_officers
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_helpers_deny ON public.poll_election_helpers
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_voters_deny ON public.poll_election_voters
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_voter_events_deny ON public.poll_election_voter_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_nominations_deny ON public.poll_election_nominations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_supporters_deny ON public.poll_election_supporters
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_scrutiny_deny ON public.poll_election_scrutiny_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_participation_deny ON public.poll_election_participation
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_tallies_deny ON public.poll_election_tallies
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_tie_resolutions_deny ON public.poll_election_tie_resolutions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_post_choices_deny ON public.poll_election_post_choices
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_declarations_deny ON public.poll_election_declarations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_external_results_deny ON public.poll_election_external_results
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_disputes_deny ON public.poll_election_disputes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_dispute_events_deny
  ON public.poll_election_dispute_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY poll_election_expense_links_deny ON public.poll_election_expense_links
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.poll_election_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Official election history is append-only.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_append_only()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_official_settings_events_append_only
  BEFORE UPDATE OR DELETE ON public.poll_official_settings_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_voter_events_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_voter_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_scrutiny_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_scrutiny_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_ties_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_tie_resolutions
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_post_choices_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_post_choices
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_declarations_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_declarations
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_external_results_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_external_results
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();
CREATE TRIGGER poll_election_dispute_events_append_only
  BEFORE UPDATE OR DELETE ON public.poll_election_dispute_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_append_only();

CREATE FUNCTION private.poll_election_no_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Official election records are permanent.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_no_delete()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_elections_no_delete BEFORE DELETE ON public.poll_elections
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_no_delete();
CREATE FUNCTION private.poll_election_post_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_setting('poll.allow_post_replace', true) IS DISTINCT FROM 'on'
    OR EXISTS (
      SELECT 1 FROM public.poll_elections
      WHERE society_id = OLD.society_id AND id = OLD.election_id
        AND stage <> 'planning'
    )
  THEN
    RAISE EXCEPTION 'Published election posts are permanent.' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_post_delete_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_election_posts_delete_guard
  BEFORE DELETE ON public.poll_election_posts
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_post_delete_guard();
CREATE TRIGGER poll_election_nominations_no_delete
  BEFORE DELETE ON public.poll_election_nominations
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_no_delete();
CREATE TRIGGER poll_election_participation_no_delete
  BEFORE DELETE ON public.poll_election_participation
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_no_delete();
CREATE TRIGGER poll_election_disputes_no_delete
  BEFORE DELETE ON public.poll_election_disputes
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_no_delete();

CREATE FUNCTION private.poll_election_enabled_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE target_society uuid;
BEGIN
  target_society := CASE WHEN TG_OP = 'DELETE' THEN OLD.society_id ELSE NEW.society_id END;
  IF NOT private.poll_election_official_enabled(target_society) THEN
    IF TG_TABLE_NAME = 'poll_elections'
      AND TG_OP = 'UPDATE' AND OLD.stage IN ('declared', 'closed')
      AND NEW.stage = 'closed'
    THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME IN (
      'poll_election_disputes', 'poll_election_dispute_events',
      'poll_election_officers'
    ) AND EXISTS (
      SELECT 1 FROM public.poll_elections
      WHERE society_id = target_society
        AND id = CASE WHEN TG_OP = 'DELETE'
          THEN OLD.election_id ELSE NEW.election_id END
        AND stage IN ('declared', 'closed')
    ) THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    RAISE EXCEPTION 'Official voting is not enabled.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_enabled_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_elections_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_elections
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();

CREATE FUNCTION private.poll_election_voter_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  matched public.unit_occupants;
BEGIN
  SELECT occupant.* INTO matched
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
  WHERE occupant.society_id = NEW.society_id
    AND occupant.id = NEW.occupancy_id
    AND occupant.unit_id = NEW.unit_id
    AND occupant.membership_id = NEW.membership_id
    AND occupant.relationship = 'owner' AND occupant.status = 'active'
    AND membership.user_id = NEW.user_id AND membership.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Election voters must match an active owner occupancy.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_voter_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER poll_election_voter_guard
  BEFORE INSERT OR UPDATE ON public.poll_election_voters
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_voter_guard();

ALTER TABLE public.poll_election_nominations
  ADD CONSTRAINT poll_election_nominations_voter_fkey
  FOREIGN KEY (society_id, election_id, unit_id)
  REFERENCES public.poll_election_voters (society_id, election_id, unit_id)
  ON DELETE RESTRICT;
ALTER TABLE public.poll_election_voter_events
  ADD CONSTRAINT poll_election_voter_events_voter_fkey
  FOREIGN KEY (society_id, election_id, unit_id)
  REFERENCES public.poll_election_voters (society_id, election_id, unit_id)
  ON DELETE RESTRICT;
ALTER TABLE public.poll_election_disputes
  ADD CONSTRAINT poll_election_disputes_voter_fkey
  FOREIGN KEY (society_id, election_id, unit_id)
  REFERENCES public.poll_election_voters (society_id, election_id, unit_id)
  ON DELETE RESTRICT;
CREATE TRIGGER poll_election_posts_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_posts
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_voters_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_voters
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_nominations_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_nominations
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_disputes_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_disputes
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_dispute_events_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_dispute_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_activities_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_activities
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_links_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_links
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_officers_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_officers
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_helpers_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_helpers
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_voter_events_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_voter_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_supporters_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_supporters
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_scrutiny_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_scrutiny_events
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_participation_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_participation
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_tallies_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_tallies
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_ties_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_tie_resolutions
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_choices_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_post_choices
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_declarations_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_declarations
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_external_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_external_results
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();
CREATE TRIGGER poll_election_expenses_enabled_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_election_expense_links
  FOR EACH ROW EXECUTE FUNCTION private.poll_election_enabled_guard();

CREATE FUNCTION private.poll_election_officer_access(
  p_society_id uuid, p_election_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.poll_election_officers AS officer
    JOIN public.poll_elections AS election
      ON election.society_id = officer.society_id
      AND election.id = officer.election_id
    WHERE officer.society_id = p_society_id
      AND officer.election_id = p_election_id
      AND officer.revoked_at IS NULL
      AND officer.conflict_confirmed_at IS NOT NULL
      AND (
        (
          officer.profile_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.memberships AS membership
            WHERE membership.society_id = officer.society_id
              AND membership.user_id = auth.uid()
              AND membership.status = 'active'
          )
        )
        OR (
          officer.profile_id IS NULL
          AND lower(auth.jwt() ->> 'email') = lower(officer.invited_email)
          AND (officer.access_ends_at IS NULL
            OR officer.access_ends_at > clock_timestamp())
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.poll_election_officer_access(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.poll_election_officer_access(uuid, uuid)
  TO authenticated;

CREATE FUNCTION private.poll_election_officer_read_access(
  p_society_id uuid, p_election_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.poll_election_officers AS officer
    WHERE officer.society_id = p_society_id
      AND officer.election_id = p_election_id
      AND officer.revoked_at IS NULL
      AND (
        (
          officer.profile_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.memberships AS membership
            WHERE membership.society_id = officer.society_id
              AND membership.user_id = auth.uid()
              AND membership.status = 'active'
          )
        )
        OR (
          officer.profile_id IS NULL
          AND lower(auth.jwt() ->> 'email') = lower(officer.invited_email)
          AND (officer.access_ends_at IS NULL
            OR officer.access_ends_at > clock_timestamp())
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.poll_election_officer_read_access(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.poll_election_officer_read_access(uuid, uuid)
  TO authenticated;

CREATE FUNCTION private.poll_election_official_enabled(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT (settings ->> 'official_voting_enabled')::boolean
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'poll'
  ), false)
$$;
REVOKE ALL ON FUNCTION private.poll_election_official_enabled(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_election_read_begin(p_society_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  IF NOT private.poll_election_official_enabled(p_society_id) THEN
    RAISE EXCEPTION 'Official voting is not enabled.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_read_begin(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_election_officer_or_admin(
  p_society_id uuid, p_election_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.poll_election_officer_access(p_society_id, p_election_id)
    OR private.has_role(p_society_id, ARRAY['admin']::text[])
    AND NOT EXISTS (
      SELECT 1 FROM public.poll_election_officers
      WHERE society_id = p_society_id AND election_id = p_election_id
        AND revoked_at IS NULL AND conflict_confirmed_at IS NOT NULL
    )
$$;
REVOKE ALL ON FUNCTION private.poll_election_officer_or_admin(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_election_officer_write_begin(
  p_society_id uuid, p_election_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'poll')
    OR NOT private.society_writable(p_society_id)
    OR NOT (
      private.poll_election_officer_access(p_society_id, p_election_id)
      OR (
        private.has_role(p_society_id, ARRAY['admin']::text[])
        AND NOT EXISTS (
          SELECT 1 FROM public.poll_election_officers
          WHERE society_id = p_society_id AND election_id = p_election_id
            AND revoked_at IS NULL AND conflict_confirmed_at IS NOT NULL
        )
      )
    )
  THEN
    RAISE EXCEPTION 'Official election officer access is not available.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_officer_write_begin(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.poll_election_check_trace(p_request_trace text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request trace is invalid.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_check_trace(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.poll_official_voting_set(
  p_society_id uuid, p_enabled boolean, p_legal_type text,
  p_confirmation text, p_client_request_id uuid, p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.module_configs;
  next_settings jsonb;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll' FOR UPDATE;
  IF p_enabled IS NOT TRUE AND EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id
      AND stage IN (
        'nominations_open', 'scrutiny', 'candidates_published', 'voting', 'counted'
      )
  ) THEN
    RAISE EXCEPTION 'Official voting cannot be switched off during an active election.'
      USING ERRCODE = '23514';
  END IF;
  IF p_enabled AND (
    p_legal_type NOT IN ('apartment_association', 'cooperative')
    OR p_confirmation IS NULL
    OR p_confirmation <> 'Our registered rules allow online voting for committee elections and I am authorised to switch this on.'
  ) THEN
    RAISE EXCEPTION 'Confirm the society legal type and authority.'
      USING ERRCODE = '22023';
  END IF;
  next_settings := COALESCE(config.settings, '{}'::jsonb)
    || jsonb_build_object('official_voting_enabled', p_enabled)
    || CASE WHEN p_enabled
      THEN jsonb_build_object('official_legal_type', p_legal_type)
      ELSE '{"official_legal_type":null}'::jsonb END;
  IF EXISTS (
    SELECT 1 FROM public.poll_official_settings_events
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id
  ) THEN
    RETURN jsonb_build_object('enabled', COALESCE(
      (config.settings ->> 'official_voting_enabled')::boolean, false
    ), 'legal_type', config.settings ->> 'official_legal_type');
  END IF;
  UPDATE public.module_configs SET settings = next_settings, updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'poll';
  INSERT INTO public.poll_official_settings_events (
    society_id, enabled, legal_type, confirmation_text, created_by, client_request_id
  ) VALUES (
    p_society_id, p_enabled,
    CASE WHEN p_enabled THEN p_legal_type END,
    CASE WHEN p_enabled THEN p_confirmation END,
    auth.uid(), p_client_request_id
  );
  PERFORM private.poll_audit(
    p_society_id, 'official_voting.set', 'poll_settings', p_society_id,
    jsonb_build_object('enabled', p_enabled, 'legalType', p_legal_type),
    p_request_trace
  );
  RETURN jsonb_build_object(
    'enabled', p_enabled,
    'legal_type', CASE WHEN p_enabled THEN p_legal_type END
  );
END;
$$;

CREATE FUNCTION public.poll_election_settings_update(
  p_society_id uuid, p_dispute_window_days integer,
  p_nomination_supporters_enabled boolean, p_multi_post_win_rule text,
  p_expected_updated_at timestamptz, p_request_trace text
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.module_configs;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll' FOR UPDATE;
  IF config.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Election settings changed. Refresh before saving.'
      USING ERRCODE = '40001';
  END IF;
  IF p_dispute_window_days NOT BETWEEN 1 AND 30
    OR p_multi_post_win_rule NOT IN ('candidate_choice', 'returning_officer')
    OR p_nomination_supporters_enabled IS NULL
  THEN
    RAISE EXCEPTION 'Check the official election settings.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.module_configs SET
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'dispute_window_days', p_dispute_window_days,
      'nomination_supporters_enabled', p_nomination_supporters_enabled,
      'multi_post_win_rule', p_multi_post_win_rule
    ),
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'poll';
  PERFORM private.poll_audit(
    p_society_id, 'official_election.settings.update', 'poll_settings',
    p_society_id, jsonb_build_object(
      'dispute_window_days', p_dispute_window_days,
      'nomination_supporters_enabled', p_nomination_supporters_enabled,
      'multi_post_win_rule', p_multi_post_win_rule
    ), p_request_trace
  );
  RETURN (
    SELECT updated_at FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'poll'
  );
END;
$$;

CREATE FUNCTION public.poll_election_save(
  p_society_id uuid, p_election_id uuid, p_title text,
  p_nominations_open_at timestamptz, p_nominations_close_at timestamptz,
  p_voting_opens_at timestamptz, p_voting_closes_at timestamptz,
  p_posts jsonb, p_expected_revision integer, p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.poll_elections;
  config public.module_configs;
  post jsonb;
  position integer := 0;
  existing_id uuid;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  IF NOT private.poll_election_official_enabled(p_society_id) THEN
    RAISE EXCEPTION 'Official voting is not enabled.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll';
  SELECT id INTO existing_id FROM public.poll_elections
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing_id IS NOT NULL THEN
    IF p_election_id IS NOT NULL AND p_election_id <> existing_id THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN existing_id;
  END IF;
  IF p_title IS NULL OR p_title <> btrim(p_title)
    OR char_length(p_title) NOT BETWEEN 1 AND 150
    OR jsonb_typeof(p_posts) <> 'array'
    OR jsonb_array_length(p_posts) NOT BETWEEN 1 AND 50
    OR (p_nominations_open_at IS NOT NULL
      AND (p_nominations_close_at IS NULL
        OR p_nominations_close_at <= p_nominations_open_at))
    OR (p_voting_opens_at IS NOT NULL
      AND (p_voting_closes_at IS NULL
        OR p_voting_closes_at <= p_voting_opens_at))
  THEN
    RAISE EXCEPTION 'Check the election title, windows and posts.'
      USING ERRCODE = '22023';
  END IF;
  IF p_election_id IS NULL THEN
    INSERT INTO public.poll_elections (
      society_id, title, legal_type, dispute_window_days,
      multi_post_win_rule, nominations_open_at, nominations_close_at,
      voting_opens_at, voting_closes_at, client_request_id,
      created_by, updated_by
    ) VALUES (
      p_society_id, p_title, config.settings ->> 'official_legal_type',
      COALESCE((config.settings ->> 'dispute_window_days')::integer, 5),
      COALESCE(config.settings ->> 'multi_post_win_rule', 'candidate_choice'),
      p_nominations_open_at, p_nominations_close_at,
      p_voting_opens_at, p_voting_closes_at, p_client_request_id,
      auth.uid(), auth.uid()
    ) RETURNING * INTO current_row;
  ELSE
    SELECT * INTO current_row FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Election not found.' USING ERRCODE = 'P0002';
    END IF;
    IF current_row.stage <> 'planning'
      OR current_row.revision IS DISTINCT FROM p_expected_revision
    THEN
      RAISE EXCEPTION 'The election changed or is no longer editable.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.poll_elections SET
      title = p_title, nominations_open_at = p_nominations_open_at,
      nominations_close_at = p_nominations_close_at,
      voting_opens_at = p_voting_opens_at, voting_closes_at = p_voting_closes_at,
      revision = revision + 1, updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_election_id
    RETURNING * INTO current_row;
    PERFORM set_config('poll.allow_post_replace', 'on', true);
    DELETE FROM public.poll_election_posts
    WHERE society_id = p_society_id AND election_id = p_election_id;
    PERFORM set_config('poll.allow_post_replace', 'off', true);
  END IF;
  FOR post IN SELECT value FROM jsonb_array_elements(p_posts)
  LOOP
    position := position + 1;
    IF jsonb_typeof(post) <> 'object'
      OR (post ->> 'name') IS NULL OR (post ->> 'name') <> btrim(post ->> 'name')
      OR char_length(post ->> 'name') NOT BETWEEN 1 AND 120
      OR (post ->> 'seats') !~ '^[0-9]+$'
      OR (post ->> 'seats')::integer NOT BETWEEN 1 AND 50
    THEN
      RAISE EXCEPTION 'Check every post and seat count.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.poll_election_posts (
      society_id, election_id, name, seats, position
    ) VALUES (
      p_society_id, current_row.id, post ->> 'name',
      (post ->> 'seats')::integer, position
    );
  END LOOP;
  PERFORM private.poll_audit(
    p_society_id, CASE WHEN p_election_id IS NULL
      THEN 'official_election.create' ELSE 'official_election.update' END,
    'poll_election', current_row.id,
    jsonb_build_object('title', p_title, 'postCount', jsonb_array_length(p_posts)),
    p_request_trace
  );
  RETURN current_row.id;
END;
$$;

CREATE FUNCTION public.poll_election_stage_advance(
  p_society_id uuid, p_election_id uuid, p_expected_revision integer,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  next_stage text;
BEGIN
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, p_election_id
  );
  PERFORM private.poll_election_check_trace(p_request_trace);
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Election not found.' USING ERRCODE = 'P0002'; END IF;
  IF election.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'The election changed. Refresh before continuing.'
      USING ERRCODE = '23505';
  END IF;
  IF NOT (
    private.has_role(p_society_id, ARRAY['admin']::text[])
    OR private.poll_election_officer_access(p_society_id, p_election_id)
  ) THEN
    RAISE EXCEPTION 'Election stage access is not available.' USING ERRCODE = '42501';
  END IF;
  next_stage := CASE election.stage
    WHEN 'planning' THEN 'nominations_open'
    WHEN 'nominations_open' THEN 'scrutiny'
    WHEN 'scrutiny' THEN 'candidates_published'
    WHEN 'candidates_published' THEN CASE
      WHEN EXISTS (
        SELECT 1 FROM public.poll_election_posts AS post
        WHERE post.society_id = p_society_id AND post.election_id = p_election_id
          AND post.balloted
      ) THEN 'voting' ELSE 'counted' END
    WHEN 'declared' THEN 'closed'
    ELSE NULL
  END;
  IF next_stage IS NULL THEN
    RAISE EXCEPTION 'This election stage cannot be advanced.' USING ERRCODE = '23514';
  END IF;
  IF election.stage = 'planning' THEN
    IF election.nominations_open_at IS NULL
      OR election.nominations_close_at IS NULL
    THEN
      RAISE EXCEPTION 'Set the nomination window first.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.poll_election_voter_events (
      society_id, election_id, unit_id, action, after_data, created_by
    )
    SELECT society_id, election_id, unit_id, 'locked',
      jsonb_build_object(
        'voterUserId', user_id, 'voterName', voter_name, 'unitLabel', unit_label
      ), auth.uid()
    FROM public.poll_election_voters
    WHERE society_id = p_society_id AND election_id = p_election_id;
    UPDATE public.poll_elections SET
      dispute_window_days = COALESCE((
        SELECT (settings ->> 'dispute_window_days')::integer
        FROM public.module_configs
        WHERE society_id = p_society_id AND module_key = 'poll'
      ), 5),
      multi_post_win_rule = COALESCE((
        SELECT settings ->> 'multi_post_win_rule'
        FROM public.module_configs
        WHERE society_id = p_society_id AND module_key = 'poll'
      ), 'candidate_choice'),
      nomination_supporters_enabled = COALESCE((
        SELECT (settings ->> 'nomination_supporters_enabled')::boolean
        FROM public.module_configs
        WHERE society_id = p_society_id AND module_key = 'poll'
      ), false)
    WHERE society_id = p_society_id AND id = p_election_id;
  END IF;
  IF election.stage = 'scrutiny' AND EXISTS (
    SELECT 1 FROM public.poll_election_nominations
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND status = 'pending' AND withdrawn_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Decide every nomination before publishing candidates.'
      USING ERRCODE = '23514';
  END IF;
  IF election.stage = 'scrutiny' THEN
    UPDATE public.poll_election_posts AS post
    SET balloted = (
      SELECT count(*) > post.seats
      FROM public.poll_election_nominations AS nomination
      WHERE nomination.society_id = p_society_id
        AND nomination.election_id = p_election_id
        AND nomination.post_id = post.id
        AND nomination.status = 'accepted'
    )
    WHERE post.society_id = p_society_id AND post.election_id = p_election_id;
  END IF;
  IF next_stage = 'voting' THEN
    IF election.voting_opens_at IS NULL OR election.voting_closes_at IS NULL THEN
      RAISE EXCEPTION 'Set the voting window first.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.poll_election_officers
      WHERE society_id = p_society_id AND election_id = p_election_id
        AND revoked_at IS NULL AND conflict_confirmed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Assign a returning officer before voting.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.poll_election_tallies (
      society_id, election_id, post_id, candidate_user_id
    )
    SELECT nomination.society_id, nomination.election_id,
      nomination.post_id, nomination.candidate_user_id
    FROM public.poll_election_nominations AS nomination
    JOIN public.poll_election_posts AS post
      ON post.society_id = nomination.society_id
      AND post.election_id = nomination.election_id
      AND post.id = nomination.post_id
    WHERE nomination.society_id = p_society_id
      AND nomination.election_id = p_election_id
      AND nomination.status = 'accepted' AND post.balloted
    ON CONFLICT DO NOTHING;
    INSERT INTO public.poll_election_tallies (
      society_id, election_id, post_id, candidate_user_id
    )
    SELECT post.society_id, post.election_id, post.id, NULL
    FROM public.poll_election_posts AS post
    WHERE post.society_id = p_society_id AND post.election_id = p_election_id
      AND post.balloted
    ON CONFLICT DO NOTHING;
  END IF;
  IF next_stage = 'declared' AND NOT private.poll_election_officer_access(
    p_society_id, p_election_id
  ) THEN
    RAISE EXCEPTION 'Only the confirmed returning officer can declare the result.'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.poll_elections SET
    stage = next_stage, revision = revision + 1, updated_by = auth.uid(),
    counted_at = CASE WHEN next_stage = 'counted' THEN clock_timestamp()
      ELSE counted_at END,
    declared_at = CASE WHEN next_stage = 'declared' THEN clock_timestamp()
      ELSE declared_at END,
    closed_at = CASE WHEN next_stage = 'closed' THEN clock_timestamp()
      ELSE closed_at END
  WHERE society_id = p_society_id AND id = p_election_id
  RETURNING stage, revision INTO next_stage, p_expected_revision;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.stage.advance', 'poll_election',
    p_election_id,
    jsonb_build_object('from', election.stage, 'to', next_stage),
    p_request_trace
  );
  RETURN jsonb_build_object(
    'stage', next_stage, 'revision', p_expected_revision
  );
END;
$$;

CREATE FUNCTION public.poll_election_external_save(
  p_society_id uuid, p_title text, p_held_on date, p_posts jsonb,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.module_configs;
  election_id uuid;
  post jsonb;
  post_id uuid;
  position integer := 0;
  existing uuid;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  IF NOT private.poll_election_official_enabled(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'document')
  THEN RAISE EXCEPTION 'Official voting and Documents must be enabled.'
    USING ERRCODE = '42501'; END IF;
  SELECT id INTO existing FROM public.poll_elections
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF p_title IS NULL OR p_title <> btrim(p_title)
    OR char_length(p_title) NOT BETWEEN 1 AND 150
    OR p_held_on IS NULL
    OR jsonb_typeof(p_posts) <> 'array'
    OR jsonb_array_length(p_posts) NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'Check the outside election details.'
    USING ERRCODE = '22023'; END IF;
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'poll';
  INSERT INTO public.poll_elections (
    society_id, title, legal_type, stage, source, outside_held_on,
    dispute_window_days, multi_post_win_rule,
    nomination_supporters_enabled, declared_at, client_request_id,
    created_by, updated_by
  ) VALUES (
    p_society_id, p_title, config.settings ->> 'official_legal_type',
    'declared', 'outside_app', p_held_on,
    COALESCE((config.settings ->> 'dispute_window_days')::integer, 5),
    COALESCE(config.settings ->> 'multi_post_win_rule', 'candidate_choice'),
    COALESCE(
      (config.settings ->> 'nomination_supporters_enabled')::boolean, false
    ), clock_timestamp(), p_client_request_id, auth.uid(), auth.uid()
  ) RETURNING id INTO election_id;
  FOR post IN SELECT value FROM jsonb_array_elements(p_posts)
  LOOP
    position := position + 1;
    IF (post ->> 'name') IS NULL OR (post ->> 'winnerName') IS NULL
      OR (post ->> 'documentId') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.documents
        WHERE society_id = p_society_id
          AND id = (post ->> 'documentId')::uuid
      )
    THEN RAISE EXCEPTION 'Each outside result needs a post, winner and Document.'
      USING ERRCODE = '22023'; END IF;
    INSERT INTO public.poll_election_posts (
      society_id, election_id, name, seats, position, balloted
    ) VALUES (
      p_society_id, election_id, post ->> 'name',
      COALESCE((post ->> 'seats')::integer, 1), position, false
    ) RETURNING id INTO post_id;
    INSERT INTO public.poll_election_external_results (
      society_id, election_id, post_id, winner_name, votes_count,
      document_id, created_by, client_request_id
    ) VALUES (
      p_society_id, election_id, post_id, post ->> 'winnerName',
      (post ->> 'votesCount')::integer, (post ->> 'documentId')::uuid,
      auth.uid(), p_client_request_id
    );
  END LOOP;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.outside.create', 'poll_election',
    election_id, jsonb_build_object(
      'title', p_title, 'heldOn', p_held_on, 'postCount', position
    ), p_request_trace
  );
  RETURN election_id;
END;
$$;

CREATE FUNCTION public.poll_election_cancel(
  p_society_id uuid, p_election_id uuid, p_reason text,
  p_expected_revision integer, p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'poll')
    OR NOT private.poll_election_official_enabled(p_society_id)
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Election cancellation is not available.'
    USING ERRCODE = '42501'; END IF;
  IF NOT (
    private.poll_election_officer_access(p_society_id, p_election_id)
    OR private.has_role(p_society_id, ARRAY['admin']::text[])
  ) THEN
    RAISE EXCEPTION 'The election cannot be cancelled.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.poll_election_check_trace(p_request_trace);
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Election not found.' USING ERRCODE = 'P0002'; END IF;
  IF election.revision IS DISTINCT FROM p_expected_revision
    OR election.stage IN ('declared', 'closed', 'cancelled')
    OR (
      election.stage = 'voting'
      AND NOT private.poll_election_officer_access(p_society_id, p_election_id)
    )
    OR (
      election.stage <> 'voting'
      AND NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    )
  THEN
    RAISE EXCEPTION 'The election cannot be cancelled.' USING ERRCODE = '23514';
  END IF;
  IF p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'Give a reason for cancelling.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.poll_elections SET
    stage = 'cancelled', cancellation_reason = p_reason,
    cancelled_at = clock_timestamp(), revision = revision + 1,
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_election_id
  RETURNING stage, revision INTO election.stage, election.revision;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.cancel', 'poll_election',
    p_election_id, jsonb_build_object('reason', p_reason), p_request_trace
  );
  RETURN jsonb_build_object('stage', election.stage, 'revision', election.revision);
END;
$$;

CREATE FUNCTION public.poll_election_activities_save(
  p_society_id uuid, p_election_id uuid, p_activities jsonb,
  p_client_request_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  activity jsonb;
  position integer := 0;
  existing jsonb;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(p_activities) <> 'array'
    OR jsonb_array_length(p_activities) > 200
  THEN RAISE EXCEPTION 'Check the election schedule.' USING ERRCODE = '22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'title', activity.title, 'ownerName', COALESCE(activity.owner_name, ''),
    'plannedOn', COALESCE(activity.planned_on::text, ''),
    'actualOn', COALESCE(activity.actual_on::text, ''),
    'status', activity.status, 'note', COALESCE(activity.note, '')
  ) ORDER BY activity.position) INTO existing
  FROM public.poll_election_activities AS activity
  WHERE activity.society_id = p_society_id
    AND activity.election_id = p_election_id
    AND activity.client_request_id = p_client_request_id;
  IF existing IS NOT NULL THEN
    IF existing IS DISTINCT FROM p_activities THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_array_length(existing);
  END IF;
  DELETE FROM public.poll_election_activities
  WHERE society_id = p_society_id AND election_id = p_election_id;
  FOR activity IN SELECT value FROM jsonb_array_elements(p_activities)
  LOOP
    position := position + 1;
    INSERT INTO public.poll_election_activities (
      society_id, election_id, title, owner_name, planned_on, actual_on,
      status, note, position, client_request_id, created_by
    ) VALUES (
      p_society_id, p_election_id, activity ->> 'title',
      nullif(btrim(activity ->> 'ownerName'), ''),
      (activity ->> 'plannedOn')::date, (activity ->> 'actualOn')::date,
      activity ->> 'status', nullif(btrim(activity ->> 'note'), ''),
      position, p_client_request_id, auth.uid()
    );
  END LOOP;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.activities.save', 'poll_election',
    p_election_id, jsonb_build_object('count', position), p_request_trace
  );
  RETURN position;
END;
$$;

CREATE FUNCTION public.poll_election_link_source(
  p_society_id uuid, p_election_id uuid, p_source_type text,
  p_source_id uuid, p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link_id uuid;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id
  ) THEN RAISE EXCEPTION 'Election not found.' USING ERRCODE = 'P0002'; END IF;
  IF (
    p_source_type = 'notice'
    AND NOT private.module_enabled(p_society_id, 'notice')
  ) OR (
    p_source_type = 'meeting'
    AND NOT private.module_enabled(p_society_id, 'meeting')
  ) OR (
    p_source_type = 'document'
    AND NOT private.module_enabled(p_society_id, 'document')
  ) THEN
    RAISE EXCEPTION 'The source module is not enabled.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO link_id FROM public.poll_election_links
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF link_id IS NOT NULL THEN RETURN link_id; END IF;
  INSERT INTO public.poll_election_links (
    society_id, election_id, source_type, notice_id, meeting_id,
    document_id, created_by, client_request_id
  )
  SELECT p_society_id, p_election_id, p_source_type,
    CASE WHEN p_source_type = 'notice' THEN p_source_id END,
    CASE WHEN p_source_type = 'meeting' THEN p_source_id END,
    CASE WHEN p_source_type = 'document' THEN p_source_id END,
    auth.uid(), p_client_request_id
  WHERE (
    p_source_type = 'notice' AND EXISTS (
      SELECT 1 FROM public.notices
      WHERE society_id = p_society_id AND id = p_source_id
    )
  ) OR (
    p_source_type = 'meeting' AND EXISTS (
      SELECT 1 FROM public.meetings
      WHERE society_id = p_society_id AND id = p_source_id
    )
  ) OR (
    p_source_type = 'document' AND EXISTS (
      SELECT 1 FROM public.documents
      WHERE society_id = p_society_id AND id = p_source_id
    )
  )
  RETURNING id INTO link_id;
  IF link_id IS NULL THEN RAISE EXCEPTION 'Source not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.source.link', 'poll_election',
    p_election_id, jsonb_build_object(
      'sourceType', p_source_type, 'sourceId', p_source_id
    ), p_request_trace
  );
  RETURN link_id;
END;
$$;

CREATE FUNCTION public.poll_election_link_remove(
  p_society_id uuid, p_link_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election_id uuid;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT link.election_id INTO election_id
  FROM public.poll_election_links AS link
  WHERE link.society_id = p_society_id AND link.id = p_link_id;
  IF election_id IS NULL THEN RAISE EXCEPTION 'Election link not found.' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.poll_election_links
  WHERE society_id = p_society_id AND id = p_link_id;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.source.unlink', 'poll_election',
    election_id, jsonb_build_object('linkId', p_link_id), p_request_trace
  );
  RETURN p_link_id;
END;
$$;

CREATE FUNCTION public.poll_election_officer_assign(
  p_society_id uuid, p_election_id uuid, p_profile_id uuid,
  p_invited_email text, p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  officer_id uuid;
  normalized_email text;
  previous public.poll_election_officers;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.poll_election_check_trace(p_request_trace);
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Election not found.' USING ERRCODE = 'P0002'; END IF;
  IF election.stage = 'declared' OR election.stage = 'closed' THEN
    RAISE EXCEPTION 'The returning officer is final after declaration.'
      USING ERRCODE = '23514';
  END IF;
  IF (p_profile_id IS NULL) = (p_invited_email IS NULL) THEN
    RAISE EXCEPTION 'Choose either a society member or an outside email.'
      USING ERRCODE = '22023';
  END IF;
  IF p_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = p_profile_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose an active society member.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_election_nominations
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND candidate_user_id = p_profile_id AND status <> 'withdrawn'
  ) THEN
    RAISE EXCEPTION 'A candidate cannot be the returning officer.'
      USING ERRCODE = '22023';
  END IF;
  normalized_email := CASE WHEN p_invited_email IS NOT NULL
    THEN lower(btrim(p_invited_email)) END;
  IF normalized_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.memberships AS membership
    JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND lower(profile.email::text) = normalized_email
  ) THEN
    RAISE EXCEPTION 'Choose the member assignment instead of an outside email.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.poll_election_officers
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF previous.id IS NOT NULL THEN
    IF previous.profile_id IS DISTINCT FROM p_profile_id
      OR previous.invited_email IS DISTINCT FROM normalized_email
    THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505'; END IF;
    RETURN previous.id;
  END IF;
  SELECT * INTO previous FROM public.poll_election_officers
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND revoked_at IS NULL;
  IF previous.id IS NOT NULL THEN
    IF previous.profile_id IS DISTINCT FROM p_profile_id
      OR previous.invited_email IS DISTINCT FROM normalized_email
    THEN RAISE EXCEPTION 'Revoke the active officer before assigning another.'
      USING ERRCODE = '23505'; END IF;
    RETURN previous.id;
  END IF;
  INSERT INTO public.poll_election_officers (
    society_id, election_id, profile_id, invited_email, created_by, client_request_id
  ) VALUES (
    p_society_id, p_election_id, p_profile_id, normalized_email, auth.uid(),
    p_client_request_id
  ) ON CONFLICT DO NOTHING
  RETURNING id INTO officer_id;
  IF officer_id IS NULL THEN
    SELECT id INTO officer_id FROM public.poll_election_officers
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND revoked_at IS NULL;
  END IF;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.officer.assign', 'poll_election',
    p_election_id, jsonb_build_object(
      'profileId', p_profile_id, 'outsideInvite', normalized_email IS NOT NULL
    ), p_request_trace
  );
  RETURN officer_id;
END;
$$;

CREATE FUNCTION public.poll_election_officer_revoke(
  p_society_id uuid, p_officer_id uuid, p_reason text, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE officer public.poll_election_officers;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO officer FROM public.poll_election_officers
  WHERE society_id = p_society_id AND id = p_officer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Returning officer not found.' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = officer.election_id
      AND stage IN ('declared', 'closed')
  ) THEN RAISE EXCEPTION 'The returning officer cannot be replaced after declaration.'
    USING ERRCODE = '23514'; END IF;
  IF officer.revoked_at IS NOT NULL THEN RETURN p_officer_id; END IF;
  IF p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'Give a reason for revoking access.' USING ERRCODE = '22023'; END IF;
  UPDATE public.poll_election_officers SET
    revoked_at = clock_timestamp(), revoked_by = auth.uid(), revoke_reason = p_reason
  WHERE society_id = p_society_id AND id = p_officer_id;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.officer.revoke', 'poll_election',
    officer.election_id, jsonb_build_object('reason', p_reason), p_request_trace
  );
  RETURN p_officer_id;
END;
$$;

CREATE FUNCTION public.poll_election_officer_confirm(
  p_society_id uuid, p_election_id uuid, p_confirmation text,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE officer_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'poll') THEN
    RAISE EXCEPTION 'Returning officer access is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS NULL OR p_confirmation <>
    'I am not a candidate and have no conflict of interest'
  THEN
    RAISE EXCEPTION 'Confirm that you have no conflict and are not a candidate.'
      USING ERRCODE = '22023';
  END IF;
  SELECT officer.id INTO officer_id
  FROM public.poll_election_officers AS officer
  WHERE officer.society_id = p_society_id
    AND officer.election_id = p_election_id AND officer.revoked_at IS NULL
    AND (
      (
        officer.profile_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = officer.society_id
            AND membership.user_id = auth.uid()
            AND membership.status = 'active'
        )
      )
      OR (
        officer.invited_email IS NOT NULL
        AND lower(auth.jwt() ->> 'email') = lower(officer.invited_email)
      )
    ) FOR UPDATE;
  IF officer_id IS NULL THEN
    RAISE EXCEPTION 'Returning officer access is not available.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_election_nominations
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND candidate_user_id = auth.uid() AND status <> 'withdrawn'
  ) THEN
    RAISE EXCEPTION 'A candidate cannot confirm as returning officer.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.poll_election_officers SET
    accepted_at = COALESCE(accepted_at, clock_timestamp()),
    conflict_confirmed_at = COALESCE(conflict_confirmed_at, clock_timestamp()),
    invited_user_id = CASE WHEN profile_id IS NULL THEN auth.uid()
      ELSE invited_user_id END
  WHERE society_id = p_society_id AND id = officer_id;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.officer.confirm', 'poll_election',
    p_election_id, jsonb_build_object('confirmation', p_confirmation),
    p_request_trace
  );
  RETURN officer_id;
END;
$$;

CREATE FUNCTION public.poll_election_helpers_save(
  p_society_id uuid, p_election_id uuid, p_helpers jsonb,
  p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE helper jsonb;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF jsonb_typeof(p_helpers) <> 'array' OR jsonb_array_length(p_helpers) > 50 THEN
    RAISE EXCEPTION 'Check the election assistants and observers.'
      USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.poll_election_helpers
  WHERE society_id = p_society_id AND election_id = p_election_id;
  FOR helper IN SELECT value FROM jsonb_array_elements(p_helpers)
  LOOP
    INSERT INTO public.poll_election_helpers (
      society_id, election_id, name, role_name, created_by
    ) VALUES (
      p_society_id, p_election_id, helper ->> 'name', helper ->> 'role', auth.uid()
    );
  END LOOP;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.helpers.save', 'poll_election',
    p_election_id, jsonb_build_object('count', jsonb_array_length(p_helpers)),
    p_request_trace
  );
  RETURN jsonb_array_length(p_helpers);
END;
$$;

CREATE FUNCTION public.poll_election_voters_init(
  p_society_id uuid, p_election_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inserted integer;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id
      AND stage <> 'planning'
  ) THEN RAISE EXCEPTION 'The voter list is locked.' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.poll_election_voters (
    society_id, election_id, unit_id, membership_id, user_id,
    occupancy_id, voter_name, unit_label, source, created_by
  )
  SELECT DISTINCT ON (occupant.unit_id)
    occupant.society_id, p_election_id, occupant.unit_id, occupant.membership_id,
    membership.user_id, occupant.id, profile.full_name,
    COALESCE(block.name || '-', '') || unit.number,
    'earliest_owner', auth.uid()
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  JOIN public.units AS unit
    ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id
  LEFT JOIN public.blocks AS block
    ON block.society_id = unit.society_id AND block.id = unit.block_id
  WHERE occupant.society_id = p_society_id
    AND occupant.status = 'active' AND occupant.relationship = 'owner'
    AND membership.status = 'active'
  ORDER BY occupant.unit_id, occupant.started_at, occupant.created_at, occupant.id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  INSERT INTO public.poll_election_voter_events (
    society_id, election_id, unit_id, action, after_data, created_by
  )
  SELECT voter.society_id, voter.election_id, voter.unit_id, 'created',
    jsonb_build_object(
      'voterUserId', voter.user_id, 'voterName', voter.voter_name,
      'unitLabel', voter.unit_label, 'source', voter.source
    ), auth.uid()
  FROM public.poll_election_voters AS voter
  WHERE voter.society_id = p_society_id AND voter.election_id = p_election_id
    AND NOT EXISTS (
      SELECT 1 FROM public.poll_election_voter_events AS event
      WHERE event.society_id = voter.society_id
        AND event.election_id = voter.election_id
        AND event.unit_id = voter.unit_id AND event.action = 'created'
    );
  PERFORM private.poll_audit(
    p_society_id, 'official_election.voters.init', 'poll_election',
    p_election_id, jsonb_build_object('inserted', inserted), p_request_trace
  );
  RETURN inserted;
END;
$$;

CREATE FUNCTION public.poll_election_voter_set(
  p_society_id uuid, p_election_id uuid, p_unit_id uuid,
  p_membership_id uuid, p_expected_revision integer, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  voter public.poll_election_voters;
  occupant public.unit_occupants;
  membership public.memberships;
  profile public.profiles;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id
      AND stage <> 'planning'
  ) THEN RAISE EXCEPTION 'The voter list is locked.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO voter FROM public.poll_election_voters
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND unit_id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voter list row not found.' USING ERRCODE = 'P0002'; END IF;
  IF voter.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'The voter changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  SELECT * INTO occupant FROM public.unit_occupants
  WHERE society_id = p_society_id AND unit_id = p_unit_id
    AND membership_id = p_membership_id AND status = 'active'
    AND relationship = 'owner';
  SELECT * INTO membership FROM public.memberships
  WHERE society_id = p_society_id AND id = p_membership_id AND status = 'active';
  SELECT * INTO profile FROM public.profiles WHERE id = membership.user_id;
  IF occupant.id IS NULL OR membership.id IS NULL OR profile.id IS NULL THEN
    RAISE EXCEPTION 'Choose an active owner of this unit.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.poll_election_voters SET
    membership_id = p_membership_id, user_id = membership.user_id,
    occupancy_id = occupant.id, voter_name = profile.full_name,
    source = 'admin_named', revision = revision + 1,
    removed_at = NULL, removal_reason = NULL
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND unit_id = p_unit_id;
  INSERT INTO public.poll_election_voter_events (
    society_id, election_id, unit_id, action, before_data, after_data, created_by
  ) VALUES (
    p_society_id, p_election_id, p_unit_id, 'voter_changed',
    jsonb_build_object('membershipId', voter.membership_id, 'voterName', voter.voter_name),
    jsonb_build_object('membershipId', p_membership_id, 'voterName', profile.full_name),
    auth.uid()
  );
  RETURN voter.revision + 1;
END;
$$;

CREATE FUNCTION public.poll_election_voter_remove(
  p_society_id uuid, p_election_id uuid, p_unit_id uuid, p_reason text,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE voter public.poll_election_voters;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id AND stage <> 'planning'
  ) THEN RAISE EXCEPTION 'The voter list is locked.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO voter FROM public.poll_election_voters
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND unit_id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voter list row not found.' USING ERRCODE = 'P0002'; END IF;
  IF voter.removed_at IS NOT NULL THEN RETURN p_unit_id; END IF;
  IF p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'Give a reason for removing the unit.' USING ERRCODE = '22023'; END IF;
  UPDATE public.poll_election_voters SET
    removed_at = clock_timestamp(), removal_reason = p_reason, revision = revision + 1
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND unit_id = p_unit_id;
  INSERT INTO public.poll_election_voter_events (
    society_id, election_id, unit_id, action, reason, created_by
  ) VALUES (
    p_society_id, p_election_id, p_unit_id, 'removed', p_reason, auth.uid()
  );
  PERFORM private.poll_audit(
    p_society_id, 'official_election.voter.remove', 'poll_election',
    p_election_id, jsonb_build_object('unitId', p_unit_id, 'reason', p_reason),
    p_request_trace
  );
  RETURN p_unit_id;
END;
$$;

CREATE FUNCTION public.poll_election_voter_restore(
  p_society_id uuid, p_election_id uuid, p_unit_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id AND stage <> 'planning'
  ) THEN RAISE EXCEPTION 'The voter list is locked.' USING ERRCODE = '23514'; END IF;
  UPDATE public.poll_election_voters SET
    removed_at = NULL, removal_reason = NULL, revision = revision + 1
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND unit_id = p_unit_id AND removed_at IS NOT NULL;
  IF FOUND THEN
    INSERT INTO public.poll_election_voter_events (
      society_id, election_id, unit_id, action, created_by
    ) VALUES (
      p_society_id, p_election_id, p_unit_id, 'restored', auth.uid()
    );
  END IF;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.voter.restore', 'poll_election',
    p_election_id, jsonb_build_object('unitId', p_unit_id), p_request_trace
  );
  RETURN p_unit_id;
END;
$$;

CREATE FUNCTION public.poll_election_nomination_submit(
  p_society_id uuid, p_election_id uuid, p_post_ids uuid[],
  p_client_request_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  voter public.poll_election_voters;
  inserted integer;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR SHARE;
  IF NOT FOUND OR election.stage <> 'nominations_open'
    OR (election.nominations_close_at IS NOT NULL
      AND clock_timestamp() >= election.nominations_close_at)
  THEN
    RAISE EXCEPTION 'Nominations are not open.' USING ERRCODE = '23514';
  END IF;
  SELECT candidate_voter.* INTO voter FROM public.poll_election_voters AS candidate_voter
  WHERE candidate_voter.society_id = p_society_id
    AND candidate_voter.election_id = p_election_id
    AND candidate_voter.removed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      WHERE occupant.society_id = p_society_id
        AND occupant.unit_id = candidate_voter.unit_id
        AND occupant.relationship = 'owner' AND occupant.status = 'active'
        AND membership.user_id = auth.uid() AND membership.status = 'active'
    )
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an active owner on the locked voter list may nominate.'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(array_length(p_post_ids, 1), 0) < 1
    OR EXISTS (
      SELECT 1 FROM unnest(p_post_ids) AS requested(post_id)
      LEFT JOIN public.poll_election_posts AS post
        ON post.society_id = p_society_id
        AND post.election_id = p_election_id
        AND post.id = requested.post_id
      WHERE post.id IS NULL
    )
  THEN
    RAISE EXCEPTION 'Choose at least one valid post.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_election_officers
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND revoked_at IS NULL
      AND (profile_id = auth.uid() OR invited_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'The returning officer cannot be a candidate.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.poll_election_nominations (
    society_id, election_id, post_id, candidate_user_id, unit_id
  )
  SELECT p_society_id, p_election_id, post_id, auth.uid(), voter.unit_id
  FROM unnest(p_post_ids) AS requested(post_id)
  ON CONFLICT (society_id, election_id, post_id, candidate_user_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.nomination.submit', 'poll_election',
    p_election_id, jsonb_build_object('postCount', inserted), p_request_trace
  );
  RETURN inserted;
END;
$$;

CREATE FUNCTION public.poll_election_nomination_withdraw(
  p_society_id uuid, p_nomination_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nomination public.poll_election_nominations;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO nomination FROM public.poll_election_nominations
  WHERE society_id = p_society_id AND id = p_nomination_id
  FOR UPDATE;
  IF NOT FOUND OR nomination.candidate_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Your nomination was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = nomination.election_id
      AND stage = 'nominations_open'
      AND (nominations_close_at IS NULL OR clock_timestamp() < nominations_close_at)
  ) THEN RAISE EXCEPTION 'Nominations can no longer be withdrawn.' USING ERRCODE = '23514'; END IF;
  UPDATE public.poll_election_nominations SET
    status = 'withdrawn', withdrawn_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_nomination_id;
  RETURN p_nomination_id;
END;
$$;

CREATE FUNCTION public.poll_election_supporters_add(
  p_society_id uuid, p_nomination_id uuid, p_proposer_user_id uuid,
  p_seconder_user_id uuid, p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nomination public.poll_election_nominations;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO nomination FROM public.poll_election_nominations
  WHERE society_id = p_society_id AND id = p_nomination_id FOR UPDATE;
  IF NOT FOUND OR nomination.candidate_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Your nomination was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = nomination.election_id
      AND nomination_supporters_enabled
      AND stage = 'nominations_open'
      AND (nominations_close_at IS NULL
        OR clock_timestamp() < nominations_close_at)
  ) THEN
    RAISE EXCEPTION 'Supporters are not enabled.' USING ERRCODE = '23514';
  END IF;
  IF p_proposer_user_id = p_seconder_user_id
    OR p_proposer_user_id = auth.uid() OR p_seconder_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM unnest(
        ARRAY[p_proposer_user_id, p_seconder_user_id]
      ) AS requested(requested_user)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.poll_election_voters
        WHERE society_id = p_society_id
          AND election_id = nomination.election_id
          AND user_id = requested_user AND removed_at IS NULL
      )
    )
  THEN
    RAISE EXCEPTION 'Choose two different listed voters as proposer and seconder.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.poll_election_supporters (
    society_id, election_id, nomination_id, supporter_user_id, kind
  ) VALUES (
    p_society_id, nomination.election_id, p_nomination_id, p_proposer_user_id, 'proposer'
  ), (
    p_society_id, nomination.election_id, p_nomination_id, p_seconder_user_id, 'seconder'
  );
  RETURN 2;
END;
$$;

CREATE FUNCTION public.poll_election_supporter_respond(
  p_society_id uuid, p_supporter_id uuid, p_confirm boolean
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE supporter public.poll_election_supporters;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO supporter FROM public.poll_election_supporters
  WHERE society_id = p_society_id AND id = p_supporter_id FOR UPDATE;
  IF NOT FOUND OR supporter.supporter_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Supporter request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF supporter.status <> 'pending' OR NOT EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = supporter.election_id
      AND stage = 'nominations_open'
      AND (nominations_close_at IS NULL
        OR clock_timestamp() < nominations_close_at)
  ) THEN RAISE EXCEPTION 'The supporter request can no longer be changed.'
    USING ERRCODE = '23514'; END IF;
  UPDATE public.poll_election_supporters SET
    status = CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,
    responded_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_supporter_id;
  RETURN p_supporter_id;
END;
$$;

CREATE FUNCTION public.poll_election_nomination_decide(
  p_society_id uuid, p_nomination_id uuid, p_accept boolean,
  p_reason text, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nomination public.poll_election_nominations;
BEGIN
  SELECT * INTO nomination FROM public.poll_election_nominations
  WHERE society_id = p_society_id AND id = p_nomination_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nomination not found.' USING ERRCODE = 'P0002'; END IF;
  IF nomination.status <> 'pending' OR nomination.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'The nomination has already been decided or withdrawn.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, nomination.election_id
  );
  IF NOT private.poll_election_officer_or_admin(
    p_society_id, nomination.election_id
  ) THEN
    RAISE EXCEPTION 'Nomination scrutiny access is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = nomination.election_id
      AND stage = 'scrutiny'
  ) THEN RAISE EXCEPTION 'Nomination scrutiny is not open.' USING ERRCODE = '23514'; END IF;
  IF (NOT p_accept) AND (
    p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 500
  ) THEN
    RAISE EXCEPTION 'Give a reason for rejecting the nomination.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.poll_election_nominations SET
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    decision_reason = CASE WHEN p_accept THEN NULL ELSE btrim(p_reason) END,
    decided_at = clock_timestamp(), decided_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_nomination_id;
  INSERT INTO public.poll_election_scrutiny_events (
    society_id, election_id, nomination_id, decision, reason, created_by
  ) VALUES (
    p_society_id, nomination.election_id, p_nomination_id,
    CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    CASE WHEN p_accept THEN NULL ELSE btrim(p_reason) END, auth.uid()
  );
  RETURN p_nomination_id;
END;
$$;

CREATE FUNCTION public.poll_election_ballot_submit(
  p_society_id uuid, p_election_id uuid, p_unit_id uuid,
  p_choices jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  voter public.poll_election_voters;
  item jsonb;
  post public.poll_election_posts;
  choice_count integer;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND OR election.stage <> 'voting'
    OR clock_timestamp() >= election.voting_closes_at
    OR clock_timestamp() < election.voting_opens_at
  THEN RAISE EXCEPTION 'Voting is not open.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO voter FROM public.poll_election_voters
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND unit_id = p_unit_id AND removed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR voter.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Your unit is not eligible to vote.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_election_participation
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND unit_id = p_unit_id
  ) THEN RAISE EXCEPTION 'Your unit has already voted.' USING ERRCODE = '23505'; END IF;
  IF jsonb_typeof(p_choices) <> 'array' THEN
    RAISE EXCEPTION 'Check each post before submitting.' USING ERRCODE = '22023';
  END IF;
  FOR post IN
    SELECT ballot_post.* FROM public.poll_election_posts AS ballot_post
    WHERE ballot_post.society_id = p_society_id
      AND ballot_post.election_id = p_election_id AND ballot_post.balloted
  LOOP
    SELECT count(*) INTO choice_count
    FROM jsonb_array_elements(p_choices) AS choice
    WHERE choice ->> 'postId' = post.id::text;
    IF choice_count < 1 OR choice_count > post.seats THEN
      RAISE EXCEPTION 'Choose candidates within the post seat limit or NOTA.'
        USING ERRCODE = '22023';
    END IF;
    IF (
      SELECT count(*)
      FROM jsonb_array_elements(p_choices) AS choice
      WHERE choice ->> 'postId' = post.id::text
        AND jsonb_typeof(choice -> 'candidateId') = 'null'
    ) > 0 AND choice_count <> 1
    THEN
      RAISE EXCEPTION 'NOTA must be the only choice for its post.'
        USING ERRCODE = '22023';
    END IF;
    IF (
      SELECT count(DISTINCT choice ->> 'candidateId')
      FROM jsonb_array_elements(p_choices) AS choice
      WHERE choice ->> 'postId' = post.id::text
        AND jsonb_typeof(choice -> 'candidateId') = 'string'
    ) <> (
      SELECT count(*)
      FROM jsonb_array_elements(p_choices) AS choice
      WHERE choice ->> 'postId' = post.id::text
        AND jsonb_typeof(choice -> 'candidateId') = 'string'
    ) THEN
      RAISE EXCEPTION 'Choose each candidate only once.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_choices)
  LOOP
    IF jsonb_typeof(item) <> 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(item) AS key
        WHERE key NOT IN ('postId', 'candidateId')
      )
      OR NOT (item ?& ARRAY['postId', 'candidateId'])
      OR jsonb_typeof(item -> 'candidateId') NOT IN ('string', 'null')
    THEN RAISE EXCEPTION 'The ballot shape is invalid.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO post FROM public.poll_election_posts
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND id = (item ->> 'postId')::uuid AND balloted;
    IF NOT FOUND THEN RAISE EXCEPTION 'The ballot contains an invalid post.'
      USING ERRCODE = '22023'; END IF;
    IF jsonb_typeof(item -> 'candidateId') = 'string'
      AND NOT EXISTS (
        SELECT 1 FROM public.poll_election_nominations AS nomination
        WHERE nomination.society_id = p_society_id
          AND nomination.election_id = p_election_id
          AND nomination.post_id = post.id
          AND nomination.candidate_user_id = (item ->> 'candidateId')::uuid
          AND nomination.status = 'accepted'
      )
    THEN RAISE EXCEPTION 'The ballot contains an invalid candidate.'
      USING ERRCODE = '22023'; END IF;
  END LOOP;
  INSERT INTO public.poll_election_participation (
    society_id, election_id, unit_id
  ) VALUES (p_society_id, p_election_id, p_unit_id);
  FOR item IN SELECT value FROM jsonb_array_elements(p_choices)
  LOOP
    UPDATE public.poll_election_tallies SET tally = tally + 1
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND post_id = (item ->> 'postId')::uuid
      AND candidate_user_id IS NOT DISTINCT FROM CASE
        WHEN jsonb_typeof(item -> 'candidateId') = 'null' THEN NULL
        ELSE (item ->> 'candidateId')::uuid END;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The ballot total could not be updated.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'electionId', p_election_id, 'unitId', p_unit_id, 'submitted', true
  );
END;
$$;

CREATE FUNCTION public.poll_election_count(
  p_society_id uuid, p_election_id uuid, p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE election public.poll_elections;
BEGIN
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, p_election_id
  );
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND OR election.stage NOT IN ('voting', 'candidates_published') THEN
    RAISE EXCEPTION 'The election cannot be counted now.' USING ERRCODE = '23514';
  END IF;
  IF election.stage = 'voting' AND clock_timestamp() < election.voting_closes_at THEN
    RAISE EXCEPTION 'Voting is still open.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.poll_election_officer_access(p_society_id, p_election_id) THEN
    RAISE EXCEPTION 'Only the returning officer can count the result.'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.poll_elections SET
    stage = 'counted', counted_at = clock_timestamp(),
    revision = revision + 1, updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_election_id
  RETURNING * INTO election;
  RETURN jsonb_build_object(
    'stage', election.stage, 'revision', election.revision,
    'counted_at', election.counted_at
  );
END;
$$;

CREATE FUNCTION public.poll_election_voting_extend(
  p_society_id uuid, p_election_id uuid, p_closes_at timestamptz,
  p_reason text, p_request_trace text
)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE election public.poll_elections;
BEGIN
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, p_election_id
  );
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND OR election.stage <> 'voting'
    OR NOT private.poll_election_officer_access(p_society_id, p_election_id)
  THEN RAISE EXCEPTION 'Voting cannot be extended.' USING ERRCODE = '23514'; END IF;
  IF p_closes_at <= election.voting_closes_at
    OR p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'Choose a later close time and give a reason.'
    USING ERRCODE = '22023'; END IF;
  UPDATE public.poll_elections SET
    voting_closes_at = p_closes_at, revision = revision + 1, updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_election_id;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.voting.extend', 'poll_election',
    p_election_id, jsonb_build_object(
      'closesAt', p_closes_at, 'reason', p_reason
    ), p_request_trace
  );
  RETURN p_closes_at;
END;
$$;

CREATE FUNCTION public.poll_election_tie_resolve(
  p_society_id uuid, p_election_id uuid, p_post_id uuid,
  p_candidate_user_id uuid, p_method text, p_reason text,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE resolution_id uuid; required_resolutions integer; recorded integer;
BEGIN
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, p_election_id
  );
  IF NOT private.poll_election_officer_access(p_society_id, p_election_id) THEN
    RAISE EXCEPTION 'Only the returning officer can resolve a tie.'
      USING ERRCODE = '42501';
  END IF;
  IF p_method IS NULL OR p_method <> btrim(p_method)
    OR char_length(p_method) NOT BETWEEN 1 AND 200
    OR p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 1000
  THEN RAISE EXCEPTION 'Record the tie method and reason.' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.poll_elections AS election
    JOIN public.poll_election_posts AS post
      ON post.society_id = election.society_id
      AND post.election_id = election.id
      AND post.id = p_post_id
    JOIN public.poll_election_tallies AS candidate_tally
      ON candidate_tally.society_id = post.society_id
      AND candidate_tally.election_id = post.election_id
      AND candidate_tally.post_id = post.id
      AND candidate_tally.candidate_user_id = p_candidate_user_id
    WHERE election.society_id = p_society_id
      AND election.id = p_election_id AND election.stage = 'counted'
      AND candidate_tally.tally = (
        SELECT threshold.tally
        FROM public.poll_election_tallies AS threshold
        WHERE threshold.society_id = post.society_id
          AND threshold.election_id = post.election_id
          AND threshold.post_id = post.id
          AND threshold.candidate_user_id IS NOT NULL
        ORDER BY threshold.tally DESC, threshold.candidate_user_id
        OFFSET post.seats - 1 LIMIT 1
      )
      AND EXISTS (
        SELECT 1 FROM public.poll_election_tallies AS other
        WHERE other.society_id = candidate_tally.society_id
          AND other.election_id = candidate_tally.election_id
          AND other.post_id = candidate_tally.post_id
          AND other.candidate_user_id IS NOT NULL
          AND other.candidate_user_id <> p_candidate_user_id
          AND other.tally = candidate_tally.tally
      )
  ) THEN RAISE EXCEPTION 'Choose a candidate in the counted tied cutoff.'
    USING ERRCODE = '22023'; END IF;
  SELECT greatest(post.seats - (
    SELECT count(*)
    FROM public.poll_election_tallies AS tally
    WHERE tally.society_id = p_society_id
      AND tally.election_id = p_election_id
      AND tally.post_id = p_post_id
      AND tally.candidate_user_id IS NOT NULL
      AND tally.tally > (
        SELECT threshold.tally
        FROM public.poll_election_tallies AS threshold
        WHERE threshold.society_id = p_society_id
          AND threshold.election_id = p_election_id
          AND threshold.post_id = p_post_id
          AND threshold.candidate_user_id IS NOT NULL
        ORDER BY threshold.tally DESC, threshold.candidate_user_id
        OFFSET post.seats - 1 LIMIT 1
      )
  ), 0) INTO required_resolutions
  FROM public.poll_election_posts AS post
  WHERE post.society_id = p_society_id
    AND post.election_id = p_election_id AND post.id = p_post_id;
  SELECT count(*) INTO recorded FROM public.poll_election_tie_resolutions
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND post_id = p_post_id;
  IF recorded >= required_resolutions THEN
    RAISE EXCEPTION 'Enough tie winners are already recorded.'
      USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.poll_election_tie_resolutions (
    society_id, election_id, post_id, candidate_user_id,
    method, reason, created_by
  ) VALUES (
    p_society_id, p_election_id, p_post_id, p_candidate_user_id,
    p_method, p_reason, auth.uid()
  ) RETURNING id INTO resolution_id;
  RETURN resolution_id;
END;
$$;

CREATE FUNCTION public.poll_election_post_choose(
  p_society_id uuid, p_election_id uuid, p_candidate_user_id uuid,
  p_chosen_post_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE choice_id uuid; deadline timestamptz;
  election public.poll_elections;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT counted_at + interval '3 days' INTO deadline
  FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id
    AND stage = 'counted';
  IF deadline IS NULL OR clock_timestamp() > deadline THEN
    RAISE EXCEPTION 'The three-day post-choice window is closed.'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id;
  IF election.multi_post_win_rule <> 'candidate_choice' THEN
    RAISE EXCEPTION 'The returning officer decides multiple wins for this election.'
      USING ERRCODE = '23514';
  END IF;
  IF auth.uid() <> p_candidate_user_id THEN
    RAISE EXCEPTION 'The winning candidate must make this choice.'
      USING ERRCODE = '42501';
  END IF;
  IF (
    SELECT count(*)
    FROM public.poll_election_posts AS ballot_post
    JOIN public.poll_election_tallies AS selected
      ON selected.society_id = ballot_post.society_id
      AND selected.election_id = ballot_post.election_id
      AND selected.post_id = ballot_post.id
      AND selected.candidate_user_id = p_candidate_user_id
    WHERE ballot_post.society_id = p_society_id
      AND ballot_post.election_id = p_election_id
      AND ballot_post.balloted
      AND selected.tally >= COALESCE((
        SELECT threshold.tally
        FROM public.poll_election_tallies AS threshold
        WHERE threshold.society_id = p_society_id
          AND threshold.election_id = p_election_id
          AND threshold.post_id = ballot_post.id
          AND threshold.candidate_user_id IS NOT NULL
        ORDER BY threshold.tally DESC, threshold.candidate_user_id
        OFFSET ballot_post.seats - 1 LIMIT 1
      ), selected.tally)
  ) < 2 OR NOT EXISTS (
    SELECT 1 FROM public.poll_election_tallies AS selected
    WHERE selected.society_id = p_society_id
      AND selected.election_id = p_election_id
      AND selected.post_id = p_chosen_post_id
      AND selected.candidate_user_id = p_candidate_user_id
  ) THEN
    RAISE EXCEPTION 'Choose a post the candidate actually won.'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_election_tallies AS selected
    JOIN public.poll_election_posts AS post
      ON post.society_id = selected.society_id
      AND post.election_id = selected.election_id
      AND post.id = selected.post_id
    WHERE selected.society_id = p_society_id
      AND selected.election_id = p_election_id
      AND selected.post_id = p_chosen_post_id
      AND selected.candidate_user_id = p_candidate_user_id
      AND selected.tally = (
        SELECT threshold.tally
        FROM public.poll_election_tallies AS threshold
        WHERE threshold.society_id = p_society_id
          AND threshold.election_id = p_election_id
          AND threshold.post_id = selected.post_id
          AND threshold.candidate_user_id IS NOT NULL
        ORDER BY threshold.tally DESC, threshold.candidate_user_id
        OFFSET post.seats - 1 LIMIT 1
      )
  ) AND NOT EXISTS (
    SELECT 1 FROM public.poll_election_tie_resolutions AS resolution
    WHERE resolution.society_id = p_society_id
      AND resolution.election_id = p_election_id
      AND resolution.post_id = p_chosen_post_id
      AND resolution.candidate_user_id = p_candidate_user_id
  ) THEN
    RAISE EXCEPTION 'The returning officer must resolve this tied post first.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.poll_election_post_choices (
    society_id, election_id, candidate_user_id, chosen_post_id,
    decided_by, method, deadline_at
  ) VALUES (
    p_society_id, p_election_id, p_candidate_user_id, p_chosen_post_id,
    auth.uid(), 'candidate_choice', deadline
  ) RETURNING id INTO choice_id;
  RETURN choice_id;
END;
$$;

CREATE FUNCTION public.poll_election_post_decide(
  p_society_id uuid, p_election_id uuid, p_candidate_user_id uuid,
  p_chosen_post_id uuid, p_reason text, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE choice_id uuid; election public.poll_elections;
BEGIN
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, p_election_id
  );
  IF NOT private.poll_election_officer_access(p_society_id, p_election_id) THEN
    RAISE EXCEPTION 'Only the returning officer can decide this post.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id;
  IF election.stage <> 'counted' OR (
    election.multi_post_win_rule = 'candidate_choice'
    AND clock_timestamp() <= election.counted_at + interval '3 days'
  )
  THEN RAISE EXCEPTION 'The returning officer is not the configured decision maker.'
    USING ERRCODE = '23514'; END IF;
  IF (
    SELECT count(*)
    FROM public.poll_election_posts AS ballot_post
    JOIN public.poll_election_tallies AS selected
      ON selected.society_id = ballot_post.society_id
      AND selected.election_id = ballot_post.election_id
      AND selected.post_id = ballot_post.id
      AND selected.candidate_user_id = p_candidate_user_id
    WHERE ballot_post.society_id = p_society_id
      AND ballot_post.election_id = p_election_id
      AND ballot_post.balloted
      AND selected.tally >= (
        SELECT threshold.tally
        FROM public.poll_election_tallies AS threshold
        WHERE threshold.society_id = p_society_id
          AND threshold.election_id = p_election_id
          AND threshold.post_id = ballot_post.id
          AND threshold.candidate_user_id IS NOT NULL
        ORDER BY threshold.tally DESC, threshold.candidate_user_id
        OFFSET ballot_post.seats - 1 LIMIT 1
      )
  ) < 2 OR NOT EXISTS (
    SELECT 1 FROM public.poll_election_tallies
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND post_id = p_chosen_post_id
      AND candidate_user_id = p_candidate_user_id
  ) THEN RAISE EXCEPTION 'Choose a post the candidate actually won.'
    USING ERRCODE = '22023'; END IF;
  IF p_reason IS NULL OR p_reason <> btrim(p_reason)
    OR char_length(p_reason) NOT BETWEEN 1 AND 1000
  THEN RAISE EXCEPTION 'Give a reason for the returning-officer decision.'
    USING ERRCODE = '22023'; END IF;
  INSERT INTO public.poll_election_post_choices (
    society_id, election_id, candidate_user_id, chosen_post_id,
    decided_by, method, reason, deadline_at
  ) VALUES (
    p_society_id, p_election_id, p_candidate_user_id, p_chosen_post_id,
    auth.uid(), 'returning_officer', p_reason, clock_timestamp()
  ) RETURNING id INTO choice_id;
  RETURN choice_id;
END;
$$;

CREATE FUNCTION public.poll_election_declare(
  p_society_id uuid, p_election_id uuid, p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  post public.poll_election_posts;
  candidate record;
  declared integer := 0;
BEGIN
  PERFORM private.poll_election_officer_write_begin(
    p_society_id, p_election_id
  );
  IF NOT private.poll_election_officer_access(p_society_id, p_election_id) THEN
    RAISE EXCEPTION 'Only the returning officer can declare the result.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id FOR UPDATE;
  IF NOT FOUND OR election.stage <> 'counted' THEN
    RAISE EXCEPTION 'Count the election before declaration.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    WITH prospective AS (
      SELECT candidate_user_id, post_id
      FROM (
        SELECT tally.candidate_user_id, tally.post_id,
          row_number() OVER (
            PARTITION BY tally.post_id
            ORDER BY tally.tally DESC, tally.candidate_user_id
          ) AS position
        FROM public.poll_election_tallies AS tally
        JOIN public.poll_election_posts AS ballot_post
          ON ballot_post.society_id = tally.society_id
          AND ballot_post.election_id = tally.election_id
          AND ballot_post.id = tally.post_id
        WHERE tally.society_id = p_society_id
          AND tally.election_id = p_election_id
          AND tally.candidate_user_id IS NOT NULL AND ballot_post.balloted
      ) AS ranked
      JOIN public.poll_election_posts AS ranked_post
        ON ranked_post.society_id = p_society_id
        AND ranked_post.election_id = p_election_id
        AND ranked_post.id = ranked.post_id
      WHERE ranked.position <= ranked_post.seats
      UNION
      SELECT nomination.candidate_user_id, nomination.post_id
      FROM public.poll_election_nominations AS nomination
      JOIN public.poll_election_posts AS unopposed_post
        ON unopposed_post.society_id = nomination.society_id
        AND unopposed_post.election_id = nomination.election_id
        AND unopposed_post.id = nomination.post_id
      WHERE nomination.society_id = p_society_id
        AND nomination.election_id = p_election_id
        AND nomination.status = 'accepted' AND NOT unopposed_post.balloted
    )
    SELECT 1
    FROM prospective
    GROUP BY candidate_user_id
    HAVING count(DISTINCT post_id) > 1
      AND NOT EXISTS (
        SELECT 1 FROM public.poll_election_post_choices AS choice
        WHERE choice.society_id = p_society_id
          AND choice.election_id = p_election_id
          AND choice.candidate_user_id = prospective.candidate_user_id
          AND choice.method = election.multi_post_win_rule
      )
  ) THEN
    RAISE EXCEPTION 'Resolve the candidate winning more than one post first.'
      USING ERRCODE = '23514';
  END IF;
  FOR post IN
    SELECT * FROM public.poll_election_posts
    WHERE society_id = p_society_id AND election_id = p_election_id
    ORDER BY position
  LOOP
    IF post.balloted THEN
      IF EXISTS (
        WITH totals AS (
          SELECT tally.candidate_user_id, tally.tally
          FROM public.poll_election_tallies AS tally
          WHERE tally.society_id = p_society_id
            AND tally.election_id = p_election_id
            AND tally.post_id = post.id
            AND tally.candidate_user_id IS NOT NULL
        ), threshold AS (
          SELECT tally
          FROM totals
          ORDER BY tally DESC, candidate_user_id
          OFFSET greatest(post.seats - 1, 0) LIMIT 1
        )
        , tied AS (
          SELECT totals.candidate_user_id
          FROM totals
          JOIN threshold USING (tally)
        ), above AS (
          SELECT count(*)::integer AS candidate_count
          FROM totals CROSS JOIN threshold
          WHERE totals.tally > threshold.tally
        ), resolved AS (
          SELECT count(*)::integer AS candidate_count
          FROM public.poll_election_tie_resolutions AS resolution
          WHERE resolution.society_id = p_society_id
            AND resolution.election_id = p_election_id
            AND resolution.post_id = post.id
            AND resolution.candidate_user_id IN (SELECT candidate_user_id FROM tied)
        )
        SELECT 1
        FROM tied CROSS JOIN above CROSS JOIN resolved
        GROUP BY above.candidate_count, resolved.candidate_count
        HAVING count(*) > greatest(post.seats - above.candidate_count, 0)
          AND resolved.candidate_count <
            greatest(post.seats - above.candidate_count, 0)
      ) THEN
        RAISE EXCEPTION 'Resolve the tied post before declaration.'
          USING ERRCODE = '23514';
      END IF;
      FOR candidate IN
        SELECT tally.candidate_user_id, tally.tally
        FROM public.poll_election_tallies AS tally
        WHERE tally.society_id = p_society_id
          AND tally.election_id = p_election_id
          AND tally.post_id = post.id
          AND tally.candidate_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.poll_election_post_choices AS choice
          WHERE choice.society_id = p_society_id
            AND choice.election_id = p_election_id
            AND choice.candidate_user_id = tally.candidate_user_id
            AND choice.chosen_post_id <> post.id
        )
        ORDER BY tally.tally DESC, EXISTS (
          SELECT 1 FROM public.poll_election_tie_resolutions AS resolved
          WHERE resolved.society_id = p_society_id
            AND resolved.election_id = p_election_id
            AND resolved.post_id = post.id
            AND resolved.candidate_user_id = tally.candidate_user_id
        ) DESC, (
          SELECT profile.full_name FROM public.profiles AS profile
          WHERE profile.id = tally.candidate_user_id
        )
        LIMIT post.seats
      LOOP
        IF EXISTS (
          SELECT 1 FROM public.poll_election_declarations
          WHERE society_id = p_society_id AND election_id = p_election_id
            AND post_id = post.id AND candidate_user_id = candidate.candidate_user_id
        ) THEN CONTINUE; END IF;
        INSERT INTO public.poll_election_declarations (
          society_id, election_id, post_id, candidate_user_id, declared_by,
          tie_resolved
        ) VALUES (
          p_society_id, p_election_id, post.id, candidate.candidate_user_id,
          auth.uid(), EXISTS (
            SELECT 1 FROM public.poll_election_tie_resolutions
            WHERE society_id = p_society_id AND election_id = p_election_id
              AND post_id = post.id
              AND candidate_user_id = candidate.candidate_user_id
          )
        );
        declared := declared + 1;
      END LOOP;
    ELSE
      FOR candidate IN
        SELECT nomination.candidate_user_id
        FROM public.poll_election_nominations AS nomination
        WHERE nomination.society_id = p_society_id
          AND nomination.election_id = p_election_id
          AND nomination.post_id = post.id
          AND nomination.status = 'accepted'
        ORDER BY nomination.created_at, nomination.id
        LIMIT post.seats
      LOOP
        INSERT INTO public.poll_election_declarations (
          society_id, election_id, post_id, candidate_user_id, unopposed,
          declared_by
        ) VALUES (
          p_society_id, p_election_id, post.id, candidate.candidate_user_id,
          true, auth.uid()
        );
        declared := declared + 1;
      END LOOP;
    END IF;
  END LOOP;
  IF declared = 0 THEN
    RAISE EXCEPTION 'No candidates were available to declare.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.poll_elections SET
    stage = 'declared', declared_at = clock_timestamp(),
    revision = revision + 1, updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_election_id
  RETURNING stage, revision INTO election.stage, election.revision;
  UPDATE public.poll_election_officers SET
    access_ends_at = greatest(
      clock_timestamp() + interval '30 days',
      COALESCE((
        SELECT max(clock_timestamp() + interval '30 days')
        FROM public.poll_election_disputes
        WHERE society_id = p_society_id AND election_id = p_election_id
          AND status IN ('open', 'under_review')
      ), clock_timestamp() + interval '30 days')
    )
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND profile_id IS NULL AND revoked_at IS NULL;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.declare', 'poll_election',
    p_election_id, jsonb_build_object('winnerCount', declared), p_request_trace
  );
  RETURN jsonb_build_object(
    'stage', election.stage, 'revision', election.revision,
    'winnerCount', declared
  );
END;
$$;

CREATE FUNCTION public.poll_election_external_result(
  p_society_id uuid, p_election_id uuid, p_post_id uuid,
  p_winner_name text, p_votes_count integer, p_document_id uuid,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result_id uuid; previous public.poll_election_external_results;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF NOT private.module_enabled(p_society_id, 'document') THEN
    RAISE EXCEPTION 'Documents is required for an outside-app result.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO previous FROM public.poll_election_external_results
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id AND post_id = p_post_id;
  IF previous.id IS NOT NULL THEN
    IF previous.election_id IS DISTINCT FROM p_election_id
      OR previous.winner_name IS DISTINCT FROM p_winner_name
      OR previous.votes_count IS DISTINCT FROM p_votes_count
      OR previous.document_id IS DISTINCT FROM p_document_id
    THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505'; END IF;
    RETURN previous.id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_elections
    WHERE society_id = p_society_id AND id = p_election_id
      AND source = 'outside_app' AND stage = 'declared'
  ) THEN RAISE EXCEPTION 'Choose an outside-app election in Declared stage.'
    USING ERRCODE = '23514'; END IF;
  INSERT INTO public.poll_election_external_results (
    society_id, election_id, post_id, winner_name, votes_count,
    document_id, created_by, client_request_id
  ) VALUES (
    p_society_id, p_election_id, p_post_id, p_winner_name,
    p_votes_count, p_document_id, auth.uid(), p_client_request_id
  ) RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

CREATE FUNCTION public.poll_election_dispute_raise(
  p_society_id uuid, p_election_id uuid, p_text text, p_file_path text,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  election public.poll_elections;
  voter public.poll_election_voters;
  previous public.poll_election_disputes;
  dispute_id uuid;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO previous FROM public.poll_election_disputes
  WHERE society_id = p_society_id AND raised_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF previous.id IS NOT NULL THEN
    IF previous.election_id IS DISTINCT FROM p_election_id
      OR previous.text IS DISTINCT FROM p_text
      OR previous.file_path IS DISTINCT FROM p_file_path
    THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505'; END IF;
    RETURN previous.id;
  END IF;
  SELECT * INTO voter FROM public.poll_election_voters
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND user_id = auth.uid() AND removed_at IS NULL
  LIMIT 1;
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id;
  IF voter.unit_id IS NULL OR election.stage NOT IN ('declared', 'closed')
    OR clock_timestamp() > election.declared_at
      + make_interval(days => election.dispute_window_days)
  THEN RAISE EXCEPTION 'The dispute window is not open.' USING ERRCODE = '42501'; END IF;
  IF p_text IS NULL OR p_text <> btrim(p_text)
    OR char_length(p_text) NOT BETWEEN 1 AND 2000
  THEN RAISE EXCEPTION 'Write the dispute in 1 to 2000 characters.'
    USING ERRCODE = '22023'; END IF;
  PERFORM private.poll_election_verify_dispute_file(
    p_society_id, p_election_id, p_file_path
  );
  INSERT INTO public.poll_election_disputes (
    society_id, election_id, raised_by, unit_id, text, file_path,
    client_request_id
  ) VALUES (
    p_society_id, p_election_id, auth.uid(), voter.unit_id, p_text, p_file_path,
    p_client_request_id
  ) RETURNING id INTO dispute_id;
  UPDATE public.poll_election_officers SET
    access_ends_at = clock_timestamp() + interval '100 years'
  WHERE society_id = p_society_id AND election_id = p_election_id
    AND profile_id IS NULL AND revoked_at IS NULL;
  RETURN dispute_id;
END;
$$;

CREATE FUNCTION public.poll_election_dispute_update(
  p_society_id uuid, p_dispute_id uuid, p_status text,
  p_resolution_note text, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE dispute public.poll_election_disputes;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'poll')
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Dispute updates are not available.'
    USING ERRCODE = '42501'; END IF;
  SELECT * INTO dispute FROM public.poll_election_disputes
  WHERE society_id = p_society_id AND id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found.' USING ERRCODE = 'P0002'; END IF;
  IF dispute.status IN ('resolved', 'rejected') THEN
    RAISE EXCEPTION 'A closed dispute cannot be reopened.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[]) THEN
    PERFORM private.poll_election_officer_write_begin(
      p_society_id, dispute.election_id
    );
  END IF;
  IF NOT (
    private.has_role(p_society_id, ARRAY['admin']::text[])
    OR private.poll_election_officer_access(p_society_id, dispute.election_id)
  ) THEN RAISE EXCEPTION 'Dispute access is not available.' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('under_review', 'resolved', 'rejected')
    OR (p_status IN ('resolved', 'rejected') AND (
      p_resolution_note IS NULL OR p_resolution_note <> btrim(p_resolution_note)
      OR char_length(p_resolution_note) NOT BETWEEN 1 AND 1000
    ))
  THEN RAISE EXCEPTION 'Choose a valid status and resolution note.'
    USING ERRCODE = '22023'; END IF;
  IF dispute.status = p_status
    AND (dispute.resolution_note IS NOT DISTINCT FROM nullif(btrim(p_resolution_note), ''))
  THEN RETURN p_dispute_id; END IF;
  UPDATE public.poll_election_disputes SET
    status = p_status,
    resolution_note = CASE WHEN p_status IN ('resolved', 'rejected')
      THEN p_resolution_note END,
    resolved_by = CASE WHEN p_status IN ('resolved', 'rejected')
      THEN auth.uid() END,
    resolved_at = CASE WHEN p_status IN ('resolved', 'rejected')
      THEN clock_timestamp() END,
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_dispute_id;
  INSERT INTO public.poll_election_dispute_events (
    society_id, election_id, dispute_id, from_status, to_status, note, created_by
  ) VALUES (
    p_society_id, dispute.election_id, p_dispute_id, dispute.status, p_status,
    nullif(btrim(p_resolution_note), ''), auth.uid()
  );
  UPDATE public.poll_election_officers AS officer SET
    access_ends_at = greatest(
      (SELECT declared_at + interval '30 days' FROM public.poll_elections
       WHERE society_id = p_society_id AND id = dispute.election_id),
      CASE WHEN EXISTS (
        SELECT 1 FROM public.poll_election_disputes AS open_dispute
        WHERE open_dispute.society_id = p_society_id
          AND open_dispute.election_id = dispute.election_id
          AND open_dispute.status IN ('open', 'under_review')
      ) THEN clock_timestamp() + interval '100 years'
      ELSE COALESCE(dispute.resolved_at, clock_timestamp()) END
    )
  WHERE officer.society_id = p_society_id
    AND officer.election_id = dispute.election_id
    AND officer.profile_id IS NULL AND officer.revoked_at IS NULL;
  RETURN p_dispute_id;
END;
$$;

CREATE FUNCTION public.poll_election_expense_link(
  p_society_id uuid, p_election_id uuid, p_expense_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link_id uuid;
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF NOT private.module_enabled(p_society_id, 'expense') THEN
    RAISE EXCEPTION 'Accounts is required to link election costs.'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.poll_election_expense_links (
    society_id, election_id, expense_id, created_by
  )
  SELECT p_society_id, p_election_id, expense.id, auth.uid()
  FROM public.expenses AS expense
  WHERE expense.society_id = p_society_id AND expense.id = p_expense_id
    AND expense.status = 'posted'
  RETURNING id INTO link_id;
  IF link_id IS NULL THEN RAISE EXCEPTION 'Choose a posted expense entry.'
    USING ERRCODE = '22023'; END IF;
  RETURN link_id;
END;
$$;

CREATE FUNCTION public.poll_election_expense_unlink(
  p_society_id uuid, p_link_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_write_begin(p_society_id, ARRAY['admin']::text[]);
  DELETE FROM public.poll_election_expense_links
  WHERE society_id = p_society_id AND id = p_link_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Election cost link not found.'
    USING ERRCODE = 'P0002'; END IF;
  RETURN p_link_id;
END;
$$;

CREATE FUNCTION public.poll_election_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.poll_authorize(
    p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false
  );
  IF NOT private.poll_election_official_enabled(p_society_id) THEN
    RETURN jsonb_build_object(
      'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
      'elections', '[]'::jsonb
    );
  END IF;
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'elections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', election.id, 'title', election.title,
        'legal_type', election.legal_type, 'stage', election.stage,
        'source', election.source,
        'nominations_open_at', election.nominations_open_at,
        'nominations_close_at', election.nominations_close_at,
        'voting_opens_at', election.voting_opens_at,
        'voting_closes_at', election.voting_closes_at,
        'declared_at', election.declared_at,
        'revision', election.revision
      ) ORDER BY election.updated_at DESC, election.id)
      FROM public.poll_elections AS election
      WHERE election.society_id = p_society_id
        AND (
          private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
          OR election.stage NOT IN ('planning')
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.poll_election_get(
  p_society_id uuid, p_election_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE election public.poll_elections;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'poll')
    OR NOT (
      private.has_role(
        p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
      )
      OR private.poll_election_officer_read_access(p_society_id, p_election_id)
    )
  THEN RAISE EXCEPTION 'Official election access is not available.'
    USING ERRCODE = '42501'; END IF;
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id;
  IF NOT FOUND OR (
    election.stage = 'planning'
    AND NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    AND NOT private.poll_election_officer_read_access(p_society_id, p_election_id)
  ) THEN RAISE EXCEPTION 'Election not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'id', election.id, 'title', election.title, 'legal_type', election.legal_type,
    'society_name', (
      SELECT society.name FROM public.societies AS society
      WHERE society.id = p_society_id
    ),
    'stage', election.stage, 'source', election.source, 'revision', election.revision,
    'nominations_open_at', election.nominations_open_at,
    'nominations_close_at', election.nominations_close_at,
    'voting_opens_at', election.voting_opens_at,
    'voting_closes_at', election.voting_closes_at,
    'outside_held_on', election.outside_held_on,
    'declared_at', election.declared_at, 'closed_at', election.closed_at,
    'cancelled_at', election.cancelled_at,
    'cancellation_reason', election.cancellation_reason,
    'dispute_window_days', election.dispute_window_days,
    'multi_post_win_rule', election.multi_post_win_rule,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'is_officer', private.poll_election_officer_access(p_society_id, p_election_id),
    'actor_id', auth.uid(),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', post.id, 'name', post.name, 'seats', post.seats,
        'position', post.position, 'balloted', post.balloted,
        'accepted_candidates', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'nomination_id', nomination.id,
            'candidate_user_id', nomination.candidate_user_id,
            'candidate_name', profile.full_name,
            'status', nomination.status,
            'decision_reason', nomination.decision_reason
          ) ORDER BY nomination.created_at)
          FROM public.poll_election_nominations AS nomination
          JOIN public.profiles AS profile ON profile.id = nomination.candidate_user_id
          WHERE nomination.society_id = p_society_id
            AND nomination.election_id = p_election_id
            AND nomination.post_id = post.id
            AND (
              (
                (
                  nomination.status = 'accepted'
                  AND election.stage NOT IN (
                    'planning', 'nominations_open', 'scrutiny'
                  )
                )
                AND election.stage NOT IN (
                  'planning', 'nominations_open', 'scrutiny'
                )
              )
              OR private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
              OR private.poll_election_officer_access(p_society_id, p_election_id)
              OR nomination.candidate_user_id = auth.uid()
            )
        ), '[]'::jsonb)
      ) ORDER BY post.position)
      FROM public.poll_election_posts AS post
      WHERE post.society_id = p_society_id AND post.election_id = p_election_id
    ), '[]'::jsonb),
    'activities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', activity.id, 'title', activity.title, 'owner_name', activity.owner_name,
        'planned_on', activity.planned_on, 'actual_on', activity.actual_on,
        'status', activity.status, 'note', activity.note
      ) ORDER BY activity.position)
      FROM public.poll_election_activities AS activity
      WHERE activity.society_id = p_society_id
        AND activity.election_id = p_election_id
    ), '[]'::jsonb),
    'links', CASE WHEN private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    ) OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', link.id, 'source_type', link.source_type,
        'source_id', COALESCE(link.notice_id, link.meeting_id, link.document_id),
        'title', CASE link.source_type
          WHEN 'notice' THEN (SELECT notice.title FROM public.notices AS notice
            WHERE notice.society_id = p_society_id AND notice.id = link.notice_id)
          WHEN 'meeting' THEN (SELECT meeting.title FROM public.meetings AS meeting
            WHERE meeting.society_id = p_society_id AND meeting.id = link.meeting_id)
          ELSE (SELECT document.title FROM public.documents AS document
            WHERE document.society_id = p_society_id AND document.id = link.document_id)
        END
      ) ORDER BY link.created_at)
      FROM public.poll_election_links AS link
      WHERE link.society_id = p_society_id AND link.election_id = p_election_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'officer', (
      SELECT jsonb_build_object(
        'id', officer.id, 'profile_id', officer.profile_id,
        'name', CASE
          WHEN officer.profile_id IS NOT NULL THEN profile.full_name
          WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
            OR private.poll_election_officer_access(p_society_id, p_election_id)
            THEN officer.invited_email::text
          ELSE 'Outside returning officer' END,
        'outside', officer.profile_id IS NULL,
        'accepted', officer.conflict_confirmed_at IS NOT NULL,
        'access_ends_at', officer.access_ends_at
      )
      FROM public.poll_election_officers AS officer
      LEFT JOIN public.profiles AS profile ON profile.id = officer.profile_id
      WHERE officer.society_id = p_society_id
        AND officer.election_id = p_election_id AND officer.revoked_at IS NULL
    ),
    'helpers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', helper.id, 'name', helper.name, 'role', helper.role_name
      ) ORDER BY helper.created_at)
      FROM public.poll_election_helpers AS helper
      WHERE helper.society_id = p_society_id
        AND helper.election_id = p_election_id
    ), '[]'::jsonb),
    'voters', CASE WHEN private.has_role(
      p_society_id, ARRAY['admin']::text[]
    ) OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'unit_id', voter.unit_id, 'unit_label', voter.unit_label,
          'membership_id', voter.membership_id, 'user_id', voter.user_id,
          'voter_name', voter.voter_name, 'source', voter.source,
          'removed', voter.removed_at IS NOT NULL,
          'removal_reason', voter.removal_reason, 'revision', voter.revision,
          'owner_options', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'membership_id', owner.membership_id,
              'name', owner_profile.full_name
            ) ORDER BY owner_profile.full_name)
            FROM public.unit_occupants AS owner
            JOIN public.memberships AS owner_membership
              ON owner_membership.society_id = owner.society_id
              AND owner_membership.id = owner.membership_id
            JOIN public.profiles AS owner_profile
              ON owner_profile.id = owner_membership.user_id
            WHERE owner.society_id = p_society_id
              AND owner.unit_id = voter.unit_id
              AND owner.status = 'active' AND owner.relationship = 'owner'
              AND owner_membership.status = 'active'
          ), '[]'::jsonb)
        ) ORDER BY voter.unit_label)
        FROM public.poll_election_voters AS voter
        WHERE voter.society_id = p_society_id
          AND voter.election_id = p_election_id
      ), '[]'::jsonb)
      ELSE '[]'::jsonb END,
    'member_options', CASE WHEN private.has_role(
      p_society_id, ARRAY['admin']::text[]
    ) THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id, 'name', profile.full_name
      ) ORDER BY profile.full_name)
      FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'source_options', jsonb_build_object(
      'notices', CASE WHEN private.module_enabled(p_society_id, 'notice')
        AND private.has_role(p_society_id, ARRAY['admin']::text[]) THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY created_at DESC)
        FROM public.notices WHERE society_id = p_society_id AND status <> 'withdrawn'
        LIMIT 200
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'meetings', CASE WHEN private.module_enabled(p_society_id, 'meeting')
        AND private.has_role(p_society_id, ARRAY['admin']::text[]) THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY starts_at DESC)
        FROM public.meetings WHERE society_id = p_society_id
        LIMIT 200
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'documents', CASE WHEN private.module_enabled(p_society_id, 'document')
        AND private.has_role(p_society_id, ARRAY['admin']::text[]) THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY updated_at DESC)
        FROM public.documents WHERE society_id = p_society_id AND archived_at IS NULL
        LIMIT 200
      ), '[]'::jsonb) ELSE '[]'::jsonb END
    ),
    'expense_options', CASE WHEN private.module_enabled(p_society_id, 'expense')
      AND private.has_role(p_society_id, ARRAY['admin']::text[])
      THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', expense.id, 'label',
          expense.spent_on || ' · ' || expense.payee || ' · Rs. ' ||
            (expense.amount_paise::numeric / 100)::text
        ) ORDER BY expense.spent_on DESC, expense.id)
        FROM public.expenses AS expense
        WHERE expense.society_id = p_society_id AND expense.status = 'posted'
        LIMIT 200
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'my_unit_id', (
      SELECT voter.unit_id FROM public.poll_election_voters AS voter
      WHERE voter.society_id = p_society_id
        AND voter.election_id = p_election_id AND voter.user_id = auth.uid()
        AND voter.removed_at IS NULL
      LIMIT 1
    ),
    'my_unit_has_voted', EXISTS (
      SELECT 1 FROM public.poll_election_participation AS participation
      WHERE participation.society_id = p_society_id
        AND participation.election_id = p_election_id
        AND participation.unit_id IN (
          SELECT voter.unit_id FROM public.poll_election_voters AS voter
          WHERE voter.society_id = p_society_id
            AND voter.election_id = p_election_id
            AND voter.user_id = auth.uid() AND voter.removed_at IS NULL
        )
    ),
    'nominations', CASE WHEN election.stage <> 'planning' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', nomination.id, 'post_id', nomination.post_id,
        'candidate_user_id', nomination.candidate_user_id,
        'candidate_name', profile.full_name, 'unit_id', nomination.unit_id,
        'status', nomination.status, 'decision_reason', nomination.decision_reason,
        'supporters', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', supporter.id, 'kind', supporter.kind,
            'supporter_user_id', supporter.supporter_user_id,
            'supporter_name', supporter_profile.full_name,
            'status', supporter.status
          ) ORDER BY supporter.kind)
          FROM public.poll_election_supporters AS supporter
          JOIN public.profiles AS supporter_profile
            ON supporter_profile.id = supporter.supporter_user_id
          WHERE supporter.society_id = p_society_id
            AND supporter.nomination_id = nomination.id
        ), '[]'::jsonb)
      ) ORDER BY nomination.created_at)
      FROM public.poll_election_nominations AS nomination
      JOIN public.profiles AS profile ON profile.id = nomination.candidate_user_id
      WHERE nomination.society_id = p_society_id
        AND nomination.election_id = p_election_id
        AND (
          nomination.status = 'accepted'
          OR nomination.candidate_user_id = auth.uid()
          OR private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
          OR private.poll_election_officer_access(p_society_id, p_election_id)
        )
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'post_id', post.id, 'post_name', post.name,
        'tallies', (
          SELECT jsonb_agg(jsonb_build_object(
            'candidate_user_id', tally.candidate_user_id,
            'candidate_name', COALESCE(profile.full_name, 'None of the above'),
            'tally', tally.tally
          ) ORDER BY tally.tally DESC, profile.full_name)
          FROM public.poll_election_tallies AS tally
          LEFT JOIN public.profiles AS profile
            ON profile.id = tally.candidate_user_id
          WHERE tally.society_id = p_society_id
            AND tally.election_id = p_election_id
            AND tally.post_id = post.id
        ),
        'winners', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'candidate_user_id', declaration.candidate_user_id,
            'candidate_name', profile.full_name,
            'unopposed', declaration.unopposed
          ) ORDER BY profile.full_name)
          FROM public.poll_election_declarations AS declaration
          LEFT JOIN public.profiles AS profile
            ON profile.id = declaration.candidate_user_id
          WHERE declaration.society_id = p_society_id
            AND declaration.election_id = p_election_id
            AND declaration.post_id = post.id
        ), '[]'::jsonb)
      ) ORDER BY post.position)
      FROM public.poll_election_posts AS post
      WHERE post.society_id = p_society_id AND post.election_id = p_election_id
        AND election.stage IN ('declared', 'closed')
    ), '[]'::jsonb),
    'outside_results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', result.id, 'post_id', result.post_id,
        'winner_name', result.winner_name, 'votes_count', result.votes_count,
        'document_id', result.document_id
      ) ORDER BY result.created_at)
      FROM public.poll_election_external_results AS result
      WHERE result.society_id = p_society_id
        AND result.election_id = p_election_id
    ), '[]'::jsonb),
    'participation_count', CASE WHEN election.stage IN ('declared', 'closed')
      OR private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN (
      SELECT count(*)::integer FROM public.poll_election_participation
      WHERE society_id = p_society_id AND election_id = p_election_id
      ) ELSE 0 END,
    'voter_count', (
      SELECT count(*)::integer FROM public.poll_election_voters
      WHERE society_id = p_society_id AND election_id = p_election_id
        AND removed_at IS NULL
    ),
    'voted_units', CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
      OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'unit_id', voter.unit_id, 'unit_label', voter.unit_label
        ) ORDER BY voter.unit_label)
        FROM public.poll_election_participation AS participation
        JOIN public.poll_election_voters AS voter
          ON voter.society_id = participation.society_id
          AND voter.election_id = participation.election_id
          AND voter.unit_id = participation.unit_id
        WHERE participation.society_id = p_society_id
          AND participation.election_id = p_election_id
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'dispute_count', CASE WHEN private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    ) OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN (
      SELECT count(*)::integer FROM public.poll_election_disputes
      WHERE society_id = p_society_id AND election_id = p_election_id
      ) ELSE (
        SELECT count(*)::integer FROM public.poll_election_disputes
        WHERE society_id = p_society_id AND election_id = p_election_id
          AND raised_by = auth.uid()
      ) END,
    'disputes', CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
      OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', dispute.id, 'text', dispute.text, 'file_path', dispute.file_path,
          'status', dispute.status, 'resolution_note', dispute.resolution_note,
          'created_at', dispute.created_at, 'raised_by', dispute.raised_by
        ) ORDER BY dispute.created_at DESC)
        FROM public.poll_election_disputes AS dispute
        WHERE dispute.society_id = p_society_id
          AND dispute.election_id = p_election_id
      ), '[]'::jsonb)
      ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', dispute.id, 'text', dispute.text, 'file_path', dispute.file_path,
          'status', dispute.status, 'resolution_note', dispute.resolution_note,
          'created_at', dispute.created_at, 'raised_by', dispute.raised_by
        ) ORDER BY dispute.created_at DESC)
        FROM public.poll_election_disputes AS dispute
        WHERE dispute.society_id = p_society_id
          AND dispute.election_id = p_election_id AND dispute.raised_by = auth.uid()
      ), '[]'::jsonb) END,
    'total_cost_paise', CASE WHEN private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    ) OR private.poll_election_officer_access(p_society_id, p_election_id)
      THEN COALESCE((
      SELECT sum(expense.amount_paise) FROM public.poll_election_expense_links AS link
      JOIN public.expenses AS expense
        ON expense.society_id = link.society_id AND expense.id = link.expense_id
      WHERE link.society_id = p_society_id AND link.election_id = p_election_id
        AND expense.status = 'posted'
    ), 0)::bigint ELSE 0::bigint END,
    'expense_links', CASE WHEN private.has_role(
      p_society_id, ARRAY['admin']::text[]
    ) THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', link.id, 'expense_id', link.expense_id,
        'description', expense.description, 'amount_paise', expense.amount_paise,
        'spent_on', expense.spent_on
      ) ORDER BY expense.spent_on DESC, link.id)
      FROM public.poll_election_expense_links AS link
      JOIN public.expenses AS expense
        ON expense.society_id = link.society_id AND expense.id = link.expense_id
      WHERE link.society_id = p_society_id
        AND link.election_id = p_election_id AND expense.status = 'posted'
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

CREATE FUNCTION public.poll_election_officer_get(
  p_society_id uuid, p_election_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE election public.poll_elections;
BEGIN
  SELECT * INTO election FROM public.poll_elections
  WHERE society_id = p_society_id AND id = p_election_id;
  IF NOT FOUND OR NOT private.poll_election_officer_read_access(
    election.society_id, p_election_id
  ) THEN RAISE EXCEPTION 'Returning officer access is not available.'
    USING ERRCODE = '42501'; END IF;
  RETURN public.poll_election_get(p_society_id, p_election_id);
END;
$$;

CREATE FUNCTION public.poll_election_officer_assignments()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'election_id', election.id, 'society_id', election.society_id,
    'title', election.title, 'stage', election.stage,
    'access_ends_at', officer.access_ends_at,
    'requires_confirmation', officer.conflict_confirmed_at IS NULL
  ) ORDER BY election.updated_at DESC), '[]'::jsonb)
  FROM public.poll_election_officers AS officer
  JOIN public.poll_elections AS election
    ON election.society_id = officer.society_id
    AND election.id = officer.election_id
  WHERE officer.revoked_at IS NULL
    AND (
      (
        officer.profile_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = officer.society_id
            AND membership.user_id = auth.uid()
            AND membership.status = 'active'
        )
      )
      OR (
        officer.profile_id IS NULL
        AND lower(officer.invited_email) = lower(auth.jwt() ->> 'email')
        AND (officer.access_ends_at IS NULL
          OR officer.access_ends_at > clock_timestamp())
      )
    )
$$;
REVOKE ALL ON FUNCTION public.poll_election_officer_assignments()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.poll_election_officer_assignments()
  TO authenticated;

CREATE FUNCTION public.poll_election_reconcile_due(p_society_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE election public.poll_elections; changed integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Election reconciliation is restricted.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'poll')
    OR NOT private.poll_election_official_enabled(p_society_id)
    OR NOT private.society_writable(p_society_id)
  THEN RETURN 0; END IF;
  FOR election IN
    SELECT * FROM public.poll_elections
    WHERE society_id = p_society_id
      AND stage = 'voting' AND voting_closes_at <= clock_timestamp()
    ORDER BY voting_closes_at, id LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.poll_elections SET
      stage = 'counted', counted_at = clock_timestamp(),
      revision = revision + 1, updated_by = auth.uid()
    WHERE id = election.id;
    changed := changed + 1;
  END LOOP;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_signin_access(p_email text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE normalized_email text;
BEGIN
  IF p_email IS NULL OR char_length(btrim(p_email)) NOT BETWEEN 3 AND 254 THEN
    RAISE EXCEPTION 'Invalid sign-in email.' USING ERRCODE = '22023';
  END IF;
  normalized_email := lower(btrim(p_email));
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE status = 'invited' AND user_id IS NULL
      AND lower(invited_email::text) = normalized_email
  ) OR EXISTS (
    SELECT 1 FROM public.memberships AS membership
    JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE membership.status IN ('active', 'pending_approval')
      AND profile.status = 'active'
      AND lower(profile.email::text) = normalized_email
  ) OR EXISTS (
    SELECT 1 FROM public.poll_election_officers AS officer
    WHERE officer.profile_id IS NULL AND officer.revoked_at IS NULL
      AND lower(officer.invited_email) = normalized_email
      AND (officer.access_ends_at IS NULL
        OR officer.access_ends_at > clock_timestamp())
  );
END;
$$;
REVOKE ALL ON FUNCTION public.has_signin_access(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_signin_access(text) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poll-dispute-files', 'poll-dispute-files', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
);

CREATE FUNCTION private.poll_election_dispute_file_scope(p_path text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_path IS NULL OR p_path !~
    '^[0-9a-f-]{36}/elections/[0-9a-f-]{36}/disputes/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|pdf)$'
  THEN RETURN NULL; END IF;
  RETURN split_part(p_path, '/', 1)::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_dispute_file_scope(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.poll_election_dispute_file_scope(text)
  TO authenticated, service_role;

CREATE FUNCTION private.poll_election_dispute_file_readable(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.module_enabled(private.poll_election_dispute_file_scope(p_path), 'poll')
    AND (
      EXISTS (
        SELECT 1 FROM public.poll_election_disputes AS dispute
        WHERE dispute.society_id = private.poll_election_dispute_file_scope(p_path)
          AND dispute.file_path = p_path
          AND (
            dispute.raised_by = auth.uid()
            OR private.has_role(
              dispute.society_id, ARRAY['admin']::text[]
            )
            OR private.poll_election_officer_access(
              dispute.society_id, dispute.election_id
            )
          )
      )
      OR (
        split_part(p_path, '/', 5) = auth.uid()::text
        AND NOT EXISTS (
          SELECT 1 FROM public.poll_election_disputes
          WHERE file_path = p_path
        )
      )
    )
$$;
REVOKE ALL ON FUNCTION private.poll_election_dispute_file_readable(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.poll_election_dispute_file_readable(text)
  TO authenticated, service_role;

CREATE POLICY poll_dispute_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'poll-dispute-files'
    AND private.poll_election_dispute_file_readable(name)
  );
CREATE POLICY poll_dispute_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'poll-dispute-files'
    AND private.poll_election_dispute_file_scope(name) IS NOT NULL
    AND split_part(name, '/', 5) = auth.uid()::text
    AND private.module_enabled(
      private.poll_election_dispute_file_scope(name), 'poll'
    )
    AND EXISTS (
      SELECT 1 FROM public.poll_election_voters AS voter
      WHERE voter.society_id = private.poll_election_dispute_file_scope(name)
        AND voter.election_id::text = split_part(name, '/', 3)
        AND voter.user_id = auth.uid() AND voter.removed_at IS NULL
    )
  );

CREATE FUNCTION private.poll_election_verify_dispute_file(
  p_society_id uuid, p_election_id uuid, p_path text
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE metadata jsonb; mime text;
BEGIN
  IF p_path IS NULL THEN RETURN; END IF;
  IF private.poll_election_dispute_file_scope(p_path) IS DISTINCT FROM p_society_id
    OR split_part(p_path, '/', 3) <> p_election_id::text
    OR split_part(p_path, '/', 5) <> auth.uid()::text
  THEN RAISE EXCEPTION 'The dispute file is not available.' USING ERRCODE = '42501'; END IF;
  SELECT object.metadata INTO metadata FROM storage.objects AS object
  WHERE bucket_id = 'poll-dispute-files' AND name = p_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute file not found.' USING ERRCODE = 'P0002'; END IF;
  mime := metadata ->> 'mimetype';
  IF COALESCE(metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
    OR (metadata ->> 'size')::numeric NOT BETWEEN 1 AND 5242880
    OR NOT (
      (mime = 'image/jpeg' AND right(p_path, 4) = '.jpg')
      OR (mime = 'image/png' AND right(p_path, 4) = '.png')
      OR (mime = 'application/pdf' AND right(p_path, 4) = '.pdf')
    )
  THEN RAISE EXCEPTION 'Invalid dispute file.' USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.poll_election_verify_dispute_file(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.poll_official_voting_set(uuid, boolean, text, text, uuid, text),
  public.poll_election_settings_update(uuid, integer, boolean, text, timestamptz, text),
  public.poll_election_external_save(uuid, text, date, jsonb, uuid, text),
  public.poll_election_save(
    uuid, uuid, text, timestamptz, timestamptz, timestamptz, timestamptz,
    jsonb, integer, uuid, text
  ),
  public.poll_election_stage_advance(uuid, uuid, integer, text),
  public.poll_election_cancel(uuid, uuid, text, integer, text),
  public.poll_election_activities_save(uuid, uuid, jsonb, uuid, text),
  public.poll_election_link_source(uuid, uuid, text, uuid, uuid, text),
  public.poll_election_link_remove(uuid, uuid, text),
  public.poll_election_officer_assign(uuid, uuid, uuid, text, uuid, text),
  public.poll_election_officer_revoke(uuid, uuid, text, text),
  public.poll_election_officer_confirm(uuid, uuid, text, text),
  public.poll_election_helpers_save(uuid, uuid, jsonb, text),
  public.poll_election_voters_init(uuid, uuid, text),
  public.poll_election_voter_set(uuid, uuid, uuid, uuid, integer, text),
  public.poll_election_voter_remove(uuid, uuid, uuid, text, text),
  public.poll_election_voter_restore(uuid, uuid, uuid, text),
  public.poll_election_nomination_submit(uuid, uuid, uuid[], uuid, text),
  public.poll_election_nomination_withdraw(uuid, uuid, text),
  public.poll_election_supporters_add(uuid, uuid, uuid, uuid, text),
  public.poll_election_supporter_respond(uuid, uuid, boolean),
  public.poll_election_nomination_decide(uuid, uuid, boolean, text, text),
  public.poll_election_ballot_submit(uuid, uuid, uuid, jsonb),
  public.poll_election_count(uuid, uuid, text),
  public.poll_election_voting_extend(uuid, uuid, timestamptz, text, text),
  public.poll_election_tie_resolve(uuid, uuid, uuid, uuid, text, text, text),
  public.poll_election_post_choose(uuid, uuid, uuid, uuid, text),
  public.poll_election_post_decide(uuid, uuid, uuid, uuid, text, text),
  public.poll_election_declare(uuid, uuid, text),
  public.poll_election_external_result(uuid, uuid, uuid, text, integer, uuid, uuid, text),
  public.poll_election_dispute_raise(uuid, uuid, text, text, uuid, text),
  public.poll_election_dispute_update(uuid, uuid, text, text, text),
  public.poll_election_expense_link(uuid, uuid, uuid, text),
  public.poll_election_expense_unlink(uuid, uuid, text),
  public.poll_election_list(uuid),
  public.poll_election_get(uuid, uuid),
  public.poll_election_officer_get(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.poll_election_list(uuid),
  public.poll_election_get(uuid, uuid),
  public.poll_election_officer_get(uuid, uuid),
  public.poll_election_officer_confirm(uuid, uuid, text, text),
  public.poll_election_nomination_submit(uuid, uuid, uuid[], uuid, text),
  public.poll_election_nomination_withdraw(uuid, uuid, text),
  public.poll_election_supporters_add(uuid, uuid, uuid, uuid, text),
  public.poll_election_supporter_respond(uuid, uuid, boolean),
  public.poll_election_ballot_submit(uuid, uuid, uuid, jsonb),
  public.poll_election_post_choose(uuid, uuid, uuid, uuid, text),
  public.poll_election_count(uuid, uuid, text),
  public.poll_election_voting_extend(uuid, uuid, timestamptz, text, text),
  public.poll_election_tie_resolve(uuid, uuid, uuid, uuid, text, text, text),
  public.poll_election_post_decide(uuid, uuid, uuid, uuid, text, text),
  public.poll_election_declare(uuid, uuid, text),
  public.poll_election_dispute_raise(uuid, uuid, text, text, uuid, text),
  public.poll_election_dispute_update(uuid, uuid, text, text, text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.poll_official_voting_set(uuid, boolean, text, text, uuid, text),
  public.poll_election_external_save(uuid, text, date, jsonb, uuid, text),
  public.poll_election_settings_update(uuid, integer, boolean, text, timestamptz, text),
  public.poll_election_save(
    uuid, uuid, text, timestamptz, timestamptz, timestamptz, timestamptz,
    jsonb, integer, uuid, text
  ),
  public.poll_election_stage_advance(uuid, uuid, integer, text),
  public.poll_election_cancel(uuid, uuid, text, integer, text),
  public.poll_election_activities_save(uuid, uuid, jsonb, uuid, text),
  public.poll_election_link_source(uuid, uuid, text, uuid, uuid, text),
  public.poll_election_link_remove(uuid, uuid, text),
  public.poll_election_officer_assign(uuid, uuid, uuid, text, uuid, text),
  public.poll_election_officer_revoke(uuid, uuid, text, text),
  public.poll_election_helpers_save(uuid, uuid, jsonb, text),
  public.poll_election_voters_init(uuid, uuid, text),
  public.poll_election_voter_set(uuid, uuid, uuid, uuid, integer, text),
  public.poll_election_voter_remove(uuid, uuid, uuid, text, text),
  public.poll_election_voter_restore(uuid, uuid, uuid, text),
  public.poll_election_nomination_decide(uuid, uuid, boolean, text, text),
  public.poll_election_external_result(uuid, uuid, uuid, text, integer, uuid, uuid, text),
  public.poll_election_expense_link(uuid, uuid, uuid, text),
  public.poll_election_expense_unlink(uuid, uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.poll_election_reconcile_due(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.poll_election_reconcile_due(uuid) TO service_role;
