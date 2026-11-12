CREATE OR REPLACE FUNCTION public.visitor_expire_run(
  p_society_id uuid,
  p_request_trace text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expired_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'The visitor expiry job requires service role.'
      USING ERRCODE = '42501';
  END IF;
  IF p_society_id IS NULL
     OR p_request_trace IS NULL
     OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The visitor expiry job input is invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'visitor')
     OR NOT private.society_writable(p_society_id) THEN
    RETURN 0;
  END IF;

  UPDATE public.visitor_entries
  SET status = 'expired'
  WHERE society_id = p_society_id
    AND status = 'pending'
    AND respond_by <= clock_timestamp();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_expire_run(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_expire_run(uuid, text)
  TO service_role;
