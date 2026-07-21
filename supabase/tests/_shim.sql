-- =====================================================================
-- SUPABASE PLATFORM SHIM (test harness only — NOT a migration)
-- =====================================================================
-- The supabase/postgres image's own entrypoint already provisions most of the
-- platform surface the migrations assume: the anon/authenticated/service_role
-- roles, the auth + storage + extensions schemas, auth.users, storage.objects /
-- storage.buckets / storage.foldername(), and the supabase_realtime publication.
--
-- This shim therefore does only two things:
--   1. OVERRIDE auth.uid()/auth.role()/auth.jwt()/auth.email() so they read from
--      the JSON `request.jwt.claims` GUC (the modern Supabase claim shape and the
--      one this harness sets via SET ROLE + set_config). The stock image
--      functions read the LEGACY singular GUCs (request.jwt.claim.sub /
--      request.jwt.claim.role), which our impersonation helpers do not set.
--   2. Be defensive for any FALLBACK image that does NOT pre-provision these
--      (roles / schemas / storage shims / publication) via IF-NOT-EXISTS guards.
--
-- Everything here is idempotent. Run as the superuser (postgres), which can
-- CREATE OR REPLACE functions owned by supabase_auth_admin.
-- =====================================================================

-- ---- Defensive role creation (no-ops on the real image, which already has
--      these). Guard on existence so a non-superuser connection (the image's
--      `postgres` role is not a full superuser) never tries to CREATE ROLE /
--      BYPASSRLS when the roles already exist. ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

-- NOTE: we deliberately do NOT `GRANT anon, authenticated, service_role TO
-- CURRENT_USER` here. On the supabase/postgres image the connecting `postgres`
-- role ALREADY has membership in all three (so SET ROLE works), and issuing that
-- GRANT segfaults the backend (a pgsodium/event-trigger bug on role grants
-- involving CURRENT_USER, signal 11). If a future fallback image lacked the
-- membership, add it conditionally only for that image — never unconditionally.

-- ---- Defensive schema creation (no-ops on the real image) ----
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
-- `private` is created by the baseline migration, but be defensive.
CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA auth       TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage    TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public     TO anon, authenticated, service_role;

-- ---- Defensive auth.users (FK target). Real image already has a richer one. ----
CREATE TABLE IF NOT EXISTS auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- (1) Override auth.* to read the JSON request.jwt.claims GUC.
-- =====================================================================
CREATE OR REPLACE FUNCTION auth.jwt()
  RETURNS jsonb
  LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- uid: NULL when no claims (acting as anon / no session).
CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql STABLE
AS $$
  SELECT nullif(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      ''
    ),
    ''
  )::uuid;
$$;

-- role: defaults to 'anon' when no claims are set.
CREATE OR REPLACE FUNCTION auth.role()
  RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION auth.email()
  RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT nullif(
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email',
    ''
  );
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role(), auth.email()
  TO anon, authenticated, service_role;

-- =====================================================================
-- (2) Defensive storage shims for any fallback image lacking them.
-- =====================================================================
-- Create the tables if absent (fallback image); on the real image they exist
-- but with an OLDER storage schema that lacks the columns the baseline migration
-- inserts into (public / file_size_limit / allowed_mime_types). Add them so the
-- baseline's `INSERT INTO storage.buckets (... public, file_size_limit,
-- allowed_mime_types)` succeeds. ADD COLUMN IF NOT EXISTS is a no-op when present.
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL
);
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS public             boolean DEFAULT false;
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS file_size_limit    bigint;
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS allowed_mime_types text[];
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS created_at         timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS storage.objects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id   text REFERENCES storage.buckets(id),
  name        text
);
ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS owner      uuid;
ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS metadata   jsonb;
ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- storage.foldername('a/b/c') -> {a,b}; storage.filename('a/b/c') -> 'c'.
-- CREATE OR REPLACE so the harness's known-good definitions are used even if the
-- image ships its own (behaviorally identical) versions.
CREATE OR REPLACE FUNCTION storage.foldername(name text)
  RETURNS text[]
  LANGUAGE sql IMMUTABLE
AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

CREATE OR REPLACE FUNCTION storage.filename(name text)
  RETURNS text
  LANGUAGE sql IMMUTABLE
AS $$
  SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$$;

GRANT EXECUTE ON FUNCTION storage.foldername(text), storage.filename(text)
  TO anon, authenticated, service_role;

-- ---- supabase_realtime publication (baseline ADDs tables to it) ----
DO $$ BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Default privileges that Supabase grants on NEW public objects ----
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
