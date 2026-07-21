# Messaging — Production Hardening Punch List

State today: real-time chat with optimistic send/edit/delete, server-side
read tracking + RLS, attachment previews, name resolution, accessible
toasts. Solid mid-tier. Below is what separates it from Linear/Slack/
Intercom-grade messaging, ordered by impact.

## P0 — Correctness & scale (do before real load)

1. **Thread pagination + windowing.** `loadMessages` selects *every*
   message in a conversation and renders them all. A 2k-message thread
   will jank and blow memory. Fix: paginate (`limit` + `created_at`
   keyset, load-older on scroll-up) and virtualize the list
   (`@tanstack/react-virtual`). This is the single biggest scale gap.

2. **Attachment signed-URL fan-out.** Signed URLs are generated in a
   sequential `for ... await createSignedUrl` loop — N serial round
   trips per thread open (the "attachments load slowly" symptom).
   Near-term: `Promise.all` the batch (done in this pass). Real fix:
   stop per-render signing — store a longer-lived URL or proxy through
   a cached route; lazy-sign only visible attachments; cache by path.

3. **Realtime covers INSERT only.** Edits and deletes do not propagate
   live (`UPDATE`/`DELETE` not subscribed). Other participants see stale
   text / ghost-deleted messages until reload. Subscribe to all three
   events and reconcile by id.

4. **Sidebar is not realtime.** The conversation list never subscribes;
   a new message doesn't move/flag the conversation until reload.
   (Addressed in this pass — keep it on the hardening radar for the
   new-conversation-appears case and ordering correctness.)

5. **Optimistic-id reconciliation.** Optimistic messages use a temp id;
   the realtime echo carries the real id. Dedup is by id, so a sent
   message can briefly double-render before refetch. Reconcile temp →
   real on echo (match by client token).

## P1 — Reliability

6. **No automated tests.** Zero coverage on the highest-churn surface.
   Add: unit tests for read/divider logic, an integration test for
   send→realtime→read, and a Playwright happy-path. No framework is
   configured — Vitest + Playwright.

7. **Error surfacing is uneven.** Send failure has retry; load/edit/
   delete failures are mostly silent or console-only in places. Every
   network path needs a user-visible, retryable state.

8. **Attachment validation.** No client/server size or type ceiling
   beyond the file input `accept`. Add a max size, server-side MIME
   check, and a friendly rejection.

9. **Signed-URL expiry mid-session.** 1h TTL; a long-lived thread shows
   broken images after expiry. Refresh on error or proxy.

10. **Rate limiting / abuse.** No throttle on send or conversation
    creation. Add a lightweight per-user rate limit (DB or edge).

## P2 — Product polish (table-stakes at top tier)

11. Typing indicators (Realtime presence/broadcast).
12. Delivery/read receipts (the `conversation_reads` table already
    gives you the data model for read).
13. Reactions / threaded replies (only if the product wants them).
14. Full-text search across messages.
15. Push/email notification on unread when the user is away.
16. Keyboard-first nav (j/k between conversations, etc.).

## Architecture note (re: "rethink stack")

The stack (Next App Router + Supabase Postgres/Realtime/Storage) is
appropriate and is what comparable products use; it does not need
replacing. The slowness is implementation, not stack: sequential signed
-URL signing, no pagination, no virtualization, and a chatty
fetch-then-sign-then-render path. Fixing P0 #1–#2 removes the perceived
slowness without a rewrite. Revisit the stack only if you outgrow
Supabase Realtime's connection limits at scale (then: dedicated WS
gateway), not before.
