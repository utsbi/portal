-- Internal roster replaces the configurable default-project destination.
BEGIN;
SELECT plan(17);

SELECT lives_ok(
  $$ INSERT INTO public.profiles (uid, name, contact_email, discord_id, role)
     VALUES (NULL, 'Discord Member', 'discord.member@example.com', '987654321', 'member') $$,
  'a member profile can exist without a login'
);
SELECT is((SELECT uid FROM public.profiles WHERE discord_id = '987654321'), NULL::uuid,
  'uid-less member has no portal account');

INSERT INTO public.projects (url_slug, company_name, config)
VALUES ('sbi-internal-test', 'SBI', '{"workspace_type":"sbi"}');
SELECT is((SELECT count(*) FROM public.project_members pm JOIN public.profiles p ON p.id = pm.profile_id
  JOIN public.projects project ON project.id = pm.project_id
  WHERE p.discord_id = '987654321' AND project.config->>'workspace_type' = 'sbi')::int,
  1, 'creating SBI backfills existing uid-less members');
SELECT is((SELECT count(*) FROM public.project_members pm JOIN public.profiles p ON p.id = pm.profile_id
  JOIN public.projects project ON project.id = pm.project_id
  WHERE project.config->>'workspace_type' = 'sbi' AND p.role = 'client')::int,
  0, 'clients are excluded from SBI');

INSERT INTO public.profiles (uid, name, role) VALUES (NULL, 'New Internal Member', 'member');
SELECT is((SELECT count(*) FROM public.project_members pm JOIN public.profiles p ON p.id = pm.profile_id
  JOIN public.projects project ON project.id = pm.project_id
  WHERE p.name = 'New Internal Member' AND project.config->>'workspace_type' = 'sbi')::int,
  1, 'new member profiles are linked to SBI automatically');
SELECT is((SELECT count(*) FROM public.project_members pm JOIN public.profiles p ON p.id = pm.profile_id
  JOIN public.projects project ON project.id = pm.project_id
  WHERE p.name = 'New Internal Member' AND project.config->>'workspace_type' IS DISTINCT FROM 'sbi')::int,
  0, 'new members are not added to client projects');

SELECT throws_ok($$ INSERT INTO public.profiles (uid, name, role)
  VALUES (NULL, 'UID-less client', 'client') $$, '23514', NULL,
  'clients still require an auth account');
SELECT is((SELECT count(*) FROM public.project_members WHERE profile_id = t.id('profile_director'))::int,
  3, 'director retains both client projects and SBI');

UPDATE public.profiles SET role = 'member' WHERE id = t.id('profile_clienta');
SELECT is((SELECT count(*) FROM public.project_members pm JOIN public.projects project ON project.id = pm.project_id
  WHERE pm.profile_id = t.id('profile_clienta') AND project.config->>'workspace_type' = 'sbi')::int,
  1, 'changing client to member adds SBI access');
UPDATE public.profiles SET role = 'client' WHERE id = t.id('profile_clienta');
SELECT is((SELECT count(*) FROM public.project_members pm JOIN public.projects project ON project.id = pm.project_id
  WHERE pm.profile_id = t.id('profile_clienta') AND project.config->>'workspace_type' = 'sbi')::int,
  0, 'changing back to client removes SBI access');
SELECT is((SELECT count(*) FROM public.project_members WHERE profile_id = t.id('profile_clienta')
  AND project_id = t.id('project_alpha'))::int, 1, 'client-project access is untouched');

SELECT t.as_user(t.uid_director());
SELECT throws_ok($$ DELETE FROM public.project_members WHERE project_id =
  (SELECT id FROM public.projects WHERE url_slug = 'sbi-internal-test') $$,
  '42501', NULL, 'SBI membership cannot be manually removed');
SELECT throws_ok($$ SELECT public.archive_project((SELECT id FROM public.projects
  WHERE url_slug = 'sbi-internal-test')) $$, '42501', NULL, 'SBI cannot be archived');
SELECT throws_ok($$ SELECT public.set_default_project(t.id('project_alpha')) $$,
  '42501', NULL, 'the old configurable default RPC is unavailable');
SELECT t.reset_auth();

UPDATE public.projects SET company_name = 'Renamed internal workspace'
WHERE url_slug = 'sbi-internal-test';
SELECT is((SELECT config->>'workspace_type' FROM public.projects WHERE url_slug = 'sbi-internal-test'),
  'sbi', 'renaming retains the stable SBI identity');
SELECT throws_ok($$ UPDATE public.projects SET config = '{}' WHERE url_slug = 'sbi-internal-test' $$,
  '42501', NULL, 'the internal marker cannot be removed');
SELECT lives_ok($$ DELETE FROM public.profiles WHERE name = 'New Internal Member' $$,
  'deleting a profile can cascade its SBI membership');

SELECT * FROM finish();
ROLLBACK;
