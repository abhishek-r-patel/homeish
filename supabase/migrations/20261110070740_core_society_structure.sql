CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT blocks_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT blocks_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT blocks_society_name_key UNIQUE (society_id, name)
);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  block_id uuid,
  number text NOT NULL,
  floor integer,
  unit_type text,
  area_sqft numeric(8, 2),
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT units_number_check
    CHECK (char_length(btrim(number)) BETWEEN 1 AND 20),
  CONSTRAINT units_unit_type_check
    CHECK (unit_type IS NULL OR char_length(unit_type) <= 30),
  CONSTRAINT units_area_sqft_check
    CHECK (area_sqft IS NULL OR area_sqft > 0),
  CONSTRAINT units_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT units_block_same_society_fkey
    FOREIGN KEY (society_id, block_id)
    REFERENCES public.blocks (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT units_society_block_number_key
    UNIQUE NULLS NOT DISTINCT (society_id, block_id, number)
);

CREATE INDEX blocks_society_active_idx
  ON public.blocks (society_id, active, name);
CREATE INDEX units_society_active_number_idx
  ON public.units (society_id, active, number);
CREATE INDEX units_block_id_idx
  ON public.units (society_id, block_id) WHERE block_id IS NOT NULL;
CREATE INDEX blocks_created_by_idx ON public.blocks (created_by);
CREATE INDEX blocks_updated_by_idx ON public.blocks (updated_by);
CREATE INDEX units_created_by_idx ON public.units (created_by);
CREATE INDEX units_updated_by_idx ON public.units (updated_by);

CREATE OR REPLACE FUNCTION private.set_updated_at_and_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_updated_at_and_actor()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER blocks_set_updated_at
  BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER units_set_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocks_read_members
  ON public.blocks FOR SELECT TO authenticated
  USING (private.is_member(society_id) OR private.is_developer());
CREATE POLICY blocks_insert_admin
  ON public.blocks FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND private.society_writable(society_id)
    AND private.module_enabled(society_id, 'core')
  );
CREATE POLICY blocks_update_admin
  ON public.blocks FOR UPDATE TO authenticated
  USING (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND private.society_writable(society_id)
    AND private.module_enabled(society_id, 'core')
  )
  WITH CHECK (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND private.society_writable(society_id)
    AND private.module_enabled(society_id, 'core')
  );

CREATE POLICY units_read_members
  ON public.units FOR SELECT TO authenticated
  USING (private.is_member(society_id) OR private.is_developer());
CREATE POLICY units_insert_admin
  ON public.units FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND private.society_writable(society_id)
    AND private.module_enabled(society_id, 'core')
  );
CREATE POLICY units_update_admin
  ON public.units FOR UPDATE TO authenticated
  USING (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND private.society_writable(society_id)
    AND private.module_enabled(society_id, 'core')
  )
  WITH CHECK (
    private.has_role(society_id, ARRAY['admin']::text[])
    AND private.society_writable(society_id)
    AND private.module_enabled(society_id, 'core')
  );

REVOKE ALL ON TABLE public.blocks, public.units
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.blocks, public.units TO authenticated;
GRANT INSERT (society_id, name, active)
  ON TABLE public.blocks TO authenticated;
GRANT UPDATE (name, active)
  ON TABLE public.blocks TO authenticated;
GRANT INSERT (
  society_id, block_id, number, floor, unit_type, area_sqft, active
)
  ON TABLE public.units TO authenticated;
GRANT UPDATE (
  block_id, number, floor, unit_type, area_sqft, active
)
  ON TABLE public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.blocks, public.units TO service_role;

CREATE OR REPLACE FUNCTION public.create_units_import_job(
  p_society_id uuid,
  p_rows jsonb,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_value jsonb;
  row_number integer;
  row_index integer := 0;
  row_count integer;
  inserted_count integer := 0;
  failed_count integer := 0;
  block_name text;
  resolved_block_id uuid;
  unit_number text;
  floor_value integer;
  unit_type_value text;
  area_value numeric(8, 2);
  job_id uuid;
  row_errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import rows must be provided as an array.'
      USING ERRCODE = '22023';
  END IF;
  row_count := jsonb_array_length(p_rows);
  IF row_count NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Import must contain between 1 and 1000 rows.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.jobs (
    society_id,
    created_by,
    updated_by,
    type,
    status,
    progress
  )
  VALUES (
    p_society_id,
    auth.uid(),
    auth.uid(),
    'csv_import_units',
    'running',
    0
  )
  RETURNING id INTO job_id;

  FOR row_value IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    row_index := row_index + 1;
    row_number := COALESCE((row_value ->> 'rowNumber')::integer, row_index + 1);
    BEGIN
      IF jsonb_typeof(row_value) <> 'object' THEN
        RAISE EXCEPTION 'Invalid import row.' USING ERRCODE = '22023';
      END IF;

      block_name := NULLIF(btrim(row_value ->> 'blockName'), '');
      unit_number := btrim(COALESCE(row_value ->> 'number', ''));
      floor_value := NULLIF(btrim(row_value ->> 'floor'), '')::integer;
      unit_type_value := NULLIF(btrim(row_value ->> 'unitType'), '');
      area_value := NULLIF(btrim(row_value ->> 'areaSqft'), '')::numeric;
      resolved_block_id := NULL;

      IF block_name IS NOT NULL THEN
        SELECT block.id
        INTO resolved_block_id
        FROM public.blocks AS block
        WHERE block.society_id = p_society_id
          AND block.name = block_name
          AND block.active;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Block is not active in this society.'
            USING ERRCODE = '23503';
        END IF;
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
        resolved_block_id,
        unit_number,
        floor_value,
        unit_type_value,
        area_value
      );
      inserted_count := inserted_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        failed_count := failed_count + 1;
        row_errors := row_errors || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'rowNumber', row_number,
            'message', 'Unit number already exists in this block.'
          )
        );
      WHEN check_violation OR invalid_text_representation
        OR numeric_value_out_of_range OR foreign_key_violation THEN
        failed_count := failed_count + 1;
        row_errors := row_errors || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'rowNumber', row_number,
            'message', 'Row values are invalid or the block is unavailable.'
          )
        );
    END;
  END LOOP;

  UPDATE public.jobs
  SET status = CASE WHEN failed_count > 0 THEN 'partial' ELSE 'succeeded' END,
      progress = 100,
      summary = pg_catalog.jsonb_build_object(
        'totalRows', row_count,
        'importedRows', inserted_count,
        'failedRows', failed_count,
        'errors', row_errors
      ),
      finished_at = now(),
      updated_by = auth.uid()
  WHERE id = job_id;

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
    auth.uid(),
    'admin',
    'structure.units.importConfirm',
    'job',
    job_id::text,
    pg_catalog.jsonb_build_object(
      'totalRows', row_count,
      'importedRows', inserted_count,
      'failedRows', failed_count
    ),
    p_request_id
  );
  RETURN job_id;
END
$$;

REVOKE ALL ON FUNCTION public.create_units_import_job(uuid, jsonb, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_units_import_job(uuid, jsonb, text)
  TO authenticated;