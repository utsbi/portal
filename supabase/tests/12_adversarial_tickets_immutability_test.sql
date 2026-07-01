-- =====================================================================
-- ADVERSARIAL TARGET: tickets identity/ownership immutability (S10).
-- =====================================================================
-- Red-team intent: as the ticket CREATOR (Client A owns the seeded Alpha
-- tickets), the "Project members can update tickets" policy's `auth.uid()=uid`
-- arm passes the RLS gate — so without a column-immutability guard the owner
-- could re-parent the ticket into another project, forge ticket_type, or
-- reassign ownership. The 20260628000006 BEFORE UPDATE trigger must block all
-- identity/ownership mutations while still allowing legitimate workflow edits.
-- =====================================================================
BEGIN;
SELECT plan(4);

SELECT t.as_user(t.uid_clienta());

-- Re-parent into Beta — trigger must block (no cross-project relocation).
SELECT throws_ok(
  $$ UPDATE public.tickets
        SET project_id = (SELECT v FROM public._test_ids WHERE k='project_beta')
      WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha') $$,
  NULL, NULL,
  'tickets: owner cannot re-parent project_id (trigger blocks)');

-- Forge ticket_type (request -> report) — trigger must block.
SELECT throws_ok(
  $$ UPDATE public.tickets
        SET ticket_type = 'report'
      WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha') $$,
  NULL, NULL,
  'tickets: owner cannot change ticket_type (trigger blocks)');

-- Reassign ownership (uid) — trigger must block.
SELECT throws_ok(
  $$ UPDATE public.tickets
        SET uid = (SELECT t.uid_clientb())
      WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha') $$,
  NULL, NULL,
  'tickets: owner cannot reassign uid (trigger blocks)');

-- CONTROL: a legitimate workflow edit (status) by the owner still succeeds.
SELECT lives_ok(
  $$ UPDATE public.tickets
        SET status = 'done'
      WHERE project_id = (SELECT v FROM public._test_ids WHERE k='project_alpha') $$,
  'CONTROL tickets: owner CAN update workflow field (status)');

SELECT t.reset_auth();
SELECT * FROM finish();
ROLLBACK;
