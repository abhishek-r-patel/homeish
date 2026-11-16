-- Guard Patrol checkpoints, round schedules and checkpoint scans.
CREATE TABLE public.patrol_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  location_note text,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  -- Six characters from an alphabet without 0, O, 1 or I so typed codes are unambiguous.
  CONSTRAINT patrol_checkpoints_code_check CHECK (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  CONSTRAINT patrol_checkpoints_name_check
    CHECK (char_length(name) BETWEEN 1 AND 80 AND name = btrim(name)),
  CONSTRAINT patrol_checkpoints_location_check
    CHECK (location_note IS NULL OR (
      char_length(location_note) BETWEEN 1 AND 200 AND location_note = btrim(location_note)
    )),
  CONSTRAINT patrol_checkpoints_version_check CHECK (version >= 1),
  CONSTRAINT patrol_checkpoints_society_code_key UNIQUE (society_id, code),
  CONSTRAINT patrol_checkpoints_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT patrol_checkpoints_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX patrol_checkpoints_name_key
  ON public.patrol_checkpoints (society_id, lower(name));
CREATE INDEX patrol_checkpoints_created_by_idx ON public.patrol_checkpoints (created_by);
CREATE INDEX patrol_checkpoints_updated_by_idx ON public.patrol_checkpoints (updated_by);

-- A schedule repeats rounds every interval_minutes from shift_start until shift_end in the
-- society timezone; a shift whose end is not after its start runs past midnight.
-- effective_from resets whenever the timing changes, so missed rounds are only computed for
-- windows that started under the current configuration.
CREATE TABLE public.patrol_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  shift_start time NOT NULL,
  shift_end time NOT NULL,
  interval_minutes integer NOT NULL,
  grace_minutes integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT patrol_schedules_name_check
    CHECK (char_length(name) BETWEEN 1 AND 80 AND name = btrim(name)),
  CONSTRAINT patrol_schedules_times_check CHECK (
    shift_start <> shift_end
    AND date_trunc('minute', shift_start::interval) = shift_start::interval
    AND date_trunc('minute', shift_end::interval) = shift_end::interval
  ),
  CONSTRAINT patrol_schedules_interval_check CHECK (interval_minutes BETWEEN 15 AND 720),
  CONSTRAINT patrol_schedules_grace_check CHECK (grace_minutes BETWEEN 0 AND 120),
  CONSTRAINT patrol_schedules_version_check CHECK (version >= 1),
  CONSTRAINT patrol_schedules_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT patrol_schedules_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX patrol_schedules_name_key
  ON public.patrol_schedules (society_id, lower(name));
CREATE INDEX patrol_schedules_created_by_idx ON public.patrol_schedules (created_by);
CREATE INDEX patrol_schedules_updated_by_idx ON public.patrol_schedules (updated_by);

-- Membership rows are configuration: removing a checkpoint from a schedule deletes its row.
-- created_at marks when the checkpoint joined the schedule, so earlier rounds never miss it.
CREATE TABLE public.patrol_schedule_checkpoints (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  schedule_id uuid NOT NULL,
  checkpoint_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT patrol_schedule_checkpoints_pkey PRIMARY KEY (society_id, schedule_id, checkpoint_id),
  CONSTRAINT patrol_schedule_checkpoints_schedule_fkey
    FOREIGN KEY (society_id, schedule_id)
    REFERENCES public.patrol_schedules (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT patrol_schedule_checkpoints_checkpoint_fkey
    FOREIGN KEY (society_id, checkpoint_id)
    REFERENCES public.patrol_checkpoints (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX patrol_schedule_checkpoints_checkpoint_idx
  ON public.patrol_schedule_checkpoints (society_id, checkpoint_id);
CREATE INDEX patrol_schedule_checkpoints_created_by_idx
  ON public.patrol_schedule_checkpoints (created_by);

CREATE TABLE public.patrol_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  checkpoint_id uuid NOT NULL,
  method text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT patrol_scans_method_check CHECK (method IN ('qr', 'typed')),
  CONSTRAINT patrol_scans_checkpoint_fkey
    FOREIGN KEY (society_id, checkpoint_id)
    REFERENCES public.patrol_checkpoints (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT patrol_scans_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT patrol_scans_actor_request_key UNIQUE (society_id, scanned_by, client_request_id)
);
CREATE INDEX patrol_scans_checkpoint_idx
  ON public.patrol_scans (society_id, checkpoint_id, scanned_at DESC);
CREATE INDEX patrol_scans_recent_idx ON public.patrol_scans (society_id, scanned_at DESC);
CREATE INDEX patrol_scans_scanned_by_idx ON public.patrol_scans (scanned_by, scanned_at DESC);

ALTER TABLE public.patrol_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_schedule_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patrol_checkpoints, public.patrol_schedules, public.patrol_schedule_checkpoints,
  public.patrol_scans FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY patrol_checkpoints_no_direct_access ON public.patrol_checkpoints
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY patrol_schedules_no_direct_access ON public.patrol_schedules
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY patrol_schedule_checkpoints_no_direct_access ON public.patrol_schedule_checkpoints
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY patrol_scans_no_direct_access ON public.patrol_scans
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER patrol_checkpoints_no_delete BEFORE DELETE ON public.patrol_checkpoints
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_checkpoints_no_truncate BEFORE TRUNCATE ON public.patrol_checkpoints
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_schedules_no_delete BEFORE DELETE ON public.patrol_schedules
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_schedules_no_truncate BEFORE TRUNCATE ON public.patrol_schedules
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_scans_no_delete BEFORE DELETE ON public.patrol_scans
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER patrol_scans_no_truncate BEFORE TRUNCATE ON public.patrol_scans
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.patrol_scan_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Patrol scans cannot be changed.' USING ERRCODE = '23514';
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_scan_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER patrol_scans_no_update BEFORE UPDATE ON public.patrol_scans
  FOR EACH ROW EXECUTE FUNCTION private.patrol_scan_guard();

CREATE FUNCTION private.patrol_checkpoint_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.society_id <> OLD.society_id OR NEW.code <> OLD.code THEN
    RAISE EXCEPTION 'A checkpoint code cannot change.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_checkpoint_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER patrol_checkpoints_guard BEFORE UPDATE ON public.patrol_checkpoints
  FOR EACH ROW EXECUTE FUNCTION private.patrol_checkpoint_guard();

CREATE FUNCTION private.patrol_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'patrol')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Guard Patrol access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.patrol_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.patrol_authorize(p_society_id, p_roles, true);
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_write_begin(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_audit(
  p_society_id uuid, p_actor_role text, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), p_actor_role, 'patrol.' || p_action, p_entity_type,
    p_entity_id::text, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_audit(uuid, text, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.patrol_society_timezone(p_society_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT timezone FROM public.societies WHERE id = p_society_id), 'Asia/Kolkata')
$$;
REVOKE ALL ON FUNCTION private.patrol_society_timezone(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Codes are printed on public stickers, so they only need to be unique, not secret.
CREATE FUNCTION private.patrol_new_code(p_society_id uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt integer := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    SELECT string_agg(substr(alphabet, 1 + floor(random() * 32)::integer, 1), '')
      INTO candidate FROM generate_series(1, 6);
    IF NOT EXISTS (
      SELECT 1 FROM public.patrol_checkpoints WHERE society_id = p_society_id AND code = candidate
    ) THEN
      RETURN candidate;
    END IF;
    IF attempt >= 20 THEN
      RAISE EXCEPTION 'Could not create a unique checkpoint code.' USING ERRCODE = '23505';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.patrol_new_code(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.patrol_settings_update(
  p_society_id uuid, p_photo_retention_days integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_photo_retention_days IS NULL OR p_photo_retention_days NOT BETWEEN 30 AND 365 THEN
    RAISE EXCEPTION 'Photo retention must be between 30 and 365 days.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.module_configs
  SET settings = jsonb_build_object('photo_retention_days', p_photo_retention_days),
    updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'patrol';
  PERFORM private.patrol_audit(p_society_id, 'admin', 'settings.update', 'module', NULL,
    jsonb_build_object('photo_retention_days', p_photo_retention_days), p_request_id);
END;
$$;

CREATE FUNCTION public.patrol_checkpoint_save(
  p_society_id uuid, p_checkpoint_id uuid, p_name text, p_location_note text,
  p_expected_version integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  checkpoint public.patrol_checkpoints;
  clean_name text := btrim(COALESCE(p_name, ''));
  clean_note text := NULLIF(btrim(COALESCE(p_location_note, '')), '');
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF char_length(clean_name) NOT BETWEEN 1 AND 80
    OR (clean_note IS NOT NULL AND char_length(clean_note) > 200)
  THEN
    RAISE EXCEPTION 'Enter a checkpoint name up to 80 characters and a location note up to 200.'
      USING ERRCODE = '22023';
  END IF;
  IF p_checkpoint_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request id is required.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO checkpoint FROM public.patrol_checkpoints
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN checkpoint.id; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('patrol:code:' || p_society_id::text, 0));
    IF (SELECT count(*) FROM public.patrol_checkpoints WHERE society_id = p_society_id) >= 200 THEN
      RAISE EXCEPTION 'A society can have up to 200 checkpoints.' USING ERRCODE = '54000';
    END IF;
    INSERT INTO public.patrol_checkpoints (
      society_id, code, name, location_note, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, private.patrol_new_code(p_society_id), clean_name, clean_note,
      p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO checkpoint;
    PERFORM private.patrol_audit(p_society_id, 'admin', 'checkpoint.create', 'patrol_checkpoint',
      checkpoint.id, jsonb_build_object('name', checkpoint.name, 'code', checkpoint.code,
        'location_note', checkpoint.location_note), p_request_id);
    RETURN checkpoint.id;
  END IF;
  SELECT * INTO checkpoint FROM public.patrol_checkpoints
    WHERE society_id = p_society_id AND id = p_checkpoint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkpoint not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR checkpoint.version <> p_expected_version THEN
    RAISE EXCEPTION 'This checkpoint changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.patrol_checkpoints
  SET name = clean_name, location_note = clean_note, version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = checkpoint.id RETURNING * INTO checkpoint;
  PERFORM private.patrol_audit(p_society_id, 'admin', 'checkpoint.update', 'patrol_checkpoint',
    checkpoint.id, jsonb_build_object('name', checkpoint.name,
      'location_note', checkpoint.location_note, 'version', checkpoint.version), p_request_id);
  RETURN checkpoint.id;
END;
$$;

CREATE FUNCTION public.patrol_checkpoint_set_active(
  p_society_id uuid, p_checkpoint_id uuid, p_active boolean, p_expected_version integer,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  checkpoint public.patrol_checkpoints;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Choose whether the checkpoint is active.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO checkpoint FROM public.patrol_checkpoints
    WHERE society_id = p_society_id AND id = p_checkpoint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkpoint not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR checkpoint.version <> p_expected_version THEN
    RAISE EXCEPTION 'This checkpoint changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF checkpoint.active = p_active THEN RETURN; END IF;
  UPDATE public.patrol_checkpoints
  SET active = p_active, version = version + 1, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE id = checkpoint.id;
  PERFORM private.patrol_audit(p_society_id, 'admin',
    CASE WHEN p_active THEN 'checkpoint.activate' ELSE 'checkpoint.deactivate' END,
    'patrol_checkpoint', checkpoint.id, jsonb_build_object('name', checkpoint.name), p_request_id);
END;
$$;

CREATE FUNCTION private.patrol_shift_minutes(p_start time, p_end time)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_end > p_start
    THEN (extract(epoch FROM (p_end - p_start)) / 60)::integer
    ELSE 1440 - (extract(epoch FROM (p_start - p_end)) / 60)::integer END
$$;
REVOKE ALL ON FUNCTION private.patrol_shift_minutes(time, time)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.patrol_schedule_save(
  p_society_id uuid, p_schedule_id uuid, p_name text, p_shift_start time, p_shift_end time,
  p_interval_minutes integer, p_grace_minutes integer, p_checkpoint_ids uuid[],
  p_expected_version integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  schedule public.patrol_schedules;
  clean_name text := btrim(COALESCE(p_name, ''));
  wanted uuid[];
  timing_changed boolean;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT COALESCE(array_agg(DISTINCT item), ARRAY[]::uuid[]) INTO wanted
    FROM unnest(COALESCE(p_checkpoint_ids, ARRAY[]::uuid[])) AS item WHERE item IS NOT NULL;
  IF char_length(clean_name) NOT BETWEEN 1 AND 80
    OR p_shift_start IS NULL OR p_shift_end IS NULL OR p_shift_start = p_shift_end
    OR date_trunc('minute', p_shift_start::interval) <> p_shift_start::interval
    OR date_trunc('minute', p_shift_end::interval) <> p_shift_end::interval
    OR p_interval_minutes IS NULL OR p_interval_minutes NOT BETWEEN 15 AND 720
    OR p_interval_minutes > private.patrol_shift_minutes(p_shift_start, p_shift_end)
    OR p_grace_minutes IS NULL OR p_grace_minutes NOT BETWEEN 0 AND 120
    OR p_grace_minutes > p_interval_minutes
    OR cardinality(wanted) NOT BETWEEN 1 AND 50
  THEN
    RAISE EXCEPTION 'Enter a name, a shift, a round interval of 15 to 720 minutes that fits the shift, a grace period up to 120 minutes, and 1 to 50 checkpoints.'
      USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.patrol_checkpoints
      WHERE society_id = p_society_id AND id = ANY(wanted) AND active) <> cardinality(wanted)
  THEN
    RAISE EXCEPTION 'Checkpoint not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_schedule_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request id is required.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO schedule FROM public.patrol_schedules
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN schedule.id; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('patrol:schedule:' || p_society_id::text, 0));
    IF (SELECT count(*) FROM public.patrol_schedules WHERE society_id = p_society_id) >= 50 THEN
      RAISE EXCEPTION 'A society can have up to 50 patrol schedules.' USING ERRCODE = '54000';
    END IF;
    INSERT INTO public.patrol_schedules (
      society_id, name, shift_start, shift_end, interval_minutes, grace_minutes,
      effective_from, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, clean_name, p_shift_start, p_shift_end, p_interval_minutes, p_grace_minutes,
      clock_timestamp(), p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO schedule;
    INSERT INTO public.patrol_schedule_checkpoints (society_id, schedule_id, checkpoint_id, created_at, created_by)
    SELECT p_society_id, schedule.id, item, clock_timestamp(), auth.uid() FROM unnest(wanted) AS item;
    PERFORM private.patrol_audit(p_society_id, 'admin', 'schedule.create', 'patrol_schedule',
      schedule.id, jsonb_build_object('name', schedule.name, 'shift_start', schedule.shift_start,
        'shift_end', schedule.shift_end, 'interval_minutes', schedule.interval_minutes,
        'grace_minutes', schedule.grace_minutes, 'checkpoint_ids', to_jsonb(wanted)), p_request_id);
    RETURN schedule.id;
  END IF;
  SELECT * INTO schedule FROM public.patrol_schedules
    WHERE society_id = p_society_id AND id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR schedule.version <> p_expected_version THEN
    RAISE EXCEPTION 'This schedule changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  timing_changed := schedule.shift_start <> p_shift_start OR schedule.shift_end <> p_shift_end
    OR schedule.interval_minutes <> p_interval_minutes OR schedule.grace_minutes <> p_grace_minutes;
  UPDATE public.patrol_schedules
  SET name = clean_name, shift_start = p_shift_start, shift_end = p_shift_end,
    interval_minutes = p_interval_minutes, grace_minutes = p_grace_minutes,
    effective_from = CASE WHEN timing_changed THEN clock_timestamp() ELSE effective_from END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = schedule.id RETURNING * INTO schedule;
  DELETE FROM public.patrol_schedule_checkpoints
    WHERE society_id = p_society_id AND schedule_id = schedule.id AND NOT (checkpoint_id = ANY(wanted));
  INSERT INTO public.patrol_schedule_checkpoints (society_id, schedule_id, checkpoint_id, created_at, created_by)
  SELECT p_society_id, schedule.id, item, clock_timestamp(), auth.uid() FROM unnest(wanted) AS item
  ON CONFLICT (society_id, schedule_id, checkpoint_id) DO NOTHING;
  PERFORM private.patrol_audit(p_society_id, 'admin', 'schedule.update', 'patrol_schedule',
    schedule.id, jsonb_build_object('name', schedule.name, 'shift_start', schedule.shift_start,
      'shift_end', schedule.shift_end, 'interval_minutes', schedule.interval_minutes,
      'grace_minutes', schedule.grace_minutes, 'checkpoint_ids', to_jsonb(wanted),
      'version', schedule.version), p_request_id);
  RETURN schedule.id;
END;
$$;

CREATE FUNCTION public.patrol_schedule_set_active(
  p_society_id uuid, p_schedule_id uuid, p_active boolean, p_expected_version integer,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  schedule public.patrol_schedules;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Choose whether the schedule is active.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO schedule FROM public.patrol_schedules
    WHERE society_id = p_society_id AND id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR schedule.version <> p_expected_version THEN
    RAISE EXCEPTION 'This schedule changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF schedule.active = p_active THEN RETURN; END IF;
  UPDATE public.patrol_schedules
  SET active = p_active,
    effective_from = CASE WHEN p_active THEN clock_timestamp() ELSE effective_from END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = schedule.id;
  PERFORM private.patrol_audit(p_society_id, 'admin',
    CASE WHEN p_active THEN 'schedule.activate' ELSE 'schedule.deactivate' END,
    'patrol_schedule', schedule.id, jsonb_build_object('name', schedule.name), p_request_id);
END;
$$;

-- Accepts the typed code or the full QR payload. Repeat scans are recorded and harmless.
CREATE FUNCTION public.patrol_scan(
  p_society_id uuid, p_code text, p_method text, p_client_request_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_code text := upper(regexp_replace(
    regexp_replace(btrim(COALESCE(p_code, '')), '^homeish-patrol:', '', 'i'), '[[:space:]-]', '', 'g'));
  checkpoint public.patrol_checkpoints;
  scan public.patrol_scans;
BEGIN
  PERFORM private.patrol_write_begin(p_society_id, ARRAY['guard']::text[]);
  IF p_client_request_id IS NULL OR p_method IS NULL OR p_method NOT IN ('qr', 'typed')
    OR clean_code !~ '^[A-HJ-NP-Z2-9]{6}$'
  THEN
    RAISE EXCEPTION 'Enter the 6-character checkpoint code.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO scan FROM public.patrol_scans
    WHERE society_id = p_society_id AND scanned_by = auth.uid()
      AND client_request_id = p_client_request_id;
  IF FOUND THEN
    SELECT * INTO checkpoint FROM public.patrol_checkpoints WHERE id = scan.checkpoint_id;
  ELSE
    SELECT * INTO checkpoint FROM public.patrol_checkpoints
      WHERE society_id = p_society_id AND code = clean_code AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No active checkpoint has that code.' USING ERRCODE = 'P0002';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('patrol-scan:' || auth.uid()::text, 0));
    IF (SELECT count(*) FROM public.patrol_scans
        WHERE scanned_by = auth.uid() AND scanned_at > clock_timestamp() - interval '1 hour') >= 240
    THEN
      RAISE EXCEPTION 'You can record 240 checkpoint scans an hour.' USING ERRCODE = '54000';
    END IF;
    INSERT INTO public.patrol_scans (
      society_id, checkpoint_id, method, scanned_at, scanned_by, client_request_id
    ) VALUES (
      p_society_id, checkpoint.id, p_method, clock_timestamp(), auth.uid(), p_client_request_id
    ) RETURNING * INTO scan;
  END IF;
  RETURN jsonb_build_object(
    'scan_id', scan.id,
    'checkpoint_id', checkpoint.id,
    'checkpoint_name', checkpoint.name,
    'scanned_at', scan.scanned_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.patrol_settings_update(uuid, integer, text),
  public.patrol_checkpoint_save(uuid, uuid, text, text, integer, uuid, text),
  public.patrol_checkpoint_set_active(uuid, uuid, boolean, integer, text),
  public.patrol_schedule_save(uuid, uuid, text, time, time, integer, integer, uuid[], integer, uuid, text),
  public.patrol_schedule_set_active(uuid, uuid, boolean, integer, text),
  public.patrol_scan(uuid, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.patrol_settings_update(uuid, integer, text),
  public.patrol_checkpoint_save(uuid, uuid, text, text, integer, uuid, text),
  public.patrol_checkpoint_set_active(uuid, uuid, boolean, integer, text),
  public.patrol_schedule_save(uuid, uuid, text, time, time, integer, integer, uuid[], integer, uuid, text),
  public.patrol_schedule_set_active(uuid, uuid, boolean, integer, text),
  public.patrol_scan(uuid, text, text, uuid, text)
  TO authenticated;
