// Isolated integration test for both dues migrations. Same PGlite setup as dues.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.DUES_PGLITE_MODULE ?? "@electric-sql/pglite");
const db = new PGlite();
await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  create table public.profiles (id bigint primary key, uid uuid, name text not null, role text not null);
  create function public.is_director(check_uid uuid) returns boolean language sql security definer
    set search_path = pg_catalog, pg_temp as $$
      select exists(select 1 from public.profiles where uid = check_uid and role in ('director', 'president'))
    $$;
  insert into public.profiles values
    (1, '00000000-0000-4000-8000-000000000001', 'Director', 'director'),
    (2, '00000000-0000-4000-8000-000000000002', 'President', 'president'),
    (3, '00000000-0000-4000-8000-000000000003', 'Member', 'member'),
    (4, '00000000-0000-4000-8000-000000000004', 'Client', 'client'),
    (5, null, 'Not invited', 'member'), (6, null, 'Later member', 'member');
  alter default privileges in schema public grant all on tables to public, anon, authenticated;
`);
for (const file of ["20261015000000_member_dues.sql", "20261015000001_historical_dues.sql"]) {
  await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
}
const actor = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [`00000000-0000-4000-8000-${String(id).padStart(12, "0")}`]);
  await db.exec("set role authenticated");
};
const manage = async (action, input) => (await db.query("select public.manage_dues($1, $2::jsonb) as id", [action, JSON.stringify(input)])).rows[0].id;
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const key = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

try {
  await actor(1);
  const creation = { request_id: key(10), name: "Fall", amount_cents: 3000, due_on: "2026-01-01", profile_ids: [3, 5], paid_profile_ids: [3] };
  const period = await manage("create_period", creation);
  assert.equal(Number(await scalar("select count(*) from public.dues_accounts")), 2);
  const historical = (await db.query("select * from public.dues_payments")).rows[0];
  assert.equal(historical.historical, true);
  assert.equal(historical.paid_on, null);
  assert.equal(historical.method, null);
  assert.equal(historical.note, "Historical payment—details unknown");
  assert.equal(historical.amount_cents, 3000);
  assert.equal(Number(historical.recorded_by_profile_id), 1);
  assert.equal(historical.recorded_by, "Director");
  assert.ok(historical.recorded_at);
  assert.equal(await manage("create_period", { ...creation, profile_ids: [5, 3, 3], paid_profile_ids: [3, 3] }), period);
  assert.equal(Number(await scalar("select count(*) from public.dues_payments")), 1, "lost-response retries cannot duplicate payments");
  await assert.rejects(() => manage("create_period", { ...creation, paid_profile_ids: [5] }), /different details/);
  await assert.rejects(() => manage("create_period", { ...creation, request_id: key(11), paid_profile_ids: [6] }), /included/);
  assert.equal(Number(await scalar("select count(*) from public.dues_periods")), 1);

  const addition = { request_id: key(12), period_id: period, profile_ids: [6], paid_profile_ids: [6] };
  await manage("assign_members", addition);
  await manage("assign_members", addition);
  assert.equal(Number(await scalar("select count(*) from public.dues_accounts")), 3);
  assert.equal(Number(await scalar("select count(*) from public.dues_payments")), 2);
  await assert.rejects(() => manage("assign_members", { ...addition, request_id: key(13) }), /already assigned/);
  await assert.rejects(() => manage("assign_members", { ...addition, request_id: key(13), profile_ids: [4], paid_profile_ids: [4] }), /organization members/);

  const mark = { request_id: key(14), period_id: period, profile_ids: [5] };
  await actor(2);
  await manage("mark_paid", mark);
  await manage("mark_paid", mark);
  assert.equal(Number(await scalar("select count(*) from public.dues_payments")), 3);
  assert.equal(await scalar("select recorded_by from public.dues_payments where recorded_by_profile_id = 2"), "President");
  await assert.rejects(() => manage("mark_paid", { ...mark, request_id: key(15) }), /already has payments/);
  await assert.rejects(() => db.exec("select public.manage_dues_original('mark_paid', '{}'::jsonb)"), /permission denied/);
  await assert.rejects(() => db.exec("select * from public.dues_bulk_requests"), /permission denied/);

  const second = await manage("create_period", { ...creation, request_id: key(16), name: "Spring", profile_ids: [3, 5, 6], paid_profile_ids: [] });
  const account = async (profile) => Number(await scalar(`select id from public.dues_accounts where period_id = ${second} and profile_id = ${profile}`));
  const partialAccount = await account(3);
  const waivedAccount = await account(6);
  await manage("record_payment", { account_id: partialAccount, request_id: key(17), amount_cents: 1000, paid_on: "2020-01-01", method: "Cash", note: "Partial" });
  await manage("set_waiver", { account_id: waivedAccount, waived: true, reason: "Exempt" });
  await assert.rejects(() => manage("mark_paid", { request_id: key(18), period_id: second, profile_ids: [5, 3] }), /already has payments/);
  await assert.rejects(() => manage("mark_paid", { request_id: key(19), period_id: second, profile_ids: [5, 6] }), /Restore waived/);
  assert.equal(Number(await scalar(`select count(*) from public.dues_payments p join public.dues_accounts a on a.id = p.account_id where a.period_id = ${second} and a.profile_id = 5`)), 0, "a batch failure rolls back all payments");
  await assert.rejects(() => manage("mark_paid", { request_id: key(20), period_id: second, profile_ids: [5, 99] }), /not assigned/);
  assert.equal(Number(await scalar(`select count(*) from public.dues_payments p join public.dues_accounts a on a.id = p.account_id where a.period_id = ${second} and a.profile_id = 5`)), 0);
  const unpaidAccount = await account(5);
  await assert.rejects(() => manage("record_payment", { account_id: unpaidAccount, request_id: key(21), amount_cents: 3000, paid_on: null, method: null, note: "" }), /check constraint/);

  await manage("void_payment", { payment_id: historical.id, reason: "Incorrect historical reconciliation" });
  assert.equal(Number(await scalar(`select count(*) from public.dues_payments where id = ${historical.id} and historical and voided_at is not null`)), 1);
  // A retry after correction must not resurrect a voided historical payment.
  await manage("create_period", creation);
  assert.equal(Number(await scalar(`select count(*) from public.dues_payments where id = ${historical.id} and voided_at is null`)), 0);

  for (const id of [3, 4]) {
    await actor(id);
    await assert.rejects(() => manage("mark_paid", mark), /access required/);
    assert.equal(Number(await scalar("select count(*) from public.dues_payments")), 0);
  }
  await db.exec("reset role; set role anon");
  await assert.rejects(() => manage("mark_paid", mark), /permission denied/);
  console.log("Historical dues integration checks passed: atomic bulk assignments, existing-member reconciliation, unknown details, audit attribution, safe retries, partial/waiver protection, corrections, and access control.");
} finally {
  await db.close();
}
