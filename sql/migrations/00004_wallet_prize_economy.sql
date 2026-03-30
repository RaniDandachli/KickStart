-- Split cash wallet vs prize credits; prize catalog for Supabase-managed rewards.
-- wallet_cents: head-to-head entry fees, tournament entry, withdrawals (same cents semantics as old `credits`).
-- prize_credits: arcade only; redeem via `prize_catalog` / redeem_prize_offer().
--
-- Admin workflow: Supabase Dashboard → Table Editor → `prize_catalog` (insert rows).
-- Images: create a public Storage bucket (e.g. `prize-images`), upload file, paste the public URL into `image_url`.

-- ---------------------------------------------------------------------------
-- profiles: rename balance column + add prize credits
-- ---------------------------------------------------------------------------
alter table public.profiles rename column credits to wallet_cents;

alter table public.profiles
  add column prize_credits bigint not null default 0
  constraint profiles_prize_credits_nonneg check (prize_credits >= 0);

-- ---------------------------------------------------------------------------
-- tournaments: fee is wallet money (cents), not arcade prize credits
-- ---------------------------------------------------------------------------
alter table public.tournaments rename column entry_cost_credits to entry_fee_wallet_cents;

-- ---------------------------------------------------------------------------
-- transactions: wallet currency renamed; prize-credit ledger lines
-- Drop checks first so we can migrate currency values, then re-add.
-- ---------------------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions drop constraint if exists transactions_currency_check;

update public.transactions set currency = 'wallet_cents' where currency = 'credits';

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend'
));

alter table public.transactions add constraint transactions_currency_check check (currency in (
  'wallet_cents', 'gems', 'prize_credits'
));

-- ---------------------------------------------------------------------------
-- Prize catalog (editable in Supabase Table Editor)
-- ---------------------------------------------------------------------------
create table public.prize_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  image_url text not null,
  cost_prize_credits bigint not null check (cost_prize_credits > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  stock_remaining int check (stock_remaining is null or stock_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prize_catalog_active_sort_idx
  on public.prize_catalog (is_active, sort_order, title);

create trigger prize_catalog_set_updated_at
  before update on public.prize_catalog
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Redemptions (fulfillment workflow — admin marks fulfilled in Table Editor or app later)
-- ---------------------------------------------------------------------------
create table public.prize_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prize_catalog_id uuid not null references public.prize_catalog (id) on delete restrict,
  prize_credits_spent bigint not null check (prize_credits_spent > 0),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now()
);

create index prize_redemptions_user_idx on public.prize_redemptions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Atomic redeem (clients call supabase.rpc('redeem_prize_offer', { p_prize_id }))
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

  v_cost := v_prize.cost_prize_credits;

  update public.profiles
  set prize_credits = prize_credits - v_cost
  where id = v_user and prize_credits >= v_cost
  returning prize_credits into v_new_balance;

  if v_new_balance is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  end if;

  if v_prize.stock_remaining is not null then
    update public.prize_catalog
    set stock_remaining = stock_remaining - 1
    where id = p_prize_id;
  end if;

  insert into public.prize_redemptions (user_id, prize_catalog_id, prize_credits_spent, status)
  values (v_user, p_prize_id, v_cost, 'pending');

  insert into public.transactions (user_id, kind, amount, currency, description, metadata)
  values (
    v_user,
    'prize_credit_spend',
    v_cost,
    'prize_credits',
    'Redeemed: ' || v_prize.title,
    jsonb_build_object('prize_catalog_id', p_prize_id)
  );

  return jsonb_build_object('ok', true, 'prize_credits_balance', v_new_balance);
end;
$$;

grant execute on function public.redeem_prize_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.prize_catalog enable row level security;
alter table public.prize_redemptions enable row level security;

create policy prize_catalog_read
  on public.prize_catalog for select
  to authenticated
  using (is_active = true or public.is_staff());

create policy prize_catalog_write_staff
  on public.prize_catalog for insert
  to authenticated
  with check (public.is_staff());

create policy prize_catalog_update_staff
  on public.prize_catalog for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy prize_catalog_delete_staff
  on public.prize_catalog for delete
  to authenticated
  using (public.is_staff());

create policy prize_redemptions_select_own
  on public.prize_redemptions for select
  to authenticated
  using (user_id = auth.uid());
