-- Browse open async-host scores (no host id exposed) + join a specific pending row (FIFO bypass).

create or replace function public.h2h_async_host_list_open_challenges(
  p_game_key text default null,
  p_limit int default 40
)
returns table (
  id uuid,
  mode text,
  game_key text,
  entry_fee_wallet_cents bigint,
  listed_prize_usd_cents bigint,
  host_score int,
  host_game_type text,
  duration_ms int,
  taps int,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
volatile
security definer
set search_path = public
as $$
  select
    p.id,
    p.mode,
    p.game_key,
    p.entry_fee_wallet_cents,
    p.listed_prize_usd_cents,
    p.host_score,
    p.host_game_type,
    p.duration_ms,
    p.taps,
    p.created_at,
    p.expires_at
  from public.h2h_async_host_pending p
  where p.status = 'waiting_opponent'
    and p.expires_at > now()
    and p.host_user_id <> auth.uid()
    and (
      nullif(trim(coalesce(p_game_key, '')), '') is null
      or lower(trim(p.game_key)) = lower(trim(coalesce(p_game_key, '')))
    )
  order by p.created_at asc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.h2h_async_host_list_open_challenges(text, int) from public;
grant execute on function public.h2h_async_host_list_open_challenges(text, int) to authenticated;

comment on function public.h2h_async_host_list_open_challenges(text, int) is
  'Public-ish feed of waiting async host rows (no host id) for Events / challenge browser.';

create or replace function public.h2h_join_specific_async_host_challenge(p_pending_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_mode text;
  v_host uuid;
  v_game text;
  v_entry bigint;
  v_prize bigint;
  v_hs int;
  v_hgt text;
  v_hdur int;
  v_htaps int;
  v_sid uuid;
  v_exp timestamptz;
  v_status text;
  v_wa bigint;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_pending_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_pending_id');
  end if;

  select
    p.mode,
    p.host_user_id,
    p.game_key,
    p.entry_fee_wallet_cents,
    coalesce(p.listed_prize_usd_cents, 0),
    p.host_score,
    p.host_game_type,
    p.duration_ms,
    p.taps,
    p.expires_at,
    p.status
  into
    v_mode,
    v_host,
    v_game,
    v_entry,
    v_prize,
    v_hs,
    v_hgt,
    v_hdur,
    v_htaps,
    v_exp,
    v_status
  from public.h2h_async_host_pending p
  where p.id = p_pending_id;

  if v_host is null then
    return jsonb_build_object('ok', false, 'error', 'async_pending_not_found');
  end if;

  if v_host = v_me then
    return jsonb_build_object('ok', false, 'error', 'cannot_challenge_own_run');
  end if;

  perform pg_advisory_xact_lock(hashtext('h2h_enqueue_' || v_mode));

  select
    p.status,
    p.host_user_id,
    p.game_key,
    p.entry_fee_wallet_cents,
    coalesce(p.listed_prize_usd_cents, 0),
    p.host_score,
    p.host_game_type,
    p.duration_ms,
    p.taps,
    p.expires_at
  into
    v_status,
    v_host,
    v_game,
    v_entry,
    v_prize,
    v_hs,
    v_hgt,
    v_hdur,
    v_htaps,
    v_exp
  from public.h2h_async_host_pending p
  where p.id = p_pending_id
  for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'async_pending_not_found');
  end if;

  if v_status <> 'waiting_opponent' then
    return jsonb_build_object('ok', false, 'error', 'async_already_matched');
  end if;

  if v_exp <= now() then
    return jsonb_build_object('ok', false, 'error', 'async_expired');
  end if;

  if exists (
    select 1
    from public.h2h_async_host_pending h
    where h.host_user_id = v_me
      and h.status = 'waiting_opponent'
  ) then
    return jsonb_build_object('ok', false, 'error', 'async_host_pending');
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

  delete from public.h2h_queue_entries
  where user_id = v_me
    and status = 'waiting';

  begin
    v_sid := public.h2h_internal_apply_async_host_match(
      p_pending_id,
      v_host,
      v_me,
      v_mode,
      coalesce(v_game, ''),
      v_entry,
      case when v_prize > 0 then v_prize else null end,
      v_hs,
      v_hgt,
      v_hdur,
      v_htaps
    );
  exception
    when others then
      return jsonb_build_object('ok', false, 'error', 'match_create_failed', 'detail', sqlerrm);
  end;

  return jsonb_build_object(
    'ok', true,
    'matched', true,
    'match_session_id', v_sid,
    'opponent_user_id', v_host,
    'async_host', true
  );
end;
$$;

revoke all on function public.h2h_join_specific_async_host_challenge(uuid) from public;
grant execute on function public.h2h_join_specific_async_host_challenge(uuid) to authenticated;

comment on function public.h2h_join_specific_async_host_challenge(uuid) is
  'Joiner locks entry debits (if paid) and consumes one async-host pending row by id — same settlement as FIFO pickup.';
