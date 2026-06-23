-- D1: conversation/message visibility is participant-gated, the 2-arg
-- is_conversation_participant oracle is gone, and the 1-arg form exists.
BEGIN;
SELECT plan(9);

-- ---- function surface: 1-arg exists, 2-arg dropped ----
SELECT has_function(
  'public', 'is_conversation_participant', ARRAY['bigint'],
  '1-arg is_conversation_participant(bigint) exists'
);
SELECT hasnt_function(
  'public', 'is_conversation_participant', ARRAY['bigint', 'uuid'],
  '2-arg is_conversation_participant(bigint, uuid) oracle is dropped'
);

-- ---- participant CAN see their conversation + messages ----
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.conversations WHERE id = t.id('conv_alpha'))::int,
  1,
  'participant (Client A): can SELECT own conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = t.id('conv_alpha'))::int,
  1,
  'participant (Client A): can SELECT messages in own conversation'
);
SELECT t.reset_auth();

-- ---- NON-participant cannot see the other tenant's conversation/messages ----
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM public.conversations WHERE id = t.id('conv_alpha'))::int,
  0,
  'non-participant (Client B): cannot SELECT Client A''s conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = t.id('conv_alpha'))::int,
  0,
  'non-participant (Client B): cannot SELECT messages in Client A''s conversation'
);
-- And the 1-arg helper returns false for a conversation they are not in.
SELECT is(
  public.is_conversation_participant(t.id('conv_alpha')),
  false,
  'non-participant (Client B): is_conversation_participant(conv_alpha) is false'
);
SELECT t.reset_auth();

-- ---- director (a participant of both) sees both ----
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.conversations WHERE id IN (t.id('conv_alpha'), t.id('conv_beta')))::int,
  2,
  'director: participant of both conversations'
);
SELECT is(
  public.is_conversation_participant(t.id('conv_alpha')),
  true,
  'director: is_conversation_participant(conv_alpha) is true'
);
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
