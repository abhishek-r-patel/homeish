-- Parking slots, unit allocations, FIFO waitlist and directory vehicle links.
CREATE TABLE public.parking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  label text NOT NULL,
  slot_type text NOT NULL,
  location_note text,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT parking_slots_label_check
    CHECK (char_length(label) BETWEEN 1 AND 40 AND label = btrim(label)),
  CONSTRAINT parking_slots_type_check
    CHECK (slot_type IN ('car', 'two_wheeler', 'visitor', 'ev')),
  CONSTRAINT parking_slots_location_check
    CHECK (location_note IS NULL OR (
      char_length(location_note) BETWEEN 1 AND 200 AND location_note = btrim(location_note)
    )),
  CONSTRAINT parking_slots_archive_check CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CONSTRAINT parking_slots_version_check CHECK (version >= 1),
  CONSTRAINT parking_slots_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT parking_slots_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX parking_slots_active_label_key
  ON public.parking_slots (society_id, lower(label)) WHERE archived_at IS NULL;
CREATE INDEX parking_slots_type_idx ON public.parking_slots (society_id, slot_type, label);
CREATE INDEX parking_slots_created_by_idx ON public.parking_slots (created_by);
CREATE INDEX parking_slots_updated_by_idx ON public.parking_slots (updated_by);
CREATE INDEX parking_slots_archived_by_idx ON public.parking_slots (archived_by);

CREATE TABLE public.parking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  queue_seq bigint GENERATED ALWAYS AS IDENTITY,
  unit_id uuid NOT NULL,
  slot_type text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'waiting',
  allocation_id uuid,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT parking_requests_type_check CHECK (slot_type IN ('car', 'two_wheeler', 'ev')),
  CONSTRAINT parking_requests_note_check
    CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 300 AND note = btrim(note))),
  CONSTRAINT parking_requests_status_check CHECK (status IN ('waiting', 'fulfilled', 'cancelled')),
  CONSTRAINT parking_requests_closed_check CHECK (
    (status = 'waiting' AND closed_at IS NULL AND closed_by IS NULL AND allocation_id IS NULL)
    OR (status = 'cancelled' AND closed_at IS NOT NULL AND closed_by IS NOT NULL AND allocation_id IS NULL)
    OR (status = 'fulfilled' AND closed_at IS NOT NULL AND closed_by IS NOT NULL AND allocation_id IS NOT NULL)
  ),
  CONSTRAINT parking_requests_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_requests_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT parking_requests_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX parking_requests_waiting_unit_type_key
  ON public.parking_requests (society_id, unit_id, slot_type) WHERE status = 'waiting';
CREATE INDEX parking_requests_unit_idx ON public.parking_requests (society_id, unit_id);
CREATE INDEX parking_requests_queue_idx
  ON public.parking_requests (society_id, slot_type, status, queue_seq);
CREATE INDEX parking_requests_allocation_idx ON public.parking_requests (society_id, allocation_id);
CREATE INDEX parking_requests_created_by_idx ON public.parking_requests (created_by);
CREATE INDEX parking_requests_closed_by_idx ON public.parking_requests (closed_by);

CREATE TABLE public.parking_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  slot_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  waitlist_request_id uuid,
  skip_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT parking_allocations_skip_reason_check
    CHECK (skip_reason IS NULL OR (char_length(skip_reason) BETWEEN 1 AND 500 AND skip_reason = btrim(skip_reason))),
  CONSTRAINT parking_allocations_end_check
    CHECK ((ended_at IS NULL) = (ended_by IS NULL) AND (ended_at IS NULL OR ended_at >= started_at)),
  CONSTRAINT parking_allocations_slot_same_society_fkey
    FOREIGN KEY (society_id, slot_id) REFERENCES public.parking_slots (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_allocations_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_allocations_request_same_society_fkey
    FOREIGN KEY (society_id, waitlist_request_id)
    REFERENCES public.parking_requests (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_allocations_society_id_id_key UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX parking_allocations_active_slot_key
  ON public.parking_allocations (slot_id) WHERE ended_at IS NULL;
CREATE INDEX parking_allocations_slot_idx ON public.parking_allocations (society_id, slot_id);
CREATE INDEX parking_allocations_unit_idx ON public.parking_allocations (society_id, unit_id);
CREATE INDEX parking_allocations_request_idx
  ON public.parking_allocations (society_id, waitlist_request_id);
CREATE INDEX parking_allocations_started_by_idx ON public.parking_allocations (started_by);
CREATE INDEX parking_allocations_ended_by_idx ON public.parking_allocations (ended_by);

ALTER TABLE public.parking_requests ADD CONSTRAINT parking_requests_allocation_same_society_fkey
  FOREIGN KEY (society_id, allocation_id)
  REFERENCES public.parking_allocations (society_id, id) ON DELETE RESTRICT;

-- slot_type and vehicle_class are checked against the live rows by a trigger, so the
-- capacity rule is enforced by constraints even under concurrent link requests.
CREATE TABLE public.parking_vehicle_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  allocation_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  slot_type text NOT NULL,
  vehicle_class text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT parking_vehicle_links_slot_type_check CHECK (slot_type IN ('car', 'two_wheeler', 'ev')),
  CONSTRAINT parking_vehicle_links_class_check CHECK (vehicle_class IN ('four_wheeler', 'two_wheeler')),
  CONSTRAINT parking_vehicle_links_capacity_check
    CHECK (slot_type <> 'two_wheeler' OR vehicle_class = 'two_wheeler'),
  CONSTRAINT parking_vehicle_links_end_check CHECK ((ended_at IS NULL) = (ended_by IS NULL)),
  CONSTRAINT parking_vehicle_links_allocation_same_society_fkey
    FOREIGN KEY (society_id, allocation_id)
    REFERENCES public.parking_allocations (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_vehicle_links_vehicle_same_society_fkey
    FOREIGN KEY (society_id, vehicle_id)
    REFERENCES public.directory_vehicles (society_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX parking_vehicle_links_four_wheeler_key
  ON public.parking_vehicle_links (allocation_id)
  WHERE ended_at IS NULL AND vehicle_class = 'four_wheeler';
CREATE UNIQUE INDEX parking_vehicle_links_active_vehicle_key
  ON public.parking_vehicle_links (vehicle_id) WHERE ended_at IS NULL;
CREATE INDEX parking_vehicle_links_allocation_idx
  ON public.parking_vehicle_links (society_id, allocation_id);
CREATE INDEX parking_vehicle_links_vehicle_idx ON public.parking_vehicle_links (society_id, vehicle_id);
CREATE INDEX parking_vehicle_links_created_by_idx ON public.parking_vehicle_links (created_by);
CREATE INDEX parking_vehicle_links_ended_by_idx ON public.parking_vehicle_links (ended_by);

ALTER TABLE public.parking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_vehicle_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parking_slots, public.parking_requests, public.parking_allocations,
  public.parking_vehicle_links FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY parking_slots_no_direct_access ON public.parking_slots
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY parking_requests_no_direct_access ON public.parking_requests
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY parking_allocations_no_direct_access ON public.parking_allocations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY parking_vehicle_links_no_direct_access ON public.parking_vehicle_links
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER parking_slots_no_delete BEFORE DELETE ON public.parking_slots
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_slots_no_truncate BEFORE TRUNCATE ON public.parking_slots
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_requests_no_delete BEFORE DELETE ON public.parking_requests
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_requests_no_truncate BEFORE TRUNCATE ON public.parking_requests
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_allocations_no_delete BEFORE DELETE ON public.parking_allocations
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_allocations_no_truncate BEFORE TRUNCATE ON public.parking_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_vehicle_links_no_delete BEFORE DELETE ON public.parking_vehicle_links
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_vehicle_links_no_truncate BEFORE TRUNCATE ON public.parking_vehicle_links
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.parking_slot_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.slot_type <> OLD.slot_type OR NEW.society_id <> OLD.society_id) THEN
    RAISE EXCEPTION 'A parking slot type cannot change.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
    RAISE EXCEPTION 'An archived parking slot cannot be restored.' USING ERRCODE = '23514';
  END IF;
  IF NEW.archived_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.parking_allocations AS allocation
    WHERE allocation.slot_id = NEW.id AND allocation.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'End the slot allocation before archiving it.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.parking_slot_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER parking_slots_guard BEFORE INSERT OR UPDATE ON public.parking_slots
  FOR EACH ROW EXECUTE FUNCTION private.parking_slot_guard();

CREATE FUNCTION private.parking_allocation_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  slot public.parking_slots;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.slot_id <> OLD.slot_id OR NEW.unit_id <> OLD.unit_id OR NEW.society_id <> OLD.society_id
    OR (OLD.ended_at IS NOT NULL AND NEW.ended_at IS DISTINCT FROM OLD.ended_at)
  ) THEN
    RAISE EXCEPTION 'A parking allocation can only be ended.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO slot FROM public.parking_slots WHERE society_id = NEW.society_id AND id = NEW.slot_id;
    IF slot.slot_type = 'visitor' THEN
      RAISE EXCEPTION 'Visitor slots cannot be allocated to a unit.' USING ERRCODE = '23514';
    END IF;
    IF slot.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Archived slots cannot be allocated.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.parking_allocation_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER parking_allocations_guard BEFORE INSERT OR UPDATE ON public.parking_allocations
  FOR EACH ROW EXECUTE FUNCTION private.parking_allocation_guard();

CREATE FUNCTION private.parking_vehicle_class(p_vehicle_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_vehicle_type = 'two_wheeler' THEN 'two_wheeler' ELSE 'four_wheeler' END
$$;
REVOKE ALL ON FUNCTION private.parking_vehicle_class(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_vehicle_link_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  allocation public.parking_allocations;
  slot_kind text;
  vehicle public.directory_vehicles;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.allocation_id <> OLD.allocation_id OR NEW.vehicle_id <> OLD.vehicle_id
      OR NEW.slot_type <> OLD.slot_type OR NEW.vehicle_class <> OLD.vehicle_class
      OR NEW.society_id <> OLD.society_id
      OR (OLD.ended_at IS NOT NULL AND NEW.ended_at IS DISTINCT FROM OLD.ended_at)
    THEN
      RAISE EXCEPTION 'A vehicle link can only be ended.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO allocation FROM public.parking_allocations
    WHERE society_id = NEW.society_id AND id = NEW.allocation_id;
  SELECT slot_type INTO slot_kind FROM public.parking_slots
    WHERE society_id = NEW.society_id AND id = allocation.slot_id;
  SELECT * INTO vehicle FROM public.directory_vehicles
    WHERE society_id = NEW.society_id AND id = NEW.vehicle_id;
  IF allocation.ended_at IS NOT NULL OR vehicle.status IS DISTINCT FROM 'active'
    OR vehicle.unit_id IS DISTINCT FROM allocation.unit_id
    OR NEW.slot_type IS DISTINCT FROM slot_kind
    OR NEW.vehicle_class IS DISTINCT FROM private.parking_vehicle_class(vehicle.vehicle_type)
  THEN
    RAISE EXCEPTION 'The vehicle cannot use this slot.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.parking_vehicle_link_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER parking_vehicle_links_guard BEFORE INSERT OR UPDATE ON public.parking_vehicle_links
  FOR EACH ROW EXECUTE FUNCTION private.parking_vehicle_link_guard();

CREATE FUNCTION private.parking_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'parking')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Parking access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.parking_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.parking_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.parking_authorize(p_society_id, p_roles, true);
END;
$$;
REVOKE ALL ON FUNCTION private.parking_write_begin(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_is_unit_resident(p_society_id uuid, p_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND membership.status = 'active'
      AND membership.user_id = auth.uid() AND 'resident' = ANY(membership.roles)
  )
$$;
REVOKE ALL ON FUNCTION private.parking_is_unit_resident(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_actor_role(p_society_id uuid, p_preferred text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'system'
    WHEN private.has_role(p_society_id, ARRAY[p_preferred]::text[]) THEN p_preferred
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    WHEN private.has_role(p_society_id, ARRAY['guard']::text[]) THEN 'guard'
    ELSE 'resident' END
$$;
REVOKE ALL ON FUNCTION private.parking_actor_role(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_audit(
  p_society_id uuid, p_actor_role text, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), private.parking_actor_role(p_society_id, p_actor_role),
    'parking.' || p_action, p_entity_type, p_entity_id::text, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.parking_audit(uuid, text, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_notify_unit(
  p_society_id uuid, p_unit_id uuid, p_type text, p_title text, p_body text,
  p_entity_id uuid, p_request_id text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  recipient uuid;
  sent integer := 0;
BEGIN
  FOR recipient IN SELECT DISTINCT membership.user_id FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND 'resident' = ANY(membership.roles)
      AND membership.user_id IS DISTINCT FROM auth.uid()
  LOOP
    PERFORM private.create_notification(p_society_id, recipient, p_type, p_title, p_body,
      'parking', p_entity_id, p_request_id);
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$$;
REVOKE ALL ON FUNCTION private.parking_notify_unit(uuid, uuid, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.parking_settings_update(
  p_society_id uuid, p_photo_retention_days integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_photo_retention_days IS NULL OR p_photo_retention_days NOT BETWEEN 1 AND 90 THEN
    RAISE EXCEPTION 'Photo retention must be between 1 and 90 days.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.module_configs
  SET settings = jsonb_build_object('photo_retention_days', p_photo_retention_days),
    updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'parking';
  PERFORM private.parking_audit(p_society_id, 'admin', 'settings.update', 'module', NULL,
    jsonb_build_object('photo_retention_days', p_photo_retention_days), p_request_id);
END;
$$;

CREATE FUNCTION public.parking_slot_save(
  p_society_id uuid, p_slot_id uuid, p_label text, p_slot_type text, p_location_note text,
  p_expected_version integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  slot public.parking_slots;
  clean_label text := btrim(COALESCE(p_label, ''));
  clean_note text := NULLIF(btrim(COALESCE(p_location_note, '')), '');
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF char_length(clean_label) NOT BETWEEN 1 AND 40
    OR (clean_note IS NOT NULL AND char_length(clean_note) > 200)
  THEN
    RAISE EXCEPTION 'Enter a slot label up to 40 characters and a location note up to 200.'
      USING ERRCODE = '22023';
  END IF;
  IF p_slot_id IS NULL THEN
    IF p_client_request_id IS NULL OR p_slot_type IS NULL
      OR p_slot_type NOT IN ('car', 'two_wheeler', 'visitor', 'ev')
    THEN
      RAISE EXCEPTION 'Choose a slot type.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO slot FROM public.parking_slots
      WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN slot.id; END IF;
    INSERT INTO public.parking_slots (
      society_id, label, slot_type, location_note, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, clean_label, p_slot_type, clean_note, p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO slot;
    PERFORM private.parking_audit(p_society_id, 'admin', 'slot.create', 'parking_slot', slot.id,
      jsonb_build_object('label', slot.label, 'slot_type', slot.slot_type,
        'location_note', slot.location_note), p_request_id);
    RETURN slot.id;
  END IF;
  SELECT * INTO slot FROM public.parking_slots
    WHERE society_id = p_society_id AND id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parking slot not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR slot.version <> p_expected_version THEN
    RAISE EXCEPTION 'This slot changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF slot.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived slots cannot be edited.' USING ERRCODE = '23514';
  END IF;
  IF p_slot_type IS NOT NULL AND p_slot_type <> slot.slot_type THEN
    RAISE EXCEPTION 'A parking slot type cannot change.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.parking_slots
  SET label = clean_label, location_note = clean_note, version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = slot.id RETURNING * INTO slot;
  PERFORM private.parking_audit(p_society_id, 'admin', 'slot.update', 'parking_slot', slot.id,
    jsonb_build_object('label', slot.label, 'location_note', slot.location_note,
      'version', slot.version), p_request_id);
  RETURN slot.id;
END;
$$;

CREATE FUNCTION public.parking_slot_archive(
  p_society_id uuid, p_slot_id uuid, p_expected_version integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  slot public.parking_slots;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO slot FROM public.parking_slots
    WHERE society_id = p_society_id AND id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parking slot not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR slot.version <> p_expected_version THEN
    RAISE EXCEPTION 'This slot changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF slot.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This slot is already archived.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.parking_slots
  SET archived_at = clock_timestamp(), archived_by = auth.uid(), version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = slot.id;
  PERFORM private.parking_audit(p_society_id, 'admin', 'slot.archive', 'parking_slot', slot.id,
    jsonb_build_object('label', slot.label, 'slot_type', slot.slot_type), p_request_id);
END;
$$;

CREATE FUNCTION public.parking_request_create(
  p_society_id uuid, p_unit_id uuid, p_slot_type text, p_note text,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.parking_requests;
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['resident']::text[]);
  IF p_client_request_id IS NULL OR p_slot_type IS NULL
    OR p_slot_type NOT IN ('car', 'two_wheeler', 'ev')
    OR (clean_note IS NOT NULL AND char_length(clean_note) > 300)
  THEN
    RAISE EXCEPTION 'Choose a car, two-wheeler or EV slot and a note up to 300 characters.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.parking_is_unit_resident(p_society_id, p_unit_id) THEN
    RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO request FROM public.parking_requests
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN request.id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('parking:queue:' || p_society_id::text || ':' || p_slot_type, 0));
  IF EXISTS (
    SELECT 1 FROM public.parking_requests
    WHERE society_id = p_society_id AND unit_id = p_unit_id AND slot_type = p_slot_type AND status = 'waiting'
  ) THEN
    RAISE EXCEPTION 'This unit is already waiting for that slot type.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.parking_requests (
    society_id, unit_id, slot_type, note, client_request_id, created_by
  ) VALUES (
    p_society_id, p_unit_id, p_slot_type, clean_note, p_client_request_id, auth.uid()
  ) RETURNING * INTO request;
  PERFORM private.parking_audit(p_society_id, 'resident', 'request.create', 'parking_request', request.id,
    jsonb_build_object('unit_id', p_unit_id, 'slot_type', p_slot_type, 'queue_seq', request.queue_seq),
    p_request_id);
  RETURN request.id;
END;
$$;

CREATE FUNCTION public.parking_request_cancel(
  p_society_id uuid, p_waitlist_request_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request public.parking_requests;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO request FROM public.parking_requests
    WHERE society_id = p_society_id AND id = p_waitlist_request_id;
  IF NOT FOUND OR NOT private.parking_is_unit_resident(p_society_id, request.unit_id) THEN
    RAISE EXCEPTION 'Parking request not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('parking:queue:' || p_society_id::text || ':' || request.slot_type, 0));
  SELECT * INTO request FROM public.parking_requests WHERE id = p_waitlist_request_id FOR UPDATE;
  IF request.status <> 'waiting' THEN
    RAISE EXCEPTION 'Only a waiting request can be cancelled.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.parking_requests
  SET status = 'cancelled', closed_at = clock_timestamp(), closed_by = auth.uid()
  WHERE id = request.id;
  PERFORM private.parking_audit(p_society_id, 'resident', 'request.cancel', 'parking_request', request.id,
    jsonb_build_object('unit_id', request.unit_id, 'slot_type', request.slot_type), p_request_id);
END;
$$;

-- Allocation fulfils the unit's oldest waiting request for the slot type. Any allocation
-- that does not go to the unit at the head of that queue needs a written skip reason.
CREATE FUNCTION public.parking_allocate(
  p_society_id uuid, p_slot_id uuid, p_unit_id uuid, p_skip_reason text, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  slot public.parking_slots;
  head public.parking_requests;
  own public.parking_requests;
  new_allocation_id uuid;
  clean_reason text := NULLIF(btrim(COALESCE(p_skip_reason, '')), '');
  skipped boolean := false;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO slot FROM public.parking_slots
    WHERE society_id = p_society_id AND id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parking slot not found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.units WHERE society_id = p_society_id AND id = p_unit_id) THEN
    RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
  END IF;
  IF slot.slot_type = 'visitor' THEN
    RAISE EXCEPTION 'Visitor slots cannot be allocated to a unit.' USING ERRCODE = '23514';
  END IF;
  IF slot.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived slots cannot be allocated.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.parking_allocations WHERE slot_id = slot.id AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This slot is already allocated.' USING ERRCODE = '23505';
  END IF;
  IF clean_reason IS NOT NULL AND char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'Keep the skip reason within 500 characters.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('parking:queue:' || p_society_id::text || ':' || slot.slot_type, 0));
  SELECT * INTO head FROM public.parking_requests
    WHERE society_id = p_society_id AND slot_type = slot.slot_type AND status = 'waiting'
    ORDER BY queue_seq LIMIT 1 FOR UPDATE;
  skipped := FOUND AND head.unit_id <> p_unit_id;
  IF skipped AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'Enter a reason for allocating out of waitlist order.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO own FROM public.parking_requests
    WHERE society_id = p_society_id AND unit_id = p_unit_id AND slot_type = slot.slot_type
      AND status = 'waiting'
    ORDER BY queue_seq LIMIT 1 FOR UPDATE;
  INSERT INTO public.parking_allocations (
    society_id, slot_id, unit_id, waitlist_request_id, skip_reason, started_by
  ) VALUES (
    p_society_id, slot.id, p_unit_id, own.id, CASE WHEN skipped THEN clean_reason END, auth.uid()
  ) RETURNING id INTO new_allocation_id;
  IF own.id IS NOT NULL THEN
    UPDATE public.parking_requests
    SET status = 'fulfilled', allocation_id = new_allocation_id,
      closed_at = clock_timestamp(), closed_by = auth.uid()
    WHERE id = own.id;
  END IF;
  PERFORM private.parking_audit(p_society_id, 'admin', 'allocation.create', 'parking_allocation',
    new_allocation_id, jsonb_build_object(
      'slot_id', slot.id, 'slot_label', slot.label, 'unit_id', p_unit_id,
      'waitlist_request_id', own.id, 'skipped_request_id', CASE WHEN skipped THEN head.id END,
      'skip_reason', CASE WHEN skipped THEN clean_reason END
    ), p_request_id);
  PERFORM private.parking_notify_unit(p_society_id, p_unit_id, 'parking_allocated',
    'Parking slot allocated', 'Slot ' || slot.label || ' is now allocated to your unit.',
    new_allocation_id, p_request_id);
  RETURN new_allocation_id;
END;
$$;

CREATE FUNCTION public.parking_allocation_end(
  p_society_id uuid, p_allocation_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  allocation public.parking_allocations;
  slot_label text;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO allocation FROM public.parking_allocations
    WHERE society_id = p_society_id AND id = p_allocation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found.' USING ERRCODE = 'P0002'; END IF;
  IF allocation.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'This allocation has already ended.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.parking_vehicle_links SET ended_at = clock_timestamp(), ended_by = auth.uid()
  WHERE society_id = p_society_id AND allocation_id = allocation.id AND ended_at IS NULL;
  UPDATE public.parking_allocations SET ended_at = clock_timestamp(), ended_by = auth.uid()
  WHERE id = allocation.id;
  SELECT label INTO slot_label FROM public.parking_slots WHERE id = allocation.slot_id;
  PERFORM private.parking_audit(p_society_id, 'admin', 'allocation.end', 'parking_allocation',
    allocation.id, jsonb_build_object('slot_id', allocation.slot_id, 'unit_id', allocation.unit_id),
    p_request_id);
  PERFORM private.parking_notify_unit(p_society_id, allocation.unit_id, 'parking_allocation_ended',
    'Parking allocation ended', 'Slot ' || slot_label || ' is no longer allocated to your unit.',
    allocation.id, p_request_id);
END;
$$;

CREATE FUNCTION public.parking_vehicle_link_set(
  p_society_id uuid, p_allocation_id uuid, p_vehicle_id uuid, p_linked boolean, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  allocation public.parking_allocations;
  slot public.parking_slots;
  vehicle public.directory_vehicles;
  link_id uuid;
  vehicle_kind text;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin', 'resident']::text[]);
  IF NOT private.module_enabled(p_society_id, 'directory') THEN
    RAISE EXCEPTION 'Vehicle links need the Directory module.' USING ERRCODE = '42501';
  END IF;
  IF p_linked IS NULL THEN
    RAISE EXCEPTION 'Choose whether the vehicle uses this slot.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO allocation FROM public.parking_allocations
    WHERE society_id = p_society_id AND id = p_allocation_id AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT (
    private.has_role(p_society_id, ARRAY['admin']::text[])
    OR private.parking_is_unit_resident(p_society_id, allocation.unit_id)
  ) THEN
    RAISE EXCEPTION 'Allocation not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO slot FROM public.parking_slots WHERE id = allocation.slot_id;
  IF NOT p_linked THEN
    UPDATE public.parking_vehicle_links SET ended_at = clock_timestamp(), ended_by = auth.uid()
    WHERE society_id = p_society_id AND allocation_id = allocation.id AND vehicle_id = p_vehicle_id
      AND ended_at IS NULL
    RETURNING id INTO link_id;
    IF link_id IS NULL THEN
      RAISE EXCEPTION 'That vehicle is not linked to this slot.' USING ERRCODE = 'P0002';
    END IF;
    PERFORM private.parking_audit(p_society_id, 'resident', 'vehicle.unlink', 'parking_allocation',
      allocation.id, jsonb_build_object('vehicle_id', p_vehicle_id, 'slot_id', slot.id), p_request_id);
    RETURN;
  END IF;
  SELECT * INTO vehicle FROM public.directory_vehicles
    WHERE society_id = p_society_id AND id = p_vehicle_id AND unit_id = allocation.unit_id
      AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found.' USING ERRCODE = 'P0002'; END IF;
  vehicle_kind := private.parking_vehicle_class(vehicle.vehicle_type);
  IF EXISTS (
    SELECT 1 FROM public.parking_vehicle_links
    WHERE society_id = p_society_id AND vehicle_id = vehicle.id AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This vehicle already uses a slot.' USING ERRCODE = '23505';
  END IF;
  IF slot.slot_type = 'two_wheeler' AND vehicle_kind <> 'two_wheeler' THEN
    RAISE EXCEPTION 'A two-wheeler slot holds two-wheelers only.' USING ERRCODE = '23514';
  END IF;
  IF vehicle_kind = 'four_wheeler' AND EXISTS (
    SELECT 1 FROM public.parking_vehicle_links
    WHERE society_id = p_society_id AND allocation_id = allocation.id AND ended_at IS NULL
      AND vehicle_class = 'four_wheeler'
  ) THEN
    RAISE EXCEPTION 'This slot already holds a four-wheeler.' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.parking_vehicle_links (
    society_id, allocation_id, vehicle_id, slot_type, vehicle_class, created_by
  ) VALUES (
    p_society_id, allocation.id, vehicle.id, slot.slot_type, vehicle_kind, auth.uid()
  );
  PERFORM private.parking_audit(p_society_id, 'resident', 'vehicle.link', 'parking_allocation',
    allocation.id, jsonb_build_object('vehicle_id', vehicle.id, 'slot_id', slot.id,
      'vehicle_class', vehicle_kind), p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.parking_settings_update(uuid, integer, text),
  public.parking_slot_save(uuid, uuid, text, text, text, integer, uuid, text),
  public.parking_slot_archive(uuid, uuid, integer, text),
  public.parking_request_create(uuid, uuid, text, text, uuid, text),
  public.parking_request_cancel(uuid, uuid, text),
  public.parking_allocate(uuid, uuid, uuid, text, text),
  public.parking_allocation_end(uuid, uuid, text),
  public.parking_vehicle_link_set(uuid, uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parking_settings_update(uuid, integer, text),
  public.parking_slot_save(uuid, uuid, text, text, text, integer, uuid, text),
  public.parking_slot_archive(uuid, uuid, integer, text),
  public.parking_request_create(uuid, uuid, text, text, uuid, text),
  public.parking_request_cancel(uuid, uuid, text),
  public.parking_allocate(uuid, uuid, uuid, text, text),
  public.parking_allocation_end(uuid, uuid, text),
  public.parking_vehicle_link_set(uuid, uuid, uuid, boolean, text)
  TO authenticated;
