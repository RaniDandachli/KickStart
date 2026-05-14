-- Generalize async staked host submit to all skill H2H minigames (same row shape: score, duration_ms, taps).

create or replace function public.h2h_async_host_submit(
  p_mode text,
  p_game_key text,
  p_entry_fee_wallet_cents bigint,
  p_listed_prize_usd_cents bigint,
  p_host_score int,
  p_host_game_type text,
  p_duration_ms int,
  p_taps int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_entry bigint;
  v_prize bigint;
  v_gk text;
  v_gt text := lower(trim(coalesce(p_host_game_type, '')));
  v_expect text;
  v_wa bigint;
  v_old_entry bigint;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_mode is null or p_mode not in ('casual', 'ranked', 'custom') then
    return jsonb_build_object('ok', false, 'error', 'invalid_mode');
  end if;

  v_entry := greatest(coalesce(p_entry_fee_wallet_cents, 0), 0);
  v_prize := greatest(coalesce(p_listed_prize_usd_cents, 0), 0);
  v_gk := lower(trim(coalesce(p_game_key, '')));

  v_expect := case v_gk
    when 'tap-dash' then 'tap_dash'
    when 'tile-clash' then 'tile_clash'
    when 'ball-run' then 'ball_run'
    when 'dash-duel' then 'dash_duel'
    when 'turbo-arena' then 'turbo_arena'
    when 'neon-dance' then 'neon_dance'
    when 'neon-grid' then 'neon_grid'
    when 'neon-ship' then 'neon_ship'
    when 'shape-dash' then 'shape_dash'
    when 'cyber-road' then 'cyber_road'
    else null
  end;

  if v_expect is null then
    return jsonb_build_object('ok', false, 'error', 'async_game_not_supported');
  end if;

  if v_gt is null or v_gt = '' or v_gt <> v_expect then
    return jsonb_build_object('ok', false, 'error', 'game_type_mismatch');
  end if;

  if p_host_score < 0 or p_host_score > 1000000 or p_duration_ms < 0 or p_duration_ms > 86400000 or p_taps < 0 or p_taps > 2000000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score_payload');
  end if;

  if v_expect = 'turbo_arena' and p_host_score > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score_payload');
  end if;

  if v_entry > 0 then
    select wallet_cents into v_wa from public.profiles where id = v_me for update;
    if v_wa is null then
      return jsonb_build_object('ok', false, 'error', 'profile_not_found');
    end if;
    if v_wa < v_entry then
      return jsonb_build_object('ok', false, 'error', 'insufficient_wallet');
    end if;
  end if;

  v_old_entry := null;
  update public.h2h_async_host_pending p
  set status = 'cancelled'
  where p.host_user_id = v_me
    and p.status = 'waiting_opponent'
  returning p.entry_fee_wallet_cents into v_old_entry;

  if coalesce(v_old_entry, 0) > 0 then
    update public.profiles
    set wallet_cents = wallet_cents + v_old_entry, updated_at = now()
    where id = v_me;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_me,
      'h2h_contest_entry_refund',
      v_old_entry,
      'wallet_cents',
      'Skill contest — async host run replaced (refund previous hold)',
      jsonb_build_object('reason', 'async_host_replaced')
    );
  end if;

  if v_entry > 0 then
    update public.profiles
    set wallet_cents = wallet_cents - v_entry, updated_at = now()
    where id = v_me;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_me,
      'h2h_contest_entry',
      v_entry,
      'wallet_cents',
      'Skill contest — async host run (entry held until match)',
      jsonb_build_object('side', 'async_host', 'game_key', v_gk)
    );
  end if;

  insert into public.h2h_async_host_pending (
    host_user_id,
    mode,
    game_key,
    entry_fee_wallet_cents,
    listed_prize_usd_cents,
    host_score,
    host_game_type,
    duration_ms,
    taps,
    status
  )
  values (
    v_me,
    p_mode,
    v_gk,
    v_entry,
    case when v_prize > 0 then v_prize else null end,
    p_host_score,
    v_expect,
    p_duration_ms,
    p_taps,
    'waiting_opponent'
  );

  return jsonb_build_object('ok', true);
end;
$$;
