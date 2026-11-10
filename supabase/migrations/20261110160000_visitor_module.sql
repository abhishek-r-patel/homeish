CREATE TABLE public.visitor_pre_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  visitor_name text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  vehicle_no text,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  used_at timestamptz,
  CONSTRAINT visitor_pre_approvals_name_check
    CHECK (char_length(btrim(visitor_name)) BETWEEN 1 AND 120),
  CONSTRAINT visitor_pre_approvals_validity_check
    CHECK (valid_to > valid_from),
  CONSTRAINT visitor_pre_approvals_vehicle_check
    CHECK (vehicle_no IS NULL OR char_length(vehicle_no) <= 20),
  CONSTRAINT visitor_pre_approvals_code_check
    CHECK (code ~ '^[0-9]{6}$'),
  CONSTRAINT visitor_pre_approvals_status_check
    CHECK (status IN ('active', 'used', 'cancelled')),
  CONSTRAINT visitor_pre_approvals_used_at_check
    CHECK ((status = 'used') = (used_at IS NOT NULL)),
  CONSTRAINT visitor_pre_approvals_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT visitor_pre_approvals_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX visitor_pre_approvals_active_code_key
  ON public.visitor_pre_approvals (society_id, code)
  WHERE status = 'active';
CREATE INDEX visitor_pre_approvals_unit_created_idx
  ON public.visitor_pre_approvals (society_id, unit_id, created_at DESC);
CREATE INDEX visitor_pre_approvals_active_validity_idx
  ON public.visitor_pre_approvals (society_id, valid_to)
  WHERE status = 'active';
CREATE INDEX visitor_pre_approvals_created_by_idx
  ON public.visitor_pre_approvals (created_by);
CREATE INDEX visitor_pre_approvals_updated_by_idx
  ON public.visitor_pre_approvals (updated_by);

CREATE TABLE public.visitor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  visitor_name text NOT NULL,
  visitor_phone text,
  purpose text NOT NULL,
  vehicle_no text,
  people_count integer NOT NULL DEFAULT 1,
  photo_path text,
  source text NOT NULL DEFAULT 'walk_in',
  pre_approval_id uuid,
  client_request_id uuid,
  status text NOT NULL DEFAULT 'pending',
  respond_by timestamptz,
  decision_source text,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decided_at timestamptz,
  override_reason text,
  handled_by_guard_id uuid NOT NULL,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checked_out_by_guard_id uuid,
  CONSTRAINT visitor_entries_name_check
    CHECK (char_length(btrim(visitor_name)) BETWEEN 1 AND 120),
  CONSTRAINT visitor_entries_phone_check
    CHECK (visitor_phone IS NULL OR char_length(visitor_phone) BETWEEN 7 AND 20),
  CONSTRAINT visitor_entries_purpose_check
    CHECK (purpose IN ('guest', 'cab', 'service', 'official', 'other')),
  CONSTRAINT visitor_entries_vehicle_check
    CHECK (vehicle_no IS NULL OR char_length(vehicle_no) <= 20),
  CONSTRAINT visitor_entries_people_count_check
    CHECK (people_count BETWEEN 1 AND 50),
  CONSTRAINT visitor_entries_source_check
    CHECK (source IN ('walk_in', 'pre_approved')),
  CONSTRAINT visitor_entries_status_check
    CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'checked_in', 'checked_out')),
  CONSTRAINT visitor_entries_decision_source_check
    CHECK (decision_source IS NULL OR decision_source IN ('resident', 'guard_override', 'pre_approved')),
  CONSTRAINT visitor_entries_override_reason_check
    CHECK (
      (decision_source = 'guard_override' AND char_length(btrim(override_reason)) BETWEEN 1 AND 500)
      OR (decision_source IS DISTINCT FROM 'guard_override' AND override_reason IS NULL)
    ),
  CONSTRAINT visitor_entries_decided_at_check
    CHECK (status NOT IN ('approved', 'denied') OR decided_at IS NOT NULL),
  CONSTRAINT visitor_entries_check_in_check
    CHECK (status NOT IN ('checked_in', 'checked_out') OR checked_in_at IS NOT NULL),
  CONSTRAINT visitor_entries_check_out_check
    CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at),
  CONSTRAINT visitor_entries_pre_approval_check
    CHECK ((source = 'pre_approved') = (pre_approval_id IS NOT NULL)),
  CONSTRAINT visitor_entries_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT visitor_entries_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT visitor_entries_pre_approval_same_society_fkey
    FOREIGN KEY (society_id, pre_approval_id)
    REFERENCES public.visitor_pre_approvals (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT visitor_entries_guard_same_society_fkey
    FOREIGN KEY (society_id, handled_by_guard_id)
    REFERENCES public.guard_roster (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT visitor_entries_checkout_guard_same_society_fkey
    FOREIGN KEY (society_id, checked_out_by_guard_id)
    REFERENCES public.guard_roster (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT visitor_entries_approval_key UNIQUE (pre_approval_id),
  CONSTRAINT visitor_entries_client_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE INDEX visitor_entries_society_status_created_idx
  ON public.visitor_entries (society_id, status, created_at DESC);
CREATE INDEX visitor_entries_society_unit_created_idx
  ON public.visitor_entries (society_id, unit_id, created_at DESC);
CREATE INDEX visitor_entries_society_created_idx
  ON public.visitor_entries (society_id, created_at DESC);
CREATE INDEX visitor_entries_society_inside_idx
  ON public.visitor_entries (society_id, checked_in_at)
  WHERE status = 'checked_in';
CREATE INDEX visitor_entries_society_phone_idx
  ON public.visitor_entries (society_id, visitor_phone)
  WHERE visitor_phone IS NOT NULL;
CREATE INDEX visitor_entries_pre_approval_fk_idx
  ON public.visitor_entries (society_id, pre_approval_id);
CREATE INDEX visitor_entries_guard_fk_idx
  ON public.visitor_entries (society_id, handled_by_guard_id);
CREATE INDEX visitor_entries_checkout_guard_fk_idx
  ON public.visitor_entries (society_id, checked_out_by_guard_id);
CREATE INDEX visitor_entries_decided_by_idx
  ON public.visitor_entries (decided_by)
  WHERE decided_by IS NOT NULL;
CREATE INDEX visitor_entries_created_by_idx ON public.visitor_entries (created_by);
CREATE INDEX visitor_entries_updated_by_idx ON public.visitor_entries (updated_by);

CREATE TABLE public.visitor_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  phone text NOT NULL,
  name text,
  reason text,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT visitor_blacklist_phone_check
    CHECK (phone ~ '^[+0-9][0-9]{6,19}$'),
  CONSTRAINT visitor_blacklist_name_check
    CHECK (name IS NULL OR char_length(name) <= 120),
  CONSTRAINT visitor_blacklist_reason_check
    CHECK (reason IS NULL OR char_length(reason) <= 500),
  CONSTRAINT visitor_blacklist_society_id_id_key UNIQUE (society_id, id)
);

CREATE UNIQUE INDEX visitor_blacklist_active_phone_key
  ON public.visitor_blacklist (society_id, phone)
  WHERE active;
CREATE INDEX visitor_blacklist_created_by_idx ON public.visitor_blacklist (created_by);
CREATE INDEX visitor_blacklist_updated_by_idx ON public.visitor_blacklist (updated_by);

CREATE TRIGGER visitor_pre_approvals_set_updated_at
  BEFORE UPDATE ON public.visitor_pre_approvals
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER visitor_entries_set_updated_at
  BEFORE UPDATE ON public.visitor_entries
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER visitor_blacklist_set_updated_at
  BEFORE UPDATE ON public.visitor_blacklist
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.visitor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_pre_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_blacklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visitor_entries, public.visitor_pre_approvals,
  public.visitor_blacklist FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (
  id, society_id, created_at, unit_id, visitor_name, purpose, vehicle_no,
  people_count, source, pre_approval_id, status, respond_by, decision_source,
  decided_at, handled_by_guard_id, checked_in_at, checked_out_at,
  checked_out_by_guard_id
) ON TABLE public.visitor_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_entries,
  public.visitor_pre_approvals, public.visitor_blacklist TO service_role;

CREATE POLICY visitor_entries_read
  ON public.visitor_entries FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'visitor')
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee', 'guard']::text[])
      OR private.occupies_unit(unit_id)
    )
  );
CREATE POLICY visitor_pre_approvals_read
  ON public.visitor_pre_approvals FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'visitor')
    AND (
      created_by = (SELECT auth.uid())
      OR private.has_role(society_id, ARRAY['admin', 'committee']::text[])
      OR private.occupies_unit(unit_id)
    )
  );
CREATE POLICY visitor_blacklist_read
  ON public.visitor_blacklist FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'visitor')
    AND private.has_role(society_id, ARRAY['admin', 'committee', 'guard']::text[])
  );

DROP POLICY homeish_files_read ON storage.objects;
CREATE POLICY homeish_files_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    CASE bucket_id
      WHEN 'visitor-photos' THEN
        private.module_enabled(private.file_society_id(name), 'visitor')
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
      WHEN 'delivery-photos' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
      WHEN 'request-files' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'payment-proofs' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'society-assets' THEN
        private.is_member(private.file_society_id(name))
        OR private.is_developer()
      ELSE false
    END
  );

DROP POLICY homeish_files_insert ON storage.objects;
CREATE POLICY homeish_files_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    CASE bucket_id
      WHEN 'visitor-photos' THEN
        private.module_enabled(private.file_society_id(name), 'visitor')
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
      WHEN 'delivery-photos' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
      WHEN 'request-files' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'payment-proofs' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'society-assets' THEN
        private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
        OR private.is_developer()
      ELSE false
    END
  );

CREATE OR REPLACE FUNCTION private.user_has_role(
  p_society_id uuid,
  p_roles text[],
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = p_user_id
      AND membership.status = 'active'
      AND membership.roles && p_roles
  )
$$;

REVOKE ALL ON FUNCTION private.user_has_role(uuid, text[], uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.user_has_role(uuid, text[], uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.visitor_create_entry(
  p_actor_id uuid,
  p_society_id uuid,
  p_unit_id uuid,
  p_guard_id uuid,
  p_visitor_name text,
  p_visitor_phone text,
  p_purpose text,
  p_people_count integer,
  p_vehicle_no text,
  p_photo_path text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS public.visitor_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := p_actor_id;
  timeout_minutes integer;
  photo_required boolean;
  phone_required boolean;
  entry public.visitor_entries;
  approver record;
BEGIN
  IF current_user_id IS NULL
     OR NOT private.user_has_role(p_society_id, ARRAY['guard', 'admin']::text[], current_user_id)
     OR NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Visitor entry access is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guard_roster guard_row
    WHERE guard_row.society_id = p_society_id
      AND guard_row.id = p_guard_id AND guard_row.active
      AND (
        guard_row.membership_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.id = guard_row.membership_id
            AND membership.user_id = current_user_id
            AND membership.status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'An identified active guard is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units unit_row
    WHERE unit_row.id = p_unit_id AND unit_row.society_id = p_society_id
      AND unit_row.active
  ) THEN
    RAISE EXCEPTION 'The unit was not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT
    COALESCE((settings->>'approval_timeout_minutes')::integer, 3),
    COALESCE((settings->>'photo_required')::boolean, false),
    COALESCE((settings->>'phone_required')::boolean, false)
  INTO timeout_minutes, photo_required, phone_required
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'visitor';
  timeout_minutes := COALESCE(timeout_minutes, 3);
  IF photo_required AND p_photo_path IS NULL THEN
    RAISE EXCEPTION 'A visitor photo is required.' USING ERRCODE = '22023';
  END IF;
  IF phone_required AND p_visitor_phone IS NULL THEN
    RAISE EXCEPTION 'A visitor phone number is required.' USING ERRCODE = '22023';
  END IF;
  IF p_photo_path IS NOT NULL AND p_photo_path !~ (
    '^' || p_society_id::text || '/' || p_unit_id::text ||
    '/visitors/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
    '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
  ) THEN
    RAISE EXCEPTION 'The visitor photo path is invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO entry
  FROM public.visitor_entries
  WHERE society_id = p_society_id
    AND created_by = current_user_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN entry; END IF;

  INSERT INTO public.visitor_entries (
    society_id, unit_id, visitor_name, visitor_phone, purpose, people_count,
    vehicle_no, photo_path, client_request_id, handled_by_guard_id,
    respond_by, created_by
  )
  VALUES (
    p_society_id, p_unit_id, p_visitor_name, p_visitor_phone, p_purpose,
    p_people_count, NULLIF(upper(regexp_replace(COALESCE(p_vehicle_no, ''), '\s', '', 'g')), ''),
    p_photo_path, p_client_request_id, p_guard_id,
    clock_timestamp() + make_interval(mins => timeout_minutes), current_user_id
  )
  RETURNING * INTO entry;

  FOR approver IN
    SELECT DISTINCT membership.user_id, profile.full_name
    FROM public.unit_occupants occupant
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    JOIN public.profiles profile ON profile.id = membership.user_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND occupant.is_approver
      AND membership.status = 'active'
  LOOP
    PERFORM private.create_notification(
      p_society_id, approver.user_id, 'visitor_pending',
      'Visitor at gate: ' || p_visitor_name,
      'A visitor is waiting at your gate.',
      'visitor_entry', entry.id, p_request_id
    );
  END LOOP;

  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_decide(
  p_entry_id uuid,
  p_approve boolean,
  p_request_id text
)
RETURNS public.visitor_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  entry public.visitor_entries;
BEGIN
  SELECT * INTO entry FROM public.visitor_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT private.module_enabled(entry.society_id, 'visitor')
     OR NOT private.society_writable(entry.society_id)
     OR NOT EXISTS (
       SELECT 1
       FROM public.unit_occupants occupant
       JOIN public.memberships membership
         ON membership.society_id = occupant.society_id
         AND membership.id = occupant.membership_id
       WHERE occupant.society_id = entry.society_id
         AND occupant.unit_id = entry.unit_id
         AND occupant.status = 'active' AND occupant.is_approver
         AND membership.user_id = current_user_id
         AND membership.status = 'active'
     ) THEN
    RAISE EXCEPTION 'The visitor entry was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF entry.status <> 'pending' OR entry.respond_by <= clock_timestamp() THEN
    RAISE EXCEPTION 'The visitor request has already closed.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.visitor_entries
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'denied' END,
      decision_source = 'resident',
      decided_by = current_user_id,
      decided_at = clock_timestamp()
  WHERE id = p_entry_id
  RETURNING * INTO entry;

  PERFORM private.create_notification(
    entry.society_id, entry.created_by, 'visitor_decided',
    CASE WHEN p_approve THEN 'Visitor approved' ELSE 'Visitor denied' END,
    'The resident has responded to the visitor request.',
    'visitor_entry', entry.id, p_request_id
  );
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_override(
  p_actor_id uuid,
  p_entry_id uuid,
  p_guard_id uuid,
  p_reason text,
  p_request_id text
)
RETURNS public.visitor_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.visitor_entries;
  override_allowed boolean;
BEGIN
  SELECT * INTO entry FROM public.visitor_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT private.user_has_role(
    entry.society_id, ARRAY['guard', 'admin']::text[], p_actor_id
  )
     OR NOT private.module_enabled(entry.society_id, 'visitor')
     OR NOT private.society_writable(entry.society_id) THEN
    RAISE EXCEPTION 'Visitor entry access is required.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'A reason is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guard_roster guard_row
    WHERE guard_row.id = p_guard_id
      AND guard_row.society_id = entry.society_id
      AND guard_row.active
      AND (
        guard_row.membership_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.memberships membership
          WHERE membership.id = guard_row.membership_id
            AND membership.user_id = p_actor_id
            AND membership.status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'An identified active guard is required.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((settings->>'guard_override_allowed')::boolean, false)
  INTO override_allowed
  FROM public.module_configs
  WHERE society_id = entry.society_id AND module_key = 'visitor';
  IF NOT COALESCE(override_allowed, false) THEN
    RAISE EXCEPTION 'Guard override is disabled.' USING ERRCODE = '42501';
  END IF;
  IF entry.status <> 'pending' OR entry.respond_by > clock_timestamp() THEN
    RAISE EXCEPTION 'The visitor request is not eligible for override.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.visitor_entries
  SET status = 'approved', decision_source = 'guard_override',
      override_reason = btrim(p_reason), decided_at = clock_timestamp()
  WHERE id = p_entry_id RETURNING * INTO entry;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    entry.society_id, p_actor_id,
    CASE WHEN private.user_has_role(entry.society_id, ARRAY['admin']::text[], p_actor_id)
      THEN 'admin' ELSE 'guard' END,
    'visitor.override', 'visitor',
    entry.id::text, pg_catalog.jsonb_build_object('reason', btrim(p_reason)),
    p_request_id
  );
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_check_in(
  p_actor_id uuid,
  p_entry_id uuid,
  p_guard_id uuid,
  p_request_id text
)
RETURNS public.visitor_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.visitor_entries;
BEGIN
  SELECT * INTO entry FROM public.visitor_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT private.user_has_role(
    entry.society_id, ARRAY['guard', 'admin']::text[], p_actor_id
  )
     OR NOT private.module_enabled(entry.society_id, 'visitor')
     OR NOT private.society_writable(entry.society_id) THEN
    RAISE EXCEPTION 'Visitor entry access is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guard_roster guard_row
    WHERE guard_row.id = p_guard_id AND guard_row.society_id = entry.society_id
      AND guard_row.active
      AND (guard_row.membership_id IS NULL OR EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE membership.id = guard_row.membership_id
          AND membership.user_id = p_actor_id AND membership.status = 'active'
      ))
  ) THEN
    RAISE EXCEPTION 'An identified active guard is required.' USING ERRCODE = '42501';
  END IF;
  IF entry.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved visitors can check in.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.visitor_entries
  SET status = 'checked_in', checked_in_at = clock_timestamp(),
      handled_by_guard_id = p_guard_id
  WHERE id = p_entry_id RETURNING * INTO entry;
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_check_out(
  p_actor_id uuid,
  p_entry_id uuid,
  p_guard_id uuid,
  p_request_id text
)
RETURNS public.visitor_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.visitor_entries;
BEGIN
  SELECT * INTO entry FROM public.visitor_entries
  WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT private.user_has_role(
    entry.society_id, ARRAY['guard', 'admin']::text[], p_actor_id
  )
     OR NOT private.module_enabled(entry.society_id, 'visitor')
     OR NOT private.society_writable(entry.society_id) THEN
    RAISE EXCEPTION 'Visitor entry access is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guard_roster guard_row
    WHERE guard_row.id = p_guard_id AND guard_row.society_id = entry.society_id
      AND guard_row.active
      AND (guard_row.membership_id IS NULL OR EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE membership.id = guard_row.membership_id
          AND membership.user_id = p_actor_id AND membership.status = 'active'
      ))
  ) THEN
    RAISE EXCEPTION 'An identified active guard is required.' USING ERRCODE = '42501';
  END IF;
  IF entry.status <> 'checked_in' THEN
    RAISE EXCEPTION 'Only visitors inside can check out.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.visitor_entries
  SET status = 'checked_out', checked_out_at = clock_timestamp(),
      checked_out_by_guard_id = p_guard_id
  WHERE id = p_entry_id RETURNING * INTO entry;
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_pre_approval_create(
  p_unit_id uuid,
  p_visitor_name text,
  p_valid_from timestamptz,
  p_valid_to timestamptz,
  p_vehicle_no text,
  p_request_id text
)
RETURNS public.visitor_pre_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  society uuid;
  approval public.visitor_pre_approvals;
  generated_code text;
  attempt integer := 0;
BEGIN
  SELECT unit.society_id INTO society
  FROM public.units unit
  WHERE unit.id = p_unit_id AND private.occupies_unit(unit.id)
    AND unit.active
    AND private.module_enabled(unit.society_id, 'visitor')
    AND private.society_writable(unit.society_id);
  IF society IS NULL THEN
    RAISE EXCEPTION 'Household manager access is required.' USING ERRCODE = '42501';
  END IF;
  LOOP
    attempt := attempt + 1;
    generated_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    BEGIN
      INSERT INTO public.visitor_pre_approvals (
        society_id, unit_id, visitor_name, valid_from, valid_to,
        vehicle_no, code, created_by
      )
      VALUES (
        society, p_unit_id, p_visitor_name, p_valid_from, p_valid_to,
        NULLIF(upper(regexp_replace(COALESCE(p_vehicle_no, ''), '\s', '', 'g')), ''),
        generated_code, auth.uid()
      )
      RETURNING * INTO approval;
      RETURN approval;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 20 THEN
        RAISE EXCEPTION 'Could not allocate a unique visitor code.' USING ERRCODE = '23505';
      END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_pre_approval_validate(
  p_actor_id uuid,
  p_society_id uuid,
  p_code text,
  p_request_id text
)
RETURNS TABLE (
  reason text,
  visitor_name text,
  unit_id uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  vehicle_no text,
  approval_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approval public.visitor_pre_approvals;
BEGIN
  IF NOT private.user_has_role(
    p_society_id, ARRAY['guard']::text[], p_actor_id
  )
     OR NOT private.module_enabled(p_society_id, 'visitor') THEN
    RAISE EXCEPTION 'Visitor gate access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO approval
  FROM public.visitor_pre_approvals item
  WHERE item.society_id = p_society_id AND item.code = p_code
  ORDER BY item.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::uuid,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::uuid;
    RETURN;
  END IF;
  IF approval.status = 'used' THEN
    RETURN QUERY SELECT 'already_used'::text, NULL::text, NULL::uuid,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::uuid;
    RETURN;
  END IF;
  IF approval.status <> 'active' OR approval.valid_to <= clock_timestamp()
     OR approval.valid_from > clock_timestamp() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::uuid,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::uuid;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'valid'::text, approval.visitor_name, approval.unit_id,
    approval.valid_from, approval.valid_to, approval.vehicle_no, approval.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_pre_approval_check_in(
  p_actor_id uuid,
  p_society_id uuid,
  p_code text,
  p_guard_id uuid,
  p_request_id text
)
RETURNS public.visitor_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approval public.visitor_pre_approvals;
  entry public.visitor_entries;
BEGIN
  IF NOT private.user_has_role(
    p_society_id, ARRAY['guard']::text[], p_actor_id
  )
     OR NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Visitor gate access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO approval FROM public.visitor_pre_approvals
  WHERE society_id = p_society_id AND code = p_code
  FOR UPDATE;
  IF NOT FOUND OR approval.status <> 'active'
     OR approval.valid_from > clock_timestamp()
     OR approval.valid_to <= clock_timestamp() THEN
    RAISE EXCEPTION 'The pre-approval is invalid, expired or used.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guard_roster guard_row
    WHERE guard_row.id = p_guard_id AND guard_row.society_id = p_society_id
      AND guard_row.active
      AND (guard_row.membership_id IS NULL OR EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE membership.id = guard_row.membership_id
          AND membership.user_id = p_actor_id AND membership.status = 'active'
      ))
  ) THEN
    RAISE EXCEPTION 'An identified active guard is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.visitor_pre_approvals SET status = 'used', used_at = clock_timestamp()
  WHERE id = approval.id;
  INSERT INTO public.visitor_entries (
    society_id, unit_id, visitor_name, purpose, vehicle_no, source,
    pre_approval_id, status, decision_source, decided_at, handled_by_guard_id,
    checked_in_at, created_by
  )
  VALUES (
    p_society_id, approval.unit_id, approval.visitor_name, 'guest',
    approval.vehicle_no, 'pre_approved', approval.id, 'checked_in',
    'pre_approved',     clock_timestamp(), p_guard_id, clock_timestamp(), p_actor_id
  )
  RETURNING * INTO entry;
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_pre_approval_cancel(
  p_approval_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.visitor_pre_approvals;
BEGIN
  SELECT * INTO target FROM public.visitor_pre_approvals
  WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND OR NOT private.module_enabled(target.society_id, 'visitor')
     OR NOT (
       target.created_by = auth.uid()
       OR private.occupies_unit(target.unit_id)
       OR private.has_role(
         target.society_id, ARRAY['admin', 'committee']::text[]
       )
     ) THEN
    RAISE EXCEPTION 'Pre-approval access is required.' USING ERRCODE = '42501';
  END IF;
  IF target.status <> 'active' THEN
    RAISE EXCEPTION 'Only active pre-approvals can be cancelled.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.visitor_pre_approvals SET status = 'cancelled'
  WHERE id = p_approval_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_list_entries(
  p_society_id uuid,
  p_unit_id uuid,
  p_scope text
)
RETURNS TABLE (
  id uuid,
  unit_id uuid,
  visitor_name text,
  visitor_phone text,
  purpose text,
  vehicle_no text,
  people_count integer,
  source text,
  status text,
  created_at timestamptz,
  respond_by timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  handled_by_guard_id uuid,
  is_blacklisted boolean,
  is_overstay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resident_view boolean;
  phone_visible boolean;
  overstay_hours integer;
  society_timezone text;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'visitor') THEN
    RAISE EXCEPTION 'Visitor module is disabled.' USING ERRCODE = '42501';
  END IF;
  resident_view :=
    private.has_role(p_society_id, ARRAY['resident']::text[])
    AND NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'guard']::text[]
    );
  IF resident_view THEN
    IF p_unit_id IS NULL OR NOT private.occupies_unit(p_unit_id) THEN
      RAISE EXCEPTION 'The visitor unit was not found.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT private.has_role(
    p_society_id, ARRAY['admin', 'committee', 'guard']::text[]
  ) THEN
    RAISE EXCEPTION 'Visitor list access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_scope NOT IN ('all', 'waiting', 'inside', 'today') THEN
    RAISE EXCEPTION 'The visitor list filter is invalid.' USING ERRCODE = '22023';
  END IF;
  IF private.society_writable(p_society_id) THEN
    IF NOT resident_view THEN
      UPDATE public.visitor_entries entry
      SET status = 'expired'
      WHERE entry.society_id = p_society_id
        AND entry.status = 'pending'
        AND entry.respond_by <= clock_timestamp();
    ELSE
      UPDATE public.visitor_entries entry
      SET status = 'expired'
      WHERE entry.society_id = p_society_id
        AND entry.unit_id = p_unit_id
        AND entry.status = 'pending'
        AND entry.respond_by <= clock_timestamp();
    END IF;
  END IF;
  phone_visible := private.has_role(p_society_id, ARRAY['admin']::text[]);
  SELECT
    COALESCE((module_config.settings->>'overstay_hours')::integer, 12),
    society.timezone
  INTO overstay_hours, society_timezone
  FROM public.module_configs module_config
  JOIN public.societies society ON society.id = module_config.society_id
  WHERE module_config.society_id = p_society_id
    AND module_config.module_key = 'visitor';
  overstay_hours := COALESCE(overstay_hours, 12);
  society_timezone := COALESCE(society_timezone, 'Asia/Kolkata');
  RETURN QUERY
  SELECT entry.id, entry.unit_id, entry.visitor_name,
    CASE
      WHEN phone_visible OR resident_view THEN entry.visitor_phone
      WHEN entry.visitor_phone IS NULL THEN NULL
      ELSE '••••' || right(entry.visitor_phone, 4)
    END,
    entry.purpose, entry.vehicle_no, entry.people_count, entry.source,
    entry.status, entry.created_at, entry.respond_by, entry.checked_in_at,
    entry.checked_out_at, entry.handled_by_guard_id,
    EXISTS (
      SELECT 1 FROM public.visitor_blacklist blacklist
      WHERE blacklist.society_id = entry.society_id
        AND blacklist.phone = entry.visitor_phone
        AND blacklist.active
    ) AND private.has_role(
    p_society_id, ARRAY['admin', 'guard']::text[]
    ),
    entry.status = 'checked_in'
      AND entry.checked_in_at <= clock_timestamp()
        - make_interval(hours => overstay_hours)
  FROM public.visitor_entries entry
  WHERE entry.society_id = p_society_id
    AND (NOT resident_view OR entry.unit_id = p_unit_id)
    AND (
      p_scope = 'all'
      OR (p_scope = 'waiting' AND entry.status = 'pending')
      OR (p_scope = 'inside' AND entry.status = 'checked_in')
      OR (
        p_scope = 'today'
        AND entry.created_at >= (
          date_trunc('day', clock_timestamp() AT TIME ZONE society_timezone)
          AT TIME ZONE society_timezone
        )
      )
    )
  ORDER BY entry.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_list_pre_approvals(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS SETOF public.visitor_pre_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT (
       private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
       OR (p_unit_id IS NOT NULL AND private.occupies_unit(p_unit_id))
     ) THEN
    RAISE EXCEPTION 'Pre-approval access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT approval.*
  FROM public.visitor_pre_approvals approval
  WHERE approval.society_id = p_society_id
    AND (p_unit_id IS NULL OR approval.unit_id = p_unit_id)
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR approval.created_by = auth.uid()
      OR private.occupies_unit(approval.unit_id)
    )
  ORDER BY approval.created_at DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_list_blacklist(p_society_id uuid)
RETURNS TABLE (id uuid, phone text, name text, reason text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  phone_visible boolean;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin', 'committee', 'guard']::text[])
     OR NOT private.module_enabled(p_society_id, 'visitor') THEN
    RAISE EXCEPTION 'Blacklist access is required.' USING ERRCODE = '42501';
  END IF;
  phone_visible := private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN QUERY
  SELECT item.id,
    CASE
      WHEN phone_visible THEN item.phone
      ELSE '••••' || right(item.phone, 4)
    END,
    item.name, item.reason, item.active
  FROM public.visitor_blacklist item
  WHERE item.society_id = p_society_id
  ORDER BY item.active DESC, item.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_blacklist_match(
  p_society_id uuid,
  p_phone text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.has_role(p_society_id, ARRAY['admin', 'guard']::text[])
    AND private.module_enabled(p_society_id, 'visitor')
    AND EXISTS (
      SELECT 1 FROM public.visitor_blacklist item
      WHERE item.society_id = p_society_id AND item.phone = p_phone AND item.active
    )
$$;

CREATE OR REPLACE FUNCTION public.visitor_update_settings(
  p_society_id uuid,
  p_settings jsonb,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before_settings jsonb;
  after_settings jsonb;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'Visitor settings are invalid.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_settings) AS setting_key(value)
    WHERE value NOT IN (
      'approval_timeout_minutes', 'overstay_hours', 'photo_required',
      'guard_override_allowed', 'phone_required'
    )
  ) THEN
    RAISE EXCEPTION 'Visitor settings contain an unknown option.' USING ERRCODE = '22023';
  END IF;
  IF p_settings ? 'approval_timeout_minutes' THEN
    IF jsonb_typeof(p_settings->'approval_timeout_minutes') <> 'number'
       OR (p_settings->>'approval_timeout_minutes')::numeric <>
          trunc((p_settings->>'approval_timeout_minutes')::numeric)
       OR (p_settings->>'approval_timeout_minutes')::numeric NOT BETWEEN 1 AND 30 THEN
      RAISE EXCEPTION 'Visitor settings are invalid.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_settings ? 'overstay_hours' THEN
    IF jsonb_typeof(p_settings->'overstay_hours') <> 'number'
       OR (p_settings->>'overstay_hours')::numeric <>
          trunc((p_settings->>'overstay_hours')::numeric)
       OR (p_settings->>'overstay_hours')::numeric NOT BETWEEN 1 AND 72 THEN
      RAISE EXCEPTION 'Visitor settings are invalid.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF (p_settings ? 'photo_required'
      AND jsonb_typeof(p_settings->'photo_required') <> 'boolean')
     OR (p_settings ? 'guard_override_allowed'
      AND jsonb_typeof(p_settings->'guard_override_allowed') <> 'boolean')
     OR (p_settings ? 'phone_required'
      AND jsonb_typeof(p_settings->'phone_required') <> 'boolean') THEN
    RAISE EXCEPTION 'Visitor settings are invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT settings INTO before_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'visitor'
  FOR UPDATE;
  INSERT INTO public.module_configs (
    society_id, module_key, enabled, settings, updated_by
  )
  VALUES (
    p_society_id, 'visitor', false,
    jsonb_build_object(
      'approval_timeout_minutes', 3,
      'overstay_hours', 12,
      'photo_required', false,
      'guard_override_allowed', false,
      'phone_required', false
    ) || COALESCE(before_settings, '{}'::jsonb) || p_settings,
    auth.uid()
  )
  ON CONFLICT (society_id, module_key) DO UPDATE
  SET settings = EXCLUDED.settings, updated_by = auth.uid()
  RETURNING settings INTO after_settings;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'visitor.settings.update',
    'module_config', p_society_id::text,
    COALESCE(before_settings, '{}'::jsonb), after_settings, p_request_id
  );
  RETURN after_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_blacklist_add(
  p_society_id uuid,
  p_phone text,
  p_name text,
  p_reason text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.visitor_blacklist (
    society_id, phone, name, reason, created_by, updated_by
  )
  VALUES (p_society_id, p_phone, p_name, p_reason, auth.uid(), auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'visitor.blacklist.add',
    'visitor_blacklist', new_id::text, p_request_id
  );
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_blacklist_remove(
  p_society_id uuid,
  p_blacklist_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
     OR NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Society administrator access is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.visitor_blacklist SET active = false
  WHERE society_id = p_society_id AND id = p_blacklist_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The blacklist entry was not found.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'visitor.blacklist.remove',
    'visitor_blacklist', p_blacklist_id::text, p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_create_entry(
  uuid, uuid, uuid, uuid, text, text, text, integer, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitor_decide(uuid, boolean, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_override(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitor_check_in(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitor_check_out(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitor_pre_approval_create(
  uuid, text, timestamptz, timestamptz, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_pre_approval_validate(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitor_pre_approval_check_in(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitor_pre_approval_cancel(uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_list_entries(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_list_pre_approvals(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_list_blacklist(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_blacklist_match(uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_update_settings(uuid, jsonb, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_blacklist_add(uuid, text, text, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.visitor_blacklist_remove(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.visitor_create_entry(
  uuid, uuid, uuid, uuid, text, text, text, integer, text, text, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.visitor_decide(uuid, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_override(uuid, uuid, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visitor_check_in(uuid, uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visitor_check_out(uuid, uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visitor_pre_approval_create(
  uuid, text, timestamptz, timestamptz, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_pre_approval_validate(uuid, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visitor_pre_approval_check_in(uuid, uuid, text, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visitor_pre_approval_cancel(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_list_entries(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_list_pre_approvals(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_list_blacklist(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_blacklist_match(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_update_settings(uuid, jsonb, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_blacklist_add(uuid, text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_blacklist_remove(uuid, uuid, text)
  TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'visitor_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_entries;
  END IF;
END;
$$;
