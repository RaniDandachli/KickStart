-- Example: Friday $10 → $70 pool, single elimination in waves of 8 players.
-- Run once in the SQL editor. Copy the returned `id` into EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID in .env
--
-- unlimited_entrants: join never blocks at 8 — more players can keep entering the same tournament row.
-- bracket_pod_size: each generateBracket call takes the next N entrants not yet placed in a bracket.
--
-- After each wave has enough entrants (≥2), call Edge `generateBracket` (admin JWT) with this tournament id.
-- Wave 1: first up to 8 unassigned entrants. Wave 2: next 8, etc.

insert into public.tournaments (
  name,
  description,
  state,
  format,
  entry_type,
  entry_fee_wallet_cents,
  prize_description,
  max_players,
  unlimited_entrants,
  bracket_pod_size,
  current_player_count,
  rules_summary,
  starts_at
) values (
  'Friday 8 · $70 Cup',
  'Weekly cash cup — single elimination in waves of 8. $10 wallet entry per player. $70 prize pool per wave winner (operator rules apply).',
  'open',
  'single_elimination',
  'credits',
  1000,
  '$70 prize pool — winner take-all per bracket wave (see official rules).',
  8,
  true,
  8,
  0,
  'Kickoff Fridays 2:00 PM local (set starts_at to your venue TZ). max_players=8 is the wave size; signups stay open while unlimited_entrants is true.',
  date_trunc('week', now() at time zone 'America/New_York') + interval '5 days' + interval '14 hours'
)
returning id, name, starts_at, unlimited_entrants, bracket_pod_size;
