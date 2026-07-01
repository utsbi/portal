-- D7: chat_begin_turn must have a locked search_path, enforce caller ownership,
-- create the correct user+assistant rows on the happy path, advance active_leaf_id
-- atomically, block cross-tenant callers, and handle the regenerate path.
BEGIN;
SELECT plan(12);

-- ----------------------------------------------------------------
-- [1] search_path is set (proconfig IS NOT NULL)
-- ----------------------------------------------------------------
SELECT isnt(
  (SELECT proconfig FROM pg_proc
     WHERE oid = 'public.chat_begin_turn(bigint,text,jsonb,text,int,boolean)'::regprocedure),
  NULL,
  'chat_begin_turn has a non-default search_path (proconfig is set)'
);

-- ----------------------------------------------------------------
-- [2] proconfig contains an explicit search_path entry
-- ----------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc,
         unnest(coalesce(proconfig, ARRAY[]::text[])) AS cfg
    WHERE oid = 'public.chat_begin_turn(bigint,text,jsonb,text,int,boolean)'::regprocedure
      AND cfg LIKE 'search_path=%'
  ),
  'chat_begin_turn proconfig contains an explicit search_path'
);

-- ----------------------------------------------------------------
-- [3] anon CANNOT execute (REVOKE FROM anon is in effect)
-- ----------------------------------------------------------------
SELECT t.as_anon();
SELECT throws_ok(
  $$ SELECT * FROM public.chat_begin_turn(
       t.id('chat_session_alpha'), 'hi', NULL, 'fast', 0, false) $$,
  '42501',
  NULL,
  'anon: chat_begin_turn is denied (permission denied)'
);
SELECT t.reset_auth();

-- ----------------------------------------------------------------
-- [4] authenticated session owner CAN execute
-- ----------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ SELECT * FROM public.chat_begin_turn(
       t.id('chat_session_alpha'), 'hello', NULL, 'fast', 0, false) $$,
  'authenticated owner: chat_begin_turn executes without error'
);
SELECT t.reset_auth();

-- ----------------------------------------------------------------
-- [5-8] Happy-path: user+assistant rows created with correct linkage.
-- A second call (historyLen=0) inserts a fresh user+assistant pair
-- regardless of prior state; we assert relative invariants only.
-- ----------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
CREATE TEMP TABLE _t13_hp AS
  SELECT * FROM public.chat_begin_turn(
    t.id('chat_session_alpha'), 'Happy path query', NULL, 'fast', 0, false
  );
SELECT t.reset_auth();

-- [5] user_message_id must be non-null (user row was created)
SELECT ok(
  (SELECT user_message_id IS NOT NULL FROM _t13_hp LIMIT 1),
  'happy path: user_message_id is returned (user row inserted)'
);

-- [6] assistant.parent_id = the user_message_id returned by the RPC
SELECT is(
  (SELECT m.parent_id
   FROM public.client_chat_messages m
   JOIN _t13_hp r ON m.id = r.assistant_message_id),
  (SELECT user_message_id FROM _t13_hp LIMIT 1),
  'happy path: assistant.parent_id = user_message_id'
);

-- [7] RPC return value: active_leaf_id = assistant_message_id
SELECT is(
  (SELECT active_leaf_id    FROM _t13_hp LIMIT 1),
  (SELECT assistant_message_id FROM _t13_hp LIMIT 1),
  'happy path: returned active_leaf_id = assistant_message_id'
);

-- [8] Session metadata.active_leaf_id was advanced to the assistant row
SELECT is(
  (SELECT (metadata ->> 'active_leaf_id')::bigint
   FROM public.client_chat_sessions
   WHERE id = t.id('chat_session_alpha')),
  (SELECT assistant_message_id FROM _t13_hp LIMIT 1),
  'happy path: session metadata.active_leaf_id = assistant_message_id'
);

-- ----------------------------------------------------------------
-- [9-10] CROSS-TENANT: Client B calling on Client A's session
-- ----------------------------------------------------------------

-- Snapshot message count before the probe so we can prove no rows landed.
CREATE TEMP TABLE _t13_ct_count AS
  SELECT count(*)::int AS n
  FROM public.client_chat_messages
  WHERE session_id = t.id('chat_session_alpha');

-- [9] Client B's call must throw (no_data_found raised by the RPC)
SELECT t.as_user(t.uid_clientb());
SELECT throws_ok(
  $$ SELECT * FROM public.chat_begin_turn(
       t.id('chat_session_alpha'), 'steal', NULL, 'fast', 0, false) $$,
  'P0002',
  NULL,
  'cross-tenant: Client B on Client A''s session throws no_data_found'
);
SELECT t.reset_auth();

-- [10] No rows were inserted into Client A's session by the failed call
SELECT is(
  (SELECT count(*)::int FROM public.client_chat_messages
   WHERE session_id = t.id('chat_session_alpha')),
  (SELECT n FROM _t13_ct_count),
  'cross-tenant: message count in A''s session unchanged after failed call'
);

-- ----------------------------------------------------------------
-- [11-12] Regenerate path: no user row, new assistant is sibling of
-- the prior assistant (same parent = the prior user turn).
-- Active leaf after [5-8] is the happy-path assistant; regenerate
-- should parent the new assistant to that leaf's parent (hp_user).
-- ----------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
CREATE TEMP TABLE _t13_regen AS
  SELECT * FROM public.chat_begin_turn(
    t.id('chat_session_alpha'), '', NULL, 'fast', 0, true
  );
SELECT t.reset_auth();

-- [11] user_message_id must be null (no user row on regenerate)
SELECT ok(
  (SELECT user_message_id IS NULL FROM _t13_regen LIMIT 1),
  'regenerate: user_message_id is null (no user row inserted)'
);

-- [12] new assistant.parent_id = happy-path user_message_id (sibling of old answer)
SELECT is(
  (SELECT m.parent_id
   FROM public.client_chat_messages m
   JOIN _t13_regen r ON m.id = r.assistant_message_id),
  (SELECT user_message_id FROM _t13_hp LIMIT 1),
  'regenerate: new assistant is sibling of prior answer (parent = hp user_message_id)'
);

SELECT * FROM finish();
ROLLBACK;
