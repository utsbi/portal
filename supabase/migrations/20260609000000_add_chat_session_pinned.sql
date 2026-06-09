-- Add a "pinned" flag to client_chat_sessions so a conversation can be pinned to
-- the top of the Explore chat-history sidebar (a "Pinned" group above the date
-- buckets). Defaults to false; existing rows stay unpinned. Idempotent.
--
-- No new RLS needed: the existing owner UPDATE policy on client_chat_sessions
-- already authorizes writes to this column. public schema is already exposed to
-- PostgREST, so no schema-exposure changes are required.

ALTER TABLE public.client_chat_sessions
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_chat_sessions.pinned IS
  'When true, the conversation is pinned to the top of the Explore chat history.';
