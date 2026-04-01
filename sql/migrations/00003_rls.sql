-- Row Level Security — client uses anon + authenticated JWT; Edge Functions use service role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Staff helper
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'moderator')
  );
$$;

grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.ratings enable row level security;
alter table public.user_stats enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_rules enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.match_sessions enable row level security;
alter table public.match_results enable row level security;
alter table public.minigame_scores enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.cosmetics enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.prize_catalog enable row level security;
alter table public.prize_redemptions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — created by handle_new_user trigger only; no direct client insert
-- ---------------------------------------------------------------------------
create policy profiles_select_authenticated
  on public.profiles for select to authenticated using (true);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- seasons / ratings / user_stats — read-only from client; writes via service role / triggers
-- ---------------------------------------------------------------------------
create policy seasons_read
  on public.seasons for select to authenticated using (true);

create policy ratings_read
  on public.ratings for select to authenticated using (true);

create policy user_stats_read
  on public.user_stats for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create policy tournaments_read
  on public.tournaments for select to authenticated using (true);

create policy tournament_rules_read
  on public.tournament_rules for select to authenticated using (true);

create policy tournament_entries_read
  on public.tournament_entries for select to authenticated using (true);

create policy tournament_entries_insert_own
  on public.tournament_entries for insert to authenticated
  with check (auth.uid() = user_id);

create policy tournament_rounds_read
  on public.tournament_rounds for select to authenticated using (true);

create policy tournament_matches_read
  on public.tournament_matches for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- match_sessions / match_results
-- ---------------------------------------------------------------------------
create policy match_sessions_read_participants
  on public.match_sessions for select to authenticated
  using (
    auth.uid() in (player_a_id, player_b_id)
    or public.is_staff()
  );

create policy match_results_read_participants
  on public.match_results for select to authenticated
  using (
    public.is_staff()
    or auth.uid() in (winner_user_id, loser_user_id)
    or exists (
      select 1 from public.match_sessions ms
      where ms.id = match_session_id
      and auth.uid() in (ms.player_a_id, ms.player_b_id)
    )
    or exists (
      select 1 from public.tournament_matches tm
      where tm.id = tournament_match_id
      and auth.uid() in (tm.player_a_id, tm.player_b_id)
    )
  );

-- ---------------------------------------------------------------------------
-- minigame_scores — insert only via Edge Function (service role); users read own rows
-- ---------------------------------------------------------------------------
create policy minigame_scores_select_own
  on public.minigame_scores for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- leaderboard / achievements
-- ---------------------------------------------------------------------------
create policy leaderboard_read
  on public.leaderboard_snapshots for select to authenticated using (true);

create policy achievements_read
  on public.achievements for select to authenticated using (true);

create policy user_achievements_read
  on public.user_achievements for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- cosmetics / inventory / economy
-- ---------------------------------------------------------------------------
create policy cosmetics_read
  on public.cosmetics for select to authenticated using (true);

create policy user_cosmetics_rw_own
  on public.user_cosmetics for select to authenticated using (auth.uid() = user_id);

create policy user_cosmetics_insert_own
  on public.user_cosmetics for insert to authenticated
  with check (auth.uid() = user_id);

create policy user_cosmetics_update_own
  on public.user_cosmetics for update to authenticated
  using (auth.uid() = user_id);

create policy transactions_read_own
  on public.transactions for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions & notifications
-- ---------------------------------------------------------------------------
create policy subscriptions_read_own
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy notifications_rw_own
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

create policy notifications_update_own
  on public.notifications for update to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reports & audit
-- ---------------------------------------------------------------------------
create policy reports_insert_authenticated
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy reports_read_own
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id or public.is_staff());

create policy audit_read_staff
  on public.admin_audit_logs for select to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------------------
-- prize_catalog / prize_redemptions — catalog browse; redemptions via RPC only
-- ---------------------------------------------------------------------------
create policy prize_catalog_read
  on public.prize_catalog for select to authenticated
  using (is_active = true or public.is_staff());

create policy prize_catalog_write_staff
  on public.prize_catalog for insert to authenticated
  with check (public.is_staff());

create policy prize_catalog_update_staff
  on public.prize_catalog for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy prize_catalog_delete_staff
  on public.prize_catalog for delete to authenticated
  using (public.is_staff());

create policy prize_redemptions_select_own
  on public.prize_redemptions for select to authenticated
  using (user_id = auth.uid());
