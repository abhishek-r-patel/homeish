CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  count integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_window timestamptz;
  current_count integer;
BEGIN
  IF p_key IS NULL
     OR char_length(p_key) NOT BETWEEN 1 AND 200
     OR p_limit IS NULL
     OR p_limit NOT BETWEEN 1 AND 1000000
     OR p_window_seconds IS NULL
     OR p_window_seconds NOT BETWEEN 1 AND 86400
  THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters.'
      USING ERRCODE = '22023';
  END IF;

  current_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds)
      * p_window_seconds
  );

  INSERT INTO public.rate_limits AS current_limit (key, window_start, count)
  VALUES (p_key, current_window, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = current_limit.count + 1
  RETURNING current_limit.count INTO current_count;

  RETURN QUERY
  SELECT
    current_count <= p_limit,
    current_count,
    GREATEST(
      1,
      ceil(
        extract(
          epoch FROM (
            current_window
            + make_interval(secs => p_window_seconds)
            - clock_timestamp()
          )
        )
      )::integer
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  TO service_role;
