-- P56 shared CSV imports: read-only context, one atomic save and one opening-dues lock per society.
ALTER TABLE public.billing_bills
  DROP CONSTRAINT billing_bills_kind_check,
  ADD CONSTRAINT billing_bills_kind_check
    CHECK (
      kind IN ('regular', 'fine', 'late_fee', 'interest', 'opening_dues')
    );
ALTER TABLE public.jobs
  DROP CONSTRAINT jobs_type_check,
  ADD CONSTRAINT jobs_type_check CHECK (type IN (
    'bill_generation',
    'bill_email',
    'csv_import_units',
    'csv_import_residents',
    'csv_import',
    'export'
  ));
CREATE UNIQUE INDEX billing_bills_opening_dues_unit_key
  ON public.billing_bills (society_id, unit_id)
  WHERE kind = 'opening_dues';

CREATE TABLE public.society_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE CASCADE,
  kind text NOT NULL,
  row_count integer NOT NULL,
  request_id text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT society_import_runs_kind_check
    CHECK (kind IN (
      'units',
      'residents',
      'opening_dues',
      'vehicles',
      'staff',
      'assets'
    )),
  CONSTRAINT society_import_runs_actor_check
    CHECK (actor_role IN ('admin', 'developer')),
  CONSTRAINT society_import_runs_count_check
    CHECK (row_count BETWEEN 1 AND 2000),
  CONSTRAINT society_import_runs_request_check
    CHECK (char_length(request_id) BETWEEN 1 AND 128),
  UNIQUE (society_id, actor_id, kind, request_id)
);

CREATE INDEX society_import_runs_society_created_idx
  ON public.society_import_runs (society_id, created_at DESC);
CREATE INDEX society_import_runs_actor_idx
  ON public.society_import_runs (actor_id);
ALTER TABLE public.society_import_runs
  ADD CONSTRAINT society_import_runs_society_id_id_key
  UNIQUE (society_id, id);

CREATE TABLE public.society_opening_dues_imports (
  society_id uuid PRIMARY KEY
    REFERENCES public.societies (id) ON DELETE CASCADE,
  import_run_id uuid NOT NULL,
  imported_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT society_opening_dues_import_run_fkey
    FOREIGN KEY (society_id, import_run_id)
    REFERENCES public.society_import_runs (society_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.society_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_opening_dues_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY society_import_runs_no_direct_access
  ON public.society_import_runs FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY society_opening_dues_imports_no_direct_access
  ON public.society_opening_dues_imports FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.society_import_runs,
  public.society_opening_dues_imports
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.bulk_import_context_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_developer()
    AND NOT private.has_role(p_society_id, ARRAY['admin']::text[])
  THEN
    RAISE EXCEPTION 'Import access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', block.id,
        'name', block.name
      ) ORDER BY block.name)
      FROM public.blocks AS block
      WHERE block.society_id = p_society_id
        AND block.active
    ), '[]'::jsonb),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', unit.id,
        'block_id', unit.block_id,
        'number', unit.number
      ) ORDER BY unit.number)
      FROM public.units AS unit
      WHERE unit.society_id = p_society_id
        AND unit.active
    ), '[]'::jsonb),
    'residents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'membership_id', membership.id,
        'email', profile.email,
        'unit_id', occupant.unit_id
      ) ORDER BY profile.email, occupant.unit_id)
      FROM public.memberships AS membership
      JOIN public.profiles AS profile
        ON profile.id = membership.user_id
      JOIN public.unit_occupants AS occupant
        ON occupant.society_id = membership.society_id
        AND occupant.membership_id = membership.id
        AND occupant.status = 'active'
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND 'resident' = ANY (membership.roles)
    ), '[]'::jsonb),
    'assetCategories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', category.id,
        'name', category.name
      ) ORDER BY category.name)
      FROM public.asset_categories AS category
      WHERE category.society_id = p_society_id
        AND category.active
    ), '[]'::jsonb),
    'existingResidentEmails', COALESCE((
      SELECT jsonb_agg(existing_email.email ORDER BY existing_email.email)
      FROM (
        SELECT lower(profile.email::text) AS email
        FROM public.memberships AS membership
        JOIN public.profiles AS profile
          ON profile.id = membership.user_id
        WHERE membership.society_id = p_society_id
        UNION
        SELECT lower(membership.invited_email::text) AS email
        FROM public.memberships AS membership
        WHERE membership.society_id = p_society_id
          AND membership.invited_email IS NOT NULL
      ) AS existing_email
    ), '[]'::jsonb),
    'existingVehicleRegistrations', COALESCE((
      SELECT jsonb_agg(
        vehicle.registration_number
        ORDER BY vehicle.registration_number
      )
      FROM public.directory_vehicles AS vehicle
      WHERE vehicle.society_id = p_society_id
        AND vehicle.status = 'active'
    ), '[]'::jsonb),
    'existingDomesticStaffPhones', COALESCE((
      SELECT jsonb_agg(staff.phone ORDER BY staff.phone)
      FROM public.staff_members AS staff
      WHERE staff.society_id = p_society_id
        AND staff.staff_type = 'domestic'
        AND staff.status = 'active'
    ), '[]'::jsonb),
    'openingDuesImported', EXISTS (
      SELECT 1
      FROM public.society_opening_dues_imports AS opening
      WHERE opening.society_id = p_society_id
    )
  );
END;
$$;

CREATE FUNCTION public.bulk_import_save(
  p_society_id uuid,
  p_kind text,
  p_rows jsonb,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_actor_id uuid := auth.uid();
  import_actor_role text;
  row_value jsonb;
  import_row_count integer;
  run_id uuid;
  module_key text;
  block_id_value uuid;
  membership_id_value uuid;
  staff_id_value uuid;
  bill_id_value uuid;
  as_on_value date;
  unit_id_value uuid;
  unit_name_value text;
BEGIN
  IF private.is_developer() THEN
    import_actor_role := 'developer';
  ELSIF private.has_role(p_society_id, ARRAY['admin']::text[]) THEN
    import_actor_role := 'admin';
  ELSE
    RAISE EXCEPTION 'Import access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN (
    'units',
    'residents',
    'opening_dues',
    'vehicles',
    'staff',
    'assets'
  ) THEN
    RAISE EXCEPTION 'Choose a supported import list.' USING ERRCODE = '22023';
  END IF;
  module_key := CASE p_kind
    WHEN 'opening_dues' THEN 'billing'
    WHEN 'vehicles' THEN 'directory'
    WHEN 'staff' THEN 'staff'
    WHEN 'assets' THEN 'asset'
    ELSE 'core'
  END;
  IF NOT private.module_enabled(p_society_id, module_key)
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'This import is not available for the society.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'The import payload is invalid.' USING ERRCODE = '22023';
  END IF;
  import_row_count := jsonb_array_length(p_rows);
  IF import_row_count NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'The import must contain 1 to 2000 rows.'
      USING ERRCODE = '22023';
  END IF;

  SELECT run.id INTO run_id
  FROM public.society_import_runs AS run
  WHERE run.society_id = p_society_id
    AND run.actor_id = current_actor_id
    AND run.kind = p_kind
    AND run.request_id = p_request_id;
  IF run_id IS NOT NULL THEN
    RETURN run_id;
  END IF;

  run_id := gen_random_uuid();
  INSERT INTO public.jobs (
    id,
    society_id,
    created_by,
    updated_by,
    type,
    status,
    progress,
    summary,
    finished_at
  )
  VALUES (
    run_id,
    p_society_id,
    current_actor_id,
    current_actor_id,
    'csv_import',
    'succeeded',
    100,
    jsonb_build_object(
      'totalRows', import_row_count,
      'importedRows', import_row_count,
      'failedRows', 0,
      'kind', p_kind
    ),
    now()
  );
  INSERT INTO public.society_import_runs (
    id,
    society_id,
    kind,
    row_count,
    request_id,
    actor_id,
    actor_role
  )
  VALUES (
    run_id,
    p_society_id,
    p_kind,
    import_row_count,
    p_request_id,
    current_actor_id,
    import_actor_role
  );

  IF p_kind = 'opening_dues' THEN
    INSERT INTO public.society_opening_dues_imports (
      society_id,
      import_run_id,
      imported_by
    )
    VALUES (p_society_id, run_id, current_actor_id);
  END IF;

  FOR row_value IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    IF jsonb_typeof(row_value) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'An import row is invalid.' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'units' THEN
      block_id_value := NULL;
      IF NULLIF(btrim(row_value ->> 'blockName'), '') IS NOT NULL THEN
        SELECT block.id INTO STRICT block_id_value
        FROM public.blocks AS block
        WHERE block.society_id = p_society_id
          AND block.name = btrim(row_value ->> 'blockName')
          AND block.active;
      END IF;
      INSERT INTO public.units (
        society_id,
        block_id,
        number,
        floor,
        unit_type,
        area_sqft
      )
      VALUES (
        p_society_id,
        block_id_value,
        btrim(row_value ->> 'number'),
        NULLIF(row_value ->> 'floor', '')::integer,
        NULLIF(row_value ->> 'unitType', ''),
        NULLIF(row_value ->> 'areaSqft', '')::numeric
      );
    ELSIF p_kind = 'residents' THEN
      INSERT INTO public.memberships (
        society_id,
        invited_email,
        roles,
        status,
        invited_by
      )
      VALUES (
        p_society_id,
        lower(btrim(row_value ->> 'email'))::extensions.citext,
        ARRAY['resident']::text[],
        'invited',
        current_actor_id
      )
      RETURNING id INTO membership_id_value;
      INSERT INTO public.unit_occupants (
        society_id,
        unit_id,
        membership_id,
        relationship,
        is_primary,
        is_approver,
        status
      )
      VALUES (
        p_society_id,
        (row_value ->> 'unitId')::uuid,
        membership_id_value,
        row_value ->> 'relationship',
        (row_value ->> 'isPrimary')::boolean,
        (row_value ->> 'isApprover')::boolean,
        'pending'
      );
    ELSIF p_kind = 'opening_dues' THEN
      unit_id_value := (row_value ->> 'unitId')::uuid;
      as_on_value := (row_value ->> 'asOn')::date;
      unit_name_value := (
        SELECT unit.number
        FROM public.units AS unit
        WHERE unit.society_id = p_society_id
          AND unit.id = unit_id_value
          AND unit.active
      );
      IF unit_name_value IS NULL THEN
        RAISE EXCEPTION 'The opening-dues unit is unavailable.'
          USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.billing_bills (
        society_id,
        unit_id,
        kind,
        title,
        period_start,
        due_date,
        total_paise,
        created_by
      )
      VALUES (
        p_society_id,
        unit_id_value,
        'opening_dues',
        'Opening dues as on ' || as_on_value::text,
        date_trunc('month', as_on_value)::date,
        (row_value ->> 'dueDate')::date,
        (row_value ->> 'amountPaise')::bigint,
        current_actor_id
      )
      RETURNING id INTO bill_id_value;
      INSERT INTO public.billing_bill_lines (
        society_id,
        bill_id,
        unit_id,
        period_start,
        charge_type_id,
        description,
        amount_paise,
        created_by
      )
      VALUES (
        p_society_id,
        bill_id_value,
        unit_id_value,
        date_trunc('month', as_on_value)::date,
        NULL,
        'Opening dues as on ' || as_on_value::text,
        (row_value ->> 'amountPaise')::bigint,
        current_actor_id
      );
      INSERT INTO public.billing_ledger_entries (
        society_id,
        unit_id,
        kind,
        direction,
        amount_paise,
        bill_id,
        created_by
      )
      VALUES (
        p_society_id,
        unit_id_value,
        'bill',
        'debit',
        (row_value ->> 'amountPaise')::bigint,
        bill_id_value,
        current_actor_id
      );
    ELSIF p_kind = 'vehicles' THEN
      INSERT INTO public.directory_vehicles (
        society_id,
        unit_id,
        membership_id,
        vehicle_type,
        registration_number,
        tag_number,
        client_request_id,
        created_by,
        updated_by
      )
      VALUES (
        p_society_id,
        (row_value ->> 'unitId')::uuid,
        (row_value ->> 'membershipId')::uuid,
        row_value ->> 'vehicleType',
        row_value ->> 'registrationNumber',
        NULLIF(row_value ->> 'tagNumber', ''),
        gen_random_uuid(),
        current_actor_id,
        current_actor_id
      );
    ELSIF p_kind = 'staff' THEN
      INSERT INTO public.staff_members (
        society_id,
        staff_type,
        full_name,
        phone,
        id_type,
        id_last_four,
        job_role,
        police_verified,
        status,
        created_by,
        updated_by
      )
      VALUES (
        p_society_id,
        row_value ->> 'staffType',
        btrim(row_value ->> 'fullName'),
        row_value ->> 'phone',
        NULLIF(row_value ->> 'idType', ''),
        upper(NULLIF(row_value ->> 'idLastFour', '')),
        btrim(row_value ->> 'jobRole'),
        (row_value ->> 'policeVerified')::boolean,
        'active',
        current_actor_id,
        current_actor_id
      )
      RETURNING id INTO staff_id_value;
      IF row_value ->> 'staffType' = 'domestic' THEN
        INSERT INTO public.staff_unit_links (
          society_id,
          staff_id,
          unit_id,
          status,
          created_by,
          decided_by,
          decided_at
        )
        VALUES (
          p_society_id,
          staff_id_value,
          (row_value ->> 'unitId')::uuid,
          'active',
          current_actor_id,
          current_actor_id,
          now()
        );
      END IF;
    ELSIF p_kind = 'assets' THEN
      INSERT INTO public.assets (
        society_id,
        category_id,
        name,
        location,
        make,
        model,
        serial_number,
        purchase_date,
        purchase_cost_paise,
        supplier,
        warranty_end_date,
        status,
        notes,
        client_request_id,
        created_by,
        updated_by
      )
      VALUES (
        p_society_id,
        (row_value ->> 'categoryId')::uuid,
        btrim(row_value ->> 'name'),
        btrim(row_value ->> 'location'),
        NULLIF(row_value ->> 'make', ''),
        NULLIF(row_value ->> 'model', ''),
        NULLIF(row_value ->> 'serialNumber', ''),
        NULLIF(row_value ->> 'purchaseDate', '')::date,
        NULLIF(row_value ->> 'purchaseCostPaise', '')::bigint,
        NULLIF(row_value ->> 'supplier', ''),
        NULLIF(row_value ->> 'warrantyEndDate', '')::date,
        row_value ->> 'status',
        NULLIF(row_value ->> 'notes', ''),
        gen_random_uuid(),
        current_actor_id,
        current_actor_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    current_actor_id,
    import_actor_role,
    'import.' || p_kind || '.save',
    'society_import_run',
    run_id::text,
    jsonb_build_object('rowCount', import_row_count, 'kind', p_kind),
    p_request_id
  );
  RETURN run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_import_context_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_import_save(uuid, text, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_import_context_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_import_save(uuid, text, jsonb, text)
  TO authenticated;
