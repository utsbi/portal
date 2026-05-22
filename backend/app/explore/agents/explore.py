from typing import Any, AsyncGenerator, Dict, List, Optional

from app.explore.agents.graph import run_graph_streaming


async def run_explore_agent_streaming(
    query: str,
    client_id: str,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast",
) -> AsyncGenerator[Dict[str, Any], None]:
    """Streaming entry point that yields SSE phase events, token deltas, and a final result."""
    async for event in run_graph_streaming(
        query=query,
        client_id=client_id,
        history=history or [],
        attachments=attachments or [],
        model_preference=model_preference,
    ):
        yield event
