-- ===========================================================================
-- Attachment / storage RLS retarget to the participant model.
--
-- Messaging moved from the rigid (client_profile_id, director_profile_id) pair
-- to a generalized conversation_participants roster (20260614000000 ..002, then
-- 20260618000002). create_conversation (the RPC) populates ONLY
-- conversation_participants; it does NOT set conversations.client_profile_id /
-- director_profile_id. Those columns are therefore unpopulated for every
-- RPC-created conversation.
--
-- Four attachment/storage policies were never retargeted and still key on the
-- legacy client_profile_id / director_profile_id columns, so they evaluate FALSE
-- for all RPC-created conversations -- breaking attachment + unfurl visibility
-- and (since 20260604000000) message-attachment uploads for every new thread:
--
--   1. public.message_attachments  SELECT "see attachments of viewable messages"
--   2. public.message_unfurls      SELECT "see unfurls for viewable messages"
--   3. storage.objects             SELECT "Allow users to read from message
--                                           attachments cu7rh3_0"  (bucket
--                                           'Message Attachments')
--   4. storage.objects             INSERT "Allow message attachments cu7rh3_0"
--                                           (bucket 'Message Attachments')
--
-- Each is rewritten to authorize via public.is_conversation_participant(
-- conversation_id) -- the same 1-arg, auth.uid()-derived helper the messages
-- SELECT/INSERT policies already use -- deriving the conversation from the
-- message_attachments/message_unfurls row, or (for the storage INSERT, where no
-- row exists yet) from the first path segment, exactly as the prior policy did.
--
-- INSERT/SELECT coverage is preserved verbatim; only the predicate changes from
-- the legacy client/director columns to the participant check. The path-parsing
-- convention ((storage.foldername(name))[1] = conversation id, mirrored into
-- message_attachments.path) is unchanged from 20260604000000.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE for each.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) message_attachments SELECT: visible to participants of the owning thread.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "see attachments of viewable messages" ON public.message_attachments;
CREATE POLICY "see attachments of viewable messages" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2) message_unfurls SELECT: visible to participants of the owning thread.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "see unfurls for viewable messages" ON public.message_unfurls;
CREATE POLICY "see unfurls for viewable messages" ON public.message_unfurls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_unfurls.message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) storage.objects SELECT ('Message Attachments'): an object is readable iff
--    it is referenced by a message_attachments row (ma.path = objects.name)
--    whose conversation the viewer participates in. Mirrors policy 1, keyed off
--    the stored path -- safe and tight against existing object names.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow users to read from message attachments cu7rh3_0" ON storage.objects;
CREATE POLICY "Allow users to read from message attachments cu7rh3_0" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'Message Attachments'::text
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      JOIN public.messages m ON m.id = ma.message_id
      WHERE ma.path = storage.objects.name
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4) storage.objects INSERT ('Message Attachments'): the object is uploaded
--    BEFORE its message_attachments row exists, so we verify the FIRST path
--    segment names a conversation the uploader participates in -- same shape as
--    20260604000000, with the participant check replacing the client/director
--    columns. Uploads whose first segment is not a numeric conversation id, or
--    name a conversation the uploader is not part of, are rejected.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow message attachments cu7rh3_0" ON storage.objects;
CREATE POLICY "Allow message attachments cu7rh3_0" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'Message Attachments'::text
    AND (storage.foldername(name))[1] ~ '^[0-9]+$'
    AND public.is_conversation_participant(((storage.foldername(name))[1])::bigint)
  );
