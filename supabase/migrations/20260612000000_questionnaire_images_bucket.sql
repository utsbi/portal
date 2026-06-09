-- Public bucket for questionnaire form-image blocks.
--
-- PROPOSAL — defined in this worktree, ordered after 20260611000000. NOT applied
-- to the live database. Review before `supabase db push`.
--
-- Form image blocks may render on PUBLIC forms (no auth), so the image must be
-- publicly readable. This bucket is public (served via the public object
-- endpoint); writes are restricted to directors uploading into their own folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'questionnaire-images',
  'questionnaire-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Read: public (anon + authenticated). Public buckets also serve objects via the
-- public endpoint regardless, but an explicit SELECT policy keeps the API honest.
DROP POLICY IF EXISTS "questionnaire-images read" ON storage.objects;
CREATE POLICY "questionnaire-images read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'questionnaire-images'::text);

-- Upload: directors only, into their own <uid>/ folder.
DROP POLICY IF EXISTS "questionnaire-images director upload" ON storage.objects;
CREATE POLICY "questionnaire-images director upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'questionnaire-images'::text
    AND public.is_director(auth.uid())
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Update / delete: only within the uploader's own folder.
DROP POLICY IF EXISTS "questionnaire-images owner update" ON storage.objects;
CREATE POLICY "questionnaire-images owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'questionnaire-images'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'questionnaire-images'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "questionnaire-images owner delete" ON storage.objects;
CREATE POLICY "questionnaire-images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'questionnaire-images'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
