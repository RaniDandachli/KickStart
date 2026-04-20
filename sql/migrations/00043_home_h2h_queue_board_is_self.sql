-- Expose whether the waiting row belongs to the caller (for in-app open-slot alerts without false positives).
-- Postgres rejects changing RETURNS TABLE columns via CREATE OR REPLACE; drop first.

drop function if exists public.home_h2h_queue_board();

create function public.home_h2h_queue_board()
returns table (
  queue_entry_id uuid,
  game_key text,
  entry_fee_wallet_cents bigint,
  listed_prize_usd_cents bigint,
  host_display_name text,
  created_at timestamptz,
  is_self boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    q.id,
    q.game_key,
    q.entry_fee_wallet_cents,
    coalesce(q.listed_prize_usd_cents, 0)::bigint,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      'Player'
    )::text,
    q.created_at,
    (q.user_id = auth.uid()) as is_self
  from public.h2h_queue_entries q
  inner join public.profiles p on p.id = q.user_id
  where q.status = 'waiting'
    and q.mode = 'casual'
    and q.game_key is not null
    and length(trim(q.game_key)) > 0
    and trim(q.game_key) <> '__quick_match__'
  order by q.created_at asc
  limit 80;
$$;

revoke all on function public.home_h2h_queue_board() from public;
grant execute on function public.home_h2h_queue_board() to anon, authenticated;

comment on function public.home_h2h_queue_board() is
  'Lists casual H2H queue waiters for Home live board; display name only, no user ids. is_self is true when the row is the caller''s own queue entry.';

revoke all on function public.home_h2h_queue_board() from public;
grant execute on function public.home_h2h_queue_board() to anon, authenticated;

comment on function public.home_h2h_queue_board() is
  'Lists casual H2H queue waiters for Home live board; display name only, no user ids. is_self is true when the row is the caller''s own queue entry.';
