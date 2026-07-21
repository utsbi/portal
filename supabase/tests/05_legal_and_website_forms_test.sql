-- D6: website_forms is a director-only read; clients/anon see 0 rows; anon can
-- still INSERT (public intake path). legal_documents — the other D6 table —
-- was dropped outright in 20260702000002, asserted here.
BEGIN;
SELECT plan(6);

-- ---- legal_documents is gone (dropped, not just locked down) ----
SELECT hasnt_table('public', 'legal_documents',
  'legal_documents table is dropped');

-- ---- a client (non-director) sees nothing ----
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.website_forms)::int, 0,
  'client: website_forms returns 0 rows'
);
SELECT t.reset_auth();

-- ---- a director sees the seeded rows ----
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.website_forms)::int, 2,
  'director: website_forms returns the 2 seeded rows'
);
SELECT t.reset_auth();

-- ---- anon: cannot read website_forms, CAN insert (public intake) ----
SELECT t.as_anon();
SELECT is(
  (SELECT count(*) FROM public.website_forms)::int, 0,
  'anon: website_forms returns 0 rows (no read)'
);
SELECT lives_ok(
  $$ INSERT INTO public.website_forms (name, email, subject, message)
     VALUES ('Anon Lead', 'anon@example.com', 'Hi', 'public intake works') $$,
  'anon: CAN INSERT into website_forms (public intake preserved)'
);
SELECT t.reset_auth();

-- ---- the legacy "Authenticated users can view ..." policy is gone ----
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_forms'
      AND policyname = 'Authenticated users can view website forms'
  ),
  'legacy authenticated-view policy on website_forms is dropped'
);

SELECT * FROM finish();
ROLLBACK;
