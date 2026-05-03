import { PUBLIC_SITE_ORIGIN } from '@/lib/publicSiteOrigin';

/**
 * Whop hosted checkout requires `https://` success/cancel URLs.
 * `Linking.createURL()` yields `exp://` / custom schemes — invalid for payment redirects.
 *
 * Uses `EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL` (public app origin), defaulting to production.
 * Configure universal / app links so `…/profile/add-funds?status=success` returns users to the native app.
 */
const ADD_FUNDS_PATH = 'profile/add-funds';

function addFundsPageBase(): string {
  return `${PUBLIC_SITE_ORIGIN}/${ADD_FUNDS_PATH}`;
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
