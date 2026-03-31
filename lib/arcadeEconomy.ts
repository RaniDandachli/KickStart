import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { DAILY_FREE_PRIZE_CREDITS, WELCOME_PRIZE_CREDITS } from '@/lib/arcadeGrants';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';

/**
 * Arcade economy (client + demo). Server should mirror for real billing.
 *
 * - **Prize credits**: spend to enter prize-mode runs vs AI; earn more from high scores / wins.
 * - **Redeem tickets**: spend in the Prizes catalog to claim physical/digital rewards (not used as run entry).
 *
 * Free credits (guest): `WELCOME_PRIZE_CREDITS` on first install + `DAILY_FREE_PRIZE_CREDITS` once per day — see `applyArcadePrizeCreditGrants`.
 */
export const PRIZE_RUN_ENTRY_CREDITS = 10;
/** Turbo Arena prize runs: harder AI + different ticket rules — see `ticketPayouts` / `TurboArenaScreen`. */
export const TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS = 20;

export { DAILY_FREE_PRIZE_CREDITS, WELCOME_PRIZE_CREDITS };

/**
 * Deduct entry from demo store when backend is off; when backend is on, checks profile balance (server deduct TODO).
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