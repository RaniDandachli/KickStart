-- Keep public.user_stats in sync when match_results rows are inserted (recordMatchResult Edge Function).
-- Exposes profile_fight_stats (wins / losses / streaks / global rank by wins) and recent_match_feed (JSON for UI).

-- ---------------------------------------------------------------------------
-- Trigger: bump user_stats from each finalized match_result
-- ---------------------------------------------------------------------------

create or replace function public.apply_user_stats_from_match_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pa uuid;
  pb uuid;
begin
  -- Decisive match: winner + loser
  if new.winner_user_id is not null and new.loser_user_id is not null then
    insert into public.user_stats (user_id, wins, losses, current_streak, best_streak, matches_played)
    values (new.winner_user_id, 1, 0, 1, 1, 1)
    on conflict (user_id) do update set
      wins = public.user_stats.wins + 1,
      matches_played = public.user_stats.matches_played + 1,
      current_streak = public.user_stats.current_streak + 1,
      best_streak = greatest(public.user_stats.best_streak, public.user_stats.current_streak + 1),
      updated_at = now();

    insert into public.user_stats (user_id, wins, losses, current_streak, best_streak, matches_played)
    values (new.loser_user_id, 0, 1, 0, 0, 1)
    on conflict (user_id) do update set
      losses = public.user_stats.losses + 1,
      matches_played = public.user_stats.matches_played + 1,
      current_streak = 0,
      updated_at = now();

    return new;
  end if;

  -- Draw (H2H): both ids null, participants from parent match
  if new.match_session_id is not null then
    select s.player_a_id, s.player_b_id
    into pa, pb
    from public.match_sessions s
    where s.id = new.match_session_id;
  elsif new.tournament_match_id is not null then
    select tm.player_a_id, tm.player_b_id
    into pa, pb
    from public.tournament_matches tm
    where tm.id = new.tournament_match_id;
  end if;

  if pa is not null and pb is not null then
    insert into public.user_stats (user_id, wins, losses, current_streak, best_streak, matches_played)
    values (pa, 0, 0, 0, 0, 1)
    on conflict (user_id) do update set
      matches_played = public.user_stats.matches_played + 1,
      current_streak = 0,
      updated_at = now();

    insert into public.user_stats (user_id, wins, losses, current_streak, best_streak, matches_played)
    values (pb, 0, 0, 0, 0, 1)
    on conflict (user_id) do update set
      matches_played = public.user_stats.matches_played + 1,
      current_streak = 0,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_match_results_user_stats on public.match_results;
create trigger trg_match_results_user_stats
  after insert on public.match_results
  for each row
  execute function public.apply_user_stats_from_match_result();

comment on function public.apply_user_stats_from_match_result() is
  'Increments user_stats wins/losses/streaks when a row is inserted into match_results (service role / Edge Functions).';

-- ---------------------------------------------------------------------------
-- RPC: single row for profile + home “YOUR STATS” (rank = global by wins)
-- ---------------------------------------------------------------------------

create or replace function public.profile_fight_stats(p_user_id uuid)
returns table (
  wins int,
  losses int,
  current_streak int,
  best_streak int,
  matches_played int,
  wins_rank bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with ranked as (
    select
      us.user_id,
      rank() over (
        order by us.wins desc, us.losses asc, us.user_id asc
      ) as rnk
    from public.user_stats us
  )
  select
    us.wins,
    us.losses,
    us.current_streak,
    us.best_streak,
    us.matches_played,
    r.rnk as wins_rank
  from public.user_stats us
  join ranked r on r.user_id = us.user_id
  where us.user_id = p_user_id;
$$;

comment on function public.profile_fight_stats(uuid) is
  'Wins, losses, streaks, matches_played, and global wins_rank (RANK() over user_stats by wins) for a user.';

grant execute on function public.profile_fight_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: recent completed H2H rows for the caller (opponent + scores)
-- ---------------------------------------------------------------------------

create or replace function public.recent_match_feed(p_limit int default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_agg(row_json order by ended_at desc)
      from (
        select
          ms.ended_at,
          jsonb_build_object(
            'match_id', ms.id,
            'ended_at', ms.ended_at,
            'is_draw', ms.winner_user_id is null,
            'won', ms.winner_user_id is not null and ms.winner_user_id = auth.uid(),
            'opponent_username', p.username,
            'opponent_display_name', coalesce(p.display_name, p.username),
            'score_for',
              case
                when ms.player_a_id = auth.uid() then ms.score_a
                else ms.score_b
              end,
            'score_against',
              case
                when ms.player_a_id = auth.uid() then ms.score_b
                else ms.score_a
              end,
            'game_key', ms.game_key
          ) as row_json
        from public.match_sessions ms
        join public.profiles p
          on p.id = case
            when ms.player_a_id = auth.uid() then ms.player_b_id
            else ms.player_a_id
          end
        where ms.status = 'completed'
          and ms.ended_at is not null
          and auth.uid() in (ms.player_a_id, ms.player_b_id)
        order by ms.ended_at desc
        limit least(coalesce(p_limit, 10), 50)
      ) sub
    ),
    '[]'::jsonb
  );
$$;

comment on function public.recent_match_feed(int) is
  'Recent completed match_sessions for auth.uid(); SECURITY DEFINER but scoped to caller as participant.';

grant execute on function public.recent_match_feed(int) to authenticated;

-- Helpful for profile / history queries (optional but cheap)
create index if not exists idx_match_sessions_completed_ended
  on public.match_sessions (ended_at desc)
  where status = 'completed' and ended_at is not null;

-- ---------------------------------------------------------------------------
-- Optional one-time backfill (commented): replay stats for rows inserted before this migration.
-- Only run manually if you need historical counts; streak/rank will reflect DB state from here on.
--
-- with agg as (
--   select winner_user_id as uid, count(*)::int as w from public.match_results
--     where winner_user_id is not null group by 1
-- ), agg_l as (
--   select loser_user_id as uid, count(*)::int as l from public.match_results
--     where loser_user_id is not null group by 1
-- )
-- update public.user_stats us set
--   wins = coalesce((select w from agg where uid = us.user_id), 0),
--   losses = coalesce((select l from agg_l where uid = us.user_id), 0),
--   matches_played = coalesce((select w from agg where uid = us.user_id), 0)
--     + coalesce((select l from agg_l where uid = us.user_id), 0),
--   updated_at = now();
-- (Then recompute current_streak / best_streak in app or a dedicated script if you need exact streak history.)
