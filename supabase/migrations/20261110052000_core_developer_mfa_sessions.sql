CREATE TABLE private.developer_mfa_sessions (
  session_id uuid PRIMARY KEY REFERENCES auth.sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.developers (user_id) ON DELETE CASCADE,
  session_expires_at timestamptz NOT NULL,
  mfa_verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.developer_mfa_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.developer_mfa_sessions
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'aal' = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM private.developer_mfa_sessions AS developer_session
      WHERE developer_session.session_id = CASE
        WHEN auth.jwt() ->> 'session_id'
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (auth.jwt() ->> 'session_id')::uuid
        ELSE NULL
      END
        AND developer_session.user_id = (SELECT auth.uid())
        AND developer_session.session_expires_at > now()
        AND developer_session.mfa_verified_at > now() - interval '15 minutes'
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.session_developer_access()
RETURNS TABLE (
  is_developer_account boolean,
  mfa_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.developers AS developer
      WHERE developer.user_id = (SELECT auth.uid())
    ),
    private.is_developer()
$$;

CREATE OR REPLACE FUNCTION public.record_developer_mfa()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  current_session_id uuid;
  session_created_at timestamptz;
  developer_expires_at timestamptz;
BEGIN
  IF current_user_id IS NULL OR auth.jwt() ->> 'aal' <> 'aal2' THEN
    RAISE EXCEPTION 'A verified second factor is required.'
      USING ERRCODE = '42501';
  END IF;

  IF (auth.jwt() ->> 'session_id')
    !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'A valid auth session is required.'
      USING ERRCODE = '28000';
  END IF;
  current_session_id := (auth.jwt() ->> 'session_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.developers AS developer
    WHERE developer.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT session.created_at
  INTO session_created_at
  FROM auth.sessions AS session
  WHERE session.id = current_session_id
    AND session.user_id = current_user_id;

  IF session_created_at IS NULL THEN
    RAISE EXCEPTION 'The auth session is no longer available.'
      USING ERRCODE = '28000';
  END IF;

  developer_expires_at := session_created_at + interval '4 hours';
  IF developer_expires_at <= now() THEN
    RAISE EXCEPTION 'The developer session has expired.'
      USING ERRCODE = '28000';
  END IF;

  INSERT INTO private.developer_mfa_sessions (
    session_id,
    user_id,
    session_expires_at,
    mfa_verified_at
  )
  VALUES (
    current_session_id,
    current_user_id,
    developer_expires_at,
    now()
  )
  ON CONFLICT (session_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        session_expires_at = EXCLUDED.session_expires_at,
        mfa_verified_at = EXCLUDED.mfa_verified_at;

  RETURN developer_expires_at;
END
$$;

REVOKE ALL ON FUNCTION public.session_developer_access()
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_developer_mfa()
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.session_developer_access()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_developer_mfa()
  TO authenticated;

GRANT EXECUTE ON FUNCTION private.is_developer()
  TO authenticated, service_role;
