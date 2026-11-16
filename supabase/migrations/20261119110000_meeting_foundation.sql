-- Meetings & AGM (D-61): tenant-scoped schema, integrity guards, shared helpers and final RPC contracts.
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT '',
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  online_url text,
  invitee_scope text NOT NULL DEFAULT 'default',
  notice_required_days integer,
  notice_given_days integer,
  quorum_percent integer,
  checkin_open boolean NOT NULL DEFAULT false,
  checkin_opened_at timestamptz,
  checkin_closed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  client_request_id text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  scheduled_at timestamptz,
  rescheduled_at timestamptz,
  held_at timestamptz,
  held_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancellation_reason text,
  CONSTRAINT meetings_type_check CHECK (meeting_type IN ('agm', 'sgm', 'committee')),
  CONSTRAINT meetings_status_check CHECK (status IN ('draft', 'scheduled', 'held', 'cancelled')),
  CONSTRAINT meetings_title_check CHECK (
    title = btrim(title) AND char_length(title) <= 150
    AND (status = 'draft' OR char_length(title) >= 1)
  ),
  CONSTRAINT meetings_description_check CHECK (
    description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 4000)
  ),
  CONSTRAINT meetings_venue_check CHECK (
    venue IS NULL OR (venue = btrim(venue) AND char_length(venue) BETWEEN 1 AND 200)
  ),
  CONSTRAINT meetings_online_url_check CHECK (
    online_url IS NULL OR (char_length(online_url) <= 500 AND online_url ~ '^https://[^[:space:]]+$')
  ),
  CONSTRAINT meetings_time_check CHECK (
    status = 'draft' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at
      AND ends_at <= starts_at + interval '24 hours')
  ),
  CONSTRAINT meetings_invitee_scope_check CHECK (invitee_scope IN ('default', 'custom')),
  CONSTRAINT meetings_notice_check CHECK (
    (notice_required_days IS NULL OR notice_required_days BETWEEN 0 AND 90)
    AND (notice_given_days IS NULL OR notice_given_days >= 0)
  ),
  CONSTRAINT meetings_quorum_percent_check CHECK (quorum_percent IS NULL OR quorum_percent BETWEEN 1 AND 100),
  CONSTRAINT meetings_checkin_check CHECK (
    (NOT checkin_open OR (checkin_opened_at IS NOT NULL AND status = 'scheduled'))
    AND (meeting_type <> 'committee' OR (NOT checkin_open AND checkin_opened_at IS NULL))
  ),
  CONSTRAINT meetings_version_check CHECK (version >= 1),
  CONSTRAINT meetings_client_request_id_check CHECK (char_length(btrim(client_request_id)) BETWEEN 1 AND 120),
  CONSTRAINT meetings_state_check CHECK (
    (status = 'draft' AND scheduled_at IS NULL AND rescheduled_at IS NULL
      AND held_at IS NULL AND held_by IS NULL
      AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL
      AND notice_required_days IS NULL AND notice_given_days IS NULL AND quorum_percent IS NULL
      AND NOT checkin_open AND checkin_opened_at IS NULL AND checkin_closed_at IS NULL)
    OR (status IN ('scheduled', 'held', 'cancelled') AND scheduled_at IS NOT NULL
      AND (venue IS NOT NULL OR online_url IS NOT NULL)
      AND notice_required_days IS NOT NULL AND notice_given_days IS NOT NULL
      AND quorum_percent IS NOT NULL
      AND (
        (status = 'scheduled' AND held_at IS NULL AND held_by IS NULL
          AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
        OR (status = 'held' AND held_at IS NOT NULL AND held_by IS NOT NULL AND NOT checkin_open
          AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
          AND char_length(btrim(cancellation_reason)) BETWEEN 1 AND 500
          AND NOT checkin_open AND held_at IS NULL AND held_by IS NULL)
      ))
  ),
  CONSTRAINT meetings_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT meetings_client_request_key UNIQUE (society_id, client_request_id)
);
CREATE INDEX meetings_society_status_starts_idx ON public.meetings (society_id, status, starts_at DESC);
CREATE INDEX meetings_society_starts_idx ON public.meetings (society_id, starts_at DESC);
CREATE INDEX meetings_created_by_idx ON public.meetings (created_by);
CREATE INDEX meetings_updated_by_idx ON public.meetings (updated_by);
CREATE INDEX meetings_held_by_idx ON public.meetings (held_by);
CREATE INDEX meetings_cancelled_by_idx ON public.meetings (cancelled_by);

CREATE TABLE public.meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  position integer NOT NULL,
  title text NOT NULL,
  description text,
  CONSTRAINT meeting_agenda_items_position_check CHECK (position BETWEEN 1 AND 50),
  CONSTRAINT meeting_agenda_items_title_check CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 1 AND 200
  ),
  CONSTRAINT meeting_agenda_items_description_check CHECK (
    description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 2000)
  ),
  CONSTRAINT meeting_agenda_items_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_agenda_items_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT meeting_agenda_items_meeting_id_key UNIQUE (society_id, meeting_id, id)
);
CREATE INDEX meeting_agenda_items_meeting_position_idx
  ON public.meeting_agenda_items (society_id, meeting_id, position);

-- Custom invitee choice kept while draft/scheduled; exactly one of unit or committee membership per row.
CREATE TABLE public.meeting_invitee_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  unit_id uuid,
  membership_id uuid,
  CONSTRAINT meeting_invitee_selections_target_check CHECK ((unit_id IS NULL) <> (membership_id IS NULL)),
  CONSTRAINT meeting_invitee_selections_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_invitee_selections_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_invitee_selections_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_invitee_selections_unit_key UNIQUE (society_id, meeting_id, unit_id),
  CONSTRAINT meeting_invitee_selections_member_key UNIQUE (society_id, meeting_id, membership_id)
);
CREATE INDEX meeting_invitee_selections_unit_idx ON public.meeting_invitee_selections (society_id, unit_id);
CREATE INDEX meeting_invitee_selections_membership_idx
  ON public.meeting_invitee_selections (society_id, membership_id);

CREATE TABLE public.meeting_invited_units (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  unit_label text NOT NULL,
  CONSTRAINT meeting_invited_units_pkey PRIMARY KEY (society_id, meeting_id, unit_id),
  CONSTRAINT meeting_invited_units_label_check CHECK (char_length(btrim(unit_label)) BETWEEN 1 AND 100),
  CONSTRAINT meeting_invited_units_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_invited_units_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX meeting_invited_units_unit_idx ON public.meeting_invited_units (society_id, unit_id);

CREATE TABLE public.meeting_invited_members (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  member_name text NOT NULL,
  CONSTRAINT meeting_invited_members_pkey PRIMARY KEY (society_id, meeting_id, membership_id),
  CONSTRAINT meeting_invited_members_name_check CHECK (char_length(btrim(member_name)) BETWEEN 1 AND 120),
  CONSTRAINT meeting_invited_members_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_invited_members_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX meeting_invited_members_membership_idx
  ON public.meeting_invited_members (society_id, membership_id);

CREATE TABLE public.meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  unit_id uuid,
  membership_id uuid,
  mode text NOT NULL,
  proxy_name text,
  checked_in_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  recorded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meeting_attendance_target_check CHECK ((unit_id IS NULL) <> (membership_id IS NULL)),
  CONSTRAINT meeting_attendance_mode_check CHECK (mode IN ('in_person', 'online', 'proxy', 'self')),
  CONSTRAINT meeting_attendance_proxy_check CHECK (
    (mode = 'proxy') = (proxy_name IS NOT NULL)
    AND (proxy_name IS NULL OR (proxy_name = btrim(proxy_name) AND char_length(proxy_name) BETWEEN 1 AND 120))
  ),
  CONSTRAINT meeting_attendance_self_check CHECK (
    (mode = 'self') = (checked_in_by IS NOT NULL) AND (mode <> 'self' OR unit_id IS NOT NULL)
  ),
  CONSTRAINT meeting_attendance_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_attendance_invited_unit_fkey
    FOREIGN KEY (society_id, meeting_id, unit_id)
    REFERENCES public.meeting_invited_units (society_id, meeting_id, unit_id) ON DELETE RESTRICT,
  CONSTRAINT meeting_attendance_invited_member_fkey
    FOREIGN KEY (society_id, meeting_id, membership_id)
    REFERENCES public.meeting_invited_members (society_id, meeting_id, membership_id) ON DELETE RESTRICT,
  CONSTRAINT meeting_attendance_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT meeting_attendance_unit_key UNIQUE (society_id, meeting_id, unit_id),
  CONSTRAINT meeting_attendance_member_key UNIQUE (society_id, meeting_id, membership_id)
);
CREATE INDEX meeting_attendance_checked_in_by_idx ON public.meeting_attendance (checked_in_by);
CREATE INDEX meeting_attendance_recorded_by_idx ON public.meeting_attendance (recorded_by);

CREATE TABLE public.meeting_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  agenda_item_id uuid,
  position integer NOT NULL,
  title text NOT NULL,
  body text,
  outcome text NOT NULL DEFAULT 'pending',
  votes_for integer,
  votes_against integer,
  votes_abstain integer,
  poll_vote_id uuid,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meeting_resolutions_position_check CHECK (position >= 1),
  CONSTRAINT meeting_resolutions_title_check CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 1 AND 200
  ),
  CONSTRAINT meeting_resolutions_body_check CHECK (
    body IS NULL OR (body = btrim(body) AND char_length(body) BETWEEN 1 AND 5000)
  ),
  CONSTRAINT meeting_resolutions_outcome_check CHECK (outcome IN ('pending', 'passed', 'failed', 'deferred')),
  CONSTRAINT meeting_resolutions_votes_check CHECK (
    (votes_for IS NULL OR votes_for >= 0) AND (votes_against IS NULL OR votes_against >= 0)
    AND (votes_abstain IS NULL OR votes_abstain >= 0)
  ),
  CONSTRAINT meeting_resolutions_version_check CHECK (version >= 1),
  CONSTRAINT meeting_resolutions_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_resolutions_agenda_item_fkey
    FOREIGN KEY (society_id, meeting_id, agenda_item_id)
    REFERENCES public.meeting_agenda_items (society_id, meeting_id, id) ON DELETE SET NULL (agenda_item_id),
  CONSTRAINT meeting_resolutions_poll_vote_fkey
    FOREIGN KEY (society_id, poll_vote_id)
    REFERENCES public.poll_votes (society_id, id) ON DELETE SET NULL (poll_vote_id),
  CONSTRAINT meeting_resolutions_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT meeting_resolutions_meeting_id_key UNIQUE (society_id, meeting_id, id)
);
CREATE INDEX meeting_resolutions_agenda_item_idx
  ON public.meeting_resolutions (society_id, meeting_id, agenda_item_id);
CREATE INDEX meeting_resolutions_poll_vote_idx ON public.meeting_resolutions (society_id, poll_vote_id);
CREATE INDEX meeting_resolutions_created_by_idx ON public.meeting_resolutions (created_by);
CREATE INDEX meeting_resolutions_updated_by_idx ON public.meeting_resolutions (updated_by);

CREATE TABLE public.meeting_minutes (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  drafted_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  published_at timestamptz,
  document_id uuid,
  CONSTRAINT meeting_minutes_pkey PRIMARY KEY (society_id, meeting_id),
  CONSTRAINT meeting_minutes_body_check CHECK (
    char_length(btrim(body)) >= 1 AND char_length(body) <= 50000
  ),
  CONSTRAINT meeting_minutes_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT meeting_minutes_version_check CHECK (version >= 1),
  CONSTRAINT meeting_minutes_publish_check CHECK (
    (status = 'draft' AND published_by IS NULL AND published_at IS NULL AND document_id IS NULL)
    OR (status = 'published' AND published_by IS NOT NULL AND published_at IS NOT NULL)
  ),
  CONSTRAINT meeting_minutes_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_minutes_document_same_society_fkey
    FOREIGN KEY (society_id, document_id) REFERENCES public.documents (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX meeting_minutes_document_idx ON public.meeting_minutes (society_id, document_id);
CREATE INDEX meeting_minutes_drafted_by_idx ON public.meeting_minutes (drafted_by);
CREATE INDEX meeting_minutes_updated_by_idx ON public.meeting_minutes (updated_by);
CREATE INDEX meeting_minutes_published_by_idx ON public.meeting_minutes (published_by);

CREATE TABLE public.meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  resolution_id uuid,
  title text NOT NULL,
  owner_membership_id uuid NOT NULL,
  owner_name text NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  note text,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_overdue_notified_on date,
  CONSTRAINT meeting_action_items_title_check CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 1 AND 300
  ),
  CONSTRAINT meeting_action_items_owner_name_check CHECK (char_length(btrim(owner_name)) BETWEEN 1 AND 120),
  CONSTRAINT meeting_action_items_status_check CHECK (status IN ('open', 'done')),
  CONSTRAINT meeting_action_items_note_check CHECK (
    note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500)
  ),
  CONSTRAINT meeting_action_items_completion_check CHECK (
    (status = 'done') = (completed_at IS NOT NULL) AND (completed_at IS NULL) = (completed_by IS NULL)
  ),
  CONSTRAINT meeting_action_items_version_check CHECK (version >= 1),
  CONSTRAINT meeting_action_items_meeting_same_society_fkey
    FOREIGN KEY (society_id, meeting_id) REFERENCES public.meetings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_action_items_resolution_fkey
    FOREIGN KEY (society_id, meeting_id, resolution_id)
    REFERENCES public.meeting_resolutions (society_id, meeting_id, id) ON DELETE SET NULL (resolution_id),
  CONSTRAINT meeting_action_items_owner_same_society_fkey
    FOREIGN KEY (society_id, owner_membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_action_items_society_id_id_key UNIQUE (society_id, id)
);
CREATE INDEX meeting_action_items_resolution_idx
  ON public.meeting_action_items (society_id, meeting_id, resolution_id);
CREATE INDEX meeting_action_items_owner_idx
  ON public.meeting_action_items (society_id, owner_membership_id, status, due_on);
CREATE INDEX meeting_action_items_due_idx ON public.meeting_action_items (society_id, status, due_on);
CREATE INDEX meeting_action_items_completed_by_idx ON public.meeting_action_items (completed_by);
CREATE INDEX meeting_action_items_created_by_idx ON public.meeting_action_items (created_by);
CREATE INDEX meeting_action_items_updated_by_idx ON public.meeting_action_items (updated_by);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invitee_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invited_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invited_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meetings, public.meeting_agenda_items, public.meeting_invitee_selections,
  public.meeting_invited_units, public.meeting_invited_members, public.meeting_attendance,
  public.meeting_resolutions, public.meeting_minutes, public.meeting_action_items
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY meetings_no_direct_access ON public.meetings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_agenda_items_no_direct_access ON public.meeting_agenda_items
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_invitee_selections_no_direct_access ON public.meeting_invitee_selections
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_invited_units_no_direct_access ON public.meeting_invited_units
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_invited_members_no_direct_access ON public.meeting_invited_members
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_attendance_no_direct_access ON public.meeting_attendance
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_resolutions_no_direct_access ON public.meeting_resolutions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_minutes_no_direct_access ON public.meeting_minutes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_action_items_no_direct_access ON public.meeting_action_items
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Integrity guards: lifecycle-frozen data is protected even from privileged direct writes.
CREATE FUNCTION private.meeting_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft meetings can be deleted.' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.society_id IS DISTINCT FROM OLD.society_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (NEW.meeting_type IS DISTINCT FROM OLD.meeting_type AND OLD.status <> 'draft')
    OR OLD.status IN ('held', 'cancelled')
  THEN
    RAISE EXCEPTION 'This meeting record is frozen.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER meetings_guard BEFORE UPDATE OR DELETE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION private.meeting_guard();

-- Agenda and custom invitee choices are editable only while the meeting is draft or scheduled.
CREATE FUNCTION private.meeting_plan_child_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM public.meetings
  WHERE society_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.society_id ELSE NEW.society_id END
    AND id = CASE WHEN TG_OP = 'DELETE' THEN OLD.meeting_id ELSE NEW.meeting_id END;
  IF parent_status IS NULL OR parent_status NOT IN ('draft', 'scheduled')
    OR (TG_OP = 'UPDATE' AND (NEW.society_id <> OLD.society_id OR NEW.meeting_id <> OLD.meeting_id))
  THEN
    RAISE EXCEPTION 'This meeting plan is frozen.' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_plan_child_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER meeting_agenda_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION private.meeting_plan_child_guard();
CREATE TRIGGER meeting_invitee_selections_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_invitee_selections
  FOR EACH ROW EXECUTE FUNCTION private.meeting_plan_child_guard();

-- Materialised invitees change only while scheduled and freeze once held or cancelled.
CREATE FUNCTION private.meeting_invited_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  parent_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Invitee snapshots cannot be changed.' USING ERRCODE = '55000';
  END IF;
  SELECT status INTO parent_status FROM public.meetings
  WHERE society_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.society_id ELSE NEW.society_id END
    AND id = CASE WHEN TG_OP = 'DELETE' THEN OLD.meeting_id ELSE NEW.meeting_id END;
  IF parent_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Meeting invitees are frozen.' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_invited_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER meeting_invited_units_guard BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_invited_units
  FOR EACH ROW EXECUTE FUNCTION private.meeting_invited_guard();
CREATE TRIGGER meeting_invited_members_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_invited_members
  FOR EACH ROW EXECUTE FUNCTION private.meeting_invited_guard();

-- Published minutes are immutable; only the document copy link may be set, once.
CREATE FUNCTION private.meeting_minutes_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Meeting minutes cannot be deleted.' USING ERRCODE = '55000';
  END IF;
  IF NEW.society_id IS DISTINCT FROM OLD.society_id OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
    OR NEW.drafted_by IS DISTINCT FROM OLD.drafted_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Meeting minutes identity cannot change.' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'published' AND (
    NEW.body IS DISTINCT FROM OLD.body OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.version IS DISTINCT FROM OLD.version OR NEW.updated_by IS DISTINCT FROM OLD.updated_by
    OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
    OR NEW.published_by IS DISTINCT FROM OLD.published_by
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR (NEW.document_id IS DISTINCT FROM OLD.document_id AND OLD.document_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Published minutes are immutable.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_minutes_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER meeting_minutes_guard BEFORE UPDATE OR DELETE ON public.meeting_minutes
  FOR EACH ROW EXECUTE FUNCTION private.meeting_minutes_guard();

CREATE FUNCTION private.meeting_reject_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Meeting records cannot be truncated.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_reject_truncate() FROM PUBLIC, anon, authenticated, service_role;
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'meetings', 'meeting_agenda_items', 'meeting_invitee_selections', 'meeting_invited_units',
    'meeting_invited_members', 'meeting_attendance', 'meeting_resolutions', 'meeting_minutes',
    'meeting_action_items'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.meeting_reject_truncate()',
      table_name || '_no_truncate', table_name);
  END LOOP;
END;
$$;

-- Shared helpers. Authorisation always runs before any argument is inspected.
CREATE FUNCTION private.meeting_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_society_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'meeting')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Meeting access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_write_begin(p_society_id uuid, p_roles text[], p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.meeting_authorize(p_society_id, p_roles, true);
  IF p_request_id IS NOT NULL AND char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request id is invalid.' USING ERRCODE = '22023';
  END IF;
  SET LOCAL lock_timeout = '5s';
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_write_begin(uuid, text[], text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_audit(
  p_society_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_request_id text, p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN auth.uid() IS NULL THEN 'system'
      WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
      WHEN private.has_role(p_society_id, ARRAY['committee']::text[]) THEN 'committee'
      ELSE 'resident' END,
    'meeting.' || p_action, p_entity_type, p_entity_id::text, p_after, left(p_reason, 500), p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_audit(uuid, text, text, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Full settings object: stored keys over D-61 defaults.
CREATE FUNCTION private.meeting_settings(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'notice_days_agm', 14, 'notice_days_sgm', 7, 'notice_days_committee', 3,
    'quorum_percent_units', 33, 'quorum_percent_committee', 50,
    'action_owner_scope', 'any_member'
  ) || COALESCE((
    SELECT config.settings FROM public.module_configs AS config
    WHERE config.society_id = p_society_id AND config.module_key = 'meeting'
  ), '{}'::jsonb)
$$;
REVOKE ALL ON FUNCTION private.meeting_settings(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.meeting_today(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (clock_timestamp() AT TIME ZONE COALESCE((
    SELECT society.timezone FROM public.societies AS society WHERE society.id = p_society_id
  ), 'Asia/Kolkata'))::date
$$;
REVOKE ALL ON FUNCTION private.meeting_today(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Public signatures and ACLs are fixed here; later migrations fill in the bodies.
CREATE FUNCTION public.meeting_create(
  p_society_id uuid, p_client_request_id text, p_meeting jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_update(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_meeting jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_draft_delete(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_schedule(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_cancel(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_checkin_set(
  p_society_id uuid, p_meeting_id uuid, p_open boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_mark_held(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_attendance_set(
  p_society_id uuid, p_meeting_id uuid, p_attendee_id uuid, p_mode text, p_proxy_name text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_attendance_remove(
  p_society_id uuid, p_meeting_id uuid, p_attendee_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_resolution_save(
  p_society_id uuid, p_meeting_id uuid, p_resolution_id uuid, p_expected_version integer,
  p_resolution jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_resolution_delete(
  p_society_id uuid, p_resolution_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_resolution_outcome_set(
  p_society_id uuid, p_resolution_id uuid, p_expected_version integer, p_outcome text,
  p_votes_for integer, p_votes_against integer, p_votes_abstain integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_resolution_poll_link(
  p_society_id uuid, p_resolution_id uuid, p_expected_version integer, p_poll_vote_id uuid,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_minutes_publish(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_minutes_document_link(
  p_society_id uuid, p_meeting_id uuid, p_document_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_action_save(
  p_society_id uuid, p_meeting_id uuid, p_action_id uuid, p_expected_version integer,
  p_action jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_settings_update(p_society_id uuid, p_settings jsonb, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_minutes_save(
  p_society_id uuid, p_meeting_id uuid, p_expected_version integer, p_body text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_action_status_set(
  p_society_id uuid, p_action_id uuid, p_expected_version integer, p_status text, p_note text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_self_checkin(
  p_society_id uuid, p_meeting_id uuid, p_unit_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['resident']::text[], true);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_admin_list(
  p_society_id uuid, p_status text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_admin_get(p_society_id uuid, p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_invitee_options(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_owner_options(p_society_id uuid, p_search text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_member_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['resident']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_member_get(p_society_id uuid, p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['resident']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_my_actions(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_settings_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'meeting_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.meeting_action_reminders_run(p_society_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Meeting maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('notified', 0);
END;
$$;

REVOKE ALL ON FUNCTION
  public.meeting_create(uuid, text, jsonb, text),
  public.meeting_update(uuid, uuid, integer, jsonb, text),
  public.meeting_draft_delete(uuid, uuid, integer, text),
  public.meeting_schedule(uuid, uuid, integer, text),
  public.meeting_cancel(uuid, uuid, integer, text, text),
  public.meeting_checkin_set(uuid, uuid, boolean, text),
  public.meeting_mark_held(uuid, uuid, integer, text),
  public.meeting_attendance_set(uuid, uuid, uuid, text, text, text),
  public.meeting_attendance_remove(uuid, uuid, uuid, text),
  public.meeting_resolution_save(uuid, uuid, uuid, integer, jsonb, text),
  public.meeting_resolution_delete(uuid, uuid, integer, text),
  public.meeting_resolution_outcome_set(uuid, uuid, integer, text, integer, integer, integer, text),
  public.meeting_resolution_poll_link(uuid, uuid, integer, uuid, text),
  public.meeting_minutes_publish(uuid, uuid, integer, text),
  public.meeting_minutes_document_link(uuid, uuid, uuid, text),
  public.meeting_action_save(uuid, uuid, uuid, integer, jsonb, text),
  public.meeting_settings_update(uuid, jsonb, text),
  public.meeting_minutes_save(uuid, uuid, integer, text, text),
  public.meeting_action_status_set(uuid, uuid, integer, text, text, text),
  public.meeting_self_checkin(uuid, uuid, uuid, text),
  public.meeting_admin_list(uuid, text, integer, integer),
  public.meeting_admin_get(uuid, uuid),
  public.meeting_invitee_options(uuid),
  public.meeting_owner_options(uuid, text, integer),
  public.meeting_member_list(uuid),
  public.meeting_member_get(uuid, uuid),
  public.meeting_my_actions(uuid),
  public.meeting_settings_get(uuid),
  public.meeting_action_reminders_run(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.meeting_create(uuid, text, jsonb, text),
  public.meeting_update(uuid, uuid, integer, jsonb, text),
  public.meeting_draft_delete(uuid, uuid, integer, text),
  public.meeting_schedule(uuid, uuid, integer, text),
  public.meeting_cancel(uuid, uuid, integer, text, text),
  public.meeting_checkin_set(uuid, uuid, boolean, text),
  public.meeting_mark_held(uuid, uuid, integer, text),
  public.meeting_attendance_set(uuid, uuid, uuid, text, text, text),
  public.meeting_attendance_remove(uuid, uuid, uuid, text),
  public.meeting_resolution_save(uuid, uuid, uuid, integer, jsonb, text),
  public.meeting_resolution_delete(uuid, uuid, integer, text),
  public.meeting_resolution_outcome_set(uuid, uuid, integer, text, integer, integer, integer, text),
  public.meeting_resolution_poll_link(uuid, uuid, integer, uuid, text),
  public.meeting_minutes_publish(uuid, uuid, integer, text),
  public.meeting_minutes_document_link(uuid, uuid, uuid, text),
  public.meeting_action_save(uuid, uuid, uuid, integer, jsonb, text),
  public.meeting_settings_update(uuid, jsonb, text),
  public.meeting_minutes_save(uuid, uuid, integer, text, text),
  public.meeting_action_status_set(uuid, uuid, integer, text, text, text),
  public.meeting_self_checkin(uuid, uuid, uuid, text),
  public.meeting_admin_list(uuid, text, integer, integer),
  public.meeting_admin_get(uuid, uuid),
  public.meeting_invitee_options(uuid),
  public.meeting_owner_options(uuid, text, integer),
  public.meeting_member_list(uuid),
  public.meeting_member_get(uuid, uuid),
  public.meeting_my_actions(uuid),
  public.meeting_settings_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_action_reminders_run(uuid, text) TO service_role;
