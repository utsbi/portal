# AGENTS.md — SBI Client Portal (monorepo)

Multi-tenant client portal for the Sustainable Building Initiative: project
dashboards, messaging, files/RAG, questionnaires, finances, and an AI agent
("Explore"). Strict tenant isolation via Supabase RLS is the core invariant.

## Layout

| Path | What | Detailed docs |
|------|------|---------------|
| `frontend/` | Next.js 16 App Router (Bun, Tailwind v4, shadcn/ui) | `frontend/AGENTS.md` |
| `backend/` | FastAPI streaming agent + RAG (Python 3.12, uv) | `backend/AGENTS.md` |
| `supabase/` | Migrations, `config.toml`, pgTAP RLS tests | `supabase/tests/run.sh` |

## Commands

```bash
cd frontend && bun install && bun dev     # frontend on :3000 (test: bun run test)
cd backend && uv sync && uv run python -m uvicorn app.explore.main:app --reload --port 8000
bash supabase/tests/run.sh                # pgTAP RLS suite (needs Docker)
```

## Conventions

- **Commits:** Conventional Commits (`type(scope): description`).
- **Migrations:** one file per change under `supabase/migrations/` with a
  unique timestamp version; never edit an applied migration. Production applies
  individual migrations (Supabase MCP `apply_migration`), not `db push`.
- **Deploys:** frontend auto-deploys via Vercel; backend and DB migrations do
  NOT auto-deploy (see the PR template's deploy checklist).
- **Supabase clients (frontend):** always use the helpers in `lib/supabase/`
  (a Biome rule bans raw `createClient` imports elsewhere).
- **Plans/specs:** keep local planning docs untracked (`docs/plans/` is ignored).

CI (`.github/workflows/ci.yml`) blocks on: Vitest, `next build`, pytest, ruff,
and the pgTAP suite. See `CONTRIBUTING.md` for the full workflow.
