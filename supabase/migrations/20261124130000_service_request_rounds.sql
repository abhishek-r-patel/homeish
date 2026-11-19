-- Daily checks (P49, PRD SRQ-19): fixed inspection points that admins, housekeeping
-- supervisors and guards mark OK or Issue once per India day, optionally raising or
-- linking a common-area service request.

CREATE TABLE public.service_request_inspection_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  location_note text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT service_request_inspection_points_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT service_request_inspection_points_location_note_check
    CHECK (location_note IS NULL OR char_length(btrim(location_note)) BETWEEN 1 AND 200),
  CONSTRAINT service_request_inspection_points_sort_order_check
    CHECK (sort_order BETWEEN 0 AND 9999),
  CONSTRAINT service_request_inspection_points_society_id_id_key
    UNIQUE (society_id, id)
);

CREATE UNIQUE INDEX service_request_inspection_points_name_key
  ON public.service_request_inspection_points (society_id, lower(btrim(name)));

-- Checks outlive the request they raised; retention may delete that request first.
CREATE TABLE public.service_request_round_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  point_id uuid NOT NULL,
  check_date date NOT NULL,
  result text NOT NULL,
  note text,
  request_id uuid,
  checked_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  client_request_id uuid NOT NULL,
  CONSTRAINT service_request_round_checks_result_check
    CHECK (result IN ('ok', 'issue')),
  CONSTRAINT service_request_round_checks_note_check
    CHECK (
      (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 500)
      AND (result = 'ok' OR note IS NOT NULL)
    ),
  CONSTRAINT service_request_round_checks_request_issue_check
    CHECK (request_id IS NULL OR result = 'issue'),
  CONSTRAINT service_request_round_checks_point_day_key
    UNIQUE (society_id, point_id, check_date),
  CONSTRAINT service_request_round_checks_client_request_key
    UNIQUE (society_id, checked_by, client_request_id),
  CONSTRAINT service_request_round_checks_point_same_society_fkey
    FOREIGN KEY (society_id, point_id)
    REFERENCES public.service_request_inspection_points (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT service_request_round_checks_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.service_requests (society_id, id)
    ON DELETE SET NULL (request_id)
);

CREATE INDEX service_request_round_checks_society_date_idx
  ON public.service_request_round_checks (society_id, check_date);
CREATE INDEX service_request_round_checks_request_idx
  ON public.service_request_round_checks (society_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX service_request_round_checks_checked_by_idx
  ON public.service_request_round_checks (checked_by);
CREATE INDEX service_request_inspection_points_created_by_idx
  ON public.service_request_inspection_points (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX service_request_inspection_points_updated_by_idx
  ON public.service_request_inspection_points (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE TRIGGER service_request_inspection_points_set_updated_at
  BEFORE UPDATE ON public.service_request_inspection_points
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.service_request_inspection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_round_checks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_request_inspection_points,
  public.service_request_round_checks
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.service_request_inspection_points,
  public.service_request_round_checks TO service_role;

CREATE POLICY service_request_inspection_points_no_direct_access
  ON public.service_request_inspection_points
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY service_request_round_checks_no_direct_access
  ON public.service_request_round_checks
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- p_point_id NULL adds a point; points are deactivated, never deleted.
CREATE OR REPLACE FUNCTION public.request_inspection_point_save(
  p_society_id uuid,
  p_point_id uuid,
  p_name text,
  p_location_note text,
  p_sort_order integer,
  p_active boolean,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.service_request_inspection_points;
  after_row public.service_request_inspection_points;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Managing daily check points is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120
    OR (p_location_note IS NOT NULL AND char_length(btrim(p_location_note)) > 200)
    OR p_sort_order IS NULL OR p_sort_order NOT BETWEEN 0 AND 9999
    OR p_active IS NULL
  THEN
    RAISE EXCEPTION 'The check point details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    IF p_point_id IS NULL THEN
      INSERT INTO public.service_request_inspection_points (
        society_id, name, location_note, sort_order, active, created_by, updated_by
      )
      VALUES (
        p_society_id, btrim(p_name), NULLIF(btrim(p_location_note), ''),
        p_sort_order, p_active, current_user_id, current_user_id
      )
      RETURNING * INTO after_row;
    ELSE
      SELECT * INTO before_row
      FROM public.service_request_inspection_points
      WHERE society_id = p_society_id AND id = p_point_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The check point was not found.'
          USING ERRCODE = 'P0002';
      END IF;
      UPDATE public.service_request_inspection_points
      SET name = btrim(p_name),
          location_note = NULLIF(btrim(p_location_note), ''),
          sort_order = p_sort_order,
          active = p_active
      WHERE society_id = p_society_id AND id = p_point_id
      RETURNING * INTO after_row;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'A check point with this name already exists.'
      USING ERRCODE = '23505', HINT = 'duplicate_name';
  END;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin', 'request.inspection_point.save',
    'service_request_inspection_point', after_row.id::text,
    CASE WHEN before_row.id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'name', before_row.name, 'location_note', before_row.location_note,
      'sort_order', before_row.sort_order, 'active', before_row.active
    ) END,
    pg_catalog.jsonb_build_object(
      'name', after_row.name, 'location_note', after_row.location_note,
      'sort_order', after_row.sort_order, 'active', after_row.active
    ),
    p_request_id
  );
  RETURN pg_catalog.to_jsonb(after_row);
END;
$$;

-- Today's points (India date) with any check already recorded. Admins also see
-- inactive points so they can manage them.
CREATE OR REPLACE FUNCTION public.request_rounds_today(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  india_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'hk_supervisor', 'guard']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Daily checks are not available.'
      USING ERRCODE = '42501';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN pg_catalog.jsonb_build_object(
    'check_date', india_today,
    'points', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', point.id,
          'name', point.name,
          'location_note', point.location_note,
          'sort_order', point.sort_order,
          'active', point.active,
          'updated_at', point.updated_at,
          'check', CASE WHEN check_row.id IS NULL THEN NULL
            ELSE pg_catalog.jsonb_build_object(
              'result', check_row.result,
              'note', check_row.note,
              'request_id', check_row.request_id,
              'checked_by_name', checker.full_name,
              'created_at', check_row.created_at
            ) END
        ) ORDER BY point.active DESC, point.sort_order, point.name
      )
      FROM public.service_request_inspection_points AS point
      LEFT JOIN public.service_request_round_checks AS check_row
        ON check_row.society_id = point.society_id
        AND check_row.point_id = point.id
        AND check_row.check_date = india_today
      LEFT JOIN public.profiles AS checker ON checker.id = check_row.checked_by
      WHERE point.society_id = p_society_id
        AND (point.active OR is_admin)
    ), '[]'::jsonb)
  );
END;
$$;

-- Records today's check. For an Issue, p_action 'raise' creates a common-area
-- request with source daily_rounds; 'link' attaches an open request.
CREATE OR REPLACE FUNCTION public.request_round_check_record(
  p_society_id uuid,
  p_point_id uuid,
  p_result text,
  p_note text,
  p_action text,
  p_category_id uuid,
  p_priority text,
  p_link_request_id uuid,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  india_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  point_row public.service_request_inspection_points;
  existing_row public.service_request_round_checks;
  check_row public.service_request_round_checks;
  linked_request uuid;
  new_request public.service_requests;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'hk_supervisor', 'guard']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Recording daily checks is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_client_request_id IS NULL
    OR p_result IS NULL OR p_result NOT IN ('ok', 'issue')
    OR p_action IS NULL OR p_action NOT IN ('none', 'raise', 'link')
    OR (p_note IS NOT NULL AND char_length(btrim(p_note)) > 500)
    OR (p_result = 'issue' AND (
      p_note IS NULL OR char_length(btrim(p_note)) < 1
    ))
    OR (p_result = 'ok' AND p_action <> 'none')
    OR ((p_action = 'raise') <> (p_category_id IS NOT NULL))
    OR ((p_action = 'link') <> (p_link_request_id IS NOT NULL))
    OR (p_priority IS NOT NULL AND p_action <> 'raise')
  THEN
    RAISE EXCEPTION 'The check details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing_row
  FROM public.service_request_round_checks
  WHERE society_id = p_society_id
    AND checked_by = current_user_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN pg_catalog.to_jsonb(existing_row);
  END IF;

  SELECT * INTO point_row
  FROM public.service_request_inspection_points
  WHERE society_id = p_society_id AND id = p_point_id AND active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The check point was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.service_request_round_checks
    WHERE society_id = p_society_id AND point_id = p_point_id
      AND check_date = india_today
  ) THEN
    RAISE EXCEPTION 'This point has already been checked today.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  IF p_action = 'link' THEN
    SELECT request.id INTO linked_request
    FROM public.service_requests AS request
    WHERE request.society_id = p_society_id
      AND request.id = p_link_request_id
      AND request.location_type = 'common_area'
      AND request.status IN ('open', 'assigned', 'in_progress', 'reopened');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose an open common-area request to link.'
        USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_action = 'raise' THEN
    new_request := private.service_request_insert(
      p_society_id, p_category_id, 'common_area', NULL,
      pg_catalog.left(point_row.name || ': ' || btrim(p_note), 2000),
      COALESCE(p_priority, 'medium'), '[]'::jsonb, p_client_request_id,
      p_request_trace, 'daily_rounds', false
    );
    linked_request := new_request.id;
  END IF;

  BEGIN
    INSERT INTO public.service_request_round_checks (
      society_id, point_id, check_date, result, note, request_id, checked_by,
      client_request_id
    )
    VALUES (
      p_society_id, p_point_id, india_today, p_result,
      NULLIF(btrim(p_note), ''), linked_request, current_user_id,
      p_client_request_id
    )
    RETURNING * INTO check_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This point has already been checked today.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END;
  RETURN pg_catalog.to_jsonb(check_row);
END;
$$;

-- OK rate and the points with the most issues over the last p_days India days.
CREATE OR REPLACE FUNCTION public.request_rounds_report(
  p_society_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  india_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  from_day date;
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The daily check report is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'The report period is invalid.'
      USING ERRCODE = '22023';
  END IF;
  from_day := india_today - (p_days - 1);
  RETURN pg_catalog.jsonb_build_object(
    'from', from_day,
    'to', india_today,
    'totals', (
      SELECT pg_catalog.jsonb_build_object(
        'checks', count(*),
        'ok', count(*) FILTER (WHERE check_row.result = 'ok'),
        'issues', count(*) FILTER (WHERE check_row.result = 'issue'),
        'ok_pct', CASE WHEN count(*) = 0 THEN NULL ELSE round(
          100.0 * count(*) FILTER (WHERE check_row.result = 'ok') / count(*), 1
        ) END
      )
      FROM public.service_request_round_checks AS check_row
      WHERE check_row.society_id = p_society_id
        AND check_row.check_date BETWEEN from_day AND india_today
    ),
    'points', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'point_id', grouped.point_id, 'name', grouped.name,
          'checks', grouped.checks, 'issues', grouped.issues
        ) ORDER BY grouped.issues DESC, grouped.name
      )
      FROM (
        SELECT point.id AS point_id, point.name,
          count(check_row.id) AS checks,
          count(check_row.id) FILTER (WHERE check_row.result = 'issue') AS issues
        FROM public.service_request_inspection_points AS point
        JOIN public.service_request_round_checks AS check_row
          ON check_row.society_id = point.society_id
          AND check_row.point_id = point.id
          AND check_row.check_date BETWEEN from_day AND india_today
        WHERE point.society_id = p_society_id
        GROUP BY point.id, point.name
        ORDER BY issues DESC, point.name
        LIMIT 10
      ) AS grouped
    ), '[]'::jsonb)
  );
END;
$$;

-- Choices for staff who log requests or raise them from daily checks: active
-- categories and the newest open common-area requests to link an Issue to.
CREATE OR REPLACE FUNCTION public.request_intake_options(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'hk_supervisor', 'guard']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request options are not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'categories', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', category.id, 'name', category.name)
        ORDER BY category.sort_order, category.name
      )
      FROM public.service_request_categories AS category
      WHERE category.society_id = p_society_id AND category.active
    ), '[]'::jsonb),
    'open_common_requests', COALESCE((
      SELECT pg_catalog.jsonb_agg(row_data ORDER BY created_at DESC)
      FROM (
        SELECT request.created_at, pg_catalog.jsonb_build_object(
          'id', request.id,
          'category', category.name,
          'summary', pg_catalog.left(request.description, 80),
          'created_at', request.created_at
        ) AS row_data
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id
          AND category.id = request.category_id
        WHERE request.society_id = p_society_id
          AND request.location_type = 'common_area'
          AND request.status IN ('open', 'assigned', 'in_progress', 'reopened')
        ORDER BY request.created_at DESC
        LIMIT 50
      ) AS recent
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_inspection_point_save(
    uuid, uuid, text, text, integer, boolean, text
  ),
  public.request_rounds_today(uuid),
  public.request_round_check_record(
    uuid, uuid, text, text, text, uuid, text, uuid, uuid, text
  ),
  public.request_rounds_report(uuid, integer),
  public.request_intake_options(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_inspection_point_save(
    uuid, uuid, text, text, integer, boolean, text
  ),
  public.request_rounds_today(uuid),
  public.request_round_check_record(
    uuid, uuid, text, text, text, uuid, text, uuid, uuid, text
  ),
  public.request_rounds_report(uuid, integer),
  public.request_intake_options(uuid)
  TO authenticated;

-- Same as 20261117140000 plus daily checks older than two years (SRQ-19).
CREATE OR REPLACE FUNCTION public.housekeeping_retention_run(
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
  visitor_count integer := 0;
  delivery_count integer := 0;
  pre_approval_count integer := 0;
  pre_approval_reference_count integer := 0;
  request_attachment_count integer := 0;
  request_comment_count integer := 0;
  request_event_count integer := 0;
  request_count integer := 0;
  round_check_count integer := 0;
  notification_count integer := 0;
  error_log_count integer := 0;
  audit_log_count integer := 0;
  job_count integer := 0;
  job_run_count integer := 0;
  rate_limit_count integer := 0;
  orphan_visitor_count integer := 0;
  orphan_delivery_count integer := 0;
  orphan_request_count integer := 0;
  orphan_payment_count integer := 0;
  orphan_asset_count integer := 0;
  orphan_notice_count integer := 0;
  orphan_file_report jsonb;
  retention_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Invalid retention arguments.'
      USING ERRCODE = '22023';
  END IF;

  retention_day := p_today::timestamp AT TIME ZONE 'Asia/Kolkata';

  PERFORM pg_catalog.set_config('homeish.retention_purge', 'on', true);

  UPDATE public.visitor_entries AS entry
  SET visitor_name = '[Anonymized]',
      visitor_phone = NULL,
      vehicle_no = NULL,
      photo_path = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE entry.created_at < retention_day - interval '1 year'
    AND (entry.visitor_name <> '[Anonymized]'
      OR entry.visitor_phone IS NOT NULL
      OR entry.vehicle_no IS NOT NULL
      OR entry.photo_path IS NOT NULL)
    AND (
      entry.photo_path IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'visitor-photos'
          AND object.name = entry.photo_path
      )
    );
  GET DIAGNOSTICS visitor_count = ROW_COUNT;

  UPDATE public.delivery_entries AS entry
  SET delivery_person = NULL,
      photo_path = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE entry.created_at < retention_day - interval '1 year'
    AND (entry.delivery_person IS NOT NULL OR entry.photo_path IS NOT NULL)
    AND (
      entry.photo_path IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'delivery-photos'
          AND object.name = entry.photo_path
      )
    );
  GET DIAGNOSTICS delivery_count = ROW_COUNT;

  UPDATE public.visitor_entries AS entry
  SET pre_approval_id = NULL
  WHERE EXISTS (
    SELECT 1
    FROM public.visitor_pre_approvals AS approval
    WHERE approval.id = entry.pre_approval_id
      AND approval.society_id = entry.society_id
      AND approval.valid_to < retention_day - interval '1 year'
  );
  GET DIAGNOSTICS pre_approval_reference_count = ROW_COUNT;

  DELETE FROM public.visitor_pre_approvals AS approval
  WHERE approval.valid_to < retention_day - interval '1 year'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visitor_entries AS entry
      WHERE entry.pre_approval_id = approval.id
        AND entry.society_id = approval.society_id
    );
  GET DIAGNOSTICS pre_approval_count = ROW_COUNT;

  DELETE FROM public.service_request_attachments AS attachment
  WHERE EXISTS (
    SELECT 1
    FROM public.service_requests AS request
    WHERE request.id = attachment.request_id
      AND request.society_id = attachment.society_id
      AND request.status = 'closed'
      AND request.closed_at < retention_day - interval '2 years'
      AND NOT EXISTS (
        SELECT 1
        FROM public.amc_request_links AS link
        WHERE link.society_id = request.society_id
          AND link.request_id = request.id
      )
  )
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects AS object
      WHERE object.bucket_id = 'request-files'
        AND object.name = attachment.storage_path
    );
  GET DIAGNOSTICS request_attachment_count = ROW_COUNT;

  DELETE FROM public.service_request_comments AS comment
  WHERE EXISTS (
    SELECT 1
    FROM public.service_requests AS request
    WHERE request.id = comment.request_id
      AND request.society_id = comment.society_id
      AND request.status = 'closed'
      AND request.closed_at < retention_day - interval '2 years'
      AND NOT EXISTS (
        SELECT 1
        FROM public.amc_request_links AS link
        WHERE link.society_id = request.society_id
          AND link.request_id = request.id
      )
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.request_id = comment.request_id
    );
  GET DIAGNOSTICS request_comment_count = ROW_COUNT;

  DELETE FROM public.service_request_events AS event
  WHERE EXISTS (
    SELECT 1
    FROM public.service_requests AS request
    WHERE request.id = event.request_id
      AND request.society_id = event.society_id
      AND request.status = 'closed'
      AND request.closed_at < retention_day - interval '2 years'
      AND NOT EXISTS (
        SELECT 1
        FROM public.amc_request_links AS link
        WHERE link.society_id = request.society_id
          AND link.request_id = request.id
      )
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.request_id = event.request_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_comments AS comment
      WHERE comment.request_id = event.request_id
    );
  GET DIAGNOSTICS request_event_count = ROW_COUNT;

  DELETE FROM public.service_requests AS request
  WHERE request.status = 'closed'
    AND request.closed_at < retention_day - interval '2 years'
    AND NOT EXISTS (
      SELECT 1
      FROM public.amc_request_links AS link
      WHERE link.society_id = request.society_id
        AND link.request_id = request.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.request_id = request.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_comments AS comment
      WHERE comment.request_id = request.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_events AS event
      WHERE event.request_id = request.id
    );
  GET DIAGNOSTICS request_count = ROW_COUNT;

  DELETE FROM public.service_request_round_checks
  WHERE check_date < (retention_day - interval '2 years')::date;
  GET DIAGNOSTICS round_check_count = ROW_COUNT;

  DELETE FROM public.notifications
  WHERE created_at < retention_day - interval '180 days';
  GET DIAGNOSTICS notification_count = ROW_COUNT;

  DELETE FROM public.error_logs
  WHERE created_at < retention_day - interval '90 days';
  GET DIAGNOSTICS error_log_count = ROW_COUNT;

  DELETE FROM public.audit_logs
  WHERE created_at < retention_day - interval '2 years';
  GET DIAGNOSTICS audit_log_count = ROW_COUNT;

  DELETE FROM public.jobs
  WHERE created_at < retention_day - interval '90 days';
  GET DIAGNOSTICS job_count = ROW_COUNT;

  DELETE FROM public.job_run_keys
  WHERE ran_at < retention_day - interval '90 days';
  GET DIAGNOSTICS job_run_count = ROW_COUNT;

  DELETE FROM public.rate_limits
  WHERE window_start < retention_day - interval '1 day';
  GET DIAGNOSTICS rate_limit_count = ROW_COUNT;

  SELECT count(*)::integer INTO orphan_visitor_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'visitor-photos'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visitor_entries AS entry
      WHERE entry.photo_path = object.name
    );

  SELECT count(*)::integer INTO orphan_delivery_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'delivery-photos'
    AND NOT EXISTS (
      SELECT 1
      FROM public.delivery_entries AS entry
      WHERE entry.photo_path = object.name
    );

  SELECT count(*)::integer INTO orphan_request_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'request-files'
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.storage_path = object.name
    );

  SELECT count(*)::integer INTO orphan_payment_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'payment-proofs'
    AND NOT EXISTS (
      SELECT 1
      FROM public.billing_payments AS payment
      WHERE payment.proof_path = object.name
    );

  SELECT count(*)::integer INTO orphan_asset_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'society-assets'
    AND NOT EXISTS (
      SELECT 1
      FROM public.societies AS society
      WHERE society.logo_path = object.name
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.billing_payment_details AS details
      WHERE details.qr_path = object.name
    );

  SELECT count(*)::integer INTO orphan_notice_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'notice-files'
    AND NOT EXISTS (
      SELECT 1
      FROM public.notices AS notice
      WHERE notice.attachment_path = object.name
    );

  orphan_file_report := pg_catalog.jsonb_build_object(
    'visitor-photos', orphan_visitor_count,
    'delivery-photos', orphan_delivery_count,
    'request-files', orphan_request_count,
    'payment-proofs', orphan_payment_count,
    'society-assets', orphan_asset_count,
    'notice-files', orphan_notice_count
  );

  retention_result := pg_catalog.jsonb_build_object(
    'visitorEntriesAnonymized', visitor_count,
    'deliveryEntriesAnonymized', delivery_count,
    'preApprovalReferencesCleared', pre_approval_reference_count,
    'preApprovalsDeleted', pre_approval_count,
    'requestAttachmentsDeleted', request_attachment_count,
    'requestCommentsDeleted', request_comment_count,
    'requestEventsDeleted', request_event_count,
    'requestsDeleted', request_count,
    'roundChecksDeleted', round_check_count,
    'notificationsDeleted', notification_count,
    'errorLogsDeleted', error_log_count,
    'auditLogsDeleted', audit_log_count,
    'jobsDeleted', job_count,
    'jobRunKeysDeleted', job_run_count,
    'rateLimitsDeleted', rate_limit_count,
    'orphanFilesReported', orphan_file_report
  );

  IF visitor_count + delivery_count + pre_approval_reference_count
    + pre_approval_count
    + request_attachment_count + request_comment_count + request_event_count
    + request_count + round_check_count + notification_count + error_log_count + audit_log_count
    + job_count + job_run_count + rate_limit_count
    + orphan_visitor_count + orphan_delivery_count + orphan_request_count
    + orphan_payment_count + orphan_asset_count + orphan_notice_count > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.audit_logs AS audit
      WHERE audit.action = 'housekeeping.retention'
        AND audit.entity_type = 'retention_run'
        AND audit.entity_id = p_today::text
    )
  THEN
    INSERT INTO public.audit_logs (
      actor_role,
      action,
      entity_type,
      entity_id,
      "after",
      request_id
    )
    VALUES (
      'service_role',
      'housekeeping.retention',
      'retention_run',
      p_today::text,
      retention_result,
      p_request_trace
    );
  END IF;

  RETURN retention_result;
END;
$$;
