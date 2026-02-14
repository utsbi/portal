# SBI Client Portal - AI Agent Context & Rules

## 1. Project Overview

**Goal:** Build a secure, multi-tenant AI Agent backend for the Sustainable Building Initiative (SBI) client portal.
**Core Function:** A RAG-first agent ("Project Manager Assistant") that helps clients (e.g., "John Doe") search construction documents, extract action items, and manage workflows.
**User:** `test@utsbi.org` (Role: Test POV for clients).
**Constraint:** Strict Data Privacy. Clients must NEVER access other clients' data.

## 2. Tech Stack (Strict Constraints)

- **Language:** Python 3.12+ (Managed by `uv`)
- **Package Manager:** `uv` (Do NOT use `pip` or `poetry` commands. Use `uv add`, `uv run`)
- **Backend:** FastAPI (Async)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Auth:** Supabase Auth (RLS is **MANDATORY** for all queries)
- **Orchestration:** LangGraph (Stateful agent workflows)
- **LLM Provider:** OpenRouter (OpenAI-compatible API) - supports any model (Gemini, Claude, GPT, etc.)
- **LLM SDK:** `openai` Python SDK with `base_url="https://openrouter.ai/api/v1"`
- **Validation:** Pydantic V2

## 3. Architecture & Directory Structure

We follow a "Service-Agent" pattern. The frontend is kept separate. All backend AI agent code lives under `app/explore/`.

```text
root/
├── frontend/            # Next.js/React
├── backend/             # CURRENT WORKSPACE
│   ├── pyproject.toml   # Managed by uv
│   ├── uv.lock
│   ├── app/
│   │   └── explore/
│   │       ├── __init__.py      # Package init
│   │       ├── main.py          # FastAPI Entry point
│   │       ├── agents/          # LangGraph State Machines (Reasoning)
│   │       │   ├── __init__.py  # Exports: run_explore_agent, run_explore_agent_streaming, OpenRouterClient
│   │       │   ├── explore.py   # Agent entry points + OpenRouterClient
│   │       │   ├── graph.py     # LangGraph state machine + SSE streaming generator
│   │       │   ├── nodes.py     # Workflow nodes (rewrite, route, retrieve, generate, format)
│   │       │   └── prompts.py   # System prompts
│   │       ├── api/             # Routes (Chat, Documents)
│   │       │   ├── deps.py      # Authentication dependencies
│   │       │   └── v1/
│   │       │       ├── router.py
│   │       │       └── endpoints/
│   │       │           ├── auth.py
│   │       │           ├── calendar.py
│   │       │           ├── chat.py
│   │       │           └── documents.py
│   │       ├── core/            # Config (Env Vars) & Security
│   │       │   ├── config.py
│   │       │   └── security.py
│   │       ├── db/
│   │       │   └── supabase.py  # Supabase client
│   │       ├── schemas/         # Pydantic Models (Request/Response)
│   │       │   ├── chat.py
│   │       │   └── document.py
│   │       └── services/        # Deterministic Tools (PDF parsing, Embeddings)
│   │           ├── google_cal.py
│   │           ├── pdf_parser.py
│   │           └── rag_service.py
│   └── tests/           # Integration tests
└── claude.md            # This Context File
```

**Import convention:** All internal imports use the `app.explore.` prefix (e.g., `from app.explore.core.config import settings`, `from app.explore.agents.explore import run_explore_agent_streaming`).

## 4. Frontend Context (Status: "Integrated")

- **Current State:** Frontend is fully integrated with the backend API via SSE streaming.
- **Implemented Features:**
  - Chat input with Enter key submission
  - File attachment upload (PDF, DOCX, TXT) - session-only, not persisted
  - Session-wide attachment context (all previously attached files available for follow-up questions)
  - Model selection (Fast/Thinking) passed to backend
  - SSE streaming progress: loading phases (thinking, planning, searching, generating) driven by real-time backend events
  - Stop/Cancel AI request functionality (works during loading AND text streaming)
  - Cancel preserves partial streamed content with "Response was cancelled" indicator
  - In-place message editing (edit updates same message, regenerates with full session attachments)
  - Response regeneration (redo button, re-sends with full session attachments)
  - Markdown rendering for AI responses (react-markdown + remark-gfm)
  - Session cleanup on route change, refresh, or navigation
  - Chat history maintained within session for context
  - Full-width scroll container with scrollbar on far right edge

- **Testing:** Can test via both frontend UI and Swagger UI at http://localhost:8000/docs

## 5. Database Schema & Security

**Rule:** Every table uses `uid` column to reference auth.users(id).
**Rule:** Every query MUST be protected by RLS.

- **Test User:** `test@utsbi.org`
- **User UUID:** `ed13b878-b87d-4b34-a138-7e51994fa0f8`
- **Table: `documents**`
- `id`: bigserial (PK)
- `client_id`: uuid (FK to auth.users, Not Null)
- `content`: text
- `metadata`: jsonb (filename, page_num, upload_date)
- `embedding`: vector(4096) (Qwen3-Embedding-8B)

- **Current Database Layout for Backend**
- Table - clients:
- id int8 PRIMARY KEY DEFAULT,
- created_at TIMESTAMPTZ DEFAULT NOW(),
- name TEXT
- company_name TEXT NOT NULL
- url_slug TEXT UNIQUE NOT NULL
- config JSON IS NULL
- uid UUID REFERENCES auth.users(id), -- Links to Supabase Auth

- Table - client_files
- id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
- uid UUID REFERENCES auth.users(id), -- Links to Supabase Auth
- file_name TEXT NOT NULL,
- storage_path TEXT NOT NULL, -- Path in Supabase Storage
- metadata JSONB

- Table - client_knowledge
- id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
- uid UUID REFERENCES auth.users(id), -- Links to Supabase Auth
- content TEXT,
- embedding VECTOR(4096), -- Qwen3-Embedding-8B via OpenRouter
- metadata JSONB

- Table client_chat_sessions
- id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
- created_at TIMESTAMPTZ DEFAULT NOW(),
- updated_at TIMESTAMPTZ DEFAULT NOW(),
- uid UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
- title TEXT,
- metadata JSONB

## 6. Development Workflow (`uv`)

1. **Start Dev Server:** `uv run python -m uvicorn app.explore.main:app --reload --port 8000`
2. **Add Libs:** `uv add <library_name>`

## 7. Roadmap & Priorities

**Phase 1: Core RAG (COMPLETED)**

- [x] **Ingestion Endpoint:** Parse uploaded PDF/Docs -> Chunk -> Supabase Vector Store.
- [x] **Retrieval Endpoint:** Hybrid Search (Keyword + Vector) filtered by `client_id`.
- [x] **Chat Endpoint:** Answer queries using retrieved context + session attachments (SSE streaming).
- [x] **LangGraph Agent:** Stateful workflow with rewrite -> route -> retrieve -> generate nodes.
- [x] **SSE Streaming:** Real-time phase events (thinking, planning, searching, generating) sent to frontend.
- [x] **Authentication:** Supabase Auth integration with RLS filtering.

**Implementation Details:**

- FastAPI server running at http://localhost:8000
- Swagger UI available at http://localhost:8000/docs
- Vector embeddings using Qwen3-Embedding-8B via OpenRouter (4096-dim)
- Professional, helpful tone (no emojis as requested)
- Multi-turn conversation support
- Source citation in responses

**API Endpoints:**

- `POST /api/v1/documents/upload` - Upload PDF documents (persisted to database)
- `GET /api/v1/documents/list` - List uploaded documents
- `POST /api/v1/chat/` - Chat with AI agent (SSE streaming, supports attachments, model_preference)
- `POST /api/v1/chat/extract-text` - Extract text from file (session-only, no persistence)
- `GET /api/v1/chat/health` - Service health check

**Phase 2: Extraction & Action**

- [ ] **Action Item Extraction:** Parse meeting notes -> JSON List of tasks.
- [ ] **Smart Notifications:** Auto-summarize updates.

**Phase 3: Agentic Workflows**

- [ ] **Calendar:** Read/Write Google Calendar events (OAuth).
- [ ] **Email:** Draft emails based on project updates.

## 8. Immediate Context (Update Daily)

**Current Status:** Phase 1 RAG + Frontend Integration + SSE Streaming Complete

**What Works:**

- PDF upload, parsing, chunking, and embedding
- Vector similarity search with Supabase pgvector
- LangGraph agent with split routing nodes (`rewrite_query` + `semantic_route`)
- SSE streaming of phase events from backend to frontend
- Intelligent routing between ATTACHMENT, RAG, and HYBRID data sources
- Multi-turn chat conversations with history context
- Source document citation
- RLS-based data isolation per client
- Frontend-backend SSE API integration complete
- Session-only file attachments (not persisted)
- Session-wide attachment context (all previously attached files available across messages)
- Model selection (Fast/Thinking modes)
- Request cancellation (stop button, works during SSE streaming)
- In-place message editing
- Automatic session cleanup on navigation

**Query Routing Architecture:**

The agent uses a two-step intelligent routing system, split into separate functions for SSE phase granularity:

1. **`rewrite_query()`** (SSE phase: `thinking`): Greeting/help detection + query rewriting. Uses `FAST_MODEL` to rewrite vague follow-ups into standalone search terms using conversation history. Greetings and help requests are fast-pathed to direct response (skips routing and retrieval). Stored as `standalone_query` in state; original `query` preserved for generation and routing.
2. **`semantic_route()`** (SSE phase: `planning`): Uses the **original query** (not the rewritten standalone_query) to examine intent against the file name + content preview (first 500 chars) of each attachment and the knowledge base description. Classifies: ATTACHMENT, RAG, or HYBRID. Defaults to HYBRID when ambiguous. When no attachments exist, defaults to RAG without an LLM routing call.
3. **`route_query()`**: Combined wrapper that calls both `rewrite_query()` + `semantic_route()` for the compiled graph's non-streaming path.
4. **Fallback**: If the attachment route yields thin context (<100 chars), automatically falls back to RAG search.
5. **Error handling**: If either LLM call fails, defaults to the safest option (original query for rewriter, hybrid for router).

**SSE Phase Mapping:**

| SSE Phase    | Node Function        | Description                                  |
| ------------ | -------------------- | -------------------------------------------- |
| `thinking`   | `rewrite_query()`    | Greeting/help detection + query rewriting    |
| `planning`   | `semantic_route()`   | LLM routing decision (ATTACHMENT/RAG/HYBRID) |
| `searching`  | `retrieve_context()` | RAG search, attachment context, or hybrid    |
| `generating` | `generate_response()`| Final LLM answer generation                 |

**LLM & Embedding Configuration:**

- All LLM calls go through OpenRouter API (`https://openrouter.ai/api/v1`) via `openai` SDK
- Chat models configurable via `FAST_MODEL` and `THINK_MODEL` env vars
- Query rewriting and semantic routing use `FAST_MODEL` for low latency
- Embeddings use configurable model via `EMBEDDING_MODEL` env var (default: `qwen/qwen3-Embedding-8B`, 4096-dim)
- `EMBEDDING_DIMENSIONS` env var is optional (only sent to API if set)

**Observability:**

- Logging throughout RAG pipeline (`rag_service.py`, `nodes.py`, `main.py`)
- Server console shows: query rewriting, semantic routing decisions, embedding generation, vector search results, retrieval counts

**Next Steps:**

1. Test end-to-end with real PDF/DOCX documents
2. Begin Phase 2: Action item extraction
3. Add chat session persistence (optional)

**Testing:**

- Server: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Test User: ed13b878-b87d-4b34-a138-7e51994fa0f8
