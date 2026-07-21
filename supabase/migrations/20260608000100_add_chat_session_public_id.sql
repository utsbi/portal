-- Add an opaque public UUID to client_chat_sessions for use in URLs
-- (e.g. /dashboard/explore/<uuid>), Claude-style, so the bigint primary key is
-- never exposed. The bigint PK and all foreign keys (client_chat_messages.
-- session_id) are left untouched — public_id is purely a URL/lookup handle.
--
-- gen_random_uuid() is built into Postgres 13+, so existing rows each receive a
-- distinct UUID as the column is added. Idempotent.

ALTER TABLE public.client_chat_sessions
  ADD COLUMN IF NOT EXISTS public_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS client_chat_sessions_public_id_key
  ON public.client_chat_sessions (public_id);

COMMENT ON COLUMN public.client_chat_sessions.public_id IS
  'Opaque UUID used in chat URLs (/dashboard/explore/<public_id>). The bigint id '
  'remains the primary key and FK target; public_id never leaks the sequence.';
