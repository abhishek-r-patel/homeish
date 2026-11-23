-- Add D-85 unit-condition handovers without changing legal, occupancy or financial records.

CREATE TABLE public.unit_handover_templates (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  items jsonb NOT NULL
    CHECK (
      jsonb_typeof(items) = 'array'
      AND jsonb_array_length(items) BETWEEN 1 AND 30
    ),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id),
  UNIQUE (society_id, id)
);

CREATE TABLE public.unit_handovers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'tenant_move_in', 'tenant_move_out', 'owner_transfer', 'standalone'
    )
  ),
  move_id uuid,
  transfer_case_id uuid,
  handover_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  note text
    CHECK (note IS NULL OR (
      note = btrim(note) AND char_length(note) BETWEEN 1 AND 1000
    )),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT unit_handovers_unit_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_handovers_move_fkey
    FOREIGN KEY (society_id, move_id)
    REFERENCES public.tenancy_moves (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_handovers_transfer_case_fkey
    FOREIGN KEY (society_id, transfer_case_id)
    REFERENCES public.tenancy_transfer_cases (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_handovers_target_check
    CHECK (move_id IS NULL OR transfer_case_id IS NULL),
  CONSTRAINT unit_handovers_state_check
    CHECK ((status = 'closed') = (closed_at IS NOT NULL)
      AND (closed_by IS NOT NULL) = (closed_at IS NOT NULL)),
  UNIQUE (society_id, created_by, client_request_id),
  UNIQUE (society_id, id)
);
CREATE INDEX unit_handovers_unit_status_idx
  ON public.unit_handovers (society_id, unit_id, status, handover_on DESC);
CREATE INDEX unit_handovers_move_idx
  ON public.unit_handovers (society_id, move_id);
CREATE INDEX unit_handovers_transfer_case_idx
  ON public.unit_handovers (society_id, transfer_case_id);

CREATE TABLE public.unit_handover_parties (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  party_name text NOT NULL
    CHECK (party_name = btrim(party_name) AND char_length(party_name) BETWEEN 1 AND 200),
  role_snapshot text NOT NULL CHECK (
    role_snapshot IN ('owner', 'tenant', 'family', 'seller', 'buyer', 'party')
  ),
  CONSTRAINT unit_handover_parties_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.unit_handovers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_handover_parties_membership_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, handover_id, membership_id),
  UNIQUE (society_id, id)
);
CREATE INDEX unit_handover_parties_membership_idx
  ON public.unit_handover_parties (society_id, membership_id, handover_id);

CREATE TABLE public.unit_handover_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 30),
  item_key text NOT NULL
    CHECK (item_key = btrim(item_key) AND char_length(item_key) BETWEEN 1 AND 80),
  label text NOT NULL
    CHECK (label = btrim(label) AND char_length(label) BETWEEN 1 AND 80),
  response text CHECK (response IN ('yes', 'no', 'not_applicable')),
  note text
    CHECK (note IS NULL OR (
      note = btrim(note) AND char_length(note) BETWEEN 1 AND 300
    )),
  CONSTRAINT unit_handover_items_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.unit_handovers (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, handover_id, position),
  UNIQUE (society_id, handover_id, item_key),
  UNIQUE (society_id, id)
);

CREATE TABLE public.unit_handover_readings (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  reading_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  added_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT unit_handover_readings_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.unit_handovers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_handover_readings_reading_fkey
    FOREIGN KEY (society_id, reading_id)
    REFERENCES public.metering_readings (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, handover_id, reading_id),
  UNIQUE (society_id, added_by, client_request_id),
  UNIQUE (society_id, id)
);

CREATE TABLE public.unit_handover_photos (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  path text NOT NULL
    CHECK (path = btrim(path) AND char_length(path) BETWEEN 1 AND 500),
  content_type text NOT NULL CHECK (
    content_type IN ('image/jpeg', 'image/png', 'application/pdf')
  ),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  added_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT unit_handover_photos_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.unit_handovers (society_id, id) ON DELETE RESTRICT,
  UNIQUE (path),
  UNIQUE (society_id, added_by, client_request_id),
  UNIQUE (society_id, id)
);

CREATE TABLE public.unit_handover_acknowledgements (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  note text
    CHECK (note IS NULL OR (
      note = btrim(note) AND char_length(note) BETWEEN 1 AND 500
    )),
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT unit_handover_acknowledgements_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.unit_handovers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_handover_acknowledgements_membership_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, handover_id, membership_id),
  UNIQUE (society_id, id)
);

CREATE TABLE public.unit_handover_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  handover_id uuid NOT NULL,
  action text NOT NULL CHECK (
    action IN ('created', 'details_updated', 'items_saved', 'closed')
  ),
  before jsonb,
  after jsonb NOT NULL,
  reason text
    CHECK (reason IS NULL OR (
      reason = btrim(reason) AND char_length(reason) BETWEEN 5 AND 500
    )),
  changed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT unit_handover_revisions_handover_fkey
    FOREIGN KEY (society_id, handover_id)
    REFERENCES public.unit_handovers (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id)
);
CREATE INDEX unit_handover_revisions_handover_idx
  ON public.unit_handover_revisions (society_id, handover_id, changed_at);

ALTER TABLE public.unit_handover_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handover_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handover_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handover_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handover_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_handover_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.unit_handover_templates,
  public.unit_handovers,
  public.unit_handover_parties,
  public.unit_handover_items,
  public.unit_handover_readings,
  public.unit_handover_photos,
  public.unit_handover_acknowledgements,
  public.unit_handover_revisions
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY unit_handover_templates_no_direct_access
  ON public.unit_handover_templates FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handovers_no_direct_access
  ON public.unit_handovers FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handover_parties_no_direct_access
  ON public.unit_handover_parties FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handover_items_no_direct_access
  ON public.unit_handover_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handover_readings_no_direct_access
  ON public.unit_handover_readings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handover_photos_no_direct_access
  ON public.unit_handover_photos FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handover_acknowledgements_no_direct_access
  ON public.unit_handover_acknowledgements FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY unit_handover_revisions_no_direct_access
  ON public.unit_handover_revisions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER unit_handover_templates_set_updated_at
  BEFORE UPDATE ON public.unit_handover_templates
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER unit_handovers_set_updated_at
  BEFORE UPDATE ON public.unit_handovers
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER unit_handovers_no_delete
  BEFORE DELETE ON public.unit_handovers
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER unit_handovers_no_truncate
  BEFORE TRUNCATE ON public.unit_handovers
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER unit_handover_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.unit_handover_revisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER unit_handover_revisions_no_truncate
  BEFORE TRUNCATE ON public.unit_handover_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE FUNCTION private.unit_handover_no_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Unit handover records are permanent.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.unit_handover_no_delete()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER unit_handover_items_no_delete
  BEFORE DELETE ON public.unit_handover_items
  FOR EACH ROW EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_items_no_truncate
  BEFORE TRUNCATE ON public.unit_handover_items
  FOR EACH STATEMENT EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_parties_no_delete
  BEFORE DELETE ON public.unit_handover_parties
  FOR EACH ROW EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_parties_no_truncate
  BEFORE TRUNCATE ON public.unit_handover_parties
  FOR EACH STATEMENT EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_readings_no_delete
  BEFORE DELETE ON public.unit_handover_readings
  FOR EACH ROW EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_readings_no_truncate
  BEFORE TRUNCATE ON public.unit_handover_readings
  FOR EACH STATEMENT EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_photos_no_delete
  BEFORE DELETE ON public.unit_handover_photos
  FOR EACH ROW EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_photos_no_truncate
  BEFORE TRUNCATE ON public.unit_handover_photos
  FOR EACH STATEMENT EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_acknowledgements_no_delete
  BEFORE DELETE ON public.unit_handover_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION private.unit_handover_no_delete();
CREATE TRIGGER unit_handover_acknowledgements_no_truncate
  BEFORE TRUNCATE ON public.unit_handover_acknowledgements
  FOR EACH STATEMENT EXECUTE FUNCTION private.unit_handover_no_delete();

CREATE FUNCTION private.unit_handover_default_template()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('key', 'keys', 'label', 'Keys'),
    jsonb_build_object('key', 'access_cards', 'label', 'Access cards'),
    jsonb_build_object('key', 'parking_sticker', 'label', 'Parking sticker'),
    jsonb_build_object('key', 'meters', 'label', 'Meters'),
    jsonb_build_object('key', 'fittings', 'label', 'Fittings')
  )
$$;
REVOKE ALL ON FUNCTION private.unit_handover_default_template()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.unit_handover_template_valid(p_items jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  entry jsonb;
BEGIN
  IF jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30
  THEN RETURN false; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(entry) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 2
      OR NOT entry ? 'key' OR NOT entry ? 'label'
      OR jsonb_typeof(entry -> 'key') <> 'string'
      OR jsonb_typeof(entry -> 'label') <> 'string'
      OR char_length(btrim(entry ->> 'key')) NOT BETWEEN 1 AND 80
      OR char_length(btrim(entry ->> 'label')) NOT BETWEEN 1 AND 80
    THEN RETURN false; END IF;
  END LOOP;
  RETURN (
    SELECT count(*) = count(DISTINCT lower(btrim(item ->> 'key')))
    FROM jsonb_array_elements(p_items) AS item
  );
END;
$$;
REVOKE ALL ON FUNCTION private.unit_handover_template_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.unit_handover_check_trace(p_request_trace text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'The request reference is invalid.'
    USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.unit_handover_check_trace(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.unit_handover_can_read(
  p_society_id uuid, p_handover public.unit_handovers
)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR EXISTS (
      SELECT 1
      FROM public.unit_handover_parties AS party
      JOIN public.memberships AS membership
        ON membership.society_id = party.society_id
        AND membership.id = party.membership_id
      WHERE party.society_id = p_society_id
        AND party.handover_id = p_handover.id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND 'resident' = ANY(membership.roles)
    )
$$;
REVOKE ALL ON FUNCTION private.unit_handover_can_read(
  uuid, public.unit_handovers
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.unit_handover_snapshot(
  p_society_id uuid, p_handover_id uuid
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'handover_on', handover.handover_on,
    'note', handover.note,
    'status', handover.status,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'item_key', item.item_key,
        'label', item.label,
        'response', item.response,
        'note', item.note
      ) ORDER BY item.position)
      FROM public.unit_handover_items AS item
      WHERE item.society_id = p_society_id
        AND item.handover_id = handover.id
    ), '[]'::jsonb)
  )
  FROM public.unit_handovers AS handover
  WHERE handover.society_id = p_society_id AND handover.id = p_handover_id
$$;
REVOKE ALL ON FUNCTION private.unit_handover_snapshot(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.unit_handover_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  target_handover_id uuid;
  handover public.unit_handovers;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/handovers/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
  ) THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  target_handover_id := split_part(p_path, '/', 3)::uuid;
  SELECT * INTO handover
  FROM public.unit_handovers
  WHERE society_id = target_society_id AND id = target_handover_id;
  IF handover.id IS NULL THEN RETURN false; END IF;
  IF p_write THEN
    RETURN split_part(p_path, '/', 4) = auth.uid()::text
      AND private.has_role(target_society_id, ARRAY['admin']::text[])
      AND private.society_writable(target_society_id)
      AND handover.status = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM public.unit_handover_photos
        WHERE society_id = target_society_id AND path = p_path
      );
  END IF;
  RETURN private.has_role(target_society_id, ARRAY['admin']::text[])
    OR private.has_role(target_society_id, ARRAY['resident']::text[])
      AND private.unit_handover_can_read(target_society_id, handover);
END;
$$;
REVOKE ALL ON FUNCTION private.unit_handover_file_access(text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.unit_handover_file_access(text, boolean)
  TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'handover-photos', 'handover-photos', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
);
CREATE POLICY handover_photos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'handover-photos'
    AND private.unit_handover_file_access(name, false)
  );
CREATE POLICY handover_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'handover-photos'
    AND private.unit_handover_file_access(name, true)
  );

CREATE FUNCTION public.unit_handover_template_save(
  p_society_id uuid, p_items jsonb, p_expected_version integer,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  template public.unit_handover_templates;
  saved_id uuid;
BEGIN
  PERFORM private.is_member(p_society_id);
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Handover template access denied.' USING ERRCODE = '42501'; END IF;
  PERFORM private.unit_handover_check_trace(p_request_trace);
  IF NOT private.unit_handover_template_valid(p_items)
    OR p_client_request_id IS NULL
  THEN RAISE EXCEPTION 'Check the handover checklist.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO template
  FROM public.unit_handover_templates
  WHERE society_id = p_society_id FOR UPDATE;
  IF template.id IS NOT NULL
    AND template.updated_by = auth.uid()
    AND template.client_request_id = p_client_request_id
  THEN
    IF template.items = p_items THEN RETURN template.id; END IF;
    RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
  END IF;
  IF template.id IS NOT NULL
    AND template.version IS DISTINCT FROM p_expected_version
  THEN RAISE EXCEPTION 'The handover checklist changed.' USING ERRCODE = '23505'; END IF;
  INSERT INTO public.unit_handover_templates (
    society_id, items, created_by, updated_by, client_request_id
  ) VALUES (
    p_society_id, p_items, auth.uid(), auth.uid(), p_client_request_id
  )
  ON CONFLICT (society_id) DO UPDATE
  SET items = excluded.items, version = unit_handover_templates.version + 1,
    client_request_id = excluded.client_request_id
  RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.handover_template.save',
    'unit_handover_template', saved_id::text,
    CASE WHEN template.id IS NULL THEN NULL ELSE jsonb_build_object(
      'items', template.items
    ) END,
    jsonb_build_object('items', p_items), p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.unit_handover_workspace(
  p_society_id uuid, p_unit_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  template public.unit_handover_templates;
  is_admin boolean;
  is_committee boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_member(p_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN RAISE EXCEPTION 'Handover access denied.' USING ERRCODE = '42501'; END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  is_committee := private.has_role(p_society_id, ARRAY['committee']::text[]);
  IF NOT is_admin AND NOT is_committee AND NOT private.has_role(
    p_society_id, ARRAY['resident']::text[]
  ) THEN RAISE EXCEPTION 'Handover access denied.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE society_id = p_society_id AND id = p_unit_id
  ) THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO template
  FROM public.unit_handover_templates
  WHERE society_id = p_society_id;
  RETURN jsonb_build_object(
    'can_manage', is_admin AND private.society_writable(p_society_id),
    'today', (clock_timestamp() AT TIME ZONE (
      SELECT timezone FROM public.societies WHERE id = p_society_id
    ))::date,
    'template', jsonb_build_object(
      'items', CASE WHEN template.id IS NULL
        THEN private.unit_handover_default_template() ELSE template.items END,
      'version', CASE WHEN template.id IS NULL THEN 0 ELSE template.version END,
      'updated_at', template.updated_at
    ),
    'parties', CASE WHEN is_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'membership_id', occupant.membership_id,
        'name', profile.full_name,
        'role', occupant.relationship
      ) ORDER BY lower(profile.full_name))
      FROM public.unit_occupants AS occupant
      JOIN public.memberships AS membership
        ON membership.society_id = occupant.society_id
        AND membership.id = occupant.membership_id
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE occupant.society_id = p_society_id
        AND occupant.unit_id = p_unit_id
        AND occupant.status = 'active'
        AND membership.status = 'active'
        AND membership.user_id IS NOT NULL
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'moves', CASE WHEN is_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', move.id, 'kind', move.kind, 'status', move.status,
        'label', move.kind || ' · ' || move.starts_at::date
      ) ORDER BY move.starts_at DESC, move.id)
      FROM public.tenancy_moves AS move
      WHERE move.society_id = p_society_id AND move.unit_id = p_unit_id
        AND move.status IN ('approved', 'completed')
      LIMIT 50
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'transfer_cases', CASE WHEN is_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', transfer.id, 'stage', transfer.stage,
        'label', 'Owner transfer · ' || transfer.received_on
      ) ORDER BY transfer.received_on DESC, transfer.id)
      FROM public.tenancy_transfer_cases AS transfer
      WHERE transfer.society_id = p_society_id
        AND transfer.unit_id = p_unit_id
      LIMIT 20
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'readings', CASE WHEN is_admin AND private.module_enabled(
      p_society_id, 'metering'
    ) THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reading.id,
        'meter_type', meter.meter_type,
        'reading_value', reading.reading_value,
        'reading_date', reading.reading_date
      ) ORDER BY reading.reading_date DESC, reading.id)
      FROM public.metering_readings AS reading
      JOIN public.metering_meters AS meter
        ON meter.society_id = reading.society_id
        AND meter.id = reading.meter_id
      WHERE reading.society_id = p_society_id
        AND reading.unit_id = p_unit_id
        AND reading.status = 'approved'
      LIMIT 100
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'handovers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', handover.id,
        'event_type', handover.event_type,
        'move_id', handover.move_id,
        'transfer_case_id', handover.transfer_case_id,
        'handover_on', handover.handover_on,
        'status', handover.status,
        'note', handover.note,
        'version', handover.version,
        'closed_at', handover.closed_at,
        'created_at', handover.created_at,
        'can_acknowledge', handover.status = 'open' AND EXISTS (
          SELECT 1
          FROM public.unit_handover_parties AS party
          JOIN public.memberships AS membership
            ON membership.society_id = party.society_id
            AND membership.id = party.membership_id
          WHERE party.society_id = handover.society_id
            AND party.handover_id = handover.id
            AND membership.user_id = auth.uid()
            AND membership.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM public.unit_handover_acknowledgements AS acknowledged
              WHERE acknowledged.society_id = party.society_id
                AND acknowledged.handover_id = party.handover_id
                AND acknowledged.membership_id = party.membership_id
            )
        ),
        'items', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', item.id, 'position', item.position,
            'item_key', item.item_key, 'label', item.label,
            'response', item.response, 'note', item.note
          ) ORDER BY item.position)
          FROM public.unit_handover_items AS item
          WHERE item.society_id = handover.society_id
            AND item.handover_id = handover.id
        ), '[]'::jsonb),
        'parties', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'membership_id', party.membership_id,
            'name', party.party_name,
            'role', party.role_snapshot,
            'acknowledged_at', acknowledgement.acknowledged_at,
            'acknowledgement_note', acknowledgement.note
          ) ORDER BY lower(party.party_name))
          FROM public.unit_handover_parties AS party
          LEFT JOIN public.unit_handover_acknowledgements AS acknowledgement
            ON acknowledgement.society_id = party.society_id
            AND acknowledgement.handover_id = party.handover_id
            AND acknowledgement.membership_id = party.membership_id
          WHERE party.society_id = handover.society_id
            AND party.handover_id = handover.id
        ), '[]'::jsonb),
        'readings', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', link.reading_id,
            'meter_type', meter.meter_type,
            'reading_value', reading.reading_value,
            'reading_date', reading.reading_date
          ) ORDER BY reading.reading_date DESC, link.id)
          FROM public.unit_handover_readings AS link
          JOIN public.metering_readings AS reading
            ON reading.society_id = link.society_id
            AND reading.id = link.reading_id
          JOIN public.metering_meters AS meter
            ON meter.society_id = reading.society_id
            AND meter.id = reading.meter_id
          WHERE link.society_id = handover.society_id
            AND link.handover_id = handover.id
        ), '[]'::jsonb),
        'photos', CASE WHEN is_admin OR (
          is_committee = false
          AND private.unit_handover_can_read(p_society_id, handover)
        ) THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', photo.id, 'path', photo.path,
            'content_type', photo.content_type,
            'size_bytes', photo.size_bytes
          ) ORDER BY photo.added_at, photo.id)
          FROM public.unit_handover_photos AS photo
          WHERE photo.society_id = handover.society_id
            AND photo.handover_id = handover.id
        ), '[]'::jsonb) ELSE '[]'::jsonb END
      ) ORDER BY handover.handover_on DESC, handover.created_at DESC)
      FROM public.unit_handovers AS handover
      WHERE handover.society_id = p_society_id
        AND handover.unit_id = p_unit_id
        AND private.unit_handover_can_read(p_society_id, handover)
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.unit_handover_create(
  p_society_id uuid, p_unit_id uuid, p_event_type text, p_move_id uuid,
  p_transfer_case_id uuid, p_handover_on date, p_note text,
  p_party_membership_ids uuid[], p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.unit_handovers;
  handover_id uuid;
  membership_id uuid;
  member public.memberships;
  profile public.profiles;
  template public.unit_handover_templates;
  template_items jsonb;
  move public.tenancy_moves;
  transfer public.tenancy_transfer_cases;
  item jsonb;
  party_ids uuid[];
  allowed_party_ids uuid[];
  position integer := 0;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Handover access denied.' USING ERRCODE = '42501'; END IF;
  PERFORM private.unit_handover_check_trace(p_request_trace);
  IF p_event_type NOT IN (
      'tenant_move_in', 'tenant_move_out', 'owner_transfer', 'standalone'
    )
    OR p_handover_on IS NULL
    OR p_move_id IS NOT NULL AND p_transfer_case_id IS NOT NULL
    OR p_event_type IN ('tenant_move_in', 'tenant_move_out')
      AND p_move_id IS NULL
    OR p_event_type = 'owner_transfer' AND p_transfer_case_id IS NULL
    OR p_event_type = 'standalone'
      AND (p_move_id IS NOT NULL OR p_transfer_case_id IS NOT NULL)
    OR p_client_request_id IS NULL
  THEN RAISE EXCEPTION 'Check the handover details.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO handover
  FROM public.unit_handovers
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF handover.id IS NOT NULL THEN
    IF handover.unit_id = p_unit_id AND handover.event_type = p_event_type
      AND handover.move_id IS NOT DISTINCT FROM p_move_id
      AND handover.transfer_case_id IS NOT DISTINCT FROM p_transfer_case_id
      AND handover.handover_on = p_handover_on
    THEN RETURN handover.id; END IF;
    RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
  END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id AND unit_id = p_unit_id
    FOR UPDATE;
    IF NOT FOUND OR p_event_type <> (CASE move.kind
      WHEN 'move_in' THEN 'tenant_move_in' ELSE 'tenant_move_out' END)
    THEN RAISE EXCEPTION 'Choose a matching tenancy move.' USING ERRCODE = '22023'; END IF;
  END IF;
  IF p_transfer_case_id IS NOT NULL THEN
    SELECT * INTO transfer FROM public.tenancy_transfer_cases
    WHERE society_id = p_society_id
      AND id = p_transfer_case_id AND unit_id = p_unit_id
    FOR UPDATE;
    IF NOT FOUND OR p_event_type <> 'owner_transfer'
    THEN RAISE EXCEPTION 'Choose a matching transfer case.' USING ERRCODE = '22023'; END IF;
  END IF;
  IF move.id IS NOT NULL AND move.status = 'completed'
    OR transfer.id IS NOT NULL AND transfer.stage = 'completed'
  THEN RAISE EXCEPTION 'The linked workflow is already completed.'
    USING ERRCODE = '23514'; END IF;
  SELECT * INTO template
  FROM public.unit_handover_templates
  WHERE society_id = p_society_id;
  template_items := COALESCE(
    template.items, private.unit_handover_default_template()
  );
  party_ids := coalesce(p_party_membership_ids, ARRAY[]::uuid[]);
  IF array_length(party_ids, 1) IS NULL THEN
    IF move.id IS NOT NULL THEN
      party_ids := ARRAY[move.tenant_membership_id] || COALESCE((
        SELECT array_agg(occupant.membership_id)
        FROM public.unit_occupants AS occupant
        WHERE occupant.society_id = p_society_id
          AND occupant.unit_id = p_unit_id
          AND occupant.status = 'active'
          AND occupant.relationship = 'owner'
      ), ARRAY[]::uuid[]);
    ELSIF transfer.id IS NOT NULL THEN
      party_ids := COALESCE((
        SELECT array_agg(party.membership_id)
        FROM public.tenancy_transfer_parties AS party
        WHERE party.society_id = p_society_id
          AND party.case_id = transfer.id
          AND party.active
          AND party.membership_id IS NOT NULL
      ), ARRAY[]::uuid[]);
    END IF;
  END IF;
  IF move.id IS NOT NULL THEN
    allowed_party_ids := ARRAY[move.tenant_membership_id] || COALESCE((
      SELECT array_agg(DISTINCT occupant.membership_id)
      FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = p_society_id
        AND occupant.unit_id = p_unit_id
        AND occupant.status = 'active'
        AND occupant.relationship = 'owner'
    ), ARRAY[]::uuid[]);
  ELSIF transfer.id IS NOT NULL THEN
    allowed_party_ids := COALESCE((
      SELECT array_agg(DISTINCT party.membership_id)
      FROM public.tenancy_transfer_parties AS party
      WHERE party.society_id = p_society_id
        AND party.case_id = transfer.id
        AND party.active
        AND party.membership_id IS NOT NULL
    ), ARRAY[]::uuid[]);
  ELSE
    allowed_party_ids := COALESCE((
      SELECT array_agg(DISTINCT occupant.membership_id)
      FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = p_society_id
        AND occupant.unit_id = p_unit_id
        AND occupant.status = 'active'
    ), ARRAY[]::uuid[]);
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(party_ids, ARRAY[]::uuid[])) AS supplied(party_id)
    WHERE party_id IS NULL OR NOT party_id = ANY(allowed_party_ids)
  ) THEN RAISE EXCEPTION 'Choose parties from the linked unit workflow.'
    USING ERRCODE = '22023'; END IF;
  IF p_event_type <> 'standalone' AND array_length(party_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Choose at least one handover party.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.unit_handovers (
    society_id, unit_id, event_type, move_id, transfer_case_id,
    handover_on, status, note, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, p_unit_id, p_event_type, p_move_id, p_transfer_case_id,
    p_handover_on, 'open', NULLIF(btrim(p_note), ''), p_client_request_id,
    auth.uid(), auth.uid()
  ) RETURNING id INTO handover_id;
  FOREACH item IN ARRAY ARRAY(
    SELECT jsonb_array_elements(template_items)
  )
  LOOP
    position := position + 1;
    INSERT INTO public.unit_handover_items (
      society_id, handover_id, position, item_key, label
    ) VALUES (
      p_society_id, handover_id, position,
      btrim(item ->> 'key'), btrim(item ->> 'label')
    );
  END LOOP;
  FOREACH membership_id IN ARRAY (
    SELECT array_agg(DISTINCT party_id)
    FROM unnest(party_ids) AS party_id
  )
  LOOP
    SELECT * INTO member FROM public.memberships
    WHERE society_id = p_society_id
      AND id = membership_id
      AND status = 'active' AND user_id IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose active society parties.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO profile FROM public.profiles WHERE id = member.user_id;
    INSERT INTO public.unit_handover_parties (
      society_id, handover_id, membership_id, party_name, role_snapshot
    ) VALUES (
      p_society_id, handover_id, membership_id,
      coalesce(profile.full_name, profile.email),
      CASE
        WHEN member.id = move.tenant_membership_id THEN 'tenant'
        WHEN transfer.id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.tenancy_transfer_parties AS party
          WHERE party.case_id = transfer.id
            AND party.membership_id = member.id
            AND party.role = 'seller'
        ) THEN 'seller'
        WHEN transfer.id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.tenancy_transfer_parties AS party
          WHERE party.case_id = transfer.id
            AND party.membership_id = member.id
            AND party.role = 'buyer'
        ) THEN 'buyer'
        WHEN EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = p_society_id
            AND occupant.unit_id = p_unit_id
            AND occupant.membership_id = member.id
            AND occupant.relationship = 'owner'
            AND occupant.status = 'active'
        ) THEN 'owner'
        WHEN EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = p_society_id
            AND occupant.unit_id = p_unit_id
            AND occupant.membership_id = member.id
            AND occupant.relationship = 'family'
            AND occupant.status = 'active'
        ) THEN 'family'
        ELSE 'party'
      END
    );
  END LOOP;
  INSERT INTO public.unit_handover_revisions (
    society_id, handover_id, action, "before", "after", changed_by
  ) VALUES (
    p_society_id, handover_id, 'created', NULL,
    private.unit_handover_snapshot(p_society_id, handover_id), auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.unit_handover.create',
    'unit_handover', handover_id::text,
    jsonb_build_object(
      'unit_id', p_unit_id, 'event_type', p_event_type,
      'move_id', p_move_id, 'transfer_case_id', p_transfer_case_id
    ),
    p_request_trace
  );
  RETURN handover_id;
END;
$$;

CREATE FUNCTION public.unit_handover_items_save(
  p_society_id uuid, p_handover_id uuid, p_items jsonb, p_reason text,
  p_expected_version integer, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.unit_handovers;
  before_values jsonb;
  changed_count integer;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Handover access denied.' USING ERRCODE = '42501'; END IF;
  PERFORM private.unit_handover_check_trace(p_request_trace);
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Check the handover items.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO handover
  FROM public.unit_handovers
  WHERE society_id = p_society_id AND id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002'; END IF;
  IF handover.status <> 'open'
    OR handover.version IS DISTINCT FROM p_expected_version
  THEN RAISE EXCEPTION 'Refresh the open handover before saving.'
    USING ERRCODE = '23505'; END IF;
  SELECT count(*) INTO changed_count
  FROM jsonb_array_elements(p_items) AS value;
  IF changed_count <> (
    SELECT count(*) FROM public.unit_handover_items
    WHERE society_id = p_society_id AND handover_id = p_handover_id
  ) THEN RAISE EXCEPTION 'Answer every handover item once.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS answer
    WHERE answer ->> 'item_id' IS NULL
      OR answer ->> 'response' NOT IN ('yes', 'no', 'not_applicable')
      OR (answer ? 'note') IS FALSE
      OR answer ->> 'note' IS NOT NULL
        AND char_length(btrim(answer ->> 'note')) > 300
      OR NOT EXISTS (
        SELECT 1 FROM public.unit_handover_items AS current
        WHERE current.society_id = p_society_id
          AND current.handover_id = p_handover_id
          AND current.id::text = answer ->> 'item_id'
      )
  ) THEN RAISE EXCEPTION 'Check the handover item answers.'
    USING ERRCODE = '22023'; END IF;
  before_values := private.unit_handover_snapshot(p_society_id, p_handover_id);
  UPDATE public.unit_handover_items AS current
  SET response = value.response,
    note = NULLIF(btrim(value.note), '')
  FROM (
    SELECT
      (answer ->> 'item_id')::uuid AS item_id,
      answer ->> 'response' AS response,
      answer ->> 'note' AS note
    FROM jsonb_array_elements(p_items) AS answer
  ) AS value
  WHERE current.society_id = p_society_id
    AND current.handover_id = p_handover_id
    AND current.id = value.item_id;
  IF NOT FOUND OR (
    SELECT count(DISTINCT (answer ->> 'item_id')::uuid)
    FROM jsonb_array_elements(p_items) AS answer
  ) <> changed_count THEN
    RAISE EXCEPTION 'Check the handover item answers.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.unit_handovers
  SET version = version + 1
  WHERE society_id = p_society_id AND id = p_handover_id;
  INSERT INTO public.unit_handover_revisions (
    society_id, handover_id, action, "before", "after", reason, changed_by
  ) VALUES (
    p_society_id, p_handover_id, 'items_saved', before_values,
    private.unit_handover_snapshot(p_society_id, p_handover_id),
    NULLIF(btrim(p_reason), ''), auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.unit_handover.items.save',
    'unit_handover', p_handover_id::text,
    jsonb_build_object('version', p_expected_version + 1), p_request_trace
  );
  RETURN p_handover_id;
END;
$$;

CREATE FUNCTION public.unit_handover_reading_link(
  p_society_id uuid, p_handover_id uuid, p_reading_id uuid,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.unit_handovers;
  reading public.metering_readings;
  existing public.unit_handover_readings;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'metering')
  THEN RAISE EXCEPTION 'Meter reading access denied.' USING ERRCODE = '42501'; END IF;
  PERFORM private.unit_handover_check_trace(p_request_trace);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Check the reading request.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO handover FROM public.unit_handovers
  WHERE society_id = p_society_id AND id = p_handover_id FOR UPDATE;
  IF handover.id IS NULL OR handover.status <> 'open' THEN
    RAISE EXCEPTION 'Choose an open handover.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO existing FROM public.unit_handover_readings
  WHERE society_id = p_society_id
    AND added_by = auth.uid() AND client_request_id = p_client_request_id;
  IF existing.id IS NOT NULL THEN
    IF existing.handover_id = p_handover_id
      AND existing.reading_id = p_reading_id
    THEN RETURN existing.id; END IF;
    RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO reading FROM public.metering_readings
  WHERE society_id = p_society_id AND id = p_reading_id
    AND unit_id = handover.unit_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an approved unit reading.'
    USING ERRCODE = '22023'; END IF;
  INSERT INTO public.unit_handover_readings (
    society_id, handover_id, reading_id, added_by, client_request_id
  ) VALUES (
    p_society_id, p_handover_id, p_reading_id, auth.uid(), p_client_request_id
  ) RETURNING * INTO existing;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.unit_handover.reading.link',
    'unit_handover_reading', existing.id::text,
    jsonb_build_object('handover_id', p_handover_id, 'reading_id', p_reading_id),
    p_request_trace
  );
  RETURN existing.id;
END;
$$;

CREATE FUNCTION public.unit_handover_photo_upload_path(
  p_society_id uuid, p_handover_id uuid, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.unit_handovers;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Handover file access denied.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO handover FROM public.unit_handovers
  WHERE society_id = p_society_id AND id = p_handover_id
  FOR UPDATE;
  IF NOT FOUND OR handover.status <> 'open' THEN
    RAISE EXCEPTION 'Choose an open handover.' USING ERRCODE = '23514';
  END IF;
  IF p_content_type NOT IN ('image/jpeg', 'image/png', 'application/pdf')
    OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Use a JPG, PNG or PDF up to 5 MiB.'
    USING ERRCODE = '22023'; END IF;
  RETURN p_society_id || '/handovers/' || p_handover_id || '/'
    || auth.uid() || '/' || extensions.gen_random_uuid()
    || CASE p_content_type
      WHEN 'image/jpeg' THEN '.jpg'
      WHEN 'image/png' THEN '.png'
      ELSE '.pdf' END;
END;
$$;

CREATE FUNCTION public.unit_handover_photo_add(
  p_society_id uuid, p_handover_id uuid, p_path text,
  p_content_type text, p_size_bytes integer,
  p_client_request_id uuid, p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  photo_id uuid;
  metadata jsonb;
  handover public.unit_handovers;
  existing public.unit_handover_photos;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Handover file access denied.' USING ERRCODE = '42501'; END IF;
  PERFORM private.unit_handover_check_trace(p_request_trace);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Check the handover file request.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO handover FROM public.unit_handovers
  WHERE society_id = p_society_id AND id = p_handover_id
  FOR UPDATE;
  IF NOT FOUND OR handover.status <> 'open' THEN
    RAISE EXCEPTION 'Choose an open handover.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO existing FROM public.unit_handover_photos
  WHERE society_id = p_society_id
    AND added_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing.id IS NOT NULL THEN
    IF existing.handover_id = p_handover_id
      AND existing.path = p_path
      AND existing.content_type = p_content_type
      AND existing.size_bytes = p_size_bytes
    THEN RETURN existing.id; END IF;
    RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
  END IF;
  IF split_part(coalesce(p_path, ''), '/', 1) <> p_society_id::text
    OR split_part(p_path, '/', 3) <> p_handover_id::text
    OR split_part(p_path, '/', 4) <> auth.uid()::text
    OR NOT private.unit_handover_file_access(p_path, true)
  THEN RAISE EXCEPTION 'Upload the handover file again.' USING ERRCODE = '22023'; END IF;
  SELECT object.metadata INTO metadata FROM storage.objects AS object
  WHERE object.bucket_id = 'handover-photos' AND object.name = p_path;
  IF metadata IS NULL
    OR metadata ->> 'mimetype' IS DISTINCT FROM p_content_type
    OR (metadata ->> 'size')::integer IS DISTINCT FROM p_size_bytes
  THEN RAISE EXCEPTION 'The uploaded handover file changed.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.unit_handover_photos (
    society_id, handover_id, path, content_type, size_bytes,
    added_by, client_request_id
  ) VALUES (
    p_society_id, p_handover_id, p_path, p_content_type, p_size_bytes,
    auth.uid(), p_client_request_id
  ) RETURNING id INTO photo_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.unit_handover.photo.add',
    'unit_handover_photo', photo_id::text,
    jsonb_build_object('handover_id', p_handover_id, 'path', p_path),
    p_request_trace
  );
  RETURN photo_id;
END;
$$;

CREATE FUNCTION public.unit_handover_file_access(
  p_society_id uuid, p_path text
)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN split_part(coalesce(p_path, ''), '/', 1) = p_society_id::text
    AND private.unit_handover_file_access(p_path, false);
END;
$$;

CREATE FUNCTION public.unit_handover_acknowledge(
  p_society_id uuid, p_handover_id uuid, p_note text,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  party_membership public.memberships;
  handover public.unit_handovers;
  saved_id uuid;
BEGIN
  PERFORM private.unit_handover_check_trace(p_request_trace);
  IF NOT private.is_member(p_society_id)
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN RAISE EXCEPTION 'Only a handover party can acknowledge it.'
    USING ERRCODE = '42501'; END IF;
  SELECT * INTO handover FROM public.unit_handovers
  WHERE society_id = p_society_id AND id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT membership.* INTO party_membership
  FROM public.memberships AS membership
  JOIN public.unit_handover_parties AS party
    ON party.society_id = membership.society_id
    AND party.membership_id = membership.id
  WHERE membership.society_id = p_society_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND party.handover_id = p_handover_id
    AND 'resident' = ANY(membership.roles)
  LIMIT 1;
  IF NOT FOUND OR handover.status <> 'open'
  THEN RAISE EXCEPTION 'Only a handover party can acknowledge it.'
    USING ERRCODE = '42501'; END IF;
  INSERT INTO public.unit_handover_acknowledgements (
    society_id, handover_id, membership_id, note
  ) VALUES (
    p_society_id, p_handover_id, party_membership.id, NULLIF(btrim(p_note), '')
  )
  ON CONFLICT (society_id, handover_id, membership_id) DO NOTHING
  RETURNING id INTO saved_id;
  IF saved_id IS NULL THEN RETURN (
    SELECT id FROM public.unit_handover_acknowledgements
    WHERE society_id = p_society_id AND handover_id = p_handover_id
      AND membership_id = party_membership.id
  ); END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'resident', 'core.unit_handover.acknowledge',
    'unit_handover', p_handover_id::text,
    jsonb_build_object('membership_id', party_membership.id), p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.unit_handover_close(
  p_society_id uuid, p_handover_id uuid, p_expected_version integer,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handover public.unit_handovers;
  before_values jsonb;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN RAISE EXCEPTION 'Handover access denied.' USING ERRCODE = '42501'; END IF;
  PERFORM private.unit_handover_check_trace(p_request_trace);
  SELECT * INTO handover FROM public.unit_handovers
  WHERE society_id = p_society_id AND id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found.' USING ERRCODE = 'P0002'; END IF;
  IF handover.status <> 'open'
    OR handover.version IS DISTINCT FROM p_expected_version
  THEN RAISE EXCEPTION 'Refresh the open handover before closing.'
    USING ERRCODE = '23505'; END IF;
  before_values := private.unit_handover_snapshot(p_society_id, p_handover_id);
  UPDATE public.unit_handovers
  SET status = 'closed', closed_at = clock_timestamp(), closed_by = auth.uid(),
    version = version + 1
  WHERE society_id = p_society_id AND id = p_handover_id;
  INSERT INTO public.unit_handover_revisions (
    society_id, handover_id, action, "before", "after", changed_by
  ) VALUES (
    p_society_id, p_handover_id, 'closed', before_values,
    private.unit_handover_snapshot(p_society_id, p_handover_id), auth.uid()
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.unit_handover.close',
    'unit_handover', p_handover_id::text, before_values,
    jsonb_build_object('status', 'closed'), p_request_trace
  );
  RETURN p_handover_id;
END;
$$;

CREATE FUNCTION private.unit_handover_completion_guard(
  p_society_id uuid, p_move_id uuid, p_case_id uuid,
  p_override boolean, p_request_trace text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  open_handover_ids uuid[];
  move public.tenancy_moves;
  transfer public.tenancy_transfer_cases;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF (p_move_id IS NULL) = (p_case_id IS NULL) THEN
    RAISE EXCEPTION 'Choose one move or transfer case.' USING ERRCODE = '22023';
  END IF;
  IF p_move_id IS NOT NULL THEN
    SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002';
    END IF;
    IF move.status = 'completed' THEN RETURN; END IF;
  ELSE
    SELECT * INTO transfer FROM public.tenancy_transfer_cases
    WHERE society_id = p_society_id AND id = p_case_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transfer case not found.' USING ERRCODE = 'P0002';
    END IF;
    IF transfer.stage = 'completed' THEN RETURN; END IF;
  END IF;
  SELECT coalesce(array_agg(handover.id), ARRAY[]::uuid[])
  INTO open_handover_ids
  FROM public.unit_handovers AS handover
  WHERE handover.society_id = p_society_id
    AND handover.status = 'open'
    AND (
      p_move_id IS NOT NULL AND handover.move_id = p_move_id
      AND handover.event_type = 'tenant_move_out'
      OR p_case_id IS NOT NULL AND handover.transfer_case_id = p_case_id
        AND handover.event_type = 'owner_transfer'
    );
  IF cardinality(open_handover_ids) = 0 THEN RETURN; END IF;
  IF NOT coalesce(p_override, false) THEN
    RAISE EXCEPTION 'Complete the linked unit handover or confirm Complete anyway.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'core.unit_handover.override',
    'unit_handover',
    CASE WHEN p_move_id IS NOT NULL THEN p_move_id::text ELSE p_case_id::text END,
    jsonb_build_object(
      'move_id', p_move_id, 'case_id', p_case_id,
      'open_handover_ids', to_jsonb(open_handover_ids)
    ),
    p_request_trace
  );
END;
$$;
REVOKE ALL ON FUNCTION private.unit_handover_completion_guard(
  uuid, uuid, uuid, boolean, text
) FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.tenancy_move_complete(uuid, uuid, integer, text)
  RENAME TO tenancy_move_complete_p36_base;
ALTER FUNCTION public.tenancy_move_complete_p36_base(uuid, uuid, integer, text)
  SET SCHEMA private;
REVOKE ALL ON FUNCTION private.tenancy_move_complete_p36_base(
  uuid, uuid, integer, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_move_complete(
  p_society_id uuid, p_move_id uuid, p_expected_version integer,
  p_request_id text, p_override_open_handover boolean
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.unit_handover_completion_guard(
    p_society_id, p_move_id, NULL, p_override_open_handover, p_request_id
  );
  RETURN private.tenancy_move_complete_p36_base(
    p_society_id, p_move_id, p_expected_version, p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_move_complete(
  p_society_id uuid, p_move_id uuid, p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN public.tenancy_move_complete(
    p_society_id, p_move_id, p_expected_version, p_request_id, false
  );
END;
$$;

ALTER FUNCTION public.tenancy_transfer_case_advance(
  uuid, uuid, integer, text, text, text
) RENAME TO tenancy_transfer_case_advance_p36_base;
ALTER FUNCTION public.tenancy_transfer_case_advance_p36_base(
  uuid, uuid, integer, text, text, text
) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.tenancy_transfer_case_advance_p36_base(
  uuid, uuid, integer, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_transfer_case_advance(
  p_society_id uuid, p_case_id uuid, p_expected_version integer,
  p_next_stage text, p_reason text, p_request_id text,
  p_override_open_handover boolean
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_next_stage = 'completed' THEN
    PERFORM private.unit_handover_completion_guard(
      p_society_id, NULL, p_case_id, p_override_open_handover, p_request_id
    );
  END IF;
  RETURN private.tenancy_transfer_case_advance_p36_base(
    p_society_id, p_case_id, p_expected_version,
    p_next_stage, p_reason, p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_transfer_case_advance(
  p_society_id uuid, p_case_id uuid, p_expected_version integer,
  p_next_stage text, p_reason text, p_request_id text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN public.tenancy_transfer_case_advance(
    p_society_id, p_case_id, p_expected_version,
    p_next_stage, p_reason, p_request_id, false
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.unit_handover_template_save(uuid, jsonb, integer, uuid, text),
  public.unit_handover_workspace(uuid, uuid),
  public.unit_handover_create(
    uuid, uuid, text, uuid, uuid, date, text, uuid[], uuid, text
  ),
  public.unit_handover_items_save(uuid, uuid, jsonb, text, integer, text),
  public.unit_handover_reading_link(uuid, uuid, uuid, uuid, text),
  public.unit_handover_photo_upload_path(uuid, uuid, text, integer),
  public.unit_handover_photo_add(
    uuid, uuid, text, text, integer, uuid, text
  ),
  public.unit_handover_file_access(uuid, text),
  public.unit_handover_acknowledge(uuid, uuid, text, text),
  public.unit_handover_close(uuid, uuid, integer, text),
  public.tenancy_move_complete(uuid, uuid, integer, text, boolean),
  public.tenancy_move_complete(uuid, uuid, integer, text),
  public.tenancy_transfer_case_advance(
    uuid, uuid, integer, text, text, text, boolean
  ),
  public.tenancy_transfer_case_advance(uuid, uuid, integer, text, text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.unit_handover_template_save(uuid, jsonb, integer, uuid, text),
  public.unit_handover_workspace(uuid, uuid),
  public.unit_handover_create(
    uuid, uuid, text, uuid, uuid, date, text, uuid[], uuid, text
  ),
  public.unit_handover_items_save(uuid, uuid, jsonb, text, integer, text),
  public.unit_handover_reading_link(uuid, uuid, uuid, uuid, text),
  public.unit_handover_photo_upload_path(uuid, uuid, text, integer),
  public.unit_handover_photo_add(
    uuid, uuid, text, text, integer, uuid, text
  ),
  public.unit_handover_file_access(uuid, text),
  public.unit_handover_acknowledge(uuid, uuid, text, text),
  public.unit_handover_close(uuid, uuid, integer, text),
  public.tenancy_move_complete(uuid, uuid, integer, text, boolean),
  public.tenancy_move_complete(uuid, uuid, integer, text),
  public.tenancy_transfer_case_advance(
    uuid, uuid, integer, text, text, text, boolean
  ),
  public.tenancy_transfer_case_advance(uuid, uuid, integer, text, text, text)
TO authenticated;
