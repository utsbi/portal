-- Message tree foundation (Claude-style edit/regenerate branching).
--
-- Each chat message gets an optional parent, so a conversation forms a
-- parent/child tree: messages that share a parent_id are alternative *branches*
-- of the same point (e.g. an edited user turn or a regenerated answer). The
-- "active" branch shown to the user is tracked per session via an active_leaf_id
-- pointer in the existing metadata jsonb (walk leaf -> parent -> ... -> root to
-- reconstruct the displayed thread).
--
-- This migration only adds the column + backfills existing history into a single
-- linear branch, so behaviour is unchanged until the branching UI/logic is built
-- on top of it. RLS is unaffected (already scoped to the session owner).

alter table public.client_chat_messages
  add column if not exists parent_id bigint
    references public.client_chat_messages(id) on delete cascade;

create index if not exists client_chat_messages_parent_idx
  on public.client_chat_messages (parent_id);

-- Backfill: each message's parent is the previous message in the same session by
-- time. This linearises existing conversations into one branch; the first message
-- of each session stays a root (parent_id null).
with ordered as (
  select
    id,
    lag(id) over (partition by session_id order by created_at, id) as prev_id
  from public.client_chat_messages
)
update public.client_chat_messages m
set parent_id = o.prev_id
from ordered o
where m.id = o.id
  and o.prev_id is not null;

-- Seed the active branch pointer to each session's latest message.
with last_msg as (
  select distinct on (session_id) session_id, id
  from public.client_chat_messages
  order by session_id, created_at desc, id desc
)
update public.client_chat_sessions s
set metadata = coalesce(s.metadata, '{}'::jsonb)
             || jsonb_build_object('active_leaf_id', lm.id)
from last_msg lm
where s.id = lm.session_id;
