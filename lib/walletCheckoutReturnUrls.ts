import { STRIPE_CONNECT_PUBLIC_ORIGIN } from '@/lib/stripeConnectUrls';

/**
 * Stripe Checkout and Whop hosted checkout require `https://` success/cancel URLs.
 * `Linking.createURL()` yields `exp://` / custom schemes — invalid for payment redirects.
 *
 * Uses `EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL` (same as Connect / app marketing domain), defaulting to production.
 * Configure universal / app links so `…/profile/add-funds?status=success` returns users to the native app.
 */
const ADD_FUNDS_PATH = 'profile/add-funds';

function addFundsPageBase(): string {
  return `${STRIPE_CONNECT_PUBLIC_ORIGIN}/${ADD_FUNDS_PATH}`;
}

export function walletCheckoutStripeReturnUrls(): {
  successUrl: string;
  cancelUrl: string;
  /** Second argument to `WebBrowser.openAuthSessionAsync` — must match redirect host/path. */
  authSessionRedirect: string;
} {
  const b = addFundsPageBase();
  return {
    successUrl: `${b}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${b}?status=cancel`,
    authSessionRedirect: b,
  };
}

export function walletCheckoutWhopReturnUrls(): {
  successUrl: string;
  cancelUrl: string;
  authSessionRedirect: string;
} {
  const b = addFundsPageBase();
  return {
    successUrl: `${b}?status=success&provider=whop`,
    cancelUrl: `${b}?status=cancel&provider=whop`,
    authSessionRedirect: b,
  };
}
