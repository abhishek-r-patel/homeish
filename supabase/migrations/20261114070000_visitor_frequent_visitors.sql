-- Saved frequent visitors per unit, with one-step pre-approval (PRD A-10).
CREATE TABLE public.visitor_frequent_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  visitor_name text NOT NULL,
  vehicle_no text,
  last_used_at timestamptz,
  CONSTRAINT visitor_frequent_visitors_name_check
    CHECK (char_length(btrim(visitor_name)) BETWEEN 1 AND 120),
  CONSTRAINT visitor_frequent_visitors_vehicle_check
    CHECK (vehicle_no IS NULL OR char_length(vehicle_no) BETWEEN 1 AND 20),
  CONSTRAINT visitor_frequent_visitors_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT visitor_frequent_visitors_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX visitor_frequent_visitors_unit_name_key
  ON public.visitor_frequent_visitors (society_id, unit_id, lower(visitor_name));
CREATE INDEX visitor_frequent_visitors_unit_created_idx
  ON public.visitor_frequent_visitors (society_id, unit_id, created_at DESC);
CREATE INDEX visitor_frequent_visitors_created_by_idx
  ON public.visitor_frequent_visitors (created_by);
CREATE INDEX visitor_frequent_visitors_updated_by_idx
  ON public.visitor_frequent_visitors (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE TRIGGER visitor_frequent_visitors_set_updated_at
  BEFORE UPDATE ON public.visitor_frequent_visitors
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.visitor_frequent_visitors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visitor_frequent_visitors
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (
  id, society_id, created_at, updated_at, unit_id, visitor_name, vehicle_no,
  last_used_at
) ON TABLE public.visitor_frequent_visitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_frequent_visitors
  TO service_role;

CREATE POLICY visitor_frequent_visitors_read
  ON public.visitor_frequent_visitors FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'visitor')
    AND private.occupies_unit(unit_id)
  );

-- Occupants of the unit share one saved list; the society and module gates
-- match visitor_pre_approval_create.
CREATE OR REPLACE FUNCTION private.visitor_frequent_unit_allowed(
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
      AND private.module_enabled(unit.society_id, 'visitor')
  );
$$;

REVOKE ALL ON FUNCTION private.visitor_frequent_unit_allowed(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.visitor_frequent_list(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS SETOF public.visitor_frequent_visitors
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.visitor_frequent_unit_allowed(p_society_id, p_unit_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT frequent.*
  FROM public.visitor_frequent_visitors AS frequent
  WHERE frequent.society_id = p_society_id AND frequent.unit_id = p_unit_id
  ORDER BY frequent.last_used_at DESC NULLS LAST, lower(frequent.visitor_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_frequent_save(
  p_society_id uuid,
  p_unit_id uuid,
  p_visitor_name text,
  p_vehicle_no text,
  p_request_id text
)
RETURNS public.visitor_frequent_visitors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_name text := btrim(COALESCE(p_visitor_name, ''));
  clean_vehicle text := NULLIF(
    upper(regexp_replace(COALESCE(p_vehicle_no, ''), '\s', '', 'g')), ''
  );
  saved public.visitor_frequent_visitors;
  saved_count integer;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.visitor_frequent_unit_allowed(p_society_id, p_unit_id)
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  IF char_length(clean_name) NOT BETWEEN 1 AND 120
     OR (clean_vehicle IS NOT NULL AND char_length(clean_vehicle) > 20) THEN
    RAISE EXCEPTION 'The frequent visitor details are invalid.' USING ERRCODE = '22023';
  END IF;
  -- Serialise saves per unit so the cap cannot be raced past.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('visitor_frequent:' || p_unit_id::text, 0)
  );
  UPDATE public.visitor_frequent_visitors
  SET visitor_name = clean_name, vehicle_no = clean_vehicle
  WHERE society_id = p_society_id AND unit_id = p_unit_id
    AND lower(visitor_name) = lower(clean_name)
  RETURNING * INTO saved;
  IF NOT FOUND THEN
    SELECT count(*) INTO saved_count
    FROM public.visitor_frequent_visitors
    WHERE society_id = p_society_id AND unit_id = p_unit_id;
    IF saved_count >= 50 THEN
      RAISE EXCEPTION 'A unit can save at most 50 frequent visitors.'
        USING ERRCODE = '54000';
    END IF;
    INSERT INTO public.visitor_frequent_visitors (
      society_id, unit_id, visitor_name, vehicle_no, created_by, updated_by
    )
    VALUES (
      p_society_id, p_unit_id, clean_name, clean_vehicle, auth.uid(), auth.uid()
    )
    RETURNING * INTO saved;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'resident', 'visitor.frequent.save',
    'visitor_frequent_visitor', saved.id::text, p_request_id
  );
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_frequent_remove(
  p_society_id uuid,
  p_frequent_visitor_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.visitor_frequent_visitors;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target
  FROM public.visitor_frequent_visitors
  WHERE society_id = p_society_id AND id = p_frequent_visitor_id
  FOR UPDATE;
  IF NOT FOUND
     OR NOT private.visitor_frequent_unit_allowed(p_society_id, target.unit_id) THEN
    RAISE EXCEPTION 'The frequent visitor was not found.' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.visitor_frequent_visitors
  WHERE society_id = p_society_id AND id = target.id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'resident', 'visitor.frequent.remove',
    'visitor_frequent_visitor', target.id::text, p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_frequent_pre_approve(
  p_society_id uuid,
  p_frequent_visitor_id uuid,
  p_valid_from timestamptz,
  p_valid_to timestamptz,
  p_request_id text
)
RETURNS public.visitor_pre_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.visitor_frequent_visitors;
  approval public.visitor_pre_approvals;
  previous_approval_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Unit occupant access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target
  FROM public.visitor_frequent_visitors
  WHERE society_id = p_society_id AND id = p_frequent_visitor_id
  FOR UPDATE;
  IF NOT FOUND
     OR NOT private.visitor_frequent_unit_allowed(p_society_id, target.unit_id) THEN
    RAISE EXCEPTION 'The frequent visitor was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 120
     OR p_valid_from IS NULL OR p_valid_to IS NULL
     OR p_valid_to <= p_valid_from THEN
    RAISE EXCEPTION 'The pre-approval window is invalid.' USING ERRCODE = '22023';
  END IF;

  -- A retried request returns the pre-approval it already created.
  SELECT (audit."after" ->> 'pre_approval_id')::uuid INTO previous_approval_id
  FROM public.audit_logs AS audit
  WHERE audit.society_id = p_society_id
    AND audit.entity_type = 'visitor_frequent_visitor'
    AND audit.entity_id = target.id::text
    AND audit.action = 'visitor.frequent.pre_approve'
    AND audit.actor_id = auth.uid()
    AND audit.request_id = p_request_id
  ORDER BY audit.id DESC
  LIMIT 1;
  IF previous_approval_id IS NOT NULL THEN
    SELECT * INTO approval
    FROM public.visitor_pre_approvals
    WHERE society_id = p_society_id AND id = previous_approval_id;
    IF FOUND THEN RETURN approval; END IF;
  END IF;

  approval := public.visitor_pre_approval_create(
    target.unit_id, target.visitor_name, p_valid_from, p_valid_to,
    target.vehicle_no, p_request_id
  );
  UPDATE public.visitor_frequent_visitors
  SET last_used_at = now()
  WHERE society_id = p_society_id AND id = target.id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'resident', 'visitor.frequent.pre_approve',
    'visitor_frequent_visitor', target.id::text,
    pg_catalog.jsonb_build_object('pre_approval_id', approval.id), p_request_id
  );
  RETURN approval;
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_frequent_list(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_frequent_save(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_frequent_remove(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_frequent_pre_approve(
  uuid, uuid, timestamptz, timestamptz, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.visitor_frequent_list(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_frequent_save(uuid, uuid, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_frequent_remove(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_frequent_pre_approve(
  uuid, uuid, timestamptz, timestamptz, text
) TO authenticated;
