-- D5: mark_conversation_read must block non-participants and have a locked,
-- non-default search_path.
BEGIN;
SELECT plan(4);

-- ---- search_path is set (non-default) on the function ----
SELECT isnt(
  (SELECT proconfig FROM pg_proc
     WHERE oid = 'public.mark_conversation_read(bigint)'::regprocedure),
  NULL,
  'mark_conversation_read has a non-default search_path (proconfig is set)'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc,
         unnest(coalesce(proconfig, ARRAY[]::text[])) AS cfg
    WHERE oid = 'public.mark_conversation_read(bigint)'::regprocedure
      AND cfg LIKE 'search_path=%'
  ),
  'mark_conversation_read proconfig contains an explicit search_path'
);

-- ---- a participant CAN mark their conversation read ----
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ SELECT public.mark_conversation_read((SELECT v FROM public._test_ids WHERE k='conv_alpha')) $$,
  'participant (Client A): mark_conversation_read on own conversation succeeds'
);
SELECT t.reset_auth();

-- ---- a NON-participant is blocked ----
SELECT t.as_user(t.uid_clientb());
SELECT throws_ok(
  $$ SELECT public.mark_conversation_read((SELECT v FROM public._test_ids WHERE k='conv_alpha')) $$,
  NULL,
  NULL,
  'non-participant (Client B): mark_conversation_read on Client A''s conversation is blocked'
);
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
