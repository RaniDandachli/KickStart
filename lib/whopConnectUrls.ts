import { env } from '@/lib/env';

/**
 * Public HTTPS origin for Whop hosted payout portal `return_url` / `refresh_url`.
 * Whop rejects non-public URLs (e.g. raw localhost); use a tunnel in dev if needed.
 */
export const WHOP_PAYOUT_PUBLIC_ORIGIN = (
  env.EXPO_PUBLIC_WHOP_PAYOUT_REDIRECT_BASE_URL?.trim() ||
  env.EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL?.trim() ||
  'https://runitarcade.app'
).replace(/\/$/, '');

export const WHOP_PAYOUT_PATH = 'profile/whop-payouts';

export function buildWhopPayoutRedirectUrls(): { refreshUrl: string; returnUrl: string; baseUrl: string } {
  const base = `${WHOP_PAYOUT_PUBLIC_ORIGIN}/${WHOP_PAYOUT_PATH}`;
  const refreshUrl = `${base}${base.includes('?') ? '&' : '?'}whop=refresh`;
  const returnUrl = `${base}${base.includes('?') ? '&' : '?'}whop=return`;
  return { refreshUrl, returnUrl, baseUrl: base };
}
