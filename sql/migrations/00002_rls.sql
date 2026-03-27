-- Row Level Security policies
-- Admin / moderation workflows that bypass RLS must use the Supabase service role key
-- (server-side Edge Functions or trusted backends only — never ship service role to the client).

-- ---------------------------------------------------------------------------
-- Staff helper (JWT-authenticated users only)
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

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_authenticated
  on public.profiles for select to authenticated using (true);

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- seasons / ratings / user_stats (read-wide; writes via Edge Functions + service role)
-- ---------------------------------------------------------------------------
create policy seasons_read
  on public.seasons for select to authenticated using (true);

create policy ratings_read
  on public.ratings for select to authenticated using (true);

create policy ratings_write_own
  on public.ratings for insert to authenticated
  with check (auth.uid() = user_id);

create policy ratings_update_own
  on public.ratings for update to authenticated
  using (auth.uid() = user_id);

create policy user_stats_read
  on public.user_stats for select to authenticated using (true);

create policy user_stats_write_own
  on public.user_stats for insert to authenticated
  with check (auth.uid() = user_id);

create policy user_stats_update_own
  on public.user_stats for update to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- tournaments (public browse; structural writes by staff via service role in MVP)
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
-- match_sessions / results
-- ---------------------------------------------------------------------------
create policy match_sessions_read_participants
  on public.match_sessions for select to authenticated
  using (
    auth.uid() in (player_a_id, player_b_id)
    or public.is_staff()
  );

create policy match_results_read_participants
  on public.match_results for select to authenticated
  using (true);

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
-- reports & audit (reads limited)
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
