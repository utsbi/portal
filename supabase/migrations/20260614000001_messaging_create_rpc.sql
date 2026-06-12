-- ===========================================================================
-- Messaging, phase 2a: matrix helpers + create_conversation RPC (ADDITIVE).
--
-- The role matrix and conversation creation are enforced in ONE place — a
-- SECURITY DEFINER RPC — rather than scattered across RLS INSERT policies (which
-- can't express "the creator's role may message each invitee's role" cleanly).
-- This is additive: new functions only, no policy or behavior changes yet. The
-- new CreateConversationModal calls create_conversation; the participant-based
-- RLS rewrite that locks down direct inserts lands in phase 2b with the UI.
--
-- The matrix:
--   director -> director, member, client
--   member   -> member, director
--   client   -> director
-- ===========================================================================

-- Directional "may <from_role> start a conversation with <to_role>?"
CREATE OR REPLACE FUNCTION public.can_message(_from_role text, _to_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE _from_role
    WHEN 'director' THEN _to_role IN ('director', 'member', 'client')
    WHEN 'member'   THEN _to_role IN ('member', 'director')
    WHEN 'client'   THEN _to_role IN ('director')
    ELSE false
  END;
$$;

-- Is the user (by auth uid) a participant of the conversation? SECURITY DEFINER
-- so RLS policies can call it without recursing into conversation_participants.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  _conversation_id bigint,
  _uid uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.profiles pr ON pr.id = cp.profile_id
    WHERE cp.conversation_id = _conversation_id
      AND pr.uid = _uid
  );
$$;

-- Create (or return an existing duplicate of) a conversation with the given
-- OTHER participants. The caller is always added. Enforces the role matrix for
-- every invitee and the project rules:
--   * if any participant is a client, _project_id is required and every client
--     (and the caller) must belong to it;
--   * otherwise it's an internal DM and project is forced NULL.
-- Returns the conversation id. Dedupes on the exact participant set + project.
CREATE OR REPLACE FUNCTION public.create_conversation(
  _participant_profile_ids bigint[],
  _project_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  _caller_uid uuid := auth.uid();
  _caller_pid bigint;
  _caller_role text;
  _all_pids bigint[];
  _target_pid bigint;
  _target_role text;
  _has_client boolean := false;
  _existing bigint;
  _new_conv_id bigint;
BEGIN
  IF _caller_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, role::text INTO _caller_pid, _caller_role
  FROM public.profiles WHERE uid = _caller_uid;
  IF _caller_pid IS NULL THEN
    RAISE EXCEPTION 'No profile for caller';
  END IF;

  -- Full, de-duplicated, sorted participant set (caller + targets).
  SELECT array_agg(pid ORDER BY pid) INTO _all_pids
  FROM (
    SELECT DISTINCT pid
    FROM (
      SELECT _caller_pid AS pid
      UNION
      SELECT unnest(_participant_profile_ids)
    ) u
    WHERE pid IS NOT NULL
  ) s;

  IF _all_pids IS NULL OR array_length(_all_pids, 1) < 2 THEN
    RAISE EXCEPTION 'A conversation needs at least one other participant';
  END IF;

  -- Matrix check for each non-self participant; track whether a client is in.
  IF _caller_role = 'client' THEN
    _has_client := true;
  END IF;
  FOREACH _target_pid IN ARRAY _all_pids LOOP
    IF _target_pid = _caller_pid THEN
      CONTINUE;
    END IF;
    SELECT role::text INTO _target_role FROM public.profiles WHERE id = _target_pid;
    IF _target_role IS NULL THEN
      RAISE EXCEPTION 'Unknown participant %', _target_pid;
    END IF;
    IF NOT public.can_message(_caller_role, _target_role) THEN
      RAISE EXCEPTION 'Your role (%) may not start a conversation with a %',
        _caller_role, _target_role;
    END IF;
    IF _target_role = 'client' THEN
      _has_client := true;
    END IF;
  END LOOP;

  -- Project rules.
  IF _has_client THEN
    IF _project_id IS NULL THEN
      RAISE EXCEPTION 'A conversation that includes a client must specify a project';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unnest(_all_pids) AS pid
      JOIN public.profiles pr ON pr.id = pid
      WHERE pr.role::text = 'client'
        AND NOT EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.profile_id = pid AND pm.project_id = _project_id
        )
    ) THEN
      RAISE EXCEPTION 'A client participant does not belong to the specified project';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.profile_id = _caller_pid AND pm.project_id = _project_id
    ) THEN
      RAISE EXCEPTION 'You do not belong to the specified project';
    END IF;
  ELSE
    _project_id := NULL;
  END IF;

  -- Dedupe: an existing conversation with the exact same participant set + project.
  SELECT c.id INTO _existing
  FROM public.conversations c
  WHERE c.project_id IS NOT DISTINCT FROM _project_id
    AND (
      SELECT array_agg(cp.profile_id ORDER BY cp.profile_id)
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id
    ) = _all_pids
  LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  INSERT INTO public.conversations (project_id)
  VALUES (_project_id)
  RETURNING id INTO _new_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, profile_id, role_at_join)
  SELECT _new_conv_id, pid, (SELECT role::text FROM public.profiles WHERE id = pid)
  FROM unnest(_all_pids) AS pid;

  RETURN _new_conv_id;
END;
$$;

-- Service-role + authenticated may create; the matrix is enforced inside.
REVOKE EXECUTE ON FUNCTION public.create_conversation(bigint[], bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_conversation(bigint[], bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_conversation(bigint[], bigint) TO authenticated;

-- Helpers are used inside policies; keep them off the anon API surface.
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(bigint, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(bigint, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(bigint, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_message(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_message(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_message(text, text) TO authenticated;
