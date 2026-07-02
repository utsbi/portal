-- ===========================================================================
-- RAG: type client_knowledge.embedding as vector(1536) + HNSW index.
--
-- The column was a dimensionless `public.vector` holding 4096-dim
-- Qwen3-Embedding-8B vectors — too wide for pgvector's HNSW limit (2000 for
-- `vector`), so every match_client_knowledge call was a sequential scan.
--
-- Qwen3-Embedding-8B supports Matryoshka (MRL) output truncation, and the
-- OpenRouter embeddings API returns dimensions=1536 unit-normalized and
-- numerically identical (cos ≈ 0.9999, verified 2026-07-02) to
-- l2_normalize(subvector(native_4096, 1, 1536)). That equivalence lets this
-- migration convert the existing rows in place — no re-embedding backfill.
--
-- Deploy lock-step: the backend must run with EMBEDDING_DIMENSIONS=1536 (the
-- new default) once this is applied. The typed column makes any mismatch fail
-- loudly at insert/query time instead of silently degrading.
--
-- Requires pgvector >= 0.7.0 (subvector, l2_normalize).
-- ===========================================================================

-- 1. Retype, converting existing 4096-dim vectors via MRL truncation.
--    Any row with fewer than 1536 dims would fail the subvector+cast loudly —
--    correct, since it could never have matched a 4096-dim query anyway.
ALTER TABLE public.client_knowledge
  ALTER COLUMN embedding TYPE public.vector(1536)
  USING (
    CASE
      WHEN embedding IS NULL THEN NULL
      ELSE l2_normalize(subvector(embedding, 1, 1536))
    END
  );

-- 2. ANN index. Cosine opclass matches the `<=>` operator used by
--    match_client_knowledge; HNSW defaults (m=16, ef_construction=64) are
--    appropriate at this corpus size and well beyond it.
CREATE INDEX IF NOT EXISTS idx_client_knowledge_embedding_hnsw
  ON public.client_knowledge
  USING hnsw (embedding vector_cosine_ops);
