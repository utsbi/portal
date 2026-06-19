-- D6: legal_documents and website_forms are director-only reads; clients see 0
-- rows; anon can still INSERT into website_forms (public intake path).
BEGIN;
SELECT plan(8);

-- ---- a client (non-director) sees nothing ----
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.legal_documents)::int, 0,
  'client: legal_documents returns 0 rows'
);
SELECT is(
  (SELECT count(*) FROM public.website_forms)::int, 0,
  'client: website_forms returns 0 rows'
);
SELECT t.reset_auth();

-- ---- a director sees the seeded rows ----
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.legal_documents)::int, 2,
  'director: legal_documents returns the 2 seeded rows'
);
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

-- ---- anon cannot read legal_documents either ----
SELECT t.as_anon();
SELECT is(
  (SELECT count(*) FROM public.legal_documents)::int, 0,
  'anon: legal_documents returns 0 rows'
);
SELECT t.reset_auth();

-- ---- the legacy "Authenticated users can view ..." policies are gone ----
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename = 'legal_documents' AND policyname = 'Authenticated users can view legal documents')
        OR (tablename = 'website_forms' AND policyname = 'Authenticated users can view website forms')
      )
  ),
  'legacy authenticated-view policies on legal_documents/website_forms are dropped'
);

SELECT * FROM finish();
ROLLBACK;
