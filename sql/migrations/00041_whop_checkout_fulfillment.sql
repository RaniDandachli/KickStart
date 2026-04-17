-- Idempotent Whop payment fulfillment (wallet / prize credits) — parallel to Stripe checkout sessions.

create table if not exists public.whop_fulfilled_payments (
  payment_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  whop_event_id text,
  fulfilled_at timestamptz not null default now()
);

alter table public.whop_fulfilled_payments enable row level security;

create policy "whop_fulfilled_no_select" on public.whop_fulfilled_payments for select using (false);
create policy "whop_fulfilled_no_insert" on public.whop_fulfilled_payments for insert with check (false);
create policy "whop_fulfilled_no_update" on public.whop_fulfilled_payments for update using (false);
create policy "whop_fulfilled_no_delete" on public.whop_fulfilled_payments for delete using (false);

create or replace function public.fulfill_whop_payment(
  p_user_id uuid,
  p_payment_id text,
  p_wallet_cents_add bigint,
  p_prize_credits_add bigint,
  p_description text,
  p_whop_event_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.whop_fulfilled_payments (payment_id, user_id, whop_event_id)
    values (p_payment_id, p_user_id, p_whop_event_id);
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'duplicate', true);
  end;

  if coalesce(p_wallet_cents_add, 0) < 0 or coalesce(p_prize_credits_add, 0) < 0 then
    raise exception 'invalid amounts';
  end if;
  if coalesce(p_wallet_cents_add, 0) = 0 and coalesce(p_prize_credits_add, 0) = 0 then
    raise exception 'nothing to apply';
  end if;

  update public.profiles
  set
    wallet_cents = wallet_cents + coalesce(p_wallet_cents_add, 0),
    prize_credits = prize_credits + coalesce(p_prize_credits_add, 0),
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'profile not found';
  end if;

  if coalesce(p_wallet_cents_add, 0) > 0 then
    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_user_id,
      'credit_earn',
      p_wallet_cents_add,
      'wallet_cents',
      p_description,
      jsonb_build_object('whop_payment_id', p_payment_id, 'source', 'whop')
    );
  end if;

  if coalesce(p_prize_credits_add, 0) > 0 then
    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_user_id,
      'prize_credit_earn',
      p_prize_credits_add,
      'prize_credits',
      p_description,
      jsonb_build_object('whop_payment_id', p_payment_id, 'source', 'whop')
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.fulfill_whop_payment(uuid, text, bigint, bigint, text, text) from public;
grant execute on function public.fulfill_whop_payment(uuid, text, bigint, bigint, text, text) to service_role;
