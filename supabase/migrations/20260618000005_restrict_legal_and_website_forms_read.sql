-- ===========================================================================
-- FINDING D6: legal_documents and website_forms are readable by ALL
-- authenticated users (including clients).
--
-- Baseline policies:
--   * legal_documents "Authenticated users can view legal documents"
--     (20260101000000 ~:760) USING (auth.role() = 'authenticated')
--   * website_forms   "Authenticated users can view website forms"
--     (~:833) USING (auth.role() = 'authenticated')
-- Both gate on the bare `authenticated` role, so every signed-in user — clients
-- included — can read internal legal document content and the website-intake
-- submissions, which contain submitter PII (name / email / IP). These are
-- staff-only datasets.
--
-- FIX: gate both SELECT policies on public.is_director(auth.uid()) — the staff
-- predicate (fixed in 20260603000000 to honor its parameter; returns true only
-- for profiles with role = 'director'). The website_forms anon INSERT policy
-- ("Anyone can submit website forms") is the public intake path and is left
-- untouched.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE for each. Both new policies are
-- restricted TO authenticated (anon never reads either table).
-- ===========================================================================

-- legal_documents: directors only may read.
DROP POLICY IF EXISTS "Authenticated users can view legal documents" ON public.legal_documents;
DROP POLICY IF EXISTS "Directors can view legal documents" ON public.legal_documents;
CREATE POLICY "Directors can view legal documents" ON public.legal_documents
  FOR SELECT TO authenticated
  USING (public.is_director(auth.uid()));

-- website_forms: directors only may read; public (anon) INSERT intake preserved.
DROP POLICY IF EXISTS "Authenticated users can view website forms" ON public.website_forms;
DROP POLICY IF EXISTS "Directors can view website forms" ON public.website_forms;
CREATE POLICY "Directors can view website forms" ON public.website_forms
  FOR SELECT TO authenticated
  USING (public.is_director(auth.uid()));
