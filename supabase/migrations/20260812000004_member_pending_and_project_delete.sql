-- Track the lifecycle of member portal invitations separately from the
-- membership profile. An invitation is pending until the recipient completes
-- the password form; existing accounts are treated as already active.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_activated_at timestamptz;

UPDATE public.profiles
SET portal_activated_at = COALESCE(portal_activated_at, created_at)
WHERE uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_portal_pending
  ON public.profiles (role, portal_activated_at)
  WHERE role = 'member' AND uid IS NOT NULL AND portal_activated_at IS NULL;

-- A deleted project should not be blocked by historical messages, tickets, or
-- questionnaire submissions. Project-owned records are removed with the
-- project; historical records retain their content with a NULL project.
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_project_id_fkey,
  ADD CONSTRAINT conversations_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.custom_form_submissions
  DROP CONSTRAINT IF EXISTS custom_form_submissions_project_id_fkey,
  ADD CONSTRAINT custom_form_submissions_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_project_id_fkey,
  ADD CONSTRAINT tickets_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.lifecycle_projects
  DROP CONSTRAINT IF EXISTS lifecycle_projects_project_id_fkey,
  ADD CONSTRAINT lifecycle_projects_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- The caller is checked inside a security-definer function so the operation is
-- atomic and cannot be expanded into a client-controlled sequence of deletes.
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

  DELETE FROM public.projects WHERE id = _project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_project(bigint) TO authenticated;
