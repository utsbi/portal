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
    """
    from app.explore.agents.nodes import (
        rewrite_query,
        semantic_route,
        retrieve_context,
        generate_response_streaming,
        format_sources,
    )

    state: Dict[str, Any] = {
        "query": query,
        "client_id": client_id,
        "history": history or [],
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

    yield {"type": "phase", "phase": "thinking"}
    state = await rewrite_query(state)

    if state.get("route") != "direct":
        yield {"type": "phase", "phase": "planning"}
        state = await semantic_route(state)

        yield {"type": "phase", "phase": "searching"}
        state = await retrieve_context(state)

    yield {"type": "phase", "phase": "generating"}
    async for event in generate_response_streaming(state):
        if event["type"] == "delta":
            yield event
        elif event["type"] == "state":
            state = event["state"]

    state = await format_sources(state)

    yield {
        "type": "result",
        "answer": state.get("response", ""),
        "sources": state.get("sources", []),
        "route": state.get("route", ""),
        "route_reason": state.get("route_reason", ""),
    }
