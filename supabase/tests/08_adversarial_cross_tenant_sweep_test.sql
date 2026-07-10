-- =====================================================================
-- ADVERSARIAL TARGET 7: cross-tenant deep sweep.
-- =====================================================================
-- Red-team intent: impersonate Client A and try to read Client B's (Beta) row
-- on EVERY tenant-data table. Every seed adds a real Beta-owned row, so a "0
-- rows" result is a genuine isolation pass, not a tautology. ANY table where the
-- count is non-zero is a REAL cross-tenant leak.
--
-- Expected outcome from the isolation requirement ("a client must NEVER read
-- another tenant's data; only same-tenant members + directors may"): every
-- cross-tenant count below is 0, and every same-tenant control count is >=1.
-- =====================================================================
BEGIN;
SELECT plan(25);

-- ---------------------------------------------------------------------
-- Client A: must NOT see any Beta-tenant row.
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());

-- projects (control + cross-tenant)
SELECT is((SELECT count(*) FROM public.projects WHERE id = t.id('project_alpha'))::int, 1,
  'CONTROL projects: Client A sees own Alpha project');
SELECT is((SELECT count(*) FROM public.projects WHERE id = t.id('project_beta'))::int, 0,
  'LEAK? projects: Client A must NOT see Beta project');

-- project_members
SELECT is((SELECT count(*) FROM public.project_members
            WHERE project_id = t.id('project_beta'))::int, 0,
  'LEAK? project_members: Client A must NOT see Beta memberships');

-- messages
SELECT is((SELECT count(*) FROM public.messages
            WHERE conversation_id = t.id('conv_beta'))::int, 0,
  'LEAK? messages: Client A must NOT see Beta conversation messages');

-- message_attachments (a real Beta attachment exists)
SELECT is((SELECT count(*) FROM public.message_attachments
            WHERE name = 'beta-secret.pdf')::int, 0,
  'LEAK? message_attachments: Client A must NOT see Beta message attachment');
-- control: Client A CAN see Alpha's own attachment
SELECT is((SELECT count(*) FROM public.message_attachments
            WHERE name = 'alpha-secret.pdf')::int, 1,
  'CONTROL message_attachments: Client A sees own Alpha attachment');

-- conversations
SELECT is((SELECT count(*) FROM public.conversations WHERE id = t.id('conv_beta'))::int, 0,
  'LEAK? conversations: Client A must NOT see Beta conversation');

-- conversation_reads (Client B has a read receipt on conv_beta)
SELECT is((SELECT count(*) FROM public.conversation_reads
            WHERE conversation_id = t.id('conv_beta'))::int, 0,
  'LEAK? conversation_reads: Client A must NOT see Beta read receipts');

-- conversation_participants (roster of Beta)
SELECT is((SELECT count(*) FROM public.conversation_participants
            WHERE conversation_id = t.id('conv_beta'))::int, 0,
  'LEAK? conversation_participants: Client A must NOT see Beta roster');

-- tickets
SELECT is((SELECT count(*) FROM public.tickets WHERE project_id = t.id('project_beta'))::int, 0,
  'LEAK? tickets: Client A must NOT see Beta tickets');

-- client_files (uploader-private)
SELECT is((SELECT count(*) FROM public.client_files WHERE uid = t.uid_clientb())::int, 0,
  'LEAK? client_files: Client A must NOT see Beta files');

-- client_knowledge (project-scoped)
SELECT is((SELECT count(*) FROM public.client_knowledge
            WHERE content = 'Beta tenant secret knowledge')::int, 0,
  'LEAK? client_knowledge: Client A must NOT see Beta knowledge');

-- client_chat_sessions (uploader-private)
SELECT is((SELECT count(*) FROM public.client_chat_sessions WHERE uid = t.uid_clientb())::int, 0,
  'LEAK? client_chat_sessions: Client A must NOT see Beta chat sessions');

-- client_chat_messages (Beta-owned, via session join)
SELECT is((SELECT count(*) FROM public.client_chat_messages
            WHERE content = 'Beta private chat msg')::int, 0,
  'LEAK? client_chat_messages: Client A must NOT see Beta chat messages');

-- custom_form_submissions
SELECT is((SELECT count(*) FROM public.custom_form_submissions
            WHERE user_id = t.uid_clientb())::int, 0,
  'LEAK? custom_form_submissions: Client A must NOT see Beta submissions');

-- finance: project_budgets
SELECT is((SELECT count(*) FROM public.project_budgets
            WHERE project_id = t.id('project_beta'))::int, 0,
  'LEAK? project_budgets: Client A must NOT see Beta budget');

-- finance: budget_categories
SELECT is((SELECT count(*) FROM public.budget_categories WHERE name = 'Beta cat')::int, 0,
  'LEAK? budget_categories: Client A must NOT see Beta category');

-- finance: budget_transactions
SELECT is((SELECT count(*) FROM public.budget_transactions WHERE description = 'Beta tx')::int, 0,
  'LEAK? budget_transactions: Client A must NOT see Beta transaction');

-- lifecycle_projects
SELECT is((SELECT count(*) FROM public.lifecycle_projects WHERE title = 'Beta roadmap')::int, 0,
  'LEAK? lifecycle_projects: Client A must NOT see Beta lifecycle project');

-- lifecycle_tasks
SELECT is((SELECT count(*) FROM public.lifecycle_tasks WHERE title = 'Beta task')::int, 0,
  'LEAK? lifecycle_tasks: Client A must NOT see Beta lifecycle task');

-- profiles: Client A must NOT see Client B's profile (not co-participant, A is
-- not a director). A non-director client should only see own + co-participants.
SELECT is((SELECT count(*) FROM public.profiles WHERE uid = t.uid_clientb())::int, 0,
  'LEAK? profiles: Client A must NOT see Client B''s profile');

-- project_events: Calendar must NOT cross tenants.
SELECT is((SELECT count(*) FROM public.project_events WHERE id = t.id('event_beta_director'))::int, 0,
  'LEAK? project_events: Client A must NOT see Beta calendar event');

-- project_event_attendees: same isolation as the parent event row.
SELECT is((SELECT count(*) FROM public.project_event_attendees
            WHERE event_id = t.id('event_beta_director'))::int, 0,
  'LEAK? project_event_attendees: Client A must NOT see Beta attendee list');

SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- Same-tenant controls: Client A CAN read its own Alpha rows (prove the
-- sweep is not just "everything returns 0").
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
SELECT is((SELECT count(*) FROM public.tickets WHERE project_id = t.id('project_alpha'))::int, 2,
  'CONTROL tickets: Client A sees own Alpha tickets (2 seeded)');
SELECT is((SELECT count(*) FROM public.lifecycle_projects WHERE title = 'Alpha roadmap')::int, 1,
  'CONTROL lifecycle_projects: Client A sees own Alpha lifecycle project');
SELECT is((SELECT count(*) FROM public.project_events
            WHERE id = t.id('event_alpha_director'))::int, 1,
  'CONTROL project_events: Client A sees own Alpha calendar event');
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
