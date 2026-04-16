import { env } from '@/lib/env';

/**
 * Public HTTPS origin used for Stripe Connect `refresh_url` / `return_url`.
 * Stripe rejects custom schemes (e.g. exp://). Must match a URL your app handles (universal / app links).
 *
 * Set in `.env`: `EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL=https://your-domain.com`
 * If unset, defaults to the production site (same default as Edge `STRIPE_CONNECT_BUSINESS_URL`).
 */
export const STRIPE_CONNECT_PUBLIC_ORIGIN = (
  env.EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL?.trim() || 'https://runitarcade.app'
).replace(/\/$/, '');

/** Path inside the app (web + native deep link) after Stripe redirects. */
export const STRIPE_CONNECT_PATH = 'profile/stripe-connect';

export function buildStripeConnectRedirectUrls(): { refreshUrl: string; returnUrl: string; baseUrl: string } {
  const base = `${STRIPE_CONNECT_PUBLIC_ORIGIN}/${STRIPE_CONNECT_PATH}`;
  const refreshUrl = `${base}${base.includes('?') ? '&' : '?'}connect=refresh`;
  const returnUrl = `${base}${base.includes('?') ? '&' : '?'}connect=return`;
  return { refreshUrl, returnUrl, baseUrl: base };
}
