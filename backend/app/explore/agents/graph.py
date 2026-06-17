import asyncio
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
      1. On the first turn (empty ``history``) kick off title generation as a
         background task so it overlaps the first model call instead of adding a
         full round-trip of dead air before any token; the ``title`` event is
         emitted as soon as it's ready.
      2. Emit ``phase: thinking``, then run a SINGLE STREAMING tool-calling loop
         (max ``MAX_TOOL_ITERATIONS``) with ``tools`` and ``tool_choice="auto"``.
         ``delta.content`` streams as ``delta`` events and ``delta.reasoning`` as
         ``reasoning`` events AS THEY ARRIVE. If a chunk yields tool calls, emit
         ``phase: searching`` once, execute each via ``execute_tool`` (
         ``search_documents`` results contribute citation sources), append the
         results, and loop again — the next iteration is ALSO streamed. A no-tool
         query therefore starts streaming on the FIRST model call.
      3. Emit ``phase: generating`` before the answer-only iteration so the UI
         can flip out of "searching"; the final answer streamed in that same
         iteration carries [n] citations against the accumulated tool results.
      4. Emit a single ``result`` event with the full answer and sources.

    The SSE contract (title / phase / reasoning / delta / result) is preserved
    exactly; a ``reasoning`` event is additive and carries ephemeral thinking
    tokens that are shown live but never persisted. The endpoint owns the
    ``session`` event, so it is never emitted here.
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

    # First turn: start best-effort title generation as a background task so it
    # overlaps the first model call instead of serializing a full round-trip
    # ahead of it. ``generate_title`` already falls back internally, so the task
    # never raises. The ``title`` event is flushed (below) the moment it's ready.
    title_task: Optional["asyncio.Task[str]"] = None
    if not history:
        title_task = asyncio.create_task(generate_title(query))

    async def _drain_title() -> Optional[Dict[str, Any]]:
        """Return a ``title`` event if the background title is ready, else None.

        Non-blocking: only resolves the task once it has completed so emitting
        the title never stalls the token stream.
        """
        if title_task is None or not title_task.done():
            return None
        try:
            title = title_task.result()
        except Exception:
            # generate_title swallows its own errors, but guard regardless so a
            # title failure can never crash the turn.
            logger.exception("Title task failed; skipping title event")
            return None
        return {"type": "title", "title": title}

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
    generating_emitted = False
    sources_msg_index: Optional[int] = None
    title_emitted = title_task is None

    model = settings.think_model if model_preference == "thinking" else settings.fast_model

    answer_parts: List[str] = []

    # --- Single streaming tool-calling loop ---------------------------------
    # Each iteration streams the model's output AS IT ARRIVES. If the model
    # requests tools we run them and loop again (also streamed); the iteration
    # that yields no tool calls IS the final answer — there is no separate,
    # serialized generation call. A simple query thus streams on call #1.
    for iteration in range(MAX_TOOL_ITERATIONS):
        # Dedupe sources while preserving order so [n] indices stay stable, then
        # (re)attach the numbered "Available Sources" system message so the model
        # can cite project facts with [n] markers in the streamed answer. We keep
        # a single such message and refresh it in place as sources accumulate.
        if collected_sources:
            deduped_sources: List[Dict[str, Any]] = []
            seen_keys: set[str] = set()
            for s in collected_sources:
                key = f"{s.get('filename')}:{s.get('page_number')}"
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                deduped_sources.append(s)
            collected_sources = deduped_sources

            sources_content = (
                "Available Sources (cite project facts drawn from these using [n] "
                "markers, matching the index below; use only these indices):\n"
                + _format_sources_list(collected_sources)
            )
            if sources_msg_index is None:
                sources_msg_index = len(messages)
                messages.append({"role": "system", "content": sources_content})
            else:
                messages[sources_msg_index]["content"] = sources_content

        # Accumulators for tool_calls streamed incrementally across chunks. Each
        # entry collects an id, function name, and the concatenated argument
        # fragments for one tool call (keyed by the streamed choice index).
        tool_calls_acc: Dict[int, Dict[str, Any]] = {}

        try:
            stream = await openrouter_client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                tools=TOOLS,
                tool_choice="auto",
                extra_body={"reasoning": {"effort": "medium"}},
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # Reasoning/thinking tokens stream BEFORE the answer. Forward
                # them as a separate ``reasoning`` event so the UI can show
                # "Thinking" live; they are ephemeral (not persisted) and never
                # part of the answer.
                reasoning = getattr(delta, "reasoning", None)
                if reasoning:
                    yield {"type": "reasoning", "text": reasoning}

                content = delta.content
                if content:
                    # First answer token: flip the UI out of "thinking"/"searching"
                    # into "generating" exactly once, on every path (a no-tool
                    # query never runs the post-tools emission below).
                    if not generating_emitted:
                        yield {"type": "phase", "phase": "generating"}
                        generating_emitted = True
                    answer_parts.append(content)
                    yield {"type": "delta", "text": content}

                # Accumulate any tool_call fragments on this chunk. The id and
                # name arrive once; arguments stream as concatenated fragments.
                for tc in getattr(delta, "tool_calls", None) or []:
                    idx = tc.index if tc.index is not None else 0
                    slot = tool_calls_acc.setdefault(
                        idx, {"id": None, "name": None, "arguments": ""}
                    )
                    if tc.id:
                        slot["id"] = tc.id
                    fn = getattr(tc, "function", None)
                    if fn is not None:
                        if fn.name:
                            slot["name"] = fn.name
                        if fn.arguments:
                            slot["arguments"] += fn.arguments

                # Flush the title as soon as it's ready, overlapped with the
                # stream rather than serialized ahead of it.
                if not title_emitted:
                    title_event = await _drain_title()
                    if title_event is not None:
                        title_emitted = True
                        yield title_event
        except Exception:
            # A streaming failure must not crash the turn. Break out; the
            # fallbacks below surface a graceful message if nothing streamed.
            logger.exception("Streaming completion failed; ending tool loop")
            break

        # Materialize accumulated tool calls in their streamed order.
        tool_calls = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]

        if not tool_calls:
            # No tools requested: the answer already streamed in this iteration.
            # We're done.
            break

        # Record the assistant's tool-call message so the tool results attach to
        # the right call ids.
        messages.append({
            "role": "assistant",
            "content": "".join(answer_parts) if answer_parts else "",
            "tool_calls": [
                {
                    "id": tc["id"] or f"call_{i}",
                    "type": "function",
                    "function": {
                        "name": tc["name"] or "",
                        "arguments": tc["arguments"] or "{}",
                    },
                }
                for i, tc in enumerate(tool_calls)
            ],
        })
        # The streamed deltas (if any) belonged to a tool-deciding turn, not the
        # final answer; reset so they don't leak into the result.
        answer_parts = []

        if not searched_emitted:
            yield {"type": "phase", "phase": "searching"}
            searched_emitted = True

        for i, tc in enumerate(tool_calls):
            name = tc["name"] or ""
            # Include the iteration in the fallback id so a provider that omits
            # tool-call ids can't collide across tool-loop iterations — the id is
            # also the message-history tool_call_id (below), where a duplicate is
            # independently invalid, and the client keys timeline cards by it.
            tc_id = tc["id"] or f"call_{iteration}_{i}"
            raw_args = tc["arguments"] or "{}"
            try:
                args = json.loads(raw_args) if raw_args.strip() else {}
                if not isinstance(args, dict):
                    args = {}
            except (json.JSONDecodeError, TypeError):
                logger.warning(f"Failed to parse tool args for {name}: {raw_args!r}")
                args = {}

            yield {"type": "tool_call", "id": tc_id, "name": name, "input": args}

            result_text, sources = await execute_tool(
                name, args, client_id, access_token, project_id
            )
            collected_sources.extend(sources)

            yield {"type": "tool_result", "id": tc_id, "name": name, "output": {
                "sources": [
                    {"filename": s.get("filename"), "page_number": s.get("page_number")}
                    for s in sources
                ],
                "text": (result_text or "")[:1200],
            }}

            messages.append({
                "role": "tool",
                "tool_call_id": tc_id,
                "content": result_text,
            })

        # We ran tools; the next iteration produces the (streamed) answer with
        # tool results in context. Flip the UI out of "searching".
        if not generating_emitted:
            yield {"type": "phase", "phase": "generating"}
            generating_emitted = True
    else:
        # Loop exhausted iterations without the model settling on an answer.
        logger.info(
            f"Tool loop hit MAX_TOOL_ITERATIONS ({MAX_TOOL_ITERATIONS}); "
            "forcing a final tool-free generation"
        )

    # If we ran tools but never produced an answer (loop exhausted still asking
    # for tools, or a mid-loop stream error), force one final streamed answer
    # WITHOUT tools so a tool-happy model still answers instead of erroring out.
    if not answer_parts and any(m.get("role") == "tool" for m in messages):
        if not generating_emitted:
            yield {"type": "phase", "phase": "generating"}
            generating_emitted = True
        try:
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
                reasoning = getattr(delta, "reasoning", None)
                if reasoning:
                    yield {"type": "reasoning", "text": reasoning}
                content = delta.content
                if content:
                    answer_parts.append(content)
                    yield {"type": "delta", "text": content}
        except Exception:
            logger.exception("Forced final generation failed")

    # Re-dedupe in case the final iteration added sources after the last refresh.
    deduped_sources = []
    seen_keys = set()
    for s in collected_sources:
        key = f"{s.get('filename')}:{s.get('page_number')}"
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped_sources.append(s)
    collected_sources = deduped_sources

    # If the title never got a chance to flush during the stream (e.g. an early
    # break or a slow first chunk), await it now so the frontend can still name
    # the chat. Bounded by generate_title's own internal fallback.
    if not title_emitted and title_task is not None:
        try:
            title = await title_task
        except Exception:
            logger.exception("Title task failed; skipping title event")
            title = None
        if title:
            yield {"type": "title", "title": title}

    full_answer = "".join(answer_parts).strip()
    if not full_answer:
        full_answer = "I was unable to generate a response. Please try rephrasing your question."
        yield {"type": "delta", "text": full_answer}

    yield {
        "type": "result",
        "answer": full_answer,
        "sources": collected_sources,
    }
