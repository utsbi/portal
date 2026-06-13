-- ===========================================================================
-- Files bucket: scope objects to the caller's project membership.
--
-- The Explore "Files" feature now roots every object under a `{projectId}/`
-- prefix (frontend app/dashboard/files). This migration makes the database
-- enforce that boundary so a caller can only read/write objects whose first
-- path segment is a project they belong to.
--
-- Before this migration (see 20260603000000_harden_storage_rls):
--   * SELECT  : any authenticated user could read EVERY object in 'Files'
--               (no owner/project segment existed to scope on) — so clients
--               saw all directors' files across all projects.
--   * INSERT/UPDATE/DELETE : any director, any object (unscoped).
--
-- After:
--   * SELECT  : project members (clients, directors, members of that project).
--   * INSERT/UPDATE/DELETE : directors who are members of that project.
--
-- Membership is resolved exactly like the rest of the app and the Explore AI
-- tools: profiles.uid = auth.uid() -> profiles.id -> project_members.project_id.
-- The first path segment (split_part(name, '/', 1)) is the project id.
--
-- Fresh-start note: pre-existing objects at the bucket root (no `{projectId}/`
-- prefix) have a first segment that matches no project id, so they become
-- invisible to all non-service-role callers. This is intentional — existing
-- root files are left in place and simply not surfaced in the per-project view.
--
-- Idempotent: each policy is DROP ... IF EXISTS then recreated, and the helper
-- is CREATE OR REPLACE, so the migration is safe to re-apply.
-- ===========================================================================

-- Helper: is `check_uid` a member of the project named by the FIRST path
-- segment of `object_name`? SECURITY DEFINER so the policy can read
-- public.project_members / public.profiles regardless of the caller's own
-- table grants, mirroring public.is_director.
CREATE OR REPLACE FUNCTION public.storage_path_project_member(
  check_uid uuid,
  object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.profiles pr ON pr.id = pm.profile_id
    WHERE pr.uid = check_uid
      AND pm.project_id::text = split_part(object_name, '/', 1)
  );
$$;

-- Used only inside RLS policies; do not expose it as a public PostgREST RPC.
-- Match the hardened posture of public.is_director (authenticated, never anon).
REVOKE EXECUTE ON FUNCTION public.storage_path_project_member(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.storage_path_project_member(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.storage_path_project_member(uuid, text) TO authenticated;

-- SELECT: members of the project the object lives under.
DROP POLICY IF EXISTS "Allow users to access and upload to buckets 14exqv_0" ON storage.objects;
CREATE POLICY "Allow users to access and upload to buckets 14exqv_0" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'Files'::text
    AND public.storage_path_project_member(auth.uid(), name)
  );

-- INSERT: directors who belong to the target project.
DROP POLICY IF EXISTS "Directors can upload Files" ON storage.objects;
CREATE POLICY "Directors can upload Files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'Files'::text
    AND public.is_director(auth.uid())
    AND public.storage_path_project_member(auth.uid(), name)
  );

-- UPDATE (covers Storage move/rename): directors who belong to the project on
-- BOTH the source row (USING) and the destination name (WITH CHECK).
DROP POLICY IF EXISTS "Directors can update Files" ON storage.objects;
CREATE POLICY "Directors can update Files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'Files'::text
    AND public.is_director(auth.uid())
    AND public.storage_path_project_member(auth.uid(), name)
  )
  WITH CHECK (
    bucket_id = 'Files'::text
    AND public.is_director(auth.uid())
    AND public.storage_path_project_member(auth.uid(), name)
  );

-- DELETE: directors who belong to the project.
DROP POLICY IF EXISTS "Directors can delete Files" ON storage.objects;
CREATE POLICY "Directors can delete Files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'Files'::text
    AND public.is_director(auth.uid())
    AND public.storage_path_project_member(auth.uid(), name)
  );
