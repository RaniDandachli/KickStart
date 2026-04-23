import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useDemoRedeemTicketsStore } from '@/store/demoRedeemTicketsStore';

/** Tap Dash run points — 1 point → 1 redeem ticket (tuned with prize catalog earn targets). */
export const TAP_DASH_POINTS_PER_TICKET = 1;
/** Tile Clash score (with streak multipliers) — 50 → 1 ticket. */
export const TILE_CLASH_POINTS_PER_TICKET = 50;
/**
 * Dash Duel uses the same “pts” as the HUD / results (`scoreForPlayer`).
 * Points scale higher than Tap Dash gates, so a larger divisor keeps payouts in line.
 */
export const DASH_DUEL_POINTS_PER_TICKET = 120;
/** Neon Ball Run — distance score; 25 → 1 ticket (between Tap Dash and Tile Clash pace). */
export const BALL_RUN_POINTS_PER_TICKET = 25;
/** Neon Pocket (pool) — table score; 200 → 1 ticket. */
export const NEON_POOL_POINTS_PER_TICKET = 200;
/** Neon Dance — successful color gates; 8 → 1 ticket. */
export const NEON_DANCE_POINTS_PER_TICKET = 8;
/** Neon Grid — rows cleared; tuned between Tap Dash and Ball Run pace. */
export const NEON_GRID_POINTS_PER_TICKET = 18;
/** Stacker — redeem tickets only on full jackpot stack (see `ticketsFromStackerPrizeRun`). */
export const STACKER_JACKPOT_TICKETS = 10_000;

/** Turbo Arena (prize run vs AI, HARD) — each goal you score + 2 bonus if you win the match. */
export const TURBO_ARENA_TICKETS_PER_GOAL = 1;
export const TURBO_ARENA_WIN_BONUS_TICKETS = 2;

export function ticketsFromTurboArenaPrizeRun(playerGoals: number, cpuGoals: number): number {
  const g = Math.max(0, Math.floor(playerGoals));
  const win = playerGoals > cpuGoals ? TURBO_ARENA_WIN_BONUS_TICKETS : 0;
  return g * TURBO_ARENA_TICKETS_PER_GOAL + win;
}

/** For Arcade “how to earn tickets” UI — single source of truth with game names. */
export const ARCADE_TICKET_SCORE_RULES: readonly {
  game: string;
  /** What the score represents in-game */
  scoreLabel: string;
  pointsPerTicket: number;
}[] = [
  { game: 'Tap Dash', scoreLabel: 'Run points', pointsPerTicket: TAP_DASH_POINTS_PER_TICKET },
  { game: 'Tile Clash', scoreLabel: 'Round score', pointsPerTicket: TILE_CLASH_POINTS_PER_TICKET },
  { game: 'Dash Duel', scoreLabel: 'Displayed points', pointsPerTicket: DASH_DUEL_POINTS_PER_TICKET },
  { game: 'Neon Ball Run', scoreLabel: 'Distance score', pointsPerTicket: BALL_RUN_POINTS_PER_TICKET },
  { game: 'Neon Dance', scoreLabel: 'Clean passes', pointsPerTicket: NEON_DANCE_POINTS_PER_TICKET },
  { game: 'Neon Grid', scoreLabel: 'Rows cleared', pointsPerTicket: NEON_GRID_POINTS_PER_TICKET },
];

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

export function ticketsFromNeonPoolScore(score: number): number {
  return Math.max(0, Math.floor(score / NEON_POOL_POINTS_PER_TICKET));
}

export function ticketsFromNeonDanceScore(score: number): number {
  return Math.max(0, Math.floor(score / NEON_DANCE_POINTS_PER_TICKET));
}

export function ticketsFromNeonGridScore(score: number): number {
  return Math.max(0, Math.floor(score / NEON_GRID_POINTS_PER_TICKET));
}

/** Prize run: tickets only if the player clears every row to the top (jackpot). */
export function ticketsFromStackerPrizeRun(fullWin: boolean): number {
  return fullWin ? STACKER_JACKPOT_TICKETS : 0;
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
