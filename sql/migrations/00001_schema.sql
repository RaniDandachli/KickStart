-- KickClash core schema (Supabase Postgres)
-- UUID keys, normalized tables, indexes for hot paths.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & progression
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin', 'moderator')),
  region text not null default 'global',
  suspended_until timestamptz,
  cheating_review_flag boolean not null default false,
  credits bigint not null default 0 check (credits >= 0),
  gems bigint not null default 0 check (gems >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete set null,
  queue_mode text not null check (queue_mode in ('ranked', 'casual')),
  rating int not null default 1500,
  games_played int not null default 0,
  provisional_games_remaining int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, season_id, queue_mode)
);

create table public.user_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  wins int not null default 0,
  losses int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  matches_played int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles (id) on delete set null,
  season_id uuid references public.seasons (id) on delete set null,
  name text not null,
  description text,
  state text not null default 'draft'
    check (state in ('draft', 'open', 'full', 'locked', 'active', 'completed', 'cancelled')),
  format text not null check (format in ('single_elimination', 'round_robin')),
  entry_type text not null check (entry_type in ('free', 'credits', 'sponsor')),
  entry_cost_credits bigint not null default 0 check (entry_cost_credits >= 0),
  prize_description text not null default '',
  max_players int not null default 8 check (max_players > 0),
  current_player_count int not null default 0 check (current_player_count >= 0),
  rules_summary text,
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'registered'
    check (status in ('registered', 'eliminated', 'winner', 'withdrawn')),
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round_index int not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_index)
);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round_id uuid not null references public.tournament_rounds (id) on delete cascade,
  match_index int not null,
  player_a_id uuid references public.profiles (id),
  player_b_id uuid references public.profiles (id),
  winner_id uuid references public.profiles (id),
  next_match_id uuid references public.tournament_matches (id),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'live', 'completed', 'disputed', 'void')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, match_index)
);

-- ---------------------------------------------------------------------------
-- Play queue / sessions (non-tournament 1v1)
-- ---------------------------------------------------------------------------
create table public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('casual', 'ranked', 'custom')),
  status text not null default 'queued'
    check (status in ('queued', 'matched', 'lobby', 'in_progress', 'completed', 'cancelled', 'disputed')),
  player_a_id uuid references public.profiles (id),
  player_b_id uuid references public.profiles (id),
  winner_user_id uuid references public.profiles (id),
  score_a int not null default 0,
  score_b int not null default 0,
  suspicious_flag boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'manual_review')),
  dispute_status text not null default 'none'
    check (dispute_status in ('none', 'submitted', 'under_review', 'resolved')),
  evidence_notes text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_session_id uuid references public.match_sessions (id) on delete set null,
  tournament_match_id uuid references public.tournament_matches (id) on delete set null,
  winner_user_id uuid references public.profiles (id),
  loser_user_id uuid references public.profiles (id),
  score jsonb not null default '{"a":0,"b":0}'::jsonb,
  ranked_rating_delta jsonb,
  was_ranked boolean not null default false,
  audit_ref text,
  created_at timestamptz not null default now(),
  constraint match_results_one_parent check (
    (match_session_id is not null and tournament_match_id is null)
    or (match_session_id is null and tournament_match_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Leaderboards & meta
-- ---------------------------------------------------------------------------
create table public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons (id) on delete cascade,
  scope text not null check (scope in ('global', 'regional', 'friends')),
  region text not null default 'global',
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank int not null,
  rating int not null,
  wins int not null default 0,
  win_rate numeric,
  streak int not null default 0,
  rank_delta int not null default 0,
  captured_at timestamptz not null default now()
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_key text not null default 'trophy',
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- Economy (no withdrawals / cash wallet)
-- ---------------------------------------------------------------------------
create table public.cosmetics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('avatar_frame', 'trail', 'ball_skin', 'title', 'emote')),
  rarity text not null default 'common',
  price_credits bigint,
  price_gems bigint,
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_cosmetics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id uuid not null references public.cosmetics (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  equipped boolean not null default false,
  unique (user_id, cosmetic_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
    'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment'
  )),
  amount bigint not null,
  currency text not null check (currency in ('credits', 'gems')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive'
    check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  plan_key text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id),
  match_session_id uuid references public.match_sessions (id),
  category text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_profiles_username on public.profiles (username);
create index idx_profiles_region on public.profiles (region);
create index idx_ratings_user on public.ratings (user_id);
create index idx_tournaments_state on public.tournaments (state);
create index idx_tournament_entries_t on public.tournament_entries (tournament_id);
create index idx_match_sessions_status on public.match_sessions (status);
create index idx_leaderboard_season_scope on public.leaderboard_snapshots (season_id, scope, region);
create index idx_transactions_user_created on public.transactions (user_id, created_at desc);
create index idx_notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_seasons_updated before update on public.seasons
  for each row execute function public.set_updated_at();
create trigger trg_ratings_updated before update on public.ratings
  for each row execute function public.set_updated_at();
create trigger trg_tournaments_updated before update on public.tournaments
  for each row execute function public.set_updated_at();
create trigger trg_tournament_matches_updated before update on public.tournament_matches
  for each row execute function public.set_updated_at();
create trigger trg_match_sessions_updated before update on public.match_sessions
  for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();
