-- Asset Register: society-defined categories, assets, manual maintenance history and a read-only AMC link.
CREATE TABLE public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT asset_categories_name_check
    CHECK (char_length(name) BETWEEN 1 AND 60 AND name = btrim(name)),
  CONSTRAINT asset_categories_version_check CHECK (version >= 1),
  CONSTRAINT asset_categories_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT asset_categories_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX asset_categories_name_key ON public.asset_categories (society_id, lower(name));
CREATE INDEX asset_categories_created_by_idx ON public.asset_categories (created_by);
CREATE INDEX asset_categories_updated_by_idx ON public.asset_categories (updated_by);

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  make text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_cost_paise bigint,
  supplier text,
  warranty_end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  amc_contract_id uuid,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT assets_name_check CHECK (char_length(name) BETWEEN 1 AND 120 AND name = btrim(name)),
  CONSTRAINT assets_location_check
    CHECK (char_length(location) BETWEEN 1 AND 120 AND location = btrim(location)),
  CONSTRAINT assets_make_check
    CHECK (make IS NULL OR (char_length(make) BETWEEN 1 AND 80 AND make = btrim(make))),
  CONSTRAINT assets_model_check
    CHECK (model IS NULL OR (char_length(model) BETWEEN 1 AND 80 AND model = btrim(model))),
  CONSTRAINT assets_serial_number_check CHECK (serial_number IS NULL OR (
    char_length(serial_number) BETWEEN 1 AND 80 AND serial_number = btrim(serial_number)
  )),
  CONSTRAINT assets_supplier_check
    CHECK (supplier IS NULL OR (char_length(supplier) BETWEEN 1 AND 120 AND supplier = btrim(supplier))),
  CONSTRAINT assets_notes_check
    CHECK (notes IS NULL OR (char_length(notes) BETWEEN 1 AND 1000 AND notes = btrim(notes))),
  CONSTRAINT assets_purchase_cost_check
    CHECK (purchase_cost_paise IS NULL OR purchase_cost_paise BETWEEN 0 AND 999999999999999),
  CONSTRAINT assets_dates_check CHECK (
    (purchase_date IS NULL OR purchase_date >= DATE '1900-01-01')
    AND (warranty_end_date IS NULL OR warranty_end_date BETWEEN DATE '1900-01-01' AND DATE '2200-12-31')
    AND (purchase_date IS NULL OR warranty_end_date IS NULL OR warranty_end_date >= purchase_date)
  ),
  CONSTRAINT assets_status_check CHECK (status IN ('active', 'under_repair', 'retired')),
  CONSTRAINT assets_version_check CHECK (version >= 1),
  CONSTRAINT assets_category_same_society_fkey FOREIGN KEY (society_id, category_id)
    REFERENCES public.asset_categories (society_id, id) ON DELETE RESTRICT,
  -- Read-only link to the AMC module; the AMC tables themselves are never changed here.
  CONSTRAINT assets_amc_contract_same_society_fkey FOREIGN KEY (society_id, amc_contract_id)
    REFERENCES public.amc_contracts (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT assets_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT assets_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX assets_category_idx ON public.assets (society_id, category_id);
CREATE INDEX assets_amc_contract_idx ON public.assets (society_id, amc_contract_id);
CREATE INDEX assets_status_idx ON public.assets (society_id, status, lower(name));
CREATE INDEX assets_created_by_idx ON public.assets (created_by);
CREATE INDEX assets_updated_by_idx ON public.assets (updated_by);

CREATE TABLE public.asset_maintenance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL,
  performed_on date NOT NULL,
  description text NOT NULL,
  cost_paise bigint,
  done_by text NOT NULL,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT asset_maintenance_entries_description_check
    CHECK (char_length(description) BETWEEN 1 AND 1000 AND description = btrim(description)),
  CONSTRAINT asset_maintenance_entries_done_by_check
    CHECK (char_length(done_by) BETWEEN 1 AND 120 AND done_by = btrim(done_by)),
  CONSTRAINT asset_maintenance_entries_cost_check
    CHECK (cost_paise IS NULL OR cost_paise BETWEEN 0 AND 999999999999999),
  CONSTRAINT asset_maintenance_entries_date_check CHECK (performed_on >= DATE '1900-01-01'),
  CONSTRAINT asset_maintenance_entries_removed_check
    CHECK ((removed_at IS NULL) = (removed_by IS NULL)),
  CONSTRAINT asset_maintenance_entries_asset_same_society_fkey FOREIGN KEY (society_id, asset_id)
    REFERENCES public.assets (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT asset_maintenance_entries_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT asset_maintenance_entries_actor_request_key
    UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX asset_maintenance_entries_asset_idx
  ON public.asset_maintenance_entries (society_id, asset_id, performed_on DESC);
CREATE INDEX asset_maintenance_entries_created_by_idx ON public.asset_maintenance_entries (created_by);
CREATE INDEX asset_maintenance_entries_removed_by_idx ON public.asset_maintenance_entries (removed_by);

-- Nothing in the register is ever deleted: assets retire, categories deactivate, entries are removed softly.
CREATE TRIGGER asset_categories_no_delete BEFORE DELETE ON public.asset_categories
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER assets_no_delete BEFORE DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER asset_maintenance_entries_no_delete BEFORE DELETE ON public.asset_maintenance_entries
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER asset_categories_no_truncate BEFORE TRUNCATE ON public.asset_categories
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER assets_no_truncate BEFORE TRUNCATE ON public.assets
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER asset_maintenance_entries_no_truncate BEFORE TRUNCATE ON public.asset_maintenance_entries
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asset_categories, public.assets, public.asset_maintenance_entries
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY asset_categories_no_direct_access ON public.asset_categories
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY assets_no_direct_access ON public.assets
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY asset_maintenance_entries_no_direct_access ON public.asset_maintenance_entries
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.asset_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'asset')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Asset Register access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.asset_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- Re-check after locking the society row so a concurrent module toggle or suspension wins.
CREATE FUNCTION private.asset_write_begin(p_society_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.asset_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.asset_authorize(p_society_id, ARRAY['admin']::text[], true);
END;
$$;
REVOKE ALL ON FUNCTION private.asset_write_begin(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.asset_audit(
  p_society_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_before jsonb, p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'asset.' || p_action, p_entity_type, p_entity_id::text,
    p_before, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.asset_audit(uuid, text, text, uuid, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.asset_today(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (clock_timestamp() AT TIME ZONE COALESCE(society.timezone, 'Asia/Kolkata'))::date
  FROM public.societies AS society WHERE society.id = p_society_id
$$;
REVOKE ALL ON FUNCTION private.asset_today(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.asset_clean_text(p_value text, p_max integer, p_label text, p_required boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  clean text := NULLIF(btrim(COALESCE(p_value, '')), '');
BEGIN
  IF (clean IS NULL AND p_required) OR char_length(clean) > p_max THEN
    RAISE EXCEPTION 'Enter % up to % characters.', p_label, p_max USING ERRCODE = '22023';
  END IF;
  RETURN clean;
END;
$$;
REVOKE ALL ON FUNCTION private.asset_clean_text(text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- The whole renewal chain of an AMC contract (predecessors and successors), so visits survive renewals.
CREATE FUNCTION private.asset_amc_chain(p_society_id uuid, p_contract_id uuid)
RETURNS TABLE (contract_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH RECURSIVE older AS (
    SELECT contract.id, contract.predecessor_id, 1 AS depth FROM public.amc_contracts AS contract
    WHERE contract.society_id = p_society_id AND contract.id = p_contract_id
    UNION ALL
    SELECT contract.id, contract.predecessor_id, older.depth + 1 FROM public.amc_contracts AS contract
    JOIN older ON contract.society_id = p_society_id AND contract.id = older.predecessor_id
    WHERE older.depth < 50
  ), newer AS (
    SELECT contract.id, 1 AS depth FROM public.amc_contracts AS contract
    WHERE contract.society_id = p_society_id AND contract.id = p_contract_id
    UNION ALL
    SELECT contract.id, newer.depth + 1 FROM public.amc_contracts AS contract
    JOIN newer ON contract.society_id = p_society_id AND contract.predecessor_id = newer.id
    WHERE newer.depth < 50
  )
  SELECT id FROM older UNION SELECT id FROM newer
$$;
REVOKE ALL ON FUNCTION private.asset_amc_chain(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.asset_category_save(
  p_society_id uuid, p_category_id uuid, p_name text, p_expected_version integer,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  category public.asset_categories;
  clean_name text;
BEGIN
  PERFORM private.asset_write_begin(p_society_id);
  clean_name := private.asset_clean_text(p_name, 60, 'a category name', true);
  IF p_category_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO category FROM public.asset_categories
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN category.id; END IF;
    -- Serialise category creation per society so the 200-category cap cannot be raced past.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('asset_categories:' || p_society_id::text, 0)
    );
    IF (SELECT count(*) FROM public.asset_categories WHERE society_id = p_society_id) >= 200 THEN
      RAISE EXCEPTION 'A society can have up to 200 asset categories. Rename or reuse one instead.'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.asset_categories
      WHERE society_id = p_society_id AND lower(name) = lower(clean_name)
    ) THEN
      RAISE EXCEPTION 'A category with this name already exists.' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.asset_categories (
      society_id, name, client_request_id, created_by, updated_by
    ) VALUES (p_society_id, clean_name, p_client_request_id, auth.uid(), auth.uid())
    ON CONFLICT ON CONSTRAINT asset_categories_actor_request_key DO NOTHING
    RETURNING * INTO category;
    IF NOT FOUND THEN
      SELECT * INTO category FROM public.asset_categories
        WHERE society_id = p_society_id AND created_by = auth.uid()
          AND client_request_id = p_client_request_id;
      RETURN category.id;
    END IF;
    PERFORM private.asset_audit(p_society_id, 'category.create', 'asset_category', category.id,
      NULL, jsonb_build_object('name', category.name), p_request_id);
    RETURN category.id;
  END IF;
  SELECT * INTO category FROM public.asset_categories
    WHERE society_id = p_society_id AND id = p_category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR category.version <> p_expected_version THEN
    RAISE EXCEPTION 'This category changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.asset_categories
    WHERE society_id = p_society_id AND lower(name) = lower(clean_name) AND id <> category.id
  ) THEN
    RAISE EXCEPTION 'A category with this name already exists.' USING ERRCODE = '23505';
  END IF;
  IF category.name = clean_name THEN RETURN category.id; END IF;
  UPDATE public.asset_categories
  SET name = clean_name, version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = category.id;
  PERFORM private.asset_audit(p_society_id, 'category.rename', 'asset_category', category.id,
    jsonb_build_object('name', category.name), jsonb_build_object('name', clean_name), p_request_id);
  RETURN category.id;
END;
$$;

CREATE FUNCTION public.asset_category_set_active(
  p_society_id uuid, p_category_id uuid, p_active boolean, p_expected_version integer,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  category public.asset_categories;
BEGIN
  PERFORM private.asset_write_begin(p_society_id);
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Choose active or inactive.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO category FROM public.asset_categories
    WHERE society_id = p_society_id AND id = p_category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR category.version <> p_expected_version THEN
    RAISE EXCEPTION 'This category changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF category.active = p_active THEN RETURN; END IF;
  UPDATE public.asset_categories
  SET active = p_active, version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = category.id;
  PERFORM private.asset_audit(p_society_id,
    CASE WHEN p_active THEN 'category.activate' ELSE 'category.deactivate' END,
    'asset_category', category.id, NULL,
    jsonb_build_object('name', category.name, 'active', p_active), p_request_id);
END;
$$;

CREATE FUNCTION public.asset_save(
  p_society_id uuid, p_asset_id uuid, p_category_id uuid, p_name text, p_location text,
  p_make text, p_model text, p_serial_number text, p_purchase_date date,
  p_purchase_cost_paise bigint, p_supplier text, p_warranty_end_date date, p_status text,
  p_notes text, p_amc_contract_id uuid, p_expected_amc_enabled boolean,
  p_expected_version integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  asset public.assets;
  previous public.assets;
  category public.asset_categories;
  clean_name text;
  clean_location text;
  clean_make text;
  clean_model text;
  clean_serial text;
  clean_supplier text;
  clean_notes text;
  next_contract uuid;
  amc_on boolean;
  audit_skip text[] := ARRAY['society_id', 'client_request_id', 'created_at', 'created_by',
    'updated_at', 'updated_by'];
BEGIN
  PERFORM private.asset_write_begin(p_society_id);
  amc_on := private.module_enabled(p_society_id, 'amc');
  -- The form was loaded under a different AMC state; saving could wrongly set or clear the link.
  IF p_expected_amc_enabled IS NULL OR p_expected_amc_enabled IS DISTINCT FROM amc_on THEN
    RAISE EXCEPTION 'Module settings changed. Reload the asset before saving.'
      USING ERRCODE = '40001';
  END IF;
  clean_name := private.asset_clean_text(p_name, 120, 'an asset name', true);
  clean_location := private.asset_clean_text(p_location, 120, 'a location', true);
  clean_make := private.asset_clean_text(p_make, 80, 'a make', false);
  clean_model := private.asset_clean_text(p_model, 80, 'a model', false);
  clean_serial := private.asset_clean_text(p_serial_number, 80, 'a serial number', false);
  clean_supplier := private.asset_clean_text(p_supplier, 120, 'a supplier', false);
  clean_notes := private.asset_clean_text(p_notes, 1000, 'notes', false);
  IF p_status IS NULL OR p_status NOT IN ('active', 'under_repair', 'retired') THEN
    RAISE EXCEPTION 'Choose active, under repair or retired.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_cost_paise IS NOT NULL AND p_purchase_cost_paise NOT BETWEEN 0 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a purchase cost of ₹0 or more.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_date IS NOT NULL AND (
    p_purchase_date < DATE '1900-01-01' OR p_purchase_date > private.asset_today(p_society_id)
  ) THEN
    RAISE EXCEPTION 'The purchase date cannot be in the future.' USING ERRCODE = '22023';
  END IF;
  IF p_warranty_end_date IS NOT NULL AND (
    p_warranty_end_date NOT BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'
    OR (p_purchase_date IS NOT NULL AND p_warranty_end_date < p_purchase_date)
  ) THEN
    RAISE EXCEPTION 'The warranty must end on or after the purchase date.' USING ERRCODE = '22023';
  END IF;

  IF p_asset_id IS NULL THEN
    IF p_client_request_id IS NULL OR p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO asset FROM public.assets
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN asset.id; END IF;
  ELSE
    SELECT * INTO previous FROM public.assets
      WHERE society_id = p_society_id AND id = p_asset_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
    IF p_expected_version IS NULL OR previous.version <> p_expected_version THEN
      RAISE EXCEPTION 'This asset changed. Refresh before trying again.' USING ERRCODE = '40001';
    END IF;
  END IF;

  SELECT * INTO category FROM public.asset_categories
    WHERE society_id = p_society_id AND id = p_category_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002'; END IF;
  -- An inactive category stays valid for assets already in it but cannot take new ones.
  IF NOT category.active AND previous.category_id IS DISTINCT FROM category.id THEN
    RAISE EXCEPTION 'This category is inactive. Choose another.' USING ERRCODE = '22023';
  END IF;

  -- While AMC is off the link is kept unchanged and cannot be set or changed.
  IF amc_on THEN
    next_contract := p_amc_contract_id;
    IF next_contract IS NOT NULL AND next_contract IS DISTINCT FROM previous.amc_contract_id THEN
      PERFORM 1 FROM public.amc_contracts WHERE society_id = p_society_id AND id = next_contract;
      IF NOT FOUND THEN RAISE EXCEPTION 'AMC contract not found.' USING ERRCODE = 'P0002'; END IF;
    END IF;
  ELSE
    IF p_amc_contract_id IS NOT NULL AND p_amc_contract_id IS DISTINCT FROM previous.amc_contract_id THEN
      RAISE EXCEPTION 'Turn on AMC Management to link a contract.' USING ERRCODE = '22023';
    END IF;
    next_contract := previous.amc_contract_id;
  END IF;

  IF p_asset_id IS NULL THEN
    INSERT INTO public.assets (
      society_id, category_id, name, location, make, model, serial_number, purchase_date,
      purchase_cost_paise, supplier, warranty_end_date, status, notes, amc_contract_id,
      client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, category.id, clean_name, clean_location, clean_make, clean_model, clean_serial,
      p_purchase_date, p_purchase_cost_paise, clean_supplier, p_warranty_end_date, p_status,
      clean_notes, next_contract, p_client_request_id, auth.uid(), auth.uid()
    )
    ON CONFLICT ON CONSTRAINT assets_actor_request_key DO NOTHING
    RETURNING * INTO asset;
    IF NOT FOUND THEN
      SELECT * INTO asset FROM public.assets
        WHERE society_id = p_society_id AND created_by = auth.uid()
          AND client_request_id = p_client_request_id;
      RETURN asset.id;
    END IF;
    PERFORM private.asset_audit(p_society_id, 'create', 'asset', asset.id, NULL,
      to_jsonb(asset) - audit_skip, p_request_id);
    RETURN asset.id;
  END IF;

  UPDATE public.assets
  SET category_id = category.id, name = clean_name, location = clean_location, make = clean_make,
    model = clean_model, serial_number = clean_serial, purchase_date = p_purchase_date,
    purchase_cost_paise = p_purchase_cost_paise, supplier = clean_supplier,
    warranty_end_date = p_warranty_end_date, status = p_status, notes = clean_notes,
    amc_contract_id = next_contract, version = version + 1, updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE id = previous.id RETURNING * INTO asset;
  PERFORM private.asset_audit(p_society_id, 'update', 'asset', asset.id,
    to_jsonb(previous) - audit_skip, to_jsonb(asset) - audit_skip, p_request_id);
  RETURN asset.id;
END;
$$;

CREATE FUNCTION public.asset_maintenance_add(
  p_society_id uuid, p_asset_id uuid, p_performed_on date, p_description text,
  p_cost_paise bigint, p_done_by text, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  entry public.asset_maintenance_entries;
  clean_description text;
  clean_done_by text;
BEGIN
  PERFORM private.asset_write_begin(p_society_id);
  clean_description := private.asset_clean_text(p_description, 1000, 'what was done', true);
  clean_done_by := private.asset_clean_text(p_done_by, 120, 'who did the work', true);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
  END IF;
  IF p_performed_on IS NULL OR p_performed_on < DATE '1900-01-01'
    OR p_performed_on > private.asset_today(p_society_id)
  THEN
    RAISE EXCEPTION 'Choose the date the work was done; it cannot be in the future.'
      USING ERRCODE = '22023';
  END IF;
  IF p_cost_paise IS NOT NULL AND p_cost_paise NOT BETWEEN 0 AND 999999999999999 THEN
    RAISE EXCEPTION 'Enter a cost of ₹0 or more.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO entry FROM public.asset_maintenance_entries
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN entry.id; END IF;
  PERFORM 1 FROM public.assets WHERE society_id = p_society_id AND id = p_asset_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.asset_maintenance_entries (
    society_id, asset_id, performed_on, description, cost_paise, done_by, client_request_id,
    created_by
  ) VALUES (
    p_society_id, p_asset_id, p_performed_on, clean_description, p_cost_paise, clean_done_by,
    p_client_request_id, auth.uid()
  )
  ON CONFLICT ON CONSTRAINT asset_maintenance_entries_actor_request_key DO NOTHING
  RETURNING * INTO entry;
  IF NOT FOUND THEN
    SELECT * INTO entry FROM public.asset_maintenance_entries
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    RETURN entry.id;
  END IF;
  PERFORM private.asset_audit(p_society_id, 'maintenance.add', 'asset_maintenance_entry', entry.id,
    NULL, jsonb_build_object('asset_id', p_asset_id, 'performed_on', p_performed_on,
      'cost_paise', p_cost_paise), p_request_id);
  RETURN entry.id;
END;
$$;

CREATE FUNCTION public.asset_maintenance_remove(
  p_society_id uuid, p_entry_id uuid, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  entry public.asset_maintenance_entries;
BEGIN
  PERFORM private.asset_write_begin(p_society_id);
  SELECT * INTO entry FROM public.asset_maintenance_entries
    WHERE society_id = p_society_id AND id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance entry not found.' USING ERRCODE = 'P0002'; END IF;
  IF entry.removed_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.asset_maintenance_entries
  SET removed_at = clock_timestamp(), removed_by = auth.uid()
  WHERE id = entry.id;
  PERFORM private.asset_audit(p_society_id, 'maintenance.remove', 'asset_maintenance_entry',
    entry.id, jsonb_build_object('asset_id', entry.asset_id, 'performed_on', entry.performed_on,
      'description', entry.description, 'cost_paise', entry.cost_paise, 'done_by', entry.done_by),
    NULL, p_request_id);
END;
$$;

CREATE FUNCTION public.asset_workspace_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  amc_on boolean;
BEGIN
  PERFORM private.asset_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  amc_on := private.module_enabled(p_society_id, 'amc');
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'amc_enabled', amc_on,
    'today', private.asset_today(p_society_id),
    'truncated', (SELECT count(*) FROM public.assets WHERE society_id = p_society_id) > 1000,
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', category.id, 'name', category.name, 'active', category.active,
        'version', category.version,
        'asset_count', (SELECT count(*) FROM public.assets AS asset
          WHERE asset.society_id = p_society_id AND asset.category_id = category.id)
      ) ORDER BY category.active DESC, lower(category.name), category.id)
      FROM public.asset_categories AS category WHERE category.society_id = p_society_id
    ), '[]'::jsonb),
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', asset.id, 'name', asset.name, 'category_id', asset.category_id,
        'category_name', category.name, 'location', asset.location, 'make', asset.make,
        'model', asset.model, 'serial_number', asset.serial_number, 'status', asset.status,
        'warranty_end_date', asset.warranty_end_date,
        'amc_linked', amc_on AND asset.amc_contract_id IS NOT NULL,
        'last_maintenance_on', (SELECT max(entry.performed_on)
          FROM public.asset_maintenance_entries AS entry
          WHERE entry.society_id = p_society_id AND entry.asset_id = asset.id
            AND entry.removed_at IS NULL)
      ) ORDER BY (asset.status = 'retired'), lower(asset.name), asset.id)
      FROM (
        SELECT * FROM public.assets WHERE society_id = p_society_id
        ORDER BY (status = 'retired'), lower(name), id LIMIT 1000
      ) AS asset
      JOIN public.asset_categories AS category
        ON category.society_id = asset.society_id AND category.id = asset.category_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.asset_get(p_society_id uuid, p_asset_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  asset public.assets;
  amc_on boolean;
  is_admin boolean;
  today date;
BEGIN
  PERFORM private.asset_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT * INTO asset FROM public.assets WHERE society_id = p_society_id AND id = p_asset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
  amc_on := private.module_enabled(p_society_id, 'amc');
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  today := private.asset_today(p_society_id);
  RETURN jsonb_build_object(
    'can_manage', is_admin,
    'amc_enabled', amc_on,
    'today', today,
    'asset', jsonb_build_object(
      'id', asset.id, 'category_id', asset.category_id,
      'category_name', (SELECT name FROM public.asset_categories
        WHERE society_id = p_society_id AND id = asset.category_id),
      'name', asset.name, 'location', asset.location, 'make', asset.make, 'model', asset.model,
      'serial_number', asset.serial_number, 'purchase_date', asset.purchase_date,
      'purchase_cost_paise', asset.purchase_cost_paise, 'supplier', asset.supplier,
      'warranty_end_date', asset.warranty_end_date, 'status', asset.status, 'notes', asset.notes,
      'amc_contract_id', CASE WHEN amc_on THEN asset.amc_contract_id END,
      'version', asset.version, 'created_at', asset.created_at, 'updated_at', asset.updated_at
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name,
        'active', category.active) ORDER BY lower(category.name), category.id)
      FROM public.asset_categories AS category
      WHERE category.society_id = p_society_id
        AND (category.active OR category.id = asset.category_id)
    ), '[]'::jsonb),
    'maintenance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', entry.id, 'performed_on', entry.performed_on, 'description', entry.description,
        'cost_paise', entry.cost_paise, 'done_by', entry.done_by, 'created_at', entry.created_at
      ) ORDER BY entry.performed_on DESC, entry.created_at DESC, entry.id)
      FROM (
        SELECT * FROM public.asset_maintenance_entries
        WHERE society_id = p_society_id AND asset_id = asset.id AND removed_at IS NULL
        ORDER BY performed_on DESC, created_at DESC, id LIMIT 200
      ) AS entry
    ), '[]'::jsonb),
    'amc_contract', CASE WHEN amc_on AND asset.amc_contract_id IS NOT NULL THEN (
      SELECT jsonb_build_object(
        'id', contract.id, 'asset_label', contract.asset_label,
        'vendor_name', contract.vendor_name, 'start_date', contract.start_date,
        'end_date', contract.end_date,
        'renewed', EXISTS (SELECT 1 FROM public.amc_contracts AS successor
          WHERE successor.society_id = p_society_id AND successor.predecessor_id = contract.id)
      )
      FROM public.amc_contracts AS contract
      WHERE contract.society_id = p_society_id AND contract.id = asset.amc_contract_id
    ) END,
    'amc_visits', CASE WHEN amc_on AND asset.amc_contract_id IS NOT NULL THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', visit.id, 'visit_date', visit.visit_date, 'summary', visit.summary,
        'technician', visit.technician
      ) ORDER BY visit.visit_date DESC, visit.id)
      FROM (
        SELECT amc_visit.* FROM public.amc_visits AS amc_visit
        WHERE amc_visit.society_id = p_society_id AND amc_visit.contract_id IN (
          SELECT chain.contract_id FROM private.asset_amc_chain(p_society_id, asset.amc_contract_id) AS chain
        )
        ORDER BY amc_visit.visit_date DESC, amc_visit.id LIMIT 200
      ) AS visit
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'amc_contracts', CASE WHEN amc_on AND is_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', contract.id, 'asset_label', contract.asset_label,
        'vendor_name', contract.vendor_name, 'end_date', contract.end_date
      ) ORDER BY (contract.end_date < today), contract.end_date DESC, contract.id)
      FROM public.amc_contracts AS contract
      WHERE contract.society_id = p_society_id AND (
        -- The linked contract is always offered so a capped list cannot clear the link on save.
        contract.id = asset.amc_contract_id
        OR contract.id IN (
          SELECT capped.id FROM public.amc_contracts AS capped
          WHERE capped.society_id = p_society_id
          ORDER BY (capped.end_date < today), capped.end_date DESC, capped.id LIMIT 200
        )
      )
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

-- Options for the new-asset form: active categories and, when AMC is on, contracts to link.
CREATE FUNCTION public.asset_form_options_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  amc_on boolean;
  today date;
BEGIN
  PERFORM private.asset_authorize(p_society_id, ARRAY['admin']::text[], false);
  amc_on := private.module_enabled(p_society_id, 'amc');
  today := private.asset_today(p_society_id);
  RETURN jsonb_build_object(
    'amc_enabled', amc_on,
    'today', today,
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name,
        'active', category.active) ORDER BY lower(category.name), category.id)
      FROM public.asset_categories AS category
      WHERE category.society_id = p_society_id AND category.active
    ), '[]'::jsonb),
    'amc_contracts', CASE WHEN amc_on THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', contract.id, 'asset_label', contract.asset_label,
        'vendor_name', contract.vendor_name, 'end_date', contract.end_date
      ) ORDER BY (contract.end_date < today), contract.end_date DESC, contract.id)
      FROM (
        SELECT * FROM public.amc_contracts WHERE society_id = p_society_id
        ORDER BY (end_date < today), end_date DESC, id LIMIT 200
      ) AS contract
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.asset_category_save(uuid, uuid, text, integer, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_category_set_active(uuid, uuid, boolean, integer, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_save(uuid, uuid, uuid, text, text, text, text, text, date, bigint, text, date, text, text, uuid, boolean, integer, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_maintenance_add(uuid, uuid, date, text, bigint, text, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_maintenance_remove(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_workspace_get(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_get(uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.asset_form_options_get(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.asset_category_save(uuid, uuid, text, integer, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_category_set_active(uuid, uuid, boolean, integer, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_save(uuid, uuid, uuid, text, text, text, text, text, date, bigint, text, date, text, text, uuid, boolean, integer, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_maintenance_add(uuid, uuid, date, text, bigint, text, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_maintenance_remove(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_workspace_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_get(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_form_options_get(uuid) TO authenticated;
