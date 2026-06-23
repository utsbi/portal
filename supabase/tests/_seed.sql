-- =====================================================================
-- DETERMINISTIC TEST FIXTURES (run as superuser/service — bypasses RLS)
-- =====================================================================
-- Two tenants for cross-tenant isolation:
--   * Project Alpha  (id captured) — Client A is the only client member
--   * Project Beta   (id captured) — Client B is the only client member
--   * One Director who belongs to BOTH projects (the staff role)
--
-- Fixed auth uids so the test files can impersonate without a lookup:
--   Client A  : aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   Client B  : bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   Director  : dddddddd-dddd-dddd-dddd-dddddddddddd
--
-- IMPORTANT — auto-link triggers (baseline):
--   * trg_auto_link_director_to_projects (AFTER INSERT ON profiles): when a
--     director profile is inserted, it is added as 'director' to EVERY existing
--     project.
--   * trg_auto_link_directors_to_new_project (AFTER INSERT ON projects): a new
--     project auto-adds all directors + (if created_by set) the creator as owner.
-- To keep memberships deterministic we insert the DIRECTOR profile FIRST, then
-- the projects (so the director is auto-linked to both), then the client
-- profiles, then explicit client memberships. We assert the resulting
-- membership counts in rls_sanity so drift is caught.
-- =====================================================================

-- ---- auth.users ----
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clienta@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'clientb@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'director@example.com')
ON CONFLICT (id) DO NOTHING;

-- ---- Director profile first (so it auto-links to projects created next) ----
INSERT INTO public.profiles (uid, name, email, role) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Dana Director', 'director@example.com', 'director');

-- ---- Projects (director auto-linked to both by trigger) ----
INSERT INTO public.projects (url_slug, company_name) VALUES ('alpha', 'Alpha Co');
INSERT INTO public.projects (url_slug, company_name) VALUES ('beta',  'Beta Co');

-- ---- Client profiles ----
INSERT INTO public.profiles (uid, name, email, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice ClientA', 'clienta@example.com', 'client'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob ClientB',   'clientb@example.com', 'client');

-- ---- Capture ids into a temp settings table the tests can read ----
-- (A plain temp table keyed by name; survives within the session that runs the
--  seed + tests. Each test file re-derives ids via these helper lookups too.)
CREATE TABLE IF NOT EXISTS public._test_ids (k text PRIMARY KEY, v bigint);

INSERT INTO public._test_ids (k, v)
SELECT 'project_alpha', id FROM public.projects WHERE url_slug = 'alpha'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
INSERT INTO public._test_ids (k, v)
SELECT 'project_beta', id FROM public.projects WHERE url_slug = 'beta'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
INSERT INTO public._test_ids (k, v)
SELECT 'profile_clienta', id FROM public.profiles WHERE uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
INSERT INTO public._test_ids (k, v)
SELECT 'profile_clientb', id FROM public.profiles WHERE uid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
INSERT INTO public._test_ids (k, v)
SELECT 'profile_director', id FROM public.profiles WHERE uid = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

GRANT SELECT ON public._test_ids TO anon, authenticated, service_role;

-- ---- Client memberships (clients belong to exactly ONE project each) ----
INSERT INTO public.project_members (project_id, profile_id, role)
SELECT (SELECT v FROM public._test_ids WHERE k='project_alpha'),
       (SELECT v FROM public._test_ids WHERE k='profile_clienta'), 'member'
ON CONFLICT DO NOTHING;
INSERT INTO public.project_members (project_id, profile_id, role)
SELECT (SELECT v FROM public._test_ids WHERE k='project_beta'),
       (SELECT v FROM public._test_ids WHERE k='profile_clientb'), 'member'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- Conversations + participants + messages
--   conv_alpha: Director <-> Client A   (Client B is NOT a participant)
--   conv_beta : Director <-> Client B
-- =====================================================================
INSERT INTO public.conversations (client_profile_id, director_profile_id, project_id)
SELECT (SELECT v FROM public._test_ids WHERE k='profile_clienta'),
       (SELECT v FROM public._test_ids WHERE k='profile_director'),
       (SELECT v FROM public._test_ids WHERE k='project_alpha');
INSERT INTO public._test_ids (k, v)
SELECT 'conv_alpha', max(id) FROM public.conversations
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

INSERT INTO public.conversations (client_profile_id, director_profile_id, project_id)
SELECT (SELECT v FROM public._test_ids WHERE k='profile_clientb'),
       (SELECT v FROM public._test_ids WHERE k='profile_director'),
       (SELECT v FROM public._test_ids WHERE k='project_beta');
INSERT INTO public._test_ids (k, v)
SELECT 'conv_beta', max(id) FROM public.conversations
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

-- Participants (conversation_participants is what the D1 1-arg fn reads).
INSERT INTO public.conversation_participants (conversation_id, profile_id, role_at_join) VALUES
  ((SELECT v FROM public._test_ids WHERE k='conv_alpha'),
   (SELECT v FROM public._test_ids WHERE k='profile_clienta'), 'client'),
  ((SELECT v FROM public._test_ids WHERE k='conv_alpha'),
   (SELECT v FROM public._test_ids WHERE k='profile_director'), 'director'),
  ((SELECT v FROM public._test_ids WHERE k='conv_beta'),
   (SELECT v FROM public._test_ids WHERE k='profile_clientb'), 'client'),
  ((SELECT v FROM public._test_ids WHERE k='conv_beta'),
   (SELECT v FROM public._test_ids WHERE k='profile_director'), 'director')
ON CONFLICT DO NOTHING;

-- Messages in each conversation.
INSERT INTO public.messages (conversation_id, sender_uid, sender_role, sender_profile_id, content) VALUES
  ((SELECT v FROM public._test_ids WHERE k='conv_alpha'),
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'client',
   (SELECT v FROM public._test_ids WHERE k='profile_clienta'), 'Hello from Alpha client'),
  ((SELECT v FROM public._test_ids WHERE k='conv_beta'),
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'client',
   (SELECT v FROM public._test_ids WHERE k='profile_clientb'), 'Hello from Beta client');

-- =====================================================================
-- client_knowledge: project-scoped rows + a NULL-project row
-- =====================================================================
INSERT INTO public.client_knowledge (uid, content, project_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha tenant secret knowledge',
   (SELECT v FROM public._test_ids WHERE k='project_alpha')),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta tenant secret knowledge',
   (SELECT v FROM public._test_ids WHERE k='project_beta')),
  -- NULL-project row owned by Client A (legacy / orphaned upload).
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha orphan unscoped knowledge', NULL),
  -- NULL-project row owned by the Director (D6 director-read path).
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Director orphan unscoped knowledge', NULL);

-- =====================================================================
-- custom_form_schemas with the secret columns set (D2)
-- =====================================================================
INSERT INTO public.custom_form_schemas
  (title, description, created_by, visibility, public_token, public_password_hash)
VALUES
  ('Public Intake Form', 'A password-protected public form',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'password',
   'tok_super_secret_capability_123', 'scrypt$deadbeefhash');
INSERT INTO public._test_ids (k, v)
SELECT 'form_public', max(id) FROM public.custom_form_schemas
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

-- =====================================================================
-- legal_documents (staff-only after D6)
-- =====================================================================
INSERT INTO public.legal_documents (content, metadata) VALUES
  ('Confidential NDA template', '{"kind":"nda"}'::jsonb),
  ('Confidential MSA template', '{"kind":"msa"}'::jsonb);

-- =====================================================================
-- website_forms (public intake; staff-only read after D6)
-- =====================================================================
INSERT INTO public.website_forms (name, email, subject, message, ip_address) VALUES
  ('Walk-in Lead', 'lead@example.com', 'Inquiry', 'Please contact me', '203.0.113.7'),
  ('Second Lead',  'lead2@example.com', 'Quote',  'How much?',          '203.0.113.8');

-- ---- tickets: one per project (for the cross-tenant sanity matrix) ----
INSERT INTO public.tickets (ticket_type, subject, message, project_id, uid) VALUES
  ('request', 'Alpha request', 'body',
   (SELECT v FROM public._test_ids WHERE k='project_alpha'),
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('request', 'Beta request', 'body',
   (SELECT v FROM public._test_ids WHERE k='project_beta'),
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ---- client_files: one per client (uploader-private) ----
INSERT INTO public.client_files (file_name, storage_path, uid) VALUES
  ('alpha.pdf', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/alpha.pdf',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('beta.pdf',  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/beta.pdf',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- =====================================================================
-- =====================================================================
-- ADVERSARIAL HARNESS ADDITIONS (red-team test files 08+)
-- =====================================================================
-- The original seed (rows above) is UNCHANGED. Everything below is ADDITIVE:
-- it materializes a cross-tenant row on EVERY remaining tenant-data table so the
-- adversarial cross-tenant sweep (08_*) can assert that Client A reads ZERO of
-- Client B's rows on each table. Without a real Beta-owned row to leak, a "0
-- rows for Client A" assertion would be a tautology (there is nothing to read);
-- these rows make each assertion a genuine isolation probe. Inserted as the
-- superuser (RLS bypassed at seed time), exactly like the rows above.
-- =====================================================================

-- ---- finance: a budget + category + transaction per project ----
INSERT INTO public.project_budgets (project_id, period_start, period_end)
SELECT (SELECT v FROM public._test_ids WHERE k='project_alpha'),
       DATE '2026-01-01', DATE '2026-12-31'
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public._test_ids (k, v)
SELECT 'budget_alpha', id FROM public.project_budgets
 WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha')
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

INSERT INTO public.project_budgets (project_id, period_start, period_end)
SELECT (SELECT v FROM public._test_ids WHERE k='project_beta'),
       DATE '2026-01-01', DATE '2026-12-31'
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public._test_ids (k, v)
SELECT 'budget_beta', id FROM public.project_budgets
 WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_beta')
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

INSERT INTO public.budget_categories (budget_id, name, expected_amount) VALUES
  ((SELECT v FROM public._test_ids WHERE k='budget_alpha'), 'Alpha cat', 1000),
  ((SELECT v FROM public._test_ids WHERE k='budget_beta'),  'Beta cat',  2000)
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_transactions (budget_id, category_id, occurred_on, title, description, amount)
SELECT b.id, c.id, DATE '2026-02-01', 'Alpha tx', 'Alpha tx', 111
FROM public.project_budgets b
JOIN public.budget_categories c ON c.budget_id = b.id
WHERE b.id = (SELECT v FROM public._test_ids WHERE k='budget_alpha');
INSERT INTO public.budget_transactions (budget_id, category_id, occurred_on, title, description, amount)
SELECT b.id, c.id, DATE '2026-02-01', 'Beta tx', 'Beta tx', 222
FROM public.project_budgets b
JOIN public.budget_categories c ON c.budget_id = b.id
WHERE b.id = (SELECT v FROM public._test_ids WHERE k='budget_beta');

-- ---- lifecycle: a lifecycle_project + task per project ----
INSERT INTO public.lifecycle_projects (project_id, title) VALUES
  ((SELECT v FROM public._test_ids WHERE k='project_alpha'), 'Alpha roadmap'),
  ((SELECT v FROM public._test_ids WHERE k='project_beta'),  'Beta roadmap');
INSERT INTO public._test_ids (k, v)
SELECT 'lifecycle_alpha', id FROM public.lifecycle_projects
 WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha')
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
INSERT INTO public._test_ids (k, v)
SELECT 'lifecycle_beta', id FROM public.lifecycle_projects
 WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_beta')
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

INSERT INTO public.lifecycle_tasks (lifecycle_project_id, title, team, due_date) VALUES
  ((SELECT v FROM public._test_ids WHERE k='lifecycle_alpha'), 'Alpha task', 'engineering', DATE '2026-03-01'),
  ((SELECT v FROM public._test_ids WHERE k='lifecycle_beta'),  'Beta task',  'engineering', DATE '2026-03-01');

-- ---- client_chat_sessions + messages (uploader-private, per client) ----
INSERT INTO public.client_chat_sessions (uid, title, project_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha chat',
   (SELECT v FROM public._test_ids WHERE k='project_alpha')),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta chat',
   (SELECT v FROM public._test_ids WHERE k='project_beta'));
INSERT INTO public._test_ids (k, v)
SELECT 'chat_session_beta', id FROM public.client_chat_sessions
 WHERE uid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
INSERT INTO public._test_ids (k, v)
SELECT 'chat_session_alpha', id FROM public.client_chat_sessions
 WHERE uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;

INSERT INTO public.client_chat_messages (session_id, role, content) VALUES
  ((SELECT v FROM public._test_ids WHERE k='chat_session_alpha'), 'user', 'Alpha private chat msg'),
  ((SELECT v FROM public._test_ids WHERE k='chat_session_beta'),  'user', 'Beta private chat msg');

-- ---- custom_form_submissions: one per client, scoped to their project ----
INSERT INTO public.custom_form_submissions (form_id, user_id, data, project_id) VALUES
  ((SELECT v FROM public._test_ids WHERE k='form_public'),
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"answer":"alpha"}'::jsonb,
   (SELECT v FROM public._test_ids WHERE k='project_alpha')),
  ((SELECT v FROM public._test_ids WHERE k='form_public'),
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"answer":"beta"}'::jsonb,
   (SELECT v FROM public._test_ids WHERE k='project_beta'));

-- ---- message_attachments: one on each tenant's seeded message ----
--      path mirrors the bucket convention "<conversation_id>/<file>".
INSERT INTO public.message_attachments (message_id, path, name, mime_type)
SELECT m.id,
       (SELECT v FROM public._test_ids WHERE k='conv_alpha')::text || '/alpha-secret.pdf',
       'alpha-secret.pdf', 'application/pdf'
FROM public.messages m
WHERE m.conversation_id = (SELECT v FROM public._test_ids WHERE k='conv_alpha');
INSERT INTO public.message_attachments (message_id, path, name, mime_type)
SELECT m.id,
       (SELECT v FROM public._test_ids WHERE k='conv_beta')::text || '/beta-secret.pdf',
       'beta-secret.pdf', 'application/pdf'
FROM public.messages m
WHERE m.conversation_id = (SELECT v FROM public._test_ids WHERE k='conv_beta');

-- ---- conversation_reads: a read receipt for each participant client ----
INSERT INTO public.conversation_reads (conversation_id, profile_id) VALUES
  ((SELECT v FROM public._test_ids WHERE k='conv_alpha'),
   (SELECT v FROM public._test_ids WHERE k='profile_clienta')),
  ((SELECT v FROM public._test_ids WHERE k='conv_beta'),
   (SELECT v FROM public._test_ids WHERE k='profile_clientb'))
ON CONFLICT DO NOTHING;

-- ---- tickets: a SECOND ticket for Client A so message_attachments / ticket
--      cross-tenant probes have a same-tenant control too (additive). ----
INSERT INTO public.tickets (ticket_type, subject, message, project_id, uid) VALUES
  ('request', 'Alpha second request', 'body',
   (SELECT v FROM public._test_ids WHERE k='project_alpha'),
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- =====================================================================
-- storage.objects fixtures (for the storage-RLS adversarial file, 11_*)
-- =====================================================================
-- "Files" bucket: prefix is "<project_id>/..." (storage_path_project_member).
-- "Message Attachments": prefix is "<conversation_id>/..." and the row's `path`
-- must match an existing message_attachments.path for the read policy to allow.
-- "ticket-attachments": prefix is "<project_id>/..." and a tickets.attachments
-- entry must reference the object name. We register the matching attachment JSON
-- on the Alpha/Beta tickets so the read policy's EXISTS can succeed for members.
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('Files', (SELECT v FROM public._test_ids WHERE k='project_alpha')::text || '/alpha-file.pdf',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('Files', (SELECT v FROM public._test_ids WHERE k='project_beta')::text  || '/beta-file.pdf',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('Message Attachments',
   (SELECT v FROM public._test_ids WHERE k='conv_alpha')::text || '/alpha-secret.pdf',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('Message Attachments',
   (SELECT v FROM public._test_ids WHERE k='conv_beta')::text  || '/beta-secret.pdf',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('ticket-attachments', (SELECT v FROM public._test_ids WHERE k='project_alpha')::text || '/alpha-ticket.pdf',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('ticket-attachments', (SELECT v FROM public._test_ids WHERE k='project_beta')::text  || '/beta-ticket.pdf',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('questionnaire-images', 'dddddddd-dddd-dddd-dddd-dddddddddddd/banner.png',
   'dddddddd-dddd-dddd-dddd-dddddddddddd')
ON CONFLICT DO NOTHING;

-- Wire the ticket-attachments objects into the tickets.attachments jsonb so the
-- "Authenticated users can read ticket-attachments" policy's EXISTS resolves.
UPDATE public.tickets
   SET attachments = jsonb_build_array(jsonb_build_object(
         'path', (SELECT v FROM public._test_ids WHERE k='project_alpha')::text || '/alpha-ticket.pdf'))
 WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha')
   AND subject = 'Alpha request';
UPDATE public.tickets
   SET attachments = jsonb_build_array(jsonb_build_object(
         'path', (SELECT v FROM public._test_ids WHERE k='project_beta')::text || '/beta-ticket.pdf'))
 WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_beta')
   AND subject = 'Beta request';
