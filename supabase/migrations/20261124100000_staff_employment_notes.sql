-- P48 staff records (D-68): society-staff employment details and private performance notes.
ALTER TABLE public.staff_members
  ADD COLUMN department text,
  ADD COLUMN designation text,
  ADD COLUMN employment_type text,
  ADD COLUMN joining_date date,
  ADD COLUMN weekly_off text,
  ADD COLUMN employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN exit_date date,
  ADD CONSTRAINT staff_members_department_check
    CHECK (department IS NULL OR (char_length(department) BETWEEN 1 AND 80 AND department = btrim(department))),
  ADD CONSTRAINT staff_members_designation_check
    CHECK (designation IS NULL OR (char_length(designation) BETWEEN 1 AND 80 AND designation = btrim(designation))),
  ADD CONSTRAINT staff_members_employment_type_check
    CHECK (employment_type IS NULL OR employment_type IN ('permanent', 'contract', 'daily_wage', 'part_time')),
  ADD CONSTRAINT staff_members_weekly_off_check
    CHECK (weekly_off IS NULL OR weekly_off IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  ADD CONSTRAINT staff_members_employment_status_check
    CHECK (employment_status IN ('active', 'on_notice', 'left')),
  ADD CONSTRAINT staff_members_exit_date_check
    CHECK (
      (employment_status = 'left') = (exit_date IS NOT NULL)
      AND (exit_date IS NULL OR joining_date IS NULL OR exit_date >= joining_date)
    ),
  -- Employment details apply to society staff only (STF-13).
  ADD CONSTRAINT staff_members_employment_society_only_check
    CHECK (
      staff_type = 'society'
      OR (
        department IS NULL AND designation IS NULL AND employment_type IS NULL
        AND joining_date IS NULL AND weekly_off IS NULL
        AND employment_status = 'active' AND exit_date IS NULL
      )
    );

CREATE TABLE public.staff_performance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  note_date date NOT NULL,
  category text NOT NULL,
  rating smallint,
  note text NOT NULL,
  action text,
  follow_up_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT staff_performance_notes_staff_fkey
    FOREIGN KEY (society_id, staff_id)
    REFERENCES public.staff_members (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_performance_notes_category_check
    CHECK (category IN ('training_needed', 'warning', 'appraisal', 'appreciation', 'other')),
  CONSTRAINT staff_performance_notes_rating_check
    CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT staff_performance_notes_note_check
    CHECK (char_length(note) BETWEEN 1 AND 2000 AND note = btrim(note)),
  CONSTRAINT staff_performance_notes_action_check
    CHECK (action IS NULL OR (char_length(action) BETWEEN 1 AND 500 AND action = btrim(action))),
  CONSTRAINT staff_performance_notes_status_check
    CHECK (status IN ('open', 'closed'))
);

CREATE INDEX staff_performance_notes_staff_idx
  ON public.staff_performance_notes (society_id, staff_id, note_date DESC, created_at DESC);
CREATE INDEX staff_performance_notes_created_by_idx
  ON public.staff_performance_notes (created_by);
CREATE INDEX staff_performance_notes_updated_by_idx
  ON public.staff_performance_notes (updated_by);
CREATE TRIGGER staff_performance_notes_set_updated_at
  BEFORE UPDATE ON public.staff_performance_notes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.staff_performance_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_performance_notes
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY staff_performance_notes_no_direct_access
  ON public.staff_performance_notes FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- Committee members read society staff for notes; employment details stay admin-only.
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
  is_committee boolean;
  is_resident boolean;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'staff')
  THEN
    RAISE EXCEPTION 'Staff access is not available.' USING ERRCODE = '42501';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  is_committee := private.has_role(p_society_id, ARRAY['committee']::text[]);
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  IF NOT is_admin AND NOT is_committee AND NOT is_resident THEN
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
        'photo_path', CASE
          WHEN is_admin OR staff.staff_type = 'domestic' THEN staff.photo_path
        END,
        'id_type', CASE
          WHEN is_admin OR staff.staff_type = 'domestic' THEN staff.id_type
        END,
        'id_last_four', CASE
          WHEN is_admin OR staff.staff_type = 'domestic' THEN staff.id_last_four
        END,
        'job_role', staff.job_role,
        'police_verified', staff.police_verified,
        'status', staff.status,
        'created_by', staff.created_by,
        'department', CASE WHEN is_admin THEN staff.department END,
        'designation', CASE WHEN is_admin THEN staff.designation END,
        'employment_type', CASE WHEN is_admin THEN staff.employment_type END,
        'joining_date', CASE WHEN is_admin THEN staff.joining_date END,
        'weekly_off', CASE WHEN is_admin THEN staff.weekly_off END,
        'employment_status', staff.employment_status,
        'exit_date', CASE WHEN is_admin THEN staff.exit_date END,
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
          OR (is_committee AND staff.staff_type = 'society')
          OR (
            is_resident
            AND staff.staff_type = 'domestic'
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

DROP FUNCTION public.staff_admin_save(
  uuid, uuid, text, text, text, text, text, text, text, boolean, text, uuid[], text
);

CREATE FUNCTION public.staff_admin_save(
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
  p_request_id text,
  p_department text DEFAULT NULL,
  p_designation text DEFAULT NULL,
  p_employment_type text DEFAULT NULL,
  p_joining_date date DEFAULT NULL,
  p_weekly_off text DEFAULT NULL,
  p_employment_status text DEFAULT 'active',
  p_exit_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  staff_row public.staff_members;
  previous_row public.staff_members;
  loop_unit_id uuid;
  previous_unit_ids uuid[] := ARRAY[]::uuid[];
  department_value text := NULLIF(btrim(COALESCE(p_department, '')), '');
  designation_value text := NULLIF(btrim(COALESCE(p_designation, '')), '');
  employment_status_value text := COALESCE(p_employment_status, 'active');
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
    OR char_length(COALESCE(department_value, '')) > 80
    OR char_length(COALESCE(designation_value, '')) > 80
    OR (p_employment_type IS NOT NULL AND p_employment_type NOT IN ('permanent', 'contract', 'daily_wage', 'part_time'))
    OR (p_weekly_off IS NOT NULL AND p_weekly_off NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
    OR employment_status_value NOT IN ('active', 'on_notice', 'left')
    OR (employment_status_value = 'left') <> (p_exit_date IS NOT NULL)
    OR (p_exit_date IS NOT NULL AND p_joining_date IS NOT NULL AND p_exit_date < p_joining_date)
    OR (
      p_staff_type = 'domestic'
      AND (
        department_value IS NOT NULL OR designation_value IS NOT NULL
        OR p_employment_type IS NOT NULL OR p_joining_date IS NOT NULL
        OR p_weekly_off IS NOT NULL OR employment_status_value <> 'active'
        OR p_exit_date IS NOT NULL
      )
    )
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
      id_last_four, job_role, police_verified, status, created_by, updated_by,
      department, designation, employment_type, joining_date, weekly_off,
      employment_status, exit_date
    )
    VALUES (
      p_society_id, p_staff_type, btrim(p_full_name), p_phone, p_photo_path,
      p_id_type, upper(p_id_last_four), btrim(p_job_role), p_police_verified,
      p_status, current_user_id, current_user_id,
      department_value, designation_value, p_employment_type, p_joining_date,
      p_weekly_off, employment_status_value, p_exit_date
    )
    RETURNING * INTO staff_row;
  ELSE
    SELECT * INTO previous_row
    FROM public.staff_members
    WHERE society_id = p_society_id AND id = p_staff_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The staff member was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous_row.staff_type <> p_staff_type THEN
      RAISE EXCEPTION 'Staff type cannot be changed.' USING ERRCODE = '23505';
    END IF;
    UPDATE public.staff_members
    SET full_name = btrim(p_full_name), phone = p_phone, photo_path = p_photo_path,
        id_type = p_id_type, id_last_four = upper(p_id_last_four),
        job_role = btrim(p_job_role), police_verified = p_police_verified,
        status = p_status, updated_by = current_user_id,
        department = department_value, designation = designation_value,
        employment_type = p_employment_type, joining_date = p_joining_date,
        weekly_off = p_weekly_off, employment_status = employment_status_value,
        exit_date = p_exit_date
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
        'unit_ids', pg_catalog.to_jsonb(previous_unit_ids),
        'status', previous_row.status,
        'employment_status', previous_row.employment_status,
        'exit_date', previous_row.exit_date
      ) END,
    pg_catalog.jsonb_build_object(
      'staff_type', staff_row.staff_type, 'full_name', staff_row.full_name,
      'status', staff_row.status, 'job_role', staff_row.job_role,
      'department', staff_row.department,
      'designation', staff_row.designation,
      'employment_type', staff_row.employment_type,
      'joining_date', staff_row.joining_date,
      'weekly_off', staff_row.weekly_off,
      'employment_status', staff_row.employment_status,
      'exit_date', staff_row.exit_date,
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

CREATE OR REPLACE FUNCTION public.staff_note_list(
  p_society_id uuid,
  p_staff_id uuid
)
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
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
  THEN
    RAISE EXCEPTION 'Staff notes are not available.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members AS staff
    WHERE staff.society_id = p_society_id AND staff.id = p_staff_id
      AND staff.staff_type = 'society'
  ) THEN
    RAISE EXCEPTION 'The staff member was not found.' USING ERRCODE = 'P0002';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', note.id,
      'staff_id', note.staff_id,
      'note_date', note.note_date,
      'category', note.category,
      'rating', note.rating,
      'note', note.note,
      'action', note.action,
      'follow_up_date', note.follow_up_date,
      'status', note.status,
      'recorded_by', COALESCE(profile.full_name, 'Former member'),
      'created_at', note.created_at,
      'updated_at', note.updated_at,
      'can_edit', is_admin AND note.created_by = current_user_id
    ) ORDER BY note.note_date DESC, note.created_at DESC, note.id)
    FROM public.staff_performance_notes AS note
    LEFT JOIN public.profiles AS profile ON profile.id = note.created_by
    WHERE note.society_id = p_society_id AND note.staff_id = p_staff_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_note_save(
  p_society_id uuid,
  p_note_id uuid,
  p_staff_id uuid,
  p_note_date date,
  p_category text,
  p_rating smallint,
  p_note text,
  p_action text,
  p_follow_up_date date,
  p_status text,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  note_row public.staff_performance_notes;
  previous_row public.staff_performance_notes;
  action_value text := NULLIF(btrim(COALESCE(p_action, '')), '');
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
    OR p_note_date IS NULL
    OR p_category IS NULL
    OR p_category NOT IN ('training_needed', 'warning', 'appraisal', 'appreciation', 'other')
    OR (p_rating IS NOT NULL AND p_rating NOT BETWEEN 1 AND 5)
    OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 1 AND 2000
    OR char_length(COALESCE(action_value, '')) > 500
    OR p_status IS NULL OR p_status NOT IN ('open', 'closed')
    OR (p_note_id IS NOT NULL AND p_expected_updated_at IS NULL)
  THEN
    RAISE EXCEPTION 'The staff note is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_note_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_members AS staff
      WHERE staff.society_id = p_society_id AND staff.id = p_staff_id
        AND staff.staff_type = 'society'
    ) THEN
      RAISE EXCEPTION 'The staff member was not found.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.staff_performance_notes (
      society_id, staff_id, note_date, category, rating, note, action,
      follow_up_date, status, created_by, updated_by
    )
    VALUES (
      p_society_id, p_staff_id, p_note_date, p_category, p_rating,
      btrim(p_note), action_value, p_follow_up_date, p_status,
      current_user_id, current_user_id
    )
    RETURNING * INTO note_row;
  ELSE
    SELECT * INTO previous_row
    FROM public.staff_performance_notes
    WHERE society_id = p_society_id AND id = p_note_id AND staff_id = p_staff_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The staff note was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous_row.created_by <> current_user_id THEN
      RAISE EXCEPTION 'Only the writer can edit this note.' USING ERRCODE = '42501';
    END IF;
    IF previous_row.updated_at <> p_expected_updated_at THEN
      RAISE EXCEPTION 'The staff note has changed.'
        USING ERRCODE = '23505', HINT = 'stale';
    END IF;
    UPDATE public.staff_performance_notes
    SET note_date = p_note_date, category = p_category, rating = p_rating,
        note = btrim(p_note), action = action_value,
        follow_up_date = p_follow_up_date, status = p_status
    WHERE society_id = p_society_id AND id = p_note_id
    RETURNING * INTO note_row;
  END IF;
  -- Note and action text are deliberately kept out of the audit trail (STF-15).
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin',
    CASE WHEN p_note_id IS NULL THEN 'staff.note.create' ELSE 'staff.note.update' END,
    'staff_performance_note', note_row.id::text,
    CASE WHEN p_note_id IS NULL THEN NULL
      ELSE pg_catalog.jsonb_build_object(
        'staff_id', previous_row.staff_id, 'note_date', previous_row.note_date,
        'category', previous_row.category, 'rating', previous_row.rating,
        'follow_up_date', previous_row.follow_up_date,
        'status', previous_row.status
      ) END,
    pg_catalog.jsonb_build_object(
      'staff_id', note_row.staff_id, 'note_date', note_row.note_date,
      'category', note_row.category, 'rating', note_row.rating,
      'follow_up_date', note_row.follow_up_date, 'status', note_row.status
    ),
    p_request_id
  );
  RETURN note_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_note_delete(
  p_society_id uuid,
  p_note_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  note_row public.staff_performance_notes;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'staff')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Staff administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request is invalid.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.staff_performance_notes
  WHERE society_id = p_society_id AND id = p_note_id
  RETURNING * INTO note_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The staff note was not found.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'staff.note.delete',
    'staff_performance_note', note_row.id::text,
    pg_catalog.jsonb_build_object(
      'staff_id', note_row.staff_id, 'note_date', note_row.note_date,
      'category', note_row.category, 'status', note_row.status
    ),
    p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_admin_save(
  uuid, uuid, text, text, text, text, text, text, text, boolean, text, uuid[], text,
  text, text, text, date, text, text, date
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_note_list(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_note_save(
  uuid, uuid, uuid, date, text, smallint, text, text, date, text, timestamptz, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_note_delete(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.staff_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_admin_save(
  uuid, uuid, text, text, text, text, text, text, text, boolean, text, uuid[], text,
  text, text, text, date, text, text, date
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_note_list(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_note_save(
  uuid, uuid, uuid, date, text, smallint, text, text, date, text, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_note_delete(uuid, uuid, text) TO authenticated;
