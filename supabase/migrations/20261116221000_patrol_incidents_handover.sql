-- Guard Patrol incidents with private photos, admin follow-up, shift handover notes,
-- read models and photo retention.
CREATE TABLE public.patrol_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  category text NOT NULL,
  severity text NOT NULL,
  description text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT patrol_incidents_category_check CHECK (category IN (
    'suspicious_activity', 'unauthorised_entry', 'theft', 'fire_safety', 'medical',
    'property_damage', 'dispute', 'other'
  )),
  CONSTRAINT patrol_incidents_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT patrol_incidents_description_check
    CHECK (char_length(description) BETWEEN 1 AND 1000 AND description = btrim(description)),
  CONSTRAINT patrol_incidents_location_check
    CHECK (location IS NULL OR (char_length(location) BETWEEN 1 AND 200 AND location = btrim(location))),
  CONSTRAINT patrol_incidents_status_check CHECK (
    (status = 'open' AND closed_at IS NULL AND closed_by IS NULL AND resolution IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL AND resolution IS NOT NULL)
  ),
  CONSTRAINT patrol_incidents_resolution_check CHECK (
    resolution IS NULL OR (char_length(resolution) BETWEEN 1 AND 1000 AND resolution = btrim(resolution))
  ),
  CONSTRAINT patrol_incidents_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT patrol_incidents_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX patrol_incidents_created_idx ON public.patrol_incidents (society_id, created_at DESC);
CREATE INDEX patrol_incidents_status_idx ON public.patrol_incidents (society_id, status, created_at DESC);
CREATE INDEX patrol_incidents_created_by_idx ON public.patrol_incidents (created_by, created_at DESC);
CREATE INDEX patrol_incidents_closed_by_idx ON public.patrol_incidents (closed_by);

CREATE TABLE public.patrol_incident_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  incident_id uuid NOT NULL,
  photo_order smallint NOT NULL,
  path text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT patrol_incident_photos_order_check CHECK (photo_order BETWEEN 1 AND 3),
  CONSTRAINT patrol_incident_photos_type_check CHECK (content_type IN ('image/jpeg', 'image/png')),
  CONSTRAINT patrol_incident_photos_size_check CHECK (size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT patrol_incident_photos_incident_fkey
    FOREIGN KEY (society_id, incident_id)
    REFERENCES public.patrol_incidents (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT patrol_incident_photos_path_key UNIQUE (path),
  CONSTRAINT patrol_incident_photos_order_key UNIQUE (society_id, incident_id, photo_order)
);
CREATE INDEX patrol_incident_photos_retention_idx
  ON public.patrol_incident_photos (created_at) WHERE deleted_at IS NULL;

CREATE TABLE public.patrol_incident_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  incident_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT patrol_incident_notes_body_check
    CHECK (char_length(body) BETWEEN 1 AND 1000 AND body = btrim(body)),
  CONSTRAINT patrol_incident_notes_incident_fkey
    FOREIGN KEY (society_id, incident_id)
    REFERENCES public.patrol_incidents (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX patrol_incident_notes_incident_idx
  ON public.patrol_incident_notes (society_id, incident_id, created_at);
CREATE INDEX patrol_incident_notes_created_by_idx ON public.patrol_incident_notes (created_by);

CREATE TABLE public.patrol_handover_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  body text NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT patrol_handover_notes_body_check
    CHECK (char_length(body) BETWEEN 1 AND 1000 AND body = btrim(body)),
  CONSTRAINT patrol_handover_notes_ack_check CHECK (
    (acknowledged_at IS NULL) = (acknowledged_by IS NULL)
    AND (acknowledged_by IS NULL OR acknowledged_by <> created_by)
  ),
  CONSTRAINT patrol_handover_notes_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT patrol_handover_notes_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX patrol_handover_notes_created_idx
  ON public.patrol_handover_notes (society_id, created_at DESC);
CREATE INDEX patrol_handover_notes_created_by_idx
  ON public.patrol_handover_notes (created_by, created_at DESC);
CREATE INDEX patrol_handover_notes_acknowledged_by_idx
  ON public.patrol_handover_notes (acknowledged_by);

ALTER TABLE public.patrol_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_incident_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_incident_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_handover_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patrol_incidents, public.patrol_incident_photos, public.patrol_incident_notes,
  public.patrol_handover_notes FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY patrol_incidents_no_direct_access ON public.patrol_incidents
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY patrol_incident_photos_no_direct_access ON public.patrol_incident_photos
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY patrol_incident_notes_no_direct_access ON public.patrol_incident_notes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY patrol_handover_notes_no_direct_access ON public.patrol_handover_notes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER patrol_incidents_no_delete BEFORE DELETE ON public.patrol_incidents
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_incidents_no_truncate BEFORE TRUNCATE ON public.patrol_incidents
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_incident_photos_no_delete BEFORE DELETE ON public.patrol_incident_photos
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_incident_photos_no_truncate BEFORE TRUNCATE ON public.patrol_incident_photos
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_incident_notes_no_mutation BEFORE UPDATE OR DELETE ON public.patrol_incident_notes
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_incident_notes_no_truncate BEFORE TRUNCATE ON public.patrol_incident_notes
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_handover_notes_no_delete BEFORE DELETE ON public.patrol_handover_notes
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_handover_notes_no_truncate BEFORE TRUNCATE ON public.patrol_handover_notes
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.patrol_incident_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.society_id <> OLD.society_id OR NEW.category <> OLD.category
    OR NEW.severity <> OLD.severity OR NEW.description <> OLD.description
    OR NEW.location IS DISTINCT FROM OLD.location OR NEW.created_by <> OLD.created_by
    OR NEW.created_at <> OLD.created_at OR OLD.status <> 'open'
  THEN
    RAISE EXCEPTION 'A patrol incident can only be closed.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_incident_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER patrol_incidents_guard BEFORE UPDATE ON public.patrol_incidents
  FOR EACH ROW EXECUTE FUNCTION private.patrol_incident_guard();

CREATE FUNCTION private.patrol_photo_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.society_id <> OLD.society_id OR NEW.incident_id <> OLD.incident_id
    OR NEW.path <> OLD.path OR NEW.photo_order <> OLD.photo_order
    OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
  THEN
    RAISE EXCEPTION 'A patrol photo can only be marked deleted.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_photo_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER patrol_incident_photos_guard BEFORE UPDATE ON public.patrol_incident_photos
  FOR EACH ROW EXECUTE FUNCTION private.patrol_photo_guard();

CREATE FUNCTION private.patrol_handover_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.society_id <> OLD.society_id OR NEW.body <> OLD.body OR NEW.created_by <> OLD.created_by
    OR NEW.created_at <> OLD.created_at OR OLD.acknowledged_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'A handover note can only be acknowledged once.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_handover_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER patrol_handover_notes_guard BEFORE UPDATE ON public.patrol_handover_notes
  FOR EACH ROW EXECUTE FUNCTION private.patrol_handover_guard();

CREATE FUNCTION private.patrol_photo_retention_days(p_society_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT (settings ->> 'photo_retention_days')::integer FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'patrol'
  ), 90)
$$;
REVOKE ALL ON FUNCTION private.patrol_photo_retention_days(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Photo paths: <society>/incidents/<uploader>/<uuid>.(jpg|png). Unattached uploads stay
-- visible only to their uploader and are purged after 24 hours.
CREATE FUNCTION private.patrol_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  uploader_id uuid;
  photo public.patrol_incident_photos;
  incident public.patrol_incidents;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/incidents/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
  ) THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  uploader_id := split_part(p_path, '/', 3)::uuid;
  IF auth.uid() IS NULL OR NOT private.module_enabled(target_society_id, 'patrol')
    OR NOT private.is_member(target_society_id)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived')
  THEN RETURN false; END IF;
  SELECT * INTO photo FROM public.patrol_incident_photos AS item
    WHERE item.society_id = target_society_id AND item.path = p_path;
  IF p_write THEN
    RETURN photo.id IS NULL AND uploader_id = auth.uid()
      AND private.society_writable(target_society_id)
      AND private.has_role(target_society_id, ARRAY['guard']::text[]);
  END IF;
  IF photo.id IS NULL THEN
    RETURN uploader_id = auth.uid();
  END IF;
  SELECT * INTO incident FROM public.patrol_incidents
    WHERE society_id = target_society_id AND id = photo.incident_id;
  RETURN photo.deleted_at IS NULL
    AND photo.created_at + make_interval(days => private.patrol_photo_retention_days(target_society_id))
      > clock_timestamp()
    AND (private.has_role(target_society_id, ARRAY['admin', 'committee']::text[])
      OR incident.created_by = auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.patrol_file_access(text, boolean) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('patrol-photos', 'patrol-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']::text[]);
CREATE POLICY patrol_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patrol-photos' AND private.patrol_file_access(name, false));
CREATE POLICY patrol_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patrol-photos' AND private.patrol_file_access(name, true));

CREATE FUNCTION public.patrol_photo_upload_path(
  p_society_id uuid, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  path text;
BEGIN
  PERFORM private.patrol_authorize(p_society_id, ARRAY['guard']::text[], true);
  IF p_content_type IS NULL OR p_content_type NOT IN ('image/jpeg', 'image/png')
    OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Use a JPG or PNG photo up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  path := p_society_id::text || '/incidents/' || auth.uid()::text || '/' || gen_random_uuid()::text
    || CASE p_content_type WHEN 'image/jpeg' THEN '.jpg' ELSE '.png' END;
  IF NOT COALESCE(private.patrol_file_access(path, true), false) THEN
    RAISE EXCEPTION 'Patrol photo upload is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN path;
END;
$$;

CREATE FUNCTION public.patrol_photo_access(p_society_id uuid, p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.patrol_authorize(p_society_id, ARRAY['admin', 'committee', 'guard']::text[], false);
  RETURN split_part(COALESCE(p_path, ''), '/', 1) = p_society_id::text
    AND COALESCE(private.patrol_file_access(p_path, false), false);
END;
$$;

-- High and critical incidents alert admins at once. The fan-out is capped; any overflow is
-- logged and audited rather than silently dropped.
CREATE FUNCTION private.patrol_admin_alert_cap()
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 50 $$;
REVOKE ALL ON FUNCTION private.patrol_admin_alert_cap() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.patrol_incident_create(
  p_society_id uuid, p_category text, p_severity text, p_description text, p_location text,
  p_photo_paths text[], p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  incident public.patrol_incidents;
  clean_description text := btrim(COALESCE(p_description, ''));
  clean_location text := NULLIF(btrim(COALESCE(p_location, '')), '');
  paths text[] := COALESCE(p_photo_paths, ARRAY[]::text[]);
  photo_path text;
  photo_position integer := 0;
  object_metadata jsonb;
  recipient uuid;
  alert_cap integer := private.patrol_admin_alert_cap();
  admin_total integer;
  severity_label text;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['guard']::text[]);
  IF p_client_request_id IS NULL
    OR p_category IS NULL OR p_category NOT IN (
      'suspicious_activity', 'unauthorised_entry', 'theft', 'fire_safety', 'medical',
      'property_damage', 'dispute', 'other')
    OR p_severity IS NULL OR p_severity NOT IN ('low', 'medium', 'high', 'critical')
    OR char_length(clean_description) NOT BETWEEN 1 AND 1000
    OR (clean_location IS NOT NULL AND char_length(clean_location) > 200)
    OR cardinality(paths) > 3
    OR array_position(paths, NULL) IS NOT NULL
    OR (SELECT count(DISTINCT item) FROM unnest(paths) AS item) <> cardinality(paths)
  THEN
    RAISE EXCEPTION 'Choose a category and severity, describe the incident in up to 1000 characters, and attach up to 3 photos.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO incident FROM public.patrol_incidents
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN incident.id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('patrol-incident:' || auth.uid()::text, 0));
  IF (SELECT count(*) FROM public.patrol_incidents
      WHERE created_by = auth.uid() AND created_at > clock_timestamp() - interval '1 hour') >= 20
  THEN
    RAISE EXCEPTION 'You can report 20 incidents an hour.' USING ERRCODE = '54000';
  END IF;
  FOREACH photo_path IN ARRAY paths LOOP
    IF split_part(photo_path, '/', 1) <> p_society_id::text
      OR split_part(photo_path, '/', 3) <> auth.uid()::text
      OR NOT COALESCE(private.patrol_file_access(photo_path, true), false)
    THEN
      RAISE EXCEPTION 'Upload the incident photos again.' USING ERRCODE = '22023';
    END IF;
    SELECT object.metadata INTO object_metadata FROM storage.objects AS object
      WHERE object.bucket_id = 'patrol-photos' AND object.name = photo_path
        AND object.created_at > clock_timestamp() - interval '24 hours';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A photo upload expired. Upload the photo again.' USING ERRCODE = '22023';
    END IF;
    IF NOT (
        (COALESCE(object_metadata ->> 'mimetype', '') = 'image/jpeg' AND right(photo_path, 4) = '.jpg')
        OR (COALESCE(object_metadata ->> 'mimetype', '') = 'image/png' AND right(photo_path, 4) = '.png')
      )
      OR (CASE WHEN COALESCE(object_metadata ->> 'size', '') ~ '^[0-9]{1,8}$'
        THEN (object_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880 ELSE true END)
    THEN
      RAISE EXCEPTION 'Upload JPG or PNG photos up to 5 MiB.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  INSERT INTO public.patrol_incidents (
    society_id, category, severity, description, location, client_request_id, created_by
  ) VALUES (
    p_society_id, p_category, p_severity, clean_description, clean_location,
    p_client_request_id, auth.uid()
  ) RETURNING * INTO incident;
  FOREACH photo_path IN ARRAY paths LOOP
    photo_position := photo_position + 1;
    SELECT metadata INTO object_metadata FROM storage.objects
      WHERE bucket_id = 'patrol-photos' AND name = photo_path;
    INSERT INTO public.patrol_incident_photos (
      society_id, incident_id, photo_order, path, content_type, size_bytes
    ) VALUES (
      p_society_id, incident.id, photo_position, photo_path, object_metadata ->> 'mimetype',
      (object_metadata ->> 'size')::integer
    );
  END LOOP;
  PERFORM private.patrol_audit(p_society_id, 'guard', 'incident.create', 'patrol_incident',
    incident.id, jsonb_build_object('category', incident.category, 'severity', incident.severity,
      'location', incident.location, 'photo_count', cardinality(paths)), p_request_id);
  IF incident.severity IN ('high', 'critical') THEN
    severity_label := CASE incident.severity WHEN 'critical' THEN 'Critical' ELSE 'High' END;
    SELECT count(DISTINCT membership.user_id) INTO admin_total FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.user_id IS NOT NULL AND 'admin' = ANY(membership.roles)
        AND membership.user_id IS DISTINCT FROM auth.uid();
    FOR recipient IN SELECT DISTINCT membership.user_id FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.user_id IS NOT NULL AND 'admin' = ANY(membership.roles)
        AND membership.user_id IS DISTINCT FROM auth.uid()
      ORDER BY membership.user_id LIMIT alert_cap
    LOOP
      PERFORM private.create_notification(p_society_id, recipient, 'patrol_incident',
        severity_label || ' incident reported',
        'A guard reported a ' || lower(severity_label) || '-severity incident'
          || COALESCE(' at ' || left(incident.location, 200), '') || '.',
        'patrol_admin', incident.id, p_request_id);
    END LOOP;
    IF admin_total > alert_cap THEN
      RAISE LOG 'patrol_incident_create: incident % dropped % admin alerts over cap %',
        incident.id, admin_total - alert_cap, alert_cap;
      PERFORM private.patrol_audit(p_society_id, 'guard', 'incident.alerts_truncated',
        'patrol_incident', incident.id,
        jsonb_build_object('admin_cap', alert_cap, 'dropped', admin_total - alert_cap), p_request_id);
    END IF;
  END IF;
  RETURN incident.id;
END;
$$;

CREATE FUNCTION public.patrol_incident_note_add(
  p_society_id uuid, p_incident_id uuid, p_body text, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  incident public.patrol_incidents;
  clean_body text := btrim(COALESCE(p_body, ''));
  note_id uuid;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF char_length(clean_body) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Write a follow-up note up to 1000 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO incident FROM public.patrol_incidents
    WHERE society_id = p_society_id AND id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found.' USING ERRCODE = 'P0002'; END IF;
  IF incident.status <> 'open' THEN
    RAISE EXCEPTION 'This incident is already closed.' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.patrol_incident_notes
      WHERE society_id = p_society_id AND incident_id = incident.id) >= 100
  THEN
    RAISE EXCEPTION 'An incident can have up to 100 follow-up notes.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.patrol_incident_notes (society_id, incident_id, body, created_by)
  VALUES (p_society_id, incident.id, clean_body, auth.uid()) RETURNING id INTO note_id;
  PERFORM private.patrol_audit(p_society_id, 'admin', 'incident.note', 'patrol_incident',
    incident.id, jsonb_build_object('note_id', note_id, 'body', clean_body), p_request_id);
  RETURN note_id;
END;
$$;

CREATE FUNCTION public.patrol_incident_close(
  p_society_id uuid, p_incident_id uuid, p_resolution text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  incident public.patrol_incidents;
  clean_resolution text := btrim(COALESCE(p_resolution, ''));
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF char_length(clean_resolution) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Write a resolution up to 1000 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO incident FROM public.patrol_incidents
    WHERE society_id = p_society_id AND id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found.' USING ERRCODE = 'P0002'; END IF;
  IF incident.status <> 'open' THEN
    RAISE EXCEPTION 'This incident is already closed.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.patrol_incidents
  SET status = 'closed', resolution = clean_resolution, closed_at = clock_timestamp(),
    closed_by = auth.uid()
  WHERE id = incident.id;
  PERFORM private.patrol_audit(p_society_id, 'admin', 'incident.close', 'patrol_incident',
    incident.id, jsonb_build_object('resolution', clean_resolution), p_request_id);
  IF incident.created_by IS DISTINCT FROM auth.uid() AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = incident.created_by AND status = 'active'
  ) THEN
    PERFORM private.create_notification(p_society_id, incident.created_by, 'patrol_incident_closed',
      'Incident closed', 'An administrator closed an incident you reported.',
      'patrol_guard', incident.id, p_request_id);
  END IF;
END;
$$;

CREATE FUNCTION public.patrol_handover_create(
  p_society_id uuid, p_body text, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  note public.patrol_handover_notes;
  clean_body text := btrim(COALESCE(p_body, ''));
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['guard']::text[]);
  IF p_client_request_id IS NULL OR char_length(clean_body) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Write a handover note up to 1000 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO note FROM public.patrol_handover_notes
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN note.id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('patrol-handover:' || auth.uid()::text, 0));
  IF (SELECT count(*) FROM public.patrol_handover_notes
      WHERE created_by = auth.uid() AND created_at > clock_timestamp() - interval '1 hour') >= 20
  THEN
    RAISE EXCEPTION 'You can write 20 handover notes an hour.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.patrol_handover_notes (society_id, body, client_request_id, created_by)
  VALUES (p_society_id, clean_body, p_client_request_id, auth.uid()) RETURNING * INTO note;
  PERFORM private.patrol_audit(p_society_id, 'guard', 'handover.create', 'patrol_handover_note',
    note.id, jsonb_build_object('length', char_length(clean_body)), p_request_id);
  RETURN note.id;
END;
$$;

CREATE FUNCTION public.patrol_handover_acknowledge(
  p_society_id uuid, p_note_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  note public.patrol_handover_notes;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['guard']::text[]);
  SELECT * INTO note FROM public.patrol_handover_notes
    WHERE society_id = p_society_id AND id = p_note_id
      AND created_at > clock_timestamp() - interval '7 days'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover note not found.' USING ERRCODE = 'P0002'; END IF;
  IF note.created_by = auth.uid() THEN
    RAISE EXCEPTION 'The next guard acknowledges your handover note.' USING ERRCODE = '23514';
  END IF;
  IF note.acknowledged_at IS NOT NULL THEN
    RAISE EXCEPTION 'This handover note is already acknowledged.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.patrol_handover_notes
  SET acknowledged_at = clock_timestamp(), acknowledged_by = auth.uid()
  WHERE id = note.id;
  PERFORM private.patrol_audit(p_society_id, 'guard', 'handover.acknowledge', 'patrol_handover_note',
    note.id, jsonb_build_object('created_by', note.created_by), p_request_id);
END;
$$;

CREATE FUNCTION private.patrol_profile_name(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT full_name FROM public.profiles WHERE id = p_user_id
$$;
REVOKE ALL ON FUNCTION private.patrol_profile_name(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_incident_json(p_incident public.patrol_incidents, p_with_notes boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_incident.id,
    'category', p_incident.category,
    'severity', p_incident.severity,
    'description', p_incident.description,
    'location', p_incident.location,
    'status', p_incident.status,
    'resolution', p_incident.resolution,
    'reported_by_name', private.patrol_profile_name(p_incident.created_by),
    'created_at', p_incident.created_at,
    'closed_at', p_incident.closed_at,
    'closed_by_name', private.patrol_profile_name(p_incident.closed_by),
    'photo_paths', COALESCE((
      SELECT jsonb_agg(photo.path ORDER BY photo.photo_order)
      FROM public.patrol_incident_photos AS photo
      WHERE photo.society_id = p_incident.society_id AND photo.incident_id = p_incident.id
        AND photo.deleted_at IS NULL
        AND photo.created_at + make_interval(days => private.patrol_photo_retention_days(p_incident.society_id))
          > clock_timestamp()
    ), '[]'::jsonb),
    'notes', CASE WHEN p_with_notes THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', note.id, 'body', note.body, 'created_at', note.created_at,
        'author_name', private.patrol_profile_name(note.created_by)
      ) ORDER BY note.created_at, note.id)
      FROM public.patrol_incident_notes AS note
      WHERE note.society_id = p_incident.society_id AND note.incident_id = p_incident.id
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  )
$$;
REVOKE ALL ON FUNCTION private.patrol_incident_json(public.patrol_incidents, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_handover_json(p_note public.patrol_handover_notes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_note.id,
    'body', p_note.body,
    'author_name', private.patrol_profile_name(p_note.created_by),
    'created_at', p_note.created_at,
    'acknowledged_at', p_note.acknowledged_at,
    'acknowledged_by_name', private.patrol_profile_name(p_note.acknowledged_by),
    'is_mine', p_note.created_by = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION private.patrol_handover_json(public.patrol_handover_notes)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_schedules_json(p_society_id uuid, p_active_only boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', schedule.id,
    'name', schedule.name,
    'shift_start', to_char(schedule.shift_start, 'HH24:MI'),
    'shift_end', to_char(schedule.shift_end, 'HH24:MI'),
    'interval_minutes', schedule.interval_minutes,
    'grace_minutes', schedule.grace_minutes,
    'active', schedule.active,
    'effective_from', schedule.effective_from,
    'version', schedule.version,
    'checkpoints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'checkpoint_id', link.checkpoint_id, 'included_at', link.created_at
      ) ORDER BY link.created_at, link.checkpoint_id)
      FROM public.patrol_schedule_checkpoints AS link
      WHERE link.society_id = schedule.society_id AND link.schedule_id = schedule.id
    ), '[]'::jsonb)
  ) ORDER BY NOT schedule.active, schedule.shift_start, lower(schedule.name)), '[]'::jsonb)
  FROM public.patrol_schedules AS schedule
  WHERE schedule.society_id = p_society_id AND (schedule.active OR NOT p_active_only)
$$;
REVOKE ALL ON FUNCTION private.patrol_schedules_json(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_scans_json(p_society_id uuid, p_since timestamptz, p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', scan.id,
    'checkpoint_id', scan.checkpoint_id,
    'method', scan.method,
    'scanned_at', scan.scanned_at,
    'scanned_by_name', private.patrol_profile_name(scan.scanned_by),
    'is_mine', scan.scanned_by = auth.uid()
  ) ORDER BY scan.scanned_at DESC, scan.id), '[]'::jsonb)
  FROM (
    SELECT * FROM public.patrol_scans AS item
    WHERE item.society_id = p_society_id AND item.scanned_at >= p_since
    ORDER BY item.scanned_at DESC LIMIT p_limit
  ) AS scan
$$;
REVOKE ALL ON FUNCTION private.patrol_scans_json(uuid, timestamptz, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_handovers_json(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(private.patrol_handover_json(note) ORDER BY note.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT * FROM public.patrol_handover_notes AS item
    WHERE item.society_id = p_society_id AND item.created_at > clock_timestamp() - interval '7 days'
    ORDER BY item.created_at DESC LIMIT 50
  ) AS note
$$;
REVOKE ALL ON FUNCTION private.patrol_handovers_json(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Round windows and missed checkpoints are computed by the application from the schedules
-- and the scans returned here (48 hours for admins, 24 hours for guards).
CREATE FUNCTION public.patrol_admin_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM private.patrol_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'timezone', private.patrol_society_timezone(p_society_id),
    'generated_at', now_at,
    'settings', jsonb_build_object(
      'photo_retention_days', private.patrol_photo_retention_days(p_society_id)
    ),
    'checkpoints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', checkpoint.id, 'code', checkpoint.code, 'name', checkpoint.name,
        'location_note', checkpoint.location_note, 'active', checkpoint.active,
        'version', checkpoint.version, 'created_at', checkpoint.created_at
      ) ORDER BY NOT checkpoint.active, lower(checkpoint.name))
      FROM public.patrol_checkpoints AS checkpoint WHERE checkpoint.society_id = p_society_id
    ), '[]'::jsonb),
    'schedules', private.patrol_schedules_json(p_society_id, false),
    'scans', private.patrol_scans_json(p_society_id, now_at - interval '48 hours', 5000),
    'incidents', COALESCE((
      SELECT jsonb_agg(private.patrol_incident_json(incident, true)
        ORDER BY incident.status = 'open' DESC, incident.created_at DESC)
      FROM (
        SELECT * FROM public.patrol_incidents AS item WHERE item.society_id = p_society_id
        ORDER BY item.status = 'open' DESC, item.created_at DESC LIMIT 100
      ) AS incident
    ), '[]'::jsonb),
    'handover_notes', private.patrol_handovers_json(p_society_id)
  );
END;
$$;

CREATE FUNCTION public.patrol_guard_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM private.patrol_authorize(p_society_id, ARRAY['guard']::text[], false);
  RETURN jsonb_build_object(
    'timezone', private.patrol_society_timezone(p_society_id),
    'generated_at', now_at,
    'checkpoints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', checkpoint.id, 'name', checkpoint.name, 'location_note', checkpoint.location_note
      ) ORDER BY lower(checkpoint.name))
      FROM public.patrol_checkpoints AS checkpoint
      WHERE checkpoint.society_id = p_society_id AND checkpoint.active
    ), '[]'::jsonb),
    'schedules', private.patrol_schedules_json(p_society_id, true),
    'scans', private.patrol_scans_json(p_society_id, now_at - interval '24 hours', 2000),
    'incidents', COALESCE((
      SELECT jsonb_agg(private.patrol_incident_json(incident, false) ORDER BY incident.created_at DESC)
      FROM (
        SELECT * FROM public.patrol_incidents AS item
        WHERE item.society_id = p_society_id AND item.created_by = auth.uid()
        ORDER BY item.created_at DESC LIMIT 20
      ) AS incident
    ), '[]'::jsonb),
    'handover_notes', private.patrol_handovers_json(p_society_id)
  );
END;
$$;

CREATE FUNCTION public.patrol_print_sheet(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.patrol_authorize(p_society_id, ARRAY['admin']::text[], false);
  RETURN jsonb_build_object(
    'society_name', (SELECT name FROM public.societies WHERE id = p_society_id),
    'checkpoints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', checkpoint.id, 'code', checkpoint.code, 'name', checkpoint.name,
        'location_note', checkpoint.location_note
      ) ORDER BY lower(checkpoint.name))
      FROM public.patrol_checkpoints AS checkpoint
      WHERE checkpoint.society_id = p_society_id AND checkpoint.active
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.patrol_retention_files_list(p_today date)
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
    SELECT 'patrol-photos'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'patrol-photos' AND (
      EXISTS (
        SELECT 1 FROM public.patrol_incident_photos AS photo
        WHERE photo.path = object.name AND (photo.deleted_at IS NOT NULL
          OR photo.created_at + make_interval(days => private.patrol_photo_retention_days(photo.society_id))
            <= cutoff)
      )
      OR (object.created_at <= cutoff - interval '24 hours' AND NOT EXISTS (
        SELECT 1 FROM public.patrol_incident_photos AS photo WHERE photo.path = object.name
      ))
    ) ORDER BY object.name;
END;
$$;

CREATE FUNCTION public.patrol_retention_run(p_today date, p_request_trace text)
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
  UPDATE public.patrol_incident_photos AS photo SET deleted_at = clock_timestamp()
  WHERE photo.deleted_at IS NULL
    AND photo.created_at + make_interval(days => private.patrol_photo_retention_days(photo.society_id))
      <= cutoff
    AND NOT EXISTS (
      SELECT 1 FROM storage.objects AS object
      WHERE object.bucket_id = 'patrol-photos' AND object.name = photo.path
    );
  GET DIAGNOSTICS photo_count = ROW_COUNT;
  RETURN jsonb_build_object('photos_deleted', photo_count);
END;
$$;

REVOKE ALL ON FUNCTION public.patrol_photo_upload_path(uuid, text, integer),
  public.patrol_photo_access(uuid, text),
  public.patrol_incident_create(uuid, text, text, text, text, text[], uuid, text),
  public.patrol_incident_note_add(uuid, uuid, text, text),
  public.patrol_incident_close(uuid, uuid, text, text),
  public.patrol_handover_create(uuid, text, uuid, text),
  public.patrol_handover_acknowledge(uuid, uuid, text),
  public.patrol_admin_workspace(uuid),
  public.patrol_guard_workspace(uuid),
  public.patrol_print_sheet(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.patrol_photo_upload_path(uuid, text, integer),
  public.patrol_photo_access(uuid, text),
  public.patrol_incident_create(uuid, text, text, text, text, text[], uuid, text),
  public.patrol_incident_note_add(uuid, uuid, text, text),
  public.patrol_incident_close(uuid, uuid, text, text),
  public.patrol_handover_create(uuid, text, uuid, text),
  public.patrol_handover_acknowledge(uuid, uuid, text),
  public.patrol_admin_workspace(uuid),
  public.patrol_guard_workspace(uuid),
  public.patrol_print_sheet(uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.patrol_retention_files_list(date), public.patrol_retention_run(date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.patrol_retention_files_list(date), public.patrol_retention_run(date, text)
  TO service_role;
