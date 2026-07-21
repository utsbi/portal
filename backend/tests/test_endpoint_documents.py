"""Tests for app.explore.api.v1.endpoints.documents.

Covers:
  - upload: oversized via Content-Length → 413
  - upload: oversized actual body → 413
  - upload: non-PDF file → 400
  - upload: error handler returns generic detail (not raw exception text)
  - upload: requires auth
  - upload: non-member gets 403
  - upload: non-director gets 403
  - list: requires auth
  - index-text: director-gated save-to-knowledge (happy path, dedup, caps)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.explore.main import app
from app.explore.api.deps import AuthContext


def _auth_override():
    return AuthContext(user_id="test-uid-1234", access_token="test-token")


def _user_id_override():
    return "test-uid-1234"


class TestDocumentUpload:
    """POST /api/v1/documents/upload"""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_oversized_via_content_length_returns_413(self):
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        client = TestClient(app, raise_server_exceptions=False)
        big_size = 11 * 1024 * 1024
        resp = client.post(
            "/api/v1/documents/upload",
            files={"file": ("big.pdf", b"x", "application/pdf")},
            data={"project_id": "1"},
            headers={
                "Authorization": "Bearer test-token",
                "Content-Length": str(big_size),
            },
        )
        assert resp.status_code == 413

    def test_oversized_actual_body_returns_413(self):
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        with (
            patch(
                "app.explore.api.v1.endpoints.documents.is_project_member",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.explore.api.v1.endpoints.documents._is_director",
                new=AsyncMock(return_value=True),
            ),
        ):
            client = TestClient(app, raise_server_exceptions=False)
            big_bytes = b"x" * (11 * 1024 * 1024)
            resp = client.post(
                "/api/v1/documents/upload",
                files={"file": ("big.pdf", big_bytes, "application/pdf")},
                data={"project_id": "1"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 413

    def test_non_pdf_file_returns_400(self):
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        with (
            patch(
                "app.explore.api.v1.endpoints.documents.is_project_member",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.explore.api.v1.endpoints.documents._is_director",
                new=AsyncMock(return_value=True),
            ),
        ):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/documents/upload",
                files={
                    "file": (
                        "report.docx",
                        b"fake docx bytes",
                        "application/vnd.openxmlformats",
                    )
                },
                data={"project_id": "1"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 400
        assert "PDF" in resp.json()["detail"]

    def test_no_auth_returns_401(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/documents/upload",
            files={"file": ("doc.pdf", b"%PDF", "application/pdf")},
            data={"project_id": "1"},
        )
        assert resp.status_code == 401

    def test_non_member_returns_403(self):
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        with patch(
            "app.explore.api.v1.endpoints.documents.is_project_member",
            new=AsyncMock(return_value=False),
        ):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/documents/upload",
                files={"file": ("doc.pdf", b"%PDF", "application/pdf")},
                data={"project_id": "99"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 403
        assert "member" in resp.json()["detail"].lower()

    def test_non_director_returns_403(self):
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        with (
            patch(
                "app.explore.api.v1.endpoints.documents.is_project_member",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.explore.api.v1.endpoints.documents._is_director",
                new=AsyncMock(return_value=False),
            ),
        ):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/documents/upload",
                files={"file": ("doc.pdf", b"%PDF", "application/pdf")},
                data={"project_id": "1"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 403
        assert "director" in resp.json()["detail"].lower()

    def test_processing_error_returns_generic_detail(self):
        """An unexpected exception during processing must not leak raw error text."""
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        secret_error_msg = "raw_db_connection_string: postgres://user:secret@host"

        with (
            patch(
                "app.explore.api.v1.endpoints.documents.is_project_member",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.explore.api.v1.endpoints.documents._is_director",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.explore.api.v1.endpoints.documents.PDFParser",
                side_effect=RuntimeError(secret_error_msg),
            ),
        ):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/documents/upload",
                files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
                data={"project_id": "1"},
                headers={"Authorization": "Bearer test-token"},
            )

        # Must be a 5xx (or 4xx from upstream), NOT leaking the raw exception
        assert resp.status_code in (400, 500)
        body_text = resp.text
        assert secret_error_msg not in body_text
        assert "raw_db_connection_string" not in body_text

    def test_successful_upload(self):
        """A valid PDF upload with proper auth should return 200 with success."""
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        fake_pages = [
            {
                "content": "PDF page 1 content",
                "metadata": {
                    "filename": "doc.pdf",
                    "page_number": 1,
                    "total_pages": 1,
                    "file_type": "pdf",
                },
            }
        ]

        mock_rag = MagicMock()
        mock_rag.store_document = AsyncMock(return_value=[42])

        with (
            patch(
                "app.explore.api.v1.endpoints.documents.is_project_member",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.explore.api.v1.endpoints.documents._is_director",
                new=AsyncMock(return_value=True),
            ),
            patch("app.explore.api.v1.endpoints.documents.PDFParser") as MockParser,
            patch(
                "app.explore.api.v1.endpoints.documents.RAGService",
                return_value=mock_rag,
            ),
        ):
            MockParser.return_value.extract_text_with_metadata.return_value = fake_pages
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/documents/upload",
                files={"file": ("doc.pdf", b"%PDF-1.4 content", "application/pdf")},
                data={"project_id": "1"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["chunks_created"] == 1


class TestDocumentList:
    """GET /api/v1/documents/list"""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_no_auth_returns_401(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/documents/list")
        assert resp.status_code == 401

    def test_authenticated_returns_documents(self, mock_supabase):
        from app.explore.api.deps import get_current_user_id

        app.dependency_overrides[get_current_user_id] = _user_id_override

        # Patch the supabase chain for this specific query
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[
                {"metadata": {"filename": "report.pdf", "page_number": 1}},
                {"metadata": {"filename": "report.pdf", "page_number": 2}},
                {"metadata": {"filename": "other.pdf", "page_number": 1}},
            ]
        )
        mock_supabase.table.return_value = chain

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/documents/list",
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "documents" in body
        assert "count" in body
        # Two distinct filenames
        assert body["count"] == 2


class TestIndexText:
    """POST /api/v1/documents/knowledge/index-text (save chat text to corpus)"""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def _client_as_director(self, monkeypatch):
        import app.explore.api.v1.endpoints.documents as docs_mod
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _yes(*a, **k):
            return True

        monkeypatch.setattr(docs_mod, "is_project_member", _yes)
        monkeypatch.setattr(docs_mod, "_is_director", _yes)
        return TestClient(app, raise_server_exceptions=False)

    def _mock_no_duplicate(self, monkeypatch):
        import app.explore.api.v1.endpoints.documents as docs_mod

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_supa = MagicMock()
        mock_supa.table.return_value = chain
        monkeypatch.setattr(docs_mod, "supabase", mock_supa)
        return chain

    def test_requires_auth(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/documents/knowledge/index-text",
            json={"project_id": 1, "filename": "a.pdf", "content": "hello"},
        )
        assert resp.status_code in (401, 403)

    def test_non_director_gets_403(self, monkeypatch):
        import app.explore.api.v1.endpoints.documents as docs_mod
        from app.explore.api.deps import get_auth_context

        app.dependency_overrides[get_auth_context] = _auth_override

        async def _member(*a, **k):
            return True

        async def _not_director(*a, **k):
            return False

        monkeypatch.setattr(docs_mod, "is_project_member", _member)
        monkeypatch.setattr(docs_mod, "_is_director", _not_director)
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/documents/knowledge/index-text",
            headers={"Authorization": "Bearer test-token"},
            json={"project_id": 1, "filename": "a.pdf", "content": "hello"},
        )
        assert resp.status_code == 403

    def test_happy_path_stores_with_source_chat(self, monkeypatch):
        import app.explore.api.v1.endpoints.documents as docs_mod

        client = self._client_as_director(monkeypatch)
        self._mock_no_duplicate(monkeypatch)

        store = AsyncMock(return_value=[1, 2, 3])
        monkeypatch.setattr(docs_mod.RAGService, "store_document", store, raising=True)
        resp = client.post(
            "/api/v1/documents/knowledge/index-text",
            headers={"Authorization": "Bearer test-token"},
            json={
                "project_id": 7,
                "filename": "notes/meeting.txt",
                "content": "Meeting notes body",
            },
        )
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"indexed": True, "chunks": 3}
        kwargs = store.call_args.kwargs
        assert kwargs["source"] == "chat"
        assert kwargs["project_id"] == 7
        # Path components are stripped from the display filename.
        assert kwargs["metadata"]["filename"] == "meeting.txt"
        assert kwargs["metadata"]["content_hash"]

    def test_duplicate_hash_skips_embedding(self, monkeypatch):
        import app.explore.api.v1.endpoints.documents as docs_mod

        client = self._client_as_director(monkeypatch)
        chain = self._mock_no_duplicate(monkeypatch)
        chain.execute.return_value = MagicMock(data=[{"id": 42}])

        store = AsyncMock()
        monkeypatch.setattr(docs_mod.RAGService, "store_document", store, raising=True)
        resp = client.post(
            "/api/v1/documents/knowledge/index-text",
            headers={"Authorization": "Bearer test-token"},
            json={"project_id": 7, "filename": "a.txt", "content": "same text"},
        )
        assert resp.status_code == 200
        assert resp.json()["duplicate"] is True
        store.assert_not_called()

    def test_oversized_content_returns_413(self, monkeypatch):
        client = self._client_as_director(monkeypatch)
        self._mock_no_duplicate(monkeypatch)
        resp = client.post(
            "/api/v1/documents/knowledge/index-text",
            headers={"Authorization": "Bearer test-token"},
            json={"project_id": 7, "filename": "big.txt", "content": "x" * 2_000_001},
        )
        assert resp.status_code == 413

    def test_blank_content_rejected(self, monkeypatch):
        client = self._client_as_director(monkeypatch)
        self._mock_no_duplicate(monkeypatch)
        resp = client.post(
            "/api/v1/documents/knowledge/index-text",
            headers={"Authorization": "Bearer test-token"},
            json={"project_id": 7, "filename": "a.txt", "content": "   "},
        )
        assert resp.status_code == 400
