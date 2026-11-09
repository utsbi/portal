// Isolated PostgreSQL integration tests for the dues migration (no live data).
// Run with @electric-sql/pglite installed, or set DUES_PGLITE_MODULE to its
// absolute dist/index.js path. This bootstraps only the pre-existing auth contract.
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
    (5, null, 'Not invited yet', 'member'),
    (6, null, 'Added later', 'member');
  -- Exercise revocation even under permissive inherited/default privileges.
  alter default privileges in schema public grant all on tables to public, anon, authenticated;
  alter default privileges in schema public grant all on sequences to public, anon, authenticated;
`);
await db.exec(await readFile(new URL("../migrations/20261015000000_member_dues.sql", import.meta.url), "utf8"));
const actor = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [`00000000-0000-4000-8000-${String(id).padStart(12, "0")}`]);
  await db.exec("set role authenticated");
};
const manage = async (action, input) => (await db.query("select public.manage_dues($1, $2::jsonb) as id", [action, JSON.stringify(input)])).rows[0].id;
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];

try {
  await actor(1);
  const creation = { request_id: "00000000-0000-4000-8000-000000000010", name: "Fall", amount_cents: 5000, due_on: "2026-01-01", profile_ids: [3, 5] };
  const period = await manage("create_period", creation);
  assert.equal(await manage("create_period", { ...creation, name: " Fall ", profile_ids: [5, 3, 3] }), period, "retry normalizes names and member order/duplicates");
  for (const patch of [{ name: "Winter" }, { amount_cents: 6000 }, { due_on: "2026-02-01" }, { profile_ids: [3] }]) {
    await assert.rejects(() => manage("create_period", { ...creation, ...patch }), /different details/);
  }
  await assert.rejects(() => manage("create_period", { ...creation, request_id: undefined }), /request ID/);
  await assert.rejects(() => manage("create_period", { ...creation, request_id: "bad" }), /uuid/);
  for (const due_on of ["infinity", "-infinity"]) {
    await assert.rejects(() => manage("create_period", { ...creation, request_id: "00000000-0000-4000-8000-000000000011", due_on }), /check constraint/);
  }
  assert.equal(Number(await scalar("select count(*) from public.dues_accounts")), 2, "includes members without portal accounts");
  await manage("assign_members", { period_id: period, profile_ids: [3, 5] });
  assert.equal(Number(await scalar("select count(*) from public.dues_accounts")), 2, "assignment is idempotent");
  await manage("assign_members", { period_id: period, profile_ids: [6] });
  assert.equal(await manage("create_period", creation), period, "later assignments do not change the original retry payload");
  assert.equal(Number(await scalar("select count(*) from public.dues_accounts")), 3);
  await assert.rejects(() => manage("create_period", { ...creation, request_id: "00000000-0000-4000-8000-000000000011", profile_ids: [4] }), /organization members/);
  assert.equal(Number(await scalar("select count(*) from public.dues_periods")), 1, "invalid assignments cannot create partial periods");
  const account = await scalar("select id from public.dues_accounts where profile_id = 3");
  const payment = { account_id: account, request_id: "d2df01a9-fd08-4624-a370-9c56e37c8234", amount_cents: 2000, paid_on: "2020-01-01", method: "Cash", note: "Historical payment" };
  const paymentId = await manage("record_payment", payment);
  assert.equal(await manage("record_payment", payment), paymentId, "retry does not duplicate payment");
  assert.equal(Number(await scalar("select recorded_by_profile_id from public.dues_payments")), 1);
  await assert.rejects(() => manage("record_payment", { ...payment, request_id: "d2df01a9-fd08-4624-a370-9c56e37c8236", paid_on: "-infinity" }), /check constraint/);
  await assert.rejects(() => manage("record_payment", { ...payment, amount_cents: 1000 }), /different details/, "reusing a key with changed details must not silently succeed");
  assert.equal(Number(await scalar("select sum(amount_cents) from public.dues_payments where voided_at is null")), 2000);
  await assert.rejects(() => manage("record_payment", { ...payment, request_id: "d2df01a9-fd08-4624-a370-9c56e37c8235", amount_cents: 4000 }), /outstanding balance/);
  await assert.rejects(() => manage("record_payment", { ...payment, request_id: "d2df01a9-fd08-4624-a370-9c56e37c8235", paid_on: "2999-01-01" }), /future/);
  await assert.rejects(() => manage("set_waiver", { account_id: account, waived: true, reason: "Exempt" }), /Void existing payments/);
  await assert.rejects(() => manage("void_payment", { payment_id: paymentId, reason: " " }), /reason/);
  await manage("void_payment", { payment_id: paymentId, reason: "Duplicate from old records" });
  assert.equal(Number(await scalar("select count(*) from public.dues_payments")), 1, "corrections preserve originals");
  assert.equal(await scalar("select voided_by from public.dues_payments"), "Director");
  assert.equal(Number(await scalar("select voided_by_profile_id from public.dues_payments")), 1);
  await manage("set_waiver", { account_id: account, waived: true, reason: "Exempt" });
  await assert.rejects(() => manage("record_payment", { ...payment, request_id: "d2df01a9-fd08-4624-a370-9c56e37c8235" }), /Restore dues/);
  await manage("set_waiver", { account_id: account, waived: false, reason: "Membership reinstated" });
  assert.equal(Number(await scalar(`select waiver_by_profile_id from public.dues_accounts where id = ${account}`)), 1);
  await db.exec("reset role; update public.profiles set name = 'Renamed director' where id = 1");
  await actor(1);
  assert.equal(await scalar("select recorded_by from public.dues_payments"), "Director", "name snapshot survives rename");
  await db.exec("reset role; delete from public.profiles where id = 1");
  await actor(2);
  assert.equal(Number(await scalar("select recorded_by_profile_id from public.dues_payments")), 1, "recorder identity survives deletion");
  assert.equal(Number(await scalar("select voided_by_profile_id from public.dues_payments")), 1, "void actor survives deletion");
  assert.equal(Number(await scalar(`select waiver_by_profile_id from public.dues_accounts where id = ${account}`)), 1, "waiver actor survives deletion");
  assert.equal(await manage("create_period", creation), period, "retry does not depend on original creator still existing");
  await manage("record_payment", { ...payment, request_id: "d2df01a9-fd08-4624-a370-9c56e37c8235", amount_cents: 5000 });
  assert.equal(await scalar("select recorded_by from public.dues_payments where voided_at is null"), "President");
  assert.equal(Number(await scalar("select recorded_by_profile_id from public.dues_payments where voided_at is null")), 2);
  await assert.rejects(() => db.exec("update public.dues_accounts set amount_cents = 1"), /permission denied/, "even staff cannot bypass the RPC");
  for (const table of ["dues_periods", "dues_accounts", "dues_payments"]) {
    await assert.rejects(() => db.exec(`truncate public.${table} cascade`), /permission denied/);
    await assert.rejects(() => db.exec(`select nextval('public.${table}_id_seq')`), /permission denied/);
  }
  for (const roleId of [3, 4]) {
    await actor(roleId);
    for (const table of ["dues_periods", "dues_accounts", "dues_payments"]) {
      assert.equal(Number(await scalar(`select count(*) from public.${table}`)), 0, `${roleId} cannot read ${table}`);
    }
    await assert.rejects(() => manage("assign_members", { period_id: period, profile_ids: [3] }), /access required/);
  }
  await db.exec("reset role; set role anon");
  await assert.rejects(() => db.exec("select * from public.dues_periods"), /permission denied/);
  await assert.rejects(() => manage("create_period", {}), /permission denied/);
  console.log("Dues SQL integration checks passed: migration, atomicity, balances, period/payment retries, stable actor snapshots, finite dates, corrections, waivers, staff RPC, RLS, and anonymous denial.");
} finally {
  await db.close();
}
