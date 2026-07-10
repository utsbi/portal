# Architecture Review: Chat + RAG System (SBI Portal)

*Generated 2026-07-02 on branch `feat/mobile-responsive`. Scope: `backend/app/explore/**` (FastAPI), `frontend/app/{api,dashboard}/**` (Next.js 16), `supabase/migrations/**`. Verified against the live `sbi` Supabase project (read-only queries). Untracked working doc — do not commit.*

**TL;DR:** You have a well-hardened, two-stage hybrid-retrieval RAG with an agentic tool loop. The confusion is understandable because there are **three distinct "document" paths** that look similar but do different things: (1) the Files portal auto-indexes into `client_knowledge` (persistent, project-shared RAG), (2) the legacy `/documents/upload` PDF path writes to the same table with page metadata, and (3) chat attachments are **never indexed** — they're session-scoped prompt injection via a content-addressed store. The corpus is currently tiny (**42 chunk rows across 2 files, all `source='manual'`, all 4096-dim, 16 with `project_id IS NULL`**), which means the "deferred" vector-index problem can be fixed essentially for free *right now*.

---

## A. CURRENT STATE

### A1. Document ingestion

```
PATH 1 — Files portal (the "drive")                     PATH 2 — Legacy PDF knowledge upload
──────────────────────────────────────                  ─────────────────────────────────────
User drops file in /dashboard/files                     Client → POST /api/knowledge/upload
  │  (frontend/app/dashboard/files/page.tsx)              │ (PDF only, ≤10 MB, project_id req.)
  ▼                                                       ▼
Supabase Storage "Files" bucket                         FastAPI POST /api/v1/documents/upload
  key = {project_id}/{path}                               │ director + member gate
  │                                                       ▼
  │ auto-index if ext ∈ {pdf,txt,md,                    PDFParser.extract_text_with_metadata
  │  docx,pptx,xlsx}  (page.tsx:61-73,568-599)            │ per-PAGE, keeps page_number metadata
  ▼                                                       ▼
POST /api/knowledge/index-file (Next proxy)             store_document() PER PAGE
  ▼                                                       (documents.py:177-186)
FastAPI POST /api/v1/documents/knowledge/index-file
  │ director+member gate (_ensure_director_member)                 │
  │ path-traversal guard (_safe_storage_key)                       │
  │ service-role download from "Files" bucket                      │
  │ extract_text() by extension (pdf_parser.py)                    │
  │ DELETE old (project_id, storage_path) chunks  ← re-index dedup │
  ▼                                                                ▼
        ┌──────────────────────────────────────────────────────────┐
        │ RAGService.store_document (rag_service.py:71-138)        │
        │  1. chunk_text: RecursiveCharacterTextSplitter           │
        │     chunk_size=1000 chars, overlap=200                   │
        │     separators ["\n\n","\n",". "," ",""]                 │
        │  2. ONE batched embeddings call for all chunks           │
        │     model=qwen/qwen3-embedding-8b (OpenRouter)           │
        │     dimensions=4096 (EMBEDDING_DIMENSIONS default)       │
        │  3. ONE bulk INSERT into client_knowledge                │
        │     (service-role client — bypasses RLS; the             │
        │      director/member gate above is the only guard)       │
        └──────────────────────────────────────────────────────────┘
                              ▼
   client_knowledge row: {uid, project_id, content, metadata jsonb
   (filename, chunk_index, total_chunks, [page_number only on Path 2],
   [storage_path on Path 1]), embedding public.vector (UNTYPED),
   storage_path, source ∈ 'portal'|'chat'|'manual'}

PATH 3 — Chat attachments (NOT RAG)
───────────────────────────────────
Composer file → POST /api/chat/extract → FastAPI /chat/extract-text (pdf/doc/docx/txt)
  → returns plain text → frontend SHA-256 hashes it and upserts into
  client_chat_attachments (UNIQUE(uid, content_hash); lib/api/chat.ts:200-235)
  → later turns send {filename, hash}; /api/chat resolves hash→content and
    forwards full text to the stateless backend
  → graph.py injects it as a system block, capped 20,000 chars/file,
    40,000 chars total (graph.py:16-20, 166-192). Never embedded, never stored
    in client_knowledge. Session context only.
```

Key ingestion facts:

- **Parsers** (`backend/app/explore/services/pdf_parser.py`): pypdf (PDF), python-docx (paragraph text only), python-pptx (text frames), openpyxl (TSV rows), UTF-8 decode for `.txt/.md`. Office formats pass a zip-bomb guard (≤200 MB declared, ≤2,000 members, ≤100:1 ratio). Anything else → `{"indexed": false, "reason": "unsupported_type"}`.
- **Chunking inconsistency worth knowing:** Path 2 (`/documents/upload`) extracts per page and stores `page_number` metadata (so citations show "p. 3"); Path 1 (`index-file`) flattens the entire document into one string first — **portal-indexed files have no page numbers**, only `chunk_index`.
- **Delete cascade exists:** deleting a file/folder in the Files portal best-effort calls `DELETE /api/knowledge/by-file` per indexed path (`page.tsx:737-751`). **Rename/move does NOT** — see B3.
- **Writes are service-role** (no RLS); authorization is the explicit director + project-membership check in `documents.py:73-111,147-157`.
- **Live counts** (`SELECT count(*), count(DISTINCT metadata->>'filename') FROM client_knowledge;`): **42 rows, 2 files, 16 NULL-project rows, 0 NULL embeddings, all `vector_dims=4096`, all `source='manual'`** — nobody has actually used the portal auto-index path in prod yet; everything came from the legacy uploader.

### A2. Retrieval (`backend/app/explore/services/rag_service.py`)

```
model calls search_documents(query="...")   ← the LLM writes this query itself
  │                                            (tool schema demands "a focused,
  ▼                                            self-contained search query")
retrieve_relevant(query, project_ids, client_id, strict=project_id is not None)
  │
  ├─ hybrid_search(limit = RERANK_CANDIDATES = 30)   ── asyncio.gather ──┐
  │   │                                                                  │
  │   ├─ VECTOR ARM (limit 60)                    ├─ KEYWORD ARM (limit 60)
  │   │  embed query (1 API call, 4096-dim)       │  keyword_search_client_knowledge RPC
  │   │  match_client_knowledge RPC               │  plainto_tsquery('english'), real
  │   │  (SECURITY DEFINER, service-role-only     │  ts_rank, GIN idx on
  │   │   grant; cosine 1-(<=>);                  │  to_tsvector('english', content)
  │   │   floor MIN_VECTOR_SIMILARITY = 0.30;     │  (20260628000007); scores normalized
  │   │   SEQUENTIAL SCAN — no ANN index)         │  so top hit = 1.0; ILIKE fallback on
  │   │                                           │  RPC failure (first word only)
  │   ▼                                           ▼
  │  RRF fusion: k=60, score = weight/(k+rank+1); vector_weight=0.7,
  │  keyword_weight=0.3; id-less docs skipped; top 30 kept
  │
  ▼
rerank(): POST openrouter.ai/api/v1/rerank, model cohere/rerank-4-pro,
  top_n = RERANK_TOP_N = 8, 15 s timeout. FAILURE MODE: best-effort —
  falls back to pre-rerank order truncated to 8 (never breaks chat).
  │
  ▼
build_context_string(): "[Source: filename (Page n)]\n{chunk}" blocks,
  200,000-char budget → returned as tool result + sources list
```

- **Tenant isolation at retrieval:** `graph.py` resolves the caller's RLS client + `scoped_project_ids()` **once per turn** (`graph.py:98-111`) via `profiles.uid → profiles.id → project_members.project_id` (`membership.py:125-140`); a spoofed `project_id` the caller doesn't belong to yields `[]`. Both search RPCs are `SECURITY DEFINER` with EXECUTE revoked from `anon`/`authenticated` (service-role only), and their WHERE mirrors: `project_id = ANY(_filter_project_ids) OR (uid = _filter_uid AND project_id IS NULL)`. With an active project, `strict=True` drops the uid arm so legacy NULL-project uploads can't leak into a project chat (`rag_service.py:306-340`, `tools.py:685-698`).
- **Caching: none.** Every `search_documents` call = 1 embedding API round-trip + 2 RPCs + 1 rerank call.
- **Query preprocessing:** the raw user message is *not* embedded verbatim — the LLM rewrites it into the tool argument (implicit query-rewriting for follow-ups). No HyDE, no multi-query, no explicit rewrite step.

### A3. Chat loop

```
Browser (chat-context.tsx)
  │ POST /api/chat {query, history, attachments[{hash}], session_id?, project_id?, regenerate?}
  ▼
Next.js /api/chat (frontend/app/api/chat/route.ts)
  │ 1. auth (getUser/getSession)
  │ 2. session resolve/create — project_id FIXED at session creation; existing
  │    sessions always use the STORED project (route.ts:80-92)
  │ 3. IN PARALLEL: chat_begin_turn RPC (atomically inserts user+blank assistant
  │    rows into the parent/child message tree + advances active_leaf_id;
  │    20260628000008) ∥ resolve attachment hashes → full content
  │ 4. fetch FastAPI /api/v1/chat/ (SSE), pump decoupled via after() so
  │    persistence survives client disconnect; debounced 400 ms incremental
  │    writes of {content, reasoning, process_steps}; final `result` event
  │    writes content + sources; abort → partial persisted with is_cancelled
  ▼
FastAPI graph.py run_graph_streaming
  │ model = THINK_MODEL if preference=="thinking" else FAST_MODEL (config.py)
  │ messages = [AGENT_SYSTEM_PROMPT]
  │          + [project-context block]        (membership.get_project_context)
  │          + [attachments block ≤40k chars]
  │          + last 10 history turns + user query
  │ First turn: generate_title() runs as a BACKGROUND task (TITLE_MODEL,
  │   falls back to FAST_MODEL, then to a 60-char query slice) — title event
  │   flushed mid-stream, never blocks tokens
  │
  │ ┌── streaming tool loop, MAX_TOOL_ITERATIONS = 4 ──────────────────┐
  │ │ stream chunk-by-chunk (reasoning → `reasoning` events;           │
  │ │  prose held in a 160-char preface buffer so tool-preface text    │
  │ │  is never shown then retracted)                                  │
  │ │ tool calls? → emit tool_call events, run ALL concurrently        │
  │ │  (asyncio.gather) under the per-turn RLS client, emit            │
  │ │  tool_result, append role:"tool" messages, loop                  │
  │ │ search_documents sources → deduped by filename:page → injected   │
  │ │  as a numbered "Available Sources" system msg (refreshed in      │
  │ │  place) → model cites with [n] markers                           │
  │ │ no tool calls? → that stream IS the final answer                 │
  │ └───────────────────────────────────────────────────────────────── ┘
  │ loop exhausted with no answer → one forced tool-free generation
  ▼
`result` {answer, sources} → persisted to client_chat_messages.sources
  → frontend interpolates [n] into citation chips with hover previews that
    deep-link to /dashboard/files (ChatMessage.tsx:42-135)
```

Tools (`tools.py`): `search_documents` (RAG, the only source-yielding tool), `search_sbi_knowledge` (returns the whole 77-line static `knowledge/sbi.md`), and five live-data reads (`get_lifecycle_status`, `get_questionnaire_status`, `get_reports`, `get_finance_summary`, `get_requests`) that run under the **caller's own RLS JWT client** plus manual project scoping.

**Attachments vs RAG documents — the key distinction:**

| | Chat attachment | RAG document |
|---|---|---|
| Storage | `client_chat_attachments` (full text, SHA-256 content-addressed, `UNIQUE(uid, content_hash)`) | `client_knowledge` (1000-char chunks + 4096-dim embeddings) |
| Scope | The uploading **user**, injected into **that conversation's prompt** | The **project team** — retrieved on demand by any member's chats |
| Retrieval | None — whole text stuffed into a system message (≤20k/file, ≤40k total) | Hybrid vector+FTS+rerank |
| Lifecycle | Referenced by hash per turn; never re-uploaded (0 rows in prod — feature shipped 6/29) | Persistent until file deleted/re-indexed |

### A4. Data model — what client data lives where

| Store | Contents | Rows (live) | Who can read it |
|---|---|---|---|
| `client_knowledge` | RAG chunks + embeddings (untyped `public.vector`, actual 4096-d) + `project_id`, `storage_path`, `source` | **42** (2 files; 16 NULL-project) | App: chat retrieval via service-role RPCs, scoped to membership-verified project ids. Direct RLS (after 20260618000006): project **members** for project rows; uploader or any **director** for NULL-project rows. Writes: service-role only, behind director+member endpoint gates |
| `legal_documents` | Orphaned old RAG arm — content + **3072-dim** embeddings | **611** | **Every authenticated user** (`baseline_schema.sql:763`). **No code path reads it** (only appears in generated `database.types.ts`) |
| Storage bucket "Files" | Raw uploaded files, keyed `{project_id}/{path}` | — | Project-scoped storage RLS (20260613000000); backend downloads via service role for indexing |
| `client_chat_attachments` | Full extracted text of chat uploads, content-addressed | **0** | Owner only (`uid = auth.uid()` RLS) |
| `client_chat_sessions` / `client_chat_messages` | Conversations: content, `sources` jsonb, `attachments` (hash refs), `reasoning`, `process_steps`, `parent_id` branch tree, `active_leaf_id` in session metadata | — | Session owner only (uid-scoped RLS) |
| `knowledge/sbi.md` | Static curated org knowledge, bundled in the backend image | 77 lines | Everyone (returned whole by `search_sbi_knowledge`) |

---

## B. OPTIMIZATION RECOMMENDATIONS (prioritized)

### B1. The vector index problem — fix it NOW, while re-embedding is free ⭐ (Effort: S, Impact: removes the scaling ceiling under every RAG feature)

Current state, verified: `client_knowledge.embedding` is a **dimensionless** `public.vector` (`baseline_schema.sql:315`) holding 4096-dim Qwen3-Embedding-8B vectors; `match_client_knowledge` does `ORDER BY embedding <=> q` → **sequential scan**. The deferral note at `rag_service.py:21-31` is correct about the constraint (pgvector HNSW/IVFFlat: ≤2000 dims for `vector`, ≤4000 for `halfvec`), but its "defer until the corpus grows" logic is backwards on cost: **re-embed cost grows with the corpus, and the corpus is 42 rows today**. The decision only gets more expensive.

Options:

| Option | How | Tradeoffs |
|---|---|---|
| **(a) MRL re-embed at 1536 + `vector(1536)` + HNSW — RECOMMENDED** | Qwen3-Embedding-8B supports Matryoshka custom output dims (32–4096); the code already passes `dimensions` (`rag_service.py:58-59`, `EMBEDDING_DIMENSIONS`) | Tiny quality delta at this corpus size (reranker absorbs most of it), 62% storage cut, indexable, typed column catches dim mismatches at insert |
| (b) 2000-dim `vector(2000)` + HNSW | Same, max headroom within indexable `vector` | Marginal quality gain over 1536; larger index; no real benefit here |
| (c) `halfvec` at high dims | halfvec index limit is **4000 — 4096 still doesn't fit**; would need a `subvector(embedding,1,2048)::halfvec` expression index + matching query-side truncation/renormalization | Most complexity for the least clarity; skip |
| (d) Binary quantization + rescore | `bit()` expression index + reorder | For millions of rows. Not now |

Concrete path (one migration + one script):
1. Verify OpenRouter honors `dimensions=1536` for qwen3-embedding-8b (embed one string, check `len` and unit norm — MRL truncation must come back normalized or cosine breaks).
2. Set `EMBEDDING_DIMENSIONS=1536`.
3. Migration: `ALTER TABLE public.client_knowledge ALTER COLUMN embedding TYPE vector(1536) USING NULL;` then `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops);` (defaults m=16, ef_construction=64 are fine).
4. Backfill: one script batching all 42 contents through `store_document`'s embedding path (a single batched API call), or simply re-run indexing on the 2 source files.
5. Re-validate `MIN_VECTOR_SIMILARITY=0.30` — the 0.0–0.25 noise-band calibration in the comment is for 4096-dim output; truncated dims shift the distribution.
6. Update the `rag_service.py:21-31` comment (it's the documented decision record).

### B2. Retire or lock down `legal_documents` (Effort: S, Impact: privacy + hygiene)
611 rows of 3072-dim embedded content readable by **every authenticated user**, with zero code paths using it (grep confirms only generated types). Its embeddings are dimensionally incompatible with the current 4096-dim query embedding anyway. Export/archive, then drop the table + policy (or at minimum revoke the blanket SELECT).

### B3. Stale index on file **move/rename** (Effort: S, Impact: correctness of the files↔RAG link)
Delete cascades into the corpus (`page.tsx:737-751`), but `moveObject`/`moveFolder`/rename (`page.tsx:681-714`, `useDragMove.ts`) never touch `client_knowledge`. Result: chunks keep the old `storage_path` → the "Indexed" badge disappears for the new path, citation deep-links break, `by-file` delete for the new path finds nothing, and re-indexing at the new path **duplicates content**. Fix: a backend endpoint that does `UPDATE client_knowledge SET storage_path = new WHERE project_id = ? AND storage_path = old` (no re-embed needed), called from the move/rename handlers.

### B4. Chunking quality (Effort: M, Impact: retrieval precision + citation fidelity)
- 1000 chars ≈ ~250 tokens — small; with a reranker in place you can afford 1,500–2,000-char chunks (fewer, more coherent candidates). Measure in tokens, not chars.
- No structural metadata: **no headings, and no page numbers on the portal path** (Path 1 flattens the doc; only legacy Path 2 keeps `page_number`). Route `index-file` PDFs through `extract_text_with_metadata` + `chunk_pages` (both already exist, `pdf_parser.py:200-262`) so portal files get page-level citations too; add heading breadcrumbs for md/docx into `metadata`.
- xlsx→TSV and pptx→flat-text lose all table/slide structure; acceptable for now, but caps answer quality on spreadsheets.

### B5. Retrieval tuning knobs (Effort: S, Impact: incremental quality + latency)
- `MIN_VECTOR_SIMILARITY=0.30`, RRF `k=60`, `vector_weight=0.7` are hardcoded (only rerank knobs are env-tunable). Promote to settings.
- Add a **rerank-score floor** (e.g. drop candidates with `relevance_score < ~0.2` before the top-8 cut) — currently 8 docs always enter the prompt even when only 1 is relevant, diluting grounding.
- Add a small **LRU embedding cache** keyed on normalized query text — repeated/refined tool calls in one conversation re-embed near-identical strings today.
- Query rewriting is already handled implicitly (the model authors the tool query); HyDE/multi-query is not worth it until the corpus is much larger.

### B6. Ingestion performance/UX (Effort: M, Impact: UX at scale)
Current: indexing is synchronous inside the upload flow (proxy `maxDuration=120`), with per-file "Indexing…"→"Indexed" badges and re-index dedup via delete-by-`(project_id, storage_path)`. Fine at today's sizes. Gaps: no content-hash dedup (same file at two paths embeds twice; unchanged file re-index re-embeds), no chunk-count/progress for big docs, and a proxy timeout on a very large PDF strands a half-indexed file. When docs get bigger: move indexing to a FastAPI `BackgroundTasks`/queue with a status row, and skip re-embedding when a stored content hash matches.

### B7. Small cleanups
- `GET /documents/list` (`documents.py:205-234`) is a legacy uid-only, service-role read that ignores project scoping — align or remove.
- `/documents/upload` still rejects everything but PDF while the portal path handles 6 formats; consider consolidating both onto the `index-file` pipeline.
- The `source='chat'` enum value (20260614000005) is reserved but unused — see C2.

---

## C. CHAT UX / TOOLS IDEAS (grounded in what exists; refreshes AUDIT_REPORT.md §6)

Status check on prior §6 ideas: **#1 (vector index)** still open → B1. **#2 (inline citations + chips)** has **shipped** (`ChatMessage.tsx` chips with hover previews + `/dashboard/files` links). **#3 voice** is half-built (AssemblyAI mic input exists via `/api/transcribe`). Refreshed ranking:

1. **Scoped write tools with confirm cards** (Value: very high / Effort: M). Everything hard is built: tool loop, per-request RLS `user_client`, server-side project scoping, `ProcessTimeline` tool cards. Add `create_request` / `draft_report` tools that return a *proposal*, render a confirm card, and only write on user click (write executes under the caller's RLS JWT — no new privilege surface). Converts the assistant from search box to copilot.
2. **"Save to project knowledge" on chat attachments** (High / S). The bridge between Path 3 and Path 1 is one button: `client_chat_attachments.content` → `store_document(..., source='chat')` — the enum value already exists and is unused. Gate with the same director check, or allow members with a director-review queue.
3. **Source viewer panel** (High / S). Chips currently deep-link to the files page. Add a slide-over showing the actual retrieved chunk (`sources[].content` is persisted per message, first 500 chars) with the matched passage highlighted — auditable answers without leaving the chat.
4. **Grounded suggested follow-ups / starter prompts** (Med-High / S). On session open, seed 3 suggestions from live data already fetched (`get_lifecycle_status` next-due, pending questionnaires, indexed file names). Zero new backend surface.
5. **Voice round-trip** (Med-High / S-M). Mic-in exists; the remaining half is read-aloud: pipe the `delta` stream through a TTS endpoint and add a hands-free toggle.
6. **Weekly "Project Pulse" digest** (High / M). A cron that runs the same tool set per project and posts a summary message/notification. Every read tool needed already exists.
7. **Auto-fill questionnaires from RAG + prior answers** (High / M). `search_documents` + `custom_form_schemas` + accept/edit chips; biggest client-friction win but the most product work.
8. **Branch-aware UX polish** (Med / S-M). The parent/child tree, `active_leaf_id`, regenerate-as-sibling, and the ‹ i/n › picker all exist; cheap additions: label branches ("fast vs thinking"), per-branch model badge from the persisted `model_preference`.

**Suggested sequence: B1 → B2/B3 (same afternoon) → C1 + C3 → B4/B5 → C2/C4 → the rest.**
