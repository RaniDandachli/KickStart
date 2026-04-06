-- Real H2H queue: pair two waiting players on matching tier/game, create charged match_sessions via shared core.
-- Step 1 of live matchmaking — clients poll `h2h_enqueue_or_match` while searching.

-- ---------------------------------------------------------------------------
-- Shared core (service_role + internal queue RPC only)
-- ---------------------------------------------------------------------------

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

revoke all on function public.h2h_internal_apply_charged_match_session(uuid, uuid, text, text, bigint, bigint) from public;
revoke all on function public.h2h_internal_apply_charged_match_session(uuid, uuid, text, text, bigint, bigint) from authenticated;
grant execute on function public.h2h_internal_apply_charged_match_session(uuid, uuid, text, text, bigint, bigint) to service_role;
grant execute on function public.h2h_internal_apply_charged_match_session(uuid, uuid, text, text, bigint, bigint) to postgres;

comment on function public.h2h_internal_apply_charged_match_session(uuid, uuid, text, text, bigint, bigint) is
  'Creates match_sessions + optional dual entry debits; used by Edge and h2h_enqueue_or_match.';

create or replace function public.h2h_create_match_session_and_debit_entries(
  p_initiator uuid,
  p_opponent uuid,
  p_mode text,
  p_game_key text,
  p_entry_fee_wallet_cents bigint,
  p_listed_prize_usd_cents bigint
) returns uuid
language sql
security definer
set search_path = public
as $$
  select public.h2h_internal_apply_charged_match_session(
    p_initiator,
    p_opponent,
    p_mode,
    p_game_key,
    p_entry_fee_wallet_cents,
    p_listed_prize_usd_cents
  );
$$;

-- ---------------------------------------------------------------------------
-- Queue table (writes only via SECURITY DEFINER RPCs)
-- ---------------------------------------------------------------------------

create table if not exists public.h2h_queue_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('casual', 'ranked', 'custom')),
  game_key text,
  entry_fee_wallet_cents bigint not null default 0 check (entry_fee_wallet_cents >= 0),
  listed_prize_usd_cents bigint check (listed_prize_usd_cents is null or listed_prize_usd_cents >= 0),
  status text not null default 'waiting' check (status in ('waiting', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_h2h_queue_waiting_created
  on public.h2h_queue_entries (created_at)
  where status = 'waiting';

create unique index if not exists uq_h2h_queue_one_waiting_per_user
  on public.h2h_queue_entries (user_id)
  where status = 'waiting';

alter table public.h2h_queue_entries enable row level security;

comment on table public.h2h_queue_entries is
  'Head-to-head matchmaking queue; paired rows create match_sessions via h2h_enqueue_or_match.';

-- ---------------------------------------------------------------------------
-- Enqueue or match (authenticated)
-- ---------------------------------------------------------------------------

create or replace function public.h2h_enqueue_or_match(
  p_mode text,
  p_game_key text,
  p_entry_fee_wallet_cents bigint,
  p_listed_prize_usd_cents bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_partner_user uuid;
  v_partner_row_id uuid;
  v_my_waiting_id uuid;
  v_game text;
  v_entry bigint;
  v_prize bigint;
  v_sid uuid;
  v_wa bigint;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_mode is null or p_mode not in ('casual', 'ranked', 'custom') then
    return jsonb_build_object('ok', false, 'error', 'invalid_mode');
  end if;

  v_entry := greatest(coalesce(p_entry_fee_wallet_cents, 0), 0);
  v_prize := greatest(coalesce(p_listed_prize_usd_cents, 0), 0);
  v_game := nullif(trim(coalesce(p_game_key, '')), '');

  if v_entry > 0 then
    select wallet_cents into v_wa from public.profiles where id = v_me;
    if v_wa is null then
      return jsonb_build_object('ok', false, 'error', 'profile_not_found');
    end if;
    if v_wa < v_entry then
      return jsonb_build_object('ok', false, 'error', 'insufficient_wallet');
    end if;
  end if;

  select q.id, q.user_id
    into v_partner_row_id, v_partner_user
  from public.h2h_queue_entries q
  where q.status = 'waiting'
    and q.user_id <> v_me
    and q.mode = p_mode
    and q.entry_fee_wallet_cents = v_entry
    and coalesce(q.listed_prize_usd_cents, 0) = v_prize
    and (q.game_key is not distinct from v_game)
  order by q.created_at asc
  limit 1
  for update skip locked;

  if v_partner_user is not null then
    update public.h2h_queue_entries set status = 'cancelled' where id = v_partner_row_id;
    delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';

    begin
      v_sid := public.h2h_internal_apply_charged_match_session(
        v_partner_user,
        v_me,
        p_mode,
        coalesce(p_game_key, ''),
        v_entry,
        case when v_prize > 0 then v_prize else null end
      );
    exception
      when others then
        return jsonb_build_object('ok', false, 'error', 'match_create_failed', 'detail', sqlerrm);
    end;

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'match_session_id', v_sid,
      'opponent_user_id', v_partner_user
    );
  end if;

  -- Drop only stale wait rows (wrong tier/game); keep position when client polls repeatedly.
  delete from public.h2h_queue_entries q
  where q.user_id = v_me
    and q.status = 'waiting'
    and (
      q.mode <> p_mode
      or q.entry_fee_wallet_cents <> v_entry
      or coalesce(q.listed_prize_usd_cents, 0) <> v_prize
      or not (q.game_key is not distinct from v_game)
    );

  select q.id
    into v_my_waiting_id
  from public.h2h_queue_entries q
  where q.user_id = v_me
    and q.status = 'waiting'
    and q.mode = p_mode
    and q.entry_fee_wallet_cents = v_entry
    and coalesce(q.listed_prize_usd_cents, 0) = v_prize
    and (q.game_key is not distinct from v_game)
  limit 1;

  if v_my_waiting_id is not null then
    return jsonb_build_object(
      'ok', true,
      'matched', false,
      'queue_entry_id', v_my_waiting_id
    );
  end if;

  insert into public.h2h_queue_entries (user_id, mode, game_key, entry_fee_wallet_cents, listed_prize_usd_cents, status)
  values (
    v_me,
    p_mode,
    v_game,
    v_entry,
    case when v_prize > 0 then v_prize else null end,
    'waiting'
  )
  returning id into v_my_waiting_id;

  return jsonb_build_object(
    'ok', true,
    'matched', false,
    'queue_entry_id', v_my_waiting_id
  );
end;
$$;

grant execute on function public.h2h_enqueue_or_match(text, text, bigint, bigint) to authenticated;

comment on function public.h2h_enqueue_or_match(text, text, bigint, bigint) is
  'Join H2H queue or immediately match with oldest compatible waiter; on match, creates charged session. Poll every 1–3s while searching.';

-- ---------------------------------------------------------------------------
-- Cancel queue (authenticated)
-- ---------------------------------------------------------------------------

create or replace function public.h2h_cancel_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.h2h_cancel_queue() to authenticated;

comment on function public.h2h_cancel_queue() is
  'Remove caller from H2H waiting queue.';
