-- Auto-create profile + stats row on signup.
-- Username should be supplied in raw_user_meta_data (see client signUp call).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, 'player'), '@', 1)
  );
  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', final_username)
  );

  insert into public.user_stats (user_id) values (new.id);

  insert into public.ratings (user_id, season_id, queue_mode)
  values (new.id, null, 'ranked');
  insert into public.ratings (user_id, season_id, queue_mode)
  values (new.id, null, 'casual');

  return new;
end;
$$;

-- Supabase / Postgres trigger syntax
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
