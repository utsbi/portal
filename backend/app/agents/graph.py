from typing import Dict, Any, List, TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, END


class AgentState(TypedDict):
    """State definition for the Explore agent workflow."""
    query: str
    client_id: str
    history: List[Dict[str, str]]
    attachments: List[Dict[str, str]]
    model_preference: str
    
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
    from app.agents.nodes import (
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
