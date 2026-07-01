-- ===========================================================================
-- S8 (follow-up): a Supabase-backed per-user rate limiter.
--
-- Serverless routes (e.g. /api/transcribe, which calls the paid AssemblyAI API
-- directly) can't use an in-memory limiter — each invocation is an isolated
-- instance. Postgres is the shared store we already have, so a tiny atomic
-- counter here works correctly across all instances without adding Redis/Upstash.
--
-- private.rate_limits lives in the `private` schema (NOT PostgREST-exposed) and
-- is only ever touched by the SECURITY DEFINER function below. consume_rate_token
-- bins now() into fixed windows, atomically increments the caller's counter, and
-- returns whether the call is within `_limit`. Self-scoped by auth.uid().
--
-- Old window rows accumulate slowly (one per uid+bucket+window); a periodic
-- cleanup (DELETE WHERE window_start < now() - '1 day') can be added as a cron
-- if volume grows — not needed at current scale.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS private.rate_limits (
  uid          uuid        NOT NULL,
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        int         NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, bucket, window_start)
);

-- Defense in depth: the table isn't API-exposed (private schema), but deny any
-- direct access anyway. The SECURITY DEFINER function below bypasses RLS as owner.
ALTER TABLE private.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically consume one token for (auth.uid(), _bucket) in the current _window.
-- Returns TRUE if the post-increment count is within _limit (allowed), else FALSE.
-- Unauthenticated callers are denied. _window must be a fixed interval (e.g.
-- '1 minute', '1 hour') — date_bin rejects month/year intervals.
CREATE OR REPLACE FUNCTION public.consume_rate_token(
  _bucket text,
  _limit  int,
  _window interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ws  timestamptz;
  _c   int;
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  _ws := date_bin(_window, now(), 'epoch'::timestamptz);

  INSERT INTO private.rate_limits (uid, bucket, window_start, count)
  VALUES (_uid, _bucket, _ws, 1)
  ON CONFLICT (uid, bucket, window_start)
  DO UPDATE SET count = private.rate_limits.count + 1
  RETURNING count INTO _c;

  RETURN _c <= _limit;
END;
$$;

-- Callable by the authenticated route (runs under the caller's auth.uid()) and
-- service_role. Never anon / PUBLIC.
REVOKE EXECUTE ON FUNCTION public.consume_rate_token(text, int, interval) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_rate_token(text, int, interval) TO authenticated, service_role;
