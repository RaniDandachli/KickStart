-- Reference seed data (no auth.users dependency).
-- Run after migrations. For demo leaderboard rows that reference profiles,
-- use the companion script after you create test accounts, or use the Edge Function bootstrap.

insert into public.seasons (id, name, starts_at, ends_at, is_active)
values (
  '11111111-1111-4111-8111-111111111111',
  'KickClash S1 — Neon Pitch',
  now() - interval '30 days',
  now() + interval '60 days',
  true
)
on conflict (id) do nothing;

insert into public.achievements (slug, name, description, icon_key) values
  ('first_touch', 'First Touch', 'Complete your first match.', 'boot'),
  ('win_streak_3', 'Heating Up', 'Win 3 matches in a row.', 'flame'),
  ('tournament_contender', 'Bracket Ready', 'Join a tournament.', 'ticket')
on conflict (slug) do nothing;

insert into public.cosmetics (slug, name, kind, rarity, price_credits, price_gems, stripe_price_id) values
  ('ball_neon', 'Neon Comet Ball', 'ball_skin', 'rare', 1200, null, null),
  ('trail_arcs', 'Voltage Trail', 'trail', 'epic', null, 40, null),
  ('title_gladiator', 'Title: Gladiator', 'title', 'common', 500, null, null),
  ('frame_gold', 'Golden Goal Frame', 'avatar_frame', 'legendary', null, 120, 'price_stub_stripe_cosmetic_gold_frame')
on conflict (slug) do nothing;

insert into public.tournaments (
  id, season_id, name, description, state, format, entry_type,
  entry_fee_wallet_cents, prize_description, max_players, current_player_count,
  rules_summary, starts_at
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Weekly Showcase (Sponsor)',
  'Sponsor-funded cosmetic bundles — no entry fee, no cash pool.',
  'open',
  'single_elimination',
  'sponsor',
  0,
  'Top 3 receive exclusive avatar frames and titles awarded by admins.',
  32,
  6,
  '1v1 KickClash rules. Single elimination. Check in 10 min before start.',
  now() + interval '2 days'
),
(
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Credit Cup (100 credits)',
  'Entry costs credits only — skill-based play; redeemable prize credits.',
  'open',
  'single_elimination',
  'credits',
  100,
  'Champion badge + 500 bonus credits granted by season admins.',
  16,
  9,
  'Fair play policy. Disputes reviewed within 24h.',
  now() + interval '5 days'
)
on conflict (id) do nothing;

insert into public.tournament_rules (tournament_id, sort_order, title, body)
select v.tournament_id, v.sort_order, v.title, v.body
from (values
  ('22222222-2222-4222-8222-222222222222'::uuid, 0, 'Match format', 'Best of 3 goals or 3 minutes — engine TBD.'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 1, 'Disconnects', 'Report via app; moderation may reschedule.'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 0, 'Wallet entry', 'Entry deducted from cash wallet on join; refunded if cancelled by admin.')
) as v(tournament_id, sort_order, title, body)
where not exists (
  select 1 from public.tournament_rules r
  where r.tournament_id = v.tournament_id and r.sort_order = v.sort_order
);
