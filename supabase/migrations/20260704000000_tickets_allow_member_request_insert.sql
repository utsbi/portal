-- ===========================================================================
-- Allow a director OR a project member to create a 'request' ticket.
--
-- The baseline "Clients can insert requests" policy gated INSERT on
--   current_user_role() = 'client'
-- so a director (or member) confirming the Explore agent's create_request draft
-- hit: "new row violates row-level security policy for table tickets". Requests
-- are project-scoped, so membership (or director) is the correct gate — the
-- client-only role check was too narrow now that directors also draft requests
-- via Explore.
--
-- Tighter than the old policy in one respect: a non-director must target a real
-- project they belong to (the app always sends project_id), instead of the old
-- "project_id IS NULL" escape hatch. Reports are unaffected (separate policy).
--
-- Idempotent: DROP POLICY IF EXISTS then CREATE.
-- ===========================================================================

DROP POLICY IF EXISTS "Clients can insert requests" ON public.tickets;
DROP POLICY IF EXISTS "Project members can insert requests" ON public.tickets;

CREATE POLICY "Project members can insert requests" ON public.tickets
  FOR INSERT WITH CHECK (
    (ticket_type = 'request'::extensions.ticket_type)
    AND (
      public.is_director(auth.uid())
      OR ((project_id IS NOT NULL) AND public.is_project_member(project_id))
    )
  );
