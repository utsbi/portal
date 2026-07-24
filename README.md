# UTSBI Portal

User portal for the UT Sustainable Building Initiative (UTSBI), serving team
members and clients. This is a monorepo containing the web frontend, the AI/API
backend, and the database schema.

## Repository structure

| Path | Description |
| --- | --- |
| `frontend/` | Next.js 16 App Router app. See [`frontend/README.md`](frontend/README.md). |
| `backend/` | FastAPI service (`uv`). See [`backend/README.md`](backend/README.md). |
| `supabase/` | Supabase Postgres migrations & RLS policies. |
| `docker-compose.yml` | VPS Docker production stack definition. |

## Quick start

```bash
# Frontend (preferred runtime: bun)
cd frontend && bun install && bun dev   # http://localhost:3000

# Backend (managed with uv)
cd backend && uv sync && uv run fastapi dev   # http://localhost:8000

# Or run the backend via Docker
docker compose up -d backend
```

Each app has its own `.env.example` — copy it to `.env.local` (frontend) or
`.env` (backend) and fill in the values before running.

## Deployment

- **Frontend** → Vercel (deploys on merge).
- **Backend** → Docker on a VPS, behind nginx proxy manager (TLS termination,
  localhost-bound containers). See the comments in `docker-compose.yml` for the
  routing model.

## Contributing

Branch naming follows `feat/x` / `fix/x` / `chore/x`, commits follow
[Conventional Commits](https://www.conventionalcommits.org/). PRs target `dev`;
`dev` merges into `main`. Use **bun** (not npm/yarn) for the frontend.
