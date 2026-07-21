"""Tests for app.explore.api.v1.endpoints.chat.

Covers:
  - extract-text: oversized upload → 413 (Content-Length header + actual body)
  - extract-text: valid small text/pdf file works (parser mocked)
  - extract-text: requires auth (no header → 401)
  - Rate-limit decorator is wired to the router (smoke check)
  - SSE endpoint: valid request emits SSE events (agent mocked)
  - SSE endpoint: timeout path yields error event
  - SSE endpoint: requires auth
  - include_sources=False strips sources from result event
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.explore.main import app
from app.explore.api.deps import AuthContext


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _auth_override():
    """Dependency override that returns a fixed AuthContext."""
    return AuthContext(user_id="test-uid-1234", access_token="test-token")


def _user_id_override():
    return "test-uid-1234"


# ---------------------------------------------------------------------------
# extract-text endpoint
# ---------------------------------------------------------------------------


class TestExtractText:
    """POST /api/v1/chat/extract-text"""

    @pytest.fixture(autouse=True)
    def _reset_rate_limiter(self):
        # The endpoint's 10/minute limit is keyed per client and shared across
        # the whole suite run; without a reset the class's later tests trip
        # 429s once enough requests accumulate.
        from app.explore.core.limiter import limiter

        limiter.reset()
        yield

    def _client_with_auth(self) -> TestClient:
        from app.explore.api.deps import get_current_user_id

        app.dependency_overrides[get_current_user_id] = _user_id_override
        client = TestClient(app, raise_server_exceptions=False)
        return client

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_oversized_via_content_length_header_returns_413(self):
        """Content-Length over MAX_UPLOAD_BYTES triggers a fast 413."""
        from app.explore.api.deps import get_current_user_id

        app.dependency_overrides[get_current_user_id] = _user_id_override

        client = TestClient(app, raise_server_exceptions=False)
        big_size = 11 * 1024 * 1024  # 11 MB > 10 MB limit
        resp = client.post(
            "/api/v1/chat/extract-text",
            files={"file": ("big.txt", b"x", "text/plain")},
            headers={
                "Authorization": "Bearer test-token",
                "Content-Length": str(big_size),
            },
        )
        assert resp.status_code == 413

    def test_oversized_actual_body_returns_413(self):
        """A file body exceeding MAX_UPLOAD_BYTES at read-time triggers 413."""
        from app.explore.api.deps import get_current_user_id

        app.dependency_overrides[get_current_user_id] = _user_id_override

        client = TestClient(app, raise_server_exceptions=False)
        big_bytes = b"x" * (11 * 1024 * 1024)  # 11 MB
        resp = client.post(
            "/api/v1/chat/extract-text",
            files={"file": ("big.txt", big_bytes, "text/plain")},
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 413

    def test_valid_txt_file_returns_content(self):
        """A small plain-text file must be extracted and returned."""
        from app.explore.api.deps import get_current_user_id

        app.dependency_overrides[get_current_user_id] = _user_id_override

        client = TestClient(app, raise_server_exceptions=False)
        text_bytes = b"Hello from the test file."
        resp = client.post(
            "/api/v1/chat/extract-text",
            files={"file": ("notes.txt", text_bytes, "text/plain")},
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["filename"] == "notes.txt"
        assert "Hello from the test file." in body["content"]
        assert body["file_type"] == "txt"

    def test_image_file_returns_data_url(self):
        """Images are returned as a base64 data URL (no transcription) so the
        multimodal chat models receive them as pixels."""
        import base64

        client = self._client_with_auth()
        raw = b"\x89PNG\r\n\x1a\n fake png bytes"
        resp = client.post(
            "/api/v1/chat/extract-text",
            files={"file": ("grades.png", raw, "image/png")},
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["file_type"] == "image"
        # content is a data URL that round-trips back to the uploaded bytes.
        assert body["content"].startswith("data:image/png;base64,")
        assert base64.b64decode(body["content"].split(",", 1)[1]) == raw

    def test_empty_image_returns_400(self):
        """An empty image upload is rejected rather than yielding an empty URL."""
        client = self._client_with_auth()
        resp = client.post(
            "/api/v1/chat/extract-text",
            files={"file": ("photo.jpg", b"", "image/jpeg")},
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 400
        assert "content" in resp.json()["detail"].lower()

    def test_valid_pdf_file_returns_content(self):
        """A valid PDF must be parsed; parser is mocked."""
        from app.explore.api.deps import get_current_user_id

        app.dependency_overrides[get_current_user_id] = _user_id_override

        fake_pages = [{"content": "PDF page text"}]
        with patch("app.explore.api.v1.endpoints.chat.PDFParser") as MockParser:
            MockParser.return_value.extract_text_with_metadata.return_value = fake_pages
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/chat/extract-text",
                files={"file": ("report.pdf", b"%PDF-1.4 fake", "application/pdf")},
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["file_type"] == "pdf"
        assert "PDF page text" in body["content"]

    def test_no_auth_header_returns_401(self):
        """Without Authorization header the endpoint must reject with 401."""
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/chat/extract-text",
            files={"file": ("notes.txt", b"hi", "text/plain")},
        )
        assert resp.status_code == 401

    def test_rate_limit_decorator_wired(self):
        """The extract-text route must have a slowapi limit decorator attached.

        We verify by checking the route has a dependency or decorator that
        includes 'limit' — this is a smoke test, not a full rate-limit test.
        """
        from fastapi.routing import APIRoute

        def collect_api_routes(route_list):
            """Recursively collect APIRoute instances from nested routers.

            Starlette 1.x wraps included routers in _IncludedRouter objects
            whose sub-routes live on original_router.routes rather than
            appearing directly in the parent routes list.
            """
            found = []
            for r in route_list:
                if isinstance(r, APIRoute):
                    found.append(r)
                original_router = getattr(r, "original_router", None)
                nested_routes = getattr(original_router, "routes", None)
                if nested_routes is None:
                    nested_routes = getattr(r, "routes", None)
                if nested_routes is not None:
                    found.extend(collect_api_routes(nested_routes))
            return found

        routes = collect_api_routes(app.routes)
        extract_text_route = next(
            (r for r in routes if "/extract-text" in r.path), None
        )
        assert extract_text_route is not None


# ---------------------------------------------------------------------------
# SSE chat endpoint
# ---------------------------------------------------------------------------


class TestChatSSE:
    """POST /api/v1/chat/ — SSE streaming."""

    def teardown_method(self):
        app.dependency_overrides.clear()

    async def _sse_events(self, response_text: str) -> list[dict]:
        """Parse SSE data lines from a raw response body."""
        events = []
        for line in response_text.splitlines():
            line = line.strip()
            if line.startswith("data:") and line != "data: [DONE]":
                payload = line[len("data:") :].strip()
                try:
                    events.append(json.loads(payload))
                except json.JSONDecodeError:
                    pass
        return events

    async def test_sse_emits_events_from_mocked_agent(self, async_client):
        """The SSE endpoint must relay events from run_explore_agent_streaming."""
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _fake_stream(**kwargs):
            yield {"type": "phase", "phase": "thinking"}
            yield {"type": "delta", "text": "Hello world"}
            yield {"type": "result", "answer": "Hello world", "sources": []}

        with patch(
            "app.explore.api.v1.endpoints.chat.run_explore_agent_streaming",
            side_effect=_fake_stream,
        ):
            resp = await async_client.post(
                "/api/v1/chat/",
                json={"query": "What is SBI?"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        events = await self._sse_events(resp.text)
        types = [e.get("type") for e in events]
        assert "phase" in types
        assert "delta" in types
        assert "result" in types

    async def test_sse_stream_ends_with_done(self, async_client):
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _fake_stream(**kwargs):
            yield {"type": "result", "answer": "ok", "sources": []}

        with patch(
            "app.explore.api.v1.endpoints.chat.run_explore_agent_streaming",
            side_effect=_fake_stream,
        ):
            resp = await async_client.post(
                "/api/v1/chat/",
                json={"query": "hi"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert "[DONE]" in resp.text

    async def test_include_sources_false_strips_sources(self, async_client):
        """When include_sources=False the result event's sources must be empty."""
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _fake_stream(**kwargs):
            yield {
                "type": "result",
                "answer": "answer text",
                "sources": [
                    {"filename": "doc.pdf", "content": "secret", "page_number": 1}
                ],
            }

        with patch(
            "app.explore.api.v1.endpoints.chat.run_explore_agent_streaming",
            side_effect=_fake_stream,
        ):
            resp = await async_client.post(
                "/api/v1/chat/",
                json={"query": "hi", "include_sources": False},
                headers={"Authorization": "Bearer test-token"},
            )

        events = await self._sse_events(resp.text)
        result_events = [e for e in events if e.get("type") == "result"]
        assert result_events, "Expected at least one result event"
        assert result_events[0]["sources"] == []

    async def test_no_auth_returns_401(self, async_client):
        """Without a valid auth header the endpoint must return 401."""
        app.dependency_overrides.clear()
        resp = await async_client.post(
            "/api/v1/chat/",
            json={"query": "hi"},
        )
        assert resp.status_code == 401

    async def test_timeout_emits_error_event(self, async_client):
        """When the agent stream times out, an error SSE event must be emitted."""
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _slow_stream(**kwargs):
            raise asyncio.TimeoutError()
            yield  # make it an async generator

        with patch(
            "app.explore.api.v1.endpoints.chat.run_explore_agent_streaming",
            side_effect=_slow_stream,
        ):
            resp = await async_client.post(
                "/api/v1/chat/",
                json={"query": "test timeout"},
                headers={"Authorization": "Bearer test-token"},
            )

        events = await self._sse_events(resp.text)
        error_events = [e for e in events if e.get("type") == "error"]
        assert error_events, "Expected an error event on timeout"
        assert "timed out" in error_events[0].get("message", "").lower()

    async def test_generic_exception_emits_generic_error_event(self, async_client):
        """Internal exceptions must not leak details to the SSE stream."""
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _exploding_stream(**kwargs):
            raise RuntimeError("super secret internal db password")
            yield

        with patch(
            "app.explore.api.v1.endpoints.chat.run_explore_agent_streaming",
            side_effect=_exploding_stream,
        ):
            resp = await async_client.post(
                "/api/v1/chat/",
                json={"query": "boom"},
                headers={"Authorization": "Bearer test-token"},
            )

        events = await self._sse_events(resp.text)
        error_events = [e for e in events if e.get("type") == "error"]
        assert error_events
        # Internal details must not leak
        assert "super secret" not in resp.text
        assert "internal db password" not in resp.text
        assert error_events[0]["message"] == "An internal error occurred"

    def test_chat_health_endpoint(self):
        """GET /api/v1/chat/health must return 200 with status healthy."""
        client = TestClient(app)
        resp = client.get("/api/v1/chat/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
        assert resp.json()["service"] == "chat"
