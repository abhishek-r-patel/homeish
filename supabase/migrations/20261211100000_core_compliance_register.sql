-- Add a factual compliance register, accepted-risk acknowledgement and cleanup controls.
CREATE TABLE public.compliance_acknowledgements (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  acknowledged_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  statement_version integer NOT NULL DEFAULT 1 CHECK (statement_version = 1),
  statement text NOT NULL CHECK (
    statement = 'These records are not legal advice or certification.'
  )
);

CREATE TABLE public.compliance_settings (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  reminders_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT
);

CREATE TABLE public.compliance_entries (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  authority text NOT NULL CHECK (char_length(btrim(authority)) BETWEEN 1 AND 120),
  recurrence text NOT NULL
    CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  due_date date NOT NULL,
  responsible_membership_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'done', 'not_applicable')),
  completed_on date,
  evidence_version_id uuid,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  reminder_30_sent_on date,
  reminder_7_sent_on date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  FOREIGN KEY (society_id, responsible_membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, evidence_version_id)
    REFERENCES public.document_versions (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CHECK (
    (status = 'pending' AND completed_on IS NULL)
    OR (status = 'done' AND completed_on IS NOT NULL)
    OR (status = 'not_applicable')
  )
);

CREATE TABLE public.compliance_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  FOREIGN KEY (society_id, entry_id)
    REFERENCES public.compliance_entries (society_id, id) ON DELETE CASCADE,
  UNIQUE (society_id, entry_id, revision)
);

CREATE TABLE public.data_cleanup_rules (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  record_kind text NOT NULL
    CHECK (record_kind IN ('compliance_entry', 'official_case')),
  enabled boolean NOT NULL DEFAULT false,
  older_than_years integer NOT NULL DEFAULT 10
    CHECK (older_than_years BETWEEN 1 AND 20),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, record_kind)
);

CREATE INDEX compliance_entries_society_due_idx
  ON public.compliance_entries (society_id, due_date, status);
CREATE INDEX compliance_entries_responsible_idx
  ON public.compliance_entries (responsible_membership_id);
CREATE INDEX compliance_revisions_entry_idx
  ON public.compliance_revisions (society_id, entry_id, revision);

ALTER TABLE public.compliance_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_cleanup_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_acknowledgements,
  public.compliance_settings, public.compliance_entries,
  public.compliance_revisions, public.data_cleanup_rules
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY compliance_acknowledgements_no_direct_access
  ON public.compliance_acknowledgements
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY compliance_settings_no_direct_access
  ON public.compliance_settings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY compliance_entries_no_direct_access
  ON public.compliance_entries
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY compliance_revisions_no_direct_access
  ON public.compliance_revisions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY data_cleanup_rules_no_direct_access
  ON public.data_cleanup_rules
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.compliance_authorize(
  p_society_id uuid, p_write boolean
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'core')
    OR NOT private.has_role(
      p_society_id,
      CASE WHEN p_write THEN ARRAY['admin']::text[]
        ELSE ARRAY['admin', 'committee']::text[] END
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Compliance register access is not available.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.compliance_authorize(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.compliance_next_due(p_due date, p_recurrence text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_recurrence
    WHEN 'monthly' THEN (p_due + interval '1 month')::date
    WHEN 'quarterly' THEN (p_due + interval '3 months')::date
    WHEN 'half_yearly' THEN (p_due + interval '6 months')::date
    WHEN 'yearly' THEN (p_due + interval '1 year')::date
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.compliance_next_due(date, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.compliance_acknowledge(
  p_society_id uuid, p_request_id text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acknowledged_at timestamptz;
BEGIN
  PERFORM private.compliance_authorize(p_society_id, true);
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request trace is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT row.acknowledged_at INTO acknowledged_at
  FROM public.compliance_acknowledgements row
  WHERE row.society_id = p_society_id;
  IF acknowledged_at IS NOT NULL THEN RETURN acknowledged_at; END IF;
  INSERT INTO public.compliance_acknowledgements (
    society_id, acknowledged_by, statement
  ) VALUES (
    p_society_id, auth.uid(),
    'These records are not legal advice or certification.'
  ) RETURNING compliance_acknowledgements.acknowledged_at
    INTO acknowledged_at;
  INSERT INTO public.compliance_settings (
    society_id, updated_by
  ) VALUES (p_society_id, auth.uid())
  ON CONFLICT (society_id) DO NOTHING;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'compliance.acknowledge',
    'compliance_acknowledgement', p_society_id::text,
    jsonb_build_object('statement_version', 1), p_request_id
  );
  RETURN acknowledged_at;
END;
$$;

CREATE FUNCTION public.compliance_entry_save(
  p_society_id uuid,
  p_id uuid,
  p_title text,
  p_authority text,
  p_recurrence text,
  p_due_date date,
  p_responsible_membership_id uuid,
  p_status text,
  p_completed_on date,
  p_evidence_version_id uuid,
  p_note text,
  p_expected_version integer,
  p_reason text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.compliance_entries;
  saved_id uuid;
  next_version integer;
BEGIN
  PERFORM private.compliance_authorize(p_society_id, true);
  IF NOT EXISTS (
    SELECT 1 FROM public.compliance_acknowledgements
    WHERE society_id = p_society_id
  ) THEN
    RAISE EXCEPTION 'Acknowledge the compliance register warning first.'
      USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120
    OR p_authority IS NULL OR char_length(btrim(p_authority)) NOT BETWEEN 1 AND 120
    OR p_recurrence IS NULL OR p_recurrence NOT IN (
      'none', 'monthly', 'quarterly', 'half_yearly', 'yearly'
    )
    OR p_due_date IS NULL
    OR p_status IS NULL OR p_status NOT IN ('pending', 'done', 'not_applicable')
    OR (p_status = 'done' AND p_completed_on IS NULL)
    OR p_note IS NULL OR char_length(p_note) > 2000
    OR p_client_request_id IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter valid compliance record details.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.society_id = p_society_id
      AND membership.id = p_responsible_membership_id
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose an active responsible member.' USING ERRCODE = '23514';
  END IF;
  IF p_evidence_version_id IS NOT NULL AND (
    NOT private.module_enabled(p_society_id, 'document')
    OR NOT private.document_user_can_see_version(
      p_society_id, auth.uid(), p_evidence_version_id
    )
  ) THEN
    RAISE EXCEPTION 'Choose an evidence file you can already view.'
      USING ERRCODE = '23514';
  END IF;
  SELECT id INTO saved_id
  FROM public.compliance_entries
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF saved_id IS NOT NULL THEN RETURN saved_id; END IF;

  IF p_id IS NULL THEN
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid compliance version.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.compliance_entries (
      society_id, title, authority, recurrence, due_date,
      responsible_membership_id, status, completed_on,
      evidence_version_id, note, created_by, updated_by, client_request_id
    ) VALUES (
      p_society_id, btrim(p_title), btrim(p_authority), p_recurrence, p_due_date,
      p_responsible_membership_id, p_status, p_completed_on,
      p_evidence_version_id, p_note, auth.uid(), auth.uid(), p_client_request_id
    ) RETURNING id INTO saved_id;
  ELSE
    IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'A reason is required to change a compliance record.'
        USING ERRCODE = '22023';
    END IF;
    SELECT * INTO previous
    FROM public.compliance_entries
    WHERE society_id = p_society_id AND id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Compliance record not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'Compliance record changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    next_version := previous.version + 1;
    UPDATE public.compliance_entries
    SET title = btrim(p_title),
      authority = btrim(p_authority),
      recurrence = p_recurrence,
      due_date = p_due_date,
      responsible_membership_id = p_responsible_membership_id,
      status = p_status,
      completed_on = p_completed_on,
      evidence_version_id = p_evidence_version_id,
      note = p_note,
      version = next_version,
      reminder_30_sent_on = CASE WHEN due_date IS DISTINCT FROM p_due_date
        THEN NULL ELSE reminder_30_sent_on END,
      reminder_7_sent_on = CASE WHEN due_date IS DISTINCT FROM p_due_date
        THEN NULL ELSE reminder_7_sent_on END,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_id;
    INSERT INTO public.compliance_revisions (
      society_id, entry_id, revision, before, after, reason, created_by, request_id
    ) VALUES (
      p_society_id, p_id, next_version, to_jsonb(previous),
      (
        SELECT to_jsonb(entry)
        FROM public.compliance_entries entry
        WHERE entry.society_id = p_society_id AND entry.id = p_id
      ),
      btrim(p_reason), auth.uid(), p_request_id
    );
    saved_id := p_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_id IS NULL THEN 'compliance.create' ELSE 'compliance.update' END,
    'compliance_entry', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL ELSE to_jsonb(previous) END,
    jsonb_build_object(
      'title', btrim(p_title), 'status', p_status, 'recurrence', p_recurrence,
      'has_evidence', p_evidence_version_id IS NOT NULL
    ),
    p_request_id
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.compliance_workspace(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  today date;
BEGIN
  PERFORM private.compliance_authorize(p_society_id, false);
  today := private.housekeeping_local_date(p_society_id);
  RETURN jsonb_build_object(
    'warning',
      'These records are not legal advice or certification.',
    'acknowledged_at', (
      SELECT acknowledged_at
      FROM public.compliance_acknowledgements
      WHERE society_id = p_society_id
    ),
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'reminders_enabled', coalesce((
      SELECT settings.reminders_enabled
      FROM public.compliance_settings settings
      WHERE settings.society_id = p_society_id
    ), false),
    'responsible_choices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'membership_id', membership.id,
        'name', profile.full_name,
        'roles', membership.roles
      ) ORDER BY lower(profile.full_name), membership.id)
      FROM public.memberships membership
      JOIN public.profiles profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND profile.status = 'active'
    ), '[]'::jsonb),
    'evidence_choices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'version_id', version.id,
        'document_title', document.title,
        'file_name', version.file_name
      ) ORDER BY lower(document.title), version.version_number DESC)
      FROM public.document_versions version
      JOIN public.documents document
        ON document.society_id = version.society_id
        AND document.id = version.document_id
      WHERE version.society_id = p_society_id
        AND version.archived_at IS NULL
        AND private.document_user_can_see_version(
          p_society_id, auth.uid(), version.id
        )
        AND version.id = private.document_current_version_id(
          p_society_id, version.document_id
        )
    ), '[]'::jsonb),
    'entries', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', entry.id,
        'title', entry.title,
        'authority', entry.authority,
        'recurrence', entry.recurrence,
        'due_date', entry.due_date,
        'next_due_date', CASE WHEN entry.status <> 'pending'
          THEN private.compliance_next_due(entry.due_date, entry.recurrence)
          ELSE entry.due_date END,
        'responsible_membership_id', entry.responsible_membership_id,
        'responsible_name', profile.full_name,
        'status', entry.status,
        'completed_on', entry.completed_on,
        'evidence_version_id', entry.evidence_version_id,
        'evidence_name', coalesce(document.title, version.file_name),
        'note', entry.note,
        'version', entry.version,
        'updated_at', entry.updated_at,
        'due_state', CASE
          WHEN entry.status = 'done' THEN 'done'
          WHEN entry.status = 'not_applicable' THEN 'not_applicable'
          WHEN entry.due_date < today THEN 'overdue'
          WHEN entry.due_date = today THEN 'due_today'
          ELSE 'upcoming'
        END
      ) ORDER BY entry.status = 'pending' DESC, entry.due_date, lower(entry.title))
      FROM public.compliance_entries entry
      JOIN public.memberships membership
        ON membership.society_id = entry.society_id
        AND membership.id = entry.responsible_membership_id
      JOIN public.profiles profile ON profile.id = membership.user_id
      LEFT JOIN public.document_versions version
        ON version.society_id = entry.society_id
        AND version.id = entry.evidence_version_id
      LEFT JOIN public.documents document
        ON document.society_id = version.society_id
        AND document.id = version.document_id
      WHERE entry.society_id = p_society_id
        AND (
          entry.evidence_version_id IS NULL
          OR NOT private.module_enabled(p_society_id, 'document')
          OR private.document_user_can_see_version(
            p_society_id, auth.uid(), entry.evidence_version_id
          )
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.compliance_reminders_save(
  p_society_id uuid, p_enabled boolean, p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.compliance_authorize(p_society_id, true);
  IF p_enabled IS NULL OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid reminder setting.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.compliance_settings (
    society_id, reminders_enabled, updated_by
  ) VALUES (p_society_id, p_enabled, auth.uid())
  ON CONFLICT (society_id) DO UPDATE
    SET reminders_enabled = excluded.reminders_enabled,
      updated_by = auth.uid(),
      updated_at = clock_timestamp();
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'compliance.reminders.update',
    'compliance_settings', p_society_id::text,
    jsonb_build_object('enabled', p_enabled), p_request_id
  );
END;
$$;

CREATE FUNCTION public.compliance_reminders_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.compliance_entries;
  recipient_user_id uuid;
  sent integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.compliance_settings
    WHERE society_id = p_society_id AND reminders_enabled
  ) THEN
    RETURN jsonb_build_object('sent', 0);
  END IF;
  FOR entry IN
    SELECT * FROM public.compliance_entries
    WHERE society_id = p_society_id
      AND status = 'pending'
      AND (
        (due_date = p_today + 30 AND reminder_30_sent_on IS NULL)
        OR (due_date = p_today + 7 AND reminder_7_sent_on IS NULL)
      )
    ORDER BY due_date, id
    FOR UPDATE
  LOOP
    FOR recipient_user_id IN
      SELECT DISTINCT member.user_id
      FROM public.memberships member
      WHERE member.society_id = p_society_id
        AND member.status = 'active'
        AND member.user_id IS NOT NULL
        AND 'admin' = ANY(member.roles)
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient_user_id, 'compliance_due',
        'Compliance obligation reminder',
        left(entry.title || ' is due on ' || entry.due_date::text, 300),
        'compliance_entry', entry.id, p_request_id
      );
    END LOOP;
    UPDATE public.compliance_entries
    SET reminder_30_sent_on = CASE
          WHEN entry.due_date = p_today + 30 THEN p_today
          ELSE reminder_30_sent_on END,
        reminder_7_sent_on = CASE
          WHEN entry.due_date = p_today + 7 THEN p_today
          ELSE reminder_7_sent_on END
    WHERE society_id = p_society_id AND id = entry.id;
    sent := sent + 1;
  END LOOP;
  RETURN jsonb_build_object('sent', sent);
END;
$$;

CREATE FUNCTION public.data_cleanup_rules_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.compliance_authorize(p_society_id, false);
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'record_kind', rule.record_kind,
      'enabled', rule.enabled,
      'older_than_years', rule.older_than_years,
      'version', rule.version
    ) ORDER BY rule.record_kind)
    FROM public.data_cleanup_rules rule
    WHERE rule.society_id = p_society_id
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.data_cleanup_rule_save(
  p_society_id uuid,
  p_record_kind text,
  p_enabled boolean,
  p_older_than_years integer,
  p_expected_version integer,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.data_cleanup_rules;
  result public.data_cleanup_rules;
BEGIN
  PERFORM private.compliance_authorize(p_society_id, true);
  IF p_record_kind IS NULL
    OR p_record_kind NOT IN ('compliance_entry', 'official_case')
    OR p_enabled IS NULL
    OR p_older_than_years IS NULL
    OR p_older_than_years NOT BETWEEN 1 AND 20
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a valid data cleanup rule.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous
  FROM public.data_cleanup_rules
  WHERE society_id = p_society_id AND record_kind = p_record_kind FOR UPDATE;
  IF FOUND THEN
    IF previous.version IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'The cleanup rule changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.data_cleanup_rules
    SET enabled = p_enabled,
      older_than_years = p_older_than_years,
      version = version + 1,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
    WHERE society_id = p_society_id AND record_kind = p_record_kind
    RETURNING * INTO result;
  ELSE
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid cleanup version.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.data_cleanup_rules (
      society_id, record_kind, enabled, older_than_years, updated_by
    ) VALUES (
      p_society_id, p_record_kind, p_enabled, p_older_than_years, auth.uid()
    ) RETURNING * INTO result;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'data_cleanup.rule.save',
    'data_cleanup_rule', p_record_kind, to_jsonb(previous), to_jsonb(result),
    p_request_id
  );
  RETURN jsonb_build_object(
    'record_kind', result.record_kind,
    'enabled', result.enabled,
    'older_than_years', result.older_than_years,
    'version', result.version
  );
END;
$$;

CREATE FUNCTION public.compliance_data_cleanup_run(
  p_society_id uuid, p_today date, p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rule public.data_cleanup_rules;
  deleted_count integer;
BEGIN
  SELECT * INTO rule
  FROM public.data_cleanup_rules
  WHERE society_id = p_society_id
    AND record_kind = 'compliance_entry'
    AND enabled;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('compliance_entries_deleted', 0);
  END IF;
  WITH selected AS (
    SELECT entry.id
    FROM public.compliance_entries entry
    WHERE entry.society_id = p_society_id
      AND entry.status IN ('done', 'not_applicable')
      AND coalesce(entry.completed_on, entry.updated_at::date)
        <= (p_today - make_interval(years => rule.older_than_years))::date
  ),
  removed AS (
    DELETE FROM public.compliance_entries entry
    USING selected
    WHERE entry.society_id = p_society_id AND entry.id = selected.id
    RETURNING entry.id
  )
  SELECT count(*)::integer INTO deleted_count FROM removed;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, NULL, 'system', 'data_cleanup.run',
    'compliance_entry', p_society_id::text,
    jsonb_build_object('deleted', deleted_count, 'older_than_years', rule.older_than_years),
    p_request_id
  );
  RETURN jsonb_build_object('compliance_entries_deleted', deleted_count);
END;
$$;

REVOKE ALL ON FUNCTION public.compliance_acknowledge(uuid, text),
  public.compliance_entry_save(
    uuid, uuid, text, text, text, date, uuid, text, date, uuid, text,
    integer, text, uuid, text
  ),
  public.compliance_workspace(uuid),
  public.compliance_reminders_save(uuid, boolean, text),
  public.compliance_reminders_run(uuid, date, text),
  public.data_cleanup_rules_get(uuid),
  public.data_cleanup_rule_save(uuid, text, boolean, integer, integer, text),
  public.compliance_data_cleanup_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compliance_acknowledge(uuid, text),
  public.compliance_entry_save(
    uuid, uuid, text, text, text, date, uuid, text, date, uuid, text,
    integer, text, uuid, text
  ),
  public.compliance_workspace(uuid),
  public.compliance_reminders_save(uuid, boolean, text),
  public.data_cleanup_rules_get(uuid),
  public.data_cleanup_rule_save(uuid, text, boolean, integer, integer, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.compliance_reminders_run(uuid, date, text),
  public.compliance_data_cleanup_run(uuid, date, text)
  TO service_role;
