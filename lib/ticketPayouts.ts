import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useDemoRedeemTicketsStore } from '@/store/demoRedeemTicketsStore';

/** Gates cleared in Tap Dash — 10 points → 1 redeem ticket. */
export const TAP_DASH_POINTS_PER_TICKET = 10;
/** Tile Clash score (with streak multipliers) — 50 → 1 ticket. */
export const TILE_CLASH_POINTS_PER_TICKET = 50;
/**
 * Dash Duel uses the same “pts” as the HUD / results (`scoreForPlayer`).
 * Points scale higher than Tap Dash gates, so a larger divisor keeps payouts in line.
 */
export const DASH_DUEL_POINTS_PER_TICKET = 120;
/** Neon Ball Run — distance score; 25 → 1 ticket (between Tap Dash and Tile Clash pace). */
export const BALL_RUN_POINTS_PER_TICKET = 25;

export function ticketsFromTapDashScore(score: number): number {
  return Math.max(0, Math.floor(score / TAP_DASH_POINTS_PER_TICKET));
}

export function ticketsFromTileClashScore(score: number): number {
  return Math.max(0, Math.floor(score / TILE_CLASH_POINTS_PER_TICKET));
}

export function ticketsFromDashDuelDisplayedScore(displayedPts: number): number {
  return Math.max(0, Math.floor(displayedPts / DASH_DUEL_POINTS_PER_TICKET));
}

export function ticketsFromBallRunScore(score: number): number {
  return Math.max(0, Math.floor(score / BALL_RUN_POINTS_PER_TICKET));
}

/**
 * Credits demo `redeem_tickets` when backend is off.
 * When `ENABLE_BACKEND`, wire an RPC / edge function to grant `profiles.redeem_tickets`.
 */
export function awardRedeemTicketsForPrizeRun(tickets: number): void {
  const n = Math.max(0, Math.floor(tickets));
  if (n <= 0) return;
  if (!ENABLE_BACKEND) {
    useDemoRedeemTicketsStore.getState().add(n);
  }
}
