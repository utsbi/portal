# UTSBI Portal — Frontend

Next.js 16 (App Router) application for the UT Sustainable Building Initiative:
public marketing pages plus an authenticated dashboard (projects, reports,
finance, messaging, and an AI portal).

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

```text
app/
  (static)/      # Public pages (home, about, contact, projects, outreach, login)
  dashboard/     # Protected routes (auth enforced via middleware/proxy)
  api/           # API routes
components/
  ui/            # shadcn/ui primitives
  dashboard/     # Dashboard-specific components, grouped by feature
lib/
  supabase/      # Client/server/middleware helpers
```

## Architecture & Conventions

- **Supabase Clients:** Always use the helpers in `lib/supabase/` (e.g.
  `createClient` from `@/lib/supabase/client` or `@/lib/supabase/server`).
- **Auth Guarding:** Dashboard routes are protected by middleware and server
  component checks enforcing authentication and workspace access.
- **Styling & Components:** Built with Tailwind CSS v4 and shadcn/ui
  primitives. Follow strict TypeScript typing and Biome formatting rules.
