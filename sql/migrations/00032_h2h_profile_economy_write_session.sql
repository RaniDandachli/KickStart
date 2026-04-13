-- H2H match flows run as SECURITY DEFINER but `auth.uid()` stays the caller's JWT.
-- `protect_profile_sensitive_columns` (00026) blocks self-updates to wallet_cents / prize_credits unless
-- `kickclash.allow_profile_economy_write = '1'` for this transaction — same pattern as 00007 / 00013.

create or replace function public.h2h_internal_apply_charged_match_session(
  p_player_a uuid,
  p_player_b uuid,
  p_mode text,
  p_game_key text,
  p_entry_fee_wallet_cents bigint,
  p_listed_prize_usd_cents bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_a bigint;
  v_b bigint;
  v_entry bigint;
  v_game text;
begin
  if p_player_a is null or p_player_b is null or p_player_a = p_player_b then
    raise exception 'invalid_players';
  end if;

  if p_mode is null or p_mode not in ('casual', 'ranked', 'custom') then
    raise exception 'invalid_mode';
  end if;

  v_entry := greatest(coalesce(p_entry_fee_wallet_cents, 0), 0);
  v_game := nullif(trim(coalesce(p_game_key, '')), '');

  if v_entry > 0 then
    select wallet_cents into v_a from public.profiles where id = p_player_a for update;
    select wallet_cents into v_b from public.profiles where id = p_player_b for update;
    if v_a is null or v_b is null then
      raise exception 'profile_not_found';
    end if;
    if v_a < v_entry or v_b < v_entry then
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
    started_at
  )
  values (
    p_mode,
    'lobby',
    p_player_a,
    p_player_b,
    v_game,
    v_entry,
    case when coalesce(p_listed_prize_usd_cents, 0) > 0 then p_listed_prize_usd_cents else null end,
    now()
  )
  returning id into v_id;

  if v_entry > 0 then
    perform set_config('kickclash.allow_profile_economy_write', '1', true);
    update public.profiles
    set wallet_cents = wallet_cents - v_entry, updated_at = now()
    where id = p_player_a;

    update public.profiles
    set wallet_cents = wallet_cents - v_entry, updated_at = now()
    where id = p_player_b;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_player_a,
      'h2h_contest_entry',
      v_entry,
      'wallet_cents',
      'Skill contest — match access (Run It)',
      jsonb_build_object('match_session_id', v_id, 'side', 'initiator')
    );

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_player_b,
      'h2h_contest_entry',
      v_entry,
      'wallet_cents',
      'Skill contest — match access (Run It)',
      jsonb_build_object('match_session_id', v_id, 'side', 'opponent')
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.h2h_abandon_match_session(p_match_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_status text;
  v_entry bigint;
  v_pa uuid;
  v_pb uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select ms.status, ms.entry_fee_wallet_cents, ms.player_a_id, ms.player_b_id
    into v_status, v_entry, v_pa, v_pb
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

  if v_status = 'completed' then
    return jsonb_build_object('ok', true, 'noop', true, 'reason', 'completed');
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('ok', true, 'noop', true, 'reason', 'cancelled');
  end if;

  if v_status = 'in_progress' then
    return jsonb_build_object('ok', false, 'error', 'cannot_abandon_after_start');
  end if;

  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_status);
  end if;

  v_entry := greatest(coalesce(v_entry, 0), 0);

  update public.match_sessions
  set
    status = 'cancelled',
    ended_at = coalesce(ended_at, now()),
    updated_at = now()
  where id = p_match_session_id;

  if v_entry > 0 then
    perform set_config('kickclash.allow_profile_economy_write', '1', true);
    update public.profiles
    set wallet_cents = wallet_cents + v_entry, updated_at = now()
    where id = v_pa;

    update public.profiles
    set wallet_cents = wallet_cents + v_entry, updated_at = now()
    where id = v_pb;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_pa,
      'h2h_contest_entry_refund',
      v_entry,
      'wallet_cents',
      'Skill contest — match access refunded (lobby left)',
      jsonb_build_object('match_session_id', p_match_session_id, 'side', 'player_a')
    );

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_pb,
      'h2h_contest_entry_refund',
      v_entry,
      'wallet_cents',
      'Skill contest — match access refunded (lobby left)',
      jsonb_build_object('match_session_id', p_match_session_id, 'side', 'player_b')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'refunded_wallet_cents_each', case when v_entry > 0 then v_entry else 0 end
  );
end;
$$;

create or replace function public.apply_h2h_contest_economy_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry bigint;
  v_prize bigint;
  v_consolation bigint;
begin
  if new.match_session_id is null
     or new.winner_user_id is null
     or new.loser_user_id is null then
    return new;
  end if;

  select
    coalesce(s.entry_fee_wallet_cents, 0),
    coalesce(s.listed_prize_usd_cents, 0)
  into v_entry, v_prize
  from public.match_sessions s
  where s.id = new.match_session_id;

  v_consolation := public.h2h_loss_arcade_credits_for_entry_fee(v_entry);

  begin
    insert into public.h2h_contest_economy_settlements (
      match_session_id,
      match_result_id,
      winner_user_id,
      loser_user_id,
      entry_fee_wallet_cents,
      prize_wallet_cents_granted,
      consolation_prize_credits_granted
    )
    values (
      new.match_session_id,
      new.id,
      new.winner_user_id,
      new.loser_user_id,
      v_entry,
      case when v_prize > 0 then v_prize else 0 end,
      case when v_consolation > 0 then v_consolation else 0 end
    );
  exception
    when unique_violation then
      return new;
  end;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  if v_prize > 0 then
    update public.profiles
    set
      wallet_cents = wallet_cents + v_prize,
      updated_at = now()
    where id = new.winner_user_id;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      new.winner_user_id,
      'reward_grant',
      v_prize,
      'wallet_cents',
      'Skill contest — top performer prize',
      jsonb_build_object(
        'source', 'h2h_contest_win',
        'match_session_id', new.match_session_id,
        'match_result_id', new.id
      )
    );
  end if;

  if v_consolation > 0 then
    update public.profiles
    set
      prize_credits = prize_credits + v_consolation,
      updated_at = now()
    where id = new.loser_user_id;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      new.loser_user_id,
      'prize_credit_earn',
      v_consolation,
      'prize_credits',
      'Arcade Credits — match participation (gameplay only, not cash)',
      jsonb_build_object(
        'source', 'h2h_loss_consolation',
        'match_session_id', new.match_session_id,
        'match_result_id', new.id,
        'arcade_only', true,
        'non_withdrawable', true,
        'non_transferable', true
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.h2h_maintenance_expire_stale()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entry bigint;
  n_lobby int := 0;
  n_queue int := 0;
begin
  for r in
    select ms.id, ms.entry_fee_wallet_cents, ms.player_a_id, ms.player_b_id
    from public.match_sessions ms
    where ms.status = 'lobby'
      and coalesce(ms.started_at, ms.created_at) < now() - interval '2 hours'
    for update skip locked
  loop
    v_entry := greatest(coalesce(r.entry_fee_wallet_cents, 0), 0);

    update public.match_sessions
    set
      status = 'cancelled',
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
    where id = r.id;

    if v_entry > 0 and r.player_a_id is not null and r.player_b_id is not null then
      perform set_config('kickclash.allow_profile_economy_write', '1', true);
      update public.profiles
      set wallet_cents = wallet_cents + v_entry, updated_at = now()
      where id = r.player_a_id;

      update public.profiles
      set wallet_cents = wallet_cents + v_entry, updated_at = now()
      where id = r.player_b_id;

      insert into public.transactions (user_id, kind, amount, currency, description, metadata)
      values (
        r.player_a_id,
        'h2h_contest_entry_refund',
        v_entry,
        'wallet_cents',
        'Skill contest — match access refunded (lobby expired)',
        jsonb_build_object('match_session_id', r.id, 'side', 'player_a', 'reason', 'stale_lobby')
      );

      insert into public.transactions (user_id, kind, amount, currency, description, metadata)
      values (
        r.player_b_id,
        'h2h_contest_entry_refund',
        v_entry,
        'wallet_cents',
        'Skill contest — match access refunded (lobby expired)',
        jsonb_build_object('match_session_id', r.id, 'side', 'player_b', 'reason', 'stale_lobby')
      );
    end if;

    n_lobby := n_lobby + 1;
  end loop;

  with removed as (
    delete from public.h2h_queue_entries q
    where q.status = 'waiting'
      and q.created_at < now() - interval '45 minutes'
    returning q.id
  )
  select coalesce(count(*)::int, 0) into n_queue from removed;

  return jsonb_build_object(
    'ok', true,
    'lobbies_expired', n_lobby,
    'queue_waiters_removed', n_queue
  );
end;
$$;
