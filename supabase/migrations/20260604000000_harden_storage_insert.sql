-- ---------------------------------------------------------------------------
-- Harden storage INSERT policies (WRITE-side IDOR close-out)
--
-- Follow-up to 20260603000000_harden_storage_rls.sql, which closed the
-- READ-side IDOR on 'Message Attachments' and 'ticket-attachments' but left
-- their INSERT policies at authenticated-only (WITH CHECK (bucket_id = ...)).
-- That left a WRITE-side IDOR: any authenticated user could upload junk objects
-- into either bucket.
--
-- The fix requires the uploader to embed a verifiable scope segment as the
-- FIRST path segment of the object name, mirroring the already-correct
-- 'questionnaire-attachments' pattern (first segment = auth.uid()::text). The
-- coupled frontend change (deployed BEFORE this migration is applied to live)
-- now writes:
--
--   * Message Attachments (MessageThread.tsx::uploadOneFile):
--         `${conversationId}/${uuid}-${file.name}`
--     -> first segment = conversation id. The same string is persisted to
--        public.message_attachments.path, so the READ-side policy from
--        20260603000000 (which joins ma.path = objects.name) keeps matching.
--
--   * ticket-attachments — BOTH ticket flows:
--       - Requests (lib/supabase/requests.ts):      `${projectId}/${ts}-${file.name}`
--       - Reports  (NewReportModal.tsx):            `${projectId}/${ts}-${file.name}`
--     -> first segment = project id (was `${ticketId}/...` for requests and
--        literal `reports/...` for reports). The same string is persisted into
--        tickets.attachments[].path, so the READ-side policy from 20260603000000
--        (which keys off that stored path) keeps matching.
--
-- ⚠️  DEPLOY ORDER: apply this migration to LIVE *only after* the coupled
--     frontend change is live in production. Applying it earlier would reject
--     in-flight uploads still using the old flat/unscoped paths. See the
--     accompanying writeup for the grace-handling note.
--
-- Idempotent: every policy is DROP ... IF EXISTS then recreated. Applying it
-- twice is safe.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 'Message Attachments' INSERT: scope by conversation id (first path segment).
--
-- The object is inserted into storage BEFORE the message_attachments row, so
-- we cannot join against that row at INSERT time. Instead we verify the first
-- path segment names a conversation the uploader participates in (client or
-- director profile). This is the same participant rule enforced by the
-- read-side policy and by public.message_attachments' own RLS, evaluated
-- directly against public.conversations so it is cheap and needs no
-- not-yet-existing row.
--
-- (storage.foldername(name))[1] is the conversation id as text; cast to bigint
-- to match conversations.id. Uploads whose first segment is not a numeric
-- conversation id, or names a conversation the user is not part of, are
-- rejected.
-- ===========================================================================
DROP POLICY IF EXISTS "Allow message attachments cu7rh3_0" ON storage.objects;
CREATE POLICY "Allow message attachments cu7rh3_0" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'Message Attachments'::text
    AND (storage.foldername(name))[1] ~ '^[0-9]+$'
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = ((storage.foldername(name))[1])::bigint
        AND (
          c.client_profile_id   = public.user_profile_id(auth.uid())
          OR c.director_profile_id = public.user_profile_id(auth.uid())
        )
    )
  );

-- ===========================================================================
-- 'ticket-attachments' INSERT: scope by project id (first path segment).
--
-- Both ticket flows now prefix uploads with `${projectId}/`. The ticket row
-- (and its attachments jsonb) is still written AFTER the storage upload, so we
-- verify the project segment directly: the uploader must be a member of the
-- project named by the first path segment, OR a director. This mirrors the
-- read-side ticket visibility rule (director OR project member).
--
-- (storage.foldername(name))[1] is the project id as text; cast to bigint for
-- is_project_member. Uploads whose first segment is not a numeric project id,
-- or names a project the user is not a member of (and is not a director),
-- are rejected.
-- ===========================================================================
DROP POLICY IF EXISTS "Authenticated users can upload ticket-attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload ticket-attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'::text
    AND (storage.foldername(name))[1] ~ '^[0-9]+$'
    AND (
      public.is_director(auth.uid())
      OR public.is_project_member(((storage.foldername(name))[1])::bigint)
    )
  );
