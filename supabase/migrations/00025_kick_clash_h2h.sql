-- H2H skill scores RPC: support both Tap Dash and Kick Clash (arcade soccer) by game_key.

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
  elsif v_gk = 'kick-clash' then
    v_gt := 'kick_clash_soccer';
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
  'H2H skill contest: latest validated minigame scores for both players (tap-dash or kick-clash).';
