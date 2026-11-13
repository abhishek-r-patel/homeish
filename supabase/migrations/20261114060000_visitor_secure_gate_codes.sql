-- Generate visitor pre-approval gate codes from a CSPRNG instead of random().
CREATE OR REPLACE FUNCTION public.visitor_pre_approval_create(
  p_unit_id uuid,
  p_visitor_name text,
  p_valid_from timestamptz,
  p_valid_to timestamptz,
  p_vehicle_no text,
  p_request_id text
)
RETURNS public.visitor_pre_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  society uuid;
  approval public.visitor_pre_approvals;
  generated_code text;
  random_bytes bytea;
  random_value integer;
  attempt integer := 0;
BEGIN
  SELECT unit.society_id INTO society
  FROM public.units unit
  WHERE unit.id = p_unit_id AND private.occupies_unit(unit.id)
    AND unit.active
    AND private.module_enabled(unit.society_id, 'visitor')
    AND private.society_writable(unit.society_id);
  IF society IS NULL THEN
    RAISE EXCEPTION 'Household manager access is required.' USING ERRCODE = '42501';
  END IF;
  LOOP
    attempt := attempt + 1;
    -- Rejection sampling keeps the six-digit code uniform: 16,000,000 is the
    -- largest multiple of 1,000,000 below 2^24.
    LOOP
      random_bytes := extensions.gen_random_bytes(3);
      random_value := (get_byte(random_bytes, 0) << 16)
        | (get_byte(random_bytes, 1) << 8)
        | get_byte(random_bytes, 2);
      EXIT WHEN random_value < 16000000;
    END LOOP;
    generated_code := lpad((random_value % 1000000)::text, 6, '0');
    BEGIN
      INSERT INTO public.visitor_pre_approvals (
        society_id, unit_id, visitor_name, valid_from, valid_to,
        vehicle_no, code, created_by
      )
      VALUES (
        society, p_unit_id, p_visitor_name, p_valid_from, p_valid_to,
        NULLIF(upper(regexp_replace(COALESCE(p_vehicle_no, ''), '\s', '', 'g')), ''),
        generated_code, auth.uid()
      )
      RETURNING * INTO approval;
      RETURN approval;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 20 THEN
        RAISE EXCEPTION 'Could not allocate a unique visitor code.' USING ERRCODE = '23505';
      END IF;
    END;
  END LOOP;
END;
$$;
