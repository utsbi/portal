-- ===========================================================================
-- S15: Scope custom_form_schemas SELECT to tenant boundaries.
--
-- The baseline policy `custom_form_schemas_select_authenticated USING (true)`
-- (20260101000000_baseline_schema.sql ~line 730) let ANY authenticated user
-- read EVERY tenant's form definitions. The application layer relied on
-- filtering by custom_form_assignments, but RLS itself imposed no boundary, so
-- a user could enumerate other tenants' form schemas directly.
--
-- Retarget SELECT so a user sees a schema row only if:
--   * they are a director (org-wide form owners), OR
--   * they created/own the schema (created_by = auth.uid()), OR
--   * the form is assigned to them directly or to a project they belong to.
--
-- The assignment check is resolved through a SECURITY DEFINER helper in the
-- `private` schema (mirroring private.user_project_ids), NOT by referencing
-- public.custom_form_assignments inline: the assignments SELECT policy
-- (20260607000000) itself references custom_form_schemas, so an inline
-- subquery here would create mutual RLS recursion (42P17). The helper runs as
-- its owner and bypasses RLS, breaking the cycle while still scoping rows to
-- the caller.
--
-- Secret columns (public_token / public_password_hash) remain column-revoked
-- by 20260618000001 regardless of this row policy.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; DROP POLICY IF EXISTS + CREATE.
-- ===========================================================================

-- Form ids assigned to the current user, directly or via project membership.
-- SECURITY DEFINER + explicit minimal search_path, matching the established
-- private.user_project_ids() pattern; bypasses RLS to avoid policy recursion.
CREATE OR REPLACE FUNCTION private.user_assigned_form_ids()
  RETURNS SETOF bigint
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT a.form_id
  FROM public.custom_form_assignments a
  WHERE a.user_id = auth.uid()
     OR a.project_id IN (SELECT private.user_project_ids());
$$;

DROP POLICY IF EXISTS custom_form_schemas_select_authenticated ON public.custom_form_schemas;
CREATE POLICY custom_form_schemas_select_authenticated ON public.custom_form_schemas
  FOR SELECT TO authenticated USING (
    public.is_director(auth.uid())
    OR created_by = auth.uid()
    OR id IN (SELECT private.user_assigned_form_ids())
  );
