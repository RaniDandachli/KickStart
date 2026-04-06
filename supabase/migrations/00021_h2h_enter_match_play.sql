-- First participant opening the skill screen moves the session from lobby → in_progress (authoritative lifecycle).

create or replace function public.h2h_enter_match_play(p_match_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_status text;
  v_pa uuid;
  v_pb uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select ms.status, ms.player_a_id, ms.player_b_id
    into v_status, v_pa, v_pb
  from public.match_sessions ms
  where ms.id = p_match_session_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_pa is null or v_pb is null then
    return jsonb_build_object('ok', false, 'error', 'players_not_set');
  end if;

  if v_me <> v_pa and v_me <> v_pb then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_status in ('completed', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'session_closed', 'status', v_status);
  end if;

  if v_status = 'in_progress' then
    return jsonb_build_object('ok', true, 'status', 'in_progress', 'already', true);
  end if;

  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_status);
  end if;

  update public.match_sessions
  set status = 'in_progress', updated_at = now()
  where id = p_match_session_id;

  return jsonb_build_object('ok', true, 'status', 'in_progress');
end;
$$;

revoke all on function public.h2h_enter_match_play(uuid) from public;
grant execute on function public.h2h_enter_match_play(uuid) to authenticated;

comment on function public.h2h_enter_match_play(uuid) is
  'Participant marks H2H match as in progress when opening play (lobby → in_progress). Idempotent if already in_progress.';
