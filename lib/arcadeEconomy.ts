import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';

/**
 * Arcade economy (client + demo). Server should mirror for real billing.
 *
 * - **Prize credits**: spend to enter prize-mode runs vs AI; earn more from high scores / wins.
 * - **Redeem tickets**: spend in the Prizes catalog to claim physical/digital rewards (not used as run entry).
 */
export const PRIZE_RUN_ENTRY_CREDITS = 10;

/**
 * Deduct entry from demo store when backend is off; when backend is on, checks profile balance (server deduct TODO).
 */
export function consumePrizeRunEntryCredits(profilePrizeCredits: number | undefined): boolean {
  if (!ENABLE_BACKEND) {
    return useDemoPrizeCreditsStore.getState().trySpend(PRIZE_RUN_ENTRY_CREDITS);
  }
  const bal = profilePrizeCredits ?? 0;
  return bal >= PRIZE_RUN_ENTRY_CREDITS;
}