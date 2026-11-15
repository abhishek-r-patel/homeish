-- Parking visitor passes, wrong-parking reports, private photos, retention and read models.
CREATE TABLE public.parking_visitor_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  slot_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  visitor_name text NOT NULL,
  vehicle_number text,
  visitor_entry_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT parking_visitor_passes_name_check
    CHECK (char_length(visitor_name) BETWEEN 1 AND 120 AND visitor_name = btrim(visitor_name)),
  CONSTRAINT parking_visitor_passes_vehicle_check
    CHECK (vehicle_number IS NULL OR (
      char_length(vehicle_number) BETWEEN 4 AND 16 AND vehicle_number ~ '^[A-Z0-9]+$'
    )),
  CONSTRAINT parking_visitor_passes_window_check
    CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '24 hours'),
  CONSTRAINT parking_visitor_passes_status_check CHECK (
    (status = 'active' AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  CONSTRAINT parking_visitor_passes_slot_same_society_fkey
    FOREIGN KEY (society_id, slot_id) REFERENCES public.parking_slots (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_visitor_passes_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_visitor_passes_entry_same_society_fkey
    FOREIGN KEY (society_id, visitor_entry_id)
    REFERENCES public.visitor_entries (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_visitor_passes_actor_request_key
    UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT parking_visitor_passes_no_overlap EXCLUDE USING gist (
    slot_id extensions.gist_uuid_ops WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'active')
);
CREATE INDEX parking_visitor_passes_slot_idx
  ON public.parking_visitor_passes (society_id, slot_id, starts_at);
CREATE INDEX parking_visitor_passes_unit_idx
  ON public.parking_visitor_passes (society_id, unit_id, ends_at);
CREATE INDEX parking_visitor_passes_window_idx
  ON public.parking_visitor_passes (society_id, status, ends_at);
CREATE INDEX parking_visitor_passes_entry_idx
  ON public.parking_visitor_passes (society_id, visitor_entry_id);
CREATE INDEX parking_visitor_passes_created_by_idx ON public.parking_visitor_passes (created_by);
CREATE INDEX parking_visitor_passes_cancelled_by_idx ON public.parking_visitor_passes (cancelled_by);

CREATE TABLE public.parking_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  slot_id uuid,
  vehicle_number text,
  note text,
  photo_path text,
  photo_content_type text,
  photo_size_bytes integer,
  photo_deleted_at timestamptz,
  matched_unit_id uuid,
  reporter_role text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT parking_reports_target_check CHECK (slot_id IS NOT NULL OR vehicle_number IS NOT NULL),
  CONSTRAINT parking_reports_vehicle_check
    CHECK (vehicle_number IS NULL OR (
      char_length(vehicle_number) BETWEEN 4 AND 16 AND vehicle_number ~ '^[A-Z0-9]+$'
    )),
  CONSTRAINT parking_reports_note_check
    CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 500 AND note = btrim(note))),
  CONSTRAINT parking_reports_photo_check CHECK (
    (photo_path IS NULL AND photo_content_type IS NULL AND photo_size_bytes IS NULL AND photo_deleted_at IS NULL)
    OR (photo_path IS NOT NULL AND photo_content_type IN ('image/jpeg', 'image/png')
      AND photo_size_bytes BETWEEN 1 AND 5242880)
  ),
  CONSTRAINT parking_reports_reporter_role_check CHECK (reporter_role IN ('guard', 'resident')),
  CONSTRAINT parking_reports_status_check CHECK (
    (status = 'open' AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_note IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  ),
  CONSTRAINT parking_reports_resolution_check CHECK (
    resolution_note IS NULL OR (char_length(resolution_note) BETWEEN 1 AND 500 AND resolution_note = btrim(resolution_note))
  ),
  CONSTRAINT parking_reports_slot_same_society_fkey
    FOREIGN KEY (society_id, slot_id) REFERENCES public.parking_slots (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_reports_unit_same_society_fkey
    FOREIGN KEY (society_id, matched_unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT parking_reports_photo_path_key UNIQUE (photo_path),
  CONSTRAINT parking_reports_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX parking_reports_created_idx ON public.parking_reports (society_id, created_at DESC);
CREATE INDEX parking_reports_slot_idx ON public.parking_reports (society_id, slot_id);
CREATE INDEX parking_reports_unit_idx ON public.parking_reports (society_id, matched_unit_id);
CREATE INDEX parking_reports_created_by_idx ON public.parking_reports (created_by, created_at DESC);
CREATE INDEX parking_reports_resolved_by_idx ON public.parking_reports (resolved_by);
CREATE INDEX parking_reports_photo_retention_idx
  ON public.parking_reports (created_at) WHERE photo_path IS NOT NULL AND photo_deleted_at IS NULL;

ALTER TABLE public.parking_visitor_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parking_visitor_passes, public.parking_reports
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY parking_visitor_passes_no_direct_access ON public.parking_visitor_passes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY parking_reports_no_direct_access ON public.parking_reports
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER parking_visitor_passes_no_delete BEFORE DELETE ON public.parking_visitor_passes
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_visitor_passes_no_truncate BEFORE TRUNCATE ON public.parking_visitor_passes
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_reports_no_delete BEFORE DELETE ON public.parking_reports
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER parking_reports_no_truncate BEFORE TRUNCATE ON public.parking_reports
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.parking_pass_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.slot_id <> OLD.slot_id OR NEW.unit_id <> OLD.unit_id OR NEW.society_id <> OLD.society_id
      OR NEW.starts_at <> OLD.starts_at OR NEW.ends_at <> OLD.ends_at OR OLD.status <> 'active'
    THEN
      RAISE EXCEPTION 'A visitor parking pass can only be cancelled.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.parking_slots
    WHERE society_id = NEW.society_id AND id = NEW.slot_id AND slot_type = 'visitor' AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Visitor passes need an active visitor slot.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.parking_pass_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER parking_visitor_passes_guard BEFORE INSERT OR UPDATE ON public.parking_visitor_passes
  FOR EACH ROW EXECUTE FUNCTION private.parking_pass_guard();

CREATE FUNCTION private.parking_normalize_vehicle(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NULLIF(upper(regexp_replace(btrim(COALESCE(p_value, '')), '[[:space:]-]', '', 'g')), '')
$$;
REVOKE ALL ON FUNCTION private.parking_normalize_vehicle(text) FROM PUBLIC, anon, authenticated, service_role;

-- Same trust conditions as directory_guard_vehicle_lookup: only verified vehicles of
-- active members who still actively occupy the vehicle's unit identify a unit.
CREATE FUNCTION private.parking_vehicle_matchable(p_vehicle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.directory_vehicles vehicle
    JOIN public.memberships membership
      ON membership.id = vehicle.membership_id AND membership.society_id = vehicle.society_id
    JOIN public.unit_occupants occupant
      ON occupant.society_id = vehicle.society_id AND occupant.unit_id = vehicle.unit_id
      AND occupant.membership_id = vehicle.membership_id
    WHERE vehicle.id = p_vehicle_id
      AND vehicle.status = 'active'
      AND vehicle.verified_at IS NOT NULL
      AND membership.status = 'active'
      AND occupant.status = 'active'
  )
$$;
REVOKE ALL ON FUNCTION private.parking_vehicle_matchable(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_photo_retention_days(p_society_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT (settings ->> 'photo_retention_days')::integer FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'parking'
  ), 3)
$$;
REVOKE ALL ON FUNCTION private.parking_photo_retention_days(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_can_read_report(p_report public.parking_reports)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.has_role(p_report.society_id, ARRAY['admin', 'committee']::text[])
    OR p_report.created_by = auth.uid()
    OR (p_report.matched_unit_id IS NOT NULL
      AND private.parking_is_unit_resident(p_report.society_id, p_report.matched_unit_id))
$$;
REVOKE ALL ON FUNCTION private.parking_can_read_report(public.parking_reports)
  FROM PUBLIC, anon, authenticated, service_role;

-- Photo paths: <society>/reports/<uploader>/<uuid>.(jpg|png). Unattached uploads stay
-- visible only to their uploader and are purged after 24 hours.
CREATE FUNCTION private.parking_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  uploader_id uuid;
  report public.parking_reports;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/reports/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
  ) THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  uploader_id := split_part(p_path, '/', 3)::uuid;
  IF auth.uid() IS NULL OR NOT private.module_enabled(target_society_id, 'parking')
    OR NOT private.is_member(target_society_id)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived')
  THEN RETURN false; END IF;
  SELECT * INTO report FROM public.parking_reports AS item
    WHERE item.society_id = target_society_id AND item.photo_path = p_path;
  IF p_write THEN
    RETURN report.id IS NULL AND uploader_id = auth.uid()
      AND private.society_writable(target_society_id)
      AND private.has_role(target_society_id, ARRAY['guard', 'resident']::text[]);
  END IF;
  IF report.id IS NULL THEN
    RETURN uploader_id = auth.uid();
  END IF;
  RETURN report.photo_deleted_at IS NULL
    AND report.created_at + make_interval(days => private.parking_photo_retention_days(target_society_id))
      > clock_timestamp()
    AND private.parking_can_read_report(report);
END;
$$;
REVOKE ALL ON FUNCTION private.parking_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.parking_file_access(text, boolean) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parking-photos', 'parking-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']::text[]);
CREATE POLICY parking_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parking-photos' AND private.parking_file_access(name, false));
CREATE POLICY parking_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parking-photos' AND private.parking_file_access(name, true));

CREATE FUNCTION public.parking_photo_upload_path(
  p_society_id uuid, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  path text;
BEGIN
  PERFORM private.parking_authorize(p_society_id, ARRAY['guard', 'resident']::text[], true);
  IF p_content_type IS NULL OR p_content_type NOT IN ('image/jpeg', 'image/png')
    OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Use a JPG or PNG photo up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  path := p_society_id::text || '/reports/' || auth.uid()::text || '/' || gen_random_uuid()::text
    || CASE p_content_type WHEN 'image/jpeg' THEN '.jpg' ELSE '.png' END;
  IF NOT COALESCE(private.parking_file_access(path, true), false) THEN
    RAISE EXCEPTION 'Parking photo upload is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN path;
END;
$$;

CREATE FUNCTION public.parking_photo_access(p_society_id uuid, p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.parking_authorize(p_society_id, ARRAY['admin', 'committee', 'guard', 'resident']::text[], false);
  RETURN split_part(COALESCE(p_path, ''), '/', 1) = p_society_id::text
    AND COALESCE(private.parking_file_access(p_path, false), false);
END;
$$;

CREATE FUNCTION public.parking_pass_create(
  p_society_id uuid, p_unit_id uuid, p_slot_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_visitor_name text, p_vehicle_number text, p_visitor_entry_id uuid,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pass public.parking_visitor_passes;
  candidate public.parking_slots;
  chosen_slot_id uuid;
  clean_name text := btrim(COALESCE(p_visitor_name, ''));
  clean_vehicle text := private.parking_normalize_vehicle(p_vehicle_number);
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['resident']::text[]);
  IF NOT private.module_enabled(p_society_id, 'visitor') THEN
    RAISE EXCEPTION 'Visitor parking passes need the Visitors module.' USING ERRCODE = '23514';
  END IF;
  IF p_client_request_id IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR (clean_vehicle IS NOT NULL AND (char_length(clean_vehicle) NOT BETWEEN 4 AND 16
      OR clean_vehicle !~ '^[A-Z0-9]+$'))
    OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at
    OR p_ends_at > p_starts_at + interval '24 hours'
    OR p_starts_at < now_at - interval '15 minutes' OR p_starts_at > now_at + interval '30 days'
  THEN
    RAISE EXCEPTION 'Enter a visitor name and a pass of up to 24 hours starting within 30 days.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.parking_is_unit_resident(p_society_id, p_unit_id) THEN
    RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO pass FROM public.parking_visitor_passes
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN pass.id; END IF;
  IF p_visitor_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.visitor_entries
    WHERE society_id = p_society_id AND id = p_visitor_entry_id AND unit_id = p_unit_id
      AND status IN ('pending', 'approved', 'checked_in')
  ) THEN
    RAISE EXCEPTION 'Visitor entry not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_slot_id IS NOT NULL THEN
    SELECT * INTO candidate FROM public.parking_slots
      WHERE society_id = p_society_id AND id = p_slot_id AND slot_type = 'visitor' AND archived_at IS NULL
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Visitor slot not found.' USING ERRCODE = 'P0002'; END IF;
    chosen_slot_id := candidate.id;
  ELSE
    FOR candidate IN SELECT * FROM public.parking_slots
      WHERE society_id = p_society_id AND slot_type = 'visitor' AND archived_at IS NULL
      ORDER BY lower(label), id FOR UPDATE
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.parking_visitor_passes AS existing
        WHERE existing.slot_id = candidate.id AND existing.status = 'active'
          AND tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      ) THEN
        chosen_slot_id := candidate.id;
        EXIT;
      END IF;
    END LOOP;
    IF chosen_slot_id IS NULL THEN
      RAISE EXCEPTION 'No visitor slot is free for that time.' USING ERRCODE = '23P01';
    END IF;
  END IF;
  INSERT INTO public.parking_visitor_passes (
    society_id, slot_id, unit_id, visitor_name, vehicle_number, visitor_entry_id,
    starts_at, ends_at, client_request_id, created_by
  ) VALUES (
    p_society_id, chosen_slot_id, p_unit_id, clean_name, clean_vehicle, p_visitor_entry_id,
    p_starts_at, p_ends_at, p_client_request_id, auth.uid()
  ) RETURNING * INTO pass;
  PERFORM private.parking_audit(p_society_id, 'resident', 'pass.create', 'parking_visitor_pass', pass.id,
    jsonb_build_object('slot_id', pass.slot_id, 'unit_id', pass.unit_id, 'starts_at', pass.starts_at,
      'ends_at', pass.ends_at, 'visitor_entry_id', pass.visitor_entry_id), p_request_id);
  RETURN pass.id;
END;
$$;

CREATE FUNCTION public.parking_pass_cancel(p_society_id uuid, p_pass_id uuid, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pass public.parking_visitor_passes;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO pass FROM public.parking_visitor_passes
    WHERE society_id = p_society_id AND id = p_pass_id FOR UPDATE;
  IF NOT FOUND OR NOT private.parking_is_unit_resident(p_society_id, pass.unit_id) THEN
    RAISE EXCEPTION 'Visitor pass not found.' USING ERRCODE = 'P0002';
  END IF;
  IF pass.status <> 'active' OR pass.ends_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Only an upcoming or current pass can be cancelled.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.parking_visitor_passes
  SET status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = auth.uid()
  WHERE id = pass.id;
  PERFORM private.parking_audit(p_society_id, 'resident', 'pass.cancel', 'parking_visitor_pass', pass.id,
    jsonb_build_object('slot_id', pass.slot_id, 'unit_id', pass.unit_id), p_request_id);
END;
$$;

CREATE FUNCTION public.parking_report_create(
  p_society_id uuid, p_slot_id uuid, p_vehicle_number text, p_note text, p_photo_path text,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  report public.parking_reports;
  slot public.parking_slots;
  clean_vehicle text := private.parking_normalize_vehicle(p_vehicle_number);
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  object_metadata jsonb;
  matched uuid;
  actor_role text;
  target_label text;
  recipient uuid;
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['guard', 'resident']::text[]);
  IF p_client_request_id IS NULL OR (p_slot_id IS NULL AND clean_vehicle IS NULL)
    OR (clean_vehicle IS NOT NULL AND (char_length(clean_vehicle) NOT BETWEEN 4 AND 16
      OR clean_vehicle !~ '^[A-Z0-9]+$'))
    OR (clean_note IS NOT NULL AND char_length(clean_note) > 500)
  THEN
    RAISE EXCEPTION 'Choose a slot or enter a vehicle number, with a note up to 500 characters.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO report FROM public.parking_reports
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN report.id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('parking-report:' || auth.uid()::text, 0));
  IF (SELECT count(*) FROM public.parking_reports
      WHERE created_by = auth.uid() AND created_at > clock_timestamp() - interval '1 hour') >= 10
  THEN
    RAISE EXCEPTION 'You can send 10 wrong-parking reports an hour.' USING ERRCODE = '54000';
  END IF;
  IF p_slot_id IS NOT NULL THEN
    SELECT * INTO slot FROM public.parking_slots
      WHERE society_id = p_society_id AND id = p_slot_id AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parking slot not found.' USING ERRCODE = 'P0002'; END IF;
    SELECT unit_id INTO matched FROM public.parking_allocations
      WHERE society_id = p_society_id AND slot_id = slot.id AND ended_at IS NULL;
  END IF;
  IF matched IS NULL AND clean_vehicle IS NOT NULL AND private.module_enabled(p_society_id, 'directory') THEN
    SELECT vehicle.unit_id INTO matched FROM public.directory_vehicles vehicle
      WHERE vehicle.society_id = p_society_id AND vehicle.registration_number = clean_vehicle
        AND private.parking_vehicle_matchable(vehicle.id)
      ORDER BY vehicle.verified_at DESC LIMIT 1;
  END IF;
  IF p_photo_path IS NOT NULL THEN
    IF split_part(p_photo_path, '/', 1) <> p_society_id::text
      OR split_part(p_photo_path, '/', 3) <> auth.uid()::text
      OR NOT COALESCE(private.parking_file_access(p_photo_path, true), false)
    THEN
      RAISE EXCEPTION 'Upload the report photo again.' USING ERRCODE = '22023';
    END IF;
    SELECT metadata INTO object_metadata FROM storage.objects
      WHERE bucket_id = 'parking-photos' AND name = p_photo_path;
    IF NOT FOUND OR COALESCE(object_metadata ->> 'mimetype', '') NOT IN ('image/jpeg', 'image/png')
      OR COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
      OR (object_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880
    THEN
      RAISE EXCEPTION 'Upload a JPG or PNG photo up to 5 MiB.' USING ERRCODE = '22023';
    END IF;
  END IF;
  actor_role := CASE WHEN private.has_role(p_society_id, ARRAY['guard']::text[]) THEN 'guard' ELSE 'resident' END;
  INSERT INTO public.parking_reports (
    society_id, slot_id, vehicle_number, note, photo_path, photo_content_type, photo_size_bytes,
    matched_unit_id, reporter_role, client_request_id, created_by
  ) VALUES (
    p_society_id, slot.id, clean_vehicle, clean_note, p_photo_path, object_metadata ->> 'mimetype',
    (object_metadata ->> 'size')::integer, matched, actor_role, p_client_request_id, auth.uid()
  ) RETURNING * INTO report;
  PERFORM private.parking_audit(p_society_id, actor_role, 'report.create', 'parking_report', report.id,
    jsonb_build_object('slot_id', report.slot_id, 'vehicle_number', report.vehicle_number,
      'matched_unit_id', report.matched_unit_id, 'has_photo', report.photo_path IS NOT NULL), p_request_id);
  target_label := CASE
    WHEN slot.id IS NOT NULL THEN 'slot ' || slot.label
    ELSE 'vehicle ' || clean_vehicle END;
  IF matched IS NOT NULL THEN
    PERFORM private.parking_notify_unit(p_society_id, matched, 'parking_report',
      'Wrong parking reported', 'A wrong-parking report mentions ' || target_label || '.',
      report.id, p_request_id);
  END IF;
  FOR recipient IN SELECT DISTINCT membership.user_id FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND 'admin' = ANY(membership.roles)
      AND membership.user_id IS DISTINCT FROM auth.uid()
  LOOP
    PERFORM private.create_notification(p_society_id, recipient, 'parking_report',
      'Wrong parking reported', 'A ' || actor_role || ' reported wrong parking at ' || target_label || '.',
      'parking_admin', report.id, p_request_id);
  END LOOP;
  RETURN report.id;
END;
$$;

CREATE FUNCTION public.parking_report_resolve(
  p_society_id uuid, p_report_id uuid, p_resolution_note text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  report public.parking_reports;
  clean_note text := NULLIF(btrim(COALESCE(p_resolution_note, '')), '');
BEGIN
  PERFORM private.parking_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF clean_note IS NOT NULL AND char_length(clean_note) > 500 THEN
    RAISE EXCEPTION 'Keep the resolution note within 500 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO report FROM public.parking_reports
    WHERE society_id = p_society_id AND id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found.' USING ERRCODE = 'P0002'; END IF;
  IF report.status <> 'open' THEN
    RAISE EXCEPTION 'This report is already resolved.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.parking_reports
  SET status = 'resolved', resolution_note = clean_note, resolved_at = clock_timestamp(),
    resolved_by = auth.uid()
  WHERE id = report.id;
  PERFORM private.parking_audit(p_society_id, 'admin', 'report.resolve', 'parking_report', report.id,
    jsonb_build_object('resolution_note', clean_note), p_request_id);
  IF report.created_by IS DISTINCT FROM auth.uid() AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = report.created_by AND status = 'active'
  ) THEN
    PERFORM private.create_notification(p_society_id, report.created_by, 'parking_report_resolved',
      'Parking report resolved', 'An administrator resolved your wrong-parking report.',
      CASE WHEN report.reporter_role = 'guard' THEN 'parking_guard' ELSE 'parking' END,
      report.id, p_request_id);
  END IF;
END;
$$;

CREATE FUNCTION private.parking_photo_visible_path(p_report public.parking_reports)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_report.photo_path IS NOT NULL AND p_report.photo_deleted_at IS NULL
    AND p_report.created_at + make_interval(days => private.parking_photo_retention_days(p_report.society_id))
      > clock_timestamp()
    THEN p_report.photo_path END
$$;
REVOKE ALL ON FUNCTION private.parking_photo_visible_path(public.parking_reports)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_report_json(p_report public.parking_reports)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_report.id,
    'slot_id', p_report.slot_id,
    'slot_label', (SELECT label FROM public.parking_slots WHERE id = p_report.slot_id),
    'vehicle_number', p_report.vehicle_number,
    'note', p_report.note,
    'status', p_report.status,
    'reporter_role', p_report.reporter_role,
    'matched_unit_number', CASE
      WHEN p_report.matched_unit_id IS NOT NULL
        AND (private.has_role(p_report.society_id, ARRAY['admin', 'committee']::text[])
          OR private.parking_is_unit_resident(p_report.society_id, p_report.matched_unit_id))
      THEN (SELECT number FROM public.units WHERE id = p_report.matched_unit_id)
    END,
    'photo_path', private.parking_photo_visible_path(p_report),
    'resolution_note', p_report.resolution_note,
    'created_at', p_report.created_at,
    'resolved_at', p_report.resolved_at,
    'is_mine', p_report.created_by = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION private.parking_report_json(public.parking_reports)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_pass_json(p_pass public.parking_visitor_passes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_pass.id,
    'slot_id', p_pass.slot_id,
    'slot_label', (SELECT label FROM public.parking_slots WHERE id = p_pass.slot_id),
    'unit_id', p_pass.unit_id,
    'unit_number', (SELECT number FROM public.units WHERE id = p_pass.unit_id),
    'visitor_name', p_pass.visitor_name,
    'vehicle_number', p_pass.vehicle_number,
    'visitor_entry_id', p_pass.visitor_entry_id,
    'starts_at', p_pass.starts_at,
    'ends_at', p_pass.ends_at,
    'status', p_pass.status
  )
$$;
REVOKE ALL ON FUNCTION private.parking_pass_json(public.parking_visitor_passes)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_allocation_vehicles(p_allocation public.parking_allocations)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN NOT private.module_enabled(p_allocation.society_id, 'directory') THEN '[]'::jsonb
  ELSE COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'vehicle_id', vehicle.id,
      'registration_number', vehicle.registration_number,
      'vehicle_type', vehicle.vehicle_type,
      'linked', COALESCE(link.allocation_id = p_allocation.id, false),
      'linked_elsewhere', link.allocation_id IS NOT NULL AND link.allocation_id <> p_allocation.id
    ) ORDER BY vehicle.registration_number)
    FROM public.directory_vehicles AS vehicle
    LEFT JOIN public.parking_vehicle_links AS link
      ON link.society_id = vehicle.society_id AND link.vehicle_id = vehicle.id AND link.ended_at IS NULL
    WHERE vehicle.society_id = p_allocation.society_id AND vehicle.unit_id = p_allocation.unit_id
      AND vehicle.status = 'active'
  ), '[]'::jsonb) END
$$;
REVOKE ALL ON FUNCTION private.parking_allocation_vehicles(public.parking_allocations)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.parking_allocation_json(p_allocation public.parking_allocations)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_allocation.id,
    'slot_id', slot.id,
    'slot_label', slot.label,
    'slot_type', slot.slot_type,
    'location_note', slot.location_note,
    'unit_id', p_allocation.unit_id,
    'unit_number', unit.number,
    'started_at', p_allocation.started_at,
    'skip_reason', p_allocation.skip_reason,
    'vehicles', private.parking_allocation_vehicles(p_allocation)
  )
  FROM public.parking_slots AS slot, public.units AS unit
  WHERE slot.id = p_allocation.slot_id AND unit.id = p_allocation.unit_id
$$;
REVOKE ALL ON FUNCTION private.parking_allocation_json(public.parking_allocations)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.parking_resident_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_ids uuid[];
  visitor_on boolean;
BEGIN
  PERFORM private.parking_authorize(p_society_id, ARRAY['resident']::text[], false);
  visitor_on := private.module_enabled(p_society_id, 'visitor');
  SELECT COALESCE(array_agg(DISTINCT occupant.unit_id), ARRAY[]::uuid[]) INTO unit_ids
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.status = 'active'
      AND membership.status = 'active' AND membership.user_id = auth.uid()
      AND 'resident' = ANY(membership.roles);
  RETURN jsonb_build_object(
    'directory_enabled', private.module_enabled(p_society_id, 'directory'),
    'visitor_enabled', visitor_on,
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'number', unit.number) ORDER BY unit.number)
      FROM public.units AS unit WHERE unit.society_id = p_society_id AND unit.id = ANY(unit_ids)
    ), '[]'::jsonb),
    'allocations', COALESCE((
      SELECT jsonb_agg(private.parking_allocation_json(allocation) ORDER BY allocation.started_at)
      FROM public.parking_allocations AS allocation
      WHERE allocation.society_id = p_society_id AND allocation.unit_id = ANY(unit_ids)
        AND allocation.ended_at IS NULL
    ), '[]'::jsonb),
    'requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', request.id, 'unit_id', request.unit_id,
        'unit_number', (SELECT number FROM public.units WHERE id = request.unit_id),
        'slot_type', request.slot_type, 'note', request.note, 'status', request.status,
        'created_at', request.created_at, 'closed_at', request.closed_at,
        'queue_position', CASE WHEN request.status = 'waiting' THEN (
          SELECT count(*) FROM public.parking_requests AS ahead
          WHERE ahead.society_id = p_society_id AND ahead.slot_type = request.slot_type
            AND ahead.status = 'waiting' AND ahead.queue_seq <= request.queue_seq
        ) END
      ) ORDER BY request.queue_seq DESC)
      FROM (
        SELECT * FROM public.parking_requests AS item
        WHERE item.society_id = p_society_id AND item.unit_id = ANY(unit_ids)
        ORDER BY item.queue_seq DESC LIMIT 50
      ) AS request
    ), '[]'::jsonb),
    'passes', COALESCE((
      SELECT jsonb_agg(private.parking_pass_json(pass) ORDER BY pass.starts_at)
      FROM public.parking_visitor_passes AS pass
      WHERE pass.society_id = p_society_id AND pass.unit_id = ANY(unit_ids)
        AND pass.status = 'active' AND pass.ends_at > clock_timestamp()
    ), '[]'::jsonb),
    'visitor_slots', CASE WHEN visitor_on THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', slot.id, 'label', slot.label,
        'location_note', slot.location_note) ORDER BY lower(slot.label))
      FROM public.parking_slots AS slot
      WHERE slot.society_id = p_society_id AND slot.slot_type = 'visitor' AND slot.archived_at IS NULL
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'visitor_entries', CASE WHEN visitor_on THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', entry.id, 'unit_id', entry.unit_id,
        'visitor_name', entry.visitor_name, 'status', entry.status, 'created_at', entry.created_at)
        ORDER BY entry.created_at DESC)
      FROM (
        SELECT * FROM public.visitor_entries AS item
        WHERE item.society_id = p_society_id AND item.unit_id = ANY(unit_ids)
          AND item.status IN ('pending', 'approved', 'checked_in')
          AND item.created_at > clock_timestamp() - interval '7 days'
        ORDER BY item.created_at DESC LIMIT 20
      ) AS entry
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'report_slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', slot.id, 'label', slot.label, 'slot_type', slot.slot_type)
        ORDER BY lower(slot.label))
      FROM public.parking_slots AS slot
      WHERE slot.society_id = p_society_id AND slot.archived_at IS NULL
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(private.parking_report_json(report) ORDER BY report.created_at DESC)
      FROM (
        SELECT * FROM public.parking_reports AS item
        WHERE item.society_id = p_society_id
          AND (item.created_by = auth.uid() OR item.matched_unit_id = ANY(unit_ids))
        ORDER BY item.created_at DESC LIMIT 50
      ) AS report
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.parking_admin_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.parking_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'directory_enabled', private.module_enabled(p_society_id, 'directory'),
    'visitor_enabled', private.module_enabled(p_society_id, 'visitor'),
    'settings', jsonb_build_object(
      'photo_retention_days', private.parking_photo_retention_days(p_society_id)
    ),
    'slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', slot.id, 'label', slot.label, 'slot_type', slot.slot_type,
        'location_note', slot.location_note, 'archived_at', slot.archived_at, 'version', slot.version,
        'allocation', (
          SELECT private.parking_allocation_json(allocation) FROM public.parking_allocations AS allocation
          WHERE allocation.slot_id = slot.id AND allocation.ended_at IS NULL
        )
      ) ORDER BY slot.archived_at IS NOT NULL, lower(slot.label))
      FROM (
        SELECT * FROM public.parking_slots AS item WHERE item.society_id = p_society_id
        ORDER BY item.archived_at IS NOT NULL, lower(item.label) LIMIT 500
      ) AS slot
    ), '[]'::jsonb),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'number', unit.number) ORDER BY unit.number)
      FROM public.units AS unit WHERE unit.society_id = p_society_id AND unit.active
    ), '[]'::jsonb),
    'queues', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', queued.id, 'unit_id', queued.unit_id, 'unit_number', queued.unit_number,
        'slot_type', queued.slot_type, 'note', queued.note, 'created_at', queued.created_at,
        'queue_position', queued.queue_position
      ) ORDER BY queued.slot_type, queued.queue_position)
      FROM (
        SELECT request.*, unit.number AS unit_number,
          row_number() OVER (PARTITION BY request.slot_type ORDER BY request.queue_seq) AS queue_position
        FROM public.parking_requests AS request
        JOIN public.units AS unit ON unit.id = request.unit_id
        WHERE request.society_id = p_society_id AND request.status = 'waiting'
      ) AS queued
    ), '[]'::jsonb),
    'passes', COALESCE((
      SELECT jsonb_agg(private.parking_pass_json(pass) ORDER BY pass.starts_at)
      FROM public.parking_visitor_passes AS pass
      WHERE pass.society_id = p_society_id AND pass.status = 'active' AND pass.ends_at > clock_timestamp()
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(private.parking_report_json(report) ORDER BY report.created_at DESC)
      FROM (
        SELECT * FROM public.parking_reports AS item WHERE item.society_id = p_society_id
        ORDER BY item.status = 'open' DESC, item.created_at DESC LIMIT 100
      ) AS report
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.parking_guard_board(p_society_id uuid, p_query text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_query text := btrim(COALESCE(p_query, ''));
  vehicle_query text := private.parking_normalize_vehicle(p_query);
  directory_on boolean;
  matches jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.parking_authorize(p_society_id, ARRAY['guard']::text[], false);
  IF char_length(clean_query) > 40 THEN
    RAISE EXCEPTION 'Enter a slot label or vehicle number up to 40 characters.' USING ERRCODE = '22023';
  END IF;
  directory_on := private.module_enabled(p_society_id, 'directory');
  IF clean_query <> '' THEN
    matches := COALESCE((
      SELECT jsonb_agg(item ORDER BY item ->> 'slot_label' NULLS LAST, item ->> 'unit_number')
      FROM (
        SELECT jsonb_build_object(
          'slot_label', slot.label, 'slot_type', slot.slot_type, 'unit_number', unit.number,
          'vehicle_numbers', CASE WHEN directory_on THEN COALESCE((
            SELECT jsonb_agg(vehicle.registration_number ORDER BY vehicle.registration_number)
            FROM public.parking_vehicle_links AS link
            JOIN public.directory_vehicles AS vehicle ON vehicle.id = link.vehicle_id
            WHERE link.allocation_id = allocation.id AND link.ended_at IS NULL
              AND private.parking_vehicle_matchable(vehicle.id)
          ), '[]'::jsonb) ELSE '[]'::jsonb END
        ) AS item
        FROM public.parking_slots AS slot
        LEFT JOIN public.parking_allocations AS allocation
          ON allocation.slot_id = slot.id AND allocation.ended_at IS NULL
        LEFT JOIN public.units AS unit ON unit.id = allocation.unit_id
        WHERE slot.society_id = p_society_id AND slot.archived_at IS NULL
          AND (lower(slot.label) = lower(clean_query) OR (directory_on AND EXISTS (
            SELECT 1 FROM public.parking_vehicle_links AS link
            JOIN public.directory_vehicles AS vehicle ON vehicle.id = link.vehicle_id
            WHERE link.allocation_id = allocation.id AND link.ended_at IS NULL
              AND private.parking_vehicle_matchable(vehicle.id) AND vehicle.registration_number = vehicle_query
          )))
        UNION ALL
        SELECT jsonb_build_object(
          'slot_label', NULL, 'slot_type', NULL, 'unit_number', unit.number,
          'vehicle_numbers', jsonb_build_array(vehicle.registration_number)
        )
        FROM public.directory_vehicles AS vehicle
        JOIN public.units AS unit ON unit.id = vehicle.unit_id
        WHERE directory_on AND vehicle.society_id = p_society_id
          AND private.parking_vehicle_matchable(vehicle.id)
          AND vehicle.registration_number = vehicle_query
          AND NOT EXISTS (
            SELECT 1 FROM public.parking_vehicle_links AS link
            WHERE link.vehicle_id = vehicle.id AND link.ended_at IS NULL
          )
        LIMIT 20
      ) AS found(item)
    ), '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'visitor_enabled', private.module_enabled(p_society_id, 'visitor'),
    'passes', COALESCE((
      SELECT jsonb_agg(private.parking_pass_json(pass) ORDER BY pass.starts_at)
      FROM public.parking_visitor_passes AS pass
      WHERE pass.society_id = p_society_id AND pass.status = 'active'
        AND pass.ends_at > clock_timestamp() AND pass.starts_at <= clock_timestamp() + interval '12 hours'
    ), '[]'::jsonb),
    'slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', slot.id, 'label', slot.label, 'slot_type', slot.slot_type)
        ORDER BY lower(slot.label))
      FROM public.parking_slots AS slot
      WHERE slot.society_id = p_society_id AND slot.archived_at IS NULL
    ), '[]'::jsonb),
    'query', NULLIF(clean_query, ''),
    'matches', matches
  );
END;
$$;

CREATE FUNCTION public.parking_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  RETURN QUERY
    SELECT 'parking-photos'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'parking-photos' AND (
      EXISTS (
        SELECT 1 FROM public.parking_reports AS report
        WHERE report.photo_path = object.name AND (report.photo_deleted_at IS NOT NULL
          OR report.created_at + make_interval(days => private.parking_photo_retention_days(report.society_id))
            <= cutoff)
      )
      OR (object.created_at <= cutoff - interval '24 hours' AND NOT EXISTS (
        SELECT 1 FROM public.parking_reports AS report WHERE report.photo_path = object.name
      ))
    ) ORDER BY object.name;
END;
$$;

CREATE FUNCTION public.parking_retention_run(p_today date, p_request_trace text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
  photo_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'Invalid retention arguments.' USING ERRCODE = '22023'; END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  UPDATE public.parking_reports AS report SET photo_deleted_at = clock_timestamp()
  WHERE report.photo_path IS NOT NULL AND report.photo_deleted_at IS NULL
    AND report.created_at + make_interval(days => private.parking_photo_retention_days(report.society_id))
      <= cutoff
    AND NOT EXISTS (
      SELECT 1 FROM storage.objects AS object
      WHERE object.bucket_id = 'parking-photos' AND object.name = report.photo_path
    );
  GET DIAGNOSTICS photo_count = ROW_COUNT;
  RETURN jsonb_build_object('photos_deleted', photo_count);
END;
$$;

REVOKE ALL ON FUNCTION public.parking_photo_upload_path(uuid, text, integer),
  public.parking_photo_access(uuid, text),
  public.parking_pass_create(uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, uuid, text),
  public.parking_pass_cancel(uuid, uuid, text),
  public.parking_report_create(uuid, uuid, text, text, text, uuid, text),
  public.parking_report_resolve(uuid, uuid, text, text),
  public.parking_resident_workspace(uuid),
  public.parking_admin_workspace(uuid),
  public.parking_guard_board(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parking_photo_upload_path(uuid, text, integer),
  public.parking_photo_access(uuid, text),
  public.parking_pass_create(uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, uuid, text),
  public.parking_pass_cancel(uuid, uuid, text),
  public.parking_report_create(uuid, uuid, text, text, text, uuid, text),
  public.parking_report_resolve(uuid, uuid, text, text),
  public.parking_resident_workspace(uuid),
  public.parking_admin_workspace(uuid),
  public.parking_guard_board(uuid, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.parking_retention_files_list(date), public.parking_retention_run(date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parking_retention_files_list(date), public.parking_retention_run(date, text)
  TO service_role;
