# SBI Client Portal - RAG Implementation Summary

## Overview

This document summarizes the Phase 1 RAG (Retrieval-Augmented Generation) implementation and Phase 1.5 Frontend Integration for the SBI Client Portal's Explore AI Agent.

## File Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI entry point
│   ├── agents/
│   │   ├── __init__.py         # Package exports
│   │   ├── explore.py          # Main agent entry point
│   │   ├── graph.py            # LangGraph state machine
│   │   ├── nodes.py            # Agent workflow nodes
│   │   └── prompts.py          # System prompts
│   ├── api/
│   │   ├── deps.py             # Authentication dependencies
│   │   └── v1/
│   │       ├── router.py       # API router
│   │       └── endpoints/
│   │           ├── chat.py     # Chat endpoint
│   │           └── documents.py # Document endpoints
│   ├── schemas/
│   │   ├── chat.py             # Chat request/response models
│   │   └── document.py         # Document models
│   ├── services/
│   │   ├── pdf_parser.py       # PDF text extraction
│   │   └── rag_service.py      # RAG operations
│   ├── core/
│   │   └── config.py           # Environment settings
│   └── db/
│       └── supabase.py         # Supabase client
├── database_schema.sql         # SQL schema for Supabase
└── claude.md                   # Project context
```

## Key Components

### 1. LangGraph Agent (`agents/graph.py`)

The agent uses a state machine with four nodes:

1. **Route Query**: Determines if the query needs document retrieval or can be answered directly
2. **Retrieve Context**: Fetches relevant documents using hybrid search
3. **Generate Response**: Creates the answer using Gemini LLM
4. **Format Sources**: Prepares source citations for the response

### 2. RAG Service (`services/rag_service.py`)

Handles all RAG operations:

- **Embedding Generation**: Uses Gemini `text-embedding-004` (768 dimensions)
- **Document Storage**: Chunks and stores documents with embeddings
- **Hybrid Search**: Combines vector similarity with keyword matching using RRF

### 3. PDF Parser (`services/pdf_parser.py`)

- Extracts text from PDF files using pypdf
- Chunks text using LangChain's RecursiveCharacterTextSplitter
- Preserves page-level metadata

### 4. API Endpoints

| Endpoint                    | Method | Description                           |
| --------------------------- | ------ | ------------------------------------- |
| `/api/v1/chat/`             | POST   | Chat with AI agent                    |
| `/api/v1/chat/extract-text` | POST   | Extract text from file (session-only) |
| `/api/v1/chat/health`       | GET    | Health check                          |
| `/api/v1/documents/upload`  | POST   | Upload PDF documents (persisted)      |
| `/api/v1/documents/list`    | GET    | List user documents                   |

## Database Setup

The backend uses the existing `client_knowledge` table with `uid` column. To enable vector similarity search, run this SQL in your Supabase SQL Editor:

```sql
-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the vector similarity search function for client_knowledge
CREATE OR REPLACE FUNCTION match_client_knowledge(
  _query_embedding vector(768),
  _match_count int DEFAULT 5,
  _filter_uid uuid DEFAULT NULL,
  _similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.content,
    ck.metadata,
    1 - (ck.embedding <=> query_embedding) as similarity
  FROM client_knowledge ck
  WHERE
    (filter_uid IS NULL OR ck.uid = filter_uid)
    AND 1 - (ck.embedding <=> query_embedding) > similarity_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS policy for client_knowledge (if not exists)
ALTER TABLE client_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can only access their own knowledge"
  ON client_knowledge
  FOR ALL
  USING (auth.uid() = uid);
```

**Note:** The `uid` column references `auth.users(id)` for user isolation.

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLIC_KEY=your_anon_public_key
SUPABASE_SECRET_KEY=your_service_role_secret_key
```

## Running the Server

```bash
cd backend

# Using uv (recommended)
uv run python -m uvicorn app.main:app --reload --port 8000

# Or directly with uvicorn
python -m uvicorn app.main:app --reload --port 8000
```

Access:

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs

## Chat Request Example

```json
POST /api/v1/chat/
{
  "query": "What are the key milestones for the solar panel installation?",
  "history": [
    {
      "role": "user",
      "content": "Tell me about the project timeline"
    },
    {
      "role": "assistant",
      "content": "The project is scheduled to complete in Q3 2026..."
    }
  ],
  "attachments": [],
  "include_sources": true,
  "model_preference": "fast"
}
```

## Response Format

```json
{
  "answer": "Based on the project documentation, the key milestones are...",
  "sources": [
    {
      "content": "Excerpt from the document...",
      "filename": "project_plan.pdf",
      "page_number": 5,
      "relevance_score": 0.87
    }
  ],
  "timestamp": "2026-01-23T12:00:00Z"
}
```

## Security

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row Level Security (RLS) ensures clients only access their own documents
- **Data Isolation**: All queries are filtered by `client_id`

## Frontend Integration (Phase 1.5 - Completed)

The frontend is now fully integrated with the backend API:

### Key Features

- **Session-Only File Uploads**: Files uploaded via chat input are extracted but NOT persisted to database
- **Model Selection**: Users can switch between "Fast" (gemini-3-flash-preview) and "Thinking" (gemini-3-pro-preview) modes
- **Request Cancellation**: Stop button allows canceling in-progress AI requests
- **In-Place Message Editing**: Editing a message updates it in place and regenerates the response
- **Session Cleanup**: Chat history and attachments are cleared on route change, page refresh, or navigation

### Frontend Files Modified

| File                                               | Changes                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `lib/chat/chat-context.tsx`                        | Added modelPreference, cancelRequest, editAndResend, modified addAttachment |
| `lib/api/chat.ts`                                  | Added signal parameter, extractFileText function                            |
| `components/dashboard/explore/ui/PortalInput.tsx`  | Connected to context model, added stop button                               |
| `components/dashboard/explore/ui/ChatMessage.tsx`  | Uses editAndResend for in-place editing                                     |
| `components/dashboard/explore/DashboardPortal.tsx` | Added session cleanup hooks                                                 |

### Backend Changes

- `chat.py`: Fixed to pass `attachments` and `model_preference` to agent
- `chat.py`: Added `/extract-text` endpoint for session-only file extraction
- `nodes.py`: Updated to use Gemini 2.0 models
- `pyproject.toml`: Added `python-docx` dependency

### Bug Fix - Large File Context Window

- `nodes.py`: Fixed query routing - when attachments are present, always route to "attachment" path instead of requiring keyword matches like "file" or "document"
- `nodes.py`: Added 800K character cap for attachment context with graceful truncation for extremely large files
- `rag_service.py`: Increased `max_context_length` from 8,000 to 200,000 characters for the retrieve path

### Markdown Response Rendering

- `ChatMessage.tsx`: AI responses now rendered with `react-markdown` + `remark-gfm` (supports headings, bold, lists, code blocks, tables, blockquotes)
- `globals.css`: Added `.prose-ai` styles for markdown elements matching SBI dark theme
- `prompts.py`: Updated SYSTEM_PROMPT and GENERATE_RESPONSE_PROMPT with Markdown formatting instructions
- `package.json`: Added `react-markdown` and `remark-gfm` dependencies

### Bug Fix - Request Cancellation (Stop Button)

**Problem:** Clicking the Stop button aborted the `fetch()` call but the backend continued processing (wasting Gemini tokens), and responses could still appear if the API response arrived before/during the loading animation or text streaming.

**Frontend fixes (`chat-context.tsx`):**

- Added `cancelledRef` ref checked after every `await` point in `sendMessage` and `editAndResend`
- `cancelRequest` sets `cancelledRef.current = true`, aborts the fetch, and removes any streaming assistant messages
- `animateLoadingPhases` and `streamText` check `cancelledRef` on each tick and resolve immediately if cancelled
- Used local `abortController` variable to prevent null reference if cancel fires during auth

**Backend fixes:**

- `nodes.py`: Switched Gemini calls from sync (`client.models.generate_content`) to async (`await client.aio.models.generate_content`) making them cancellable via `asyncio.CancelledError`
- `rag_service.py`: Switched embedding call to async (`await client.aio.models.embed_content`)
- `chat.py`: Added `Request` parameter and `asyncio.wait` pattern to monitor client disconnection in parallel with agent execution; cancels the agent task when the client disconnects

### UI Fix - User Message Component

**Problem:** Long user messages overflowed horizontally instead of wrapping. Copy/edit icons appeared next to the attachment chips rather than the message bubble. Collapse/expand and "..." truncation never triggered because text didn't wrap.

**Root cause:** The flex layout lacked `min-w-0` on flex containers, preventing width constraint propagation. The `max-w-[80%]` on the bubble was ineffective because its parent flex-col had no width constraint. Copy/edit icons were at the outer flex level (next to the full column including attachments) instead of specifically next to the message bubble.

**Fix (`ChatMessage.tsx`):**

- Restructured user message layout: outer column (`max-w-[80%]`) contains attachments row, then a sub-row with `[icons + bubble]`
- Added `min-w-0` to the message row and bubble div for proper flex width constraint propagation
- Copy/edit icons now appear on hover to the left of the message bubble (Gemini-style)
- Collapse/expand chevron and "..." truncation now work correctly since text wraps properly

### OpenRouter API Migration

**Problem:** The backend was tightly coupled to Google's `google-genai` SDK for both LLM chat completions and embeddings. Switching to OpenRouter enables multi-provider support (Gemini, Claude, GPT, etc.) through a single OpenAI-compatible API.

**Changes:**

| File                      | Change                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pyproject.toml`          | Replaced `google-genai` with `openai`                                                                                       |
| `core/config.py`          | `GEMINI_API_KEY` → `OPEN_ROUTER_KEY`, added `EMBEDDING_MODEL` + `EMBEDDING_DIMENSIONS`                                      |
| `agents/nodes.py`         | `genai.Client` → `AsyncOpenAI(base_url="https://openrouter.ai/api/v1")`, `generate_content()` → `chat.completions.create()` |
| `services/rag_service.py` | `embed_content()` → `embeddings.create()`, configurable model + dimensions                                                  |
| `agents/explore.py`       | `GeminiClient` → `OpenRouterClient`, proper async with `AsyncOpenAI`                                                        |
| `.env`                    | New env vars: `OPEN_ROUTER_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`                                                  |

**API Mapping:**

| Gemini SDK                                            | OpenAI SDK (OpenRouter)                              |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `client.aio.models.generate_content(model, contents)` | `client.chat.completions.create(model, messages)`    |
| `client.aio.models.embed_content(model, contents)`    | `client.embeddings.create(model, input, dimensions)` |
| `response.text`                                       | `response.choices[0].message.content`                |
| `result.embeddings[0].values`                         | `result.data[0].embedding`                           |

**Database Migration Required:**

```sql
-- Update vector dimension from 768 (Gemini) to 4096 (Qwen3-Embedding-8B)
ALTER TABLE client_knowledge ALTER COLUMN embedding TYPE vector(4096);

-- Update match function signature
CREATE OR REPLACE FUNCTION match_client_knowledge(
  _query_embedding vector(4096),
  _match_count int DEFAULT 5,
  _filter_uid uuid DEFAULT NULL,
  _similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT ck.id, ck.content, ck.metadata,
    1 - (ck.embedding <=> _query_embedding) as similarity
  FROM client_knowledge ck
  WHERE (_filter_uid IS NULL OR ck.uid = _filter_uid)
    AND 1 - (ck.embedding <=> _query_embedding) > _similarity_threshold
  ORDER BY ck.embedding <=> _query_embedding
  LIMIT _match_count;
END; $$;
```

**Note:** After running the SQL migration, all existing documents must be re-uploaded/re-embedded since Gemini and OpenAI embeddings are incompatible.

## Next Steps (Phase 2)

1. Action item extraction from meeting notes
2. Smart notification summaries
3. Chat session persistence (optional)
