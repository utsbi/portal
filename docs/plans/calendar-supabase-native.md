# Calendar: Google → Supabase-native migration

**Status:** proposed (worktree)
**Goal:** replace the director-Google-Calendar-proxy model with a `project_events` table in Supabase. Both director and client get full CRUD, RSVP is a column update, no OAuth token to manage, no attendee-email matching.

---

## 1. Why

Current state, summarized from `frontend/app/api/contact/calendar/client-events/route.ts:43-359`:

- The portal never owns a single event. It asks each director's personal Google Calendar (`events.list`), filters to events where the project owner's email appears in `attendees[]`, and proxies RSVPs back through `events.patch` using the director's decrypted refresh token.
- Failure modes the migration removes: token refresh failures (`oauth2.refreshAccessToken` 400 on scope change), `last_synced_at` best-effort writes, `organizer.email → profiles` resolution to avoid leaking raw addresses, `attendees[]` matching by lowercased email, all-day `start.date` UTC-midnight parsing (`utils.ts:226-234`).
- A native table is one source of truth, RLS gives tenant isolation for free, and we can ship a per-user `.ics` feed so events still appear in phone calendars.

---

## 2. New schema

Two new tables, one index, RLS, two trigger functions. All in one migration `20260710000000_project_events.sql`.

### 2.1 `public.project_events`

| column          | type                        | notes                                                                                  |
| --------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `id`            | `bigint identity PK`        | matches existing id style (lifecycle, custom_form_schemas)                             |
| `project_id`    | `bigint NOT NULL`           | `references projects(id) on delete cascade`                                           |
| `title`         | `text NOT NULL`             | CHECK length > 0                                                                       |
| `description`   | `text`                      | nullable                                                                               |
| `location`      | `text`                      | nullable                                                                               |
| `start_at`      | `timestamptz NOT NULL`      | UTC; UI handles display TZ                                                             |
| `end_at`        | `timestamptz NOT NULL`      | `CHECK (end_at > start_at)`                                                            |
| `all_day`       | `boolean NOT NULL DEFAULT false` | when true, render date-only (UI side; storage is still timestamptz with 00:00:00Z) |
| `created_by`    | `bigint NOT NULL`           | `references profiles(id)` — the profile that created it (director or client)           |
| `created_at`    | `timestamptz NOT NULL DEFAULT now()` |                                                                                |
| `updated_at`    | `timestamptz NOT NULL DEFAULT now()` | touched by `trg_touch_updated_at` trigger                                    |

Indexes:
- `idx_project_events_project_start` on `(project_id, start_at)` — every read path filters by project + time window.

### 2.2 `public.project_event_attendees`

| column      | type                  | notes                                                                                |
| ----------- | --------------------- | ------------------------------------------------------------------------------------ |
| `event_id`  | `bigint NOT NULL`     | `references project_events(id) on delete cascade`                                   |
| `profile_id`| `bigint NOT NULL`     | `references profiles(id) on delete cascade`                                         |
| `response`  | `text NOT NULL DEFAULT 'needsAction'` | CHECK in `'accepted','declined','tentative','needsAction'`           |
| `responded_at` | `timestamptz`      | nullable; set when response ≠ 'needsAction'                                          |
| primary key | `(event_id, profile_id)` |                                                                                  |

The event creator is **not** implicitly added — explicit INSERT into attendees is required. This keeps "who is invited" a deliberate, auditable choice.

### 2.3 RLS policies

Reuse the existing helpers (`is_director`, `is_project_member`, `private.user_project_ids` from `20260101000000_baseline_schema.sql:410-446`).

**`project_events`:**
```sql
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the project
CREATE POLICY project_events_select_members
  ON public.project_events FOR SELECT TO authenticated
  USING (project_id IN (SELECT private.user_project_ids()));

-- INSERT: any member of the project can create an event on it
CREATE POLICY project_events_insert_members
  ON public.project_events FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (SELECT private.user_project_ids())
    AND created_by = public.user_profile_id(auth.uid())
  );

-- UPDATE: event creator OR director on the project
CREATE POLICY project_events_update_creator_or_director
  ON public.project_events FOR UPDATE TO authenticated
  USING (
    created_by = public.user_profile_id(auth.uid())
    OR public.is_director(auth.uid())
  )
  WITH CHECK (
    created_by = public.user_profile_id(auth.uid())
    OR public.is_director(auth.uid())
  );

-- DELETE: event creator OR director on the project
CREATE POLICY project_events_delete_creator_or_director
  ON public.project_events FOR DELETE TO authenticated
  USING (
    created_by = public.user_profile_id(auth.uid())
    OR public.is_director(auth.uid())
  );
```

The director-OR-creator rule on UPDATE/DELETE means a client who created an event can edit/cancel it without a director override. Directors can edit anything on their projects (consistent with how `lifecycle_projects` and `custom_form_schemas` work).

**`project_event_attendees`:**
```sql
ALTER TABLE public.project_event_attendees ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the event's project
CREATE POLICY project_event_attendees_select_members
  ON public.project_event_attendees FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT pe.id FROM public.project_events pe
      WHERE pe.project_id IN (SELECT private.user_project_ids())
    )
  );

-- INSERT: any project member can invite anyone (i.e. add an attendee row).
-- Restrict to project members at write time so a member of project A can't add
-- an attendee from project B.
CREATE POLICY project_event_attendees_insert_members
  ON public.project_event_attendees FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT pe.id FROM public.project_events pe
      WHERE pe.project_id IN (SELECT private.user_project_ids())
    )
  );

-- UPDATE/DELETE on attendees: event creator OR director OR the attendee themselves
-- (a user can always leave an event they're on, i.e. DELETE their own row)
CREATE POLICY project_event_attendees_update_creator_director_or_self
  ON public.project_event_attendees FOR UPDATE TO authenticated
  USING (
    profile_id = public.user_profile_id(auth.uid())
    OR public.is_director(auth.uid())
    OR event_id IN (
      SELECT pe.id FROM public.project_events pe
      WHERE pe.created_by = public.user_profile_id(auth.uid())
    )
  )
  WITH CHECK (
    profile_id = public.user_profile_id(auth.uid())
    OR public.is_director(auth.uid())
    OR event_id IN (
      SELECT pe.id FROM public.project_events pe
      WHERE pe.created_by = public.user_profile_id(auth.uid())
    )
  );

CREATE POLICY project_event_attendees_delete_creator_director_or_self
  ON public.project_event_attendees FOR DELETE TO authenticated
  USING (
    profile_id = public.user_profile_id(auth.uid())
    OR public.is_director(auth.uid())
    OR event_id IN (
      SELECT pe.id FROM public.project_events pe
      WHERE pe.created_by = public.user_profile_id(auth.uid())
    )
  );
```

### 2.4 Triggers

- `trg_touch_updated_at` on `project_events` — reuse the existing `public.touch_updated_at()` from `20260607000000_questionnaire_full_system.sql:67-75`.
- `trg_stamp_attendee_responded_at` on `project_event_attendees` — set `responded_at = now()` when `response` changes away from `needsAction`. Mirror `stamp_submission_submitted_at` pattern.

### 2.5 Grant summary

`supabase/tests/_grants.sql` grants `SELECT/INSERT/UPDATE/DELETE` on new tables to `authenticated` (the RLS USING/WITH CHECK clauses do the actual gating). Add the new tables to that file.

---

## 3. API changes

The existing routes under `frontend/app/api/contact/calendar/client-events/` are the single read/write surface. Replace them, don't extend them.

### 3.1 Read — `GET /api/contact/calendar/client-events?project_id=X`

Replace `route.ts:43-359` with:

1. Auth (session cookie OR `Authorization: Bearer …` from the Explore backend, same as today).
2. Verify caller is a member of `project_id` (`role IN ('owner','director','member')`).
3. Single query against `project_events` joined with `project_event_attendees` for the caller's row, filtered to `start_at >= now() - 7d AND start_at <= now() + 60d` (preserve the current 7-back/60-forward window; configurable later).
4. Return `{ ok: true, events: CalendarEventDTO[] }`. The `connected` field goes away — there's nothing to connect to.

`CalendarEventDTO` shape (mirrors what `useCalendarEvents` already consumes in `types.ts:25-43`):
```ts
{
  id: string,                // bigint → string
  title: string,
  start: string,             // ISO
  end: string,               // ISO
  allDay: boolean,
  location: string | null,
  description: string | null,
  organizer: string,         // profile name
  organizerId: number,
  myResponse: 'accepted' | 'declined' | 'tentative' | 'needsAction',
  attendeeCount: number,     // for "X attending" UI if we add it
}
```

The `sourceCalendarId` field on the current `RawCalendarEvent` goes away — it was a write-back handle for Google, not needed with native CRUD.

### 3.2 Create / Update / Delete

Three new routes (or one with method dispatch — match whichever style dominates `frontend/app/api/contact/`). Auth + project-membership check identical to read.

- `POST /api/contact/calendar/client-events` — body: `{ projectId, title, startAt, endAt, allDay?, location?, description?, attendeeIds: number[] }`. Server inserts the row with `created_by = caller`, then inserts attendee rows (excluding the creator — they get `response='accepted'` if they pass their own id, otherwise they're added with `needsAction` and the UI prompts them).
- `PATCH /api/contact/calendar/client-events/[id]` — partial update of any field; same auth as the SELECT (creator or director on the project). Attendee diff is handled separately via the attendees route below.
- `DELETE /api/contact/calendar/client-events/[id]` — auth same as PATCH.
- `POST /api/contact/calendar/client-events/[id]/attendees` — `{ profileIds: number[] }`. Auth: creator or director.
- `DELETE /api/contact/calendar/client-events/[id]/attendees/[profileId]` — auth: creator, director, or self (RSVP "Not going" = leave).

### 3.3 RSVP — `POST /api/contact/calendar/client-events/rsvp`

Replace `route.ts:1-200` with a single `UPDATE` on `project_event_attendees` setting `response` for the row where `(event_id, profile_id) = (eventId, callerProfileId)`. RLS does the gating. No more Google `events.patch`, no `attendees[]` round-trip, no `sendUpdates: 'none'` concern.

Optimistic update + revert-on-failure in the frontend hook stays exactly the same shape (`useCalendarEvents.ts:126-180`).

### 3.4 `.ics` subscription — new

Two surfaces, both important:

**Per-event download (already exists at `/api/contact/calendar/client-events/ics`, `route.ts:1-76`):** rewrite to take an `eventId` instead of query-string fields, and verify the caller is a project member before serving. The "Add to Google Calendar" / "Download .ics" buttons in `EventDetails.tsx:142-164` just point at this URL.

**Per-user subscription feed (new — for phone native calendars):** `GET /api/contact/calendar/feed/[token].ics`. Token is a per-profile opaque secret stored on `profiles.config.calendar_feed_token` (generated on first request, rotation endpoint at `/api/contact/calendar/feed/rotate`). Returns a single `VCALENDAR` with all the caller's events across all their projects, scoped to a sensible future window (e.g. 90 days past → 365 days future). Subscribable as a webcal URL in iOS Calendar / Google Calendar / Outlook. This is the one piece that recovers the "show up in my phone's native calendar" affordance we currently get for free from Google.

Auth on the feed endpoint is the token only — no session. Token is in the URL so it's not great, but it's how `.ics` subscription works. Mitigations: token is opaque + 32+ bytes + rotatable + scoped to events the profile is on (RLS-friendly: just `WHERE profile_id = $1` on the join).

### 3.5 Remove

- `POST /api/contact/calendar/client-events/select` — calendar selection no longer exists.
- `GET /api/contact/calendar/client-events/list` — director's Google calendar list no longer exists.
- `GET /api/contact/auth/google` — start of the OAuth dance.
- `GET /api/contact/auth/google/callback` — OAuth callback.
- `POST /api/contact/auth/google/disconnect` — no Google connection to disconnect.

The settings page's Calendar section (`app/dashboard/settings/page.tsx:987-1230`, the entire `CalendarSection` + the `connected`/`not_connected`/`no_calendar`/`connected` tri-state) collapses to: "Your project events are available at `webcal://…/feed/<token>.ics`. [Rotate URL] [Copy]". Or just hide the section entirely if we don't want users to deal with the URL directly.

---

## 4. Frontend changes

### 4.1 `types.ts`

- Drop `RawCalendarEvent` and the `organizerEmail`/`creatorEmail`/`creatorName`/`htmlLink`/`sourceCalendarId` fields. None of them apply to native rows.
- Extend `CalendarEvent` with `allDay: boolean` and `organizerId: number` (needed for the "Edit" / "Delete" affordances gated on creator-or-director).
- `attendeeCount` is optional; only the agenda list might want it.

### 4.2 `useCalendarEvents.ts`

- `load()` swaps to a single `fetch` to the new read endpoint. Drop the demo-mode short-circuit *or* keep it pointing at `generateDemoEvents` (it lives at `components/dashboard/calendar/demo-events.ts:1` — keep that file, it's the demo fixture, and it'll need a slight shape update to match the new `CalendarEvent`).
- `rsvp()` becomes a single POST with no `calendarId` payload.

### 4.3 UI

- `EventDetails.tsx`: replace RSVP buttons (kept) with create/edit/delete affordances when `canEdit` (caller is creator or director). The "Add to Google Calendar" and "Download .ics" links stay but point at the per-event `.ics` endpoint.
- `page.tsx:96-128` (`CalendarPageInner` body): add a "+ New event" button at the top of the agenda/month views when `canCreate` (always true for any project member). Opens a modal with the create form. Same modal reused for editing.
- `NoDirectorConnectedState` → `NoEventsState` already exists. The connected-state branching (`page.tsx:99-101`) goes away.
- `useCalendarViewState` is unchanged.
- The `canRsvp = user?.role === "client"` check goes away. RSVP is now: "you're on the attendees list, you can respond". A director who's an attendee on a client-created event can also RSVP.

### 4.4 Settings page

Remove the Calendar section's "Connect Google Calendar" flow and replace with a "Subscribe in your phone calendar" block showing the per-user feed URL with a Copy button and a Rotate button. If the user is not a member of any project, hide the section.

---

## 5. Tests

### 5.1 RLS — `supabase/tests/16_project_events_test.sql`

New file, following the pattern in `01_form_schemas_test.sql`. Cases:

- director on project can SELECT, INSERT, UPDATE, DELETE on `project_events` and `project_event_attendees`
- client (project owner) can SELECT, INSERT, UPDATE/DELETE only their own created events
- member of project A cannot SELECT events of project B
- non-member cannot SELECT, INSERT, UPDATE, DELETE anything
- an attendee can UPDATE/DELETE only their own attendee row
- `created_by` is forced to the caller's profile id on INSERT (try to set it to someone else's id → must fail or be ignored)
- `responded_at` is set automatically when `response` changes away from `'needsAction'`

### 5.2 Update existing tests

- `08_adversarial_cross_tenant_sweep_test.sql` — add cross-tenant probes against the new tables.
- `07_rls_sanity_test.sql` — extend the "every new table has RLS" check to include `project_events` and `project_event_attendees`.

### 5.3 Frontend tests

- `__tests__/api/chat.test.ts` and similar — confirm they don't stub the removed Google routes.
- The four places that mock `crypto.randomUUID` in `__tests__/api/{calendar-rsvp,chat-persistence,chat,google-oauth}.test.ts`: the calendar-rsvp and google-oauth stubs go away (routes deleted). Chat tests keep theirs.

---

## 6. Migration / rollout

The existing `profiles.config.google.{refresh_token,access_token,calendar_id,last_synced_at}` blob holds the only data we lose by removing the Google path. No user events are stored anywhere we control today — the events are Google's. So there's no historical event data to backfill.

**Rollout order:**

1. **Migration + read path behind a flag.** Add the tables + RLS + a new `/api/contact/calendar/client-events/v2` route that reads from `project_events` (returns empty until seeded). Don't switch the UI yet. Deploy.
2. **Seed script** (optional, for the demo project) — backfill a few events into the demo project so the UI has something to show.
3. **Switch the UI** to v2. Delete the Google read path (`/api/contact/calendar/client-events` original).
4. **Switch RSVP** to v2. Delete the Google RSVP path.
5. **Add the per-user `.ics` feed** + settings page UI.
6. **Delete** the Google OAuth routes, the calendar selection route, the disconnect route, the `CalendarSection` Google connect UI. Remove the `googleapis` and `lib/crypto/tokens` (if no other callers) dependencies. Remove the docs page `docs/google-calendar-setup.md` (or repurpose into a "subscribe to your calendar feed" page).
7. **Drop `profiles.config.google`** — write a one-shot migration that NULLs the `google` key on all profiles, or just leave it dormant and let the column be the next cleanup pass.

Each step is independently shippable and revertable by toggling the route at the call site.

---

## 7. Open questions

1. **Time zones.** Store UTC, render in the user's browser TZ. All-day events render in the browser's local date. This is what the current code does (`utils.ts:226-234`); same approach carries over.
2. **Notifications / reminders.** Out of scope for the table migration. The `.ics` feed lets the user's phone handle reminders natively. If we want portal-side push, that's a separate `event_reminders` table + cron.
3. **Recurring events.** Out of scope. Single-occurrence rows only. The portal has never had recurring events; not adding them in this migration.
4. **Migration of directors who already use Google today.** A director with connected Google today will lose their event history (it stays in Google, the portal just stops reading it). Acceptable per the rollout — they can re-create events in the portal, or we can write a one-off importer. Decide before step 3.
5. **Project-scoped vs profile-scoped `.ics` feed.** Per-user is what phone calendar apps expect. Per-project is what the client wants. Per-user covers both (subscribing to a project calendar in a phone app = the same URL, filtered to one project server-side via a separate `/projects/[id]/feed/[token].ics` endpoint). Add the per-project variant if a customer asks.

---

## 8. File-by-file checklist

**New:**
- `supabase/migrations/20260710000000_project_events.sql`
- `supabase/tests/16_project_events_test.sql`
- `frontend/app/api/contact/calendar/client-events/[id]/route.ts` (PATCH + DELETE on `[id]`)
- `frontend/app/api/contact/calendar/client-events/route.ts` (rewrite as POST create)
- `frontend/app/api/contact/calendar/client-events/[id]/attendees/route.ts` (POST/DELETE)
- `frontend/app/api/contact/calendar/feed/[token]/route.ts` (GET — `.ics` feed)
- `frontend/app/api/contact/calendar/feed/rotate/route.ts` (POST — rotate feed token)
- `frontend/components/dashboard/calendar/EventFormModal.tsx`
- `frontend/lib/calendar/feed-token.ts` (generate / rotate / verify)

**Modified:**
- `frontend/app/api/contact/calendar/client-events/route.ts` (rewrite read path)
- `frontend/app/api/contact/calendar/client-events/rsvp/route.ts` (rewrite as plain UPDATE)
- `frontend/app/api/contact/calendar/client-events/ics/route.ts` (take eventId, verify membership)
- `frontend/components/dashboard/calendar/types.ts` (drop Google fields, add allDay/organizerId)
- `frontend/components/dashboard/calendar/utils.ts` (drop Google-specific helpers, keep date math + bucketing)
- `frontend/components/dashboard/calendar/hooks/useCalendarEvents.ts` (new endpoints, drop calendarId)
- `frontend/components/dashboard/calendar/EventDetails.tsx` (edit/delete affordances)
- `frontend/components/dashboard/calendar/EmptyStates.tsx` (drop `NoDirectorConnectedState`)
- `frontend/components/dashboard/calendar/AgendaView.tsx` / `MonthView.tsx` (add "+ New event" button)
- `frontend/components/dashboard/calendar/demo-events.ts` (shape update)
- `frontend/app/dashboard/calendar/page.tsx` (drop connected-state branch, add create modal)
- `frontend/app/dashboard/settings/page.tsx` (`CalendarSection` → feed-URL block)
- `supabase/tests/_grants.sql` (grant on new tables)
- `supabase/tests/07_rls_sanity_test.sql` + `08_adversarial_cross_tenant_sweep_test.sql`

**Deleted:**
- `frontend/app/api/contact/auth/google/route.ts`
- `frontend/app/api/contact/auth/google/callback/route.ts`
- `frontend/app/api/contact/auth/google/disconnect/route.ts`
- `frontend/app/api/contact/calendar/client-events/list/route.ts`
- `frontend/app/api/contact/calendar/client-events/select/route.ts`
- `frontend/lib/crypto/tokens.ts` (if no remaining callers — check)
- `docs/google-calendar-setup.md` (or repurpose)
- `googleapis` from `frontend/package.json` dependencies
- `GOOGLE_*` and `TOKEN_ENCRYPTION_KEY` from `.env.example` (after token-rotation migration lands)

---

## 9. Effort estimate (for prioritization)

| section                          | touches                                    | rough size |
| -------------------------------- | ------------------------------------------ | ---------- |
| §2 migration + §5.1 RLS tests    | 1 SQL file, 1 test file                    | small      |
| §3.1–3.3 API rewrite             | 3 routes                                   | small      |
| §3.4 `.ics` feed                 | 2 new routes, 1 lib                        | small      |
| §4 frontend types/hook/components | ~6 files                                  | medium     |
| §4.4 settings cleanup            | 1 file                                     | small      |
| §3.5 deletions + dep cleanup     | 5 routes, 1 dep, env vars                  | small      |
| §6 rollout choreography          | feature flag, 7 deploy steps               | medium     |

Net: probably 2-3 focused PRs (schema+RLS+tests, read/write API + frontend, feed + cleanup).
