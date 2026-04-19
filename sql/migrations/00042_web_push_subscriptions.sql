-- Browser Web Push subscriptions (VAPID) for open-queue alerts on web.

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists idx_web_push_subscriptions_user on public.web_push_subscriptions (user_id);

comment on table public.web_push_subscriptions is
  'PushSubscription keys for Web Push (h2hOpenMatchWatchScan + registerWebPushSubscription).';

drop trigger if exists set_web_push_subscriptions_updated_at on public.web_push_subscriptions;
create trigger set_web_push_subscriptions_updated_at
  before update on public.web_push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.web_push_subscriptions enable row level security;

create policy web_push_subscriptions_select_own
  on public.web_push_subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy web_push_subscriptions_insert_own
  on public.web_push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

create policy web_push_subscriptions_update_own
  on public.web_push_subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy web_push_subscriptions_delete_own
  on public.web_push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);
