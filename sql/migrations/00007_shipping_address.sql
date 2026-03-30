-- Physical prize shipping: profile JSON + catalog flag + snapshot on redemption.

alter table public.profiles
  add column if not exists shipping_address jsonb;

alter table public.prize_catalog
  add column if not exists requires_shipping boolean not null default false;

alter table public.prize_redemptions
  add column if not exists shipping_snapshot jsonb;

update public.prize_catalog set requires_shipping = true where slug = 'kickclash-hat-demo';
update public.prize_catalog set requires_shipping = false where slug = 'gift-card-10-demo';

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
