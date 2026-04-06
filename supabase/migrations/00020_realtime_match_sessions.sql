-- Broadcast `match_sessions` row changes over Supabase Realtime (H2H match-found + cache invalidation).
-- Filtered `postgres_changes` subscriptions require REPLICA IDENTITY FULL on the table.

alter table public.match_sessions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_sessions'
  ) then
    alter publication supabase_realtime add table public.match_sessions;
  end if;
end $$;

comment on table public.match_sessions is
  '1v1 sessions; replicated for Realtime (match found, lobby updates).';
