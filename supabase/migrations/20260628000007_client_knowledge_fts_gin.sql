-- ===========================================================================
-- Phase-3 RAG hardening: FTS GIN index + keyword_search_client_knowledge RPC
-- ===========================================================================
-- 1. A functional GIN index on to_tsvector('english', content) so that the
--    full-text WHERE clause and ORDER-BY ts_rank in the function below use
--    the index rather than a full sequential scan.
--
-- 2. keyword_search_client_knowledge — RPC that the Python _keyword_search
--    path calls instead of the PostgREST table API.  It returns real ts_rank
--    scores (column: rank float) rather than the fabricated 0.5/0.3 constant
--    the previous table-API path used.  The caller normalises the scores
--    (top result → 1.0) so they are comparable to vector similarity values
--    in the RRF combiner.
--
-- Scoping mirrors match_client_knowledge exactly:
--   - rows whose project_id is in _filter_project_ids (team-shared docs), OR
--   - rows where uid = _filter_uid AND project_id IS NULL (caller's own
--     legacy NULL-project uploads).
-- Either filter may be omitted (NULL); if both are NULL nothing is returned.
-- ===========================================================================

-- 1. GIN index ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_client_knowledge_fts
    ON public.client_knowledge
    USING gin(to_tsvector('english', content));


-- 2. Keyword search RPC -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.keyword_search_client_knowledge(
    _query           text,
    _match_count     integer          DEFAULT 10,
    _filter_uid      uuid             DEFAULT NULL::uuid,
    _filter_project_ids bigint[]      DEFAULT NULL::bigint[]
)
RETURNS TABLE(
    id       bigint,
    content  text,
    metadata jsonb,
    rank     float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    _tsquery tsquery;
BEGIN
    -- An empty or whitespace-only query produces an empty tsquery; return
    -- nothing rather than matching every row.
    IF _query IS NULL OR trim(_query) = '' THEN
        RETURN;
    END IF;

    _tsquery := plainto_tsquery('english', _query);

    -- A degenerate tsquery (e.g. all stop-words) would match everything;
    -- guard against it.
    IF _tsquery IS NULL OR _tsquery::text = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        ck.id,
        ck.content,
        ck.metadata,
        ts_rank(to_tsvector('english', ck.content), _tsquery)::float AS rank
    FROM public.client_knowledge ck
    WHERE
        to_tsvector('english', ck.content) @@ _tsquery
        AND (
            (
                _filter_project_ids IS NOT NULL
                AND ck.project_id = ANY(_filter_project_ids)
            )
            OR (
                _filter_uid IS NOT NULL
                AND ck.uid = _filter_uid
                AND ck.project_id IS NULL
            )
        )
    ORDER BY rank DESC
    LIMIT _match_count;
END;
$$;

-- Restrict to service_role only (same ACL as match_client_knowledge). Supabase's
-- default privileges auto-grant EXECUTE on new public functions to anon +
-- authenticated, so REVOKE FROM PUBLIC alone is insufficient — revoke from those
-- roles explicitly or this SECURITY DEFINER function (which trusts the caller's
-- _filter_project_ids) would be a cross-tenant read of client_knowledge.
REVOKE ALL ON FUNCTION public.keyword_search_client_knowledge(
    text, integer, uuid, bigint[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.keyword_search_client_knowledge(
    text, integer, uuid, bigint[]
) TO service_role;
