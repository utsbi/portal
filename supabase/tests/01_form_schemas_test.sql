-- D2: custom_form_schemas must not leak public_token / public_password_hash to
-- anon or authenticated, while non-secret columns stay readable.
BEGIN;
SELECT plan(8);

-- ---- as authenticated (a director, who can SELECT the form row) ----
SELECT t.as_user(t.uid_director());

-- Non-secret columns are readable.
SELECT lives_ok(
  $$ SELECT title, description FROM public.custom_form_schemas WHERE id = (SELECT v FROM public._test_ids WHERE k='form_public') $$,
  'authenticated: can read non-secret columns of custom_form_schemas'
);
SELECT is(
  (SELECT title FROM public.custom_form_schemas WHERE id = (SELECT v FROM public._test_ids WHERE k='form_public')),
  'Public Intake Form',
  'authenticated: title is the expected value'
);

-- Selecting the secret columns must be DENIED (column privilege revoked).
SELECT throws_ok(
  $$ SELECT public_token FROM public.custom_form_schemas $$,
  '42501',
  NULL,
  'authenticated: SELECT public_token is denied (permission denied)'
);
SELECT throws_ok(
  $$ SELECT public_password_hash FROM public.custom_form_schemas $$,
  '42501',
  NULL,
  'authenticated: SELECT public_password_hash is denied (permission denied)'
);
-- SELECT * must also fail because it expands to include the revoked columns.
SELECT throws_ok(
  $$ SELECT * FROM public.custom_form_schemas $$,
  '42501',
  NULL,
  'authenticated: SELECT * is denied (expands to secret columns)'
);

SELECT t.reset_auth();

-- ---- as anon ----
SELECT t.as_anon();
SELECT throws_ok(
  $$ SELECT public_token FROM public.custom_form_schemas $$,
  '42501',
  NULL,
  'anon: SELECT public_token is denied'
);
SELECT throws_ok(
  $$ SELECT public_password_hash FROM public.custom_form_schemas $$,
  '42501',
  NULL,
  'anon: SELECT public_password_hash is denied'
);
SELECT t.reset_auth();

-- ---- the table-level SELECT privilege itself is gone for both roles ----
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.custom_form_schemas', 'public_token', 'SELECT')
  AND NOT has_column_privilege('anon', 'public.custom_form_schemas', 'public_token', 'SELECT'),
  'neither anon nor authenticated has column SELECT on public_token'
);

SELECT * FROM finish();
ROLLBACK;
