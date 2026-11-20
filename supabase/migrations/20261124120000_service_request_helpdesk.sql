-- Helpdesk additions (P49, PRD D-70 / SRQ-10–SRQ-18 and SRQ-20): four priorities with
-- category × priority targets, On Hold, detailed feedback, intake source, escalation
-- responses, vendor linking and the performance report.

-- Priorities. Existing rows map urgent → high and normal → medium and keep their
-- recorded due times (SRQ-12); the trigger is paused so updated_at is not rewritten.
ALTER TABLE public.service_requests
  DROP CONSTRAINT service_requests_priority_check;
ALTER TABLE public.service_requests DISABLE TRIGGER service_requests_set_updated_at;
UPDATE public.service_requests
SET priority = CASE priority WHEN 'urgent' THEN 'high' ELSE 'medium' END
WHERE priority IN ('urgent', 'normal');
ALTER TABLE public.service_requests ENABLE TRIGGER service_requests_set_updated_at;

ALTER TABLE public.service_requests
  ALTER COLUMN priority SET DEFAULT 'medium',
  ADD CONSTRAINT service_requests_priority_check
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  ADD COLUMN on_hold_since timestamptz,
  ADD COLUMN on_hold_reason text,
  ADD COLUMN held_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN rating_quality smallint,
  ADD COLUMN rating_speed smallint,
  ADD COLUMN rating_behaviour smallint,
  ADD COLUMN feedback_follow_up text,
  ADD COLUMN intake_source text NOT NULL DEFAULT 'helpdesk_app',
  ADD COLUMN assigned_vendor_id uuid,
  ADD CONSTRAINT service_requests_hold_check
    CHECK (
      (on_hold_since IS NULL AND on_hold_reason IS NULL)
      OR (on_hold_since IS NOT NULL
        AND char_length(btrim(on_hold_reason)) BETWEEN 1 AND 500
        AND status IN ('open', 'assigned', 'in_progress', 'reopened'))
    ),
  ADD CONSTRAINT service_requests_held_seconds_check
    CHECK (held_seconds >= 0),
  ADD CONSTRAINT service_requests_feedback_scores_check
    CHECK (
      (rating_quality IS NULL AND rating_speed IS NULL AND rating_behaviour IS NULL)
      OR (rating IS NOT NULL
        AND rating_quality IS NOT NULL AND rating_quality BETWEEN 1 AND 5
        AND rating_speed IS NOT NULL AND rating_speed BETWEEN 1 AND 5
        AND rating_behaviour IS NOT NULL AND rating_behaviour BETWEEN 1 AND 5)
    ),
  ADD CONSTRAINT service_requests_feedback_follow_up_check
    CHECK (
      feedback_follow_up IS NULL
      OR (rating IS NOT NULL AND feedback_follow_up IN ('needed', 'done'))
    ),
  ADD CONSTRAINT service_requests_intake_source_check
    CHECK (intake_source IN (
      'walk_in', 'phone', 'whatsapp', 'email', 'helpdesk_app', 'daily_rounds'
    )),
  ADD CONSTRAINT service_requests_vendor_link_check
    CHECK (assigned_vendor_id IS NULL OR assigned_vendor_name IS NOT NULL),
  ADD CONSTRAINT service_requests_vendor_same_society_fkey
    FOREIGN KEY (society_id, assigned_vendor_id)
    REFERENCES public.vendors (society_id, id) ON DELETE RESTRICT;

CREATE INDEX service_requests_vendor_same_society_idx
  ON public.service_requests (society_id, assigned_vendor_id)
  WHERE assigned_vendor_id IS NOT NULL;

ALTER TABLE public.service_request_events
  DROP CONSTRAINT service_request_events_type_check,
  ADD CONSTRAINT service_request_events_type_check
    CHECK (event_type IN (
      'created', 'assigned', 'reassigned', 'status_changed',
      'rejected', 'confirmed', 'reopened', 'rated', 'commented', 'auto_closed',
      'escalated', 'priority_changed', 'held', 'released'
    )) NOT VALID;
ALTER TABLE public.service_request_events
  VALIDATE CONSTRAINT service_request_events_type_check;

-- Category × priority targets (SRQ-11). sla_hours stays for history only.
CREATE TABLE public.service_request_priority_targets (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  priority text NOT NULL,
  target_days integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, category_id, priority),
  CONSTRAINT service_request_priority_targets_priority_check
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT service_request_priority_targets_days_check
    CHECK (target_days BETWEEN 1 AND 365),
  CONSTRAINT service_request_priority_targets_category_same_society_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.service_request_categories (society_id, id) ON DELETE CASCADE
);

-- Low is capped at the 365-day maximum for very long category targets.
INSERT INTO public.service_request_priority_targets (
  society_id, category_id, priority, target_days, created_by, updated_by
)
SELECT category.society_id, category.id, seeded.priority, seeded.target_days,
  category.updated_by, category.updated_by
FROM public.service_request_categories AS category
CROSS JOIN LATERAL (
  SELECT GREATEST(1, ceil(category.sla_hours / 24.0)::integer) AS medium_days
) AS base
CROSS JOIN LATERAL (
  VALUES
    ('critical', 1),
    ('high', GREATEST(1, ceil(base.medium_days / 2.0)::integer)),
    ('medium', base.medium_days),
    ('low', LEAST(365, base.medium_days * 2))
) AS seeded (priority, target_days)
WHERE category.sla_hours IS NOT NULL;

-- Committee wait per category or per priority (SRQ-13). Every society that exists
-- now keeps the per-category wait; societies created later start per priority.
ALTER TABLE public.service_request_escalation_settings
  ADD COLUMN committee_wait_mode text NOT NULL DEFAULT 'per_priority',
  ADD CONSTRAINT service_request_escalation_settings_wait_mode_check
    CHECK (committee_wait_mode IN ('per_category', 'per_priority'));
ALTER TABLE public.service_request_escalation_settings
  DISABLE TRIGGER service_request_escalation_settings_set_updated_at;
UPDATE public.service_request_escalation_settings
SET committee_wait_mode = 'per_category';
ALTER TABLE public.service_request_escalation_settings
  ENABLE TRIGGER service_request_escalation_settings_set_updated_at;
INSERT INTO public.service_request_escalation_settings (
  society_id, committee_wait_mode
)
SELECT society.id, 'per_category'
FROM public.societies AS society
ON CONFLICT (society_id) DO NOTHING;

CREATE TABLE public.service_request_committee_waits (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  priority text NOT NULL,
  wait_days integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, priority),
  CONSTRAINT service_request_committee_waits_priority_check
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT service_request_committee_waits_days_check
    CHECK (wait_days BETWEEN 1 AND 30)
);

-- Escalation responses (SRQ-16); not shown to residents.
ALTER TABLE public.service_request_escalations
  ADD COLUMN response_status text NOT NULL DEFAULT 'pending_response',
  ADD COLUMN responded_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN response_note text,
  ADD CONSTRAINT service_request_escalations_response_status_check
    CHECK (response_status IN (
      'pending_response', 'action_taken', 'resolved', 'further_escalated'
    )),
  ADD CONSTRAINT service_request_escalations_response_check
    CHECK (
      (response_status = 'pending_response' AND responded_by IS NULL
        AND responded_at IS NULL AND response_note IS NULL)
      OR (response_status <> 'pending_response' AND responded_by IS NOT NULL
        AND responded_at IS NOT NULL
        AND (response_note IS NULL
          OR char_length(btrim(response_note)) BETWEEN 1 AND 1000))
    );

CREATE INDEX service_request_priority_targets_created_by_idx
  ON public.service_request_priority_targets (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX service_request_priority_targets_updated_by_idx
  ON public.service_request_priority_targets (updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX service_request_committee_waits_created_by_idx
  ON public.service_request_committee_waits (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX service_request_committee_waits_updated_by_idx
  ON public.service_request_committee_waits (updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX service_request_escalations_responded_by_idx
  ON public.service_request_escalations (responded_by)
  WHERE responded_by IS NOT NULL;

CREATE TRIGGER service_request_priority_targets_set_updated_at
  BEFORE UPDATE ON public.service_request_priority_targets
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER service_request_committee_waits_set_updated_at
  BEFORE UPDATE ON public.service_request_committee_waits
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.service_request_priority_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_committee_waits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_request_priority_targets,
  public.service_request_committee_waits
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.service_request_priority_targets,
  public.service_request_committee_waits TO service_role;

CREATE POLICY service_request_priority_targets_no_direct_access
  ON public.service_request_priority_targets
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY service_request_committee_waits_no_direct_access
  ON public.service_request_committee_waits
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Due time = logged time + target days + time already held. NULL when the category
-- has no target for the priority.
CREATE OR REPLACE FUNCTION private.service_request_due_at(
  p_society_id uuid,
  p_category_id uuid,
  p_priority text,
  p_created_at timestamptz,
  p_held_seconds integer
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_created_at + make_interval(days => target.target_days)
    + make_interval(secs => COALESCE(p_held_seconds, 0))
  FROM public.service_request_priority_targets AS target
  WHERE target.society_id = p_society_id
    AND target.category_id = p_category_id
    AND target.priority = p_priority
$$;

REVOKE ALL ON FUNCTION private.service_request_due_at(
  uuid, uuid, text, timestamptz, integer
) FROM PUBLIC, anon, authenticated, service_role;

-- Shared by request_create (residents and admins) and request_create_for_unit
-- (admins and housekeeping supervisors logging an off-app request).
CREATE OR REPLACE FUNCTION private.service_request_insert(
  p_society_id uuid,
  p_category_id uuid,
  p_location_type text,
  p_unit_id uuid,
  p_description text,
  p_priority text,
  p_attachments jsonb,
  p_client_request_id uuid,
  p_request_id text,
  p_intake_source text,
  p_require_occupancy boolean
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_row public.service_requests;
  new_row public.service_requests;
  attachment jsonb;
  attachment_count integer;
BEGIN
  IF p_client_request_id IS NULL
    OR p_description IS NULL
    OR char_length(btrim(p_description)) NOT BETWEEN 1 AND 2000
    OR p_priority IS NULL
    OR p_priority NOT IN ('critical', 'high', 'medium', 'low')
    OR p_location_type IS NULL
    OR p_location_type NOT IN ('unit', 'common_area')
    OR (p_location_type = 'unit') <> (p_unit_id IS NOT NULL)
    OR p_intake_source IS NULL
    OR p_intake_source NOT IN (
      'walk_in', 'phone', 'whatsapp', 'email', 'helpdesk_app', 'daily_rounds'
    )
    OR pg_catalog.jsonb_typeof(COALESCE(p_attachments, '[]'::jsonb)) <> 'array'
  THEN
    RAISE EXCEPTION 'The request details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing_row
  FROM public.service_requests
  WHERE society_id = p_society_id
    AND created_by = current_user_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN existing_row; END IF;

  IF p_location_type = 'unit' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.society_id = p_society_id
        AND unit.id = p_unit_id AND unit.active
    ) THEN
      RAISE EXCEPTION 'The unit was not found.'
        USING ERRCODE = 'P0002';
    END IF;
    IF p_require_occupancy AND NOT private.occupies_unit(p_unit_id) THEN
      RAISE EXCEPTION 'The requester does not occupy this unit.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_request_categories AS category
    WHERE category.society_id = p_society_id
      AND category.id = p_category_id AND category.active
  ) THEN
    RAISE EXCEPTION 'The request category was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  attachment_count := pg_catalog.jsonb_array_length(
    COALESCE(p_attachments, '[]'::jsonb)
  );
  IF attachment_count > 3 THEN
    RAISE EXCEPTION 'A request can have at most three photos.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_requests (
    society_id, created_by, updated_by, category_id, location_type, unit_id,
    description, priority, sla_due_at, client_request_id, intake_source
  )
  VALUES (
    p_society_id, current_user_id, current_user_id, p_category_id,
    p_location_type, p_unit_id, btrim(p_description), p_priority,
    private.service_request_due_at(
      p_society_id, p_category_id, p_priority, now(), 0
    ),
    p_client_request_id, p_intake_source
  )
  RETURNING * INTO new_row;

  FOR attachment IN
    SELECT value FROM pg_catalog.jsonb_array_elements(
      COALESCE(p_attachments, '[]'::jsonb)
    )
  LOOP
    IF attachment->>'path' !~
      ('^' || p_society_id::text || '/' || current_user_id::text
        || '/requests/' || p_client_request_id::text
        || '/[0-9a-f-]{36}\.(jpg|png)$')
      OR attachment->>'content_type' NOT IN ('image/jpeg', 'image/png')
      OR NOT (attachment->>'size_bytes') ~ '^[1-9][0-9]{0,6}$'
      OR (attachment->>'size_bytes')::integer > 5242880
    THEN
      RAISE EXCEPTION 'A request photo is invalid.'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.service_request_attachments (
      society_id, created_by, request_id, storage_path, content_type, size_bytes
    )
    VALUES (
      p_society_id, current_user_id, new_row.id,
      attachment->>'path', attachment->>'content_type',
      (attachment->>'size_bytes')::integer
    );
  END LOOP;

  PERFORM private.service_request_event(
    p_society_id, new_row.id, 'created', NULL, 'open', NULL
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, new_row.id, 'service_request_created',
    'New service request',
    CASE WHEN p_intake_source = 'helpdesk_app'
      THEN 'A resident submitted a new ' || p_priority || ' request.'
      ELSE 'A new ' || p_priority || ' priority request was logged.' END,
    p_request_id
  );
  RETURN new_row;
END;
$$;

REVOKE ALL ON FUNCTION private.service_request_insert(
  uuid, uuid, text, uuid, text, text, jsonb, uuid, text, text, boolean
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_create(
  p_society_id uuid,
  p_category_id uuid,
  p_location_type text,
  p_unit_id uuid,
  p_description text,
  p_priority text,
  p_attachments jsonb,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request creation is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  RETURN private.service_request_insert(
    p_society_id, p_category_id, p_location_type, p_unit_id, p_description,
    p_priority, p_attachments, p_client_request_id, p_request_id,
    'helpdesk_app',
    NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_create_for_unit(
  p_society_id uuid,
  p_category_id uuid,
  p_location_type text,
  p_unit_id uuid,
  p_description text,
  p_priority text,
  p_intake_source text,
  p_attachments jsonb,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'hk_supervisor']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Logging a request is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  RETURN private.service_request_insert(
    p_society_id, p_category_id, p_location_type, p_unit_id, p_description,
    p_priority, p_attachments, p_client_request_id, p_request_id,
    p_intake_source, false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_create_for_unit(
  uuid, uuid, text, uuid, text, text, text, jsonb, uuid, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_create_for_unit(
  uuid, uuid, text, uuid, text, text, text, jsonb, uuid, text
) TO authenticated;

-- Locks one active request for an admin change and checks module and writability.
CREATE OR REPLACE FUNCTION private.service_request_admin_lock(
  p_society_id uuid,
  p_request_id uuid
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.service_requests;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service request administration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION private.service_request_admin_lock(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_priority_change(
  p_society_id uuid,
  p_request_id uuid,
  p_priority text,
  p_reason text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.service_requests;
  old_priority text;
BEGIN
  request_row := private.service_request_admin_lock(p_society_id, p_request_id);
  IF p_priority IS NULL
    OR p_priority NOT IN ('critical', 'high', 'medium', 'low')
    OR p_reason IS NULL
    OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 400
  THEN
    RAISE EXCEPTION 'Choose a priority and give a reason.'
      USING ERRCODE = '22023';
  END IF;
  IF request_row.status NOT IN ('open', 'assigned', 'in_progress', 'reopened') THEN
    RAISE EXCEPTION 'This request priority can no longer be changed.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF request_row.priority = p_priority THEN
    RETURN request_row;
  END IF;
  old_priority := request_row.priority;

  UPDATE public.service_requests
  SET priority = p_priority,
      sla_due_at = private.service_request_due_at(
        p_society_id, request_row.category_id, p_priority,
        request_row.created_at, request_row.held_seconds
      ),
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_request_id
  RETURNING * INTO request_row;

  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'priority_changed', NULL, NULL,
    pg_catalog.left(
      'Priority changed from ' || old_priority || ' to ' || p_priority
        || '. ' || btrim(p_reason),
      500
    )
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_hold(
  p_society_id uuid,
  p_request_id uuid,
  p_reason text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.service_requests;
BEGIN
  request_row := private.service_request_admin_lock(p_society_id, p_request_id);
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'A reason is required to put a request on hold.'
      USING ERRCODE = '22023';
  END IF;
  IF request_row.status NOT IN ('open', 'assigned', 'in_progress', 'reopened')
    OR request_row.on_hold_since IS NOT NULL
  THEN
    RAISE EXCEPTION 'This request cannot be put on hold.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  UPDATE public.service_requests
  SET on_hold_since = now(),
      on_hold_reason = btrim(p_reason),
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_request_id
  RETURNING * INTO request_row;

  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'held', request_row.status, request_row.status,
    btrim(p_reason)
  );
  PERFORM private.create_notification(
    p_society_id, request_row.created_by, 'service_request_status',
    'Request on hold', pg_catalog.left(btrim(p_reason), 500),
    'service_request', p_request_id, p_request_trace
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_release(
  p_society_id uuid,
  p_request_id uuid,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.service_requests;
  held integer;
BEGIN
  request_row := private.service_request_admin_lock(p_society_id, p_request_id);
  IF request_row.on_hold_since IS NULL THEN
    RAISE EXCEPTION 'This request is not on hold.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  held := GREATEST(
    0, floor(extract(epoch FROM now() - request_row.on_hold_since))::integer
  );

  UPDATE public.service_requests
  SET held_seconds = held_seconds + held,
      sla_due_at = sla_due_at + make_interval(secs => held),
      on_hold_since = NULL,
      on_hold_reason = NULL,
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_request_id
  RETURNING * INTO request_row;

  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'released', request_row.status,
    request_row.status, NULL
  );
  PERFORM private.create_notification(
    p_society_id, request_row.created_by, 'service_request_status',
    'Request released from hold', 'Work on your service request has resumed.',
    'service_request', p_request_id, p_request_trace
  );
  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_priority_change(uuid, uuid, text, text, text),
  public.request_hold(uuid, uuid, text, text),
  public.request_release(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_priority_change(uuid, uuid, text, text, text),
  public.request_hold(uuid, uuid, text, text),
  public.request_release(uuid, uuid, text)
  TO authenticated;

-- Adds the vendor link (SRQ-20) to the 20261110213000 definition and refuses an
-- assignment that would move a held request out of Open.
DROP FUNCTION public.request_assign(uuid, uuid, uuid, text, text, text, text);

CREATE FUNCTION public.request_assign(
  p_society_id uuid,
  p_request_id uuid,
  p_membership_id uuid,
  p_vendor_name text,
  p_vendor_phone text,
  p_note text,
  p_request_trace text,
  p_vendor_id uuid DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  vendor_row public.vendors;
  vendor_name text := p_vendor_name;
  vendor_phone text := p_vendor_phone;
  previous_assignee uuid;
  next_status text;
  event text;
  old_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request assignment is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;

  IF p_vendor_id IS NOT NULL THEN
    IF p_membership_id IS NOT NULL
      OR NOT private.module_enabled(p_society_id, 'vendor')
    THEN
      RAISE EXCEPTION 'The assignment details are invalid.'
        USING ERRCODE = '22023';
    END IF;
    SELECT * INTO vendor_row
    FROM public.vendors
    WHERE society_id = p_society_id AND id = p_vendor_id AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The vendor is not an active society vendor.'
        USING ERRCODE = '23514';
    END IF;
    IF vendor_row.phone IS NULL
      OR char_length(btrim(vendor_row.phone)) NOT BETWEEN 7 AND 20
    THEN
      RAISE EXCEPTION 'Add a phone number to this vendor before assigning it.'
        USING ERRCODE = '22023';
    END IF;
    vendor_name := vendor_row.name;
    vendor_phone := vendor_row.phone;
  END IF;

  IF (p_membership_id IS NULL) = (vendor_name IS NULL)
    OR (vendor_name IS NOT NULL AND (
      char_length(btrim(vendor_name)) NOT BETWEEN 1 AND 120
      OR vendor_phone IS NULL
      OR char_length(btrim(vendor_phone)) NOT BETWEEN 7 AND 20
    ))
    OR (vendor_name IS NULL AND vendor_phone IS NOT NULL)
    OR (p_note IS NOT NULL AND char_length(p_note) > 500)
  THEN
    RAISE EXCEPTION 'The assignment details are invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF p_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships AS member
    WHERE member.society_id = p_society_id
      AND member.id = p_membership_id
      AND member.status = 'active'
      AND NOT (member.roles && ARRAY['guard']::text[])
  ) THEN
    RAISE EXCEPTION 'The assignee is not an active society member.'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.status NOT IN ('open', 'assigned', 'in_progress', 'reopened')
    OR (request_row.on_hold_since IS NOT NULL AND request_row.status = 'open')
  THEN
    RAISE EXCEPTION 'This request can no longer be assigned.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  previous_assignee := request_row.assigned_membership_id;
  old_status := request_row.status;
  next_status := CASE WHEN request_row.status = 'open' THEN 'assigned'
    ELSE request_row.status END;
  event := CASE WHEN previous_assignee IS NULL
      AND request_row.assigned_vendor_name IS NULL
    THEN 'assigned' ELSE 'reassigned' END;

  UPDATE public.service_requests
  SET assigned_membership_id = p_membership_id,
      assigned_vendor_id = p_vendor_id,
      assigned_vendor_name = NULLIF(btrim(vendor_name), ''),
      assigned_vendor_phone = NULLIF(btrim(vendor_phone), ''),
      status = next_status,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;

  PERFORM private.service_request_event(
    p_society_id, p_request_id, event, old_status, next_status, p_note
  );
  IF request_row.created_by <> current_user_id THEN
    PERFORM private.create_notification(
      p_society_id, request_row.created_by, 'service_request_assigned',
      'Request assignment updated', 'Your service request assignment changed.',
      'service_request', p_request_id, p_request_trace
    );
  END IF;
  IF p_membership_id IS NOT NULL THEN
    PERFORM private.create_notification(
      p_society_id,
      (SELECT user_id FROM public.memberships WHERE id = p_membership_id),
      'service_request_assigned',
      'Service request assigned',
      'A service request has been assigned to you.',
      'service_request', p_request_id, p_request_trace
    );
  END IF;
  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_assign(
  uuid, uuid, uuid, text, text, text, text, uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_assign(
  uuid, uuid, uuid, text, text, text, text, uuid
) TO authenticated;

-- Same as 20261110213000 but refused while on hold (SRQ-14).
CREATE OR REPLACE FUNCTION public.request_update_status(
  p_society_id uuid,
  p_request_id uuid,
  p_status text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  old_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request status updates are not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('in_progress', 'resolved') THEN
    RAISE EXCEPTION 'The requested status is invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships AS member
      WHERE member.society_id = p_society_id
        AND member.id = request_row.assigned_membership_id
        AND member.user_id = current_user_id
        AND member.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'Only an administrator or the assigned member can update status.'
      USING ERRCODE = '42501';
  END IF;
  old_status := request_row.status;
  IF request_row.on_hold_since IS NOT NULL OR NOT (
    (old_status = 'assigned' AND p_status IN ('in_progress', 'resolved'))
    OR (old_status = 'in_progress' AND p_status = 'resolved')
    OR (old_status = 'reopened' AND p_status IN ('in_progress', 'resolved'))
  ) THEN
    RAISE EXCEPTION 'The status transition is not allowed.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  UPDATE public.service_requests
  SET status = p_status,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
      closed_at = NULL,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'status_changed', old_status, p_status, NULL
  );
  PERFORM private.create_notification(
    p_society_id, request_row.created_by, 'service_request_status',
    'Request status updated',
    'Your request is now ' || replace(p_status, '_', ' ') || '.',
    'service_request', p_request_id, p_request_trace
  );
  RETURN request_row;
END;
$$;

-- Same as 20261110213000; rejecting also ends any hold and clears the vendor link.
CREATE OR REPLACE FUNCTION public.request_reject(
  p_society_id uuid,
  p_request_id uuid,
  p_reason text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  old_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request rejection is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'A rejection reason is required.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.status NOT IN ('open', 'assigned', 'in_progress', 'reopened') THEN
    RAISE EXCEPTION 'This request can no longer be rejected.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  old_status := request_row.status;
  UPDATE public.service_requests
  SET status = 'rejected', reject_reason = btrim(p_reason),
      held_seconds = held_seconds + CASE WHEN on_hold_since IS NULL THEN 0
        ELSE GREATEST(0, floor(extract(epoch FROM now() - on_hold_since))::integer)
        END,
      on_hold_since = NULL, on_hold_reason = NULL,
      assigned_membership_id = NULL, assigned_vendor_id = NULL,
      assigned_vendor_name = NULL, assigned_vendor_phone = NULL,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'rejected', old_status, 'rejected', btrim(p_reason)
  );
  PERFORM private.create_notification(
    p_society_id, request_row.created_by, 'service_request_rejected',
    'Request rejected', btrim(p_reason), 'service_request', p_request_id,
    p_request_trace
  );
  RETURN request_row;
END;
$$;

-- Same as 20261110213000; reopening also clears the detailed scores and follow-up.
CREATE OR REPLACE FUNCTION public.request_reopen(
  p_society_id uuid,
  p_request_id uuid,
  p_reason text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  close_days integer;
  previous_status text;
  window_end timestamptz;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request reopening is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'A reopening reason is required.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.created_by <> current_user_id
    OR request_row.status NOT IN ('resolved', 'closed')
  THEN
    RAISE EXCEPTION 'Only the requester can reopen a resolved or closed request.'
      USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((settings->>'auto_close_days')::integer, 3) INTO close_days
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'service_request';
  window_end := COALESCE(request_row.closed_at, request_row.resolved_at)
    + make_interval(days => COALESCE(close_days, 3));
  IF now() > window_end THEN
    RAISE EXCEPTION 'The reopening window has expired.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  previous_status := request_row.status;
  UPDATE public.service_requests
  SET status = 'reopened', resolved_at = NULL, closed_at = NULL,
      rating = NULL, rating_comment = NULL, rating_quality = NULL,
      rating_speed = NULL, rating_behaviour = NULL, feedback_follow_up = NULL,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'reopened', previous_status, 'reopened',
    btrim(p_reason)
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, p_request_id, 'service_request_reopened',
    'Request reopened', 'A resident reopened a service request.',
    p_request_trace
  );
  RETURN request_row;
END;
$$;

-- Adds the three detailed scores (SRQ-17); all three or none.
DROP FUNCTION public.request_rate(uuid, uuid, integer, text, text);

CREATE FUNCTION public.request_rate(
  p_society_id uuid,
  p_request_id uuid,
  p_rating integer,
  p_comment text,
  p_request_trace text,
  p_quality integer DEFAULT NULL,
  p_speed integer DEFAULT NULL,
  p_behaviour integer DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request rating is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5
    OR (p_comment IS NOT NULL AND char_length(p_comment) > 500)
    OR NOT (
      (p_quality IS NULL AND p_speed IS NULL AND p_behaviour IS NULL)
      OR COALESCE(p_quality BETWEEN 1 AND 5 AND p_speed BETWEEN 1 AND 5
        AND p_behaviour BETWEEN 1 AND 5, false)
    )
  THEN
    RAISE EXCEPTION 'The rating is invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.created_by <> current_user_id OR request_row.status <> 'closed' THEN
    RAISE EXCEPTION 'Only the requester can rate a closed request.'
      USING ERRCODE = '42501';
  END IF;
  IF request_row.rating IS NOT NULL THEN
    RAISE EXCEPTION 'This request has already been rated.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  UPDATE public.service_requests
  SET rating = p_rating, rating_comment = NULLIF(btrim(p_comment), ''),
      rating_quality = p_quality, rating_speed = p_speed,
      rating_behaviour = p_behaviour,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'rated', 'closed', 'closed', NULL
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, p_request_id, 'service_request_rated',
    'Request rated', 'A resident rated a completed service request.',
    p_request_trace
  );
  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_rate(
  uuid, uuid, integer, text, text, integer, integer, integer
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_rate(
  uuid, uuid, integer, text, text, integer, integer, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_feedback_follow_up_set(
  p_society_id uuid,
  p_request_id uuid,
  p_follow_up text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before_row public.service_requests;
  request_row public.service_requests;
BEGIN
  before_row := private.service_request_admin_lock(p_society_id, p_request_id);
  IF p_follow_up IS NOT NULL AND p_follow_up NOT IN ('needed', 'done') THEN
    RAISE EXCEPTION 'Choose Needed or Done.'
      USING ERRCODE = '22023';
  END IF;
  IF before_row.rating IS NULL THEN
    RAISE EXCEPTION 'Only rated requests have a feedback follow-up.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF before_row.feedback_follow_up IS NOT DISTINCT FROM p_follow_up THEN
    RETURN before_row;
  END IF;
  UPDATE public.service_requests
  SET feedback_follow_up = p_follow_up, updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_request_id
  RETURNING * INTO request_row;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'request.feedback_follow_up.set',
    'service_request', p_request_id::text,
    pg_catalog.jsonb_build_object('feedback_follow_up', before_row.feedback_follow_up),
    pg_catalog.jsonb_build_object('feedback_follow_up', request_row.feedback_follow_up),
    p_request_trace
  );
  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_feedback_follow_up_set(uuid, uuid, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_feedback_follow_up_set(uuid, uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.request_category_targets_list(
  p_society_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request targets are not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'category_id', target.category_id,
      'priority', target.priority,
      'target_days', target.target_days
    ) ORDER BY target.category_id, target.priority)
    FROM public.service_request_priority_targets AS target
    WHERE target.society_id = p_society_id
  ), '[]'::jsonb);
END;
$$;

-- Replaces all four values for one category at once; all NULL clears the targets.
-- Existing requests keep their recorded due times.
CREATE OR REPLACE FUNCTION public.request_category_targets_save(
  p_society_id uuid,
  p_category_id uuid,
  p_critical integer,
  p_high integer,
  p_medium integer,
  p_low integer,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_targets jsonb;
  after_targets jsonb;
  clearing boolean := p_critical IS NULL AND p_high IS NULL
    AND p_medium IS NULL AND p_low IS NULL;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service request administration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT clearing AND NOT COALESCE(
    p_critical BETWEEN 1 AND 365 AND p_high BETWEEN 1 AND 365
    AND p_medium BETWEEN 1 AND 365 AND p_low BETWEEN 1 AND 365,
    false
  ) THEN
    RAISE EXCEPTION 'Enter all four targets in days, or leave all empty.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.service_request_categories
  WHERE society_id = p_society_id AND id = p_category_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The category was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT pg_catalog.jsonb_object_agg(priority, target_days) INTO before_targets
  FROM public.service_request_priority_targets
  WHERE society_id = p_society_id AND category_id = p_category_id;

  DELETE FROM public.service_request_priority_targets
  WHERE society_id = p_society_id AND category_id = p_category_id;
  IF NOT clearing THEN
    INSERT INTO public.service_request_priority_targets (
      society_id, category_id, priority, target_days, created_by, updated_by
    )
    VALUES
      (p_society_id, p_category_id, 'critical', p_critical, current_user_id, current_user_id),
      (p_society_id, p_category_id, 'high', p_high, current_user_id, current_user_id),
      (p_society_id, p_category_id, 'medium', p_medium, current_user_id, current_user_id),
      (p_society_id, p_category_id, 'low', p_low, current_user_id, current_user_id);
    after_targets := pg_catalog.jsonb_build_object(
      'critical', p_critical, 'high', p_high, 'medium', p_medium, 'low', p_low
    );
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'request.categories.targets.save',
    'service_request_category', p_category_id::text,
    pg_catalog.jsonb_build_object('targets', before_targets),
    pg_catalog.jsonb_build_object('targets', after_targets),
    p_request_id
  );
  RETURN pg_catalog.jsonb_build_object(
    'category_id', p_category_id, 'targets', after_targets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_category_targets_list(uuid),
  public.request_category_targets_save(
    uuid, uuid, integer, integer, integer, integer, text
  )
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_category_targets_list(uuid),
  public.request_category_targets_save(
    uuid, uuid, integer, integer, integer, integer, text
  )
  TO authenticated;

-- Same as 20261117130000 plus the committee wait mode and the four per-priority waits.
CREATE OR REPLACE FUNCTION public.request_escalation_settings_get(
  p_society_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.service_request_escalation_settings;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Escalation settings are not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO settings_row
  FROM public.service_request_escalation_settings
  WHERE society_id = p_society_id;
  RETURN pg_catalog.jsonb_build_object(
    'delivery', COALESCE(settings_row.delivery, 'in_app'),
    'committee_wait_mode',
      COALESCE(settings_row.committee_wait_mode, 'per_priority'),
    'committee_waits', (
      SELECT pg_catalog.jsonb_object_agg(
        priority.value, COALESCE(wait.wait_days, 2)
      )
      FROM pg_catalog.unnest(
        ARRAY['critical', 'high', 'medium', 'low']::text[]
      ) AS priority (value)
      LEFT JOIN public.service_request_committee_waits AS wait
        ON wait.society_id = p_society_id AND wait.priority = priority.value
    ),
    'updated_at', settings_row.updated_at
  );
END;
$$;

DROP FUNCTION public.request_escalation_settings_save(
  uuid, text, timestamptz, text
);

CREATE FUNCTION public.request_escalation_settings_save(
  p_society_id uuid,
  p_delivery text,
  p_expected_updated_at timestamptz,
  p_request_id text,
  p_committee_wait_mode text DEFAULT NULL,
  p_committee_waits jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.service_request_escalation_settings;
  after_row public.service_request_escalation_settings;
  before_waits jsonb;
  wait_priority text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service request administration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_delivery IS NULL OR p_delivery NOT IN ('in_app', 'in_app_email') THEN
    RAISE EXCEPTION 'Choose how escalations are sent.'
      USING ERRCODE = '22023';
  END IF;
  IF p_committee_wait_mode IS NOT NULL
    AND p_committee_wait_mode NOT IN ('per_category', 'per_priority')
  THEN
    RAISE EXCEPTION 'Choose how the committee wait is set.'
      USING ERRCODE = '22023';
  END IF;
  IF p_committee_waits IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(p_committee_waits) <> 'object'
      OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(p_committee_waits)) <> 4
    THEN
      RAISE EXCEPTION 'Enter a committee wait for every priority.'
        USING ERRCODE = '22023';
    END IF;
    FOREACH wait_priority IN ARRAY ARRAY['critical', 'high', 'medium', 'low']::text[]
    LOOP
      IF pg_catalog.jsonb_typeof(p_committee_waits->wait_priority) IS DISTINCT FROM 'number'
        OR (p_committee_waits->>wait_priority) !~ '^[0-9]{1,2}$'
        OR (p_committee_waits->>wait_priority)::integer NOT BETWEEN 1 AND 30
      THEN
        RAISE EXCEPTION 'Each committee wait must be 1 to 30 days.'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  SELECT * INTO before_row
  FROM public.service_request_escalation_settings
  WHERE society_id = p_society_id
  FOR UPDATE;
  IF FOUND THEN
    IF p_expected_updated_at IS NULL
      OR before_row.updated_at <> p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The escalation settings changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    UPDATE public.service_request_escalation_settings
    SET delivery = p_delivery,
        committee_wait_mode = COALESCE(
          p_committee_wait_mode, before_row.committee_wait_mode
        )
    WHERE society_id = p_society_id
    RETURNING * INTO after_row;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'The escalation settings changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    INSERT INTO public.service_request_escalation_settings (
      society_id, delivery, committee_wait_mode, created_by, updated_by
    )
    VALUES (
      p_society_id, p_delivery, COALESCE(p_committee_wait_mode, 'per_priority'),
      current_user_id, current_user_id
    )
    ON CONFLICT (society_id) DO NOTHING
    RETURNING * INTO after_row;
    IF after_row.society_id IS NULL THEN
      RAISE EXCEPTION 'The escalation settings changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
  END IF;

  SELECT pg_catalog.jsonb_object_agg(priority, wait_days) INTO before_waits
  FROM public.service_request_committee_waits
  WHERE society_id = p_society_id;
  IF p_committee_waits IS NOT NULL THEN
    INSERT INTO public.service_request_committee_waits (
      society_id, priority, wait_days, created_by, updated_by
    )
    SELECT p_society_id, priority.value,
      (p_committee_waits->>priority.value)::integer,
      current_user_id, current_user_id
    FROM pg_catalog.unnest(
      ARRAY['critical', 'high', 'medium', 'low']::text[]
    ) AS priority (value)
    ON CONFLICT (society_id, priority) DO UPDATE
    SET wait_days = EXCLUDED.wait_days, updated_by = current_user_id
    WHERE service_request_committee_waits.wait_days IS DISTINCT FROM EXCLUDED.wait_days;
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'request.escalation_settings.update',
    'service_request_escalation_settings', p_society_id::text,
    pg_catalog.jsonb_build_object(
      'delivery', COALESCE(before_row.delivery, 'in_app'),
      'committee_wait_mode', before_row.committee_wait_mode,
      'committee_waits', before_waits
    ),
    pg_catalog.jsonb_build_object(
      'delivery', after_row.delivery,
      'committee_wait_mode', after_row.committee_wait_mode,
      'committee_waits', COALESCE(p_committee_waits, before_waits)
    ),
    p_request_id
  );
  RETURN public.request_escalation_settings_get(p_society_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_escalation_settings_save(
  uuid, text, timestamptz, text, text, jsonb
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_escalation_settings_save(
  uuid, text, timestamptz, text, text, jsonb
) TO authenticated;

-- Same as 20261117130000, but held requests are skipped and the committee wait is
-- read from the category or the per-priority table according to the society's mode.
CREATE OR REPLACE FUNCTION public.request_escalation_run(
  p_society_id uuid,
  p_today date,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  india_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  delivery_choice text;
  wait_mode text;
  cutoff timestamptz;
  candidate record;
  step_emails jsonb;
  emails jsonb := '[]'::jsonb;
  admin_count integer := 0;
  committee_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'The daily request job requires service role.'
      USING ERRCODE = '42501';
  END IF;
  IF p_society_id IS NULL OR p_today IS NULL
    OR p_today NOT BETWEEN india_today - 1 AND india_today
  THEN
    RAISE EXCEPTION 'The escalation run details are invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'service_request')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN pg_catalog.jsonb_build_object(
      'admin', 0, 'committee', 0, 'emails', '[]'::jsonb
    );
  END IF;

  SELECT settings.delivery, settings.committee_wait_mode
  INTO delivery_choice, wait_mode
  FROM public.service_request_escalation_settings AS settings
  WHERE settings.society_id = p_society_id;
  delivery_choice := COALESCE(delivery_choice, 'in_app');
  wait_mode := COALESCE(wait_mode, 'per_priority');
  cutoff := LEAST(
    now(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  -- Committee first, so a request that reaches admins in this run waits its full interval.
  FOR candidate IN
    SELECT request.id
    FROM public.service_requests AS request
    JOIN public.service_request_categories AS category
      ON category.society_id = request.society_id
      AND category.id = request.category_id
    JOIN public.service_request_escalations AS admin_step
      ON admin_step.society_id = request.society_id
      AND admin_step.request_id = request.id
      AND admin_step.level = 'admin'
    LEFT JOIN public.service_request_committee_waits AS priority_wait
      ON priority_wait.society_id = request.society_id
      AND priority_wait.priority = request.priority
    WHERE request.society_id = p_society_id
      AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
      AND request.on_hold_since IS NULL
      AND admin_step.escalated_on + CASE WHEN wait_mode = 'per_category'
          THEN category.committee_escalation_days
          ELSE COALESCE(priority_wait.wait_days, 2) END <= p_today
      AND NOT EXISTS (
        SELECT 1 FROM public.service_request_escalations AS committee_step
        WHERE committee_step.society_id = request.society_id
          AND committee_step.request_id = request.id
          AND committee_step.level = 'committee'
      )
    ORDER BY admin_step.escalated_on, request.id
    LIMIT 200
    FOR UPDATE OF request SKIP LOCKED
  LOOP
    step_emails := private.service_request_escalate(
      p_society_id, candidate.id, 'committee', p_today, delivery_choice,
      p_request_trace
    );
    IF step_emails IS NOT NULL THEN
      committee_count := committee_count + 1;
      emails := emails || step_emails;
    END IF;
  END LOOP;

  FOR candidate IN
    SELECT request.id
    FROM public.service_requests AS request
    WHERE request.society_id = p_society_id
      AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
      AND request.on_hold_since IS NULL
      AND request.sla_due_at IS NOT NULL
      AND request.sla_due_at < cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.service_request_escalations AS admin_step
        WHERE admin_step.society_id = request.society_id
          AND admin_step.request_id = request.id
          AND admin_step.level = 'admin'
      )
    ORDER BY request.sla_due_at, request.id
    LIMIT 200
    FOR UPDATE OF request SKIP LOCKED
  LOOP
    step_emails := private.service_request_escalate(
      p_society_id, candidate.id, 'admin', p_today, delivery_choice,
      p_request_trace
    );
    IF step_emails IS NOT NULL THEN
      admin_count := admin_count + 1;
      emails := emails || step_emails;
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'admin', admin_count, 'committee', committee_count, 'emails', emails
  );
END;
$$;

-- Admins answer admin-level escalations; admins or committee answer committee-level ones.
CREATE OR REPLACE FUNCTION public.request_escalation_respond(
  p_society_id uuid,
  p_request_id uuid,
  p_level text,
  p_response_status text,
  p_note text,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.service_request_escalations;
  after_row public.service_request_escalations;
  actor text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
    OR p_level IS NULL OR p_level NOT IN ('admin', 'committee')
    OR NOT private.has_role(
      p_society_id,
      CASE WHEN p_level = 'committee'
        THEN ARRAY['admin', 'committee']::text[]
        ELSE ARRAY['admin']::text[] END
    )
  THEN
    RAISE EXCEPTION 'Responding to this escalation is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_response_status IS NULL
    OR p_response_status NOT IN ('action_taken', 'resolved', 'further_escalated')
    OR (p_note IS NOT NULL AND char_length(btrim(p_note)) > 1000)
  THEN
    RAISE EXCEPTION 'The escalation response is invalid.'
      USING ERRCODE = '22023';
  END IF;
  actor := CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
    THEN 'admin' ELSE 'committee' END;

  SELECT * INTO before_row
  FROM public.service_request_escalations
  WHERE society_id = p_society_id AND request_id = p_request_id
    AND level = p_level
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The escalation was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.service_request_escalations
  SET response_status = p_response_status,
      responded_by = current_user_id,
      responded_at = now(),
      response_note = NULLIF(btrim(p_note), '')
  WHERE id = before_row.id
  RETURNING * INTO after_row;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, actor, 'request.escalation.respond',
    'service_request', p_request_id::text,
    pg_catalog.jsonb_build_object(
      'level', p_level, 'response_status', before_row.response_status
    ),
    pg_catalog.jsonb_build_object(
      'level', p_level, 'response_status', after_row.response_status
    ),
    p_request_trace
  );
  RETURN pg_catalog.jsonb_build_object(
    'level', after_row.level,
    'escalated_on', after_row.escalated_on,
    'response_status', after_row.response_status,
    'responded_at', after_row.responded_at,
    'response_note', after_row.response_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_escalation_respond(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_escalation_respond(
  uuid, uuid, text, text, text, text
) TO authenticated;

-- Same as 20261117130000 plus held_days, overdue that ignores held requests, and
-- written feedback limited to admins and the requester (SRQ-15).
CREATE OR REPLACE FUNCTION public.request_list(
  p_society_id uuid,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'default'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  can_manage boolean;
  is_admin boolean;
  is_resident boolean;
  own_units uuid[];
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service requests are not available.'
      USING ERRCODE = '42501';
  END IF;
  IF (p_status IS NOT NULL AND p_status NOT IN (
      'open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
    ))
    OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset < 0
    OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from)
    OR p_sort IS NULL OR p_sort NOT IN ('default', 'votes')
  THEN
    RAISE EXCEPTION 'The request filters are invalid.'
      USING ERRCODE = '22023';
  END IF;

  can_manage := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  own_units := private.current_user_unit_ids(p_society_id);

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(filtered) || CASE
        WHEN is_admin OR filtered.created_by = current_user_id THEN '{}'::jsonb
        ELSE pg_catalog.jsonb_build_object('rating_comment', NULL) END
      ORDER BY
        CASE WHEN p_sort = 'votes' THEN filtered.upvote_count END DESC NULLS LAST,
        filtered.is_overdue DESC,
        filtered.created_at DESC
    )
    FROM (
      SELECT
        page.*,
        unit.number AS unit_number,
        requester.full_name AS requester_name,
        assignee_profile.full_name AS assignee_name,
        COALESCE(votes.upvote_count, 0) AS upvote_count,
        COALESCE(votes.has_upvoted, false) AS has_upvoted,
        private.service_request_escalation_level(
          page.society_id, page.id
        ) AS escalation_level
      FROM (
        SELECT
          request.*,
          category.name AS category_name,
          COALESCE(
            request.status IN ('open', 'assigned', 'in_progress', 'reopened')
              AND request.on_hold_since IS NULL
              AND request.sla_due_at < now(),
            false
          ) AS is_overdue,
          CASE WHEN request.on_hold_since IS NULL THEN NULL
            ELSE floor(
              extract(epoch FROM now() - request.on_hold_since) / 86400
            )::integer END AS held_days
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id
          AND category.id = request.category_id
        WHERE request.society_id = p_society_id
          AND (
            can_manage
            OR (request.location_type = 'unit'
              AND request.unit_id = ANY (own_units)
              AND private.occupies_unit(request.unit_id))
            OR (request.location_type = 'common_area' AND is_resident)
            OR EXISTS (
              SELECT 1 FROM public.memberships AS current_assignee
              WHERE current_assignee.society_id = request.society_id
                AND current_assignee.id = request.assigned_membership_id
                AND current_assignee.user_id = current_user_id
                AND current_assignee.status = 'active'
            )
          )
          AND (p_status IS NULL OR request.status = p_status)
          AND (p_category_id IS NULL OR request.category_id = p_category_id)
          AND (p_unit_id IS NULL OR request.unit_id = p_unit_id)
          AND (p_assignee_id IS NULL
            OR request.assigned_membership_id = p_assignee_id)
          AND (p_from IS NULL OR request.created_at::date >= p_from)
          AND (p_to IS NULL OR request.created_at::date <= p_to)
        ORDER BY
          CASE WHEN p_sort = 'votes' THEN (
            SELECT count(*)::integer FROM public.service_request_upvotes AS vote
            WHERE vote.society_id = request.society_id
              AND vote.request_id = request.id
          ) END DESC NULLS LAST,
          CASE WHEN request.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request.on_hold_since IS NULL
            AND request.sla_due_at < now() THEN 0 ELSE 1 END,
          request.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) AS page
      LEFT JOIN public.units AS unit
        ON unit.society_id = page.society_id AND unit.id = page.unit_id
      LEFT JOIN public.profiles AS requester
        ON requester.id = page.created_by
      LEFT JOIN public.memberships AS assignee
        ON assignee.society_id = page.society_id
        AND assignee.id = page.assigned_membership_id
      LEFT JOIN public.profiles AS assignee_profile
        ON assignee_profile.id = assignee.user_id
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS upvote_count,
          bool_or(vote.user_id = current_user_id) AS has_upvoted
        FROM public.service_request_upvotes AS vote
        WHERE vote.society_id = page.society_id
          AND vote.request_id = page.id
      ) AS votes ON true
    ) AS filtered
  ), '[]'::jsonb);
END;
$$;

-- Same as 20261117130000 plus held_days, overdue that ignores held requests, admin-
-- and committee-only escalation responses, and written feedback limited as in the list.
CREATE OR REPLACE FUNCTION public.request_get(
  p_society_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  can_manage boolean;
  is_admin boolean;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The service request is not available.'
      USING ERRCODE = '42501';
  END IF;
  can_manage := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  SELECT request.* INTO request_row
  FROM public.service_requests AS request
  WHERE request.society_id = p_society_id AND request.id = p_request_id
    AND (
      can_manage
      OR (request.location_type = 'unit'
        AND private.occupies_unit(request.unit_id))
      OR (request.location_type = 'common_area'
        AND private.has_role(p_society_id, ARRAY['resident']::text[]))
      OR EXISTS (
        SELECT 1 FROM public.memberships AS assignee
        WHERE assignee.society_id = request.society_id
          AND assignee.id = request.assigned_membership_id
          AND assignee.user_id = current_user_id
          AND assignee.status = 'active'
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The service request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_admin AND request_row.created_by <> current_user_id THEN
    request_row.rating_comment := NULL;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'request', pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object(
      'category_name', (
        SELECT name FROM public.service_request_categories
        WHERE society_id = p_society_id AND id = request_row.category_id
      ),
      'unit_number', (
        SELECT number FROM public.units
        WHERE society_id = p_society_id AND id = request_row.unit_id
      ),
      'requester_name', (
        SELECT full_name FROM public.profiles WHERE id = request_row.created_by
      ),
      'assignee_name', (
        SELECT profile.full_name
        FROM public.memberships AS member
        JOIN public.profiles AS profile ON profile.id = member.user_id
        WHERE member.society_id = p_society_id
          AND member.id = request_row.assigned_membership_id
      ),
      'is_overdue',
        COALESCE(
          request_row.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request_row.on_hold_since IS NULL
            AND request_row.sla_due_at < now(),
          false
        ),
      'held_days',
        CASE WHEN request_row.on_hold_since IS NULL THEN NULL
          ELSE floor(
            extract(epoch FROM now() - request_row.on_hold_since) / 86400
          )::integer END,
      'escalation_level',
        private.service_request_escalation_level(p_society_id, p_request_id)
    ) || (
      private.service_request_upvote_summary(p_society_id, p_request_id)
        - 'request_id'
    ),
    'comments', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(comment) || pg_catalog.jsonb_build_object(
          'author_name', profile.full_name
        ) ORDER BY comment.created_at
      )
      FROM public.service_request_comments AS comment
      JOIN public.profiles AS profile ON profile.id = comment.created_by
      WHERE comment.society_id = p_society_id
        AND comment.request_id = p_request_id
    ), '[]'::jsonb),
    'attachments', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(attachment) ORDER BY attachment.created_at
      )
      FROM public.service_request_attachments AS attachment
      WHERE attachment.society_id = p_society_id
        AND attachment.request_id = p_request_id
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(event) || pg_catalog.jsonb_build_object(
          'actor_name', profile.full_name
        ) ORDER BY event.created_at
      )
      FROM public.service_request_events AS event
      LEFT JOIN public.profiles AS profile ON profile.id = event.created_by
      WHERE event.society_id = p_society_id
        AND event.request_id = p_request_id
    ), '[]'::jsonb),
    'escalations', CASE WHEN NOT can_manage THEN '[]'::jsonb ELSE COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'level', step.level,
          'escalated_on', step.escalated_on,
          'response_status', step.response_status,
          'responded_at', step.responded_at,
          'responder_name', responder.full_name,
          'response_note', step.response_note,
          'days_to_respond', CASE WHEN step.responded_at IS NULL THEN NULL
            ELSE (step.responded_at AT TIME ZONE 'Asia/Kolkata')::date
              - step.escalated_on END
        ) ORDER BY step.escalated_on, step.level
      )
      FROM public.service_request_escalations AS step
      LEFT JOIN public.profiles AS responder ON responder.id = step.responded_by
      WHERE step.society_id = p_society_id AND step.request_id = p_request_id
    ), '[]'::jsonb) END
  );
END;
$$;

-- Same as 20261113060000 but the overdue count ignores held requests.
CREATE OR REPLACE FUNCTION public.request_dashboard(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The request dashboard is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'total_open', (
      SELECT count(*) FROM public.service_requests
      WHERE society_id = p_society_id
        AND status IN ('open', 'assigned', 'in_progress', 'reopened')
    ),
    'overdue', (
      SELECT count(*) FROM public.service_requests
      WHERE society_id = p_society_id
        AND status IN ('open', 'assigned', 'in_progress', 'reopened')
        AND on_hold_since IS NULL
        AND sla_due_at < now()
    ),
    'by_status', COALESCE((
      SELECT pg_catalog.jsonb_object_agg(status, total)
      FROM (
        SELECT status, count(*) AS total
        FROM public.service_requests
        WHERE society_id = p_society_id
        GROUP BY status
      ) AS statuses
    ), '{}'::jsonb),
    'by_category', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'category_id', categories.category_id,
          'category', categories.category_name,
          'total', categories.total,
          'avg_resolution_hours', categories.avg_resolution_hours,
          'avg_rating', categories.avg_rating
        ) ORDER BY categories.sort_order, categories.category_name
      )
      FROM (
        SELECT
          category.id AS category_id,
          category.name AS category_name,
          category.sort_order,
          count(request.id) AS total,
          avg(
            extract(epoch FROM request.resolved_at - request.created_at) / 3600
          ) AS avg_resolution_hours,
          avg(request.rating) AS avg_rating
        FROM public.service_request_categories AS category
        LEFT JOIN public.service_requests AS request
          ON request.society_id = category.society_id
          AND request.category_id = category.id
        WHERE category.society_id = p_society_id AND category.active
        GROUP BY category.id, category.name, category.sort_order
      ) AS categories
    ), '[]'::jsonb)
  );
END;
$$;

-- Read-only performance report (SRQ-15) over the last 12 India months, including the
-- current one. Rejected requests are left out of every rate and of the backlog.
-- Resolution % = resolved ÷ (logged − rejected); on-time % = resolved by the due time
-- ÷ resolved with a due time; average days use resolved requests; closing backlog =
-- non-rejected requests logged up to month end − those resolved up to month end.
-- Unit-level repeats and written comments are admin-only.
CREATE OR REPLACE FUNCTION public.request_report(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_admin boolean;
  first_month date := (
    pg_catalog.date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))
    - interval '11 months'
  )::date;
  window_start timestamptz;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The request report is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  window_start := first_month::timestamp AT TIME ZONE 'Asia/Kolkata';

  RETURN pg_catalog.jsonb_build_object(
    'from_month', pg_catalog.to_char(first_month, 'YYYY-MM'),
    'totals', (
      SELECT pg_catalog.jsonb_build_object(
        'logged', count(*),
        'rejected', count(*) FILTER (WHERE request.status = 'rejected'),
        'resolved', count(*) FILTER (WHERE request.resolved_at IS NOT NULL),
        'with_target', count(*) FILTER (
          WHERE request.resolved_at IS NOT NULL AND request.sla_due_at IS NOT NULL
        ),
        'on_time', count(*) FILTER (
          WHERE request.resolved_at IS NOT NULL
            AND request.resolved_at <= request.sla_due_at
        ),
        'avg_days', round(avg(
          extract(epoch FROM request.resolved_at - request.created_at) / 86400
        )::numeric, 1)
      )
      FROM public.service_requests AS request
      WHERE request.society_id = p_society_id
        AND request.created_at >= window_start
    ),
    'by_category', COALESCE((
      SELECT pg_catalog.jsonb_agg(row_data ORDER BY sort_order, name)
      FROM (
        SELECT category.sort_order, category.name,
          pg_catalog.jsonb_build_object(
            'category', category.name,
            'logged', count(request.id),
            'resolved', count(request.resolved_at),
            'avg_days', round(avg(
              extract(epoch FROM request.resolved_at - request.created_at) / 86400
            )::numeric, 1)
          ) AS row_data
        FROM public.service_request_categories AS category
        JOIN public.service_requests AS request
          ON request.society_id = category.society_id
          AND request.category_id = category.id
          AND request.created_at >= window_start
          AND request.status <> 'rejected'
        WHERE category.society_id = p_society_id
        GROUP BY category.id, category.sort_order, category.name
      ) AS grouped
    ), '[]'::jsonb),
    'by_priority', COALESCE((
      SELECT pg_catalog.jsonb_agg(row_data ORDER BY rank)
      FROM (
        SELECT pg_catalog.array_position(
            ARRAY['critical', 'high', 'medium', 'low']::text[], request.priority
          ) AS rank,
          pg_catalog.jsonb_build_object(
            'priority', request.priority,
            'logged', count(*),
            'resolved', count(request.resolved_at),
            'avg_days', round(avg(
              extract(epoch FROM request.resolved_at - request.created_at) / 86400
            )::numeric, 1)
          ) AS row_data
        FROM public.service_requests AS request
        WHERE request.society_id = p_society_id
          AND request.created_at >= window_start
          AND request.status <> 'rejected'
        GROUP BY request.priority
      ) AS grouped
    ), '[]'::jsonb),
    'by_month', (
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'month', pg_catalog.to_char(month.start_day, 'YYYY-MM'),
        'logged', (
          SELECT count(*) FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.status <> 'rejected'
            AND request.created_at >= month.start_at
            AND request.created_at < month.end_at
        ),
        'resolved', (
          SELECT count(*) FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.status <> 'rejected'
            AND request.resolved_at >= month.start_at
            AND request.resolved_at < month.end_at
        ),
        'avg_days', (
          SELECT round(avg(
            extract(epoch FROM request.resolved_at - request.created_at) / 86400
          )::numeric, 1)
          FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.resolved_at >= month.start_at
            AND request.resolved_at < month.end_at
        ),
        'closing_backlog', (
          SELECT count(*) FILTER (WHERE request.created_at < month.end_at)
            - count(*) FILTER (WHERE request.resolved_at < month.end_at)
          FROM public.service_requests AS request
          WHERE request.society_id = p_society_id
            AND request.status <> 'rejected'
        )
      ) ORDER BY month.start_day)
      FROM (
        SELECT series.start_day,
          series.start_day::timestamp AT TIME ZONE 'Asia/Kolkata' AS start_at,
          (series.start_day + interval '1 month')::timestamp
            AT TIME ZONE 'Asia/Kolkata' AS end_at
        FROM (
          SELECT pg_catalog.generate_series(
            first_month, first_month + interval '11 months', interval '1 month'
          )::date AS start_day
        ) AS series
      ) AS month
    ),
    'open_load', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('assignee', load.assignee, 'open', load.open)
        ORDER BY load.open DESC, load.assignee
      )
      FROM (
        SELECT COALESCE(profile.full_name, request.assigned_vendor_name)
            AS assignee,
          count(*) AS open
        FROM public.service_requests AS request
        LEFT JOIN public.memberships AS member
          ON member.society_id = request.society_id
          AND member.id = request.assigned_membership_id
        LEFT JOIN public.profiles AS profile ON profile.id = member.user_id
        WHERE request.society_id = p_society_id
          AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
          AND (request.assigned_membership_id IS NOT NULL
            OR request.assigned_vendor_name IS NOT NULL)
        GROUP BY 1
      ) AS load
    ), '[]'::jsonb),
    'unassigned_open', (
      SELECT count(*) FROM public.service_requests AS request
      WHERE request.society_id = p_society_id
        AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
        AND request.assigned_membership_id IS NULL
        AND request.assigned_vendor_name IS NULL
    ),
    'repeats', CASE WHEN NOT is_admin THEN NULL ELSE COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'category', repeat.category, 'unit_number', repeat.unit_number,
          'count', repeat.total
        ) ORDER BY repeat.total DESC, repeat.unit_number, repeat.category
      )
      FROM (
        SELECT category.name AS category, unit.number AS unit_number,
          count(*) AS total
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id
          AND category.id = request.category_id
        JOIN public.units AS unit
          ON unit.society_id = request.society_id AND unit.id = request.unit_id
        WHERE request.society_id = p_society_id
          AND request.location_type = 'unit'
          AND request.created_at >= now() - interval '90 days'
        GROUP BY category.name, unit.number
        HAVING count(*) >= 3
      ) AS repeat
    ), '[]'::jsonb) END,
    'feedback', (
      SELECT pg_catalog.jsonb_build_object(
        'rated', count(request.rating),
        'avg_overall', round(avg(request.rating)::numeric, 1),
        'avg_quality', round(avg(request.rating_quality)::numeric, 1),
        'avg_speed', round(avg(request.rating_speed)::numeric, 1),
        'avg_behaviour', round(avg(request.rating_behaviour)::numeric, 1),
        'follow_up_needed', count(*) FILTER (
          WHERE request.feedback_follow_up = 'needed'
        )
      )
      FROM public.service_requests AS request
      WHERE request.society_id = p_society_id
        AND request.created_at >= window_start
        AND request.rating IS NOT NULL
    ),
    'comments', CASE WHEN NOT is_admin THEN NULL ELSE COALESCE((
      SELECT pg_catalog.jsonb_agg(row_data ORDER BY closed_at DESC)
      FROM (
        SELECT request.closed_at, pg_catalog.jsonb_build_object(
          'request_id', request.id,
          'category', category.name,
          'rating', request.rating,
          'comment', request.rating_comment,
          'follow_up', request.feedback_follow_up,
          'closed_at', request.closed_at
        ) AS row_data
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id
          AND category.id = request.category_id
        WHERE request.society_id = p_society_id
          AND request.rating_comment IS NOT NULL
          AND request.created_at >= window_start
        ORDER BY request.closed_at DESC
        LIMIT 20
      ) AS recent
    ), '[]'::jsonb) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_report(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_report(uuid) TO authenticated;
