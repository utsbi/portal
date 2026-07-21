from typing import Any, AsyncGenerator, Dict, List, Optional

from app.explore.agents.graph import run_graph_streaming


async def run_explore_agent_streaming(
    query: str,
    client_id: str,
    access_token: str,
    project_id: Optional[int] = None,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast",
) -> AsyncGenerator[Dict[str, Any], None]:
    """Streaming entry point that yields SSE phase events, token deltas, and a final result.

    ``access_token`` is the caller's validated Supabase JWT, threaded through to
    the live-data tools so their queries run under the caller's RLS context.
    ``project_id`` is the caller's active project; it narrows the live-data tools
    to that project (membership-verified server-side).
    """
    async for event in run_graph_streaming(
        query=query,
        client_id=client_id,
        access_token=access_token,
        project_id=project_id,
        history=history or [],
        attachments=attachments or [],
        model_preference=model_preference,
    ):
        yield event
