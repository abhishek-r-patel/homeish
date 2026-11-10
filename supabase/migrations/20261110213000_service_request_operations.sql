CREATE OR REPLACE FUNCTION private.service_request_event(
  p_society_id uuid,
  p_request_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.service_request_events (
    society_id, request_id, event_type, from_status, to_status, note, created_by
  )
  VALUES (
    p_society_id, p_request_id, p_event_type, p_from_status, p_to_status,
    NULLIF(p_note, ''), auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.service_request_admin_notify(
  p_society_id uuid,
  p_request_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_request_trace text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient record;
BEGIN
  FOR recipient IN
    SELECT membership.user_id
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND membership.roles @> ARRAY['admin']::text[]
  LOOP
    PERFORM private.create_notification(
      p_society_id,
      recipient.user_id,
      p_type,
      p_title,
      p_body,
      'service_request',
      p_request_id,
      p_request_trace
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.service_request_event(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.service_request_admin_notify(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_categories_list(
  p_society_id uuid,
  p_include_inactive boolean DEFAULT false
)
RETURNS SETOF public.service_request_categories
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request categories are not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_include_inactive
    AND NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Inactive categories are not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT category.*
  FROM public.service_request_categories AS category
  WHERE category.society_id = p_society_id
    AND (category.active OR p_include_inactive)
  ORDER BY category.sort_order, category.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_list(
  p_society_id uuid,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service requests are not available.'
      USING ERRCODE = '42501';
  END IF;
  IF (p_status IS NOT NULL AND p_status NOT IN (
      'open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
    ))
    OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset < 0
    OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from)
  THEN
    RAISE EXCEPTION 'The request filters are invalid.'
      USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(filtered)
      ORDER BY filtered.is_overdue DESC, filtered.created_at DESC
    )
    FROM (
      SELECT
        request.*,
        category.name AS category_name,
        unit.number AS unit_number,
        requester.full_name AS requester_name,
        assignee_profile.full_name AS assignee_name,
        COALESCE(
          request.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request.sla_due_at < now(),
          false
        ) AS is_overdue
      FROM public.service_requests AS request
      JOIN public.service_request_categories AS category
        ON category.society_id = request.society_id
        AND category.id = request.category_id
      LEFT JOIN public.units AS unit
        ON unit.society_id = request.society_id AND unit.id = request.unit_id
      LEFT JOIN public.profiles AS requester
        ON requester.id = request.created_by
      LEFT JOIN public.memberships AS assignee
        ON assignee.society_id = request.society_id
        AND assignee.id = request.assigned_membership_id
      LEFT JOIN public.profiles AS assignee_profile
        ON assignee_profile.id = assignee.user_id
      WHERE request.society_id = p_society_id
        AND (
          private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
          OR (request.location_type = 'unit'
            AND private.occupies_unit(request.unit_id))
          OR (request.location_type = 'common_area'
            AND private.has_role(p_society_id, ARRAY['resident']::text[]))
          OR EXISTS (
            SELECT 1 FROM public.memberships AS current_assignee
            WHERE current_assignee.society_id = request.society_id
              AND current_assignee.id = request.assigned_membership_id
              AND current_assignee.user_id = current_user_id
              AND current_assignee.status = 'active'
          )
        )
        AND (p_status IS NULL OR request.status = p_status)
        AND (p_category_id IS NULL OR request.category_id = p_category_id)
        AND (p_unit_id IS NULL OR request.unit_id = p_unit_id)
        AND (p_assignee_id IS NULL
          OR request.assigned_membership_id = p_assignee_id)
        AND (p_from IS NULL OR request.created_at::date >= p_from)
        AND (p_to IS NULL OR request.created_at::date <= p_to)
      ORDER BY
        CASE WHEN request.status IN ('open', 'assigned', 'in_progress', 'reopened')
          AND request.sla_due_at < now() THEN 0 ELSE 1 END,
        request.created_at DESC
      LIMIT p_limit OFFSET p_offset
    ) AS filtered
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_get(
  p_society_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The service request is not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT request.* INTO request_row
  FROM public.service_requests AS request
  WHERE request.society_id = p_society_id AND request.id = p_request_id
    AND (
      private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
      OR (request.location_type = 'unit'
        AND private.occupies_unit(request.unit_id))
      OR (request.location_type = 'common_area'
        AND private.has_role(p_society_id, ARRAY['resident']::text[]))
      OR EXISTS (
        SELECT 1 FROM public.memberships AS assignee
        WHERE assignee.society_id = request.society_id
          AND assignee.id = request.assigned_membership_id
          AND assignee.user_id = current_user_id
          AND assignee.status = 'active'
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The service request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'request', pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object(
      'category_name', (
        SELECT name FROM public.service_request_categories
        WHERE society_id = p_society_id AND id = request_row.category_id
      ),
      'unit_number', (
        SELECT number FROM public.units
        WHERE society_id = p_society_id AND id = request_row.unit_id
      ),
      'requester_name', (
        SELECT full_name FROM public.profiles WHERE id = request_row.created_by
      ),
      'assignee_name', (
        SELECT profile.full_name
        FROM public.memberships AS member
        JOIN public.profiles AS profile ON profile.id = member.user_id
        WHERE member.society_id = p_society_id
          AND member.id = request_row.assigned_membership_id
      ),
      'is_overdue',
        COALESCE(
          request_row.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request_row.sla_due_at < now(),
          false
        )
    ),
    'comments', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(comment) || pg_catalog.jsonb_build_object(
          'author_name', profile.full_name
        ) ORDER BY comment.created_at
      )
      FROM public.service_request_comments AS comment
      JOIN public.profiles AS profile ON profile.id = comment.created_by
      WHERE comment.society_id = p_society_id
        AND comment.request_id = p_request_id
    ), '[]'::jsonb),
    'attachments', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(attachment) ORDER BY attachment.created_at
      )
      FROM public.service_request_attachments AS attachment
      WHERE attachment.society_id = p_society_id
        AND attachment.request_id = p_request_id
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(event) || pg_catalog.jsonb_build_object(
          'actor_name', profile.full_name
        ) ORDER BY event.created_at
      )
      FROM public.service_request_events AS event
      LEFT JOIN public.profiles AS profile ON profile.id = event.created_by
      WHERE event.society_id = p_society_id
        AND event.request_id = p_request_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_assignees_list(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request assignees are not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'membership_id', membership.id,
        'user_id', membership.user_id,
        'name', profile.full_name,
        'roles', membership.roles
      ) ORDER BY profile.full_name, membership.id
    )
    FROM public.memberships AS membership
    JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND NOT (membership.roles && ARRAY['guard']::text[])
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_category_save(
  p_society_id uuid,
  p_category_id uuid,
  p_name text,
  p_sla_hours integer,
  p_sort_order integer,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_id text
)
RETURNS public.service_request_categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  before_row public.service_request_categories;
  after_row public.service_request_categories;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Service request administration is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
    OR p_sort_order NOT BETWEEN 0 AND 10000
    OR (p_sla_hours IS NOT NULL AND p_sla_hours NOT BETWEEN 1 AND 8760)
    OR p_active IS NULL
  THEN
    RAISE EXCEPTION 'The category details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  IF p_category_id IS NULL THEN
    INSERT INTO public.service_request_categories (
      society_id, name, sla_hours, sort_order, active, created_by, updated_by
    )
    VALUES (
      p_society_id, btrim(p_name), p_sla_hours, p_sort_order, p_active,
      current_user_id, current_user_id
    )
    RETURNING * INTO after_row;
  ELSE
    SELECT * INTO before_row
    FROM public.service_request_categories
    WHERE society_id = p_society_id AND id = p_category_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The category was not found.'
        USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_updated_at IS NULL
      OR before_row.updated_at <> p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The category changed in another session.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;

    UPDATE public.service_request_categories
    SET name = btrim(p_name),
        sla_hours = p_sla_hours,
        sort_order = p_sort_order,
        active = p_active,
        updated_by = current_user_id
    WHERE society_id = p_society_id AND id = p_category_id
    RETURNING * INTO after_row;
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, current_user_id, 'admin',
    CASE WHEN p_category_id IS NULL
      THEN 'request.categories.create' ELSE 'request.categories.update' END,
    'service_request_category', after_row.id::text,
    CASE WHEN p_category_id IS NULL THEN NULL ELSE
      pg_catalog.jsonb_build_object(
        'name', before_row.name, 'sla_hours', before_row.sla_hours,
        'sort_order', before_row.sort_order, 'active', before_row.active
      )
    END,
    pg_catalog.jsonb_build_object(
      'name', after_row.name, 'sla_hours', after_row.sla_hours,
      'sort_order', after_row.sort_order, 'active', after_row.active
    ),
    p_request_id
  );
  RETURN after_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_create(
  p_society_id uuid,
  p_category_id uuid,
  p_location_type text,
  p_unit_id uuid,
  p_description text,
  p_priority text,
  p_attachments jsonb,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_row public.service_requests;
  new_row public.service_requests;
  sla integer;
  attachment jsonb;
  attachment_count integer;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'resident']::text[]
    )
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request creation is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_client_request_id IS NULL
    OR p_description IS NULL
    OR char_length(btrim(p_description)) NOT BETWEEN 1 AND 2000
    OR p_priority NOT IN ('normal', 'urgent')
    OR p_location_type NOT IN ('unit', 'common_area')
    OR (p_location_type = 'unit') <> (p_unit_id IS NOT NULL)
    OR pg_catalog.jsonb_typeof(COALESCE(p_attachments, '[]'::jsonb)) <> 'array'
  THEN
    RAISE EXCEPTION 'The request details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing_row
  FROM public.service_requests
  WHERE society_id = p_society_id
    AND created_by = current_user_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN existing_row; END IF;

  IF p_location_type = 'unit' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.society_id = p_society_id
        AND unit.id = p_unit_id AND unit.active
    ) THEN
      RAISE EXCEPTION 'The unit was not found.'
        USING ERRCODE = 'P0002';
    END IF;
    IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
      AND NOT private.occupies_unit(p_unit_id)
    THEN
      RAISE EXCEPTION 'The requester does not occupy this unit.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT category.sla_hours INTO sla
  FROM public.service_request_categories AS category
  WHERE category.society_id = p_society_id
    AND category.id = p_category_id AND category.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request category was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  attachment_count := pg_catalog.jsonb_array_length(
    COALESCE(p_attachments, '[]'::jsonb)
  );
  IF attachment_count > 3 THEN
    RAISE EXCEPTION 'A request can have at most three photos.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_requests (
    society_id, created_by, updated_by, category_id, location_type, unit_id,
    description, priority, sla_due_at, client_request_id
  )
  VALUES (
    p_society_id, current_user_id, current_user_id, p_category_id,
    p_location_type, p_unit_id, btrim(p_description), p_priority,
    CASE WHEN sla IS NULL THEN NULL ELSE now() + make_interval(hours => sla) END,
    p_client_request_id
  )
  RETURNING * INTO new_row;

  FOR attachment IN
    SELECT value FROM pg_catalog.jsonb_array_elements(
      COALESCE(p_attachments, '[]'::jsonb)
    )
  LOOP
    IF attachment->>'path' !~
      ('^' || p_society_id::text || '/' || current_user_id::text
        || '/requests/' || p_client_request_id::text
        || '/[0-9a-f-]{36}\.(jpg|png)$')
      OR attachment->>'content_type' NOT IN ('image/jpeg', 'image/png')
      OR NOT (attachment->>'size_bytes') ~ '^[1-9][0-9]{0,6}$'
      OR (attachment->>'size_bytes')::integer > 5242880
    THEN
      RAISE EXCEPTION 'A request photo is invalid.'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.service_request_attachments (
      society_id, created_by, request_id, storage_path, content_type, size_bytes
    )
    VALUES (
      p_society_id, current_user_id, new_row.id,
      attachment->>'path', attachment->>'content_type',
      (attachment->>'size_bytes')::integer
    );
  END LOOP;

  PERFORM private.service_request_event(
    p_society_id, new_row.id, 'created', NULL, 'open', NULL
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, new_row.id, 'service_request_created',
    'New service request',
    'A resident submitted a new ' || p_priority || ' request.',
    p_request_id
  );
  RETURN new_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_assign(
  p_society_id uuid,
  p_request_id uuid,
  p_membership_id uuid,
  p_vendor_name text,
  p_vendor_phone text,
  p_note text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  previous_assignee uuid;
  next_status text;
  event text;
  old_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request assignment is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF (p_membership_id IS NULL) = (p_vendor_name IS NULL)
    OR (p_vendor_name IS NOT NULL AND (
      char_length(btrim(p_vendor_name)) NOT BETWEEN 1 AND 120
      OR p_vendor_phone IS NULL
      OR char_length(btrim(p_vendor_phone)) NOT BETWEEN 7 AND 20
    ))
    OR (p_vendor_name IS NULL AND p_vendor_phone IS NOT NULL)
    OR (p_note IS NOT NULL AND char_length(p_note) > 500)
  THEN
    RAISE EXCEPTION 'The assignment details are invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF p_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships AS member
    WHERE member.society_id = p_society_id
      AND member.id = p_membership_id
      AND member.status = 'active'
      AND NOT (member.roles && ARRAY['guard']::text[])
  ) THEN
    RAISE EXCEPTION 'The assignee is not an active society member.'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.status NOT IN ('open', 'assigned', 'in_progress', 'reopened') THEN
    RAISE EXCEPTION 'This request can no longer be assigned.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  previous_assignee := request_row.assigned_membership_id;
  old_status := request_row.status;
  next_status := CASE WHEN request_row.status = 'open' THEN 'assigned'
    ELSE request_row.status END;
  event := CASE WHEN previous_assignee IS NULL
      AND request_row.assigned_vendor_name IS NULL
    THEN 'assigned' ELSE 'reassigned' END;

  UPDATE public.service_requests
  SET assigned_membership_id = p_membership_id,
      assigned_vendor_name = NULLIF(btrim(p_vendor_name), ''),
      assigned_vendor_phone = NULLIF(btrim(p_vendor_phone), ''),
      status = next_status,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;

  PERFORM private.service_request_event(
    p_society_id, p_request_id, event, old_status, next_status, p_note
  );
  IF request_row.created_by <> current_user_id THEN
    PERFORM private.create_notification(
      p_society_id, request_row.created_by, 'service_request_assigned',
      'Request assignment updated', 'Your service request assignment changed.',
      'service_request', p_request_id, p_request_trace
    );
  END IF;
  IF p_membership_id IS NOT NULL THEN
    PERFORM private.create_notification(
      p_society_id,
      (SELECT user_id FROM public.memberships WHERE id = p_membership_id),
      'service_request_assigned',
      'Service request assigned',
      'A service request has been assigned to you.',
      'service_request', p_request_id, p_request_trace
    );
  END IF;
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_update_status(
  p_society_id uuid,
  p_request_id uuid,
  p_status text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  old_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request status updates are not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('in_progress', 'resolved') THEN
    RAISE EXCEPTION 'The requested status is invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships AS member
      WHERE member.society_id = p_society_id
        AND member.id = request_row.assigned_membership_id
        AND member.user_id = current_user_id
        AND member.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'Only an administrator or the assigned member can update status.'
      USING ERRCODE = '42501';
  END IF;
  old_status := request_row.status;
  IF NOT (
    (old_status = 'assigned' AND p_status IN ('in_progress', 'resolved'))
    OR (old_status = 'in_progress' AND p_status = 'resolved')
    OR (old_status = 'reopened' AND p_status IN ('in_progress', 'resolved'))
  ) THEN
    RAISE EXCEPTION 'The status transition is not allowed.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;

  UPDATE public.service_requests
  SET status = p_status,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
      closed_at = NULL,
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'status_changed', old_status, p_status, NULL
  );
  PERFORM private.create_notification(
    p_society_id, request_row.created_by, 'service_request_status',
    'Request status updated',
    'Your request is now ' || replace(p_status, '_', ' ') || '.',
    'service_request', p_request_id, p_request_trace
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_reject(
  p_society_id uuid,
  p_request_id uuid,
  p_reason text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  old_status text;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request rejection is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'A rejection reason is required.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.status NOT IN ('open', 'assigned', 'in_progress', 'reopened') THEN
    RAISE EXCEPTION 'This request can no longer be rejected.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  old_status := request_row.status;
  UPDATE public.service_requests
  SET status = 'rejected', reject_reason = btrim(p_reason),
      assigned_membership_id = NULL, assigned_vendor_name = NULL,
      assigned_vendor_phone = NULL, updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'rejected', old_status, 'rejected', btrim(p_reason)
  );
  PERFORM private.create_notification(
    p_society_id, request_row.created_by, 'service_request_rejected',
    'Request rejected', btrim(p_reason), 'service_request', p_request_id,
    p_request_trace
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_confirm_close(
  p_society_id uuid,
  p_request_id uuid,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  close_days integer;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request confirmation is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.created_by <> current_user_id
    OR request_row.status <> 'resolved'
  THEN
    RAISE EXCEPTION 'Only the requester can confirm a resolved request.'
      USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((settings->>'auto_close_days')::integer, 3) INTO close_days
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'service_request';
  IF now() > request_row.resolved_at
      + make_interval(days => COALESCE(close_days, 3)) THEN
    RAISE EXCEPTION 'The confirmation window has expired.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  UPDATE public.service_requests
  SET status = 'closed', closed_at = now(), updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'confirmed', 'resolved', 'closed', NULL
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, p_request_id, 'service_request_closed',
    'Request closed', 'A resident confirmed a resolved request.',
    p_request_trace
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_reopen(
  p_society_id uuid,
  p_request_id uuid,
  p_reason text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  close_days integer;
  previous_status text;
  window_end timestamptz;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request reopening is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'A reopening reason is required.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.created_by <> current_user_id
    OR request_row.status NOT IN ('resolved', 'closed')
  THEN
    RAISE EXCEPTION 'Only the requester can reopen a resolved or closed request.'
      USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((settings->>'auto_close_days')::integer, 3) INTO close_days
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'service_request';
  window_end := COALESCE(request_row.closed_at, request_row.resolved_at)
    + make_interval(days => COALESCE(close_days, 3));
  IF now() > window_end THEN
    RAISE EXCEPTION 'The reopening window has expired.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  previous_status := request_row.status;
  UPDATE public.service_requests
  SET status = 'reopened', resolved_at = NULL, closed_at = NULL,
      rating = NULL, rating_comment = NULL, updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'reopened', previous_status, 'reopened',
    btrim(p_reason)
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, p_request_id, 'service_request_reopened',
    'Request reopened', 'A resident reopened a service request.',
    p_request_trace
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_rate(
  p_society_id uuid,
  p_request_id uuid,
  p_rating integer,
  p_comment text,
  p_request_trace text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request rating is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_rating NOT BETWEEN 1 AND 5
    OR (p_comment IS NOT NULL AND char_length(p_comment) > 500)
  THEN
    RAISE EXCEPTION 'The rating is invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.created_by <> current_user_id OR request_row.status <> 'closed' THEN
    RAISE EXCEPTION 'Only the requester can rate a closed request.'
      USING ERRCODE = '42501';
  END IF;
  IF request_row.rating IS NOT NULL THEN
    RAISE EXCEPTION 'This request has already been rated.'
      USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  UPDATE public.service_requests
  SET rating = p_rating, rating_comment = NULLIF(btrim(p_comment), ''),
      updated_by = current_user_id
  WHERE id = p_request_id AND society_id = p_society_id
  RETURNING * INTO request_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'rated', 'closed', 'closed', NULL
  );
  PERFORM private.service_request_admin_notify(
    p_society_id, p_request_id, 'service_request_rated',
    'Request rated', 'A resident rated a completed service request.',
    p_request_trace
  );
  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_add_comment(
  p_society_id uuid,
  p_request_id uuid,
  p_body text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS public.service_request_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  comment_row public.service_request_comments;
  recipient uuid;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'Request comments are not allowed.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'The society is not writable.'
      USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'The comment is invalid.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO request_row
  FROM public.service_requests
  WHERE society_id = p_society_id AND id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF request_row.created_by <> current_user_id
    AND NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships AS assignee
      WHERE assignee.society_id = p_society_id
        AND assignee.id = request_row.assigned_membership_id
        AND assignee.user_id = current_user_id
        AND assignee.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'Only the requester, an administrator or the assignee may comment.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO comment_row
  FROM public.service_request_comments
  WHERE society_id = p_society_id AND created_by = current_user_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN comment_row; END IF;

  INSERT INTO public.service_request_comments (
    society_id, created_by, request_id, body, client_request_id
  )
  VALUES (
    p_society_id, current_user_id, p_request_id, btrim(p_body),
    p_client_request_id
  )
  RETURNING * INTO comment_row;
  PERFORM private.service_request_event(
    p_society_id, p_request_id, 'commented', NULL, NULL, NULL
  );

  IF current_user_id = request_row.created_by THEN
    IF request_row.assigned_membership_id IS NOT NULL THEN
      SELECT user_id INTO recipient FROM public.memberships
      WHERE id = request_row.assigned_membership_id;
      PERFORM private.create_notification(
        p_society_id, recipient, 'service_request_comment',
        'New request comment', 'A resident added a comment to an assigned request.',
        'service_request', p_request_id, p_request_trace
      );
    ELSE
      PERFORM private.service_request_admin_notify(
        p_society_id, p_request_id, 'service_request_comment',
        'New request comment', 'A resident added a comment to a request.',
        p_request_trace
      );
    END IF;
  ELSE
    PERFORM private.create_notification(
      p_society_id, request_row.created_by, 'service_request_comment',
      'New request comment', 'A new comment was added to your request.',
      'service_request', p_request_id, p_request_trace
    );
  END IF;
  RETURN comment_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_auto_close_run(
  p_society_id uuid,
  p_today date,
  p_request_trace text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  close_days integer;
  closed_count integer;
  cutoff timestamptz;
  request_row public.service_requests;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'The daily request job requires service role.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'service_request') THEN
    RETURN 0;
  END IF;
  SELECT COALESCE((settings->>'auto_close_days')::integer, 3) INTO close_days
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'service_request';
  cutoff := p_today::timestamp AT TIME ZONE 'Asia/Kolkata';
  closed_count := 0;
  FOR request_row IN
    SELECT * FROM public.service_requests
    WHERE society_id = p_society_id AND status = 'resolved'
      AND resolved_at + make_interval(days => close_days)
        <= cutoff
    FOR UPDATE
  LOOP
    UPDATE public.service_requests
    SET status = 'closed', closed_at = now()
    WHERE id = request_row.id AND society_id = p_society_id;
    PERFORM private.service_request_event(
      p_society_id, request_row.id, 'auto_closed',
      'resolved', 'closed', NULL
    );
    PERFORM private.create_notification(
      p_society_id, request_row.created_by, 'service_request_closed',
      'Request closed automatically',
      'Your resolved request was closed after the confirmation window.',
      'service_request', request_row.id, p_request_trace
    );
    closed_count := closed_count + 1;
  END LOOP;
  RETURN closed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_dashboard(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
  THEN
    RAISE EXCEPTION 'The request dashboard is not allowed.'
      USING ERRCODE = '42501';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'total_open', (
      SELECT count(*) FROM public.service_requests
      WHERE society_id = p_society_id
        AND status IN ('open', 'assigned', 'in_progress', 'reopened')
    ),
    'overdue', (
      SELECT count(*) FROM public.service_requests
      WHERE society_id = p_society_id
        AND status IN ('open', 'assigned', 'in_progress', 'reopened')
        AND sla_due_at < now()
    ),
    'by_status', COALESCE((
      SELECT pg_catalog.jsonb_object_agg(status, total)
      FROM (
        SELECT status, count(*) AS total
        FROM public.service_requests
        WHERE society_id = p_society_id
        GROUP BY status
      ) AS statuses
    ), '{}'::jsonb),
    'by_category', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'category_id', category.id,
          'category', category.name,
          'total', count(request.id),
          'avg_resolution_hours', avg(
            extract(epoch FROM request.resolved_at - request.created_at) / 3600
          ),
          'avg_rating', avg(request.rating)
        ) ORDER BY category.sort_order, category.name
      )
      FROM public.service_request_categories AS category
      LEFT JOIN public.service_requests AS request
        ON request.society_id = category.society_id
        AND request.category_id = category.id
      WHERE category.society_id = p_society_id AND category.active
      GROUP BY category.society_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_category_save(
  uuid, uuid, text, integer, integer, boolean, timestamptz, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_categories_list(uuid, boolean)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_get(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_assignees_list(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_create(
  uuid, uuid, text, uuid, text, text, jsonb, uuid, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_assign(
  uuid, uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_update_status(
  uuid, uuid, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_reject(
  uuid, uuid, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_confirm_close(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_reopen(uuid, uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_rate(
  uuid, uuid, integer, text, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_add_comment(
  uuid, uuid, text, uuid, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_auto_close_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_dashboard(uuid)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.request_category_save(
  uuid, uuid, text, integer, integer, boolean, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_categories_list(uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_get(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_assignees_list(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_create(
  uuid, uuid, text, uuid, text, text, jsonb, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_assign(
  uuid, uuid, uuid, text, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_update_status(
  uuid, uuid, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_reject(
  uuid, uuid, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_confirm_close(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_reopen(uuid, uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_rate(
  uuid, uuid, integer, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_add_comment(
  uuid, uuid, text, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_auto_close_run(uuid, date, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.request_dashboard(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.is_service_request_file_owner(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.split_part(p_name, '/', 2) = auth.uid()::text
    AND pg_catalog.split_part(p_name, '/', 3) = 'requests'
    AND pg_catalog.split_part(p_name, '/', 4) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND pg_catalog.split_part(p_name, '/', 5) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    AND pg_catalog.array_length(pg_catalog.string_to_array(p_name, '/'), 1) = 5
$$;
REVOKE ALL ON FUNCTION private.is_service_request_file_owner(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_service_request_file_owner(text)
  TO authenticated, service_role;

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
        private.module_enabled(private.file_society_id(name), 'delivery')
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
        AND name ~* (
          '^' || private.file_society_id(name)::text ||
          '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}/deliveries/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        )
        AND EXISTS (
          SELECT 1 FROM public.units unit
          WHERE unit.society_id = private.file_society_id(name)
            AND lower(unit.id::text) = lower(split_part(name, '/', 2))
            AND unit.active
        )
      WHEN 'request-files' THEN
        private.module_enabled(private.file_society_id(name), 'service_request')
        AND EXISTS (
          SELECT 1 FROM public.service_request_attachments AS attachment
          WHERE attachment.storage_path = name
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
        private.module_enabled(private.file_society_id(name), 'delivery')
        AND private.society_writable(private.file_society_id(name))
        AND private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
        AND name ~* (
          '^' || private.file_society_id(name)::text ||
          '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}/deliveries/' ||
          '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
          '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        )
        AND EXISTS (
          SELECT 1 FROM public.units unit
          WHERE unit.society_id = private.file_society_id(name)
            AND lower(unit.id::text) = lower(split_part(name, '/', 2))
            AND unit.active
        )
      WHEN 'request-files' THEN
        private.module_enabled(private.file_society_id(name), 'service_request')
        AND private.society_writable(private.file_society_id(name))
        AND private.has_role(
          private.file_society_id(name), ARRAY['admin', 'resident']::text[]
        )
        AND private.is_service_request_file_owner(name)
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
