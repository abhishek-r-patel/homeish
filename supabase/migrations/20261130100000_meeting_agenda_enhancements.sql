-- P45 agenda duration estimates and reusable, society-scoped agenda templates.

ALTER TABLE public.meeting_agenda_items
  ADD COLUMN duration_minutes integer;
ALTER TABLE public.meeting_agenda_items
  ADD CONSTRAINT meeting_agenda_items_duration_check
  CHECK (duration_minutes BETWEEN 1 AND 1440);

CREATE TABLE public.meeting_agenda_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  meeting_types text[] NOT NULL,
  archived_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  client_request_id text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meeting_agenda_templates_name_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 150),
  CONSTRAINT meeting_agenda_templates_types_check CHECK (
    cardinality(meeting_types) BETWEEN 1 AND 3
    AND meeting_types <@ ARRAY['agm', 'sgm', 'committee']::text[]
    AND cardinality(meeting_types)
      = (CASE WHEN 'agm' = ANY (meeting_types) THEN 1 ELSE 0 END)
        + (CASE WHEN 'sgm' = ANY (meeting_types) THEN 1 ELSE 0 END)
        + (CASE WHEN 'committee' = ANY (meeting_types) THEN 1 ELSE 0 END)
  ),
  CONSTRAINT meeting_agenda_templates_version_check CHECK (version >= 1),
  CONSTRAINT meeting_agenda_templates_client_request_check
    CHECK (char_length(btrim(client_request_id)) BETWEEN 1 AND 120),
  CONSTRAINT meeting_agenda_templates_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT meeting_agenda_templates_client_request_key UNIQUE (society_id, client_request_id)
);
CREATE INDEX meeting_agenda_templates_society_active_idx
  ON public.meeting_agenda_templates (society_id, archived_at, lower(name));
CREATE INDEX meeting_agenda_templates_created_by_idx
  ON public.meeting_agenda_templates (created_by);
CREATE INDEX meeting_agenda_templates_updated_by_idx
  ON public.meeting_agenda_templates (updated_by);

CREATE TABLE public.meeting_agenda_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  template_id uuid NOT NULL,
  position integer NOT NULL,
  title text NOT NULL,
  description text,
  suggested_duration_minutes integer,
  CONSTRAINT meeting_agenda_template_items_template_fkey
    FOREIGN KEY (society_id, template_id)
    REFERENCES public.meeting_agenda_templates (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT meeting_agenda_template_items_position_check
    CHECK (position BETWEEN 1 AND 50),
  CONSTRAINT meeting_agenda_template_items_title_check
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT meeting_agenda_template_items_description_check CHECK (
    description IS NULL
    OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 2000)
  ),
  CONSTRAINT meeting_agenda_template_items_duration_check
    CHECK (suggested_duration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT meeting_agenda_template_items_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT meeting_agenda_template_items_position_key UNIQUE (society_id, template_id, position)
);
CREATE INDEX meeting_agenda_template_items_society_template_position_idx
  ON public.meeting_agenda_template_items (society_id, template_id, position);

ALTER TABLE public.meeting_agenda_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agenda_template_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meeting_agenda_templates, public.meeting_agenda_template_items
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY meeting_agenda_templates_no_direct_access
  ON public.meeting_agenda_templates
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY meeting_agenda_template_items_no_direct_access
  ON public.meeting_agenda_template_items
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER meeting_agenda_templates_no_truncate
  BEFORE TRUNCATE ON public.meeting_agenda_templates
  FOR EACH STATEMENT EXECUTE FUNCTION private.meeting_reject_truncate();
CREATE TRIGGER meeting_agenda_template_items_no_truncate
  BEFORE TRUNCATE ON public.meeting_agenda_template_items
  FOR EACH STATEMENT EXECUTE FUNCTION private.meeting_reject_truncate();

CREATE FUNCTION private.meeting_json_duration(p_value jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_result integer;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_value) <> 'number' OR p_value #>> '{}' !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'A duration in minutes is invalid.' USING ERRCODE = '22023';
  END IF;
  v_result := (p_value #>> '{}')::integer;
  IF v_result NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'A duration must be between 1 and 1440 minutes.' USING ERRCODE = '22023';
  END IF;
  RETURN v_result;
EXCEPTION WHEN numeric_value_out_of_range THEN
  RAISE EXCEPTION 'A duration must be between 1 and 1440 minutes.' USING ERRCODE = '22023';
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_json_duration(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserve P23's input behaviour while accepting P45's optional duration field.
CREATE OR REPLACE FUNCTION private.meeting_parse(p_meeting jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_type text;
  v_title text;
  v_online text;
  v_agenda jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_title text;
  v_invitees jsonb;
  v_scope text;
  v_unit_ids uuid[];
  v_membership_ids uuid[];
BEGIN
  IF p_meeting IS NULL OR jsonb_typeof(p_meeting) <> 'object'
    OR NOT (p_meeting ?& ARRAY['meetingType', 'title', 'agenda', 'invitees'])
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_meeting) AS input_key
      WHERE input_key NOT IN ('meetingType', 'title', 'description', 'startsAt', 'endsAt', 'venue',
        'onlineUrl', 'agenda', 'invitees')
    )
  THEN
    RAISE EXCEPTION 'The meeting details are invalid.' USING ERRCODE = '22023';
  END IF;
  v_type := private.meeting_json_text(p_meeting -> 'meetingType', 20);
  IF v_type IS NULL OR v_type NOT IN ('agm', 'sgm', 'committee') THEN
    RAISE EXCEPTION 'The meeting type is invalid.' USING ERRCODE = '22023';
  END IF;
  v_title := COALESCE(private.meeting_json_text(p_meeting -> 'title', 150), '');
  v_online := private.meeting_json_text(p_meeting -> 'onlineUrl', 500);
  IF v_online IS NOT NULL AND v_online !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'The online meeting link must be an https link.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_meeting -> 'agenda') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_meeting -> 'agenda') > 50
  THEN
    RAISE EXCEPTION 'The agenda is invalid.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT element FROM jsonb_array_elements(p_meeting -> 'agenda') AS element LOOP
    IF jsonb_typeof(v_item) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_item) AS input_key
      WHERE input_key NOT IN ('id', 'title', 'description', 'durationMinutes')
    ) THEN
      RAISE EXCEPTION 'An agenda item is invalid.' USING ERRCODE = '22023';
    END IF;
    v_item_title := private.meeting_json_text(v_item -> 'title', 200);
    IF v_item_title IS NULL THEN
      RAISE EXCEPTION 'Every agenda item needs a title.' USING ERRCODE = '22023';
    END IF;
    v_agenda := v_agenda || jsonb_build_array(jsonb_build_object(
      'id', private.meeting_json_uuid(v_item -> 'id'),
      'title', v_item_title,
      'description', private.meeting_json_text(v_item -> 'description', 2000),
      'duration_minutes', private.meeting_json_duration(v_item -> 'durationMinutes'),
      'duration_present', v_item ? 'durationMinutes'
    ));
  END LOOP;

  v_invitees := p_meeting -> 'invitees';
  IF jsonb_typeof(v_invitees) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_invitees) AS input_key
    WHERE input_key NOT IN ('scope', 'unitIds', 'membershipIds')
  ) THEN
    RAISE EXCEPTION 'The invitees are invalid.' USING ERRCODE = '22023';
  END IF;
  v_scope := private.meeting_json_text(v_invitees -> 'scope', 10);
  IF v_scope IS NULL OR v_scope NOT IN ('default', 'custom') THEN
    RAISE EXCEPTION 'The invitee scope is invalid.' USING ERRCODE = '22023';
  END IF;
  v_unit_ids := private.meeting_json_uuid_array(v_invitees -> 'unitIds', 5000);
  v_membership_ids := private.meeting_json_uuid_array(v_invitees -> 'membershipIds', 5000);
  IF v_scope = 'default' THEN
    v_unit_ids := ARRAY[]::uuid[];
    v_membership_ids := ARRAY[]::uuid[];
  ELSIF (v_type = 'committee' AND cardinality(v_unit_ids) > 0)
    OR (v_type <> 'committee' AND cardinality(v_membership_ids) > 0)
  THEN
    RAISE EXCEPTION 'The invitees do not match the meeting type.' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'meeting_type', v_type,
    'title', v_title,
    'description', private.meeting_json_text(p_meeting -> 'description', 4000),
    'starts_at', private.meeting_json_timestamp(p_meeting -> 'startsAt'),
    'ends_at', private.meeting_json_timestamp(p_meeting -> 'endsAt'),
    'venue', private.meeting_json_text(p_meeting -> 'venue', 200),
    'online_url', v_online,
    'agenda', v_agenda,
    'scope', v_scope,
    'unit_ids', to_jsonb(v_unit_ids),
    'membership_ids', to_jsonb(v_membership_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.meeting_store_plan(p_society_id uuid, p_meeting_id uuid, p_parsed jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_keep uuid[];
  v_item jsonb;
  v_position integer;
  v_item_id uuid;
  v_old_titles text[];
  v_old_descriptions text[];
  v_old_durations integer[];
  v_unit_ids uuid[];
  v_membership_ids uuid[];
BEGIN
  SELECT
    array_agg(agenda.title ORDER BY agenda.position),
    array_agg(agenda.description ORDER BY agenda.position),
    array_agg(agenda.duration_minutes ORDER BY agenda.position)
  INTO v_old_titles, v_old_descriptions, v_old_durations
  FROM public.meeting_agenda_items AS agenda
  WHERE agenda.society_id = p_society_id AND agenda.meeting_id = p_meeting_id;
  v_keep := ARRAY(
    SELECT (element ->> 'id')::uuid FROM jsonb_array_elements(p_parsed -> 'agenda') AS element
    WHERE element ->> 'id' IS NOT NULL
  );
  IF cardinality(v_keep) <> (SELECT count(DISTINCT kept) FROM unnest(v_keep) AS kept)
    OR EXISTS (
      SELECT 1 FROM unnest(v_keep) AS kept
      WHERE NOT EXISTS (
        SELECT 1 FROM public.meeting_agenda_items AS agenda
        WHERE agenda.society_id = p_society_id AND agenda.meeting_id = p_meeting_id AND agenda.id = kept
      )
    )
  THEN
    RAISE EXCEPTION 'An agenda item id is invalid.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.meeting_agenda_items AS agenda
  WHERE agenda.society_id = p_society_id AND agenda.meeting_id = p_meeting_id
    AND NOT agenda.id = ANY (v_keep);
  FOR v_item, v_position IN
    SELECT element, ordinality::integer
    FROM jsonb_array_elements(p_parsed -> 'agenda') WITH ORDINALITY AS item(element, ordinality)
  LOOP
    v_item_id := (v_item ->> 'id')::uuid;
    IF v_item_id IS NULL THEN
      INSERT INTO public.meeting_agenda_items (
        society_id, meeting_id, position, title, description, duration_minutes
      ) VALUES (
        p_society_id, p_meeting_id, v_position, v_item ->> 'title', v_item ->> 'description',
        CASE
          WHEN (v_item ->> 'duration_present')::boolean
            THEN (v_item ->> 'duration_minutes')::integer
          WHEN v_old_titles[v_position] IS NOT DISTINCT FROM v_item ->> 'title'
            AND v_old_descriptions[v_position] IS NOT DISTINCT FROM v_item ->> 'description'
            THEN v_old_durations[v_position]
          ELSE NULL
        END
      );
    ELSE
      UPDATE public.meeting_agenda_items
      SET position = v_position, title = v_item ->> 'title', description = v_item ->> 'description',
        duration_minutes = CASE
          WHEN (v_item ->> 'duration_present')::boolean
            THEN (v_item ->> 'duration_minutes')::integer
          WHEN position = v_position
            AND title IS NOT DISTINCT FROM v_item ->> 'title'
            AND description IS NOT DISTINCT FROM v_item ->> 'description'
            THEN duration_minutes
          ELSE NULL
        END
      WHERE society_id = p_society_id AND meeting_id = p_meeting_id AND id = v_item_id;
    END IF;
  END LOOP;

  v_unit_ids := ARRAY(SELECT jsonb_array_elements_text(p_parsed -> 'unit_ids')::uuid);
  v_membership_ids := ARRAY(SELECT jsonb_array_elements_text(p_parsed -> 'membership_ids')::uuid);
  IF EXISTS (
    SELECT 1 FROM unnest(v_unit_ids) AS chosen
    WHERE NOT EXISTS (
      SELECT 1 FROM private.meeting_candidate_units(p_society_id, p_meeting_id, 'default') AS candidate
      WHERE candidate.unit_id = chosen
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_membership_ids) AS chosen
    WHERE NOT EXISTS (
      SELECT 1 FROM private.meeting_candidate_members(p_society_id, p_meeting_id, 'default') AS candidate
      WHERE candidate.membership_id = chosen
    )
  ) THEN
    RAISE EXCEPTION 'An invitee is not active in this society.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.meeting_invitee_selections
  WHERE society_id = p_society_id AND meeting_id = p_meeting_id;
  INSERT INTO public.meeting_invitee_selections (society_id, meeting_id, unit_id)
  SELECT p_society_id, p_meeting_id, chosen FROM unnest(v_unit_ids) AS chosen;
  INSERT INTO public.meeting_invitee_selections (society_id, meeting_id, membership_id)
  SELECT p_society_id, p_meeting_id, chosen FROM unnest(v_membership_ids) AS chosen;
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_store_plan(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meeting_agenda_durations_get(
  p_society_id uuid, p_meeting_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF NOT EXISTS (
    SELECT 1 FROM public.meetings WHERE society_id = p_society_id AND id = p_meeting_id
  ) THEN
    RAISE EXCEPTION 'Meeting not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', agenda.id, 'durationMinutes', agenda.duration_minutes
    ) ORDER BY agenda.position)
    FROM public.meeting_agenda_items AS agenda
    WHERE agenda.society_id = p_society_id AND agenda.meeting_id = p_meeting_id
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.meeting_agenda_durations_get(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meeting_agenda_durations_get(uuid, uuid) TO authenticated;

CREATE FUNCTION private.meeting_template_parse(p_template jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_name text;
  v_types text[];
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_title text;
  v_type text;
BEGIN
  IF p_template IS NULL OR jsonb_typeof(p_template) <> 'object'
    OR NOT (p_template ?& ARRAY['name', 'meetingTypes', 'items'])
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_template) AS input_key
      WHERE input_key NOT IN ('name', 'meetingTypes', 'items')
    )
  THEN
    RAISE EXCEPTION 'The agenda template is invalid.' USING ERRCODE = '22023';
  END IF;
  v_name := private.meeting_json_text(p_template -> 'name', 150);
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Give the agenda template a name.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_template -> 'meetingTypes') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_template -> 'meetingTypes') NOT BETWEEN 1 AND 3
  THEN
    RAISE EXCEPTION 'Choose at least one meeting type.' USING ERRCODE = '22023';
  END IF;
  v_types := ARRAY[]::text[];
  FOR v_type IN SELECT element #>> '{}' FROM jsonb_array_elements(p_template -> 'meetingTypes') AS element
  LOOP
    IF v_type NOT IN ('agm', 'sgm', 'committee') OR v_type = ANY (v_types) THEN
      RAISE EXCEPTION 'The meeting types are invalid.' USING ERRCODE = '22023';
    END IF;
    v_types := v_types || v_type;
  END LOOP;
  IF jsonb_typeof(p_template -> 'items') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_template -> 'items') NOT BETWEEN 1 AND 50
  THEN
    RAISE EXCEPTION 'A template needs 1 to 50 agenda items.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT element FROM jsonb_array_elements(p_template -> 'items') AS element LOOP
    IF jsonb_typeof(v_item) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_item) AS input_key
      WHERE input_key NOT IN ('title', 'description', 'suggestedDurationMinutes')
    ) THEN
      RAISE EXCEPTION 'A template agenda item is invalid.' USING ERRCODE = '22023';
    END IF;
    v_title := private.meeting_json_text(v_item -> 'title', 200);
    IF v_title IS NULL THEN
      RAISE EXCEPTION 'Every template agenda item needs a title.' USING ERRCODE = '22023';
    END IF;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'title', v_title,
      'description', private.meeting_json_text(v_item -> 'description', 2000),
      'suggested_duration_minutes',
        private.meeting_json_duration(v_item -> 'suggestedDurationMinutes')
    ));
  END LOOP;
  RETURN jsonb_build_object('name', v_name, 'meeting_types', to_jsonb(v_types), 'items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION private.meeting_template_parse(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meeting_agenda_templates_get(
  p_society_id uuid, p_meeting_type text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.meeting_authorize(p_society_id, ARRAY['admin']::text[], false);
  IF p_meeting_type IS NOT NULL AND p_meeting_type NOT IN ('agm', 'sgm', 'committee') THEN
    RAISE EXCEPTION 'The meeting type is invalid.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
        'id', template.id,
        'name', template.name,
        'meetingTypes', template.meeting_types,
        'archivedAt', template.archived_at,
        'version', template.version,
        'items', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
              'title', item.title,
              'description', item.description,
              'suggestedDurationMinutes', item.suggested_duration_minutes
            ) ORDER BY item.position)
          FROM public.meeting_agenda_template_items AS item
          WHERE item.society_id = template.society_id AND item.template_id = template.id
        ), '[]'::jsonb)
      ) ORDER BY template.archived_at IS NOT NULL, lower(template.name), template.id)
    FROM public.meeting_agenda_templates AS template
    WHERE template.society_id = p_society_id
      AND (p_meeting_type IS NULL OR p_meeting_type = ANY (template.meeting_types))
  ), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.meeting_agenda_templates_get(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meeting_agenda_templates_get(uuid, text) TO authenticated;

CREATE FUNCTION public.meeting_agenda_template_save(
  p_society_id uuid, p_template_id uuid, p_expected_version integer,
  p_client_request_id text, p_template jsonb, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing public.meeting_agenda_templates%ROWTYPE;
  v_parsed jsonb;
  v_id uuid;
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_template_id IS NULL AND p_expected_version IS NOT NULL
    OR p_template_id IS NOT NULL AND p_expected_version IS NULL
  THEN
    RAISE EXCEPTION 'The template version is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_client_request_id IS NULL OR char_length(p_client_request_id) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'The client request id is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_template_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.meeting_agenda_templates
    WHERE society_id = p_society_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
      RETURN jsonb_build_object('templateId', v_existing.id, 'version', v_existing.version);
    END IF;
  END IF;
  v_parsed := private.meeting_template_parse(p_template);

  IF p_template_id IS NULL THEN
    INSERT INTO public.meeting_agenda_templates (
      society_id, name, meeting_types, client_request_id, created_by
    ) VALUES (
      p_society_id, v_parsed ->> 'name',
      ARRAY(SELECT jsonb_array_elements_text(v_parsed -> 'meeting_types')), p_client_request_id, auth.uid()
    )
    ON CONFLICT (society_id, client_request_id) DO NOTHING
    RETURNING id, version INTO v_id, v_version;
    IF v_id IS NULL THEN
      SELECT * INTO v_existing
      FROM public.meeting_agenda_templates
      WHERE society_id = p_society_id AND client_request_id = p_client_request_id;
      RETURN jsonb_build_object('templateId', v_existing.id, 'version', v_existing.version);
    END IF;
  ELSE
    SELECT * INTO v_existing
    FROM public.meeting_agenda_templates
    WHERE society_id = p_society_id AND id = p_template_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Agenda template not found.' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.version <> p_expected_version THEN
      RAISE EXCEPTION 'The agenda template changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.meeting_agenda_templates
    SET name = v_parsed ->> 'name',
      meeting_types = ARRAY(SELECT jsonb_array_elements_text(v_parsed -> 'meeting_types')),
      version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_template_id
    RETURNING id, version INTO v_id, v_version;
    DELETE FROM public.meeting_agenda_template_items
    WHERE society_id = p_society_id AND template_id = p_template_id;
  END IF;

  INSERT INTO public.meeting_agenda_template_items (
    society_id, template_id, position, title, description, suggested_duration_minutes
  )
  SELECT
    p_society_id, v_id, ordinality::integer, item ->> 'title', item ->> 'description',
    (item ->> 'suggested_duration_minutes')::integer
  FROM jsonb_array_elements(v_parsed -> 'items') WITH ORDINALITY AS input_item(item, ordinality);
  PERFORM private.meeting_audit(
    p_society_id, CASE WHEN p_template_id IS NULL THEN 'agenda_template.create' ELSE 'agenda_template.update' END,
    'meeting_agenda_template', v_id,
    jsonb_build_object(
      'name', v_parsed ->> 'name',
      'meetingTypes', v_parsed -> 'meeting_types',
      'itemCount', jsonb_array_length(v_parsed -> 'items')
    ),
    p_request_id
  );
  RETURN jsonb_build_object('templateId', v_id, 'version', v_version);
END;
$$;
REVOKE ALL ON FUNCTION public.meeting_agenda_template_save(uuid, uuid, integer, text, jsonb, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meeting_agenda_template_save(uuid, uuid, integer, text, jsonb, text)
  TO authenticated;

CREATE FUNCTION public.meeting_agenda_template_archive(
  p_society_id uuid, p_template_id uuid, p_expected_version integer,
  p_archived boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version integer;
BEGIN
  PERFORM private.meeting_write_begin(p_society_id, ARRAY['admin']::text[], p_request_id);
  IF p_template_id IS NULL OR p_expected_version IS NULL OR p_archived IS NULL THEN
    RAISE EXCEPTION 'Choose a template, version and archive state.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.meeting_agenda_templates
  SET archived_at = CASE WHEN p_archived THEN COALESCE(archived_at, clock_timestamp()) ELSE NULL END,
    version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_template_id AND version = p_expected_version
  RETURNING version INTO v_version;
  IF v_version IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.meeting_agenda_templates
      WHERE society_id = p_society_id AND id = p_template_id
    ) THEN
      RAISE EXCEPTION 'The agenda template changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
    RAISE EXCEPTION 'Agenda template not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.meeting_audit(
    p_society_id,
    CASE WHEN p_archived THEN 'agenda_template.archive' ELSE 'agenda_template.restore' END,
    'meeting_agenda_template', p_template_id,
    jsonb_build_object('archived', p_archived, 'version', v_version),
    p_request_id
  );
  RETURN jsonb_build_object('templateId', p_template_id, 'version', v_version, 'archived', p_archived);
END;
$$;
REVOKE ALL ON FUNCTION public.meeting_agenda_template_archive(uuid, uuid, integer, boolean, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meeting_agenda_template_archive(uuid, uuid, integer, boolean, text)
  TO authenticated;
