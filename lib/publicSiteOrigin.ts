import { env } from '@/lib/env';

/**
 * Public HTTPS origin for hosted checkout redirects and universal links.
 * Set `EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL` in `.env` (legacy env name — same value Whop checkout uses).
 */
export const PUBLIC_SITE_ORIGIN = (
  env.EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL?.trim() || 'https://runitarcade.app'
).replace(/\/$/, '');
