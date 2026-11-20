-- P35 core toolkit: society reference profile, capability adoption register, committee action plans and letter generation log.

-- Shared helpers ---------------------------------------------------------------

CREATE FUNCTION private.core_toolkit_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_society_id IS NULL
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'This society tool is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION private.core_toolkit_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.core_toolkit_authorize(p_society_id, p_roles, true);
END;
$$;

CREATE FUNCTION private.core_toolkit_actor_role(p_society_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'system'
    WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
    WHEN private.has_role(p_society_id, ARRAY['committee']::text[]) THEN 'committee'
    ELSE 'member' END
$$;

CREATE FUNCTION private.core_toolkit_audit(
  p_society_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_request_id text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), private.core_toolkit_actor_role(p_society_id),
    'core.' || p_action, p_entity_type, p_entity_id, p_before, p_after, p_request_id
  );
$$;

CREATE FUNCTION private.core_toolkit_person(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT full_name FROM public.profiles WHERE id = p_user_id
$$;

CREATE FUNCTION private.core_toolkit_clean_text(p_value text, p_max integer, p_label text, p_required boolean)
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

CREATE FUNCTION private.core_toolkit_json_text(
  p_values jsonb, p_key text, p_max integer, p_label text, p_pattern text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  clean text;
BEGIN
  IF jsonb_typeof(p_values -> p_key) NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Enter a valid %.', p_label USING ERRCODE = '22023';
  END IF;
  clean := private.core_toolkit_clean_text(p_values ->> p_key, p_max, p_label, false);
  IF clean IS NOT NULL AND p_pattern IS NOT NULL AND clean !~ p_pattern THEN
    RAISE EXCEPTION 'Enter a valid %.', p_label USING ERRCODE = '22023';
  END IF;
  RETURN clean;
END;
$$;

CREATE FUNCTION private.core_toolkit_json_date(p_values jsonb, p_key text, p_label text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  raw text := NULLIF(btrim(COALESCE(p_values ->> p_key, '')), '');
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  IF raw !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Enter a valid %.', p_label USING ERRCODE = '22023';
  END IF;
  BEGIN
    RETURN raw::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Enter a valid %.', p_label USING ERRCODE = '22023';
  END;
END;
$$;

CREATE FUNCTION private.core_toolkit_json_numeric(
  p_values jsonb, p_key text, p_label text, p_min numeric, p_max numeric, p_whole boolean
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  raw text := NULLIF(btrim(COALESCE(p_values ->> p_key, '')), '');
  parsed numeric;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  IF raw !~ '^\d+(\.\d+)?$' THEN
    RAISE EXCEPTION 'Enter a valid %.', p_label USING ERRCODE = '22023';
  END IF;
  parsed := raw::numeric;
  IF parsed < p_min OR parsed > p_max OR (p_whole AND parsed <> trunc(parsed)) THEN
    RAISE EXCEPTION 'Enter a valid %.', p_label USING ERRCODE = '22023';
  END IF;
  RETURN parsed;
END;
$$;

-- P35.2 society reference profile ---------------------------------------------

-- Name, address, city, official email and phone stay on public.societies; this
-- table stores only the extra reference fields and never drives billing or reports.
CREATE TABLE public.society_reference_profiles (
  society_id uuid PRIMARY KEY REFERENCES public.societies(id) ON DELETE RESTRICT,
  society_type text CHECK (
    society_type IS NULL
    OR society_type IN ('cooperative_housing_society', 'apartment_association', 'other')
  ),
  registration_number text CHECK (registration_number IS NULL OR char_length(registration_number) BETWEEN 1 AND 80),
  registration_date date,
  registration_authority text CHECK (
    registration_authority IS NULL OR char_length(registration_authority) BETWEEN 1 AND 200
  ),
  pan text CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  state text CHECK (state IS NULL OR char_length(state) BETWEEN 1 AND 80),
  pin_code text CHECK (pin_code IS NULL OR pin_code ~ '^[1-9][0-9]{5}$'),
  bye_laws_adopted_on date,
  committee_size integer CHECK (committee_size IS NULL OR committee_size BETWEEN 1 AND 99),
  committee_term_months integer CHECK (
    committee_term_months IS NULL OR committee_term_months BETWEEN 1 AND 120
  ),
  last_agm_on date,
  last_election_on date,
  auditor_name text CHECK (auditor_name IS NULL OR char_length(auditor_name) BETWEEN 1 AND 120),
  auditor_category text CHECK (auditor_category IS NULL OR char_length(auditor_category) BETWEEN 1 AND 120),
  financial_year_start_month integer CHECK (
    financial_year_start_month IS NULL OR financial_year_start_month BETWEEN 1 AND 12
  ),
  wings_count integer CHECK (wings_count IS NULL OR wings_count BETWEEN 0 AND 999),
  statutory_members_count integer CHECK (
    statutory_members_count IS NULL OR statutory_members_count BETWEEN 0 AND 99999
  ),
  parking_count integer CHECK (parking_count IS NULL OR parking_count BETWEEN 0 AND 99999),
  construction_year integer CHECK (construction_year IS NULL OR construction_year BETWEEN 1800 AND 2200),
  built_up_area_sq_ft numeric(12, 2) CHECK (
    built_up_area_sq_ft IS NULL OR built_up_area_sq_ft BETWEEN 0.01 AND 9999999999.99
  ),
  maintenance_rate_reference text CHECK (
    maintenance_rate_reference IS NULL OR char_length(maintenance_rate_reference) BETWEEN 1 AND 200
  ),
  sinking_fund_rate_reference text CHECK (
    sinking_fund_rate_reference IS NULL OR char_length(sinking_fund_rate_reference) BETWEEN 1 AND 200
  ),
  arrears_interest_reference text CHECK (
    arrears_interest_reference IS NULL OR char_length(arrears_interest_reference) BETWEEN 1 AND 200
  ),
  grace_period_reference text CHECK (
    grace_period_reference IS NULL OR char_length(grace_period_reference) BETWEEN 1 AND 200
  ),
  bank_name text CHECK (bank_name IS NULL OR char_length(bank_name) BETWEEN 1 AND 120),
  bank_account_last4 text CHECK (bank_account_last4 IS NULL OR bank_account_last4 ~ '^[0-9]{4}$'),
  ifsc text CHECK (ifsc IS NULL OR ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  chairman_name text CHECK (chairman_name IS NULL OR char_length(chairman_name) BETWEEN 1 AND 120),
  chairman_mobile text CHECK (chairman_mobile IS NULL OR chairman_mobile ~ '^\+?[0-9]{10,15}$'),
  secretary_name text CHECK (secretary_name IS NULL OR char_length(secretary_name) BETWEEN 1 AND 120),
  secretary_mobile text CHECK (secretary_mobile IS NULL OR secretary_mobile ~ '^\+?[0-9]{10,15}$'),
  treasurer_name text CHECK (treasurer_name IS NULL OR char_length(treasurer_name) BETWEEN 1 AND 120),
  treasurer_mobile text CHECK (treasurer_mobile IS NULL OR treasurer_mobile ~ '^\+?[0-9]{10,15}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE INDEX society_reference_profiles_created_by_idx ON public.society_reference_profiles (created_by);
CREATE INDEX society_reference_profiles_updated_by_idx ON public.society_reference_profiles (updated_by);

ALTER TABLE public.society_reference_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.society_reference_profiles FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY society_reference_profiles_no_direct_access ON public.society_reference_profiles
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER society_reference_profiles_reject_delete BEFORE DELETE ON public.society_reference_profiles
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER society_reference_profiles_reject_truncate BEFORE TRUNCATE ON public.society_reference_profiles
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.core_profile_editable_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ARRAY[
    'society_type', 'registration_number', 'registration_date', 'registration_authority', 'pan',
    'state', 'pin_code', 'bye_laws_adopted_on', 'committee_size', 'committee_term_months',
    'last_agm_on', 'last_election_on', 'auditor_name', 'auditor_category',
    'financial_year_start_month', 'wings_count', 'statutory_members_count', 'parking_count',
    'construction_year', 'built_up_area_sq_ft', 'maintenance_rate_reference',
    'sinking_fund_rate_reference', 'arrears_interest_reference', 'grace_period_reference',
    'bank_name', 'bank_account_last4', 'ifsc', 'chairman_name', 'chairman_mobile',
    'secretary_name', 'secretary_mobile', 'treasurer_name', 'treasurer_mobile'
  ]::text[]
$$;

-- PAN, bank identifiers and office-bearer mobiles are returned to admins only.
CREATE FUNCTION private.core_profile_restricted_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ARRAY[
    'pan', 'bank_name', 'bank_account_last4', 'ifsc',
    'chairman_mobile', 'secretary_mobile', 'treasurer_mobile'
  ]::text[]
$$;

-- Advisory only: missing values never block a society.
CREATE FUNCTION private.core_profile_completeness(p_values jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH required AS (
    SELECT key, position
    FROM unnest(
      ARRAY[
        'name', 'society_type', 'registration_number', 'registration_date', 'address', 'city',
        'state', 'pin_code', 'contact_email', 'contact_phone', 'financial_year_start_month'
      ]::text[]
      || CASE WHEN p_values ->> 'society_type' = 'cooperative_housing_society'
        THEN ARRAY['registration_authority', 'statutory_members_count', 'auditor_name']::text[]
        ELSE ARRAY[]::text[] END
    ) WITH ORDINALITY AS item(key, position)
  )
  SELECT jsonb_build_object(
    'required_fields', COALESCE(jsonb_agg(key ORDER BY position), '[]'::jsonb),
    'missing_fields', COALESCE(
      jsonb_agg(key ORDER BY position) FILTER (
        WHERE NULLIF(btrim(COALESCE(p_values ->> key, '')), '') IS NULL
      ),
      '[]'::jsonb
    ),
    'required_count', count(*),
    'filled_count', count(*) FILTER (
      WHERE NULLIF(btrim(COALESCE(p_values ->> key, '')), '') IS NOT NULL
    )
  )
  FROM required
$$;

CREATE FUNCTION private.core_profile_read(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  society public.societies;
  profile_row public.society_reference_profiles;
  is_admin boolean := private.has_role(p_society_id, ARRAY['admin']::text[]);
  values_all jsonb;
  values_visible jsonb;
BEGIN
  SELECT * INTO society FROM public.societies WHERE id = p_society_id;
  SELECT * INTO profile_row FROM public.society_reference_profiles WHERE society_id = p_society_id;

  SELECT COALESCE(jsonb_object_agg(key, to_jsonb(profile_row) -> key), '{}'::jsonb)
  INTO values_all
  FROM unnest(private.core_profile_editable_keys()) AS key;
  values_visible := CASE WHEN is_admin THEN values_all
    ELSE values_all - private.core_profile_restricted_keys() END;

  RETURN jsonb_build_object(
    'society', jsonb_build_object(
      'name', society.name,
      'address', society.address,
      'city', society.city,
      'contact_email', society.contact_email,
      'contact_phone', society.contact_phone
    ),
    'profile', values_visible,
    'restricted_visible', is_admin,
    'can_manage', is_admin AND private.society_writable(p_society_id),
    'version', profile_row.version,
    'updated_at', profile_row.updated_at,
    'updated_by_name', private.core_toolkit_person(profile_row.updated_by),
    'completeness', private.core_profile_completeness(
      values_all || jsonb_build_object(
        'name', society.name,
        'address', society.address,
        'city', society.city,
        'contact_email', society.contact_email,
        'contact_phone', society.contact_phone
      )
    )
  );
END;
$$;

CREATE FUNCTION public.society_reference_profile_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  RETURN private.core_profile_read(p_society_id);
END;
$$;

CREATE FUNCTION public.society_reference_profile_save(
  p_society_id uuid,
  p_values jsonb,
  p_expected_version integer,
  p_request_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.society_reference_profiles;
  new_row public.society_reference_profiles;
  unknown_key text;
  v_type text;
  restricted text[] := private.core_profile_restricted_keys();
  before_json jsonb;
  after_json jsonb;
  changed_restricted jsonb;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']);

  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object' THEN
    RAISE EXCEPTION 'Enter the profile details.' USING ERRCODE = '22023';
  END IF;
  SELECT key INTO unknown_key FROM jsonb_object_keys(p_values) AS key
  WHERE key <> ALL (private.core_profile_editable_keys()) LIMIT 1;
  IF unknown_key IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown profile field: %.', unknown_key USING ERRCODE = '22023';
  END IF;

  v_type := private.core_toolkit_json_text(p_values, 'society_type', 40, 'society type');
  IF v_type IS NOT NULL
    AND v_type NOT IN ('cooperative_housing_society', 'apartment_association', 'other') THEN
    RAISE EXCEPTION 'Choose a society type.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.society_reference_profiles
  WHERE society_id = p_society_id FOR UPDATE;
  IF FOUND THEN
    IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
      RAISE EXCEPTION 'Society profile changed. Refresh.' USING ERRCODE = '40001';
    END IF;
  ELSIF p_expected_version IS NOT NULL THEN
    RAISE EXCEPTION 'Society profile changed. Refresh.' USING ERRCODE = '40001';
  END IF;

  new_row.society_id := p_society_id;
  new_row.society_type := v_type;
  new_row.registration_number := private.core_toolkit_json_text(p_values, 'registration_number', 80, 'registration number');
  new_row.registration_date := private.core_toolkit_json_date(p_values, 'registration_date', 'registration date');
  new_row.registration_authority := private.core_toolkit_json_text(p_values, 'registration_authority', 200, 'registration authority');
  new_row.pan := private.core_toolkit_json_text(
    jsonb_build_object('pan', upper(p_values ->> 'pan')), 'pan', 10, 'PAN', '^[A-Z]{5}[0-9]{4}[A-Z]$'
  );
  new_row.state := private.core_toolkit_json_text(p_values, 'state', 80, 'state');
  new_row.pin_code := private.core_toolkit_json_text(p_values, 'pin_code', 6, 'PIN code', '^[1-9][0-9]{5}$');
  new_row.bye_laws_adopted_on := private.core_toolkit_json_date(p_values, 'bye_laws_adopted_on', 'bye-laws adoption date');
  new_row.committee_size := private.core_toolkit_json_numeric(p_values, 'committee_size', 'committee size', 1, 99, true);
  new_row.committee_term_months := private.core_toolkit_json_numeric(p_values, 'committee_term_months', 'committee term', 1, 120, true);
  new_row.last_agm_on := private.core_toolkit_json_date(p_values, 'last_agm_on', 'last AGM date');
  new_row.last_election_on := private.core_toolkit_json_date(p_values, 'last_election_on', 'last election date');
  new_row.auditor_name := private.core_toolkit_json_text(p_values, 'auditor_name', 120, 'auditor name');
  new_row.auditor_category := private.core_toolkit_json_text(p_values, 'auditor_category', 120, 'auditor category');
  new_row.financial_year_start_month := private.core_toolkit_json_numeric(p_values, 'financial_year_start_month', 'financial-year start month', 1, 12, true);
  new_row.wings_count := private.core_toolkit_json_numeric(p_values, 'wings_count', 'number of wings', 0, 999, true);
  new_row.statutory_members_count := private.core_toolkit_json_numeric(p_values, 'statutory_members_count', 'number of members', 0, 99999, true);
  new_row.parking_count := private.core_toolkit_json_numeric(p_values, 'parking_count', 'number of parking spaces', 0, 99999, true);
  new_row.construction_year := private.core_toolkit_json_numeric(p_values, 'construction_year', 'construction year', 1800, 2200, true);
  new_row.built_up_area_sq_ft := private.core_toolkit_json_numeric(p_values, 'built_up_area_sq_ft', 'built-up area', 0.01, 9999999999.99, false);
  new_row.maintenance_rate_reference := private.core_toolkit_json_text(p_values, 'maintenance_rate_reference', 200, 'maintenance rate reference');
  new_row.sinking_fund_rate_reference := private.core_toolkit_json_text(p_values, 'sinking_fund_rate_reference', 200, 'sinking fund rate reference');
  new_row.arrears_interest_reference := private.core_toolkit_json_text(p_values, 'arrears_interest_reference', 200, 'arrears interest reference');
  new_row.grace_period_reference := private.core_toolkit_json_text(p_values, 'grace_period_reference', 200, 'grace period reference');
  new_row.bank_name := private.core_toolkit_json_text(p_values, 'bank_name', 120, 'bank name');
  new_row.bank_account_last4 := private.core_toolkit_json_text(p_values, 'bank_account_last4', 4, 'last four account digits', '^[0-9]{4}$');
  new_row.ifsc := private.core_toolkit_json_text(
    jsonb_build_object('ifsc', upper(p_values ->> 'ifsc')), 'ifsc', 11, 'IFSC', '^[A-Z]{4}0[A-Z0-9]{6}$'
  );
  new_row.chairman_name := private.core_toolkit_json_text(p_values, 'chairman_name', 120, 'chairman name');
  new_row.chairman_mobile := private.core_toolkit_json_text(p_values, 'chairman_mobile', 16, 'chairman mobile', '^\+?[0-9]{10,15}$');
  new_row.secretary_name := private.core_toolkit_json_text(p_values, 'secretary_name', 120, 'secretary name');
  new_row.secretary_mobile := private.core_toolkit_json_text(p_values, 'secretary_mobile', 16, 'secretary mobile', '^\+?[0-9]{10,15}$');
  new_row.treasurer_name := private.core_toolkit_json_text(p_values, 'treasurer_name', 120, 'treasurer name');
  new_row.treasurer_mobile := private.core_toolkit_json_text(p_values, 'treasurer_mobile', 16, 'treasurer mobile', '^\+?[0-9]{10,15}$');

  IF current_row.society_id IS NULL THEN
    new_row.version := 1;
    new_row.created_at := now();
    new_row.created_by := auth.uid();
    new_row.updated_at := now();
    new_row.updated_by := auth.uid();
    INSERT INTO public.society_reference_profiles SELECT new_row.*;
  ELSE
    new_row.version := current_row.version + 1;
    new_row.created_at := current_row.created_at;
    new_row.created_by := current_row.created_by;
    new_row.updated_at := now();
    new_row.updated_by := auth.uid();
    UPDATE public.society_reference_profiles AS target
    SET (society_type, registration_number, registration_date, registration_authority, pan,
      state, pin_code, bye_laws_adopted_on, committee_size, committee_term_months,
      last_agm_on, last_election_on, auditor_name, auditor_category,
      financial_year_start_month, wings_count, statutory_members_count, parking_count,
      construction_year, built_up_area_sq_ft, maintenance_rate_reference,
      sinking_fund_rate_reference, arrears_interest_reference, grace_period_reference,
      bank_name, bank_account_last4, ifsc, chairman_name, chairman_mobile,
      secretary_name, secretary_mobile, treasurer_name, treasurer_mobile,
      version, updated_at, updated_by)
    = (new_row.society_type, new_row.registration_number, new_row.registration_date,
      new_row.registration_authority, new_row.pan, new_row.state, new_row.pin_code,
      new_row.bye_laws_adopted_on, new_row.committee_size, new_row.committee_term_months,
      new_row.last_agm_on, new_row.last_election_on, new_row.auditor_name,
      new_row.auditor_category, new_row.financial_year_start_month, new_row.wings_count,
      new_row.statutory_members_count, new_row.parking_count, new_row.construction_year,
      new_row.built_up_area_sq_ft, new_row.maintenance_rate_reference,
      new_row.sinking_fund_rate_reference, new_row.arrears_interest_reference,
      new_row.grace_period_reference, new_row.bank_name, new_row.bank_account_last4,
      new_row.ifsc, new_row.chairman_name, new_row.chairman_mobile, new_row.secretary_name,
      new_row.secretary_mobile, new_row.treasurer_name, new_row.treasurer_mobile,
      new_row.version, new_row.updated_at, new_row.updated_by)
    WHERE target.society_id = p_society_id;
  END IF;

  -- Committee can read audit logs, so restricted values are logged as changed-field names only.
  before_json := CASE WHEN current_row.society_id IS NULL THEN NULL
    ELSE to_jsonb(current_row) - restricted END;
  after_json := to_jsonb(new_row) - restricted;
  SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb) INTO changed_restricted
  FROM unnest(restricted) AS key
  WHERE COALESCE(to_jsonb(current_row) -> key, 'null'::jsonb)
    IS DISTINCT FROM COALESCE(to_jsonb(new_row) -> key, 'null'::jsonb);

  PERFORM private.core_toolkit_audit(
    p_society_id,
    CASE WHEN current_row.society_id IS NULL THEN 'society_profile.create' ELSE 'society_profile.update' END,
    'society_reference_profile', p_society_id::text, before_json,
    after_json || jsonb_build_object('restricted_fields_changed', changed_restricted),
    p_request_id
  );

  RETURN private.core_profile_read(p_society_id);
END;
$$;

-- P35.4 capability adoption register ------------------------------------------

CREATE TABLE public.society_capability_adoptions (
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'not_started' CHECK (
    status IN ('not_started', 'exploring', 'in_use', 'mastered')
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  owner_membership_id uuid,
  review_on date,
  notes text CHECK (notes IS NULL OR (notes = btrim(notes) AND char_length(notes) BETWEEN 1 AND 1000)),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, module_key),
  CONSTRAINT society_capability_adoptions_owner_same_society_fkey
    FOREIGN KEY (society_id, owner_membership_id)
    REFERENCES public.memberships(society_id, id) ON DELETE RESTRICT
);

CREATE INDEX society_capability_adoptions_module_idx ON public.society_capability_adoptions (module_key);
CREATE INDEX society_capability_adoptions_owner_idx
  ON public.society_capability_adoptions (society_id, owner_membership_id);
CREATE INDEX society_capability_adoptions_created_by_idx ON public.society_capability_adoptions (created_by);
CREATE INDEX society_capability_adoptions_updated_by_idx ON public.society_capability_adoptions (updated_by);

ALTER TABLE public.society_capability_adoptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.society_capability_adoptions FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY society_capability_adoptions_no_direct_access ON public.society_capability_adoptions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER society_capability_adoptions_reject_delete BEFORE DELETE ON public.society_capability_adoptions
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER society_capability_adoptions_reject_truncate BEFORE TRUNCATE ON public.society_capability_adoptions
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.core_member_name(p_society_id uuid, p_membership_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT profile.full_name
  FROM public.memberships AS membership
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  WHERE membership.society_id = p_society_id AND membership.id = p_membership_id
$$;

-- Returns the owner's user id, or raises when the membership is not an active member with the given roles.
CREATE FUNCTION private.core_active_member(p_society_id uuid, p_membership_id uuid, p_roles text[])
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owner_user uuid;
BEGIN
  SELECT membership.user_id INTO owner_user
  FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id AND membership.id = p_membership_id
    AND membership.status = 'active' AND membership.user_id IS NOT NULL
    AND (p_roles IS NULL OR membership.roles && p_roles);
  IF owner_user IS NULL THEN
    RAISE EXCEPTION 'Choose an active society member as the owner.' USING ERRCODE = '22023';
  END IF;
  RETURN owner_user;
END;
$$;

CREATE FUNCTION public.society_capability_adoptions_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_rows jsonb;
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin', 'committee'], false);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'module_key', module.key,
      'module_name', module.name,
      'enabled', private.module_enabled(p_society_id, module.key),
      'status', COALESCE(adoption.status, 'not_started'),
      'priority', COALESCE(adoption.priority, 'medium'),
      'owner_membership_id', adoption.owner_membership_id,
      'owner_name', private.core_member_name(p_society_id, adoption.owner_membership_id),
      'review_on', adoption.review_on,
      'notes', adoption.notes,
      'version', adoption.version,
      'updated_at', adoption.updated_at,
      'updated_by_name', private.core_toolkit_person(adoption.updated_by)
    ) ORDER BY module.sort_order, module.key), '[]'::jsonb)
  INTO result_rows
  FROM public.modules AS module
  LEFT JOIN public.society_capability_adoptions AS adoption
    ON adoption.society_id = p_society_id AND adoption.module_key = module.key;

  RETURN jsonb_build_object(
    'today', private.housekeeping_local_date(p_society_id),
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id),
    'capabilities', result_rows
  );
END;
$$;

CREATE FUNCTION public.society_capability_adoption_save(
  p_society_id uuid,
  p_module_key text,
  p_status text,
  p_priority text,
  p_owner_membership_id uuid,
  p_review_on date,
  p_notes text,
  p_expected_version integer,
  p_request_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.society_capability_adoptions;
  new_row public.society_capability_adoptions;
  clean_notes text;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']);

  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE key = p_module_key) THEN
    RAISE EXCEPTION 'Choose a capability.' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('not_started', 'exploring', 'in_use', 'mastered') THEN
    RAISE EXCEPTION 'Choose an adoption status.' USING ERRCODE = '22023';
  END IF;
  IF p_priority IS NULL OR p_priority NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Choose a priority.' USING ERRCODE = '22023';
  END IF;
  IF p_owner_membership_id IS NOT NULL THEN
    PERFORM private.core_active_member(p_society_id, p_owner_membership_id, ARRAY['admin', 'committee']);
  END IF;
  clean_notes := private.core_toolkit_clean_text(p_notes, 1000, 'notes', false);

  SELECT * INTO current_row FROM public.society_capability_adoptions
  WHERE society_id = p_society_id AND module_key = p_module_key FOR UPDATE;
  IF FOUND THEN
    IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
      RAISE EXCEPTION 'Adoption record changed. Refresh.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.society_capability_adoptions SET
      status = p_status,
      priority = p_priority,
      owner_membership_id = p_owner_membership_id,
      review_on = p_review_on,
      notes = clean_notes,
      version = current_row.version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE society_id = p_society_id AND module_key = p_module_key
    RETURNING * INTO new_row;
  ELSE
    IF p_expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'Adoption record changed. Refresh.' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.society_capability_adoptions (
      society_id, module_key, status, priority, owner_membership_id, review_on, notes,
      created_by, updated_by
    ) VALUES (
      p_society_id, p_module_key, p_status, p_priority, p_owner_membership_id, p_review_on,
      clean_notes, auth.uid(), auth.uid()
    ) RETURNING * INTO new_row;
  END IF;

  PERFORM private.core_toolkit_audit(
    p_society_id, 'capability_adoption.save', 'society_capability_adoption', p_module_key,
    CASE WHEN current_row.society_id IS NULL THEN NULL ELSE to_jsonb(current_row) END,
    to_jsonb(new_row), p_request_id
  );

  RETURN to_jsonb(new_row);
END;
$$;

-- P35.5 committee action plans ------------------------------------------------

CREATE TABLE public.committee_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  start_on date NOT NULL,
  notes text CHECK (notes IS NULL OR (notes = btrim(notes) AND char_length(notes) BETWEEN 1 AND 1000)),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CHECK ((archived_at IS NULL) = (archived_by IS NULL))
);

CREATE INDEX committee_action_plans_start_idx ON public.committee_action_plans (society_id, start_on);
CREATE INDEX committee_action_plans_created_by_idx ON public.committee_action_plans (created_by);
CREATE INDEX committee_action_plans_updated_by_idx ON public.committee_action_plans (updated_by);
CREATE INDEX committee_action_plans_archived_by_idx ON public.committee_action_plans (archived_by)
  WHERE archived_by IS NOT NULL;

CREATE TABLE public.committee_action_plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL,
  title text NOT NULL CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 300),
  category text NOT NULL CHECK (
    category IN ('governance', 'finance', 'compliance', 'operations', 'communication', 'technology', 'safety')
  ),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  owner_membership_id uuid,
  start_day integer NOT NULL CHECK (start_day BETWEEN 1 AND 3650),
  end_day integer NOT NULL CHECK (end_day BETWEEN 1 AND 3650),
  status text NOT NULL DEFAULT 'not_started' CHECK (
    status IN ('not_started', 'in_progress', 'done', 'blocked')
  ),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  notes text CHECK (notes IS NULL OR (notes = btrim(notes) AND char_length(notes) BETWEEN 1 AND 1000)),
  evidence_url text CHECK (
    evidence_url IS NULL OR (char_length(evidence_url) BETWEEN 1 AND 2048 AND evidence_url ~* '^https?://[^[:space:]]+$')
  ),
  meeting_action_item_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT committee_action_plan_tasks_plan_same_society_fkey
    FOREIGN KEY (society_id, plan_id) REFERENCES public.committee_action_plans(society_id, id) ON DELETE RESTRICT,
  CONSTRAINT committee_action_plan_tasks_owner_same_society_fkey
    FOREIGN KEY (society_id, owner_membership_id)
    REFERENCES public.memberships(society_id, id) ON DELETE RESTRICT,
  CONSTRAINT committee_action_plan_tasks_meeting_action_same_society_fkey
    FOREIGN KEY (society_id, meeting_action_item_id)
    REFERENCES public.meeting_action_items(society_id, id) ON DELETE RESTRICT,
  CONSTRAINT committee_action_plan_tasks_meeting_action_key UNIQUE (society_id, meeting_action_item_id),
  CHECK (end_day >= start_day),
  -- A linked task takes completion from the meeting action, so it never stores its own done state.
  CHECK (meeting_action_item_id IS NULL OR status <> 'done')
);

CREATE INDEX committee_action_plan_tasks_plan_idx
  ON public.committee_action_plan_tasks (society_id, plan_id, start_day);
CREATE INDEX committee_action_plan_tasks_owner_idx
  ON public.committee_action_plan_tasks (society_id, owner_membership_id);
CREATE INDEX committee_action_plan_tasks_created_by_idx ON public.committee_action_plan_tasks (created_by);
CREATE INDEX committee_action_plan_tasks_updated_by_idx ON public.committee_action_plan_tasks (updated_by);

ALTER TABLE public.committee_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_action_plan_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.committee_action_plans, public.committee_action_plan_tasks
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY committee_action_plans_no_direct_access ON public.committee_action_plans
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY committee_action_plan_tasks_no_direct_access ON public.committee_action_plan_tasks
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER committee_action_plans_reject_delete BEFORE DELETE ON public.committee_action_plans
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER committee_action_plans_reject_truncate BEFORE TRUNCATE ON public.committee_action_plans
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER committee_action_plan_tasks_reject_delete BEFORE DELETE ON public.committee_action_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER committee_action_plan_tasks_reject_truncate BEFORE TRUNCATE ON public.committee_action_plan_tasks
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.core_plan_task_notify(
  p_society_id uuid,
  p_task public.committee_action_plan_tasks,
  p_plan public.committee_action_plans,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owner_user uuid;
BEGIN
  SELECT user_id INTO owner_user FROM public.memberships
  WHERE society_id = p_society_id AND id = p_task.owner_membership_id AND status = 'active';
  IF owner_user IS NULL OR owner_user = auth.uid() THEN
    RETURN;
  END IF;
  PERFORM private.create_notification(
    p_society_id, owner_user, 'committee_action_task_assigned',
    'Action plan task assigned',
    left(
      p_task.title || '. Due ' || to_char(p_plan.start_on + p_task.end_day - 1, 'DD Mon YYYY') || '.',
      300
    ),
    'committee_action_plan', p_plan.id, p_request_id
  );
END;
$$;

CREATE FUNCTION public.committee_action_plan_save(
  p_society_id uuid,
  p_plan_id uuid,
  p_name text,
  p_start_on date,
  p_notes text,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.committee_action_plans;
  new_row public.committee_action_plans;
  existing_id uuid;
  clean_name text;
  clean_notes text;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin', 'committee']);
  clean_name := private.core_toolkit_clean_text(p_name, 120, 'a plan name', true);
  clean_notes := private.core_toolkit_clean_text(p_notes, 1000, 'notes', false);
  IF p_start_on IS NULL THEN
    RAISE EXCEPTION 'Enter the plan start date.' USING ERRCODE = '22023';
  END IF;

  IF p_plan_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO existing_id FROM public.committee_action_plans
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
    INSERT INTO public.committee_action_plans (
      society_id, name, start_on, notes, client_request_id, created_by, updated_by
    ) VALUES (
      p_society_id, clean_name, p_start_on, clean_notes, p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO new_row;
    PERFORM private.core_toolkit_audit(
      p_society_id, 'action_plan.create', 'committee_action_plan', new_row.id::text,
      NULL, to_jsonb(new_row) - 'client_request_id', p_request_id
    );
    RETURN new_row.id;
  END IF;

  SELECT * INTO current_row FROM public.committee_action_plans
  WHERE society_id = p_society_id AND id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action plan not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Action plan changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF current_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'An archived plan cannot be edited.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.committee_action_plans SET
    name = clean_name,
    start_on = p_start_on,
    notes = clean_notes,
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  PERFORM private.core_toolkit_audit(
    p_society_id, 'action_plan.update', 'committee_action_plan', new_row.id::text,
    to_jsonb(current_row) - 'client_request_id', to_jsonb(new_row) - 'client_request_id', p_request_id
  );
  RETURN new_row.id;
END;
$$;

CREATE FUNCTION public.committee_action_plan_set_archived(
  p_society_id uuid,
  p_plan_id uuid,
  p_archived boolean,
  p_expected_version integer,
  p_request_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.committee_action_plans;
  new_row public.committee_action_plans;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin', 'committee']);
  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'Choose archive or restore.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.committee_action_plans
  WHERE society_id = p_society_id AND id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action plan not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'Action plan changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  IF (current_row.archived_at IS NOT NULL) = p_archived THEN
    RETURN;
  END IF;

  UPDATE public.committee_action_plans SET
    archived_at = CASE WHEN p_archived THEN now() END,
    archived_by = CASE WHEN p_archived THEN auth.uid() END,
    version = current_row.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = current_row.id
  RETURNING * INTO new_row;

  PERFORM private.core_toolkit_audit(
    p_society_id, CASE WHEN p_archived THEN 'action_plan.archive' ELSE 'action_plan.restore' END,
    'committee_action_plan', new_row.id::text,
    to_jsonb(current_row) - 'client_request_id', to_jsonb(new_row) - 'client_request_id', p_request_id
  );
END;
$$;

CREATE FUNCTION public.committee_action_plan_task_save(
  p_society_id uuid,
  p_task_id uuid,
  p_plan_id uuid,
  p_title text,
  p_category text,
  p_priority text,
  p_owner_membership_id uuid,
  p_start_day integer,
  p_end_day integer,
  p_status text,
  p_progress integer,
  p_notes text,
  p_evidence_url text,
  p_meeting_action_item_id uuid,
  p_expected_version integer,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  plan_row public.committee_action_plans;
  current_row public.committee_action_plan_tasks;
  new_row public.committee_action_plan_tasks;
  existing_id uuid;
  clean_title text;
  clean_notes text;
  clean_url text;
  final_progress integer;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin', 'committee']);

  IF p_task_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO existing_id FROM public.committee_action_plan_tasks
    WHERE society_id = p_society_id AND created_by = auth.uid()
      AND client_request_id = p_client_request_id;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  ELSE
    SELECT * INTO current_row FROM public.committee_action_plan_tasks
    WHERE society_id = p_society_id AND id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Task not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_version IS NULL OR current_row.version <> p_expected_version THEN
      RAISE EXCEPTION 'Task changed. Refresh.' USING ERRCODE = '40001';
    END IF;
    IF p_plan_id IS NOT NULL AND p_plan_id <> current_row.plan_id THEN
      RAISE EXCEPTION 'A task cannot move to another plan.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO plan_row FROM public.committee_action_plans
  WHERE society_id = p_society_id AND id = COALESCE(current_row.plan_id, p_plan_id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action plan not found.' USING ERRCODE = 'P0002';
  END IF;
  IF plan_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'An archived plan cannot be edited.' USING ERRCODE = '22023';
  END IF;

  clean_title := private.core_toolkit_clean_text(p_title, 300, 'a task', true);
  clean_notes := private.core_toolkit_clean_text(p_notes, 1000, 'notes', false);
  clean_url := private.core_toolkit_clean_text(p_evidence_url, 2048, 'an evidence link', false);
  IF clean_url IS NOT NULL AND clean_url !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter an evidence link starting with http:// or https://.' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN (
    'governance', 'finance', 'compliance', 'operations', 'communication', 'technology', 'safety'
  ) THEN
    RAISE EXCEPTION 'Choose a category.' USING ERRCODE = '22023';
  END IF;
  IF p_priority IS NULL OR p_priority NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Choose a priority.' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('not_started', 'in_progress', 'done', 'blocked') THEN
    RAISE EXCEPTION 'Choose a status.' USING ERRCODE = '22023';
  END IF;
  IF p_start_day IS NULL OR p_end_day IS NULL OR p_start_day NOT BETWEEN 1 AND 3650
    OR p_end_day NOT BETWEEN 1 AND 3650 OR p_end_day < p_start_day THEN
    RAISE EXCEPTION 'Enter a start day and an end day on or after it (1 to 3650).' USING ERRCODE = '22023';
  END IF;
  IF p_progress IS NULL OR p_progress NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Progress must be 0 to 100.' USING ERRCODE = '22023';
  END IF;
  IF p_owner_membership_id IS NOT NULL
    AND p_owner_membership_id IS DISTINCT FROM current_row.owner_membership_id THEN
    PERFORM private.core_active_member(p_society_id, p_owner_membership_id, NULL);
  END IF;
  IF p_meeting_action_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.meeting_action_items
      WHERE society_id = p_society_id AND id = p_meeting_action_item_id
    ) THEN
      RAISE EXCEPTION 'Meeting action not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_status = 'done' THEN
      RAISE EXCEPTION 'Complete the linked meeting action instead.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.committee_action_plan_tasks
      WHERE society_id = p_society_id AND meeting_action_item_id = p_meeting_action_item_id
        AND id IS DISTINCT FROM current_row.id
    ) THEN
      RAISE EXCEPTION 'This meeting action is already linked to another task.' USING ERRCODE = '23505';
    END IF;
  END IF;
  final_progress := CASE WHEN p_status = 'done' THEN 100 ELSE p_progress END;

  IF p_task_id IS NULL THEN
    INSERT INTO public.committee_action_plan_tasks (
      society_id, plan_id, title, category, priority, owner_membership_id, start_day, end_day,
      status, progress, notes, evidence_url, meeting_action_item_id, client_request_id,
      created_by, updated_by
    ) VALUES (
      p_society_id, plan_row.id, clean_title, p_category, p_priority, p_owner_membership_id,
      p_start_day, p_end_day, p_status, final_progress, clean_notes, clean_url,
      p_meeting_action_item_id, p_client_request_id, auth.uid(), auth.uid()
    ) RETURNING * INTO new_row;
    PERFORM private.core_toolkit_audit(
      p_society_id, 'action_plan.task_create', 'committee_action_plan_task', new_row.id::text,
      NULL, to_jsonb(new_row) - 'client_request_id', p_request_id
    );
  ELSE
    UPDATE public.committee_action_plan_tasks SET
      title = clean_title,
      category = p_category,
      priority = p_priority,
      owner_membership_id = p_owner_membership_id,
      start_day = p_start_day,
      end_day = p_end_day,
      status = p_status,
      progress = final_progress,
      notes = clean_notes,
      evidence_url = clean_url,
      meeting_action_item_id = p_meeting_action_item_id,
      version = current_row.version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = current_row.id
    RETURNING * INTO new_row;
    PERFORM private.core_toolkit_audit(
      p_society_id, 'action_plan.task_update', 'committee_action_plan_task', new_row.id::text,
      to_jsonb(current_row) - 'client_request_id', to_jsonb(new_row) - 'client_request_id', p_request_id
    );
  END IF;

  IF new_row.owner_membership_id IS NOT NULL
    AND new_row.owner_membership_id IS DISTINCT FROM current_row.owner_membership_id THEN
    PERFORM private.core_plan_task_notify(p_society_id, new_row, plan_row, p_request_id);
  END IF;

  RETURN new_row.id;
END;
$$;

-- Editable planning example (Foundation by day 30, Systems by day 60, Growth later); not legal periods.
CREATE FUNCTION public.committee_action_plan_create_sample(
  p_society_id uuid,
  p_name text,
  p_start_on date,
  p_client_request_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing_id uuid;
  new_plan public.committee_action_plans;
  clean_name text;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin', 'committee']);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO existing_id FROM public.committee_action_plans
  WHERE society_id = p_society_id AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;
  clean_name := COALESCE(
    private.core_toolkit_clean_text(p_name, 120, 'a plan name', false),
    'Committee setup plan'
  );

  INSERT INTO public.committee_action_plans (
    society_id, name, start_on, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, clean_name, COALESCE(p_start_on, private.housekeeping_local_date(p_society_id)),
    p_client_request_id, auth.uid(), auth.uid()
  ) RETURNING * INTO new_plan;

  INSERT INTO public.committee_action_plan_tasks (
    society_id, plan_id, title, category, priority, start_day, end_day, client_request_id,
    created_by, updated_by
  )
  SELECT p_society_id, new_plan.id, sample.title, sample.category, sample.priority,
    sample.start_day, sample.end_day, gen_random_uuid(), auth.uid(), auth.uid()
  FROM (VALUES
    ('Confirm the society profile and registration details', 'governance', 'high', 1, 14),
    ('Confirm committee roles and office-bearer contacts', 'governance', 'high', 1, 14),
    ('Verify unit and member records in the app', 'operations', 'high', 1, 30),
    ('Review bye-laws and record the adoption date', 'governance', 'medium', 8, 30),
    ('Review maintenance charge heads and due dates', 'finance', 'high', 15, 30),
    ('Set up a monthly bank reconciliation routine', 'finance', 'medium', 31, 60),
    ('List statutory filings and their due dates', 'compliance', 'high', 31, 60),
    ('Review vendor contracts and AMC renewal dates', 'operations', 'medium', 31, 60),
    ('Share society rules and the complaint process with residents', 'communication', 'medium', 31, 45),
    ('Check fire-safety equipment and emergency contacts', 'safety', 'high', 31, 60),
    ('Prepare for the next annual general meeting', 'governance', 'medium', 61, 90),
    ('Review which app features the committee is using', 'technology', 'low', 61, 90)
  ) AS sample(title, category, priority, start_day, end_day);

  PERFORM private.core_toolkit_audit(
    p_society_id, 'action_plan.create_sample', 'committee_action_plan', new_plan.id::text,
    NULL, to_jsonb(new_plan) - 'client_request_id', p_request_id
  );
  RETURN new_plan.id;
END;
$$;

-- Managers see every plan and task; any other active member sees only tasks assigned to them.
CREATE FUNCTION public.committee_action_plans_get(p_society_id uuid, p_include_archived boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_manager boolean;
  local_today date;
  my_membership_id uuid;
  plans jsonb;
BEGIN
  PERFORM private.core_toolkit_authorize(
    p_society_id, ARRAY['admin', 'committee', 'guard', 'hk_supervisor', 'resident'], false
  );
  is_manager := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  local_today := private.housekeeping_local_date(p_society_id);
  SELECT id INTO my_membership_id FROM public.memberships
  WHERE society_id = p_society_id AND user_id = auth.uid() AND status = 'active';

  WITH visible_tasks AS (
    SELECT task.*, plan.start_on + task.start_day - 1 AS start_on,
      plan.start_on + task.end_day - 1 AS due_on,
      action.status AS action_status, action.title AS action_title,
      action.due_on AS action_due_on, action.meeting_id AS action_meeting_id,
      CASE
        WHEN task.meeting_action_item_id IS NULL THEN task.status
        WHEN action.status = 'done' THEN 'done'
        ELSE task.status
      END AS effective_status
    FROM public.committee_action_plan_tasks AS task
    JOIN public.committee_action_plans AS plan
      ON plan.society_id = task.society_id AND plan.id = task.plan_id
    LEFT JOIN public.meeting_action_items AS action
      ON action.society_id = task.society_id AND action.id = task.meeting_action_item_id
    WHERE task.society_id = p_society_id
      AND (is_manager OR task.owner_membership_id = my_membership_id)
  ),
  task_json AS (
    SELECT task.plan_id, jsonb_agg(jsonb_build_object(
        'id', task.id,
        'plan_id', task.plan_id,
        'title', task.title,
        'category', task.category,
        'priority', task.priority,
        'owner_membership_id', task.owner_membership_id,
        'owner_name', private.core_member_name(p_society_id, task.owner_membership_id),
        'start_day', task.start_day,
        'end_day', task.end_day,
        'start_on', task.start_on,
        'due_on', task.due_on,
        'days_left', task.due_on - local_today,
        'status', task.effective_status,
        'progress', CASE WHEN task.effective_status = 'done' THEN 100 ELSE task.progress END,
        'timeline', CASE
          WHEN task.effective_status = 'done' THEN 'done'
          WHEN local_today > task.due_on THEN 'overdue'
          WHEN local_today < task.start_on THEN 'upcoming'
          ELSE 'on_track'
        END,
        'notes', task.notes,
        'evidence_url', task.evidence_url,
        'meeting_action', CASE WHEN task.meeting_action_item_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', task.meeting_action_item_id,
            'meeting_id', task.action_meeting_id,
            'title', task.action_title,
            'status', task.action_status,
            'due_on', task.action_due_on
          ) END,
        'version', task.version,
        'updated_at', task.updated_at,
        'updated_by_name', private.core_toolkit_person(task.updated_by)
      ) ORDER BY task.start_day, task.end_day, task.created_at) AS tasks
    FROM visible_tasks AS task
    GROUP BY task.plan_id
  )
  SELECT COALESCE(jsonb_agg(
      CASE WHEN is_manager THEN jsonb_build_object(
        'id', plan.id,
        'name', plan.name,
        'start_on', plan.start_on,
        'notes', plan.notes,
        'archived_at', plan.archived_at,
        'version', plan.version,
        'created_at', plan.created_at,
        'created_by_name', private.core_toolkit_person(plan.created_by),
        'updated_at', plan.updated_at,
        'updated_by_name', private.core_toolkit_person(plan.updated_by),
        'tasks', COALESCE(task_json.tasks, '[]'::jsonb)
      ) ELSE jsonb_build_object(
        'id', plan.id,
        'name', plan.name,
        'start_on', plan.start_on,
        'archived_at', plan.archived_at,
        'tasks', task_json.tasks
      ) END
      ORDER BY plan.archived_at NULLS FIRST, plan.start_on DESC, plan.created_at DESC
    ), '[]'::jsonb)
  INTO plans
  FROM public.committee_action_plans AS plan
  LEFT JOIN task_json ON task_json.plan_id = plan.id
  WHERE plan.society_id = p_society_id
    AND (COALESCE(p_include_archived, false) OR plan.archived_at IS NULL)
    AND (is_manager OR task_json.tasks IS NOT NULL);

  RETURN jsonb_build_object(
    'today', local_today,
    'can_manage', is_manager AND private.society_writable(p_society_id),
    'plans', plans
  );
END;
$$;

-- P35.13 letter generation log ------------------------------------------------

CREATE TABLE public.letter_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  letter_type text NOT NULL CHECK (letter_type IN (
    'dues_reminder', 'dues_final_notice', 'member_welcome', 'complaint_acknowledgement',
    'rule_violation_warning', 'hall_booking_confirmation', 'vendor_work_order',
    'utility_shutdown', 'circular', 'event_announcement', 'annual_newsletter'
  )),
  source_type text CHECK (source_type IS NULL OR source_type ~ '^[a-z][a-z0-9_]{0,79}$'),
  source_id uuid,
  generated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  generated_at timestamptz NOT NULL DEFAULT now(),
  request_id text CHECK (request_id IS NULL OR char_length(request_id) BETWEEN 1 AND 128),
  CHECK (source_id IS NULL OR source_type IS NOT NULL)
);

CREATE INDEX letter_generation_logs_society_idx
  ON public.letter_generation_logs (society_id, generated_at DESC);
CREATE INDEX letter_generation_logs_generated_by_idx ON public.letter_generation_logs (generated_by);

ALTER TABLE public.letter_generation_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.letter_generation_logs FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY letter_generation_logs_no_direct_access ON public.letter_generation_logs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER letter_generation_logs_reject_mutation BEFORE UPDATE OR DELETE ON public.letter_generation_logs
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER letter_generation_logs_reject_truncate BEFORE TRUNCATE ON public.letter_generation_logs
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION public.letter_generation_record(
  p_society_id uuid,
  p_letter_type text,
  p_source_type text,
  p_source_id uuid,
  p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  new_id uuid;
  clean_source text := NULLIF(btrim(COALESCE(p_source_type, '')), '');
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin', 'committee']);
  IF p_letter_type IS NULL OR p_letter_type NOT IN (
    'dues_reminder', 'dues_final_notice', 'member_welcome', 'complaint_acknowledgement',
    'rule_violation_warning', 'hall_booking_confirmation', 'vendor_work_order',
    'utility_shutdown', 'circular', 'event_announcement', 'annual_newsletter'
  ) THEN
    RAISE EXCEPTION 'Choose a letter type.' USING ERRCODE = '22023';
  END IF;
  IF (clean_source IS NOT NULL AND clean_source !~ '^[a-z][a-z0-9_]{0,79}$')
    OR (p_source_id IS NOT NULL AND clean_source IS NULL) THEN
    RAISE EXCEPTION 'Invalid letter source.' USING ERRCODE = '22023';
  END IF;
  IF p_request_id IS NOT NULL AND char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid request identifier.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.letter_generation_logs (
    society_id, letter_type, source_type, source_id, generated_by, request_id
  ) VALUES (
    p_society_id, p_letter_type, clean_source, p_source_id, auth.uid(), p_request_id
  ) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE FUNCTION public.letter_generation_logs_get(p_society_id uuid, p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_rows jsonb;
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin', 'committee'], false);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Limit must be 1 to 500.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', entry.id,
      'letter_type', entry.letter_type,
      'source_type', entry.source_type,
      'source_id', entry.source_id,
      'generated_by_name', private.core_toolkit_person(entry.generated_by),
      'generated_at', entry.generated_at
    ) ORDER BY entry.generated_at DESC, entry.id), '[]'::jsonb)
  INTO result_rows
  FROM (
    SELECT * FROM public.letter_generation_logs
    WHERE society_id = p_society_id
    ORDER BY generated_at DESC, id
    LIMIT p_limit
  ) AS entry;
  RETURN result_rows;
END;
$$;

-- Grants -----------------------------------------------------------------------

REVOKE ALL ON FUNCTION
  private.core_toolkit_authorize(uuid, text[], boolean),
  private.core_toolkit_write_begin(uuid, text[]),
  private.core_toolkit_actor_role(uuid),
  private.core_toolkit_audit(uuid, text, text, text, jsonb, jsonb, text),
  private.core_toolkit_person(uuid),
  private.core_toolkit_clean_text(text, integer, text, boolean),
  private.core_toolkit_json_text(jsonb, text, integer, text, text),
  private.core_toolkit_json_date(jsonb, text, text),
  private.core_toolkit_json_numeric(jsonb, text, text, numeric, numeric, boolean),
  private.core_profile_editable_keys(),
  private.core_profile_restricted_keys(),
  private.core_profile_completeness(jsonb),
  private.core_profile_read(uuid),
  private.core_member_name(uuid, uuid),
  private.core_active_member(uuid, uuid, text[]),
  private.core_plan_task_notify(uuid, public.committee_action_plan_tasks, public.committee_action_plans, text)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.society_reference_profile_get(uuid),
  public.society_reference_profile_save(uuid, jsonb, integer, text),
  public.society_capability_adoptions_get(uuid),
  public.society_capability_adoption_save(uuid, text, text, text, uuid, date, text, integer, text),
  public.committee_action_plan_save(uuid, uuid, text, date, text, integer, uuid, text),
  public.committee_action_plan_set_archived(uuid, uuid, boolean, integer, text),
  public.committee_action_plan_task_save(uuid, uuid, uuid, text, text, text, uuid, integer, integer, text, integer, text, text, uuid, integer, uuid, text),
  public.committee_action_plan_create_sample(uuid, text, date, uuid, text),
  public.committee_action_plans_get(uuid, boolean),
  public.letter_generation_record(uuid, text, text, uuid, text),
  public.letter_generation_logs_get(uuid, integer)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.society_reference_profile_get(uuid),
  public.society_reference_profile_save(uuid, jsonb, integer, text),
  public.society_capability_adoptions_get(uuid),
  public.society_capability_adoption_save(uuid, text, text, text, uuid, date, text, integer, text),
  public.committee_action_plan_save(uuid, uuid, text, date, text, integer, uuid, text),
  public.committee_action_plan_set_archived(uuid, uuid, boolean, integer, text),
  public.committee_action_plan_task_save(uuid, uuid, uuid, text, text, text, uuid, integer, integer, text, integer, text, text, uuid, integer, uuid, text),
  public.committee_action_plan_create_sample(uuid, text, date, uuid, text),
  public.committee_action_plans_get(uuid, boolean),
  public.letter_generation_record(uuid, text, text, uuid, text),
  public.letter_generation_logs_get(uuid, integer)
TO authenticated;
