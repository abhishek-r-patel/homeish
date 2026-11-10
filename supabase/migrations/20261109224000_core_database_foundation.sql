CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA extensions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only records cannot be changed.'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.reject_append_only_mutation() FROM PUBLIC, anon, authenticated, service_role;
