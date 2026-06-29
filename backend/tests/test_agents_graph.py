"""Tests for app.explore.agents.graph — run_graph_streaming.

Covers:
  - Title task created only on first turn (no history), not on subsequent turns
  - MAX_TOOL_ITERATIONS constant is 4
  - Attachment injection: text appears in model context, per-file cap enforced,
    empty attachments leave context unchanged
  - Streaming loop: emits phase/delta/result events in a no-tool scenario (mocked LLM)
  - MAX_TOOL_ITERATIONS caps the loop when tool calls are always returned

These tests use heavy mocking of the OpenAI streaming client.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch


from app.explore.agents.graph import MAX_TOOL_ITERATIONS, run_graph_streaming


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

def test_max_tool_iterations_is_4():
    assert MAX_TOOL_ITERATIONS == 4


# ---------------------------------------------------------------------------
# Helpers to build fake streaming chunks
# ---------------------------------------------------------------------------

def _make_delta(content=None, tool_calls=None, reasoning=None):
    delta = MagicMock()
    delta.content = content
    delta.tool_calls = tool_calls or []
    if reasoning is not None:
        delta.reasoning = reasoning
    else:
        # getattr fallback to None
        delta.reasoning = None
    return delta


def _make_chunk(content=None, tool_calls=None):
    chunk = MagicMock()
    choice = MagicMock()
    choice.delta = _make_delta(content=content, tool_calls=tool_calls)
    chunk.choices = [choice]
    return chunk


class _FakeStream:
    """Async context-manager that yields a fixed list of chunks."""

    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._chunks:
            raise StopAsyncIteration
        return self._chunks.pop(0)


# ---------------------------------------------------------------------------
# Title task creation
# ---------------------------------------------------------------------------

    # graph.py uses lazy imports inside run_graph_streaming:
    #   from app.explore.agents.nodes import openrouter_client, generate_title, ...
    #   from app.explore.agents.tools import TOOLS, execute_tool
    #   from app.explore.db.supabase import user_client
    #   from app.explore.services.membership import get_project_context
    # So patch the names at their source modules.

_PATCHES = dict(
    get_project_context="app.explore.services.membership.get_project_context",
    user_client="app.explore.db.supabase.user_client",
    openrouter_client="app.explore.agents.nodes.openrouter_client",
    generate_title="app.explore.agents.nodes.generate_title",
    execute_tool="app.explore.agents.tools.execute_tool",
)


class TestTitleTaskCreation:
    async def test_title_task_created_on_first_turn(self):
        """When history is empty (first turn), generate_title must be called."""

        async def _no_tool_stream(**kwargs):
            async def _inner():
                yield _make_chunk(content="Hello!")
            return _inner()

        mock_title = AsyncMock(return_value="Test Title")
        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=mock_title),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_no_tool_stream)

            events = []
            async for event in run_graph_streaming(
                query="hello",
                client_id="uid-123",
                access_token="tok",
                history=[],
            ):
                events.append(event)

        mock_title.assert_called_once()

    async def test_title_task_not_created_on_subsequent_turns(self):
        """When history is non-empty (subsequent turn), generate_title must NOT be called."""

        async def _no_tool_stream(**kwargs):
            async def _inner():
                yield _make_chunk(content="Follow-up answer.")
            return _inner()

        mock_title = AsyncMock(return_value="Should Not Be Called")
        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=mock_title),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_no_tool_stream)

            events = []
            async for event in run_graph_streaming(
                query="follow up question",
                client_id="uid-123",
                access_token="tok",
                history=[
                    {"role": "user", "content": "previous question"},
                    {"role": "assistant", "content": "previous answer"},
                ],
            ):
                events.append(event)

        mock_title.assert_not_called()


# ---------------------------------------------------------------------------
# Streaming event contract
# ---------------------------------------------------------------------------

class TestStreamingEventContract:
    async def test_no_tool_query_emits_phase_delta_result(self):
        """A simple query with no tool calls must emit phase, delta, result events."""

        async def _stream(**kwargs):
            async def _inner():
                yield _make_chunk(content="The answer is 42.")
            return _inner()

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="Test")),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_stream)

            events = []
            async for event in run_graph_streaming(
                query="What is the answer?",
                client_id="uid",
                access_token="tok",
                history=[],
            ):
                events.append(event)

        types = [e.get("type") for e in events]
        assert "phase" in types
        assert "delta" in types
        assert "result" in types

    async def test_result_event_contains_answer(self):
        async def _stream(**kwargs):
            async def _inner():
                yield _make_chunk(content="Forty-two.")
            return _inner()

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="T")),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_stream)

            events = []
            async for event in run_graph_streaming(
                query="answer?", client_id="uid", access_token="tok", history=[]
            ):
                events.append(event)

        result_events = [e for e in events if e.get("type") == "result"]
        assert result_events
        assert "Forty-two." in result_events[0]["answer"]

    async def test_title_event_emitted_on_first_turn(self):
        async def _stream(**kwargs):
            async def _inner():
                yield _make_chunk(content="Here is info.")
            return _inner()

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="My Generated Title")),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_stream)

            events = []
            async for event in run_graph_streaming(
                query="tell me about SBI", client_id="uid", access_token="tok", history=[]
            ):
                events.append(event)

        title_events = [e for e in events if e.get("type") == "title"]
        assert title_events
        assert title_events[0]["title"] == "My Generated Title"


# ---------------------------------------------------------------------------
# MAX_TOOL_ITERATIONS cap
# ---------------------------------------------------------------------------

class TestMaxToolIterations:
    async def test_tool_loop_is_capped_at_max_iterations(self):
        """When the model always requests tools, the loop must stop after MAX_TOOL_ITERATIONS."""
        call_count = [0]

        def _make_tool_call_chunk():
            tc = MagicMock()
            tc.index = 0
            tc.id = "call_0"
            fn = MagicMock()
            fn.name = "search_sbi_knowledge"
            fn.arguments = '{"query": "test"}'
            tc.function = fn
            return tc

        async def _tool_stream(**kwargs):
            call_count[0] += 1
            async def _inner():
                chunk = MagicMock()
                choice = MagicMock()
                delta = MagicMock()
                delta.content = None
                delta.reasoning = None
                delta.tool_calls = [_make_tool_call_chunk()]
                choice.delta = delta
                chunk.choices = [choice]
                yield chunk
            return _inner()

        async def _fake_execute_tool(name, args, client_id, access_token, project_id=None):
            return "tool result text", []

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="T")),
            patch(_PATCHES["execute_tool"], new=AsyncMock(side_effect=_fake_execute_tool)),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_tool_stream)

            events = []
            async for event in run_graph_streaming(
                query="keep calling tools",
                client_id="uid",
                access_token="tok",
                history=[],
            ):
                events.append(event)

        # The tool-calling loop runs at most MAX_TOOL_ITERATIONS times.
        # After exhausting iterations, a final tool-free generation may run (one more call).
        assert call_count[0] <= MAX_TOOL_ITERATIONS + 1

    async def test_tool_call_events_emitted(self):
        """tool_call and tool_result events must be emitted when a tool is called."""
        tool_called = [False]

        async def _first_call_tools_then_answer(**kwargs):
            if not tool_called[0]:
                tool_called[0] = True
                async def _inner():
                    chunk = MagicMock()
                    choice = MagicMock()
                    delta = MagicMock()
                    delta.content = None
                    delta.reasoning = None
                    tc = MagicMock()
                    tc.index = 0
                    tc.id = "call_abc"
                    fn = MagicMock()
                    fn.name = "search_sbi_knowledge"
                    fn.arguments = '{"query": "SBI mission"}'
                    tc.function = fn
                    delta.tool_calls = [tc]
                    choice.delta = delta
                    chunk.choices = [choice]
                    yield chunk
                return _inner()
            else:
                async def _answer():
                    yield _make_chunk(content="SBI is a sustainable building org.")
                return _answer()

        async def _fake_execute_tool(name, args, client_id, access_token, project_id=None):
            return "SBI knowledge text", []

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="T")),
            patch(_PATCHES["execute_tool"], new=AsyncMock(side_effect=_fake_execute_tool)),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(
                side_effect=_first_call_tools_then_answer
            )

            events = []
            async for event in run_graph_streaming(
                query="What is SBI?",
                client_id="uid",
                access_token="tok",
                history=[],
            ):
                events.append(event)

        types = [e.get("type") for e in events]
        assert "tool_call" in types
        assert "tool_result" in types


# ---------------------------------------------------------------------------
# Attachment injection into model context
# ---------------------------------------------------------------------------

class TestAttachmentInjection:
    """Attachment content must be injected into the messages sent to the model."""

    async def test_attachment_text_appears_in_model_context(self):
        """Known attachment text must be present in the messages list on the first call."""
        captured_messages: list = []

        async def _capturing_stream(**kwargs):
            if not captured_messages:
                captured_messages.extend(kwargs.get("messages", []))
            async def _inner():
                yield _make_chunk(content="Based on the document, the budget is $1.5M.")
            return _inner()

        attachments = [
            {
                "filename": "report.pdf",
                "content": "Project budget is $1.5M",
                "file_type": "pdf",
            }
        ]

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="T")),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_capturing_stream)

            events = []
            async for event in run_graph_streaming(
                query="What is the budget?",
                client_id="uid",
                access_token="tok",
                history=[],
                attachments=attachments,
            ):
                events.append(event)

        combined = " ".join(
            m["content"] for m in captured_messages if isinstance(m.get("content"), str)
        )
        assert "Project budget is $1.5M" in combined
        assert "report.pdf" in combined

    async def test_attachment_text_truncated_to_per_file_cap(self):
        """Attachment content exceeding _ATTACHMENT_CHARS_PER_FILE must be truncated."""
        from app.explore.agents.graph import _ATTACHMENT_CHARS_PER_FILE

        captured_messages: list = []

        async def _capturing_stream(**kwargs):
            if not captured_messages:
                captured_messages.extend(kwargs.get("messages", []))
            async def _inner():
                yield _make_chunk(content="Answer.")
            return _inner()

        oversized_content = "A" * (_ATTACHMENT_CHARS_PER_FILE + 5_000)
        attachments = [
            {"filename": "big.pdf", "content": oversized_content, "file_type": "pdf"}
        ]

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="T")),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_capturing_stream)

            events = []
            async for event in run_graph_streaming(
                query="summarize",
                client_id="uid",
                access_token="tok",
                history=[],
                attachments=attachments,
            ):
                events.append(event)

        combined = " ".join(
            m["content"] for m in captured_messages if isinstance(m.get("content"), str)
        )
        # The oversized original must not appear verbatim
        assert oversized_content not in combined
        # But the file must still contribute content up to the cap
        assert "A" * 100 in combined

    async def test_no_attachments_leaves_context_unchanged(self):
        """When no attachments are provided, no attachment system block must appear."""
        captured_messages: list = []

        async def _capturing_stream(**kwargs):
            if not captured_messages:
                captured_messages.extend(kwargs.get("messages", []))
            async def _inner():
                yield _make_chunk(content="No attachments here.")
            return _inner()

        with (
            patch(_PATCHES["get_project_context"], new=AsyncMock(return_value=None)),
            patch(_PATCHES["user_client"], return_value=MagicMock()),
            patch(_PATCHES["generate_title"], new=AsyncMock(return_value="T")),
            patch(_PATCHES["openrouter_client"]) as mock_client,
        ):
            mock_client.chat.completions.create = AsyncMock(side_effect=_capturing_stream)

            events = []
            async for event in run_graph_streaming(
                query="What is SBI?",
                client_id="uid",
                access_token="tok",
                history=[],
                attachments=[],
            ):
                events.append(event)

        for m in captured_messages:
            content = m.get("content") or ""
            assert "User-attached documents" not in content
