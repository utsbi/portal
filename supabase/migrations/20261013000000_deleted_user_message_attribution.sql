-- Preserve messages when an account is deleted while removing the deleted
-- user's identity links. Message content and conversation history remain intact.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_display_name text;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title_override text;

-- The existing identity-lock trigger normally prevents changing sender_uid.
-- Permit the server-side account deletion flow to clear both identity foreign
-- keys only when it also records the explicit Deleted User attribution. RLS
-- still prevents regular users from making this transition.
CREATE OR REPLACE FUNCTION public.prevent_message_identity_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- The account-deletion action uses the trusted service-role client to
  -- restore these fields if Supabase Auth rejects deletion after the
  -- pre-deletion anonymization step. Browser roles never use this path.
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_uid IS DISTINCT FROM OLD.sender_uid
     AND NOT (
       NEW.sender_uid IS NULL
       AND NEW.sender_profile_id IS NULL
       AND NEW.sender_display_name IS NOT DISTINCT FROM 'Deleted User'
     ) THEN
    RAISE EXCEPTION 'messages.sender_uid is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.sender_role IS DISTINCT FROM OLD.sender_role THEN
    RAISE EXCEPTION 'messages.sender_role is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'messages.conversation_id is immutable (no re-parenting)'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id THEN
    RAISE EXCEPTION 'messages.reply_to_id is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
