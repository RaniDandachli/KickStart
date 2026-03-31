/**
 * Shared tuning for Neon Ball Run — no imports.
 * Subway-style: 3 lanes, tilted ramp decks with air gaps between ramps (jump to clear).
 */
export const BALL_RUN = {
  laneCount: 3,
  laneSpacing: 2.4,

  ballRadius: 0.52,
  /** Ball center Y when standing on flat surface y=0 */
  ballY: 0.52,
  jumpVy: 11.5,
  gravity: 26,
  maxJumpCount: 1,

  laneShiftDuration: 0.085,

  /** Starting and top forward speed (units/s along −Z). Actual speed eases exponentially toward max. */
  baseSpeed: 24,
  maxSpeed: 60,
  /** ~63% of max speed near this many seconds (smaller = hits top speed sooner). */
  speedRampTimeConstantSec: 15,

  /** @deprecated Engine uses exponential ramp; kept for AI / tools reading “ramp rate”. */
  speedRampPerSec: 0.2,

  /** Longer decks = more space between hazard props along the track. */
  rampLength: 11.5,
  rampGap: 2.9,
  rampDropPerSeg: 0.12,

  /** Z window for hazard hits — slightly wider = more forgiving. */
  obstacleHitHalfWidth: 1.26,

  /** Legacy — AI lookahead (~one ramp length). */
  tileDepth: 11.5,
  tileWidth: 2.15,
  tileHeight: 0.28,

  visibleTilesAhead: 12,
  visibleTilesBehind: 4,

  /** Segments between hazards (each spawn = one runway). Lower = more action. */
  obstacleGapStartSegments: 2,
  obstacleGapEndSegments: 1,
  /** Seconds until spacing is mostly at the tighter end value. */
  obstacleRampSec: 28,
  /** Obstacle type mix shifts slightly harder over this many seconds (still fair). */
  obstacleMixRampSec: 85,

  /** @deprecated Replaced by obstacleGap* — kept for any external reads. */
  startGapBetweenObstacles: 2,
  minGapAtMaxSpeed: 1,

  scorePerSec: 10,
  scorePerDodge: 15,
} as const;
