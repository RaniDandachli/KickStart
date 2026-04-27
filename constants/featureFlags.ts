import { env } from '@/lib/env';

/**
 * Supabase + API usage. Defaults to **on** (`EXPO_PUBLIC_ENABLE_BACKEND` unset or not `false`).
 * Set `EXPO_PUBLIC_ENABLE_BACKEND=false` only for local UI-only testing (guest mode, no live H2H).
 *
 * Security: balances (`wallet_cents`, `prize_credits`, `redeem_tickets`, `gems`), `role`, Stripe ids, and
 * moderation fields are enforced server-side (`protect_profile_sensitive_columns` + RLS). Redemptions and
 * grants go through RPCs / Edge Functions only — never trust client-side balance changes.
 */
export const ENABLE_BACKEND = env.EXPO_PUBLIC_ENABLE_BACKEND;

/** Derived: guest routing when backend is off. */
export const ALLOW_GUEST_MODE = !ENABLE_BACKEND;

/**
 * Wallet top-up UI — Stripe (publishable key in app; secret in Edge Functions). Never credit `wallet_cents`
 * from the client without a verified server event (Stripe webhook or Whop webhook).
 */
export const WALLET_TOPUP_STRIPE_ENABLED = env.EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED;

/**
 * Whop checkout for wallet top-ups + arcade credit packs (same flows as Stripe; separate Edge + webhook).
 * Off by default — set `EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED=true` when `createWhopCheckoutSession` + Whop webhook are live.
 */
export const WHOP_CHECKOUT_ENABLED = env.EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED;

/** Daily elimination event (no entry fee in-app). */
export const ENABLE_DAILY_FREE_TOURNAMENT = true;

/** Single-elimination credit cups (1000–5000 prize_credits; same flow as daily bracket). */
export const ENABLE_CREDIT_CUPS = true;

/** $10 daily rotating minigame race — 10 scored runs, leaderboard + wallet entry (see `enter_weekly_race`). */
export const ENABLE_WEEKLY_RACE = true;

/**
 * Void Glider (neon ship). When false, the minigame is vaulted: hidden from Arcade rows and H2H game
 * pickers; the route redirects to Play. Match flows + backend stay wired for in-flight games.
 * Set to true to unvault.
 */
export const SHOW_NEON_SHIP_MINIGAME = false;
