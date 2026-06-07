-- Let directors read questionnaire file uploads for forms they own.
--
-- PROPOSAL — defined in this worktree, ordered after 20260608000000. NOT applied
-- to the live database. Review before `supabase db push`.
--
-- The 'questionnaire-attachments' bucket (baseline) is owner-folder scoped: a
-- user can read/write/delete only objects whose first path segment equals their
-- own auth.uid() ("Users can view/upload/delete own files"). That lets a client
-- upload their answer files, but gives the director NO way to read them — so the
-- responses viewer could never show a client's uploaded file.
--
-- The client fill-out UI uploads to a path of the form:
--     <user_uid>/<form_id>/<timestamp>-<filename>
-- so the SECOND path segment is the form id. This policy grants a director SELECT
-- on an object only when that form id belongs to a schema they created. It is
-- additive (multiple permissive SELECT policies are OR'd), so the existing
-- owner-read policy is unchanged and clients keep reading their own files.
--
-- Idempotent: DROP ... IF EXISTS then CREATE.

DROP POLICY IF EXISTS "Directors can read attachments for forms they own"
  ON storage.objects;
CREATE POLICY "Directors can read attachments for forms they own"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'questionnaire-attachments'::text
    AND array_length(storage.foldername(name), 1) >= 2
    -- guard the cast: only consider objects whose 2nd segment is numeric.
    AND (storage.foldername(name))[2] ~ '^[0-9]+$'
    AND EXISTS (
      SELECT 1 FROM public.custom_form_schemas s
      WHERE s.id = ((storage.foldername(name))[2])::bigint
        AND s.created_by = auth.uid()
    )
  );
