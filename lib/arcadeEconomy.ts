import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { DAILY_FREE_PRIZE_CREDITS, WELCOME_PRIZE_CREDITS } from '@/lib/arcadeGrants';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';

/**
 * Arcade economy: guest uses on-device store; with backend, spend is enforced server-side on score submit / RPCs.
 *
 * - **Arcade Credits (`prize_credits`)**: closed-loop gameplay currency — typically **10–20 credits per prize run** depending on the
 *   game (`PRIZE_RUN_ENTRY_CREDITS` vs Turbo/Stacker). Not withdrawable, not for head-to-head entry unless explicitly enabled later.
 * - **Redeem tickets**: spend in the Prizes catalog to claim physical/digital rewards (not used as run entry).
 *
 * Free credits (guest): `WELCOME_PRIZE_CREDITS` on first install + `DAILY_FREE_PRIZE_CREDITS` once per day — see `applyArcadePrizeCreditGrants`.
 */
export const PRIZE_RUN_ENTRY_CREDITS = 10;
/** Turbo Arena prize runs: harder AI + different ticket rules — see `ticketPayouts` / `TurboArenaScreen`. */
export const TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS = 20;
/** Stacker — jackpot-style prize cabinet; entry matches Turbo tier difficulty pricing. */
export const STACKER_PRIZE_RUN_ENTRY_CREDITS = 20;

export { DAILY_FREE_PRIZE_CREDITS, WELCOME_PRIZE_CREDITS };

/**
 * Deduct entry from guest store when backend is off; when backend is on, checks profile balance (server enforces on submit).
 */
export function consumePrizeRunEntryCredits(
  profilePrizeCredits: number | undefined,
  costCredits: number = PRIZE_RUN_ENTRY_CREDITS,
): boolean {
  if (!ENABLE_BACKEND) {
    return useDemoPrizeCreditsStore.getState().trySpend(costCredits);
  }
  const bal = profilePrizeCredits ?? 0;
  return bal >= costCredits;
}