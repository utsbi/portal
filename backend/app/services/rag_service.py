import logging
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from app.core.config import settings
from app.db.supabase import supabase
from app.services.pdf_parser import PDFParser

logger = logging.getLogger(__name__)


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
            if settings.EMBEDDING_DIMENSIONS is not None:
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
        client_id: str) -> List[int]:
        """Chunk, embed, and store a document in Supabase."""
        chunks = self.pdf_parser.chunk_text(content)
        document_ids = []

        for chunk_idx, chunk in enumerate(chunks):
            embedding = await self.generate_embedding(chunk)

            # Prepare metadata with chunk info
            chunk_metadata = {
                **metadata,
                "chunk_index": chunk_idx,
                "total_chunks": len(chunks)
            }

            # Insert into Supabase (using 'uid' column per schema)
            result = supabase.table("client_knowledge").insert({
                "uid": client_id,
                "content": chunk,
                "metadata": chunk_metadata,
                "embedding": embedding
            }).execute()

            if result.data and isinstance(result.data, list) and len(result.data) > 0:
                document_ids.append(result.data[0]["id"])  # type: ignore

        return document_ids

    async def search_documents(self, query: str, client_id: str, limit: int = 5,
        similarity_threshold: float = 0.0) -> List[Dict[str, Any]]:
        """Search for relevant documents using vector similarity."""
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
                logger.info(f"Vector search returned no results for client {client_id} (threshold={similarity_threshold})")
        except Exception as e:
            logger.error(f"RPC match_client_knowledge failed: {e}")

        return []

    async def hybrid_search(self, query: str, client_id: str, limit: int = 5,
        vector_weight: float = 0.7) -> List[Dict[str, Any]]:
        """Perform hybrid search combining vector similarity and keyword matching."""
        # Get vector search results
        vector_results = await self.search_documents(
            query=query,
            client_id=client_id,
            limit=limit * 2
        )

        # Get keyword search results
        keyword_results = await self._keyword_search(
            query=query,
            client_id=client_id,
            limit=limit * 2
        )

        # Reciprocal Rank Fusion
        combined_scores: Dict[int, Dict[str, Any]] = {}
        k = 60

        # Score vector results
        for rank, doc in enumerate(vector_results):
            doc_id = doc["id"]
            rrf_score = vector_weight / (k + rank + 1)
            combined_scores[doc_id] = {
                **doc,
                "combined_score": rrf_score
            }

        # Add keyword results
        keyword_weight = 1 - vector_weight
        for rank, doc in enumerate(keyword_results):
            doc_id = doc["id"]
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

    async def _keyword_search(self, query: str, client_id: str,
        limit: int = 10) -> List[Dict[str, Any]]:
        """Perform keyword-based full-text search."""
        try:
            result = supabase.table("client_knowledge") \
                .select("id, content, metadata") \
                .eq("uid", client_id) \
                .text_search("content", query, options={"type": "plain"}) \
                .execute()

            if not result.data:
                return []

            return [
                {
                    "id": doc["id"],
                    "content": doc["content"],
                    "metadata": doc.get("metadata", {}),
                    "similarity_score": 0.5
                }
                for doc in result.data[:limit]
            ]
        except Exception as e:
            logger.warning(f"Full-text search failed, falling back to ILIKE: {e}")
            return await self._fallback_keyword_search(query, client_id, limit)

    async def _fallback_keyword_search(self, query: str, client_id: str,
        limit: int = 10) -> List[Dict[str, Any]]:
        """Fallback keyword search using ILIKE for simple pattern matching."""
        words = query.lower().split()[:3]
        if not words:
            return []

        result = supabase.table("client_knowledge") \
            .select("id, content, metadata") \
            .eq("uid", client_id) \
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

    async def get_context_for_query(self, query: str, client_id: str,
        attachments: Optional[List[Dict[str, str]]] = None,
        max_context_length: int = 200_000) -> str:
        """Build a context string for the LLM from retrieved documents and attachments."""
        context_parts = []
        current_length = 0

        if attachments:
            context_parts.append("=== Session Attachments ===\n")
            for att in attachments:
                att_text = f"\n[File: {att.get('filename', 'attachment')}]\n{att.get('content', '')}\n"
                if current_length + len(att_text) < max_context_length:
                    context_parts.append(att_text)
                    current_length += len(att_text)

        # Retrieve relevant documents from the vector store
        retrieved_docs = await self.hybrid_search(
            query=query,
            client_id=client_id,
            limit=5
        )

        if retrieved_docs:
            context_parts.append("\n=== Retrieved Documents ===\n")
            for doc in retrieved_docs:
                metadata = doc.get("metadata", {})
                filename = metadata.get("filename", "Unknown")
                page = metadata.get("page_number", "")
                page_str = f" (Page {page})" if page else ""

                doc_text = f"\n[Source: {filename}{page_str}]\n{doc['content']}\n"

                if current_length + len(doc_text) < max_context_length:
                    context_parts.append(doc_text)
                    current_length += len(doc_text)
                else:
                    break

        return "".join(context_parts) if context_parts else "No relevant documents found."
