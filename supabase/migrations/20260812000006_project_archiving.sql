-- Projects are reversible records. Archiving hides a project from active
-- navigation without deleting memberships, files, or project history.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_archived_at
  ON public.projects (archived_at);

-- Archived projects cannot remain the default member destination.
CREATE OR REPLACE FUNCTION public.set_default_project(_project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_director(auth.uid()) THEN
    RAISE EXCEPTION 'Director role required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.projects
  WHERE id = _project_id AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active project not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.projects SET is_default = false WHERE is_default;
  UPDATE public.projects SET is_default = true WHERE id = _project_id;

  INSERT INTO public.project_members (project_id, profile_id, role)
  SELECT _project_id, profile.id, 'member'::extensions.project_role
  FROM public.profiles AS profile
  WHERE profile.role = 'member'
    AND NOT EXISTS (
      SELECT 1 FROM public.project_members AS membership
      WHERE membership.profile_id = profile.id
    )
  ON CONFLICT (project_id, profile_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_project(_project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_director(auth.uid()) THEN
    RAISE EXCEPTION 'Director role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET archived_at = now(), is_default = false
  WHERE id = _project_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active project not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project(_project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_director(auth.uid()) THEN
    RAISE EXCEPTION 'Director role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET archived_at = NULL
  WHERE id = _project_id AND archived_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archived project not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_project(bigint), public.restore_project(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_project(bigint), public.restore_project(bigint) TO authenticated;

-- The previous migration exposed the destructive helper. Keep it for audit
-- compatibility, but remove browser access now that archiving is the only UI
-- project lifecycle operation.
REVOKE ALL ON FUNCTION public.delete_project(bigint) FROM authenticated;
