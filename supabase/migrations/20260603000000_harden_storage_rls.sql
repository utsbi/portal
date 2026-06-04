-- ---------------------------------------------------------------------------
-- Harden storage RLS + fix is_director()
--
-- Addresses four findings from the security review of the baseline schema
-- (which faithfully reproduces the live prod policies):
--
--   [HIGH]   1. 'Files' bucket readable by anon.
--   [HIGH]   2. 'Message Attachments' IDOR (any authed user reads/writes any).
--   [HIGH]   3. 'ticket-attachments' IDOR (any authed user reads/uploads any).
--   [MEDIUM] 4. is_director(check_uid) ignores its parameter.
--
-- Reference (already-correct) pattern: 'questionnaire-attachments' policies
-- scope by (storage.foldername(name))[1] = auth.uid()::text.
--
-- This migration is idempotent: every policy is DROP ... IF EXISTS then
-- recreated, and the function is CREATE OR REPLACE. Applying it twice is safe.
--
-- ⚠️  REVIEW BEFORE APPLYING TO LIVE — see the writeup accompanying this file.
--     In particular, the INSERT scoping for 'Message Attachments' and
--     'ticket-attachments' is constrained by how the frontend constructs
--     object paths today (no user/owner segment at upload time). The SELECT
--     tightening below is safe against existing object paths; the INSERT
--     tightening is intentionally conservative and is documented inline.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Finding 4 (MEDIUM): is_director(check_uid) must honor its parameter.
--
-- The buggy body checks auth.uid() regardless of check_uid, so any caller
-- passing a *different* uid silently gets the wrong answer. Every call site in
-- the schema passes auth.uid() (verified across all migrations + live
-- policies), so honoring the parameter is fully backward-compatible: callers
-- passing auth.uid() get identical results, and callers passing another uid
-- now get the correct answer instead of a silent lie.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.is_director(check_uid uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE uid = check_uid AND role = 'director'
  );
$$;

-- ===========================================================================
-- Finding 1 (HIGH): 'Files' bucket must not be readable by anon.
--
-- Exploit: the SELECT policy granted TO anon, authenticated with only
-- bucket_id = 'Files', so an unauthenticated client could read every object in
-- the bucket. The 'Files' bucket is the directors' internal file manager
-- (app/dashboard/files) — there is no public/anon use case.
--
-- Object paths in this bucket are arbitrary, user-chosen folder trees
-- (e.g. "ProjectX/specs/file.pdf"); there is NO owner/project segment to scope
-- on, so the correct tightening is simply to drop the anon grant and keep
-- authenticated read. INSERT/UPDATE/DELETE are already director-only and are
-- left unchanged.
-- ===========================================================================
DROP POLICY IF EXISTS "Allow users to access and upload to buckets 14exqv_0" ON storage.objects;
CREATE POLICY "Allow users to access and upload to buckets 14exqv_0" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'Files'::text);

-- ===========================================================================
-- Finding 2 (HIGH): 'Message Attachments' IDOR.
--
-- Exploit: SELECT/INSERT policies only checked bucket_id = 'Message
-- Attachments', so any authenticated user could read or write ANY message
-- attachment object (e.g. enumerate other clients' attachments via
-- createSignedUrl).
--
-- Real upload path (MessageThread.tsx::uploadOneFile):
--     `${crypto.randomUUID()}-${file.name}`   -- FLAT, no folder segment.
-- The same string is stored in public.message_attachments.path. So we scope
-- the storage object by joining storage.objects.name = message_attachments.path
-- -> messages -> conversations, and check the viewer is the conversation's
-- client or director profile. This mirrors the existing (correct) RLS on the
-- public.message_attachments table itself.
--
-- SELECT: safe and tight. An object is readable only if it is referenced by a
-- message_attachments row whose conversation the viewer belongs to.
--
-- INSERT: ⚠️ the attachment ROW is inserted AFTER the storage upload
-- (uploadOneFile runs first; the message_attachments INSERT happens later in
-- insertAttachmentsMessage). At storage-INSERT time there is therefore no
-- message_attachments row to join against, and the flat path carries no
-- uploader id. We CANNOT cryptographically bind the upload to the user via the
-- path without a coupled frontend change. The conservative tightening here
-- keeps INSERT limited to authenticated users (status quo for write) while the
-- IDOR that actually leaks data (unscoped SELECT/read) is closed. A stronger
-- INSERT guard requires the frontend to prefix the object path with a
-- conversation/user segment (see writeup → recommended frontend change).
-- ===========================================================================
DROP POLICY IF EXISTS "Allow users to read from message attachments cu7rh3_0" ON storage.objects;
CREATE POLICY "Allow users to read from message attachments cu7rh3_0" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'Message Attachments'::text
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      JOIN public.messages m       ON m.id = ma.message_id
      JOIN public.conversations c  ON c.id = m.conversation_id
      WHERE ma.path = storage.objects.name
        AND (
          c.client_profile_id   = public.user_profile_id(auth.uid())
          OR c.director_profile_id = public.user_profile_id(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Allow message attachments cu7rh3_0" ON storage.objects;
CREATE POLICY "Allow message attachments cu7rh3_0" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Message Attachments'::text);

-- ===========================================================================
-- Finding 3 (HIGH): 'ticket-attachments' IDOR.
--
-- Exploit: SELECT/INSERT policies only checked bucket_id +
-- auth.role() = 'authenticated', so any authenticated user could read or
-- upload ANY ticket file.
--
-- Real upload paths DIFFER by ticket type (verified in the frontend):
--   * Requests (lib/supabase/requests.ts):  `${requestId}/${ts}-${file.name}`
--                                            -> first segment = TICKET id.
--   * Reports  (NewReportModal.tsx):         `reports/${ts}-${file.name}`
--                                            -> first segment = literal "reports".
-- So scoping by "first path segment = project_id" (as the review hypothesized)
-- would be WRONG for both flows and would break uploads/downloads of every
-- existing object. Instead we scope via the public.tickets table: an object is
-- visible iff it is referenced by tickets.attachments (jsonb array of
-- { path, name, size }) for a ticket the viewer is allowed to see. Ticket
-- visibility reuses the same rule as the tickets SELECT policy:
-- director OR project member.
--
-- SELECT: safe and tight against existing stored files — it keys off the
-- stored path string, which already exists in tickets.attachments for every
-- legitimately-uploaded file.
--
-- INSERT: ⚠️ same ordering problem as message attachments — the ticket row
-- (and its attachments jsonb) is written AFTER the storage upload, and the
-- "reports/" flow has no project/ticket segment in the path at all. We
-- therefore keep INSERT at authenticated-only (status quo for write) and close
-- the read-side IDOR. A stronger INSERT guard requires a coupled frontend
-- change to embed <project_id>/ as the first path segment for BOTH flows (see
-- writeup → recommended frontend change), after which INSERT can enforce
-- public.is_project_member((storage.foldername(name))[1]::bigint).
-- ===========================================================================
DROP POLICY IF EXISTS "Authenticated users can read ticket-attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read ticket-attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'::text
    AND EXISTS (
      SELECT 1
      FROM public.tickets t,
           jsonb_array_elements(COALESCE(t.attachments, '[]'::jsonb)) AS att
      WHERE att->>'path' = storage.objects.name
        AND (
          public.is_director(auth.uid())
          OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id))
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload ticket-attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload ticket-attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments'::text);
