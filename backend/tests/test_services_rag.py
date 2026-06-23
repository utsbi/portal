"""Tests for app.explore.services.rag_service.

Covers:
  - _UUID_RE: non-UUID / injection string raises ValueError in _scope_or_filter
  - _UUID_RE: valid UUID passes _scope_or_filter
  - _scope_or_filter: returns None when no project_ids and no client_id
  - _scope_or_filter: builds correct filter with project_ids only
  - _scope_or_filter: builds correct filter with both project_ids and client_id
  - rerank: falls back to pre-rerank order when rerank_model is empty
  - rerank: returns at most top_n when there is only 1 document (skip rerank)
  - build_context_string: pure function with known input
  - search_documents: empty project_ids AND no client_id returns [] without calling embedding
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.explore.services.rag_service import RAGService, _UUID_RE


# ---------------------------------------------------------------------------
# _UUID_RE regex guard
# ---------------------------------------------------------------------------

class TestUUIDRegex:
    def test_valid_uuid_matches(self):
        valid = "550e8400-e29b-41d4-a716-446655440000"
        assert _UUID_RE.fullmatch(valid) is not None

    def test_valid_uuid_uppercase_matches(self):
        valid = "550E8400-E29B-41D4-A716-446655440000"
        assert _UUID_RE.fullmatch(valid) is not None

    def test_non_uuid_string_does_not_match(self):
        assert _UUID_RE.fullmatch("not-a-uuid") is None

    def test_sql_injection_attempt_does_not_match(self):
        injection = "' OR '1'='1"
        assert _UUID_RE.fullmatch(injection) is None

    def test_empty_string_does_not_match(self):
        assert _UUID_RE.fullmatch("") is None

    def test_partial_uuid_does_not_fullmatch(self):
        partial = "550e8400-e29b-41d4"
        assert _UUID_RE.fullmatch(partial) is None

    def test_uuid_with_extra_chars_does_not_fullmatch(self):
        # Extra character appended
        invalid = "550e8400-e29b-41d4-a716-446655440000X"
        assert _UUID_RE.fullmatch(invalid) is None


# ---------------------------------------------------------------------------
# RAGService._scope_or_filter
# ---------------------------------------------------------------------------

class TestScopeOrFilter:
    def test_no_project_ids_no_client_id_returns_none(self):
        result = RAGService._scope_or_filter([], None)
        assert result is None

    def test_project_ids_only_builds_filter(self):
        result = RAGService._scope_or_filter([1, 2, 3], None)
        assert result is not None
        assert "project_id.in.(1,2,3)" in result

    def test_client_id_only_builds_filter(self):
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        result = RAGService._scope_or_filter([], valid_uuid)
        assert result is not None
        assert valid_uuid in result
        assert "project_id.is.null" in result

    def test_both_project_ids_and_client_id(self):
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        result = RAGService._scope_or_filter([10], valid_uuid)
        assert result is not None
        assert "project_id.in.(10)" in result
        assert valid_uuid in result

    def test_non_uuid_client_id_raises_value_error(self):
        with pytest.raises(ValueError, match="not a valid UUID"):
            RAGService._scope_or_filter([], "'; DROP TABLE users; --")

    def test_injection_string_as_client_id_raises(self):
        """A SQL-injection-shaped client_id must be rejected."""
        with pytest.raises(ValueError):
            RAGService._scope_or_filter([], "' OR '1'='1")

    def test_plain_non_uuid_string_raises(self):
        with pytest.raises(ValueError):
            RAGService._scope_or_filter([], "admin")


# ---------------------------------------------------------------------------
# RAGService.rerank — fallback behaviour
# ---------------------------------------------------------------------------

class TestRerank:
    def _service(self) -> RAGService:
        with patch("app.explore.services.rag_service.AsyncOpenAI"):
            svc = RAGService()
        return svc

    async def test_empty_rerank_model_returns_documents_truncated(self):
        svc = self._service()
        docs = [{"id": i, "content": f"doc {i}"} for i in range(5)]
        with patch("app.explore.services.rag_service.settings") as mock_settings:
            mock_settings.rerank_model = ""
            result = await svc.rerank(query="q", documents=docs, top_n=3)
        assert result == docs[:3]

    async def test_single_document_skips_rerank(self):
        svc = self._service()
        docs = [{"id": 0, "content": "only doc"}]
        with patch("app.explore.services.rag_service.settings") as mock_settings:
            mock_settings.rerank_model = "cohere/rerank-4-pro"
            result = await svc.rerank(query="q", documents=docs, top_n=5)
        # Single doc: rerank skipped, returned as-is (limited to top_n)
        assert result == docs[:5]

    async def test_rerank_api_failure_falls_back_to_original_order(self):
        """When the rerank HTTP call fails, return the original order truncated."""
        import httpx

        svc = self._service()
        docs = [{"id": i, "content": f"doc {i}"} for i in range(10)]

        with patch("app.explore.services.rag_service.settings") as mock_settings:
            mock_settings.rerank_model = "cohere/rerank-4-pro"
            mock_settings.api_key = "test-key"
            with patch("httpx.AsyncClient") as MockClient:
                mock_resp = MagicMock()
                mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                    "500", request=MagicMock(), response=MagicMock()
                )
                MockClient.return_value.__aenter__.return_value.post = AsyncMock(
                    return_value=mock_resp
                )
                result = await svc.rerank(query="q", documents=docs, top_n=3)

        # Falls back to pre-rerank order, truncated
        assert len(result) == 3
        assert result == docs[:3]


# ---------------------------------------------------------------------------
# RAGService.search_documents — empty scope short-circuits
# ---------------------------------------------------------------------------

class TestSearchDocuments:
    def _service(self) -> RAGService:
        with patch("app.explore.services.rag_service.AsyncOpenAI"):
            svc = RAGService()
        return svc

    async def test_empty_project_ids_and_no_client_id_returns_empty(self):
        svc = self._service()
        # generate_embedding should NOT be called if scope is empty
        svc.generate_embedding = AsyncMock()
        result = await svc.search_documents(
            query="test", project_ids=[], client_id=None
        )
        assert result == []
        svc.generate_embedding.assert_not_called()

    async def test_rpc_returns_results(self):
        svc = self._service()
        fake_embedding = [0.1] * 4096
        svc.generate_embedding = AsyncMock(return_value=fake_embedding)

        mock_rpc_result = MagicMock()
        mock_rpc_result.data = [
            {
                "id": 1,
                "content": "relevant content",
                "metadata": {"filename": "doc.pdf"},
                "similarity": 0.85,
            }
        ]

        with patch("app.explore.services.rag_service.supabase") as mock_supa:
            rpc_chain = MagicMock()
            rpc_chain.execute.return_value = mock_rpc_result
            mock_supa.rpc.return_value = rpc_chain

            result = await svc.search_documents(
                query="test query", project_ids=[1], client_id=None
            )

        assert len(result) == 1
        assert result[0]["content"] == "relevant content"
        assert result[0]["similarity_score"] == 0.85

    async def test_rpc_call_shape(self):
        """The RPC must be called with expected parameter names."""
        svc = self._service()
        fake_embedding = [0.0] * 4096
        svc.generate_embedding = AsyncMock(return_value=fake_embedding)

        with patch("app.explore.services.rag_service.supabase") as mock_supa:
            rpc_chain = MagicMock()
            rpc_chain.execute.return_value = MagicMock(data=[])
            mock_supa.rpc.return_value = rpc_chain

            await svc.search_documents(
                query="roof insulation", project_ids=[5], client_id="uid-abc"
            )

            call_args = mock_supa.rpc.call_args
            assert call_args is not None
            rpc_name = call_args[0][0]
            rpc_params = call_args[0][1]
            assert rpc_name == "match_client_knowledge"
            assert "_query_embedding" in rpc_params
            assert "_match_count" in rpc_params
            assert "_filter_project_ids" in rpc_params


# ---------------------------------------------------------------------------
# RAGService.build_context_string — pure function
# ---------------------------------------------------------------------------

class TestBuildContextString:
    def test_no_docs_no_attachments_returns_no_relevant(self):
        result = RAGService.build_context_string([], None)
        assert result == "No relevant documents found."

    def test_docs_included_in_output(self):
        docs = [
            {
                "content": "The roof R-value is R-30.",
                "metadata": {"filename": "spec.pdf", "page_number": 2},
            }
        ]
        result = RAGService.build_context_string(docs)
        assert "spec.pdf" in result
        assert "R-30" in result
        assert "Page 2" in result

    def test_attachments_included_before_docs(self):
        attachments = [{"filename": "notes.txt", "content": "meeting notes here"}]
        result = RAGService.build_context_string([], attachments)
        assert "Session Attachments" in result
        assert "meeting notes here" in result

    def test_max_context_length_respected(self):
        docs = [
            {
                "content": "x" * 5000,
                "metadata": {"filename": "big.pdf"},
            }
            for _ in range(50)
        ]
        result = RAGService.build_context_string(docs, max_context_length=10_000)
        assert len(result) <= 10_500  # some slack for surrounding text
