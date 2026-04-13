-- Same as H2H wallet debits: profile economy columns are guarded by `protect_profile_sensitive_columns`.
-- If this RPC ever runs in a context where `auth.uid()` matches the row (or for consistency), allow the write.

create or replace function public.record_minigame_prize_run(
  p_user_id uuid,
  p_game_type text,
  p_score int,
  p_duration_ms int,
  p_taps int,
  p_entry_credits bigint,
  p_tickets_granted bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cr bigint;
  v_rt bigint;
begin
  if p_entry_credits < 0 or p_tickets_granted < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amounts');
  end if;

  if p_score < 0 or p_duration_ms < 0 or p_taps < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score_row');
  end if;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  update public.profiles
  set
    prize_credits = prize_credits - p_entry_credits,
    redeem_tickets = redeem_tickets + p_tickets_granted
  where id = p_user_id
    and prize_credits >= p_entry_credits
  returning prize_credits, redeem_tickets into v_cr, v_rt;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'insufficient_credits');
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
