-- Emergency SOS: alerts, recipient acknowledgements, timeline, emergency contacts and responder RPCs.
CREATE TABLE public.sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid,
  category text NOT NULL CHECK (category IN ('medical', 'fire', 'security', 'other')),
  note text CHECK (note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 280)),
  status text NOT NULL DEFAULT 'raised'
    CHECK (status IN ('raised', 'acknowledged', 'closed', 'cancelled')),
  raised_role text NOT NULL CHECK (raised_role IN ('resident', 'guard')),
  raised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  raised_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  close_reason text CHECK (close_reason IN (
    'resolved', 'false_alarm', 'duplicate', 'test', 'other', 'raised_by_mistake'
  )),
  close_note text CHECK (
    close_note IS NULL OR (close_note = btrim(close_note) AND char_length(close_note) BETWEEN 1 AND 500)
  ),
  client_request_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT sos_alerts_unit_fkey FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT sos_alerts_resident_unit_check CHECK (raised_role = 'guard' OR unit_id IS NOT NULL),
  CONSTRAINT sos_alerts_acknowledgement_check CHECK (
    (acknowledged_at IS NULL) = (acknowledged_by IS NULL)
    AND (status <> 'acknowledged' OR acknowledged_at IS NOT NULL)
  ),
  CONSTRAINT sos_alerts_closure_check CHECK (
    (status IN ('raised', 'acknowledged') AND closed_at IS NULL AND closed_by IS NULL
      AND close_reason IS NULL AND close_note IS NULL)
    OR (status = 'cancelled' AND closed_at IS NOT NULL AND closed_by = raised_by
      AND close_reason = 'raised_by_mistake' AND close_note IS NULL AND acknowledged_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL
      AND acknowledged_at IS NOT NULL
      AND close_reason IN ('resolved', 'false_alarm', 'duplicate', 'test', 'other')
      AND (close_reason NOT IN ('false_alarm', 'other') OR close_note IS NOT NULL))
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, raised_by, client_request_id)
);
CREATE UNIQUE INDEX sos_alerts_one_open_unit_idx ON public.sos_alerts (society_id, unit_id)
  WHERE status IN ('raised', 'acknowledged') AND unit_id IS NOT NULL;
CREATE INDEX sos_alerts_unit_recent_idx ON public.sos_alerts (society_id, unit_id, raised_at DESC);
CREATE INDEX sos_alerts_society_recent_idx ON public.sos_alerts (society_id, raised_at DESC, id);
CREATE INDEX sos_alerts_open_idx ON public.sos_alerts (society_id, raised_at DESC)
  WHERE status IN ('raised', 'acknowledged');
CREATE INDEX sos_alerts_raised_by_idx ON public.sos_alerts (raised_by, raised_at DESC);
CREATE INDEX sos_alerts_acknowledged_by_idx ON public.sos_alerts (acknowledged_by);
CREATE INDEX sos_alerts_closed_by_idx ON public.sos_alerts (closed_by);

CREATE TABLE public.sos_alert_recipients (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  alert_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  audience text NOT NULL CHECK (audience IN ('guard', 'admin', 'committee', 'resident')),
  notified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  acknowledged_at timestamptz,
  PRIMARY KEY (alert_id, user_id),
  CONSTRAINT sos_alert_recipients_alert_fkey FOREIGN KEY (society_id, alert_id)
    REFERENCES public.sos_alerts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT sos_alert_recipients_membership_fkey FOREIGN KEY (society_id, user_id)
    REFERENCES public.memberships (society_id, user_id) ON DELETE RESTRICT
);
CREATE INDEX sos_alert_recipients_pending_idx ON public.sos_alert_recipients (user_id, notified_at DESC)
  WHERE acknowledged_at IS NULL;
CREATE INDEX sos_alert_recipients_user_id_idx ON public.sos_alert_recipients (user_id);
CREATE INDEX sos_alert_recipients_membership_idx ON public.sos_alert_recipients (society_id, user_id);
CREATE INDEX sos_alert_recipients_alert_idx ON public.sos_alert_recipients (society_id, alert_id);

CREATE TABLE public.sos_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  alert_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('raised', 'acknowledged', 'updated', 'closed', 'cancelled')),
  status text NOT NULL CHECK (status IN ('raised', 'acknowledged', 'closed', 'cancelled')),
  note text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  CONSTRAINT sos_alert_events_alert_fkey FOREIGN KEY (society_id, alert_id)
    REFERENCES public.sos_alerts (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX sos_alert_events_alert_idx ON public.sos_alert_events (society_id, alert_id, created_at, id);
CREATE INDEX sos_alert_events_created_by_idx ON public.sos_alert_events (created_by);

CREATE TABLE public.sos_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (label = btrim(label) AND char_length(label) BETWEEN 1 AND 60),
  phone text NOT NULL CHECK (
    char_length(phone) BETWEEN 2 AND 20 AND phone ~ '^\+?[0-9]([0-9 -]*[0-9])?$'
  ),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  UNIQUE (society_id, id)
);
CREATE INDEX sos_contacts_society_idx ON public.sos_contacts (society_id, sort_order, label)
  WHERE archived_at IS NULL;
CREATE INDEX sos_contacts_created_by_idx ON public.sos_contacts (created_by);
CREATE INDEX sos_contacts_updated_by_idx ON public.sos_contacts (updated_by);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sos_alerts, public.sos_alert_recipients, public.sos_alert_events, public.sos_contacts
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY sos_alerts_no_direct_access ON public.sos_alerts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sos_alert_recipients_no_direct_access ON public.sos_alert_recipients
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sos_alert_events_no_direct_access ON public.sos_alert_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sos_contacts_no_direct_access ON public.sos_contacts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER sos_alert_events_immutable BEFORE UPDATE OR DELETE ON public.sos_alert_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_alert_events_no_truncate BEFORE TRUNCATE ON public.sos_alert_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_alerts_no_delete BEFORE DELETE ON public.sos_alerts
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_alerts_no_truncate BEFORE TRUNCATE ON public.sos_alerts
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_alert_recipients_no_delete BEFORE DELETE ON public.sos_alert_recipients
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_alert_recipients_no_truncate BEFORE TRUNCATE ON public.sos_alert_recipients
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_contacts_no_delete BEFORE DELETE ON public.sos_contacts
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER sos_contacts_no_truncate BEFORE TRUNCATE ON public.sos_contacts
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.sos_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'sos')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Emergency access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION private.sos_settings(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'notify_guards', true, 'notify_admins', true, 'notify_committee', false, 'resident_scope', 'off'
  ) || COALESCE((
    SELECT settings FROM public.module_configs WHERE society_id = p_society_id AND module_key = 'sos'
  ), '{}'::jsonb)
$$;

CREATE FUNCTION private.sos_actor_role(p_society_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'system'
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    WHEN private.has_role(p_society_id, ARRAY['committee']::text[]) THEN 'committee'
    WHEN private.has_role(p_society_id, ARRAY['guard']::text[]) THEN 'guard'
    ELSE 'resident' END
$$;

CREATE FUNCTION private.sos_unit_label(p_society_id uuid, p_unit_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(block.name || ' - ', '') || unit.number
  FROM public.units AS unit
  LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
  WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
$$;

CREATE FUNCTION private.sos_my_unit_ids(p_society_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(array_agg(DISTINCT occupant.unit_id), ARRAY[]::uuid[])
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
  JOIN public.units AS unit ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id
  WHERE occupant.society_id = p_society_id AND occupant.status = 'active' AND unit.active
    AND membership.status = 'active' AND membership.user_id = auth.uid()
    AND 'resident' = ANY(membership.roles)
$$;

CREATE FUNCTION private.sos_entity_type(p_society_id uuid, p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN membership.roles && ARRAY['admin', 'committee']::text[] THEN 'sos_admin'
    WHEN 'guard' = ANY(membership.roles) THEN 'sos_guard'
    ELSE 'sos_alert' END
  FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id AND membership.user_id = p_user_id
$$;

CREATE FUNCTION private.sos_category_label(p_category text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_category
    WHEN 'medical' THEN 'Medical emergency'
    WHEN 'fire' THEN 'Fire'
    WHEN 'security' THEN 'Security emergency'
    ELSE 'Emergency' END
$$;

CREATE FUNCTION private.sos_notify(
  p_alert public.sos_alerts, p_user_id uuid, p_type text, p_title text, p_body text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_alert.society_id AND user_id = p_user_id AND status = 'active'
  ) THEN
    PERFORM private.create_notification(
      p_alert.society_id, p_user_id, p_type, p_title, p_body,
      private.sos_entity_type(p_alert.society_id, p_user_id), p_alert.id, p_request_id
    );
  END IF;
END;
$$;

CREATE FUNCTION private.sos_notify_pending_recipients(
  p_alert public.sos_alerts, p_title text, p_body text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  recipient record;
BEGIN
  FOR recipient IN
    SELECT user_id FROM public.sos_alert_recipients
    WHERE society_id = p_alert.society_id AND alert_id = p_alert.id
      AND acknowledged_at IS NULL AND user_id <> COALESCE(auth.uid(), p_alert.raised_by)
  LOOP
    PERFORM private.sos_notify(p_alert, recipient.user_id, 'sos_update', p_title, p_body, p_request_id);
  END LOOP;
END;
$$;

CREATE FUNCTION private.sos_event(p_alert_id uuid, p_action text, p_note text, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts;
BEGIN
  SELECT * INTO STRICT alert FROM public.sos_alerts WHERE id = p_alert_id;
  INSERT INTO public.sos_alert_events (society_id, alert_id, action, status, note, created_by, request_id)
  VALUES (alert.society_id, alert.id, p_action, alert.status, p_note, auth.uid(), p_request_id);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    alert.society_id, auth.uid(), private.sos_actor_role(alert.society_id),
    'sos.' || p_action, 'sos_alert', alert.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'status', alert.status, 'category', alert.category, 'unit_id', alert.unit_id,
      'close_reason', alert.close_reason
    )),
    p_request_id
  );
END;
$$;

-- Recipients are fixed when the SOS is raised; one row per person with the highest-priority audience.
CREATE FUNCTION private.sos_resident_cap()
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT 5000 $$;

CREATE FUNCTION private.sos_route(p_alert public.sos_alerts, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  settings jsonb := private.sos_settings(p_alert.society_id);
  scope text := settings ->> 'resident_scope';
  source_unit public.units;
  recipient record;
  unit_text text := private.sos_unit_label(p_alert.society_id, p_alert.unit_id);
  title text := 'SOS: ' || private.sos_category_label(p_alert.category);
  resident_cap integer := private.sos_resident_cap();
  dropped integer;
BEGIN
  IF p_alert.unit_id IS NOT NULL THEN
    SELECT * INTO source_unit FROM public.units
    WHERE society_id = p_alert.society_id AND id = p_alert.unit_id;
  END IF;
  -- Responders are never dropped; resident fan-out is capped and the overflow is audited.
  WITH chosen AS (
  SELECT DISTINCT ON (candidate.user_id) candidate.user_id, candidate.rank, candidate.audience
  FROM (
    SELECT membership.user_id, 1 AS rank, 'guard' AS audience
    FROM public.memberships AS membership
    WHERE (settings ->> 'notify_guards')::boolean AND 'guard' = ANY(membership.roles)
      AND membership.society_id = p_alert.society_id AND membership.status = 'active'
    UNION ALL
    SELECT membership.user_id, 2, 'admin'
    FROM public.memberships AS membership
    WHERE (settings ->> 'notify_admins')::boolean AND 'admin' = ANY(membership.roles)
      AND membership.society_id = p_alert.society_id AND membership.status = 'active'
    UNION ALL
    SELECT membership.user_id, 3, 'committee'
    FROM public.memberships AS membership
    WHERE (settings ->> 'notify_committee')::boolean AND 'committee' = ANY(membership.roles)
      AND membership.society_id = p_alert.society_id AND membership.status = 'active'
    UNION ALL
    SELECT membership.user_id, 4, 'resident'
    FROM public.memberships AS membership
    WHERE 'resident' = ANY(membership.roles)
      AND membership.society_id = p_alert.society_id AND membership.status = 'active'
      AND (
        scope = 'society'
        OR (scope IN ('floor', 'block') AND p_alert.unit_id IS NOT NULL
          AND (scope = 'block' OR source_unit.floor IS NOT NULL)
          AND EXISTS (
            SELECT 1 FROM public.unit_occupants AS occupant
            JOIN public.units AS unit ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id
            WHERE occupant.society_id = membership.society_id AND occupant.membership_id = membership.id
              AND occupant.status = 'active' AND unit.active
              AND unit.block_id IS NOT DISTINCT FROM source_unit.block_id
              AND (scope = 'block' OR unit.floor = source_unit.floor)
          ))
      )
  ) AS candidate
  WHERE candidate.user_id IS NOT NULL AND candidate.user_id <> p_alert.raised_by
  ORDER BY candidate.user_id, candidate.rank
  ), ranked AS (
    SELECT chosen.*, CASE WHEN chosen.rank = 4
      THEN row_number() OVER (PARTITION BY chosen.rank = 4 ORDER BY chosen.user_id) END AS resident_no
    FROM chosen
  ), inserted AS (
    INSERT INTO public.sos_alert_recipients (society_id, alert_id, user_id, audience)
    SELECT p_alert.society_id, p_alert.id, ranked.user_id, ranked.audience
    FROM ranked WHERE ranked.resident_no IS NULL OR ranked.resident_no <= resident_cap
    RETURNING 1
  )
  SELECT count(*) FILTER (WHERE ranked.resident_no > resident_cap) INTO dropped FROM ranked;

  IF dropped > 0 THEN
    RAISE LOG 'sos_route: alert % dropped % resident recipients over cap %', p_alert.id, dropped, resident_cap;
    INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
    VALUES (
      p_alert.society_id, auth.uid(), private.sos_actor_role(p_alert.society_id),
      'sos.recipients_truncated', 'sos_alert', p_alert.id::text,
      jsonb_build_object('resident_cap', resident_cap, 'dropped', dropped), p_request_id
    );
  END IF;

  FOR recipient IN
    SELECT user_id, audience FROM public.sos_alert_recipients
    WHERE society_id = p_alert.society_id AND alert_id = p_alert.id
  LOOP
    PERFORM private.create_notification(
      p_alert.society_id, recipient.user_id, 'sos_alert', title,
      CASE
        WHEN recipient.audience = 'resident' THEN
          'An SOS was raised' || COALESCE(' from ' || unit_text, '')
          || '. Responders have been alerted. Help only if it is safe.'
        ELSE
          'An SOS was raised' || COALESCE(' from ' || unit_text, ' at the gate')
          || '. Open Emergency to acknowledge and respond.'
      END,
      private.sos_entity_type(p_alert.society_id, recipient.user_id), p_alert.id, p_request_id
    );
  END LOOP;
END;
$$;

CREATE FUNCTION private.sos_seed_contacts(p_society_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.sos_contacts (society_id, label, phone, sort_order)
  VALUES
    (p_society_id, 'Emergency', '112', 10),
    (p_society_id, 'Ambulance', '108', 20),
    (p_society_id, 'Fire', '101', 30),
    (p_society_id, 'Police', '100', 40)
$$;

CREATE FUNCTION private.sos_seed_society_contacts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.sos_seed_contacts(NEW.id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER societies_seed_sos_contacts AFTER INSERT ON public.societies
  FOR EACH ROW EXECUTE FUNCTION private.sos_seed_society_contacts();
SELECT private.sos_seed_contacts(id) FROM public.societies;

CREATE FUNCTION public.sos_settings_update(
  p_society_id uuid, p_notify_guards boolean, p_notify_admins boolean, p_notify_committee boolean,
  p_resident_scope text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  next_settings jsonb;
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_notify_guards IS NULL OR p_notify_admins IS NULL OR p_notify_committee IS NULL
    OR p_resident_scope IS NULL OR p_resident_scope NOT IN ('off', 'floor', 'block', 'society')
    OR NOT (p_notify_guards OR p_notify_admins OR p_notify_committee)
  THEN
    RAISE EXCEPTION 'Choose at least one responder group and a resident scope.' USING ERRCODE = '22023';
  END IF;
  next_settings := jsonb_build_object(
    'notify_guards', p_notify_guards, 'notify_admins', p_notify_admins,
    'notify_committee', p_notify_committee, 'resident_scope', p_resident_scope
  );
  UPDATE public.module_configs
  SET settings = next_settings, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'sos';
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
  VALUES (p_society_id, auth.uid(), 'admin', 'sos.settings.update', 'module', 'sos', next_settings, p_request_id);
END;
$$;

CREATE FUNCTION public.sos_raise(
  p_society_id uuid, p_unit_id uuid, p_category text, p_note text,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts;
  v_unit_id uuid := p_unit_id;
  v_role text;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  my_units uuid[];
  recent integer;
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['resident', 'guard']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.sos_authorize(p_society_id, ARRAY['resident', 'guard']::text[], true);
  IF p_category IS NULL OR p_category NOT IN ('medical', 'fire', 'security', 'other')
    OR p_client_request_id IS NULL OR char_length(COALESCE(v_note, '')) > 280
  THEN
    RAISE EXCEPTION 'Choose the kind of emergency and keep the note short.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO alert FROM public.sos_alerts
  WHERE society_id = p_society_id AND raised_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN alert.id; END IF;

  my_units := private.sos_my_unit_ids(p_society_id);
  IF v_unit_id IS NULL AND NOT private.has_role(p_society_id, ARRAY['guard']::text[]) THEN
    IF cardinality(my_units) <> 1 THEN
      RAISE EXCEPTION 'Choose the unit for this SOS.' USING ERRCODE = '22023';
    END IF;
    v_unit_id := my_units[1];
  END IF;
  IF v_unit_id IS NOT NULL AND v_unit_id = ANY(my_units) THEN
    v_role := 'resident';
  ELSIF private.has_role(p_society_id, ARRAY['guard']::text[]) THEN
    v_role := 'guard';
    IF v_unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units WHERE society_id = p_society_id AND id = v_unit_id AND active
    ) THEN
      RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    RAISE EXCEPTION 'You can raise an SOS only for your own unit.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'sos:' || p_society_id::text || ':' || COALESCE(v_unit_id::text, 'user:' || auth.uid()::text), 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.sos_alerts AS existing
    WHERE existing.society_id = p_society_id AND existing.status IN ('raised', 'acknowledged')
      AND ((v_unit_id IS NOT NULL AND existing.unit_id = v_unit_id)
        OR (v_unit_id IS NULL AND existing.unit_id IS NULL AND existing.raised_by = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'An SOS is already open for this unit.' USING ERRCODE = '55000';
  END IF;
  SELECT count(*) INTO recent FROM public.sos_alerts AS existing
  WHERE existing.society_id = p_society_id AND existing.raised_at > clock_timestamp() - interval '1 hour'
    AND ((v_unit_id IS NOT NULL AND existing.unit_id = v_unit_id)
      OR (v_unit_id IS NULL AND existing.unit_id IS NULL AND existing.raised_by = auth.uid()));
  IF recent >= 3 THEN
    RAISE EXCEPTION 'This unit has raised 3 SOS alerts in the last hour.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.sos_alerts (
    society_id, unit_id, category, note, raised_role, raised_by, client_request_id
  ) VALUES (
    p_society_id, v_unit_id, p_category, v_note, v_role, auth.uid(), p_client_request_id
  ) RETURNING * INTO alert;
  PERFORM private.sos_event(alert.id, 'raised', NULL, p_request_id);
  PERFORM private.sos_route(alert, p_request_id);
  RETURN alert.id;
END;
$$;

CREATE FUNCTION private.sos_lock_for_response(p_society_id uuid, p_alert_id uuid)
RETURNS public.sos_alerts LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts;
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin', 'committee', 'guard']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin', 'committee', 'guard']::text[], true);
  SELECT * INTO alert FROM public.sos_alerts WHERE society_id = p_society_id AND id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS not found.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.sos_alert_recipients SET acknowledged_at = clock_timestamp()
  WHERE society_id = p_society_id AND alert_id = p_alert_id AND user_id = auth.uid()
    AND acknowledged_at IS NULL;
  RETURN alert;
END;
$$;

CREATE FUNCTION public.sos_acknowledge(p_society_id uuid, p_alert_id uuid, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts := private.sos_lock_for_response(p_society_id, p_alert_id);
BEGIN
  IF alert.status = 'acknowledged' THEN RETURN; END IF;
  IF alert.status <> 'raised' THEN
    RAISE EXCEPTION 'This SOS is already closed.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.sos_alerts
  SET status = 'acknowledged', acknowledged_at = clock_timestamp(), acknowledged_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE id = p_alert_id RETURNING * INTO alert;
  PERFORM private.sos_event(p_alert_id, 'acknowledged', NULL, p_request_id);
  IF alert.raised_by <> auth.uid() THEN
    PERFORM private.sos_notify(alert, alert.raised_by, 'sos_update', 'SOS acknowledged',
      'A responder has acknowledged your SOS and is responding.', p_request_id);
  END IF;
END;
$$;

CREATE FUNCTION public.sos_add_update(p_society_id uuid, p_alert_id uuid, p_note text, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts;
  v_note text := btrim(COALESCE(p_note, ''));
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin', 'committee', 'guard']::text[], true);
  IF char_length(v_note) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Enter an update of up to 500 characters.' USING ERRCODE = '22023';
  END IF;
  alert := private.sos_lock_for_response(p_society_id, p_alert_id);
  IF alert.status <> 'acknowledged' THEN
    RAISE EXCEPTION 'Acknowledge this SOS before adding updates.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.sos_alerts SET updated_at = clock_timestamp() WHERE id = p_alert_id;
  PERFORM private.sos_event(p_alert_id, 'updated', v_note, p_request_id);
  IF alert.raised_by <> auth.uid() THEN
    PERFORM private.sos_notify(alert, alert.raised_by, 'sos_update', 'SOS update',
      'A responder added an update to your SOS. Open Emergency to read it.', p_request_id);
  END IF;
END;
$$;

CREATE FUNCTION public.sos_close(
  p_society_id uuid, p_alert_id uuid, p_reason text, p_note text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin', 'committee', 'guard']::text[], true);
  IF p_reason IS NULL OR p_reason NOT IN ('resolved', 'false_alarm', 'duplicate', 'test', 'other')
    OR char_length(COALESCE(v_note, '')) > 500
    OR (p_reason IN ('false_alarm', 'other') AND v_note IS NULL)
  THEN
    RAISE EXCEPTION 'Choose a close reason and add a note when it is required.' USING ERRCODE = '22023';
  END IF;
  alert := private.sos_lock_for_response(p_society_id, p_alert_id);
  IF alert.status <> 'acknowledged' THEN
    RAISE EXCEPTION 'Only an acknowledged SOS can be closed.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.sos_alerts
  SET status = 'closed', closed_at = clock_timestamp(), closed_by = auth.uid(),
    close_reason = p_reason, close_note = v_note, updated_at = clock_timestamp()
  WHERE id = p_alert_id RETURNING * INTO alert;
  PERFORM private.sos_event(p_alert_id, 'closed', v_note, p_request_id);
  IF alert.raised_by <> auth.uid() THEN
    PERFORM private.sos_notify(alert, alert.raised_by, 'sos_update', 'SOS closed',
      'Responders have closed your SOS. Open Emergency for the details.', p_request_id);
  END IF;
  PERFORM private.sos_notify_pending_recipients(alert, 'SOS closed',
    'Responders have closed this SOS. No further action is needed.', p_request_id);
END;
$$;

CREATE FUNCTION public.sos_cancel(p_society_id uuid, p_alert_id uuid, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  alert public.sos_alerts;
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['resident', 'guard']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.sos_authorize(p_society_id, ARRAY['resident', 'guard']::text[], true);
  SELECT * INTO alert FROM public.sos_alerts
  WHERE society_id = p_society_id AND id = p_alert_id AND raised_by = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS not found.' USING ERRCODE = 'P0002';
  END IF;
  IF alert.status = 'cancelled' THEN RETURN; END IF;
  IF alert.status <> 'raised' THEN
    RAISE EXCEPTION 'A responder has already acknowledged this SOS.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.sos_alerts
  SET status = 'cancelled', closed_at = clock_timestamp(), closed_by = auth.uid(),
    close_reason = 'raised_by_mistake', updated_at = clock_timestamp()
  WHERE id = p_alert_id RETURNING * INTO alert;
  PERFORM private.sos_event(p_alert_id, 'cancelled', 'Raised by mistake', p_request_id);
  PERFORM private.sos_notify_pending_recipients(alert, 'SOS cancelled',
    'The SOS was cancelled as raised by mistake. No further action is needed.', p_request_id);
END;
$$;

-- Recipients dismiss their own banner; this is separate from a responder acknowledging the incident.
CREATE FUNCTION public.sos_alert_dismiss(p_alert_id uuid, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  recipient public.sos_alert_recipients;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Emergency access is not available.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO recipient FROM public.sos_alert_recipients
  WHERE alert_id = p_alert_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS alert not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.module_enabled(recipient.society_id, 'sos') OR NOT private.is_member(recipient.society_id) THEN
    RAISE EXCEPTION 'Emergency access is not available.' USING ERRCODE = '42501';
  END IF;
  IF recipient.acknowledged_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.sos_alert_recipients SET acknowledged_at = clock_timestamp()
  WHERE alert_id = p_alert_id AND user_id = auth.uid();
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
  VALUES (recipient.society_id, auth.uid(), private.sos_actor_role(recipient.society_id),
    'sos.alert_dismissed', 'sos_alert', p_alert_id::text,
    jsonb_build_object('audience', recipient.audience), p_request_id);
END;
$$;

CREATE FUNCTION public.sos_my_alerts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Emergency access is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item.data ORDER BY item.raised_at DESC, item.id)
    FROM (
      SELECT alert.id, alert.raised_at, jsonb_build_object(
        'id', alert.id, 'society_id', alert.society_id, 'society_name', society.name,
        'category', alert.category, 'status', alert.status, 'raised_role', alert.raised_role,
        'unit_label', private.sos_unit_label(alert.society_id, alert.unit_id),
        'raised_at', alert.raised_at, 'audience', recipient.audience,
        'note', CASE WHEN recipient.audience = 'resident' THEN NULL ELSE alert.note END
      ) AS data
      FROM public.sos_alert_recipients AS recipient
      JOIN public.sos_alerts AS alert ON alert.society_id = recipient.society_id AND alert.id = recipient.alert_id
      JOIN public.societies AS society ON society.id = alert.society_id
      WHERE recipient.user_id = auth.uid() AND recipient.acknowledged_at IS NULL
        AND alert.status IN ('raised', 'acknowledged') AND society.status <> 'archived'
        AND private.module_enabled(alert.society_id, 'sos') AND private.is_member(alert.society_id)
      ORDER BY alert.raised_at DESC, alert.id
      LIMIT 20
    ) AS item
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION private.sos_alert_json(p_alert public.sos_alerts, p_is_responder boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_alert.id, 'unit_id', p_alert.unit_id,
    'unit_label', private.sos_unit_label(p_alert.society_id, p_alert.unit_id),
    'category', p_alert.category, 'note', p_alert.note, 'status', p_alert.status,
    'raised_role', p_alert.raised_role, 'raised_at', p_alert.raised_at,
    'raised_by_name', COALESCE((SELECT full_name FROM public.profiles WHERE id = p_alert.raised_by), 'Member'),
    'is_mine', p_alert.raised_by = auth.uid(),
    'can_cancel', p_alert.status = 'raised' AND p_alert.raised_by = auth.uid(),
    'can_respond', p_is_responder AND p_alert.status IN ('raised', 'acknowledged'),
    'acknowledged_at', p_alert.acknowledged_at,
    'acknowledged_by_name', (SELECT full_name FROM public.profiles WHERE id = p_alert.acknowledged_by),
    'closed_at', p_alert.closed_at, 'close_reason', p_alert.close_reason, 'close_note', p_alert.close_note,
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id, 'action', event.action, 'note', event.note,
        'actor_name', COALESCE(profile.full_name, 'System'), 'created_at', event.created_at
      ) ORDER BY event.created_at, event.id)
      FROM public.sos_alert_events AS event
      LEFT JOIN public.profiles AS profile ON profile.id = event.created_by
      WHERE event.society_id = p_alert.society_id AND event.alert_id = p_alert.id
    ), '[]'::jsonb)
  )
$$;

CREATE FUNCTION public.sos_workspace(
  p_society_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_responder boolean;
  is_admin boolean;
  is_guard boolean;
  my_units uuid[];
BEGIN
  PERFORM private.sos_authorize(
    p_society_id, ARRAY['admin', 'committee', 'guard', 'resident']::text[], false
  );
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Choose a valid page.' USING ERRCODE = '22023';
  END IF;
  is_responder := private.has_role(p_society_id, ARRAY['admin', 'committee', 'guard']::text[]);
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  is_guard := private.has_role(p_society_id, ARRAY['guard']::text[]);
  my_units := private.sos_my_unit_ids(p_society_id);
  RETURN (
    WITH visible AS (
      SELECT alert.* FROM public.sos_alerts AS alert
      WHERE alert.society_id = p_society_id
        AND (is_responder OR alert.raised_by = auth.uid() OR alert.unit_id = ANY(my_units))
    ), history AS (
      SELECT * FROM visible WHERE status IN ('closed', 'cancelled')
      ORDER BY raised_at DESC, id LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'timezone', society.timezone, 'unit_label', society.unit_label,
      'can_write', private.society_writable(p_society_id),
      'can_raise', private.has_role(p_society_id, ARRAY['guard']::text[]) OR cardinality(my_units) > 0,
      'can_respond', is_responder, 'can_manage', is_admin,
      'settings', private.sos_settings(p_society_id),
      'my_units', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', unit_id, 'label', private.sos_unit_label(p_society_id, unit_id))
          ORDER BY private.sos_unit_label(p_society_id, unit_id))
        FROM unnest(my_units) AS unit_id
      ), '[]'::jsonb),
      'units', CASE WHEN is_guard THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', unit.id, 'label', private.sos_unit_label(p_society_id, unit.id))
          ORDER BY private.sos_unit_label(p_society_id, unit.id))
        FROM public.units AS unit WHERE unit.society_id = p_society_id AND unit.active
      ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'open', COALESCE((
        SELECT jsonb_agg(private.sos_alert_json(visible::public.sos_alerts, is_responder)
          ORDER BY visible.raised_at DESC, visible.id)
        FROM visible WHERE visible.status IN ('raised', 'acknowledged')
      ), '[]'::jsonb),
      'history', jsonb_build_object(
        'items', COALESCE((
          SELECT jsonb_agg(private.sos_alert_json(history::public.sos_alerts, is_responder)
            ORDER BY history.raised_at DESC, history.id)
          FROM history
        ), '[]'::jsonb),
        'total', (SELECT count(*) FROM visible WHERE status IN ('closed', 'cancelled')),
        'limit', p_limit, 'offset', p_offset
      ),
      'contacts', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', contact.id, 'label', contact.label, 'phone', contact.phone,
          'sort_order', contact.sort_order, 'archived', contact.archived_at IS NOT NULL
        ) ORDER BY contact.archived_at IS NOT NULL, contact.sort_order, contact.label, contact.id)
        FROM public.sos_contacts AS contact
        WHERE contact.society_id = p_society_id AND (contact.archived_at IS NULL OR is_admin)
      ), '[]'::jsonb)
    )
    FROM public.societies AS society WHERE society.id = p_society_id
  );
END;
$$;

CREATE FUNCTION public.sos_contact_save(
  p_society_id uuid, p_contact_id uuid, p_label text, p_phone text, p_sort_order integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_label text := btrim(COALESCE(p_label, ''));
  v_phone text := btrim(COALESCE(p_phone, ''));
  v_id uuid;
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF char_length(v_label) NOT BETWEEN 1 AND 60 OR char_length(v_phone) NOT BETWEEN 2 AND 20
    OR v_phone !~ '^\+?[0-9]([0-9 -]*[0-9])?$' OR p_sort_order IS NULL OR p_sort_order NOT BETWEEN 0 AND 999
  THEN
    RAISE EXCEPTION 'Enter a name and a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF p_contact_id IS NULL THEN
    INSERT INTO public.sos_contacts (society_id, label, phone, sort_order, created_by, updated_by)
    VALUES (p_society_id, v_label, v_phone, p_sort_order, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.sos_contacts
    SET label = v_label, phone = v_phone, sort_order = p_sort_order,
      updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_contact_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Emergency contact not found.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
  VALUES (p_society_id, auth.uid(), 'admin',
    CASE WHEN p_contact_id IS NULL THEN 'sos.contact.create' ELSE 'sos.contact.update' END,
    'sos_contact', v_id::text,
    jsonb_build_object('label', v_label, 'phone', v_phone, 'sort_order', p_sort_order), p_request_id);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.sos_contact_set_archived(
  p_society_id uuid, p_contact_id uuid, p_archived boolean, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.sos_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'Choose whether to archive the contact.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sos_contacts
  SET archived_at = CASE WHEN p_archived THEN COALESCE(archived_at, clock_timestamp()) ELSE NULL END,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE society_id = p_society_id AND id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency contact not found.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
  VALUES (p_society_id, auth.uid(), 'admin',
    CASE WHEN p_archived THEN 'sos.contact.archive' ELSE 'sos.contact.restore' END,
    'sos_contact', p_contact_id::text, jsonb_build_object('archived', p_archived), p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION private.sos_authorize(uuid, text[], boolean),
  private.sos_settings(uuid),
  private.sos_actor_role(uuid),
  private.sos_unit_label(uuid, uuid),
  private.sos_my_unit_ids(uuid),
  private.sos_entity_type(uuid, uuid),
  private.sos_category_label(text),
  private.sos_notify(public.sos_alerts, uuid, text, text, text, text),
  private.sos_notify_pending_recipients(public.sos_alerts, text, text, text),
  private.sos_event(uuid, text, text, text),
  private.sos_route(public.sos_alerts, text),
  private.sos_resident_cap(),
  private.sos_seed_contacts(uuid),
  private.sos_seed_society_contacts(),
  private.sos_lock_for_response(uuid, uuid),
  private.sos_alert_json(public.sos_alerts, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sos_settings_update(uuid, boolean, boolean, boolean, text, text),
  public.sos_raise(uuid, uuid, text, text, uuid, text),
  public.sos_acknowledge(uuid, uuid, text),
  public.sos_add_update(uuid, uuid, text, text),
  public.sos_close(uuid, uuid, text, text, text),
  public.sos_cancel(uuid, uuid, text),
  public.sos_alert_dismiss(uuid, text),
  public.sos_my_alerts(),
  public.sos_workspace(uuid, integer, integer),
  public.sos_contact_save(uuid, uuid, text, text, integer, text),
  public.sos_contact_set_archived(uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sos_settings_update(uuid, boolean, boolean, boolean, text, text),
  public.sos_raise(uuid, uuid, text, text, uuid, text),
  public.sos_acknowledge(uuid, uuid, text),
  public.sos_add_update(uuid, uuid, text, text),
  public.sos_close(uuid, uuid, text, text, text),
  public.sos_cancel(uuid, uuid, text),
  public.sos_alert_dismiss(uuid, text),
  public.sos_my_alerts(),
  public.sos_workspace(uuid, integer, integer),
  public.sos_contact_save(uuid, uuid, text, text, integer, text),
  public.sos_contact_set_archived(uuid, uuid, boolean, text)
  TO authenticated;
