-- Bulk reconciliation with honest unknown payment dates/methods. Existing
-- dated payments and the original migration remain unchanged.
alter table public.dues_payments
  alter column paid_on drop not null,
  alter column method drop not null,
  add column historical boolean not null default false,
  add constraint dues_payment_known_details check (
    historical or (paid_on is not null and method is not null)
  );

-- Durable operation receipts make creation/assignment + historical payments
-- atomic and safely retryable, even after a response is lost.
create table public.dues_bulk_requests (
  request_id uuid primary key,
  action text not null,
  payload jsonb not null,
  period_id bigint references public.dues_periods(id),
  created_at timestamptz not null default now()
);
alter table public.dues_bulk_requests enable row level security;
revoke all on public.dues_bulk_requests from public, anon, authenticated;

-- Keep the tested single-record operations private behind the new entry point.
alter function public.manage_dues(text, jsonb) rename to manage_dues_original;
revoke all on function public.manage_dues_original(text, jsonb) from public, anon, authenticated;

create function public.manage_dues(p_action text, p_input jsonb)
returns bigint
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  actor_id bigint;
  actor_name text;
  member_ids bigint[];
  paid_ids bigint[];
  existing_ids bigint[];
  request_key uuid;
  normalized jsonb;
  receipt public.dues_bulk_requests;
  target_period bigint;
  account_row public.dues_accounts;
  selected_count integer := 0;
begin
  select id, name into actor_id, actor_name from public.profiles
    where uid = auth.uid() and role::text in ('director', 'president');
  if actor_id is null then raise exception 'Director or president access required'; end if;

  if p_action not in ('create_period', 'assign_members', 'mark_paid') then
    return public.manage_dues_original(p_action, p_input);
  end if;

  select array_agg(distinct value::bigint order by value::bigint) into member_ids
    from jsonb_array_elements_text(p_input->'profile_ids');
  if coalesce(cardinality(member_ids), 0) = 0 or cardinality(member_ids) > 5000
    or array_position(member_ids, null) is not null then
    raise exception 'Select between 1 and 5000 members';
  end if;
  if p_action = 'mark_paid' then
    paid_ids := member_ids;
  else
    select coalesce(array_agg(distinct value::bigint order by value::bigint), '{}'::bigint[]) into paid_ids
      from jsonb_array_elements_text(coalesce(p_input->'paid_profile_ids', '[]'::jsonb));
  end if;
  if not paid_ids <@ member_ids or array_position(paid_ids, null) is not null then
    raise exception 'Already-paid members must be included in the selected members';
  end if;

  -- Backward-compatible assignment without a payment needs no new receipt.
  if p_action = 'assign_members' and p_input->>'request_id' is null and cardinality(paid_ids) = 0 then
    return public.manage_dues_original(p_action, p_input);
  end if;
  if p_input->>'request_id' is null then raise exception 'A bulk request ID is required'; end if;
  request_key := (p_input->>'request_id')::uuid;
  normalized := jsonb_build_object('profile_ids', member_ids, 'paid_profile_ids', paid_ids);
  if p_action = 'create_period' then
    normalized := normalized || jsonb_build_object('name', btrim(p_input->>'name'),
      'amount_cents', (p_input->>'amount_cents')::integer, 'due_on', (p_input->>'due_on')::date);
  else
    normalized := normalized || jsonb_build_object('period_id', (p_input->>'period_id')::bigint);
  end if;
  insert into public.dues_bulk_requests(request_id, action, payload)
    values (request_key, p_action, normalized)
    on conflict (request_id) do nothing returning * into receipt;
  if not found then
    select * into receipt from public.dues_bulk_requests where request_id = request_key;
    if receipt.action is distinct from p_action or receipt.payload is distinct from normalized then
      raise exception 'Bulk request already recorded with different details; reload the dues tracker';
    end if;
    return receipt.period_id;
  end if;

  if p_action = 'create_period' then
    -- An old-version creation cannot be reinterpreted as a new paid assignment.
    if cardinality(paid_ids) > 0 and exists (select 1 from public.dues_periods where request_id = request_key) then
      raise exception 'Period already exists; use Mark already paid to reconcile its members';
    end if;
    target_period := public.manage_dues_original(p_action, p_input);
  else
    target_period := (p_input->>'period_id')::bigint;
    -- Serialize assignment/reconciliation within this period as well as locking
    -- each affected account below. Direct payment entry also locks the account.
    perform 1 from public.dues_periods where id = target_period for update;
    if not found then raise exception 'Dues period not found'; end if;
    if p_action = 'assign_members' then
      select coalesce(array_agg(profile_id), '{}'::bigint[]) into existing_ids
        from public.dues_accounts where period_id = target_period;
      if paid_ids && existing_ids then
        raise exception 'Member already assigned; use Mark already paid for existing records';
      end if;
      perform public.manage_dues_original(p_action, p_input);
    end if;
  end if;

  for account_row in
    select * from public.dues_accounts where period_id = target_period
      and profile_id = any(paid_ids) order by id for update
  loop
    selected_count := selected_count + 1;
    if account_row.waived then raise exception 'Restore waived dues before marking a member paid'; end if;
    if exists (select 1 from public.dues_payments where account_id = account_row.id and voided_at is null) then
      raise exception 'Member already has payments; use their record for partial payments or corrections';
    end if;
    insert into public.dues_payments(account_id, request_id, amount_cents, paid_on, method,
      historical, note, recorded_by, recorded_by_profile_id)
    values (account_row.id, gen_random_uuid(), account_row.amount_cents, null, null, true,
      'Historical payment—details unknown', actor_name, actor_id);
  end loop;
  if selected_count <> cardinality(paid_ids) then raise exception 'Some members are not assigned to this period'; end if;
  update public.dues_bulk_requests set period_id = target_period where request_id = request_key;
  return target_period;
end;
$$;
revoke all on function public.manage_dues(text, jsonb) from public, anon;
grant execute on function public.manage_dues(text, jsonb) to authenticated;
