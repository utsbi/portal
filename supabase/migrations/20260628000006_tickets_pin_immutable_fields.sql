-- ===========================================================================
-- S10: tickets UPDATE allowed identity/ownership mutation (incl. re-parenting).
--
-- The "Project members can update tickets" policy (20260606000000) gates UPDATE
-- on:
--   USING/WITH CHECK: (auth.uid() = uid) OR is_director(auth.uid())
--                     OR (project_id IS NOT NULL AND <member of tickets.project_id>)
-- The `auth.uid() = uid` arm short-circuits the membership check, so the ticket
-- CREATOR can change ANY column on their own row -- including project_id (moving
-- the ticket into a victim project), ticket_type (request<->report forge),
-- customer_id, or uid. WITH CHECK can't catch this because it cannot reference
-- the row's prior (OLD) values.
--
-- FIX: a BEFORE UPDATE trigger pins the immutable identity/ownership columns
-- (uid, ticket_type, project_id, customer_id, created_at). Editable workflow
-- columns (status, assign_to, subject, message, department, attachments, ...)
-- are unaffected -- a legitimate status change or attachment update still works.
-- Mirrors the messages identity-lock in 20260628000001.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; DROP TRIGGER IF EXISTS.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.prevent_ticket_identity_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.uid IS DISTINCT FROM OLD.uid THEN
    RAISE EXCEPTION 'tickets.uid is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.ticket_type IS DISTINCT FROM OLD.ticket_type THEN
    RAISE EXCEPTION 'tickets.ticket_type is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'tickets.project_id is immutable (no re-parenting)'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'tickets.customer_id is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'tickets.created_at is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ticket_identity_mutation ON public.tickets;
CREATE TRIGGER trg_prevent_ticket_identity_mutation
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ticket_identity_mutation();
