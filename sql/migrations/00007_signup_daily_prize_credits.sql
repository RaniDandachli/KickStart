-- Signup bonus + daily prize credits when using Supabase (client grants are disabled when backend is on).

alter table public.profiles
  add column if not exists last_daily_claim_ymd text;

comment on column public.profiles.last_daily_claim_ymd is
  'UTC calendar date (YYYY-MM-DD) when daily arcade credits were last claimed; null = legacy row.';

-- ---------------------------------------------------------------------------
-- Daily claim: +100 prize_credits once per UTC day (after signup day).
-- ---------------------------------------------------------------------------
create or replace function public.claim_daily_prize_credits()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today text := to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');
  v_last text;
  v_bal bigint;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select last_daily_claim_ymd, prize_credits into v_last, v_bal
  from public.profiles where id = v_user for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  if v_last is not null and v_last = v_today then
    return jsonb_build_object('ok', true, 'claimed', false, 'balance', v_bal);
  end if;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  update public.profiles
  set prize_credits = prize_credits + 100,
      last_daily_claim_ymd = v_today
  where id = v_user
  returning prize_credits into v_bal;

  return jsonb_build_object('ok', true, 'claimed', true, 'amount', 100, 'balance', v_bal);
end;
$$;

grant execute on function public.claim_daily_prize_credits() to authenticated;

comment on function public.claim_daily_prize_credits is
  'Adds 100 prize_credits once per UTC day if not already claimed; uses profiles.last_daily_claim_ymd.';

-- ---------------------------------------------------------------------------
-- New users: 100 prize credits on signup; stamp today so daily RPC does not double-grant same day.
-- ---------------------------------------------------------------------------
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
  v_today text := to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');
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

  insert into public.profiles (id, username, display_name, prize_credits, last_daily_claim_ymd)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', final_username),
    100,
    v_today
  );

  insert into public.user_stats (user_id) values (new.id);

  insert into public.ratings (user_id, season_id, queue_mode)
  values (new.id, null, 'ranked');
  insert into public.ratings (user_id, season_id, queue_mode)
  values (new.id, null, 'casual');

  return new;
end;
$$;
