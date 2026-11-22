-- Add P40.2 Billing charge mappings, estimate breakdown and collection split suggestions.
CREATE OR REPLACE FUNCTION public.expense_fund_mapping_save(
  p_society_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_income_kind text,
  p_fund_id uuid,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.expense_fund_mappings;
  saved_id uuid;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_source_kind NOT IN ('expense_category', 'income_kind', 'billing_charge')
    OR (p_source_kind = 'expense_category'
      AND (p_source_id IS NULL OR p_income_kind IS NOT NULL))
    OR (p_source_kind = 'income_kind'
      AND (p_source_id IS NOT NULL
        OR p_income_kind NOT IN ('donation', 'interest', 'other')))
    OR (p_source_kind = 'billing_charge'
      AND (p_source_id IS NULL OR p_income_kind IS NOT NULL))
    OR (p_fund_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    ))
  THEN
    RAISE EXCEPTION 'Check the fund suggestion mapping.' USING ERRCODE = '22023';
  END IF;
  IF p_source_kind = 'billing_charge' AND NOT EXISTS (
    SELECT 1 FROM public.billing_charge_types
    WHERE society_id = p_society_id AND id = p_source_id
  ) THEN
    RAISE EXCEPTION 'Choose a Billing charge from this society.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT * INTO previous FROM public.expense_fund_mappings
  WHERE society_id = p_society_id
    AND (
      (p_source_kind = 'expense_category' AND expense_category_id = p_source_id)
      OR (p_source_kind = 'income_kind' AND income_kind = p_income_kind)
      OR (p_source_kind = 'billing_charge' AND billing_charge_type_id = p_source_id)
    ) FOR UPDATE;
  IF previous.id IS NOT NULL THEN
    IF p_expected_updated_at IS NOT NULL
      AND previous.updated_at IS DISTINCT FROM p_expected_updated_at
    THEN
      RAISE EXCEPTION 'The mapping changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF p_fund_id IS NULL THEN
      DELETE FROM public.expense_fund_mappings WHERE id = previous.id;
      INSERT INTO public.audit_logs (
        society_id, actor_id, actor_role, action, entity_type, entity_id,
        "before", "after", request_id
      ) VALUES (
        p_society_id, auth.uid(), 'admin', 'expense.fund_mapping.remove',
        'expense_fund_mapping', previous.id::text,
        jsonb_build_object('fund_id', previous.fund_id),
        jsonb_build_object('fund_id', null), p_request_trace
      );
      RETURN previous.id;
    END IF;
    UPDATE public.expense_fund_mappings SET fund_id = p_fund_id
    WHERE id = previous.id;
    saved_id := previous.id;
  ELSE
    IF p_fund_id IS NULL THEN
      RAISE EXCEPTION 'No mapping exists to remove.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.expense_fund_mappings (
      society_id, fund_id, source_kind, expense_category_id,
      income_kind, billing_charge_type_id, created_by
    ) VALUES (
      p_society_id, p_fund_id, p_source_kind,
      CASE WHEN p_source_kind = 'expense_category' THEN p_source_id END,
      CASE WHEN p_source_kind = 'income_kind' THEN p_income_kind END,
      CASE WHEN p_source_kind = 'billing_charge' THEN p_source_id END,
      auth.uid()
    ) RETURNING id INTO saved_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.fund_mapping.save',
    'expense_fund_mapping', saved_id::text,
    CASE WHEN previous.id IS NULL THEN NULL
      ELSE jsonb_build_object('fund_id', previous.fund_id) END,
    jsonb_build_object(
      'source_kind', p_source_kind,
      'source_id', p_source_id,
      'income_kind', p_income_kind,
      'fund_id', p_fund_id
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.expense_fund_billing_mappings_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'charge_type_id', charge.id,
      'charge_name', charge.name,
      'fund_id', mapping.fund_id,
      'updated_at', mapping.updated_at
    ) ORDER BY lower(charge.name))
    FROM public.billing_charge_types AS charge
    LEFT JOIN public.expense_fund_mappings AS mapping
      ON mapping.society_id = charge.society_id
      AND mapping.source_kind = 'billing_charge'
      AND mapping.billing_charge_type_id = charge.id
    WHERE charge.society_id = p_society_id AND charge.active
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.expense_billing_estimate_breakdown(
  p_society_id uuid,
  p_lines jsonb,
  p_months integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF jsonb_typeof(p_lines) <> 'array'
    OR jsonb_array_length(p_lines) > 100
    OR p_months IS NULL OR p_months NOT BETWEEN 1 AND 12
  THEN
    RAISE EXCEPTION 'Check the Billing fund estimate.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'months', p_months,
    'funds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fund_id', grouped.fund_id,
        'fund_name', fund.name,
        'monthly_paise', grouped.monthly_paise::text,
        'preview_paise', (grouped.monthly_paise * p_months)::text
      ) ORDER BY fund.name NULLS LAST)
      FROM (
        SELECT mapping.fund_id, sum((line ->> 'amount_paise')::bigint) AS monthly_paise
        FROM jsonb_array_elements(p_lines) AS line
        LEFT JOIN public.expense_fund_mappings AS mapping
          ON mapping.society_id = p_society_id
          AND mapping.source_kind = 'billing_charge'
          AND mapping.billing_charge_type_id = (line ->> 'charge_type_id')::uuid
        GROUP BY mapping.fund_id
      ) AS grouped
      LEFT JOIN public.expense_funds AS fund
        ON fund.society_id = p_society_id AND fund.id = grouped.fund_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.expense_billing_collection_suggestions(
  p_society_id uuid,
  p_limit integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  opening public.expense_fund_openings;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Check the Billing suggestion limit.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO opening FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  IF opening.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'entry_id', entry.id,
      'allocations', (
        SELECT jsonb_agg(jsonb_build_object(
          'fund_id', allocation.fund_id,
          'fund_name', fund.name,
          'amount_paise', allocation.amount_paise
        ) ORDER BY allocation.fund_id NULLS LAST)
        FROM (
          SELECT mapped.fund_id,
            sum(mapped.amount_paise)::bigint AS amount_paise
          FROM (
            SELECT mapping.fund_id,
              floor(
                payment_allocation.amount_paise::numeric * line.amount_paise
                / nullif(bill.total_paise, 0)
              )::bigint AS amount_paise
            FROM public.billing_payment_allocations AS payment_allocation
            JOIN public.billing_bills AS bill
              ON bill.society_id = payment_allocation.society_id
              AND bill.id = payment_allocation.bill_id
            JOIN public.billing_bill_lines AS line
              ON line.society_id = bill.society_id AND line.bill_id = bill.id
            LEFT JOIN public.expense_fund_mappings AS mapping
              ON mapping.society_id = line.society_id
              AND mapping.source_kind = 'billing_charge'
              AND mapping.billing_charge_type_id = line.charge_type_id
            WHERE payment_allocation.society_id = entry.society_id
              AND payment_allocation.payment_id = entry.billing_payment_id
          ) AS mapped
          WHERE mapped.fund_id IS NOT NULL
          GROUP BY mapped.fund_id
          UNION ALL
          SELECT NULL::uuid AS fund_id,
            entry.amount_paise - COALESCE((
              SELECT sum(floor(
                payment_allocation.amount_paise::numeric * line.amount_paise
                / nullif(bill.total_paise, 0)
              )::bigint)
              FROM public.billing_payment_allocations AS payment_allocation
              JOIN public.billing_bills AS bill
                ON bill.society_id = payment_allocation.society_id
                AND bill.id = payment_allocation.bill_id
              JOIN public.billing_bill_lines AS line
                ON line.society_id = bill.society_id AND line.bill_id = bill.id
              JOIN public.expense_fund_mappings AS mapping
                ON mapping.society_id = line.society_id
                AND mapping.source_kind = 'billing_charge'
                AND mapping.billing_charge_type_id = line.charge_type_id
              WHERE payment_allocation.society_id = entry.society_id
                AND payment_allocation.payment_id = entry.billing_payment_id
            ), 0)::bigint AS amount_paise
        ) AS allocation
        LEFT JOIN public.expense_funds AS fund
          ON fund.society_id = p_society_id AND fund.id = allocation.fund_id
        WHERE allocation.amount_paise > 0
      )
    ) ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id)
    FROM (
      SELECT entry.*
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id
        AND entry.source = 'billing_payment'
        AND entry.entry_date >= opening.cutover_on
        AND NOT EXISTS (
          SELECT 1 FROM public.expense_fund_entry_allocations AS allocation
          WHERE allocation.society_id = entry.society_id
            AND allocation.entry_id = entry.id
        )
      ORDER BY entry.entry_date DESC, entry.created_at DESC, entry.id
      LIMIT p_limit
    ) AS entry
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION
  public.expense_fund_mapping_save(uuid, text, uuid, text, uuid, timestamptz, text),
  public.expense_fund_billing_mappings_list(uuid),
  public.expense_billing_estimate_breakdown(uuid, jsonb, integer),
  public.expense_billing_collection_suggestions(uuid, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.expense_fund_mapping_save(uuid, text, uuid, text, uuid, timestamptz, text),
  public.expense_fund_billing_mappings_list(uuid),
  public.expense_billing_estimate_breakdown(uuid, jsonb, integer),
  public.expense_billing_collection_suggestions(uuid, integer)
  TO authenticated;
