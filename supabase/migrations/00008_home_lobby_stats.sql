-- Public aggregate stats + activity feeds for the home lobby (SECURITY DEFINER reads across tables).

create or replace function public.home_lobby_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'players_online', coalesce((
      select count(distinct ms.user_id)::int
      from public.minigame_scores ms
      where ms.created_at > now() - interval '30 minutes'
    ), 0),
    'rewards_wallet_cents_24h', coalesce((
      select sum(t.amount)::bigint
      from public.transactions t
      where t.kind = 'reward_grant'
        and t.currency = 'wallet_cents'
        and t.amount > 0
        and t.created_at > now() - interval '24 hours'
    ), 0),
    'matches_in_progress', coalesce((
      select count(*)::int
      from public.match_sessions s
      where s.status in ('in_progress', 'lobby', 'matched')
    ), 0),
    'matches_queued', coalesce((
      select count(*)::int
      from public.match_sessions s
      where s.status = 'queued'
    ), 0),
    'recent_rewards', coalesce((
      select jsonb_agg(x.obj)
      from (
        select jsonb_build_object(
          'username', p.username,
          'cents', t.amount,
          'created_at', t.created_at
        ) as obj
        from public.transactions t
        inner join public.profiles p on p.id = t.user_id
        where t.kind = 'reward_grant'
          and t.currency = 'wallet_cents'
          and t.amount > 0
        order by t.created_at desc
        limit 24
      ) x
    ), '[]'::jsonb),
    'recent_arcade', coalesce((
      select jsonb_agg(y.obj)
      from (
        select jsonb_build_object(
          'username', p.username,
          'score', ms.score,
          'game_type', ms.game_type,
          'created_at', ms.created_at
        ) as obj
        from public.minigame_scores ms
        inner join public.profiles p on p.id = ms.user_id
        order by ms.created_at desc
        limit 24
      ) y
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

grant execute on function public.home_lobby_stats() to authenticated;
grant execute on function public.home_lobby_stats() to anon;
