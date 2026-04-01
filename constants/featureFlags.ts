import { env } from '@/lib/env';

/**
 * Supabase + API usage. Prefer `EXPO_PUBLIC_ENABLE_BACKEND=true` in `.env` for real backend; defaults to false.
 * When false, guest/demo mode (no required auth); local stores handle arcade credits.
 */
export const ENABLE_BACKEND = env.EXPO_PUBLIC_ENABLE_BACKEND;

/** Derived: guest routing when backend is off. */
export const ALLOW_GUEST_MODE = !ENABLE_BACKEND;

/**
 * Wallet top-up UI (Stripe test/live publishable key in app; secret only in Edge Functions / Dashboard).
 * Never credit `wallet_cents` from the client without a verified Stripe server event.
 */
export const WALLET_TOPUP_STRIPE_ENABLED = env.EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED;

/** Promotional daily free bracket (client-only; no paid entry). */
export const ENABLE_DAILY_FREE_TOURNAMENT = true;
