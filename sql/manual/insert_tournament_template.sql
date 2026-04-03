-- Manual insert: add a new row to `public.tournaments` (and optional rules).
-- Run in Supabase SQL Editor (or psql) as a role that can INSERT (often bypasses RLS).
-- Adjust values, then execute the whole block.

-- Valid `state`:    'draft' | 'open' | 'full' | 'locked' | 'active' | 'completed' | 'cancelled'
-- Valid `format`:   'single_elimination' | 'round_robin'
-- Valid `entry_type`: 'free' | 'credits' | 'sponsor'

with new_t as (
  insert into public.tournaments (
    season_id,
    creator_id,
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
    (select id from public.seasons where is_active = true order by starts_at desc nulls last limit 1),
    null, -- or a profile uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    'My New Cup',
    'Short blurb shown in the app.',
    'open',
    'single_elimination',
    'free',
    0,
    'Champion wins $50 in redeemable credits (admin-granted).',
    16,
    0,
    'Skill-based. Single elimination. Check in 10 min before start.',
    now() + interval '3 days'
  )
  returning id
)
insert into public.tournament_rules (tournament_id, sort_order, title, body)
select id, 0, 'Match format', 'Best of 3 goals or 3 minutes — follow in-app rules.'
from new_t;

-- Verify:
-- select id, name, state, starts_at from public.tournaments order by created_at desc limit 5;
