# SBI Client Portal - RAG Implementation Summary

## Overview

This document summarizes the RAG (Retrieval-Augmented Generation) implementation and Frontend Integration for the SBI Client Portal's Explore AI Agent.

## File Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI entry point
│   ├── agents/
│   │   ├── __init__.py         # Package exports
│   │   ├── explore.py          # Main agent entry point + OpenRouterClient
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
└── claude.md                   # Project context
```

## Key Components

### 1. LangGraph Agent (`agents/graph.py`)

The agent uses a state machine with four nodes:

1. **Route Query**: Determines if the query needs document retrieval, attachment focus, or direct response
2. **Retrieve Context**: Fetches relevant documents using hybrid search, or inlines session attachments
3. **Generate Response**: Creates the answer using LLM via OpenRouter
4. **Format Sources**: Prepares source citations for the response

### 2. RAG Service (`services/rag_service.py`)

Handles all RAG operations:

- **Embedding Generation**: Configurable model via OpenRouter (default: Qwen3-Embedding-8B, 4096 dimensions)
- **Document Storage**: Chunks and stores documents with embeddings in Supabase pgvector
- **Hybrid Search**: Combines vector similarity with keyword matching using Reciprocal Rank Fusion (RRF)
- **Context Building**: Assembles context from retrieved documents and session attachments (up to 200K characters)

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
  _query_embedding vector(4096),
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
    1 - (ck.embedding <=> _query_embedding) as similarity
  FROM client_knowledge ck
  WHERE
    (_filter_uid IS NULL OR ck.uid = _filter_uid)
    AND 1 - (ck.embedding <=> _query_embedding) > _similarity_threshold
  ORDER BY ck.embedding <=> _query_embedding
  LIMIT _match_count;
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
OPEN_ROUTER_KEY=sk-or-v1-...
FAST_MODEL=google/gemini-3-flash-preview   # OpenRouter model ID for fast responses
THINK_MODEL=google/gemini-3-pro-preview    # OpenRouter model ID for complex reasoning
EMBEDDING_MODEL=qwen/qwen3-embedding-8b    # OpenRouter embedding model
EMBEDDING_DIMENSIONS=4096                   # Optional, omit to use model default
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

## Frontend Integration

The frontend is fully integrated with the backend API:

### Key Features

- **Session-Only File Uploads**: Files uploaded via chat input are extracted but NOT persisted to database
- **Session-Wide Attachment Context**: All previously attached files remain available for follow-up questions across the entire chat session without re-uploading
- **Model Selection**: Users can switch between "Fast" and "Thinking" modes (configurable via `FAST_MODEL` and `THINK_MODEL` env vars)
- **Request Cancellation**: Stop button allows canceling at any point - during API loading phases AND during text streaming animation
- **Cancel Preserves Partial Content**: If cancelled mid-stream, displayed text is preserved with "Response was cancelled" appended
- **In-Place Message Editing**: Editing a message updates it in place and regenerates the response with full session attachment context
- **Response Regeneration**: Redo button on the latest assistant message re-sends the query with full session attachment context
- **Markdown Rendering**: AI responses rendered with `react-markdown` + `remark-gfm` (headings, bold, lists, code blocks, tables, blockquotes)
- **Session Cleanup**: Chat history and attachments are cleared on route change, page refresh, or navigation

### Frontend Files

| File                                               | Purpose                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `lib/chat/chat-context.tsx`                        | Central chat state: messages, attachments, loading, cancel, edit/resend |
| `lib/api/chat.ts`                                  | API client: sendChatMessage, extractFileText, uploadDocument            |
| `components/dashboard/explore/ui/PortalInput.tsx`  | Chat input with file upload, model picker, send/stop button             |
| `components/dashboard/explore/ui/ChatMessage.tsx`  | Message rendering: markdown, sources, edit, copy, redo, cancel state    |
| `components/dashboard/explore/ui/ChatMessages.tsx` | Message list container with auto-scroll                                 |
| `components/dashboard/explore/DashboardPortal.tsx` | Page layout, GSAP animations, session cleanup hooks                     |

### Backend Endpoint Details

- `chat.py`: Runs the LangGraph agent as a cancellable `asyncio.Task`, monitors client disconnection via `asyncio.wait` to cancel and save tokens if the user navigates away or hits stop
- `chat.py /extract-text`: Extracts text from PDF (pypdf), DOCX (python-docx), and TXT files for session-only use without persisting to database

## How Attachments Work (Frontend ↔ Backend)

Understanding the attachment lifecycle is critical for maintaining session context:

1. **User attaches file** → Frontend calls `POST /extract-text` → backend extracts text → returns `{filename, content, file_type}`
2. **User sends message** → Frontend stores `{filename, content}` on the `DisplayMessage` object, then sends ALL session attachments (from all previous user messages + new ones) to `POST /chat/`
3. **After send** → `setAttachments([])` clears the input UI chips, but attachment content persists on each `DisplayMessage.attachments`
4. **Follow-up message** → `collectSessionAttachments()` scans all user messages for their `.attachments`, deduplicates by filename, merges with any new attachments, and sends the full set to the API
5. **Edit/Redo** → Same collection logic applies, gathering all attachments from messages up to the relevant point in the conversation
6. **Session end** → `clearChat()` resets all state (messages, attachments, loading) on route change or page refresh

**Key types:**

- `MessageAttachment` (frontend display): `{filename, content}` - stored on each `DisplayMessage`
- `AttachmentFile` (API payload): `{filename, content, file_type}` - sent to backend, `file_type` inferred from extension

## How Request Cancellation Works (Frontend ↔ Backend)

1. **Frontend**: `cancelRequest()` sets `cancelledRef.current = true`, calls `abortController.abort()`, sets loading phase to idle
2. **Frontend**: `animateLoadingPhases` and `streamText` check `cancelledRef` on each tick and resolve immediately if cancelled
3. **Frontend**: If streaming, preserves `displayedContent` as final content and marks message as `isCancelled`
4. **Backend**: `chat.py` runs `asyncio.wait({agent_task, disconnect_task})` - when the client disconnects (abort), the disconnect task completes first, and the agent task is cancelled via `task.cancel()`
5. **Backend**: All LLM calls are async (`AsyncOpenAI`), so `asyncio.CancelledError` propagates and stops token generation

## Next Steps (Phase 2)

1. Action item extraction from meeting notes
2. Smart notification summaries
3. Chat session persistence (optional)
