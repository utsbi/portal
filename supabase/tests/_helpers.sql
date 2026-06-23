-- =====================================================================
-- TEST IMPERSONATION HELPERS (test harness only)
-- =====================================================================
-- Each pgTAP test file runs inside a single transaction (pg_prove / our psql
-- wrapper both BEGIN ... ROLLBACK). These helpers set the role + JWT claims so
-- RLS USING/WITH CHECK clauses (evaluated AS THE QUERYING USER) see the right
-- auth.uid()/auth.role(). Always pair an impersonation with t.reset_auth() (or a
-- transaction rollback) so state does not leak between assertions.
--
-- We use SET (not SET LOCAL) for ROLE and the claims here because pgTAP runs all
-- assertions in one transaction; SET-without-LOCAL persists until reset/rollback
-- which is what we want across multiple SELECTs in one test. Tests that need to
-- drop privileges and come back call test_reset() explicitly.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS t;

-- Impersonate an authenticated user by uid.
CREATE OR REPLACE FUNCTION t.as_user(_uid uuid)
  RETURNS void
  LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text,
    false
  );
  EXECUTE 'SET ROLE authenticated';
END;
$$;

-- Impersonate the anonymous role (no session / public path).
CREATE OR REPLACE FUNCTION t.as_anon()
  RETURNS void
  LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    false
  );
  EXECUTE 'SET ROLE anon';
END;
$$;

-- Impersonate the service role (server-side / RPC path; BYPASSRLS).
CREATE OR REPLACE FUNCTION t.as_service()
  RETURNS void
  LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    false
  );
  EXECUTE 'SET ROLE service_role';
END;
$$;

-- Drop back to the test superuser and clear claims.
CREATE OR REPLACE FUNCTION t.reset_auth()
  RETURNS void
  LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$;

-- Convenience id lookups (read the fixture id table).
CREATE OR REPLACE FUNCTION t.id(_k text)
  RETURNS bigint
  LANGUAGE sql STABLE
AS $$ SELECT v FROM public._test_ids WHERE k = _k $$;

-- Fixed uids as helpers (kept in sync with _seed.sql).
CREATE OR REPLACE FUNCTION t.uid_clienta() RETURNS uuid LANGUAGE sql IMMUTABLE
  AS $$ SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $$;
CREATE OR REPLACE FUNCTION t.uid_clientb() RETURNS uuid LANGUAGE sql IMMUTABLE
  AS $$ SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid $$;
CREATE OR REPLACE FUNCTION t.uid_director() RETURNS uuid LANGUAGE sql IMMUTABLE
  AS $$ SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid $$;

GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;
