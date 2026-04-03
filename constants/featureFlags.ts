import { env } from '@/lib/env';

/**
 * Supabase + API usage. Prefer `EXPO_PUBLIC_ENABLE_BACKEND=true` in `.env` for real backend; defaults to false.
 * When false, guest/demo mode (no required auth); local stores handle arcade credits.
 *
 * Security: balances (`wallet_cents`, `prize_credits`, `redeem_tickets`, `gems`), `role`, Stripe ids, and
 * moderation fields are enforced server-side (`protect_profile_sensitive_columns` + RLS). Redemptions and
 * grants go through RPCs / Edge Functions only — never trust client-side balance changes.
 */
export const ENABLE_BACKEND = env.EXPO_PUBLIC_ENABLE_BACKEND;

/** Derived: guest routing when backend is off. */
export const ALLOW_GUEST_MODE = !ENABLE_BACKEND;

/**
 * Wallet top-up UI (Stripe test/live publishable key in app; secret only in Edge Functions / Dashboard).
 * Never credit `wallet_cents` from the client without a verified Stripe server event.
 */
export const WALLET_TOPUP_STRIPE_ENABLED = env.EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED;

/** Daily elimination event (no entry fee in-app). */
export const ENABLE_DAILY_FREE_TOURNAMENT = true;

/** Single-elimination credit cups (1000–5000 prize_credits; same flow as daily bracket). */
export const ENABLE_CREDIT_CUPS = true;
