-- Whop connected account (platform sub-merchant) id for optional hosted payout portal (alongside Stripe Connect).

alter table public.profiles
  add column if not exists whop_company_id text;

comment on column public.profiles.whop_company_id is
  'Whop Company id (biz_…) for connected-account payouts; set only via Edge Function (service role).';

-- Block client from setting Whop company id (same pattern as Stripe Connect).
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if current_setting('kickclash.allow_profile_economy_write', true) = '1' then
    return new;
  end if;
  if auth.uid() = old.id then
    if new.wallet_cents is distinct from old.wallet_cents
       or new.prize_credits is distinct from old.prize_credits
       or new.redeem_tickets is distinct from old.redeem_tickets
       or new.gems is distinct from old.gems
       or new.role is distinct from old.role
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_connect_account_id is distinct from old.stripe_connect_account_id
       or new.whop_company_id is distinct from old.whop_company_id
       or new.last_daily_claim_ymd is distinct from old.last_daily_claim_ymd
       or new.suspended_until is distinct from old.suspended_until
       or new.cheating_review_flag is distinct from old.cheating_review_flag
       or new.last_daily_credits_push_sent_ymd is distinct from old.last_daily_credits_push_sent_ymd
       or new.last_tournament_of_day_push_sent_ymd is distinct from old.last_tournament_of_day_push_sent_ymd
    then
      raise exception 'Economy, Stripe, Whop, daily-claim, moderation, and server push stamp fields cannot be changed from the client';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_sensitive_columns() is
  'Rejects client updates to balances, role, Stripe/Whop ids, daily claim date, moderation flags, and Expo push idempotency stamps unless kickclash.allow_profile_economy_write=1.';
