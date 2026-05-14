-- Let signed-in hosts read their own async-host rows (in-app "runs waiting to settle" UI).
-- Inserts/updates remain via RPC / service paths only.

drop policy if exists "h2h_async_host_pending_select_own" on public.h2h_async_host_pending;

create policy "h2h_async_host_pending_select_own"
  on public.h2h_async_host_pending
  for select
  to authenticated
  using (host_user_id = (select auth.uid()));
