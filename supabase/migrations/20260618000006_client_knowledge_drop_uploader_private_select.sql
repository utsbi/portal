-- ===========================================================================
-- FINDING D3 (most delicate): client_knowledge stays uploader-private because
-- the legacy uid-only SELECT policies were never dropped.
--
-- CURRENT SELECT POLICY SET on public.client_knowledge (all PERMISSIVE, OR'd):
--   (a) baseline "Users can view their own knowledge"  USING (uid = auth.uid())
--   (b) baseline "Users can view own documents"        USING (uid = auth.uid())
--   (c) 20260613000001 "Project members can view client knowledge"
--         USING (project_id IS NOT NULL AND <caller is member of project_id>)
--   (d) 20260613000003 "Uploaders can view their own unscoped knowledge"
--         USING (uid = auth.uid() AND project_id IS NULL)
--
-- Because PostgreSQL ORs permissive policies, (a)/(b) make EVERY row readable by
-- its uploader regardless of project — i.e. reads are effectively
-- uploader-private, not project-private, defeating the project-scoping work in
-- 20260613000001/3. Project teammates can read a project's rows via (c), but the
-- uploader-uid policies add an orthogonal, broader read grant that was meant to
-- be retired once project scoping landed.
--
-- GOAL: gate reads by PROJECT MEMBERSHIP, not uploader identity, without locking
-- out any access the app currently depends on.
--
-- WHAT THIS MIGRATION DOES:
--   1. DROP the two redundant uid-only SELECT policies (a) and (b). After this,
--      project-scoped rows are read via (c); NULL-project rows via (d)/(e).
--   2. ADD a director SELECT path for NULL-project rows (e), so directors (the
--      staff role) can read orphaned uploads that never got a project — see the
--      residual note below — instead of only the original uploader.
--
-- WRITE/DELETE policies are untouched: inserts/updates/deletes still use the
-- uploader-uid baseline policies plus the project-director delete policy
-- (20260613000002). Only the over-broad SELECT grant is narrowed.
--
-- match_client_knowledge IS UNAFFECTED: that RPC is SECURITY DEFINER and granted
-- to service_role only (20260613000003), so it bypasses these RLS policies; the
-- explore backend's retrieval continues to work exactly as before.
--
-- ---------------------------------------------------------------------------
-- RESIDUAL / MANUAL VERIFICATION BEFORE DEPLOY (documented, not silently hidden)
-- ---------------------------------------------------------------------------
-- Director uploads land with project_id = NULL: auto_link_director_to_projects
-- makes a director a member of EVERY project, so the 20260613000001 backfill
-- (which only assigns a project when the uploader belongs to exactly one,
-- `sub.n = 1`) skips directors, leaving their rows project-less. Such rows are:
--   * readable by their own uploader via (d),
--   * readable by ALL directors via the new (e) below,
--   * NOT readable by non-director project teammates, and
--   * NOT returned by project-filtered retrieval (they have no project_id).
-- This is acceptable for direct table reads (the app reads RAG via the
-- service-role RPC, not the authenticated role). FULLY resolving these rows so
-- they participate in project-scoped retrieval requires a DATA BACKFILL that
-- assigns each NULL-project director upload to its intended project — which
-- cannot be inferred safely from schema alone (a director belongs to all
-- projects, so there is no unambiguous source project). RECOMMENDED follow-up:
-- a product-driven backfill (e.g. derive project from upload context / Sources
-- panel) before relying on team-wide retrieval of director uploads. This
-- migration intentionally does NOT guess that mapping.
--
-- Idempotent: DROP POLICY IF EXISTS for the removals; DROP + CREATE for (e).
-- ===========================================================================

-- 1) Remove the redundant uploader-uid-only SELECT policies. (Their write
--    counterparts remain; only the over-broad read grant is removed.)
DROP POLICY IF EXISTS "Users can view their own knowledge" ON public.client_knowledge;
DROP POLICY IF EXISTS "Users can view own documents" ON public.client_knowledge;

-- 2) Director read path for NULL-project (orphaned) rows, so the staff role can
--    see director uploads that never received a project_id — not just the single
--    original uploader. Project-scoped rows are still read via the project-member
--    policy from 20260613000001; this only widens read access for NULL rows to
--    directors (a strict superset of the uploader for those orphaned rows).
DROP POLICY IF EXISTS "Directors can view unscoped client knowledge" ON public.client_knowledge;
CREATE POLICY "Directors can view unscoped client knowledge" ON public.client_knowledge
  FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    AND public.is_director(auth.uid())
  );
