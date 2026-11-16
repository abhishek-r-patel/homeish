-- Committee analytics (D-62): metric preferences, catalogue, authorisation, date ranges and the live dashboard.
-- Figures are computed on every call from module data; this migration adds no summary or snapshot tables.
CREATE TABLE public.analytics_preferences (
  society_id uuid PRIMARY KEY REFERENCES public.societies (id) ON DELETE RESTRICT,
  metric_keys text[] NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT analytics_preferences_metric_keys_check CHECK (
    cardinality(metric_keys) <= 100 AND array_position(metric_keys, NULL) IS NULL
  ),
  CONSTRAINT analytics_preferences_version_check CHECK (version >= 1)
);
CREATE INDEX analytics_preferences_updated_by_idx ON public.analytics_preferences (updated_by);

ALTER TABLE public.analytics_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.analytics_preferences FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY analytics_preferences_no_direct_access ON public.analytics_preferences
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.analytics_reject_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Analytics preferences cannot be truncated.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_reject_truncate() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER analytics_preferences_no_truncate BEFORE TRUNCATE ON public.analytics_preferences
  FOR EACH STATEMENT EXECUTE FUNCTION private.analytics_reject_truncate();

-- The closed metric catalogue. `money` marks metrics that may use the current financial year instead of months.
-- Keep in sync with src/core/analytics/catalogue.ts (an integration test compares the two).
CREATE FUNCTION private.analytics_catalogue()
RETURNS TABLE (metric_key text, module_key text, sort_position integer, default_on boolean, money boolean)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT catalogue.metric_key, catalogue.module_key, catalogue.sort_position, catalogue.default_on, catalogue.money
  FROM (VALUES
    ('core.occupancy', 'core', 1, false, false),
    ('core.members_trend', 'core', 2, false, false),
    ('billing.dues_ageing', 'billing', 3, true, false),
    ('billing.collection_trend', 'billing', 4, true, true),
    ('billing.collection_rate', 'billing', 5, false, true),
    ('expense.income_vs_expense', 'expense', 6, true, true),
    ('expense.by_category', 'expense', 7, false, true),
    ('service_request.sla', 'service_request', 8, true, false),
    ('service_request.open_by_category', 'service_request', 9, false, false),
    ('service_request.resolution_time', 'service_request', 10, false, false),
    ('amenity.usage', 'amenity', 11, true, false),
    ('amenity.cancellations', 'amenity', 12, false, false),
    ('visitor.trend', 'visitor', 13, true, false),
    ('visitor.peak_hours', 'visitor', 14, false, false),
    ('delivery.trend', 'delivery', 15, false, false),
    ('delivery.uncollected', 'delivery', 16, false, false),
    ('staff.attendance_rate', 'staff', 17, false, false),
    ('staff.active_by_type', 'staff', 18, false, false),
    ('housekeeping.consumption', 'housekeeping', 19, false, false),
    ('housekeeping.low_stock', 'housekeeping', 20, false, false),
    ('amc.expiring', 'amc', 21, false, false),
    ('amc.visits', 'amc', 22, false, false),
    ('notice.published', 'notice', 23, false, false),
    ('notice.read_rate', 'notice', 24, false, false),
    ('directory.vehicles', 'directory', 25, false, false),
    ('directory.pending_verification', 'directory', 26, false, false),
    ('tenancy.moves', 'tenancy', 27, false, false),
    ('tenancy.pending', 'tenancy', 28, false, false),
    ('document.published', 'document', 29, false, false),
    ('document.downloads', 'document', 30, false, false),
    ('parking.occupancy', 'parking', 31, false, false),
    ('parking.reports', 'parking', 32, false, false),
    ('sos.alerts', 'sos', 33, false, false),
    ('sos.response_time', 'sos', 34, false, false),
    ('vendor.requests', 'vendor', 35, false, false),
    ('vendor.approved_spend', 'vendor', 36, false, true),
    ('patrol.completion', 'patrol', 37, false, false),
    ('patrol.incidents', 'patrol', 38, false, false),
    ('metering.consumption', 'metering', 39, false, false),
    ('metering.pending_readings', 'metering', 40, false, false),
    ('asset.by_category', 'asset', 41, false, false),
    ('asset.warranty_expiring', 'asset', 42, false, false),
    ('home_services.providers', 'home_services', 43, false, false),
    ('home_services.ratings', 'home_services', 44, false, false),
    ('poll.completed', 'poll', 45, false, false),
    ('poll.turnout', 'poll', 46, false, false),
    ('meeting.held', 'meeting', 47, false, false),
    ('meeting.attendance', 'meeting', 48, false, false),
    ('meeting.actions', 'meeting', 49, false, false)
  ) AS catalogue (metric_key, module_key, sort_position, default_on, money)
$$;
REVOKE ALL ON FUNCTION private.analytics_catalogue() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.analytics_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_society_id IS NULL
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies
      WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Analytics access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.analytics_timezone(p_society_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT society.timezone FROM public.societies AS society WHERE society.id = p_society_id
  ), 'Asia/Kolkata')
$$;
REVOKE ALL ON FUNCTION private.analytics_timezone(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.analytics_today(p_society_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (clock_timestamp() AT TIME ZONE private.analytics_timezone(p_society_id))::date
$$;
REVOKE ALL ON FUNCTION private.analytics_today(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Half-open instant range [from_ts, to_ts) covering whole society-local days p_from..p_to.
CREATE FUNCTION private.analytics_bounds(p_society_id uuid, p_from date, p_to date)
RETURNS TABLE (from_ts timestamptz, to_ts timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (p_from::timestamp AT TIME ZONE private.analytics_timezone(p_society_id)),
    ((p_to + 1)::timestamp AT TIME ZONE private.analytics_timezone(p_society_id))
$$;
REVOKE ALL ON FUNCTION private.analytics_bounds(uuid, date, date) FROM PUBLIC, anon, authenticated, service_role;

-- Every calendar month touching p_from..p_to, so trends include months with no activity.
CREATE FUNCTION private.analytics_months(p_from date, p_to date)
RETURNS TABLE (month_start date, period text)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT month::date, to_char(month, 'YYYY-MM')
  FROM generate_series(
    date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month'
  ) AS month
$$;
REVOKE ALL ON FUNCTION private.analytics_months(date, date) FROM PUBLIC, anon, authenticated, service_role;

-- Society-local month (YYYY-MM) of an instant.
CREATE FUNCTION private.analytics_period(p_society_id uuid, p_at timestamptz)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_char(p_at AT TIME ZONE private.analytics_timezone(p_society_id), 'YYYY-MM')
$$;
REVOKE ALL ON FUNCTION private.analytics_period(uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- Percentage with one decimal; null when there is nothing to divide by.
CREATE FUNCTION private.analytics_percent(p_part numeric, p_whole numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_whole IS NULL OR p_whole = 0 THEN NULL
    ELSE round(COALESCE(p_part, 0) * 100 / p_whole, 1) END
$$;
REVOKE ALL ON FUNCTION private.analytics_percent(numeric, numeric) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.analytics_selected_keys(p_society_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT preference.metric_keys FROM public.analytics_preferences AS preference
      WHERE preference.society_id = p_society_id),
    (SELECT array_agg(catalogue.metric_key ORDER BY catalogue.sort_position)
      FROM private.analytics_catalogue() AS catalogue WHERE catalogue.default_on)
  )
$$;
REVOKE ALL ON FUNCTION private.analytics_selected_keys(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.analytics_audit(
  p_society_id uuid, p_action text, p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin' ELSE 'committee' END,
    'analytics.' || p_action, 'analytics', p_society_id::text, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.analytics_audit(uuid, text, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.analytics_settings_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_preference public.analytics_preferences;
BEGIN
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  SELECT * INTO v_preference FROM public.analytics_preferences WHERE society_id = p_society_id;
  RETURN jsonb_build_object(
    'metrics', to_jsonb(private.analytics_selected_keys(p_society_id)),
    'isDefault', v_preference.society_id IS NULL,
    'version', COALESCE(v_preference.version, 0),
    'updatedAt', v_preference.updated_at,
    'catalogue', (
      SELECT jsonb_agg(jsonb_build_object(
        'key', catalogue.metric_key,
        'module', catalogue.module_key,
        'defaultOn', catalogue.default_on,
        'money', catalogue.money,
        'moduleEnabled', private.module_enabled(p_society_id, catalogue.module_key)
      ) ORDER BY catalogue.sort_position)
      FROM private.analytics_catalogue() AS catalogue
    )
  );
END;
$$;

-- p_expected_version is 0 while the society still uses the defaults.
CREATE FUNCTION public.analytics_settings_update(
  p_society_id uuid, p_metric_keys text[], p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_current public.analytics_preferences;
  v_keys text[];
BEGIN
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_request_id IS NOT NULL AND char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request id is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_metric_keys IS NULL OR p_expected_version IS NULL OR p_expected_version < 0
    OR array_position(p_metric_keys, NULL) IS NOT NULL
    OR cardinality(p_metric_keys) <> (SELECT count(DISTINCT key) FROM unnest(p_metric_keys) AS key)
    OR EXISTS (
      SELECT 1 FROM unnest(p_metric_keys) AS key
      WHERE key NOT IN (SELECT catalogue.metric_key FROM private.analytics_catalogue() AS catalogue)
    )
  THEN
    RAISE EXCEPTION 'The analytics metrics are invalid.' USING ERRCODE = '22023';
  END IF;
  SET LOCAL lock_timeout = '5s';

  SELECT array_agg(catalogue.metric_key ORDER BY catalogue.sort_position) INTO v_keys
  FROM private.analytics_catalogue() AS catalogue
  WHERE catalogue.metric_key = ANY (p_metric_keys);
  v_keys := COALESCE(v_keys, ARRAY[]::text[]);

  SELECT * INTO v_current FROM public.analytics_preferences WHERE society_id = p_society_id FOR UPDATE;
  IF COALESCE(v_current.version, 0) <> p_expected_version THEN
    RAISE EXCEPTION 'The analytics settings changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;

  IF v_current.society_id IS NULL THEN
    INSERT INTO public.analytics_preferences (society_id, metric_keys, updated_by)
    VALUES (p_society_id, v_keys, auth.uid())
    ON CONFLICT (society_id) DO NOTHING;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The analytics settings changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
  ELSE
    UPDATE public.analytics_preferences
    SET metric_keys = v_keys, version = version + 1, updated_by = auth.uid(), updated_at = clock_timestamp()
    WHERE society_id = p_society_id;
  END IF;

  PERFORM private.analytics_audit(
    p_society_id, 'settings_update',
    jsonb_build_object('metrics', to_jsonb(v_keys), 'previous', to_jsonb(v_current.metric_keys)),
    p_request_id
  );
  RETURN public.analytics_settings_get(p_society_id);
END;
$$;

CREATE FUNCTION public.analytics_dashboard(p_society_id uuid, p_months integer, p_money_range text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_today date;
  v_from date;
  v_fy_from date;
  v_metric_from date;
  v_selected text[];
  v_metric record;
  v_result jsonb;
  v_metrics jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF p_months IS NULL OR p_months NOT IN (3, 6, 12)
    OR p_money_range IS NULL OR p_money_range NOT IN ('months', 'fy')
  THEN
    RAISE EXCEPTION 'The analytics range is invalid.' USING ERRCODE = '22023';
  END IF;

  v_today := private.analytics_today(p_society_id);
  v_from := (date_trunc('month', v_today::timestamp) - make_interval(months => p_months - 1))::date;
  v_fy_from := make_date(
    CASE WHEN extract(month FROM v_today) >= 4 THEN extract(year FROM v_today)::integer
      ELSE extract(year FROM v_today)::integer - 1 END,
    4, 1
  );
  v_selected := private.analytics_selected_keys(p_society_id);

  FOR v_metric IN
    SELECT catalogue.metric_key, catalogue.module_key, catalogue.money
    FROM private.analytics_catalogue() AS catalogue
    WHERE catalogue.metric_key = ANY (v_selected)
      AND private.module_enabled(p_society_id, catalogue.module_key)
    ORDER BY catalogue.sort_position
  LOOP
    v_metric_from := CASE WHEN v_metric.money AND p_money_range = 'fy' THEN v_fy_from ELSE v_from END;
    -- The function name comes from the closed catalogue above, never from caller input.
    EXECUTE format('SELECT private.%I($1, $2, $3)', 'analytics_metric_' || replace(v_metric.metric_key, '.', '_'))
      INTO v_result
      USING p_society_id, v_metric_from, v_today;
    v_metrics := v_metrics || jsonb_build_array(
      v_result || jsonb_build_object(
        'key', v_metric.metric_key,
        'module', v_metric.module_key,
        'from', v_metric_from,
        'to', v_today,
        'range', CASE WHEN v_metric.money AND p_money_range = 'fy' THEN 'fy' ELSE 'months' END
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'today', v_today,
    'timezone', private.analytics_timezone(p_society_id),
    'months', p_months,
    'moneyRange', p_money_range,
    'from', v_from,
    'fyFrom', v_fy_from,
    'generatedAt', clock_timestamp(),
    'metrics', v_metrics
  );
END;
$$;

-- Audits an admin export; the export itself re-reads analytics_dashboard.
CREATE FUNCTION public.analytics_export_record(
  p_society_id uuid, p_format text, p_months integer, p_money_range text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin']::text[], false);
  IF p_format IS NULL OR p_format NOT IN ('csv', 'pdf')
    OR p_months IS NULL OR p_months NOT IN (3, 6, 12)
    OR p_money_range IS NULL OR p_money_range NOT IN ('months', 'fy')
    OR (p_request_id IS NOT NULL AND char_length(p_request_id) NOT BETWEEN 1 AND 128)
  THEN
    RAISE EXCEPTION 'The analytics export is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.analytics_audit(
    p_society_id, 'export',
    jsonb_build_object('format', p_format, 'months', p_months, 'moneyRange', p_money_range,
      'metrics', (
        SELECT COALESCE(jsonb_agg(catalogue.metric_key ORDER BY catalogue.sort_position), '[]'::jsonb)
        FROM private.analytics_catalogue() AS catalogue
        WHERE catalogue.metric_key = ANY (private.analytics_selected_keys(p_society_id))
          AND private.module_enabled(p_society_id, catalogue.module_key)
      )),
    p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_settings_get(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.analytics_settings_update(uuid, text[], integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.analytics_dashboard(uuid, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.analytics_export_record(uuid, text, integer, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.analytics_settings_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_settings_update(uuid, text[], integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_export_record(uuid, text, integer, text, text) TO authenticated;
