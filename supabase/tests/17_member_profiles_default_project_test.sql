-- Member profiles may exist without Auth, and default-project assignment is
-- intentionally limited to members with no existing membership.
BEGIN;
SELECT plan(10);

SELECT lives_ok(
  $$ INSERT INTO public.profiles (uid, name, contact_email, discord_id, role)
     VALUES (NULL, 'Discord Member', 'discord.member@example.com', '987654321', 'member') $$,
  'a member profile can exist without an auth uid'
);

SELECT is(
  (SELECT uid FROM public.profiles WHERE discord_id = '987654321'),
  NULL::uuid,
  'uid-less member has no portal account'
);

SELECT is(
  (SELECT count(*) FROM public.project_members pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE p.discord_id = '987654321')::int,
  0,
  'a member gets no membership before a default exists'
);

SELECT t.as_user(t.uid_director());
SELECT lives_ok(
  $$ SELECT public.set_default_project(t.id('project_alpha')) $$,
  'a director can select a default project'
);
SELECT t.reset_auth();

SELECT is(
  (SELECT count(*) FROM public.projects WHERE is_default)::int,
  1,
  'only one default project exists'
);

SELECT is(
  (SELECT project_id FROM public.project_members pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE p.discord_id = '987654321'),
  t.id('project_alpha'),
  'setting a default backfills only the unassigned member'
);

SELECT lives_ok(
  $$ INSERT INTO public.profiles (uid, name, role)
     VALUES (NULL, 'New Default Member', 'member') $$,
  'a newly inserted member profile is accepted'
);
SELECT is(
  (SELECT project_id FROM public.project_members pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE p.name = 'New Default Member'),
  t.id('project_alpha'),
  'new member profile receives the default project automatically'
);

SELECT throws_ok(
  $$ INSERT INTO public.profiles (uid, name, role)
     VALUES (NULL, 'UID-less client', 'client') $$,
  '23514', NULL,
  'clients cannot be created without a portal auth uid'
);

SELECT is(
  (SELECT count(*) FROM public.project_members pm
    WHERE pm.profile_id = t.id('profile_director'))::int,
  2,
  'existing director all-project memberships are unchanged'
);

SELECT * FROM finish();
ROLLBACK;
