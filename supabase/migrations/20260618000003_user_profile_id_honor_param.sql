-- ===========================================================================
-- FINDING D4: user_profile_id(check_uid) ignores its parameter.
--
-- The baseline function (20260101000000 ~:392-399) is declared to take a
-- `check_uid uuid` but its body selects `WHERE uid = auth.uid()`, ignoring the
-- argument entirely. This is a correctness/security latent bug: any future
-- caller passing a uid other than auth.uid() would silently receive the CURRENT
-- user's profile id instead of the requested one, defeating an authorization
-- check that looks correct on its face.
--
-- BACKWARD-COMPATIBLE: a grep of all migrations for `user_profile_id(` shows
-- EVERY current caller passes `auth.uid()` (baseline RLS policies, the storage
-- hardening policies, private.user_project_ids, mark_conversation_read, the
-- messaging directory view). For those callers auth.uid() == check_uid, so
-- honoring the parameter does not change any existing behavior — it only makes
-- the function behave as written for any future caller.
--
-- Keeps SECURITY DEFINER + locked search_path exactly as the baseline had.
-- Idempotent: CREATE OR REPLACE.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.user_profile_id(check_uid uuid)
  RETURNS bigint
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT id FROM public.profiles WHERE uid = check_uid LIMIT 1;
$$;
