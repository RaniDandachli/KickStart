-- Quick Match wildcard: pair with any waiting specific row the caller can afford (wallet / policy max entry).
-- Wildcard waiters use game_key = '__quick_match__' + wildcard_budget_cents (max entry they can accept).

alter table public.h2h_queue_entries
  add column if not exists wildcard_budget_cents bigint null;

comment on column public.h2h_queue_entries.wildcard_budget_cents is
  'When game_key is __quick_match__, max entry fee (cents) this user can accept (wallet/policy). Null for normal rows.';

-- ---------------------------------------------------------------------------
-- Home board: hide wildcard rows (not a concrete contest to join from Home).
-- ---------------------------------------------------------------------------

create or replace function public.home_h2h_queue_board()
returns table (
  queue_entry_id uuid,
  game_key text,
  entry_fee_wallet_cents bigint,
  listed_prize_usd_cents bigint,
  host_display_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    q.id,
    q.game_key,
    q.entry_fee_wallet_cents,
    coalesce(q.listed_prize_usd_cents, 0)::bigint,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      'Player'
    )::text,
    q.created_at
  from public.h2h_queue_entries q
  inner join public.profiles p on p.id = q.user_id
  where q.status = 'waiting'
    and q.mode = 'casual'
    and q.game_key is not null
    and length(trim(q.game_key)) > 0
    and trim(q.game_key) <> '__quick_match__'
  order by q.created_at asc
  limit 80;
$$;

-- ---------------------------------------------------------------------------
-- Quick Match poll: afford any specific waiter, or wait as wildcard.
-- ---------------------------------------------------------------------------

create or replace function public.h2h_enqueue_quick_match(
  p_mode text,
  p_max_affordable_entry_cents bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_wallet bigint;
  v_max_entry bigint;
  v_partner_row_id uuid;
  v_partner_user uuid;
  v_game text;
  v_entry bigint;
  v_prize bigint;
  v_sid uuid;
  v_my_waiting_id uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_mode is null or p_mode not in ('casual', 'ranked', 'custom') then
    return jsonb_build_object('ok', false, 'error', 'invalid_mode');
  end if;

  select wallet_cents into v_wallet from public.profiles where id = v_me;
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  v_max_entry := greatest(coalesce(p_max_affordable_entry_cents, 0), 0);
  if v_max_entry > v_wallet then
    v_max_entry := v_wallet;
  end if;

  -- Pick up session if we were already paired (wildcard or other).
  select ms.id,
         case when ms.player_a_id = v_me then ms.player_b_id else ms.player_a_id end
    into v_sid, v_partner_user
  from public.match_sessions ms
  where (ms.player_a_id = v_me or ms.player_b_id = v_me)
    and ms.status in ('lobby', 'in_progress')
    and ms.mode = p_mode
    and ms.updated_at > now() - interval '24 hours'
  order by coalesce(ms.started_at, ms.created_at) desc
  limit 1;

  if v_sid is not null and v_partner_user is not null then
    delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'match_session_id', v_sid,
      'opponent_user_id', v_partner_user
    );
  end if;

  -- Oldest specific contest we can afford (not another wildcard).
  select
    q.id,
    q.user_id,
    nullif(trim(coalesce(q.game_key, '')), ''),
    q.entry_fee_wallet_cents,
    coalesce(q.listed_prize_usd_cents, 0)
  into v_partner_row_id, v_partner_user, v_game, v_entry, v_prize
  from public.h2h_queue_entries q
  where q.status = 'waiting'
    and q.user_id <> v_me
    and q.mode = p_mode
    and trim(coalesce(q.game_key, '')) <> '__quick_match__'
    and q.entry_fee_wallet_cents <= v_max_entry
    and v_wallet >= q.entry_fee_wallet_cents
  order by q.created_at asc
  limit 1
  for update skip locked;

  if v_partner_user is not null and v_game is not null then
    update public.h2h_queue_entries set status = 'cancelled' where id = v_partner_row_id;
    delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';

    begin
      v_sid := public.h2h_internal_apply_charged_match_session(
        v_partner_user,
        v_me,
        p_mode,
        coalesce(v_game, ''),
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

  delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';

  insert into public.h2h_queue_entries (
    user_id,
    mode,
    game_key,
    entry_fee_wallet_cents,
    listed_prize_usd_cents,
    status,
    wildcard_budget_cents
  )
  values (
    v_me,
    p_mode,
    '__quick_match__',
    0,
    0,
    'waiting',
    v_max_entry
  )
  returning id into v_my_waiting_id;

  return jsonb_build_object(
    'ok', true,
    'matched', false,
    'queue_entry_id', v_my_waiting_id
  );
end;
$$;

grant execute on function public.h2h_enqueue_quick_match(text, bigint) to authenticated;

comment on function public.h2h_enqueue_quick_match(text, bigint) is
  'Quick Match: pair with any affordable specific waiter, or enqueue as wildcard until someone joins.';

-- ---------------------------------------------------------------------------
-- Specific enqueue: also pair callers into waiting Quick Match wildcards.
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

  select ms.id,
         case when ms.player_a_id = v_me then ms.player_b_id else ms.player_a_id end
    into v_sid, v_partner_user
  from public.match_sessions ms
  where (ms.player_a_id = v_me or ms.player_b_id = v_me)
    and ms.status in ('lobby', 'in_progress')
    and ms.mode = p_mode
    and ms.entry_fee_wallet_cents = v_entry
    and coalesce(ms.listed_prize_usd_cents, 0) = v_prize
    and (ms.game_key is not distinct from v_game)
    and ms.updated_at > now() - interval '24 hours'
  order by coalesce(ms.started_at, ms.created_at) desc
  limit 1;

  if v_sid is not null and v_partner_user is not null then
    delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'match_session_id', v_sid,
      'opponent_user_id', v_partner_user
    );
  end if;

  -- Match a Quick Match wildcard who can afford this contest entry.
  select q.id, q.user_id
    into v_partner_row_id, v_partner_user
  from public.h2h_queue_entries q
  where q.status = 'waiting'
    and q.user_id <> v_me
    and q.mode = p_mode
    and trim(coalesce(q.game_key, '')) = '__quick_match__'
    and coalesce(q.wildcard_budget_cents, 0) >= v_entry
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
