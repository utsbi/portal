-- =====================================================================
-- consume_rate_token: per-user atomic rate limiter (S8 follow-up).
-- =====================================================================
BEGIN;
SELECT plan(6);

SELECT t.as_user(t.uid_clienta());

-- Within a limit of 2, the first two calls are allowed, the third is denied.
SELECT ok(
  public.consume_rate_token('test', 2, '1 minute'::interval),
  'consume_rate_token: 1st call within limit is allowed');
SELECT ok(
  public.consume_rate_token('test', 2, '1 minute'::interval),
  'consume_rate_token: 2nd call (at limit) is allowed');
SELECT ok(
  NOT public.consume_rate_token('test', 2, '1 minute'::interval),
  'consume_rate_token: 3rd call (over limit) is denied');

-- A different bucket has its own independent counter.
SELECT ok(
  public.consume_rate_token('other', 2, '1 minute'::interval),
  'consume_rate_token: a different bucket is independent');

SELECT t.reset_auth();

-- ACL: anon must NOT be able to call it; authenticated must.
SELECT ok(
  NOT has_function_privilege('anon', 'public.consume_rate_token(text,integer,interval)', 'EXECUTE'),
  'consume_rate_token is NOT executable by anon');
SELECT ok(
  has_function_privilege('authenticated', 'public.consume_rate_token(text,integer,interval)', 'EXECUTE'),
  'consume_rate_token IS executable by authenticated');

SELECT * FROM finish();
ROLLBACK;
