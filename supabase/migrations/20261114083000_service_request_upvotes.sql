-- Let residents upvote common-area service requests and let admins sort by votes (PRD SRQ-7, D-17).
CREATE TABLE public.service_request_upvotes (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_request_upvotes_pkey
    PRIMARY KEY (society_id, request_id, user_id),
  CONSTRAINT service_request_upvotes_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.service_requests (society_id, id) ON DELETE CASCADE
);

CREATE INDEX service_request_upvotes_user_idx
  ON public.service_request_upvotes (user_id);

ALTER TABLE public.service_request_upvotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_request_upvotes
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (society_id, request_id, user_id, created_at)
  ON TABLE public.service_request_upvotes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.service_request_upvotes
  TO service_role;

-- Voters are not exposed; counts come only through the RPCs below.
CREATE POLICY service_request_upvotes_read_own
  ON public.service_request_upvotes FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND private.module_enabled(society_id, 'service_request')
  );

CREATE OR REPLACE FUNCTION private.service_request_upvote_summary(
  p_society_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'request_id', p_request_id,
    'upvote_count', (
      SELECT count(*)::integer FROM public.service_request_upvotes AS vote
      WHERE vote.society_id = p_society_id AND vote.request_id = p_request_id
    ),
    'has_upvoted', EXISTS (
      SELECT 1 FROM public.service_request_upvotes AS vote
      WHERE vote.society_id = p_society_id AND vote.request_id = p_request_id
        AND vote.user_id = (SELECT auth.uid())
    )
  );
$$;

REVOKE ALL ON FUNCTION private.service_request_upvote_summary(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Set semantics make retries safe: the same desired state is a no-op.
CREATE OR REPLACE FUNCTION public.request_upvote_set(
  p_society_id uuid,
  p_request_id uuid,
  p_upvoted boolean,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  request_row public.service_requests;
  changed integer := 0;
BEGIN
  IF current_user_id IS NULL
    OR NOT private.has_role(p_society_id, ARRAY['resident']::text[])
    OR NOT private.module_enabled(p_society_id, 'service_request')
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Request upvotes are not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_upvoted IS NULL THEN
    RAISE EXCEPTION 'Choose whether to upvote.' USING ERRCODE = '22023';
  END IF;
  SELECT request.* INTO request_row
  FROM public.service_requests AS request
  WHERE request.society_id = p_society_id AND request.id = p_request_id
    AND request.location_type = 'common_area'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The common-area request was not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_upvoted AND request_row.status IN ('closed', 'rejected') THEN
    RAISE EXCEPTION 'Closed requests cannot be upvoted.'
      USING ERRCODE = '23514';
  END IF;

  IF p_upvoted THEN
    INSERT INTO public.service_request_upvotes (society_id, request_id, user_id)
    VALUES (p_society_id, p_request_id, current_user_id)
    ON CONFLICT ON CONSTRAINT service_request_upvotes_pkey DO NOTHING;
  ELSE
    DELETE FROM public.service_request_upvotes
    WHERE society_id = p_society_id AND request_id = p_request_id
      AND user_id = current_user_id;
  END IF;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed > 0 THEN
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      request_id
    )
    VALUES (
      p_society_id, current_user_id, 'resident',
      CASE WHEN p_upvoted THEN 'service_request.upvote'
        ELSE 'service_request.upvote_remove' END,
      'service_request', p_request_id::text, p_request_trace
    );
  END IF;
  RETURN private.service_request_upvote_summary(p_society_id, p_request_id);
END;
$$;

DROP FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer
);

CREATE FUNCTION public.request_list(
  p_society_id uuid,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'default'
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
    OR p_sort IS NULL OR p_sort NOT IN ('default', 'votes')
  THEN
    RAISE EXCEPTION 'The request filters are invalid.'
      USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(filtered)
      ORDER BY
        CASE WHEN p_sort = 'votes' THEN filtered.upvote_count END DESC NULLS LAST,
        filtered.is_overdue DESC,
        filtered.created_at DESC
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
        ) AS is_overdue,
        COALESCE(votes.upvote_count, 0) AS upvote_count,
        COALESCE(votes.has_upvoted, false) AS has_upvoted
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
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS upvote_count,
          bool_or(vote.user_id = current_user_id) AS has_upvoted
        FROM public.service_request_upvotes AS vote
        WHERE vote.society_id = request.society_id
          AND vote.request_id = request.id
      ) AS votes ON true
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
        CASE WHEN p_sort = 'votes' THEN COALESCE(votes.upvote_count, 0) END
          DESC NULLS LAST,
        CASE WHEN request.status IN ('open', 'assigned', 'in_progress', 'reopened')
          AND request.sla_due_at < now() THEN 0 ELSE 1 END,
        request.created_at DESC
      LIMIT p_limit OFFSET p_offset
    ) AS filtered
  ), '[]'::jsonb);
END;
$$;

-- Same body as before plus the vote fields on the request object.
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
    ) || (
      private.service_request_upvote_summary(p_society_id, p_request_id)
        - 'request_id'
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

REVOKE ALL ON FUNCTION public.request_upvote_set(uuid, uuid, boolean, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_upvote_set(uuid, uuid, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer, text
) TO authenticated;
