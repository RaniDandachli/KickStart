import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED } from '@/constants/featureFlags';
import { useDemoWalletStore } from '@/store/demoWalletStore';

export const MIN_TOP_UP_CENTS = 100;
export const MAX_TOP_UP_CENTS = 50_000;

/**
 * Validates amount for a wallet deposit (USD cents).
 * Production credits must come from a Stripe-confirmed payment on the server — never trust the client alone.
 */
export function assertValidTopUpAmountCents(cents: number): void {
  const n = Math.floor(cents);
  if (!Number.isFinite(n) || n < MIN_TOP_UP_CENTS || n > MAX_TOP_UP_CENTS) {
    throw new Error(`Choose an amount between $${(MIN_TOP_UP_CENTS / 100).toFixed(2)} and $${(MAX_TOP_UP_CENTS / 100).toFixed(2)}.`);
  }
}

/**
 * Guest / offline: credits the local demo wallet immediately (simulates a successful Stripe charge).
 *
 * With backend: only completes when `WALLET_TOPUP_STRIPE_ENABLED` and your Edge Function has verified
 * the PaymentIntent / Checkout Session; until then, throws so the UI can show “coming soon”.
 */
export async function completeWalletTopUp(amountCents: number): Promise<void> {
  assertValidTopUpAmountCents(amountCents);

  if (!ENABLE_BACKEND) {
    useDemoWalletStore.getState().addWalletCents(amountCents);
    return;
  }

  if (!WALLET_TOPUP_STRIPE_ENABLED) {
    throw new Error(
      'Card payments are not connected yet. Add a Stripe Checkout or Payment Element flow on the server, then credit `profiles.wallet_cents` from a webhook after `payment_intent.succeeded`.',
    );
  }

  throw new Error('Stripe top-up is enabled but no client bridge is wired yet. Call your Edge Function from the payment success handler.');
}
