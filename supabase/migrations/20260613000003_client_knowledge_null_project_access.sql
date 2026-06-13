-- ===========================================================================
-- client_knowledge: restore uploader-private access to NULL-project documents.
--
-- 20260613000001 added `project_id` and narrowed every retrieval path to it,
-- but its backfill only assigned a project to rows whose uploader belongs to
-- exactly one project (`sub.n = 1`). Rows left with `project_id IS NULL` became
-- unreachable everywhere: the `match_client_knowledge` RPC filtered
-- `ck.project_id = ANY(_filter_project_ids)`, keyword search used
-- `.in_("project_id", project_ids)`, and the new SELECT RLS policy required
-- `project_id IS NOT NULL`. That silently hid a user's own legacy uploads.
--
-- This restores the uploader's private access to their NULL-project rows while
-- keeping project sharing for scoped rows:
--   1. Re-create `match_client_knowledge` so a row matches if EITHER it is in
--      the active project set OR it is the caller's own NULL-project row.
--   2. Add a SELECT RLS policy letting uploaders read their own NULL rows.
--
-- Idempotent: RPC is DROP/CREATE with grants restated; policy is DROP/CREATE.
-- ===========================================================================

-- Vector search RPC: a row now matches when it is in the caller's active
-- project set OR (uid-scoped fallback) it is the caller's own legacy row with
-- no project. The signature is unchanged from 20260613000001, so DROP + CREATE
-- with the hardened service-role grants restated below.
DROP FUNCTION IF EXISTS public.match_client_knowledge(public.vector, integer, uuid, double precision, bigint[]);
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
  SET search_path TO 'public'
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

-- Preserve the hardened posture: the RAG functions are service-role only (the
-- explore backend uses the service role; never anon/authenticated directly).
REVOKE EXECUTE ON FUNCTION public.match_client_knowledge(public.vector, integer, uuid, double precision, bigint[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_client_knowledge(public.vector, integer, uuid, double precision, bigint[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_client_knowledge(public.vector, integer, uuid, double precision, bigint[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_client_knowledge(public.vector, integer, uuid, double precision, bigint[]) TO service_role;

-- Defense-in-depth RLS: let uploaders read their own legacy NULL-project rows.
-- Additive to the existing project-member SELECT policy (20260613000001) and
-- the uploader-uid policies from the baseline schema; PostgreSQL ORs permissive
-- policies, so this only widens access to a user's own orphaned uploads.
DROP POLICY IF EXISTS "Uploaders can view their own unscoped knowledge" ON public.client_knowledge;
CREATE POLICY "Uploaders can view their own unscoped knowledge" ON public.client_knowledge
  FOR SELECT TO authenticated
  USING (uid = auth.uid() AND project_id IS NULL);
