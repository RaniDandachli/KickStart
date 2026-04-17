/** User-facing copy for Stripe Connect withdrawals (bank timing). */

export const PAYOUT_BANK_TIMING_SHORT =
  'Most transfers reach your bank in about 2–3 business days. Sometimes banks need an extra day or two for security checks—thanks for hanging with us while everything clears.';

export const PAYOUT_BANK_TIMING_WITHDRAWAL_SUCCESS =
  "We're sending your cash to Stripe, and they'll route it to your linked bank. Most people see it in 2–3 business days; occasionally your bank takes a bit longer for routine checks. You'll see updates in your Stripe dashboard.";

/** After a successful wallet debit → Whop ledger transfer (bank timing is on Whop’s side). */
export const PAYOUT_WHOP_TRANSFER_SUCCESS =
  'Your cash balance was moved to your Whop connected account. Withdraw to your bank from the Whop payout portal when you’re ready — timing depends on Whop and your bank.';

/** Shown on Shop → Cash wallet: card deposits don’t require Connect; withdrawals do. */
export const WALLET_DEPOSIT_WITHDRAW_POLICY =
  'You can add cash with a card anytime. Withdrawing to your bank still needs Stripe payout setup (Profile → Creator payouts).';
