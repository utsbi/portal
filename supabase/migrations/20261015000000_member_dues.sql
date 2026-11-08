-- Organization-wide dues. All reads are staff-only; writes go through one
-- audited, atomic RPC. No payment processing and no project-role access.
create table public.dues_periods (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  -- Preserve the original selection; later assignments must not change retries.
  initial_profile_ids bigint[] not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  due_on date not null check (isfinite(due_on)),
  created_by bigint references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.dues_accounts (
  id bigint generated always as identity primary key,
  period_id bigint not null references public.dues_periods(id),
  profile_id bigint not null references public.profiles(id),
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  waived boolean not null default false,
  waiver_reason text,
  waiver_by text,
  -- Immutable identity snapshots, deliberately not FKs: retain attribution even
  -- if the actor's profile is subsequently deleted. Names remain display snapshots.
  waiver_by_profile_id bigint,
  waiver_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_id, profile_id)
);
create table public.dues_payments (
  id bigint generated always as identity primary key,
  account_id bigint not null references public.dues_accounts(id),
  request_id uuid not null unique,
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  paid_on date not null check (isfinite(paid_on)),
  method text not null check (method in ('Venmo', 'Zelle', 'Cash', 'Check', 'Other')),
  note text not null default '' check (length(note) <= 1000),
  recorded_by text not null,
  recorded_by_profile_id bigint not null,
  recorded_at timestamptz not null default now(),
  void_reason text,
  voided_by text,
  voided_by_profile_id bigint,
  voided_at timestamptz
);
create index dues_payments_account_idx on public.dues_payments(account_id);

alter table public.dues_periods enable row level security;
alter table public.dues_accounts enable row level security;
alter table public.dues_payments enable row level security;
create policy dues_periods_staff_read on public.dues_periods for select to authenticated using (public.is_director(auth.uid()));
create policy dues_accounts_staff_read on public.dues_accounts for select to authenticated using (public.is_director(auth.uid()));
create policy dues_payments_staff_read on public.dues_payments for select to authenticated using (public.is_director(auth.uid()));
revoke all on public.dues_periods, public.dues_accounts, public.dues_payments from public, anon, authenticated;
revoke all on sequence public.dues_periods_id_seq, public.dues_accounts_id_seq,
  public.dues_payments_id_seq from public, anon, authenticated;
grant select on public.dues_periods, public.dues_accounts, public.dues_payments to authenticated;

create function public.manage_dues(p_action text, p_input jsonb)
returns bigint
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  actor_id bigint;
  actor_name text;
  target_id bigint;
  period_row public.dues_periods;
  account_row public.dues_accounts;
  payment_row public.dues_payments;
  paid bigint;
  member_ids bigint[];
  cents integer;
  reason text;
begin
  select id, name into actor_id, actor_name from public.profiles
    where uid = auth.uid() and role::text in ('director', 'president');
  if actor_id is null then raise exception 'Director or president access required'; end if;

  if p_action in ('create_period', 'assign_members') then
    select array_agg(distinct value::bigint order by value::bigint) into member_ids
      from jsonb_array_elements_text(p_input->'profile_ids');
    if coalesce(cardinality(member_ids), 0) = 0 then raise exception 'Select at least one member'; end if;
    if p_action = 'create_period' then
      if p_input->>'request_id' is null then raise exception 'A period request ID is required'; end if;
      -- The unique key also serializes concurrent retries. Never infer a retry
      -- from the period name: distinct periods may legitimately share a name.
      insert into public.dues_periods(request_id, initial_profile_ids, name, amount_cents, due_on, created_by)
      values ((p_input->>'request_id')::uuid, member_ids, btrim(p_input->>'name'),
        (p_input->>'amount_cents')::integer, (p_input->>'due_on')::date, actor_id)
      on conflict (request_id) do nothing
      returning * into period_row;
      if not found then
        select * into period_row from public.dues_periods where request_id = (p_input->>'request_id')::uuid;
        if period_row.initial_profile_ids is distinct from member_ids
          or period_row.name is distinct from btrim(p_input->>'name')
          or period_row.amount_cents is distinct from (p_input->>'amount_cents')::integer
          or period_row.due_on is distinct from (p_input->>'due_on')::date then
          raise exception 'Period request already recorded with different details; reload the dues tracker';
        end if;
        return period_row.id;
      end if;
    else
      select * into period_row from public.dues_periods where id = (p_input->>'period_id')::bigint;
      if not found then raise exception 'Dues period not found'; end if;
    end if;
    if exists (select 1 from unnest(member_ids) m(id) left join public.profiles p on p.id = m.id
      where p.id is null or p.role::text = 'client') then
      raise exception 'Only existing organization members can be assigned dues';
    end if;
    insert into public.dues_accounts(period_id, profile_id, amount_cents)
      select period_row.id, id, period_row.amount_cents from unnest(member_ids) m(id)
      on conflict (period_id, profile_id) do nothing;
    return period_row.id;
  end if;

  if p_action = 'void_payment' then
    select account_id into target_id from public.dues_payments where id = (p_input->>'payment_id')::bigint;
  else
    target_id := (p_input->>'account_id')::bigint;
  end if;
  -- Serialize all balance changes for a member, including concurrent payments.
  select * into account_row from public.dues_accounts where id = target_id for update;
  if not found then raise exception 'Dues account not found'; end if;
  select coalesce(sum(amount_cents), 0) into paid from public.dues_payments
    where account_id = target_id and voided_at is null;

  if p_action = 'record_payment' then
    select * into payment_row from public.dues_payments where request_id = (p_input->>'request_id')::uuid;
    if found then
      if payment_row.account_id <> target_id
        or payment_row.amount_cents is distinct from (p_input->>'amount_cents')::integer
        or payment_row.paid_on is distinct from (p_input->>'paid_on')::date
        or payment_row.method is distinct from p_input->>'method'
        or payment_row.note is distinct from coalesce(btrim(p_input->>'note'), '') then
        raise exception 'Payment request already recorded with different details; reload the member record';
      end if;
      return payment_row.id;
    end if;
    cents := (p_input->>'amount_cents')::integer;
    if account_row.waived then raise exception 'Restore dues before recording a payment'; end if;
    if cents is null or cents <= 0 or cents + paid > account_row.amount_cents then
      raise exception 'Payment must be positive and cannot exceed the outstanding balance';
    end if;
    if (p_input->>'paid_on')::date > current_date then raise exception 'Payment date cannot be in the future'; end if;
    insert into public.dues_payments(account_id, request_id, amount_cents, paid_on, method, note, recorded_by, recorded_by_profile_id)
    values (target_id, (p_input->>'request_id')::uuid, cents, (p_input->>'paid_on')::date,
      p_input->>'method', coalesce(btrim(p_input->>'note'), ''), actor_name, actor_id)
    returning id into target_id;
    return target_id;
  elsif p_action = 'set_waiver' then
    reason := btrim(p_input->>'reason');
    if (p_input->>'waived')::boolean is null then raise exception 'A waiver state is required'; end if;
    if reason is null or length(reason) not between 1 and 1000 then raise exception 'A reason is required (up to 1000 characters)'; end if;
    if (p_input->>'waived')::boolean and paid > 0 then
      raise exception 'Void existing payments before waiving dues';
    end if;
    update public.dues_accounts set waived = (p_input->>'waived')::boolean,
      waiver_reason = reason, waiver_by = actor_name, waiver_by_profile_id = actor_id,
      waiver_at = now() where id = target_id;
    return target_id;
  elsif p_action = 'void_payment' then
    reason := btrim(p_input->>'reason');
    if reason is null or length(reason) not between 1 and 1000 then raise exception 'A correction reason is required (up to 1000 characters)'; end if;
    update public.dues_payments set void_reason = reason, voided_by = actor_name,
      voided_by_profile_id = actor_id, voided_at = now()
      where id = (p_input->>'payment_id')::bigint and voided_at is null;
    return target_id;
  end if;
  raise exception 'Unknown dues action';
end;
$$;
revoke all on function public.manage_dues(text, jsonb) from public, anon;
grant execute on function public.manage_dues(text, jsonb) to authenticated;
