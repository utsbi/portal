-- =====================================================================
-- ADVERSARIAL TARGET 9: storage.objects bucket folder-prefix scoping.
-- =====================================================================
-- The prior harness skipped storage RLS. The shim ships storage.objects with RLS
-- ENABLED and storage.foldername(); the migrations add folder-prefix policies:
--   * "Files"               : prefix "<project_id>/..."  (storage_path_project_member)
--   * "Message Attachments" : prefix "<conversation_id>/..."  (+ matching ma.path)
--   * "ticket-attachments"  : prefix "<project_id>/..."  (+ tickets.attachments path)
--   * "questionnaire-images": PUBLIC bucket (anon + authenticated read all)
--
-- Red-team intent: a user must NOT SELECT an object outside their own project /
-- conversation prefix. Cross-prefix counts must be 0; same-prefix controls >=1.
--
-- NOTE on "Files": INSERT/UPDATE/DELETE require is_director, but SELECT only
-- requires storage_path_project_member. Client A is a MEMBER of Alpha, so it can
-- read Alpha-prefixed objects but never Beta-prefixed ones.
-- =====================================================================
BEGIN;
SELECT plan(23);

-- ---------------------------------------------------------------------
-- Files bucket: project-prefix scoping.
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
-- control: Client A reads its own Alpha-prefixed Files object.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Files' AND name = t.id('project_alpha')::text || '/alpha-file.pdf')::int, 1,
  'CONTROL Files: Client A reads own Alpha-prefixed object');
-- leak probe: Client A must NOT read Beta-prefixed Files object.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Files' AND name = t.id('project_beta')::text || '/beta-file.pdf')::int, 0,
  'LEAK? Files: Client A must NOT read Beta-prefixed object (cross-project)');
SELECT t.reset_auth();

-- Client B (member of Beta) is the mirror: own yes, Alpha no.
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Files' AND name = t.id('project_beta')::text || '/beta-file.pdf')::int, 1,
  'CONTROL Files: Client B reads own Beta-prefixed object');
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Files' AND name = t.id('project_alpha')::text || '/alpha-file.pdf')::int, 0,
  'LEAK? Files: Client B must NOT read Alpha-prefixed object (cross-project)');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- Message Attachments bucket: conversation-prefix scoping (+ ma.path match).
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
-- control: Client A (participant of conv_alpha) reads its own attachment object.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Message Attachments'
       AND name = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 1,
  'CONTROL Message Attachments: Client A reads own conv_alpha attachment object');
-- leak probe: Client A must NOT read Beta conversation's attachment object.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Message Attachments'
       AND name = t.id('conv_beta')::text || '/beta-secret.pdf')::int, 0,
  'LEAK? Message Attachments: Client A must NOT read Beta conv attachment object');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- ticket-attachments bucket: project-prefix scoping (+ tickets.attachments path).
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
-- control: Client A (member of Alpha) reads the Alpha ticket attachment object.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'ticket-attachments'
       AND name = t.id('project_alpha')::text || '/alpha-ticket.pdf')::int, 1,
  'CONTROL ticket-attachments: Client A reads own Alpha ticket attachment object');
-- leak probe: Client A must NOT read the Beta ticket attachment object.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'ticket-attachments'
       AND name = t.id('project_beta')::text || '/beta-ticket.pdf')::int, 0,
  'LEAK? ticket-attachments: Client A must NOT read Beta ticket attachment object');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- questionnaire-images: PUBLIC bucket. After 20260619000002 the broad listing
-- SELECT policy is dropped (advisor: public_bucket_allows_listing). Individual
-- objects are still served by direct URL via the storage HTTP endpoint (public
-- bucket -> RLS bypassed for object serving), but the data API can NO LONGER
-- enumerate the bucket. In this in-DB harness there is no HTTP object endpoint,
-- so a data-API SELECT must now return 0 rows for anon -- i.e. not enumerable.
-- We also assert NO other bucket leaks to anon.
-- ---------------------------------------------------------------------
SELECT t.as_anon();
SELECT is(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'questionnaire-images')::int, 0,
  'questionnaire-images: anon can NOT enumerate the public bucket via data API (URL serving still works)');
-- anon must NOT read any private-bucket object (Files / Message Attachments /
-- ticket-attachments) -- these have no anon SELECT policy.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id IN ('Files', 'Message Attachments', 'ticket-attachments'))::int, 0,
  'LEAK? anon must NOT read any private-bucket storage object');
SELECT t.reset_auth();

-- =====================================================================
-- PARTICIPANT-MODEL retarget (20260628000002): message attachments + the
-- 'Message Attachments' storage bucket now authorize via
-- is_conversation_participant(conversation_id), NOT the legacy
-- client_profile_id/director_profile_id columns. conv_alpha = {Client A,
-- Director}; conv_beta = {Client B, Director}; Client B is NOT in conv_alpha.
-- =====================================================================

-- ---------------------------------------------------------------------
-- message_attachments TABLE SELECT: participant-scoped row visibility.
-- ---------------------------------------------------------------------
-- CONTROL: Client A (participant of conv_alpha) sees the conv_alpha attachment row.
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.message_attachments
     WHERE path = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 1,
  'CONTROL message_attachments: Client A (participant) reads own conv_alpha attachment row');
-- LEAK probe: Client A must NOT see conv_beta's attachment row.
SELECT is(
  (SELECT count(*) FROM public.message_attachments
     WHERE path = t.id('conv_beta')::text || '/beta-secret.pdf')::int, 0,
  'LEAK? message_attachments: Client A must NOT read Beta conv attachment row');
SELECT t.reset_auth();
-- LEAK probe: Client B (non-participant of conv_alpha) must NOT see its attachment row.
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM public.message_attachments
     WHERE path = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 0,
  'LEAK? message_attachments: non-participant Client B must NOT read conv_alpha attachment row');
SELECT t.reset_auth();
-- CONTROL: the Director (also a participant of conv_alpha) CAN read the row.
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.message_attachments
     WHERE path = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 1,
  'CONTROL message_attachments: Director (participant) reads conv_alpha attachment row');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- storage.objects 'Message Attachments' SELECT: participant-scoped.
-- ---------------------------------------------------------------------
-- LEAK probe: non-participant Client B must NOT read conv_alpha's storage object.
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Message Attachments'
       AND name = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 0,
  'LEAK? Message Attachments: non-participant Client B must NOT read conv_alpha object');
SELECT t.reset_auth();
-- CONTROL: Director (participant) CAN read conv_alpha's storage object.
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id = 'Message Attachments'
       AND name = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 1,
  'CONTROL Message Attachments: Director (participant) reads conv_alpha object');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- storage.objects 'Message Attachments' INSERT: WITH CHECK requires the first
-- path segment to name a conversation the uploader participates in.
-- ---------------------------------------------------------------------
-- non-participant Client B cannot upload into conv_alpha's prefix.
SELECT t.as_user(t.uid_clientb());
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('Message Attachments',
             (SELECT v FROM public._test_ids WHERE k='conv_alpha')::text || '/evil.pdf',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  NULL, NULL,
  'INSERT Message Attachments: non-participant Client B cannot upload into conv_alpha prefix');
-- CONTROL: Client B CAN upload into conv_beta's prefix (it is a participant there).
SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('Message Attachments',
             (SELECT v FROM public._test_ids WHERE k='conv_beta')::text || '/ok.pdf',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'CONTROL INSERT Message Attachments: Client B (participant) CAN upload into conv_beta prefix');
SELECT t.reset_auth();
-- CONTROL: Director (participant of conv_alpha) CAN upload into conv_alpha's prefix.
SELECT t.as_user(t.uid_director());
SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('Message Attachments',
             (SELECT v FROM public._test_ids WHERE k='conv_alpha')::text || '/legit.pdf',
             'dddddddd-dddd-dddd-dddd-dddddddddddd') $$,
  'CONTROL INSERT Message Attachments: Director (participant) CAN upload into conv_alpha prefix');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- message_attachments TABLE DELETE: only the sending participant may delete;
-- a non-participant (also non-sender) cannot. (DELETE policy is sender-scoped;
-- a non-participant is never the sender, so removal is denied -> no-op.)
-- ---------------------------------------------------------------------
-- non-participant Client B cannot delete conv_alpha's attachment row (no-op).
SELECT t.as_user(t.uid_clientb());
SELECT lives_ok(
  $$ DELETE FROM public.message_attachments
       WHERE path = (SELECT v FROM public._test_ids WHERE k='conv_alpha')::text || '/alpha-secret.pdf' $$,
  'DELETE message_attachments: non-participant Client B delete is a silent no-op');
SELECT t.reset_auth();
SELECT t.as_service();
SELECT is(
  (SELECT count(*) FROM public.message_attachments
     WHERE path = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 1,
  'DELETE message_attachments: conv_alpha attachment row survives non-participant DELETE');
SELECT t.reset_auth();
-- CONTROL: the sending participant (Client A) CAN delete their own attachment row.
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ DELETE FROM public.message_attachments
       WHERE path = (SELECT v FROM public._test_ids WHERE k='conv_alpha')::text || '/alpha-secret.pdf' $$,
  'CONTROL DELETE message_attachments: sending participant Client A deletes own attachment row');
SELECT t.reset_auth();
SELECT t.as_service();
SELECT is(
  (SELECT count(*) FROM public.message_attachments
     WHERE path = t.id('conv_alpha')::text || '/alpha-secret.pdf')::int, 0,
  'CONTROL DELETE message_attachments: row is gone after the sender deletes it');
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
