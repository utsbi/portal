-- RLS isolation for client_chat_attachments:
-- a user can read/write own rows but cannot access another user's rows.
BEGIN;
SELECT plan(5);

-- [1] RLS is enabled on the new table
SELECT ok(
  relrowsecurity,
  'RLS enabled: public.client_chat_attachments'
)
FROM pg_class WHERE oid = 'public.client_chat_attachments'::regclass;

-- [2] Client A can insert own attachment row
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ INSERT INTO public.client_chat_attachments
       (uid, content_hash, filename, file_type, content, byte_len)
     VALUES (t.uid_clienta(), 'deadbeef01', 'report.txt', 'txt', 'hello world', 11) $$,
  'Client A: can INSERT own attachment'
);
SELECT t.reset_auth();

-- [3] Client A can SELECT own row
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*)::int FROM public.client_chat_attachments
   WHERE uid = t.uid_clienta()),
  1,
  'Client A: can SELECT own attachment row'
);
SELECT t.reset_auth();

-- [4] Client B cannot SELECT Client A's rows (cross-tenant isolation)
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*)::int FROM public.client_chat_attachments
   WHERE uid = t.uid_clienta()),
  0,
  'Client B: cannot SELECT Client A''s attachment (cross-tenant)'
);
SELECT t.reset_auth();

-- [5] Client B inserting with Client A's uid is rejected by RLS WITH CHECK
SELECT t.as_user(t.uid_clientb());
SELECT throws_ok(
  $$ INSERT INTO public.client_chat_attachments
       (uid, content_hash, filename, file_type, content, byte_len)
     VALUES (t.uid_clienta(), 'forgedhash42', 'evil.txt', 'txt', 'bad', 3) $$,
  NULL,
  NULL,
  'Client B: cannot INSERT with Client A''s uid (RLS WITH CHECK)'
);
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
