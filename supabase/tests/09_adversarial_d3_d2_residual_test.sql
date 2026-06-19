-- =====================================================================
-- ADVERSARIAL TARGET 1 (D3 residual) + TARGET 2 (D2 secret columns).
-- =====================================================================
-- D3: the NULL-project client_knowledge read path. The migration documents a
-- residual where director NULL-project uploads are readable by uploader + all
-- directors. Red-team probe: confirm that path does NOT leak across tenants and
-- that NULL-project rows are NOT world-readable to other tenants' clients.
--
-- D2: confirm the exact behavior of SELECT * / secret-column selects as
-- authenticated and anon, and that a SELECT of ONLY the secret columns is denied
-- for both roles (column privilege, SQLSTATE 42501).
-- =====================================================================
BEGIN;
SELECT plan(13);

-- ---------------------------------------------------------------------
-- D3: NULL-project cross-tenant isolation.
-- ---------------------------------------------------------------------
-- Client A owns one NULL-project row; the Director owns another. Client B owns
-- NONE. Probe Client B against BOTH NULL rows: Client B must read neither.
SELECT t.as_user(t.uid_clientb());
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Alpha orphan unscoped knowledge')::int, 0,
  'D3 LEAK? Client B must NOT read Client A''s NULL-project orphan row');
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Director orphan unscoped knowledge')::int, 0,
  'D3 LEAK? Client B must NOT read the Director''s NULL-project orphan row');
-- A NULL-project row is NOT world-readable to authenticated users of other
-- tenants: Client B sees ZERO of the two NULL-project rows in total.
SELECT is(
  (SELECT count(*) FROM public.client_knowledge WHERE project_id IS NULL)::int, 0,
  'D3 LEAK? NULL-project client_knowledge rows are not world-readable to Client B');
SELECT t.reset_auth();

-- Client A must NOT read the Director's NULL-project row (only own NULL rows).
SELECT t.as_user(t.uid_clienta());
SELECT is(
  (SELECT count(*) FROM public.client_knowledge
     WHERE content = 'Director orphan unscoped knowledge')::int, 0,
  'D3 LEAK? Client A must NOT read the Director''s NULL-project orphan row');
-- Client A reads exactly ONE NULL-project row (its own), not the Director's.
SELECT is(
  (SELECT count(*) FROM public.client_knowledge WHERE project_id IS NULL)::int, 1,
  'D3: Client A reads exactly its own 1 NULL-project row, not the Director''s');
SELECT t.reset_auth();

-- The director NULL-project read path is director-gated, not a tenant bypass:
-- the director reads BOTH NULL rows (own + Client A''s) via the documented (d)/(e)
-- paths, but that is the STAFF role, not a cross-tenant client leak.
SELECT t.as_user(t.uid_director());
SELECT is(
  (SELECT count(*) FROM public.client_knowledge WHERE project_id IS NULL)::int, 2,
  'D3: Director reads both NULL-project rows (documented staff residual)');
SELECT t.reset_auth();

-- ---------------------------------------------------------------------
-- D2: custom_form_schemas column-privilege behavior.
-- ---------------------------------------------------------------------
-- A plain SELECT * as authenticated MUST error (42501) rather than silently omit
-- the secrets -- this is the documented, app-relevant behavior.
SELECT t.as_user(t.uid_clienta());
SELECT throws_ok(
  $$ SELECT * FROM public.custom_form_schemas $$,
  '42501', NULL,
  'D2: authenticated SELECT * ERRORS (column privilege denied), does not silently omit');
-- A select of ONLY the two secret columns is denied.
SELECT throws_ok(
  $$ SELECT public_token, public_password_hash FROM public.custom_form_schemas $$,
  '42501', NULL,
  'D2: authenticated SELECT of only secret columns is denied');
-- But an explicit non-secret projection still works (app path preserved).
SELECT lives_ok(
  $$ SELECT id, title, description FROM public.custom_form_schemas $$,
  'D2: authenticated SELECT of explicit non-secret columns still works');
SELECT t.reset_auth();

-- anon: secrets denied (both individually and combined); plus has_column_privilege.
SELECT t.as_anon();
SELECT throws_ok(
  $$ SELECT public_token, public_password_hash FROM public.custom_form_schemas $$,
  '42501', NULL,
  'D2: anon SELECT of secret columns is denied');
SELECT throws_ok(
  $$ SELECT * FROM public.custom_form_schemas $$,
  '42501', NULL,
  'D2: anon SELECT * is denied (expands to secret columns)');
SELECT t.reset_auth();

-- Catalog-level: neither role has column SELECT on the password hash.
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.custom_form_schemas', 'public_password_hash', 'SELECT')
  AND NOT has_column_privilege('anon', 'public.custom_form_schemas', 'public_password_hash', 'SELECT'),
  'D2: neither anon nor authenticated has column SELECT on public_password_hash');
-- ... and the service role STILL can (server-side verification path intact).
SELECT ok(
  has_column_privilege('service_role', 'public.custom_form_schemas', 'public_token', 'SELECT')
  AND has_column_privilege('service_role', 'public.custom_form_schemas', 'public_password_hash', 'SELECT'),
  'D2: service_role retains column SELECT on both secret columns (server path intact)');

SELECT * FROM finish();
ROLLBACK;
