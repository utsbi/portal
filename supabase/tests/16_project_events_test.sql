-- =====================================================================
-- project_events + project_event_attendees RLS isolation
-- =====================================================================
-- Goals:
--   1. Cross-tenant isolation: Client A cannot see Beta events/attendees.
--   2. INSERT: project members can create events (created_by forced to self).
--   3. UPDATE/DELETE: event creator + director can edit/delete; other members
--      can read but not mutate.
--   4. Attendee RSVP: the attendee can update their own response row, nobody
--      else can.
--   5. attended_at / responded_at trigger: stamping behaves as designed.
--
-- Fixtures added in _seed.sql:
--   event_alpha_director  (Director-created, Alpha)
--   event_alpha_client    (Client A-created, Alpha)
--   event_beta_director   (Director-created, Beta)
-- =====================================================================
BEGIN;
SELECT plan(24);

-- ---------------------------------------------------------------------
-- 1. Cross-tenant SELECT (Client A must NOT see Beta events).
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());

SELECT is(
  (SELECT count(*) FROM public.project_events
    WHERE id = t.id('event_beta_director'))::int,
  0,
  'project_events: Client A cannot SELECT Beta event (cross-tenant)'
);

SELECT is(
  (SELECT count(*) FROM public.project_events
    WHERE id IN (t.id('event_alpha_director'), t.id('event_alpha_client')))::int,
  2,
  'CONTROL project_events: Client A CAN SELECT own Alpha events (2 seeded)'
);

SELECT is(
  (SELECT count(*) FROM public.project_event_attendees
    WHERE event_id = t.id('event_beta_director'))::int,
  0,
  'project_event_attendees: Client A cannot SELECT Beta attendees (cross-tenant)'
);

SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 2. Non-member (anon-like, no claims) cannot read or write anything.
-- ---------------------------------------------------------------------
SELECT t.as_anon();
SELECT is(
  (SELECT count(*) FROM public.project_events)::int,
  0,
  'project_events: anon cannot SELECT any rows'
);
SELECT throws_ok(
  $$ INSERT INTO public.project_events
       (project_id, title, start_at, end_at, created_by)
     VALUES (t.id('project_alpha'), 'Anon attempt',
             now(), now() + interval '1 hour',
             t.id('profile_director')) $$,
  '42501', NULL,
  'project_events: anon INSERT is denied'
);
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 3. Director (cross-tenant staff) can read both tenants' events.
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.project_events
    WHERE id IN (t.id('event_alpha_director'),
                 t.id('event_alpha_client'),
                 t.id('event_beta_director')))::int,
  3,
  'project_events: director sees events on every project they are linked to'
);
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 4. INSERT: project member can create; created_by is forced to caller.
-- ---------------------------------------------------------------------
-- Client A creates a new event on Alpha.
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ INSERT INTO public.project_events
       (project_id, title, start_at, end_at, created_by)
     VALUES (t.id('project_alpha'), 'Client A new event',
             now() + interval '7 days',
             now() + interval '7 days' + interval '30 minutes',
             t.id('profile_clienta')) $$,
  'project_events: Client A can INSERT into their own Alpha project'
);

-- Client A tries to insert into Beta (NOT a member) — must be denied.
SELECT throws_ok(
  $$ INSERT INTO public.project_events
       (project_id, title, start_at, end_at, created_by)
     VALUES (t.id('project_beta'), 'Cross-tenant insert attempt',
             now(), now() + interval '1 hour',
             t.id('profile_clienta')) $$,
  '42501', NULL,
  'project_events: Client A INSERT into Beta is denied (cross-tenant)'
);

-- Client A tries to spoof created_by = director on insert — must be denied
-- (the WITH CHECK clause forces created_by = caller's own profile id).
SELECT throws_ok(
  $$ INSERT INTO public.project_events
       (project_id, title, start_at, end_at, created_by)
     VALUES (t.id('project_alpha'), 'Spoofed author',
             now(), now() + interval '1 hour',
             t.id('profile_director')) $$,
  '42501', NULL,
  'project_events: WITH CHECK forces created_by = caller (spoof blocked)'
);
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 5. UPDATE: only the event creator OR a director can update.
-- ---------------------------------------------------------------------
-- Director (on Alpha) can update the Client A-created event.
SELECT t.as_user(t.uid_director());
SELECT lives_ok(
  $$ UPDATE public.project_events
       SET title = 'Director renamed it'
     WHERE id = t.id('event_alpha_client') $$,
  'project_events: director can UPDATE a client-created event'
);
SELECT t.reset_auth();

-- Client A (the creator) can update their own event.
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ UPDATE public.project_events
       SET title = 'Client A renamed it'
     WHERE id = t.id('event_alpha_client') $$,
  'project_events: event creator can UPDATE their own event'
);
SELECT t.reset_auth();

-- A second member on the same project, who is NOT the creator and NOT a
-- director, must NOT be able to update. We have no second Alpha member in
-- the seed, so add one inline (auto-rolls-back with the test transaction).
INSERT INTO public.profiles (uid, name, email, role)
  VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          'Eve ExtraMember', 'eve@example.com', 'member')
  ON CONFLICT (uid) DO NOTHING;
INSERT INTO public.project_members (project_id, profile_id, role)
  SELECT t.id('project_alpha'),
         (SELECT id FROM public.profiles WHERE uid = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
         'member'
  ON CONFLICT DO NOTHING;

SELECT t.as_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
SELECT throws_ok(
  $$ UPDATE public.project_events
       SET title = 'Eve renamed it'
     WHERE id = t.id('event_alpha_client') $$,
  '42501', NULL,
  'project_events: non-creator non-director member UPDATE is denied'
);
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 6. DELETE: same rule as UPDATE — creator or director only.
-- ---------------------------------------------------------------------
SELECT t.as_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
SELECT is(
  (SELECT count(*) FROM public.project_events
    WHERE id = t.id('event_alpha_director'))::int,
  1,
  'CONTROL: non-creator member CAN still SELECT the event before attempting delete'
);
-- A direct DELETE — 0 rows affected because RLS filters them out.
SELECT lives_ok(
  $$ DELETE FROM public.project_events
     WHERE id = t.id('event_alpha_director') $$,
  'project_events: non-creator non-director DELETE is silently blocked (0 rows affected)'
);
SELECT is(
  (SELECT count(*) FROM public.project_events
    WHERE id = t.id('event_alpha_director'))::int,
  1,
  'project_events: non-creator non-director DELETE leaves row intact'
);
SELECT t.reset_auth();

-- Director can delete.
SELECT t.as_user(t.uid_director());
SELECT lives_ok(
  $$ DELETE FROM public.project_events
     WHERE id = t.id('event_alpha_director') $$,
  'project_events: director can DELETE an event on their project'
);
SELECT is(
  (SELECT count(*) FROM public.project_events
    WHERE id = t.id('event_alpha_director'))::int,
  0,
  'project_events: event actually removed after director DELETE'
);
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 7. Attendee RSVP: the attendee updates their own response; nobody else can.
-- ---------------------------------------------------------------------
-- Client A accepts their invite on event_alpha_client (which they themselves
-- created, but the RSVP path is still the attendee-side policy).
SELECT t.as_user(t.uid_clienta());
SELECT lives_ok(
  $$ UPDATE public.project_event_attendees
       SET response = 'accepted'
     WHERE event_id = t.id('event_alpha_director')
       AND profile_id = (SELECT id FROM public.profiles WHERE uid = t.uid_clienta()) $$,
  'project_event_attendees: attendee can UPDATE their own response (RSVP self-service)'
);

-- A non-attendee member tries to flip someone else's RSVP — must be denied.
SELECT throws_ok(
  $$ UPDATE public.project_event_attendees
       SET response = 'declined'
     WHERE event_id = t.id('event_alpha_director')
       AND profile_id = t.id('profile_director') $$,
  '42501', NULL,
  'project_event_attendees: non-attendee UPDATE on another attendee is denied'
);

-- Cross-tenant probe: Client A tries to read Beta attendees — must be 0.
SELECT is(
  (SELECT count(*) FROM public.project_event_attendees
    WHERE event_id = t.id('event_beta_director'))::int,
  0,
  'CONTROL project_event_attendees: Client A still cannot see Beta attendees after RSVP'
);
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- 8. responded_at trigger stamps automatically on RSVP.
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT responded_at IS NOT NULL
     FROM public.project_event_attendees
    WHERE event_id = t.id('event_alpha_director')
      AND profile_id = (SELECT id FROM public.profiles WHERE uid = t.uid_clienta())),
  true,
  'project_event_attendees: responded_at is set after moving off needsAction'
);

-- Flip back to needsAction — responded_at should clear.
SELECT lives_ok(
  $$ UPDATE public.project_event_attendees
       SET response = 'needsAction'
     WHERE event_id = t.id('event_alpha_director')
       AND profile_id = (SELECT id FROM public.profiles WHERE uid = t.uid_clienta()) $$
);
SELECT is(
  (SELECT responded_at
     FROM public.project_event_attendees
    WHERE event_id = t.id('event_alpha_director')
      AND profile_id = (SELECT id FROM public.profiles WHERE uid = t.uid_clienta())),
  NULL,
  'project_event_attendees: responded_at clears when response reverts to needsAction'
);
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
