import { PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';

/**
 * IAP / card checkout (Stripe, App Store) — **tune together** with `prize_catalog.cost_redeem_tickets`
 * and your real COGS (gift cards, merch).
 *
 * ## Example pack (your ask): $10 → 1000 prize credits
 * ⇒ **100 prize credits per $1** gross before fees.
 *
 * ## Not losing money (rules of thumb)
 *
 * 1. **Card fees** — net revenue is below gross. Use `netUsdAfterCardFeesUsd` when modeling.
 *
 * 2. **Prize runs** — If users only ever bought credits at this rate, each run “earns” you about
 *    `impliedGrossUsdPerPrizeRunBeforeFees()` in **gross** dollars (see function). Play‑earned credits
 *    are a **marketing cost** until you monetize elsewhere (ads, sponsors).
 *
 * 3. **Redeem tickets** — `impliedGrossUsdIfTicketsWereAllPurchased()` tells you the **gross** USD
 *    if someone bought every ticket at `REDEEM_TICKETS_PER_USD`. Set catalog ticket prices so that
 *    for **purchased** tickets, that implied USD comfortably exceeds **your cost to fulfill** the prize
 *    (gift card face value, shipping, ops). Play‑earned tickets are **not** covered by that revenue —
 *    treat them as engagement cost or cap earn rates / catalog face values.
 *
 * 4. **Digital prizes** — Fulfill to the **Supabase auth email** (sign-up email). No extra address field
 *    needed unless you add optional “delivery email” later.
 */
export const PRIZE_CREDITS_PER_USD = 100;
/** $10 → 1000 credits when using whole-dollar packs at this rate. */
export const EXAMPLE_USD_PACK = 10;
export const EXAMPLE_PRIZE_CREDITS_FOR_PACK = EXAMPLE_USD_PACK * PRIZE_CREDITS_PER_USD;

/**
 * Redeem tickets sold per $1 USD (gross). Tune so catalog ticket costs × implied $/ticket > your COGS.
 * Example: 10 tickets/$1 ⇒ $10 pack = 100 tickets (pair with catalog pricing).
 */
export const REDEEM_TICKETS_PER_USD = 10;
export const EXAMPLE_REDEEM_TICKETS_FOR_PACK = EXAMPLE_USD_PACK * REDEEM_TICKETS_PER_USD;

/** Rough Stripe-style card fee (replace with your real blended rate). */
export const CARD_FEE_PERCENT = 0.029;
export const CARD_FEE_FIXED_USD = 0.3;

export function netUsdAfterCardFeesUsd(grossUsd: number): number {
  return Math.max(0, grossUsd * (1 - CARD_FEE_PERCENT) - CARD_FEE_FIXED_USD);
}

export function prizeCreditsForUsdPurchase(grossUsd: number): number {
  return Math.floor(grossUsd * PRIZE_CREDITS_PER_USD);
}

export function redeemTicketsForUsdPurchase(grossUsd: number): number {
  return Math.floor(grossUsd * REDEEM_TICKETS_PER_USD);
}

/** Gross USD per prize run if the user paid for credits at PRIZE_CREDITS_PER_USD (before card fees). */
export function impliedGrossUsdPerPrizeRunBeforeFees(): number {
  return PRIZE_RUN_ENTRY_CREDITS / PRIZE_CREDITS_PER_USD;
}

/**
 * If every ticket in the user's balance had been bought at REDEEM_TICKETS_PER_USD, this is the
 * **gross** USD that would have been collected (before fees). Use to sanity-check catalog prices.
 */
export function impliedGrossUsdIfTicketsWereAllPurchased(ticketCount: number): number {
  return ticketCount / REDEEM_TICKETS_PER_USD;
}

export function topUpComingSoonMessage(): string {
  return [
    `Example packs: $${EXAMPLE_USD_PACK} → ${EXAMPLE_PRIZE_CREDITS_FOR_PACK} prize credits (${PRIZE_CREDITS_PER_USD}/$1) · `,
    `${EXAMPLE_REDEEM_TICKETS_FOR_PACK} redeem tickets (${REDEEM_TICKETS_PER_USD}/$1). `,
    `Net to you after ~${(CARD_FEE_PERCENT * 100).toFixed(1)}% + $${CARD_FEE_FIXED_USD} card fees is lower — model with netUsdAfterCardFeesUsd.`,
    ' In-app purchase coming soon.',
  ].join('');
}
