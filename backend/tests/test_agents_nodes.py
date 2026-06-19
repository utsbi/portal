"""Tests for app.explore.agents.nodes.

Covers:
  - _fallback_title: first line trimmed to max_len, ellipsis added, empty query
  - generate_title: uses settings.title_model for the LLM call
  - generate_title: falls back to _fallback_title when LLM call raises
  - generate_title: falls back when LLM returns empty string
  - generate_title: strips wrapping quotes from LLM response
  - generate_title: caps length at 80 characters with ellipsis
  - generate_title: empty/blank query returns fallback without calling LLM
  - title_model: falls back to fast_model when TITLE_MODEL env var is unset
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch


import app.explore.agents.nodes as nodes_module
from app.explore.agents.nodes import _fallback_title, generate_title


# ---------------------------------------------------------------------------
# _fallback_title
# ---------------------------------------------------------------------------

class TestFallbackTitle:
    def test_returns_first_line(self):
        result = _fallback_title("What is the roof R-value?\nMore text here.")
        assert result == "What is the roof R-value?"

    def test_truncates_long_query_with_ellipsis(self):
        long_query = "A" * 100
        result = _fallback_title(long_query, max_len=60)
        assert len(result) <= 60
        assert result.endswith("…")

    def test_short_query_not_truncated(self):
        result = _fallback_title("Short question", max_len=60)
        assert result == "Short question"

    def test_empty_query_returns_new_conversation(self):
        result = _fallback_title("")
        assert result == "New Conversation"

    def test_whitespace_only_returns_new_conversation(self):
        result = _fallback_title("   ")
        assert result == "New Conversation"

    def test_exactly_max_len_not_truncated(self):
        query = "A" * 60
        result = _fallback_title(query, max_len=60)
        assert result == query
        assert not result.endswith("…")

    def test_one_over_max_len_truncated(self):
        query = "A" * 61
        result = _fallback_title(query, max_len=60)
        assert len(result) == 60
        assert result.endswith("…")


# ---------------------------------------------------------------------------
# generate_title — LLM success path
# ---------------------------------------------------------------------------

class TestGenerateTitle:
    def _mock_llm_response(self, content: str) -> MagicMock:
        choice = MagicMock()
        choice.message.content = content
        response = MagicMock()
        response.choices = [choice]
        return response

    async def test_uses_title_model_setting(self):
        """generate_title must pass settings.title_model to the completions call."""
        from app.explore.core.config import settings

        mock_response = self._mock_llm_response("Roof Insulation Review")

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=mock_response),
        ) as mock_create:
            result = await generate_title("What is the roof insulation spec?")

        assert result == "Roof Insulation Review"
        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["model"] == settings.title_model

    async def test_strips_wrapping_double_quotes(self):
        mock_response = self._mock_llm_response('"Project Status Overview"')

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await generate_title("How is my project going?")

        assert result == "Project Status Overview"
        assert not result.startswith('"')
        assert not result.endswith('"')

    async def test_strips_wrapping_single_quotes(self):
        mock_response = self._mock_llm_response("'Budget Summary'")

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await generate_title("What is the budget?")

        assert result == "Budget Summary"

    async def test_caps_title_at_80_chars_with_ellipsis(self):
        long_title = "A Very Extremely Long Title That Goes Way Beyond The Allowed Maximum Characters Limit"
        assert len(long_title) > 80
        mock_response = self._mock_llm_response(long_title)

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await generate_title("A very long question here")

        assert len(result) <= 80
        assert result.endswith("…")

    async def test_short_title_not_truncated(self):
        mock_response = self._mock_llm_response("Short Title")

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await generate_title("quick question")

        assert result == "Short Title"


# ---------------------------------------------------------------------------
# generate_title — fallback paths
# ---------------------------------------------------------------------------

class TestGenerateTitleFallback:
    async def test_llm_exception_returns_fallback(self):
        """When the LLM call raises, _fallback_title must be returned."""
        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(side_effect=Exception("network error")),
        ):
            result = await generate_title("What is my project status?")

        # Should return first line of the query as fallback
        assert "What is my project status?" in result or result == "What is my project status?"

    async def test_llm_returns_empty_string_uses_fallback(self):
        choice = MagicMock()
        choice.message.content = ""
        response = MagicMock()
        response.choices = [choice]

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=response),
        ):
            result = await generate_title("Tell me about the roof")

        # Must fall back to the query text
        assert result == "Tell me about the roof"

    async def test_llm_returns_none_content_uses_fallback(self):
        choice = MagicMock()
        choice.message.content = None
        response = MagicMock()
        response.choices = [choice]

        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(return_value=response),
        ):
            result = await generate_title("Hello")

        assert result == "Hello"

    async def test_empty_query_skips_llm_and_uses_fallback(self):
        """An empty query must not call the LLM at all."""
        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(),
        ) as mock_create:
            result = await generate_title("")

        mock_create.assert_not_called()
        assert result == "New Conversation"

    async def test_blank_query_skips_llm(self):
        with patch.object(
            nodes_module.openrouter_client.chat.completions,
            "create",
            new=AsyncMock(),
        ) as mock_create:
            result = await generate_title("   ")

        mock_create.assert_not_called()
        assert result == "New Conversation"


# ---------------------------------------------------------------------------
# title_model setting — falls back to fast_model when TITLE_MODEL is unset
# ---------------------------------------------------------------------------

class TestTitleModelSetting:
    def test_title_model_equals_fast_model_when_title_model_env_unset(self):
        """When TITLE_MODEL is not set, settings.title_model == settings.fast_model."""
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            FAST_MODEL="openai/gpt-4o-mini",
            TITLE_MODEL=None,
        )
        assert s.title_model == "openai/gpt-4o-mini"
        assert s.title_model == s.fast_model

    def test_title_model_uses_own_value_when_set(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            FAST_MODEL="openai/gpt-4o-mini",
            TITLE_MODEL="openai/gpt-4o-nano",
        )
        assert s.title_model == "openai/gpt-4o-nano"
        assert s.title_model != s.fast_model
