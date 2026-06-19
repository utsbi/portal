-- ===========================================================================
-- FINDING D5: mark_conversation_read(p_conversation_id) is unhardened.
--
-- The baseline RPC (20260101000000 ~:492-500) has:
--   * NO `SET search_path` — a SECURITY-relevant omission for any function that
--     resolves unqualified objects; this RPC is SECURITY INVOKER (the default),
--     so the risk is lower, but locking the search_path is the project standard
--     for every other function and removes search-path-shadowing ambiguity.
--   * NO participant check — a user can mark ANY conversation read for
--     themselves. The conversation_reads RLS already constrains the inserted
--     `profile_id` to the caller's own profile, so this cannot forge another
--     user's read state, but it lets a non-participant create read rows for
--     arbitrary conversation ids (low-severity integrity/leak vector).
--
-- FIX: CREATE OR REPLACE with a locked search_path and a participant guard using
-- the new 1-arg public.is_conversation_participant (20260618000002). Stays
-- SECURITY INVOKER so the conversation_reads RLS continues to gate `profile_id`.
--
-- NOTE: switched to plpgsql so we can RAISE on a non-participant; the body is
-- otherwise identical (same upsert into conversation_reads).
--
-- Idempotent: CREATE OR REPLACE. Depends on 20260618000002 having created the
-- 1-arg is_conversation_participant (ordered earlier today).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id bigint)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'Not a participant of conversation %', p_conversation_id;
  END IF;

  INSERT INTO public.conversation_reads (conversation_id, profile_id, last_read_at)
  VALUES (p_conversation_id, public.user_profile_id(auth.uid()), now())
  ON CONFLICT (conversation_id, profile_id)
  DO UPDATE SET last_read_at = now();
END;
$$;
