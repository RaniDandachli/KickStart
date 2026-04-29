-- Prevent second-chance re-submits for the same H2H match/game/player.
create unique index if not exists uq_minigame_scores_h2h_one_submit
  on public.minigame_scores (match_session_id, user_id, game_type)
  where match_session_id is not null;

