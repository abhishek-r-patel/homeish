-- Let residents pre-announce an expected delivery so the gate sees it (PRD DEL-4, A-14).
CREATE TABLE public.delivery_pre_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  platform text NOT NULL,
  expected_from timestamptz NOT NULL,
  expected_to timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'expected',
  cancelled_at timestamptz,
  client_request_id uuid NOT NULL,
  CONSTRAINT delivery_pre_announcements_platform_check
    CHECK (char_length(btrim(platform)) BETWEEN 1 AND 60),
  CONSTRAINT delivery_pre_announcements_window_check
    CHECK (
      expected_to > expected_from
      AND expected_to <= expected_from + interval '24 hours'
    ),
  CONSTRAINT delivery_pre_announcements_status_check
    CHECK (status IN ('expected', 'cancelled')),
  CONSTRAINT delivery_pre_announcements_cancelled_check
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT delivery_pre_announcements_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT delivery_pre_announcements_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT delivery_pre_announcements_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE INDEX delivery_pre_announcements_expected_idx
  ON public.delivery_pre_announcements (society_id, expected_to)
  WHERE status = 'expected';
CREATE INDEX delivery_pre_announcements_unit_idx
  ON public.delivery_pre_announcements (society_id, unit_id, expected_from DESC);
CREATE INDEX delivery_pre_announcements_created_by_idx
  ON public.delivery_pre_announcements (created_by);
CREATE INDEX delivery_pre_announcements_updated_by_idx
  ON public.delivery_pre_announcements (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE TRIGGER delivery_pre_announcements_set_updated_at
  BEFORE UPDATE ON public.delivery_pre_announcements
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.delivery_pre_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_pre_announcements
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (
  id, society_id, created_at, unit_id, platform, expected_from, expected_to,
  status, cancelled_at
) ON TABLE public.delivery_pre_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_pre_announcements
  TO service_role;

CREATE POLICY delivery_pre_announcements_read
  ON public.delivery_pre_announcements FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'delivery')
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee', 'guard']::text[])
      OR private.occupies_unit(unit_id)
    )
  );

-- Any active resident occupant of the unit may announce; matches the read rule.
CREATE OR REPLACE FUNCTION private.delivery_announce_unit_allowed(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.units AS unit
    WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
      AND unit.active
      AND private.occupies_unit(unit.id)
      AND private.has_role(unit.society_id, ARRAY['resident']::text[])
      AND private.module_enabled(unit.society_id, 'delivery')
  );
$$;

REVOKE ALL ON FUNCTION private.delivery_announce_unit_allowed(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_pre_announce_create(
  p_society_id uuid,
  p_unit_id uuid,
  p_platform text,
  p_expected_from timestamptz,
  p_expected_to timestamptz,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS public.delivery_pre_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  clean_platform text := btrim(COALESCE(p_platform, ''));
  saved public.delivery_pre_announcements;
  active_count integer;
BEGIN
  IF actor_id IS NULL
     OR NOT private.delivery_announce_unit_allowed(p_society_id, p_unit_id)
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_client_request_id IS NULL
     OR char_length(clean_platform) NOT BETWEEN 1 AND 60
     OR p_expected_from IS NULL OR p_expected_to IS NULL
     OR p_expected_to <= p_expected_from
     OR p_expected_to > p_expected_from + interval '24 hours'
     OR p_expected_to <= now()
     OR p_expected_from > now() + interval '30 days' THEN
    RAISE EXCEPTION 'The expected delivery details are invalid.'
      USING ERRCODE = '22023';
  END IF;
  -- Serialise per unit so a duplicate submission sees the committed row and the
  -- cap cannot be raced past.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('delivery_pre_announce:' || p_unit_id::text, 0)
  );
  SELECT * INTO saved
  FROM public.delivery_pre_announcements
  WHERE society_id = p_society_id
    AND created_by = actor_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN saved; END IF;

  SELECT count(*) INTO active_count
  FROM public.delivery_pre_announcements
  WHERE society_id = p_society_id AND unit_id = p_unit_id
    AND status = 'expected' AND expected_to > now();
  IF active_count >= 20 THEN
    RAISE EXCEPTION 'A unit can have at most 20 expected deliveries.'
      USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.delivery_pre_announcements (
    society_id, unit_id, platform, expected_from, expected_to,
    client_request_id, created_by, updated_by
  )
  VALUES (
    p_society_id, p_unit_id, clean_platform, p_expected_from, p_expected_to,
    p_client_request_id, actor_id, actor_id
  )
  RETURNING * INTO saved;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, actor_id, 'resident', 'delivery.pre_announce.create',
    'delivery_pre_announcement', saved.id::text, p_request_id
  );
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_pre_announce_cancel(
  p_society_id uuid,
  p_announcement_id uuid,
  p_request_id text
)
RETURNS public.delivery_pre_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.delivery_pre_announcements;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.module_enabled(p_society_id, 'delivery')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target
  FROM public.delivery_pre_announcements
  WHERE society_id = p_society_id AND id = p_announcement_id
  FOR UPDATE;
  IF NOT FOUND
     OR NOT private.delivery_announce_unit_allowed(p_society_id, target.unit_id) THEN
    RAISE EXCEPTION 'The expected delivery was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF target.status = 'cancelled' THEN RETURN target; END IF;
  UPDATE public.delivery_pre_announcements
  SET status = 'cancelled', cancelled_at = now()
  WHERE society_id = p_society_id AND id = target.id
  RETURNING * INTO target;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'resident', 'delivery.pre_announce.cancel',
    'delivery_pre_announcement', target.id::text, p_request_id
  );
  RETURN target;
END;
$$;

-- Gate staff see every upcoming announcement; residents see their unit's.
CREATE OR REPLACE FUNCTION public.delivery_pre_announce_list(
  p_society_id uuid,
  p_unit_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  unit_id uuid,
  platform text,
  expected_from timestamptz,
  expected_to timestamptz,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.module_enabled(p_society_id, 'delivery') THEN
    RAISE EXCEPTION 'Delivery list access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_unit_id IS NULL THEN
    IF NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'guard']::text[]
    ) THEN
      RAISE EXCEPTION 'Delivery list access is required.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT private.delivery_announce_unit_allowed(p_society_id, p_unit_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT announcement.id, announcement.unit_id, announcement.platform,
    announcement.expected_from, announcement.expected_to,
    announcement.status, announcement.created_at
  FROM public.delivery_pre_announcements AS announcement
  WHERE announcement.society_id = p_society_id
    AND (p_unit_id IS NULL OR announcement.unit_id = p_unit_id)
    AND announcement.status = 'expected'
    AND announcement.expected_to > now()
  ORDER BY announcement.expected_from, announcement.created_at
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_pre_announce_create(
  uuid, uuid, text, timestamptz, timestamptz, uuid, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_pre_announce_cancel(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.delivery_pre_announce_list(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_pre_announce_create(
  uuid, uuid, text, timestamptz, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_pre_announce_cancel(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_pre_announce_list(uuid, uuid)
  TO authenticated;
