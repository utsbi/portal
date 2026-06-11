-- ===========================================================================
-- client_knowledge (RAG documents): scope to project, not just uploader uid.
--
-- The Explore AI `search_documents` tool retrieved a caller's documents by
-- `uid` only, so a director switching projects always got their own uploads
-- regardless of the active project, and documents weren't shared with the
-- project team. This adds a `project_id` so retrieval can be narrowed to the
-- caller's active project (membership-verified in the backend), matching the
-- live-data tools and the Files bucket.
--
-- Backfill is lossless here: every existing row's uploader belongs to exactly
-- one project, so each row is assigned that project. Rows whose uploader has an
-- ambiguous (0 or >1) project membership are left NULL and simply won't match a
-- project-filtered search until reassigned.
--
-- Idempotent: column add is IF NOT EXISTS; RPC and policy are DROP/CREATE.
-- ===========================================================================

ALTER TABLE public.client_knowledge
  ADD COLUMN IF NOT EXISTS project_id bigint
  REFERENCES public.projects(id) ON DELETE CASCADE;

-- Backfill from unambiguous single-project uploaders.
UPDATE public.client_knowledge ck
SET project_id = sub.pid
FROM (
  SELECT pr.uid AS uid,
         min(pm.project_id) AS pid,
         count(DISTINCT pm.project_id) AS n
  FROM public.profiles pr
  JOIN public.project_members pm ON pm.profile_id = pr.id
  GROUP BY pr.uid
) sub
WHERE ck.uid = sub.uid
  AND sub.n = 1
  AND ck.project_id IS NULL;

CREATE INDEX IF NOT EXISTS client_knowledge_project_id_idx
  ON public.client_knowledge (project_id);

-- Vector search RPC: add an optional project-id array filter. Kept as the last
-- parameter with a default so existing positional/named callers are unaffected;
-- the backend now passes `_filter_project_ids` (the caller's membership-verified
-- active project). The signature change requires DROP + CREATE, so the hardened
-- grants (service_role only) are re-applied below.
DROP FUNCTION IF EXISTS public.match_client_knowledge(public.vector, integer, uuid, double precision);
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
  WHERE (_filter_project_ids IS NULL OR ck.project_id = ANY(_filter_project_ids))
    AND (_filter_uid IS NULL OR ck.uid = _filter_uid)
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

-- Defense-in-depth RLS: project members may read their project's documents
-- (retrieval itself runs as service role, so this guards any direct access).
-- Additive to the existing uploader-uid policies.
DROP POLICY IF EXISTS "Project members can view client knowledge" ON public.client_knowledge;
CREATE POLICY "Project members can view client knowledge" ON public.client_knowledge
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.project_members pm
      JOIN public.profiles pr ON pr.id = pm.profile_id
      WHERE pr.uid = auth.uid()
        AND pm.project_id = client_knowledge.project_id
    )
  );
