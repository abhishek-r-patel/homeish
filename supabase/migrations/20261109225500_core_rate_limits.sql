CREATE TABLE public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (key, window_start),
  CONSTRAINT rate_limits_key_check
    CHECK (char_length(key) BETWEEN 1 AND 200),
  CONSTRAINT rate_limits_count_check CHECK (count >= 0)
);

CREATE INDEX rate_limits_window_start_idx
  ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limits_service_manage
  ON public.rate_limits FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO service_role;
