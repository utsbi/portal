-- ===========================================================================
-- FINDING D1: is_conversation_participant(_conversation_id, _uid) is a
-- membership oracle.
--
-- The 2-arg helper (20260614000001 ~:34-51) is SECURITY DEFINER and GRANTed
-- EXECUTE to `authenticated`, and it takes a caller-supplied `_uid`. Any
-- authenticated user can therefore probe `is_conversation_participant(C, U)` for
-- ANY conversation C and ANY user U and learn whether U is in C — a membership
-- oracle leaking the social graph.
--
-- We cannot simply REVOKE EXECUTE from `authenticated`: the RLS policies on
-- conversations / messages / conversation_participants call this function in
-- their USING clauses, and an RLS USING expression is evaluated AS THE QUERYING
-- USER. Revoking would make every normal query fail with
-- "permission denied for function is_conversation_participant".
--
-- FIX: remove the caller-controlled argument. Introduce a 1-arg
-- is_conversation_participant(_conversation_id) that derives the identity from
-- auth.uid() internally (still SECURITY DEFINER so it can read
-- conversation_participants without recursing into that table's own RLS), repoint
-- every RLS policy that called the 2-arg form with auth.uid() to the 1-arg form,
-- then DROP the 2-arg version so the oracle no longer exists.
--
-- REFERENCES UPDATED (exhaustive — grep of all migrations for
-- `is_conversation_participant` shows the function is only used in these three
-- policies; the messaging directory/realtime migrations query the
-- conversation_participants table directly, not this function):
--   * conversations  "Participants can view conversations"      (SELECT)
--   * messages       "Participants can view messages"           (SELECT)
--   * messages       "Participants can send messages"           (INSERT)
--   * conversation_participants
--                    "Participants can view co-participants"     (SELECT)
--
-- Idempotent: CREATE OR REPLACE for the new function; DROP POLICY IF EXISTS +
-- CREATE for each policy; DROP FUNCTION IF EXISTS for the old 2-arg form.
-- ===========================================================================

-- 1) New 1-arg participant check keyed on auth.uid() (no caller-supplied uid).
CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  _conversation_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.profiles pr ON pr.id = cp.profile_id
    WHERE cp.conversation_id = _conversation_id
      AND pr.uid = auth.uid()
  );
$$;

-- Helper is used inside policies; keep it off the anon API surface and grant it
-- to authenticated so RLS USING clauses (evaluated as the querying user) work.
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(bigint) TO authenticated;

-- 2) Repoint every RLS policy from the 2-arg form to the new 1-arg form.

-- conversations: participant may read.
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id));

-- messages: participants read.
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

-- messages: participants send (sender must be the caller AND a participant).
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_uid = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- conversation_participants: participant may read the roster.
DROP POLICY IF EXISTS "Participants can view co-participants" ON public.conversation_participants;
CREATE POLICY "Participants can view co-participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

-- 3) Drop the oracle. No remaining references after the repoints above.
DROP FUNCTION IF EXISTS public.is_conversation_participant(bigint, uuid);
