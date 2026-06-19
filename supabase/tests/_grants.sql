-- =====================================================================
-- POST-MIGRATION GRANTS (test harness only)
-- =====================================================================
-- Real Supabase grants table-wide privileges to anon/authenticated/service_role
-- on EVERY object in `public` (it re-runs these grants after migrations). The
-- D2 fix (20260618000001) REVOKEs the table-wide SELECT from anon/authenticated
-- on custom_form_schemas and re-grants column-level SELECT — that REVOKE is only
-- meaningful if the table-wide grant existed first. A bare `psql -f` of the
-- migrations never establishes those grants, so we apply them HERE, BEFORE the
-- migrations run, so the migration ordering matches production:
--   shim -> grants -> migrations (incl. D2's revoke) -> seed -> tests.
--
-- NOTE: this file is applied immediately after the BASELINE (20260101000000),
-- not at the very end — see run.sh. Applying after the baseline (which creates
-- the public tables) but before the D-fix migrations reproduces the production
-- ordering where the broad grant precedes the hardening revoke.
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
-- NOTE: we intentionally do NOT `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public`
-- here. On the supabase/postgres image the pgvector functions live in `public`
-- and are owned by a different role, so a blanket function grant emits dozens of
-- "no privileges were granted" warnings. The shim's ALTER DEFAULT PRIVILEGES
-- already grants EXECUTE on functions CREATEd by the test role from here on, and
-- each migration that needs a specific function GRANT does it explicitly.
