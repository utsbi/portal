-- Remove project-scoped storage objects as part of the same director-only
-- deletion operation. Both buckets use the project id as their first path
-- segment; other buckets are intentionally left untouched.

CREATE OR REPLACE FUNCTION public.delete_project(_project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_director(auth.uid()) THEN
    RAISE EXCEPTION 'Director role required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id) THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id IN ('Files', 'ticket-attachments')
    AND (storage.foldername(name))[1] = _project_id::text;

  DELETE FROM public.projects WHERE id = _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_project(bigint) TO authenticated;
