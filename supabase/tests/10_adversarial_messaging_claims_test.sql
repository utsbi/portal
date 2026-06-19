-- =====================================================================
-- ADVERSARIAL TARGETS 3 (D1 dynamic participant), 4 (D4 cross-user profile id),
-- 5 (D5 read-receipt forgery), 6 (D6 staff-only), 8 (claims tampering).
-- =====================================================================
BEGIN;
SELECT plan(16);

-- NOTE ON ORDERING: pgTAP runs this whole file in ONE transaction, so mutations
-- persist between assertions until the final ROLLBACK. The D5 read-receipt
-- forgery probe needs PRISTINE participant state (Client B NOT in conv_alpha),
-- so it runs FIRST -- before the D1 section deliberately adds Client B and
-- removes Client A to test dynamic membership.

-- ---------------------------------------------------------------------
-- TARGET 5 (D5): a non-participant cannot create a read receipt for a
-- conversation they are not in. mark_conversation_read must block, and no
-- conversation_reads row must appear for them. (Runs first: pristine state.)
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clientb());
SELECT throws_ok(
  $$ SELECT public.mark_conversation_read(
        (SELECT v FROM public._test_ids WHERE k='conv_alpha')) $$,
  NULL, NULL,
  'D5: non-participant Client B cannot mark_conversation_read on conv_alpha');
SELECT t.reset_auth();
-- Confirm no read receipt was created for Client B on conv_alpha (no-op/blocked).
-- (Read as service so RLS does not mask a row that WAS wrongly written.)
SELECT t.as_service();
SELECT is(
  (SELECT count(*) FROM public.conversation_reads
     WHERE conversation_id = (SELECT v FROM public._test_ids WHERE k='conv_alpha')
       AND profile_id = (SELECT v FROM public._test_ids WHERE k='profile_clientb'))::int, 0,
  'D5: no conversation_reads row was forged for non-participant Client B');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- TARGET 3 (D1): participant membership is DYNAMIC. Removing a participant must
-- immediately revoke message SELECT; adding one must immediately grant it.
-- ---------------------------------------------------------------------
-- Baseline: Client B is NOT a participant of conv_alpha -> reads 0 messages.
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = t.id('conv_alpha'))::int, 0,
  'D1: non-participant Client B reads 0 messages of conv_alpha');
SELECT is(public.is_conversation_participant(t.id('conv_alpha')), false,
  'D1: is_conversation_participant(conv_alpha) is false for Client B');
SELECT t.reset_auth();

-- ADD Client B to conv_alpha (as superuser, RLS bypassed) -> B gains access.
INSERT INTO public.conversation_participants (conversation_id, profile_id, role_at_join)
VALUES (t.id('conv_alpha'),
        (SELECT v FROM public._test_ids WHERE k='profile_clientb'), 'client')
ON CONFLICT DO NOTHING;
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = t.id('conv_alpha'))::int, 1,
  'D1: after being ADDED, Client B immediately reads conv_alpha messages');
SELECT is(public.is_conversation_participant(t.id('conv_alpha')), true,
  'D1: is_conversation_participant(conv_alpha) becomes true after add');
SELECT t.reset_auth();

-- REMOVE Client A from conv_alpha -> A immediately loses access.
DELETE FROM public.conversation_participants
 WHERE conversation_id = t.id('conv_alpha')
   AND profile_id = (SELECT v FROM public._test_ids WHERE k='profile_clienta');
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = t.id('conv_alpha'))::int, 0,
  'D1: after being REMOVED, Client A immediately loses conv_alpha message access');
SELECT is(public.is_conversation_participant(t.id('conv_alpha')), false,
  'D1: is_conversation_participant(conv_alpha) becomes false after remove');
SELECT t.reset_auth();

-- The 2-arg oracle must be GONE: calling it errors (function does not exist).
SELECT throws_ok(
  $$ SELECT public.is_conversation_participant(1::bigint, '00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42883', NULL,
  'D1: old 2-arg is_conversation_participant(bigint,uuid) no longer exists (undefined function)');

-- ---------------------------------------------------------------------
-- TARGET 4 (D4): user_profile_id honors its param. Adversarial angle: ensure no
-- live SELECT policy uses a CROSS-USER user_profile_id value to grant access.
-- conversation_reads policy is "profile_id = user_profile_id(auth.uid())". We
-- prove that passing self yields self, and that the policy cannot be tricked: a
-- client reads ONLY its own read-receipt rows, never another profile's.
-- ---------------------------------------------------------------------
SELECT t.as_user(t.uid_clienta());
-- honored param: returns the OTHER user's id for an explicit cross-user call.
SELECT is(public.user_profile_id(t.uid_clientb()),
  (SELECT v FROM public._test_ids WHERE k='profile_clientb'),
  'D4: user_profile_id(clientB) honors param, returns Client B''s profile id');
-- but the conversation_reads RLS keys on user_profile_id(auth.uid()) (self), so
-- Client A sees only its OWN read receipt, not Client B''s (no cross-user grant).
SELECT is(
  (SELECT count(*) FROM public.conversation_reads
     WHERE profile_id = (SELECT v FROM public._test_ids WHERE k='profile_clientb'))::int, 0,
  'D4: conversation_reads policy does NOT grant Client A access to Client B''s read row');
SELECT is(
  (SELECT count(*) FROM public.conversation_reads
     WHERE profile_id = (SELECT v FROM public._test_ids WHERE k='profile_clienta'))::int, 1,
  'D4 CONTROL: Client A sees its own conversation_reads row');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- TARGET 6 (D6): client reads ZERO from legal_documents AND website_forms; anon
-- can INSERT website_forms but cannot read back even its OWN insert.
-- ---------------------------------------------------------------------
SELECT t.as_anon();
-- anon inserts a uniquely-identifiable lead ...
SELECT lives_ok(
  $$ INSERT INTO public.website_forms (name, email, subject, message)
     VALUES ('Adversary Lead', 'adversary@example.com', 'probe', 'can I read this back?') $$,
  'D6: anon CAN INSERT into website_forms (public intake preserved)');
-- ... and must NOT be able to read it (or any other) back.
SELECT is(
  (SELECT count(*) FROM public.website_forms WHERE email = 'adversary@example.com')::int, 0,
  'D6 LEAK? anon cannot read back its OWN website_forms insert');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- TARGET 8: claims tampering. As SET ROLE authenticated, forge claims that
-- (a) impersonate a different sub, and (b) assert role=service_role. Neither may
-- escalate beyond what the authenticated role + true identity allow.
-- ---------------------------------------------------------------------
-- (a) Forge sub = Client B while SET ROLE authenticated. The privilege ceiling
--     is still the authenticated role; auth.uid() will read the forged sub, so
--     this tests whether a forged sub alone lets one act as another user. The
--     RLS evaluates as 'authenticated' with sub=ClientB, so this behaves as
--     Client B -- which is EXACTLY why the real system must never let a client
--     mint its own JWT. Here we assert the ceiling: even with role=service_role
--     in the CLAIMS, BYPASSRLS is NOT granted (that is a ROLE attribute, not a
--     claim), so RLS still applies.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', t.uid_clienta()::text, 'role', 'service_role')::text, false);
SET ROLE authenticated;  -- real DB role stays authenticated; only claims say service_role
-- Despite role=service_role in the claims, RLS is NOT bypassed: Client A still
-- cannot see Beta's project (BYPASSRLS is a role attribute, not a JWT claim).
SELECT is(
  (SELECT count(*) FROM public.projects WHERE id = t.id('project_beta'))::int, 0,
  'TARGET 8: role=service_role in CLAIMS does not grant BYPASSRLS (cross-tenant still blocked)');
-- And legal_documents (staff-only) stays empty: claims cannot fake director-ness
-- beyond what is_director(auth.uid()) derives from the real profile row.
SELECT is(
  (SELECT count(*) FROM public.legal_documents)::int, 0,
  'TARGET 8: forged service_role claim does not unlock staff-only legal_documents');
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
