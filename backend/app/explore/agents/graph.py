import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)

# Cap on tool-decision iterations so a model that keeps requesting tools can
# never spin the turn forever.
MAX_TOOL_ITERATIONS = 4


async def run_graph_streaming(
    query: str,
    client_id: str,
    access_token: str,
    project_id: Optional[int] = None,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast",
) -> AsyncGenerator[Dict[str, Any], None]:
    """Run the Explore agent tool-calling loop, yielding SSE events.

    Flow:
      1. On the first turn (empty ``history``) emit a ``title`` event.
      2. Emit ``phase: thinking``, then run a NON-streaming tool-decision loop
         (max ``MAX_TOOL_ITERATIONS``) using ``FAST_MODEL`` with ``tools`` and
         ``tool_choice="auto"``. Each requested tool is executed via
         ``execute_tool``; ``search_documents`` results contribute citation
         sources.
      3. Emit ``phase: generating`` and produce the FINAL answer as a STREAMING
         completion WITHOUT tools, yielding ``delta`` events per token. On
         thinking-model turns the model's reasoning tokens stream first as
         ``reasoning`` events (best-effort; fast models emit none).
      4. Emit a single ``result`` event with the full answer and sources.

    The SSE contract (title / phase / delta / result) is preserved exactly; a
    ``reasoning`` event is additive and carries ephemeral thinking tokens that
    are shown live but never persisted. The endpoint owns the ``session`` event,
    so it is never emitted here.
    """
    # Imported lazily to keep import-time side effects (OpenAI client creation)
    # out of module import and mirror the previous graph.py structure.
    from app.explore.agents.nodes import (
        openrouter_client,
        generate_title,
        _format_sources_list,
    )
    from app.explore.agents.prompts import AGENT_SYSTEM_PROMPT
    from app.explore.agents.tools import TOOLS, execute_tool
    from app.explore.core.config import settings
    from app.explore.db.supabase import user_client
    from app.explore.services.membership import get_project_context

    history = history or []
    attachments = attachments or []

    # First turn: best-effort conversation title (never blocks the turn).
    if not history:
        title = await generate_title(query)
        yield {"type": "title", "title": title}

    yield {"type": "phase", "phase": "thinking"}

    # Build the working message list. History is normalized to role/content
    # pairs and capped to the last ~10 turns to bound prompt size.
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT}
    ]

    # When the request carries an active project, inject an authoritative
    # project-context block right after the static prompt so the model knows
    # which project it's in (and can answer "what project am I in?"). This is
    # best-effort: a lookup failure must never block the turn.
    if project_id is not None:
        try:
            project_context = await get_project_context(
                user_client(access_token), client_id, project_id
            )
            if project_context:
                messages.append({"role": "system", "content": project_context})
        except Exception:
            logger.exception("Project-context injection failed; continuing without it")

    for msg in history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": query})

    collected_sources: List[Dict[str, Any]] = []
    searched_emitted = False

    # --- Tool-decision loop (non-streaming) ---------------------------------
    for iteration in range(MAX_TOOL_ITERATIONS):
        try:
            resp = await openrouter_client.chat.completions.create(
                model=settings.fast_model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
        except Exception:
            # A failure deciding on tools must not crash the turn; fall through
            # to generation with whatever (if anything) we have so far.
            logger.exception("Tool-decision call failed; proceeding to generation")
            break

        message = resp.choices[0].message
        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            # Model is ready to answer; stop deciding and stream the final answer.
            break

        # Record the assistant's tool-call message so the tool results attach
        # to the right call ids.
        messages.append({
            "role": "assistant",
            "content": message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments or "{}",
                    },
                }
                for tc in tool_calls
            ],
        })

        if not searched_emitted:
            yield {"type": "phase", "phase": "searching"}
            searched_emitted = True

        for tc in tool_calls:
            name = tc.function.name
            raw_args = tc.function.arguments or "{}"
            try:
                args = json.loads(raw_args) if raw_args.strip() else {}
                if not isinstance(args, dict):
                    args = {}
            except (json.JSONDecodeError, TypeError):
                logger.warning(f"Failed to parse tool args for {name}: {raw_args!r}")
                args = {}

            result_text, sources = await execute_tool(
                name, args, client_id, access_token, project_id
            )
            collected_sources.extend(sources)

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_text,
            })
    else:
        # Loop exhausted iterations without the model settling on an answer.
        logger.info(
            f"Tool loop hit MAX_TOOL_ITERATIONS ({MAX_TOOL_ITERATIONS}); "
            "forcing final generation"
        )

    # Dedupe sources while preserving order so [n] indices stay stable.
    deduped_sources: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()
    for s in collected_sources:
        key = f"{s.get('filename')}:{s.get('page_number')}"
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped_sources.append(s)
    collected_sources = deduped_sources

    # If documents were cited, give the model the numbered source list so it can
    # attach [n] markers to project facts in the final streamed answer.
    if collected_sources:
        messages.append({
            "role": "system",
            "content": (
                "Available Sources (cite project facts drawn from these using [n] "
                "markers, matching the index below; use only these indices):\n"
                + _format_sources_list(collected_sources)
            ),
        })

    # --- Final answer (streaming, no tools) ---------------------------------
    yield {"type": "phase", "phase": "generating"}

    model = settings.think_model if model_preference == "thinking" else settings.fast_model

    answer_parts: List[str] = []
    try:
        # Request reasoning tokens. Thinking models (think_model) interleave
        # reasoning before the answer; flash/fast models simply emit none, which
        # is fine — reasoning is best-effort and never required. OpenRouter takes
        # the reasoning config via extra_body.
        stream = await openrouter_client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            extra_body={"reasoning": {"effort": "medium"}},
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            # Reasoning/thinking tokens stream BEFORE the answer. Forward them as
            # a separate ``reasoning`` event so the UI can show "Thinking" live;
            # they are ephemeral (not persisted) and never part of the answer.
            reasoning = getattr(delta, "reasoning", None)
            if reasoning:
                yield {"type": "reasoning", "text": reasoning}
            content = delta.content
            if content:
                answer_parts.append(content)
                yield {"type": "delta", "text": content}
    except Exception:
        logger.exception("Final response generation failed")
        if not answer_parts:
            err = (
                "I ran into a problem while generating a response. "
                "Please try again in a moment, or rephrase your question."
            )
            yield {"type": "delta", "text": err}
            answer_parts.append(err)

    full_answer = "".join(answer_parts).strip()
    if not full_answer:
        full_answer = "I was unable to generate a response. Please try rephrasing your question."
        yield {"type": "delta", "text": full_answer}

    yield {
        "type": "result",
        "answer": full_answer,
        "sources": collected_sources,
    }
