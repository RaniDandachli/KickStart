-- Idempotent prize_credits grants for in-app events (e.g. credit cups). Callable by authenticated users only.

create table if not exists public.arcade_prize_credit_grants (
  idempotency_key text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.arcade_prize_credit_grants enable row level security;

create policy "arcade_prize_grants_no_select" on public.arcade_prize_credit_grants for select using (false);
create policy "arcade_prize_grants_no_insert" on public.arcade_prize_credit_grants for insert with check (false);
create policy "arcade_prize_grants_no_update" on public.arcade_prize_credit_grants for update using (false);
create policy "arcade_prize_grants_no_delete" on public.arcade_prize_credit_grants for delete using (false);

create or replace function public.grant_arcade_prize_credits(
  p_amount bigint,
  p_description text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_idempotency_key');
  end if;

  if p_amount is null or p_amount not in (1000, 2000, 3000, 4000, 5000) then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  begin
    insert into public.arcade_prize_credit_grants (idempotency_key, user_id, amount, description)
    values (p_idempotency_key, v_user, p_amount, left(p_description, 500));
  exception
    when unique_violation then
      return jsonb_build_object('ok', true, 'duplicate', true);
  end;

  update public.profiles
  set
    prize_credits = prize_credits + p_amount,
    updated_at = now()
  where id = v_user;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  insert into public.transactions (user_id, kind, amount, currency, description, metadata)
  values (
    v_user,
    'prize_credit_earn',
    p_amount,
    'prize_credits',
    coalesce(nullif(trim(p_description), ''), 'Arcade prize credits'),
    jsonb_build_object('idempotency_key', p_idempotency_key, 'source', 'grant_arcade_prize_credits')
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.grant_arcade_prize_credits(bigint, text, text) from public;
grant execute on function public.grant_arcade_prize_credits(bigint, text, text) to authenticated;

comment on function public.grant_arcade_prize_credits is
  'Adds prize_credits (1000–5000) once per idempotency_key; for cup wins and similar.';
