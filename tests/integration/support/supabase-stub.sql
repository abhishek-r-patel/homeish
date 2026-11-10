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
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table auth.users owner to supabase_auth_admin;
grant all on auth.users to postgres;

create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table auth.sessions owner to supabase_auth_admin;
grant all on auth.sessions to postgres;

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

-- Minimal Storage catalog for policies and private bucket migration tests.
create schema storage authorization postgres;
grant usage on schema storage to anon, authenticated, service_role, postgres;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb,
  unique (bucket_id, name)
);
alter table storage.objects owner to postgres;
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects
  to anon, authenticated, service_role, postgres;
grant select, insert, update, delete on storage.buckets
  to anon, authenticated, service_role, postgres;

-- Supabase's default grants for objects created by postgres in public.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
