-- Single-player arcade scores (anti-cheat validated via Edge Functions).
-- Duel outcomes stay in `match_results` (requires match_session / tournament_match).

create table public.minigame_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_type text not null,
  score int not null check (score >= 0),
  duration_ms int not null check (duration_ms >= 0),
  taps int not null check (taps >= 0),
  created_at timestamptz not null default now(),
  constraint minigame_scores_duration_cap check (duration_ms <= 86400000),
  constraint minigame_scores_taps_cap check (taps <= 2000000)
);

create index minigame_scores_user_game_created_idx
  on public.minigame_scores (user_id, game_type, created_at desc);

alter table public.minigame_scores enable row level security;

create policy minigame_scores_select_own
  on public.minigame_scores for select
  to authenticated
  using (user_id = auth.uid());
