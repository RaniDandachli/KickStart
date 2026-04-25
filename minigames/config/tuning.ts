/** Shared tuning for arcade mini-games — abstract units, dt in ms where noted. */

/**
 * Human vs human (competitive) — product rules for all minigames:
 * - **Order:** Randomize who goes first (which player attempts / sees the run first when turns are sequential, or lobby order for async runs).
 * - **Outcome:** Higher score wins. Tiebreak details are per minigame (e.g. distance, time) where scores are equal.
 *
 * Practice vs AI may differ; this applies when both sides are real players.
 */
export const PVP_MATCH_RULES = {
  randomizeFirstPlayer: true,
  winnerByHigherScore: true,
} as const;

export const MINI = {
  countdownStyle: '3-2-1-go' as const,
  /** Default competitive round length (ms). */
  defaultRoundMs: 26_000,
};

export const TAP_DASH = {
  laneW: 100,
  laneH: 168,
  birdR: 5.2,
  birdX: 32,
  /** Velocity delta per ms (arcade units). */
  gravity: 0.00024,
  flapVy: -0.28,
  vyClamp: [-0.52, 0.52],
  pipeW: 17,
  gapHalf: 25,
  scrollPerMs: 0.048,
  spawnEveryMs: [1380, 2100],
  /** Passive points per ms alive. */
  scorePerMsAlive: 0.012,
  /** Bonus when clearing a gate. */
  scorePerGate: 48,
  roundMs: 30_000,
};

export const TILE_CLASH = {
  cols: 4,
  laneH: 176,
  /** Narrower band (~32 logical px vs ~66) — same vertical center as before. */
  hitZoneTop: 137,
  hitZoneBottom: 169,
  tileH: 22,
  goodChance: 0.58,
  spawnEveryMs: 520,
  scrollBasePerMs: 0.052,
  scrollAccelPerMs2: 0.0000042,
  goodTap: 14,
  badTapPenalty: 9,
  missPenalty: 11,
  timingBonusMax: 8,
  roundMs: 26_000,
};

/** Dash Duel — Neon runner physics in `minigames/dashduel/constants.ts` (`NR`, `GROUND_Y`). */
export const DASH_DUEL = {
  /** Legacy UI hint; engine uses `NR.ROUND_MS` (0 = endless). */
  roundMs: 0,
};
