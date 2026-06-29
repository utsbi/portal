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

    def test_all_tools_have_type_function(self):
        for tool in TOOLS:
            assert tool.get("type") == "function", f"Tool {tool} missing type=function"

    def test_all_tools_have_description(self):
        for tool in TOOLS:
            desc = tool.get("function", {}).get("description", "")
            assert desc, f"Tool {tool['function']['name']} has no description"


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


