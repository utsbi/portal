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

We follow a "Service-Agent" pattern. The frontend is kept separate.

```text
root/
├── frontend/            # Next.js/React
├── backend/             # CURRENT WORKSPACE
│   ├── pyproject.toml   # Managed by uv
│   ├── uv.lock
│   ├── app/
│   │   ├── main.py      # FastAPI Entry point
│   │   ├── api/         # Routes (Chat, Ingest)
│   │   ├── core/        # Config (Env Vars) & Security
│   │   ├── services/    # Deterministic Tools (PDF parsing, Embeddings)
│   │   ├── agents/      # LangGraph State Machines (Reasoning)
│   │   └── schemas/     # Pydantic Models (Request/Response)
│   └── tests/           # Integration tests
└── claude.md            # This Context File
```

## 4. Frontend Context (Status: "Integrated")

- **Current State:** Frontend is fully integrated with the backend API.
- **Implemented Features:**
  - Chat input with Enter key submission
  - File attachment upload (PDF, DOCX, TXT) - session-only, not persisted
  - Session-wide attachment context (all previously attached files available for follow-up questions)
  - Model selection (Fast/Thinking) passed to backend
  - Stop/Cancel AI request functionality (works during loading AND text streaming)
  - Cancel preserves partial streamed content with "Response was cancelled" indicator
  - In-place message editing (edit updates same message, regenerates with full session attachments)
  - Response regeneration (redo button, re-sends with full session attachments)
  - Markdown rendering for AI responses (react-markdown + remark-gfm)
  - Session cleanup on route change, refresh, or navigation
  - Chat history maintained within session for context

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

1. **Start Dev Server:** `uv run fastapi dev app/main.py`
2. **Add Libs:** `uv add <library_name>`

## 7. Roadmap & Priorities

**Phase 1: Core RAG (COMPLETED)**

- [x] **Ingestion Endpoint:** Parse uploaded PDF/Docs -> Chunk -> Supabase Vector Store.
- [x] **Retrieval Endpoint:** Hybrid Search (Keyword + Vector) filtered by `client_id`.
- [x] **Chat Endpoint:** Answer queries using retrieved context + session attachments.
- [x] **LangGraph Agent:** Stateful workflow with analyze → retrieve → generate nodes.
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
- `POST /api/v1/chat/` - Chat with AI agent (supports attachments, model_preference)
- `POST /api/v1/chat/extract-text` - Extract text from file (session-only, no persistence)
- `GET /api/v1/chat/health` - Service health check

**Phase 2: Extraction & Action**

- [ ] **Action Item Extraction:** Parse meeting notes -> JSON List of tasks.
- [ ] **Smart Notifications:** Auto-summarize updates.

**Phase 3: Agentic Workflows**

- [ ] **Calendar:** Read/Write Google Calendar events (OAuth).
- [ ] **Email:** Draft emails based on project updates.

## 8. Immediate Context (Update Daily)

**Current Status:** ✅ Phase 1 RAG + Frontend Integration Complete

**What Works:**

- PDF upload, parsing, chunking, and embedding
- Vector similarity search with Supabase pgvector
- LangGraph agent with intelligent query routing
- Multi-turn chat conversations with history context
- Source document citation
- RLS-based data isolation per client
- Frontend-backend API integration complete
- Session-only file attachments (not persisted)
- Session-wide attachment context (all previously attached files available across messages)
- Model selection (Fast/Thinking modes)
- Request cancellation (stop button, works during streaming)
- In-place message editing
- Automatic session cleanup on navigation

**LLM & Embedding Configuration:**

- All LLM calls go through OpenRouter API (`https://openrouter.ai/api/v1`) via `openai` SDK
- Chat models configurable via `FAST_MODEL` and `THINK_MODEL` env vars
- Embeddings use configurable model via `EMBEDDING_MODEL` env var (default: `qwen/qwen3-Embedding-8B`, 4096-dim)
- `EMBEDDING_DIMENSIONS` env var is optional (only sent to API if set)

**Observability:**

- Logging throughout RAG pipeline (`rag_service.py`, `nodes.py`, `main.py`)
- Server console shows: embedding generation, vector search results, routing decisions, retrieval counts

**Next Steps:**

1. Test end-to-end with real PDF/DOCX documents
2. Begin Phase 2: Action item extraction
3. Add chat session persistence (optional)

**Testing:**

- Server: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Test User: ed13b878-b87d-4b34-a138-7e51994fa0f8
