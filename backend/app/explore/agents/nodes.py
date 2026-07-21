import logging
from typing import Any, Dict, List

from openai import AsyncOpenAI

from app.explore.core.config import settings
from app.explore.agents.prompts import TITLE_GENERATOR_PROMPT
from app.explore.services.rag_service import RAGService

logger = logging.getLogger(__name__)


rag_service = RAGService()
openrouter_client = AsyncOpenAI(
    api_key=settings.api_key,
    base_url="https://openrouter.ai/api/v1",
)


def format_history(history: List[Dict[str, str]]) -> str:
    """Format conversation history for prompts."""
    if not history:
        return "No previous conversation."

    formatted = []
    for msg in history[-5:]:
        role = msg.get("role", "user").capitalize()
        content = msg.get("content", "")
        formatted.append(f"{role}: {content}")

    return "\n".join(formatted)


def _fallback_title(query: str, max_len: int = 60) -> str:
    """Deterministic title fallback: first line of the query, trimmed to max_len."""
    first_line = (query or "").strip().splitlines()[0] if query.strip() else ""
    first_line = first_line.strip() or "New Conversation"
    if len(first_line) > max_len:
        first_line = first_line[: max_len - 1].rstrip() + "…"  # ellipsis
    return first_line


async def generate_title(query: str) -> str:
    """Generate a concise conversation title from the first user message.

    Best-effort: uses ``FAST_MODEL`` for a short, descriptive title and falls
    back to a trimmed slice of the query if the LLM call fails or returns empty,
    so titling never blocks or breaks a chat turn.
    """
    if not query or not query.strip():
        return _fallback_title(query)

    try:
        title_prompt = TITLE_GENERATOR_PROMPT.format(query=query.strip()[:2000])
        response = await openrouter_client.chat.completions.create(
            model=settings.title_model,
            messages=[{"role": "user", "content": title_prompt}],
        )
        title = (response.choices[0].message.content or "").strip()
        # Strip stray wrapping quotes the model may add despite instructions.
        title = title.strip('"').strip("'").strip()
        if title:
            # Keep titles short even if the model ignores the word limit.
            return title if len(title) <= 80 else title[:79].rstrip() + "…"
        logger.warning("Title generator returned empty, using fallback")
    except Exception as e:
        logger.warning(f"Title generation failed, using fallback: {e}")

    return _fallback_title(query)


def _format_sources_list(sources: List[Dict[str, Any]]) -> str:
    """Render the sources list for the generation prompt with [n] markers.

    Order matches state['sources'] exactly so the model's [n] citations and the
    frontend's chip mapping align.
    """
    if not sources:
        return "(no sources available - do not emit citation markers)"
    lines = []
    for i, s in enumerate(sources, start=1):
        filename = s.get("filename", "unknown")
        page = s.get("page_number")
        preview = (s.get("content") or "")[:150].replace("\n", " ").strip()
        suffix = f" (p. {page})" if page else ""
        lines.append(f'[{i}] {filename}{suffix}: "{preview}..."')
    return "\n".join(lines)
