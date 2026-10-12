# SBI Portal: Projects, Profiles, and Accounts

## Agreed model

- `public.profiles` is the source of truth for people and their account role: client, member, director, or president.
- SBI is the internal workspace. Every non-client belongs to it, whether or not they have a portal login yet.
- A project roster displays the account role from `profiles.role`.
- Ownership is separate from the account role: the owner appears first, with an **Owner** badge. A client owner still displays **Client** as their role.
- SBI membership is automatic, not individually assigned or removed by a director.
- Directors and presidents retain their existing global project access.
- Regular members' access to client projects is unchanged. They are not automatically added to every client project.
- Clients are excluded from SBI and from the staff member picker.

## What the lists mean

### Projects → SBI

All profiles whose account role is not client. This includes members, directors, presidents, and profiles without logins.

Each row shows:

- Name and available portal/contact email.
- Account role.
- Owner badge, if applicable.
- Portal login status: **Active**, **Pending setup**, or **No account**.

### Projects → a client project

Assigned people, with the owner first. Automatic directors/presidents are explained separately rather than counted as the assigned team. An owner remains visible even if their account role changes to director or president.

The Add member picker contains member profiles not already linked to that particular project. A login is not required. Clients are assigned through the owner flow, not the staff picker.

### Accounts → Portal accounts

Reads `public.profiles` with a non-null `uid`. All account roles are included. A pending member account is included and labeled **Pending setup**, rather than being silently omitted.

The Members filter here counts only accounts whose global role is member, not everyone assigned to SBI.

### Accounts → Member profiles

Reads the same `public.profiles` table, restricted to global member profiles with a null `uid`.

These are people without portal logins yet. They can already belong to SBI. They may come from Discord verification or recovered roster records. A pending invitation with a linked login belongs in Portal accounts instead.

There is no separate `member_profiles` table.

## Correction to the earlier explanations of the 135 count

A read-only audit of the app's configured Supabase database confirmed:

- **143 profiles** total.
- **135** global member profiles.
- **4** directors, **2** presidents, **2** clients.
- **10** profiles with a login (`uid` present).
- **133** member profiles without a login.
- **157** project-membership rows across all projects.
- SBI had **135 member links plus 5 staff links**. One additional non-client staff profile was missing its SBI link.

Thus, the 135 in the screenshot really were member profiles, mostly without logins. The earlier suggestion that they were stale or mismatched role records was unverified and incorrect for this dataset. The screenshot of accounts was not the complete roster of profiles without accounts.

Under the new roster rules, this audited dataset produces **141 people in SBI**: 135 members plus 6 directors/presidents. Counts may change as profiles are added or edited.

## Why `project_members` still exists

`project_members` is retained as the authorization link between a profile and a project. Its legacy `role` field remains for compatibility with existing permission and ownership checks, but is not displayed as the person's account role.

Ownership continues to use the existing owner relationship in that table. We do not infer ownership from `projects.created_by`, which records who created the project and can be a staff member.

This avoids accidentally broadening access to client projects while simplifying the UI.

## Implemented changes

### Frontend and server actions

- Team settings renamed to Projects; old Team bookmarks still work.
- Creation, membership/access, archive, and restore controls are grouped under Projects.
- The header switcher is the single active-project selector.
- SBI's roster is built from all non-client profiles, including directors and presidents.
- Client-project ownership is separate from displayed account roles; owners are sorted first.
- Portal login status is displayed separately from roles.
- SBI's Add member, Assign owner, Remove, Archive, and configurable-default controls are not offered.
- Server actions reject manual SBI membership changes, client ownership of SBI, and SBI archiving.
- Accounts includes pending logins; Member profiles includes only members with no login.
- Switching projects clears the previous roster immediately and ignores stale responses.

### Prepared database migration — not applied to live Supabase

`supabase/migrations/20260812000009_sbi_internal_workspace.sql`

The migration:

1. Identifies the existing project named SBI once and stores a stable `projects.config.workspace_type = 'sbi'` marker. The marker survives renaming; ambiguous candidates cause the migration to stop.
2. Backfills a membership for every non-client profile, including people already linked to other projects.
3. Automatically maintains SBI membership on profile creation and account-role changes.
4. Removes SBI access when a profile becomes a client.
5. Prevents manual removal/moving of required SBI memberships, while allowing a deleted profile's membership to cascade normally.
6. Prevents SBI from being archived, deleted, or losing its internal marker.
7. Disables the old configurable-default RPC.
8. Leaves client-project memberships and permission policies unchanged.

For an installation with no existing SBI, an administrator can provision a project using the stable marker; its staff links populate automatically. The migration does not silently turn an unrelated client project into SBI.

Until the migration is explicitly applied, the UI recognizes the existing default project named SBI as a transitional fallback. The roster can show a non-client whose persisted SBI access link is still missing; the migration supplies that link.

## Validation and rollout

- TypeScript typecheck passes.
- All 344 frontend tests pass, including roster, action, UI, and project-switching regressions.
- Changed frontend files pass Biome checks.
- The migration passed 22 checks in an isolated Postgres (PGlite) instance, covering backfill, role changes, client-project preservation, rename-safe identity, and protection of SBI membership/workspace.
- The pgTAP test for the old default-project behavior was updated for automatic SBI membership. The full Docker-based pgTAP suite was not run locally because Docker is unavailable.
- The live Supabase database was read only. No migration or live data mutation was performed.

Apply the migration explicitly before relying on the database-level SBI membership invariant. After applying it, verify every non-client has one SBI link and no clients have SBI links. Review rather than delete existing profiles or client-project access to reconcile any remaining differences.
