/**
 * Master switch for Supabase + API usage. Set to `false` to explore the app UI without backend setup.
 * When false, you enter as a guest (no auth screen); data hooks stay idle so nothing calls the network.
 */
export const ENABLE_BACKEND = false;

/** Derived: guest routing when backend is off. */
export const ALLOW_GUEST_MODE = !ENABLE_BACKEND;

/**
 * When `ENABLE_BACKEND` is true, set this after you implement Stripe Checkout + server-side wallet credit.
 * Never credit `wallet_cents` from the client without a verified Stripe event.
 */
export const WALLET_TOPUP_STRIPE_ENABLED = false;
