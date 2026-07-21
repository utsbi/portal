-- ===========================================================================
-- Messaging, phase 1: generalized conversation participants (ADDITIVE).
--
-- Today a conversation is a rigid (client_profile_id, director_profile_id,
-- project_id) triple, so only director<->client threads can exist. To support
-- the full messaging matrix (director<->director, member<->member,
-- director<->member, ...) and group conversations, a conversation becomes a set
-- of participants via this join table.
--
-- This migration is deliberately ADDITIVE and changes NO existing behavior:
--   * the conversations.client_profile_id / director_profile_id columns and ALL
--     current RLS on conversations/messages are left intact;
--   * conversation_participants is populated for existing threads but not yet
--     read by any policy or app code.
-- Participant-based visibility and the role-pair creation matrix land in a
-- later migration, together with the UI, so live messaging is never broken
-- mid-build.
--
-- project_id becomes nullable here so internal (director/member) DMs can exist
-- without being filed under a client project.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id bigint NOT NULL
    REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_at_join text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_profile_id_idx
  ON public.conversation_participants (profile_id);

-- Internal DMs are not tied to a client project.
ALTER TABLE public.conversations ALTER COLUMN project_id DROP NOT NULL;

-- Backfill: each existing thread's client + director become participants.
INSERT INTO public.conversation_participants (conversation_id, profile_id, role_at_join)
SELECT c.id, c.client_profile_id, 'client'
FROM public.conversations c
WHERE c.client_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, profile_id, role_at_join)
SELECT c.id, c.director_profile_id, 'director'
FROM public.conversations c
WHERE c.director_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: enable, with a TRANSITIONAL read policy — you can see participant rows of
-- a conversation you can already see via the current client/director columns.
-- (Full participant-based read/write policies replace this with the UI.)
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View participants of visible conversations" ON public.conversation_participants;
CREATE POLICY "View participants of visible conversations" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND (
          c.client_profile_id = public.user_profile_id(auth.uid())
          OR c.director_profile_id = public.user_profile_id(auth.uid())
        )
    )
  );
