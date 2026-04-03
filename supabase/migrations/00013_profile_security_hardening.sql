-- Lock down profile columns that must only change via SECURITY DEFINER RPCs / service role (Stripe webhooks, Edge).
-- Also fix grant_arcade_prize_credits: it updates prize_credits and must set kickclash.allow_profile_economy_write
-- when invoked with a user JWT (otherwise trg_profiles_protect_economy rejects the update).

create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  -- Service role / internal (no end-user JWT): allow
  if auth.uid() is null then
    return new;
  end if;
  -- Trusted RPCs set this for one transaction (redeem, daily claim, gift cards, grants, etc.)
  if current_setting('kickclash.allow_profile_economy_write', true) = '1' then
    return new;
  end if;
  -- End user updating their own row: only safe profile fields (not economy, billing, or moderation)
  if auth.uid() = old.id then
    if new.wallet_cents is distinct from old.wallet_cents
       or new.prize_credits is distinct from old.prize_credits
       or new.redeem_tickets is distinct from old.redeem_tickets
       or new.gems is distinct from old.gems
       or new.role is distinct from old.role
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_connect_account_id is distinct from old.stripe_connect_account_id
       or new.last_daily_claim_ymd is distinct from old.last_daily_claim_ymd
       or new.suspended_until is distinct from old.suspended_until
       or new.cheating_review_flag is distinct from old.cheating_review_flag
    then
      raise exception 'Economy, Stripe, daily-claim, and moderation fields cannot be changed from the client';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_sensitive_columns() is
  'Rejects client updates to balances, role, Stripe ids, daily claim date, and moderation flags unless kickclash.allow_profile_economy_write=1 in-session.';

-- ---------------------------------------------------------------------------
-- grant_arcade_prize_credits: allow prize_credits update when called as authenticated user
-- ---------------------------------------------------------------------------
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

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

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
