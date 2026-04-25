-- Mirror of supabase/migrations/00049_neon_ship_minigame.sql

-- Void Glider: prize runs + H2H (game_key neon-ship → minigame_scores.game_type neon_ship).

alter table public.prize_run_reservations drop constraint if exists prize_run_reservations_game_type_check;

alter table public.prize_run_reservations
  add constraint prize_run_reservations_game_type_check check (
    game_type in (
      'tap_dash',
      'tile_clash',
      'ball_run',
      'neon_pool',
      'stacker',
      'dash_duel',
      'turbo_arena',
      'neon_dance',
      'neon_grid',
      'neon_ship'
    )
  );

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
    or p_game_type !~ '^(tap_dash|tile_clash|ball_run|neon_pool|stacker|dash_duel|turbo_arena|neon_dance|neon_grid|neon_ship)$'
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

create or replace function public.h2h_tap_dash_scores_for_match(p_match_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_pa uuid;
  v_pb uuid;
  v_gk text;
  v_gt text;
  sa int;
  sb int;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select ms.player_a_id, ms.player_b_id, ms.game_key
    into v_pa, v_pb, v_gk
  from public.match_sessions ms
  where ms.id = p_match_session_id;

  if v_pa is null or v_pb is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_me <> v_pa and v_me <> v_pb then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_gk := lower(trim(coalesce(v_gk, '')));
  if v_gk = '' or v_gk = 'tap-dash' then
    v_gt := 'tap_dash';
  elsif v_gk = 'tile-clash' then
    v_gt := 'tile_clash';
  elsif v_gk = 'ball-run' then
    v_gt := 'ball_run';
  elsif v_gk = 'dash-duel' then
    v_gt := 'dash_duel';
  elsif v_gk = 'turbo-arena' then
    v_gt := 'turbo_arena';
  elsif v_gk = 'neon-dance' then
    v_gt := 'neon_dance';
  elsif v_gk = 'neon-grid' then
    v_gt := 'neon_grid';
  elsif v_gk = 'neon-ship' then
    v_gt := 'neon_ship';
  else
    return jsonb_build_object('ok', false, 'error', 'wrong_game');
  end if;

  select ms.score into sa
  from public.minigame_scores ms
  where ms.match_session_id = p_match_session_id
    and ms.user_id = v_pa
    and ms.game_type = v_gt
  order by ms.created_at desc
  limit 1;

  select ms.score into sb
  from public.minigame_scores ms
  where ms.match_session_id = p_match_session_id
    and ms.user_id = v_pb
    and ms.game_type = v_gt
  order by ms.created_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'player_a_score', sa,
    'player_b_score', sb,
    'self_score', case when v_me = v_pa then sa else sb end,
    'opponent_score', case when v_me = v_pa then sb else sa end,
    'both_submitted', sa is not null and sb is not null
  );
end;
$$;

comment on function public.h2h_tap_dash_scores_for_match(uuid) is
  'H2H skill contest: latest validated minigame_scores for both players (includes neon-ship → neon_ship).';
