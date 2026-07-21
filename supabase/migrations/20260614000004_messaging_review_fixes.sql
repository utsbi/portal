-- ===========================================================================
-- Messaging review fixes (PR #72): privacy lock-down, latest-message perf,
-- and realtime for participant inserts.
--
-- 1. PRIVACY: the phase-2c "View co-participant profiles" policy granted a SELECT
--    on the WHOLE profiles row to anyone you share a conversation with — exposing
--    email, eid, discord_id, department, etc. to every member of a group thread.
--    Postgres RLS can't restrict columns, so the fix is to drop that broad policy
--    and expose ONLY (id, name) of your co-participants through a SECURITY DEFINER
--    RPC. The inbox loader (load-conversations.ts) is the sole consumer; the
--    thread component only ever reads the viewer's OWN profile (uid = auth.uid()).
--
-- 2. PERF: the inbox loaded the latest message per conversation with one query
--    each (N round-trips). Replace with a single set-based RPC.
--
-- 3. REALTIME: conversation_participants was never added to the supabase_realtime
--    publication, so the "I was added to a conversation" listener never fired.
-- ===========================================================================

-- 1. Privacy ---------------------------------------------------------------

DROP POLICY IF EXISTS "View co-participant profiles" ON public.profiles;

-- Return only (id, name) for the given profile ids, and only for profiles the
-- caller actually shares a conversation with. Definer rights let it read profiles
-- without re-granting broad table access; the co-participant EXISTS check is the
-- security boundary (a caller can't harvest names for arbitrary ids).
CREATE OR REPLACE FUNCTION public.get_conversation_peer_names(_ids bigint[])
RETURNS TABLE(id bigint, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT DISTINCT pr.id, pr.name
  FROM public.profiles pr
  WHERE pr.id = ANY(_ids)
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp_me
      JOIN public.conversation_participants cp_them
        ON cp_them.conversation_id = cp_me.conversation_id
      JOIN public.profiles me ON me.id = cp_me.profile_id
      WHERE me.uid = auth.uid()
        AND cp_them.profile_id = pr.id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_conversation_peer_names(bigint[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_conversation_peer_names(bigint[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_peer_names(bigint[]) TO authenticated;

-- 2. Latest-message perf ---------------------------------------------------

-- One row per conversation: the most recent message. SECURITY INVOKER so the
-- caller's "Participants can view messages" RLS still applies (you only get the
-- latest message of conversations you belong to).
CREATE OR REPLACE FUNCTION public.latest_conversation_messages(_ids bigint[])
RETURNS TABLE(conversation_id bigint, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id, m.content, m.created_at
  FROM public.messages m
  WHERE m.conversation_id = ANY(_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.latest_conversation_messages(bigint[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.latest_conversation_messages(bigint[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.latest_conversation_messages(bigint[]) TO authenticated;

-- 3. Realtime for participant inserts --------------------------------------

-- profile_id is part of the primary key, so the default replica identity already
-- carries it for the equality filter the client subscribes with.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.conversation_participants;
  END IF;
END $$;
