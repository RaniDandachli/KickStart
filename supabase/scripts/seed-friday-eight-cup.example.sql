-- Example: create the Friday $10 → $70 pool, 8-player single-elimination cup.
-- Run once in the SQL editor (or adapt for migration). Copy the returned `id` into
-- EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID in the app .env
--
-- Prerequisites: `join_tournament` (00038) debits `wallet_cents` when
-- `entry_type = 'credits'` and `entry_fee_wallet_cents` > 0.
--
-- After 8 entrants, call Edge `generateBracket` (admin JWT) with this tournament id.

insert into public.tournaments (
  name,
  description,
  state,
  format,
  entry_type,
  entry_fee_wallet_cents,
  prize_description,
  max_players,
  current_player_count,
  rules_summary,
  starts_at
) values (
  'Friday 8 · $70 Cup',
  'Weekly cash cup — 8 players, single elimination. $10 wallet entry. $70 prize pool to the winner (operator rules apply).',
  'open',
  'single_elimination',
  'credits',
  1000,
  '$70 prize pool — winner take-all (see official rules).',
  8,
  0,
  'Kickoff Fridays 2:00 PM local (set starts_at to your venue TZ). No-show: forfeit after 30 minutes of scheduled match time — enforce with ops/cron (see tournamentForfeitsCron Edge stub).',
  -- Next Friday 14:00 in the database session timezone — replace with timestamptz for your region:
  date_trunc('week', now() at time zone 'America/New_York') + interval '5 days' + interval '14 hours'
)
returning id, name, starts_at;

-- Optional rules rows:
-- insert into public.tournament_rules (tournament_id, sort_order, title, body)
-- values ('<uuid-from-above>', 0, 'Entry', '$10 charged from wallet_cents on join via join_tournament.');
