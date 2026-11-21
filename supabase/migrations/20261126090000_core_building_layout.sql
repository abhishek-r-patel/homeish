-- P36 building layout: per-building floors and spaces replace the row/column floor schematic.

-- Retire the pilot row/column placements; their only data was synthetic.
DROP TRIGGER unit_position_invalidate ON public.units;
DROP FUNCTION private.unit_position_invalidate();

CREATE TABLE public.building_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  block_id uuid NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN -5 AND 99),
  label text CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 30),
  whole boolean NOT NULL DEFAULT false,
  UNIQUE (society_id, id),
  UNIQUE (society_id, block_id, level),
  FOREIGN KEY (society_id, block_id) REFERENCES public.blocks(society_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.building_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  floor_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
  kind text NOT NULL
    CHECK (kind IN ('unit', 'upper', 'parking', 'amenity', 'shop', 'service', 'gap')),
  name text CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 40),
  duplex boolean NOT NULL DEFAULT false,
  unit_id uuid,
  CHECK (unit_id IS NULL OR kind = 'unit'),
  CHECK (NOT duplex OR kind = 'unit'),
  CHECK (kind NOT IN ('unit', 'upper', 'gap') OR name IS NULL),
  -- Deferred so a whole-building save can reorder spots without transient clashes.
  CONSTRAINT building_spaces_floor_position_key UNIQUE (floor_id, position)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (society_id, unit_id),
  FOREIGN KEY (society_id, floor_id) REFERENCES public.building_floors(society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, unit_id) REFERENCES public.units(society_id, id) ON DELETE RESTRICT
);
CREATE INDEX building_spaces_floor_idx ON public.building_spaces(society_id, floor_id);

ALTER TABLE public.building_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_spaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.building_floors, public.building_spaces
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY building_floors_no_direct_access ON public.building_floors
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY building_spaces_no_direct_access ON public.building_spaces
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Placing a unit sets its block and floor, so any later change to them unplaces it.
CREATE FUNCTION private.building_unit_unplace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.building_spaces SET unit_id = NULL
    WHERE society_id = OLD.society_id AND unit_id = OLD.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER building_unit_unplace AFTER UPDATE OF active, floor, block_id ON public.units
  FOR EACH ROW WHEN (OLD.active IS DISTINCT FROM NEW.active OR
    OLD.floor IS DISTINCT FROM NEW.floor OR OLD.block_id IS DISTINCT FROM NEW.block_id)
  EXECUTE FUNCTION private.building_unit_unplace();

CREATE FUNCTION private.building_block_archive_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.building_spaces s JOIN public.building_floors f
    ON f.society_id = s.society_id AND f.id = s.floor_id
    WHERE f.society_id = OLD.society_id AND f.block_id = OLD.id AND s.unit_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Move this building’s placed units first.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER building_block_archive_guard BEFORE UPDATE OF active ON public.blocks
  FOR EACH ROW WHEN (OLD.active AND NOT NEW.active)
  EXECUTE FUNCTION private.building_block_archive_guard();

CREATE FUNCTION private.building_layout_snapshot(p_society_id uuid, p_block_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'level', f.level, 'label', f.label, 'whole', f.whole,
    'spaces', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'kind', s.kind, 'name', s.name, 'duplex', s.duplex,
      'unit', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id', u.id, 'number', u.number) END
    ) ORDER BY s.position), '[]'::jsonb)
      FROM public.building_spaces s
      LEFT JOIN public.units u ON u.society_id = s.society_id AND u.id = s.unit_id
      WHERE s.society_id = f.society_id AND s.floor_id = f.id)
  ) ORDER BY f.level DESC), '[]'::jsonb)
  FROM public.building_floors f
  WHERE f.society_id = p_society_id AND f.block_id = p_block_id
$$;

CREATE FUNCTION private.building_layout_version(p_society_id uuid, p_block_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT md5(jsonb_build_array(b.name, private.building_layout_snapshot(p_society_id, p_block_id))::text)
  FROM public.blocks b WHERE b.society_id = p_society_id AND b.id = p_block_id
$$;

CREATE FUNCTION public.building_layout_get(p_society_id uuid, p_block_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  selected uuid;
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  SELECT id INTO selected FROM public.blocks
    WHERE society_id = p_society_id AND active
    ORDER BY (id = p_block_id) DESC, name, id LIMIT 1;
  RETURN jsonb_build_object(
    'buildings', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)
      ORDER BY name, id), '[]'::jsonb) FROM public.blocks WHERE society_id = p_society_id AND active),
    'selected', selected,
    'floors', CASE WHEN selected IS NULL THEN '[]'::jsonb
      ELSE private.building_layout_snapshot(p_society_id, selected) END,
    'version', CASE WHEN selected IS NULL THEN NULL
      ELSE private.building_layout_version(p_society_id, selected) END
  );
END;
$$;

CREATE FUNCTION public.building_layout_save(
  p_society_id uuid, p_block_id uuid, p_values jsonb,
  p_client_request_id uuid, p_request_trace text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  block_row public.blocks;
  target uuid := p_block_id;
  clean_name text;
  floor_value jsonb;
  space_value jsonb;
  space_index integer;
  floor_level integer;
  floor_whole boolean;
  space_kind text;
  space_count integer;
  floor_total integer;
  space_total integer;
  done_id text;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']);
  IF p_client_request_id IS NULL OR jsonb_typeof(p_values) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_values -> 'floors') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_values -> 'version') NOT IN ('string', 'null')
  THEN RAISE EXCEPTION 'Invalid building layout.' USING ERRCODE = '22023'; END IF;
  SELECT entity_id INTO done_id FROM public.audit_logs WHERE society_id = p_society_id
    AND entity_type = 'block' AND actor_id = auth.uid() AND action = 'core.building_layout.save'
    AND "after" ->> 'client_request_id' = p_client_request_id::text LIMIT 1;
  IF done_id IS NOT NULL THEN RETURN done_id::uuid; END IF;

  clean_name := private.core_toolkit_json_text(p_values, 'name', 60, 'building name');
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Enter a building name.' USING ERRCODE = '22023';
  END IF;
  IF target IS NULL THEN
    IF p_values ->> 'version' IS NOT NULL THEN
      RAISE EXCEPTION 'The building layout changed.' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.blocks (society_id, name) VALUES (p_society_id, clean_name)
      RETURNING id INTO target;
  ELSE
    SELECT * INTO block_row FROM public.blocks
      WHERE society_id = p_society_id AND id = target AND active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Building not found.' USING ERRCODE = 'P0002'; END IF;
    IF (p_values ->> 'version') IS DISTINCT FROM private.building_layout_version(p_society_id, target) THEN
      RAISE EXCEPTION 'The building layout changed.' USING ERRCODE = '40001';
    END IF;
    IF clean_name IS DISTINCT FROM block_row.name THEN
      UPDATE public.blocks SET name = clean_name WHERE id = target;
    END IF;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.layout_floors (
    level integer PRIMARY KEY, label text, whole boolean NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.layout_spaces (
    level integer NOT NULL, position integer NOT NULL, id uuid, kind text NOT NULL,
    name text, duplex boolean NOT NULL, PRIMARY KEY (level, position)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.layout_floors, pg_temp.layout_spaces;

  FOR floor_value IN SELECT value FROM jsonb_array_elements(p_values -> 'floors') LOOP
    IF jsonb_typeof(floor_value) IS DISTINCT FROM 'object'
      OR jsonb_typeof(floor_value -> 'level') IS DISTINCT FROM 'number'
      OR jsonb_typeof(floor_value -> 'whole') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(floor_value -> 'spaces') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'Invalid building floor.' USING ERRCODE = '22023'; END IF;
    floor_level := (floor_value ->> 'level')::integer;
    floor_whole := (floor_value ->> 'whole')::boolean;
    space_count := jsonb_array_length(floor_value -> 'spaces');
    IF floor_level NOT BETWEEN -5 AND 99 OR space_count NOT BETWEEN 1 AND 20
      OR (floor_whole AND space_count <> 1)
    THEN RAISE EXCEPTION 'Invalid building floor.' USING ERRCODE = '22023'; END IF;
    INSERT INTO pg_temp.layout_floors VALUES (floor_level,
      private.core_toolkit_json_text(floor_value, 'label', 30, 'floor name'), floor_whole);
    space_index := 0;
    FOR space_value IN SELECT value FROM jsonb_array_elements(floor_value -> 'spaces') LOOP
      space_index := space_index + 1;
      space_kind := space_value ->> 'kind';
      IF jsonb_typeof(space_value) IS DISTINCT FROM 'object'
        OR jsonb_typeof(space_value -> 'id') NOT IN ('string', 'null')
        OR jsonb_typeof(space_value -> 'duplex') IS DISTINCT FROM 'boolean'
        OR space_kind IS NULL
        OR space_kind NOT IN ('unit', 'upper', 'parking', 'amenity', 'shop', 'service', 'gap')
        OR (floor_whole AND space_kind NOT IN ('parking', 'amenity', 'shop', 'service'))
        OR ((space_value ->> 'duplex')::boolean AND space_kind <> 'unit')
      THEN RAISE EXCEPTION 'Invalid building space.' USING ERRCODE = '22023'; END IF;
      INSERT INTO pg_temp.layout_spaces VALUES (floor_level, space_index,
        (space_value ->> 'id')::uuid, space_kind,
        CASE WHEN space_kind IN ('unit', 'upper', 'gap') THEN NULL
          ELSE private.core_toolkit_json_text(space_value, 'name', 40, 'space name') END,
        (space_value ->> 'duplex')::boolean);
    END LOOP;
  END LOOP;

  SELECT count(*) INTO floor_total FROM pg_temp.layout_floors;
  SELECT count(*) INTO space_total FROM pg_temp.layout_spaces;
  -- Floors must run without gaps from the lowest basement through Ground to the top.
  IF floor_total = 0
    OR NOT EXISTS (SELECT 1 FROM pg_temp.layout_floors WHERE level = 0)
    OR (SELECT max(level) - min(level) + 1 FROM pg_temp.layout_floors) <> floor_total
  THEN RAISE EXCEPTION 'Invalid building floors.' USING ERRCODE = '22023'; END IF;
  -- A duplex spot and the upper half above it must line up at the same position.
  IF EXISTS (SELECT 1 FROM pg_temp.layout_spaces d WHERE d.duplex AND NOT EXISTS (
      SELECT 1 FROM pg_temp.layout_spaces u JOIN pg_temp.layout_floors f ON f.level = u.level
      WHERE u.level = d.level + 1 AND u.position = d.position AND u.kind = 'upper' AND NOT f.whole))
    OR EXISTS (SELECT 1 FROM pg_temp.layout_spaces u WHERE u.kind = 'upper' AND NOT EXISTS (
      SELECT 1 FROM pg_temp.layout_spaces d
      WHERE d.level = u.level - 1 AND d.position = u.position AND d.duplex))
  THEN RAISE EXCEPTION 'Invalid duplex.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT id FROM pg_temp.layout_spaces WHERE id IS NOT NULL GROUP BY id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM pg_temp.layout_spaces l WHERE l.id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.building_spaces s JOIN public.building_floors f
        ON f.society_id = s.society_id AND f.id = s.floor_id
      WHERE s.society_id = p_society_id AND f.block_id = target AND s.id = l.id))
  THEN RAISE EXCEPTION 'Invalid building space.' USING ERRCODE = '22023'; END IF;
  -- Placed units keep their spot, kind and floor; they move only through Unit 360.
  IF EXISTS (SELECT 1 FROM public.building_spaces s JOIN public.building_floors f
      ON f.society_id = s.society_id AND f.id = s.floor_id
    WHERE s.society_id = p_society_id AND f.block_id = target AND s.unit_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_temp.layout_spaces l
        WHERE l.id = s.id AND l.kind = 'unit' AND l.level = f.level))
  THEN RAISE EXCEPTION 'Move placed units first.' USING ERRCODE = '22023'; END IF;

  DELETE FROM public.building_spaces s USING public.building_floors f
    WHERE f.society_id = s.society_id AND f.id = s.floor_id
      AND s.society_id = p_society_id AND f.block_id = target
      AND NOT EXISTS (SELECT 1 FROM pg_temp.layout_spaces l WHERE l.id = s.id);
  INSERT INTO public.building_floors (society_id, block_id, level, label, whole)
    SELECT p_society_id, target, level, label, whole FROM pg_temp.layout_floors
    ON CONFLICT (society_id, block_id, level) DO UPDATE
      SET label = EXCLUDED.label, whole = EXCLUDED.whole;
  UPDATE public.building_spaces s SET floor_id = f.id, position = l.position,
      kind = l.kind, name = l.name, duplex = l.duplex
    FROM pg_temp.layout_spaces l JOIN public.building_floors f
      ON f.society_id = p_society_id AND f.block_id = target AND f.level = l.level
    WHERE s.society_id = p_society_id AND s.id = l.id;
  INSERT INTO public.building_spaces (society_id, floor_id, position, kind, name, duplex)
    SELECT p_society_id, f.id, l.position, l.kind, l.name, l.duplex
    FROM pg_temp.layout_spaces l JOIN public.building_floors f
      ON f.society_id = p_society_id AND f.block_id = target AND f.level = l.level
    WHERE l.id IS NULL;
  DELETE FROM public.building_floors f WHERE f.society_id = p_society_id AND f.block_id = target
    AND NOT EXISTS (SELECT 1 FROM pg_temp.layout_floors l WHERE l.level = f.level);

  PERFORM private.core_toolkit_audit(p_society_id, 'building_layout.save', 'block', target::text,
    NULL, jsonb_build_object('client_request_id', p_client_request_id,
      'floors', floor_total, 'spaces', space_total), p_request_trace);
  RETURN target;
-- Repeated floor levels and duplicate building names are invalid input, not edit conflicts.
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR not_null_violation
  OR unique_violation THEN
  RAISE EXCEPTION 'Invalid building layout.' USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION public.building_unit_place(
  p_society_id uuid, p_unit_id uuid, p_block_id uuid, p_space_id uuid, p_version text,
  p_client_request_id uuid, p_request_trace text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_row public.units;
  space_row public.building_spaces;
  floor_row public.building_floors;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Invalid unit placement.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE society_id = p_society_id
    AND entity_type = 'unit' AND entity_id = p_unit_id::text AND actor_id = auth.uid()
    AND action = 'core.building_unit.place'
    AND "after" ->> 'client_request_id' = p_client_request_id::text)
  THEN RETURN true; END IF;
  SELECT * INTO unit_row FROM public.units
    WHERE society_id = p_society_id AND id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT unit_row.active THEN
    RAISE EXCEPTION 'Only active units can be placed.' USING ERRCODE = '22023';
  END IF;

  IF p_space_id IS NULL THEN
    UPDATE public.building_spaces SET unit_id = NULL
      WHERE society_id = p_society_id AND unit_id = p_unit_id;
  ELSE
    PERFORM 1 FROM public.blocks WHERE society_id = p_society_id AND id = p_block_id AND active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Building not found.' USING ERRCODE = 'P0002'; END IF;
    IF p_version IS DISTINCT FROM private.building_layout_version(p_society_id, p_block_id) THEN
      RAISE EXCEPTION 'The building layout changed.' USING ERRCODE = '40001';
    END IF;
    SELECT s.* INTO space_row FROM public.building_spaces s JOIN public.building_floors f
      ON f.society_id = s.society_id AND f.id = s.floor_id
      WHERE s.society_id = p_society_id AND s.id = p_space_id AND f.block_id = p_block_id
      FOR UPDATE OF s;
    IF NOT FOUND THEN RAISE EXCEPTION 'Spot not found.' USING ERRCODE = 'P0002'; END IF;
    IF space_row.kind <> 'unit' THEN
      RAISE EXCEPTION 'Choose a unit spot.' USING ERRCODE = '22023';
    END IF;
    IF space_row.unit_id IS DISTINCT FROM p_unit_id THEN
      IF space_row.unit_id IS NOT NULL THEN
        RAISE EXCEPTION 'This spot is already taken.' USING ERRCODE = '40001';
      END IF;
      SELECT * INTO floor_row FROM public.building_floors
        WHERE society_id = p_society_id AND id = space_row.floor_id;
      UPDATE public.units SET block_id = p_block_id, floor = floor_row.level
        WHERE society_id = p_society_id AND id = p_unit_id;
      UPDATE public.building_spaces SET unit_id = NULL
        WHERE society_id = p_society_id AND unit_id = p_unit_id;
      UPDATE public.building_spaces SET unit_id = p_unit_id WHERE id = space_row.id;
    END IF;
  END IF;
  PERFORM private.core_toolkit_audit(p_society_id, 'building_unit.place', 'unit', p_unit_id::text,
    NULL, jsonb_build_object('client_request_id', p_client_request_id, 'space', p_space_id),
    p_request_trace);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unit_records_get(p_society_id uuid, p_unit_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  unit_row public.units;
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin'], false);
  SELECT * INTO unit_row FROM public.units WHERE society_id = p_society_id AND id = p_unit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
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
    'placement', (SELECT jsonb_build_object('block_id', f.block_id, 'block', b.name,
      'level', f.level, 'label', f.label, 'position', s.position, 'duplex', s.duplex)
      FROM public.building_spaces s
      JOIN public.building_floors f ON f.society_id = s.society_id AND f.id = s.floor_id
      JOIN public.blocks b ON b.society_id = f.society_id AND b.id = f.block_id
      WHERE s.society_id = p_society_id AND s.unit_id = p_unit_id),
    'timezone', (SELECT timezone FROM public.societies WHERE id = p_society_id),
    'today', (now() AT TIME ZONE (SELECT timezone FROM public.societies WHERE id = p_society_id))::date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unit_records_save(
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
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']);
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

DROP FUNCTION private.unit_floor_snapshot(public.units);
DROP TABLE public.unit_floor_positions;

REVOKE ALL ON FUNCTION private.building_unit_unplace(), private.building_block_archive_guard(),
  private.building_layout_snapshot(uuid, uuid), private.building_layout_version(uuid, uuid),
  public.building_layout_get(uuid, uuid), public.building_layout_save(uuid, uuid, jsonb, uuid, text),
  public.building_unit_place(uuid, uuid, uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.building_layout_get(uuid, uuid),
  public.building_layout_save(uuid, uuid, jsonb, uuid, text),
  public.building_unit_place(uuid, uuid, uuid, uuid, text, uuid, text) TO authenticated;
