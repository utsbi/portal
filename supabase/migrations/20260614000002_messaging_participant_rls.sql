-- ===========================================================================
-- Messaging, phase 2b: participant-based RLS (replaces client/director gating).
--
-- APPLY WITH THE UI, NOT BEFORE: this changes conversation/message visibility
-- and locks conversation creation to the create_conversation RPC, so the old
-- (client/director) create flow stops working the moment this lands. The new
-- CreateConversationModal (which calls the RPC) ships in the same change.
--
-- conversation_reads stays as-is (its policies are already own-row, so they work
-- for any participant). Conversations are created only via the SECURITY DEFINER
-- public.create_conversation (which bypasses RLS and enforces the role matrix),
-- so there is intentionally no INSERT policy on conversations.
-- ===========================================================================

-- conversations: a participant can read; no direct insert (RPC only).
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;

-- messages: participants read and send; senders still edit their own (unchanged).
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_uid = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- conversation_participants: a participant can see the roster (replaces the
-- transitional policy from phase 1). Inserts happen only via the RPC.
DROP POLICY IF EXISTS "View participants of visible conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can view co-participants" ON public.conversation_participants;
CREATE POLICY "Participants can view co-participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
