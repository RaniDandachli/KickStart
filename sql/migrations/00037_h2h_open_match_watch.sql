-- Optional push when someone is waiting in the H2H queue and filters match (cron → Edge → Expo).

alter table public.profiles
  add column if not exists push_notify_h2h_open_slots boolean not null default false,
  add column if not exists h2h_open_slot_watch jsonb not null default '{"enabled":false,"entryCents":[],"gameKeys":null}'::jsonb;

comment on column public.profiles.push_notify_h2h_open_slots is
  'When true, h2hOpenMatchWatchScan may send Expo pushes for open queue rows matching h2h_open_slot_watch.';
comment on column public.profiles.h2h_open_slot_watch is
  'JSON: { "enabled": bool, "entryCents": number[] (empty = any tier), "gameKeys": string[] | null (null = any game) }.';

create table if not exists public.h2h_open_slot_notify_log (
  id bigserial primary key,
  watcher_user_id uuid not null references public.profiles (id) on delete cascade,
  queue_entry_id uuid not null,
  sent_at timestamptz not null default now(),
  unique (watcher_user_id, queue_entry_id)
);

create index if not exists idx_h2h_open_slot_notify_sent on public.h2h_open_slot_notify_log (sent_at desc);

alter table public.h2h_open_slot_notify_log enable row level security;
