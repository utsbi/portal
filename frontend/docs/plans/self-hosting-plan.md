# Self-Hosting & Reproducible Setup Plan

**Created:** 2026-04-22
**Goal:** Make it possible for someone to clone this repo and bootstrap a fully working instance with a fresh Supabase project.

**Current state:** The app runs but the setup is not reproducible. Schema lives only in Supabase cloud (no local migrations tracked in repo). No `.env.example`. No setup documentation or automation.

---

## Phase 1: Schema Portability (Critical)

### 1.1 Initialize Supabase CLI Project
- **Status:** Not Started
- **Steps:**
  1. `supabase init` in repo root
  2. `supabase db pull` to capture current schema as baseline migration
  3. This captures: tables, columns, constraints, indexes, functions, triggers, RLS policies, enums, sequences
  4. Commit `supabase/` directory to repo
- **Result:** `supabase/migrations/` contains the full schema. Anyone can `supabase db push` to a new project.
- **Estimated effort:** Low

### 1.2 Storage Bucket Migration
- **Status:** Not Started
- **Current state:** `client_files` and messages use a `Files` bucket in Supabase Storage. Bucket creation and policies are not tracked anywhere.
- **Steps:**
  1. Document which buckets exist and their policies (public/private, size limits)
  2. Add bucket creation + policies to a Supabase migration or seed script
- **Estimated effort:** Low

---

## Phase 2: Environment Configuration (Critical)

### 2.1 Create `.env.example`
- **Status:** Not Started
- **Target:** `frontend/.env.example` with all required/optional vars, descriptions, and grouping.
- **Required vars (app won't start without these):**
  ```
  NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Supabase anon/public key
  SUPABASE_SECRET_KEY=              # Supabase service role key (server-side)
  ```
- **Optional vars (features degrade gracefully):**
  ```
  # Google Calendar OAuth
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GOOGLE_REDIRECT_URI=

  # Calendar client view
  NEXT_PUBLIC_CALENDAR_EVENTS_API=
  NEXT_PUBLIC_CALENDAR_ICS_API=
  NEXT_PUBLIC_GOOGLE_CALENDAR_URL=

  # Turnstile CAPTCHA (contact form)
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=
  TURNSTILE_SECRET_KEY=

  # Contact form webhook (n8n)
  N8N_CONTACT_WEBHOOK_URL=
  BASIC_AUTH_USER=
  BASIC_AUTH_PASSWORD=

  # Backend API (AI chat)
  NEXT_PUBLIC_API_URL=

  # Seed script
  SEED_TEST_PASSWORD=
  ```
- **Estimated effort:** Trivial

---

## Phase 3: Setup Automation (High)

### 3.1 Setup Script
- **Status:** Not Started
- **Target:** `scripts/setup.sh` that automates first-time setup.
- **Script flow:**
  1. Check prerequisites (Node.js/Bun, Supabase CLI)
  2. Copy `.env.example` → `.env` if not exists, prompt user to fill in values
  3. `supabase link` to connect to their project (or `supabase start` for local dev)
  4. `supabase db push` to apply schema migrations
  5. `npm install` / `bun install`
  6. Run seed script (`npx tsx scripts/seed-test-accounts.ts`)
  7. Print summary: URLs, test account credentials
- **Estimated effort:** Medium

### 3.2 Local Supabase Dev Option
- **Status:** Not Started
- **Target:** Support `supabase start` for fully local development (Docker-based, no cloud project needed).
- **Steps:**
  1. Ensure migrations work with `supabase start` (local Postgres)
  2. Add seed data that works offline (no Google OAuth, mock calendar data)
  3. Document in README
- **Estimated effort:** Medium

---

## Phase 4: Documentation (Medium)

### 4.1 Setup README
- **Status:** Not Started
- **Target:** Update `frontend/README.md` or create `SETUP.md` with:
  - Prerequisites (Node 18+, Supabase CLI, optionally Docker)
  - Quick start (clone → setup → running in 5 commands)
  - Environment variable reference table
  - Feature flag mapping (which env vars enable which features)
  - Test accounts and how to use them

### 4.2 Google OAuth Setup Guide
- **Status:** Not Started
- **Target:** Document how to configure Google Cloud Console for calendar OAuth:
  - Create OAuth 2.0 credentials
  - Set authorized redirect URIs
  - Enable Google Calendar API
  - Where to put the credentials in `.env`
- **Estimated effort:** Low

### 4.3 Deployment Guide
- **Status:** Not Started
- **Target:** Document deploying to Vercel (primary) with:
  - Environment variable configuration in Vercel dashboard
  - Supabase project setup and linking
  - Domain and auth redirect configuration
- **Estimated effort:** Low

---

## Phase 5: CI/Smoke Tests (Low Priority)

### 5.1 Build Verification
- **Status:** Not Started
- **Target:** GitHub Actions workflow that:
  1. Installs deps
  2. Runs `tsc --noEmit`
  3. Runs `next build`
  4. Optionally runs seed against a Supabase branch DB

### 5.2 Smoke Test Checklist
- From the unification plan (Phase 0.2), still not implemented:
  - [ ] Build passes (`npm run build`)
  - [ ] Auth flow works (login → dashboard redirect)
  - [ ] RLS policies verified (test as client, test as director)
  - [ ] No console errors on key pages

---

## Priority Order

1. **`.env.example`** — trivial, immediate value
2. **`supabase init` + `db pull`** — captures schema, makes everything else possible
3. **Storage bucket migration** — completes the schema story
4. **Setup README** — makes 1-3 usable by others
5. **Setup script** — automates 1-4
6. **Google OAuth docs** — unblocks calendar feature for new instances
7. **Local dev option** — nice-to-have for offline development
8. **CI** — nice-to-have for quality gates

---

## Open Questions

1. Should we support `supabase start` (local Docker) as a first-class dev option, or require a cloud project?
2. Should the seed script create more realistic sample data (lifecycle projects, tickets, conversations)?
3. Do we need a Terraform/Pulumi config for the Supabase project itself (project creation, auth settings, storage config)?
