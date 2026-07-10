# UTSBI Client Portal — Whole-Codebase Audit: Final Report

*Scope: Next.js frontend, FastAPI Explore backend, Supabase/Postgres. Findings below are de-duplicated and merged across per-area and cross-cutting passes.*

---

## 1. Executive Summary

The portal is a capable, feature-rich multi-tenant product with genuinely advanced infrastructure already in place (a streaming tool-calling RAG agent, a parent/child chat branch tree, per-request RLS clients, hybrid retrieval + reranking). Overall security posture is reasonable — most surfaces are auth-gated and RLS-scoped, and a recent hardening pass (PR #80) closed real gaps. However, the audit surfaced **two true cross-tenant integrity bugs, one fully-broken headline feature, and a pervasive set of performance and consistency issues** concentrated in the chat/RAG hot path and the design-token layer.

**Act on these now:**

1. **Cross-tenant message write (CRITICAL/HIGH security).** The `messages` UPDATE RLS policy re-checks only `sender_uid`, letting any authenticated sender re-parent their own message into *any* conversation — including ones they cannot read. Add `is_conversation_participant(conversation_id)` to the `WITH CHECK`.
2. **Chat attachments are silently dropped before the model (HIGH feature break).** Users attach PDFs/DOCX, the client re-uploads them every turn, the backend accepts them — and `graph.py` never injects them into the model context. A headline feature does nothing while costing full upload bandwidth each turn.
3. **Attachment/storage RLS stranded on dead columns (HIGH).** The messaging rebuild moved to a participant model but four attachment/storage policies still key on `client_profile_id`/`director_profile_id`, which the RPC no longer populates — so attachments are broken for every new/internal conversation.
4. **RAG vectors are dimensionless `public.vector` with no ANN index.** Every document search is a full sequential scan that cannot be indexed until the column is re-typed. This is the scaling ceiling under every RAG-dependent feature.
5. **Two cross-tenant content-injection gaps via trusted client input:** questionnaire `submitForm`/`saveDraft` accept arbitrary `projectId`/`formId`, and the reports `POST` skips the membership re-check its own `GET` performs.

Quick wins (open redirect, `img` sanitization, dropdown a11y, dead token blocks, `asyncio.gather`/`to_thread` fixes) are cheap and high-value; the larger items (token-system consolidation, chat-route write collapse, RAG re-embedding, write-tool copilot) are where the durable leverage is.

---

## 2. Security

Severity-sorted. Critical/high are called out first.

| # | Sev | Issue | File |
|---|-----|-------|------|
| S1 | **HIGH** | `messages` UPDATE policy re-checks only `sender_uid` → cross-tenant message injection/relocation, forged `sender_role`/`reply_to_id` | `supabase/migrations/20260101000000_baseline_schema.sql:627-628` |
| S2 | **HIGH** (authz design) | Three divergent `requireDirector` gates (global `profiles.role` vs per-project `project_members.role`; one uses RLS-bypassing admin client) | `settings/actions.ts:43`, `questionnaire/actions.ts:40`, `finances/actions.ts:13` |
| S3 | MED | `submitForm`/`saveDraft` trust client `projectId`/`formId`; RLS only checks `user_id` → submit any active form, tag rows into a victim project | `questionnaire/actions.ts:267-350`; RLS `20260606000000:228-237` |
| S4 | MED | Public form password gate: no Turnstile, no rate limit, runs on service-role client; submit path also checks password *before* Turnstile (validity oracle) | `lib/questionnaire/public.ts:139-151` |
| S5 | MED | Google OAuth refresh/access tokens stored plaintext in `profiles.config` jsonb | `api/contact/auth/google/callback/route.ts:103-119` |
| S6 | MED | Reports `POST` skips the membership re-check its `GET` does; trusts client `project_id`/`customer_id`; no length caps on title/message | `api/reports/route.ts:184-257` |
| S7 | MED | Office/zip docs (docx/pptx/xlsx) parsed with no decompressed-size bound → zip-bomb / OOM (only 10 MB on-wire cap) | `backend/.../services/pdf_parser.py:53` |
| S8 | MED | Cost-bearing endpoints have inconsistent throttling: `/api/chat` + `/api/transcribe` have none; backend limiter is keyed on the rotating raw JWT (bypassable by refresh, leaks tokens into memory) | `core/limiter.py:18`; `api/chat`, `api/transcribe` |
| S9 | MED | Mutation authz inconsistent: gated server actions vs ungated browser-client writes (`tickets`) leaning on permissive RLS | `reports/use-reports.ts:36`; `lib/supabase/requests.ts:163` |
| S10 | LOW | Reports/tickets browser writes: any project member (incl. client owners) can mutate any ticket field / move `project_id` | `use-reports.ts:36-51`; RLS `20260606000000:113-126` |
| S11 | LOW | Open redirect via unvalidated `next` after OTP verify | `app/auth/confirm/route.ts:10,21` |
| S12 | LOW | No `img` override on markdown renderer → model/RAG-authored `![](http://…)` is an uncontrolled egress/tracking channel (the `a` path is allowlisted; images aren't) | `components/.../ChatMessage.tsx:137-257` |
| S13 | LOW | `/api/chat` body unbounded (attachments base64 + history); only `query` validated (platform 4.5 MB cap + RLS self-scope mitigate) | `api/chat/route.ts:62-217` |
| S14 | LOW | Client `history` trusted for both fork-point selection and model context (self-scoped jailbreak / branch spoof) | `api/chat/route.ts:142-194` |
| S15 | LOW | `custom_form_schemas` SELECT `USING (true)` exposes every tenant's form definitions (title/description/fields) to any authenticated user | `baseline_schema.sql:730-731` |
| S16 | LOW | Retrieved doc/tool text injected into system/tool roles with no delimiting → indirect prompt injection (RLS bounds blast radius to own project) | `backend/.../agents/graph.py:148,290` |
| S17 | LOW | `match_client_knowledge` uses `SET search_path TO 'public'` (omits `pg_temp`), deviating from the project's hardening standard | `20260613000003:36` |
| S18 | LOW | RAG read path runs on RLS-bypassing service-role client; isolation rests entirely on Python-built params (currently sound, no DB backstop) | `services/rag_service.py:7` |
| S19 | LOW | `/documents/list` on service-role client with unbounded `limit` query param | `documents.py:205` |
| S20 | LOW | Expensive doc endpoints (`index-file`, `by-file`, `indexed`, `list`) have no rate limit (cost amplification; index-file is director-gated) | `documents.py:237` |
| S21 | LOW | Unauthenticated ICS endpoint mints `.ics` files from portal origin (escaping is sound; concern is open/unthrottled content generation) | `api/contact/calendar/.../ics/route.ts:31-75` |
| S22 | LOW | Permissive defaults: `ALLOWED_HOSTS="*"`; credentialed CORS with wildcard methods/headers (origins are allowlisted, so not currently exploitable) | `core/config.py:24`; `main.py:35-37` |

**Most urgent:** S1 (real cross-tenant write), S2 (authz-model split with an RLS-bypassing variant), and S3/S6 (cross-tenant content injection through trusted client ids). S5 and S7 are the highest-value defense-in-depth items.

---

## 3. Performance

Sorted by impact. Most of the heavy items cluster on the **chat/RAG end-to-end waterfall**.

### Systemic / high-impact

- **HIGH — Chat first-byte blocked behind 5-8 sequential Supabase round-trips.** Before the backend fetch even starts, the route serially awaits `getUser → getSession → session select/insert → full message-tree read → user insert → leaf update → assistant pre-create → advanceActiveLeaf`. On serverless this adds 200-400 ms+ of dead air per turn. *Fix:* collapse user-insert + leaf-advance + assistant pre-create into one RPC; start the backend fetch in parallel with non-blocking persistence. (`api/chat/route.ts:78-309`)
- **HIGH — RAG vectors are dimensionless with no ANN index.** `client_knowledge.embedding`/`legal_documents.embedding` are bare `public.vector`; `match_client_knowledge` does `ORDER BY embedding <=> _query` → sequential scan, and pgvector *cannot* index a dimensionless column. Compounded: 4096 dims exceeds pgvector's 2000-dim index limit. *Fix:* re-type to `vector(N≤2000)` (or `halfvec`), add HNSW `vector_cosine_ops`, re-embed. (`baseline_schema.sql:306,315`)
- **MED — Backend auth = blocking, uncached GoTrue call on the event loop.** `_validate_bearer` calls synchronous `supabase.auth.get_user(token)` inside an `async def`, not wrapped in `to_thread`, on every request (membership.py *does* wrap its queries — this path diverges). *Fix:* verify the JWT locally with `SUPABASE_JWT_SECRET` (already in env, not yet in `Settings`), or at minimum `to_thread` + short-TTL cache. (`api/deps.py:43`)
- **MED — Synchronous supabase-py calls block the loop broadly.** Same anti-pattern in `rag_service` (rpc/insert/text_search), `documents.py` (list/delete/select), and PDF/DOCX parsing (`extract_text_with_metadata`, `docx.Document`) all run inline in async handlers. *Fix:* `asyncio.to_thread` (or process pool for CPU-bound parsing). (`deps.py`, `rag_service.py`, `documents.py`, `chat.py:122`)
- **MED — Entire message tree re-read unbounded every turn.** `.eq("session_id", …)` with no limit, materialized into JS maps to walk the ancestor chain; grows linearly with conversation length. *Fix:* maintain `active_leaf_id` authoritatively; resolve the path with a bounded recursive CTE. (`api/chat/route.ts:145-196`)
- **MED — Every turn re-sends full history + ALL attachment base64** to the stateless backend; a couple of 10 MB docs re-upload tens of MB per message and re-persist into each user row. *Fix:* persist attachments once (keyed by hash/id), send references; bound/de-dup history. (`chat-context.tsx:327-367`)
- **MED — `active_leaf_id` read-modify-write TOCTOU** across three code paths (the inline user-row update uses a stale request-start snapshot). *Fix:* funnel all writes through one atomic `jsonb_set` UPDATE/RPC under a row lock. (`api/chat/route.ts:238-276`)

### RAG retrieval / ingestion

- **MED — Vector and keyword search run serially** (then rerank adds a third serial hop). *Fix:* `asyncio.gather` vector + keyword; keyword arm can start during embedding generation. (`rag_service.py:147-161`)
- **MED — Keyword FTS has no GIN tsvector index and no `.limit()`** — fetches all matching rows then slices in Python (the ILIKE fallback *does* limit; inconsistent). *Fix:* functional GIN index on `to_tsvector('english', content)` + push `LIMIT` into the query. (`rag_service.py:319-336`)
- **MED — `store_document` embeds + inserts chunks one-at-a-time sequentially** (2N round-trips for an N-chunk PDF). *Fix:* batch-embed (list input) + single bulk insert; ingest in background. (`rag_service.py:64-91`)
- **MED — New Supabase/httpx client built per tool call + membership re-resolved (2 queries) per tool.** *Fix:* one RLS client per turn (DI), resolve `scoped_project_ids` once per turn. (`tools.py:685`; `membership.py:92-117`)
- **LOW — Live-data tools in one iteration execute serially** despite being independent reads → use `asyncio.gather`, emit events in stable order. (`graph.py:259-294`)
- **LOW — No per-LLM-call timeout; reasoning effort forced on every iteration** including tool-deciding turns whose streamed text is discarded. *Fix:* per-call timeout; only enable reasoning on the final answer pass; bound `generate_title` with `max_tokens`. (`graph.py:165-172,316-321`)

### Dashboard / DB / client

- **MED — Lifecycle `fetchProjects` loads ALL `lifecycle_tasks` unfiltered** (with joins), then filters in JS — for a director this pulls the whole table per page load. *Fix:* `.in("lifecycle_project_id", ids)`. (`lifecycle/api.ts:48-92`)
- **MED — Missing `messages(conversation_id, created_at DESC)` index** for thread-load and `latest_conversation_messages()`. (`baseline_schema.sql:162-164`)
- **MED — No caching layer anywhere** (JWTs, query embeddings, RSC/data cache, idempotent GETs). *Fix:* JWT-validation cache, embedding cache keyed on normalized query, Next `unstable_cache` for static dashboard reads. (`rag_service.py:29-47`)
- **LOW — Director auto-link materializes a `project_members` row per director × project** (D×P write amplification; makes membership a poor authz boundary). Consider deriving director-wide access from `is_director` instead. (`baseline_schema.sql:449-487`)
- **LOW — `DataTable` does all filter/sort/paginate client-side** over the full dataset, no virtualization; index-based entrance stagger scales with page size. *Fix:* optional server pagination + `react-virtual`. (`data-table.tsx:298-392`)
- **LOW — Heavy client bundle:** three.js + react-three-fiber/drei + recharts + two icon libs. Ensure 3D is `next/dynamic ssr:false` and route-split; run bundle-analyzer. (`next.config.ts:38-46`)
- **LOW — `client-events` route fans out sequential Google Calendar calls** (`maxResults 2500`) per director. *Fix:* `Promise.all`, narrow `maxResults`. (`api/contact/calendar/client-events/route.ts:180-269`)
- **LOW — Files recursive collector** caps `list()` at 1000 with no pagination → large folders silently truncated on delete/move (correctness, not just perf — see §5). (`files/storage.ts:174-197`)

---

## 4. Design Consistency

Grouped by theme. The dominant story is **duplicated logic across boundaries** and a **fragmented design-token/component layer**.

### Theme A — Design tokens & theming (highest visual-consistency risk)
- **MED — Two conflicting color-token blocks in `globals.css`:** an HSL `@layer base` set (`--radius:0rem`) and a *second, unlayered* OKLCH set (`--radius:0.625rem`). Unlayered rules win, so the entire alphabetized-and-canonical-looking HSL block is dead code, and the real radius is non-obvious. (`globals.css:36-91,265-332`)
- **MED — shadcn surfaces resolve near-white on the forced-dark app** unless `.dark` is set. `<html>` is hardcoded `#050807`, but `defaultTheme="system"`, so a light-OS visitor gets light `:root` tokens; the team already patched one symptom inline (the prose-ai code-chip comment). *Fix:* force `.dark`/`defaultTheme="dark"`, then audit `bg-card`/`bg-muted`/`bg-popover` usage. (`globals.css:265-298,339-345`; `layout.tsx:107`)
- **MED — Three overlapping token vocabularies** (`sbi-*` hand-rolled + shadcn HSL + shadcn OKLCH); components mix them (dropdowns use `sbi-*`, ui primitives use shadcn tokens). Collapse to one system and one `--radius`.
- **LOW — Inconsistent border-radius across primitives** (square Input, `rounded-md` Select, `rounded-xl`/`rounded-lg` dropdowns, `rounded-full` pill) — none consume the `--radius` token. (`input.tsx:10-15`)

### Theme B — Duplicated components / vocabularies
- **MED — Two divergent `SearchableDropdown`s**, both live (lucide vs phosphor icons, different radii/padding/hover tokens; ui/ variant silently drops `placeholder`). Promote one to `components/ui/`, delete the other, re-point 3 import sites. (`components/ui/` vs `components/data-table/searchable-dropdown.tsx`)
- **MED — Shared dropdowns lack ARIA/keyboard semantics** that `contact-subject-dropdown.tsx` already implements correctly (`aria-haspopup`, `role=listbox/option`, arrow/enter/escape). Reuse that pattern or adopt Radix Select.
- **MED — `status-pill` defines a status/color map parallel to (and inconsistent with) Badge variants** — literal `text-blue-400/amber-400/red-400` vs token-driven `bg-destructive`. Define one status→intent token mapping both consume. (`status-pill.tsx:26-52`; `badge.tsx`)
- **MED — Off-brand hardcoded teal** `rgba(45,212,191)` used as the brand accent in `decorative-element.tsx`/`strategy-card.tsx`, where the brand green is `#22c55e`. Use `color-mix`/`rgb(34 197 94 / N)`. (`decorative-element.tsx`)
- **LOW — Icon library split:** ~89 files lucide vs ~8 phosphor, mixed *within* the data-table subsystem (different stroke weights sit side-by-side). Standardize, codemod the minority.

### Theme C — Cross-boundary logic duplication (latent drift bugs)
- **MED — Three incompatible server-action result shapes:** `{error?}` (finances) vs discriminated union + guard (questionnaire) vs ad-hoc inline unions (settings). Standardize on one `Result<T>` union. (`finances/types.ts`, `questionnaire/action-types.ts`, `settings/actions.ts`)
- **MED — Inlined Supabase client construction bypasses `lib/supabase/{admin,server}`** (settings `getAdminClient`, reports route, google callback) — drops `server-only`, hardened auth options, and typed `Database`. Route all through the canonical helpers; add a lint rule banning direct `createClient` imports outside `lib/supabase/*`.
- **MED — User enums live in the Supabase-managed `extensions` schema** (collision/least-privilege risk; includes a quoted `"status enum"`). Plan `ALTER TYPE … SET SCHEMA public`. (`baseline_schema.sql:48-80`)
- **MED — No `supabase/config.toml`; baseline reconstructed by prod introspection** → non-reproducible local stack and live/VCS drift exactly where RLS bugs hide. Commit config, run `db diff` against prod, treat migrations as source of truth. (`baseline_schema.sql:1-34`)
- **LOW — Actor resolution + stream-coalescing each implemented twice** (server `resolve-actor.ts` vs client `project-context.tsx`; route vs `chat-context.tsx`). Hoist to one isomorphic pure module each. (`resolve-actor.ts:22-101`; `route.ts:501-617`)
- **LOW — `refreshBranchMeta` grafts dbId/branch metadata positionally** and silently no-ops on equal-length divergence → stale dbIds until full reload. Key on a stable correspondence. (`chat-context.tsx:379-425`)
- **LOW — Lifecycle data layer pervasively `any`-typed** across Supabase join rows, against the repo's strict-mode mandate. (`lifecycle/api.ts:21-46`)

### Theme D — DB modeling
- **LOW — `tickets` mixes denormalized free-text (`project`, `director`, `name`, `assign_to`…) with `project_id` FK** — dual representation can drift. Pick one source of truth. (`baseline_schema.sql:206-230`)
- **LOW — `messages.sender_role` is free text** (no CHECK/FK), duplicating `conversation_participants.role_at_join` and forgeable via S1. Constrain or drop. (`baseline_schema.sql:149-168`)

### Backend correctness/robustness (design-adjacent)
- **MED — Streamed prose discarded when an iteration also requests tools:** tokens shown mid-stream are stored as the assistant tool-message and `answer_parts` reset, so the persisted answer omits prose the user already saw (plus generating→searching→generating flicker). Buffer deltas until the iteration is known tool-free. (`graph.py:194`)
- **LOW — Mid-stream LLM exception breaks the loop with only a generic fallback**; no transient-error distinction, no retry. (`graph.py:220`)
- **LOW — Per-iteration source re-numbering can drift cited `[n]` indices.** Freeze index at first append. (`graph.py:137`)
- **LOW — RRF fusion keys on a nullable doc id** → multiple `None`-id docs collapse into one bucket, corrupting ranking. Skip id-less candidates. (`rag_service.py:169`)
- **LOW — `upload_document` dereferences `file.filename` without a None guard** → 500 instead of 400; `/chat/extract-text` already guards (inconsistent). (`documents.py:136`)
- **LOW — `/documents/list` ignores project sharing model** (uid-only filter on service client) → omits project-shared docs the user can actually retrieve. (`documents.py:205`)
- **INFO — Service-role client built at import from a possibly-empty secret**, no startup validation → silently behaves as anon. Add a fail-fast secrets check. (`db/supabase.py:6`)
- **INFO — Dead code:** `get_optional_user_id` unused; weakens the no-anonymous invariant if wired by mistake. (`deps.py:96`)

---

## 5. Feature Improvements (harden existing)

- **HIGH — Wire chat attachments into the model context.** `graph.py:61` does `attachments = attachments or []` and never uses them; the whole upload→accept→persist pipeline is dead-ends before the LLM. Inject via `build_context_string(attachments=…)` (or prepend extracted text), respecting the existing char caps. Add a contract round-trip test. (`graph.py:61`; `chat-context.tsx:327-367`)
- **HIGH — Retarget attachment/storage RLS to the participant model.** Four policies still key on the no-longer-populated `client_profile_id`/`director_profile_id`, breaking attachments for all RPC-created (member↔member / director↔director) conversations. Switch to `is_conversation_participant(conversation_id)`; then backfill/deprecate the legacy columns. (`20260604000000_harden_storage_insert.sql:61-69`)
- **MED — Orphaned empty assistant row on backend failure.** The assistant row is pre-created (content="") and `active_leaf` advanced *before* the backend fetch; the two early-return error paths skip the `finally` cancel-fallback, leaving a non-cancelled blank bubble with no retry. Defer pre-create until `backendRes.ok`, or delete/mark-cancelled on the error paths. (`api/chat/route.ts:285-341`)
- **MED — Streamed-row writes in `finally` may not survive client disconnect on serverless** → same blank-bubble outcome. Persist via `waitUntil`/`after` so completion doesn't depend on the client stream. (`api/chat/route.ts:588-647`)
- **MED — `updateAccount` role change wipes ALL `project_members`,** but the director auto-link trigger is INSERT-only and the owner-link isn't re-established. A promoted director loses Finances access on every project; a client's `owner` row is destroyed, orphaning the project. Backfill on role change (or trigger on `UPDATE OF role`); never blanket-delete owner rows. (`settings/actions.ts:230-232`)
- **MED — Recursive folder collect truncates at `limit:1000`** with no pagination → `deleteFolder`/`moveFolder` silently split large folders. Paginate `list()` or assert on full pages. (`files/storage.ts:174-197`)
- **MED — Hybrid retrieval has no relevance floor and fabricates keyword scores** (`similarity_threshold=0.0`, constant `0.5`/`0.3` surfaced as `relevance_score`); quality rests entirely on a best-effort reranker that returns unfiltered top-k on failure. Add a non-zero vector floor, compute real `ts_rank`, stop presenting constants as confidence. (`rag_service.py:95`)
- **LOW — `extract-text` guesses encoding for unknown/binary types** (`decode('utf-8', errors='ignore')` → garbage into the prompt) and routes legacy `.doc` to python-docx (raises). Reuse `pdf_parser.extract_text`, whitelist real content types. (`chat.py:134`)
- **LOW — `get_calendar_events` is a permanently-stubbed tool** still advertised to the model — it burns a tool-loop iteration to dead-end. Wire it or remove from `TOOLS`/prompt. (`tools.py:633`)
- **LOW — Debounced incremental write can land after the final `result`,** dropping sources. Add a post-result guard or always carry last-known sources. (`api/chat/route.ts:363-388`)
- **MED — `MagneticButton` renders raw `<a>` for internal links** (full reload, no prefetch) and has no `focus-visible` ring. Use `next/link` for internal hrefs, add focus styles, move className into `cn()`. (`magnetic-button.tsx:42-65`)
- **MED — Login page uses native `alert()`** (a `<Toaster>` is mounted), gates forgot-password behind 2 failed attempts, hand-builds inputs, and ships commented-out dead JSX. Use `toast.success`, always show the reset link, reuse the shared field component. (`(static)/login/page.tsx:105,140-145,260`)

---

## 6. New Ideas (prioritized: value vs effort, strongest first)

| Rank | Idea | Value / Effort | Why now |
|------|------|----------------|---------|
| 1 | **Fix RAG vector dimensionality + add ANN index** | High / M (+ re-embed) | Hard ceiling under *every* RAG feature below; everything else compounds on it |
| 2 | **Inline document citations + source viewer** | High / S-M | `search_documents` already returns source metadata; deep-link chips into the files portal — turns ungrounded prose into auditable answers |
| 3 | **Voice conversation mode for Explore** | High / S | `/api/transcribe` (AssemblyAI) + the answer stream already exist; add mic-in + streamed TTS-out. Highest delight-per-LOC (gate the transcribe route as part of this) |
| 4 | **Scoped WRITE tools (action copilot)** | Very high / M | The entire tool loop + per-request RLS client + server-side `project_id` scoping is built; add `create_request`/`draft_report`/`log_finance_transaction` behind a confirm-card UI. Converts "smart search box" → copilot. Pair with idea #10 (audit feed) |
| 5 | **Auto-fill questionnaires from RAG + prior answers** | High / M | Directly attacks the portal's biggest client-friction point; reuses RAG + questionnaire schema; human-in-the-loop accept/edit chips |
| 6 | **Proactive weekly "Project Pulse" briefing (agent + cron)** | High / M | Every read tool needed already exists; a cron + the agent flips the portal from passive to proactive — big engagement lift |
| 7 | **Global semantic Cmd-K command palette** | High / S-M | Six siloed data domains, no unified "find that thing"; mostly orchestration over existing retrieval |
| 8 | **Decision-branch log on the existing message tree** | Med / M | Near-unique capability — the parent/child branch tree already exists, used only for edit/regen. Harden the `active_leaf_id` RMW first |
| 9 | **Document → structured-data extraction pipeline** | Med / M-L | Second pass at index-file extracts dates/amounts/parties into a review queue → removes manual re-keying. Pair with zip-bomb hardening (S7) |
| 10 | **Unified notification center** | Med / S-M | Natural delivery surface for #4/#6; `notifications.ts` exists but events are scattered |
| 11 | **Project health score + trend dashboard** | Med / M | Rolls existing aggregates into one "is this project healthy?" signal |
| 12 | **Finance burn-rate forecasting + threshold alerts** | Med / M | Converts bookkeeping into decision support; feeds #6/#10 |
| 13 | **Agent-drafted reports with human approval** | Med / M | Pre-fills `NewReportModal` from read tools + RAG; pairs with #4 |
| 14 | **Two-way calendar sync (ICS first)** | Med / S-M | Calendar auth route exists; ICS subscription URL is a cheap first step |
| 15 | **Per-project activity/audit feed** | Med / S-M | Trust + support value, and a **prerequisite for safely shipping #4's write tools** |

---

## 7. Prioritized Action Plan

### Phase 0 — Critical correctness & security (do first)
1. **S1:** Add `is_conversation_participant(conversation_id)` to the `messages` UPDATE `WITH CHECK`; pin immutable columns. *(cross-tenant write)*
2. **Feature/HIGH:** Retarget the four attachment/storage RLS policies to the participant model. *(attachments broken for all internal convos)*
3. **Feature/HIGH:** Inject chat attachments into the model context in `graph.py` (or remove the contract until implemented) + round-trip test.
4. **S3 / S6:** Verify project membership + assignment server-side in `submitForm`/`saveDraft` and in the reports `POST`; add length caps. Mirror in RLS.

### Phase 1 — Quick wins (cheap, high-value, mostly local)
5. **S11:** Allowlist `next` to relative same-origin paths in `auth/confirm`.
6. **S12:** Add an `img` override to the markdown renderer.
7. **S15:** Scope `custom_form_schemas` SELECT to membership/ownership.
8. **S17:** Align `match_client_knowledge` `search_path` to the project standard.
9. **Perf quick wins:** `asyncio.gather` for vector+keyword search and for same-iteration tool calls; `to_thread` (or local JWT verify) for auth + parsing; `.limit()` on keyword FTS; add the `messages(conversation_id, created_at DESC)` index.
10. **Backend robustness:** `file.filename` None guard; RRF skip id-less docs; startup secrets validation; remove dead `get_optional_user_id`/stubbed `get_calendar_events`.
11. **Design quick wins:** delete the dead HSL token block + pick one `--radius`; force `.dark`/`defaultTheme="dark"`; replace login `alert()` with toast; `MagneticButton` → `next/link` + focus ring.

### Phase 2 — Defense-in-depth & hardening
12. **S2:** Extract one canonical authz module (`requireDirector` / `requireProjectDirector`); converge all three call sites; stop using the admin client for authz. *(also resolves a HIGH design split)*
13. **S8:** One rate-limit strategy keyed on the stable `sub`; apply to `/api/chat`, `/api/transcribe`, the public password gate (+ Turnstile, reorder before password check); never key on the raw token.
14. **S5:** Encrypt Google OAuth tokens at rest (or move to an RLS-locked secrets table).
15. **S7:** Bound decompressed size / element counts before parsing Office docs; run parsing in a bounded worker.
16. **S9/S10:** Move ticket/report browser writes behind gated server actions; tighten the `tickets` UPDATE policy.
17. **Files truncation:** paginate `list()` so delete/move can't silently split folders.

### Phase 3 — Structural / larger-leverage
18. **Chat route:** collapse the 5-8 sequential writes into one RPC, run backend fetch in parallel, make `active_leaf_id` writes atomic, bound the message-tree read. *(largest single latency win)*
19. **Stop re-sending attachments every turn:** persist once keyed by hash, send references; bound history.
20. **RAG ingestion/retrieval:** batch-embed + bulk-insert; one RLS client + cached membership per turn; add the GIN tsvector index; add a similarity floor + real keyword ranks.
21. **Design-system consolidation:** one token vocabulary, one `SearchableDropdown` (with ARIA/keyboard), one status→intent mapping, one icon library, one `Result<T>` action shape, canonical Supabase client helpers + lint rule.
22. **DB hygiene:** commit `supabase/config.toml`, `db diff` against prod, move enums out of `extensions`, reconcile the director auto-link materialization.

### Phase 4 — Product bets (sequence per §6 ranking)
23. **Idea #1** (RAG dimensionality fix — unblocks the rest) → **#2** citations → **#3** voice → **#4** write tools (with **#15** audit feed) → **#5/#6/#7**, then the remaining engagement features.

---

*Note on severity calibration: several findings were down-rated from their initial ratings during verification because exploitation requires an authenticated tenant account, RLS confines blast radius to the caller's own scope, or a platform/SameSite control already mitigates the stated vector. The HIGH/CRITICAL items above (S1, attachment-RLS, attachment-drop) are the ones that survived that scrutiny as genuine cross-tenant or full-feature-loss defects.*