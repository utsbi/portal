"""Tests for app.explore.agents.tools — tool dispatch and security.

Covers:
  - execute_tool: unknown tool name returns error string, not raise
  - execute_tool: search_documents injects project_id server-side (model cannot override)
  - execute_tool: search_sbi_knowledge returns SBI text, no sources
  - execute_tool: each live-data tool calls _scoped_project_ids server-side
  - execute_tool: tool exception returns generic error string (never raises)
  - TOOLS schema: all expected tool names are present
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch


from app.explore.agents.tools import TOOLS, execute_tool


# ---------------------------------------------------------------------------
# TOOLS schema — all expected tool names present
# ---------------------------------------------------------------------------

class TestToolsSchema:
    def _tool_names(self):
        return {t["function"]["name"] for t in TOOLS}

    def test_search_documents_present(self):
        assert "search_documents" in self._tool_names()

    def test_search_sbi_knowledge_present(self):
        assert "search_sbi_knowledge" in self._tool_names()

    def test_get_lifecycle_status_present(self):
        assert "get_lifecycle_status" in self._tool_names()

    def test_get_questionnaire_status_present(self):
        assert "get_questionnaire_status" in self._tool_names()

    def test_get_reports_present(self):
        assert "get_reports" in self._tool_names()

    def test_get_finance_summary_present(self):
        assert "get_finance_summary" in self._tool_names()

    def test_get_requests_present(self):
        assert "get_requests" in self._tool_names()

    def test_get_upcoming_events_present(self):
        assert "get_upcoming_events" in self._tool_names()

    def test_create_request_present(self):
        assert "create_request" in self._tool_names()

    def test_all_tools_have_type_function(self):
        for tool in TOOLS:
            assert tool.get("type") == "function", f"Tool {tool} missing type=function"

    def test_all_tools_have_description(self):
        for tool in TOOLS:
            desc = tool.get("function", {}).get("description", "")
            assert desc, f"Tool {tool['function']['name']} has no description"


# ---------------------------------------------------------------------------
# create_request — draft-only proposal, never a write
# ---------------------------------------------------------------------------

class TestCreateRequestProposal:
    async def _run(self, args):
        return await execute_tool(
            name="create_request",
            args=args,
            client_id="uid-123",
            access_token="tok",
            project_id=1,
        )

    async def test_returns_proposal_json_and_no_sources(self):
        import json

        text, sources = await self._run(
            {"subject": "Updated schematics", "message": "Please send rev B."}
        )
        assert sources == []
        assert "NOT SUBMITTED" in text
        payload = next(
            line for line in text.splitlines() if line.startswith("PROPOSAL_JSON:")
        )
        proposal = json.loads(payload.removeprefix("PROPOSAL_JSON:"))
        assert proposal == {
            "kind": "request_proposal",
            "subject": "Updated schematics",
            "message": "Please send rev B.",
        }

    async def test_empty_subject_is_error_string(self):
        text, sources = await self._run({"subject": "  ", "message": "hi"})
        assert text.startswith("Error:")
        assert sources == []

    async def test_lengths_are_capped(self):
        import json

        text, _ = await self._run({"subject": "s" * 500, "message": "m" * 10_000})
        payload = next(
            line for line in text.splitlines() if line.startswith("PROPOSAL_JSON:")
        )
        proposal = json.loads(payload.removeprefix("PROPOSAL_JSON:"))
        assert len(proposal["subject"]) == 150
        assert len(proposal["message"]) == 4000

    async def test_no_db_client_is_built(self, monkeypatch):
        """The draft tool must never touch a database client."""
        import app.explore.agents.tools as tools_mod

        def _boom(*a, **k):
            raise AssertionError("create_request must not build a DB client")

        monkeypatch.setattr(tools_mod, "user_client", _boom)
        text, _ = await self._run({"subject": "s", "message": "m"})
        assert "PROPOSAL_JSON:" in text


# ---------------------------------------------------------------------------
# execute_tool — unknown tool
# ---------------------------------------------------------------------------

class TestExecuteToolUnknown:
    async def test_unknown_tool_returns_error_string_not_raise(self):
        result_text, sources = await execute_tool(
            name="does_not_exist",
            args={},
            client_id="uid-123",
            access_token="tok",
        )
        assert "Unknown tool" in result_text or "does_not_exist" in result_text
        assert sources == []

    async def test_unknown_tool_result_is_string(self):
        result_text, sources = await execute_tool(
            name="nonexistent_tool",
            args={"x": 1},
            client_id="uid",
            access_token="tok",
        )
        assert isinstance(result_text, str)
        assert isinstance(sources, list)


# ---------------------------------------------------------------------------
# execute_tool — search_sbi_knowledge
# ---------------------------------------------------------------------------

class TestExecuteToolSBIKnowledge:
    async def test_returns_sbi_knowledge_text(self):
        result_text, sources = await execute_tool(
            name="search_sbi_knowledge",
            args={"query": "What is SBI?"},
            client_id="uid",
            access_token="tok",
        )
        # SBI_KNOWLEDGE is the static text loaded from sbi.md
        assert isinstance(result_text, str)
        assert len(result_text) > 0
        assert sources == []

    async def test_empty_query_still_returns_text(self):
        result_text, sources = await execute_tool(
            name="search_sbi_knowledge",
            args={"query": ""},
            client_id="uid",
            access_token="tok",
        )
        assert isinstance(result_text, str)
        assert sources == []


# ---------------------------------------------------------------------------
# execute_tool — search_documents server-side scoping
# ---------------------------------------------------------------------------

class TestExecuteToolSearchDocuments:
    async def test_project_id_is_scoped_server_side(self):
        """The model cannot inject its own project_id; scoping is server-side."""
        captured_args = {}

        async def _fake_scoped_ids(db, client_id, project_id):
            captured_args["client_id"] = client_id
            captured_args["project_id"] = project_id
            return [project_id] if project_id else []

        async def _fake_search_docs(query, project_ids, client_id, strict=False):
            return "context text", [{"filename": "doc.pdf", "page_number": 1, "content": "x", "relevance_score": 0.9}]

        with (
            patch("app.explore.agents.tools.user_client", return_value=MagicMock()),
            patch("app.explore.agents.tools._scoped_project_ids", new=AsyncMock(side_effect=_fake_scoped_ids)),
            patch("app.explore.agents.tools._search_documents", new=AsyncMock(side_effect=_fake_search_docs)),
        ):
            result_text, sources = await execute_tool(
                name="search_documents",
                args={"query": "roof spec"},
                client_id="uid-abc",
                access_token="tok",
                project_id=7,
            )

        # Confirm that scoping used client_id and project_id from the server context
        assert captured_args["client_id"] == "uid-abc"
        assert captured_args["project_id"] == 7

    async def test_model_cannot_override_project_id_via_args(self):
        """Even if the model sneaks a project_id into args, scoping still uses
        the server-side project_id parameter, not anything from args."""
        captured_scope = {}

        async def _fake_scoped_ids(db, client_id, project_id):
            captured_scope["project_id_used"] = project_id
            return []

        async def _fake_search_docs(query, project_ids, client_id, strict=False):
            return "no docs", []

        with (
            patch("app.explore.agents.tools.user_client", return_value=MagicMock()),
            patch("app.explore.agents.tools._scoped_project_ids", new=AsyncMock(side_effect=_fake_scoped_ids)),
            patch("app.explore.agents.tools._search_documents", new=AsyncMock(side_effect=_fake_search_docs)),
        ):
            await execute_tool(
                name="search_documents",
                args={"query": "docs", "project_id": 999},  # model tries to inject
                client_id="uid",
                access_token="tok",
                project_id=5,  # server-side authoritative value
            )

        # The server-side project_id (5) must be used, not 999 from args
        assert captured_scope["project_id_used"] == 5


# ---------------------------------------------------------------------------
# execute_tool — live-data tools use _scoped_project_ids
# ---------------------------------------------------------------------------

class TestExecuteToolLiveData:
    """Verify that live-data tools resolve project scope server-side."""

    async def _run_tool_with_scoped_mock(self, tool_name: str):
        captured = {}

        async def _fake_scoped_ids(db, client_id, project_id):
            captured["called"] = True
            captured["client_id"] = client_id
            return []  # empty → no data message

        with (
            patch("app.explore.agents.tools.user_client", return_value=MagicMock()),
            patch("app.explore.agents.tools._scoped_project_ids", new=AsyncMock(side_effect=_fake_scoped_ids)),
        ):
            result_text, sources = await execute_tool(
                name=tool_name,
                args={},
                client_id="uid-live",
                access_token="tok",
                project_id=None,
            )

        return result_text, sources, captured

    async def test_lifecycle_uses_scoped_project_ids(self):
        result, sources, captured = await self._run_tool_with_scoped_mock("get_lifecycle_status")
        assert captured.get("called") is True
        assert captured["client_id"] == "uid-live"
        assert "no project" in result.lower() or "no" in result.lower()

    async def test_questionnaire_uses_scoped_project_ids(self):
        result, sources, captured = await self._run_tool_with_scoped_mock("get_questionnaire_status")
        assert captured.get("called") is True

    async def test_reports_uses_scoped_project_ids(self):
        result, sources, captured = await self._run_tool_with_scoped_mock("get_reports")
        assert captured.get("called") is True

    async def test_finance_uses_scoped_project_ids(self):
        result, sources, captured = await self._run_tool_with_scoped_mock("get_finance_summary")
        assert captured.get("called") is True

    async def test_requests_uses_scoped_project_ids(self):
        result, sources, captured = await self._run_tool_with_scoped_mock("get_requests")
        assert captured.get("called") is True


# ---------------------------------------------------------------------------
# execute_tool — get_upcoming_events (proxies the frontend calendar route)
# ---------------------------------------------------------------------------


class _FakeResp:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Minimal async-context-manager stand-in for httpx.AsyncClient."""

    def __init__(self, resp, captured):
        self._resp = resp
        self._captured = captured

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None, headers=None):
        self._captured["url"] = url
        self._captured["params"] = params
        self._captured["headers"] = headers or {}
        return self._resp


class TestExecuteToolUpcomingEvents:
    async def _run(self, *, scoped, project_id, resp, captured):
        with (
            patch("app.explore.agents.tools.user_client", return_value=MagicMock()),
            patch(
                "app.explore.agents.tools._scoped_project_ids",
                new=AsyncMock(return_value=scoped),
            ),
            patch(
                "app.explore.agents.tools.httpx.AsyncClient",
                return_value=_FakeAsyncClient(resp, captured),
            ),
        ):
            return await execute_tool(
                name="get_upcoming_events",
                args={},
                client_id="uid-cal",
                access_token="jwt-abc",
                project_id=project_id,
            )

    async def test_no_project_short_circuits_without_http(self):
        captured = {}
        text, sources = await self._run(
            scoped=[], project_id=None, resp=_FakeResp(), captured=captured
        )
        assert "no project" in text.lower()
        assert sources == []
        assert captured == {}  # never hit the network

    async def test_multiple_projects_no_active_asks_which(self):
        captured = {}
        text, _ = await self._run(
            scoped=[1, 2], project_id=None, resp=_FakeResp(), captured=captured
        )
        assert "multiple projects" in text.lower()
        assert captured == {}

    async def test_happy_path_formats_events_and_forwards_jwt(self):
        captured = {}
        payload = {
            "ok": True,
            "events": [
                {
                    "title": "Design review",
                    "start": "2099-01-15T10:00:00Z",
                    "location": "Room 4",
                    "myResponse": "accepted",
                },
                {  # already-passed event must be filtered out
                    "title": "Old kickoff",
                    "start": "2000-01-01T09:00:00Z",
                },
            ],
        }
        text, sources = await self._run(
            scoped=[7],
            project_id=7,
            resp=_FakeResp(payload=payload),
            captured=captured,
        )
        assert sources == []
        assert "Design review" in text
        assert "Jan 15, 2099" in text
        assert "Room 4" in text
        assert "accepted" in text
        assert "Old kickoff" not in text  # past event dropped
        # The caller's JWT is forwarded as a bearer token, scoped to their project.
        assert captured["headers"].get("Authorization") == "Bearer jwt-abc"
        assert captured["params"] == {"project_id": 7}

    async def test_empty_calendar_returns_friendly_message(self):
        captured = {}
        text, _ = await self._run(
            scoped=[7],
            project_id=7,
            resp=_FakeResp(payload={"ok": True, "events": []}),
            captured=captured,
        )
        assert "no upcoming events" in text.lower()

    async def test_forbidden_status_is_access_message(self):
        captured = {}
        text, _ = await self._run(
            scoped=[7],
            project_id=7,
            resp=_FakeResp(status_code=403, text="forbidden"),
            captured=captured,
        )
        assert "do not have access" in text.lower()


# ---------------------------------------------------------------------------
# execute_tool — exception handling
# ---------------------------------------------------------------------------

class TestExecuteToolExceptionHandling:
    async def test_tool_exception_returns_error_string_not_raise(self):
        """If a tool's internal function raises, execute_tool must return an error
        string and an empty sources list, never propagate the exception."""

        async def _exploding_tool(db, client_id, project_id):
            raise RuntimeError("database connection lost")

        with (
            patch("app.explore.agents.tools.user_client", return_value=MagicMock()),
            patch(
                "app.explore.agents.tools._get_lifecycle_status",
                new=AsyncMock(side_effect=RuntimeError("db error")),
            ),
            patch(
                "app.explore.agents.tools._scoped_project_ids",
                new=AsyncMock(return_value=[1]),
            ),
        ):
            result_text, sources = await execute_tool(
                name="get_lifecycle_status",
                args={},
                client_id="uid",
                access_token="tok",
            )

        assert isinstance(result_text, str)
        assert "error" in result_text.lower() or "encountered" in result_text.lower()
        assert sources == []

    async def test_error_message_does_not_leak_exception_details(self):
        """The returned error string must be generic, not contain the raw exception."""
        with (
            patch("app.explore.agents.tools.user_client", return_value=MagicMock()),
            patch(
                "app.explore.agents.tools._get_reports",
                new=AsyncMock(side_effect=RuntimeError("SECRET_DB_CREDENTIALS_HERE")),
            ),
            patch(
                "app.explore.agents.tools._scoped_project_ids",
                new=AsyncMock(return_value=[1]),
            ),
        ):
            result_text, _ = await execute_tool(
                name="get_reports",
                args={},
                client_id="uid",
                access_token="tok",
            )

        assert "SECRET_DB_CREDENTIALS_HERE" not in result_text


