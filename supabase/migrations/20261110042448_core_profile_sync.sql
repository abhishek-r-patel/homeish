CREATE OR REPLACE FUNCTION private.sync_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email::extensions.citext, 'Homeish member')
  ON CONFLICT (id)
  DO UPDATE SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_profile_from_auth_user()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER auth_user_profile_sync
  AFTER INSERT OR UPDATE OF email, email_confirmed_at
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_profile_from_auth_user();