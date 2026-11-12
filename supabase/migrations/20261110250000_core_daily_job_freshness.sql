ALTER TABLE public.job_run_keys
  ADD COLUMN completed_at timestamptz;

GRANT UPDATE ON TABLE public.job_run_keys TO service_role;

CREATE OR REPLACE FUNCTION public.daily_job_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;

  WITH active_societies AS (
    SELECT society.id
    FROM public.societies AS society
    WHERE society.status IN ('trial', 'active')
  ),
  required_jobs(job_name) AS (
    VALUES
      ('billing.late_fees'),
      ('billing.reminders'),
      ('billing.stale_payments'),
      ('visitor.expire'),
      ('service_request.auto_close')
  ),
  expected_runs AS (
    SELECT society.id AS society_id, job.job_name
    FROM active_societies AS society
    CROSS JOIN required_jobs AS job
  ),
  latest_runs AS (
    SELECT run.society_id, run.job_name, max(run.completed_at) AS completed_at
    FROM public.job_run_keys AS run
    WHERE run.completed_at IS NOT NULL
    GROUP BY run.society_id, run.job_name
  ),
  society_coverage AS (
    SELECT
      count(*)::integer AS expected_count,
      count(*) FILTER (
        WHERE run.completed_at >= now() - interval '36 hours'
      )::integer AS recent_count
    FROM expected_runs AS expected
    LEFT JOIN latest_runs AS run
      ON run.society_id = expected.society_id
      AND run.job_name = expected.job_name
  ),
  global_run AS (
    SELECT max(run.completed_at) AS completed_at
    FROM public.job_run_keys AS run
    WHERE run.job_name = 'housekeeping.retention'
  ),
  all_completed AS (
    SELECT run.completed_at
    FROM expected_runs AS expected
    JOIN latest_runs AS run
      ON run.society_id = expected.society_id
      AND run.job_name = expected.job_name
    UNION ALL
    SELECT completed_at FROM global_run
  ),
  summary AS (
    SELECT
      coverage.expected_count,
      coverage.recent_count,
      global_run.completed_at AS global_completed_at,
      (SELECT min(completed_at) FROM all_completed) AS last_completed_at
    FROM society_coverage AS coverage
    CROSS JOIN global_run
  )
  SELECT pg_catalog.jsonb_build_object(
    'lastDailyRunAt', summary.last_completed_at,
    'ageHours', CASE
      WHEN summary.last_completed_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - summary.last_completed_at)) / 3600)::integer
    END,
    'staleAfterHours', 36,
    'missingTaskCount',
      summary.expected_count - summary.recent_count
      + CASE
          WHEN summary.expected_count > 0
            AND summary.global_completed_at < now() - interval '36 hours'
          THEN 1
          WHEN summary.expected_count > 0
            AND summary.global_completed_at IS NULL
          THEN 1
          ELSE 0
        END,
    'isFresh',
      summary.expected_count = 0
      OR (
        summary.expected_count = summary.recent_count
        AND summary.global_completed_at >= now() - interval '36 hours'
      )
  )
  INTO result
  FROM summary;

  RETURN result;
END
$$;

REVOKE ALL ON FUNCTION public.daily_job_health_summary()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.daily_job_health_summary()
  TO authenticated, service_role;
