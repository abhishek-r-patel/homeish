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
          'category_id', categories.category_id,
          'category', categories.category_name,
          'total', categories.total,
          'avg_resolution_hours', categories.avg_resolution_hours,
          'avg_rating', categories.avg_rating
        ) ORDER BY categories.sort_order, categories.category_name
      )
      FROM (
        SELECT
          category.id AS category_id,
          category.name AS category_name,
          category.sort_order,
          count(request.id) AS total,
          avg(
            extract(epoch FROM request.resolved_at - request.created_at) / 3600
          ) AS avg_resolution_hours,
          avg(request.rating) AS avg_rating
        FROM public.service_request_categories AS category
        LEFT JOIN public.service_requests AS request
          ON request.society_id = category.society_id
          AND request.category_id = category.id
        WHERE category.society_id = p_society_id AND category.active
        GROUP BY category.id, category.name, category.sort_order
      ) AS categories
    ), '[]'::jsonb)
  );
END;
$$;
