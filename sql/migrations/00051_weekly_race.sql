-- Daily paid leaderboard: $10 entry, 10 scored runs, rotating minigame (excludes Stacker + Turbo Arena on client allowlist).
-- Payouts to top 3 (ops/Edge cron) — this migration only debits entry + records best score.

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
  'weekly_race_entry'
));

comment on constraint transactions_kind_check on public.transactions is
  'weekly_race_entry: $10 cash wallet debit for the daily rotating minigame race (see weekly_race_entries).';

-- ---------------------------------------------------------------------------
create table if not exists public.weekly_race_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_key text not null,
  game_key text not null,
  entry_fee_cents int not null default 1000,
  attempts_used int not null default 0,
  best_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_key)
);

create index if not exists weekly_race_entries_day_key_idx
  on public.weekly_race_entries (day_key);

comment on table public.weekly_race_entries is
  'One row per user per local calendar day (day_key) after paying the race entry.';

-- Allowlisted minigame route keys; excludes turbo-arena and (non-H2H) stacker.
create or replace function public.weekly_race_game_allowed(p_game text)
returns boolean
language sql
immutable
as $$
  select p_game in (
    'tap-dash', 'tile-clash', 'dash-duel', 'ball-run', 'neon-dance', 'neon-grid', 'neon-ship'
  );
$$;

-- ---------------------------------------------------------------------------
create or replace function public.enter_weekly_race(p_day_key text, p_game_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_fee int := 1000;
  v_ex text;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_ex := nullif(trim(p_day_key), '');
  if v_ex is null or char_length(p_ex) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_day');
  end if;
  if not public.weekly_race_game_allowed(nullif(trim(p_game_key), '')) then
    return jsonb_build_object('ok', false, 'error', 'invalid_game');
  end if;
  if exists (select 1 from public.weekly_race_entries e where e.user_id = v_me and e.day_key = v_ex) then
    return jsonb_build_object('ok', false, 'error', 'already_entered');
  end if;

  update public.profiles
  set wallet_cents = wallet_cents - v_fee, updated_at = now()
  where id = v_me and wallet_cents >= v_fee;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient_wallet');
  end if;

  insert into public.transactions (user_id, kind, amount, currency, description, metadata)
  values (
    v_me, 'weekly_race_entry', v_fee, 'wallet_cents', 'Weekly Race entry', jsonb_build_object('day_key', v_ex, 'game_key', p_game_key)
  );

  insert into public.weekly_race_entries (user_id, day_key, game_key, entry_fee_cents, attempts_used, best_score)
  values (v_me, v_ex, trim(p_game_key), v_fee, 0, 0);

  return jsonb_build_object('ok', true, 'day_key', v_ex, 'game_key', trim(p_game_key));
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.record_weekly_race_score(p_day_key text, p_game_key text, p_score int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.weekly_race_entries%rowtype;
  v_ex text;
  v_g text;
  v_max int := 10;
  v_s int;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_ex := nullif(trim(p_day_key), '');
  v_g := nullif(trim(p_game_key), '');
  v_s := coalesce(p_score, 0);
  if v_s < 0 or v_s > 2000000000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score');
  end if;
  if v_ex is null or v_g is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_args');
  end if;
  if not public.weekly_race_game_allowed(v_g) then
    return jsonb_build_object('ok', false, 'error', 'invalid_game');
  end if;

  select * into v_row
  from public.weekly_race_entries
  where user_id = v_me and day_key = v_ex
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_entered');
  end if;
  if v_row.game_key <> v_g then
    return jsonb_build_object('ok', false, 'error', 'game_mismatch');
  end if;
  if v_row.attempts_used >= v_max then
    return jsonb_build_object('ok', false, 'error', 'no_attempts_left');
  end if;

  update public.weekly_race_entries
  set
    attempts_used = attempts_used + 1,
    best_score = case when v_s > best_score then v_s else best_score end,
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'attempts_used', (select attempts_used from public.weekly_race_entries where id = v_row.id),
    'best_score', (select best_score from public.weekly_race_entries where id = v_row.id)
  );
end;
$$;

comment on function public.enter_weekly_race(text, text) is
  'Debit $10 wallet and create weekly_race_entries for (auth user, p_day_key). p_game_key must match client rotation for the day.';

comment on function public.record_weekly_race_score(text, text, int) is
  'After a validated minigame score submit, increment attempt count and update high score (max 10 / day).';

grant execute on function public.enter_weekly_race(text, text) to authenticated;
grant execute on function public.record_weekly_race_score(text, text, int) to authenticated;
grant execute on function public.weekly_race_game_allowed(text) to authenticated;

alter table public.weekly_race_entries enable row level security;

create policy "weekly_race_select_own" on public.weekly_race_entries
  for select
  to authenticated
  using (user_id = auth.uid());

-- Direct INSERT/UPDATE from clients: blocked by RLS (no with-check). Mutations go through security-definer RPCs.
