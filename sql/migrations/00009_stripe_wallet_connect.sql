-- Stripe wallet top-up + Connect (creator) account ids; idempotent checkout fulfillment.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_connect_account_id text;

comment on column public.profiles.stripe_customer_id is 'Stripe Customer id (cus_…) for card payments.';
comment on column public.profiles.stripe_connect_account_id is 'Stripe Connect Express account id (acct_…) for payouts.';

-- One row per fulfilled Checkout Session (idempotency for webhooks).
create table if not exists public.stripe_fulfilled_checkout_sessions (
  checkout_session_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_event_id text,
  fulfilled_at timestamptz not null default now()
);

alter table public.stripe_fulfilled_checkout_sessions enable row level security;

create policy "stripe_fulfilled_no_select" on public.stripe_fulfilled_checkout_sessions
  for select using (false);

create policy "stripe_fulfilled_no_insert" on public.stripe_fulfilled_checkout_sessions
  for insert with check (false);

create policy "stripe_fulfilled_no_update" on public.stripe_fulfilled_checkout_sessions
  for update using (false);

create policy "stripe_fulfilled_no_delete" on public.stripe_fulfilled_checkout_sessions
  for delete using (false);

-- Idempotent fulfillment: insert session row + credit wallet / prize credits in one transaction.
create or replace function public.fulfill_stripe_checkout_session(
  p_user_id uuid,
  p_checkout_session_id text,
  p_wallet_cents_add bigint,
  p_prize_credits_add bigint,
  p_description text,
  p_stripe_event_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.stripe_fulfilled_checkout_sessions (checkout_session_id, user_id, stripe_event_id)
    values (p_checkout_session_id, p_user_id, p_stripe_event_id);
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
      jsonb_build_object('stripe_checkout_session_id', p_checkout_session_id, 'source', 'stripe')
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
      jsonb_build_object('stripe_checkout_session_id', p_checkout_session_id, 'source', 'stripe')
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.fulfill_stripe_checkout_session(uuid, text, bigint, bigint, text, text) from public;
grant execute on function public.fulfill_stripe_checkout_session(uuid, text, bigint, bigint, text, text) to service_role;
