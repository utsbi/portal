-- ===========================================================================
-- Messaging, phase 2c: directory reads for the matrix.
--
-- profiles SELECT was restricted to "own profile" (directors excepted), so
-- members/clients could not read the NAME of anyone they message — breaking
-- both the conversation peer-name display and the recipient picker. Two pieces:
--
--   1. A co-participant profiles SELECT policy so you can read the profiles of
--      people you share a conversation with (peer names in the inbox/thread).
--   2. list_messageable_profiles(): a SECURITY DEFINER RPC returning exactly the
--      people the caller may start a conversation with (matrix + project rules),
--      so the picker doesn't need broad profiles/project_members read access.
-- ===========================================================================

DROP POLICY IF EXISTS "View co-participant profiles" ON public.profiles;
CREATE POLICY "View co-participant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp_me
      JOIN public.conversation_participants cp_them
        ON cp_them.conversation_id = cp_me.conversation_id
      WHERE cp_me.profile_id = public.user_profile_id(auth.uid())
        AND cp_them.profile_id = profiles.id
    )
  );

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
  -- Alias the table: the OUT columns (name, role, project_id) shadow the
  -- profiles columns, so unqualified references would be ambiguous.
  SELECT p.id, p.role::text INTO _caller_pid, _caller_role
  FROM public.profiles p WHERE p.uid = auth.uid();
  IF _caller_pid IS NULL THEN
    RETURN;
  END IF;

  IF _caller_role = 'client' THEN
    -- Clients may message the directors on their own projects.
    RETURN QUERY
      SELECT DISTINCT pr.id, pr.name, pr.role::text, NULL::bigint, NULL::text
      FROM public.project_members pm_me
      JOIN public.project_members pm_dir ON pm_dir.project_id = pm_me.project_id
      JOIN public.profiles pr ON pr.id = pm_dir.profile_id
      WHERE pm_me.profile_id = _caller_pid
        AND pr.role::text = 'director'
        AND pr.id <> _caller_pid;
    RETURN;
  END IF;

  -- Directors/members: any internal staff the matrix permits.
  RETURN QUERY
    SELECT pr.id, pr.name, pr.role::text, NULL::bigint, NULL::text
    FROM public.profiles pr
    WHERE pr.id <> _caller_pid
      AND pr.role::text IN ('director', 'member')
      AND public.can_message(_caller_role, pr.role::text);

  -- Directors may also message the clients (owners) of their projects.
  IF _caller_role = 'director' THEN
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

REVOKE EXECUTE ON FUNCTION public.list_messageable_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_messageable_profiles() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_messageable_profiles() TO authenticated;
