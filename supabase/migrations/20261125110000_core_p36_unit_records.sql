-- P36: admin-only unit measurement history, vacancy follow-ups and schematic placements.
CREATE TABLE public.unit_area_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  source text NOT NULL CHECK (char_length(btrim(source)) BETWEEN 1 AND 120),
  carpet_sqft numeric(8,2) CHECK (carpet_sqft > 0 AND carpet_sqft <= 999999.99),
  built_up_sqft numeric(8,2) CHECK (built_up_sqft > 0 AND built_up_sqft <= 999999.99),
  outdoor_sqft numeric(8,2) CHECK (outdoor_sqft > 0 AND outdoor_sqft <= 999999.99),
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'remeasure')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  client_request_id uuid NOT NULL,
  CHECK (carpet_sqft IS NOT NULL OR built_up_sqft IS NOT NULL OR outdoor_sqft IS NOT NULL),
  FOREIGN KEY (society_id, unit_id) REFERENCES public.units(society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, unit_id, version),
  UNIQUE (society_id, unit_id, created_by, client_request_id)
);
CREATE INDEX unit_area_history_actor_idx ON public.unit_area_history(created_by);

CREATE TABLE public.unit_vacancy_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  kind text NOT NULL CHECK (kind IN ('vacant', 'locked')),
  starts_on date NOT NULL,
  assigned_to uuid NOT NULL,
  inspection_on date CHECK (inspection_on >= starts_on),
  follow_up_on date NOT NULL CHECK (follow_up_on >= starts_on),
  closed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  client_request_id uuid NOT NULL,
  FOREIGN KEY (society_id, unit_id) REFERENCES public.units(society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, assigned_to) REFERENCES public.memberships(society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, unit_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX unit_vacancy_open_idx
  ON public.unit_vacancy_followups(society_id, unit_id) WHERE closed_at IS NULL;
CREATE INDEX unit_vacancy_handler_idx ON public.unit_vacancy_followups(society_id, assigned_to);
CREATE INDEX unit_vacancy_actor_idx ON public.unit_vacancy_followups(created_by);
CREATE INDEX unit_vacancy_retention_idx ON public.unit_vacancy_followups(closed_at)
  WHERE closed_at IS NOT NULL;

CREATE TABLE public.unit_floor_positions (
  id uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  block_id uuid,
  floor integer NOT NULL,
  map_row integer NOT NULL CHECK (map_row BETWEEN 1 AND 12),
  map_column integer NOT NULL CHECK (map_column BETWEEN 1 AND 12),
  PRIMARY KEY (society_id, unit_id),
  UNIQUE NULLS NOT DISTINCT (society_id, block_id, floor, map_row, map_column),
  FOREIGN KEY (society_id, unit_id) REFERENCES public.units(society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, block_id) REFERENCES public.blocks(society_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.unit_area_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_vacancy_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_floor_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unit_area_history, public.unit_vacancy_followups, public.unit_floor_positions
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY unit_area_no_direct_access ON public.unit_area_history
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY unit_vacancy_no_direct_access ON public.unit_vacancy_followups
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY unit_position_no_direct_access ON public.unit_floor_positions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER unit_area_append_only BEFORE UPDATE OR DELETE ON public.unit_area_history
  FOR EACH ROW EXECUTE FUNCTION private.reject_billing_history_mutation();

CREATE FUNCTION private.unit_position_invalidate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.unit_floor_positions
    WHERE society_id = OLD.society_id AND unit_id = OLD.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER unit_position_invalidate AFTER UPDATE OF active, floor, block_id ON public.units
  FOR EACH ROW WHEN (OLD.active IS DISTINCT FROM NEW.active OR
    OLD.floor IS DISTINCT FROM NEW.floor OR OLD.block_id IS DISTINCT FROM NEW.block_id)
  EXECUTE FUNCTION private.unit_position_invalidate();

CREATE FUNCTION private.unit_floor_snapshot(p_unit public.units)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'number', u.number, 'row', p.map_row, 'column', p.map_column,
    'placement', p.id
  ) ORDER BY u.id), '[]'::jsonb)
  FROM public.units u
  LEFT JOIN public.unit_floor_positions p ON p.society_id = u.society_id AND p.unit_id = u.id
  WHERE p_unit.active AND p_unit.floor IS NOT NULL AND u.active
    AND u.society_id = p_unit.society_id AND u.floor = p_unit.floor
    AND u.block_id IS NOT DISTINCT FROM p_unit.block_id
$$;

CREATE FUNCTION public.unit_records_get(p_society_id uuid, p_unit_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_row public.units;
  floor_data jsonb;
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin'], false);
  SELECT * INTO unit_row FROM public.units WHERE society_id = p_society_id AND id = p_unit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
  floor_data := private.unit_floor_snapshot(unit_row);
  RETURN jsonb_build_object(
    'areas', (SELECT coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'actor', private.core_toolkit_person(a.created_by)) ORDER BY a.version DESC), '[]')
      FROM public.unit_area_history a WHERE a.society_id = p_society_id AND a.unit_id = p_unit_id),
    'followups', (SELECT coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object(
      'handler', private.core_toolkit_person(m.user_id)) ORDER BY v.closed_at DESC NULLS FIRST, v.created_at DESC), '[]')
      FROM public.unit_vacancy_followups v JOIN public.memberships m
      ON m.society_id = v.society_id AND m.id = v.assigned_to
      WHERE v.society_id = p_society_id AND v.unit_id = p_unit_id),
    'admins', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', p.full_name)
      ORDER BY p.full_name, m.id), '[]') FROM public.memberships m JOIN public.profiles p ON p.id = m.user_id
      WHERE m.society_id = p_society_id AND m.status = 'active' AND m.roles @> ARRAY['admin']),
    'floor_units', floor_data,
    'floor_version', md5(jsonb_build_array(unit_row.block_id, unit_row.floor, floor_data)::text),
    'timezone', (SELECT timezone FROM public.societies WHERE id = p_society_id),
    'today', (now() AT TIME ZONE (SELECT timezone FROM public.societies WHERE id = p_society_id))::date
  );
END;
$$;

CREATE FUNCTION public.unit_records_save(
  p_society_id uuid, p_unit_id uuid, p_kind text, p_values jsonb,
  p_client_request_id uuid, p_request_trace text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_row public.units;
  area_row public.unit_area_history;
  followup_row public.unit_vacancy_followups;
  handler_id uuid;
  start_on date;
  inspect_on date;
  next_on date;
  today date;
  expected integer;
  new_status text;
  position_row integer;
  position_column integer;
  floor_data jsonb;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']);
  -- Structure writes must not change the floor between validation and placement.
  IF p_kind = 'position' THEN
    LOCK TABLE public.units IN SHARE ROW EXCLUSIVE MODE;
  END IF;
  SELECT * INTO unit_row FROM public.units WHERE society_id = p_society_id AND id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_client_request_id IS NULL OR jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid unit record.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE society_id = p_society_id
    AND entity_type = 'unit' AND entity_id = p_unit_id::text AND actor_id = auth.uid()
    AND action = 'core.unit_records.' || p_kind
    AND "after" ->> 'client_request_id' = p_client_request_id::text)
  THEN RETURN true; END IF;

  IF p_kind IN ('measure', 'verify') THEN
    IF EXISTS (SELECT 1 FROM public.unit_area_history WHERE society_id = p_society_id
      AND unit_id = p_unit_id AND created_by = auth.uid() AND client_request_id = p_client_request_id)
    THEN RETURN true; END IF;
    SELECT * INTO area_row FROM public.unit_area_history WHERE society_id = p_society_id
      AND unit_id = p_unit_id ORDER BY version DESC LIMIT 1;
    expected := (p_values ->> 'version')::integer;
    IF expected IS DISTINCT FROM coalesce(area_row.version, 0) THEN
      RAISE EXCEPTION 'The measurements changed.' USING ERRCODE = '40001';
    END IF;
    IF p_kind = 'measure' THEN
      area_row.source := private.core_toolkit_json_text(p_values, 'source', 120, 'source');
      IF EXISTS (SELECT 1 FROM jsonb_each(p_values) AS field(key, value)
        WHERE key IN ('carpet', 'builtUp', 'outdoor') AND value <> 'null'::jsonb
          AND (jsonb_typeof(value) <> 'string' OR value #>> '{}' !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$'))
      THEN RAISE EXCEPTION 'Invalid measured area.' USING ERRCODE = '22023'; END IF;
      area_row.carpet_sqft := (p_values ->> 'carpet')::numeric;
      area_row.built_up_sqft := (p_values ->> 'builtUp')::numeric;
      area_row.outdoor_sqft := (p_values ->> 'outdoor')::numeric;
      new_status := 'pending';
    ELSE
      new_status := p_values ->> 'status';
      IF area_row.status IS DISTINCT FROM 'pending'
        OR new_status IS NULL OR new_status NOT IN ('verified', 'remeasure') THEN
        RAISE EXCEPTION 'Only pending measurements can be reviewed.' USING ERRCODE = '22023';
      END IF;
    END IF;
    INSERT INTO public.unit_area_history (society_id, unit_id, version, source, carpet_sqft,
      built_up_sqft, outdoor_sqft, status, created_by, client_request_id)
    VALUES (p_society_id, p_unit_id, expected + 1, area_row.source, area_row.carpet_sqft,
      area_row.built_up_sqft, area_row.outdoor_sqft, new_status, auth.uid(), p_client_request_id);
  ELSIF p_kind IN ('vacancy', 'close') THEN
    expected := (p_values ->> 'version')::integer;
    IF expected = 0 AND EXISTS (SELECT 1 FROM public.unit_vacancy_followups WHERE society_id = p_society_id
      AND unit_id = p_unit_id AND created_by = auth.uid() AND client_request_id = p_client_request_id)
    THEN RETURN true; END IF;
    SELECT * INTO followup_row FROM public.unit_vacancy_followups WHERE society_id = p_society_id
      AND unit_id = p_unit_id AND closed_at IS NULL;
    IF expected IS DISTINCT FROM coalesce(followup_row.version, 0)
      OR (p_values ->> 'id')::uuid IS DISTINCT FROM followup_row.id THEN
      RAISE EXCEPTION 'The follow-up changed.' USING ERRCODE = '40001';
    END IF;
    IF p_kind = 'close' THEN
      IF followup_row.id IS NULL THEN RAISE EXCEPTION 'No open follow-up.' USING ERRCODE = 'P0002'; END IF;
      UPDATE public.unit_vacancy_followups SET closed_at = now(), version = version + 1
        WHERE id = followup_row.id;
    ELSE
      handler_id := (p_values ->> 'assignedTo')::uuid;
      new_status := p_values ->> 'kind';
      start_on := private.core_toolkit_json_date(p_values, 'startsOn', 'start date');
      inspect_on := private.core_toolkit_json_date(p_values, 'inspectionOn', 'inspection date');
      next_on := private.core_toolkit_json_date(p_values, 'followUpOn', 'follow-up date');
      SELECT (now() AT TIME ZONE timezone)::date INTO today FROM public.societies WHERE id = p_society_id;
      IF start_on IS NULL OR start_on > today OR next_on IS NULL OR next_on < start_on
        OR inspect_on < start_on OR new_status IS NULL OR new_status NOT IN ('vacant', 'locked')
        OR NOT EXISTS (SELECT 1 FROM public.memberships WHERE society_id = p_society_id
          AND id = handler_id AND status = 'active' AND user_id IS NOT NULL AND roles @> ARRAY['admin'])
      THEN RAISE EXCEPTION 'Invalid vacancy follow-up.' USING ERRCODE = '22023'; END IF;
      IF followup_row.id IS NULL THEN
        INSERT INTO public.unit_vacancy_followups (society_id, unit_id, kind, starts_on, assigned_to,
          inspection_on, follow_up_on, created_by, client_request_id)
        VALUES (p_society_id, p_unit_id, new_status, start_on, handler_id,
          inspect_on, next_on, auth.uid(), p_client_request_id);
      ELSE
        UPDATE public.unit_vacancy_followups SET kind = new_status, starts_on = start_on,
          assigned_to = handler_id, inspection_on = inspect_on, follow_up_on = next_on, version = version + 1
          WHERE id = followup_row.id;
      END IF;
    END IF;
  ELSIF p_kind = 'position' THEN
    IF NOT unit_row.active OR unit_row.floor IS NULL THEN
      RAISE EXCEPTION 'Record an active unit floor first.' USING ERRCODE = '22023';
    END IF;
    floor_data := private.unit_floor_snapshot(unit_row);
    IF (p_values ->> 'floorVersion') IS DISTINCT FROM
      md5(jsonb_build_array(unit_row.block_id, unit_row.floor, floor_data)::text)
    THEN RAISE EXCEPTION 'The floor layout changed.' USING ERRCODE = '40001'; END IF;
    position_row := (p_values ->> 'row')::integer;
    position_column := (p_values ->> 'column')::integer;
    IF position_row IS NULL AND position_column IS NULL THEN
      DELETE FROM public.unit_floor_positions WHERE society_id = p_society_id AND unit_id = p_unit_id;
    ELSE
      INSERT INTO public.unit_floor_positions (society_id, unit_id, block_id, floor, map_row, map_column)
      VALUES (p_society_id, p_unit_id, unit_row.block_id, unit_row.floor, position_row, position_column)
      ON CONFLICT (society_id, unit_id) DO UPDATE SET map_row = EXCLUDED.map_row,
        map_column = EXCLUDED.map_column, id = EXCLUDED.id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown unit record change.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.core_toolkit_audit(p_society_id, 'unit_records.' || p_kind,
    'unit', p_unit_id::text, NULL, jsonb_build_object('client_request_id', p_client_request_id), p_request_trace);
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid unit record.' USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION public.unit_vacancy_retention_run(p_today date, p_request_trace text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE total integer;
BEGIN
  IF p_today IS NULL THEN RAISE EXCEPTION 'Retention day required.' USING ERRCODE = '22023'; END IF;
  WITH removed AS (
    DELETE FROM public.unit_vacancy_followups v USING public.societies s
    WHERE v.society_id = s.id AND v.closed_at <
      ((p_today - interval '12 months')::date::timestamp AT TIME ZONE s.timezone)
    RETURNING v.society_id
  ), grouped AS (
    SELECT society_id, count(*)::integer AS count FROM removed GROUP BY society_id
  ), audited AS (
    INSERT INTO public.audit_logs (society_id, actor_role, action, entity_type, "after", request_id)
      SELECT society_id, 'system', 'core.unit_vacancy.retention_delete', 'unit',
        jsonb_build_object('deleted', count), p_request_trace FROM grouped RETURNING 1
  ) SELECT coalesce(sum(count), 0)::integer INTO total FROM grouped;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION private.unit_position_invalidate(), private.unit_floor_snapshot(public.units),
  public.unit_records_get(uuid, uuid), public.unit_records_save(uuid, uuid, text, jsonb, uuid, text),
  public.unit_vacancy_retention_run(date, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unit_records_get(uuid, uuid),
  public.unit_records_save(uuid, uuid, text, jsonb, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unit_vacancy_retention_run(date, text) TO service_role;
