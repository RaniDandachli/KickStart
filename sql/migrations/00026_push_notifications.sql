-- Expo push: device token + per-channel opt-in + idempotency stamps for broadcast edges.

alter table public.profiles
  add column if not exists expo_push_token text,
  add column if not exists expo_push_token_updated_at timestamptz,
  add column if not exists push_notify_match_invites boolean not null default true,
  add column if not exists push_notify_tournament_of_day boolean not null default true,
  add column if not exists push_notify_daily_credits boolean not null default true,
  add column if not exists last_daily_credits_push_sent_ymd text,
  add column if not exists last_tournament_of_day_push_sent_ymd text;

comment on column public.profiles.expo_push_token is
  'Expo push token (ExponentPushToken[...]). Cleared on sign-out or when permission revoked.';
comment on column public.profiles.expo_push_token_updated_at is 'Last time expo_push_token was set or cleared from the client.';
comment on column public.profiles.push_notify_match_invites is 'Reserved for future match-invite pushes (client Settings → Match invites).';
comment on column public.profiles.push_notify_tournament_of_day is 'Tournament of the Day broadcast (Edge cron + Expo Push).';
comment on column public.profiles.push_notify_daily_credits is 'Push after daily 100 Arcade Credits claim (notifyDailyCreditsPush).';
comment on column public.profiles.last_daily_credits_push_sent_ymd is
  'UTC YYYY-MM-DD when notifyDailyCreditsPush last sent; server-managed.';
comment on column public.profiles.last_tournament_of_day_push_sent_ymd is
  'UTC YYYY-MM-DD when broadcastTournamentOfDayPush last sent; server-managed.';

-- ---------------------------------------------------------------------------
-- Block client from forging server-managed push idempotency fields.
-- ---------------------------------------------------------------------------
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
       or new.last_daily_claim_ymd is distinct from old.last_daily_claim_ymd
       or new.suspended_until is distinct from old.suspended_until
       or new.cheating_review_flag is distinct from old.cheating_review_flag
       or new.last_daily_credits_push_sent_ymd is distinct from old.last_daily_credits_push_sent_ymd
       or new.last_tournament_of_day_push_sent_ymd is distinct from old.last_tournament_of_day_push_sent_ymd
    then
      raise exception 'Economy, Stripe, daily-claim, moderation, and server push stamp fields cannot be changed from the client';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_sensitive_columns() is
  'Rejects client updates to balances, role, Stripe ids, daily claim date, moderation flags, and Expo push idempotency stamps unless kickclash.allow_profile_economy_write=1.';
