-- Department-owned files have their own access boundary. Project links are
-- contextual only and never make a department object readable to a client.
BEGIN;
SELECT plan(9);

SELECT is(
  (SELECT count(*) FROM public.file_spaces WHERE kind = 'department')::int,
  (SELECT count(*) FROM public.departments)::int,
  'every department has one persistent file space'
);

SELECT is(
  public.storage_file_space_id(
    'department/' || (SELECT id FROM public.departments WHERE slug = 'legal') || '/matter.pdf'
  ),
  (SELECT id FROM public.file_spaces WHERE kind = 'department' AND department_id =
    (SELECT id FROM public.departments WHERE slug = 'legal')),
  'department storage paths resolve to a department space'
);

SELECT is(
  public.storage_file_space_id((SELECT id FROM public.projects WHERE url_slug = 'alpha')::text || '/report.pdf'),
  (SELECT id FROM public.file_spaces WHERE kind = 'project' AND project_id = t.id('project_alpha')),
  'existing project storage paths still resolve to project spaces'
);

SELECT is(
  public.file_space_can_read(
    t.uid_director(),
    (SELECT id FROM public.file_spaces WHERE kind = 'department' AND department_id =
      (SELECT id FROM public.departments WHERE slug = 'legal'))
  ),
  true,
  'directors can read every department space'
);

SELECT is(
  public.file_space_can_read(
    t.uid_clienta(),
    (SELECT id FROM public.file_spaces WHERE kind = 'department' AND department_id =
      (SELECT id FROM public.departments WHERE slug = 'legal'))
  ),
  false,
  'clients cannot read department spaces by default'
);

SELECT t.as_user(t.uid_director());
SELECT lives_ok($$ INSERT INTO public.department_file_project_links
  (file_space_id, storage_path, project_id, created_by)
  VALUES (
    (SELECT id FROM public.file_spaces WHERE kind = 'department' AND department_id =
      (SELECT id FROM public.departments WHERE slug = 'legal')),
    'department/' || (SELECT id FROM public.departments WHERE slug = 'legal') || '/matter.pdf',
    t.id('project_alpha'),
    t.id('profile_director')
  ) $$,
  'a director can add a project context link'
);
SELECT t.reset_auth();

SELECT is(
  (SELECT count(*) FROM public.department_file_project_links
   WHERE project_id = t.id('project_alpha'))::int,
  1,
  'the contextual project link is stored'
);

SELECT is(
  public.file_space_can_read(
    t.uid_clienta(),
    (SELECT file_space_id FROM public.department_file_project_links
     WHERE project_id = t.id('project_alpha') LIMIT 1)
  ),
  false,
  'a project link does not grant the client department access'
);

SELECT t.as_user(t.uid_director());
SELECT throws_ok($$ INSERT INTO public.department_file_project_links
  (file_space_id, storage_path, project_id)
  VALUES (
    (SELECT id FROM public.file_spaces WHERE kind = 'department' AND department_id =
      (SELECT id FROM public.departments WHERE slug = 'legal')),
    (SELECT id FROM public.projects WHERE url_slug = 'alpha')::text || '/wrong-root.pdf',
    t.id('project_alpha')
  ) $$,
  '42501', NULL,
  'a department link cannot point at a project storage root'
);
SELECT t.reset_auth();

SELECT * FROM finish();
ROLLBACK;
