-- Folder defaults and member-inbox storage permissions.
BEGIN;
SELECT plan(8);

SELECT is(
  (SELECT count(*)::int FROM public.project_file_folders
   WHERE project_id = t.id('project_alpha')),
  3,
  'every project receives Shared, Deliverables, and Member Inbox defaults'
);

SELECT is(
  (SELECT access_mode::text FROM public.project_file_folders
   WHERE project_id = t.id('project_alpha') AND path = 'Member Inbox'),
  'member_inbox',
  'Member Inbox uses the member upload access mode'
);

SELECT is(
  (SELECT client_visible FROM public.project_file_folders
   WHERE project_id = t.id('project_alpha') AND path = 'Member Inbox'),
  false,
  'Member Inbox is not client-visible'
);

-- Add a real member for the write-path assertions. The transaction rolls this
-- back with the rest of the test.
SELECT t.reset_auth();
INSERT INTO auth.users (id, email)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'member@example.com');
INSERT INTO public.profiles (uid, name, email, role)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Member Example', 'member@example.com', 'member');
INSERT INTO public.project_members (project_id, profile_id, role)
SELECT t.id('project_alpha'), id, 'member'
FROM public.profiles
WHERE uid = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

SELECT t.as_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('Files', (SELECT v FROM public._test_ids WHERE k = 'project_alpha')::text || '/Member Inbox/member-upload.pdf', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  'members can upload into Member Inbox'
);
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('Files', (SELECT v FROM public._test_ids WHERE k = 'project_alpha')::text || '/Shared/member-upload.pdf', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  NULL, NULL,
  'members cannot upload into Shared'
);
SELECT is(
  (SELECT count(*)::int FROM storage.objects
   WHERE bucket_id = 'Files'
     AND name = (SELECT v FROM public._test_ids WHERE k = 'project_alpha')::text || '/Member Inbox/member-upload.pdf'),
  1,
  'members can read the Member Inbox they uploaded to'
);

SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*)::int FROM storage.objects
   WHERE bucket_id = 'Files'
     AND name = (SELECT v FROM public._test_ids WHERE k = 'project_alpha')::text || '/Member Inbox/member-upload.pdf'),
  0,
  'clients cannot read Member Inbox objects'
);
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('Files', (SELECT v FROM public._test_ids WHERE k = 'project_alpha')::text || '/Member Inbox/client-upload.pdf', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  NULL, NULL,
  'clients cannot upload into Member Inbox'
);

SELECT t.reset_auth();
SELECT * FROM finish();
ROLLBACK;
