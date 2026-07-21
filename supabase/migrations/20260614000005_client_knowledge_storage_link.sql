-- ===========================================================================
-- Link RAG chunks to their source file in the Document Portal (Files bucket).
--
-- The Document Portal becomes the project's indexable "drive": every indexable
-- file dropped there is auto-chunked into client_knowledge so the Explore
-- assistant can read it. To make that reversible (delete a file -> drop its
-- chunks) and inspectable ("which files are indexed?"), each chunk records the
-- project-relative storage path of the file it came from and how it got here.
--
-- Additive + idempotent: no existing rows change behavior. Pre-existing chunks
-- default to source='manual' (the old standalone knowledge uploader) with a
-- NULL storage_path, exactly matching their current meaning.
-- ===========================================================================

ALTER TABLE public.client_knowledge
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Constrain source to the known origins. Dropped-then-readded so re-running the
-- migration can't fail on an existing constraint.
ALTER TABLE public.client_knowledge
  DROP CONSTRAINT IF EXISTS client_knowledge_source_check;
ALTER TABLE public.client_knowledge
  ADD CONSTRAINT client_knowledge_source_check
  CHECK (source IN ('portal', 'chat', 'manual'));

-- Fast lookups for "is this file indexed?" and delete-by-file cascades.
CREATE INDEX IF NOT EXISTS client_knowledge_project_storage_idx
  ON public.client_knowledge (project_id, storage_path);

COMMENT ON COLUMN public.client_knowledge.storage_path IS
  'Project-relative path of the source file in the Files storage bucket when '
  'source=portal (e.g. "Media/contract.pdf"); NULL for chat/manual chunks.';
COMMENT ON COLUMN public.client_knowledge.source IS
  'Origin of the chunk: portal (auto-indexed Document Portal file), chat '
  '(per-chat upload), or manual (legacy standalone knowledge uploader).';
