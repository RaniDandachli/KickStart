-- Link validated Tap Dash runs to H2H sessions; read scores for both players (participants only).

alter table public.minigame_scores
  add column if not exists match_session_id uuid references public.match_sessions (id) on delete cascade;

create index if not exists idx_minigame_scores_match_session
  on public.minigame_scores (match_session_id)
  where match_session_id is not null;

create unique index if not exists uq_minigame_scores_h2h_session_user_game
  on public.minigame_scores (match_session_id, user_id, game_type)
  where match_session_id is not null;

comment on column public.minigame_scores.match_session_id is
  'When set, this row is an official run for that H2H match (validated via submitMinigameScore).';

-- ---------------------------------------------------------------------------
-- Participant: latest tap_dash scores for player A and B (self vs opponent mapped)
-- ---------------------------------------------------------------------------

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

  if v_gk is not null and trim(v_gk) <> '' and lower(trim(v_gk)) <> 'tap-dash' then
    return jsonb_build_object('ok', false, 'error', 'wrong_game');
  end if;

  select ms.score into sa
  from public.minigame_scores ms
  where ms.match_session_id = p_match_session_id
    and ms.user_id = v_pa
    and ms.game_type = 'tap_dash'
  order by ms.created_at desc
  limit 1;

  select ms.score into sb
  from public.minigame_scores ms
  where ms.match_session_id = p_match_session_id
    and ms.user_id = v_pb
    and ms.game_type = 'tap_dash'
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

revoke all on function public.h2h_tap_dash_scores_for_match(uuid) from public;
grant execute on function public.h2h_tap_dash_scores_for_match(uuid) to authenticated;

comment on function public.h2h_tap_dash_scores_for_match(uuid) is
  'H2H Tap Dash: latest validated scores for both players (participant-only).';

-- ---------------------------------------------------------------------------
-- File dispute: report row + flag match session
-- ---------------------------------------------------------------------------

create or replace function public.h2h_file_match_dispute(p_match_session_id uuid, p_details text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_pa uuid;
  v_pb uuid;
  t text := trim(coalesce(p_details, ''));
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if length(t) < 12 then
    return jsonb_build_object('ok', false, 'error', 'details_too_short');
  end if;

  select ms.player_a_id, ms.player_b_id into v_pa, v_pb
  from public.match_sessions ms
  where ms.id = p_match_session_id;

  if v_pa is null or v_pb is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_me <> v_pa and v_me <> v_pb then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.reports (reporter_id, match_session_id, category, details, status)
  values (v_me, p_match_session_id, 'match_dispute', t, 'open');

  update public.match_sessions
  set
    dispute_status = 'submitted',
    updated_at = now()
  where id = p_match_session_id
    and dispute_status = 'none';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.h2h_file_match_dispute(uuid, text) from public;
grant execute on function public.h2h_file_match_dispute(uuid, text) to authenticated;

comment on function public.h2h_file_match_dispute(uuid, text) is
  'Participant files a match dispute; opens support ticket and flags session.';
