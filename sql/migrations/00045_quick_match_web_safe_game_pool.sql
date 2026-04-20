-- Mirror of supabase/migrations/00045_quick_match_web_safe_game_pool.sql

-- Quick Match wildcard pairing: avoid native-only game picks on web.
-- Ball Run requires native expo-gl on web fallback, so do not auto-pick it.

create or replace function public.h2h_enqueue_quick_match(
  p_mode text,
  p_max_affordable_entry_cents bigint,
  p_allowed_entry_cents bigint[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_known bigint[] := array[0, 100, 500, 1000, 2000, 5000, 10000]::bigint[];
  v_me uuid := auth.uid();
  v_wallet bigint;
  v_max_entry bigint;
  v_me_allowed bigint[];
  v_partner_row_id uuid;
  v_partner_user uuid;
  v_partner_wallet bigint;
  v_partner_allowed bigint[];
  v_game text;
  v_pair_game text;
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

  perform pg_advisory_xact_lock(hashtext('h2h_enqueue_' || p_mode));

  select wallet_cents into v_wallet from public.profiles where id = v_me;
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  v_max_entry := greatest(coalesce(p_max_affordable_entry_cents, 0), 0);
  if v_max_entry > v_wallet then
    v_max_entry := v_wallet;
  end if;

  select coalesce(array_agg(x order by x), array[]::bigint[])
  into v_me_allowed
  from (
    select distinct u as x
    from unnest(coalesce(p_allowed_entry_cents, array[]::bigint[])) as t(u)
    where u = any(v_known)
      and u <= v_max_entry
      and u <= v_wallet
  ) s;

  if v_me_allowed is null or cardinality(v_me_allowed) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_allowed_entries');
  end if;

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
    and q.entry_fee_wallet_cents = any(v_me_allowed)
  order by q.created_at asc
  limit 1
  for update;

  if v_partner_user is not null and v_game is not null then
    begin
      v_sid := public.h2h_internal_apply_charged_match_session(
        v_partner_user,
        v_me,
        p_mode,
        coalesce(v_game, ''),
        v_entry,
        case when v_prize > 0 then v_prize else null end
      );
      update public.h2h_queue_entries set status = 'cancelled' where id = v_partner_row_id;
      delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
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

  select
    q.id,
    q.user_id,
    coalesce(q.quick_match_allowed_entry_cents, array[0::bigint]) as pa,
    pw.wallet_cents
  into v_partner_row_id, v_partner_user, v_partner_allowed, v_partner_wallet
  from public.h2h_queue_entries q
  inner join public.profiles pw on pw.id = q.user_id
  where q.status = 'waiting'
    and q.user_id <> v_me
    and q.mode = p_mode
    and trim(coalesce(q.game_key, '')) = '__quick_match__'
    and exists (
      select 1
      from unnest(v_me_allowed) me(e)
      where me.e in (select unnest(coalesce(q.quick_match_allowed_entry_cents, array[0::bigint])))
        and me.e <= least(v_wallet, pw.wallet_cents)
    )
  order by q.created_at asc
  limit 1
  for update of q;

  if v_partner_user is not null then
    select max(e) into v_entry
    from (
      select unnest(v_me_allowed) as e
      intersect
      select unnest(v_partner_allowed) as e
    ) x(e)
    where x.e <= least(v_wallet, v_partner_wallet);

    if v_entry is null then
      return jsonb_build_object('ok', false, 'error', 'match_create_failed', 'detail', 'no_common_quick_match_tier');
    end if;

    v_prize := case v_entry
      when 0 then 0
      when 100 then 200
      when 500 then 900
      when 1000 then 1900
      when 2000 then 3800
      when 5000 then 9500
      when 10000 then 19000
      else 0
    end;

    -- Web-safe pool for auto-picked wildcard-vs-wildcard game.
    v_pair_game := (array['tap-dash', 'tile-clash', 'dash-duel'])[
      1 + (abs(hashtext(v_me::text || '|' || v_partner_user::text)) % 3)
    ];

    begin
      v_sid := public.h2h_internal_apply_charged_match_session(
        v_partner_user,
        v_me,
        p_mode,
        v_pair_game,
        v_entry,
        case when v_prize > 0 then v_prize else null end
      );
      update public.h2h_queue_entries set status = 'cancelled' where id = v_partner_row_id;
      delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
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

  select ms.id,
         case when ms.player_a_id = v_me then ms.player_b_id else ms.player_a_id end
    into v_sid, v_partner_user
    from public.match_sessions ms
    where (ms.player_a_id = v_me or ms.player_b_id = v_me)
      and ms.status in ('lobby', 'in_progress')
      and ms.mode = p_mode
      and ms.created_at > now() - interval '3 minutes'
    order by ms.created_at desc
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

  delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';

  insert into public.h2h_queue_entries (
    user_id,
    mode,
    game_key,
    entry_fee_wallet_cents,
    listed_prize_usd_cents,
    status,
    wildcard_budget_cents,
    quick_match_allowed_entry_cents
  )
  values (
    v_me,
    p_mode,
    '__quick_match__',
    0,
    0,
    'waiting',
    v_max_entry,
    v_me_allowed
  )
  returning id into v_my_waiting_id;

  return jsonb_build_object(
    'ok', true,
    'matched', false,
    'queue_entry_id', v_my_waiting_id
  );
end;
$$;

grant execute on function public.h2h_enqueue_quick_match(text, bigint, bigint[]) to authenticated;

comment on function public.h2h_enqueue_quick_match(text, bigint, bigint[]) is
  'Quick Match: specific waiters (tier must be allowed), WW vs WW (max common tier), pending session pickup, then wildcard wait with tier allowlist. WW game pool excludes native-only Ball Run.';
-- Quick Match wildcard pairing: avoid native-only game picks on web.
-- Ball Run requires native expo-gl on web fallback, so do not auto-pick it.

create or replace function public.h2h_enqueue_quick_match(
  p_mode text,
  p_max_affordable_entry_cents bigint,
  p_allowed_entry_cents bigint[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_known bigint[] := array[0, 100, 500, 1000, 2000, 5000, 10000]::bigint[];
  v_me uuid := auth.uid();
  v_wallet bigint;
  v_max_entry bigint;
  v_me_allowed bigint[];
  v_partner_row_id uuid;
  v_partner_user uuid;
  v_partner_wallet bigint;
  v_partner_allowed bigint[];
  v_game text;
  v_pair_game text;
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

  perform pg_advisory_xact_lock(hashtext('h2h_enqueue_' || p_mode));

  select wallet_cents into v_wallet from public.profiles where id = v_me;
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  v_max_entry := greatest(coalesce(p_max_affordable_entry_cents, 0), 0);
  if v_max_entry > v_wallet then
    v_max_entry := v_wallet;
  end if;

  select coalesce(array_agg(x order by x), array[]::bigint[])
  into v_me_allowed
  from (
    select distinct u as x
    from unnest(coalesce(p_allowed_entry_cents, array[]::bigint[])) as t(u)
    where u = any(v_known)
      and u <= v_max_entry
      and u <= v_wallet
  ) s;

  if v_me_allowed is null or cardinality(v_me_allowed) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_allowed_entries');
  end if;

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
    and q.entry_fee_wallet_cents = any(v_me_allowed)
  order by q.created_at asc
  limit 1
  for update;

  if v_partner_user is not null and v_game is not null then
    begin
      v_sid := public.h2h_internal_apply_charged_match_session(
        v_partner_user,
        v_me,
        p_mode,
        coalesce(v_game, ''),
        v_entry,
        case when v_prize > 0 then v_prize else null end
      );
      update public.h2h_queue_entries set status = 'cancelled' where id = v_partner_row_id;
      delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
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

  select
    q.id,
    q.user_id,
    coalesce(q.quick_match_allowed_entry_cents, array[0::bigint]) as pa,
    pw.wallet_cents
  into v_partner_row_id, v_partner_user, v_partner_allowed, v_partner_wallet
  from public.h2h_queue_entries q
  inner join public.profiles pw on pw.id = q.user_id
  where q.status = 'waiting'
    and q.user_id <> v_me
    and q.mode = p_mode
    and trim(coalesce(q.game_key, '')) = '__quick_match__'
    and exists (
      select 1
      from unnest(v_me_allowed) me(e)
      where me.e in (select unnest(coalesce(q.quick_match_allowed_entry_cents, array[0::bigint])))
        and me.e <= least(v_wallet, pw.wallet_cents)
    )
  order by q.created_at asc
  limit 1
  for update of q;

  if v_partner_user is not null then
    select max(e) into v_entry
    from (
      select unnest(v_me_allowed) as e
      intersect
      select unnest(v_partner_allowed) as e
    ) x(e)
    where x.e <= least(v_wallet, v_partner_wallet);

    if v_entry is null then
      return jsonb_build_object('ok', false, 'error', 'match_create_failed', 'detail', 'no_common_quick_match_tier');
    end if;

    v_prize := case v_entry
      when 0 then 0
      when 100 then 200
      when 500 then 900
      when 1000 then 1900
      when 2000 then 3800
      when 5000 then 9500
      when 10000 then 19000
      else 0
    end;

    -- Web-safe pool for auto-picked wildcard-vs-wildcard game.
    v_pair_game := (array['tap-dash', 'tile-clash', 'dash-duel'])[
      1 + (abs(hashtext(v_me::text || '|' || v_partner_user::text)) % 3)
    ];

    begin
      v_sid := public.h2h_internal_apply_charged_match_session(
        v_partner_user,
        v_me,
        p_mode,
        v_pair_game,
        v_entry,
        case when v_prize > 0 then v_prize else null end
      );
      update public.h2h_queue_entries set status = 'cancelled' where id = v_partner_row_id;
      delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';
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

  select ms.id,
         case when ms.player_a_id = v_me then ms.player_b_id else ms.player_a_id end
    into v_sid, v_partner_user
    from public.match_sessions ms
    where (ms.player_a_id = v_me or ms.player_b_id = v_me)
      and ms.status in ('lobby', 'in_progress')
      and ms.mode = p_mode
      and ms.created_at > now() - interval '3 minutes'
    order by ms.created_at desc
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

  delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';

  insert into public.h2h_queue_entries (
    user_id,
    mode,
    game_key,
    entry_fee_wallet_cents,
    listed_prize_usd_cents,
    status,
    wildcard_budget_cents,
    quick_match_allowed_entry_cents
  )
  values (
    v_me,
    p_mode,
    '__quick_match__',
    0,
    0,
    'waiting',
    v_max_entry,
    v_me_allowed
  )
  returning id into v_my_waiting_id;

  return jsonb_build_object(
    'ok', true,
    'matched', false,
    'queue_entry_id', v_my_waiting_id
  );
end;
$$;

grant execute on function public.h2h_enqueue_quick_match(text, bigint, bigint[]) to authenticated;

comment on function public.h2h_enqueue_quick_match(text, bigint, bigint[]) is
  'Quick Match: specific waiters (tier must be allowed), WW vs WW (max common tier), pending session pickup, then wildcard wait with tier allowlist. WW game pool excludes native-only Ball Run.';
