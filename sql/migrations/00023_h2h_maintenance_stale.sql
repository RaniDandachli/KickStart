-- Expire abandoned H2H lobbies (refund like lobby leave) and drop stale queue waiters.
-- Invoke via Edge `h2hMaintenance` + service role (schedule in Supabase Dashboard → Edge Functions → Cron).

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

revoke all on function public.h2h_maintenance_expire_stale() from public;
revoke all on function public.h2h_maintenance_expire_stale() from authenticated;
grant execute on function public.h2h_maintenance_expire_stale() to service_role;
grant execute on function public.h2h_maintenance_expire_stale() to postgres;

comment on function public.h2h_maintenance_expire_stale() is
  'Service role: cancel lobby sessions idle >2h (with entry refund); remove queue rows waiting >45m. Call from scheduled Edge function.';
