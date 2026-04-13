# Portal Unification Plan

**Created:** 2026-04-11
**Last Updated:** 2026-04-11 (Codex audit incorporated)
**Goal:** Unify all feature branches into a consistent, secure, well-architected portal before merging to main.

**Context:** Client-director portal built by multiple contributors (1st/2nd year CS students with varying agent assistance). Features work in isolation but share no unified identity model, data access patterns, or type system. 10+ branches, 16 database tables, critical security gaps.

---

## Codex Audit Notes (2026-04-11)

Key feedback from Codex audit that changed the plan:

1. **Identity model needs `profiles` + `memberships`**, not just a flat `profiles` table with a role column. Clients behave like tenant/account rows scoped by `url_slug`, not just people.
2. **Migration must be incremental**, not big-bang. Need source-controlled migrations, compatibility views, dual-read window before dropping old tables.
3. **Assignment model (`client_directors`) belongs in Phase 1**, not Phase 4. Calendar and messages already depend on it.
4. **Reports/requests decision must happen before merging either branch.** Recommendation: merge into single `tickets` domain.
5. **Routing unification is missing** — broken legacy routes, calendar adds routes outside slug pattern.
6. **Calendar is a tenancy/security problem**, not just a hardcoded env var.
7. **Data fetching needs boundaries, not one pattern** — server-first hybrid approach.

---

## Phase 0: Infrastructure (New — Before Everything)

### 0.1 Source-Control Database Schema
- **Status:** Not Started
- **Severity:** Critical
- **Current state:** No checked-in Supabase migrations. Schema changes are ad-hoc and untracked.
- **Target:** Initialize `supabase/migrations/` with current schema as baseline. All future changes via migrations.
- **Steps:**
  1. `supabase init` (if not done)
  2. Dump current schema as baseline migration
  3. Commit to repo
- **Estimated effort:** Low

### 0.2 Define Rollback/Smoke-Test Protocol
- **Status:** Not Started
- **Severity:** High
- **Target:** After each merge, run a defined smoke-test checklist:
  - [ ] Build passes (`npm run build`)
  - [ ] Auth flow works (login → dashboard redirect)
  - [ ] RLS policies verified (test as client, test as director)
  - [ ] No console errors on key pages
- **Estimated effort:** Low

---

## Phase 1: Foundation (Before Any Merges)

These must be completed before merging any feature branch.

### 1.1 Design Identity + Membership + Assignment Model
- **Status:** In Progress — Design Finalized
- **Severity:** Critical
- **Current state:** Three separate tables (`clients`, `directors`, `members`). FKs inconsistent — `conversations.director_id` → `members.id` while `client_directors.director_id` → `directors.id`.

#### Finalized Schema Design

**`profiles`** — one row per auth user
```sql
profiles (
  id bigint PK,
  uid uuid FK → auth.users UNIQUE,
  name text NOT NULL,
  email text,
  role text NOT NULL CHECK (role IN ('client', 'director', 'member')),
  config jsonb DEFAULT '{}',      -- calendar tokens, preferences (per-person, not per-project)
  department text,                 -- for directors/members
  eid text,                        -- employee ID for members
  graduation smallint,             -- for members
  discord_id bigint,               -- for members
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**`projects`** — one row per client company/tenant
```sql
projects (
  id bigint PK,
  url_slug text UNIQUE NOT NULL,   -- kept for internal use / API scoping (NOT in frontend URLs)
  company_name text NOT NULL,
  config jsonb DEFAULT '{}',       -- project-level settings
  created_by bigint FK → profiles, -- the client who owns this project
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**`project_members`** — who has access to which project and in what role
```sql
project_members (
  id bigint PK,
  project_id bigint FK → projects NOT NULL,
  profile_id bigint FK → profiles NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'director', 'member')),
  assigned_by bigint FK → profiles,  -- NULL for auto-assigned
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, profile_id)
)
```

#### Assignment Rules
- **Clients** → auto-linked as `owner` to their own project on creation
- **Directors** → auto-linked to ALL projects (they oversee everything)
- **Members** → explicitly assigned by directors via role management UI (NOT auto-linked)

#### Routing: Session-Based (No Slugs in URL)
- All pages under `/dashboard/...` — no `[url_slug]` dynamic segment
- Active project resolved from auth session → `project_members` lookup
- Directors get a project switcher dropdown in sidebar
- `projects.url_slug` kept in DB for internal reference only

#### What This Replaces
- `clients` → split into `profiles` (person) + `projects` (company/tenant)
- `directors` → merged into `profiles` with `role='director'`
- `members` → merged into `profiles` with `role='member'`
- `client_directors` → replaced by `project_members`
- Auto-link triggers → new triggers: auto-link directors only, not members

#### Migration Strategy (Incremental)
  1. Create new `profiles`, `projects`, `project_members` tables alongside old tables
  2. Backfill data from `clients`, `directors`, `members`
  3. Create compatibility views mapping old table names → new tables
  4. Update frontend to read from new tables (dual-read window)
  5. Verify all features work against new model
  6. Drop old tables and views

- **Risk:** High — touches every feature. Must be done first.
- **Estimated effort:** High

### 1.2 Fix RLS Policies
- **Status:** Not Started
- **Severity:** Critical
- **Note:** RLS design depends on 1.1 identity model. Design policies against `profiles`/`memberships`.
- **Issues:**
  - `reports` — wide open (`SELECT: true`, `INSERT: true`)
  - `requests` — wide open (`SELECT: true`, `INSERT: true`, `UPDATE: true`)
  - `client_directors` — RLS enabled, zero policies (locked out)
  - `directors` — RLS enabled, zero policies (locked out)
  - `client_chat_sessions` — RLS enabled, zero policies (locked out)
  - `legal_documents` — RLS enabled, zero policies (locked out)
  - `website_forms` — RLS enabled, zero policies (locked out)
- **Target:** Every table has policies scoped by `auth.uid()`, role, and slug context.
- **Estimated effort:** Medium

### 1.3 Migrate to Session-Based Routing
- **Status:** Not Started
- **Severity:** High
- **Decision:** Drop `[url_slug]` from URLs. Use session-based project resolution.
- **Current problems:**
  - `app/(dashboard)/questionnaire/page.tsx` redirects to `/dashboard/questionnaire` which doesn't exist
  - Calendar branch adds standalone `/director/calendar` route outside the slug pattern
  - Most `[url_slug]/dashboard/*` routes are stubs returning `notFound()`
  - Slug naming is inconsistent and hard to standardize for company names
- **Target:**
  - Move all pages from `app/[url_slug]/dashboard/` → `app/dashboard/`
  - Remove legacy `app/(dashboard)/` routes
  - Remove standalone `/director/` routes
  - Active project resolved from cookie/context via `useProject()` hook
  - Directors get project switcher dropdown in sidebar
  - `proxy.ts` matcher updated from `/:slug/dashboard/:path*` → `/dashboard/:path*`
- **Estimated effort:** Medium

### 1.4 Build Shared Auth/Actor Resolver
- **Status:** Not Started
- **Severity:** High
- **Current state:** "Check clients table, then members table" pattern duplicated in 4 places. `ClientData` has no `role` field. Sidebar hardcodes "Client Portal" for all users.
- **Target:**
  - Single `resolveActor(uid, urlSlug)` utility returning `{ profile, membership, role }`
  - Add `role` to context provider
  - Use for conditional UI rendering (sidebar label, nav items, permissions)
- **Estimated effort:** Low-Medium

### 1.5 Decide and Build Tickets Layer
- **Status:** Not Started
- **Severity:** High
- **Decision (per Codex audit):** Merge `reports` + `requests` into a single `tickets` table.
  - Add `ticket_type` column (`report` | `request`)
  - Shared: status, assignment, attachments, subject, message, department, project
  - Typed views/services for each UI
  - If "report" later means an immutable deliverable, that's a separate `documents` model
- **Must decide before merging either reports or requests branch.**
- **Estimated effort:** Medium-High

### 1.6 Fix Database Bugs
- **Status:** Not Started
- **Severity:** High
- **Items:**
  - [ ] `custom_form_schemas.created_by` default: `gen_random_uuid()` → `auth.uid()`
  - [ ] `requests.UID` uppercase → rename to `uid`
  - [ ] `client_chat_sessions.updated_at` → change to `timestamptz`
  - [ ] Rename stale indexes (`reports/requests_pkey`, `client_documents_pkey`, `client_users_pkey`)
  - [ ] Drop 3 duplicate index pairs
  - [ ] Remove hardcoded `dev_test` slug in `auth/confirm/route.ts`
- **Estimated effort:** Low-Medium

### 1.7 Generate Supabase Types
- **Status:** Not Started
- **Severity:** High
- **Target:** Run `supabase gen types typescript` after schema stabilizes. Use as single source of truth.
- **Estimated effort:** Low

### 1.8 Canonicalize Data Table Component
- **Status:** Not Started
- **Severity:** High
- **Current state:** Data table duplicated across 4+ branches with divergent versions.
- **Target:** Pick most complete version, merge to main, rebase all feature branches.
- **Estimated effort:** Medium

### 1.9 Update Proxy Session Validation (Optional)
- **Status:** Not Started
- **Severity:** Low
- **Current:** `proxy.ts` uses `supabase.auth.getUser()` (network call per request)
- **Target:** Consider `supabase.auth.getClaims()` (local JWT validation, faster)
- **Estimated effort:** Trivial

---

## Phase 2: Branch Cleanup

After foundation is solid, clean up branches before integration.

### 2.1 Delete Obsolete Branches
- **Status:** Not Started
- **Branches to delete:**
  - `feature/reports-data-table` — superseded by `feat/frontend/reports`
  - `explore-agent` — identical to main, no changes
- **Estimated effort:** Trivial

### 2.2 Stabilize Dev Branch
- **Status:** Not Started
- **Current state:** Multiple reverts of the same features. Unstable.
- **Target:** Decide if `dev` should be the integration branch or merge directly to main.
- **Estimated effort:** Low

### 2.3 Rebase All Feature Branches on Updated Main
- **Status:** Not Started
- **Branches to rebase:**
  - `portal/feat/messages`
  - `questionnaire`
  - `feat/frontend/reports`
  - `feat/frontend/requests`
  - `dashboard` (lifecycle)
  - `portal/feat/files`
  - `portal/feat/calendar`
- **Estimated effort:** Medium (conflict resolution)

### 2.4 Drop Duplicate Indexes
- **Status:** Not Started
- **Duplicates:**
  - `client_directors_client_id_director_id_idx` = `client_directors_unique_pair`
  - `unique_form_submission` = `unique_submission_per_user_per_form_per_project`
  - `conversations_id_key` = `conversations_pkey`
- **Estimated effort:** Trivial

---

## Phase 3: Feature Integration & Polish

Merge features one at a time, running smoke tests after each.

### 3.1 Merge Order (Revised per Codex Audit)
1. **Questionnaire** — most self-contained, well-structured
2. **Reports + Requests** — merge together against unified `tickets` table
3. **Messages** — needs Realtime additions
4. **Files** — Supabase Storage integration
5. **Calendar** — most complex (OAuth + tenancy security), merge last
6. **Lifecycle/Dashboard** — anytime after routing shell is stable

### 3.2 Messages Polish
- [ ] Add Supabase Realtime subscriptions (critical for chat UX)
- [ ] Fix over-fetching pattern (fetch ALL messages to find latest preview)
- [ ] Fix hidden conversations bug (`lastMessage === ""` filter)
- [ ] Extract shared `useConversations` hook (deduplicate client/director logic)
- [ ] Make `urlSlug` non-optional in component props
- [ ] Ensure conversations respect assignment model (not "any director")

### 3.3 Calendar Security Refactor
- [ ] Remove all `DIRECTOR_ID` env var usage (3 route handlers)
- [ ] Derive director context from authenticated user session, not global env
- [ ] Move service-role handlers to proper auth-scoped pattern
- [ ] Remove standalone `/director/calendar` route (move under slug pattern)
- [ ] Add error states for failed OAuth / event fetches
- [ ] Add loading states for event fetch

### 3.4 Files Polish
- [ ] Fix hardcoded date in FileCard ("Feb 20, 2026")
- [ ] Add file upload functionality
- [ ] Add error handling for failed downloads
- [ ] Define storage bucket policy contract

### 3.5 Lifecycle/Dashboard
- [ ] Connect to real database tables (currently mock data)
- [ ] Design and create `projects` and `tasks` tables

### 3.6 Data Fetching Boundaries (Server-First Hybrid)
Per Codex recommendation — not "pick one pattern" but define clear boundaries:

| Layer | Responsibility | Example |
|-------|---------------|---------|
| Server layouts/pages | Resolve actor + slug access, preload initial data | Dashboard layout auth check |
| Server actions / route handlers | Writes, privileged integrations (Google API, etc.) | Report submission, calendar OAuth |
| Client hooks | Local UI state management | Form state, modal state |
| Direct browser Supabase | Realtime only, upload progress, draft autosave | Message subscriptions, file uploads, questionnaire debounce |

---

## Branch Status Summary

| Branch | Feature | Lines | Readiness | Notes |
|--------|---------|-------|-----------|-------|
| `questionnaire` | Client questionnaire forms | 3,168 | ~90% | Well-structured, DataTable integrated |
| `feat/frontend/reports` | Reports dashboard + API | 3,039 | ~95% | Needs tickets refactor + RLS fix |
| `feat/frontend/requests` | Request management + upload | 2,464 | ~95% | Needs tickets refactor + RLS fix |
| `portal/feat/messages` | Client-director messaging | ~2,000 | ~75% | No Realtime, over-fetching, duplicate logic |
| `portal/feat/calendar` | Google Calendar OAuth | 1,513 | ~70% | Tenancy/security issues (not just polish) |
| `portal/feat/files` | File management | 2,137 | ~85% | Hardcoded date, no upload |
| `dashboard` | Lifecycle/project mgmt | 1,107 | ~70% | Mock data only |
| `feat/frontend/unified-data-table` | Base data table | 2,004 | 100% | Already in main |
| `feature/reports-data-table` | Old data table + reports | 2,924 | OBSOLETE | Delete |
| `dev` | Integration branch | — | UNSTABLE | Multiple reverts |
| `explore-agent` | — | 0 | OBSOLETE | Same as main |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-11 | Plan created | Pre-merge unification needed |
| 2026-04-11 | Codex audit incorporated | Identity model needs memberships table, not flat profiles. Migration must be incremental. Assignment model in Phase 1. Reports+requests → tickets. Routing unification added. Calendar downgraded to ~70% (security issues). |
| 2026-04-11 | Reports + Requests → Tickets | Both are inbound client-submitted work items with near-identical schemas. Use `ticket_type` column. |
| 2026-04-11 | Data fetching: server-first hybrid | Not one pattern — define boundaries. Server for auth/preload/writes, client for Realtime/uploads/drafts only. No React Query during unification. |
| 2026-04-12 | Phase 0 complete | Baseline migration applied. TypeScript types generated. |
| 2026-04-13 | Identity model finalized | `profiles` + `projects` + `project_members` (3-table model). Directors auto-linked to all projects. Members explicitly assigned by directors. |
| 2026-04-13 | Session-based routing | Drop `[url_slug]` from URLs. Active project resolved from session/cookie. Directors get project switcher. `projects.url_slug` kept in DB only. |
| 2026-04-13 | Member assignment model | Members NOT auto-linked. Directors manage member assignments via role management UI. |
| 2026-04-13 | Calendar: .ics subscription feed | Approach B selected. Director OAuth stays. Add .ics subscription URL per project for clients. |

---

## Temporary Workarounds (Must Clean Up)

| File | Workaround | Clean Up When |
|------|-----------|---------------|
| `components/dashboard/messages/index.tsx` | Queries old `clients` table to get `client.id` for conversation lookups | When `conversations` table FKs migrate to `profiles`/`projects` |
| `components/dashboard/messages/DirectorMessages.tsx` | Queries old `clients` table for client search | Same as above |
| `app/dashboard/messages/page.tsx` | Queries `profiles.member_id` to get old `members.id` for director conversations | Same as above |
| `app/dashboard/messages/[conversationId]/page.tsx` | Same pattern — needs old member ID for conversation queries | Same as above |
| `components/dashboard/explore/ui/AmbientGrid.tsx` | Pre-existing: uses `Math.random()` causing hydration mismatch | Move random generation to `useMemo` with seed or `useEffect` |

---

## Open Questions

1. ~~Should `reports` and `requests` merge into a single `tickets` table?~~ **DECIDED: Yes**
2. ~~What data fetching pattern to standardize?~~ **DECIDED: Server-first hybrid with boundaries**
3. Should `dev` remain the integration branch or merge directly to `main`?
4. ~~What is the assignment model for directors to clients?~~ **DECIDED: Directors auto-linked, members explicitly assigned by directors**
5. ~~What does the identity schema look like?~~ **DECIDED: `profiles` + `projects` + `project_members`**
6. ~~Slug in URL or session-based?~~ **DECIDED: Session-based, no slug in URL**
7. ~~Calendar sync approach?~~ **DECIDED: .ics subscription feed (Approach B)**
