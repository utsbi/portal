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
- **LLM:** Gemini 3.0 Flash (Fast/RAG) & Gemini 3.0 Thinking (Complex Reasoning)
- **Validation:** Pydantic V2

## 3. Architecture & Directory Structure

We follow a "Service-Agent" pattern. The frontend is kept separate.

```text
root/
├── frontend/            # Next.js/React (Visuals only, logic incomplete)
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
  - Model selection (Fast/Thinking) passed to backend
  - Stop/Cancel AI request functionality
  - In-place message editing (edit updates same message, not new)
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
- `embedding`: vector(768) (Gemini dimension)

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
- embedding VECTOR(768), -- For Gemini or OpenAI embeddings
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
- Vector embeddings using Gemini text-embedding-004 (768-dim)
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
- Model selection (Fast/Thinking modes)
- Request cancellation (stop button)
- In-place message editing
- Automatic session cleanup on navigation

**Recent Changes (Phase 1.5 - Frontend Integration):**

- Fixed chat.py to pass `attachments` and `model_preference` to agent
- Updated Gemini models to 3.0 Flash and 3.0 Thinking
- Added `/extract-text` endpoint for session-only file extraction
- Added `python-docx` dependency for DOCX support
- Frontend ChatProvider now manages model state, abort controller
- PortalInput connected to context for model selection
- Stop button replaces loader during AI response generation
- ChatMessage uses `editAndResend` for in-place updates
- DashboardPortal has cleanup hooks for route changes

**Bug Fix - Large File Context Window:**

- Fixed routing: when attachments are present, always route to "attachment" path (users who upload files intend to ask about them)
- Increased attachment context cap to 800K chars (Gemini 3 Flash supports ~1M tokens)
- Increased RAG retrieve path `max_context_length` from 8,000 to 200,000 chars
- Large PDFs (textbooks, reports) now work correctly as session attachments

**Markdown Response Rendering:**

- Added `react-markdown` and `remark-gfm` to frontend for rendering AI responses
- Updated `ChatMessage.tsx` to render AI messages with ReactMarkdown (headings, bold, lists, code blocks, tables, blockquotes)
- Added `.prose-ai` CSS styles in `globals.css` matching the dark SBI theme
- Updated `prompts.py` SYSTEM_PROMPT and GENERATE_RESPONSE_PROMPT to instruct AI to format all responses using Markdown

**Bug Fix - Request Cancellation (Stop Button):**

- Frontend: Added `cancelledRef` guard checked after every `await` point in `sendMessage` and `editAndResend`
- Frontend: `cancelRequest` now sets `cancelledRef`, aborts fetch, and removes any streaming assistant messages
- Frontend: Loading animation (`animateLoadingPhases`) and text streaming (`streamText`) check `cancelledRef` each tick
- Backend: Switched Gemini API calls from sync to async (`client.aio.models.generate_content`) in `nodes.py`
- Backend: Switched embedding calls to async (`client.aio.models.embed_content`) in `rag_service.py`
- Backend: `chat.py` now monitors client disconnection via `asyncio.wait` + `Request.is_disconnected()`
- Backend: When client disconnects, the agent task is cancelled mid-execution, stopping the Gemini API call

**UI Fix - User Message Component:**

- Fixed user message text not wrapping (long messages overflowed horizontally)
- Restructured layout: copy/edit icons now positioned to the left of the message bubble (not the attachments)
- Added `min-w-0` to flex containers for proper width constraint propagation
- `max-w-[80%]` moved to outer column to constrain both attachments and bubble
- Collapse/expand (chevron arrow) and "..." truncation now work correctly for messages exceeding 5 lines

**Next Steps:**

1. Test end-to-end with real PDF/DOCX documents
2. Begin Phase 2: Action item extraction
3. Add chat session persistence (optional)

**Testing:**

- Server: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Test User: ed13b878-b87d-4b34-a138-7e51994fa0f8
