-- Prize credits = arcade play only. Redeem tickets = Prizes catalog only.
-- Renames catalog / redemption columns and switches redeem_prize_offer() to redeem_tickets.

alter table public.profiles
  add column if not exists redeem_tickets bigint not null default 0
  constraint profiles_redeem_tickets_nonneg check (redeem_tickets >= 0);

alter table public.prize_catalog rename column cost_prize_credits to cost_redeem_tickets;

alter table public.prize_redemptions rename column prize_credits_spent to redeem_tickets_spent;

alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions drop constraint if exists transactions_currency_check;

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend',
  'redeem_ticket_spend'
));

alter table public.transactions add constraint transactions_currency_check check (currency in (
  'wallet_cents', 'gems', 'prize_credits', 'redeem_tickets'
));

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

  insert into public.prize_redemptions (user_id, prize_catalog_id, redeem_tickets_spent, status)
  values (v_user, p_prize_id, v_cost, 'pending');

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
