import { ENABLE_BACKEND, WHOP_CHECKOUT_ENABLED } from '@/constants/featureFlags';
import { getCreditPackageById } from '@/lib/creditPackages';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';

import { openWhopCheckoutSession } from '@/services/wallet/whopCheckout';

export const MIN_TOP_UP_CENTS = 100;
export const MAX_TOP_UP_CENTS = 50_000;

/**
 * Validates amount for a wallet deposit (USD cents).
 * Production credits must come from a Whop-confirmed payment on the server — never trust the client alone.
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
 * With backend: opens Whop checkout when enabled; wallet updates after `whopWebhook`.
 */
export async function completeWalletTopUp(amountCents: number): Promise<boolean> {
  assertValidTopUpAmountCents(amountCents);

  if (!ENABLE_BACKEND) {
    useDemoWalletStore.getState().addWalletCents(amountCents);
    return true;
  }

  if (!WHOP_CHECKOUT_ENABLED) {
    throw new Error(
      'Whop checkout is not enabled. Set EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED and deploy createWhopCheckoutSession + whopWebhook.',
    );
  }
  return openWhopCheckoutSession({ kind: 'wallet', amountCents });
}

/**
 * Purchase a credit pack: guest mode grants on-device Arcade Credits; production uses Whop checkout + webhook.
 */
export async function completeCreditsPackagePurchase(packageId: string): Promise<boolean> {
  const pack = getCreditPackageById(packageId);
  if (!pack) throw new Error('Unknown credit package.');

  if (!ENABLE_BACKEND) {
    useDemoPrizeCreditsStore.getState().add(pack.prizeCredits);
    return true;
  }

  if (!WHOP_CHECKOUT_ENABLED) {
    throw new Error(
      'Whop checkout is not enabled. Set EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED and deploy createWhopCheckoutSession + whopWebhook.',
    );
  }
  return openWhopCheckoutSession({ kind: 'credits', packageId });
}
