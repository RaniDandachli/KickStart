-- Let authenticated users read other players' waiting async rows (open battle board).
-- Complements h2h_async_host_list_open_challenges (security definer) and enables client fallback
-- when that RPC is not yet deployed.

drop policy if exists "h2h_async_host_pending_select_open_board" on public.h2h_async_host_pending;

create policy "h2h_async_host_pending_select_open_board"
  on public.h2h_async_host_pending
  for select
  to authenticated
  using (
    status = 'waiting_opponent'
    and expires_at > now()
    and host_user_id <> (select auth.uid())
  );

comment on policy "h2h_async_host_pending_select_open_board" on public.h2h_async_host_pending is
  'Events 1v1 board: browse open locked scores from other hosts (not your own pending row).';
