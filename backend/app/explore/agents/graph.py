from typing import Dict, Any, List, TypedDict, Annotated, Optional, AsyncGenerator
from langgraph.graph import StateGraph, END


class AgentState(TypedDict):
    """State definition for the Explore agent workflow."""
    query: str
    client_id: str
    history: List[Dict[str, str]]
    attachments: List[Dict[str, str]]
    model_preference: str

    standalone_query: str
    route: str
    route_reason: str

    context: str
    retrieved_docs: List[Dict[str, Any]]

    response: str
    sources: List[Dict[str, Any]]


def create_explore_graph() -> StateGraph:
    """
    Create the LangGraph state machine for the Explore AI Agent.
    
    The workflow follows this pattern:
    1. route_query: Determine if we need retrieval or direct response
    2. retrieve_context: Fetch relevant documents (if needed)
    3. generate_response: Create the response using context
    4. format_sources: Prepare source citations
    """
    from app.explore.agents.nodes import (
        route_query,
        retrieve_context,
        generate_response,
        format_sources
    )
    
    graph = StateGraph(AgentState)
    
    graph.add_node("route", route_query)
    graph.add_node("retrieve", retrieve_context)
    graph.add_node("generate", generate_response)
    graph.add_node("format_sources", format_sources)
    
    def should_retrieve(state: Dict[str, Any]) -> str:
        """Determine next step based on routing decision."""
        route = state.get("route", "retrieve")
        if route == "direct":
            return "generate"
        return "retrieve"
    
    graph.set_entry_point("route")
    
    graph.add_conditional_edges(
        "route",
        should_retrieve,
        {
            "retrieve": "retrieve",
            "generate": "generate"
        }
    )
    
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "format_sources")
    graph.add_edge("format_sources", END)
    
    return graph


_compiled_graph = None


def get_compiled_graph():
    """Get or create the compiled graph singleton."""
    global _compiled_graph
    if _compiled_graph is None:
        graph = create_explore_graph()
        _compiled_graph = graph.compile()
    return _compiled_graph


async def run_graph(query: str, client_id: str,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast"
) -> Dict[str, Any]:
    """Run the Explore agent graph with the given inputs."""
    graph = get_compiled_graph()

    initial_state: AgentState = {
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
        "sources": []
    }

    result = await graph.ainvoke(initial_state)

    return {
        "response": result.get("response", ""),
        "sources": result.get("sources", []),
        "route": result.get("route", ""),
        "route_reason": result.get("route_reason", "")
    }


async def run_graph_streaming(
    query: str, client_id: str,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast"
) -> AsyncGenerator[Dict[str, Any], None]:
    """Run the Explore agent graph, yielding SSE progress events.

    Yields phase events that map to backend node execution:
      thinking: rewrite_query (query rewriting)
      planning: semantic_route (LLM routing)
      searching: retrieve_context (RAG / attachment / hybrid)
      generating: generate_response (final answer)

    Final yield is a result event with the complete response.
    """
    from app.explore.agents.nodes import (
        rewrite_query, semantic_route,
        retrieve_context, generate_response, format_sources
    )

    initial_state: Dict[str, Any] = {
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
        "sources": []
    }

    # Phase: Thinking (query rewriting)
    yield {"type": "phase", "phase": "thinking"}
    state = await rewrite_query(initial_state)

    if state.get("route") == "direct":
        # Direct responses skip routing and retrieval
        yield {"type": "phase", "phase": "generating"}
        state = await generate_response(state)
        state = await format_sources(state)
    else:
        # Phase: Planning (semantic routing)
        yield {"type": "phase", "phase": "planning"}
        state = await semantic_route(state)

        # Phase: Searching (context retrieval)
        yield {"type": "phase", "phase": "searching"}
        state = await retrieve_context(state)

        # Phase: Generating (final answer)
        yield {"type": "phase", "phase": "generating"}
        state = await generate_response(state)
        state = await format_sources(state)

    # Emit final result
    yield {
        "type": "result",
        "answer": state.get("response", ""),
        "sources": state.get("sources", []),
        "route": state.get("route", ""),
        "route_reason": state.get("route_reason", ""),
    }
