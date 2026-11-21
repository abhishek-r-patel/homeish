-- P37.1-P37.4 billing additions (PRD D-12 update, D-72, BIL-1 and BIL-22 to BIL-24).
-- Adds the percentage-of-charge method and occupancy eligibility to charge heads, a read-only
-- flat charge estimate and read-only report summaries. billing_charge_save is replaced by a
-- version with three trailing optional arguments (base charge, rate in basis points, eligibility);
-- the old eight-argument call still works and keeps a charge's eligibility unchanged on update.
-- private.billing_calculate_lines keeps its signature and now returns only the billable rows of the
-- new private.billing_calculate_plan. billing_bills_preview is copied from
-- 20261110190000_billing_bills_ledger.sql and adds a `skipped` list (also covered by the preview
-- hash). billing_bills_generate publishes the exact reviewed lines. billing_report_export is copied from
-- 20261110203000_billing_reminders_reports.sql and adds four aggregate report kinds. Published
-- bills are never recalculated.

ALTER TABLE public.unit_occupants
  ADD COLUMN billing_confirmed_move_in_on date,
  ADD CONSTRAINT unit_occupants_billing_move_in_check CHECK (
    billing_confirmed_move_in_on IS NULL OR (
      relationship = 'tenant' AND status IN ('active', 'ended')
      AND (ended_at IS NULL OR billing_confirmed_move_in_on <= ended_at)
    )
  );

CREATE FUNCTION public.billing_confirm_tenant_move_in(
  p_society_id uuid, p_occupant_id uuid, p_move_in_on date, p_request_id text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  occupant public.unit_occupants;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO occupant FROM public.unit_occupants
    WHERE society_id = p_society_id AND id = p_occupant_id
      AND relationship = 'tenant' AND status IN ('active', 'ended')
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant occupancy not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_move_in_on IS NULL OR p_move_in_on > private.billing_society_today(p_society_id)
    OR p_move_in_on > occupant.ended_at
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a valid actual move-in date.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tenancy_moves
    WHERE society_id = p_society_id AND occupancy_id = p_occupant_id
      AND kind = 'move_in' AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Tenancy already confirmed this move-in.' USING ERRCODE = '22023';
  END IF;
  IF occupant.billing_confirmed_move_in_on = p_move_in_on THEN RETURN; END IF;
  IF occupant.billing_confirmed_move_in_on IS NOT NULL THEN
    RAISE EXCEPTION 'The move-in date has already been confirmed.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.unit_occupants SET billing_confirmed_move_in_on = p_move_in_on
    WHERE society_id = p_society_id AND id = p_occupant_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.occupancy.confirmMoveIn',
    'unit_occupant', p_occupant_id::text, jsonb_build_object('moveInOn', p_move_in_on),
    p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.billing_confirm_tenant_move_in(uuid, uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_confirm_tenant_move_in(uuid, uuid, date, text)
  TO authenticated;

CREATE FUNCTION public.billing_unconfirmed_tenant_moves(p_society_id uuid, p_unit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', occupant.id, 'name', profile.full_name, 'ended_on', occupant.ended_at
  ) ORDER BY occupant.started_at DESC, occupant.id), '[]'::jsonb) INTO result
  FROM public.unit_occupants occupant
  JOIN public.memberships member
    ON member.society_id = occupant.society_id AND member.id = occupant.membership_id
  LEFT JOIN public.profiles profile ON profile.id = member.user_id
  WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
    AND occupant.relationship = 'tenant' AND occupant.status IN ('active', 'ended')
    AND occupant.billing_confirmed_move_in_on IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.tenancy_moves move
      WHERE move.society_id = occupant.society_id AND move.occupancy_id = occupant.id
        AND move.kind = 'move_in' AND move.status = 'completed'
    );
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_unconfirmed_tenant_moves(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_unconfirmed_tenant_moves(uuid, uuid)
  TO authenticated;

ALTER TABLE public.billing_charge_types
  ADD COLUMN base_charge_type_id uuid,
  ADD COLUMN percent_basis_points integer,
  ADD COLUMN eligibility text NOT NULL DEFAULT 'all';
ALTER TABLE public.billing_charge_types
  DROP CONSTRAINT billing_charge_types_method_check,
  DROP CONSTRAINT billing_charge_types_amount_check;
ALTER TABLE public.billing_charge_types
  ADD CONSTRAINT billing_charge_types_method_check
    CHECK (method IN ('fixed', 'per_sqft', 'custom', 'percent_of_charge')),
  ADD CONSTRAINT billing_charge_types_amount_check CHECK (
    (method IN ('custom', 'percent_of_charge') AND amount_paise IS NULL)
    OR (method IN ('fixed', 'per_sqft')
      AND amount_paise IS NOT NULL
      AND amount_paise BETWEEN 1 AND 9007199254740991)
  ),
  ADD CONSTRAINT billing_charge_types_percent_check CHECK (
    (method = 'percent_of_charge'
      AND base_charge_type_id IS NOT NULL
      AND base_charge_type_id <> id
      AND percent_basis_points IS NOT NULL
      AND percent_basis_points BETWEEN 1 AND 10000)
    OR (method <> 'percent_of_charge'
      AND base_charge_type_id IS NULL
      AND percent_basis_points IS NULL)
  ),
  ADD CONSTRAINT billing_charge_types_eligibility_check
    CHECK (eligibility IN ('all', 'owner', 'tenant')),
  ADD CONSTRAINT billing_charge_types_base_same_society_fkey
    FOREIGN KEY (society_id, base_charge_type_id)
    REFERENCES public.billing_charge_types (society_id, id) ON DELETE RESTRICT;
CREATE INDEX billing_charge_types_base_same_society_idx
  ON public.billing_charge_types (society_id, base_charge_type_id);

-- A percentage charge may only use an active fixed, per-square-foot or custom charge as its base,
-- so chains and cycles cannot form. A base used by an active percentage charge cannot itself become
-- a percentage charge or be deactivated until that percentage charge is changed first.
CREATE OR REPLACE FUNCTION private.billing_charge_base_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  base public.billing_charge_types;
BEGIN
  IF NEW.method = 'percent_of_charge' THEN
    SELECT * INTO base FROM public.billing_charge_types charge
      WHERE charge.society_id = NEW.society_id
        AND charge.id = NEW.base_charge_type_id
      FOR SHARE;
    IF NOT FOUND OR base.id = NEW.id
      OR base.method = 'percent_of_charge'
      OR (NEW.active AND NOT base.active)
    THEN
      RAISE EXCEPTION 'Choose an active fixed, per-square-foot or custom charge as the base.'
        USING ERRCODE = '22023', HINT = 'charge_base_invalid';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE'
    AND (NEW.method = 'percent_of_charge' OR NOT NEW.active)
    AND EXISTS (
      SELECT 1 FROM public.billing_charge_types dependent
      WHERE dependent.society_id = NEW.society_id
        AND dependent.base_charge_type_id = NEW.id
        AND dependent.id <> NEW.id
        AND (dependent.active OR NEW.method = 'percent_of_charge')
    )
  THEN
    RAISE EXCEPTION 'This charge is the base of another percentage charge.'
      USING ERRCODE = '22023', HINT = 'charge_base_in_use';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_charge_types_base_guard
  BEFORE INSERT OR UPDATE ON public.billing_charge_types
  FOR EACH ROW EXECUTE FUNCTION private.billing_charge_base_guard();
REVOKE ALL ON FUNCTION private.billing_charge_base_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.billing_charge_save(
  uuid, uuid, text, text, bigint, boolean, timestamptz, text
);
CREATE FUNCTION public.billing_charge_save(
  p_society_id uuid,
  p_id uuid,
  p_name text,
  p_method text,
  p_amount_paise bigint,
  p_active boolean,
  p_expected_updated_at timestamptz,
  p_request_id text,
  p_base_charge_type_id uuid DEFAULT NULL,
  p_percent_basis_points integer DEFAULT NULL,
  p_eligibility text DEFAULT NULL
)
RETURNS public.billing_charge_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous public.billing_charge_types;
  result public.billing_charge_types;
  v_eligibility text := p_eligibility;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'A request ID is required.' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'The charge details are invalid.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.billing_charge_types (
      society_id, name, method, amount_paise, active, base_charge_type_id,
      percent_basis_points, eligibility, created_by, updated_by
    ) VALUES (
      p_society_id, p_name, p_method, p_amount_paise, p_active,
      p_base_charge_type_id, p_percent_basis_points, coalesce(v_eligibility, 'all'),
      auth.uid(), auth.uid()
    ) RETURNING * INTO result;
  ELSE
    SELECT * INTO previous FROM public.billing_charge_types
      WHERE society_id = p_society_id AND id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The charge was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The charge has changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    -- Older callers omit eligibility; keep the saved value rather than resetting it.
    v_eligibility := coalesce(v_eligibility, previous.eligibility);
    IF (previous.name, previous.method, previous.amount_paise, previous.active,
        previous.base_charge_type_id, previous.percent_basis_points,
        previous.eligibility)
      IS NOT DISTINCT FROM (p_name, p_method, p_amount_paise, p_active,
        p_base_charge_type_id, p_percent_basis_points, v_eligibility)
    THEN RETURN previous; END IF;
    UPDATE public.billing_charge_types
      SET name = p_name, method = p_method, amount_paise = p_amount_paise,
          active = p_active, base_charge_type_id = p_base_charge_type_id,
          percent_basis_points = p_percent_basis_points,
          eligibility = v_eligibility
      WHERE society_id = p_society_id AND id = p_id RETURNING * INTO result;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_id IS NULL THEN 'billing.charges.create'
      WHEN NOT p_active AND previous.active THEN 'billing.charges.deactivate'
      ELSE 'billing.charges.update' END,
    'billing_charge_type', result.id::text,
    CASE WHEN p_id IS NULL THEN NULL ELSE to_jsonb(previous) END,
    to_jsonb(result), p_request_id
  );
  RETURN result;
END;
$$;

-- Invitation dates are not evidence of tenant occupancy.
CREATE OR REPLACE FUNCTION private.billing_unit_occupancy(
  p_society_id uuid, p_unit_ids uuid[], p_on date
)
RETURNS TABLE (unit_id uuid, occupancy text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH effective AS (
    SELECT occupant.unit_id, occupant.relationship,
      CASE
        WHEN occupant.relationship <> 'tenant' THEN occupant.started_at
        WHEN EXISTS (
          SELECT 1 FROM public.tenancy_moves move
          WHERE move.society_id = occupant.society_id AND move.occupancy_id = occupant.id
            AND move.kind = 'move_in' AND move.status = 'completed'
        ) THEN occupant.started_at
        ELSE occupant.billing_confirmed_move_in_on
      END AS move_in_on
    FROM public.unit_occupants occupant
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = ANY(p_unit_ids)
      AND occupant.status IN ('active', 'ended')
      AND (occupant.ended_at IS NULL OR occupant.ended_at >= p_on)
  )
  SELECT unit.id,
    CASE
      WHEN bool_or(occupant.relationship = 'tenant' AND occupant.move_in_on <= p_on)
        THEN 'tenant'
      WHEN bool_or(occupant.relationship = 'tenant' AND occupant.move_in_on IS NULL)
        THEN 'unconfirmed'
      WHEN bool_or(occupant.relationship <> 'tenant' AND occupant.move_in_on <= p_on)
        THEN 'owner'
      ELSE 'vacant'
    END
  FROM public.units unit
  LEFT JOIN effective occupant ON occupant.unit_id = unit.id
  WHERE unit.society_id = p_society_id AND unit.id = ANY(p_unit_ids)
  GROUP BY unit.id
$$;

CREATE OR REPLACE FUNCTION private.billing_calculate_plan(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb
)
RETURNS TABLE (
  unit_id uuid,
  unit_number text,
  charge_type_id uuid,
  charge_name text,
  method text,
  amount_paise bigint,
  skip_reason text,
  occupancy text,
  eligibility text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  unit_count integer;
  charge_count integer;
  configured_rounding text;
  plan jsonb;
  problem jsonb;
BEGIN
  IF p_period_start IS NULL
    OR p_period_start <> date_trunc('month', p_period_start)::date
    OR p_unit_ids IS NULL OR cardinality(p_unit_ids) NOT BETWEEN 1 AND 1000
    OR p_charge_type_ids IS NULL
    OR cardinality(p_charge_type_ids) NOT BETWEEN 1 AND 100
    OR cardinality(p_unit_ids) <> (
      SELECT count(DISTINCT value) FROM unnest(p_unit_ids) AS value
    )
    OR cardinality(p_charge_type_ids) <> (
      SELECT count(DISTINCT value) FROM unnest(p_charge_type_ids) AS value
    )
  THEN
    RAISE EXCEPTION 'Select a valid billing period, units and charges.'
      USING ERRCODE = '22023';
  END IF;
  IF p_custom_amounts IS NULL THEN p_custom_amounts := '[]'::jsonb; END IF;
  IF jsonb_typeof(p_custom_amounts) <> 'array'
    OR jsonb_array_length(p_custom_amounts) > 100000
  THEN
    RAISE EXCEPTION 'Custom charge amounts are invalid.'
      USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_custom_amounts) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(item)) <> 3
      OR NOT (item ?& ARRAY['unit_id', 'charge_type_id', 'amount_paise'])
      OR jsonb_typeof(item->'unit_id') <> 'string'
      OR item->>'unit_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(item->'charge_type_id') <> 'string'
      OR item->>'charge_type_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(item->'amount_paise') <> 'number'
      OR item->>'amount_paise' !~ '^[1-9][0-9]*$'
      OR (item->>'amount_paise')::numeric > 9007199254740991
    THEN
      RAISE EXCEPTION 'Custom charge amounts are invalid.'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_custom_amounts)
      AS custom(unit_id uuid, charge_type_id uuid, amount_paise bigint)
    GROUP BY custom.unit_id, custom.charge_type_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Custom charge amounts contain duplicates.'
      USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO unit_count FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = ANY(p_unit_ids)
      AND unit.active;
  SELECT count(*) INTO charge_count FROM public.billing_charge_types charge
    WHERE charge.society_id = p_society_id
      AND charge.id = ANY(p_charge_type_ids) AND charge.active;
  IF unit_count <> cardinality(p_unit_ids)
    OR charge_count <> cardinality(p_charge_type_ids)
  THEN
    RAISE EXCEPTION 'Some selected units or charges are no longer available.'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.billing_charge_types charge
    LEFT JOIN public.billing_charge_types base
      ON base.society_id = charge.society_id AND base.id = charge.base_charge_type_id
    WHERE charge.society_id = p_society_id AND charge.id = ANY(p_charge_type_ids)
      AND (charge.eligibility <> 'all' OR base.eligibility <> 'all')
  ) THEN
    IF p_period_start > private.billing_society_today(p_society_id) THEN
      RAISE EXCEPTION 'Wait until the billed month begins to apply occupancy rules.'
        USING ERRCODE = '22023', HINT = 'occupancy_period_not_started';
    END IF;
    SELECT jsonb_build_object('unit', unit.number) INTO problem
    FROM private.billing_unit_occupancy(p_society_id, p_unit_ids, p_period_start) occupancy
    JOIN public.units unit ON unit.id = occupancy.unit_id AND unit.society_id = p_society_id
    WHERE occupancy.occupancy = 'unconfirmed'
    ORDER BY unit.number, unit.id LIMIT 1;
    IF problem IS NOT NULL THEN
      RAISE EXCEPTION 'Confirm the actual tenant move-in date before applying occupancy rules.'
        USING ERRCODE = '22023', HINT = 'tenant_move_in_unconfirmed', DETAIL = problem::text;
    END IF;
  END IF;
  SELECT coalesce(settings->>'rounding', 'rupee') INTO configured_rounding
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'billing';
  IF configured_rounding NOT IN ('rupee', 'paise') THEN
    RAISE EXCEPTION 'Billing rounding settings are invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_custom_amounts)
      AS custom(unit_id uuid, charge_type_id uuid, amount_paise bigint)
    LEFT JOIN public.units unit
      ON unit.society_id = p_society_id AND unit.id = custom.unit_id
        AND unit.id = ANY(p_unit_ids) AND unit.active
    LEFT JOIN public.billing_charge_types charge
      ON charge.society_id = p_society_id
        AND charge.id = custom.charge_type_id
        AND charge.id = ANY(p_charge_type_ids)
        AND charge.active AND charge.method = 'custom'
    WHERE unit.id IS NULL OR charge.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Enter one amount for every custom charge and selected unit.'
      USING ERRCODE = '22023';
  END IF;
  WITH custom AS MATERIALIZED (
    SELECT item.unit_id, item.charge_type_id, item.amount_paise
    FROM jsonb_to_recordset(p_custom_amounts)
      AS item(unit_id uuid, charge_type_id uuid, amount_paise bigint)
  ),
  selected_units AS MATERIALIZED (
    SELECT unit.id, unit.number, unit.area_sqft, occ.occupancy
    FROM public.units unit
    JOIN private.billing_unit_occupancy(p_society_id, p_unit_ids, p_period_start) occ
      ON occ.unit_id = unit.id
    WHERE unit.society_id = p_society_id
      AND unit.id = ANY(p_unit_ids) AND unit.active
  ),
  selected_charges AS MATERIALIZED (
    SELECT charge.id, charge.name, charge.method, charge.amount_paise,
      charge.base_charge_type_id, charge.percent_basis_points,
      charge.eligibility, base.eligibility AS base_eligibility
    FROM public.billing_charge_types charge
    LEFT JOIN public.billing_charge_types base
      ON base.society_id = charge.society_id
      AND base.id = charge.base_charge_type_id
    WHERE charge.society_id = p_society_id
      AND charge.id = ANY(p_charge_type_ids) AND charge.active
  ),
  pairs AS MATERIALIZED (
    SELECT unit.id AS unit_id, unit.number AS unit_number, unit.area_sqft,
      unit.occupancy, charge.id AS charge_type_id, charge.name AS charge_name,
      charge.method, charge.amount_paise AS rate_paise,
      charge.base_charge_type_id, charge.percent_basis_points,
      charge.eligibility, custom.amount_paise AS custom_paise,
      CASE
        WHEN charge.eligibility NOT IN ('all', unit.occupancy)
          THEN 'not_eligible'
        WHEN charge.method = 'percent_of_charge'
          AND charge.base_eligibility NOT IN ('all', unit.occupancy)
          THEN 'not_applicable'
      END AS skip_reason
    FROM selected_units unit
    CROSS JOIN selected_charges charge
    LEFT JOIN custom
      ON custom.unit_id = unit.id AND custom.charge_type_id = charge.id
  ),
  direct AS MATERIALIZED (
    SELECT pair.*,
      CASE
        WHEN pair.skip_reason IS NOT NULL THEN NULL
        WHEN pair.method = 'custom' THEN pair.custom_paise
        WHEN pair.method = 'per_sqft' AND pair.area_sqft IS NULL THEN NULL
        WHEN pair.method = 'per_sqft' AND configured_rounding = 'rupee'
          THEN private.billing_checked_amount(
            round(pair.rate_paise * pair.area_sqft / 100) * 100
          )
        WHEN pair.method = 'per_sqft'
          THEN private.billing_checked_amount(
            round(pair.rate_paise * pair.area_sqft)
          )
        WHEN pair.method = 'fixed' THEN pair.rate_paise
      END AS amount_paise
    FROM pairs pair
  ),
  bases AS MATERIALIZED (
    SELECT pair.unit_id, pair.charge_type_id,
      coalesce(published.amount_paise, run.amount_paise) AS base_paise
    FROM direct pair
    LEFT JOIN LATERAL (
      SELECT line.amount_paise
      FROM public.billing_bill_lines line
      JOIN public.billing_bills bill
        ON bill.id = line.bill_id AND bill.cancelled_at IS NULL
      WHERE line.society_id = p_society_id
        AND line.unit_id = pair.unit_id
        AND line.period_start = p_period_start
        AND line.charge_type_id = pair.base_charge_type_id
    ) published ON true
    LEFT JOIN direct run
      ON run.unit_id = pair.unit_id
      AND run.charge_type_id = pair.base_charge_type_id
      AND run.amount_paise IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.billing_bill_lines existing
        WHERE existing.society_id = p_society_id
          AND existing.unit_id = pair.unit_id
          AND existing.period_start = p_period_start
          AND existing.charge_type_id = pair.base_charge_type_id
      )
    WHERE pair.method = 'percent_of_charge' AND pair.skip_reason IS NULL
  )
  , amounts AS (
    SELECT pair.*, CASE
      WHEN pair.method <> 'percent_of_charge' THEN pair.amount_paise
      WHEN base.base_paise IS NULL THEN NULL
      WHEN configured_rounding = 'rupee'
        THEN round(base.base_paise::numeric * pair.percent_basis_points / 1000000.0) * 100
      ELSE round(base.base_paise::numeric * pair.percent_basis_points / 10000.0)
    END AS final_paise
    FROM direct pair
    LEFT JOIN bases base
      ON base.unit_id = pair.unit_id AND base.charge_type_id = pair.charge_type_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', pair.unit_id,
      'unit_number', pair.unit_number,
      'charge_type_id', pair.charge_type_id,
      'charge_name', pair.charge_name,
      'method', pair.method,
      'amount_paise', CASE WHEN pair.final_paise > 0 THEN
        private.billing_checked_amount(pair.final_paise)
      END,
      'skip_reason', CASE WHEN pair.final_paise = 0 THEN 'rounds_to_zero'
        ELSE pair.skip_reason END,
      'occupancy', pair.occupancy,
      'eligibility', pair.eligibility,
      'area_missing', pair.method = 'per_sqft' AND pair.area_sqft IS NULL
    ) ORDER BY pair.unit_number, pair.unit_id, pair.charge_name, pair.charge_type_id
  ), '[]'::jsonb)
  INTO plan
  FROM amounts pair;

  SELECT entry INTO problem FROM jsonb_array_elements(plan) entry
    WHERE entry->'skip_reason' = 'null'::jsonb AND entry->>'method' = 'custom'
      AND entry->'amount_paise' = 'null'::jsonb
    LIMIT 1;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Enter one amount for every custom charge and selected unit.'
      USING ERRCODE = '22023', HINT = 'custom_amount_missing',
        DETAIL = jsonb_build_object(
          'unit', problem->>'unit_number', 'charge', problem->>'charge_name'
        )::text;
  END IF;
  SELECT entry INTO problem FROM jsonb_array_elements(plan) entry
    WHERE entry->'skip_reason' = 'null'::jsonb
      AND (entry->>'area_missing')::boolean
    LIMIT 1;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Unit % needs a recorded area before billing.',
      problem->>'unit_number'
      USING ERRCODE = '22023';
  END IF;
  SELECT entry INTO problem FROM jsonb_array_elements(plan) entry
    WHERE entry->'skip_reason' = 'null'::jsonb
      AND entry->>'method' = 'percent_of_charge'
      AND entry->'amount_paise' = 'null'::jsonb
    LIMIT 1;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Unit % has no base charge amount for this month.',
      problem->>'unit_number'
      USING ERRCODE = '22023', HINT = 'percent_base_missing',
        DETAIL = jsonb_build_object(
          'unit', problem->>'unit_number',
          'charge', (
            SELECT base.name FROM public.billing_charge_types charge
            JOIN public.billing_charge_types base
              ON base.society_id = charge.society_id
              AND base.id = charge.base_charge_type_id
            WHERE charge.society_id = p_society_id
              AND charge.id = (problem->>'charge_type_id')::uuid
          )
        )::text;
  END IF;
  RETURN QUERY
  SELECT entry.unit_id, entry.unit_number, entry.charge_type_id,
    entry.charge_name, entry.method, entry.amount_paise, entry.skip_reason,
    entry.occupancy, entry.eligibility
  FROM jsonb_to_recordset(plan) AS entry(
    unit_id uuid, unit_number text, charge_type_id uuid, charge_name text,
    method text, amount_paise bigint, skip_reason text, occupancy text,
    eligibility text
  )
  ORDER BY entry.unit_id, entry.charge_type_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.billing_calculate_lines(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb
)
RETURNS TABLE (
  unit_id uuid,
  unit_number text,
  charge_type_id uuid,
  charge_name text,
  method text,
  amount_paise bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT plan.unit_id, plan.unit_number, plan.charge_type_id,
    plan.charge_name, plan.method, plan.amount_paise
  FROM private.billing_calculate_plan(
    p_society_id, p_period_start, p_unit_ids, p_charge_type_ids,
    p_custom_amounts
  ) plan
  WHERE plan.skip_reason IS NULL
  ORDER BY plan.unit_id, plan.charge_type_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bills_preview(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  line_data jsonb;
  skipped_data jsonb;
  line_count integer;
  new_count integer;
  total_paise numeric;
  due_date date;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT (
      private.has_role(p_society_id, ARRAY['admin']::text[])
      OR private.has_role(p_society_id, ARRAY['committee']::text[])
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  due_date := private.billing_due_date(p_society_id, p_period_start);
  WITH plan AS MATERIALIZED (
    SELECT plan.*, EXISTS (
      SELECT 1 FROM public.billing_bill_lines existing
      WHERE existing.society_id = p_society_id
        AND existing.unit_id = plan.unit_id
        AND existing.period_start = p_period_start
        AND existing.charge_type_id = plan.charge_type_id
    ) AS already_generated
    FROM private.billing_calculate_plan(
      p_society_id, p_period_start, p_unit_ids, p_charge_type_ids,
      p_custom_amounts
    ) plan
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
        'unit_id', line.unit_id,
        'unit_number', line.unit_number,
        'charge_type_id', line.charge_type_id,
        'charge_name', line.charge_name,
        'method', line.method,
        'amount_paise', line.amount_paise,
        'already_generated', line.already_generated
      ) ORDER BY line.unit_id, line.charge_type_id)
      FILTER (WHERE line.skip_reason IS NULL), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
        'unit_id', line.unit_id,
        'unit_number', line.unit_number,
        'charge_type_id', line.charge_type_id,
        'charge_name', line.charge_name,
        'reason', line.skip_reason,
        'occupancy', line.occupancy,
        'eligibility', line.eligibility
      ) ORDER BY line.unit_number, line.unit_id, line.charge_name,
        line.charge_type_id)
      FILTER (WHERE line.skip_reason IS NOT NULL), '[]'::jsonb),
    (count(*) FILTER (WHERE line.skip_reason IS NULL))::integer,
    (count(*) FILTER (
      WHERE line.skip_reason IS NULL AND NOT line.already_generated
    ))::integer,
    coalesce(sum(line.amount_paise) FILTER (
      WHERE line.skip_reason IS NULL AND NOT line.already_generated
    ), 0)
  INTO line_data, skipped_data, line_count, new_count, total_paise
  FROM plan line;
  result := jsonb_build_object(
    'society_id', p_society_id,
    'period_start', p_period_start,
    'due_date', due_date,
    'unit_count', cardinality(p_unit_ids),
    'line_count', line_count,
    'new_line_count', new_count,
    'new_total_paise', total_paise::text,
    'lines', line_data,
    'skipped', skipped_data
  );
  result := result || jsonb_build_object(
    'preview_hash', md5(result::text)
  );
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_bills_generate(
  p_society_id uuid,
  p_period_start date,
  p_unit_ids uuid[],
  p_charge_type_ids uuid[],
  p_custom_amounts jsonb,
  p_preview_hash text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  preview jsonb;
  generated_count integer;
  generated_line_count integer;
  new_total numeric;
  job_id uuid;
  bill_ids uuid[];
  recipient record;
  ledger_count integer;
  utility jsonb;
  utility_summary jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Billing administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_preview_hash IS NULL OR p_preview_hash !~ '^[0-9a-f]{32}$'
  THEN
    RAISE EXCEPTION 'The billing preview is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.module_configs config
    WHERE config.society_id = p_society_id AND config.module_key = 'billing'
    FOR SHARE;
  PERFORM 1 FROM public.billing_charge_types charge
    WHERE charge.society_id = p_society_id AND charge.id = ANY(p_charge_type_ids)
    ORDER BY charge.id FOR SHARE;
  PERFORM 1 FROM public.units unit
    WHERE unit.society_id = p_society_id AND unit.id = ANY(p_unit_ids)
    ORDER BY unit.id FOR UPDATE;
  preview := public.billing_bills_preview(
    p_society_id, p_period_start, p_unit_ids, p_charge_type_ids, p_custom_amounts
  );
  IF preview->>'preview_hash' IS DISTINCT FROM p_preview_hash THEN
    RAISE EXCEPTION 'The billing preview has changed. Review it before generating.'
      USING ERRCODE = '23505';
  END IF;
  -- Recalculating after the hash check could pick up a concurrently confirmed occupancy.
  IF EXISTS (
    SELECT line.unit_id
    FROM jsonb_to_recordset(preview->'lines')
      AS line(unit_id uuid, amount_paise bigint, already_generated boolean)
    WHERE NOT line.already_generated
    GROUP BY line.unit_id
    HAVING sum(line.amount_paise) > 9007199254740991
  ) THEN
    RAISE EXCEPTION 'The bill total is outside the supported paise range.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.jobs (
    society_id, created_by, type, status, progress, summary, finished_at
  ) VALUES (
    p_society_id, auth.uid(), 'bill_generation', 'running', 0,
    jsonb_build_object('period_start', p_period_start), NULL
  ) RETURNING id INTO job_id;
  WITH new_lines AS MATERIALIZED (
    SELECT line.*
    FROM jsonb_to_recordset(preview->'lines') AS line(
      unit_id uuid, charge_type_id uuid, charge_name text, amount_paise bigint,
      already_generated boolean
    )
    WHERE NOT line.already_generated
  ),
  totals AS (
    SELECT line.unit_id, sum(line.amount_paise) AS total_paise
    FROM new_lines line GROUP BY line.unit_id
  ),
  new_bills AS (
    INSERT INTO public.billing_bills (
      society_id, unit_id, kind, title, period_start, due_date, total_paise, created_by
    )
    SELECT p_society_id, totals.unit_id, 'regular',
      'Society charges - ' || to_char(p_period_start, 'Mon YYYY'),
      p_period_start, (preview->>'due_date')::date, totals.total_paise::bigint, auth.uid()
    FROM totals RETURNING id, unit_id
  ),
  new_bill_lines AS (
    INSERT INTO public.billing_bill_lines (
      society_id, bill_id, unit_id, period_start, charge_type_id,
      description, amount_paise, created_by
    )
    SELECT p_society_id, bill.id, line.unit_id, p_period_start,
      line.charge_type_id, line.charge_name, line.amount_paise, auth.uid()
    FROM new_bills bill JOIN new_lines line ON line.unit_id = bill.unit_id
    RETURNING bill_id, unit_id, amount_paise
  ),
  new_ledger_entries AS (
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
    )
    SELECT p_society_id, bill.unit_id, 'bill', 'debit',
      totals.total_paise::bigint, bill.id, auth.uid()
    FROM new_bills bill JOIN totals ON totals.unit_id = bill.unit_id
    RETURNING id
  )
  SELECT
    (SELECT count(*)::integer FROM new_bills),
    (SELECT count(*)::integer FROM new_bill_lines),
    coalesce((SELECT sum(amount_paise) FROM new_bill_lines), 0),
    coalesce((SELECT array_agg(id) FROM new_bills), ARRAY[]::uuid[]),
    (SELECT count(*)::integer FROM new_ledger_entries)
  INTO generated_count, generated_line_count, new_total, bill_ids, ledger_count;
  IF ledger_count <> generated_count THEN
    RAISE EXCEPTION 'Billing ledger entries could not be created.' USING ERRCODE = '23514';
  END IF;
  IF private.module_enabled(p_society_id, 'metering') THEN
    utility := private.metering_billing_post(p_society_id, LEAST(private.metering_today(p_society_id), (p_period_start + interval '1 month' - interval '1 day')::date), p_request_id, p_period_start, p_unit_ids);
    utility_summary := jsonb_build_object('bills', utility->'bills_created', 'charges', utility->'charges_billed', 'has_more', utility->'has_more');
    IF (utility->>'bills_created')::integer > 0 OR (utility->>'charges_no_charge')::integer > 0 THEN
      PERFORM private.metering_audit(p_society_id, 'admin', 'billing.generate', 'module', NULL,
        utility || jsonb_build_object('period_start', p_period_start, 'billing_job_id', job_id), p_request_id);
    END IF;
  END IF;
  FOR recipient IN
    SELECT DISTINCT bill.id AS bill_id, membership.user_id
    FROM public.billing_bills bill
    JOIN public.unit_occupants occupant
      ON occupant.society_id = bill.society_id
      AND occupant.unit_id = bill.unit_id AND occupant.status = 'active'
    JOIN public.memberships membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
      AND membership.status = 'active' AND membership.user_id IS NOT NULL
    WHERE bill.society_id = p_society_id AND bill.id = ANY(bill_ids)
    ORDER BY bill.id, membership.user_id
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, 'billing_bill_generated',
      'A new society bill is available',
      'A bill for ' || to_char(p_period_start, 'Mon YYYY') || ' is available in Billing.',
      'billing_bill', recipient.bill_id, p_request_id
    );
  END LOOP;
  UPDATE public.jobs
    SET status = 'succeeded', progress = 100,
        summary = jsonb_build_object(
          'period_start', p_period_start,
          'generated_bill_count', generated_count,
          'generated_line_count', generated_line_count,
          'already_generated_count', (preview->>'line_count')::integer - generated_line_count,
          'total_paise', new_total::text,
          'utility', utility_summary
        ), finished_at = now()
    WHERE id = job_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'billing.bills.generate',
    'billing_job', job_id::text, NULL,
    jsonb_build_object(
      'period_start', p_period_start, 'generated_bill_count', generated_count,
      'generated_line_count', generated_line_count, 'total_paise', new_total::text,
      'utility', utility_summary
    ), p_request_id
  );
  RETURN jsonb_build_object(
    'job_id', job_id, 'period_start', p_period_start, 'due_date', preview->'due_date',
    'generated_bill_count', generated_count, 'generated_line_count', generated_line_count,
    'already_generated_count', (preview->>'line_count')::integer - generated_line_count,
    'total_paise', new_total::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_estimate(
  p_society_id uuid,
  p_area_sqft numeric,
  p_occupancy text,
  p_custom_amounts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  configured_rounding text;
  plan jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_area_sqft IS NULL OR p_area_sqft <= 0 OR p_area_sqft > 999999.99
    OR p_area_sqft <> round(p_area_sqft, 2)
    OR p_occupancy IS NULL OR p_occupancy NOT IN ('owner', 'tenant', 'vacant')
  THEN
    RAISE EXCEPTION 'Enter a valid area and occupancy.' USING ERRCODE = '22023';
  END IF;
  IF p_custom_amounts IS NULL THEN p_custom_amounts := '[]'::jsonb; END IF;
  IF jsonb_typeof(p_custom_amounts) <> 'array'
    OR jsonb_array_length(p_custom_amounts) > 100
  THEN
    RAISE EXCEPTION 'Custom charge amounts are invalid.' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_custom_amounts) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(item)) <> 2
      OR NOT (item ?& ARRAY['charge_type_id', 'amount_paise'])
      OR jsonb_typeof(item->'charge_type_id') <> 'string'
      OR item->>'charge_type_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(item->'amount_paise') <> 'number'
      OR item->>'amount_paise' !~ '^[1-9][0-9]*$'
      OR (item->>'amount_paise')::numeric > 9007199254740991
    THEN
      RAISE EXCEPTION 'Custom charge amounts are invalid.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_custom_amounts)
      AS custom(charge_type_id uuid, amount_paise bigint)
    GROUP BY custom.charge_type_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_custom_amounts)
      AS custom(charge_type_id uuid, amount_paise bigint)
    LEFT JOIN public.billing_charge_types charge
      ON charge.society_id = p_society_id AND charge.id = custom.charge_type_id
      AND charge.active AND charge.method = 'custom'
    WHERE charge.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Custom charge amounts are invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(settings->>'rounding', 'rupee') INTO configured_rounding
    FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'billing';
  IF configured_rounding NOT IN ('rupee', 'paise') THEN
    RAISE EXCEPTION 'Billing rounding settings are invalid.' USING ERRCODE = '22023';
  END IF;
  WITH custom AS (
    SELECT item.charge_type_id, item.amount_paise
    FROM jsonb_to_recordset(p_custom_amounts)
      AS item(charge_type_id uuid, amount_paise bigint)
  ),
  charges AS MATERIALIZED (
    SELECT charge.id, charge.name, charge.method, charge.amount_paise,
      charge.base_charge_type_id, charge.percent_basis_points,
      charge.eligibility, custom.amount_paise AS custom_paise
    FROM public.billing_charge_types charge
    LEFT JOIN custom ON custom.charge_type_id = charge.id
    WHERE charge.society_id = p_society_id AND charge.active
  ),
  direct AS MATERIALIZED (
    SELECT charge.*,
      CASE
        WHEN charge.eligibility NOT IN ('all', p_occupancy) THEN 'not_eligible'
        WHEN charge.method = 'custom' AND charge.custom_paise IS NULL
          THEN 'no_amount'
      END AS skip_reason,
      CASE
        WHEN charge.eligibility NOT IN ('all', p_occupancy) THEN NULL
        WHEN charge.method = 'custom' THEN charge.custom_paise
        WHEN charge.method = 'per_sqft' AND configured_rounding = 'rupee'
          THEN private.billing_checked_amount(
            round(charge.amount_paise * p_area_sqft / 100) * 100
          )
        WHEN charge.method = 'per_sqft'
          THEN private.billing_checked_amount(
            round(charge.amount_paise * p_area_sqft)
          )
        WHEN charge.method = 'fixed' THEN charge.amount_paise
      END AS line_paise
    FROM charges charge
  ),
  calculated AS (
    SELECT charge.id, charge.name, charge.method,
      CASE
        WHEN charge.method <> 'percent_of_charge' THEN charge.skip_reason
        WHEN charge.eligibility NOT IN ('all', p_occupancy) THEN 'not_eligible'
        WHEN base.eligibility NOT IN ('all', p_occupancy) THEN 'not_applicable'
        WHEN base.line_paise IS NULL THEN 'base_excluded'
      END AS skip_reason,
      CASE
        WHEN charge.method <> 'percent_of_charge' THEN charge.line_paise
        WHEN charge.eligibility NOT IN ('all', p_occupancy)
          OR base.line_paise IS NULL THEN NULL
        WHEN configured_rounding = 'rupee'
          THEN round(base.line_paise::numeric * charge.percent_basis_points / 1000000.0) * 100
        ELSE round(base.line_paise::numeric * charge.percent_basis_points / 10000.0)
      END AS amount_paise,
      charge.percent_basis_points, base.name AS base_name
    FROM direct charge
    LEFT JOIN direct base ON base.id = charge.base_charge_type_id
  ), result AS (
    SELECT calculated.*,
      CASE WHEN calculated.amount_paise = 0 THEN 'rounds_to_zero'
        ELSE calculated.skip_reason END AS reason
    FROM calculated
  )
  SELECT jsonb_build_object(
    'area_sqft', p_area_sqft::text,
    'occupancy', p_occupancy,
    'rounding', configured_rounding,
    'lines', coalesce(jsonb_agg(jsonb_build_object(
        'charge_type_id', item.id, 'charge_name', item.name,
        'method', item.method, 'amount_paise', item.amount_paise,
        'percent_basis_points', item.percent_basis_points,
        'base_charge_name', item.base_name
      ) ORDER BY item.name, item.id) FILTER (WHERE item.reason IS NULL),
      '[]'::jsonb),
    'skipped', coalesce(jsonb_agg(jsonb_build_object(
        'charge_type_id', item.id, 'charge_name', item.name,
        'method', item.method, 'reason', item.reason
      ) ORDER BY item.name, item.id) FILTER (WHERE item.reason IS NOT NULL),
      '[]'::jsonb),
    'total_paise', (coalesce(sum(item.amount_paise)
      FILTER (WHERE item.reason IS NULL), 0))::text
  ) INTO plan
  FROM result item;
  RETURN plan;
END;
$$;

-- Society-level aggregates only: no names, phone numbers or unit-level balances.
CREATE OR REPLACE FUNCTION private.billing_report_summary_data(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH payments AS (
    SELECT payment.mode, count(*)::integer AS payment_count,
      sum(payment.amount_paise) AS amount
    FROM public.billing_payments payment
    WHERE payment.society_id = p_society_id AND payment.status = 'confirmed'
      AND payment.paid_on BETWEEN p_from AND p_to
    GROUP BY payment.mode
  ),
  bills AS (
    SELECT bill.*, unit.block_id, block.name AS block_name,
      CASE
        WHEN bill.status IN ('due', 'partially_paid')
          AND bill.due_date < private.billing_society_today(p_society_id)
          THEN 'overdue'
        ELSE bill.status
      END AS display_status
    FROM public.billing_bills bill
    JOIN public.units unit
      ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
    LEFT JOIN public.blocks block
      ON block.society_id = unit.society_id AND block.id = unit.block_id
    WHERE bill.society_id = p_society_id
      AND bill.period_start BETWEEN date_trunc('month', p_from)::date AND p_to
  ),
  blocks AS (
    SELECT bill.block_id, bill.block_name, count(*)::integer AS bill_count,
      sum(bill.total_paise) AS billed, sum(bill.paid_paise) AS collected,
      sum(bill.waived_paise) AS waived,
      sum(bill.total_paise - bill.paid_paise - bill.waived_paise) AS outstanding
    FROM bills bill
    WHERE bill.cancelled_at IS NULL
    GROUP BY bill.block_id, bill.block_name
  ),
  statuses AS (
    SELECT bill.display_status, count(*)::integer AS bill_count,
      sum(bill.total_paise) AS total,
      sum(CASE WHEN bill.cancelled_at IS NULL
        THEN bill.total_paise - bill.paid_paise - bill.waived_paise ELSE 0 END)
        AS outstanding
    FROM bills bill
    GROUP BY bill.display_status
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'collections_by_mode', (
      SELECT jsonb_agg(jsonb_build_object(
          'mode', mode.key,
          'payment_count', coalesce(payments.payment_count, 0),
          'amount_paise', coalesce(payments.amount, 0)::text
        ) ORDER BY mode.ord)
      FROM unnest(ARRAY['upi', 'cash', 'cheque', 'bank_transfer'])
        WITH ORDINALITY AS mode(key, ord)
      LEFT JOIN payments ON payments.mode = mode.key
    ),
    'block_totals', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'block_id', item.block_id,
          'block_name', item.block_name,
          'bill_count', item.bill_count,
          'billed_paise', item.billed::text,
          'collected_paise', item.collected::text,
          'waived_paise', item.waived::text,
          'outstanding_paise', item.outstanding::text
        ) ORDER BY item.block_name NULLS LAST, item.block_id), '[]'::jsonb)
      FROM blocks item
    ),
    'status_summary', (
      SELECT jsonb_agg(jsonb_build_object(
          'status', status.key,
          'bill_count', coalesce(item.bill_count, 0),
          'total_paise', coalesce(item.total, 0)::text,
          'outstanding_paise', coalesce(item.outstanding, 0)::text
        ) ORDER BY status.ord)
      FROM unnest(ARRAY[
          'due', 'partially_paid', 'overdue', 'paid', 'waived', 'cancelled'
        ]) WITH ORDINALITY AS status(key, ord)
      LEFT JOIN statuses item ON item.display_status = status.key
    ),
    'unapplied_credit_paise', (
      SELECT (coalesce(sum(ledger.amount_paise), 0) - coalesce((
          SELECT sum(allocation.amount_paise)
          FROM public.billing_payment_allocations allocation
          JOIN public.billing_payments allocated
            ON allocated.society_id = allocation.society_id
            AND allocated.id = allocation.payment_id
          WHERE allocation.society_id = p_society_id
            AND allocated.status = 'confirmed'
        ), 0))::text
      FROM public.billing_ledger_entries ledger
      JOIN public.billing_payments payment
        ON payment.society_id = ledger.society_id AND payment.id = ledger.payment_id
      WHERE ledger.society_id = p_society_id AND ledger.kind = 'payment'
        AND payment.status = 'confirmed'
    ),
    'credit_as_of', private.billing_society_today(p_society_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.billing_report_summary(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to
    OR p_to - p_from > 731
  THEN
    RAISE EXCEPTION 'Choose a valid date range.' USING ERRCODE = '22023';
  END IF;
  RETURN private.billing_report_summary_data(p_society_id, p_from, p_to);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_report_export(
  p_society_id uuid,
  p_report text,
  p_from date,
  p_to date,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  report_columns jsonb;
  report_rows jsonb;
  row_count integer;
  job_id uuid;
  actor_role text;
  today date;
  summary jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'billing')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
  THEN
    RAISE EXCEPTION 'Billing report access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_report IS NULL
    OR p_report NOT IN (
      'dues_by_unit', 'collections', 'defaulters',
      'collections_by_mode', 'block_totals', 'bill_status', 'unapplied_credit'
    )
    OR p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid report and date range.'
      USING ERRCODE = '22023';
  END IF;
  today := private.billing_society_today(p_society_id);
  actor_role := CASE
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    ELSE 'committee'
  END;
  IF p_report IN ('collections_by_mode', 'block_totals', 'bill_status', 'unapplied_credit') THEN
    summary := private.billing_report_summary_data(p_society_id, p_from, p_to);
  END IF;
  IF p_report = 'dues_by_unit' THEN
    report_columns := '["Unit","Bills","Billed (Rs.)","Paid (Rs.)","Waived (Rs.)","Outstanding (Rs.)","Oldest unpaid due date"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        item.number, item.bill_count, private.billing_rupees(item.billed),
        private.billing_rupees(item.paid), private.billing_rupees(item.waived),
        private.billing_rupees(item.outstanding), item.oldest_due
      ) ORDER BY item.number), '[]'::jsonb)
      INTO report_rows
    FROM (
      SELECT unit.number, count(*)::integer AS bill_count,
        sum(bill.total_paise) AS billed, sum(bill.paid_paise) AS paid,
        sum(bill.waived_paise) AS waived,
        sum(bill.total_paise - bill.paid_paise - bill.waived_paise) AS outstanding,
        min(bill.due_date) FILTER (
          WHERE bill.paid_paise + bill.waived_paise < bill.total_paise
        )::text AS oldest_due
      FROM public.billing_bills bill
      JOIN public.units unit
        ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
      WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
        AND bill.period_start BETWEEN date_trunc('month', p_from)::date AND p_to
      GROUP BY unit.number
      LIMIT 10000
    ) item;
  ELSIF p_report = 'collections' THEN
    report_columns := '["Receipt","Unit","Paid on","Mode","Reference","Amount (Rs.)","Source","Confirmed at"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        item.receipt_no, item.number, item.paid_on::text, item.mode,
        item.reference, private.billing_rupees(item.amount_paise),
        item.source, item.confirmed_at
      ) ORDER BY item.paid_on, item.receipt_no), '[]'::jsonb)
      INTO report_rows
    FROM (
      SELECT payment.receipt_no, unit.number, payment.paid_on, payment.mode,
        payment.reference, payment.amount_paise, payment.source,
        to_char(
          payment.confirmed_at AT TIME ZONE society.timezone,
          'YYYY-MM-DD HH24:MI'
        ) AS confirmed_at
      FROM public.billing_payments payment
      JOIN public.units unit
        ON unit.society_id = payment.society_id AND unit.id = payment.unit_id
      JOIN public.societies society ON society.id = payment.society_id
      WHERE payment.society_id = p_society_id
        AND payment.status = 'confirmed'
        AND payment.paid_on BETWEEN p_from AND p_to
      ORDER BY payment.paid_on, payment.receipt_no
      LIMIT 10000
    ) item;
  ELSIF p_report = 'defaulters' THEN
    report_columns := '["Unit","Overdue bills","Overdue (Rs.)","Oldest due date","Days overdue"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        item.number, item.bill_count, private.billing_rupees(item.overdue),
        item.oldest_due::text, today - item.oldest_due
      ) ORDER BY item.overdue DESC, item.number), '[]'::jsonb)
      INTO report_rows
    FROM (
      SELECT unit.number, count(*)::integer AS bill_count,
        sum(bill.total_paise - bill.paid_paise - bill.waived_paise) AS overdue,
        min(bill.due_date) AS oldest_due
      FROM public.billing_bills bill
      JOIN public.units unit
        ON unit.society_id = bill.society_id AND unit.id = bill.unit_id
      WHERE bill.society_id = p_society_id AND bill.cancelled_at IS NULL
        AND bill.paid_paise + bill.waived_paise < bill.total_paise
        AND bill.due_date < least(today, p_to + 1)
      GROUP BY unit.number
      LIMIT 10000
    ) item;
  ELSIF p_report = 'collections_by_mode' THEN
    report_columns := '["Mode","Payments","Amount (Rs.)"]'::jsonb;
    SELECT jsonb_agg(jsonb_build_array(
        CASE item->>'mode' WHEN 'upi' THEN 'UPI' WHEN 'cash' THEN 'Cash'
          WHEN 'cheque' THEN 'Cheque' ELSE 'Bank transfer' END,
        (item->>'payment_count')::integer,
        private.billing_rupees((item->>'amount_paise')::numeric)
      ) ORDER BY ord)
      INTO report_rows
    FROM jsonb_array_elements(summary->'collections_by_mode')
      WITH ORDINALITY AS entry(item, ord);
  ELSIF p_report = 'block_totals' THEN
    report_columns := '["Block","Bills","Billed (Rs.)","Collected (Rs.)","Waived (Rs.)","Outstanding (Rs.)"]'::jsonb;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
        coalesce(item->>'block_name', 'No block'),
        (item->>'bill_count')::integer,
        private.billing_rupees((item->>'billed_paise')::numeric),
        private.billing_rupees((item->>'collected_paise')::numeric),
        private.billing_rupees((item->>'waived_paise')::numeric),
        private.billing_rupees((item->>'outstanding_paise')::numeric)
      ) ORDER BY ord), '[]'::jsonb)
      INTO report_rows
    FROM jsonb_array_elements(summary->'block_totals')
      WITH ORDINALITY AS entry(item, ord);
  ELSIF p_report = 'unapplied_credit' THEN
    report_columns := '["As of","Unapplied advance credit (Rs.)"]'::jsonb;
    report_rows := jsonb_build_array(jsonb_build_array(
      summary->>'credit_as_of',
      private.billing_rupees((summary->>'unapplied_credit_paise')::numeric)
    ));
  ELSE
    report_columns := '["Status","Bills","Total (Rs.)","Outstanding (Rs.)"]'::jsonb;
    SELECT jsonb_agg(jsonb_build_array(
        CASE item->>'status' WHEN 'due' THEN 'Due'
          WHEN 'partially_paid' THEN 'Partially paid'
          WHEN 'overdue' THEN 'Overdue' WHEN 'paid' THEN 'Paid'
          WHEN 'waived' THEN 'Waived' ELSE 'Cancelled' END,
        (item->>'bill_count')::integer,
        private.billing_rupees((item->>'total_paise')::numeric),
        private.billing_rupees((item->>'outstanding_paise')::numeric)
      ) ORDER BY ord)
      INTO report_rows
    FROM jsonb_array_elements(summary->'status_summary')
      WITH ORDINALITY AS entry(item, ord);
  END IF;
  row_count := jsonb_array_length(report_rows);
  INSERT INTO public.jobs (
    society_id, created_by, type, status, progress, summary, finished_at
  ) VALUES (
    p_society_id, auth.uid(), 'export', 'succeeded', 100,
    jsonb_build_object(
      'module', 'billing', 'report', p_report, 'from', p_from, 'to', p_to,
      'row_count', row_count, 'columns', report_columns, 'rows', report_rows
    ), now()
  ) RETURNING id INTO job_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), actor_role, 'billing.reports.export', 'job',
    job_id::text, NULL,
    jsonb_build_object(
      'report', p_report, 'from', p_from, 'to', p_to, 'row_count', row_count
    ), p_request_id
  );
  RETURN jsonb_build_object(
    'job_id', job_id, 'report', p_report, 'row_count', row_count
  );
END;
$$;

REVOKE ALL ON FUNCTION
  private.billing_unit_occupancy(uuid, uuid[], date),
  private.billing_calculate_plan(uuid, date, uuid[], uuid[], jsonb),
  private.billing_report_summary_data(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.billing_charge_save(
    uuid, uuid, text, text, bigint, boolean, timestamptz, text, uuid, integer, text
  ),
  public.billing_estimate(uuid, numeric, text, jsonb),
  public.billing_report_summary(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.billing_charge_save(
    uuid, uuid, text, text, bigint, boolean, timestamptz, text, uuid, integer, text
  ),
  public.billing_estimate(uuid, numeric, text, jsonb),
  public.billing_report_summary(uuid, date, date)
  TO authenticated;
