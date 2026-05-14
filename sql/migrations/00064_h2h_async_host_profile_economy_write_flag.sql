-- Async host flows UPDATE profiles.wallet_cents while auth.uid() is still the player.
-- protect_profile_sensitive_columns() blocks that unless kickclash.allow_profile_economy_write = '1'
-- (same pattern as h2h_internal_apply_charged_match_session in 00032).

create or replace function public.h2h_internal_apply_async_host_match(
  p_pending_id uuid,
  p_host uuid,
  p_joiner uuid,
  p_mode text,
  p_game_key text,
  p_entry_fee_wallet_cents bigint,
  p_listed_prize_usd_cents bigint,
  p_host_score int,
  p_host_game_type text,
  p_host_duration_ms int,
  p_host_taps int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_entry bigint;
  v_joiner_wallet bigint;
  r record;
begin
  if p_host is null or p_joiner is null or p_host = p_joiner then
    raise exception 'invalid_players';
  end if;

  select *
    into r
  from public.h2h_async_host_pending p
  where p.id = p_pending_id
    and p.status = 'waiting_opponent'
    and p.host_user_id = p_host
  for update;

  if r.host_user_id is null then
    raise exception 'async_pending_not_found';
  end if;

  v_entry := greatest(coalesce(p_entry_fee_wallet_cents, 0), 0);

  if v_entry > 0 then
    select wallet_cents into v_joiner_wallet from public.profiles where id = p_joiner for update;
    if v_joiner_wallet is null then
      raise exception 'profile_not_found';
    end if;
    if v_joiner_wallet < v_entry then
      raise exception 'insufficient_wallet';
    end if;
  end if;

  insert into public.match_sessions (
    mode,
    status,
    player_a_id,
    player_b_id,
    game_key,
    entry_fee_wallet_cents,
    listed_prize_usd_cents,
    started_at,
    metadata
  )
  values (
    p_mode,
    'lobby',
    p_host,
    p_joiner,
    nullif(trim(coalesce(p_game_key, '')), ''),
    v_entry,
    case when coalesce(p_listed_prize_usd_cents, 0) > 0 then p_listed_prize_usd_cents else null end,
    now(),
    jsonb_build_object('async_host_pending_id', p_pending_id)
  )
  returning id into v_id;

  if v_entry > 0 then
    perform set_config('kickclash.allow_profile_economy_write', '1', true);
    update public.profiles
    set wallet_cents = wallet_cents - v_entry, updated_at = now()
    where id = p_joiner;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_joiner,
      'h2h_contest_entry',
      v_entry,
      'wallet_cents',
      'Skill contest — match access (Run It)',
      jsonb_build_object('match_session_id', v_id, 'side', 'joiner', 'async_host', true)
    );
  end if;

  insert into public.minigame_scores (
    user_id,
    game_type,
    score,
    duration_ms,
    taps,
    match_session_id
  )
  values (
    p_host,
    p_host_game_type,
    p_host_score,
    p_host_duration_ms,
    p_host_taps,
    v_id
  );

  update public.h2h_async_host_pending
  set
    status = 'consumed',
    consumed_match_session_id = v_id
  where id = p_pending_id;

  return v_id;
end;
$$;

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

  if coalesce(v_old_entry, 0) > 0 or v_entry > 0 then
    perform set_config('kickclash.allow_profile_economy_write', '1', true);
  end if;

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

create or replace function public.h2h_async_host_cancel()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_entry bigint;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  update public.h2h_async_host_pending p
  set status = 'cancelled'
  where p.host_user_id = v_me
    and p.status = 'waiting_opponent'
  returning p.entry_fee_wallet_cents into v_entry;

  if v_entry is null then
    return jsonb_build_object('ok', true, 'cancelled', false);
  end if;

  v_entry := greatest(coalesce(v_entry, 0), 0);
  if v_entry > 0 then
    perform set_config('kickclash.allow_profile_economy_write', '1', true);
    update public.profiles
    set wallet_cents = wallet_cents + v_entry, updated_at = now()
    where id = v_me;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_me,
      'h2h_contest_entry_refund',
      v_entry,
      'wallet_cents',
      'Skill contest — async host run cancelled',
      jsonb_build_object('reason', 'async_host_cancel')
    );
  end if;

  return jsonb_build_object('ok', true, 'cancelled', true);
end;
$$;

create or replace function public.h2h_maintenance_expire_async_hosts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_entry bigint;
begin
  for r in
    select p.id, p.host_user_id, p.entry_fee_wallet_cents
    from public.h2h_async_host_pending p
    where p.status = 'waiting_opponent'
      and p.expires_at < now()
    for update skip locked
  loop
    v_entry := greatest(coalesce(r.entry_fee_wallet_cents, 0), 0);

    update public.h2h_async_host_pending
    set status = 'expired'
    where id = r.id;

    if v_entry > 0 and r.host_user_id is not null then
      perform set_config('kickclash.allow_profile_economy_write', '1', true);
      update public.profiles
      set wallet_cents = wallet_cents + v_entry, updated_at = now()
      where id = r.host_user_id;

      insert into public.transactions (user_id, kind, amount, currency, description, metadata)
      values (
        r.host_user_id,
        'h2h_contest_entry_refund',
        v_entry,
        'wallet_cents',
        'Skill contest — async host run expired',
        jsonb_build_object('async_pending_id', r.id, 'reason', 'async_host_expired')
      );
    end if;

    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'async_hosts_expired', n);
end;
$$;

comment on function public.h2h_async_host_submit(text, text, bigint, bigint, int, text, int, int) is
  'Locks async host row; debits/refunds wallet with kickclash.allow_profile_economy_write for trigger bypass.';
