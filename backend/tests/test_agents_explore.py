from unittest.mock import patch

from app.explore.agents.explore import run_explore_agent_streaming


async def test_streaming_entrypoint_forwards_arguments_and_defaults() -> None:
    received: dict[str, object] = {}

    async def fake_graph(**kwargs: object):
        received.update(kwargs)
        yield {"type": "delta", "text": "hello"}
        yield {"type": "result", "answer": "hello", "sources": []}

    with patch("app.explore.agents.explore.run_graph_streaming", new=fake_graph):
        events = [
            event
            async for event in run_explore_agent_streaming(
                query="hi",
                client_id="client-id",
                access_token="token",
            )
        ]

    assert events == [
        {"type": "delta", "text": "hello"},
        {"type": "result", "answer": "hello", "sources": []},
    ]
    assert received == {
        "query": "hi",
        "client_id": "client-id",
        "access_token": "token",
        "project_id": None,
        "history": [],
        "attachments": [],
        "model_preference": "fast",
    }
