CREATE FUNCTION public.daily_job_societies()
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Daily job society discovery requires service role.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id
  FROM public.societies AS s
  WHERE s.status IN ('trial', 'active')
  ORDER BY s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.daily_job_societies()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_job_societies()
  TO service_role;