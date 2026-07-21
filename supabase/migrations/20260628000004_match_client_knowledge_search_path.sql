-- ===========================================================================
-- S17: Harden search_path on public.match_client_knowledge.
--
-- The function (last defined in 20260613000003_client_knowledge_null_project_
-- access.sql ~line 26) declares `SET search_path TO 'public'`, omitting
-- 'pg_temp' and deviating from the project hardening standard used by every
-- other SECURITY DEFINER function (e.g. 20260628000001:
-- `SET search_path TO 'public', 'pg_temp'`). Without an explicit, minimal
-- search_path a SECURITY DEFINER function can be hijacked via objects planted
-- in a caller-controlled schema.
--
-- The body, signature, SECURITY DEFINER attribute, and grants are unchanged
-- and copied verbatim from 20260613000003; only the SET clause is corrected.
-- CREATE OR REPLACE preserves the existing service-role-only ACL.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.match_client_knowledge(
  _query_embedding public.vector,
  _match_count integer DEFAULT 5,
  _filter_uid uuid DEFAULT NULL::uuid,
  _similarity_threshold double precision DEFAULT 0.5,
  _filter_project_ids bigint[] DEFAULT NULL::bigint[]
)
  RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT ck.id, ck.content, ck.metadata,
    1 - (ck.embedding <=> _query_embedding) AS similarity
  FROM client_knowledge ck
  WHERE (
      -- Project-scoped rows shared with the active project's team.
      (_filter_project_ids IS NOT NULL AND ck.project_id = ANY(_filter_project_ids))
      -- Uploader's own legacy rows that never got a project assigned.
      OR (_filter_uid IS NOT NULL AND ck.uid = _filter_uid AND ck.project_id IS NULL)
    )
    AND 1 - (ck.embedding <=> _query_embedding) > _similarity_threshold
  ORDER BY ck.embedding <=> _query_embedding
  LIMIT _match_count;
END;
$$;
