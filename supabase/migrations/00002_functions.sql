-- Auth bootstrap + prize redemption RPC (security definer)

-- ---------------------------------------------------------------------------
-- Auto-create profile + stats + ratings on signup (username from raw_user_meta_data)
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic prize redemption (called from app: supabase.rpc('redeem_prize_offer', { p_prize_id }))
-- ---------------------------------------------------------------------------
create or replace function public.redeem_prize_offer(p_prize_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cost bigint;
  v_prize public.prize_catalog%rowtype;
  v_new_balance bigint;
  v_ship jsonb;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_prize from public.prize_catalog
  where id = p_prize_id and is_active = true
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_prize.stock_remaining is not null and v_prize.stock_remaining <= 0 then
    return jsonb_build_object('ok', false, 'error', 'out_of_stock');
  end if;

  select shipping_address into v_ship from public.profiles where id = v_user;

  if v_prize.requires_shipping then
    if v_ship is null
       or nullif(trim(v_ship->>'fullName'), '') is null
       or nullif(trim(v_ship->>'line1'), '') is null
       or nullif(trim(v_ship->>'city'), '') is null
       or nullif(trim(v_ship->>'postalCode'), '') is null
       or nullif(trim(v_ship->>'country'), '') is null
    then
      return jsonb_build_object('ok', false, 'error', 'shipping_required');
    end if;
  end if;

  v_cost := v_prize.cost_redeem_tickets;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  update public.profiles
  set redeem_tickets = redeem_tickets - v_cost
  where id = v_user and redeem_tickets >= v_cost
  returning redeem_tickets into v_new_balance;

  if v_new_balance is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  end if;

  if v_prize.stock_remaining is not null then
    update public.prize_catalog
    set stock_remaining = stock_remaining - 1
    where id = p_prize_id;
  end if;

  insert into public.prize_redemptions (user_id, prize_catalog_id, redeem_tickets_spent, status, shipping_snapshot)
  values (
    v_user,
    p_prize_id,
    v_cost,
    'pending',
    case when v_prize.requires_shipping then v_ship else null end
  );

  insert into public.transactions (user_id, kind, amount, currency, description, metadata)
  values (
    v_user,
    'redeem_ticket_spend',
    v_cost,
    'redeem_tickets',
    'Redeemed: ' || v_prize.title,
    jsonb_build_object('prize_catalog_id', p_prize_id)
  );

  return jsonb_build_object('ok', true, 'redeem_tickets_balance', v_new_balance);
end;
$$;

grant execute on function public.redeem_prize_offer(uuid) to authenticated;
