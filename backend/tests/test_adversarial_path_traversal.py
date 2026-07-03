"""Adversarial tests for storage path traversal in /documents/knowledge/index-file
and server-side project scoping.

REQUIREMENT derived first: ``index-file`` builds the storage object key as
``f"{project_id}/{storage_path}"`` and downloads it via the service-role storage
client. ``storage_path`` is attacker-controlled. The director+membership gate
only proves the caller belongs to ``project_id`` — it does NOT constrain
``storage_path`` to stay inside that project's prefix. A ``storage_path`` of
``../{other}/file`` resolves to another project's prefix, so a director of
project A can read/index/delete objects under project B's prefix. The handler
MUST reject any ``storage_path`` containing traversal sequences, leading slashes,
or null bytes BEFORE touching storage.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import app.explore.api.deps as deps_mod
import app.explore.api.v1.endpoints.documents as docs_mod
from app.explore.main import app


@pytest.fixture()
def director_client(monkeypatch):
    """TestClient where the caller is an authenticated director AND member of any
    project, so we isolate the path-handling logic (not the authz gate)."""
    user = MagicMock()
    user.id = "test-user-uuid-1234"
    mock_supa = MagicMock()
    mock_supa.auth.get_user = MagicMock(return_value=MagicMock(user=user))
    monkeypatch.setattr(deps_mod, "supabase", mock_supa)

    async def _yes_member(db, uid, pid):
        return True

    async def _yes_director(db, uid):
        return True

    monkeypatch.setattr(docs_mod, "is_project_member", _yes_member)
    monkeypatch.setattr(docs_mod, "_is_director", _yes_director)
    return TestClient(app, raise_server_exceptions=False)


def _spy_storage(monkeypatch):
    """Replace the storage download with a spy that records the requested key and
    returns harmless bytes; return the capture dict."""
    captured = {"path": None}

    def _download(path):
        captured["path"] = path
        return b"%PDF-1.4 harmless"

    storage_obj = MagicMock()
    storage_obj.download = MagicMock(side_effect=_download)
    monkeypatch.setattr(docs_mod.supabase.storage, "from_", lambda *_: storage_obj)
    return captured


class TestIndexFilePathTraversal:
    @pytest.mark.parametrize(
        "evil_path",
        [
            "../6/secret.pdf",       # climb into another project's prefix
            "../../etc/passwd.pdf",  # climb out entirely
            "a/../../b.pdf",         # mid-path traversal
        ],
    )
    def test_traversal_path_rejected_before_download(
        self, director_client, monkeypatch, evil_path
    ):
        captured = _spy_storage(monkeypatch)
        resp = director_client.post(
            "/api/v1/documents/knowledge/index-file",
            headers={"Authorization": "Bearer t"},
            json={"project_id": 5, "storage_path": evil_path},
        )
        # Correct behavior: reject the traversal as a bad request (4xx) and never
        # call download with a path that escapes the project prefix.
        assert resp.status_code in (400, 422), resp.text
        assert ".." not in (captured["path"] or ""), (
            f"download() was called with an escaping key: {captured['path']!r}"
        )

    def test_leading_slash_rejected(self, director_client, monkeypatch):
        _spy_storage(monkeypatch)  # neutralize storage I/O
        resp = director_client.post(
            "/api/v1/documents/knowledge/index-file",
            headers={"Authorization": "Bearer t"},
            json={"project_id": 5, "storage_path": "/etc/passwd.pdf"},
        )
        assert resp.status_code in (400, 422), resp.text

    def test_null_byte_rejected(self, director_client, monkeypatch):
        _spy_storage(monkeypatch)  # neutralize storage I/O
        resp = director_client.post(
            "/api/v1/documents/knowledge/index-file",
            headers={"Authorization": "Bearer t"},
            json={"project_id": 5, "storage_path": "ok.pdf\x00.png"},
        )
        assert resp.status_code in (400, 422), resp.text


class TestMoveFilePathTraversal:
    """move-file takes TWO client-controlled paths; each must pass the same
    guard as index-file or one side of the move could address another
    project's client_knowledge rows."""

    @pytest.mark.parametrize(
        "from_path,to_path",
        [
            ("../6/secret.pdf", "ok.pdf"),        # escaping source
            ("ok.pdf", "../6/stolen.pdf"),        # escaping destination
            ("/etc/passwd.pdf", "ok.pdf"),        # absolute source
            ("ok.pdf", "a/../../b.pdf"),          # mid-path traversal dest
            ("ok.pdf", "bad\x00.pdf"),            # null byte dest
        ],
    )
    def test_traversal_rejected_before_rpc(
        self, director_client, monkeypatch, from_path, to_path
    ):
        rpc_spy = MagicMock()
        monkeypatch.setattr(docs_mod.supabase, "rpc", rpc_spy)
        resp = director_client.post(
            "/api/v1/documents/knowledge/move-file",
            headers={"Authorization": "Bearer t"},
            json={"project_id": 5, "from_path": from_path, "to_path": to_path},
        )
        assert resp.status_code in (400, 422), resp.text
        rpc_spy.assert_not_called()

    def test_valid_move_calls_rpc_with_expected_params(
        self, director_client, monkeypatch
    ):
        rpc_chain = MagicMock()
        rpc_chain.execute.return_value = MagicMock(data=3)
        rpc_spy = MagicMock(return_value=rpc_chain)
        monkeypatch.setattr(docs_mod.supabase, "rpc", rpc_spy)

        resp = director_client.post(
            "/api/v1/documents/knowledge/move-file",
            headers={"Authorization": "Bearer t"},
            json={
                "project_id": 5,
                "from_path": "Media/old.pdf",
                "to_path": "Archive/new.pdf",
            },
        )
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"moved": 3}
        rpc_spy.assert_called_once_with(
            "move_client_knowledge_file",
            {
                "_project_id": 5,
                "_from_path": "Media/old.pdf",
                "_to_path": "Archive/new.pdf",
            },
        )


class TestScopedProjectIds:
    """Server-side scoping: a client-supplied project_id the caller is NOT a
    member of must yield [] (no data), never widen access."""

    async def test_non_member_project_id_yields_empty(self, monkeypatch):
        from app.explore.services import membership

        async def _member_of_only_1(db, client_id):
            return [1]

        monkeypatch.setattr(membership, "caller_project_ids", _member_of_only_1)
        # Caller is a member of project 1 only; asks for project 999.
        result = await membership.scoped_project_ids(MagicMock(), "uid", 999)
        assert result == [], "spoofed non-member project_id must yield no scope"

    async def test_negative_project_id_yields_empty(self, monkeypatch):
        from app.explore.services import membership

        async def _member_of_only_1(db, client_id):
            return [1]

        monkeypatch.setattr(membership, "caller_project_ids", _member_of_only_1)
        assert await membership.scoped_project_ids(MagicMock(), "uid", -1) == []

    async def test_huge_project_id_yields_empty(self, monkeypatch):
        from app.explore.services import membership

        async def _member_of_only_1(db, client_id):
            return [1]

        monkeypatch.setattr(membership, "caller_project_ids", _member_of_only_1)
        huge = 10**18
        assert await membership.scoped_project_ids(MagicMock(), "uid", huge) == []

    async def test_member_project_id_is_narrowed_to_exactly_that_project(
        self, monkeypatch
    ):
        from app.explore.services import membership

        async def _member_of_many(db, client_id):
            return [1, 2, 3]

        monkeypatch.setattr(membership, "caller_project_ids", _member_of_many)
        # Asking for a project the caller IS in must narrow to just that one.
        assert await membership.scoped_project_ids(MagicMock(), "uid", 2) == [2]

    async def test_blank_client_id_yields_empty(self, monkeypatch):
        """A blank client_id must never resolve to any project scope."""
        from app.explore.services import membership

        assert await membership.scoped_project_ids(MagicMock(), "", 1) == []
        assert await membership.scoped_project_ids(MagicMock(), "   ", None) == []
