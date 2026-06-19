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
SELECT plan(10);

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
-- questionnaire-images: PUBLIC bucket -> readable by anon (by design). Assert it
-- IS public (so we have explicit coverage of the one intentionally-public path)
-- and that NO other bucket leaks to anon.
-- ---------------------------------------------------------------------
SELECT t.as_anon();
SELECT is(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'questionnaire-images')::int, 1,
  'questionnaire-images: anon CAN read the public bucket (by design)');
-- anon must NOT read any private-bucket object (Files / Message Attachments /
-- ticket-attachments) -- these have no anon SELECT policy.
SELECT is(
  (SELECT count(*) FROM storage.objects
     WHERE bucket_id IN ('Files', 'Message Attachments', 'ticket-attachments'))::int, 0,
  'LEAK? anon must NOT read any private-bucket storage object');
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
