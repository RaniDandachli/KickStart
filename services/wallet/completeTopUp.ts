import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED } from '@/constants/featureFlags';
import { getCreditPackageById } from '@/lib/creditPackages';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';

import { openStripeCheckoutSession } from '@/services/wallet/stripeCheckout';

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
 * Guest / no backend: credits the on-device cash balance only (no payment).
 *
 * With backend: opens Stripe Checkout when `WALLET_TOPUP_STRIPE_ENABLED`; wallet updates after server webhook.
 */
export async function completeWalletTopUp(amountCents: number): Promise<boolean> {
  assertValidTopUpAmountCents(amountCents);

  if (!ENABLE_BACKEND) {
    useDemoWalletStore.getState().addWalletCents(amountCents);
    return true;
  }

  if (!WALLET_TOPUP_STRIPE_ENABLED) {
    throw new Error(
      'Card payments are not connected yet. Set EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED and deploy Stripe Edge Functions + webhook.',
    );
  }

  return openStripeCheckoutSession({ kind: 'wallet', amountCents });
}

/**
 * Purchase a credit pack: guest mode grants on-device Arcade Credits; production uses Stripe Checkout + webhook.
 */
export async function completeCreditsPackagePurchase(packageId: string): Promise<boolean> {
  const pack = getCreditPackageById(packageId);
  if (!pack) throw new Error('Unknown credit package.');

  if (!ENABLE_BACKEND) {
    useDemoPrizeCreditsStore.getState().add(pack.prizeCredits);
    return true;
  }

  if (!WALLET_TOPUP_STRIPE_ENABLED) {
    throw new Error(
      'Purchases are not enabled yet. Set EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED and deploy Stripe Edge Functions + webhook.',
    );
  }

  return openStripeCheckoutSession({ kind: 'credits', packageId });
}
