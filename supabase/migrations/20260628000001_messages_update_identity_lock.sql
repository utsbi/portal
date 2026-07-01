-- ===========================================================================
-- S1 [CRITICAL]: messages UPDATE allowed a cross-tenant write / identity forge.
--
-- The baseline UPDATE policy "Allow users to update their own messages" gated
-- BOTH its USING and WITH CHECK on `sender_uid = auth.uid()` only:
--
--   FOR UPDATE TO authenticated
--   USING (sender_uid = auth.uid()) WITH CHECK (sender_uid = auth.uid());
--
-- Because the WITH CHECK re-validated only the sender, an authenticated sender
-- could UPDATE their own row to RE-PARENT it into ANY conversation_id -- even a
-- conversation they cannot read or participate in -- and could simultaneously
-- forge sender_role / reply_to_id. That is a cross-tenant write (a message
-- planted in a victim's thread) plus an identity/threading forgery.
--
-- FIX (two layers):
--   1. WITH CHECK additionally requires the row's (post-update) conversation is
--      one the editor participates in: public.is_conversation_participant(
--      conversation_id). This blocks relocating a message into a conversation the
--      caller is not part of, and revokes edit rights once a sender is removed
--      from a conversation.
--   2. A BEFORE UPDATE trigger pins the immutable identity/threading columns
--      (sender_uid, sender_role, conversation_id, reply_to_id). RLS WITH CHECK
--      cannot reference OLD, so the only correct way to assert "these columns may
--      not change" is a trigger that compares NEW vs OLD and raises. This also
--      makes the relocation attempt fail loudly instead of silently.
--
-- Editable columns (content, edited_at, is_pinned, pinned_at, ...) are
-- unaffected: a legitimate self-edit by a still-present participant succeeds.
--
-- is_conversation_participant(bigint) is the 1-arg, auth.uid()-derived helper
-- introduced in 20260618000002 (SECURITY DEFINER, granted to authenticated, used
-- the same way by the messages SELECT/INSERT policies).
--
-- Idempotent: CREATE OR REPLACE FUNCTION, DROP TRIGGER/POLICY IF EXISTS.
-- ===========================================================================

-- 1) Immutability guard for message identity/threading columns. RLS WITH CHECK
--    cannot see OLD, so enforce it in a BEFORE UPDATE trigger. SECURITY DEFINER
--    is NOT needed (it only reads NEW/OLD of the row being written).
CREATE OR REPLACE FUNCTION public.prevent_message_identity_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.sender_uid IS DISTINCT FROM OLD.sender_uid THEN
    RAISE EXCEPTION 'messages.sender_uid is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.sender_role IS DISTINCT FROM OLD.sender_role THEN
    RAISE EXCEPTION 'messages.sender_role is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'messages.conversation_id is immutable (no re-parenting)'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id THEN
    RAISE EXCEPTION 'messages.reply_to_id is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_identity_mutation ON public.messages;
CREATE TRIGGER trg_prevent_message_identity_mutation
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_identity_mutation();

-- 2) Re-create the UPDATE policy: keep the sender-ownership USING check, and
--    require the (immutable) conversation to be one the editor participates in.
DROP POLICY IF EXISTS "Allow users to update their own messages" ON public.messages;
CREATE POLICY "Allow users to update their own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_uid = auth.uid())
  WITH CHECK (
    sender_uid = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );
