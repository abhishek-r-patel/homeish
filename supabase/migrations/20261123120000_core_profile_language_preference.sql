ALTER TABLE public.profiles
  ADD COLUMN language_preference text NOT NULL DEFAULT 'en',
  ADD CONSTRAINT profiles_language_preference_check
    CHECK (language_preference IN ('en', 'hi'));

GRANT UPDATE (language_preference)
  ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION private.profiles_reset_anonymized_language()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'anonymized' THEN
    NEW.language_preference := 'en';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.profiles_reset_anonymized_language()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER profiles_reset_anonymized_language
  BEFORE UPDATE OF status, language_preference ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.profiles_reset_anonymized_language();
