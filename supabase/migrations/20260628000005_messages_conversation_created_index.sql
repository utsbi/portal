-- ===========================================================================
-- Perf: composite index for thread loads and latest_conversation_messages().
--
-- Thread reads scan public.messages by conversation_id ordered by created_at
-- (newest first), and latest_conversation_messages()
-- (20260614000004_messaging_review_fixes.sql) selects the most recent message
-- per conversation. The existing messages indexes don't cover this access
-- path: messages_pinned_idx is partial on (conversation_id, pinned_at DESC)
-- WHERE is_pinned, and idx_messages_sender_profile is keyed by sender. Add a
-- covering (conversation_id, created_at DESC) index. Name follows the
-- idx_messages_<cols> convention (cf. idx_messages_sender_profile).
--
-- Idempotent: IF NOT EXISTS.
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);
