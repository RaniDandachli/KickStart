-- Mirror of supabase/migrations/00046_solo_challenge_daily_attempts.sql

-- Server-side daily attempt counter for Solo Challenges (replaces client-only AsyncStorage when app uses RPC).
-- Friday cup continues to use existing `join_tournament` + `tournaments` row (see scripts/seed-friday-eight-cup.example.sql).

-- ---------------------------------------------------------------------------
-- solo_challenge_daily_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.solo_challenge_daily_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null,
  /* YYYY-MM-DD — must match the app's todayYmdLocal() for that user/session. */
  calendar_day text not null,
  attempts int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id, calendar_day),
  constraint solo_challenge_calendar_day_fmt check (calendar_day ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint solo_challenge_attempts_range check (attempts >= 0 and attempts <= 50)
);

create index if not exists idx_solo_challenge_daily_attempts_user_day
  on public.solo_challenge_daily_attempts (user_id, calendar_day);

comment on table public.solo_challenge_daily_attempts is
  'Daily per-challenge run counter for solo skill challenges (e.g. Tap Dash target score). Max 50/day enforced in solo_challenge_consume_try.';

alter table public.solo_challenge_daily_attempts enable row level security;

drop policy if exists solo_challenge_attempts_select_own on public.solo_challenge_daily_attempts;
create policy solo_challenge_attempts_select_own
  on public.solo_challenge_daily_attempts for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.solo_challenge_daily_attempts from authenticated;

-- ---------------------------------------------------------------------------
-- solo_challenge_consume_try: atomic increment with daily cap
-- ---------------------------------------------------------------------------
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
  v_max int := 50;
  v_allowed text[] := array['tap_dash_100']::text[];
  v_prev int;
  v_new int;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_challenge_id is null or not (p_challenge_id = any(v_allowed)) then
    return jsonb_build_object('ok', false, 'error', 'invalid_challenge');
  end if;

  if p_calendar_day is null or p_calendar_day !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_calendar_day');
  end if;

  select a.attempts
    into v_prev
  from public.solo_challenge_daily_attempts a
  where a.user_id = v_me
    and a.challenge_id = p_challenge_id
    and a.calendar_day = p_calendar_day
  for update;

  if not found then
    insert into public.solo_challenge_daily_attempts (user_id, challenge_id, calendar_day, attempts)
    values (v_me, p_challenge_id, p_calendar_day, 1);
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
    and challenge_id = p_challenge_id
    and calendar_day = p_calendar_day
  returning attempts into v_new;

  return jsonb_build_object(
    'ok', true,
    'attempts_after', v_new,
    'max_attempts', v_max
  );
end;
$$;

comment on function public.solo_challenge_consume_try(text, text) is
  'Consumes one solo challenge attempt for the calendar day; caps at 50.';

grant execute on function public.solo_challenge_consume_try(text, text) to authenticated;
