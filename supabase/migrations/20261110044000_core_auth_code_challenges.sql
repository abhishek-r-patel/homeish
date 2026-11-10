CREATE TABLE public.auth_code_challenges (
  email_key text PRIMARY KEY,
  challenge_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  failed_attempts smallint NOT NULL DEFAULT 0,
  in_flight_attempts smallint NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  CONSTRAINT auth_code_challenges_email_key_check
    CHECK (char_length(email_key) BETWEEN 1 AND 120),
  CONSTRAINT auth_code_challenges_attempts_check
    CHECK (
      failed_attempts BETWEEN 0 AND 5
      AND in_flight_attempts BETWEEN 0 AND 5
    ),
  CONSTRAINT auth_code_challenges_expiry_check
    CHECK (expires_at > created_at)
);

CREATE INDEX auth_code_challenges_expires_at_idx
  ON public.auth_code_challenges (expires_at);

ALTER TABLE public.auth_code_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_code_challenges_service_manage
  ON public.auth_code_challenges FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.auth_code_challenges
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_code_challenges
  TO service_role;

CREATE OR REPLACE FUNCTION public.start_auth_code_challenge(p_email_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_challenge_id uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF p_email_key IS NULL
     OR p_email_key !~ '^[a-z0-9:_-]{1,120}$'
  THEN
    RAISE EXCEPTION 'Invalid authentication challenge key.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.auth_code_challenges
  WHERE expires_at <= clock_timestamp();

  INSERT INTO public.auth_code_challenges (
    email_key,
    challenge_id,
    expires_at
  )
  VALUES (
    p_email_key,
    new_challenge_id,
    clock_timestamp() + interval '10 minutes'
  )
  ON CONFLICT (email_key)
  DO UPDATE SET
    challenge_id = EXCLUDED.challenge_id,
    created_at = clock_timestamp(),
    expires_at = EXCLUDED.expires_at,
    failed_attempts = 0,
    in_flight_attempts = 0,
    consumed_at = NULL;

  RETURN new_challenge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_auth_code_attempt(p_email_key text)
RETURNS TABLE (
  status text,
  challenge_id uuid,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_challenge_id uuid;
  current_expiry timestamptz;
  current_consumed_at timestamptz;
BEGIN
  IF p_email_key IS NULL
     OR p_email_key !~ '^[a-z0-9:_-]{1,120}$'
  THEN
    RAISE EXCEPTION 'Invalid authentication challenge key.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.auth_code_challenges AS challenge
  SET in_flight_attempts = challenge.in_flight_attempts + 1
  WHERE challenge.email_key = p_email_key
    AND challenge.expires_at > clock_timestamp()
    AND challenge.consumed_at IS NULL
    AND challenge.failed_attempts + challenge.in_flight_attempts < 5
  RETURNING challenge.challenge_id INTO current_challenge_id;

  IF FOUND THEN
    RETURN QUERY
    SELECT 'reserved'::text, current_challenge_id, 0;
    RETURN;
  END IF;

  SELECT challenge.challenge_id, challenge.expires_at, challenge.consumed_at
    INTO current_challenge_id, current_expiry, current_consumed_at
  FROM public.auth_code_challenges AS challenge
  WHERE challenge.email_key = p_email_key;

  IF NOT FOUND
     OR current_expiry <= clock_timestamp()
  THEN
    RETURN QUERY
    SELECT 'invalid'::text, NULL::uuid, 0;
    RETURN;
  END IF;

  IF current_consumed_at IS NOT NULL THEN
    RETURN QUERY
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.auth_code_challenges AS challenge
          WHERE challenge.challenge_id = current_challenge_id
            AND challenge.failed_attempts >= 5
        )
        THEN 'locked'::text
        ELSE 'invalid'::text
      END,
      current_challenge_id,
      GREATEST(
        1,
        ceil(extract(epoch FROM (current_expiry - clock_timestamp())))::integer
      );
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'locked'::text,
    current_challenge_id,
    GREATEST(
      1,
      ceil(extract(epoch FROM (current_expiry - clock_timestamp())))::integer
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_auth_code_attempt(
  p_challenge_id uuid,
  p_failed boolean,
  p_succeeded boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated boolean;
BEGIN
  IF p_challenge_id IS NULL
     OR p_failed IS NULL
     OR p_succeeded IS NULL
     OR (p_failed AND p_succeeded)
  THEN
    RAISE EXCEPTION 'Invalid authentication attempt result.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.auth_code_challenges AS challenge
  SET in_flight_attempts = challenge.in_flight_attempts - 1,
      failed_attempts = challenge.failed_attempts
        + CASE WHEN p_failed THEN 1 ELSE 0 END,
      consumed_at = CASE
        WHEN p_succeeded
          OR (p_failed AND challenge.failed_attempts + 1 >= 5)
        THEN clock_timestamp()
        ELSE challenge.consumed_at
      END
  WHERE challenge.challenge_id = p_challenge_id
    AND challenge.in_flight_attempts > 0
    AND challenge.consumed_at IS NULL
  RETURNING true INTO updated;

  RETURN COALESCE(updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.start_auth_code_challenge(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_auth_code_challenge(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.reserve_auth_code_attempt(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_auth_code_attempt(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.finish_auth_code_attempt(uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_auth_code_attempt(uuid, boolean, boolean)
  TO service_role;
