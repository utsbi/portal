-- Cross-tenant isolation sanity matrix: RLS is ENABLED on the key tenant tables,
-- and a representative cross-tenant SELECT returns zero rows.
BEGIN;
SELECT plan(15);

-- ---- RLS enabled on the key tenant tables ----
SELECT ok(relrowsecurity, 'RLS enabled: public.projects')
  FROM pg_class WHERE oid = 'public.projects'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.messages')
  FROM pg_class WHERE oid = 'public.messages'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.conversations')
  FROM pg_class WHERE oid = 'public.conversations'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.client_files')
  FROM pg_class WHERE oid = 'public.client_files'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.client_knowledge')
  FROM pg_class WHERE oid = 'public.client_knowledge'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.tickets')
  FROM pg_class WHERE oid = 'public.tickets'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.project_members')
  FROM pg_class WHERE oid = 'public.project_members'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.project_events')
  FROM pg_class WHERE oid = 'public.project_events'::regclass;
SELECT ok(relrowsecurity, 'RLS enabled: public.project_event_attendees')
  FROM pg_class WHERE oid = 'public.project_event_attendees'::regclass;

-- ---- Client A: sees own tenant, not Client B's ----
SELECT t.as_user(t.uid_clienta());

-- projects: Client A sees only Alpha (its single membership).
SELECT is(
  (SELECT count(*) FROM public.projects WHERE id = t.id('project_beta'))::int,
  0,
  'projects: Client A cannot SELECT Beta (cross-tenant)'
);
SELECT is(
  (SELECT count(*) FROM public.projects WHERE id = t.id('project_alpha'))::int,
  1,
  'projects: Client A CAN SELECT own Alpha project'
);

-- messages: Client A cannot see Beta's conversation messages.
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = t.id('conv_beta'))::int,
  0,
  'messages: Client A cannot SELECT Beta conversation messages (cross-tenant)'
);

-- client_files: uploader-private — Client A sees only its own file.
SELECT is(
  (SELECT count(*) FROM public.client_files WHERE uid = t.uid_clientb())::int,
  0,
  'client_files: Client A cannot SELECT Client B''s files (cross-tenant)'
);

-- tickets: Client A cannot see Beta's ticket (not a member of Beta).
SELECT is(
  (SELECT count(*) FROM public.tickets WHERE project_id = t.id('project_beta'))::int,
  0,
  'tickets: Client A cannot SELECT Beta project tickets (cross-tenant)'
);

SELECT t.reset_auth();

-- ---- Director sees across tenants (staff) ----
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.projects WHERE id IN (t.id('project_alpha'), t.id('project_beta')))::int,
  2,
  'projects: director sees both tenants (staff)'
);
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
