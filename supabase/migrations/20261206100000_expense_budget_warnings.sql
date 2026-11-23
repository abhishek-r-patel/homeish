-- Add P42.2 burn-rate warnings and year-end projections to approved budget reports.

ALTER FUNCTION public.expense_budget_report(uuid, integer, date)
  RENAME TO expense_budget_report_p41_3_unsafe;
ALTER FUNCTION public.expense_budget_report_p41_3_unsafe(uuid, integer, date)
  SET SCHEMA private;
REVOKE ALL ON FUNCTION private.expense_budget_report_p41_3_unsafe(
  uuid, integer, date
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.expense_budget_report_p41_3_safe(
  p_society_id uuid, p_financial_year integer, p_as_of date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget public.expense_budgets;
  year_start date;
  year_end date;
  elapsed_months integer;
  forecast_method text;
  opening_money_paise bigint;
  accounts_added_paise bigint;
  today date;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  today := private.expense_budget_today(p_society_id);
  IF p_financial_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Choose a valid financial year.' USING ERRCODE = '22023';
  END IF;
  year_start := make_date(p_financial_year, 4, 1);
  year_end := make_date(p_financial_year + 1, 3, 31);
  IF p_as_of IS NULL OR p_as_of NOT BETWEEN year_start AND year_end
    OR p_as_of > today
  THEN
    RAISE EXCEPTION 'Choose an as-of date inside the financial year.'
      USING ERRCODE = '22023';
  END IF;
  elapsed_months := (
    (
      extract(year FROM p_as_of)::integer * 12
      + extract(month FROM p_as_of)::integer
    ) - (
      p_financial_year * 12 + 4
    ) + 1
  );
  SELECT * INTO budget FROM public.expense_budgets
  WHERE society_id = p_society_id
    AND financial_year = p_financial_year
    AND status = 'approved';
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'financial_year', p_financial_year,
      'from', year_start,
      'to', year_end,
      'as_of', p_as_of,
      'approved', false,
      'forecast_method', coalesce((
        SELECT settings ->> 'budget_forecast_method'
        FROM public.module_configs
        WHERE society_id = p_society_id AND module_key = 'expense'
      ), 'budget'),
      'months_averaged', 0,
      'summary', '[]'::jsonb,
      'months', '[]'::jsonb,
      'cash_flow', '[]'::jsonb,
      'opening_money_paise', 0,
      'accounts_added_opening_paise', 0
    );
  END IF;
  SELECT coalesce(settings ->> 'budget_forecast_method', 'budget')
  INTO forecast_method
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'expense';
  SELECT coalesce(sum(private.expense_balance(
    p_society_id, account.id, year_start - 1
  )), 0)::bigint
  INTO opening_money_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id
    AND account.opening_on < year_start;
  SELECT coalesce(sum(account.opening_balance_paise), 0)::bigint
  INTO accounts_added_paise
  FROM public.expense_accounts AS account
  WHERE account.society_id = p_society_id
    AND account.opening_on BETWEEN year_start AND year_end;
  RETURN (
    WITH RECURSIVE heads AS (
      SELECT category.id AS category_id, NULL::text AS income_type,
        category.name, 'spending'::text AS kind
      FROM public.expense_categories AS category
      WHERE category.society_id = p_society_id
      UNION ALL
      SELECT NULL::uuid, income.kind, income.label, 'income'
      FROM (VALUES
        ('billing', 'Maintenance collections'),
        ('donation', 'Donations'),
        ('interest', 'Interest'),
        ('other', 'Other income')
      ) AS income(kind, label)
    ), changes_by_head AS (
      SELECT
        category_id, income_type,
        sum(
          CASE WHEN direction = 'increase' THEN amount_paise
            ELSE -amount_paise END
        )::bigint AS changes_paise,
        ARRAY[
          sum(CASE WHEN direction = 'increase' THEN month_paise[1]
            ELSE -month_paise[1] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[2]
            ELSE -month_paise[2] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[3]
            ELSE -month_paise[3] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[4]
            ELSE -month_paise[4] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[5]
            ELSE -month_paise[5] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[6]
            ELSE -month_paise[6] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[7]
            ELSE -month_paise[7] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[8]
            ELSE -month_paise[8] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[9]
            ELSE -month_paise[9] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[10]
            ELSE -month_paise[10] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[11]
            ELSE -month_paise[11] END)::bigint,
          sum(CASE WHEN direction = 'increase' THEN month_paise[12]
            ELSE -month_paise[12] END)::bigint
        ]::bigint[] AS changed_months
      FROM public.expense_budget_changes
      WHERE society_id = p_society_id
        AND budget_id = budget.id
        AND voided_at IS NULL
      GROUP BY category_id, income_type
    ), plan AS (
      SELECT
        heads.*,
        line.id AS line_id,
        coalesce(line.annual_paise, 0)::bigint AS original_paise,
        coalesce(changes.changes_paise, 0)::bigint AS changes_paise,
        (
          coalesce(line.annual_paise, 0)
          + coalesce(changes.changes_paise, 0)
        )::bigint AS current_paise,
        coalesce(
          line.month_paise,
          ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::bigint[]
        ) AS original_months,
        coalesce(
          changes.changed_months,
          ARRAY[0,0,0,0,0,0,0,0,0,0,0,0]::bigint[]
        ) AS changed_months
      FROM heads
      LEFT JOIN public.expense_budget_lines AS line
        ON line.budget_id = budget.id
        AND line.category_id IS NOT DISTINCT FROM heads.category_id
        AND line.income_type IS NOT DISTINCT FROM heads.income_type
      LEFT JOIN changes_by_head AS changes
        ON changes.category_id IS NOT DISTINCT FROM heads.category_id
        AND changes.income_type IS NOT DISTINCT FROM heads.income_type
    ), month_plan AS (
      SELECT
        plan.*,
        month_number,
        (year_start + (month_number - 1) * interval '1 month')::date AS month_start,
        (
          plan.original_months[month_number]
          + plan.changed_months[month_number]
        )::bigint AS budget_paise
      FROM plan
      CROSS JOIN generate_series(1, 12) AS month_number
    ), actuals AS (
      SELECT *
      FROM private.expense_budget_head_actuals(
        p_society_id, year_start, p_as_of
      )
    ), monthly_actual AS (
      SELECT category_id, income_type, month, sum(amount_paise)::bigint
        AS actual_paise
      FROM actuals
      GROUP BY category_id, income_type, month
    ), actual_totals AS (
      SELECT category_id, income_type, sum(amount_paise)::bigint AS actual_paise
      FROM actuals
      GROUP BY category_id, income_type
    ), plan_actual AS (
      SELECT
        plan.*,
        coalesce(actual.actual_paise, 0)::bigint AS actual_to_date_paise,
        (
          SELECT sum(plan.original_months[month_number]
            + plan.changed_months[month_number])
          FROM generate_series(1, elapsed_months) AS month_number
        )::bigint AS plan_to_date_paise
      FROM plan
      LEFT JOIN actual_totals AS actual
        ON actual.category_id IS NOT DISTINCT FROM plan.category_id
        AND actual.income_type IS NOT DISTINCT FROM plan.income_type
    ), summary AS (
      SELECT
        plan_actual.*,
        CASE WHEN kind = 'income'
          THEN actual_to_date_paise - plan_to_date_paise
          ELSE plan_to_date_paise - actual_to_date_paise
        END AS difference_paise,
        CASE
          WHEN plan_to_date_paise > 0
            THEN round(actual_to_date_paise::numeric * 10000 / plan_to_date_paise)::double precision
          ELSE NULL
        END AS percent_used_bp,
        line_id IS NOT NULL OR changes_paise <> 0 AS budgeted
      FROM plan_actual
    ), cash_actual AS (
      SELECT
        (entry.entry_date
          - (extract(day FROM entry.entry_date)::integer - 1))::date AS month,
        sum(CASE WHEN entry.direction = 'in'
          THEN entry.amount_paise ELSE 0 END)::bigint AS money_in_paise,
        sum(CASE WHEN entry.direction = 'out'
          THEN entry.amount_paise ELSE 0 END)::bigint AS money_out_paise
      FROM public.expense_book_entries AS entry
      WHERE entry.society_id = p_society_id
        AND entry.entry_date BETWEEN year_start AND p_as_of
        AND entry.transfer_pair_id IS NULL
      GROUP BY (
        entry.entry_date
          - (extract(day FROM entry.entry_date)::integer - 1)
      )::date
    ), cash_plan AS (
      SELECT
        month_plan.month_start,
        sum(CASE WHEN kind = 'income' THEN budget_paise ELSE 0 END)::bigint
          AS budget_in_paise,
        sum(CASE WHEN kind = 'spending' THEN budget_paise ELSE 0 END)::bigint
          AS budget_out_paise
      FROM month_plan
      GROUP BY month_plan.month_start
    ), average_input AS (
      SELECT
        month_start,
        coalesce(cash_actual.money_in_paise, 0)::bigint AS money_in_paise,
        coalesce(cash_actual.money_out_paise, 0)::bigint AS money_out_paise
      FROM (
        SELECT (year_start + (month_number - 1) * interval '1 month')::date
          AS month_start
        FROM generate_series(1, 12) AS month_number
      ) AS calendar
      LEFT JOIN cash_actual ON cash_actual.month = calendar.month_start
      WHERE (
        calendar.month_start + interval '1 month' - interval '1 day'
      )::date <= p_as_of
    ), averages AS (
      SELECT
        count(*)::integer AS months_averaged,
        coalesce(round(avg(money_in_paise))::bigint, 0) AS money_in_paise,
        coalesce(round(avg(money_out_paise))::bigint, 0) AS money_out_paise
      FROM (
        SELECT * FROM average_input ORDER BY month_start DESC LIMIT 3
      ) AS recent
    ), cash_months AS (
      SELECT
        calendar.month_start,
        calendar.month_number,
        CASE
          WHEN calendar.month_end <= p_as_of
            THEN coalesce(cash_actual.money_in_paise, 0)
          WHEN forecast_method = 'budget'
            THEN coalesce(cash_plan.budget_in_paise, 0)
          WHEN forecast_method = 'average_3_months' AND averages.months_averaged > 0
            THEN averages.money_in_paise
          ELSE 0
        END::bigint AS money_in_paise,
        CASE
          WHEN calendar.month_end <= p_as_of
            THEN coalesce(cash_actual.money_out_paise, 0)
          WHEN forecast_method = 'budget'
            THEN coalesce(cash_plan.budget_out_paise, 0)
          WHEN forecast_method = 'average_3_months' AND averages.months_averaged > 0
            THEN averages.money_out_paise
          ELSE 0
        END::bigint AS money_out_paise,
        calendar.month_end > p_as_of
          AND forecast_method <> 'none' AS is_estimate,
        calendar.month_end <= p_as_of
          OR forecast_method = 'budget'
          OR (
            forecast_method = 'average_3_months'
            AND averages.months_averaged > 0
          ) AS forecast_available,
        averages.months_averaged
      FROM (
        SELECT
          month_number,
          (year_start + (month_number - 1) * interval '1 month')::date
            AS month_start,
          (
            year_start + month_number * interval '1 month'
              - interval '1 day'
          )::date AS month_end
        FROM generate_series(1, 12) AS month_number
      ) AS calendar
      LEFT JOIN cash_actual ON cash_actual.month = calendar.month_start
      LEFT JOIN cash_plan ON cash_plan.month_start = calendar.month_start
      CROSS JOIN averages
    ), cash_running(month_number, month_start, money_in_paise, money_out_paise,
      net_paise, running_paise, is_estimate, forecast_available,
      months_averaged) AS (
      SELECT
        month_number, month_start, money_in_paise, money_out_paise,
        money_in_paise - money_out_paise,
        opening_money_paise + accounts_added_paise
          + money_in_paise - money_out_paise,
        is_estimate, forecast_available, months_averaged
      FROM cash_months WHERE month_number = 1
      UNION ALL
      SELECT
        current.month_number, current.month_start,
        current.money_in_paise, current.money_out_paise,
        current.money_in_paise - current.money_out_paise,
        previous.running_paise
          + current.money_in_paise - current.money_out_paise,
        current.is_estimate, current.forecast_available,
        current.months_averaged
      FROM cash_running AS previous
      JOIN cash_months AS current
        ON current.month_number = previous.month_number + 1
    )
    SELECT jsonb_build_object(
      'financial_year', p_financial_year,
      'from', year_start,
      'to', year_end,
      'as_of', p_as_of,
      'approved', true,
      'forecast_method', forecast_method,
      'months_averaged', (
        SELECT months_averaged FROM averages
      ),
      'summary', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'category_id', category_id,
          'income_type', income_type,
          'name', name,
          'kind', kind,
          'budgeted', budgeted,
          'original_paise', original_paise,
          'changes_paise', changes_paise,
          'current_paise', current_paise,
          'plan_to_date_paise', plan_to_date_paise,
          'actual_to_date_paise', actual_to_date_paise,
          'difference_paise', difference_paise,
          'difference_label', CASE
            WHEN kind = 'income' AND difference_paise > 0 THEN 'Better than budget'
            WHEN kind = 'spending' AND difference_paise < 0 THEN 'Over budget'
            ELSE 'Below budget'
          END,
          'percent_used_bp', percent_used_bp
        ) ORDER BY kind, lower(name))
        FROM summary
      ), '[]'::jsonb),
      'months', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'month', calendar.month_start,
          'heads', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
              'category_id', month_plan.category_id,
              'income_type', month_plan.income_type,
              'name', month_plan.name,
              'kind', month_plan.kind,
              'budget_paise', month_plan.budget_paise,
              'actual_paise', coalesce(monthly_actual.actual_paise, 0)
            ) ORDER BY month_plan.kind, lower(month_plan.name)), '[]'::jsonb)
            FROM month_plan
            LEFT JOIN monthly_actual
              ON monthly_actual.category_id IS NOT DISTINCT FROM month_plan.category_id
              AND monthly_actual.income_type IS NOT DISTINCT FROM month_plan.income_type
              AND monthly_actual.month = month_plan.month_start
            WHERE month_plan.month_number = calendar.month_number
          )
        ) ORDER BY calendar.month_number)
        FROM (
          SELECT
            month_number,
            (year_start + (month_number - 1) * interval '1 month')::date
              AS month_start
          FROM generate_series(1, 12) AS month_number
        ) AS calendar
      ), '[]'::jsonb),
      'cash_flow', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month_start,
          'money_in_paise', money_in_paise,
          'money_out_paise', money_out_paise,
          'net_paise', net_paise,
          'running_paise', running_paise,
          'is_estimate', is_estimate,
          'forecast_available', forecast_available
        ) ORDER BY month_number)
        FROM cash_running
      ), '[]'::jsonb),
      'opening_money_paise', opening_money_paise,
      'accounts_added_opening_paise', accounts_added_paise
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.expense_budget_report_p41_3_safe(
  uuid, integer, date
) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION private.expense_budget_report_p41_3_unsafe(uuid, integer, date);

CREATE FUNCTION private.expense_budget_warning_row(
  p_row jsonb, p_watch_percent integer, p_finished boolean
)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  actual_paise bigint;
  budgeted boolean;
  burn_rate_bp double precision;
  current_paise bigint;
  kind text;
  plan_to_date_paise bigint;
  projected_overrun_paise numeric;
  projected_year_end_paise numeric;
  projection_available boolean := false;
  warning text;
BEGIN
  kind := p_row ->> 'kind';
  budgeted := coalesce((p_row ->> 'budgeted')::boolean, false);
  IF kind <> 'spending' OR NOT budgeted THEN
    RETURN p_row || jsonb_build_object(
      'burn_rate_bp', NULL,
      'warning', NULL,
      'projected_year_end_paise', NULL,
      'projected_overrun_paise', NULL,
      'projection_available', false
    );
  END IF;

  current_paise := (p_row ->> 'current_paise')::bigint;
  plan_to_date_paise := (p_row ->> 'plan_to_date_paise')::bigint;
  actual_paise := (p_row ->> 'actual_to_date_paise')::bigint;
  IF plan_to_date_paise > 0 THEN
    burn_rate_bp := round(
      actual_paise::numeric * 10000 / plan_to_date_paise
    )::double precision;
  END IF;

  IF p_finished THEN
    projected_year_end_paise := actual_paise;
    projection_available := true;
  ELSIF plan_to_date_paise > 0 THEN
    projected_year_end_paise := (
      round(current_paise::numeric * actual_paise
        / plan_to_date_paise / 100) * 100
    );
    projection_available := true;
  END IF;

  IF projection_available AND projected_year_end_paise > current_paise THEN
    projected_overrun_paise := projected_year_end_paise - current_paise;
  END IF;
  IF (plan_to_date_paise > 0 AND actual_paise > plan_to_date_paise)
    OR projected_overrun_paise IS NOT NULL
  THEN
    warning := 'over_plan';
  ELSIF plan_to_date_paise > 0
    AND actual_paise::numeric * 100
      >= plan_to_date_paise::numeric * p_watch_percent
  THEN
    warning := 'watch';
  ELSIF burn_rate_bp IS NOT NULL THEN
    warning := 'on_track';
  END IF;

  RETURN p_row || jsonb_build_object(
    'burn_rate_bp', burn_rate_bp,
    'warning', warning,
    'projected_year_end_paise', projected_year_end_paise,
    'projected_overrun_paise', projected_overrun_paise,
    'projection_available', projection_available
  );
END;
$$;
REVOKE ALL ON FUNCTION private.expense_budget_warning_row(
  jsonb, integer, boolean
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_budget_report(
  p_society_id uuid, p_financial_year integer, p_as_of date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base_report jsonb;
  finished boolean;
  summary jsonb;
  watch_percent integer;
BEGIN
  base_report := private.expense_budget_report_p41_3_safe(
    p_society_id, p_financial_year, p_as_of
  );
  SELECT coalesce(
    (config.settings ->> 'budget_watch_percent')::integer, 90
  ) INTO watch_percent
  FROM public.module_configs AS config
  WHERE config.society_id = p_society_id
    AND config.module_key = 'expense';
  finished := (base_report ->> 'as_of')::date = (base_report ->> 'to')::date;
  SELECT coalesce(jsonb_agg(
    private.expense_budget_warning_row(
      item.row, coalesce(watch_percent, 90), finished
    )
    ORDER BY item.position
  ), '[]'::jsonb)
  INTO summary
  FROM jsonb_array_elements(base_report -> 'summary')
    WITH ORDINALITY AS item(row, position);
  RETURN jsonb_set(base_report, '{summary}', summary);
END;
$$;

REVOKE ALL ON FUNCTION public.expense_budget_report(uuid, integer, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.expense_budget_report(uuid, integer, date)
  TO authenticated;
