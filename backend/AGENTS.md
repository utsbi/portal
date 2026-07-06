# SBI Client Portal — Backend Context

## 1. Project Overview

Multi-tenant AI agent backend for the Sustainable Building Initiative (SBI) client portal.
A **Project Manager Assistant** that helps clients search their construction documents,
check live project status, and get answers about their SBI projects.

**Constraint:** Strict data privacy — clients must NEVER access other clients' data.

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.12+ |
| Package manager | `uv` (not pip/poetry) |
| Framework | FastAPI (async) |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth with RLS |
| LLM provider | OpenRouter (OpenAI-compatible API) |
| LLM SDK | `openai` Python SDK (`base_url=https://openrouter.ai/api/v1`) |
| Validation | Pydantic V2 |
| Embeddings | Qwen3-Embedding-8B via OpenRouter, MRL-truncated to 1536-dim (HNSW-indexed) |

## 3. Directory Structure

```
backend/
├── pyproject.toml
├── uv.lock
├── Dockerfile
└── app/
    └── explore/
        ├── main.py                  # FastAPI entry point
        ├── agents/
        │   ├── explore.py           # Streaming entry point (thin wrapper)
        │   ├── graph.py             # Streaming tool-calling loop
        │   ├── tools.py             # Tool schemas + implementations + dispatch
        │   ├── nodes.py             # Utilities (title gen, source formatting, RAG client)
        │   └── prompts.py           # System prompt + title generator prompt
        ├── api/
        │   ├── deps.py              # Auth dependencies (JWT validation)
        │   └── v1/
        │       ├── router.py        # API router (/api/v1)
        │       └── endpoints/
        │           ├── chat.py      # POST /chat/ (SSE), /chat/extract-text, /chat/health
        │           └── documents.py # POST /documents/upload, GET /documents/list
        ├── core/
        │   ├── config.py            # Env settings (pydantic-settings)
        │   ├── limiter.py           # Per-user rate limiting (keyed on JWT sub)
        │   └── uploads.py           # Upload size/type bounds
        ├── db/
        │   └── supabase.py          # Supabase client (service-role + user-scoped)
        ├── knowledge/
        │   └── sbi.md               # Curated SBI org knowledge (static)
        ├── schemas/
        │   ├── chat.py              # Chat request/response Pydantic models
        │   └── document.py          # Document models
        └── services/
            ├── membership.py        # Project membership resolution
            ├── pdf_parser.py        # PDF/DOCX text extraction (zip-bomb bounded)
            └── rag_service.py       # RAG embeddings + hybrid search + rerank
```

Tests live in `backend/tests/` (pytest; unit + adversarial suites, run in CI).

**Import convention:** All internal imports use `app.explore.` prefix (e.g. `from app.explore.core.config import settings`).

## 4. How the Agent Works

The agent is a **streaming tool-calling loop** in `agents/graph.py` (`run_graph_streaming`).
No LangGraph. No state machine. No manual routing nodes.

**Flow:**
1. Build messages: system prompt → optional project context → last ~10 history turns → user query
2. Stream the model's response. The model decides when to call tools via `tool_choice="auto"`
3. If the model requests tools, execute them, feed results back, and loop (max 4 iterations)
4. The iteration that produces no tool calls IS the final answer — there is no separate generation step

**SSE events are yielded throughout**, so the frontend sees thinking tokens, tool cards, and
answer text as they arrive — no waiting for a serialized round-trip.

Key constants in `graph.py`:
- `MAX_TOOL_ITERATIONS = 4` — caps tool-decision loops so a tool-happy model can't spin forever

## 5. Available Tools

Defined in `agents/tools.py`. The `TOOLS` list is the OpenAI function-calling schema passed
to the model. `execute_tool()` dispatches a tool call and returns `(result_text, sources)`.

| Tool | What it does | Data source |
|------|-------------|-------------|
| `search_documents` | RAG search over client's uploaded project documents | pgvector |
| `search_sbi_knowledge` | Look up general SBI info (mission, team, services) | Static markdown (`knowledge/sbi.md`) |
| `get_lifecycle_status` | Live project lifecycle task progress | PostgREST (RLS-scoped) |
| `get_questionnaire_status` | Live questionnaire/form status | PostgREST (RLS-scoped) |
| `get_reports` | Live list of project reports | PostgREST (RLS-scoped) |
| `get_finance_summary` | Live budget/spend summary | PostgREST (RLS-scoped) |
| `get_requests` | Live client support requests | PostgREST (RLS-scoped) |
| `get_upcoming_events` | Upcoming project meetings | Proxies the frontend Google Calendar route (forwards caller JWT) |

The Google Calendar OAuth tokens and API calls live in the frontend's
`app/api/contact/calendar/` routes. The backend holds no Google credentials;
`get_upcoming_events` proxies that route with the caller's JWT so the frontend's
own membership/authorization gate applies (`PORTAL_BASE_URL` points at it).

**Security:** All live-data tools run queries under the **caller's RLS context** via
`user_client(access_token)`, plus manual `project_id`/`client_id` scoping. No service-role
client for live-data reads. Tool results are strictly scoped to the authenticated user.

**To add a tool:**
1. Add its schema to the `TOOLS` list in `tools.py`
2. Add an `if name == "your_tool":` branch in `execute_tool()`
3. Add a human-readable label to `TOOL_LABELS` in the frontend's `ProcessTimeline.tsx`

## 6. SSE Event Contract

The `POST /api/v1/chat/` endpoint returns `text/event-stream`. Each event is a JSON line
prefixed with `data: `. The stream ends with `data: [DONE]`.

| Event type | Fields | When |
|-----------|--------|------|
| `title` | `title: string` | First-turn title generated (overlapped with stream) |
| `phase` | `phase: "thinking" \| "searching" \| "generating"` | Phase transitions |
| `reasoning` | `text: string` | Model thinking tokens (ephemeral, shown live) |
| `delta` | `text: string` | Answer text token |
| `tool_call` | `id, name, input` | Tool invocation begins |
| `tool_result` | `id, name, output: {sources, text}` | Tool execution completes |
| `result` | `answer, sources` | Final answer + citation sources |
| `error` | `message: string` | Fatal error |

The client can disconnect at any point — the endpoint checks `request.is_disconnected()`
between events and stops streaming.

## 7. API Endpoints

All under `/api/v1/`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat/` | Chat with AI agent (SSE streaming) |
| `POST` | `/chat/extract-text` | Extract text from PDF/DOCX/TXT (session-only) |
| `GET` | `/chat/health` | Chat service health check |
| `POST` | `/documents/upload` | Upload PDF to vector store (persisted) |
| `GET` | `/documents/list` | List user's uploaded documents |

Plus root-level:
| `GET` | `/` | API health check |
| `GET` | `/health` | Detailed health check |

## 8. Environment Variables

```env
OPEN_ROUTER_KEY=sk-or-v1-...
FAST_MODEL=...                               # Fast responses + tool-calling agent loop
THINK_MODEL=...                              # Final answer when model_preference="thinking"
TITLE_MODEL=...                              # Optional; conversation-title model. Falls back to FAST_MODEL
EMBEDDING_MODEL=...                          # Embedding model
EMBEDDING_DIMENSIONS=1536                    # Must match client_knowledge.embedding vector(1536)
RERANK_MODEL=...                             # Optional; reranker for hybrid retrieval
RERANK_CANDIDATES=...                        # Optional; candidate pool size for reranking
RERANK_TOP_N=...                             # Optional; results kept after reranking
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLIC_KEY=your_anon_public_key
SUPABASE_SECRET_KEY=your_service_role_secret_key

# Security / hardening (optional; safe defaults)
ENV=development                              # "production" disables docs + enables HSTS
CORS_ORIGINS=http://localhost:3000           # Comma-separated allowed browser origins
ALLOWED_HOSTS=*                              # Comma-separated Host-header allowlist
MAX_UPLOAD_BYTES=10485760                    # Max upload / extract size (10 MB)
PORTAL_BASE_URL=http://localhost:3000        # Frontend base URL; get_upcoming_events proxies its calendar route
```

Title generation uses `TITLE_MODEL` (see `nodes.generate_title`), which falls back
to `FAST_MODEL` when unset. It runs as a background task overlapping the first
model call, so titling never adds latency to the stream.

## 9. Development Workflow

```bash
cd backend

# Install dependencies
uv sync

# Start dev server
uv run python -m uvicorn app.explore.main:app --reload --port 8000

# Add a dependency
uv add <package>

# Run tests
uv run pytest
```

- **API:** http://localhost:8000
- **Swagger UI:** http://localhost:8000/docs
- **Frontend:** http://localhost:3000

## 10. Security

- **Authentication:** Supabase Auth with JWT tokens. The `get_auth_context` dependency
  validates the `Authorization: Bearer <token>` header and extracts `user_id` + `access_token`
- **Row-Level Security:** All live-data queries run under the caller's RLS context via
  `user_client(access_token)`. The service-role client is only used for operations that
  require it (e.g., document upload)
- **Membership verification:** `project_id` from the request is verified server-side via
  `membership.scoped_project_ids()` before any tool query uses it
- **No project id from model input:** Tool queries are scoped server-side; the model never
  provides or influences project scoping
