-- ===========================================================================
-- FINDING D2: custom_form_schemas leaks secret columns to authenticated users.
--
-- The baseline policy `custom_form_schemas_select_authenticated USING (true)`
-- (20260101000000 ~:730) lets EVERY authenticated user read EVERY form schema
-- row. Migration 20260610000000 then added two secret columns to that table:
--   * public_token         — the capability secret in the public share URL
--   * public_password_hash — the scrypt hash gating password-protected forms
-- Because the SELECT policy is row-level only (RLS cannot hide columns), any
-- authenticated client can SELECT these secrets for arbitrary forms, which is
-- enough to forge a public-form link or mount an offline attack on the hash.
--
-- FIX (column-level SELECT). IMPORTANT POSTGRES SEMANTICS: a *table-level*
-- `GRANT SELECT` is a single privilege that implicitly covers every column, and
-- a column-level `REVOKE SELECT (col)` does NOT subtract from it (column REVOKE
-- only acts on column-level grants). Supabase grants table-wide SELECT to the
-- `anon` and `authenticated` roles by default, so a bare column REVOKE is a
-- no-op here. The correct pattern is therefore:
--   1. REVOKE the table-level SELECT from anon/authenticated, then
--   2. GRANT SELECT back on every column EXCEPT the two secrets.
-- This is done dynamically (loop over current columns) so adding a future
-- non-secret column does NOT silently lose its read grant.
--
-- WHY THIS IS SAFE: the only code that reads public_token / public_password_hash
-- is the public-form verification path in frontend/lib/questionnaire/public.ts,
-- which runs with the SERVICE ROLE (createAdminClient, "server-only") — NOT the
-- authenticated role. The service role's grants are untouched here, so
-- server-side verification is unaffected. No authenticated-role client query
-- needs these columns.
--
-- Idempotent: REVOKE/GRANT are repeatable; the loop recomputes the column set
-- each run. Re-running simply re-asserts the same grant state.
-- ===========================================================================

DO $$
DECLARE
  _cols text;
  _role text;
BEGIN
  -- Comma-separated list of every column EXCEPT the two secrets, quoted.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO _cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'custom_form_schemas'
    AND column_name NOT IN ('public_token', 'public_password_hash');

  FOREACH _role IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    -- Drop the table-wide SELECT (which covers the secret columns) ...
    EXECUTE format(
      'REVOKE SELECT ON public.custom_form_schemas FROM %I', _role);
    -- ... and re-grant SELECT on only the non-secret columns.
    EXECUTE format(
      'GRANT SELECT (%s) ON public.custom_form_schemas TO %I', _cols, _role);
  END LOOP;
END $$;
