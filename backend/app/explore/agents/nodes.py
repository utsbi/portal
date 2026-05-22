import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from openai import AsyncOpenAI

from app.explore.core.config import settings
from app.explore.agents.prompts import (
    SYSTEM_PROMPT,
    GENERATE_RESPONSE_PROMPT,
    QUERY_REWRITER_PROMPT,
    SEMANTIC_ROUTER_PROMPT,
)
from app.explore.services.rag_service import RAGService

logger = logging.getLogger(__name__)


rag_service = RAGService()
openrouter_client = AsyncOpenAI(
    api_key=settings.api_key,
    base_url="https://openrouter.ai/api/v1",
)


HELP_RESPONSE = """I'm here to help you with your construction and sustainability projects. Here's what I can do:

### Document Analysis
- **Search and answer** questions about your project documents and specifications
- **Summarize** meeting notes, reports, and technical documents

### Project Tracking
- **Track** project progress, deadlines, and deliverables
- **Extract action items** from meeting notes and documents

### Insights
- **Analyze** your project data and provide actionable insights
- **Compare** information across multiple documents

Feel free to ask me anything about your project, or upload documents for me to analyze."""

GREETING_RESPONSE = (
    "Hello. I'm your **Project Manager Assistant** for SBI. "
    "How may I assist you with your project today?"
)

NO_CONTEXT_FOOTER = (
    "\n\n---\n\n> **Note:** No specific documents were found in your project "
    "files related to this query. You can upload relevant documents or ask me "
    "to search for something else."
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


def _direct_response_text(query: str) -> Optional[str]:
    """Canned response for greeting/help direct route. None if not a direct case."""
    query_lower = query.lower().strip()
    if any(query_lower.startswith(g) for g in ["hello", "hi", "hey", "good"]):
        return GREETING_RESPONSE
    if "help" in query_lower or "what can you" in query_lower:
        return HELP_RESPONSE
    return None


async def rewrite_query(state: Dict[str, Any]) -> Dict[str, Any]:
    """Phase 1 (Thinking): Check greetings/help, rewrite query."""
    query = state.get("query", "")
    history = state.get("history", [])

    logger.info(f"Rewrite query: '{query[:100]}' (history={len(history)} msgs)")

    # Greetings and help (no LLM needed)
    query_lower = query.lower().strip()
    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]
    if any(query_lower.startswith(g) for g in greetings):
        logger.info("Route: direct (greeting detected)")
        return {**state, "route": "direct", "route_reason": "Greeting detected", "standalone_query": query}

    if query_lower in ["help", "what can you do", "what can you help with"]:
        logger.info("Route: direct (help request)")
        return {**state, "route": "direct", "route_reason": "Help request", "standalone_query": query}

    # Query rewriting (conversation history exists)
    standalone_query = query
    if history:
        try:
            formatted_history = format_history(history)
            rewrite_prompt = QUERY_REWRITER_PROMPT.format(
                query=query,
                history=formatted_history,
            )
            rewrite_response = await openrouter_client.chat.completions.create(
                model=settings.fast_model,
                messages=[{"role": "user", "content": rewrite_prompt}],
            )
            rewritten = (rewrite_response.choices[0].message.content or "").strip()
            if rewritten:
                standalone_query = rewritten
                logger.info(f"Query rewritten: '{query[:80]}' -> '{standalone_query[:80]}'")
            else:
                logger.warning("Query rewriter returned empty, using original query")
        except Exception as e:
            logger.warning(f"Query rewriting failed, using original: {e}")

    return {**state, "standalone_query": standalone_query}


async def semantic_route(state: Dict[str, Any]) -> Dict[str, Any]:
    """Phase 2 (Planning): Determine routing based on attachments.

    No attachments -> RAG (no LLM call).
    Attachments exist -> LLM semantic router decides ATTACHMENT / RAG / HYBRID.
    """
    query = state.get("query", "")
    attachments = state.get("attachments", [])

    logger.info(f"Semantic routing: '{query[:100]}' (attachments={len(attachments)} files)")

    if not attachments:
        logger.info("Route: retrieve (no attachments, default RAG)")
        return {
            **state,
            "route": "retrieve",
            "route_reason": "No attachments, default RAG search",
        }

    try:
        attachment_info = _build_attachment_info(attachments)
        router_prompt = SEMANTIC_ROUTER_PROMPT.format(
            query=query,
            attachment_info=attachment_info,
        )
        router_response = await openrouter_client.chat.completions.create(
            model=settings.fast_model,
            messages=[{"role": "user", "content": router_prompt}],
        )
        decision = (router_response.choices[0].message.content or "").strip().upper()
        logger.info(f"Semantic router raw decision: '{decision}' for original query: '{query[:80]}'")

        if "HYBRID" in decision:
            route = "hybrid"
            reason = "Semantic router: needs both attachment and knowledge base"
        elif "RAG" in decision:
            route = "retrieve"
            reason = "Semantic router: needs knowledge base (not about attachments)"
        elif "ATTACHMENT" in decision:
            route = "attachment"
            reason = "Semantic router: question is about attached file(s)"
        else:
            route = "hybrid"
            reason = f"Semantic router returned unexpected '{decision}', defaulting to hybrid"
            logger.warning(f"Unexpected router decision: '{decision}'")
    except Exception as e:
        route = "hybrid"
        reason = f"Semantic routing failed ({e}), defaulting to hybrid"
        logger.warning(f"Semantic routing LLM call failed: {e}")

    logger.info(f"Route: {route} ({reason})")
    return {**state, "route": route, "route_reason": reason}


def _build_attachment_info(attachments: List[Dict[str, str]]) -> str:
    """Concise summary of attachments for semantic routing (filename + 500-char preview)."""
    info_parts = []
    for att in attachments:
        filename = att.get("filename", "unknown")
        content = att.get("content", "")
        preview = content[:500].replace("\n", " ").strip()
        if len(content) > 500:
            preview += "..."
        info_parts.append(f"- {filename}: \"{preview}\"")
    return "\n".join(info_parts) if info_parts else "- (no files)"


async def retrieve_context(state: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieve relevant context from documents and/or attachments.

    Routes:
      - attachment: Build context from session files only (with RAG fallback)
      - retrieve:   Search DB vector store only (RAG)
      - hybrid:     Combine attachment context + RAG results
    """
    # Use the rewritten standalone query for better search accuracy
    query = state.get("standalone_query", "") or state.get("query", "")
    client_id = state.get("client_id", "")
    attachments = state.get("attachments", [])
    route = state.get("route", "retrieve")
    logger.info(
        f"Retrieve context: route={route}, client_id={client_id[:8]}..., "
        f"attachments={len(attachments)}, query='{query[:80]}'"
    )

    retrieved_docs: List[Dict[str, Any]] = []
    context = ""

    if route == "attachment" and attachments:
        context = _build_attachment_context(attachments)

        # If attachment context is too thin, fall back to RAG search
        if len(context.strip()) < 100:
            logger.info("Attachment context too thin, falling back to RAG search")
            context = await rag_service.get_context_for_query(
                query=query, client_id=client_id,
            )
            retrieved_docs = await rag_service.hybrid_search(
                query=query, client_id=client_id, limit=5,
            )

    elif route == "retrieve":
        context = await rag_service.get_context_for_query(
            query=query, client_id=client_id,
        )
        retrieved_docs = await rag_service.hybrid_search(
            query=query, client_id=client_id, limit=5,
        )

    elif route == "hybrid":
        context = await rag_service.get_context_for_query(
            query=query, client_id=client_id, attachments=attachments,
        )
        retrieved_docs = await rag_service.hybrid_search(
            query=query, client_id=client_id, limit=5,
        )

    logger.info(
        f"Retrieval complete: route={route}, context_length={len(context)}, "
        f"docs_found={len(retrieved_docs)}"
    )
    return {
        **state,
        "context": context,
        "retrieved_docs": retrieved_docs,
    }


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


def _build_attachment_context(
    attachments: List[Dict[str, str]],
    max_length: int = 800_000,
) -> str:
    """Build a context string from session attachments."""
    context_parts = ["=== Session Attachments ===\n"]
    current_length = 0
    for att in attachments:
        att_header = f"\n[File: {att.get('filename', 'attachment')}]\n"
        att_content = att.get("content", "")

        if current_length + len(att_header) + len(att_content) > max_length:
            remaining = max_length - current_length - len(att_header) - 100
            if remaining > 1000:
                context_parts.append(att_header)
                context_parts.append(att_content[:remaining])
                context_parts.append("\n\n[Note: File content was truncated due to size limits.]\n")
            break

        context_parts.append(att_header)
        context_parts.append(att_content)
        context_parts.append("\n")
        current_length += len(att_header) + len(att_content) + 1

    return "".join(context_parts)


async def generate_response_streaming(
    state: Dict[str, Any],
) -> AsyncGenerator[Dict[str, Any], None]:
    """Generate the final response, streaming token deltas.

    Yields:
      {"type": "delta", "text": str}     -- 0+ times as chunks arrive
      {"type": "state", "state": Dict}   -- once at the end with the full updated state
    """
    query = state.get("query", "")
    context = state.get("context", "")
    history = state.get("history", [])
    route = state.get("route", "retrieve")
    model_preference = state.get("model_preference", "fast")

    model = settings.think_model if model_preference == "thinking" else settings.fast_model

    logger.info(
        f"Generate response (streaming): model={model}, route={route}, "
        f"context_length={len(context)}, history={len(history)} msgs"
    )

    # Direct route (greetings, help) — emit canned text as a single delta.
    if route == "direct":
        canned = _direct_response_text(query)
        if canned is not None:
            yield {"type": "delta", "text": canned}
            yield {"type": "state", "state": {**state, "response": canned}}
            return

    formatted_history = format_history(history)
    sources_list = _format_sources_list(state.get("sources", []))
    user_prompt = GENERATE_RESPONSE_PROMPT.format(
        query=query,
        context=context if context else "No relevant documents found.",
        history=formatted_history,
        sources_list=sources_list,
    )

    answer_parts: List[str] = []
    try:
        stream = await openrouter_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                answer_parts.append(delta)
                yield {"type": "delta", "text": delta}

        answer = "".join(answer_parts).strip()
        if not answer:
            answer = "I was unable to generate a response. Please try rephrasing your question."
            yield {"type": "delta", "text": answer}

        # If no context was found, append a note (and stream it so the UI sees it).
        if (not context or context == "No relevant documents found.") and "No relevant documents" not in answer:
            yield {"type": "delta", "text": NO_CONTEXT_FOOTER}
            answer = f"{answer}{NO_CONTEXT_FOOTER}"

        yield {"type": "state", "state": {**state, "response": answer}}

    except Exception as e:
        logger.exception("generate_response_streaming failed")
        # TODO: stop leaking the exception text once we have proper user-visible errors.
        err = (
            "I apologize, but I encountered an issue while processing your request. "
            f"Please try again or rephrase your question. Technical details: {e}"
        )
        yield {"type": "delta", "text": err}
        yield {"type": "state", "state": {**state, "response": err}}


async def format_sources(state: Dict[str, Any]) -> Dict[str, Any]:
    """Format source documents for the response based on the routing decision.

    Routes:
      - retrieve:   Only RAG sources
      - attachment: Only attached file(s)
      - hybrid:     Both attached files and RAG sources
      - direct:     No sources
    """
    retrieved_docs = state.get("retrieved_docs", [])
    attachments = state.get("attachments", [])
    route = state.get("route", "retrieve")

    sources: List[Dict[str, Any]] = []
    seen_files = set()

    if route in ("attachment", "hybrid") and attachments:
        for att in attachments:
            filename = att.get("filename", "unknown")
            if filename not in seen_files:
                seen_files.add(filename)
                sources.append({
                    "content": att.get("content", "")[:500],
                    "filename": filename,
                    "page_number": None,
                    "relevance_score": 1.0,
                })

    if route in ("retrieve", "hybrid"):
        for doc in retrieved_docs:
            metadata = doc.get("metadata", {})
            filename = metadata.get("filename", "Unknown")
            page = metadata.get("page_number")
            source_key = f"{filename}:{page}" if page else filename

            if source_key not in seen_files:
                seen_files.add(source_key)
                sources.append({
                    "content": doc.get("content", "")[:500],
                    "filename": filename,
                    "page_number": page,
                    "relevance_score": doc.get("similarity_score", 0.0),
                })

    return {**state, "sources": sources}
