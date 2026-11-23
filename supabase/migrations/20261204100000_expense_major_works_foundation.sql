-- Add D-82 repair forecasting and the Major repairs & redevelopment foundation.
CREATE TABLE public.expense_repair_forecast_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN (
    'structure', 'waterproofing', 'painting', 'lifts', 'plumbing',
    'electrical', 'fire_safety', 'other'
  )),
  last_done_year integer
    CHECK (last_done_year BETWEEN 1950 AND 2200),
  cycle_years integer NOT NULL CHECK (cycle_years BETWEEN 1 AND 50),
  manual_next_due_year integer
    CHECK (manual_next_due_year BETWEEN 1950 AND 2300),
  current_cost_paise bigint NOT NULL
    CHECK (current_cost_paise BETWEEN 0 AND 9007199254740991),
  inflation_bp integer NOT NULL DEFAULT 0
    CHECK (inflation_bp BETWEEN 0 AND 2000),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  archive_reason text
    CHECK (archive_reason IS NULL OR (
      archive_reason = btrim(archive_reason)
      AND char_length(archive_reason) BETWEEN 5 AND 500
    )),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_repair_forecast_items_due_year_check CHECK (
    (last_done_year IS NULL) = (manual_next_due_year IS NOT NULL)
  ),
  CONSTRAINT expense_repair_forecast_items_archive_check CHECK (
    (archived_at IS NULL AND archived_by IS NULL AND archive_reason IS NULL)
    OR (
      archived_at IS NOT NULL AND archived_by IS NOT NULL
      AND archive_reason IS NOT NULL
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX expense_repair_forecast_items_society_idx
  ON public.expense_repair_forecast_items (
    society_id, archived_at, category, name
  );
CREATE INDEX expense_repair_forecast_items_created_by_idx
  ON public.expense_repair_forecast_items (created_by);
CREATE INDEX expense_repair_forecast_items_updated_by_idx
  ON public.expense_repair_forecast_items (updated_by);
CREATE INDEX expense_repair_forecast_items_archived_by_idx
  ON public.expense_repair_forecast_items (archived_by);
CREATE TRIGGER expense_repair_forecast_items_set_updated_at
  BEFORE UPDATE ON public.expense_repair_forecast_items
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.expense_repair_forecast_item_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  item_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore')),
  previous_values jsonb,
  after_values jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT expense_repair_forecast_item_revisions_item_fkey
    FOREIGN KEY (society_id, item_id)
    REFERENCES public.expense_repair_forecast_items (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX expense_repair_forecast_item_revisions_item_idx
  ON public.expense_repair_forecast_item_revisions (
    society_id, item_id, changed_at DESC
  );
CREATE INDEX expense_repair_forecast_item_revisions_actor_idx
  ON public.expense_repair_forecast_item_revisions (changed_by);
CREATE TRIGGER expense_repair_forecast_item_revisions_append_only
  BEFORE UPDATE OR DELETE
  ON public.expense_repair_forecast_item_revisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER expense_repair_forecast_item_revisions_no_truncate
  BEFORE TRUNCATE ON public.expense_repair_forecast_item_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TABLE public.expense_repair_forecast_settings (
  society_id uuid PRIMARY KEY
    REFERENCES public.societies (id) ON DELETE RESTRICT,
  gap_fund_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT expense_repair_forecast_settings_fund_fkey
    FOREIGN KEY (society_id, gap_fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX expense_repair_forecast_settings_fund_idx
  ON public.expense_repair_forecast_settings (gap_fund_id);
CREATE INDEX expense_repair_forecast_settings_updated_by_idx
  ON public.expense_repair_forecast_settings (updated_by);
CREATE TRIGGER expense_repair_forecast_settings_set_updated_at
  BEFORE UPDATE ON public.expense_repair_forecast_settings
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.expense_repair_forecast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_repair_forecast_item_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_repair_forecast_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.expense_repair_forecast_items,
  public.expense_repair_forecast_item_revisions,
  public.expense_repair_forecast_settings
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY expense_repair_forecast_items_no_direct_access
  ON public.expense_repair_forecast_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_repair_forecast_item_revisions_no_direct_access
  ON public.expense_repair_forecast_item_revisions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY expense_repair_forecast_settings_no_direct_access
  ON public.expense_repair_forecast_settings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.expense_repair_forecast_item_values(
  p_item public.expense_repair_forecast_items
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'name', p_item.name,
    'category', p_item.category,
    'last_done_year', p_item.last_done_year,
    'cycle_years', p_item.cycle_years,
    'manual_next_due_year', p_item.manual_next_due_year,
    'current_cost_paise', p_item.current_cost_paise,
    'inflation_bp', p_item.inflation_bp,
    'notes', p_item.notes,
    'archived_at', p_item.archived_at,
    'archive_reason', p_item.archive_reason,
    'version', p_item.version
  )
$$;
REVOKE ALL ON FUNCTION private.expense_repair_forecast_item_values(
  public.expense_repair_forecast_items
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_repair_forecast_item_save(
  p_society_id uuid,
  p_item_id uuid,
  p_name text,
  p_category text,
  p_last_done_year integer,
  p_cycle_years integer,
  p_manual_next_due_year integer,
  p_current_cost_paise bigint,
  p_inflation_bp integer,
  p_notes text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_item public.expense_repair_forecast_items;
  retried_revision public.expense_repair_forecast_item_revisions;
  saved_id uuid;
  clean_name text := btrim(p_name);
  clean_category text := btrim(p_category);
  clean_notes text := NULLIF(btrim(p_notes), '');
  current_year integer :=
    extract(year FROM private.housekeeping_local_date(p_society_id))::integer;
  requested_due_year integer;
  previous_values jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR clean_category NOT IN (
      'structure', 'waterproofing', 'painting', 'lifts', 'plumbing',
      'electrical', 'fire_safety', 'other'
    )
    OR p_cycle_years NOT BETWEEN 1 AND 50
    OR p_current_cost_paise NOT BETWEEN 0 AND 9007199254740991
    OR p_inflation_bp NOT BETWEEN 0 AND 2000
    OR char_length(clean_notes) > 500
    OR (p_last_done_year IS NULL) = (p_manual_next_due_year IS NULL)
    OR (p_last_done_year IS NOT NULL AND
      p_last_done_year NOT BETWEEN 1950 AND current_year)
    OR (p_manual_next_due_year IS NOT NULL AND
      p_manual_next_due_year NOT BETWEEN 1950 AND current_year + 100)
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the repair forecast item details.'
      USING ERRCODE = '22023';
  END IF;
  requested_due_year := COALESCE(
    p_last_done_year + p_cycle_years,
    p_manual_next_due_year
  );
  IF requested_due_year < 1950 OR requested_due_year > current_year + 100 THEN
    RAISE EXCEPTION 'Choose a supported next due year.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retried_revision
  FROM public.expense_repair_forecast_item_revisions
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF (
      retried_revision.action = 'create'
      AND p_item_id IS NOT NULL
    ) OR (
      retried_revision.action = 'update'
      AND retried_revision.item_id IS DISTINCT FROM p_item_id
    ) OR retried_revision.action NOT IN ('create', 'update')
      OR retried_revision.after_values ->> 'name' IS DISTINCT FROM clean_name
      OR retried_revision.after_values ->> 'category'
        IS DISTINCT FROM clean_category
      OR (retried_revision.after_values ->> 'last_done_year')::integer
        IS DISTINCT FROM p_last_done_year
      OR (retried_revision.after_values ->> 'cycle_years')::integer
        IS DISTINCT FROM p_cycle_years
      OR (retried_revision.after_values ->> 'manual_next_due_year')::integer
        IS DISTINCT FROM p_manual_next_due_year
      OR (retried_revision.after_values ->> 'current_cost_paise')::bigint
        IS DISTINCT FROM p_current_cost_paise
      OR (retried_revision.after_values ->> 'inflation_bp')::integer
        IS DISTINCT FROM p_inflation_bp
      OR retried_revision.after_values ->> 'notes' IS DISTINCT FROM clean_notes
    THEN
      RAISE EXCEPTION 'That retry key belongs to another forecast action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN retried_revision.item_id;
  END IF;
  IF p_item_id IS NULL THEN
    INSERT INTO public.expense_repair_forecast_items (
      society_id, name, category, last_done_year, cycle_years,
      manual_next_due_year, current_cost_paise, inflation_bp, notes,
      client_request_id, created_by
    ) VALUES (
      p_society_id, clean_name, clean_category, p_last_done_year,
      p_cycle_years, p_manual_next_due_year, p_current_cost_paise,
      p_inflation_bp, clean_notes, p_client_request_id, auth.uid()
    ) RETURNING * INTO current_item;
    saved_id := current_item.id;
    INSERT INTO public.expense_repair_forecast_item_revisions (
      society_id, item_id, action, previous_values, after_values,
      changed_by, client_request_id
    ) VALUES (
      p_society_id, saved_id, 'create', NULL,
      private.expense_repair_forecast_item_values(current_item),
      auth.uid(), p_client_request_id
    );
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin', 'expense.repair_forecast.create',
      'expense_repair_forecast_item', saved_id::text, NULL,
      private.expense_repair_forecast_item_values(current_item),
      p_request_trace
    );
    RETURN saved_id;
  END IF;
  SELECT * INTO current_item FROM public.expense_repair_forecast_items
  WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair forecast item not found.' USING ERRCODE = 'P0002';
  END IF;
  IF current_item.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The repair forecast item changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF current_item.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restore the forecast item before editing it.'
      USING ERRCODE = '23514';
  END IF;
  previous_values := private.expense_repair_forecast_item_values(current_item);
  UPDATE public.expense_repair_forecast_items
  SET name = clean_name,
      category = clean_category,
      last_done_year = p_last_done_year,
      cycle_years = p_cycle_years,
      manual_next_due_year = p_manual_next_due_year,
      current_cost_paise = p_current_cost_paise,
      inflation_bp = p_inflation_bp,
      notes = clean_notes,
      version = current_item.version + 1
  WHERE society_id = p_society_id AND id = p_item_id
  RETURNING * INTO current_item;
  INSERT INTO public.expense_repair_forecast_item_revisions (
    society_id, item_id, action, previous_values, after_values,
    changed_by, client_request_id
  ) VALUES (
    p_society_id, p_item_id, 'update', previous_values,
    private.expense_repair_forecast_item_values(current_item),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.repair_forecast.update',
    'expense_repair_forecast_item', p_item_id::text, previous_values,
    private.expense_repair_forecast_item_values(current_item),
    p_request_trace
  );
  RETURN p_item_id;
END;
$$;

CREATE FUNCTION public.expense_repair_forecast_item_archive(
  p_society_id uuid,
  p_item_id uuid,
  p_archive boolean,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_item public.expense_repair_forecast_items;
  retried_revision public.expense_repair_forecast_item_revisions;
  previous_values jsonb;
  clean_reason text := NULLIF(btrim(p_reason), '');
  action_name text;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_item_id IS NULL OR p_archive IS NULL OR p_client_request_id IS NULL
    OR (p_archive AND (clean_reason IS NULL
      OR char_length(clean_reason) NOT BETWEEN 5 AND 500))
    OR (NOT p_archive AND clean_reason IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Check the forecast archive action and reason.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retried_revision
  FROM public.expense_repair_forecast_item_revisions
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retried_revision.item_id <> p_item_id
      OR retried_revision.action <> (
        CASE WHEN p_archive THEN 'archive' ELSE 'restore' END
      )
    THEN
      RAISE EXCEPTION 'That retry key belongs to another forecast action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_item_id;
  END IF;
  SELECT * INTO current_item FROM public.expense_repair_forecast_items
  WHERE society_id = p_society_id AND id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair forecast item not found.' USING ERRCODE = 'P0002';
  END IF;
  IF current_item.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The repair forecast item changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF (p_archive AND current_item.archived_at IS NOT NULL)
    OR (NOT p_archive AND current_item.archived_at IS NULL)
  THEN
    RAISE EXCEPTION 'The repair forecast item is already in that state.'
      USING ERRCODE = '23514';
  END IF;
  previous_values := private.expense_repair_forecast_item_values(current_item);
  UPDATE public.expense_repair_forecast_items
  SET archived_at = CASE WHEN p_archive THEN clock_timestamp() ELSE NULL END,
      archived_by = CASE WHEN p_archive THEN auth.uid() ELSE NULL END,
      archive_reason = CASE WHEN p_archive THEN clean_reason ELSE NULL END,
      version = current_item.version + 1
  WHERE society_id = p_society_id AND id = p_item_id
  RETURNING * INTO current_item;
  action_name := CASE WHEN p_archive THEN 'archive' ELSE 'restore' END;
  INSERT INTO public.expense_repair_forecast_item_revisions (
    society_id, item_id, action, previous_values, after_values,
    changed_by, client_request_id
  ) VALUES (
    p_society_id, p_item_id, action_name, previous_values,
    private.expense_repair_forecast_item_values(current_item),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    'expense.repair_forecast.' || action_name,
    'expense_repair_forecast_item', p_item_id::text, previous_values,
    private.expense_repair_forecast_item_values(current_item),
    p_request_trace
  );
  RETURN p_item_id;
END;
$$;

CREATE FUNCTION public.expense_repair_forecast_fund_set(
  p_society_id uuid,
  p_gap_fund_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  setting public.expense_repair_forecast_settings;
  previous_values jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_client_request_id IS NULL OR (
    p_gap_fund_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_gap_fund_id AND active
    )
  ) THEN
    RAISE EXCEPTION 'Choose an active fund or clear the gap fund.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO setting FROM public.expense_repair_forecast_settings
  WHERE society_id = p_society_id FOR UPDATE;
  IF FOUND THEN
    IF setting.client_request_id = p_client_request_id THEN
      RETURN p_society_id;
    END IF;
    IF setting.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The repair forecast settings changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    previous_values := jsonb_build_object(
      'gap_fund_id', setting.gap_fund_id,
      'version', setting.version
    );
    UPDATE public.expense_repair_forecast_settings
    SET gap_fund_id = p_gap_fund_id,
        client_request_id = p_client_request_id,
        version = setting.version + 1
    WHERE society_id = p_society_id;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'The repair forecast settings changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.expense_repair_forecast_settings (
      society_id, gap_fund_id, client_request_id, updated_by
    ) VALUES (
      p_society_id, p_gap_fund_id, p_client_request_id, auth.uid()
    );
    previous_values := NULL;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'expense.repair_forecast.fund_set',
    'expense_repair_forecast_settings', p_society_id::text, previous_values,
    jsonb_build_object('gap_fund_id', p_gap_fund_id),
    p_request_trace
  );
  RETURN p_society_id;
END;
$$;

CREATE FUNCTION public.expense_repair_forecast_get(
  p_society_id uuid,
  p_include_archived boolean
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date := private.housekeeping_local_date(p_society_id);
  current_financial_year_start date := make_date(
    CASE WHEN extract(month FROM today) >= 4
      THEN extract(year FROM today)::integer
      ELSE extract(year FROM today)::integer - 1
    END,
    4,
    1
  );
  current_financial_year integer :=
    extract(year FROM current_financial_year_start)::integer;
  setting public.expense_repair_forecast_settings;
  gap_fund public.expense_funds;
  fund_opening_exists boolean;
  result_items jsonb;
  result_years jsonb;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  SELECT * INTO setting FROM public.expense_repair_forecast_settings
  WHERE society_id = p_society_id;
  SELECT * INTO gap_fund FROM public.expense_funds
  WHERE society_id = p_society_id AND id = setting.gap_fund_id;
  SELECT EXISTS (
    SELECT 1 FROM public.expense_fund_openings
    WHERE society_id = p_society_id
  ) INTO fund_opening_exists;
  SELECT COALESCE(jsonb_agg(item_json ORDER BY item_name), '[]'::jsonb)
  INTO result_items
  FROM (
    SELECT
      item.name AS item_name,
      jsonb_build_object(
        'id', item.id,
        'name', item.name,
        'category', item.category,
        'last_done_year', item.last_done_year,
        'cycle_years', item.cycle_years,
        'manual_next_due_year', item.manual_next_due_year,
        'current_cost_paise', item.current_cost_paise,
        'inflation_bp', item.inflation_bp,
        'notes', item.notes,
        'archived_at', item.archived_at,
        'archive_reason', item.archive_reason,
        'updated_at', item.updated_at,
        'next_due_year', COALESCE(
          item.last_done_year + item.cycle_years,
          item.manual_next_due_year
        ),
        'overdue', COALESCE(
          item.last_done_year + item.cycle_years,
          item.manual_next_due_year
        ) < current_financial_year,
        'years', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'financial_year', current_financial_year + offset_year,
              'amount_paise',
                CASE WHEN offset_year = 0
                  AND COALESCE(
                    item.last_done_year + item.cycle_years,
                    item.manual_next_due_year
                  ) < current_financial_year
                THEN
                  round(
                    item.current_cost_paise::numeric / 100
                  )::bigint * 100
                WHEN (
                  current_financial_year + offset_year =
                    COALESCE(
                      item.last_done_year + item.cycle_years,
                      item.manual_next_due_year
                    )
                  OR (
                    current_financial_year + offset_year >
                      COALESCE(
                        item.last_done_year + item.cycle_years,
                        item.manual_next_due_year
                      )
                    AND mod(
                      current_financial_year + offset_year
                        - COALESCE(
                          item.last_done_year + item.cycle_years,
                          item.manual_next_due_year
                        ),
                      item.cycle_years
                    ) = 0
                  )
                ) THEN
                  round((
                    item.current_cost_paise::numeric
                    * power(
                      1 + item.inflation_bp::numeric / 10000,
                      offset_year
                    )
                  ) / 100)::bigint * 100
                ELSE 0
                END
            ) ORDER BY offset_year
          )
          FROM generate_series(0, 9) AS offset_year
        ),
        'project_id', NULL,
        'project_title', NULL
      ) AS item_json
    FROM public.expense_repair_forecast_items AS item
    WHERE item.society_id = p_society_id
      AND (p_include_archived OR item.archived_at IS NULL)
  ) AS item_rows;
  SELECT jsonb_agg(jsonb_build_object(
    'financial_year', current_financial_year + year_offset,
    'total_paise', COALESCE((
      SELECT sum((year_value.value ->> 'amount_paise')::bigint)
      FROM jsonb_array_elements(result_items) AS result_item(value)
      CROSS JOIN LATERAL jsonb_array_elements(
        result_item.value -> 'years'
      ) AS year_value(value)
      WHERE (year_value.value ->> 'financial_year')::integer =
        current_financial_year + year_offset
    ), 0)
  ) ORDER BY year_offset)
  INTO result_years
  FROM generate_series(0, 9) AS year_offset;
  RETURN jsonb_build_object(
    'today', today,
    'financial_year_start', current_financial_year_start,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'include_archived', COALESCE(p_include_archived, false),
    'items', result_items,
    'years', result_years,
    'gap_fund_id', setting.gap_fund_id,
    'gap_fund_name', gap_fund.name,
    'gap_fund_balance_paise', CASE
      WHEN gap_fund.id IS NULL OR NOT gap_fund.active
        OR NOT fund_opening_exists THEN NULL
      ELSE private.expense_fund_balance(
        p_society_id, gap_fund.id, today
      )
    END,
    'fund_balance_available', gap_fund.id IS NOT NULL
      AND gap_fund.active AND fund_opening_exists,
    'settings_updated_at', setting.updated_at,
    'funds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fund.id,
        'name', fund.name
      ) ORDER BY lower(fund.name))
      FROM public.expense_funds AS fund
      WHERE fund.society_id = p_society_id AND fund.active
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expense_repair_forecast_item_save(
  uuid, uuid, text, text, integer, integer, integer, bigint, integer, text,
  timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expense_repair_forecast_item_archive(
  uuid, uuid, boolean, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expense_repair_forecast_fund_set(
  uuid, uuid, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expense_repair_forecast_get(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_repair_forecast_item_save(
  uuid, uuid, text, text, integer, integer, integer, bigint, integer, text,
  timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expense_repair_forecast_item_archive(
  uuid, uuid, boolean, text, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expense_repair_forecast_fund_set(
  uuid, uuid, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expense_repair_forecast_get(uuid, boolean)
  TO authenticated;

CREATE FUNCTION private.major_works_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN jsonb_typeof(p_settings) = 'object'
    AND (p_settings - 'consent_method') = '{}'::jsonb
    AND (
      NOT (p_settings ? 'consent_method')
      OR p_settings ->> 'consent_method' IN ('poll', 'admin_recorded')
    );
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_settings_valid(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.major_works_settings_valid(jsonb)
  TO authenticated, service_role;
ALTER TABLE public.module_configs
  ADD CONSTRAINT module_configs_major_works_settings_check
  CHECK (
    module_key <> 'major_works'
    OR private.major_works_settings_valid(settings)
  );

ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN (
    'core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense',
    'tenancy', 'document', 'parking', 'sos', 'vendor', 'patrol', 'metering',
    'asset', 'home_services', 'poll', 'meeting', 'event', 'community',
    'language', 'major_works'
  )
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('major_works', 'Major repairs & redevelopment', false, 26);

CREATE TABLE public.major_works_projects (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  title text NOT NULL
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 120),
  location text NOT NULL
    CHECK (location = btrim(location) AND char_length(location) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN (
    'structure', 'waterproofing', 'painting', 'lifts', 'plumbing',
    'electrical', 'fire_safety', 'other'
  )),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimate_paise bigint NOT NULL
    CHECK (estimate_paise BETWEEN 0 AND 9007199254740991),
  planned_start_on date,
  planned_end_on date,
  actual_start_on date,
  actual_end_on date,
  progress_percent integer NOT NULL DEFAULT 0
    CHECK (progress_percent BETWEEN 0 AND 100),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  forecast_item_id uuid,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'quoting', 'approved', 'in_progress', 'on_hold',
    'completed', 'cancelled'
  )),
  status_reason text CHECK (
    status_reason IS NULL OR char_length(status_reason) BETWEEN 5 AND 500
  ),
  resume_status text CHECK (
    resume_status IS NULL
    OR resume_status IN ('quoting', 'approved', 'in_progress')
  ),
  approval_body text CHECK (
    approval_body IS NULL
    OR approval_body IN ('committee', 'general_body', 'other')
  ),
  approval_date date,
  approval_meeting_resolution_id uuid,
  approval_resolution_version_snapshot integer,
  approval_resolution_title_snapshot text,
  budget_source text NOT NULL DEFAULT 'typed'
    CHECK (budget_source IN ('typed', 'sanctioned_work')),
  typed_budget_paise bigint NOT NULL DEFAULT 0
    CHECK (typed_budget_paise BETWEEN 0 AND 9007199254740991),
  linked_budget_paise bigint
    CHECK (
      linked_budget_paise IS NULL
      OR linked_budget_paise BETWEEN 0 AND 9007199254740991
    ),
  fund_work_id uuid,
    vendor_purchase_request_id uuid,
    scoring_state text NOT NULL DEFAULT 'setup'
      CHECK (scoring_state IN ('setup', 'open', 'closed', 'not_scored')),
    scoring_opened_at timestamptz,
    scoring_opened_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
    scoring_closed_at timestamptz,
    scoring_closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
    not_scored_reason text
      CHECK (
        not_scored_reason IS NULL
        OR char_length(not_scored_reason) BETWEEN 5 AND 500
      ),
    chosen_quote_id uuid,
    chosen_quote_reason text
      CHECK (
        chosen_quote_reason IS NULL
        OR char_length(chosen_quote_reason) BETWEEN 5 AND 500
      ),
    chosen_quote_resolution_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_projects_planned_dates_check CHECK (
    planned_start_on IS NULL OR planned_end_on IS NULL
    OR planned_end_on >= planned_start_on
  ),
  CONSTRAINT major_works_projects_actual_dates_check CHECK (
    actual_start_on IS NULL OR actual_end_on IS NULL
    OR actual_end_on >= actual_start_on
  ),
  CONSTRAINT major_works_projects_forecast_fkey
    FOREIGN KEY (society_id, forecast_item_id)
    REFERENCES public.expense_repair_forecast_items (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_projects_fund_work_fkey
    FOREIGN KEY (society_id, fund_work_id)
    REFERENCES public.expense_fund_works (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_projects_resolution_fkey
    FOREIGN KEY (society_id, approval_meeting_resolution_id)
    REFERENCES public.meeting_resolutions (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT major_works_projects_purchase_request_fkey
    FOREIGN KEY (society_id, vendor_purchase_request_id)
    REFERENCES public.vendor_purchase_requests (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_projects_chosen_resolution_fkey
    FOREIGN KEY (society_id, chosen_quote_resolution_id)
    REFERENCES public.meeting_resolutions (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT major_works_projects_status_reason_state_check CHECK (
    (
      status IN ('on_hold', 'cancelled')
      AND status_reason IS NOT NULL
    )
    OR (
      status NOT IN ('on_hold', 'cancelled')
      AND status_reason IS NULL
    )
  ),
  CONSTRAINT major_works_projects_resume_status_state_check CHECK (
    (status = 'on_hold' AND resume_status IS NOT NULL)
    OR (status <> 'on_hold' AND resume_status IS NULL)
  ),
  CONSTRAINT major_works_projects_scoring_state_flow_check CHECK (
    (
      scoring_state = 'setup'
      AND scoring_opened_at IS NULL
      AND scoring_opened_by IS NULL
      AND scoring_closed_at IS NULL
      AND scoring_closed_by IS NULL
      AND not_scored_reason IS NULL
    )
    OR (
      scoring_state = 'open'
      AND scoring_opened_at IS NOT NULL
      AND scoring_opened_by IS NOT NULL
      AND scoring_closed_at IS NULL
      AND scoring_closed_by IS NULL
      AND not_scored_reason IS NULL
    )
    OR (
      scoring_state = 'closed'
      AND scoring_opened_at IS NOT NULL
      AND scoring_opened_by IS NOT NULL
      AND scoring_closed_at IS NOT NULL
      AND scoring_closed_by IS NOT NULL
      AND not_scored_reason IS NULL
    )
    OR (
      scoring_state = 'not_scored'
      AND not_scored_reason IS NOT NULL
      AND scoring_closed_at IS NULL
      AND scoring_closed_by IS NULL
    )
  ),
  CONSTRAINT major_works_projects_chosen_quote_check CHECK (
    (chosen_quote_id IS NULL AND chosen_quote_reason IS NULL)
    OR (chosen_quote_id IS NOT NULL AND chosen_quote_reason IS NOT NULL)
  ),
  CONSTRAINT major_works_projects_approval_check CHECK (
    (
      approval_body IS NULL
      AND approval_date IS NULL
      AND approval_meeting_resolution_id IS NULL
      AND approval_resolution_version_snapshot IS NULL
      AND approval_resolution_title_snapshot IS NULL
    )
    OR (
      approval_body IS NOT NULL
      AND approval_date IS NOT NULL
      AND (
        (
          approval_meeting_resolution_id IS NULL
          AND approval_resolution_version_snapshot IS NULL
          AND approval_resolution_title_snapshot IS NULL
        )
        OR (
          approval_meeting_resolution_id IS NOT NULL
          AND approval_resolution_version_snapshot IS NOT NULL
          AND approval_resolution_title_snapshot IS NOT NULL
        )
      )
    )
  ),
  CONSTRAINT major_works_projects_budget_check CHECK (
    (
      budget_source = 'typed'
      AND fund_work_id IS NULL
      AND linked_budget_paise IS NULL
    )
    OR (
      budget_source = 'sanctioned_work'
      AND fund_work_id IS NOT NULL
      AND linked_budget_paise IS NOT NULL
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE UNIQUE INDEX major_works_projects_active_forecast_idx
  ON public.major_works_projects (society_id, forecast_item_id)
  WHERE forecast_item_id IS NOT NULL AND status <> 'cancelled';
CREATE INDEX major_works_projects_society_status_idx
  ON public.major_works_projects (society_id, status, priority, title);
CREATE INDEX major_works_projects_created_by_idx
  ON public.major_works_projects (created_by);
CREATE INDEX major_works_projects_updated_by_idx
  ON public.major_works_projects (updated_by);
CREATE INDEX major_works_projects_fund_work_idx
  ON public.major_works_projects (society_id, fund_work_id);
CREATE INDEX major_works_projects_resolution_idx
  ON public.major_works_projects (
    society_id, approval_meeting_resolution_id
  );
CREATE TRIGGER major_works_projects_set_updated_at
  BEFORE UPDATE ON public.major_works_projects
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.major_works_project_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  project_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'create', 'update', 'status', 'budget'
  )),
  previous_values jsonb,
  after_values jsonb NOT NULL,
  reason text,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  CONSTRAINT major_works_project_events_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_project_events_project_idx
  ON public.major_works_project_events (
    society_id, project_id, created_at
  );
CREATE INDEX major_works_project_events_actor_idx
  ON public.major_works_project_events (actor_id);
CREATE TRIGGER major_works_project_events_append_only
  BEFORE UPDATE OR DELETE ON public.major_works_project_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER major_works_project_events_no_truncate
  BEFORE TRUNCATE ON public.major_works_project_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TABLE public.major_works_spend_tags (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  project_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  removal_reason text,
  removal_client_request_id uuid,
  client_request_id uuid NOT NULL,
  CONSTRAINT major_works_spend_tags_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_spend_tags_entry_fkey
    FOREIGN KEY (society_id, entry_id)
    REFERENCES public.expense_book_entries (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_spend_tags_removal_check CHECK (
    (
      removed_at IS NULL
      AND removed_by IS NULL
      AND removal_reason IS NULL
      AND removal_client_request_id IS NULL
    )
    OR (
      removed_at IS NOT NULL
      AND removed_by IS NOT NULL
      AND removal_reason IS NOT NULL
      AND removal_reason = btrim(removal_reason)
      AND char_length(removal_reason) BETWEEN 5 AND 500
      AND removal_client_request_id IS NOT NULL
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX major_works_spend_tags_removal_request_idx
  ON public.major_works_spend_tags (society_id, removal_client_request_id)
  WHERE removal_client_request_id IS NOT NULL;
CREATE INDEX major_works_spend_tags_project_idx
  ON public.major_works_spend_tags (society_id, project_id, removed_at);
CREATE INDEX major_works_spend_tags_entry_idx
  ON public.major_works_spend_tags (society_id, entry_id, removed_at);
CREATE INDEX major_works_spend_tags_created_by_idx
  ON public.major_works_spend_tags (created_by);
CREATE INDEX major_works_spend_tags_removed_by_idx
  ON public.major_works_spend_tags (removed_by);

ALTER TABLE public.major_works_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_spend_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.major_works_projects,
  public.major_works_project_events,
  public.major_works_spend_tags
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY major_works_projects_no_direct_access
  ON public.major_works_projects FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_project_events_no_direct_access
  ON public.major_works_project_events FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_spend_tags_no_direct_access
  ON public.major_works_spend_tags FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.major_works_authorize(
  p_society_id uuid,
  p_access text
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.module_enabled(p_society_id, 'major_works')
    OR p_access NOT IN ('list', 'manage', 'resident')
    OR NOT private.has_role(
      p_society_id,
      CASE p_access
        WHEN 'manage' THEN ARRAY['admin']
        WHEN 'resident' THEN ARRAY['resident']
        ELSE ARRAY['admin', 'committee']
      END::text[]
    )
    OR (p_access = 'manage' AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Major works access is not available.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_authorize(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.major_works_project_values(
  p_project public.major_works_projects
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'title', p_project.title,
    'location', p_project.location,
    'category', p_project.category,
    'priority', p_project.priority,
    'estimate_paise', p_project.estimate_paise,
    'planned_start_on', p_project.planned_start_on,
    'planned_end_on', p_project.planned_end_on,
    'actual_start_on', p_project.actual_start_on,
    'actual_end_on', p_project.actual_end_on,
    'progress_percent', p_project.progress_percent,
    'notes', p_project.notes,
    'forecast_item_id', p_project.forecast_item_id,
    'status', p_project.status,
    'status_reason', p_project.status_reason,
    'resume_status', p_project.resume_status,
    'approval_body', p_project.approval_body,
    'approval_date', p_project.approval_date,
    'approval_meeting_resolution_id',
      p_project.approval_meeting_resolution_id,
    'budget_source', p_project.budget_source,
    'typed_budget_paise', p_project.typed_budget_paise,
    'linked_budget_paise', p_project.linked_budget_paise,
    'fund_work_id', p_project.fund_work_id,
    'version', p_project.version
  )
$$;
REVOKE ALL ON FUNCTION private.major_works_project_values(
  public.major_works_projects
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.major_works_project_save(
  p_society_id uuid,
  p_project_id uuid,
  p_title text,
  p_location text,
  p_category text,
  p_priority text,
  p_estimate_paise bigint,
  p_planned_start_on date,
  p_planned_end_on date,
  p_actual_start_on date,
  p_actual_end_on date,
  p_progress_percent integer,
  p_notes text,
  p_forecast_item_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  forecast public.expense_repair_forecast_items;
  retry public.major_works_project_events;
  clean_title text := btrim(p_title);
  clean_location text := btrim(p_location);
  clean_category text := btrim(p_category);
  clean_priority text := btrim(p_priority);
  clean_notes text := NULLIF(btrim(p_notes), '');
  saved_id uuid;
  previous_values jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_title IS NULL OR char_length(clean_title) NOT BETWEEN 1 AND 120
    OR clean_location IS NULL
      OR char_length(clean_location) NOT BETWEEN 1 AND 120
    OR clean_category NOT IN (
      'structure', 'waterproofing', 'painting', 'lifts', 'plumbing',
      'electrical', 'fire_safety', 'other'
    )
    OR clean_priority NOT IN ('low', 'medium', 'high', 'urgent')
    OR p_estimate_paise NOT BETWEEN 0 AND 9007199254740991
    OR p_progress_percent NOT BETWEEN 0 AND 100
    OR char_length(clean_notes) > 2000
    OR (p_planned_start_on IS NOT NULL AND p_planned_end_on IS NOT NULL
      AND p_planned_end_on < p_planned_start_on)
    OR (p_actual_start_on IS NOT NULL AND p_actual_end_on IS NOT NULL
      AND p_actual_end_on < p_actual_start_on)
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the repair project details.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_project_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.action NOT IN ('create', 'update')
      OR (
        retry.action = 'create' AND p_project_id IS NOT NULL
      )
      OR (
        retry.action = 'update'
        AND retry.project_id IS DISTINCT FROM p_project_id
      )
      OR retry.after_values ->> 'title' IS DISTINCT FROM clean_title
      OR retry.after_values ->> 'location' IS DISTINCT FROM clean_location
      OR retry.after_values ->> 'category' IS DISTINCT FROM clean_category
      OR retry.after_values ->> 'priority' IS DISTINCT FROM clean_priority
      OR (retry.after_values ->> 'estimate_paise')::bigint
        IS DISTINCT FROM p_estimate_paise
      OR retry.after_values ->> 'notes' IS DISTINCT FROM clean_notes
    THEN
      RAISE EXCEPTION 'That retry key belongs to another project action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN retry.project_id;
  END IF;
  IF p_forecast_item_id IS NOT NULL THEN
    IF NOT private.module_enabled(p_society_id, 'expense') THEN
      RAISE EXCEPTION 'Accounts must be enabled for a forecast link.'
        USING ERRCODE = '23514';
    END IF;
    SELECT * INTO forecast FROM public.expense_repair_forecast_items
    WHERE society_id = p_society_id
      AND id = p_forecast_item_id
      AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose an active repair forecast item.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_project_id IS NULL THEN
    INSERT INTO public.major_works_projects (
      society_id, title, location, category, priority, estimate_paise,
      planned_start_on, planned_end_on, actual_start_on, actual_end_on,
      progress_percent, notes, forecast_item_id, client_request_id, created_by
    ) VALUES (
      p_society_id,
      COALESCE(forecast.name, clean_title),
      clean_location,
      COALESCE(forecast.category, clean_category),
      clean_priority,
      COALESCE(forecast.current_cost_paise, p_estimate_paise),
      p_planned_start_on, p_planned_end_on, p_actual_start_on, p_actual_end_on,
      p_progress_percent, clean_notes, p_forecast_item_id,
      p_client_request_id, auth.uid()
    ) RETURNING * INTO project;
    saved_id := project.id;
    INSERT INTO public.major_works_project_events (
      society_id, project_id, action, previous_values, after_values,
      actor_id, client_request_id
    ) VALUES (
      p_society_id, saved_id, 'create', NULL,
      private.major_works_project_values(project),
      auth.uid(), p_client_request_id
    );
  ELSE
    SELECT * INTO project FROM public.major_works_projects
    WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
    END IF;
    IF project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The repair project changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    previous_values := private.major_works_project_values(project);
    UPDATE public.major_works_projects
    SET title = clean_title,
        location = clean_location,
        category = clean_category,
        priority = clean_priority,
        estimate_paise = p_estimate_paise,
        planned_start_on = p_planned_start_on,
        planned_end_on = p_planned_end_on,
        actual_start_on = p_actual_start_on,
        actual_end_on = p_actual_end_on,
        progress_percent = p_progress_percent,
        notes = clean_notes,
        forecast_item_id = p_forecast_item_id,
        version = project.version + 1
    WHERE society_id = p_society_id AND id = p_project_id
    RETURNING * INTO project;
    saved_id := p_project_id;
    INSERT INTO public.major_works_project_events (
      society_id, project_id, action, previous_values, after_values,
      actor_id, client_request_id
    ) VALUES (
      p_society_id, saved_id, 'update', previous_values,
      private.major_works_project_values(project),
      auth.uid(), p_client_request_id
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_project_id IS NULL THEN 'major_works.project.create'
      ELSE 'major_works.project.update' END,
    'major_works_project', saved_id::text, previous_values,
    private.major_works_project_values(project), p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.major_works_project_status_set(
  p_society_id uuid,
  p_project_id uuid,
  p_status text,
  p_reason text,
  p_approval_body text,
  p_approval_date date,
  p_meeting_resolution_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  retry public.major_works_project_events;
  resolution public.meeting_resolutions;
  previous_values jsonb;
  clean_reason text := NULLIF(btrim(p_reason), '');
  allowed boolean;
  next_resume text;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_status NOT IN (
    'planned', 'quoting', 'approved', 'in_progress', 'on_hold',
    'completed', 'cancelled'
  ) OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Choose a valid repair-project status.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_project_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.project_id <> p_project_id OR retry.action <> 'status'
      OR retry.after_values ->> 'status' IS DISTINCT FROM p_status
    THEN
      RAISE EXCEPTION 'That retry key belongs to another project status.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_project_id;
  END IF;
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The repair project changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  allowed := (
    (project.status = 'planned'
      AND p_status IN ('quoting', 'cancelled'))
    OR (project.status = 'quoting'
      AND p_status IN ('approved', 'on_hold', 'cancelled'))
    OR (project.status = 'approved'
      AND p_status IN ('in_progress', 'on_hold', 'cancelled'))
    OR (project.status = 'in_progress'
      AND p_status IN ('completed', 'on_hold', 'cancelled'))
    OR (project.status = 'on_hold' AND p_status = project.resume_status)
    OR (project.status = 'on_hold' AND p_status = 'cancelled')
  );
  IF NOT allowed THEN
    RAISE EXCEPTION 'That status change is not allowed.' USING ERRCODE = '23514';
  END IF;
  IF p_status IN ('on_hold', 'cancelled')
    AND (clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 5 AND 500)
  THEN
    RAISE EXCEPTION 'Give a reason for this status.' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('on_hold', 'cancelled') AND clean_reason IS NOT NULL THEN
    RAISE EXCEPTION 'A reason is not used for this status.'
      USING ERRCODE = '22023';
  END IF;
  IF p_status = 'approved' THEN
    IF p_approval_body NOT IN ('committee', 'general_body', 'other')
      OR p_approval_date IS NULL
      OR p_approval_date > private.housekeeping_local_date(p_society_id)
    THEN
      RAISE EXCEPTION 'Record the approving body and date.'
        USING ERRCODE = '22023';
    END IF;
    IF p_meeting_resolution_id IS NOT NULL THEN
      IF NOT private.module_enabled(p_society_id, 'meeting') THEN
        RAISE EXCEPTION 'Meetings must be enabled for a resolution link.'
          USING ERRCODE = '23514';
      END IF;
      SELECT * INTO resolution FROM public.meeting_resolutions
      WHERE society_id = p_society_id AND id = p_meeting_resolution_id;
      IF NOT FOUND OR resolution.outcome <> 'passed' THEN
        RAISE EXCEPTION 'Choose a passed meeting resolution.'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSIF p_approval_body IS NOT NULL OR p_approval_date IS NOT NULL
    OR p_meeting_resolution_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'Approval details are recorded only when moving to Approved.'
      USING ERRCODE = '22023';
  END IF;
  previous_values := private.major_works_project_values(project);
  next_resume := CASE WHEN p_status = 'on_hold' THEN project.status ELSE NULL END;
  UPDATE public.major_works_projects
  SET status = p_status,
      status_reason = CASE WHEN p_status IN ('on_hold', 'cancelled')
        THEN clean_reason ELSE NULL END,
      resume_status = next_resume,
      approval_body = CASE WHEN p_status = 'approved'
        THEN p_approval_body ELSE approval_body END,
      approval_date = CASE WHEN p_status = 'approved'
        THEN p_approval_date ELSE approval_date END,
      approval_meeting_resolution_id = CASE WHEN p_status = 'approved'
        THEN p_meeting_resolution_id ELSE approval_meeting_resolution_id END,
      approval_resolution_version_snapshot = CASE
        WHEN p_status = 'approved' THEN resolution.version
        ELSE approval_resolution_version_snapshot END,
      approval_resolution_title_snapshot = CASE
        WHEN p_status = 'approved' THEN resolution.title
        ELSE approval_resolution_title_snapshot END,
      version = project.version + 1
  WHERE society_id = p_society_id AND id = p_project_id
  RETURNING * INTO project;
  INSERT INTO public.major_works_project_events (
    society_id, project_id, action, previous_values, after_values,
    reason, actor_id, client_request_id
  ) VALUES (
    p_society_id, p_project_id, 'status', previous_values,
    private.major_works_project_values(project), clean_reason,
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.project.status',
    'major_works_project', p_project_id::text, previous_values,
    private.major_works_project_values(project), p_request_trace
  );
  RETURN p_project_id;
END;
$$;

CREATE FUNCTION public.major_works_project_budget_set(
  p_society_id uuid,
  p_project_id uuid,
  p_source text,
  p_typed_budget_paise bigint,
  p_fund_work_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  fund_work public.expense_fund_works;
  retry public.major_works_project_events;
  previous_values jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_source NOT IN ('typed', 'sanctioned_work')
    OR p_typed_budget_paise NOT BETWEEN 0 AND 9007199254740991
    OR (p_source = 'sanctioned_work') <> (p_fund_work_id IS NOT NULL)
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the project budget source.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_project_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.project_id <> p_project_id OR retry.action <> 'budget'
      OR retry.after_values ->> 'budget_source' IS DISTINCT FROM p_source
      OR (retry.after_values ->> 'typed_budget_paise')::bigint
        IS DISTINCT FROM p_typed_budget_paise
      OR (retry.after_values ->> 'fund_work_id')::uuid
        IS DISTINCT FROM p_fund_work_id
    THEN
      RAISE EXCEPTION 'That retry key belongs to another project budget.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_project_id;
  END IF;
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The repair project changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF p_source = 'sanctioned_work' THEN
    IF NOT private.module_enabled(p_society_id, 'expense') THEN
      RAISE EXCEPTION 'Accounts must be enabled for a sanctioned-work budget.'
        USING ERRCODE = '23514';
    END IF;
    SELECT * INTO fund_work FROM public.expense_fund_works
    WHERE society_id = p_society_id AND id = p_fund_work_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a sanctioned-work record.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  previous_values := private.major_works_project_values(project);
  UPDATE public.major_works_projects
  SET budget_source = p_source,
      typed_budget_paise = p_typed_budget_paise,
      fund_work_id = p_fund_work_id,
      linked_budget_paise = CASE WHEN p_source = 'sanctioned_work'
        THEN fund_work.sanctioned_amount_paise ELSE NULL END,
      version = project.version + 1
  WHERE society_id = p_society_id AND id = p_project_id
  RETURNING * INTO project;
  INSERT INTO public.major_works_project_events (
    society_id, project_id, action, previous_values, after_values,
    actor_id, client_request_id
  ) VALUES (
    p_society_id, p_project_id, 'budget', previous_values,
    private.major_works_project_values(project),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.project.budget',
    'major_works_project', p_project_id::text, previous_values,
    private.major_works_project_values(project), p_request_trace
  );
  RETURN p_project_id;
END;
$$;

CREATE FUNCTION public.major_works_spend_tag_save(
  p_society_id uuid,
  p_project_id uuid,
  p_entry_id uuid,
  p_amount_paise bigint,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing_tag public.major_works_spend_tags;
  entry public.expense_book_entries;
  tagged_paise bigint;
  tag_id uuid;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF NOT private.module_enabled(p_society_id, 'expense')
    OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Accounts must be enabled and the tag amount must be positive.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO existing_tag FROM public.major_works_spend_tags
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF existing_tag.project_id <> p_project_id
      OR existing_tag.entry_id <> p_entry_id
      OR existing_tag.amount_paise <> p_amount_paise
    THEN
      RAISE EXCEPTION 'That retry key belongs to another spend tag.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_tag.id;
  END IF;
  PERFORM 1 FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO entry FROM public.expense_book_entries
  WHERE society_id = p_society_id AND id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR entry.source <> 'expense' OR entry.direction <> 'out' THEN
    RAISE EXCEPTION 'Choose a posted Accounts expense.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  SELECT COALESCE(sum(amount_paise), 0) INTO tagged_paise
  FROM public.major_works_spend_tags
  WHERE society_id = p_society_id
    AND entry_id = p_entry_id
    AND removed_at IS NULL;
  IF tagged_paise + p_amount_paise > entry.amount_paise THEN
    RAISE EXCEPTION 'Tagged amounts cannot exceed the Accounts entry.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.major_works_spend_tags (
    society_id, project_id, entry_id, amount_paise, created_by,
    client_request_id
  ) VALUES (
    p_society_id, p_project_id, p_entry_id, p_amount_paise, auth.uid(),
    p_client_request_id
  ) RETURNING id INTO tag_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.spend_tag.create',
    'major_works_spend_tag', tag_id::text, NULL,
    jsonb_build_object(
      'project_id', p_project_id, 'entry_id', p_entry_id,
      'amount_paise', p_amount_paise
    ),
    p_request_trace
  );
  RETURN tag_id;
END;
$$;

CREATE FUNCTION public.major_works_spend_tag_remove(
  p_society_id uuid,
  p_tag_id uuid,
  p_reason text,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tag public.major_works_spend_tags;
  retry public.major_works_spend_tags;
  clean_reason text := btrim(p_reason);
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 5 AND 500
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Give a reason for removing the spend tag.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_spend_tags
  WHERE society_id = p_society_id
    AND removal_client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.id <> p_tag_id OR retry.removal_reason <> clean_reason THEN
      RAISE EXCEPTION 'That retry key belongs to another spend-tag removal.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_tag_id;
  END IF;
  SELECT * INTO tag FROM public.major_works_spend_tags
  WHERE society_id = p_society_id AND id = p_tag_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spend tag not found.' USING ERRCODE = 'P0002';
  END IF;
  IF tag.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'The spend tag is already removed.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.major_works_spend_tags
  SET removed_at = clock_timestamp(),
      removed_by = auth.uid(),
      removal_reason = clean_reason,
      removal_client_request_id = p_client_request_id
  WHERE society_id = p_society_id AND id = p_tag_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.spend_tag.remove',
    'major_works_spend_tag', p_tag_id::text,
    jsonb_build_object(
      'project_id', tag.project_id, 'entry_id', tag.entry_id,
      'amount_paise', tag.amount_paise
    ),
    jsonb_build_object('removed', true, 'reason', clean_reason),
    p_request_trace
  );
  RETURN p_tag_id;
END;
$$;

CREATE FUNCTION public.major_works_projects_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  expense_enabled boolean := private.module_enabled(p_society_id, 'expense');
  meeting_enabled boolean := private.module_enabled(p_society_id, 'meeting');
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'expense_enabled', expense_enabled,
    'meeting_enabled', meeting_enabled,
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', project.id,
        'title', project.title,
        'location', project.location,
        'category', project.category,
        'priority', project.priority,
        'estimate_paise', project.estimate_paise,
        'planned_start_on', project.planned_start_on,
        'planned_end_on', project.planned_end_on,
        'actual_start_on', project.actual_start_on,
        'actual_end_on', project.actual_end_on,
        'progress_percent', project.progress_percent,
        'notes', project.notes,
        'forecast_item_id', project.forecast_item_id,
        'status', project.status,
        'status_reason', project.status_reason,
        'resume_status', project.resume_status,
        'approval_body', project.approval_body,
        'approval_date', project.approval_date,
        'approval_meeting_resolution_id',
          project.approval_meeting_resolution_id,
        'budget_source', project.budget_source,
        'typed_budget_paise', project.typed_budget_paise,
        'linked_budget_paise', project.linked_budget_paise,
        'fund_work_id', project.fund_work_id,
        'budget_paise', CASE WHEN project.budget_source = 'typed'
          THEN project.typed_budget_paise
          ELSE project.linked_budget_paise END,
        'spend_paise', CASE
          WHEN NOT expense_enabled THEN NULL
          WHEN project.budget_source = 'sanctioned_work' THEN COALESCE((
            SELECT sum(link.amount_paise)
            FROM public.expense_fund_work_links AS link
            JOIN public.expense_book_entries AS entry
              ON entry.society_id = link.society_id
              AND entry.id = link.entry_id
            WHERE link.society_id = p_society_id
              AND link.work_id = project.fund_work_id
              AND NOT EXISTS (
                SELECT 1 FROM public.expense_book_entries AS reversal
                WHERE reversal.society_id = entry.society_id
                  AND reversal.reverses_entry_id = entry.id
              )
          ), 0)
          ELSE COALESCE((
            SELECT sum(tag.amount_paise)
            FROM public.major_works_spend_tags AS tag
            JOIN public.expense_book_entries AS entry
              ON entry.society_id = tag.society_id
              AND entry.id = tag.entry_id
            WHERE tag.society_id = p_society_id
              AND tag.project_id = project.id
              AND tag.removed_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.expense_book_entries AS reversal
                WHERE reversal.society_id = entry.society_id
                  AND reversal.reverses_entry_id = entry.id
              )
          ), 0)
        END,
        'spend_tags', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', tag.id,
            'entry_id', tag.entry_id,
            'entry_date', entry.entry_date,
            'counterparty', entry.counterparty,
            'amount_paise', tag.amount_paise,
            'removed_at', tag.removed_at,
            'removal_reason', tag.removal_reason
          ) ORDER BY tag.created_at DESC)
          FROM public.major_works_spend_tags AS tag
          JOIN public.expense_book_entries AS entry
            ON entry.society_id = tag.society_id
            AND entry.id = tag.entry_id
          WHERE tag.society_id = p_society_id
            AND tag.project_id = project.id
        ), '[]'::jsonb),
        'updated_at', project.updated_at
      ) ORDER BY
        CASE project.status
          WHEN 'in_progress' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'quoting' THEN 2
          WHEN 'planned' THEN 3
          WHEN 'on_hold' THEN 4
          WHEN 'completed' THEN 5
          ELSE 6
        END,
        lower(project.title))
      FROM public.major_works_projects AS project
      WHERE project.society_id = p_society_id
    ), '[]'::jsonb),
    'forecast_items', CASE WHEN expense_enabled THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'name', item.name,
        'category', item.category,
        'estimate_paise', item.current_cost_paise
      ) ORDER BY lower(item.name))
      FROM public.expense_repair_forecast_items AS item
      WHERE item.society_id = p_society_id
        AND item.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.major_works_projects AS project
          WHERE project.society_id = item.society_id
            AND project.forecast_item_id = item.id
            AND project.status <> 'cancelled'
        )
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'sanctioned_works', CASE WHEN expense_enabled THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', work.id,
        'title', work.title,
        'amount_paise', work.sanctioned_amount_paise
      ) ORDER BY lower(work.title))
      FROM public.expense_fund_works AS work
      WHERE work.society_id = p_society_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'expense_entries', CASE WHEN expense_enabled THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', choice.id,
        'entry_date', choice.entry_date,
        'counterparty', choice.counterparty,
        'amount_paise', choice.amount_paise,
        'remaining_paise', choice.remaining_paise
      ) ORDER BY choice.entry_date DESC, choice.created_at DESC)
      FROM (
        SELECT entry.id, entry.entry_date, entry.counterparty,
          entry.amount_paise, entry.created_at,
          entry.amount_paise - COALESCE((
            SELECT sum(tag.amount_paise)
            FROM public.major_works_spend_tags AS tag
            WHERE tag.society_id = entry.society_id
              AND tag.entry_id = entry.id
              AND tag.removed_at IS NULL
          ), 0) AS remaining_paise
        FROM public.expense_book_entries AS entry
        WHERE entry.society_id = p_society_id
          AND entry.source = 'expense'
          AND NOT EXISTS (
            SELECT 1 FROM public.expense_book_entries AS reversal
            WHERE reversal.society_id = entry.society_id
              AND reversal.reverses_entry_id = entry.id
          )
          AND entry.amount_paise > COALESCE((
            SELECT sum(tag.amount_paise)
            FROM public.major_works_spend_tags AS tag
            WHERE tag.society_id = entry.society_id
              AND tag.entry_id = entry.id
              AND tag.removed_at IS NULL
          ), 0)
        ORDER BY entry.entry_date DESC, entry.created_at DESC
        LIMIT 200
      ) AS choice
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'meeting_resolutions', CASE WHEN meeting_enabled THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', resolution.id,
        'title', resolution.title,
        'passed_on', COALESCE(
          (meeting.held_at AT TIME ZONE 'Asia/Kolkata')::date,
          (meeting.starts_at AT TIME ZONE 'Asia/Kolkata')::date,
          resolution.updated_at::date
        )
      ) ORDER BY resolution.updated_at DESC)
      FROM public.meeting_resolutions AS resolution
      JOIN public.meetings AS meeting
        ON meeting.society_id = resolution.society_id
        AND meeting.id = resolution.meeting_id
      WHERE resolution.society_id = p_society_id
        AND resolution.outcome = 'passed'
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

CREATE FUNCTION public.major_works_resident_projects_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'resident');
  RETURN jsonb_build_object(
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', project.id,
        'title', project.title,
        'location', project.location,
        'status', project.status,
        'progress_percent', project.progress_percent,
        'planned_start_on', project.planned_start_on,
        'planned_end_on', project.planned_end_on
      ) ORDER BY
        CASE project.status
          WHEN 'in_progress' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'quoting' THEN 2
          WHEN 'planned' THEN 3
          WHEN 'on_hold' THEN 4
          WHEN 'completed' THEN 5
          ELSE 6
        END,
        lower(project.title))
      FROM public.major_works_projects AS project
      WHERE project.society_id = p_society_id
        AND project.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_project_save(
  uuid, uuid, text, text, text, text, bigint, date, date, date, date, integer,
  text, uuid, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_project_status_set(
  uuid, uuid, text, text, text, date, uuid, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_project_budget_set(
  uuid, uuid, text, bigint, uuid, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_spend_tag_save(
  uuid, uuid, uuid, bigint, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_spend_tag_remove(
  uuid, uuid, text, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_projects_list(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_resident_projects_get(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.major_works_project_save(
  uuid, uuid, text, text, text, text, bigint, date, date, date, date, integer,
  text, uuid, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_project_status_set(
  uuid, uuid, text, text, text, date, uuid, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_project_budget_set(
  uuid, uuid, text, bigint, uuid, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_spend_tag_save(
  uuid, uuid, uuid, bigint, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_spend_tag_remove(
  uuid, uuid, text, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_projects_list(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_resident_projects_get(uuid)
  TO authenticated;

CREATE TABLE public.major_works_audits (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  audit_on date NOT NULL,
  auditor_name text NOT NULL
    CHECK (
      auditor_name = btrim(auditor_name)
      AND char_length(auditor_name) BETWEEN 1 AND 120
    ),
  findings text NOT NULL
    CHECK (char_length(findings) BETWEEN 1 AND 2000),
  rating text NOT NULL CHECK (
    rating IN ('fine', 'minor_repairs', 'major_repairs', 'unsafe')
  ),
  report_path text CHECK (report_path IS NULL OR char_length(report_path) <= 500),
  repair_status text NOT NULL CHECK (
    repair_status IN ('not_needed', 'pending', 'in_progress', 'done')
  ),
  next_due_on date NOT NULL CHECK (next_due_on >= audit_on),
  reminder_due_sent_at timestamptz,
  reminder_overdue_sent_at timestamptz,
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  void_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_audits_void_check CHECK (
    (
      voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL
    )
    OR (
      voided_at IS NOT NULL
      AND voided_by IS NOT NULL
      AND void_reason = btrim(void_reason)
      AND char_length(void_reason) BETWEEN 5 AND 500
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_audits_society_idx
  ON public.major_works_audits (society_id, audit_on DESC, created_at DESC);
CREATE INDEX major_works_audits_live_due_idx
  ON public.major_works_audits (society_id, next_due_on)
  WHERE voided_at IS NULL;
CREATE INDEX major_works_audits_created_by_idx
  ON public.major_works_audits (created_by);
CREATE INDEX major_works_audits_updated_by_idx
  ON public.major_works_audits (updated_by);
CREATE INDEX major_works_audits_voided_by_idx
  ON public.major_works_audits (voided_by);
CREATE TRIGGER major_works_audits_set_updated_at
  BEFORE UPDATE ON public.major_works_audits
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.major_works_audit_projects (
  society_id uuid NOT NULL,
  audit_id uuid NOT NULL,
  project_id uuid NOT NULL,
  PRIMARY KEY (society_id, audit_id, project_id),
  CONSTRAINT major_works_audit_projects_audit_fkey
    FOREIGN KEY (society_id, audit_id)
    REFERENCES public.major_works_audits (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_audit_projects_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT
);
CREATE INDEX major_works_audit_projects_project_idx
  ON public.major_works_audit_projects (society_id, project_id);

CREATE TABLE public.major_works_audit_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  audit_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'void')),
  previous_values jsonb,
  after_values jsonb NOT NULL,
  project_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  CONSTRAINT major_works_audit_events_audit_fkey
    FOREIGN KEY (society_id, audit_id)
    REFERENCES public.major_works_audits (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_audit_events_audit_idx
  ON public.major_works_audit_events (society_id, audit_id, created_at);
CREATE INDEX major_works_audit_events_actor_idx
  ON public.major_works_audit_events (actor_id);
CREATE TRIGGER major_works_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.major_works_audit_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER major_works_audit_events_no_truncate
  BEFORE TRUNCATE ON public.major_works_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

ALTER TABLE public.major_works_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_audit_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.major_works_audits,
  public.major_works_audit_projects,
  public.major_works_audit_events
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY major_works_audits_no_direct_access
  ON public.major_works_audits FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_audit_projects_no_direct_access
  ON public.major_works_audit_projects FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_audit_events_no_direct_access
  ON public.major_works_audit_events FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'major-works-files',
  'major-works-files',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
);
CREATE POLICY major_works_files_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'major-works-files'
    AND private.module_enabled(private.file_society_id(name), 'major_works')
    AND private.has_role(
      private.file_society_id(name),
      ARRAY['admin', 'committee']::text[]
    )
  );
CREATE POLICY major_works_files_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'major-works-files'
    AND private.module_enabled(private.file_society_id(name), 'major_works')
    AND private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
    AND private.society_writable(private.file_society_id(name))
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE FUNCTION private.major_works_audit_values(
  p_audit public.major_works_audits
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'audit_on', p_audit.audit_on,
    'auditor_name', p_audit.auditor_name,
    'findings', p_audit.findings,
    'rating', p_audit.rating,
    'report_path', p_audit.report_path,
    'repair_status', p_audit.repair_status,
    'next_due_on', p_audit.next_due_on,
    'voided_at', p_audit.voided_at,
    'void_reason', p_audit.void_reason,
    'version', p_audit.version
  )
$$;
REVOKE ALL ON FUNCTION private.major_works_audit_values(
  public.major_works_audits
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.major_works_audit_save(
  p_society_id uuid,
  p_audit_id uuid,
  p_audit_on date,
  p_auditor_name text,
  p_findings text,
  p_rating text,
  p_report_path text,
  p_repair_status text,
  p_next_due_on date,
  p_project_ids uuid[],
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  audit public.major_works_audits;
  retry public.major_works_audit_events;
  clean_name text := btrim(p_auditor_name);
  clean_findings text := btrim(p_findings);
  previous_values jsonb;
  unique_project_ids uuid[];
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_audit_on IS NULL OR p_next_due_on IS NULL
    OR p_next_due_on < p_audit_on
    OR clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR clean_findings IS NULL
      OR char_length(clean_findings) NOT BETWEEN 1 AND 2000
    OR p_rating NOT IN ('fine', 'minor_repairs', 'major_repairs', 'unsafe')
    OR p_repair_status NOT IN ('not_needed', 'pending', 'in_progress', 'done')
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the structural audit details.'
      USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT project_id), ARRAY[]::uuid[])
  INTO unique_project_ids
  FROM unnest(COALESCE(p_project_ids, ARRAY[]::uuid[])) AS project_id;
  IF EXISTS (
    SELECT 1 FROM unnest(unique_project_ids) AS project_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.major_works_projects
      WHERE society_id = p_society_id AND id = project_id
    )
  ) THEN
    RAISE EXCEPTION 'Choose projects from this society.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_audit_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.action NOT IN ('create', 'update')
      OR retry.audit_id IS DISTINCT FROM p_audit_id
      OR retry.after_values ->> 'auditor_name' IS DISTINCT FROM clean_name
      OR retry.after_values ->> 'findings' IS DISTINCT FROM clean_findings
      OR retry.after_values ->> 'rating' IS DISTINCT FROM p_rating
      OR retry.after_values ->> 'report_path' IS DISTINCT FROM p_report_path
    THEN
      RAISE EXCEPTION 'That retry key belongs to another audit action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN retry.audit_id;
  END IF;
  IF p_audit_id IS NULL THEN
    INSERT INTO public.major_works_audits (
      society_id, audit_on, auditor_name, findings, rating, report_path,
      repair_status, next_due_on, client_request_id, created_by
    ) VALUES (
      p_society_id, p_audit_on, clean_name, clean_findings, p_rating,
      p_report_path, p_repair_status, p_next_due_on,
      p_client_request_id, auth.uid()
    ) RETURNING * INTO audit;
    INSERT INTO public.major_works_audit_projects (
      society_id, audit_id, project_id
    )
    SELECT p_society_id, audit.id, project_id
    FROM unnest(unique_project_ids) AS project_id;
    INSERT INTO public.major_works_audit_events (
      society_id, audit_id, action, previous_values, after_values,
      project_ids, actor_id, client_request_id
    ) VALUES (
      p_society_id, audit.id, 'create', NULL,
      private.major_works_audit_values(audit),
      to_jsonb(unique_project_ids), auth.uid(), p_client_request_id
    );
  ELSE
    SELECT * INTO audit FROM public.major_works_audits
    WHERE society_id = p_society_id AND id = p_audit_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Structural audit not found.' USING ERRCODE = 'P0002';
    END IF;
    IF audit.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The structural audit changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF audit.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'A voided structural audit cannot be edited.'
        USING ERRCODE = '23514';
    END IF;
    previous_values := private.major_works_audit_values(audit);
    UPDATE public.major_works_audits
    SET audit_on = p_audit_on,
        auditor_name = clean_name,
        findings = clean_findings,
        rating = p_rating,
        report_path = p_report_path,
        repair_status = p_repair_status,
        next_due_on = p_next_due_on,
        reminder_due_sent_at = NULL,
        reminder_overdue_sent_at = NULL,
        version = audit.version + 1
    WHERE society_id = p_society_id AND id = p_audit_id
    RETURNING * INTO audit;
    DELETE FROM public.major_works_audit_projects
    WHERE society_id = p_society_id AND audit_id = p_audit_id;
    INSERT INTO public.major_works_audit_projects (
      society_id, audit_id, project_id
    )
    SELECT p_society_id, audit.id, project_id
    FROM unnest(unique_project_ids) AS project_id;
    INSERT INTO public.major_works_audit_events (
      society_id, audit_id, action, previous_values, after_values,
      project_ids, actor_id, client_request_id
    ) VALUES (
      p_society_id, audit.id, 'update', previous_values,
      private.major_works_audit_values(audit),
      to_jsonb(unique_project_ids), auth.uid(), p_client_request_id
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_audit_id IS NULL THEN 'major_works.audit.create'
      ELSE 'major_works.audit.update' END,
    'major_works_audit', audit.id::text, previous_values,
    private.major_works_audit_values(audit), p_request_trace
  );
  RETURN audit.id;
END;
$$;

CREATE FUNCTION public.major_works_audit_void(
  p_society_id uuid,
  p_audit_id uuid,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  audit public.major_works_audits;
  retry public.major_works_audit_events;
  clean_reason text := btrim(p_reason);
  previous_values jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 5 AND 500
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Give a reason for voiding the structural audit.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_audit_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.action <> 'void' OR retry.audit_id <> p_audit_id THEN
      RAISE EXCEPTION 'That retry key belongs to another audit action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_audit_id;
  END IF;
  SELECT * INTO audit FROM public.major_works_audits
  WHERE society_id = p_society_id AND id = p_audit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Structural audit not found.' USING ERRCODE = 'P0002';
  END IF;
  IF audit.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The structural audit changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF audit.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'The structural audit is already void.'
      USING ERRCODE = '23514';
  END IF;
  previous_values := private.major_works_audit_values(audit);
  UPDATE public.major_works_audits
  SET voided_at = clock_timestamp(),
      voided_by = auth.uid(),
      void_reason = clean_reason,
      version = audit.version + 1
  WHERE society_id = p_society_id AND id = p_audit_id
  RETURNING * INTO audit;
  INSERT INTO public.major_works_audit_events (
    society_id, audit_id, action, previous_values, after_values,
    project_ids, actor_id, client_request_id
  ) VALUES (
    p_society_id, p_audit_id, 'void', previous_values,
    private.major_works_audit_values(audit),
    COALESCE((
      SELECT jsonb_agg(project_id)
      FROM public.major_works_audit_projects
      WHERE society_id = p_society_id AND audit_id = p_audit_id
    ), '[]'::jsonb),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.audit.void',
    'major_works_audit', p_audit_id::text, previous_values,
    private.major_works_audit_values(audit), p_request_trace
  );
  RETURN p_audit_id;
END;
$$;

CREATE FUNCTION public.major_works_audits_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'audits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', audit.id,
        'audit_on', audit.audit_on,
        'auditor_name', audit.auditor_name,
        'findings', audit.findings,
        'rating', audit.rating,
        'report_path', audit.report_path,
        'repair_status', audit.repair_status,
        'next_due_on', audit.next_due_on,
        'reminder_due_sent_at', audit.reminder_due_sent_at,
        'reminder_overdue_sent_at', audit.reminder_overdue_sent_at,
        'voided_at', audit.voided_at,
        'void_reason', audit.void_reason,
        'updated_at', audit.updated_at,
        'projects', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', project.id, 'title', project.title
          ) ORDER BY lower(project.title))
          FROM public.major_works_audit_projects AS link
          JOIN public.major_works_projects AS project
            ON project.society_id = link.society_id
            AND project.id = link.project_id
          WHERE link.society_id = audit.society_id
            AND link.audit_id = audit.id
        ), '[]'::jsonb)
      ) ORDER BY audit.audit_on DESC, audit.created_at DESC)
      FROM public.major_works_audits AS audit
      WHERE audit.society_id = p_society_id
    ), '[]'::jsonb),
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', project.id, 'title', project.title
      ) ORDER BY lower(project.title))
      FROM public.major_works_projects AS project
      WHERE project.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.major_works_audit_reminders_run(
  p_society_id uuid,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date;
  latest public.major_works_audits;
  admin_user record;
  notified integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Major-works maintenance is restricted.'
      USING ERRCODE = '42501';
  END IF;
  IF p_society_id IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'The society and request id are invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'major_works')
    OR NOT private.society_writable(p_society_id)
  THEN
    RETURN jsonb_build_object('notified', 0);
  END IF;
  today := private.housekeeping_local_date(p_society_id);
  SELECT * INTO latest FROM public.major_works_audits
  WHERE society_id = p_society_id AND voided_at IS NULL
  ORDER BY audit_on DESC, created_at DESC, id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('notified', 0);
  END IF;
  IF (
    today = latest.next_due_on - 30
    AND latest.reminder_due_sent_at IS NULL
  ) OR (
    today = latest.next_due_on + 1
    AND latest.reminder_overdue_sent_at IS NULL
  ) THEN
    FOR admin_user IN
      SELECT DISTINCT membership.user_id
      FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND membership.user_id IS NOT NULL
        AND membership.roles && ARRAY['admin']::text[]
      ORDER BY membership.user_id
    LOOP
      PERFORM private.create_notification(
        p_society_id,
        admin_user.user_id,
        CASE WHEN today = latest.next_due_on + 1
          THEN 'major_works_audit_overdue'
          ELSE 'major_works_audit_due'
        END,
        CASE WHEN today = latest.next_due_on + 1
          THEN 'Structural audit overdue'
          ELSE 'Structural audit due in 30 days'
        END,
        left(
          'Review the next structural audit due '
          || to_char(latest.next_due_on, 'DD Mon YYYY')
          || '.',
          300
        ),
        'major_works_audit',
        latest.id,
        p_request_id
      );
      notified := notified + 1;
    END LOOP;
    UPDATE public.major_works_audits
    SET reminder_due_sent_at = CASE
        WHEN today = latest.next_due_on - 30
          THEN clock_timestamp()
        ELSE reminder_due_sent_at
      END,
      reminder_overdue_sent_at = CASE
        WHEN today = latest.next_due_on + 1
          THEN clock_timestamp()
        ELSE reminder_overdue_sent_at
      END
    WHERE society_id = p_society_id AND id = latest.id;
    IF notified > 0 THEN
      INSERT INTO public.audit_logs (
        society_id, actor_id, actor_role, action, entity_type, entity_id,
        "before", "after", request_id
      ) VALUES (
        p_society_id, NULL, 'system', 'major_works.audit.reminder',
        'major_works_audit', latest.id::text, NULL,
        jsonb_build_object('notified', notified, 'day', today),
        p_request_id
      );
    END IF;
  END IF;
  RETURN jsonb_build_object('notified', notified);
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_audit_save(
  uuid, uuid, date, text, text, text, text, text, date, uuid[],
  timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_audit_void(
  uuid, uuid, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_audits_list(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_audit_reminders_run(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_audit_save(
  uuid, uuid, date, text, text, text, text, text, date, uuid[],
  timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_audit_void(
  uuid, uuid, text, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_audits_list(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_audit_reminders_run(uuid, text)
  TO service_role;

CREATE TABLE public.major_works_quotes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  project_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('vendor_quote', 'typed')),
  vendor_quote_id uuid,
  vendor_name text NOT NULL
    CHECK (
      vendor_name = btrim(vendor_name)
      AND char_length(vendor_name) BETWEEN 1 AND 120
    ),
  amount_paise bigint NOT NULL
    CHECK (amount_paise BETWEEN 1 AND 9007199254740991),
  scope_note text NOT NULL
    CHECK (
      scope_note = btrim(scope_note)
      AND char_length(scope_note) BETWEEN 1 AND 500
    ),
  file_path text CHECK (file_path IS NULL OR char_length(file_path) <= 500),
  like_for_like boolean NOT NULL DEFAULT false,
  excluded_at timestamptz,
  excluded_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  exclusion_reason text,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  removal_reason text,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_quotes_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_quotes_vendor_quote_fkey
    FOREIGN KEY (society_id, vendor_quote_id)
    REFERENCES public.vendor_quotes (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT major_works_quotes_source_shape_check CHECK (
    (
      source = 'vendor_quote' AND vendor_quote_id IS NOT NULL
    )
    OR (
      source = 'typed' AND vendor_quote_id IS NULL
    )
  ),
  CONSTRAINT major_works_quotes_exclusion_check CHECK (
    (excluded_at IS NULL) = (excluded_by IS NULL)
    AND (excluded_at IS NULL) = (exclusion_reason IS NULL)
    AND (
      exclusion_reason IS NULL
      OR (
        exclusion_reason = btrim(exclusion_reason)
        AND char_length(exclusion_reason) BETWEEN 5 AND 500
      )
    )
  ),
  CONSTRAINT major_works_quotes_removal_check CHECK (
    (removed_at IS NULL) = (removed_by IS NULL)
    AND (removed_at IS NULL) = (removal_reason IS NULL)
    AND (
      removal_reason IS NULL
      OR (
        removal_reason = btrim(removal_reason)
        AND char_length(removal_reason) BETWEEN 5 AND 500
      )
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX major_works_quotes_live_vendor_quote_idx
  ON public.major_works_quotes (society_id, project_id, vendor_quote_id)
  WHERE removed_at IS NULL AND vendor_quote_id IS NOT NULL;
CREATE INDEX major_works_quotes_project_idx
  ON public.major_works_quotes (society_id, project_id, removed_at);
CREATE INDEX major_works_quotes_created_by_idx
  ON public.major_works_quotes (created_by);

CREATE TABLE public.major_works_criteria (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  weight integer NOT NULL CHECK (weight BETWEEN 1 AND 100),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 8),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_criteria_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, project_id, position),
  UNIQUE (society_id, project_id, client_request_id, position)
);
CREATE INDEX major_works_criteria_project_idx
  ON public.major_works_criteria (society_id, project_id, position);

CREATE TABLE public.major_works_scores (
  society_id uuid NOT NULL,
  project_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  criterion_id uuid NOT NULL,
  scorer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 10),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (society_id, project_id, quote_id, criterion_id, scorer_id),
  CONSTRAINT major_works_scores_quote_fkey
    FOREIGN KEY (society_id, quote_id)
    REFERENCES public.major_works_quotes (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_scores_criterion_fkey
    FOREIGN KEY (society_id, criterion_id)
    REFERENCES public.major_works_criteria (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_scores_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT
);
CREATE INDEX major_works_scores_project_idx
  ON public.major_works_scores (society_id, project_id);
CREATE INDEX major_works_scores_scorer_idx
  ON public.major_works_scores (society_id, scorer_id);

ALTER TABLE public.major_works_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.major_works_quotes,
  public.major_works_criteria,
  public.major_works_scores
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY major_works_quotes_no_direct_access
  ON public.major_works_quotes FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_criteria_no_direct_access
  ON public.major_works_criteria FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_scores_no_direct_access
  ON public.major_works_scores FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.major_works_projects
  ADD CONSTRAINT major_works_projects_chosen_quote_fkey
  FOREIGN KEY (society_id, chosen_quote_id)
  REFERENCES public.major_works_quotes (society_id, id) ON DELETE RESTRICT;

CREATE FUNCTION public.major_works_quote_add(
  p_society_id uuid,
  p_project_id uuid,
  p_vendor_quote_id uuid,
  p_vendor_name text,
  p_amount_paise bigint,
  p_scope_note text,
  p_file_path text,
  p_like_for_like boolean,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  vendor_quote public.vendor_quotes;
  existing public.major_works_quotes;
  quote_id uuid;
  live_count integer;
  clean_name text := btrim(p_vendor_name);
  clean_note text := btrim(p_scope_note);
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO existing FROM public.major_works_quotes
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF existing.project_id <> p_project_id
      OR existing.vendor_quote_id IS DISTINCT FROM p_vendor_quote_id
      OR existing.vendor_name IS DISTINCT FROM clean_name
      OR existing.amount_paise IS DISTINCT FROM p_amount_paise
    THEN
      RAISE EXCEPTION 'That retry key belongs to another quote.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF project.scoring_state <> 'setup' THEN
    RAISE EXCEPTION 'Quotes lock when scoring opens.'
      USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO live_count FROM public.major_works_quotes
  WHERE society_id = p_society_id
    AND project_id = p_project_id
    AND removed_at IS NULL;
  IF live_count >= 3 THEN
    RAISE EXCEPTION 'A project can hold at most three live quotes.'
      USING ERRCODE = '23514';
  END IF;
  IF p_vendor_quote_id IS NOT NULL THEN
    IF NOT private.module_enabled(p_society_id, 'vendor') THEN
      RAISE EXCEPTION 'Vendors must be enabled for linked quotes.'
        USING ERRCODE = '23514';
    END IF;
    SELECT quote.* INTO vendor_quote
    FROM public.vendor_quotes AS quote
    JOIN public.vendors AS vendor
      ON vendor.society_id = quote.society_id
      AND vendor.id = quote.vendor_id
    WHERE quote.society_id = p_society_id
      AND quote.id = p_vendor_quote_id
      AND quote.removed_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a live vendor quote.'
        USING ERRCODE = '22023';
    END IF;
    SELECT vendor.name, vendor_quote.amount_paise, vendor_quote.note
    INTO clean_name, p_amount_paise, clean_note
    FROM public.vendors AS vendor
    WHERE vendor.society_id = p_society_id
      AND vendor.id = vendor_quote.vendor_id;
    p_scope_note := clean_note;
  END IF;
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR clean_note IS NULL OR char_length(clean_note) NOT BETWEEN 1 AND 500
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the quote vendor, amount and scope.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.major_works_quotes (
    society_id, project_id, source, vendor_quote_id, vendor_name,
    amount_paise, scope_note, file_path, like_for_like, client_request_id,
    created_by
  ) VALUES (
    p_society_id, p_project_id,
    CASE WHEN p_vendor_quote_id IS NULL THEN 'typed' ELSE 'vendor_quote' END,
    p_vendor_quote_id, clean_name, p_amount_paise, clean_note,
    p_file_path, COALESCE(p_like_for_like, false), p_client_request_id,
    auth.uid()
  ) RETURNING id INTO quote_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.quote.add',
    'major_works_quote', quote_id::text, NULL,
    jsonb_build_object(
      'project_id', p_project_id, 'vendor_quote_id', p_vendor_quote_id,
      'vendor_name', clean_name, 'amount_paise', p_amount_paise,
      'like_for_like', COALESCE(p_like_for_like, false)
    ),
    p_request_trace
  );
  RETURN quote_id;
END;
$$;

CREATE FUNCTION public.major_works_quote_remove(
  p_society_id uuid,
  p_quote_id uuid,
  p_reason text,
  p_exclude boolean,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  quote public.major_works_quotes;
  project public.major_works_projects;
  clean_reason text := btrim(p_reason);
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 5 AND 500
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Give a reason for changing the quote.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO quote FROM public.major_works_quotes
  WHERE society_id = p_society_id AND id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.' USING ERRCODE = 'P0002';
  END IF;
  IF (
    p_exclude
    AND quote.excluded_at IS NOT NULL
    AND quote.exclusion_reason = clean_reason
  ) OR (
    NOT p_exclude
    AND quote.removed_at IS NOT NULL
    AND quote.removal_reason = clean_reason
  ) THEN
    RETURN p_quote_id;
  END IF;
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = quote.society_id AND id = quote.project_id;
  IF NOT FOUND OR project.scoring_state NOT IN ('setup', 'not_scored') THEN
    RAISE EXCEPTION 'Quotes lock while scoring is open or closed.'
      USING ERRCODE = '23514';
  END IF;
  IF p_exclude THEN
    IF quote.removed_at IS NOT NULL OR quote.excluded_at IS NOT NULL THEN
      RAISE EXCEPTION 'The quote is already unavailable for scoring.'
        USING ERRCODE = '23514';
    END IF;
    UPDATE public.major_works_quotes
    SET excluded_at = clock_timestamp(), excluded_by = auth.uid(),
      exclusion_reason = clean_reason
    WHERE society_id = p_society_id AND id = p_quote_id;
  ELSE
    IF quote.removed_at IS NOT NULL THEN
      RAISE EXCEPTION 'The quote is already removed.' USING ERRCODE = '23514';
    END IF;
    UPDATE public.major_works_quotes
    SET removed_at = clock_timestamp(), removed_by = auth.uid(),
      removal_reason = clean_reason
    WHERE society_id = p_society_id AND id = p_quote_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_exclude THEN 'major_works.quote.exclude'
      ELSE 'major_works.quote.remove' END,
    'major_works_quote', p_quote_id::text, NULL,
    jsonb_build_object('excluded', p_exclude, 'reason', clean_reason),
    p_request_trace
  );
  RETURN p_quote_id;
END;
$$;

CREATE FUNCTION public.major_works_criteria_set(
  p_society_id uuid,
  p_project_id uuid,
  p_items jsonb,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  weight_total integer;
  item_count integer;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.major_works_criteria
    WHERE society_id = p_society_id
      AND project_id = p_project_id
      AND client_request_id = p_client_request_id
  ) THEN
    IF (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', criterion.name, 'weight', criterion.weight
        ) ORDER BY criterion.position
      )
      FROM public.major_works_criteria AS criterion
      WHERE criterion.society_id = p_society_id
        AND criterion.project_id = p_project_id
    ) IS DISTINCT FROM (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', btrim(item ->> 'name'),
          'weight', (item ->> 'weight')::integer
        ) ORDER BY position
      )
      FROM jsonb_array_elements(p_items) WITH ORDINALITY
        AS item_row(item, position)
    ) THEN
      RAISE EXCEPTION 'That retry key belongs to another criteria set.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_project_id;
  END IF;
  IF project.scoring_state <> 'setup' THEN
    RAISE EXCEPTION 'Criteria lock when scoring opens.' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), COALESCE(sum((item ->> 'weight')::integer), 0)
  INTO item_count, weight_total
  FROM jsonb_array_elements(p_items) AS item;
  IF item_count NOT BETWEEN 2 AND 8 OR weight_total <> 100
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_items) AS item
      WHERE btrim(item ->> 'name') = ''
        OR char_length(btrim(item ->> 'name')) > 80
        OR (item ->> 'weight')::integer NOT BETWEEN 1 AND 100
    )
  THEN
    RAISE EXCEPTION 'Add 2 to 8 criteria with weights totalling 100.'
      USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.major_works_criteria
  WHERE society_id = p_society_id AND project_id = p_project_id;
  INSERT INTO public.major_works_criteria (
    society_id, project_id, name, weight, position,
    client_request_id, created_by
  )
  SELECT p_society_id, p_project_id, btrim(item ->> 'name'),
    (item ->> 'weight')::integer, position::integer,
    p_client_request_id, auth.uid()
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item_row(item, position);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.criteria.save',
    'major_works_project', p_project_id::text, NULL,
    jsonb_build_object('criteria', p_items), p_request_trace
  );
  RETURN p_project_id;
END;
$$;

CREATE FUNCTION public.major_works_scoring_transition(
  p_society_id uuid,
  p_project_id uuid,
  p_action text,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  criteria_count integer;
  weight_total integer;
  quote_count integer;
  clean_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF (
    p_action = 'open' AND project.scoring_state = 'open'
  ) OR (
    p_action = 'close' AND project.scoring_state = 'closed'
  ) OR (
    p_action = 'not_scored'
    AND project.scoring_state = 'not_scored'
    AND project.not_scored_reason = NULLIF(btrim(p_reason), '')
  ) THEN
    RETURN p_project_id;
  END IF;
  IF project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The repair project changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF p_action = 'open' AND project.scoring_state = 'setup' THEN
    SELECT count(*), COALESCE(sum(weight), 0)
    INTO criteria_count, weight_total
    FROM public.major_works_criteria
    WHERE society_id = p_society_id AND project_id = p_project_id;
    SELECT count(*) INTO quote_count FROM public.major_works_quotes
    WHERE society_id = p_society_id
      AND project_id = p_project_id
      AND removed_at IS NULL
      AND excluded_at IS NULL;
    IF criteria_count NOT BETWEEN 2 AND 8
      OR weight_total <> 100 OR quote_count < 1
    THEN
      RAISE EXCEPTION 'Open scoring needs valid criteria and an included quote.'
        USING ERRCODE = '23514';
    END IF;
    UPDATE public.major_works_projects
    SET scoring_state = 'open',
      scoring_opened_at = clock_timestamp(),
      scoring_opened_by = auth.uid(),
      version = version + 1
    WHERE society_id = p_society_id AND id = p_project_id;
  ELSIF p_action = 'close' AND project.scoring_state = 'open' THEN
    UPDATE public.major_works_projects
    SET scoring_state = 'closed',
      scoring_closed_at = clock_timestamp(),
      scoring_closed_by = auth.uid(),
      version = version + 1
    WHERE society_id = p_society_id AND id = p_project_id;
  ELSIF p_action = 'not_scored' AND project.scoring_state = 'setup'
    AND clean_reason IS NOT NULL AND char_length(clean_reason) BETWEEN 5 AND 500
  THEN
    UPDATE public.major_works_projects
    SET scoring_state = 'not_scored',
      not_scored_reason = clean_reason,
      version = version + 1
    WHERE society_id = p_society_id AND id = p_project_id;
  ELSE
    RAISE EXCEPTION 'That scoring change is not allowed.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.scoring.' || p_action,
    'major_works_project', p_project_id::text,
    jsonb_build_object('state', project.scoring_state),
    jsonb_build_object('state', (
      SELECT scoring_state FROM public.major_works_projects
      WHERE society_id = p_society_id AND id = p_project_id
    ), 'reason', clean_reason),
    p_request_trace
  );
  RETURN p_project_id;
END;
$$;

CREATE FUNCTION public.major_works_scores_save(
  p_society_id uuid,
  p_project_id uuid,
  p_items jsonb,
  p_request_trace text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  saved integer;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  PERFORM private.expense_check_trace(p_request_trace);
  IF NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.society_writable(p_society_id)
  THEN
    RAISE EXCEPTION 'Scoring is unavailable.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id;
  IF NOT FOUND OR project.scoring_state <> 'open' THEN
    RAISE EXCEPTION 'Scoring is not open.' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.major_works_scores (
    society_id, project_id, quote_id, criterion_id, scorer_id, score
  )
  SELECT p_society_id, p_project_id,
    (item ->> 'quote_id')::uuid,
    (item ->> 'criterion_id')::uuid,
    auth.uid(),
    (item ->> 'score')::integer
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.major_works_quotes AS quote
    ON quote.society_id = p_society_id
    AND quote.id = (item ->> 'quote_id')::uuid
    AND quote.project_id = p_project_id
    AND quote.removed_at IS NULL
    AND quote.excluded_at IS NULL
  JOIN public.major_works_criteria AS criterion
    ON criterion.society_id = p_society_id
    AND criterion.id = (item ->> 'criterion_id')::uuid
    AND criterion.project_id = p_project_id
  WHERE (item ->> 'score')::integer BETWEEN 0 AND 10
  ON CONFLICT (society_id, project_id, quote_id, criterion_id, scorer_id)
  DO UPDATE SET score = EXCLUDED.score, updated_at = clock_timestamp();
  GET DIAGNOSTICS saved = ROW_COUNT;
  IF saved <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Every score needs an included quote and criterion.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
      THEN 'admin' ELSE 'committee' END,
    'major_works.scores.save', 'major_works_project',
    p_project_id::text, NULL,
    jsonb_build_object('score_count', saved), p_request_trace
  );
  RETURN saved;
END;
$$;

CREATE FUNCTION public.major_works_scoring_get(p_society_id uuid, p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'project_id', project.id,
    'scoring_state', project.scoring_state,
    'not_scored_reason', project.not_scored_reason,
    'chosen_quote_id', project.chosen_quote_id,
    'chosen_quote_reason', project.chosen_quote_reason,
    'updated_at', project.updated_at,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'quotes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', quote.id,
        'source', quote.source,
        'vendor_quote_id', quote.vendor_quote_id,
        'vendor_name', quote.vendor_name,
        'amount_paise', quote.amount_paise,
        'scope_note', quote.scope_note,
        'file_path', quote.file_path,
        'like_for_like', quote.like_for_like,
        'excluded_at', quote.excluded_at,
        'exclusion_reason', quote.exclusion_reason,
        'removed_at', quote.removed_at,
        'removal_reason', quote.removal_reason,
        'weighted_average', CASE WHEN project.scoring_state = 'closed'
          THEN round(COALESCE((
            SELECT sum(
              (
                SELECT avg(score)::numeric
                FROM public.major_works_scores
                WHERE society_id = p_society_id
                  AND project_id = p_project_id
                  AND quote_id = quote.id
                  AND criterion_id = criterion.id
              ) * criterion.weight
            )
            FROM public.major_works_criteria AS criterion
            WHERE criterion.society_id = p_society_id
              AND criterion.project_id = p_project_id
          ), 0) / 100, 1)
          ELSE NULL END,
        'scorer_count', CASE WHEN project.scoring_state = 'closed'
          THEN (
            SELECT count(DISTINCT scorer_id)
            FROM public.major_works_scores
            WHERE society_id = p_society_id
              AND project_id = p_project_id
              AND quote_id = quote.id
          ) ELSE NULL END
      ) ORDER BY quote.amount_paise, lower(quote.vendor_name))
      FROM public.major_works_quotes AS quote
      WHERE quote.society_id = p_society_id
        AND quote.project_id = p_project_id
        AND quote.removed_at IS NULL
    ), '[]'::jsonb),
    'criteria', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', criterion.id,
        'name', criterion.name,
        'weight', criterion.weight,
        'position', criterion.position
      ) ORDER BY criterion.position)
      FROM public.major_works_criteria AS criterion
      WHERE criterion.society_id = p_society_id
        AND criterion.project_id = p_project_id
    ), '[]'::jsonb),
    'my_scores', CASE WHEN project.scoring_state = 'open' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'quote_id', score.quote_id,
        'criterion_id', score.criterion_id,
        'score', score.score
      ))
      FROM public.major_works_scores AS score
      WHERE score.society_id = p_society_id
        AND score.project_id = p_project_id
        AND score.scorer_id = auth.uid()
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'vendor_quotes', CASE WHEN private.module_enabled(p_society_id, 'vendor')
      THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', quote.id,
          'request_id', request.id,
          'request_title', request.title,
          'vendor_name', vendor.name,
          'amount_paise', quote.amount_paise,
          'scope_note', quote.note
        ) ORDER BY request.title, lower(vendor.name))
        FROM public.vendor_quotes AS quote
        JOIN public.vendor_purchase_requests AS request
          ON request.society_id = quote.society_id
          AND request.id = quote.request_id
        JOIN public.vendors AS vendor
          ON vendor.society_id = quote.society_id
          AND vendor.id = quote.vendor_id
        WHERE quote.society_id = p_society_id
          AND quote.removed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.major_works_quotes AS linked
            WHERE linked.society_id = p_society_id
              AND linked.project_id = p_project_id
              AND linked.vendor_quote_id = quote.id
              AND linked.removed_at IS NULL
          )
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

CREATE FUNCTION public.major_works_chosen_quote_set(
  p_society_id uuid,
  p_project_id uuid,
  p_quote_id uuid,
  p_reason text,
  p_resolution_id uuid,
  p_expected_updated_at timestamptz,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project public.major_works_projects;
  clean_reason text := btrim(p_reason);
  resolution public.meeting_resolutions;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO project FROM public.major_works_projects
  WHERE society_id = p_society_id AND id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF project.chosen_quote_id = p_quote_id
    AND project.chosen_quote_reason = btrim(p_reason)
    AND project.chosen_quote_resolution_id IS NOT DISTINCT FROM p_resolution_id
  THEN
    RETURN p_project_id;
  END IF;
  IF project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The repair project changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 5 AND 500
    OR NOT EXISTS (
      SELECT 1 FROM public.major_works_quotes
      WHERE society_id = p_society_id
        AND project_id = p_project_id
        AND id = p_quote_id
        AND removed_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'Choose a quote and record the reason.'
      USING ERRCODE = '22023';
  END IF;
  IF p_resolution_id IS NOT NULL THEN
    SELECT * INTO resolution FROM public.meeting_resolutions
    WHERE society_id = p_society_id AND id = p_resolution_id;
    IF NOT FOUND OR resolution.outcome <> 'passed'
      OR NOT private.module_enabled(p_society_id, 'meeting')
    THEN
      RAISE EXCEPTION 'Choose a passed meeting resolution.'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.major_works_projects
  SET chosen_quote_id = p_quote_id,
      chosen_quote_reason = clean_reason,
      chosen_quote_resolution_id = p_resolution_id,
      version = version + 1
  WHERE society_id = p_society_id AND id = p_project_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.quote.choose',
    'major_works_project', p_project_id::text,
    jsonb_build_object('quote_id', project.chosen_quote_id),
    jsonb_build_object(
      'quote_id', p_quote_id, 'reason', clean_reason,
      'resolution_id', p_resolution_id
    ),
    p_request_trace
  );
  RETURN p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_quote_add(
  uuid, uuid, uuid, text, bigint, text, text, boolean, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_quote_remove(
  uuid, uuid, text, boolean, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_criteria_set(
  uuid, uuid, jsonb, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_scoring_transition(
  uuid, uuid, text, text, timestamptz, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_scores_save(
  uuid, uuid, jsonb, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_scoring_get(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_chosen_quote_set(
  uuid, uuid, uuid, text, uuid, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.major_works_quote_add(
  uuid, uuid, uuid, text, bigint, text, text, boolean, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_quote_remove(
  uuid, uuid, text, boolean, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_criteria_set(
  uuid, uuid, jsonb, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_scoring_transition(
  uuid, uuid, text, text, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_scores_save(
  uuid, uuid, jsonb, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_scoring_get(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_chosen_quote_set(
  uuid, uuid, uuid, text, uuid, timestamptz, text
) TO authenticated;

CREATE TABLE public.major_works_scenarios (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  amount_basis text NOT NULL CHECK (
    amount_basis IN ('typed', 'estimate', 'budget')
  ),
  typed_amount_paise bigint
    CHECK (
      typed_amount_paise IS NULL
      OR typed_amount_paise BETWEEN 0 AND 9007199254740991
    ),
  deduction_type text NOT NULL CHECK (deduction_type IN ('none', 'typed', 'fund')),
  deduction_paise bigint
    CHECK (
      deduction_paise IS NULL
      OR deduction_paise BETWEEN 0 AND 9007199254740991
    ),
  fund_id uuid,
  split text NOT NULL CHECK (split IN ('area', 'equal')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_scenarios_project_fkey
    FOREIGN KEY (society_id, project_id)
    REFERENCES public.major_works_projects (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_scenarios_fund_fkey
    FOREIGN KEY (society_id, fund_id)
    REFERENCES public.expense_funds (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT major_works_scenarios_amount_check CHECK (
    (amount_basis = 'typed' AND typed_amount_paise IS NOT NULL)
    OR (amount_basis <> 'typed' AND typed_amount_paise IS NULL)
  ),
  CONSTRAINT major_works_scenarios_deduction_check CHECK (
    (
      deduction_type = 'none'
      AND deduction_paise IS NULL
      AND fund_id IS NULL
    )
    OR (
      deduction_type = 'typed'
      AND deduction_paise IS NOT NULL
      AND fund_id IS NULL
    )
    OR (
      deduction_type = 'fund'
      AND deduction_paise IS NULL
      AND fund_id IS NOT NULL
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_scenarios_project_idx
  ON public.major_works_scenarios (society_id, project_id, updated_at DESC);
CREATE INDEX major_works_scenarios_created_by_idx
  ON public.major_works_scenarios (created_by);
CREATE INDEX major_works_scenarios_updated_by_idx
  ON public.major_works_scenarios (updated_by);
CREATE TRIGGER major_works_scenarios_set_updated_at
  BEFORE UPDATE ON public.major_works_scenarios
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.major_works_scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.major_works_scenarios
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY major_works_scenarios_no_direct_access
  ON public.major_works_scenarios FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION public.major_works_scenario_save(
  p_society_id uuid,
  p_scenario_id uuid,
  p_project_id uuid,
  p_name text,
  p_amount_basis text,
  p_typed_amount_paise bigint,
  p_deduction_type text,
  p_deduction_paise bigint,
  p_fund_id uuid,
  p_split text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  scenario public.major_works_scenarios;
  clean_name text := btrim(p_name);
  saved_id uuid;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 80
    OR p_amount_basis NOT IN ('typed', 'estimate', 'budget')
    OR p_split NOT IN ('area', 'equal')
    OR p_deduction_type NOT IN ('none', 'typed', 'fund')
    OR p_client_request_id IS NULL
    OR (
      p_amount_basis = 'typed'
      AND p_typed_amount_paise NOT BETWEEN 0 AND 9007199254740991
    )
    OR (p_amount_basis <> 'typed' AND p_typed_amount_paise IS NOT NULL)
    OR (
      p_deduction_type = 'typed'
      AND p_deduction_paise NOT BETWEEN 0 AND 9007199254740991
    )
    OR (p_deduction_type <> 'typed' AND p_deduction_paise IS NOT NULL)
    OR (p_deduction_type = 'fund') <> (p_fund_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Check the what-if amount, deduction and split.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.major_works_projects
    WHERE society_id = p_society_id AND id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Repair project not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_fund_id IS NOT NULL AND (
    NOT private.module_enabled(p_society_id, 'expense')
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_funds
      WHERE society_id = p_society_id AND id = p_fund_id AND active
    )
  ) THEN
    RAISE EXCEPTION 'Choose an active fund for the what-if deduction.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO scenario FROM public.major_works_scenarios
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF scenario.id IS DISTINCT FROM p_scenario_id
      OR scenario.name IS DISTINCT FROM clean_name
      OR scenario.amount_basis IS DISTINCT FROM p_amount_basis
      OR scenario.typed_amount_paise IS DISTINCT FROM p_typed_amount_paise
      OR scenario.deduction_type IS DISTINCT FROM p_deduction_type
      OR scenario.deduction_paise IS DISTINCT FROM p_deduction_paise
      OR scenario.fund_id IS DISTINCT FROM p_fund_id
      OR scenario.split IS DISTINCT FROM p_split
    THEN
      RAISE EXCEPTION 'That retry key belongs to another what-if scenario.'
        USING ERRCODE = '23505';
    END IF;
    RETURN scenario.id;
  END IF;
  IF p_scenario_id IS NULL THEN
    INSERT INTO public.major_works_scenarios (
      society_id, project_id, name, amount_basis, typed_amount_paise,
      deduction_type, deduction_paise, fund_id, split,
      client_request_id, created_by
    ) VALUES (
      p_society_id, p_project_id, clean_name, p_amount_basis,
      p_typed_amount_paise, p_deduction_type, p_deduction_paise,
      p_fund_id, p_split, p_client_request_id, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO scenario FROM public.major_works_scenarios
    WHERE society_id = p_society_id AND id = p_scenario_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'What-if scenario not found.' USING ERRCODE = 'P0002';
    END IF;
    IF scenario.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The what-if scenario changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.major_works_scenarios
    SET project_id = p_project_id,
        name = clean_name,
        amount_basis = p_amount_basis,
        typed_amount_paise = p_typed_amount_paise,
        deduction_type = p_deduction_type,
        deduction_paise = p_deduction_paise,
        fund_id = p_fund_id,
        split = p_split,
        version = scenario.version + 1
    WHERE society_id = p_society_id AND id = p_scenario_id;
    saved_id := p_scenario_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.scenario.save',
    'major_works_scenario', saved_id::text,
    CASE WHEN scenario.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', scenario.name, 'split', scenario.split
    ) END,
    jsonb_build_object(
      'name', clean_name, 'amount_basis', p_amount_basis,
      'deduction_type', p_deduction_type, 'split', p_split
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.major_works_scenarios_list(
  p_society_id uuid,
  p_project_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  expense_enabled boolean := private.module_enabled(p_society_id, 'expense');
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'expense_enabled', expense_enabled,
    'scenarios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', result.id,
        'project_id', result.project_id,
        'name', result.name,
        'amount_basis', result.amount_basis,
        'typed_amount_paise', result.typed_amount_paise,
        'deduction_type', result.deduction_type,
        'deduction_paise', result.deduction_paise,
        'fund_id', result.fund_id,
        'split', result.split,
        'amount_paise', result.amount_paise,
        'complete', result.complete,
        'rounding_difference_paise',
          CASE WHEN result.complete THEN
            result.amount_paise - COALESCE((
              SELECT sum((share ->> 'amount_paise')::bigint)
              FROM jsonb_array_elements(result.shares) AS share
            ), 0)
          ELSE 0
        END,
        'missing_area_units', result.missing_area_units,
        'shares', result.shares,
        'updated_at', result.updated_at
      ) ORDER BY result.updated_at DESC)
      FROM (
        SELECT scenario.*,
          base.base_paise,
          GREATEST(
            0,
            round(
              (
                base.base_paise
                - CASE scenario.deduction_type
                    WHEN 'typed' THEN scenario.deduction_paise
                    WHEN 'fund' THEN CASE WHEN expense_enabled
                      THEN COALESCE(private.expense_fund_balance(
                        p_society_id, scenario.fund_id,
                        private.housekeeping_local_date(p_society_id)
                      ), 0)
                      ELSE 0
                    END
                    ELSE 0
                  END
              )::numeric / 100
            )::bigint * 100
          ) AS amount_paise,
          (
            scenario.split = 'equal'
            OR NOT EXISTS (
              SELECT 1 FROM public.units AS unit
              WHERE unit.society_id = p_society_id
                AND unit.active
                AND unit.area_sqft IS NULL
            )
          ) AS complete,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'unit_id', unit.id, 'unit_number', unit.number
            ) ORDER BY unit.number)
            FROM public.units AS unit
            WHERE scenario.split = 'area'
              AND unit.society_id = p_society_id
              AND unit.active
              AND unit.area_sqft IS NULL
          ), '[]'::jsonb) AS missing_area_units,
          CASE WHEN (
            scenario.split = 'equal'
            OR NOT EXISTS (
              SELECT 1 FROM public.units AS unit
              WHERE unit.society_id = p_society_id
                AND unit.active
                AND unit.area_sqft IS NULL
            )
          ) THEN COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'unit_id', share.unit_id,
              'unit_number', share.unit_number,
              'area_sqft', share.area_sqft,
              'amount_paise', share.amount_paise
            ) ORDER BY share.unit_number)
            FROM (
              SELECT unit.id AS unit_id, unit.number AS unit_number,
                unit.area_sqft,
                round(
                  (
                    GREATEST(
                      0,
                      round((
                        base.base_paise - CASE scenario.deduction_type
                          WHEN 'typed' THEN scenario.deduction_paise
                          WHEN 'fund' THEN CASE WHEN expense_enabled
                            THEN COALESCE(private.expense_fund_balance(
                              p_society_id, scenario.fund_id,
                              private.housekeeping_local_date(p_society_id)
                            ), 0)
                            ELSE 0
                          END
                          ELSE 0
                        END
                      )::numeric / 100)::bigint * 100
                    ) *
                    CASE WHEN scenario.split = 'equal'
                      THEN 1::numeric
                      ELSE unit.area_sqft / total.area_sqft
                    END
                    / NULLIF(CASE WHEN scenario.split = 'equal'
                      THEN total.unit_count ELSE 1
                    END, 0)
                  ) / 100
                )::bigint * 100 AS amount_paise
              FROM public.units AS unit
              CROSS JOIN LATERAL (
                SELECT count(*) AS unit_count,
                  COALESCE(sum(unit_area.area_sqft), 0) AS area_sqft
                FROM public.units AS unit_area
                WHERE unit_area.society_id = p_society_id
                  AND unit_area.active
              ) AS total
              WHERE unit.society_id = p_society_id
                AND unit.active
            ) AS share
          ), '[]'::jsonb) ELSE '[]'::jsonb END AS shares
        FROM public.major_works_scenarios AS scenario
        JOIN public.major_works_projects AS project
          ON project.society_id = scenario.society_id
          AND project.id = scenario.project_id
        CROSS JOIN LATERAL (
          SELECT CASE scenario.amount_basis
            WHEN 'typed' THEN scenario.typed_amount_paise
            WHEN 'estimate' THEN project.estimate_paise
            ELSE CASE WHEN project.budget_source = 'typed'
              THEN project.typed_budget_paise
              ELSE project.linked_budget_paise
            END
          END::bigint AS base_paise
        ) AS base
        WHERE scenario.society_id = p_society_id
          AND scenario.project_id = p_project_id
      ) AS result
    ), '[]'::jsonb),
    'funds', CASE WHEN expense_enabled THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fund.id,
        'name', fund.name,
        'balance_paise', private.expense_fund_balance(
          p_society_id, fund.id,
          private.housekeeping_local_date(p_society_id)
        )
      ) ORDER BY lower(fund.name))
      FROM public.expense_funds AS fund
      WHERE fund.society_id = p_society_id AND fund.active
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'project', (
      SELECT jsonb_build_object(
        'id', project.id,
        'title', project.title,
        'estimate_paise', project.estimate_paise,
        'budget_paise', CASE WHEN project.budget_source = 'typed'
          THEN project.typed_budget_paise ELSE project.linked_budget_paise END
      )
      FROM public.major_works_projects AS project
      WHERE project.society_id = p_society_id AND project.id = p_project_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_scenario_save(
  uuid, uuid, uuid, text, text, bigint, text, bigint, uuid, text,
  timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_scenarios_list(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.major_works_scenario_save(
  uuid, uuid, uuid, text, text, bigint, text, bigint, uuid, text,
  timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_scenarios_list(uuid, uuid)
  TO authenticated;

CREATE TABLE public.major_works_proposals (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  developer_name text NOT NULL
    CHECK (
      developer_name = btrim(developer_name)
      AND char_length(developer_name) BETWEEN 1 AND 120
    ),
  received_on date NOT NULL,
  stage text NOT NULL DEFAULT 'received' CHECK (
    stage IN (
      'received', 'under_review', 'shortlisted', 'selected', 'rejected',
      'withdrawn'
    )
  ),
  stage_reason text CHECK (
    stage_reason IS NULL OR char_length(stage_reason) BETWEEN 5 AND 500
  ),
  decision_due_on date,
  extra_area_bp integer
    CHECK (extra_area_bp IS NULL OR extra_area_bp BETWEEN 0 AND 10000),
  monthly_rent_paise bigint
    CHECK (
      monthly_rent_paise IS NULL
      OR monthly_rent_paise BETWEEN 0 AND 9007199254740991
    ),
  corpus_paise bigint
    CHECK (
      corpus_paise IS NULL OR corpus_paise BETWEEN 0 AND 9007199254740991
    ),
  timeline_months integer CHECK (
    timeline_months IS NULL OR timeline_months BETWEEN 1 AND 600
  ),
  bank_guarantee_paise bigint
    CHECK (
      bank_guarantee_paise IS NULL
      OR bank_guarantee_paise BETWEEN 0 AND 9007199254740991
    ),
  other_terms text CHECK (other_terms IS NULL OR char_length(other_terms) <= 1000),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  purge_at timestamptz,
  purged_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_proposals_stage_reason_state_check CHECK (
    (
      stage IN ('rejected', 'withdrawn') AND stage_reason IS NOT NULL
    )
    OR (
      stage NOT IN ('rejected', 'withdrawn') AND stage_reason IS NULL
    )
  ),
  CONSTRAINT major_works_proposals_archive_check CHECK (
    (archived_at IS NULL) = (archived_by IS NULL)
    AND (
      archived_at IS NULL
      OR stage IN ('selected', 'rejected', 'withdrawn')
    )
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_proposals_society_stage_idx
  ON public.major_works_proposals (society_id, stage, received_on DESC);
CREATE INDEX major_works_proposals_created_by_idx
  ON public.major_works_proposals (created_by);
CREATE INDEX major_works_proposals_archived_by_idx
  ON public.major_works_proposals (archived_by);
CREATE TRIGGER major_works_proposals_set_updated_at
  BEFORE UPDATE ON public.major_works_proposals
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

CREATE TABLE public.major_works_proposal_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'stage', 'archive')),
  previous_values jsonb,
  after_values jsonb NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  CONSTRAINT major_works_proposal_events_proposal_fkey
    FOREIGN KEY (society_id, proposal_id)
    REFERENCES public.major_works_proposals (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_proposal_events_proposal_idx
  ON public.major_works_proposal_events (
    society_id, proposal_id, created_at
  );
CREATE TRIGGER major_works_proposal_events_append_only
  BEFORE UPDATE OR DELETE ON public.major_works_proposal_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER major_works_proposal_events_no_truncate
  BEFORE TRUNCATE ON public.major_works_proposal_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TABLE public.major_works_proposal_files (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 500),
  content_type text NOT NULL
    CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  uploaded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_proposal_files_proposal_fkey
    FOREIGN KEY (society_id, proposal_id)
    REFERENCES public.major_works_proposals (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_proposal_files_proposal_idx
  ON public.major_works_proposal_files (society_id, proposal_id, created_at);

ALTER TABLE public.major_works_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_proposal_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.major_works_proposals,
  public.major_works_proposal_events,
  public.major_works_proposal_files
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY major_works_proposals_no_direct_access
  ON public.major_works_proposals FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_proposal_events_no_direct_access
  ON public.major_works_proposal_events FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_proposal_files_no_direct_access
  ON public.major_works_proposal_files FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.major_works_proposal_values(
  p_proposal public.major_works_proposals
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'developer_name', p_proposal.developer_name,
    'received_on', p_proposal.received_on,
    'stage', p_proposal.stage,
    'stage_reason', p_proposal.stage_reason,
    'decision_due_on', p_proposal.decision_due_on,
    'extra_area_bp', p_proposal.extra_area_bp,
    'monthly_rent_paise', p_proposal.monthly_rent_paise,
    'corpus_paise', p_proposal.corpus_paise,
    'timeline_months', p_proposal.timeline_months,
    'bank_guarantee_paise', p_proposal.bank_guarantee_paise,
    'other_terms', p_proposal.other_terms,
    'archived_at', p_proposal.archived_at,
    'purge_at', p_proposal.purge_at,
    'purged_at', p_proposal.purged_at,
    'version', p_proposal.version
  )
$$;
REVOKE ALL ON FUNCTION private.major_works_proposal_values(
  public.major_works_proposals
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.major_works_proposal_save(
  p_society_id uuid,
  p_proposal_id uuid,
  p_developer_name text,
  p_received_on date,
  p_decision_due_on date,
  p_extra_area_bp integer,
  p_monthly_rent_paise bigint,
  p_corpus_paise bigint,
  p_timeline_months integer,
  p_bank_guarantee_paise bigint,
  p_other_terms text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.major_works_proposals;
  retry public.major_works_proposal_events;
  clean_name text := btrim(p_developer_name);
  clean_terms text := NULLIF(btrim(p_other_terms), '');
  previous_values jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 120
    OR p_received_on IS NULL
    OR char_length(clean_terms) > 1000
    OR (p_extra_area_bp IS NOT NULL
      AND p_extra_area_bp NOT BETWEEN 0 AND 10000)
    OR (p_monthly_rent_paise IS NOT NULL
      AND p_monthly_rent_paise NOT BETWEEN 0 AND 9007199254740991)
    OR (p_corpus_paise IS NOT NULL
      AND p_corpus_paise NOT BETWEEN 0 AND 9007199254740991)
    OR (p_bank_guarantee_paise IS NOT NULL
      AND p_bank_guarantee_paise NOT BETWEEN 0 AND 9007199254740991)
    OR (p_timeline_months IS NOT NULL
      AND p_timeline_months NOT BETWEEN 1 AND 600)
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the redevelopment proposal details.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO retry FROM public.major_works_proposal_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.action NOT IN ('create', 'update')
      OR (retry.action = 'create' AND p_proposal_id IS NOT NULL)
      OR (
        retry.action = 'update'
        AND retry.proposal_id IS DISTINCT FROM p_proposal_id
      )
      OR retry.after_values ->> 'developer_name' IS DISTINCT FROM clean_name
      OR retry.after_values ->> 'received_on'
        IS DISTINCT FROM p_received_on::text
    THEN
      RAISE EXCEPTION 'That retry key belongs to another proposal action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN retry.proposal_id;
  END IF;
  IF p_proposal_id IS NULL THEN
    INSERT INTO public.major_works_proposals (
      society_id, developer_name, received_on, decision_due_on,
      extra_area_bp, monthly_rent_paise, corpus_paise, timeline_months,
      bank_guarantee_paise, other_terms, client_request_id, created_by
    ) VALUES (
      p_society_id, clean_name, p_received_on, p_decision_due_on,
      p_extra_area_bp, p_monthly_rent_paise, p_corpus_paise,
      p_timeline_months, p_bank_guarantee_paise, clean_terms,
      p_client_request_id, auth.uid()
    ) RETURNING * INTO proposal;
    INSERT INTO public.major_works_proposal_events (
      society_id, proposal_id, action, previous_values, after_values,
      actor_id, client_request_id
    ) VALUES (
      p_society_id, proposal.id, 'create', NULL,
      private.major_works_proposal_values(proposal),
      auth.uid(), p_client_request_id
    );
  ELSE
    SELECT * INTO proposal FROM public.major_works_proposals
    WHERE society_id = p_society_id AND id = p_proposal_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Redevelopment proposal not found.'
        USING ERRCODE = 'P0002';
    END IF;
    IF proposal.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The redevelopment proposal changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    IF proposal.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Archived proposals cannot be edited.'
        USING ERRCODE = '23514';
    END IF;
    previous_values := private.major_works_proposal_values(proposal);
    UPDATE public.major_works_proposals
    SET developer_name = clean_name,
        received_on = p_received_on,
        decision_due_on = p_decision_due_on,
        extra_area_bp = p_extra_area_bp,
        monthly_rent_paise = p_monthly_rent_paise,
        corpus_paise = p_corpus_paise,
        timeline_months = p_timeline_months,
        bank_guarantee_paise = p_bank_guarantee_paise,
        other_terms = clean_terms,
        version = proposal.version + 1
    WHERE society_id = p_society_id AND id = p_proposal_id
    RETURNING * INTO proposal;
    INSERT INTO public.major_works_proposal_events (
      society_id, proposal_id, action, previous_values, after_values,
      actor_id, client_request_id
    ) VALUES (
      p_society_id, p_proposal_id, 'update', previous_values,
      private.major_works_proposal_values(proposal),
      auth.uid(), p_client_request_id
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin',
    CASE WHEN p_proposal_id IS NULL THEN 'major_works.proposal.create'
      ELSE 'major_works.proposal.update' END,
    'major_works_proposal', proposal.id::text, previous_values,
    private.major_works_proposal_values(proposal), p_request_trace
  );
  RETURN proposal.id;
END;
$$;

CREATE FUNCTION public.major_works_proposal_stage_set(
  p_society_id uuid,
  p_proposal_id uuid,
  p_stage text,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.major_works_proposals;
  retry public.major_works_proposal_events;
  clean_reason text := NULLIF(btrim(p_reason), '');
  previous_values jsonb;
  allowed boolean;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO retry FROM public.major_works_proposal_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.action <> 'stage'
      OR retry.proposal_id <> p_proposal_id
      OR retry.after_values ->> 'stage' IS DISTINCT FROM p_stage
    THEN
      RAISE EXCEPTION 'That retry key belongs to another proposal stage.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_proposal_id;
  END IF;
  SELECT * INTO proposal FROM public.major_works_proposals
  WHERE society_id = p_society_id AND id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redevelopment proposal not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF proposal.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The redevelopment proposal changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF proposal.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived proposals cannot change stage.'
      USING ERRCODE = '23514';
  END IF;
  allowed := (
    (proposal.stage = 'received' AND p_stage = 'under_review')
    OR (proposal.stage = 'under_review' AND p_stage = 'shortlisted')
    OR (proposal.stage = 'shortlisted' AND p_stage = 'selected')
    OR (
      proposal.stage IN ('received', 'under_review', 'shortlisted')
      AND p_stage IN ('rejected', 'withdrawn')
    )
  );
  IF NOT allowed THEN
    RAISE EXCEPTION 'That proposal stage change is not allowed.'
      USING ERRCODE = '23514';
  END IF;
  IF p_stage IN ('rejected', 'withdrawn') THEN
    IF clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 5 AND 500 THEN
      RAISE EXCEPTION 'Give a reason for this proposal stage.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF clean_reason IS NOT NULL THEN
    RAISE EXCEPTION 'A reason is used only for rejected or withdrawn.'
      USING ERRCODE = '22023';
  END IF;
  previous_values := private.major_works_proposal_values(proposal);
  UPDATE public.major_works_proposals
  SET stage = p_stage,
      stage_reason = clean_reason,
      version = proposal.version + 1
  WHERE society_id = p_society_id AND id = p_proposal_id
  RETURNING * INTO proposal;
  INSERT INTO public.major_works_proposal_events (
    society_id, proposal_id, action, previous_values, after_values,
    actor_id, client_request_id
  ) VALUES (
    p_society_id, p_proposal_id, 'stage', previous_values,
    private.major_works_proposal_values(proposal),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.proposal.stage',
    'major_works_proposal', p_proposal_id::text, previous_values,
    private.major_works_proposal_values(proposal), p_request_trace
  );
  RETURN p_proposal_id;
END;
$$;

CREATE FUNCTION public.major_works_proposal_file_add(
  p_society_id uuid,
  p_proposal_id uuid,
  p_path text,
  p_content_type text,
  p_size_bytes integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing public.major_works_proposal_files;
  proposal public.major_works_proposals;
  saved_id uuid;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO existing FROM public.major_works_proposal_files
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF existing.proposal_id <> p_proposal_id OR existing.path <> p_path THEN
      RAISE EXCEPTION 'That retry key belongs to another proposal file.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;
  SELECT * INTO proposal FROM public.major_works_proposals
  WHERE society_id = p_society_id AND id = p_proposal_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or archived.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.major_works_proposal_files (
    society_id, proposal_id, path, content_type, size_bytes,
    client_request_id, uploaded_by
  ) VALUES (
    p_society_id, p_proposal_id, p_path, p_content_type, p_size_bytes,
    p_client_request_id, auth.uid()
  ) RETURNING id INTO saved_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.proposal.file_add',
    'major_works_proposal', p_proposal_id::text, NULL,
    jsonb_build_object('file_id', saved_id, 'content_type', p_content_type),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.major_works_proposals_list(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'proposals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', proposal.id,
        'developer_name', proposal.developer_name,
        'received_on', proposal.received_on,
        'stage', proposal.stage,
        'stage_reason', proposal.stage_reason,
        'decision_due_on', proposal.decision_due_on,
        'extra_area_bp', proposal.extra_area_bp,
        'monthly_rent_paise', proposal.monthly_rent_paise,
        'corpus_paise', proposal.corpus_paise,
        'timeline_months', proposal.timeline_months,
        'bank_guarantee_paise', proposal.bank_guarantee_paise,
        'other_terms', proposal.other_terms,
        'archived_at', proposal.archived_at,
        'updated_at', proposal.updated_at,
        'files', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', file.id,
            'path', file.path,
            'content_type', file.content_type,
            'size_bytes', file.size_bytes,
            'created_at', file.created_at
          ) ORDER BY file.created_at DESC)
          FROM public.major_works_proposal_files AS file
          WHERE file.society_id = proposal.society_id
            AND file.proposal_id = proposal.id
        ), '[]'::jsonb)
      ) ORDER BY proposal.received_on DESC, proposal.created_at DESC)
      FROM public.major_works_proposals AS proposal
      WHERE proposal.society_id = p_society_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_proposal_save(
  uuid, uuid, text, date, date, integer, bigint, bigint, integer, bigint, text,
  timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_proposal_stage_set(
  uuid, uuid, text, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_proposal_file_add(
  uuid, uuid, text, text, integer, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_proposals_list(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.major_works_proposal_save(
  uuid, uuid, text, date, date, integer, bigint, bigint, integer, bigint, text,
  timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_proposal_stage_set(
  uuid, uuid, text, text, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_proposal_file_add(
  uuid, uuid, text, text, integer, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_proposals_list(uuid)
  TO authenticated;

CREATE TABLE public.major_works_consent_confirmations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('poll', 'admin_recorded')),
  confirmation_text_version integer NOT NULL CHECK (
    confirmation_text_version BETWEEN 1 AND 999
  ),
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  confirmed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_consent_confirmations_society_idx
  ON public.major_works_consent_confirmations (society_id, confirmed_at DESC);
CREATE TRIGGER major_works_consent_confirmations_append_only
  BEFORE UPDATE OR DELETE ON public.major_works_consent_confirmations
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TABLE public.major_works_consents (
  society_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consents', 'does_not_consent')),
  method text CHECK (method IS NULL OR method IN ('poll', 'admin')),
  recorded_on date,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  signed_form_path text
    CHECK (signed_form_path IS NULL OR char_length(signed_form_path) <= 500),
  source_poll_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT major_works_consents_pkey
    PRIMARY KEY (society_id, proposal_id, unit_id),
  CONSTRAINT major_works_consents_proposal_fkey
    FOREIGN KEY (society_id, proposal_id)
    REFERENCES public.major_works_proposals (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_consents_unit_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT major_works_consents_poll_fkey
    FOREIGN KEY (society_id, source_poll_id)
    REFERENCES public.poll_votes (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT major_works_consents_state_check CHECK (
    (
      status = 'pending'
      AND method IS NULL
      AND recorded_on IS NULL
      AND recorded_by IS NULL
      AND signed_form_path IS NULL
      AND source_poll_id IS NULL
    )
    OR (
      status <> 'pending'
      AND method IS NOT NULL
      AND recorded_on IS NOT NULL
      AND recorded_by IS NULL
      AND signed_form_path IS NULL
      AND source_poll_id IS NOT NULL
    )
    OR (
      status <> 'pending'
      AND method = 'admin'
      AND recorded_on IS NOT NULL
      AND recorded_by IS NOT NULL
      AND source_poll_id IS NULL
    )
  )
);
CREATE INDEX major_works_consents_unit_idx
  ON public.major_works_consents (society_id, unit_id);
CREATE INDEX major_works_consents_poll_idx
  ON public.major_works_consents (society_id, source_poll_id);
CREATE TRIGGER major_works_consents_set_updated_at
  BEFORE UPDATE ON public.major_works_consents
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.major_works_consent_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  previous_values jsonb,
  after_values jsonb NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid,
  CONSTRAINT major_works_consent_events_consent_fkey
    FOREIGN KEY (society_id, proposal_id, unit_id)
    REFERENCES public.major_works_consents (society_id, proposal_id, unit_id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_consent_events_consent_idx
  ON public.major_works_consent_events (
    society_id, proposal_id, unit_id, created_at
  );
CREATE TRIGGER major_works_consent_events_append_only
  BEFORE UPDATE OR DELETE ON public.major_works_consent_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE TABLE public.major_works_consent_polls (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  CONSTRAINT major_works_consent_polls_proposal_fkey
    FOREIGN KEY (society_id, proposal_id)
    REFERENCES public.major_works_proposals (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT major_works_consent_polls_poll_fkey
    FOREIGN KEY (society_id, poll_id)
    REFERENCES public.poll_votes (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, poll_id),
  UNIQUE (society_id, proposal_id),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_consent_polls_poll_idx
  ON public.major_works_consent_polls (society_id, poll_id);

CREATE TABLE public.major_works_milestones (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  title text NOT NULL
    CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 120),
  planned_on date,
  actual_on date,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'done', 'not_needed')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 100),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT major_works_milestones_proposal_fkey
    FOREIGN KEY (society_id, proposal_id)
    REFERENCES public.major_works_proposals (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, proposal_id, position),
  UNIQUE (society_id, client_request_id)
);
CREATE INDEX major_works_milestones_proposal_idx
  ON public.major_works_milestones (society_id, proposal_id, position);
CREATE TRIGGER major_works_milestones_set_updated_at
  BEFORE UPDATE ON public.major_works_milestones
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.major_works_consent_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_consent_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_works_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.major_works_consent_confirmations,
  public.major_works_consents,
  public.major_works_consent_events,
  public.major_works_consent_polls,
  public.major_works_milestones
FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY major_works_consent_confirmations_no_direct_access
  ON public.major_works_consent_confirmations FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_consents_no_direct_access
  ON public.major_works_consents FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_consent_events_no_direct_access
  ON public.major_works_consent_events FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_consent_polls_no_direct_access
  ON public.major_works_consent_polls FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY major_works_milestones_no_direct_access
  ON public.major_works_milestones FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE FUNCTION private.major_works_consents_sync(p_society_id uuid, p_proposal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  added integer;
BEGIN
  INSERT INTO public.major_works_consents (
    society_id, proposal_id, unit_id
  )
  SELECT DISTINCT p_society_id, p_proposal_id, unit.id
  FROM public.units AS unit
  WHERE unit.society_id = p_society_id AND unit.active
    AND EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = p_society_id
        AND occupant.unit_id = unit.id
        AND occupant.relationship = 'owner'
        AND occupant.status = 'active'
    )
  ON CONFLICT (society_id, proposal_id, unit_id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_consents_sync(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.major_works_proposal_consents_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.stage IN ('under_review', 'shortlisted', 'selected')
    AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage)
  THEN
    PERFORM private.major_works_consents_sync(NEW.society_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_proposal_consents_trigger()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER major_works_proposals_consents
  AFTER INSERT OR UPDATE OF stage ON public.major_works_proposals
  FOR EACH ROW EXECUTE FUNCTION private.major_works_proposal_consents_trigger();

CREATE FUNCTION public.major_works_consent_method_set(
  p_society_id uuid,
  p_method text,
  p_confirmed boolean,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.module_configs;
  previous jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_method NOT IN ('poll', 'admin_recorded') OR p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Choose a valid consent method.' USING ERRCODE = '22023';
  END IF;
  IF p_method = 'poll' AND p_confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'Confirm the poll consent method first.'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO config FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'major_works' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Major works is unavailable.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.major_works_consent_confirmations
    WHERE society_id = p_society_id
      AND method = p_method
      AND client_request_id = p_client_request_id
  ) THEN
    RETURN jsonb_build_object('method', p_method, 'confirmed', true);
  END IF;
  previous := config.settings;
  UPDATE public.module_configs
  SET settings = jsonb_set(settings, '{consent_method}', to_jsonb(p_method)),
      updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'major_works';
  IF p_method = 'poll' THEN
    INSERT INTO public.major_works_consent_confirmations (
      society_id, method, confirmation_text_version,
      confirmed_by, client_request_id
    ) VALUES (
      p_society_id, 'poll', 1, auth.uid(), p_client_request_id
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.consent_method',
    'major_works_settings', p_society_id::text,
    jsonb_build_object('settings', previous),
    jsonb_build_object('method', p_method, 'confirmed', p_confirmed),
    p_request_trace
  );
  RETURN jsonb_build_object('method', p_method, 'confirmed', p_confirmed);
END;
$$;

CREATE FUNCTION public.major_works_consent_record(
  p_society_id uuid,
  p_proposal_id uuid,
  p_unit_id uuid,
  p_status text,
  p_signed_form_path text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  consent public.major_works_consents;
  before_values jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF p_status NOT IN ('consents', 'does_not_consent') THEN
    RAISE EXCEPTION 'Choose a consent response.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.major_works_consents_sync(p_society_id, p_proposal_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.unit_occupants
    WHERE society_id = p_society_id
      AND unit_id = p_unit_id
      AND relationship = 'owner'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose a unit with an active owner.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO consent FROM public.major_works_consents
  WHERE society_id = p_society_id
    AND proposal_id = p_proposal_id
    AND unit_id = p_unit_id
  FOR UPDATE;
  IF consent.method = 'admin'
    AND consent.status = p_status
    AND consent.signed_form_path IS NOT DISTINCT FROM p_signed_form_path
  THEN
    RETURN p_unit_id;
  END IF;
  IF consent.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'The consent record changed. Refresh before saving.'
      USING ERRCODE = '40001';
  END IF;
  before_values := jsonb_build_object(
    'status', consent.status, 'method', consent.method,
    'signed_form_path', consent.signed_form_path,
    'version', consent.version
  );
  UPDATE public.major_works_consents
  SET status = p_status,
      method = 'admin',
      recorded_on = private.housekeeping_local_date(p_society_id),
      recorded_by = auth.uid(),
      signed_form_path = p_signed_form_path,
      source_poll_id = NULL,
      version = consent.version + 1
  WHERE society_id = p_society_id
    AND proposal_id = p_proposal_id
    AND unit_id = p_unit_id;
  INSERT INTO public.major_works_consent_events (
    society_id, proposal_id, unit_id, previous_values, after_values,
    actor_id, client_request_id
  ) VALUES (
    p_society_id, p_proposal_id, p_unit_id, before_values,
    jsonb_build_object(
      'status', p_status, 'method', 'admin',
      'signed_form_path', p_signed_form_path
    ),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.consent.record',
    'major_works_consent', p_proposal_id::text || ':' || p_unit_id::text,
    before_values,
    jsonb_build_object('status', p_status, 'method', 'admin'),
    p_request_trace
  );
  RETURN p_unit_id;
END;
$$;

CREATE FUNCTION public.major_works_consent_poll_create(
  p_society_id uuid,
  p_proposal_id uuid,
  p_confirmed boolean,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.major_works_proposals;
  existing public.major_works_consent_polls;
  draft jsonb;
  vote_id uuid;
  revision integer;
  configured_method text;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF NOT private.module_enabled(p_society_id, 'poll') THEN
    RAISE EXCEPTION 'Polls must be enabled for in-app consent.'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO existing FROM public.major_works_consent_polls
  WHERE society_id = p_society_id AND proposal_id = p_proposal_id;
  IF FOUND THEN
    IF existing.client_request_id = p_client_request_id THEN
      RETURN existing.poll_id;
    END IF;
    RAISE EXCEPTION 'A consent poll already exists.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO proposal FROM public.major_works_proposals
  WHERE society_id = p_society_id AND id = p_proposal_id
    AND archived_at IS NULL
    AND stage IN ('under_review', 'shortlisted', 'selected');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active reviewed proposal.'
      USING ERRCODE = '23514';
  END IF;
  SELECT settings ->> 'consent_method' INTO configured_method
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'major_works';
  IF configured_method IS DISTINCT FROM 'poll' THEN
    RAISE EXCEPTION 'Switch the consent method to poll first.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.major_works_consent_confirmations
    WHERE society_id = p_society_id AND method = 'poll'
  ) THEN
    IF p_confirmed IS NOT TRUE THEN
      RAISE EXCEPTION 'Confirm responsibility for the consent poll.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.major_works_consent_confirmations (
      society_id, method, confirmation_text_version,
      confirmed_by, client_request_id
    ) VALUES (
      p_society_id, 'poll', 1, auth.uid(), p_client_request_id
    );
  END IF;
  PERFORM private.major_works_consents_sync(p_society_id, p_proposal_id);
  draft := public.poll_draft_create(
    p_society_id, 'major-works-consent-' || p_proposal_id::text, 'public'
  );
  vote_id := (draft ->> 'voteId')::uuid;
  revision := (draft ->> 'revision')::integer;
  PERFORM public.poll_draft_save(
    p_society_id,
    vote_id,
    revision,
    jsonb_build_object(
      'title', 'Redevelopment consent: ' || proposal.developer_name,
      'instructions',
        'Choose one owner response. Homeish does not determine any legal threshold.',
      'opensAt', NULL,
      'closesAt', NULL,
      'selectionMode', 'single',
      'selectionLimit', 1,
      'tenantVotingOverride', false,
      'blockIds', '[]'::jsonb,
      'options', jsonb_build_array(
        jsonb_build_object('label', 'I consent'),
        jsonb_build_object('label', 'I do not consent')
      ),
      'offices', '[]'::jsonb
    )
  );
  INSERT INTO public.major_works_consent_polls (
    society_id, proposal_id, poll_id, created_by, client_request_id
  ) VALUES (
    p_society_id, p_proposal_id, vote_id, auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.consent_poll.create',
    'major_works_consent_poll', vote_id::text, NULL,
    jsonb_build_object('proposal_id', p_proposal_id, 'poll_id', vote_id),
    p_request_trace
  );
  RETURN vote_id;
END;
$$;

CREATE FUNCTION private.major_works_consent_poll_apply(p_poll_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  link public.major_works_consent_polls;
  vote public.poll_votes;
  configured_method text;
  applied integer := 0;
  response record;
  consent public.major_works_consents;
BEGIN
  SELECT * INTO vote FROM public.poll_votes WHERE id = p_poll_id;
  IF NOT FOUND OR vote.status <> 'completed' THEN
    RETURN 0;
  END IF;
  SELECT * INTO link FROM public.major_works_consent_polls
  WHERE society_id = vote.society_id AND poll_id = vote.id FOR UPDATE;
  IF NOT FOUND OR link.applied_at IS NOT NULL THEN
    RETURN 0;
  END IF;
  SELECT settings ->> 'consent_method' INTO configured_method
  FROM public.module_configs
  WHERE society_id = vote.society_id AND module_key = 'major_works';
  IF configured_method = 'poll' THEN
    FOR response IN
      SELECT public_response.unit_id, option.label
      FROM public.poll_public_responses AS public_response
      JOIN public.poll_options AS option
        ON option.society_id = public_response.society_id
        AND option.vote_id = public_response.vote_id
        AND option.id = public_response.option_id
      WHERE public_response.society_id = vote.society_id
        AND public_response.vote_id = vote.id
    LOOP
      SELECT * INTO consent FROM public.major_works_consents
      WHERE society_id = vote.society_id
        AND proposal_id = link.proposal_id
        AND unit_id = response.unit_id
      FOR UPDATE;
      IF FOUND AND consent.method IS DISTINCT FROM 'admin' THEN
        UPDATE public.major_works_consents
        SET status = CASE response.label
            WHEN 'I consent' THEN 'consents'
            ELSE 'does_not_consent'
          END,
          method = 'poll',
          recorded_on = private.housekeeping_local_date(vote.society_id),
          recorded_by = NULL,
          signed_form_path = NULL,
          source_poll_id = vote.id,
          version = version + 1
        WHERE society_id = vote.society_id
          AND proposal_id = link.proposal_id
          AND unit_id = response.unit_id;
        INSERT INTO public.major_works_consent_events (
          society_id, proposal_id, unit_id, previous_values, after_values,
          actor_id, client_request_id
        ) VALUES (
          vote.society_id, link.proposal_id, response.unit_id,
          jsonb_build_object('status', consent.status, 'method', consent.method),
          jsonb_build_object(
            'status', CASE response.label
              WHEN 'I consent' THEN 'consents' ELSE 'does_not_consent' END,
            'method', 'poll',
            'poll_id', vote.id
          ),
          NULL, NULL
        );
        applied := applied + 1;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.major_works_consent_polls
  SET applied_at = clock_timestamp()
  WHERE id = link.id;
  RETURN applied;
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_consent_poll_apply(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.major_works_poll_completed_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM private.major_works_consent_poll_apply(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_poll_completed_trigger()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER major_works_consent_poll_completed
  AFTER UPDATE OF status ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION private.major_works_poll_completed_trigger();

CREATE FUNCTION public.major_works_consents_get(
  p_society_id uuid,
  p_proposal_id uuid
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  configured_method text;
  link public.major_works_consent_polls;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  PERFORM private.major_works_consents_sync(p_society_id, p_proposal_id);
  SELECT settings ->> 'consent_method' INTO configured_method
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'major_works';
  SELECT * INTO link FROM public.major_works_consent_polls
  WHERE society_id = p_society_id AND proposal_id = p_proposal_id;
  RETURN jsonb_build_object(
    'method', COALESCE(configured_method, 'poll'),
    'poll_id', link.poll_id,
    'poll_applied_at', link.applied_at,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'unit_id', unit.id,
        'unit_number', unit.number,
        'status', consent.status,
        'method', consent.method,
        'recorded_on', consent.recorded_on,
        'version', consent.version,
        'has_signed_form', consent.signed_form_path IS NOT NULL,
        'signed_form_path', consent.signed_form_path
      ) ORDER BY unit.number)
      FROM public.major_works_consents AS consent
      JOIN public.units AS unit
        ON unit.society_id = consent.society_id
        AND unit.id = consent.unit_id
      WHERE consent.society_id = p_society_id
        AND consent.proposal_id = p_proposal_id
    ), '[]'::jsonb),
    'indicative_poll_answers', CASE
      WHEN configured_method = 'admin_recorded' AND link.poll_id IS NOT NULL THEN
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'unit_id', response.unit_id,
            'label', option.label
          ) ORDER BY response.unit_id)
          FROM public.poll_public_responses AS response
          JOIN public.poll_options AS option
            ON option.society_id = response.society_id
            AND option.vote_id = response.vote_id
            AND option.id = response.option_id
          WHERE response.society_id = p_society_id
            AND response.vote_id = link.poll_id
        ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

CREATE FUNCTION public.major_works_my_consents_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'resident');
  RETURN jsonb_build_object(
    'consents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'proposal_id', proposal.id,
        'developer_name', proposal.developer_name,
        'unit_id', consent.unit_id,
        'unit_number', unit.number,
        'status', consent.status,
        'method', consent.method
      ) ORDER BY proposal.received_on DESC, unit.number)
      FROM public.major_works_consents AS consent
      JOIN public.major_works_proposals AS proposal
        ON proposal.society_id = consent.society_id
        AND proposal.id = consent.proposal_id
      JOIN public.units AS unit
        ON unit.society_id = consent.society_id
        AND unit.id = consent.unit_id
      WHERE consent.society_id = p_society_id
        AND EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          JOIN public.memberships AS membership
            ON membership.society_id = occupant.society_id
            AND membership.id = occupant.membership_id
          WHERE occupant.society_id = consent.society_id
            AND occupant.unit_id = consent.unit_id
            AND occupant.relationship = 'owner'
            AND occupant.status = 'active'
            AND membership.user_id = auth.uid()
            AND membership.status = 'active'
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.major_works_milestone_save(
  p_society_id uuid,
  p_milestone_id uuid,
  p_proposal_id uuid,
  p_title text,
  p_planned_on date,
  p_actual_on date,
  p_status text,
  p_note text,
  p_position integer,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  milestone public.major_works_milestones;
  clean_title text := btrim(p_title);
  clean_note text := NULLIF(btrim(p_note), '');
  saved_id uuid;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  IF clean_title IS NULL OR char_length(clean_title) NOT BETWEEN 1 AND 120
    OR p_status NOT IN ('todo', 'done', 'not_needed')
    OR p_position NOT BETWEEN 1 AND 100
    OR char_length(clean_note) > 500
    OR p_client_request_id IS NULL
  THEN
    RAISE EXCEPTION 'Check the milestone details.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO milestone FROM public.major_works_milestones
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN milestone.id;
  END IF;
  IF p_milestone_id IS NULL THEN
    INSERT INTO public.major_works_milestones (
      society_id, proposal_id, title, planned_on, actual_on, status,
      note, position, client_request_id, created_by
    ) VALUES (
      p_society_id, p_proposal_id, clean_title, p_planned_on,
      p_actual_on, p_status, clean_note, p_position,
      p_client_request_id, auth.uid()
    ) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO milestone FROM public.major_works_milestones
    WHERE society_id = p_society_id AND id = p_milestone_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;
    IF milestone.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The milestone changed. Refresh before saving.'
        USING ERRCODE = '23505';
    END IF;
    UPDATE public.major_works_milestones
    SET proposal_id = p_proposal_id,
        title = clean_title,
        planned_on = p_planned_on,
        actual_on = p_actual_on,
        status = p_status,
        note = clean_note,
        position = p_position,
        version = milestone.version + 1
    WHERE society_id = p_society_id AND id = p_milestone_id;
    saved_id := p_milestone_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.milestone.save',
    'major_works_milestone', saved_id::text, NULL,
    jsonb_build_object(
      'proposal_id', p_proposal_id, 'title', clean_title,
      'status', p_status, 'position', p_position
    ),
    p_request_trace
  );
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.major_works_milestones_list(p_society_id uuid, p_proposal_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', milestone.id,
        'proposal_id', milestone.proposal_id,
        'title', milestone.title,
        'planned_on', milestone.planned_on,
        'actual_on', milestone.actual_on,
        'status', milestone.status,
        'note', milestone.note,
        'position', milestone.position,
        'updated_at', milestone.updated_at
      ) ORDER BY milestone.position)
      FROM public.major_works_milestones AS milestone
      WHERE milestone.society_id = p_society_id
        AND milestone.proposal_id = p_proposal_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_consent_method_set(
  uuid, text, boolean, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_consent_record(
  uuid, uuid, uuid, text, text, integer, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_consent_poll_create(
  uuid, uuid, boolean, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_consents_get(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_my_consents_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_milestone_save(
  uuid, uuid, uuid, text, date, date, text, text, integer,
  timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_milestones_list(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.major_works_consent_method_set(
  uuid, text, boolean, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_consent_record(
  uuid, uuid, uuid, text, text, integer, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_consent_poll_create(
  uuid, uuid, boolean, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_consents_get(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_my_consents_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_milestone_save(
  uuid, uuid, uuid, text, date, date, text, text, integer,
  timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_milestones_list(uuid, uuid)
  TO authenticated;

CREATE FUNCTION public.major_works_summary_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today date := private.housekeeping_local_date(p_society_id);
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'list');
  RETURN jsonb_build_object(
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', project.id,
        'title', project.title,
        'status', project.status,
        'progress_percent', project.progress_percent,
        'planned_end_on', project.planned_end_on,
        'budget_paise', CASE WHEN project.budget_source = 'typed'
          THEN project.typed_budget_paise
          ELSE project.linked_budget_paise
        END,
        'spend_paise', CASE
          WHEN NOT private.module_enabled(p_society_id, 'expense') THEN NULL
          WHEN project.budget_source = 'sanctioned_work' THEN COALESCE((
            SELECT sum(link.amount_paise)
            FROM public.expense_fund_work_links AS link
            JOIN public.expense_book_entries AS entry
              ON entry.society_id = link.society_id
              AND entry.id = link.entry_id
            WHERE link.society_id = p_society_id
              AND link.work_id = project.fund_work_id
              AND NOT EXISTS (
                SELECT 1 FROM public.expense_book_entries AS reversal
                WHERE reversal.society_id = entry.society_id
                  AND reversal.reverses_entry_id = entry.id
              )
          ), 0)
          ELSE COALESCE((
            SELECT sum(tag.amount_paise)
            FROM public.major_works_spend_tags AS tag
            JOIN public.expense_book_entries AS entry
              ON entry.society_id = tag.society_id
              AND entry.id = tag.entry_id
            WHERE tag.society_id = p_society_id
              AND tag.project_id = project.id
              AND tag.removed_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.expense_book_entries AS reversal
                WHERE reversal.society_id = entry.society_id
                  AND reversal.reverses_entry_id = entry.id
              )
          ), 0)
        END,
        'delayed', project.planned_end_on IS NOT NULL
          AND project.planned_end_on < today
          AND project.status NOT IN ('completed', 'cancelled')
      ) ORDER BY lower(project.title))
      FROM public.major_works_projects AS project
      WHERE project.society_id = p_society_id
        AND project.status NOT IN ('completed', 'cancelled')
    ), '[]'::jsonb),
    'overdue_audits', EXISTS (
      SELECT 1 FROM (
        SELECT audit.id, audit.next_due_on
        FROM public.major_works_audits AS audit
        WHERE audit.society_id = p_society_id
          AND audit.voided_at IS NULL
        ORDER BY audit.audit_on DESC, audit.created_at DESC
        LIMIT 1
      ) AS latest
      WHERE latest.next_due_on < today
    ),
    'proposals_by_stage', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'stage', stage.stage, 'count', stage.count
      ) ORDER BY CASE stage.stage
        WHEN 'received' THEN 1
        WHEN 'under_review' THEN 2
        WHEN 'shortlisted' THEN 3
        WHEN 'selected' THEN 4
        WHEN 'rejected' THEN 5
        ELSE 6
      END)
      FROM (
        SELECT proposal.stage, count(*)::integer AS count
        FROM public.major_works_proposals AS proposal
        WHERE proposal.society_id = p_society_id
          AND proposal.archived_at IS NULL
        GROUP BY proposal.stage
      ) AS stage
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.major_works_proposal_archive(
  p_society_id uuid,
  p_proposal_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.major_works_proposals;
  retry public.major_works_proposal_events;
  previous_values jsonb;
BEGIN
  PERFORM private.major_works_authorize(p_society_id, 'manage');
  PERFORM private.expense_check_trace(p_request_trace);
  SELECT * INTO retry FROM public.major_works_proposal_events
  WHERE society_id = p_society_id
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF retry.action <> 'archive' OR retry.proposal_id <> p_proposal_id THEN
      RAISE EXCEPTION 'That retry key belongs to another proposal action.'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_proposal_id;
  END IF;
  SELECT * INTO proposal FROM public.major_works_proposals
  WHERE society_id = p_society_id AND id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redevelopment proposal not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF proposal.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The redevelopment proposal changed. Refresh before saving.'
      USING ERRCODE = '23505';
  END IF;
  IF proposal.archived_at IS NOT NULL THEN
    RETURN p_proposal_id;
  END IF;
  IF proposal.stage NOT IN ('selected', 'rejected', 'withdrawn') THEN
    RAISE EXCEPTION 'Archive only selected, rejected or withdrawn proposals.'
      USING ERRCODE = '23514';
  END IF;
  previous_values := private.major_works_proposal_values(proposal);
  UPDATE public.major_works_proposals
  SET archived_at = clock_timestamp(),
      archived_by = auth.uid(),
      purge_at = clock_timestamp() + interval '8 years',
      version = proposal.version + 1
  WHERE society_id = p_society_id AND id = p_proposal_id
  RETURNING * INTO proposal;
  INSERT INTO public.major_works_proposal_events (
    society_id, proposal_id, action, previous_values, after_values,
    actor_id, client_request_id
  ) VALUES (
    p_society_id, p_proposal_id, 'archive', previous_values,
    private.major_works_proposal_values(proposal),
    auth.uid(), p_client_request_id
  );
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'major_works.proposal.archive',
    'major_works_proposal', p_proposal_id::text, previous_values,
    private.major_works_proposal_values(proposal), p_request_trace
  );
  RETURN p_proposal_id;
END;
$$;

CREATE FUNCTION public.major_works_retention_files(
  p_society_id uuid,
  p_today date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Major-works retention is restricted.'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'path', file.path,
      'proposal_id', file.proposal_id
    ) ORDER BY file.created_at)
    FROM public.major_works_proposal_files AS file
    JOIN public.major_works_proposals AS proposal
      ON proposal.society_id = file.society_id
      AND proposal.id = file.proposal_id
    WHERE file.society_id = p_society_id
      AND proposal.archived_at IS NOT NULL
      AND proposal.purged_at IS NULL
      AND proposal.purge_at <= p_today::timestamptz
  ), '[]'::jsonb) || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'path', consent.signed_form_path,
      'proposal_id', consent.proposal_id
    ))
    FROM public.major_works_consents AS consent
    JOIN public.major_works_proposals AS proposal
      ON proposal.society_id = consent.society_id
      AND proposal.id = consent.proposal_id
    WHERE consent.society_id = p_society_id
      AND consent.signed_form_path IS NOT NULL
      AND proposal.archived_at IS NOT NULL
      AND proposal.purged_at IS NULL
      AND proposal.purge_at <= p_today::timestamptz
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION private.major_works_consent_event_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_setting('major_works.retention_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Consent history is append-only.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.major_works_consent_event_guard()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER major_works_consent_events_append_only
  ON public.major_works_consent_events;
CREATE TRIGGER major_works_consent_events_append_only
  BEFORE UPDATE OR DELETE ON public.major_works_consent_events
  FOR EACH ROW EXECUTE FUNCTION private.major_works_consent_event_guard();

CREATE FUNCTION public.major_works_retention_run(
  p_society_id uuid,
  p_today date,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.major_works_proposals;
  files_count integer := 0;
  consents_count integer := 0;
  milestones_count integer := 0;
  proposals_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Major-works retention is restricted.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request id is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('major_works.retention_delete', 'on', true);
  FOR proposal IN
    SELECT * FROM public.major_works_proposals
    WHERE society_id = p_society_id
      AND archived_at IS NOT NULL
      AND purged_at IS NULL
      AND purge_at <= p_today::timestamptz
    FOR UPDATE
  LOOP
    SELECT count(*) INTO files_count
    FROM public.major_works_proposal_files
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    SELECT count(*) INTO consents_count
    FROM public.major_works_consents
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    SELECT count(*) INTO milestones_count
    FROM public.major_works_milestones
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    DELETE FROM public.major_works_consent_events
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    DELETE FROM public.major_works_consent_polls
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    DELETE FROM public.major_works_consents
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    DELETE FROM public.major_works_milestones
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    DELETE FROM public.major_works_proposal_files
    WHERE society_id = p_society_id AND proposal_id = proposal.id;
    UPDATE public.major_works_proposals
    SET purged_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = proposal.id;
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, NULL, 'system', 'major_works.retention.purge',
      'major_works_proposal', proposal.id::text, NULL,
      jsonb_build_object(
        'files', files_count, 'consents', consents_count,
        'milestones', milestones_count
      ),
      p_request_id
    );
    proposals_count := proposals_count + 1;
  END LOOP;
  RETURN jsonb_build_object('purged', proposals_count);
END;
$$;

REVOKE ALL ON FUNCTION public.major_works_summary_get(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_proposal_archive(
  uuid, uuid, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.major_works_retention_files(uuid, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.major_works_retention_run(uuid, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_summary_get(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_proposal_archive(
  uuid, uuid, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.major_works_retention_files(uuid, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.major_works_retention_run(uuid, date, text)
  TO service_role;
