-- ===========================================================================
-- RPC: move_client_knowledge_file — retarget a portal file's RAG chunks when
-- the file is moved/renamed in the Files bucket.
--
-- Deleting a file already cascades into client_knowledge, but move/rename did
-- not: chunks kept the old storage_path, so the "Indexed" badge vanished for
-- the new path, citation deep-links broke, and re-indexing at the new path
-- duplicated content. This updates storage_path (and the mirrored
-- metadata.storage_path / metadata.filename keys) in one atomic statement —
-- embeddings are content-derived and unaffected by a path change.
--
-- Service-role-only, same ACL rationale as match_client_knowledge /
-- keyword_search_client_knowledge: the backend endpoint enforces the
-- director + project-membership gate and path validation before calling.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.move_client_knowledge_file(
    _project_id bigint,
    _from_path  text,
    _to_path    text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    _moved integer;
BEGIN
    UPDATE public.client_knowledge
    SET storage_path = _to_path,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'storage_path', _to_path,
            'filename', split_part(_to_path, '/', -1)
        )
    WHERE project_id = _project_id
      AND storage_path = _from_path;
    GET DIAGNOSTICS _moved = ROW_COUNT;
    RETURN _moved;
END;
$$;

REVOKE ALL ON FUNCTION public.move_client_knowledge_file(
    bigint, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.move_client_knowledge_file(
    bigint, text, text
) TO service_role;
