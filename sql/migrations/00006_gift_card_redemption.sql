-- Gift card redemption: inventory (codes never exposed to clients), reward_catalog, atomic RPC,
-- prize_catalog + prize_redemptions extensions. Ticket balance stays on public.profiles.redeem_tickets.

-- ---------------------------------------------------------------------------
-- A) reward_catalog — canonical gift-card reward definition (reward_key, brand, value, ticket cost)
-- ---------------------------------------------------------------------------
create table public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  reward_key text not null unique,
  reward_name text not null,
  brand text not null,
  value_amount numeric not null,
  currency text not null default 'USD',
  ticket_cost bigint not null check (ticket_cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index reward_catalog_active_key_idx on public.reward_catalog (is_active, reward_key);

comment on table public.reward_catalog is
  'Gift-card redeem targets. prize_catalog rows link here for shop display; redeem uses redeem_gift_card_offer.';

-- ---------------------------------------------------------------------------
-- B) gift_card_inventory — preloaded codes; never readable via PostgREST for end users
-- ---------------------------------------------------------------------------
create table public.gift_card_inventory (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  reward_name text not null,
  value_amount numeric not null,
  currency text not null default 'USD',
  code text not null unique,
  pin text,
  is_used boolean not null default false,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  redemption_id uuid,
  created_at timestamptz not null default now()
);

create index gift_card_inventory_available_idx
  on public.gift_card_inventory (brand, value_amount, currency, created_at)
  where is_used = false;

comment on table public.gift_card_inventory is
  'Preloaded codes. RLS blocks authenticated reads; Edge Function uses service role to email codes.';

-- FK to prize_redemptions added after column exists on prize_redemptions

-- ---------------------------------------------------------------------------
-- C) Extend prize_catalog — link optional shop row to reward_catalog
-- ---------------------------------------------------------------------------
alter table public.prize_catalog
  add column if not exists reward_catalog_id uuid references public.reward_catalog (id) on delete set null;

create unique index if not exists prize_catalog_reward_catalog_id_uidx
  on public.prize_catalog (reward_catalog_id)
  where reward_catalog_id is not null;

comment on column public.prize_catalog.reward_catalog_id is
  'When set, this prize is a gift card — redeem via Edge Function redeem-gift-card, not redeem_prize_offer.';

-- ---------------------------------------------------------------------------
-- D) Extend prize_redemptions — email + idempotency + gift row reference
--    (Spec “reward_redemptions” is modeled here to avoid duplicating redemption tables.)
-- ---------------------------------------------------------------------------
alter table public.prize_redemptions
  add column if not exists gift_card_inventory_id uuid references public.gift_card_inventory (id) on delete set null;

alter table public.prize_redemptions
  add column if not exists email_to text;

alter table public.prize_redemptions
  add column if not exists email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed'));

alter table public.prize_redemptions
  add column if not exists email_error text;

alter table public.prize_redemptions
  add column if not exists idempotency_key text;

create unique index if not exists prize_redemptions_user_idempotency_uidx
  on public.prize_redemptions (user_id, idempotency_key)
  where idempotency_key is not null;

-- redemption_id is set after insert for audit links; no FK to prize_redemptions to avoid circular constraints.

-- ---------------------------------------------------------------------------
-- E) RLS — inventory is server-only; reward_catalog readable when active
-- ---------------------------------------------------------------------------
alter table public.reward_catalog enable row level security;
alter table public.gift_card_inventory enable row level security;

create policy reward_catalog_read_active
  on public.reward_catalog for select to authenticated
  using (is_active = true or public.is_staff());

create policy reward_catalog_write_staff
  on public.reward_catalog for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- No SELECT/INSERT/UPDATE/DELETE for authenticated on gift_card_inventory (service role bypasses RLS)

-- ---------------------------------------------------------------------------
-- F) Atomic gift-card redemption (no secrets returned)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_gift_card_offer(p_reward_key text, p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rc public.reward_catalog%rowtype;
  v_prize public.prize_catalog%rowtype;
  v_gift public.gift_card_inventory%rowtype;
  v_cost bigint;
  v_new_balance bigint;
  v_redeem_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_reward_key is null or length(trim(p_reward_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_reward_key');
  end if;

  -- Serialize same user + same reward to reduce double-submit races
  perform pg_advisory_xact_lock(hashtext('giftcard_redeem:' || v_user::text || ':' || trim(p_reward_key)));

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('giftcard_idem:' || v_user::text || ':' || trim(p_idempotency_key)));
    select pr.id into v_redeem_id
    from public.prize_redemptions pr
    where pr.user_id = v_user and pr.idempotency_key = trim(p_idempotency_key);
    if found then
      return jsonb_build_object('ok', true, 'redemption_id', v_redeem_id, 'duplicate', true);
    end if;
  end if;

  select * into v_rc from public.reward_catalog
  where reward_key = trim(p_reward_key) and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_prize from public.prize_catalog
  where reward_catalog_id = v_rc.id and is_active = true
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'prize_not_configured');
  end if;

  if v_prize.cost_redeem_tickets is distinct from v_rc.ticket_cost then
    return jsonb_build_object('ok', false, 'error', 'catalog_mismatch');
  end if;

  v_cost := v_rc.ticket_cost;

  select * into v_gift from public.gift_card_inventory
  where brand = v_rc.brand
    and value_amount = v_rc.value_amount
    and currency = v_rc.currency
    and is_used = false
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'out_of_stock');
  end if;

  perform set_config('kickclash.allow_profile_economy_write', '1', true);

  update public.profiles
  set redeem_tickets = redeem_tickets - v_cost
  where id = v_user and redeem_tickets >= v_cost
  returning redeem_tickets into v_new_balance;

  if v_new_balance is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  end if;

  insert into public.prize_redemptions (
    user_id,
    prize_catalog_id,
    redeem_tickets_spent,
    status,
    shipping_snapshot,
    gift_card_inventory_id,
    email_to,
    email_status,
    idempotency_key
  )
  values (
    v_user,
    v_prize.id,
    v_cost,
    'fulfilled',
    null,
    v_gift.id,
    null,
    'pending',
    nullif(trim(p_idempotency_key), '')
  )
  returning id into v_redeem_id;

  update public.gift_card_inventory
  set is_used = true,
      used_by = v_user,
      used_at = now(),
      redemption_id = v_redeem_id
  where id = v_gift.id;

  insert into public.transactions (user_id, kind, amount, currency, description, metadata)
  values (
    v_user,
    'redeem_ticket_spend',
    v_cost,
    'redeem_tickets',
    'Gift card: ' || v_rc.reward_name,
    jsonb_build_object(
      'prize_catalog_id', v_prize.id,
      'reward_key', v_rc.reward_key,
      'gift_card_inventory_id', v_gift.id,
      'redemption_id', v_redeem_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'redemption_id', v_redeem_id,
    'redeem_tickets_balance', v_new_balance,
    'duplicate', false
  );
end;
$$;

grant execute on function public.redeem_gift_card_offer(text, text) to authenticated;

comment on function public.redeem_gift_card_offer is
  'Atomically assigns one inventory row, deducts tickets from profiles, records redemption. No codes in response.';

-- ---------------------------------------------------------------------------
-- G) Block generic prize RPC for gift-card rows (must use redeem_gift_card_offer / Edge)
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

  if v_prize.reward_catalog_id is not null then
    return jsonb_build_object('ok', false, 'error', 'use_gift_card_flow');
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
