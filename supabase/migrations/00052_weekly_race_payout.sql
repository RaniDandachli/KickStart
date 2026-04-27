-- Duplicate of supabase/migrations/00052_weekly_race_payout.sql (repo mirror).
-- Credits top 3 entrants by real best_score per day_key (after UTC date has passed).

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
  'weekly_race_prize'
));

comment on constraint transactions_kind_check on public.transactions is
  'weekly_race_prize: cash wallet credit for top-3 daily Weekly Race leaderboard.';

create table if not exists public.weekly_race_daily_settlement (
  day_key text primary key,
  settled_at timestamptz not null default now()
);

comment on table public.weekly_race_daily_settlement is
  'One row once top-3 payouts for that calendar day_key (client local YYYY-MM-DD) have been executed.';

create table if not exists public.weekly_race_payout_audit (
  id uuid primary key default gen_random_uuid(),
  day_key text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (day_key, user_id),
  unique (day_key, rank)
);

create index if not exists weekly_race_payout_audit_user_idx
  on public.weekly_race_payout_audit (user_id, day_key);

alter table public.weekly_race_daily_settlement enable row level security;
alter table public.weekly_race_payout_audit enable row level security;

-- ---------------------------------------------------------------------------
create or replace function public._finalize_weekly_race_one_day(p_day_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_today date;
  r record;
  v_amount int;
  v_payload jsonb := '[]'::jsonb;
  v_obj jsonb;
begin
  v_day := to_date(nullif(trim(p_day_key), ''), 'YYYY-MM-DD');
  if v_day is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_day');
  end if;
  v_today := (now() at time zone 'utc')::date;
  if v_day >= v_today then
    return jsonb_build_object('ok', false, 'error', 'day_not_eligible');
  end if;

  if exists (select 1 from public.weekly_race_daily_settlement w where w.day_key = trim(p_day_key)) then
    return jsonb_build_object('ok', true, 'already_settled', true, 'day_key', trim(p_day_key));
  end if;

  for r in
    with ranked as (
      select
        e.user_id,
        e.best_score,
        row_number() over (order by e.best_score desc, e.user_id asc) as rn
      from public.weekly_race_entries e
      where e.day_key = trim(p_day_key)
    )
    select user_id, rn as rk, best_score
    from ranked
    where rn <= 3
  loop
    v_amount := case r.rk
      when 1 then 20000
      when 2 then 5000
      when 3 then 3000
      else 0
    end;

    if v_amount <= 0 then
      continue;
    end if;

    update public.profiles
    set wallet_cents = wallet_cents + v_amount, updated_at = now()
    where id = r.user_id;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      r.user_id,
      'weekly_race_prize',
      v_amount,
      'wallet_cents',
      'Weekly Race prize',
      jsonb_build_object('day_key', trim(p_day_key), 'rank', r.rk, 'best_score', r.best_score)
    );

    insert into public.weekly_race_payout_audit (day_key, user_id, rank, amount_cents)
    values (trim(p_day_key), r.user_id, r.rk, v_amount);

    v_obj := jsonb_build_object(
      'day_key', trim(p_day_key),
      'user_id', r.user_id,
      'rank', r.rk,
      'amount_cents', v_amount
    );
    v_payload := v_payload || jsonb_build_array(v_obj);
  end loop;

  insert into public.weekly_race_daily_settlement (day_key) values (trim(p_day_key));

  return jsonb_build_object(
    'ok', true,
    'already_settled', false,
    'day_key', trim(p_day_key),
    'winners', coalesce(v_payload, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.finalize_weekly_race_pending_days()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  d text;
  v_one jsonb;
  v_all jsonb := '[]'::jsonb;
  v_you int := 0;
  outer_rec record;
  pay_rec record;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  for d in
    select distinct e.day_key
    from public.weekly_race_entries e
    where (to_date(e.day_key, 'YYYY-MM-DD')) < ((now() at time zone 'utc')::date)
      and not exists (
        select 1 from public.weekly_race_daily_settlement w where w.day_key = e.day_key
      )
    order by e.day_key asc
  loop
    v_one := public._finalize_weekly_race_one_day(d);
    if coalesce(v_one ->> 'ok', '') <> 'true' then
      continue;
    end if;
    if coalesce(trim(v_one ->> 'already_settled'), '') = 'true' then
      continue;
    end if;

    v_all := v_all || jsonb_build_array(v_one);
  end loop;

  for outer_rec in
    select elem as settle from jsonb_array_elements(v_all) as outer_arr(elem)
  loop
    for pay_rec in
      select elem as line from jsonb_array_elements(coalesce(outer_rec.settle -> 'winners', '[]'::jsonb)) as prize_arr(elem)
    loop
      if (pay_rec.line ->> 'user_id')::uuid = v_me then
        v_you := v_you + coalesce(nullif(trim(pay_rec.line ->> 'amount_cents'), '')::int, 0);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'settlements', v_all, 'you_received_cents', v_you);
end;
$$;

comment on function public.finalize_weekly_race_pending_days() is
  'Credits wallet + audit for unsettled Weekly Race days (UTC cutoff). Callable by authenticated users to run backlog safely.';

comment on function public._finalize_weekly_race_one_day(text) is
  'Internal: top 3 debit by best_score among weekly_race_entries for one day_key.';

grant execute on function public.finalize_weekly_race_pending_days() to authenticated;
revoke execute on function public._finalize_weekly_race_one_day(text) from authenticated;
revoke execute on function public._finalize_weekly_race_one_day(text) from anon;
