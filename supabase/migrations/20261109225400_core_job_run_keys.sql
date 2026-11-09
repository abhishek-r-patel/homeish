CREATE TABLE public.job_run_keys (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  job_name text NOT NULL,
  period_key text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (society_id, job_name, period_key),
  CONSTRAINT job_run_keys_job_name_check
    CHECK (char_length(job_name) BETWEEN 1 AND 120),
  CONSTRAINT job_run_keys_period_key_check
    CHECK (char_length(period_key) BETWEEN 1 AND 40)
);

ALTER TABLE public.job_run_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_run_keys_service_manage
  ON public.job_run_keys FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.job_run_keys FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.job_run_keys TO service_role;
