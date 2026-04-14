-- Mirror of supabase/migrations/00034_h2h_quick_match_pickup_strict.sql

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

  perform pg_advisory_xact_lock(hashtext('h2h_enqueue_' || p_mode));

  select wallet_cents into v_wallet from public.profiles where id = v_me;
  if v_wallet is null then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  v_max_entry := greatest(coalesce(p_max_affordable_entry_cents, 0), 0);
  if v_max_entry > v_wallet then
    v_max_entry := v_wallet;
  end if;

  select ms.id,
         case when ms.player_a_id = v_me then ms.player_b_id else ms.player_a_id end
    into v_sid, v_partner_user
  from public.match_sessions ms
  where (ms.player_a_id = v_me or ms.player_b_id = v_me)
    and ms.status in ('lobby', 'in_progress')
    and ms.mode = p_mode
    and coalesce(ms.entry_fee_wallet_cents, 0) <= v_max_entry
    and v_wallet >= coalesce(ms.entry_fee_wallet_cents, 0)
    and ms.updated_at > now() - interval '45 minutes'
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

  delete from public.h2h_queue_entries where user_id = v_me and status = 'waiting';

  insert into public.h2h_queue_entries (
    user_id, mode, game_key, entry_fee_wallet_cents, listed_prize_usd_cents, status, wildcard_budget_cents
  )
  values (
    v_me, p_mode, '__quick_match__', 0, 0, 'waiting', v_max_entry
  )
  returning id into v_my_waiting_id;

  return jsonb_build_object(
    'ok', true,
    'matched', false,
    'queue_entry_id', v_my_waiting_id
  );
end;
$$;

comment on function public.h2h_enqueue_quick_match(text, bigint) is
  'Quick Match: pair with affordable waiter; session pickup limited by wallet, tier, and recency.';
