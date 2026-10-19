BEGIN;
SELECT plan(6);

SELECT is((SELECT name FROM public.departments WHERE slug = 'engineering-general'),
  'Engineering', 'general engineering is named Engineering');
SELECT is((SELECT name FROM public.departments WHERE slug = 'internal-technologies'),
  'Tech', 'internal technologies is named Tech');
SELECT is((SELECT count(*)::int FROM public.departments
  WHERE slug IN ('marketing', 'public-relations', 'engineering-structural')), 0,
  'Marketing, PR, and Structural Engineering are removed');
SELECT is((SELECT count(*)::int FROM public.file_spaces fs
  JOIN public.departments d ON d.id = fs.department_id
  WHERE fs.name <> d.name), 0, 'space names match the department catalog');
SELECT is((SELECT count(*)::int FROM public.file_spaces fs
  JOIN public.departments d ON d.id = fs.department_id
  WHERE d.slug IN ('engineering-general', 'internal-technologies')
    AND fs.root_prefix = 'department/' || d.id::text), 2,
  'renamed departments retain their storage roots');

SELECT is((SELECT name FROM public.departments WHERE slug = 'engineering-environmental'),
  'Sustainability', 'environmental engineering is named Sustainability');

SELECT * FROM finish();
ROLLBACK;
