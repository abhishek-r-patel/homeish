-- P10.3 performance at target scale (see OPERATIONS "Performance at target scale").
-- Measured at 1,500 units: the list functions below called private.has_role()
-- and private.occupies_unit() once per row, and request_list switched to a
-- generic plan after five calls that scanned units and profiles once per
-- request (3-7 s). Access rules are unchanged: role checks run once per call,
-- residents' rows are pre-narrowed to the units they occupy before the same
-- occupies_unit() check, and display lookups run only for the returned page.

-- Units the caller actively occupies in a society. Only narrows rows before
-- the authoritative private.occupies_unit() check; it never grants access.
CREATE OR REPLACE FUNCTION private.current_user_unit_ids(p_society_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(pg_catalog.array_agg(DISTINCT occupant.unit_id), '{}')
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
  WHERE occupant.society_id = p_society_id
    AND occupant.status = 'active'
    AND membership.user_id = (SELECT auth.uid())
    AND membership.status = 'active'
$$;

REVOKE ALL ON FUNCTION private.current_user_unit_ids(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Keeps the signature, checks and result of 20261114083000 (vote sort): vote
-- counts are only computed per row when sorting by votes.
CREATE OR REPLACE FUNCTION public.request_list(
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
  can_manage boolean;
  is_resident boolean;
  own_units uuid[];
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

  can_manage := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  own_units := private.current_user_unit_ids(p_society_id);

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
        page.*,
        unit.number AS unit_number,
        requester.full_name AS requester_name,
        assignee_profile.full_name AS assignee_name,
        COALESCE(votes.upvote_count, 0) AS upvote_count,
        COALESCE(votes.has_upvoted, false) AS has_upvoted
      FROM (
        SELECT
          request.*,
          category.name AS category_name,
          COALESCE(
            request.status IN ('open', 'assigned', 'in_progress', 'reopened')
              AND request.sla_due_at < now(),
            false
          ) AS is_overdue
        FROM public.service_requests AS request
        JOIN public.service_request_categories AS category
          ON category.society_id = request.society_id
          AND category.id = request.category_id
        WHERE request.society_id = p_society_id
          AND (
            can_manage
            OR (request.location_type = 'unit'
              AND request.unit_id = ANY (own_units)
              AND private.occupies_unit(request.unit_id))
            OR (request.location_type = 'common_area' AND is_resident)
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
          CASE WHEN p_sort = 'votes' THEN (
            SELECT count(*)::integer FROM public.service_request_upvotes AS vote
            WHERE vote.society_id = request.society_id
              AND vote.request_id = request.id
          ) END DESC NULLS LAST,
          CASE WHEN request.status IN ('open', 'assigned', 'in_progress', 'reopened')
            AND request.sla_due_at < now() THEN 0 ELSE 1 END,
          request.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) AS page
      LEFT JOIN public.units AS unit
        ON unit.society_id = page.society_id AND unit.id = page.unit_id
      LEFT JOIN public.profiles AS requester
        ON requester.id = page.created_by
      LEFT JOIN public.memberships AS assignee
        ON assignee.society_id = page.society_id
        AND assignee.id = page.assigned_membership_id
      LEFT JOIN public.profiles AS assignee_profile
        ON assignee_profile.id = assignee.user_id
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS upvote_count,
          bool_or(vote.user_id = current_user_id) AS has_upvoted
        FROM public.service_request_upvotes AS vote
        WHERE vote.society_id = page.society_id
          AND vote.request_id = page.id
      ) AS votes ON true
    ) AS filtered
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.request_list(
  uuid, text, uuid, uuid, uuid, date, date, integer, integer, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_bills_list(
  p_society_id uuid, p_limit integer, p_offset integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  can_manage boolean;
  is_resident boolean;
  own_units uuid[];
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin', 'committee', 'resident']::text[])
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  can_manage := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  own_units := private.current_user_unit_ids(p_society_id);
  SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) INTO result
  FROM (
    SELECT bill.id, bill.unit_id, unit.number AS unit_number, bill.kind,
      bill.title, bill.period_start,
      bill.due_date, bill.total_paise, bill.paid_paise, bill.waived_paise,
      bill.status, bill.cancelled_at,
      bill.total_paise - bill.paid_paise - bill.waived_paise AS outstanding_paise,
      EXISTS (
        SELECT 1 FROM public.billing_bill_lines line
        WHERE line.society_id = bill.society_id AND line.bill_id = bill.id
      ) AS has_lines
    FROM public.billing_bills bill
    JOIN public.units unit
      ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
    WHERE bill.society_id = p_society_id
      AND (
        can_manage
        OR (
          is_resident
          AND bill.unit_id = ANY (own_units)
          AND private.occupies_unit(bill.unit_id)
        )
      )
    ORDER BY bill.due_date DESC, bill.id DESC
    LIMIT p_limit OFFSET p_offset
  ) item;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_payments_list(
  p_society_id uuid, p_limit integer, p_offset integer, p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  can_manage boolean;
  is_resident boolean;
  own_units uuid[];
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(
      p_society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.societies society
      WHERE society.id = p_society_id AND society.status <> 'archived'
    )
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL OR p_offset < 0
    OR (p_status IS NOT NULL AND p_status NOT IN (
      'awaiting_confirmation', 'confirmed', 'rejected'
    ))
  THEN
    RAISE EXCEPTION 'Billing payment access is required.'
      USING ERRCODE = '42501';
  END IF;
  can_manage := private.has_role(
    p_society_id, ARRAY['admin', 'committee']::text[]
  );
  is_resident := private.has_role(p_society_id, ARRAY['resident']::text[]);
  own_units := private.current_user_unit_ids(p_society_id);
  SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) INTO result
  FROM (
    SELECT page.id, page.unit_id, page.unit_number,
      page.amount_paise, page.mode, page.source, page.reference,
      page.paid_on, page.status, page.submitted_by,
      page.submitted_by_name, page.confirmed_by,
      page.confirmed_at, page.rejected_at, page.reject_reason,
      page.receipt_no,
      CASE WHEN can_manage THEN page.proof_path ELSE NULL END AS proof_path,
      page.created_at,
      coalesce(allocations.allocated_paise, 0) AS allocated_paise,
      (page.amount_paise - coalesce(allocations.allocated_paise, 0))::text
        AS unallocated_paise
    FROM (
      SELECT payment.*, unit.number AS unit_number,
        profile.full_name AS submitted_by_name
      FROM public.billing_payments payment
      JOIN public.units unit
        ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
      JOIN public.profiles profile ON profile.id = payment.submitted_by
      WHERE payment.society_id = p_society_id
        AND (p_status IS NULL OR payment.status = p_status)
        AND (
          can_manage
          OR (
            is_resident
            AND payment.unit_id = ANY (own_units)
            AND private.occupies_unit(payment.unit_id)
          )
        )
      ORDER BY payment.created_at DESC, payment.id DESC
      LIMIT p_limit OFFSET p_offset
    ) page
    LEFT JOIN LATERAL (
      SELECT sum(allocation.amount_paise)::bigint AS allocated_paise
      FROM public.billing_payment_allocations allocation
      WHERE allocation.society_id = page.society_id
        AND allocation.payment_id = page.id
    ) allocations ON true
    ORDER BY page.created_at DESC, page.id DESC
  ) item;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_bills_list(uuid, integer, integer),
  public.billing_payments_list(uuid, integer, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_bills_list(uuid, integer, integer),
  public.billing_payments_list(uuid, integer, integer, text)
  TO authenticated;

-- Developer log viewers count every matching row (exact totals). The policy
-- check ran is_developer() per row (about 10 s for 200,000 audit rows); as a
-- sub-select it runs once per query. Same rules, evaluated first.
ALTER POLICY error_logs_read_developer ON public.error_logs
  USING ((SELECT private.is_developer()));

ALTER POLICY audit_logs_read_admin_or_developer ON public.audit_logs
  USING (
    (SELECT private.is_developer())
    OR (society_id IS NOT NULL AND private.has_role(
      society_id,
      ARRAY['admin', 'committee']::text[]
    ))
  );
