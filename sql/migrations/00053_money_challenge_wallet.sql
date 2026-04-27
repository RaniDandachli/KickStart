-- Money Challenges paid tier — wallet debit once per calendar day, then reuse solo_challenge_daily_attempts.

alter table public.transactions drop constraint if exists transactions_kind_check;

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend',
  'redeem_ticket_spend',
  'wallet_withdraw',
  'h2h_contest_entry',
  'h2h_contest_entry_refund',
  'tournament_entry',
  'tournament_prize_grant',
  'weekly_race_entry',
  'weekly_race_prize',
  'money_challenge_entry'
));

create table if not exists public.money_challenge_daily_payments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null,
  calendar_day text not null,
  paid_cents int not null check (paid_cents > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_id, calendar_day),
  constraint mcc_day_fmt check (calendar_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

create index if not exists money_challenge_payments_day_idx
  on public.money_challenge_daily_payments (calendar_day);

comment on table public.money_challenge_daily_payments is
  'Paid Money Challenge unlock rows — wallet debit once before solo_challenge_consume_try for matching challenge id.';

alter table public.money_challenge_daily_payments enable row level security;

drop policy if exists money_challenge_pay_select_own on public.money_challenge_daily_payments;
create policy money_challenge_pay_select_own
  on public.money_challenge_daily_payments for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.money_challenge_daily_payments from authenticated;

create or replace function public.enter_money_challenge_wallet(
  p_challenge_id text,
  p_calendar_day text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_fee int;
  v_slug text := nullif(trim(p_challenge_id), '');
  cd text := nullif(trim(p_calendar_day), '');
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if cd is null or cd !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_calendar_day');
  end if;

  if v_slug = 'money_tapdash_hot' then v_fee := 500;
  else
    return jsonb_build_object('ok', false, 'error', 'unknown_challenge');
  end if;

  if exists (
    select 1 from public.money_challenge_daily_payments p
    where p.user_id = v_me and p.challenge_id = v_slug and p.calendar_day = cd
  ) then
    return jsonb_build_object('ok', true, 'already_unlocked', true, 'challenge_id', v_slug, 'paid_cents', v_fee);
  end if;

  update public.profiles
  set wallet_cents = wallet_cents - v_fee, updated_at = now()
  where id = v_me and wallet_cents >= v_fee;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient_wallet');
  end if;

  insert into public.transactions (user_id, kind, amount, currency, description, metadata)
  values (
    v_me,
    'money_challenge_entry',
    v_fee,
    'wallet_cents',
    'Money Challenge entry',
    jsonb_build_object('challenge_id', v_slug, 'calendar_day', cd)
  );

  insert into public.money_challenge_daily_payments (user_id, challenge_id, calendar_day, paid_cents)
  values (v_me, v_slug, cd, v_fee);

  return jsonb_build_object('ok', true, 'challenge_id', v_slug, 'paid_cents', v_fee);
end;
$$;

comment on function public.enter_money_challenge_wallet(text, text) is
  'Debit wallet once per (user, challenge, local calendar day) to unlock paid Money Challenge attempts for that day.';

grant execute on function public.enter_money_challenge_wallet(text, text) to authenticated;

create or replace function public.solo_challenge_consume_try(
  p_challenge_id text,
  p_calendar_day text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_max int;
  v_allowed text[] := array['tap_dash_100', 'money_tapdash_hot']::text[];
  v_prev int;
  v_new int;
  id text := nullif(trim(p_challenge_id), '');
  cd text := nullif(trim(p_calendar_day), '');
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if id is null or not (id = any(v_allowed)) then
    return jsonb_build_object('ok', false, 'error', 'invalid_challenge');
  end if;

  if cd is null or cd !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_calendar_day');
  end if;

  -- Free tap_dash_100: 10 tries/day · paid tier: requires unlock row · both caps at 10.
  case id
    when 'tap_dash_100' then v_max := 10;
    when 'money_tapdash_hot' then v_max := 10;
    else v_max := 50;
  end case;

  if id = 'money_tapdash_hot' then
    if not exists (
      select 1 from public.money_challenge_daily_payments p
      where p.user_id = v_me and p.challenge_id = id and p.calendar_day = cd
    ) then
      return jsonb_build_object('ok', false, 'error', 'payment_required', 'challenge_id', id);
    end if;
  end if;

  select a.attempts
    into v_prev
  from public.solo_challenge_daily_attempts a
  where a.user_id = v_me
    and a.challenge_id = id
    and a.calendar_day = cd
  for update;

  if not found then
    insert into public.solo_challenge_daily_attempts (user_id, challenge_id, calendar_day, attempts)
    values (v_me, id, cd, 1);
    v_new := 1;
    return jsonb_build_object(
      'ok', true,
      'attempts_after', v_new,
      'max_attempts', v_max
    );
  end if;

  if v_prev >= v_max then
    return jsonb_build_object(
      'ok', false,
      'error', 'daily_limit',
      'attempts_after', v_prev,
      'max_attempts', v_max
    );
  end if;

  update public.solo_challenge_daily_attempts
  set
    attempts = attempts + 1,
    updated_at = now()
  where user_id = v_me
    and challenge_id = id
    and calendar_day = cd
  returning attempts into v_new;

  return jsonb_build_object(
    'ok', true,
    'attempts_after', v_new,
    'max_attempts', v_max
  );
end;
$$;

comment on function public.solo_challenge_consume_try(text, text) is
  'Solo Money Challenge tries; tap_dash_100 + money_tapdash_hot capped at 10/day; paid slug requires unlock row same day.';
