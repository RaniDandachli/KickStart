-- Head-to-head: extra fields for 1v1 queue + one persisted result per session
alter table public.match_sessions
  add column if not exists game_key text,
  add column if not exists entry_fee_wallet_cents bigint not null default 0,
  add column if not exists listed_prize_usd_cents bigint,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.match_sessions.game_key is 'Minigame key for this 1v1 (e.g. tap-dash).';
comment on column public.match_sessions.entry_fee_wallet_cents is 'Contest entry held for this session (wallet cents).';
comment on column public.match_sessions.listed_prize_usd_cents is 'Fixed prize tier for UI / payout (USD cents).';

-- Prevent duplicate result rows for the same head-to-head session
create unique index if not exists idx_match_results_one_per_h2h_session
  on public.match_results (match_session_id)
  where match_session_id is not null;
