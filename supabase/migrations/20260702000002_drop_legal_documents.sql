-- ===========================================================================
-- Drop the orphaned legal_documents table.
--
-- An abandoned early RAG arm: content + 3072-dim embeddings from a model the
-- app no longer uses (current embeddings are 1536-dim Qwen3/MRL — dimensionally
-- incompatible, so these rows could never be retrieved). No code path reads or
-- writes it; the only reference left is the generated database.types.ts entry,
-- which disappears on the next type regeneration. Reads were already locked to
-- directors-only in 20260618000005.
--
-- PROD PRE-APPLY CHECKLIST: the live table holds ~611 rows of embedded legal
-- content. Export/archive it BEFORE applying, e.g.:
--   \copy (SELECT id, content, metadata FROM public.legal_documents)
--     TO 'legal_documents_archive.csv' CSV HEADER
-- (embeddings are intentionally omitted — they are regenerable and useless
--  at 3072 dims.)
-- ===========================================================================

DROP TABLE IF EXISTS public.legal_documents;
