-- Prize runs: debit prize_credits when the run starts; complete grants tickets + minigame_scores using a reservation id.

create table if not exists public.prize_run_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_type text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz null,
  constraint prize_run_reservations_game_type_check check (
    game_type in (
      'tap_dash', 'tile_clash', 'ball_run', 'neon_pool', 'stacker',
      'dash_duel', 'turbo_arena', 'neon_dance'
    )
  )
);

comment on table public.prize_run_reservations is
  'Entry debited at prize run start; consumed when submitMinigameScore completes the run.';

create index if not exists idx_prize_run_reservations_user_created
  on public.prize_run_reservations (user_id, created_at desc);

alter table public.prize_run_reservations enable row level security;

create or replace function public.begin_minigame_prize_run(p_game_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_entry bigint;
  v_cr bigint;
  v_rid uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_game_type is null
    or p_game_type !~ '^(tap_dash|tile_clash|ball_run|neon_pool|stacker|dash_duel|turbo_arena|neon_dance)$'
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_game_type');
  end if;

  v_entry := case p_game_type
    when 'stacker' then 20
    when 'turbo_arena' then 20
    else 10
  end;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  update public.profiles
  set
    prize_credits = prize_credits - v_entry,
    updated_at = now()
  where id = v_uid
    and prize_credits >= v_entry
  returning prize_credits into v_cr;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient_credits');
  end if;

  insert into public.prize_run_reservations (user_id, game_type)
  values (v_uid, p_game_type)
  returning id into v_rid;

  return jsonb_build_object(
    'ok', true,
    'reservation_id', v_rid,
    'prize_credits', v_cr,
    'entry_credits', v_entry
  );
end;
$$;

revoke all on function public.begin_minigame_prize_run(text) from public;
grant execute on function public.begin_minigame_prize_run(text) to authenticated;

comment on function public.begin_minigame_prize_run(text) is
  'Debit prize credits when a prize run starts; returns reservation_id for submitMinigameScore.';

drop function if exists public.record_minigame_prize_run(uuid, text, int, int, int, bigint, bigint);

create or replace function public.complete_minigame_prize_run(
  p_reservation_id uuid,
  p_user_id uuid,
  p_game_type text,
  p_score int,
  p_duration_ms int,
  p_taps int,
  p_tickets_granted bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gt text;
  v_cr bigint;
  v_rt bigint;
begin
  if p_tickets_granted < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amounts');
  end if;

  if p_score < 0 or p_duration_ms < 0 or p_taps < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score_row');
  end if;

  select r.game_type into v_gt
  from public.prize_run_reservations r
  where r.id = p_reservation_id
    and r.user_id = p_user_id
    and r.consumed_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_consumed_reservation');
  end if;

  if v_gt is distinct from p_game_type then
    return jsonb_build_object('ok', false, 'error', 'reservation_game_mismatch');
  end if;

  update public.prize_run_reservations
  set consumed_at = now()
  where id = p_reservation_id;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  update public.profiles
  set
    redeem_tickets = redeem_tickets + p_tickets_granted,
    updated_at = now()
  where id = p_user_id
  returning prize_credits, redeem_tickets into v_cr, v_rt;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_missing');
  end if;

  insert into public.minigame_scores (user_id, game_type, score, duration_ms, taps)
  values (p_user_id, p_game_type, p_score, p_duration_ms, p_taps);

  return jsonb_build_object(
    'ok', true,
    'prize_credits', v_cr,
    'redeem_tickets', v_rt,
    'tickets_granted', p_tickets_granted
  );
end;
$$;

revoke all on function public.complete_minigame_prize_run(uuid, uuid, text, int, int, int, bigint) from public;
grant execute on function public.complete_minigame_prize_run(uuid, uuid, text, int, int, int, bigint) to service_role;

comment on function public.complete_minigame_prize_run is
  'Service-role: grant redeem tickets + minigame_scores for a prepaid prize run reservation.';
