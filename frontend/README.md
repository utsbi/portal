# UTSBI Portal — Frontend

Next.js 16 (App Router) application for the UT Sustainable Building Initiative:
public marketing pages plus an authenticated dashboard (projects, reports,
finance, messaging, and an AI portal).

> For full conventions, architecture, and code style, see
> [`AGENTS.md`](AGENTS.md) — it is the source of truth for this app.

## Getting started

```bash
bun install   # preferred runtime
bun dev       # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in the values before running.
`.env.example` is the authoritative list of required environment variables.
Production email configuration and verification are documented in
[`docs/EMAIL.md`](docs/EMAIL.md).

## Tech stack

- **Framework:** Next.js 16 (App Router), React, TypeScript (strict)
- **Styling:** Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix primitives)
- **Animation:** `motion/react`
- **3D rendering:** React Three Fiber
- **Auth & data:** Supabase (Auth + Postgres, RLS)
- **Tooling:** Bun, Biome (lint/format)

## Scripts

```bash
bun dev            # Start dev server (Turbopack)
bun build          # Production build
bun start          # Start production server
bun lint           # Biome (biome check)
bun run test       # Vitest suites
bun run test:e2e   # Playwright smoke suite
```

## Project structure

```
app/
  (static)/      # Public pages (home, about, contact, projects, outreach, login)
  dashboard/     # Protected routes (auth enforced via proxy.ts)
  api/           # API routes
components/
  ui/            # shadcn/ui primitives
  dashboard/     # Dashboard-specific components, grouped by feature
lib/
  supabase/      # Client/server/middleware helpers
```

See [`AGENTS.md`](AGENTS.md) for the complete structure, naming conventions,
auth patterns, and component guidelines.
