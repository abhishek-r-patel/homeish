-- Utility meters, flat per-type rates, readings with resident photo review and pending utility charges.
-- Consumption = approved reading - previous approved reading (or the meter's initial reading).
-- A reading lower than the previous one needs a reason, consumes 0 and becomes the new baseline (a reset).
CREATE TABLE public.metering_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meter_type text NOT NULL,
  scope text NOT NULL,
  unit_id uuid,
  label text NOT NULL,
  serial_number text,
  initial_reading numeric(14, 3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT metering_meters_type_check CHECK (meter_type IN ('water', 'electricity', 'dg', 'gas')),
  CONSTRAINT metering_meters_scope_check CHECK (scope IN ('unit', 'common')),
  CONSTRAINT metering_meters_scope_unit_check CHECK ((scope = 'unit') = (unit_id IS NOT NULL)),
  CONSTRAINT metering_meters_label_check
    CHECK (char_length(label) BETWEEN 1 AND 60 AND label = btrim(label)),
  CONSTRAINT metering_meters_serial_check
    CHECK (serial_number IS NULL OR (
      char_length(serial_number) BETWEEN 1 AND 60 AND serial_number = btrim(serial_number)
    )),
  CONSTRAINT metering_meters_initial_check CHECK (initial_reading >= 0),
  CONSTRAINT metering_meters_version_check CHECK (version >= 1),
  CONSTRAINT metering_meters_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_meters_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT metering_meters_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX metering_meters_label_key ON public.metering_meters (society_id, lower(label));
CREATE INDEX metering_meters_unit_idx ON public.metering_meters (society_id, unit_id);
CREATE INDEX metering_meters_created_by_idx ON public.metering_meters (created_by);
CREATE INDEX metering_meters_updated_by_idx ON public.metering_meters (updated_by);

-- Append-only rate history. The current rate for a type is its latest row; bills store the rate used.
CREATE TABLE public.metering_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meter_type text NOT NULL,
  rate_paise integer NOT NULL,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT metering_rates_type_check CHECK (meter_type IN ('water', 'electricity', 'dg', 'gas')),
  CONSTRAINT metering_rates_paise_check CHECK (rate_paise BETWEEN 0 AND 10000000),
  CONSTRAINT metering_rates_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT metering_rates_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX metering_rates_current_idx
  ON public.metering_rates (society_id, meter_type, created_at DESC, id DESC);
CREATE INDEX metering_rates_created_by_idx ON public.metering_rates (created_by);

CREATE TABLE public.metering_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  meter_id uuid NOT NULL,
  unit_id uuid,
  reading_value numeric(14, 3) NOT NULL,
  reading_date date NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  lower_reason text,
  photo_path text,
  photo_content_type text,
  photo_size_bytes integer,
  previous_reading_id uuid,
  previous_value numeric(14, 3),
  consumption numeric(14, 3),
  is_reset boolean NOT NULL DEFAULT false,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT metering_readings_value_check CHECK (reading_value >= 0),
  CONSTRAINT metering_readings_source_check CHECK (source IN ('admin', 'guard', 'resident')),
  CONSTRAINT metering_readings_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT metering_readings_lower_reason_check
    CHECK (lower_reason IS NULL OR (
      char_length(lower_reason) BETWEEN 3 AND 300 AND lower_reason = btrim(lower_reason)
    )),
  CONSTRAINT metering_readings_rejection_reason_check
    CHECK (rejection_reason IS NULL OR (
      char_length(rejection_reason) BETWEEN 3 AND 300 AND rejection_reason = btrim(rejection_reason)
    )),
  CONSTRAINT metering_readings_photo_check CHECK (
    (photo_path IS NULL AND photo_content_type IS NULL AND photo_size_bytes IS NULL)
    OR (photo_path IS NOT NULL AND photo_content_type IN ('image/jpeg', 'image/png')
      AND photo_size_bytes BETWEEN 1 AND 5242880)
  ),
  CONSTRAINT metering_readings_resident_photo_check CHECK (source <> 'resident' OR photo_path IS NOT NULL),
  CONSTRAINT metering_readings_state_check CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL AND previous_reading_id IS NULL
      AND previous_value IS NULL AND consumption IS NULL AND NOT is_reset AND rejection_reason IS NULL)
    OR (status = 'rejected' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL
      AND previous_reading_id IS NULL AND previous_value IS NULL AND consumption IS NULL
      AND NOT is_reset AND rejection_reason IS NOT NULL)
    OR (status = 'approved' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL
      AND previous_value IS NOT NULL AND consumption IS NOT NULL AND rejection_reason IS NULL
      AND is_reset = (reading_value < previous_value)
      AND ((is_reset AND consumption = 0 AND lower_reason IS NOT NULL)
        OR (NOT is_reset AND consumption = reading_value - previous_value)))
  ),
  CONSTRAINT metering_readings_meter_same_society_fkey
    FOREIGN KEY (society_id, meter_id) REFERENCES public.metering_meters (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_readings_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_readings_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT metering_readings_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
ALTER TABLE public.metering_readings ADD CONSTRAINT metering_readings_previous_same_society_fkey
  FOREIGN KEY (society_id, previous_reading_id)
  REFERENCES public.metering_readings (society_id, id) ON DELETE RESTRICT;
-- The approved readings of a meter form a single chain: one first reading and one successor each.
CREATE UNIQUE INDEX metering_readings_chain_key
  ON public.metering_readings (meter_id, previous_reading_id)
  WHERE status = 'approved' AND previous_reading_id IS NOT NULL;
CREATE UNIQUE INDEX metering_readings_chain_start_key
  ON public.metering_readings (meter_id) WHERE status = 'approved' AND previous_reading_id IS NULL;
CREATE UNIQUE INDEX metering_readings_one_pending_key
  ON public.metering_readings (meter_id) WHERE status = 'pending';
CREATE UNIQUE INDEX metering_readings_photo_key
  ON public.metering_readings (photo_path) WHERE photo_path IS NOT NULL;
CREATE INDEX metering_readings_meter_date_idx
  ON public.metering_readings (society_id, meter_id, reading_date DESC, created_at DESC);
CREATE INDEX metering_readings_unit_idx ON public.metering_readings (society_id, unit_id, created_at DESC);
CREATE INDEX metering_readings_previous_idx ON public.metering_readings (society_id, previous_reading_id);
CREATE INDEX metering_readings_status_idx ON public.metering_readings (society_id, status, created_at);
CREATE INDEX metering_readings_created_by_idx ON public.metering_readings (created_by);
CREATE INDEX metering_readings_reviewed_by_idx ON public.metering_readings (reviewed_by);

-- One charge per approved unit-meter reading with consumption, created only while billing is enabled.
-- The rate is applied when the charge is billed, so a rate change applies to every unbilled reading.
CREATE TABLE public.metering_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  reading_id uuid NOT NULL,
  meter_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  meter_type text NOT NULL,
  consumption numeric(14, 3) NOT NULL,
  reading_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rate_id uuid,
  rate_paise integer,
  -- amount_paise is the exact charge (consumption x rate, half up to whole paise); billed_paise is the
  -- bill line after billing's rounding setting (whole rupees when rounding = 'rupee').
  amount_paise bigint,
  billed_paise bigint,
  bill_id uuid,
  billed_at timestamptz,
  billed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT metering_charges_type_check CHECK (meter_type IN ('water', 'electricity', 'dg', 'gas')),
  CONSTRAINT metering_charges_consumption_check CHECK (consumption > 0),
  CONSTRAINT metering_charges_status_check CHECK (status IN ('pending', 'billed', 'no_charge')),
  CONSTRAINT metering_charges_state_check CHECK (
    (status = 'pending' AND rate_id IS NULL AND rate_paise IS NULL AND amount_paise IS NULL
      AND billed_paise IS NULL AND bill_id IS NULL AND billed_at IS NULL AND billed_by IS NULL)
    OR (status = 'billed' AND rate_id IS NOT NULL AND rate_paise IS NOT NULL
      AND amount_paise BETWEEN 1 AND 9007199254740991
      AND billed_paise BETWEEN 1 AND 9007199254740991 AND bill_id IS NOT NULL
      AND billed_at IS NOT NULL AND billed_by IS NOT NULL)
    OR (status = 'no_charge' AND rate_id IS NOT NULL AND rate_paise IS NOT NULL
      AND amount_paise BETWEEN 0 AND 9007199254740991 AND billed_paise = 0
      AND bill_id IS NULL AND billed_at IS NOT NULL AND billed_by IS NOT NULL)
  ),
  CONSTRAINT metering_charges_reading_key UNIQUE (reading_id),
  CONSTRAINT metering_charges_reading_same_society_fkey
    FOREIGN KEY (society_id, reading_id) REFERENCES public.metering_readings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_charges_meter_same_society_fkey
    FOREIGN KEY (society_id, meter_id) REFERENCES public.metering_meters (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_charges_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_charges_rate_same_society_fkey
    FOREIGN KEY (society_id, rate_id) REFERENCES public.metering_rates (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_charges_bill_same_society_fkey
    FOREIGN KEY (society_id, bill_id) REFERENCES public.billing_bills (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT metering_charges_society_id_id_key UNIQUE (society_id, id)
);
CREATE INDEX metering_charges_pending_idx
  ON public.metering_charges (society_id, status, unit_id, reading_date);
CREATE INDEX metering_charges_reading_idx ON public.metering_charges (society_id, reading_id);
CREATE INDEX metering_charges_meter_idx ON public.metering_charges (society_id, meter_id);
CREATE INDEX metering_charges_unit_idx ON public.metering_charges (society_id, unit_id);
CREATE INDEX metering_charges_rate_idx ON public.metering_charges (society_id, rate_id);
CREATE INDEX metering_charges_bill_idx ON public.metering_charges (society_id, bill_id);
CREATE INDEX metering_charges_billed_by_idx ON public.metering_charges (billed_by);

ALTER TABLE public.metering_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metering_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metering_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metering_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.metering_meters, public.metering_rates, public.metering_readings,
  public.metering_charges FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY metering_meters_no_direct_access ON public.metering_meters
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY metering_rates_no_direct_access ON public.metering_rates
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY metering_readings_no_direct_access ON public.metering_readings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY metering_charges_no_direct_access ON public.metering_charges
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER metering_meters_no_delete BEFORE DELETE ON public.metering_meters
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_meters_no_truncate BEFORE TRUNCATE ON public.metering_meters
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_rates_no_change BEFORE UPDATE OR DELETE ON public.metering_rates
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_rates_no_truncate BEFORE TRUNCATE ON public.metering_rates
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_readings_no_delete BEFORE DELETE ON public.metering_readings
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_readings_no_truncate BEFORE TRUNCATE ON public.metering_readings
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_charges_no_delete BEFORE DELETE ON public.metering_charges
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER metering_charges_no_truncate BEFORE TRUNCATE ON public.metering_charges
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.metering_meter_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.society_id <> OLD.society_id OR NEW.meter_type <> OLD.meter_type OR NEW.scope <> OLD.scope
    OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
  ) THEN
    RAISE EXCEPTION 'A meter type, scope and unit cannot change.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.initial_reading <> OLD.initial_reading AND EXISTS (
    SELECT 1 FROM public.metering_readings WHERE society_id = NEW.society_id AND meter_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'The initial reading cannot change after readings exist.' USING ERRCODE = '23514';
  END IF;
  IF NEW.unit_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.active) AND NOT EXISTS (
    SELECT 1 FROM public.units WHERE society_id = NEW.society_id AND id = NEW.unit_id AND active
  ) THEN
    RAISE EXCEPTION 'The unit is not active.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_meter_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER metering_meters_guard BEFORE INSERT OR UPDATE ON public.metering_meters
  FOR EACH ROW EXECUTE FUNCTION private.metering_meter_guard();

CREATE FUNCTION private.metering_reading_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  meter public.metering_meters;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO meter FROM public.metering_meters WHERE society_id = NEW.society_id AND id = NEW.meter_id;
    IF NOT meter.active OR NEW.unit_id IS DISTINCT FROM meter.unit_id THEN
      RAISE EXCEPTION 'The reading does not match an active meter.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' OR (
    NEW.society_id, NEW.meter_id, NEW.unit_id, NEW.reading_value, NEW.reading_date, NEW.source,
    NEW.photo_path, NEW.photo_content_type, NEW.photo_size_bytes, NEW.client_request_id,
    NEW.created_at, NEW.created_by
  ) IS DISTINCT FROM (
    OLD.society_id, OLD.meter_id, OLD.unit_id, OLD.reading_value, OLD.reading_date, OLD.source,
    OLD.photo_path, OLD.photo_content_type, OLD.photo_size_bytes, OLD.client_request_id,
    OLD.created_at, OLD.created_by
  ) THEN
    RAISE EXCEPTION 'Only a pending reading can be reviewed.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_reading_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER metering_readings_guard BEFORE INSERT OR UPDATE ON public.metering_readings
  FOR EACH ROW EXECUTE FUNCTION private.metering_reading_guard();

CREATE FUNCTION private.metering_charge_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'pending' OR (
    NEW.society_id, NEW.reading_id, NEW.meter_id, NEW.unit_id, NEW.meter_type, NEW.consumption,
    NEW.reading_date, NEW.created_at
  ) IS DISTINCT FROM (
    OLD.society_id, OLD.reading_id, OLD.meter_id, OLD.unit_id, OLD.meter_type, OLD.consumption,
    OLD.reading_date, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'A billed utility charge cannot change.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_charge_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER metering_charges_guard BEFORE UPDATE ON public.metering_charges
  FOR EACH ROW EXECUTE FUNCTION private.metering_charge_guard();

CREATE FUNCTION private.metering_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'metering')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Metering access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.metering_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.metering_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.metering_authorize(p_society_id, p_roles, true);
END;
$$;
REVOKE ALL ON FUNCTION private.metering_write_begin(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.metering_is_unit_resident(p_society_id uuid, p_unit_id uuid)
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
REVOKE ALL ON FUNCTION private.metering_is_unit_resident(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.metering_today(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (clock_timestamp() AT TIME ZONE COALESCE(society.timezone, 'Asia/Kolkata'))::date
  FROM public.societies AS society WHERE society.id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.metering_today(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.metering_audit(
  p_society_id uuid, p_actor_role text, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), p_actor_role, 'metering.' || p_action, p_entity_type,
    p_entity_id::text, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.metering_audit(uuid, text, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Photo paths: <society>/readings/<uploader>/<uuid>.(jpg|png). Unattached uploads stay visible only to
-- their uploader and are purged after 24 hours. Attached photos are kept with the reading.
CREATE FUNCTION private.metering_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  uploader_id uuid;
  reading public.metering_readings;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/readings/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
  ) THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  uploader_id := split_part(p_path, '/', 3)::uuid;
  IF auth.uid() IS NULL OR NOT private.module_enabled(target_society_id, 'metering')
    OR NOT private.is_member(target_society_id)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived')
  THEN RETURN false; END IF;
  SELECT * INTO reading FROM public.metering_readings AS item
    WHERE item.society_id = target_society_id AND item.photo_path = p_path;
  IF p_write THEN
    RETURN reading.id IS NULL AND uploader_id = auth.uid()
      AND private.society_writable(target_society_id)
      AND private.has_role(target_society_id, ARRAY['admin', 'guard', 'resident']::text[]);
  END IF;
  IF reading.id IS NULL THEN
    RETURN uploader_id = auth.uid();
  END IF;
  RETURN private.has_role(target_society_id, ARRAY['admin', 'committee']::text[])
    OR reading.created_by = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION private.metering_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.metering_file_access(text, boolean) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('metering-photos', 'metering-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']::text[]);
CREATE POLICY metering_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'metering-photos' AND private.metering_file_access(name, false));
CREATE POLICY metering_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'metering-photos' AND private.metering_file_access(name, true));

-- Validates an uploaded reading photo and returns its stored content type and size.
CREATE FUNCTION private.metering_photo_check(p_society_id uuid, p_path text)
RETURNS TABLE(content_type text, size_bytes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  object_metadata jsonb;
  object_created_at timestamptz;
BEGIN
  IF split_part(COALESCE(p_path, ''), '/', 1) <> p_society_id::text
    OR split_part(p_path, '/', 3) <> auth.uid()::text
    OR NOT COALESCE(private.metering_file_access(p_path, true), false)
  THEN
    RAISE EXCEPTION 'Upload the meter photo again.' USING ERRCODE = '22023';
  END IF;
  SELECT object.metadata, object.created_at INTO object_metadata, object_created_at
    FROM storage.objects AS object
    WHERE object.bucket_id = 'metering-photos' AND object.name = p_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload the meter photo again.' USING ERRCODE = '22023';
  END IF;
  -- Matches the 24-hour cleanup of unattached uploads.
  IF object_created_at IS NULL OR object_created_at <= clock_timestamp() - interval '24 hours' THEN
    RAISE EXCEPTION 'Photo upload expired. Upload it again.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
    OR (object_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880
    OR NOT (
      (object_metadata ->> 'mimetype' = 'image/jpeg' AND right(p_path, 4) = '.jpg')
      OR (object_metadata ->> 'mimetype' = 'image/png' AND right(p_path, 4) = '.png')
    )
  THEN
    RAISE EXCEPTION 'Upload a JPG or PNG photo up to 5 MiB.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT object_metadata ->> 'mimetype', (object_metadata ->> 'size')::integer;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_photo_check(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- The latest approved reading of a meter: the end of its approved chain.
CREATE FUNCTION private.metering_head(p_society_id uuid, p_meter_id uuid)
RETURNS public.metering_readings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT reading.* FROM public.metering_readings AS reading
  WHERE reading.society_id = p_society_id AND reading.meter_id = p_meter_id
    AND reading.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.metering_readings AS successor
      WHERE successor.society_id = reading.society_id AND successor.previous_reading_id = reading.id
        AND successor.status = 'approved'
    )
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.metering_head(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Creates the pending charge for a newly approved reading. Common-area meters, zero consumption and
-- readings approved while billing is disabled are never billed.
CREATE FUNCTION private.metering_charge_create(p_reading public.metering_readings)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  meter public.metering_meters;
BEGIN
  SELECT * INTO meter FROM public.metering_meters
    WHERE society_id = p_reading.society_id AND id = p_reading.meter_id;
  IF p_reading.status <> 'approved' OR meter.scope <> 'unit' OR p_reading.consumption <= 0
    OR NOT private.module_enabled(p_reading.society_id, 'billing')
  THEN RETURN; END IF;
  INSERT INTO public.metering_charges (
    society_id, reading_id, meter_id, unit_id, meter_type, consumption, reading_date
  ) VALUES (
    p_reading.society_id, p_reading.id, meter.id, meter.unit_id, meter.meter_type,
    p_reading.consumption, p_reading.reading_date
  ) ON CONFLICT (reading_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.metering_charge_create(public.metering_readings)
  FROM PUBLIC, anon, authenticated, service_role;
