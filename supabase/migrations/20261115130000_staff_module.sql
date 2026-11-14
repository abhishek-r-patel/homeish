-- P12 Staff Management: private resident, manager and gate workflows.
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  staff_code text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  staff_type text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  photo_path text,
  id_type text,
  id_last_four text,
  job_role text NOT NULL,
  police_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT staff_members_name_check
    CHECK (char_length(full_name) BETWEEN 1 AND 120 AND full_name = btrim(full_name)),
  CONSTRAINT staff_members_phone_check
    CHECK (phone ~ '^[+]?[0-9]{10,15}$'),
  CONSTRAINT staff_members_type_check
    CHECK (staff_type IN ('domestic', 'society')),
  CONSTRAINT staff_members_code_check
    CHECK (staff_code ~ '^[A-F0-9]{10}$'),
  CONSTRAINT staff_members_role_check
    CHECK (char_length(job_role) BETWEEN 1 AND 80 AND job_role = btrim(job_role)),
  CONSTRAINT staff_members_id_check
    CHECK (
      (id_type IS NULL AND id_last_four IS NULL)
      OR (
        id_type IS NOT NULL
        AND id_type IN ('aadhaar', 'pan', 'voter_id', 'passport', 'other')
        AND id_last_four IS NOT NULL
        AND id_last_four ~ '^[A-Za-z0-9]{4}$'
      )
    ),
  CONSTRAINT staff_members_status_check CHECK (status IN ('active', 'blocked')),
  CONSTRAINT staff_members_photo_path_check
    CHECK (
      photo_path IS NULL
      OR (
        char_length(photo_path) <= 500
        AND photo_path ~ (
          '^' || society_id::text || '/staff/[0-9a-f]{8}-[0-9a-f]{4}-' ||
          '[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        )
      )
    ),
  CONSTRAINT staff_members_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT staff_members_society_code_key UNIQUE (society_id, staff_code)
);

CREATE INDEX staff_members_society_type_name_idx
  ON public.staff_members (society_id, staff_type, lower(full_name));
CREATE INDEX staff_members_created_by_idx ON public.staff_members (created_by);
CREATE INDEX staff_members_updated_by_idx ON public.staff_members (updated_by);
CREATE UNIQUE INDEX staff_members_domestic_phone_key
  ON public.staff_members (society_id, phone) WHERE staff_type = 'domestic';
CREATE UNIQUE INDEX staff_members_photo_path_key
  ON public.staff_members (photo_path) WHERE photo_path IS NOT NULL;
CREATE TRIGGER staff_members_set_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.staff_unit_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id uuid,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_unit_links_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'inactive')),
  CONSTRAINT staff_unit_links_decision_check
    CHECK (
      (status = 'pending' AND decided_at IS NULL AND decided_by IS NULL)
      OR (
        status <> 'pending'
        AND decided_at IS NOT NULL
        AND decided_by IS NOT NULL
      )
    ),
  CONSTRAINT staff_unit_links_staff_same_society_fkey
    FOREIGN KEY (society_id, staff_id)
    REFERENCES public.staff_members (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_unit_links_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_unit_links_staff_unit_key UNIQUE (society_id, staff_id, unit_id),
  CONSTRAINT staff_unit_links_society_id_id_key UNIQUE (society_id, id)
);

CREATE INDEX staff_unit_links_unit_status_idx
  ON public.staff_unit_links (society_id, unit_id, status);
CREATE INDEX staff_unit_links_created_by_idx
  ON public.staff_unit_links (created_by);
CREATE UNIQUE INDEX staff_unit_links_request_key
  ON public.staff_unit_links (society_id, created_by, request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  checked_in_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  check_in_guard_id uuid NOT NULL,
  checked_out_at timestamptz,
  checked_out_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  check_out_guard_id uuid,
  CONSTRAINT staff_attendance_checkout_check
    CHECK (
      (checked_out_at IS NULL AND checked_out_by IS NULL AND check_out_guard_id IS NULL)
      OR (
        checked_out_at IS NOT NULL
        AND checked_out_by IS NOT NULL
        AND check_out_guard_id IS NOT NULL
        AND checked_out_at >= checked_in_at
      )
    ),
  CONSTRAINT staff_attendance_staff_same_society_fkey
    FOREIGN KEY (society_id, staff_id)
    REFERENCES public.staff_members (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_attendance_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_attendance_checkin_guard_same_society_fkey
    FOREIGN KEY (society_id, check_in_guard_id)
    REFERENCES public.guard_roster (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_attendance_checkout_guard_same_society_fkey
    FOREIGN KEY (society_id, check_out_guard_id)
    REFERENCES public.guard_roster (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_attendance_society_id_id_key UNIQUE (society_id, id)
);

CREATE UNIQUE INDEX staff_attendance_one_open_visit_key
  ON public.staff_attendance (society_id, staff_id)
  WHERE checked_out_at IS NULL;
CREATE INDEX staff_attendance_month_idx
  ON public.staff_attendance (society_id, staff_id, checked_in_at DESC);
CREATE INDEX staff_attendance_unit_open_idx
  ON public.staff_attendance (society_id, unit_id, checked_in_at DESC)
  WHERE checked_out_at IS NULL;

CREATE TABLE public.staff_day_blocks (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  block_date date NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_day_blocks_pkey
    PRIMARY KEY (society_id, staff_id, unit_id, block_date),
  CONSTRAINT staff_day_blocks_staff_same_society_fkey
    FOREIGN KEY (society_id, staff_id)
    REFERENCES public.staff_members (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_day_blocks_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.staff_shift_attendance (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL,
  marked_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_shift_attendance_status_check
    CHECK (status IN ('present', 'absent', 'leave')),
  CONSTRAINT staff_shift_attendance_staff_same_society_fkey
    FOREIGN KEY (society_id, staff_id)
    REFERENCES public.staff_members (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_shift_attendance_pkey
    PRIMARY KEY (society_id, staff_id, attendance_date)
);
CREATE INDEX staff_shift_attendance_date_idx
  ON public.staff_shift_attendance (society_id, attendance_date DESC);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_unit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_day_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shift_attendance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_members, public.staff_unit_links,
  public.staff_attendance, public.staff_day_blocks,
  public.staff_shift_attendance FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY staff_members_no_direct_access
  ON public.staff_members FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY staff_unit_links_no_direct_access
  ON public.staff_unit_links FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY staff_attendance_no_direct_access
  ON public.staff_attendance FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY staff_day_blocks_no_direct_access
  ON public.staff_day_blocks FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY staff_shift_attendance_no_direct_access
  ON public.staff_shift_attendance FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX staff_unit_links_decided_by_idx
  ON public.staff_unit_links (decided_by);
CREATE INDEX staff_attendance_checked_in_by_idx
  ON public.staff_attendance (checked_in_by);
CREATE INDEX staff_attendance_checked_out_by_idx
  ON public.staff_attendance (checked_out_by);
CREATE INDEX staff_attendance_unit_fk_idx
  ON public.staff_attendance (society_id, unit_id);
CREATE INDEX staff_attendance_checkin_guard_fk_idx
  ON public.staff_attendance (society_id, check_in_guard_id);
CREATE INDEX staff_attendance_checkout_guard_fk_idx
  ON public.staff_attendance (society_id, check_out_guard_id);
CREATE INDEX staff_day_blocks_created_by_idx
  ON public.staff_day_blocks (created_by);
CREATE INDEX staff_day_blocks_unit_date_idx
  ON public.staff_day_blocks (society_id, unit_id, block_date);
CREATE INDEX staff_shift_attendance_marked_by_idx
  ON public.staff_shift_attendance (marked_by);

CREATE OR REPLACE FUNCTION private.staff_unit_occupied_by(
  p_society_id uuid,
  p_unit_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    JOIN public.units AS unit
      ON unit.society_id = occupant.society_id
      AND unit.id = occupant.unit_id
    WHERE occupant.society_id = p_society_id
      AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active'
      AND membership.user_id = p_user_id
      AND membership.status = 'active'
      AND membership.roles @> ARRAY['resident']::text[]
      AND unit.active
  )
$$;
REVOKE ALL ON FUNCTION private.staff_unit_occupied_by(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.staff_photo_owner(p_path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_path ~ (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-' ||
      '[0-9a-f]{12}/staff/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-' ||
      '[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    )
    THEN split_part(p_path, '/', 3)::uuid
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.staff_photo_owner(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.staff_photo_owner(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.staff_local_date(p_society_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (pg_catalog.now() AT TIME ZONE COALESCE(society.timezone, 'Asia/Kolkata'))::date
  FROM public.societies AS society
  WHERE society.id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.staff_local_date(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.staff_photo_read_allowed(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members AS staff
    WHERE staff.society_id = private.file_society_id(p_path)
      AND staff.photo_path = p_path
      AND private.module_enabled(staff.society_id, 'staff')
      AND (
        private.has_role(staff.society_id, ARRAY['admin']::text[])
        OR (
          private.has_role(staff.society_id, ARRAY['guard']::text[])
          AND EXISTS (
            SELECT 1 FROM public.staff_unit_links AS link
            WHERE link.society_id = staff.society_id
              AND link.staff_id = staff.id AND link.status = 'active'
          )
        )
        OR EXISTS (
          SELECT 1 FROM public.staff_unit_links AS link
          WHERE link.society_id = staff.society_id
            AND link.staff_id = staff.id
            AND private.staff_unit_occupied_by(
              link.society_id, link.unit_id, auth.uid()
            )
            AND (
              link.status = 'active'
              OR (
                link.status = 'pending'
                AND link.created_by = auth.uid()
                AND staff.created_by = auth.uid()
              )
            )
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.staff_photo_read_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.staff_photo_read_allowed(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.staff_photo_referenced(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members AS staff
    WHERE staff.society_id = private.file_society_id(p_path)
      AND staff.photo_path = p_path
  )
$$;
REVOKE ALL ON FUNCTION private.staff_photo_referenced(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.staff_photo_referenced(text) TO authenticated;

CREATE POLICY staff_photos_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'staff-photos'
    AND private.module_enabled(private.file_society_id(name), 'staff')
    AND private.staff_photo_read_allowed(name)
  );

CREATE POLICY staff_photos_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'staff-photos'
    AND private.module_enabled(private.file_society_id(name), 'staff')
    AND private.society_writable(private.file_society_id(name))
    AND private.staff_photo_owner(name) = auth.uid()
    AND (
      private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      OR private.has_role(private.file_society_id(name), ARRAY['resident']::text[])
    )
  );

CREATE POLICY staff_photos_delete_unreferenced
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'staff-photos'
    AND private.module_enabled(private.file_society_id(name), 'staff')
    AND (
      private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      OR private.staff_photo_owner(name) = auth.uid()
    )
    AND NOT private.staff_photo_referenced(name)
  );

CREATE OR REPLACE FUNCTION public.staff_settings_update(
  p_society_id uuid,
  p_resident_approval_required boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  previous_settings jsonb;
  next_settings jsonb;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Staff administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_resident_approval_required IS NULL
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The staff settings are invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT settings INTO previous_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'staff'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff module configuration was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  next_settings := pg_catalog.jsonb_set(
    COALESCE(previous_settings, '{}'::jsonb),
    '{resident_approval_required}',
    pg_catalog.to_jsonb(p_resident_approval_required),
    true
  );
  UPDATE public.module_configs
  SET settings = next_settings, updated_by = current_user_id
  WHERE society_id = p_society_id AND module_key = 'staff';
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'staff.settings.update',
    'module_config', p_society_id::text,
    pg_catalog.jsonb_build_object(
      'resident_approval_required',
      COALESCE((previous_settings->>'resident_approval_required')::boolean, true)
    ),
    pg_catalog.jsonb_build_object(
      'resident_approval_required', p_resident_approval_required
    ),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_list(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_admin boolean;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'staff')
  THEN
    RAISE EXCEPTION 'Staff access is not available.' USING ERRCODE = '42501';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  IF NOT is_admin
    AND NOT private.has_role(p_society_id, ARRAY['resident']::text[])
  THEN
    RAISE EXCEPTION 'Staff access is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(item ORDER BY item->>'full_name', item->>'staff_code')
    FROM (
      SELECT pg_catalog.jsonb_build_object(
        'id', staff.id,
        'staff_code', staff.staff_code,
        'staff_type', staff.staff_type,
        'full_name', staff.full_name,
        'phone', staff.phone,
        'photo_path', staff.photo_path,
        'id_type', staff.id_type,
        'id_last_four', staff.id_last_four,
        'job_role', staff.job_role,
        'police_verified', staff.police_verified,
        'status', staff.status,
        'created_by', staff.created_by,
        'unit_links', COALESCE((
          SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', link.id, 'unit_id', link.unit_id, 'status', link.status,
            'blocked_today', EXISTS (
              SELECT 1 FROM public.staff_day_blocks AS day_block
              WHERE day_block.society_id = link.society_id
                AND day_block.staff_id = link.staff_id
                AND day_block.unit_id = link.unit_id
                AND day_block.block_date = private.staff_local_date(link.society_id)
            ),
            'unit_label', COALESCE(block.name || ' · ', '') || unit.number
          ) ORDER BY unit.number)
          FROM public.staff_unit_links AS link
          JOIN public.units AS unit
            ON unit.society_id = link.society_id AND unit.id = link.unit_id
          LEFT JOIN public.blocks AS block
            ON block.society_id = unit.society_id AND block.id = unit.block_id
          WHERE link.society_id = staff.society_id
            AND link.staff_id = staff.id
            AND (
              is_admin
              OR (
                private.staff_unit_occupied_by(
                  link.society_id, link.unit_id, current_user_id
                )
                AND (
                  link.status = 'active'
                  OR (
                    link.created_by = current_user_id
                    AND staff.created_by = current_user_id
                  )
                )
              )
            )
        ), '[]'::jsonb)
      ) AS item
      FROM public.staff_members AS staff
      WHERE staff.society_id = p_society_id
        AND (
          is_admin
          OR (
            staff.staff_type = 'domestic'
            AND EXISTS (
              SELECT 1 FROM public.staff_unit_links AS link
              WHERE link.society_id = staff.society_id
                AND link.staff_id = staff.id
                AND private.staff_unit_occupied_by(
                  link.society_id, link.unit_id, current_user_id
                )
                AND (
                  link.status = 'active'
                  OR (
                    link.created_by = current_user_id
                    AND staff.created_by = current_user_id
                  )
                )
            )
          )
        )
    ) AS rows
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_units_list(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_admin boolean;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'staff')
  THEN
    RAISE EXCEPTION 'Staff access is not available.' USING ERRCODE = '42501';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  IF NOT is_admin
    AND NOT private.has_role(
      p_society_id, ARRAY['resident', 'guard']::text[]
    )
  THEN
    RAISE EXCEPTION 'Staff access is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', unit.id,
      'label', COALESCE(block.name || ' · ', '') || unit.number
    ) ORDER BY block.name NULLS FIRST, unit.number)
    FROM public.units AS unit
    LEFT JOIN public.blocks AS block
      ON block.society_id = unit.society_id AND block.id = unit.block_id
    WHERE unit.society_id = p_society_id AND unit.active
      AND (
        is_admin
        OR private.has_role(p_society_id, ARRAY['guard']::text[])
        OR private.staff_unit_occupied_by(
          p_society_id, unit.id, current_user_id
        )
      )
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_resident_register(
  p_society_id uuid,
  p_unit_id uuid,
  p_full_name text,
  p_phone text,
  p_photo_path text,
  p_id_type text,
  p_id_last_four text,
  p_job_role text,
  p_police_verified boolean,
  p_request_id uuid,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  require_approval boolean;
  staff_row public.staff_members;
  link_row public.staff_unit_links;
  matched_existing boolean := false;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.staff_unit_occupied_by(p_society_id, p_unit_id, current_user_id)
  THEN
    RAISE EXCEPTION 'Resident staff registration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL
    OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
    OR p_full_name IS NULL OR char_length(btrim(p_full_name)) NOT BETWEEN 1 AND 120
    OR p_phone IS NULL OR p_phone !~ '^[+]?[0-9]{10,15}$'
    OR p_job_role IS NULL OR char_length(btrim(p_job_role)) NOT BETWEEN 1 AND 80
    OR p_police_verified IS NULL
    OR (p_id_type IS NULL) <> (p_id_last_four IS NULL)
    OR (p_id_type IS NOT NULL AND p_id_type NOT IN ('aadhaar', 'pan', 'voter_id', 'passport', 'other'))
    OR (p_id_last_four IS NOT NULL AND p_id_last_four !~ '^[A-Za-z0-9]{4}$')
  THEN
    RAISE EXCEPTION 'The staff details are invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_photo_path IS NULL THEN
    RAISE EXCEPTION 'Upload a staff photo.' USING ERRCODE = '22023';
  END IF;
  IF p_photo_path IS NOT NULL AND
    p_photo_path !~ ('^' || p_society_id::text || '/staff/') THEN
    RAISE EXCEPTION 'The staff photo must be uploaded again.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_society_id::text || ':' || p_phone, 0)
  );
  SELECT * INTO link_row
  FROM public.staff_unit_links
  WHERE society_id = p_society_id
    AND created_by = current_user_id
    AND request_id = p_request_id;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'staff_id', link_row.staff_id, 'link_id', link_row.id,
      'status', link_row.status
    );
  END IF;
  SELECT COALESCE((settings->>'resident_approval_required')::boolean, true)
  INTO require_approval
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'staff';

  SELECT * INTO staff_row
  FROM public.staff_members
  WHERE society_id = p_society_id
    AND staff_type = 'domestic'
    AND phone = p_phone
  ORDER BY created_at NULLS LAST, id
  LIMIT 1
  FOR UPDATE;
  matched_existing := FOUND;
  IF matched_existing AND staff_row.status = 'blocked' THEN
    RAISE EXCEPTION 'This staff member cannot be registered.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  IF NOT matched_existing THEN
    INSERT INTO public.staff_members (
      society_id, staff_type, full_name, phone, photo_path, id_type,
      id_last_four, job_role, police_verified, created_by
    )
    VALUES (
      p_society_id, 'domestic', btrim(p_full_name), p_phone, p_photo_path,
      p_id_type, upper(p_id_last_four), btrim(p_job_role), p_police_verified,
      current_user_id
    )
    RETURNING * INTO staff_row;
  END IF;

  INSERT INTO public.staff_unit_links (
    society_id, staff_id, unit_id, status, created_by, request_id,
    decided_by, decided_at
  )
  VALUES (
    p_society_id, staff_row.id, p_unit_id,
    CASE WHEN require_approval OR matched_existing THEN 'pending' ELSE 'active' END,
    current_user_id, p_request_id,
    CASE WHEN require_approval OR matched_existing THEN NULL ELSE current_user_id END,
    CASE WHEN require_approval OR matched_existing THEN NULL ELSE now() END
  )
  RETURNING * INTO link_row;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'resident', 'staff.registration.request',
    'staff_unit_link', link_row.id::text,
    pg_catalog.jsonb_build_object(
      'staff_id', staff_row.id, 'unit_id', p_unit_id,
      'status', link_row.status, 'matched_existing', matched_existing
    ),
    p_request_trace
  );
  RETURN pg_catalog.jsonb_build_object(
    'staff_id', staff_row.id, 'link_id', link_row.id,
    'status', link_row.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_admin_save(
  p_society_id uuid,
  p_staff_id uuid,
  p_staff_type text,
  p_full_name text,
  p_phone text,
  p_photo_path text,
  p_id_type text,
  p_id_last_four text,
  p_job_role text,
  p_police_verified boolean,
  p_status text,
  p_unit_ids uuid[],
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  staff_row public.staff_members;
  loop_unit_id uuid;
  previous_unit_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Staff administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_staff_type IS NULL OR p_staff_type NOT IN ('domestic', 'society')
    OR p_full_name IS NULL OR char_length(btrim(p_full_name)) NOT BETWEEN 1 AND 120
    OR p_phone IS NULL OR p_phone !~ '^[+]?[0-9]{10,15}$'
    OR p_job_role IS NULL OR char_length(btrim(p_job_role)) NOT BETWEEN 1 AND 80
    OR p_police_verified IS NULL OR p_status IS NULL
    OR p_status NOT IN ('active', 'blocked')
    OR (p_id_type IS NULL) <> (p_id_last_four IS NULL)
    OR (p_id_type IS NOT NULL AND p_id_type NOT IN ('aadhaar', 'pan', 'voter_id', 'passport', 'other'))
    OR (p_id_last_four IS NOT NULL AND p_id_last_four !~ '^[A-Za-z0-9]{4}$')
    OR (p_staff_type = 'society' AND cardinality(COALESCE(p_unit_ids, ARRAY[]::uuid[])) > 0)
  THEN
    RAISE EXCEPTION 'The staff details are invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_staff_id IS NULL AND p_photo_path IS NULL THEN
    RAISE EXCEPTION 'Upload a staff photo.' USING ERRCODE = '22023';
  END IF;
  IF p_photo_path IS NOT NULL AND
    p_photo_path !~ ('^' || p_society_id::text || '/staff/') THEN
    RAISE EXCEPTION 'The staff photo must be uploaded again.'
      USING ERRCODE = '22023';
  END IF;
  IF p_staff_id IS NULL THEN
    INSERT INTO public.staff_members (
      society_id, staff_type, full_name, phone, photo_path, id_type,
      id_last_four, job_role, police_verified, status, created_by, updated_by
    )
    VALUES (
      p_society_id, p_staff_type, btrim(p_full_name), p_phone, p_photo_path,
      p_id_type, upper(p_id_last_four), btrim(p_job_role), p_police_verified,
      p_status, current_user_id, current_user_id
    )
    RETURNING * INTO staff_row;
  ELSE
    SELECT * INTO staff_row
    FROM public.staff_members
    WHERE society_id = p_society_id AND id = p_staff_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The staff member was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF staff_row.staff_type <> p_staff_type THEN
      RAISE EXCEPTION 'Staff type cannot be changed.' USING ERRCODE = '23505';
    END IF;
    UPDATE public.staff_members
    SET full_name = btrim(p_full_name), phone = p_phone, photo_path = p_photo_path,
        id_type = p_id_type, id_last_four = upper(p_id_last_four),
        job_role = btrim(p_job_role), police_verified = p_police_verified,
        status = p_status, updated_by = current_user_id
    WHERE society_id = p_society_id AND id = p_staff_id
    RETURNING * INTO staff_row;
  END IF;
  IF p_staff_type = 'domestic' THEN
    SELECT COALESCE(pg_catalog.array_agg(link.unit_id ORDER BY link.unit_id), ARRAY[]::uuid[])
    INTO previous_unit_ids
    FROM public.staff_unit_links AS link
    WHERE link.society_id = p_society_id AND link.staff_id = staff_row.id
      AND link.status = 'active';
    UPDATE public.staff_unit_links AS link
    SET status = 'inactive', decided_by = current_user_id, decided_at = now()
    WHERE link.society_id = p_society_id AND link.staff_id = staff_row.id
      AND link.status = 'active'
      AND NOT (
        link.unit_id = ANY(COALESCE(p_unit_ids, ARRAY[]::uuid[]))
      );
    FOREACH loop_unit_id IN ARRAY COALESCE(p_unit_ids, ARRAY[]::uuid[]) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.units AS unit
        WHERE unit.society_id = p_society_id
          AND unit.id = loop_unit_id AND unit.active
      ) THEN
        RAISE EXCEPTION 'Choose active units in this society.'
          USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.staff_unit_links (
        society_id, staff_id, unit_id, status, created_by, decided_by, decided_at
      )
      VALUES (
        p_society_id, staff_row.id, loop_unit_id, 'active',
        current_user_id, current_user_id, now()
      )
      ON CONFLICT (society_id, staff_id, unit_id)
      DO UPDATE SET status = 'active', decided_by = current_user_id,
        decided_at = now();
    END LOOP;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin',
    CASE WHEN p_staff_id IS NULL THEN 'staff.create' ELSE 'staff.update' END,
    'staff', staff_row.id::text,
    CASE WHEN p_staff_id IS NULL THEN NULL
      ELSE pg_catalog.jsonb_build_object(
        'unit_ids', pg_catalog.to_jsonb(previous_unit_ids)
      ) END,
    pg_catalog.jsonb_build_object(
      'staff_type', staff_row.staff_type, 'full_name', staff_row.full_name,
      'status', staff_row.status, 'job_role', staff_row.job_role,
      'unit_ids', COALESCE((
        SELECT pg_catalog.jsonb_agg(link.unit_id ORDER BY link.unit_id)
        FROM public.staff_unit_links AS link
        WHERE link.society_id = p_society_id AND link.staff_id = staff_row.id
          AND link.status = 'active'
      ), '[]'::jsonb)
    ),
    p_request_id
  );
  RETURN staff_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_review_link(
  p_society_id uuid,
  p_link_id uuid,
  p_decision text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  link_row public.staff_unit_links;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Staff administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('active', 'rejected')
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid staff registration decision.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO link_row
  FROM public.staff_unit_links
  WHERE society_id = p_society_id AND id = p_link_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The staff registration was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF link_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This staff request has already been reviewed.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  UPDATE public.staff_unit_links
  SET status = p_decision, decided_by = current_user_id, decided_at = now()
  WHERE society_id = p_society_id AND id = p_link_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'staff.registration.review',
    'staff_unit_link', link_row.id::text,
    pg_catalog.jsonb_build_object('status', link_row.status),
    pg_catalog.jsonb_build_object('status', p_decision),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_resident_day_block(
  p_society_id uuid,
  p_staff_id uuid,
  p_unit_id uuid,
  p_request_id text
)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  local_date date;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
    OR NOT private.staff_unit_occupied_by(p_society_id, p_unit_id, current_user_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.staff_unit_links AS link
      JOIN public.staff_members AS staff
        ON staff.society_id = link.society_id AND staff.id = link.staff_id
      WHERE link.society_id = p_society_id AND link.staff_id = p_staff_id
        AND link.unit_id = p_unit_id AND link.status = 'active'
        AND staff.staff_type = 'domestic' AND staff.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'The staff member cannot be blocked for this unit.'
      USING ERRCODE = '42501';
  END IF;
  local_date := private.staff_local_date(p_society_id);
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request ID is required.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.staff_day_blocks (
    society_id, staff_id, unit_id, block_date, created_by
  )
  VALUES (p_society_id, p_staff_id, p_unit_id, local_date, current_user_id)
  ON CONFLICT (society_id, staff_id, unit_id, block_date) DO NOTHING;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'resident', 'staff.block.today',
    'staff', p_staff_id::text,
    pg_catalog.jsonb_build_object('unit_id', p_unit_id, 'block_date', local_date),
    p_request_id
  );
  RETURN local_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_gate_list(
  p_society_id uuid,
  p_unit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_date date;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['guard']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.society_id = p_society_id AND unit.id = p_unit_id AND unit.active
    )
  THEN
    RAISE EXCEPTION 'Gate staff access is not available.'
      USING ERRCODE = '42501';
  END IF;
  local_date := private.staff_local_date(p_society_id);
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', staff.id,
      'staff_code', staff.staff_code,
      'full_name', staff.full_name,
      'photo_path', staff.photo_path,
      'job_role', staff.job_role,
      'status', staff.status,
      'blocked_today', EXISTS (
        SELECT 1 FROM public.staff_day_blocks AS block
        WHERE block.society_id = staff.society_id
          AND block.staff_id = staff.id AND block.unit_id = p_unit_id
          AND block.block_date = local_date
      ),
      'open_attendance_id', (
        SELECT attendance.id
        FROM public.staff_attendance AS attendance
        WHERE attendance.society_id = staff.society_id
          AND attendance.staff_id = staff.id
          AND attendance.checked_out_at IS NULL
      ),
      'inside', EXISTS (
        SELECT 1 FROM public.staff_attendance AS attendance
        WHERE attendance.society_id = staff.society_id
          AND attendance.staff_id = staff.id AND attendance.checked_out_at IS NULL
      )
    ) ORDER BY lower(staff.full_name))
    FROM public.staff_members AS staff
    JOIN public.staff_unit_links AS link
      ON link.society_id = staff.society_id AND link.staff_id = staff.id
    WHERE staff.society_id = p_society_id AND staff.staff_type = 'domestic'
      AND link.unit_id = p_unit_id AND link.status = 'active'
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_check_in(
  p_society_id uuid,
  p_unit_id uuid,
  p_staff_code text,
  p_guard_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  staff_row public.staff_members;
  new_attendance_id uuid;
  local_date date;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['guard']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.guard_roster AS guard
      JOIN public.societies AS society ON society.id = guard.society_id
      WHERE guard.society_id = p_society_id AND guard.id = p_guard_id
        AND guard.active
        AND (
          (society.gate_login_mode = 'individual' AND EXISTS (
            SELECT 1 FROM public.memberships AS membership
            WHERE membership.society_id = p_society_id
              AND membership.id = guard.membership_id
              AND membership.user_id = current_user_id
              AND membership.status = 'active'
          ))
          OR society.gate_login_mode = 'shared'
        )
    )
  THEN
    RAISE EXCEPTION 'Gate staff access is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_staff_code IS NULL OR p_staff_code !~ '^[A-Fa-f0-9]{10}$'
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a valid staff code.' USING ERRCODE = '22023';
  END IF;
  SELECT staff.* INTO staff_row
  FROM public.staff_members AS staff
  JOIN public.staff_unit_links AS link
    ON link.society_id = staff.society_id AND link.staff_id = staff.id
  WHERE staff.society_id = p_society_id
    AND upper(staff.staff_code) = upper(p_staff_code)
    AND staff.staff_type = 'domestic'
    AND link.unit_id = p_unit_id AND link.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
        AND unit.active
    )
  FOR UPDATE OF staff;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The staff member is not registered for this unit.'
      USING ERRCODE = 'P0002';
  END IF;
  IF staff_row.status <> 'active' THEN
    RAISE EXCEPTION 'This staff member is blocked by the society.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  local_date := private.staff_local_date(p_society_id);
  IF EXISTS (
    SELECT 1 FROM public.staff_day_blocks AS block
    WHERE block.society_id = p_society_id AND block.staff_id = staff_row.id
      AND block.unit_id = p_unit_id AND block.block_date = local_date
  ) THEN
    RAISE EXCEPTION 'This staff member is not allowed at this unit today.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  INSERT INTO public.staff_attendance (
    society_id, staff_id, unit_id, checked_in_by, check_in_guard_id
  )
  VALUES (p_society_id, staff_row.id, p_unit_id, current_user_id, p_guard_id)
  RETURNING id INTO new_attendance_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'guard', 'staff.entry',
    'staff_attendance', new_attendance_id::text,
    pg_catalog.jsonb_build_object(
      'staff_id', staff_row.id, 'unit_id', p_unit_id, 'guard_id', p_guard_id
    ),
    p_request_id
  );
  RETURN new_attendance_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_check_out(
  p_society_id uuid,
  p_attendance_id uuid,
  p_guard_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  attendance_row public.staff_attendance;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['guard']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.guard_roster AS guard
      JOIN public.societies AS society ON society.id = guard.society_id
      WHERE guard.society_id = p_society_id AND guard.id = p_guard_id
        AND guard.active
        AND (
          (society.gate_login_mode = 'individual' AND EXISTS (
            SELECT 1 FROM public.memberships AS membership
            WHERE membership.society_id = p_society_id
              AND membership.id = guard.membership_id
              AND membership.user_id = current_user_id
              AND membership.status = 'active'
          ))
          OR society.gate_login_mode = 'shared'
        )
    )
  THEN
    RAISE EXCEPTION 'Gate staff access is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request ID is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO attendance_row
  FROM public.staff_attendance
  WHERE society_id = p_society_id AND id = p_attendance_id
  FOR UPDATE;
  IF NOT FOUND OR attendance_row.checked_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'The open staff attendance was not found.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  UPDATE public.staff_attendance
  SET checked_out_at = clock_timestamp(), checked_out_by = current_user_id,
      check_out_guard_id = p_guard_id
  WHERE society_id = p_society_id AND id = p_attendance_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'guard', 'staff.exit',
    'staff_attendance', p_attendance_id::text,
    pg_catalog.jsonb_build_object('checked_out_at', NULL),
    pg_catalog.jsonb_build_object('checked_out_at', clock_timestamp(), 'guard_id', p_guard_id),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_attendance_list(
  p_society_id uuid,
  p_staff_id uuid,
  p_month date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  society_timezone text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin']::text[])
      OR EXISTS (
        SELECT 1 FROM public.staff_unit_links AS link
        WHERE link.society_id = p_society_id AND link.staff_id = p_staff_id
          AND link.status = 'active'
          AND private.staff_unit_occupied_by(
            p_society_id, link.unit_id, current_user_id
          )
      )
    )
  THEN
    RAISE EXCEPTION 'Staff attendance is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR p_month <> date_trunc('month', p_month)::date THEN
    RAISE EXCEPTION 'Choose a valid attendance month.'
      USING ERRCODE = '22023';
  END IF;
  SELECT timezone INTO society_timezone
  FROM public.societies WHERE id = p_society_id;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', attendance.id,
      'unit_id', attendance.unit_id,
      'unit_label', COALESCE(block.name || ' · ', '') || unit.number,
      'checked_in_at', attendance.checked_in_at,
      'checked_out_at', attendance.checked_out_at,
      'check_in_guard', check_in_guard.name,
      'check_out_guard', check_out_guard.name
    ) ORDER BY attendance.checked_in_at DESC)
    FROM public.staff_attendance AS attendance
    JOIN public.societies AS society ON society.id = attendance.society_id
    JOIN public.units AS unit
      ON unit.society_id = attendance.society_id AND unit.id = attendance.unit_id
    LEFT JOIN public.blocks AS block
      ON block.society_id = unit.society_id AND block.id = unit.block_id
    JOIN public.guard_roster AS check_in_guard
      ON check_in_guard.society_id = attendance.society_id
      AND check_in_guard.id = attendance.check_in_guard_id
    LEFT JOIN public.guard_roster AS check_out_guard
      ON check_out_guard.society_id = attendance.society_id
      AND check_out_guard.id = attendance.check_out_guard_id
    WHERE attendance.society_id = p_society_id
      AND attendance.staff_id = p_staff_id
      AND attendance.checked_in_at >= (
        p_month::timestamp AT TIME ZONE COALESCE(society_timezone, 'Asia/Kolkata')
      )
      AND attendance.checked_in_at < (
        (p_month + interval '1 month')::timestamp
        AT TIME ZONE COALESCE(society_timezone, 'Asia/Kolkata')
      )
      AND (
        private.has_role(p_society_id, ARRAY['admin']::text[])
        OR private.staff_unit_occupied_by(
          p_society_id, attendance.unit_id, current_user_id
        )
      )
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_shift_list(
  p_society_id uuid,
  p_month date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
  THEN
    RAISE EXCEPTION 'Society staff attendance is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR p_month <> date_trunc('month', p_month)::date THEN
    RAISE EXCEPTION 'Choose a valid attendance month.'
      USING ERRCODE = '22023';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'staff_id', staff.id,
      'staff_name', staff.full_name,
      'attendance_date', shift.attendance_date,
      'status', shift.status
    ) ORDER BY shift.attendance_date DESC, lower(staff.full_name))
    FROM public.staff_shift_attendance AS shift
    JOIN public.staff_members AS staff
      ON staff.society_id = shift.society_id AND staff.id = shift.staff_id
    WHERE shift.society_id = p_society_id
      AND shift.attendance_date >= p_month
      AND shift.attendance_date < p_month + interval '1 month'
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_shift_mark(
  p_society_id uuid,
  p_staff_id uuid,
  p_attendance_date date,
  p_status text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  previous_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.staff_members
      WHERE society_id = p_society_id AND id = p_staff_id
        AND staff_type = 'society'
    )
  THEN
    RAISE EXCEPTION 'Society staff attendance is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_attendance_date IS NULL
    OR p_attendance_date > private.staff_local_date(p_society_id)
    OR p_status IS NULL OR p_status NOT IN ('present', 'absent', 'leave')
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The shift attendance details are invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT status INTO previous_status
  FROM public.staff_shift_attendance
  WHERE society_id = p_society_id AND staff_id = p_staff_id
    AND attendance_date = p_attendance_date
  FOR UPDATE;
  INSERT INTO public.staff_shift_attendance (
    society_id, staff_id, attendance_date, status, marked_by
  )
  VALUES (p_society_id, p_staff_id, p_attendance_date, p_status, current_user_id)
  ON CONFLICT (society_id, staff_id, attendance_date)
  DO UPDATE SET status = EXCLUDED.status, marked_by = current_user_id,
    updated_at = now();
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'staff.shift_attendance.mark',
    'staff_shift_attendance', p_staff_id::text || ':' || p_attendance_date::text,
    CASE WHEN previous_status IS NULL THEN NULL
      ELSE pg_catalog.jsonb_build_object('status', previous_status) END,
    pg_catalog.jsonb_build_object('status', p_status, 'date', p_attendance_date),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_retention_run(
  p_today date,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retention_day timestamptz;
  attendance_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Invalid staff retention arguments.'
      USING ERRCODE = '22023';
  END IF;
  retention_day := p_today::timestamp AT TIME ZONE 'Asia/Kolkata';
  DELETE FROM public.staff_attendance
  WHERE checked_out_at IS NOT NULL
    AND checked_in_at < retention_day - interval '1 year';
  GET DIAGNOSTICS attendance_count = ROW_COUNT;
  IF attendance_count > 0 THEN
    INSERT INTO public.audit_logs (
      actor_role, action, entity_type, entity_id, "after", request_id
    )
    VALUES (
      'service_role', 'staff.retention', 'retention_run', p_today::text,
      pg_catalog.jsonb_build_object(
        'staffAttendanceDeleted', attendance_count
      ),
      p_request_trace
    );
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'staffAttendanceDeleted', attendance_count
  );
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-photos', 'staff-photos', false, 5242880,
  ARRAY['image/jpeg', 'image/png']
);

REVOKE ALL ON FUNCTION public.staff_settings_update(uuid, boolean, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_units_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_resident_register(
  uuid, uuid, text, text, text, text, text, text, boolean, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_admin_save(
  uuid, uuid, text, text, text, text, text, text, text, boolean, text, uuid[], text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_review_link(uuid, uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_resident_day_block(uuid, uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_gate_list(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_check_in(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_check_out(uuid, uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_attendance_list(uuid, uuid, date)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_shift_list(uuid, date)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_shift_mark(uuid, uuid, date, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_retention_run(date, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.staff_settings_update(uuid, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_units_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_resident_register(
  uuid, uuid, text, text, text, text, text, text, boolean, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_admin_save(
  uuid, uuid, text, text, text, text, text, text, text, boolean, text, uuid[], text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_review_link(uuid, uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_resident_day_block(uuid, uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_gate_list(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_check_in(uuid, uuid, text, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_check_out(uuid, uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_attendance_list(uuid, uuid, date)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_shift_list(uuid, date)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_shift_mark(uuid, uuid, date, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_retention_run(date, text)
  TO service_role;
