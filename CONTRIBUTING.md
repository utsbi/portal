# Contributing

Thanks for contributing to the UTSBI Portal. This is a monorepo — `frontend/`
(Next.js 16), `backend/` (FastAPI), and `supabase/` (Postgres migrations). See
the root [`README.md`](README.md) for orientation.

## Branching

Branch off `dev` using `<type>/<kebab-description>`:

- `feat/calendar-sync`
- `fix/login-redirect`
- `chore/repo-setup`

Open PRs against `dev`. `dev` is merged into `main` for release.

## Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): subject` — e.g. `fix(auth): refresh session on expired token`.
Common types: `feat`, `fix`, `chore`, `refactor`, `docs`.

## Running locally

Use **bun** for the frontend (not npm/yarn) and **uv** for the backend.

```bash
# Frontend
cd frontend
bun install
bun dev            # http://localhost:3000

# Backend
cd backend
uv sync
uv run uvicorn app.explore.main:app --reload --port 8000

# Or run the backend in Docker
docker compose up -d backend
```

Copy each app's `.env.example` to `.env.local` (frontend) / `.env` (backend)
and fill in the values first. See [`frontend/README.md`](frontend/README.md)
and [`frontend/AGENTS.md`](frontend/AGENTS.md) for frontend details.

## Before opening a PR

- Frontend: `bun lint` (Biome) and `bun build` pass.
- Fill in the PR template (Summary / Changes / Test plan).
- Keep PRs focused; one logical change per PR.
