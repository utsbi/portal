import logging
from typing import Dict, Any, List
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.services.rag_service import RAGService
from app.agents.prompts import (
    SYSTEM_PROMPT,
    ROUTING_PROMPT,
    GENERATE_RESPONSE_PROMPT,
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
    """Determine the routing path for the query."""
    query = state.get("query", "")
    history = state.get("history", [])
    attachments = state.get("attachments", [])

    # Simple routing for common uses
    query_lower = query.lower().strip()

    # Greeting queries
    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]
    if any(query_lower.startswith(g) for g in greetings):
        return {**state, "route": "direct", "route_reason": "Greeting detected"}

    # Help requests
    if query_lower in ["help", "what can you do", "what can you help with"]:
        return {**state, "route": "direct", "route_reason": "Help request"}

    # If attachments are present, always route to attachment path.
    if attachments:
        return {**state, "route": "attachment", "route_reason": "Session attachments present"}

    # Complex routing decisions, use LLM
    routing_prompt = ROUTING_PROMPT.format(
        query=query,
        has_history=len(history) > 0,
        has_attachments=len(attachments) > 0
    )

    try:
        response = await openrouter_client.chat.completions.create(
            model=settings.fast_model,
            messages=[{"role": "user", "content": routing_prompt}]
        )
        decision = (response.choices[0].message.content or "").strip().upper()

        if "DIRECT" in decision:
            return {**state, "route": "direct", "route_reason": "LLM determined direct response"}
        elif "ATTACHMENT" in decision:
            return {**state, "route": "attachment", "route_reason": "LLM determined attachment focus"}
        else:
            return {**state, "route": "retrieve", "route_reason": "Document retrieval needed"}

    except Exception as e:
        logger.error(f"Routing LLM call failed: {e}")
        return {**state, "route": "retrieve", "route_reason": f"Default (routing error: {str(e)})"}


async def retrieve_context(state: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieve relevant context from documents and attachments."""
    query = state.get("query", "")
    client_id = state.get("client_id", "")
    attachments = state.get("attachments", [])
    route = state.get("route", "retrieve")

    retrieved_docs = []
    context = ""

    # Handle attachment-focused queries
    # Gemini supports 1M tokens. Cap at 800K tokens
    # leave room for system prompt, history, and generation.
    MAX_ATTACHMENT_CONTEXT = 800_000

    if route == "attachment" and attachments:
        context_parts = ["=== Session Attachments ===\n"]
        current_length = 0
        for att in attachments:
            att_header = f"\n[File: {att.get('filename', 'attachment')}]\n"
            att_content = att.get("content", "")

            if current_length + len(att_header) + len(att_content) > MAX_ATTACHMENT_CONTEXT:
                # Include as much of this attachment as fits
                remaining = MAX_ATTACHMENT_CONTEXT - current_length - len(att_header) - 100
                if remaining > 1000:
                    context_parts.append(att_header)
                    context_parts.append(att_content[:remaining])
                    context_parts.append("\n\n[Note: File content was truncated due to size limits.]\n")
                break

            context_parts.append(att_header)
            context_parts.append(att_content)
            context_parts.append("\n")
            current_length += len(att_header) + len(att_content) + 1

        context = "".join(context_parts)

    # Retrieve from vector store
    elif route == "retrieve":
        context = await rag_service.get_context_for_query(
            query=query,
            client_id=client_id,
            attachments=attachments
        )

        # Also get raw docs for source citation
        retrieved_docs = await rag_service.hybrid_search(
            query=query,
            client_id=client_id,
            limit=5
        )

    logger.info(f"Retrieval complete: route={route}, context_length={len(context)}, docs_found={len(retrieved_docs)}")
    return {
        **state,
        "context": context,
        "retrieved_docs": retrieved_docs
    }


async def generate_response(state: Dict[str, Any]) -> Dict[str, Any]:
    """Generate the final response using retrieved context."""
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

    # Handle direct responses (greetings, help)
    if route == "direct":
        query_lower = query.lower().strip()

        if any(query_lower.startswith(g) for g in ["hello", "hi", "hey", "good"]):
            return {
                **state,
                "response": "Hello. I'm your Project Manager Assistant for SBI. How may I assist you with your project today?"
            }

        if "help" in query_lower or "what can you" in query_lower:
            return {
                **state,
                "response": """I'm here to help you with your construction and sustainability projects. I can assist with:

* Answering questions about your project documents and specifications
* Summarizing meeting notes and reports
* Tracking project progress, deadlines, and deliverables
* Extracting action items from documents
* Providing insights from your project data

Feel free to ask me anything about your project, or upload documents for me to analyze."""
            }

    # Build the generation prompt
    formatted_history = format_history(history)

    generation_prompt = f"{SYSTEM_PROMPT}\n\n{GENERATE_RESPONSE_PROMPT.format(
        query=query,
        context=context if context else 'No relevant documents found.',
        history=formatted_history
    )}"

    try:
        response = await openrouter_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": generation_prompt}]
        )
        answer = (response.choices[0].message.content or "").strip()

        if not answer:
            answer = "I was unable to generate a response. Please try rephrasing your question."

        # If no context was found, add a note
        if not context or context == "No relevant documents found.":
            if "No relevant documents" not in answer:
                answer = f"Based on the available information:\n\n{answer}\n\nNote: I did not find specific documents in your project files related to this prompt. If you have relevant documents, please upload them or let me know if you'd like me to search for something else."

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
