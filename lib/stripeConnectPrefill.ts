/**
 * Shown on the payouts screen — matches server prefill in `createStripeConnectLink` Edge Function.
 * Update env on the server (`STRIPE_CONNECT_*`) if you change business category copy.
 */
export const STRIPE_CONNECT_PREFILL_SUMMARY = [
  'Business type: individual (player payouts)',
  'Industry category (MCC): amusement / skill contests (7994)',
  'Product: mobile skill contests and tournament prizes',
  'Your email & display name come from your RunitArcade profile',
  'Country: profile shipping first, then your device region (US vs CA etc.), then server STRIPE_CONNECT_DEFAULT_COUNTRY, else US',
  'If you saved a shipping address, we send city/ZIP/postal code to speed up bank setup',
] as const;
