-- 20260605000000_retarget_public_policies.sql
--
-- Security hardening: re-target accidentally-public RLS policies to {authenticated}
-- and close the now-safe anon EXECUTE on the 3 SECURITY DEFINER helpers.
--
-- BACKGROUND
-- ----------
-- Many RLS policies were created without an explicit `TO` clause, so Postgres
-- defaulted them to the `{public}` role. Because Supabase grants `anon` blanket
-- table privileges, anon-issued queries actually *evaluate* these `{public}`
-- policies. Every policy retargeted below is gated on a signed-in identity
-- (auth.uid(), user_profile_id(auth.uid()), is_project_member/_director(),
-- is_director(), current_user_role(), private.user_project_ids()) -- i.e. it was
-- clearly intended for authenticated users only.
--
-- This is defense-in-depth, NOT a fix for an active leak: read-probes as the
-- `anon` role return 0 rows (helpers evaluate false) or hard-fail with
-- "permission denied for function ..." today. After this migration anon no
-- longer matches any of these policies at all.
--
-- INTENTIONALLY LEFT PUBLIC (not touched by this migration):
--   * public.website_forms "Anyone can submit website forms" (INSERT, WITH CHECK true)
--     -> anonymous website/contact intake, public-by-design.
--
-- Each policy below is recreated with the EXACT same cmd / USING / WITH CHECK,
-- only the role target changes from {public} -> authenticated. Idempotent via
-- DROP POLICY IF EXISTS + CREATE.

BEGIN;

-- =====================================================================
-- project_budgets  (finance: members read, directors write)
-- =====================================================================
DROP POLICY IF EXISTS "budget_read" ON public.project_budgets;
CREATE POLICY "budget_read" ON public.project_budgets
  FOR SELECT TO authenticated
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "budget_insert" ON public.project_budgets;
CREATE POLICY "budget_insert" ON public.project_budgets
  FOR INSERT TO authenticated
  WITH CHECK (is_project_director(project_id));

DROP POLICY IF EXISTS "budget_update" ON public.project_budgets;
CREATE POLICY "budget_update" ON public.project_budgets
  FOR UPDATE TO authenticated
  USING (is_project_director(project_id))
  WITH CHECK (is_project_director(project_id));

DROP POLICY IF EXISTS "budget_delete" ON public.project_budgets;
CREATE POLICY "budget_delete" ON public.project_budgets
  FOR DELETE TO authenticated
  USING (is_project_director(project_id));

-- =====================================================================
-- budget_categories  (members read, directors write)
-- =====================================================================
DROP POLICY IF EXISTS "cat_read" ON public.budget_categories;
CREATE POLICY "cat_read" ON public.budget_categories
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM project_budgets b
    WHERE ((b.id = budget_categories.budget_id) AND is_project_member(b.project_id))));

DROP POLICY IF EXISTS "cat_write" ON public.budget_categories;
CREATE POLICY "cat_write" ON public.budget_categories
  FOR ALL TO authenticated
  USING (EXISTS ( SELECT 1
     FROM project_budgets b
    WHERE ((b.id = budget_categories.budget_id) AND is_project_director(b.project_id))))
  WITH CHECK (EXISTS ( SELECT 1
     FROM project_budgets b
    WHERE ((b.id = budget_categories.budget_id) AND is_project_director(b.project_id))));

-- =====================================================================
-- budget_transactions  (members read, directors write)
-- =====================================================================
DROP POLICY IF EXISTS "tx_read" ON public.budget_transactions;
CREATE POLICY "tx_read" ON public.budget_transactions
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM project_budgets b
    WHERE ((b.id = budget_transactions.budget_id) AND is_project_member(b.project_id))));

DROP POLICY IF EXISTS "tx_write" ON public.budget_transactions;
CREATE POLICY "tx_write" ON public.budget_transactions
  FOR ALL TO authenticated
  USING (EXISTS ( SELECT 1
     FROM project_budgets b
    WHERE ((b.id = budget_transactions.budget_id) AND is_project_director(b.project_id))))
  WITH CHECK (EXISTS ( SELECT 1
     FROM project_budgets b
    WHERE ((b.id = budget_transactions.budget_id) AND is_project_director(b.project_id))));

-- =====================================================================
-- tickets  (clients/members/directors, project-scoped)
-- =====================================================================
DROP POLICY IF EXISTS "Clients can insert requests" ON public.tickets;
CREATE POLICY "Clients can insert requests" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK ((ticket_type = 'request'::ticket_type) AND (current_user_role() = 'client'::text) AND ((project_id IS NULL) OR is_project_member(project_id)));

DROP POLICY IF EXISTS "Members and directors can insert reports" ON public.tickets;
CREATE POLICY "Members and directors can insert reports" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK ((ticket_type = 'report'::ticket_type) AND (current_user_role() = ANY (ARRAY['director'::text, 'member'::text])) AND ((project_id IS NULL) OR is_project_member(project_id)));

DROP POLICY IF EXISTS "Project members can view tickets" ON public.tickets;
CREATE POLICY "Project members can view tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (is_director(auth.uid()) OR ((project_id IS NOT NULL) AND is_project_member(project_id)));

DROP POLICY IF EXISTS "Project members can update tickets" ON public.tickets;
CREATE POLICY "Project members can update tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING ((auth.uid() = uid) OR is_director(auth.uid()) OR ((project_id IS NOT NULL) AND (EXISTS ( SELECT 1
     FROM (project_members pm
       JOIN profiles p ON ((p.id = pm.profile_id)))
    WHERE ((pm.project_id = tickets.project_id) AND (p.uid = auth.uid()))))))
  WITH CHECK ((auth.uid() = uid) OR is_director(auth.uid()) OR ((project_id IS NOT NULL) AND (EXISTS ( SELECT 1
     FROM (project_members pm
       JOIN profiles p ON ((p.id = pm.profile_id)))
    WHERE ((pm.project_id = tickets.project_id) AND (p.uid = auth.uid()))))));

-- =====================================================================
-- profiles  (own profile + director view)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = uid);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = uid)
  WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS "Directors can view all profiles" ON public.profiles;
CREATE POLICY "Directors can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_director(auth.uid()));

-- =====================================================================
-- project_members  (members view their memberships, directors manage)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view project memberships" ON public.project_members;
CREATE POLICY "Users can view project memberships" ON public.project_members
  FOR SELECT TO authenticated
  USING (project_id IN ( SELECT private.user_project_ids() AS user_project_ids));

DROP POLICY IF EXISTS "Directors can assign members to projects" ON public.project_members;
CREATE POLICY "Directors can assign members to projects" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (is_director(auth.uid()));

DROP POLICY IF EXISTS "Directors can remove members from projects" ON public.project_members;
CREATE POLICY "Directors can remove members from projects" ON public.project_members
  FOR DELETE TO authenticated
  USING (is_director(auth.uid()));

-- =====================================================================
-- projects  (members view their projects)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;
CREATE POLICY "Users can view their projects" ON public.projects
  FOR SELECT TO authenticated
  USING (id IN ( SELECT private.user_project_ids() AS user_project_ids));

-- =====================================================================
-- conversation_reads  (own read receipts)
-- =====================================================================
DROP POLICY IF EXISTS "own reads select" ON public.conversation_reads;
CREATE POLICY "own reads select" ON public.conversation_reads
  FOR SELECT TO authenticated
  USING (profile_id = user_profile_id(auth.uid()));

DROP POLICY IF EXISTS "own reads insert" ON public.conversation_reads;
CREATE POLICY "own reads insert" ON public.conversation_reads
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = user_profile_id(auth.uid()));

DROP POLICY IF EXISTS "own reads update" ON public.conversation_reads;
CREATE POLICY "own reads update" ON public.conversation_reads
  FOR UPDATE TO authenticated
  USING (profile_id = user_profile_id(auth.uid()))
  WITH CHECK (profile_id = user_profile_id(auth.uid()));

-- =====================================================================
-- message_attachments  (attachments of viewable / sent messages)
-- =====================================================================
DROP POLICY IF EXISTS "see attachments of viewable messages" ON public.message_attachments;
CREATE POLICY "see attachments of viewable messages" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM (messages m
       JOIN conversations c ON ((c.id = m.conversation_id)))
    WHERE ((m.id = message_attachments.message_id) AND ((c.client_profile_id = user_profile_id(auth.uid())) OR (c.director_profile_id = user_profile_id(auth.uid()))))));

DROP POLICY IF EXISTS "insert attachments to messages you sent" ON public.message_attachments;
CREATE POLICY "insert attachments to messages you sent" ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1
     FROM messages m
    WHERE ((m.id = message_attachments.message_id) AND (m.sender_uid = auth.uid()))));

DROP POLICY IF EXISTS "delete attachments of messages you sent" ON public.message_attachments;
CREATE POLICY "delete attachments of messages you sent" ON public.message_attachments
  FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1
     FROM messages m
    WHERE ((m.id = message_attachments.message_id) AND (m.sender_uid = auth.uid()))));

-- =====================================================================
-- message_unfurls  (unfurls of viewable messages)
-- =====================================================================
DROP POLICY IF EXISTS "see unfurls for viewable messages" ON public.message_unfurls;
CREATE POLICY "see unfurls for viewable messages" ON public.message_unfurls
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM (messages m
       JOIN conversations c ON ((c.id = m.conversation_id)))
    WHERE ((m.id = message_unfurls.message_id) AND ((c.client_profile_id = user_profile_id(auth.uid())) OR (c.director_profile_id = user_profile_id(auth.uid()))))));

-- =====================================================================
-- custom_form_submissions  (submitter + form owner + project members)
-- =====================================================================
DROP POLICY IF EXISTS "Users can insert own submissions" ON public.custom_form_submissions;
CREATE POLICY "Users can insert own submissions" ON public.custom_form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only submitter can update" ON public.custom_form_submissions;
CREATE POLICY "Only submitter can update" ON public.custom_form_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authorized deletion" ON public.custom_form_submissions;
CREATE POLICY "Authorized deletion" ON public.custom_form_submissions
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
     FROM public.custom_form_schemas s
    WHERE ((s.id = custom_form_submissions.form_id) AND (s.created_by = auth.uid())))));

DROP POLICY IF EXISTS "Users can view relevant submissions" ON public.custom_form_submissions;
CREATE POLICY "Users can view relevant submissions" ON public.custom_form_submissions
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
     FROM public.custom_form_schemas s
    WHERE ((s.id = custom_form_submissions.form_id) AND ((s.created_by = auth.uid()) OR (custom_form_submissions.project_id IN ( SELECT private.user_project_ids() AS user_project_ids)))))));

-- =====================================================================
-- questionnaire_responses  (own responses)
-- =====================================================================
DROP POLICY IF EXISTS "users can read responses" ON public.questionnaire_responses;
CREATE POLICY "users can read responses" ON public.questionnaire_responses
  FOR SELECT TO authenticated
  USING (auth.uid() = uid);

DROP POLICY IF EXISTS "users can create responses" ON public.questionnaire_responses;
CREATE POLICY "users can create responses" ON public.questionnaire_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS "users can update responses" ON public.questionnaire_responses;
CREATE POLICY "users can update responses" ON public.questionnaire_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = uid)
  WITH CHECK (auth.uid() = uid);

-- =====================================================================
-- client_files  (own files)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their own files" ON public.client_files;
CREATE POLICY "Users can view their own files" ON public.client_files
  FOR SELECT TO authenticated
  USING (auth.uid() = uid);

DROP POLICY IF EXISTS "Users can insert their own files" ON public.client_files;
CREATE POLICY "Users can insert their own files" ON public.client_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS "Users can delete their own files" ON public.client_files;
CREATE POLICY "Users can delete their own files" ON public.client_files
  FOR DELETE TO authenticated
  USING (auth.uid() = uid);

-- =====================================================================
-- client_knowledge  (legacy {public} duplicates of the {authenticated}
-- "own documents" policies; retargeted, predicates preserved verbatim)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their own knowledge" ON public.client_knowledge;
CREATE POLICY "Users can view their own knowledge" ON public.client_knowledge
  FOR SELECT TO authenticated
  USING (auth.uid() = uid);

DROP POLICY IF EXISTS "Users can insert their own knowledge" ON public.client_knowledge;
CREATE POLICY "Users can insert their own knowledge" ON public.client_knowledge
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS "Users can delete their own knowledge" ON public.client_knowledge;
CREATE POLICY "Users can delete their own knowledge" ON public.client_knowledge
  FOR DELETE TO authenticated
  USING (auth.uid() = uid);

-- =====================================================================
-- lifecycle_projects / lifecycle_tasks / lifecycle_task_assignees
-- (member-visible read policies; the "Directors can manage" ALL policies
--  are already {authenticated} and untouched)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view lifecycle projects" ON public.lifecycle_projects;
CREATE POLICY "Users can view lifecycle projects" ON public.lifecycle_projects
  FOR SELECT TO authenticated
  USING (project_id IN ( SELECT private.user_project_ids() AS user_project_ids));

DROP POLICY IF EXISTS "Users can view lifecycle tasks" ON public.lifecycle_tasks;
CREATE POLICY "Users can view lifecycle tasks" ON public.lifecycle_tasks
  FOR SELECT TO authenticated
  USING (lifecycle_project_id IN ( SELECT lifecycle_projects.id
     FROM lifecycle_projects
    WHERE (lifecycle_projects.project_id IN ( SELECT private.user_project_ids() AS user_project_ids))));

DROP POLICY IF EXISTS "Users can view task assignees" ON public.lifecycle_task_assignees;
CREATE POLICY "Users can view task assignees" ON public.lifecycle_task_assignees
  FOR SELECT TO authenticated
  USING (task_id IN ( SELECT lt.id
     FROM (lifecycle_tasks lt
       JOIN lifecycle_projects lp ON ((lp.id = lt.lifecycle_project_id)))
    WHERE (lp.project_id IN ( SELECT private.user_project_ids() AS user_project_ids))));

-- =====================================================================
-- Close anon EXECUTE on the 3 SECURITY DEFINER helpers.
--
-- SAFE NOW because, after the retargeting above, NO remaining {public} RLS
-- policy references any of these helpers. Verified from pg_policies: the only
-- {public}-role policies that called current_user_role / is_project_member /
-- is_project_director were on project_budgets, budget_categories,
-- budget_transactions and tickets -- all retargeted to {authenticated} above.
-- (Helpers user_profile_id / is_director / private.user_project_ids are out of
--  scope for this REVOKE; anon already lacks EXECUTE on the first two, and
--  user_project_ids lives in the non-exposed `private` schema.)
--
-- Closes the 3 `anon_security_definer_function_executable` advisor warnings.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.current_user_role()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(bigint)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_director(bigint)    FROM PUBLIC, anon;

-- Re-affirm EXECUTE for the roles that legitimately call them (idempotent).
GRANT EXECUTE ON FUNCTION public.current_user_role()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(bigint)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_director(bigint)    TO authenticated, service_role;

COMMIT;
