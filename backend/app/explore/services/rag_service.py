import asyncio
import logging
import re
from typing import List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI
from app.explore.core.config import settings
from app.explore.db.supabase import supabase
from app.explore.services.pdf_parser import PDFParser

logger = logging.getLogger(__name__)

# Minimum cosine similarity for a vector result to be included in retrieval.
# Recalibrated 2026-07-02 for 1536-dim MRL-truncated Qwen3-Embedding-8B
# vectors: truncation compresses similarities slightly downward (a
# same-domain/different-topic pair that scored 0.30 at 4096 dims scores ~0.25
# at 1536; unrelated texts ~0.15). 0.25 keeps the previous behaviour — above
# the unrelated-text noise band, but still admitting documents that share
# topic or domain with the query even without a verbatim match.
MIN_VECTOR_SIMILARITY: float = 0.25

# NOTE (audit idea #1 — ANN index, DONE 2026-07-02): client_knowledge.embedding
# is now a typed vector(1536) column with an HNSW cosine index (migration
# 20260702000001). Embeddings are Qwen3-Embedding-8B requested at
# dimensions=1536 — Matryoshka truncation of the native 4096, returned
# unit-normalized by the API, which fits under pgvector's 2000-dim HNSW limit.
# Existing 4096-dim rows were converted in-place by the migration via
# l2_normalize(subvector(embedding, 1, 1536)), which is numerically identical
# (cos ≈ 0.9999, verified) to re-embedding at 1536, so no API backfill was
# needed. EMBEDDING_DIMENSIONS must stay in lock-step with the column type;
# a mismatch now fails loudly at insert/query time instead of silently.

# Max rows per client_knowledge INSERT. One statement for a whole document
# does NOT scale: a ~700-chunk book carries tens of MB of vector payload and
# pays per-row HNSW index maintenance, blowing Postgres's statement timeout
# (observed: 57014 on a 763-chunk insert). ~100 rows stays comfortably under
# the timeout while keeping round-trips low.
INSERT_BATCH_SIZE: int = 100

# Canonical 8-4-4-4-12 UUID, as issued by Supabase auth.
_UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


class RAGService:
    """Service for embedding generation, vector storage, and hybrid search."""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        self.pdf_parser = PDFParser()

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate an embedding vector for the given text."""
        try:
            params: Dict[str, Any] = {
                "model": settings.embedding_model,
                "input": text,
            }
            if settings.embedding_dimensions:
                params["dimensions"] = settings.embedding_dimensions

            result = await self.client.embeddings.create(**params)
            if result.data:
                embedding = list(result.data[0].embedding)
                logger.info(f"Generated embedding: model={settings.embedding_model}, dims={len(embedding)}")
                return embedding
            raise ValueError("No embeddings returned from API")
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise ValueError(f"Failed to generate embedding: {str(e)}")

    async def store_document(self, content: str, metadata: Dict[str, Any],
        client_id: str, project_id: Optional[int] = None,
        storage_path: Optional[str] = None, source: str = "manual") -> List[int]:
        """Chunk, embed, and store a document in Supabase.

        ``project_id`` tags the document with the project it belongs to so the
        ``search_documents`` tool can retrieve it for that project's team. The
        uploader ``uid`` is still recorded for ownership/auditing.

        ``storage_path`` records the project-relative path of the source file in
        the "Files" storage bucket (set for files indexed from the Document
        Portal); ``source`` tags how the chunk entered the corpus ('portal',
        'chat', or 'manual'). Both default to today's behaviour for existing
        callers.
        """
        chunks = self.pdf_parser.chunk_text(content)
        if not chunks:
            return []

        # Batch-embed all chunks in a single API call (one round-trip instead of N).
        # The OpenAI embeddings API accepts a list for `input`; result.data is
        # returned sorted by index, so result.data[i] always corresponds to chunks[i].
        try:
            params: Dict[str, Any] = {
                "model": settings.embedding_model,
                "input": chunks,
            }
            if settings.embedding_dimensions:
                params["dimensions"] = settings.embedding_dimensions

            emb_result = await self.client.embeddings.create(**params)
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            raise ValueError(f"Failed to generate embeddings: {str(e)}")

        if not emb_result.data or len(emb_result.data) != len(chunks):
            raise ValueError(
                f"Embeddings API returned {len(emb_result.data) if emb_result.data else 0} "
                f"results for {len(chunks)} chunks"
            )

        logger.info(
            f"Batch-embedded {len(chunks)} chunks "
            f"(model={settings.embedding_model}, dims={len(emb_result.data[0].embedding)})"
        )

        # Build all rows, preserving chunk order.
        rows = [
            {
                "uid": client_id,
                "project_id": project_id,
                "content": chunk,
                "metadata": {**metadata, "chunk_index": i, "total_chunks": len(chunks)},
                "embedding": list(emb_result.data[i].embedding),
                "storage_path": storage_path,
                "source": source,
            }
            for i, chunk in enumerate(chunks)
        ]

        # Batched bulk insert (see INSERT_BATCH_SIZE). A mid-batch failure can
        # leave a partial document behind, but both index paths delete by
        # (project_id, storage_path) / dedupe by content hash before storing,
        # so a retry self-heals rather than duplicating.
        document_ids: List[int] = []
        for start in range(0, len(rows), INSERT_BATCH_SIZE):
            batch = rows[start:start + INSERT_BATCH_SIZE]
            insert_result = supabase.table("client_knowledge").insert(batch).execute()
            if insert_result.data and isinstance(insert_result.data, list):
                document_ids.extend(
                    row["id"] for row in insert_result.data if row.get("id") is not None
                )
        return document_ids

    async def search_documents(self, query: str, project_ids: List[int],
        client_id: Optional[str] = None, limit: int = 5,
        similarity_threshold: float = 0.0) -> List[Dict[str, Any]]:
        """Search for relevant documents using vector similarity, scoped to the
        caller's (membership-verified) project(s).

        Passing ``client_id`` also surfaces the caller's own legacy documents
        that were never assigned a project (``project_id IS NULL``), so a user
        with zero memberships can still reach their pre-scoping uploads.
        """
        if not project_ids and not client_id:
            return []
        try:
            query_embedding = await self.generate_embedding(query)
        except Exception as e:
            logger.error(f"Vector search failed - embedding error: {e}")
            return []

        try:
            result = supabase.rpc(
                "match_client_knowledge",
                {
                    "_query_embedding": query_embedding,
                    "_match_count": limit,
                    "_filter_uid": client_id,
                    "_filter_project_ids": project_ids or None,
                    "_similarity_threshold": similarity_threshold
                }
            ).execute()

            if result.data and isinstance(result.data, list) and len(result.data) > 0:
                documents = []
                for item in result.data:
                    doc = dict(item) if isinstance(item, dict) else {}
                    sim = doc.get("similarity", 0.0)
                    documents.append({
                        "id": doc.get("id"),
                        "content": doc.get("content", ""),
                        "metadata": doc.get("metadata", {}),
                        "similarity_score": sim
                    })
                logger.info(f"Vector search returned {len(documents)} results (top similarity: {documents[0]['similarity_score']:.4f})")
                return documents
            else:
                logger.info(f"Vector search returned no results for projects {project_ids} uid={client_id} (threshold={similarity_threshold})")
        except Exception as e:
            logger.error(f"RPC match_client_knowledge failed: {e}")

        return []

    async def hybrid_search(self, query: str, project_ids: List[int],
        client_id: Optional[str] = None, limit: int = 5,
        vector_weight: float = 0.7) -> List[Dict[str, Any]]:
        """Perform hybrid search combining vector similarity and keyword matching."""
        # Run vector and keyword searches concurrently.
        vector_results, keyword_results = await asyncio.gather(
            self.search_documents(
                query=query,
                project_ids=project_ids,
                client_id=client_id,
                limit=limit * 2,
                similarity_threshold=MIN_VECTOR_SIMILARITY,
            ),
            self._keyword_search(
                query=query,
                project_ids=project_ids,
                client_id=client_id,
                limit=limit * 2,
            ),
        )

        # Reciprocal Rank Fusion
        # Keys must be stable and non-None; skip id-less docs so multiple
        # None-id candidates never collapse into one corrupted bucket.
        combined_scores: Dict[Any, Dict[str, Any]] = {}
        k = 60

        # Score vector results
        for rank, doc in enumerate(vector_results):
            doc_id = doc["id"]
            if doc_id is None:
                continue
            rrf_score = vector_weight / (k + rank + 1)
            combined_scores[doc_id] = {
                **doc,
                "combined_score": rrf_score
            }

        # Add keyword results
        keyword_weight = 1 - vector_weight
        for rank, doc in enumerate(keyword_results):
            doc_id = doc["id"]
            if doc_id is None:
                continue
            rrf_score = keyword_weight / (k + rank + 1)

            if doc_id in combined_scores:
                combined_scores[doc_id]["combined_score"] += rrf_score
            else:
                combined_scores[doc_id] = {
                    **doc,
                    "combined_score": rrf_score
                }

        # Sort by combined score and return top results
        sorted_results = sorted(
            combined_scores.values(),
            key=lambda x: x["combined_score"],
            reverse=True
        )

        return sorted_results[:limit]

    async def rerank(self, query: str, documents: List[Dict[str, Any]],
        top_n: int) -> List[Dict[str, Any]]:
        """Re-score candidate documents against the query with a cross-encoder.

        Uses OpenRouter's hosted rerank endpoint (Cohere Rerank), which scores
        each (query, document) pair far more accurately than the embedding
        similarity used for first-stage retrieval. Returns the ``top_n`` highest
        scoring documents, each annotated with a ``rerank_score``.

        Reranking is best-effort: if it is disabled or the call fails for any
        reason, we fall back to the pre-rerank ordering (truncated to ``top_n``)
        so a reranker hiccup never breaks chat.
        """
        if not settings.rerank_model or len(documents) <= 1:
            return documents[:top_n]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/rerank",
                    headers={"Authorization": f"Bearer {settings.api_key}"},
                    json={
                        "model": settings.rerank_model,
                        "query": query,
                        "documents": [d.get("content", "") for d in documents],
                        "top_n": top_n,
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])

            reranked: List[Dict[str, Any]] = []
            for r in results:
                idx = r.get("index")
                if idx is None or idx < 0 or idx >= len(documents):
                    continue
                doc = dict(documents[idx])
                doc["rerank_score"] = r.get("relevance_score")
                reranked.append(doc)

            if reranked:
                logger.info(
                    f"Reranked {len(documents)} candidates -> {len(reranked)} "
                    f"(model={settings.rerank_model})"
                )
                return reranked

            logger.warning("Rerank returned no usable results, using pre-rerank order")
        except Exception as e:
            logger.warning(f"Rerank failed, using pre-rerank order: {e}")

        return documents[:top_n]

    async def retrieve_relevant(self, query: str, project_ids: List[int],
        client_id: Optional[str] = None,
        top_n: Optional[int] = None,
        strict: bool = False) -> List[Dict[str, Any]]:
        """Retrieve the most relevant documents for a query (two-stage).

        Scoped to ``project_ids`` (the caller's membership-verified active
        project) and, when ``client_id`` is given, the caller's own legacy
        NULL-project documents. Stage 1: hybrid search widens to
        ``rerank_candidates`` candidates. Stage 2: the reranker re-scores them
        and keeps the top ``top_n``.

        When ``strict`` is True (a specific project is active), ``client_id`` is
        dropped from the scope so ONLY documents belonging to the active project
        are returned — the caller's legacy NULL-project uploads are NOT mixed in,
        preventing cross-scope document leakage.

        This is the entry point chat turns should use; the returned list is the
        single source of truth for both the prompt context and the citation
        sources, keeping the model's ``[n]`` markers aligned with the rendered
        source chips.
        """
        effective_client_id = None if strict else client_id
        if not project_ids and not effective_client_id:
            return []
        keep = top_n if top_n is not None else settings.rerank_top_n
        candidates = await self.hybrid_search(
            query=query,
            project_ids=project_ids,
            client_id=effective_client_id,
            limit=settings.rerank_candidates,
        )
        if not candidates:
            return []
        return await self.rerank(query=query, documents=candidates, top_n=keep)

    @staticmethod
    def _scope_or_filter(
        project_ids: List[int], client_id: Optional[str]
    ) -> Optional[str]:
        """Build the PostgREST ``or`` filter that mirrors the RPC's WHERE: a row
        matches if it is in the active project set OR it is the caller's own
        legacy NULL-project row. Returns ``None`` when there is nothing to scope
        to (no projects and no client id), signalling the caller to skip.

        ``client_id`` is embedded verbatim into the filter string, so it must
        be a UUID; anything else is rejected rather than risk a filter
        injection from a future non-auth call site.
        """
        clauses: List[str] = []
        if project_ids:
            ids_csv = ",".join(str(pid) for pid in project_ids)
            clauses.append(f"project_id.in.({ids_csv})")
        if client_id:
            if not _UUID_RE.fullmatch(client_id):
                raise ValueError(f"client_id is not a valid UUID: {client_id!r}")
            clauses.append(f"and(uid.eq.{client_id},project_id.is.null)")
        return ",".join(clauses) if clauses else None

    async def _keyword_search(self, query: str, project_ids: List[int],
        client_id: Optional[str] = None,
        limit: int = 10) -> List[Dict[str, Any]]:
        """Perform keyword-based full-text search via the
        ``keyword_search_client_knowledge`` RPC, which returns real
        ``ts_rank`` scores instead of a fabricated constant.

        Scores are normalized so the top result is 1.0, making them
        comparable to vector similarity scores in the RRF combiner.
        Scoped to the caller's project(s) and legacy NULL-project rows.
        """
        scope = self._scope_or_filter(project_ids, client_id)
        if scope is None:
            return []
        try:
            result = supabase.rpc(
                "keyword_search_client_knowledge",
                {
                    "_query": query,
                    "_match_count": limit,
                    "_filter_uid": client_id or None,
                    "_filter_project_ids": project_ids or None,
                },
            ).execute()

            if not result.data:
                return []

            # Normalize ts_rank so the top result has similarity_score=1.0.
            # ts_rank values are typically small floats (e.g. 0.06); normalizing
            # keeps them on the same scale as the vector similarity scores used
            # in the RRF combiner without distorting relative ordering.
            ranks = [float(row.get("rank") or 0.0) for row in result.data]
            max_rank = max(ranks) if ranks else 1.0
            normalizer = max_rank if max_rank > 0.0 else 1.0

            return [
                {
                    "id": doc["id"],
                    "content": doc["content"],
                    "metadata": doc.get("metadata", {}),
                    "similarity_score": float(doc.get("rank") or 0.0) / normalizer,
                }
                for doc in result.data[:limit]
            ]
        except Exception as e:
            logger.warning(f"Full-text search RPC failed, falling back to ILIKE: {e}")
            return await self._fallback_keyword_search(
                query, project_ids, client_id, limit
            )

    async def _fallback_keyword_search(self, query: str, project_ids: List[int],
        client_id: Optional[str] = None,
        limit: int = 10) -> List[Dict[str, Any]]:
        """Fallback keyword search using ILIKE for simple pattern matching."""
        words = query.lower().split()[:3]
        scope = self._scope_or_filter(project_ids, client_id)
        if not words or scope is None:
            return []

        result = supabase.table("client_knowledge") \
            .select("id, content, metadata") \
            .or_(scope) \
            .ilike("content", f"%{words[0]}%") \
            .limit(limit) \
            .execute()

        if not result.data:
            return []

        return [
            {
                "id": doc["id"],
                "content": doc["content"],
                "metadata": doc.get("metadata", {}),
                "similarity_score": 0.3
            }
            for doc in result.data
        ]

    @staticmethod
    def build_context_string(
        retrieved_docs: List[Dict[str, Any]],
        attachments: Optional[List[Dict[str, str]]] = None,
        max_context_length: int = 200_000,
    ) -> str:
        """Render a prompt context string from already-retrieved docs + attachments.

        Pure (no I/O) so it can be reused wherever docs were fetched once.
        """
        context_parts: List[str] = []
        current_length = 0

        if attachments:
            context_parts.append("=== Session Attachments ===\n")
            for att in attachments:
                att_text = f"\n[File: {att.get('filename', 'attachment')}]\n{att.get('content', '')}\n"
                if current_length + len(att_text) < max_context_length:
                    context_parts.append(att_text)
                    current_length += len(att_text)

        if retrieved_docs:
            context_parts.append("\n=== Retrieved Documents ===\n")
            for doc in retrieved_docs:
                metadata = doc.get("metadata", {})
                filename = metadata.get("filename", "Unknown")
                page = metadata.get("page_number", "")
                page_str = f" (Page {page})" if page else ""

                doc_text = f"\n[Source: {filename}{page_str}]\n{doc.get('content', '')}\n"

                if current_length + len(doc_text) < max_context_length:
                    context_parts.append(doc_text)
                    current_length += len(doc_text)
                else:
                    break

        return "".join(context_parts) if context_parts else "No relevant documents found."
