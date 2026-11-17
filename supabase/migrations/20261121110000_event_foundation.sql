-- Events & RSVPs (D-63): tenant-scoped schema, integrity guards, shared helpers and final RPC contracts.
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT '',
  description text,
  venue text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  rsvp_deadline timestamptz,
  capacity integer,
  max_per_unit integer,
  contribution_type text NOT NULL DEFAULT 'none',
  contribution_paise bigint NOT NULL DEFAULT 0,
  audience_scope text NOT NULL DEFAULT 'all',
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancellation_reason text,
  reminder_sent_at timestamptz,
  CONSTRAINT events_status_check CHECK (status IN ('draft', 'published', 'cancelled')),
  CONSTRAINT events_title_check CHECK (
    title = btrim(title) AND char_length(title) <= 150
    AND (status = 'draft' OR char_length(title) >= 1)
  ),
  CONSTRAINT events_description_check CHECK (
    description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 4000)
  ),
  CONSTRAINT events_venue_check CHECK (
    venue IS NULL OR (venue = btrim(venue) AND char_length(venue) BETWEEN 1 AND 200)
  ),
  -- Drafts may hold incomplete or inconsistent times; publish readiness enforces them.
  CONSTRAINT events_time_check CHECK (
    status = 'draft' OR (ends_at > starts_at AND ends_at <= starts_at + interval '14 days'
      AND (rsvp_deadline IS NULL OR rsvp_deadline <= starts_at))
  ),
  CONSTRAINT events_capacity_check CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 100000),
  CONSTRAINT events_max_per_unit_check CHECK (max_per_unit IS NULL OR max_per_unit BETWEEN 1 AND 100),
  CONSTRAINT events_contribution_check CHECK (
    (contribution_type = 'none' AND contribution_paise = 0)
    OR (contribution_type IN ('per_unit', 'per_head') AND contribution_paise BETWEEN 1 AND 10000000)
  ),
  CONSTRAINT events_audience_scope_check CHECK (audience_scope IN ('all', 'blocks')),
  CONSTRAINT events_version_check CHECK (version >= 1),
  CONSTRAINT events_state_check CHECK (
    (status = 'draft' AND published_at IS NULL AND published_by IS NULL
      AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL
      AND reminder_sent_at IS NULL)
    OR (status = 'published' AND venue IS NOT NULL AND published_at IS NOT NULL AND published_by IS NOT NULL
      AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
    OR (status = 'cancelled' AND venue IS NOT NULL AND published_at IS NOT NULL AND published_by IS NOT NULL
      AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
      AND cancellation_reason = btrim(cancellation_reason)
      AND char_length(cancellation_reason) BETWEEN 1 AND 500)
  ),
  CONSTRAINT events_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT events_client_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX events_society_status_starts_idx ON public.events (society_id, status, starts_at);
CREATE INDEX events_society_starts_idx ON public.events (society_id, starts_at DESC);
CREATE INDEX events_created_by_idx ON public.events (created_by);
CREATE INDEX events_updated_by_idx ON public.events (updated_by);
CREATE INDEX events_published_by_idx ON public.events (published_by);
CREATE INDEX events_cancelled_by_idx ON public.events (cancelled_by);

CREATE TABLE public.event_audience_blocks (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  block_id uuid NOT NULL,
  CONSTRAINT event_audience_blocks_pkey PRIMARY KEY (society_id, event_id, block_id),
  CONSTRAINT event_audience_blocks_event_same_society_fkey
    FOREIGN KEY (society_id, event_id) REFERENCES public.events (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_audience_blocks_block_same_society_fkey
    FOREIGN KEY (society_id, block_id) REFERENCES public.blocks (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX event_audience_blocks_block_idx ON public.event_audience_blocks (society_id, block_id);

CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  status text NOT NULL,
  headcount integer NOT NULL,
  responded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  responded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT event_rsvps_status_check CHECK (status IN ('going', 'not_going')),
  CONSTRAINT event_rsvps_headcount_check CHECK (
    (status = 'going' AND headcount BETWEEN 1 AND 100) OR (status = 'not_going' AND headcount = 0)
  ),
  CONSTRAINT event_rsvps_version_check CHECK (version >= 1),
  CONSTRAINT event_rsvps_event_same_society_fkey
    FOREIGN KEY (society_id, event_id) REFERENCES public.events (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_rsvps_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_rsvps_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT event_rsvps_unit_key UNIQUE (society_id, event_id, unit_id),
  CONSTRAINT event_rsvps_charge_target_key UNIQUE (society_id, event_id, unit_id, id)
);
CREATE INDEX event_rsvps_unit_idx ON public.event_rsvps (society_id, unit_id);
CREATE INDEX event_rsvps_event_status_idx ON public.event_rsvps (society_id, event_id, status);
CREATE INDEX event_rsvps_responded_by_idx ON public.event_rsvps (responded_by);

-- Every ledger entry an RSVP caused; net charge = sum(debits) - sum(credits).
CREATE TABLE public.event_rsvp_charges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  rsvp_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  ledger_entry_id bigint NOT NULL,
  direction text NOT NULL,
  amount_paise bigint NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT event_rsvp_charges_direction_check CHECK (direction IN ('debit', 'credit')),
  CONSTRAINT event_rsvp_charges_amount_check CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  CONSTRAINT event_rsvp_charges_reason_check CHECK (
    reason IN ('rsvp', 'headcount_change', 'withdrawn', 'event_cancelled')
  ),
  CONSTRAINT event_rsvp_charges_ledger_entry_key UNIQUE (ledger_entry_id),
  CONSTRAINT event_rsvp_charges_rsvp_fkey
    FOREIGN KEY (society_id, event_id, unit_id, rsvp_id)
    REFERENCES public.event_rsvps (society_id, event_id, unit_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_rsvp_charges_ledger_fkey
    FOREIGN KEY (society_id, unit_id, ledger_entry_id)
    REFERENCES public.billing_ledger_entries (society_id, unit_id, id) ON DELETE RESTRICT
);
CREATE INDEX event_rsvp_charges_rsvp_idx ON public.event_rsvp_charges (society_id, event_id, unit_id, rsvp_id);
CREATE INDEX event_rsvp_charges_rsvp_id_idx ON public.event_rsvp_charges (society_id, rsvp_id);
CREATE INDEX event_rsvp_charges_ledger_idx ON public.event_rsvp_charges (society_id, unit_id, ledger_entry_id);
CREATE INDEX event_rsvp_charges_created_by_idx ON public.event_rsvp_charges (created_by);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_audience_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvp_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.events, public.event_audience_blocks, public.event_rsvps, public.event_rsvp_charges
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY events_no_direct_access ON public.events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY event_audience_blocks_no_direct_access ON public.event_audience_blocks
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY event_rsvps_no_direct_access ON public.event_rsvps
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY event_rsvp_charges_no_direct_access ON public.event_rsvp_charges
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Integrity guards: identity is fixed, contributions lock at publish, cancelled events are frozen,
-- and only drafts (which never have RSVPs) can be deleted.
CREATE FUNCTION private.event_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft events can be deleted.' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.society_id IS DISTINCT FROM OLD.society_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR OLD.status = 'cancelled'
    OR (OLD.status <> 'draft' AND (NEW.contribution_type IS DISTINCT FROM OLD.contribution_type
      OR NEW.contribution_paise IS DISTINCT FROM OLD.contribution_paise
      OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR NEW.status = 'draft'))
  THEN
    RAISE EXCEPTION 'This event record is frozen.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.event_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER events_guard BEFORE UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION private.event_guard();

-- Audience choice is editable while the event is draft or published.
CREATE FUNCTION private.event_audience_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audience rows cannot be changed; replace them instead.' USING ERRCODE = '55000';
  END IF;
  SELECT status INTO v_status FROM public.events
  WHERE society_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.society_id ELSE NEW.society_id END
    AND id = CASE WHEN TG_OP = 'DELETE' THEN OLD.event_id ELSE NEW.event_id END;
  IF v_status IS NULL OR v_status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'This event audience is frozen.' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.event_audience_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER event_audience_blocks_guard BEFORE INSERT OR UPDATE OR DELETE ON public.event_audience_blocks
  FOR EACH ROW EXECUTE FUNCTION private.event_audience_guard();

-- RSVPs back ledger entries: never deleted and their identity never moves.
CREATE FUNCTION private.event_rsvp_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Event RSVPs cannot be deleted.' USING ERRCODE = '55000';
  END IF;
  IF NEW.society_id IS DISTINCT FROM OLD.society_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Event RSVP identity cannot change.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.event_rsvp_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER event_rsvps_guard BEFORE UPDATE OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION private.event_rsvp_guard();

CREATE TRIGGER event_rsvp_charges_append_only BEFORE UPDATE OR DELETE ON public.event_rsvp_charges
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.event_reject_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Event records cannot be truncated.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.event_reject_truncate() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON public.events
  FOR EACH STATEMENT EXECUTE FUNCTION private.event_reject_truncate();
CREATE TRIGGER event_audience_blocks_no_truncate BEFORE TRUNCATE ON public.event_audience_blocks
  FOR EACH STATEMENT EXECUTE FUNCTION private.event_reject_truncate();
CREATE TRIGGER event_rsvps_no_truncate BEFORE TRUNCATE ON public.event_rsvps
  FOR EACH STATEMENT EXECUTE FUNCTION private.event_reject_truncate();
CREATE TRIGGER event_rsvp_charges_no_truncate BEFORE TRUNCATE ON public.event_rsvp_charges
  FOR EACH STATEMENT EXECUTE FUNCTION private.event_reject_truncate();

-- Shared helpers. Authorisation always runs before any argument is inspected.
CREATE FUNCTION private.event_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_society_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'event')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Event access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.event_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.event_write_begin(p_society_id uuid, p_roles text[], p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.event_authorize(p_society_id, p_roles, true);
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request id is invalid.' USING ERRCODE = '22023';
  END IF;
  SET LOCAL lock_timeout = '5s';
END;
$$;
REVOKE ALL ON FUNCTION private.event_write_begin(uuid, text[], text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.event_audit(
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
      WHEN p_entity_type = 'event_rsvp' THEN 'resident'
      WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
      WHEN private.has_role(p_society_id, ARRAY['committee']::text[]) THEN 'committee'
      ELSE 'resident' END,
    'event.' || p_action, p_entity_type, p_entity_id::text, p_after, left(p_reason, 500), p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.event_audit(uuid, text, text, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Public signatures and ACLs are fixed here; the next migration fills in the bodies.
CREATE FUNCTION public.event_create(
  p_society_id uuid, p_client_request_id uuid, p_event jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], true);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_update(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_event jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], true);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_draft_delete(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], true);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_publish(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], true);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_cancel(
  p_society_id uuid, p_event_id uuid, p_expected_version integer, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], true);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_rsvp_set(
  p_society_id uuid, p_event_id uuid, p_unit_id uuid, p_status text, p_headcount integer,
  p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['resident']::text[], true);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_admin_list(
  p_society_id uuid, p_filter text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_admin_get(p_society_id uuid, p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_block_options(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_member_list(p_society_id uuid, p_filter text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['resident']::text[], false);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_member_get(p_society_id uuid, p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.event_authorize(p_society_id, ARRAY['resident']::text[], false);
  RAISE EXCEPTION 'event_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.event_reminders_run(p_society_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Event maintenance is restricted.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('events', 0, 'notified', 0);
END;
$$;

REVOKE ALL ON FUNCTION
  public.event_create(uuid, uuid, jsonb, text),
  public.event_update(uuid, uuid, integer, jsonb, text),
  public.event_draft_delete(uuid, uuid, integer, text),
  public.event_publish(uuid, uuid, integer, text),
  public.event_cancel(uuid, uuid, integer, text, text),
  public.event_rsvp_set(uuid, uuid, uuid, text, integer, integer, text),
  public.event_admin_list(uuid, text, integer, integer),
  public.event_admin_get(uuid, uuid),
  public.event_block_options(uuid),
  public.event_member_list(uuid, text),
  public.event_member_get(uuid, uuid),
  public.event_reminders_run(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.event_create(uuid, uuid, jsonb, text),
  public.event_update(uuid, uuid, integer, jsonb, text),
  public.event_draft_delete(uuid, uuid, integer, text),
  public.event_publish(uuid, uuid, integer, text),
  public.event_cancel(uuid, uuid, integer, text, text),
  public.event_rsvp_set(uuid, uuid, uuid, text, integer, integer, text),
  public.event_admin_list(uuid, text, integer, integer),
  public.event_admin_get(uuid, uuid),
  public.event_block_options(uuid),
  public.event_member_list(uuid, text),
  public.event_member_get(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_reminders_run(uuid, text) TO service_role;
