# Member dues

The organization-wide tracker lives at `/dashboard/admin/dues`. It is independent
of the selected project. Global directors and the president can read and manage
records; ordinary members, clients, and project-only directors cannot.

## Database setup

Apply `supabase/migrations/20261015000000_member_dues.sql` followed by
`supabase/migrations/20261015000001_historical_dues.sql` through the normal
Supabase migration workflow before using this screen. The application does not
apply migrations automatically. If records cannot load, it shows an unavailable
state instead of fabricated balances or an empty ledger.

The migration creates periods, member assessments, and payment records. Reads use
the authenticated Supabase client and staff-only RLS. Direct writes are revoked;
`manage_dues` independently authenticates the caller and handles mutations in a
single transaction. Account row locks serialize balance changes. No service-role
client is used by the dues feature.

## Workflow

1. Create a named period, USD amount per member, and due date. Explicitly select
   the members who owe dues, including member profiles without portal accounts.
   Clients are ineligible. Creating a period and its assessments is atomic.
   Creation requires a caller-generated `request_id` UUID, retained when retrying
   the same submission. Reusing it with different period details or a different
   initial member selection is rejected. Adding members later does not affect retries.
2. When creating a period or adding members, mark selected members **Already paid**
   to assign dues and record their full historical payment in one transaction.
   Payment date and method are unknown (NULL), not fabricated. Recorder identity
   and the actual recording timestamp are retained. Deselecting a member clears
   their paid mark. Existing assessments are never overwritten.
   For members already assigned, use **Mark already paid** to reconcile multiple
   unpaid accounts at once. Accounts with partial payments or waivers are excluded
   and independently rejected by the database. Bulk receipts make retries safe.
3. Open a member record and enter each payment received outside the portal.
   Historical dates and partial payments are supported. The original payment
   date is separate from the recording timestamp and recorder's name. Payment,
   void, and waiver actors also have stable profile-ID snapshots, intentionally
   without foreign keys so attribution survives actor profile deletion.
4. Correct a mistaken payment by voiding it with a reason, then record its
   replacement. Voiding does not refund money or delete the original record.
5. Waive unpaid assessments with a reason, or restore waived dues with a reason.
   Existing payments must be voided before an assessment can be waived. The
   assessment retains the latest waiver/restoration reason, actor, and timestamp;
   unlike payment history, this is not a full waiver event log.
6. Export the entire selected period as CSV (search/status filters do not limit
   exports). Spreadsheet formulas in text fields are neutralized.

Amounts are integer cents. Payments cannot exceed the outstanding balance.
Period, bulk-operation, and payment request UUIDs prevent duplicate records when retrying the same
request. The UI retains each key while its form remains open; after closing or
reloading, check the ledger before submitting again. The UI
never collects or processes money. Unpaid means no recorded payment, not proof
that a member has not paid; reconcile existing records before following up.

Period definitions and assessment amounts are intentionally fixed in this first
version. There is no bulk import, automatic reminder, online checkout, refund
processing, or hard-delete action. Financial references prevent deleting a member
profile that has dues records.

## Checks

Frontend tests cover arithmetic, input validation, CSV safety, actions, role gates,
and the member/payment workflows. Run with the frontend's standard test command.

The isolated PostgreSQL integration check uses PGlite (not a live Supabase project):

```sh
npm install --prefix /tmp/dues-sql-check --no-package-lock @electric-sql/pglite
DUES_PGLITE_MODULE=/tmp/dues-sql-check/node_modules/@electric-sql/pglite/dist/index.js \
  node supabase/tests/dues.test.mjs
DUES_PGLITE_MODULE=/tmp/dues-sql-check/node_modules/@electric-sql/pglite/dist/index.js \
  node supabase/tests/dues-historical.test.mjs
```

Run these from the repository root. The historical checks also verify bulk
atomicity, unknown payment details, receipt idempotency, and protection against
reconciling partial or waived accounts. The original check verifies migration execution, RLS,
RPC authorization, atomic creation, period/payment idempotency and changed-payload
rejection, stable actor identities after renames/deletion, payment caps, finite
historical dates, waivers, and immutable original payment records. It bootstraps the existing auth
contract in an isolated database; it does not replace testing the full migration
history against a staging Supabase instance.
