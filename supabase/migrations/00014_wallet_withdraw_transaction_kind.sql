-- Allow ledger rows for cash-out to Stripe Connect (wallet → connected account transfer).

alter table public.transactions drop constraint if exists transactions_kind_check;

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend',
  'redeem_ticket_spend',
  'wallet_withdraw'
));

comment on constraint transactions_kind_check on public.transactions is
  'wallet_withdraw: cash balance sent to user Stripe Connect account (see withdrawWalletToConnect Edge Function).';
