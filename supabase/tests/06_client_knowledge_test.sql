-- D3: client_knowledge reads are project-scoped, not uploader-private. Client A
-- cannot read Client B's project rows; the uploader-private uid-only SELECT
-- policies are gone; the director NULL-project read path and the service-role
-- RPC path still work.
BEGIN;
SELECT plan(11);

-- ---- the two redundant uploader-uid SELECT policies are dropped ----
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='client_knowledge'
      AND policyname IN ('Users can view their own knowledge', 'Users can view own documents')
  ),
  'uploader-uid-only SELECT policies (a)/(b) are dropped'
);
-- the project-member SELECT policy remains.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='client_knowledge'
      AND policyname='Project members can view client knowledge'
  ),
  'project-member SELECT policy on client_knowledge exists'
);

-- ---- Client A reads ONLY Alpha project rows + own NULL-project row ----
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Alpha tenant secret knowledge')::int,
  1,
  'Client A: CAN read own project (Alpha) knowledge row'
);
-- Cross-tenant: Client A cannot read Beta's project row.
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Beta tenant secret knowledge')::int,
  0,
  'Client A: CANNOT read Client B''s (Beta) project knowledge row'
);
-- Client A still reads their own NULL-project (orphan) row.
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Alpha orphan unscoped knowledge')::int,
  1,
  'Client A: CAN read own NULL-project orphan row (uploader-unscoped policy)'
);
-- Client A cannot read the Director's NULL-project row (uploader-private gone:
-- the only NULL-project read paths are own-uid and director).
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Director orphan unscoped knowledge')::int,
  0,
  'Client A: CANNOT read the Director''s NULL-project orphan row'
);
SELECT t.reset_auth();

-- ---- Client B cannot read Alpha's project row (cross-tenant) ----
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Alpha tenant secret knowledge')::int,
  0,
  'Client B: CANNOT read Client A''s (Alpha) project knowledge row'
);
SELECT t.reset_auth();

-- ---- Director reads NULL-project orphan rows via the D6 director path ----
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Director orphan unscoped knowledge')::int,
  1,
  'Director: CAN read NULL-project orphan rows (director read path)'
);
SELECT t.reset_auth();

-- ---- service-role / RPC path still reads everything (BYPASSRLS) ----
SELECT t.as_service();
SELECT is(
  (SELECT count(*) FROM public.client_knowledge)::int,
  4,
  'service_role: reads all 4 client_knowledge rows (RPC/admin path intact)'
);
SELECT t.reset_auth();

-- ---- keyword_search RPC must be locked to service_role (SECURITY DEFINER that
--      trusts caller-supplied _filter_project_ids => leak if anon/auth callable) ----
SELECT ok(
  NOT has_function_privilege('anon', 'public.keyword_search_client_knowledge(text,integer,uuid,bigint[])', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.keyword_search_client_knowledge(text,integer,uuid,bigint[])', 'EXECUTE'),
  'keyword_search_client_knowledge is NOT executable by anon/authenticated'
);
SELECT ok(
  has_function_privilege('service_role', 'public.keyword_search_client_knowledge(text,integer,uuid,bigint[])', 'EXECUTE'),
  'keyword_search_client_knowledge IS executable by service_role'
);

SELECT * FROM finish();
ROLLBACK;
