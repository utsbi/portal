# UTSBI Portal — Backend

FastAPI application for the UT Sustainable Building Initiative portal. Powers
the AI agent ("Explore"), document ingestion/RAG pipeline, and backend APIs.

## Tech stack

- **Framework:** FastAPI (Python 3.12+)
- **Dependency Management:** [`uv`](https://github.com/astral-sh/uv)
- **AI & RAG:** OpenAI API, document processing (`pypdf`, `python-docx`,
  `python-pptx`, `openpyxl`)
- **Database & Auth:** Supabase (Postgres with RLS, JWT validation)
- **Testing & Quality:** `pytest`, `ruff` (linter & formatter), `pyright` (type
  checker)

## Getting started

```bash
# Install dependencies
uv sync

# Run development server
uv run python -m uvicorn app.explore.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill in required environment variables
(Supabase URL, Service Role key, OpenAI key, etc.).

## Development scripts

```bash
uv run pytest                        # Run test suite
uv run pytest --cov=app             # Run tests with coverage
uv run ruff check .                 # Run linter
uv run ruff format --check .        # Check formatting
uv run pyright                      # Run static type checker
```

## Structure

```text
app/
  explore/
    api/        # FastAPI endpoint routers (v1)
    agents/     # Agent loop, tools, and execution logic
    core/       # Settings, rate limiting, and security configuration
    db/         # Supabase database client and RLS context handlers
    knowledge/  # Base knowledge & document ingestion
    schemas/    # Pydantic models & request validation
    services/   # Domain services and external integrations
tests/          # Pytest suite
```
