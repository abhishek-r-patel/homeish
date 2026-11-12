DO $$
DECLARE
  profile_auth_fk text;
BEGIN
  SELECT constraint_row.conname INTO profile_auth_fk
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.profiles'::regclass
    AND constraint_row.confrelid = 'auth.users'::regclass
    AND constraint_row.contype = 'f';

  IF profile_auth_fk IS NULL THEN
    RAISE EXCEPTION 'The profile-to-auth foreign key was not found.';
  END IF;

  EXECUTE pg_catalog.format(
    'ALTER TABLE public.profiles DROP CONSTRAINT %I',
    profile_auth_fk
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.profiles_require_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'anonymized'
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      WHERE auth_user.id = NEW.id
    )
  THEN
    RAISE EXCEPTION 'A non-anonymized profile must have an auth account.'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.profiles_require_auth_user()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER profiles_require_auth_user
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.profiles_require_auth_user();

CREATE OR REPLACE FUNCTION public.user_erasure_prepare(
  p_user_id uuid,
  p_actor_id uuid,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_status text;
  auth_account_present boolean;
  memberships_deactivated integer := 0;
  guards_disabled integer := 0;
  notifications_deleted integer := 0;
  subscriptions_deleted integer := 0;
  preparation_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_actor_id IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_user_id = p_actor_id
  THEN
    RAISE EXCEPTION 'Invalid user-erasure arguments.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.developers AS developer
    JOIN public.profiles AS actor ON actor.id = developer.user_id
    WHERE developer.user_id = p_actor_id
      AND actor.status = 'active'
  ) THEN
    RAISE EXCEPTION 'An active developer must request user erasure.'
      USING ERRCODE = '42501';
  END IF;

  SELECT target.status INTO profile_status
  FROM public.profiles AS target
  WHERE target.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The user profile was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET email = (
        'deleted+' || p_user_id::text || '@anonymized.invalid'
      )::extensions.citext,
      full_name = 'Deleted user',
      phone = NULL,
      photo_path = NULL,
      font_preference = 'manrope_sora',
      status = 'anonymized'
  WHERE id = p_user_id
    AND (
      email IS DISTINCT FROM (
        'deleted+' || p_user_id::text || '@anonymized.invalid'
      )::extensions.citext
      OR full_name IS DISTINCT FROM 'Deleted user'
      OR phone IS NOT NULL
      OR photo_path IS NOT NULL
      OR font_preference IS DISTINCT FROM 'manrope_sora'
      OR status IS DISTINCT FROM 'anonymized'
    );

  DELETE FROM public.notifications
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS notifications_deleted = ROW_COUNT;

  DELETE FROM public.push_subscriptions
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS subscriptions_deleted = ROW_COUNT;

  UPDATE public.guard_roster AS guard
  SET membership_id = NULL,
      active = false,
      pin_hash = NULL
  WHERE EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.society_id = guard.society_id
      AND membership.id = guard.membership_id
      AND membership.user_id = p_user_id
  );
  GET DIAGNOSTICS guards_disabled = ROW_COUNT;

  DELETE FROM public.developers
  WHERE user_id = p_user_id;

  UPDATE public.memberships
  SET invited_email = NULL,
      status = 'deactivated',
      left_at = COALESCE(left_at, pg_catalog.clock_timestamp())
  WHERE user_id = p_user_id
    AND (
      status <> 'deactivated'
      OR invited_email IS NOT NULL
    );
  GET DIAGNOSTICS memberships_deactivated = ROW_COUNT;

  preparation_result := pg_catalog.jsonb_build_object(
    'alreadyAnonymized', profile_status = 'anonymized',
    'authAccountPresent', EXISTS (
      SELECT 1 FROM auth.users AS auth_user WHERE auth_user.id = p_user_id
    ),
    'membershipsDeactivated', memberships_deactivated,
    'guardsDisabled', guards_disabled,
    'notificationsDeleted', notifications_deleted,
    'pushSubscriptionsDeleted', subscriptions_deleted
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.audit_logs AS audit
    WHERE audit.action = 'user.erasure_started'
      AND audit.entity_type = 'profile'
      AND audit.entity_id = p_user_id::text
  ) THEN
    INSERT INTO public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      "after",
      request_id
    )
    VALUES (
      p_actor_id,
      'developer',
      'user.erasure_started',
      'profile',
      p_user_id::text,
      preparation_result - 'authAccountPresent',
      p_request_id
    );
  END IF;

  RETURN preparation_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_erasure_complete(
  p_user_id uuid,
  p_actor_id uuid,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_actor_id IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_user_id = p_actor_id
  THEN
    RAISE EXCEPTION 'Invalid user-erasure arguments.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.developers AS developer
    JOIN public.profiles AS actor ON actor.id = developer.user_id
    WHERE developer.user_id = p_actor_id
      AND actor.status = 'active'
  ) THEN
    RAISE EXCEPTION 'An active developer must complete user erasure.'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1
  FROM public.profiles AS target
  WHERE target.id = p_user_id
    AND target.status = 'anonymized'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User erasure was not prepared.'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM auth.users AS auth_user WHERE auth_user.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'The auth account has not been deleted.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.audit_logs AS audit
    WHERE audit.action = 'user.erasure_completed'
      AND audit.entity_type = 'profile'
      AND audit.entity_id = p_user_id::text
  ) THEN
    INSERT INTO public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      "after",
      request_id
    )
    VALUES (
      p_actor_id,
      'developer',
      'user.erasure_completed',
      'profile',
      p_user_id::text,
      pg_catalog.jsonb_build_object(
        'authAccountDeleted', true,
        'profileStatus', 'anonymized',
        'historyRetained', true
      ),
      p_request_id
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'completed', true,
    'profileStatus', 'anonymized'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_erasure_prepare(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_erasure_complete(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_erasure_prepare(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.user_erasure_complete(uuid, uuid, text)
  TO service_role;
