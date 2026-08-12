-- Keep the assistant corpus in sync with the Files bucket even when a
-- deletion is performed outside the web UI or the browser closes mid-flow.
-- Only portal-indexed chunks are removed; chat and manually-authored
-- knowledge is intentionally independent of Storage objects.

CREATE OR REPLACE FUNCTION public.delete_portal_knowledge_for_storage_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  project_key bigint;
  relative_path text;
BEGIN
  project_key := public.storage_path_project_id(OLD.name);
  relative_path := regexp_replace(OLD.name, '^[^/]+/?', '');

  IF OLD.bucket_id = 'Files' AND project_key IS NOT NULL AND relative_path <> '' THEN
    DELETE FROM public.client_knowledge
    WHERE project_id = project_key
      AND storage_path = relative_path
      AND source = 'portal';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_portal_knowledge_for_storage_object
  ON storage.objects;
CREATE TRIGGER trg_delete_portal_knowledge_for_storage_object
  AFTER DELETE ON storage.objects
  FOR EACH ROW
  WHEN (OLD.bucket_id = 'Files')
  EXECUTE FUNCTION public.delete_portal_knowledge_for_storage_object();

REVOKE EXECUTE ON FUNCTION public.delete_portal_knowledge_for_storage_object()
  FROM PUBLIC, anon, authenticated;
