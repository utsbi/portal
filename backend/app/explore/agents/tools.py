"""Tool definitions and dispatch for the Explore agent tool-calling loop.

Exposes two tools to the model:
  - ``search_documents`` — RAG over the client's uploaded project documents.
  - ``search_sbi_knowledge`` — curated org knowledge about SBI and the portal.

``TOOLS`` is the OpenAI function-calling schema list passed to the chat
completion. ``execute_tool`` dispatches a single tool call and returns the tool
result text plus any citation sources (only ``search_documents`` yields sources).
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple

from app.explore.agents.nodes import rag_service

logger = logging.getLogger(__name__)


# --- Curated SBI knowledge (loaded once at import) ---------------------------

def _load_sbi_knowledge() -> str:
    """Load the curated SBI knowledge markdown bundled with the package."""
    path = Path(__file__).resolve().parent.parent / "knowledge" / "sbi.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except Exception as e:  # pragma: no cover - defensive; file is bundled
        logger.warning(f"Failed to load SBI knowledge from {path}: {e}")
        return (
            "The Sustainable Building Initiative (SBI) is a student-led "
            "sustainable-building consultancy founded at the University of Texas "
            "at Austin in 2024."
        )


SBI_KNOWLEDGE: str = _load_sbi_knowledge()


# --- Tool schemas ------------------------------------------------------------

TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": (
                "Search the client's uploaded project documents for relevant "
                "passages. Use this for any question about the client's specific "
                "project: facts, figures, dates, budgets, specs, meeting notes, "
                "deliverables, or document contents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "A focused, self-contained search query describing the "
                            "project information to retrieve."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_sbi_knowledge",
            "description": (
                "Look up general info about SBI (Sustainable Building Initiative): "
                "what it is, its mission, services, team/leadership, departments, "
                "and how the portal works. Use this for 'what is SBI' or 'who is "
                "SBI' style questions, not for the client's own project documents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "What to look up about SBI (e.g. 'mission', "
                            "'leadership', 'departments', 'how the portal works')."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    },
]


# --- Tool implementations ----------------------------------------------------

async def _search_documents(query: str, client_id: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Run RAG retrieval; return (context_text, sources) for citations."""
    if not query or not query.strip():
        return "No search query was provided.", []

    docs = await rag_service.retrieve_relevant(query=query, client_id=client_id)
    if not docs:
        return (
            "No matching passages were found in the client's project documents "
            "for this query.",
            [],
        )

    context_text = rag_service.build_context_string(retrieved_docs=docs)

    sources: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for doc in docs:
        metadata = doc.get("metadata", {})
        filename = metadata.get("filename", "Unknown")
        page = metadata.get("page_number")
        key = f"{filename}:{page}" if page else filename
        if key in seen:
            continue
        seen.add(key)
        rerank_score = doc.get("rerank_score")
        relevance = (
            rerank_score if rerank_score is not None else doc.get("similarity_score", 0.0)
        )
        sources.append({
            "content": (doc.get("content", "") or "")[:500],
            "filename": filename,
            "page_number": page,
            "relevance_score": relevance,
        })

    return context_text, sources


def _search_sbi_knowledge(query: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Return the curated SBI knowledge text. No document sources."""
    # The curated knowledge is small, so returning it whole gives the model the
    # full picture; the ``query`` is accepted for interface symmetry and logging.
    return SBI_KNOWLEDGE, []


async def execute_tool(
    name: str, args: Dict[str, Any], client_id: str
) -> Tuple[str, List[Dict[str, Any]]]:
    """Dispatch a single tool call.

    Returns ``(result_text, sources)``. Never raises: a tool failure is returned
    as an error string so the agent loop can continue the turn.
    """
    try:
        if name == "search_documents":
            query = str(args.get("query", "")) if args else ""
            return await _search_documents(query, client_id)
        if name == "search_sbi_knowledge":
            query = str(args.get("query", "")) if args else ""
            return _search_sbi_knowledge(query)
        logger.warning(f"Unknown tool requested: {name}")
        return f"Unknown tool '{name}'. No action taken.", []
    except Exception:
        logger.exception(f"Tool '{name}' failed")
        return f"The tool '{name}' encountered an error and returned no results.", []
