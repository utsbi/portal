-- Add the SBI president as a global staff role. Presidents inherit every
-- director capability, but application mutations separately prevent a
-- director from inviting, editing, or deleting a president.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_president_requires_uid
  CHECK (role <> 'president'::extensions.profile_role OR uid IS NOT NULL);

-- Project-scoped RLS helpers were originally written against the synthetic
-- project_members rows. Presidents are global staff, so keep their access
-- correct even if a legacy database is missing one of those rows.
CREATE OR REPLACE FUNCTION public.is_project_director(_project_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT public.is_director(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = _project_id
        AND pm.profile_id = public.user_profile_id(auth.uid())
        AND pm.role = 'director'::extensions.project_role
    );
$$;

CREATE OR REPLACE FUNCTION public.is_president(check_uid uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE uid = check_uid
      AND role = 'president'::extensions.profile_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_president(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_president(uuid) TO authenticated;

-- Keep the legacy helper name for all director-level RLS policies, but make
-- the president a first-class staff principal everywhere those policies use it.
CREATE OR REPLACE FUNCTION public.is_director(check_uid uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE uid = check_uid
      AND role IN (
        'director'::extensions.profile_role,
        'president'::extensions.profile_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.auto_link_director_to_projects()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
BEGIN
  IF NEW.role IN (
    'director'::extensions.profile_role,
    'president'::extensions.profile_role
  ) THEN
    INSERT INTO public.project_members (project_id, profile_id, role)
    SELECT p.id, NEW.id, 'director'::extensions.project_role
    FROM public.projects p
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Presidents submit the same report tickets as directors. Replacing the
-- policy is necessary because the older policy compared current_user_role()
-- to a literal text array instead of using is_director().
DROP POLICY IF EXISTS "Members and directors can insert reports" ON public.tickets;
CREATE POLICY "Members and directors can insert reports" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    ticket_type = 'report'::extensions.ticket_type
    AND current_user_role() = ANY (ARRAY['director'::text, 'president'::text, 'member'::text])
    AND ((project_id IS NULL) OR is_project_member(project_id))
  );

CREATE OR REPLACE FUNCTION public.auto_link_directors_to_new_project()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, profile_id, role)
  SELECT NEW.id, p.id, 'director'::extensions.project_role
  FROM public.profiles p
  WHERE p.role IN (
    'director'::extensions.profile_role,
    'president'::extensions.profile_role
  )
  ON CONFLICT DO NOTHING;

  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, profile_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner'::extensions.project_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Existing presidents, if any were provisioned before this migration, receive
-- the same project coverage as existing directors.
INSERT INTO public.project_members (project_id, profile_id, role)
SELECT p.id, profile.id, 'director'::extensions.project_role
FROM public.projects p
CROSS JOIN public.profiles profile
WHERE profile.role = 'president'::extensions.profile_role
ON CONFLICT DO NOTHING;

-- Presidents follow the existing director-to-everyone messaging matrix.
CREATE OR REPLACE FUNCTION public.can_message(_from_role text, _to_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE _from_role
    WHEN 'director' THEN _to_role IN ('director', 'president', 'member', 'client')
    WHEN 'president' THEN _to_role IN ('director', 'president', 'member', 'client')
    WHEN 'member'   THEN _to_role IN ('member', 'director', 'president')
    WHEN 'client'   THEN _to_role IN ('director', 'president')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.list_messageable_profiles()
RETURNS TABLE(
  profile_id bigint,
  name text,
  role text,
  project_id bigint,
  project_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  _caller_pid bigint;
  _caller_role text;
BEGIN
  SELECT p.id, p.role::text INTO _caller_pid, _caller_role
  FROM public.profiles p WHERE p.uid = auth.uid();
  IF _caller_pid IS NULL THEN RETURN; END IF;

  IF _caller_role = 'client' THEN
    RETURN QUERY
      SELECT DISTINCT pr.id, pr.name, pr.role::text, NULL::bigint, NULL::text
      FROM public.project_members pm_me
      JOIN public.project_members pm_dir ON pm_dir.project_id = pm_me.project_id
      JOIN public.profiles pr ON pr.id = pm_dir.profile_id
      WHERE pm_me.profile_id = _caller_pid
        AND pr.role::text IN ('director', 'president')
        AND pr.id <> _caller_pid;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT pr.id, pr.name, pr.role::text, NULL::bigint, NULL::text
    FROM public.profiles pr
    WHERE pr.id <> _caller_pid
      AND pr.role::text IN ('director', 'president', 'member')
      AND public.can_message(_caller_role, pr.role::text);

  IF _caller_role IN ('director', 'president') THEN
    RETURN QUERY
      SELECT DISTINCT pr.id, pr.name, pr.role::text, p.id, p.company_name
      FROM public.project_members pm_me
      JOIN public.project_members pm_cl
        ON pm_cl.project_id = pm_me.project_id AND pm_cl.role = 'owner'
      JOIN public.profiles pr ON pr.id = pm_cl.profile_id
      JOIN public.projects p ON p.id = pm_cl.project_id
      WHERE pm_me.profile_id = _caller_pid
        AND pr.id <> _caller_pid;
  END IF;
END;
$$;
