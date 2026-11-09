-- Test-only stand-in for the parts of Supabase that migrations rely on: the
-- managed auth schema (users and the uid/jwt/role helpers) and Supabase's default
-- grants. Cluster roles come from roles.sql (applied first). It grants less than
-- real Supabase where unsure, so a migration that works here should not depend on
-- elevated privileges. It is NOT Supabase Auth: sign-in, sessions and tokens are
-- verified separately against homeish-testdb. Extend it only to mirror real
-- Supabase behaviour that a migration needs.

create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;

create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);
alter table auth.users owner to supabase_auth_admin;
grant all on auth.users to postgres;

-- Same claim lookups as Supabase (PostgREST sets request.jwt.claims per request).
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
      (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')),
    '')::uuid
$$;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim', true), ''),
    nullif(pg_catalog.current_setting('request.jwt.claims', true), ''))::jsonb
$$;

create function auth.role() returns text language sql stable as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '')
    ::text
$$;

alter function auth.uid() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;

grant usage on schema public to anon, authenticated, service_role, postgres;
grant create on schema public to postgres;

-- Supabase's default grants for objects created by postgres in public.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
