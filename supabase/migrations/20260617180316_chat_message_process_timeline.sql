-- Persist the per-turn "process timeline" (reasoning text + ordered tool
-- steps) so the ProcessTimeline UI survives page reload, tab switch, and the
-- cancel-mid-stream case. Until now these lived only in React state and were
-- discarded on any navigation — making every reloaded turn look "thoughtless"
-- even though the full reasoning + tool lifecycle happened on the server.
--
-- `reasoning` is the concatenated text of every reasoning/thinking chunk the
-- model emitted before its answer. `process_steps` is the ordered list of
-- `reasoning` chunks interleaved with `tool_call` / `tool_result` events — the
-- same shape the live UI builds in memory, persisted as jsonb so a reload can
-- reconstruct the timeline exactly as it streamed.
--
-- Both columns are nullable: existing rows (and rows for turns that used the
-- non-thinking model) simply leave them null, and the UI already falls back to
-- "no timeline" in that case. No RLS changes — the existing session-scoped
-- policies cover any new column on this table.

alter table public.client_chat_messages
  add column if not exists reasoning text;

alter table public.client_chat_messages
  add column if not exists process_steps jsonb;

comment on column public.client_chat_messages.reasoning is
  'Concatenated reasoning/thinking text the model emitted before its answer on thinking-model turns. Null for non-thinking turns.';

comment on column public.client_chat_messages.process_steps is
  'Ordered process timeline for the turn: reasoning chunks interleaved with tool_call/tool_result events. Same shape as the live UI''s TimelineStep[], persisted as jsonb so a reload can reconstruct the timeline exactly as it streamed. Null for non-thinking turns or turns with no tool calls.';
