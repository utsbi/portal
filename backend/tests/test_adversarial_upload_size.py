"""Adversarial tests for the upload size cap on /chat/extract-text and
/documents/upload.

REQUIREMENT derived first: an oversize upload must be rejected (413) and, just
as important, the server must NOT read an unbounded body fully into memory
before rejecting it (a memory-DoS even on the rejection path), and a malformed
Content-Length must not crash the request handler with a 500.

The handlers gate on the Content-Length header (`int(content_length)`), then
`await file.read()` (which buffers the WHOLE body), then re-check the read size.
These tests probe the three weaknesses: malformed CL crash, the body being
fully buffered before the size check, and the exact-limit / one-over boundary.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import app.explore.api.deps as deps_mod
from app.explore.core.config import settings
from app.explore.main import app


@pytest.fixture()
def authed_client(monkeypatch):
    """A TestClient whose auth always resolves to a fixed user, so we exercise
    the size-cap logic rather than auth. raise_server_exceptions=False so we can
    observe 500s instead of them bubbling out of the client."""
    user = MagicMock()
    user.id = "test-user-uuid-1234"
    mock_supa = MagicMock()
    mock_supa.auth.get_user = MagicMock(return_value=MagicMock(user=user))
    monkeypatch.setattr(deps_mod, "supabase", mock_supa)
    return TestClient(app, raise_server_exceptions=False)


_HDR = {"Authorization": "Bearer t"}


class TestMalformedContentLength:
    """A non-numeric Content-Length must not 500. The handler does
    ``int(content_length)`` with no guard, so a header like 'abc' raises
    ValueError -> 500 Internal Server Error. The correct behavior is a 4xx
    (400/413/422), never a 500."""

    def test_extract_text_malformed_content_length_not_500(self, authed_client):
        resp = authed_client.post(
            "/api/v1/chat/extract-text",
            headers={**_HDR, "content-length": "not-a-number"},
            files={"file": ("a.txt", b"hello", "text/plain")},
        )
        assert resp.status_code != 500, resp.text
        assert resp.status_code < 500

    def test_upload_malformed_content_length_not_500(self, authed_client):
        resp = authed_client.post(
            "/api/v1/documents/upload",
            headers={**_HDR, "content-length": "12abc"},
            files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")},
            data={"project_id": "1"},
        )
        assert resp.status_code != 500, resp.text


class TestSpoofedAndOversizeBody:
    """The Content-Length pre-check can be bypassed (spoofed low / absent), in
    which case the only remaining gate is the POST-read length check — meaning
    the full oversize body has already been buffered into memory. We assert the
    request is still rejected with 413 (correctness), and document that the
    rejection happens only AFTER a full read (the memory-DoS surface)."""

    def test_oversize_body_with_spoofed_low_content_length_is_rejected(
        self, authed_client
    ):
        # Body is over the cap; we spoof a tiny Content-Length so the fast-path
        # header check passes. (Test/h11 may recompute CL; the post-read check
        # is the backstop and MUST still reject.)
        over = settings.MAX_UPLOAD_BYTES + 1024
        body = b"A" * over
        resp = authed_client.post(
            "/api/v1/chat/extract-text",
            headers={**_HDR, "content-length": "10"},
            files={"file": ("big.txt", body, "text/plain")},
        )
        assert resp.status_code == 413, (
            f"oversize body must be rejected with 413, got {resp.status_code}"
        )

    async def test_oversize_body_aborts_early_without_full_buffering_unit(
        self, monkeypatch
    ):
        """Memory-DoS regression guard (unit-level).

        Over HTTP, TestClient/h11 always sends an accurate Content-Length, so the
        fast-path header check fires first — which HIDES the real weakness. But
        the header check is trivially bypassable in production: a request with NO
        Content-Length (chunked transfer-encoding) or a Content-Length spoofed
        LOW by an upstream proxy slips past it. In that case the ONLY remaining
        gate is the post-read length check.

        The handler MUST read the body in bounded chunks and abort the moment the
        cumulative size crosses the cap — it must NEVER buffer the whole oversize
        body into RAM first. We exercise that bypass path directly with a Request
        carrying no usable Content-Length and an UploadFile holding a body far
        larger than the cap, and assert (a) it still rejects with 413 and (b) it
        read no more than ~cap+one-chunk bytes (strictly less than the full body).
        """
        import io

        from fastapi import HTTPException, UploadFile
        from starlette.requests import Request

        from app.explore.api.v1.endpoints.chat import extract_file_text
        from app.explore.core.uploads import _UPLOAD_CHUNK_BYTES

        # Body FAR larger than the cap (4x) so an early abort is unambiguous: a
        # handler that buffered the whole thing would read ~4x the cap.
        body = b"B" * (settings.MAX_UPLOAD_BYTES * 4)

        # A Request with NO content-length header (simulates chunked encoding /
        # a proxy that stripped or spoofed it) — bypasses the fast-path check.
        # The handler is decorated with the slowapi limiter, which reads several
        # scope keys, so we provide a complete-enough ASGI scope.
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/chat/extract-text",
            "headers": [],
            "query_string": b"",
            "client": ("127.0.0.1", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
            "app": app,
        }
        request = Request(scope)
        assert request.headers.get("content-length") is None

        upload = UploadFile(filename="big.txt", file=io.BytesIO(body))

        read_sizes = {"total": 0}
        original_read = upload.read

        async def spy_read(size: int = -1):
            data = await original_read(size)
            read_sizes["total"] += len(data) if data else 0
            return data

        monkeypatch.setattr(upload, "read", spy_read)

        with pytest.raises(HTTPException) as exc:
            await extract_file_text(request=request, file=upload, user_id="u")

        # Rejected (good)...
        assert exc.value.status_code == 413
        # ...and it aborted EARLY: it never materialized the whole oversize body.
        # A correct chunked read stops at most one chunk past the cap.
        cap = settings.MAX_UPLOAD_BYTES
        assert read_sizes["total"] <= cap + _UPLOAD_CHUNK_BYTES, (
            f"handler read {read_sizes['total']} bytes — it should abort within "
            f"one chunk of the {cap}-byte cap, not buffer the full body"
        )
        assert read_sizes["total"] < len(body), (
            "handler buffered the entire oversize body before rejecting it "
            "(memory-DoS on the rejection path)"
        )


class TestBoundary:
    def test_just_under_limit_is_accepted(self, authed_client):
        # Leave headroom for multipart framing so the request's Content-Length
        # (which the fast-path header check measures) stays under the cap. A file
        # comfortably under MAX must not be rejected by the size gate.
        body = b"x" * (settings.MAX_UPLOAD_BYTES - 4096)
        resp = authed_client.post(
            "/api/v1/chat/extract-text",
            headers=_HDR,
            files={"file": ("ok.txt", body, "text/plain")},
        )
        assert resp.status_code != 413, resp.text

    def test_one_byte_over_limit_is_rejected(self, authed_client):
        body = b"x" * (settings.MAX_UPLOAD_BYTES + 1)
        resp = authed_client.post(
            "/api/v1/chat/extract-text",
            headers=_HDR,
            files={"file": ("over.txt", body, "text/plain")},
        )
        assert resp.status_code == 413, resp.text


class TestZeroByteAndWrongType:
    def test_zero_byte_file_does_not_500(self, authed_client):
        resp = authed_client.post(
            "/api/v1/chat/extract-text",
            headers=_HDR,
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        assert resp.status_code < 500, resp.text
