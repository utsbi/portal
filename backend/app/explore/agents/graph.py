from typing import Any, AsyncGenerator, Dict, List, Optional


async def run_graph_streaming(
    query: str,
    client_id: str,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast",
) -> AsyncGenerator[Dict[str, Any], None]:
    """Run the Explore agent pipeline, yielding SSE events.

    Phase events map to the pipeline nodes:
      thinking   -- rewrite_query
      planning   -- semantic_route
      searching  -- retrieve_context
      generating -- generate_response_streaming (interleaved with delta events)

    Delta events carry token chunks from the model. The final yield is a
    result event with the complete response and source citations.

    On the first turn of a conversation (empty ``history``) a ``title`` event is
    also emitted with an auto-generated conversation title.
    """
    from app.explore.agents.nodes import (
        rewrite_query,
        semantic_route,
        retrieve_context,
        generate_response_streaming,
        format_sources,
        generate_title,
    )

    history = history or []

    state: Dict[str, Any] = {
        "query": query,
        "client_id": client_id,
        "history": history,
        "attachments": attachments or [],
        "model_preference": model_preference,
        "standalone_query": "",
        "route": "",
        "route_reason": "",
        "context": "",
        "retrieved_docs": [],
        "response": "",
        "sources": [],
    }

    # First turn (no prior history): generate a concise conversation title so the
    # client can label the session. Best-effort and additive — never blocks the turn.
    if not history:
        title = await generate_title(query)
        yield {"type": "title", "title": title}

    yield {"type": "phase", "phase": "thinking"}
    state = await rewrite_query(state)

    if state.get("route") != "direct":
        yield {"type": "phase", "phase": "planning"}
        state = await semantic_route(state)

        yield {"type": "phase", "phase": "searching"}
        state = await retrieve_context(state)

        # Materialize sources before generation so the prompt can reference them by [n].
        state = await format_sources(state)

    yield {"type": "phase", "phase": "generating"}
    async for event in generate_response_streaming(state):
        if event["type"] == "delta":
            yield event
        elif event["type"] == "state":
            state = event["state"]

    yield {
        "type": "result",
        "answer": state.get("response", ""),
        "sources": state.get("sources", []),
        "route": state.get("route", ""),
        "route_reason": state.get("route_reason", ""),
    }
