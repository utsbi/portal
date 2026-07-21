-- ===========================================================================
-- ADVISOR FIX: anon_security_definer_function_executable
--   public.snapshot_form_schema_version()
--
-- The Supabase security advisor flags this SECURITY DEFINER function as callable
-- by `anon` (and `authenticated`) over the PostgREST RPC surface. It is purely a
-- TRIGGER function: it is wired only to the AFTER INSERT OR UPDATE trigger
-- `trg_snapshot_form_schema_version` on public.custom_form_schemas
-- (see 20260608000000_questionnaire_schema_versions.sql ~:55-78). It takes no
-- arguments, returns `trigger`, and is never invoked directly.
--
-- VERIFICATION (performed before writing this migration):
--   * grep of supabase/migrations/ shows the only references are the CREATE
--     FUNCTION, the CREATE TRIGGER, and the DROP TRIGGER -- no RPC/SELECT use.
--   * grep of frontend/ source (excluding .next build output) shows NO
--     `.rpc("snapshot_form_schema_version")` call anywhere; the app never calls
--     it directly.
--
-- FIX: revoke EXECUTE from anon, authenticated and PUBLIC so it disappears from
-- the RPC surface. Triggers fire with the table-owner's rights regardless of who
-- holds EXECUTE on the function, so the snapshot trigger keeps working unchanged.
--
-- Idempotent: REVOKE is repeatable and is a no-op once the grant is gone.
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.snapshot_form_schema_version()
  FROM anon, authenticated, PUBLIC;
