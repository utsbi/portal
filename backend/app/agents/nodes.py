import logging
from typing import Dict, Any, List
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.services.rag_service import RAGService
from app.agents.prompts import (
    SYSTEM_PROMPT,
    GENERATE_RESPONSE_PROMPT,
    QUERY_REWRITER_PROMPT,
    SEMANTIC_ROUTER_PROMPT,
)


rag_service = RAGService()
openrouter_client = AsyncOpenAI(
    api_key=settings.api_key,
    base_url="https://openrouter.ai/api/v1"
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


async def route_query(state: Dict[str, Any]) -> Dict[str, Any]:
    """Determine the routing path using query rewriting and semantic routing

    Pipeline:
    1. Greetings/help -> direct (no LLM)
    2. Rewrite query into standalone form (LLM, only when history exists)
    3. No attachments -> retrieve from RAG (no LLM routing)
    4. Attachments exist -> LLM semantic router decides ATTACHMENT / RAG / HYBRID
    """
    query = state.get("query", "")
    history = state.get("history", [])
    attachments = state.get("attachments", [])

    logger.info(f"Routing query: '{query[:100]}' (history={len(history)} msgs, attachments={len(attachments)} files)")

    # greetings and help (no LLM needed)
    query_lower = query.lower().strip()

    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]
    if any(query_lower.startswith(g) for g in greetings):
        logger.info("Route: direct (greeting detected)")
        return {**state, "route": "direct", "route_reason": "Greeting detected", "standalone_query": query}

    if query_lower in ["help", "what can you do", "what can you help with"]:
        logger.info("Route: direct (help request)")
        return {**state, "route": "direct", "route_reason": "Help request", "standalone_query": query}

    # Step 1: Query Rewriting (conversation history exists)
    # Turns vague questions like into complete
    # standalone search query by incorporating conversation context
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

    # Step 2: Routing Decision
    # No attachments in session -> always use RAG
    if not attachments:
        logger.info("Route: retrieve (no attachments, default RAG)")
        return {
            **state,
            "route": "retrieve",
            "route_reason": "No attachments, default RAG search",
            "standalone_query": standalone_query,
        }

    # Attachments exist -> use LLM semantic router to decide whether the user is asking about file, the RAG DB, or both
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
        # If routing LLM fails, default to hybrid
        route = "hybrid"
        reason = f"Semantic routing failed ({e}), defaulting to hybrid"
        logger.warning(f"Semantic routing LLM call failed: {e}")

    logger.info(f"Route: {route} ({reason})")
    return {**state, "route": route, "route_reason": reason, "standalone_query": standalone_query}


def _build_attachment_info(attachments: List[Dict[str, str]]) -> str:
    """Build a concise summary of attachments for semantic routing

    Includes filename and first 300 chars of content
    """
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
    logger.info(f"Retrieve context: route={route}, client_id={client_id[:8]}..., attachments={len(attachments)}, query='{query[:80]}'")

    retrieved_docs: List[Dict[str, Any]] = []
    context = ""

    if route == "attachment" and attachments:
        # Build context from session attachments only
        context = _build_attachment_context(attachments)

        # Fallback: if attachment context not enough, the file probably
        # doesn't contain needed info, try RAG
        if len(context.strip()) < 100:
            logger.info("Attachment context too thin, falling back to RAG search")
            context = await rag_service.get_context_for_query(
                query=query, client_id=client_id,
            )
            retrieved_docs = await rag_service.hybrid_search(
                query=query, client_id=client_id, limit=5,
            )

    elif route == "retrieve":
        # RAG search only, no attachment context
        context = await rag_service.get_context_for_query(
            query=query, client_id=client_id,
        )
        retrieved_docs = await rag_service.hybrid_search(
            query=query, client_id=client_id, limit=5,
        )

    elif route == "hybrid":
        # Both sources: get_context_for_query merges attachment
        # text and vector search results when attachments are passed
        context = await rag_service.get_context_for_query(
            query=query, client_id=client_id, attachments=attachments,
        )
        retrieved_docs = await rag_service.hybrid_search(
            query=query, client_id=client_id, limit=5,
        )

    logger.info(f"Retrieval complete: route={route}, context_length={len(context)}, docs_found={len(retrieved_docs)}")
    return {
        **state,
        "context": context,
        "retrieved_docs": retrieved_docs,
    }


def _build_attachment_context(attachments: List[Dict[str, str]],
                              max_length: int = 800_000) -> str:
    """Build a context string from session attachments"""
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


async def generate_response(state: Dict[str, Any]) -> Dict[str, Any]:
    """Generate the final response using retrieved context"""
    query = state.get("query", "")
    context = state.get("context", "")
    history = state.get("history", [])
    route = state.get("route", "retrieve")
    model_preference = state.get("model_preference", "fast")

    # Select model based on preference
    if model_preference == "thinking":
        model = settings.think_model
    else:
        model = settings.fast_model

    logger.info(f"Generate response: model={model}, route={route}, context_length={len(context)}, history={len(history)} msgs")

    # Handle direct responses (greetings, help)
    if route == "direct":
        query_lower = query.lower().strip()

        if any(query_lower.startswith(g) for g in ["hello", "hi", "hey", "good"]):
            return {
                **state,
                "response": "Hello. I'm your **Project Manager Assistant** for SBI. How may I assist you with your project today?"
            }

        if "help" in query_lower or "what can you" in query_lower:
            return {
                **state,
                "response": """I'm here to help you with your construction and sustainability projects. Here's what I can do:

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
            }

    # Build the generation messages with proper system/user roles
    formatted_history = format_history(history)

    user_prompt = GENERATE_RESPONSE_PROMPT.format(
        query=query,
        context=context if context else 'No relevant documents found.',
        history=formatted_history
    )

    try:
        response = await openrouter_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ]
        )
        answer = (response.choices[0].message.content or "").strip()

        if not answer:
            answer = "I was unable to generate a response. Please try rephrasing your question."

        # If no context was found, add a note
        if not context or context == "No relevant documents found.":
            if "No relevant documents" not in answer:
                answer = f"{answer}\n\n---\n\n> **Note:** No specific documents were found in your project files related to this query. You can upload relevant documents or ask me to search for something else."

        return {**state, "response": answer}

    # TODO: Remove the error message {e} once it hits prod
    except Exception as e:
        return {
            **state,
            "response": f"I apologize, but I encountered an issue while processing your request. Please try again or rephrase your question. Technical details: {str(e)}"
        }


async def format_sources(state: Dict[str, Any]) -> Dict[str, Any]:
    """Format source documents for the response."""
    retrieved_docs = state.get("retrieved_docs", [])

    sources = []
    seen_files = set()

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
                "relevance_score": doc.get("similarity_score", 0.0)
            })

    return {**state, "sources": sources}
