-- Read resident-home data and complete open-bill totals without broadening household access.
CREATE OR REPLACE FUNCTION private.resident_home_allowed(p_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.has_role(p_society_id, ARRAY['resident']::text[])
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status IN ('trial', 'active', 'suspended')
    )
$$;

REVOKE ALL ON FUNCTION private.resident_home_allowed(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.billing_resident_outstanding(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  own_units uuid[];
BEGIN
  IF NOT private.resident_home_allowed(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'billing')
  THEN
    RAISE EXCEPTION 'Resident billing is not available.' USING ERRCODE = '42501';
  END IF;

  own_units := private.current_user_unit_ids(p_society_id);
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'unit_id', outstanding.unit_id,
        'outstanding_paise', outstanding.amount::text,
        'next_due_date', outstanding.next_due_date
      ) ORDER BY outstanding.unit_id
    )
    FROM (
      SELECT bill.unit_id,
        sum(bill.total_paise - bill.paid_paise - bill.waived_paise) AS amount,
        min(bill.due_date) AS next_due_date
      FROM public.billing_bills AS bill
      WHERE bill.society_id = p_society_id
        AND bill.unit_id = ANY (own_units)
        AND private.occupies_unit(bill.unit_id)
        AND bill.cancelled_at IS NULL
        AND bill.paid_paise + bill.waived_paise < bill.total_paise
      GROUP BY bill.unit_id
    ) AS outstanding
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_resident_lists(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  own_units uuid[];
  bills jsonb;
  payments jsonb;
BEGIN
  IF NOT private.resident_home_allowed(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'billing')
  THEN
    RAISE EXCEPTION 'Resident billing is not available.' USING ERRCODE = '42501';
  END IF;
  own_units := private.current_user_unit_ids(p_society_id);

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(item) ORDER BY item.due_date DESC, item.id DESC
  ), '[]'::jsonb)
  INTO bills
  FROM (
    SELECT bill.id, bill.unit_id, unit.number AS unit_number, bill.kind,
      bill.title, bill.period_start, bill.due_date, bill.total_paise,
      bill.paid_paise, bill.waived_paise, bill.status, bill.cancelled_at,
      bill.total_paise - bill.paid_paise - bill.waived_paise AS outstanding_paise,
      EXISTS (
        SELECT 1 FROM public.billing_bill_lines AS line
        WHERE line.society_id = bill.society_id AND line.bill_id = bill.id
      ) AS has_lines
    FROM public.billing_bills AS bill
    JOIN public.units AS unit
      ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
    WHERE bill.society_id = p_society_id
      AND bill.unit_id = ANY (own_units)
      AND private.occupies_unit(bill.unit_id)
    ORDER BY bill.due_date DESC, bill.id DESC
    LIMIT 100
  ) AS item;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(item) ORDER BY item.created_at DESC, item.id DESC
  ), '[]'::jsonb)
  INTO payments
  FROM (
    SELECT page.id, page.unit_id, page.unit_number, page.amount_paise,
      page.mode, page.source, page.reference, page.paid_on, page.status,
      page.submitted_by, page.submitted_by_name, page.confirmed_by,
      page.confirmed_at, page.rejected_at, page.reject_reason, page.receipt_no,
      NULL::text AS proof_path, page.created_at,
      COALESCE(allocations.allocated_paise, 0) AS allocated_paise,
      (page.amount_paise - COALESCE(allocations.allocated_paise, 0))::text
        AS unallocated_paise
    FROM (
      SELECT payment.*, unit.number AS unit_number,
        profile.full_name AS submitted_by_name
      FROM public.billing_payments AS payment
      JOIN public.units AS unit
        ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
      JOIN public.profiles AS profile ON profile.id = payment.submitted_by
      WHERE payment.society_id = p_society_id
        AND payment.unit_id = ANY (own_units)
        AND private.occupies_unit(payment.unit_id)
      ORDER BY payment.created_at DESC, payment.id DESC
      LIMIT 100
    ) AS page
    LEFT JOIN LATERAL (
      SELECT sum(allocation.amount_paise)::bigint AS allocated_paise
      FROM public.billing_payment_allocations AS allocation
      WHERE allocation.society_id = page.society_id
        AND allocation.payment_id = page.id
    ) AS allocations ON true
  ) AS item;
  RETURN pg_catalog.jsonb_build_object('bills', bills, 'payments', payments);
END;
$$;

CREATE OR REPLACE FUNCTION public.resident_home_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  own_units uuid[];
  approver_units uuid[];
  resident_name text;
  society_timezone text;
  society_unit_label text;
  units jsonb;
  activity jsonb;
  pending_visitors integer;
  pending_deliveries integer;
  next_response_at timestamptz;
  can_respond boolean;
BEGIN
  IF NOT private.resident_home_allowed(p_society_id) THEN
    RAISE EXCEPTION 'Resident home is not available.' USING ERRCODE = '42501';
  END IF;

  SELECT profile.full_name, society.timezone, society.unit_label
  INTO resident_name, society_timezone, society_unit_label
  FROM public.profiles AS profile
  JOIN public.societies AS society ON society.id = p_society_id
  WHERE profile.id = (SELECT auth.uid())
    AND profile.status = 'active'
    AND society.status IN ('trial', 'active', 'suspended');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident home is not available.' USING ERRCODE = '42501';
  END IF;

  own_units := private.current_user_unit_ids(p_society_id);
  can_respond := private.society_writable(p_society_id);

  SELECT COALESCE(pg_catalog.array_agg(DISTINCT occupant.unit_id), '{}')
  INTO approver_units
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
  WHERE occupant.society_id = p_society_id
    AND occupant.status = 'active'
    AND occupant.is_approver
    AND membership.user_id = (SELECT auth.uid())
    AND membership.status = 'active'
    AND private.occupies_unit(occupant.unit_id);

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('id', unit.id, 'number', unit.number)
    ORDER BY unit.number, unit.id
  ), '[]'::jsonb)
  INTO units
  FROM public.units AS unit
  WHERE unit.society_id = p_society_id
    AND unit.id = ANY (own_units)
    AND private.occupies_unit(unit.id);

  SELECT count(*) FILTER (
      WHERE can_respond AND pending.module = 'visitor'
        AND pending.unit_id = ANY (approver_units)
    )::integer,
    count(*) FILTER (
      WHERE can_respond AND pending.module = 'delivery'
        AND pending.unit_id = ANY (approver_units)
    )::integer,
    min(pending.respond_by)
  INTO pending_visitors, pending_deliveries, next_response_at
  FROM (
    SELECT 'visitor'::text AS module, visitor.unit_id, visitor.respond_by
    FROM public.visitor_entries AS visitor
    WHERE private.module_enabled(p_society_id, 'visitor')
      AND visitor.society_id = p_society_id
      AND visitor.unit_id = ANY (own_units)
      AND private.occupies_unit(visitor.unit_id)
      AND visitor.status = 'pending'
      AND visitor.respond_by > now()
    UNION ALL
    SELECT 'delivery'::text, delivery.unit_id, delivery.respond_by
    FROM public.delivery_entries AS delivery
    WHERE private.module_enabled(p_society_id, 'delivery')
      AND delivery.society_id = p_society_id
      AND delivery.unit_id = ANY (own_units)
      AND private.occupies_unit(delivery.unit_id)
      AND delivery.status = 'pending_response'
      AND delivery.respond_by > now()
  ) AS pending;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(recent)
    ORDER BY recent.occurred_at DESC, recent.module, recent.id
  ), '[]'::jsonb)
  INTO activity
  FROM (
    SELECT candidates.*
    FROM (
      SELECT visitor.id, 'visitor'::text AS module, visitor.visitor_name AS title,
        CASE WHEN visitor.status = 'pending' AND visitor.respond_by <= now()
          THEN 'expired' ELSE visitor.status END AS status,
        unit.number AS unit_number, NULL::date AS due_date,
        GREATEST(visitor.updated_at,
          CASE WHEN visitor.status = 'pending' AND visitor.respond_by <= now()
            THEN visitor.respond_by END) AS occurred_at
      FROM public.visitor_entries AS visitor
      JOIN public.units AS unit
        ON unit.society_id = visitor.society_id AND unit.id = visitor.unit_id
      WHERE private.module_enabled(p_society_id, 'visitor')
        AND visitor.society_id = p_society_id
        AND visitor.unit_id = ANY (own_units)
        AND private.occupies_unit(visitor.unit_id)
      UNION ALL
      SELECT delivery.id, 'delivery'::text, delivery.company,
        CASE WHEN delivery.status = 'pending_response' AND delivery.respond_by <= now()
          THEN 'no_response' ELSE delivery.status END,
        unit.number, NULL::date,
        GREATEST(delivery.updated_at,
          CASE WHEN delivery.status = 'pending_response' AND delivery.respond_by <= now()
            THEN delivery.respond_by END)
      FROM public.delivery_entries AS delivery
      JOIN public.units AS unit
        ON unit.society_id = delivery.society_id AND unit.id = delivery.unit_id
      WHERE private.module_enabled(p_society_id, 'delivery')
        AND delivery.society_id = p_society_id
        AND delivery.unit_id = ANY (own_units)
        AND private.occupies_unit(delivery.unit_id)
      UNION ALL
      SELECT bill.id, 'billing'::text, bill.title, bill.status,
        unit.number, bill.due_date,
        GREATEST(bill.created_at, bill.cancelled_at,
          (SELECT max(ledger.created_at)
           FROM public.billing_ledger_entries AS ledger
           WHERE ledger.society_id = bill.society_id AND ledger.bill_id = bill.id),
          (SELECT max(allocation.created_at)
           FROM public.billing_payment_allocations AS allocation
           WHERE allocation.society_id = bill.society_id AND allocation.bill_id = bill.id))
      FROM public.billing_bills AS bill
      JOIN public.units AS unit
        ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
      WHERE private.module_enabled(p_society_id, 'billing')
        AND bill.society_id = p_society_id
        AND bill.unit_id = ANY (own_units)
        AND private.occupies_unit(bill.unit_id)
      UNION ALL
      SELECT request.id, 'service_request'::text, category.name, request.status,
        unit.number, NULL::date,
        GREATEST(request.updated_at,
          (SELECT max(comment.created_at)
           FROM public.service_request_comments AS comment
           WHERE comment.society_id = request.society_id
             AND comment.request_id = request.id))
      FROM public.service_requests AS request
      JOIN public.service_request_categories AS category
        ON category.society_id = request.society_id AND category.id = request.category_id
      LEFT JOIN public.units AS unit
        ON unit.society_id = request.society_id AND unit.id = request.unit_id
      WHERE private.module_enabled(p_society_id, 'service_request')
        AND request.society_id = p_society_id
        AND request.created_by = (SELECT auth.uid())
        AND (request.location_type = 'common_area'
          OR (request.unit_id = ANY (own_units) AND private.occupies_unit(request.unit_id)))
    ) AS candidates
    ORDER BY candidates.occurred_at DESC, candidates.module, candidates.id
    LIMIT 5
  ) AS recent;

  RETURN pg_catalog.jsonb_build_object(
    'resident_name', resident_name,
    'timezone', society_timezone,
    'unit_label', society_unit_label,
    'units', units,
    'pending_visitors', pending_visitors,
    'pending_deliveries', pending_deliveries,
    'server_now', now(),
    'next_response_at', next_response_at,
    'activity', activity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.billing_resident_outstanding(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.billing_resident_lists(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resident_home_get(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_resident_outstanding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_resident_lists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resident_home_get(uuid) TO authenticated;
