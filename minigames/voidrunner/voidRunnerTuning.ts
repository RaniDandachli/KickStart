/**
 * VoidRunner – tuning constants.
 * Mirror of the TAP_DASH config pattern used across the arcade app.
 */

export const VOID_RUNNER = {
    // ─── World ─────────────────────────────────────────────────────────────
    /** Logical lane width (px). Renderer scales to fit device. */
    laneW: 390,
    /** Logical lane height (px). */
    laneH: 520,
  
    // ─── Lanes ─────────────────────────────────────────────────────────────
    /** Number of horizontal lanes the runner occupies. */
    numLanes: 3,
    /** X centre of each lane (logical px). */
    laneCentres: [78, 195, 312] as [number, number, number],
    /** Full lane width for collision */
    laneWidth: 104,
  
    // ─── Runner ─────────────────────────────────────────────────────────────
    /** Runner logical Y (base position — feet on ground line). */
    runnerY: 380,
    /** Runner bounding-box half-height when standing. */
    runnerH: 54,
    /** Runner bounding-box half-width. */
    runnerW: 22,
    /** Duck reduces hitbox height to this fraction. */
    duckHFactor: 0.48,
    /** Duration of duck state (ms). */
    duckMs: 600,
  
    // ─── Jump ───────────────────────────────────────────────────────────────
    /** Initial jump velocity (negative = up). */
    jumpVy: -14.5,
    /** Gravity (px/frame²  at 60fps). */
    gravity: 0.72,
    /** Maximum fall velocity. */
    maxFallVy: 16,
  
    // ─── Obstacles ──────────────────────────────────────────────────────────
    /** Obstacle scroll speed base (px/ms). Increases with score. */
    baseScrollPerMs: 0.28,
    /** Speed ramp — added every 10 score points. */
    speedRampPerTen: 0.012,
    /** Minimum gap between obstacle spawn (ms). */
    minSpawnMs: 900,
    /** Maximum gap between obstacle spawn (ms). */
    maxSpawnMs: 1600,
  
    // ─── Scoring ─────────────────────────────────────────────────────────────
    /** Points awarded per obstacle cleared. */
    scorePerObstacle: 1,
    /** Bonus points for coin pickup. */
    scorePerCoin: 5,
    /** Alive-time bonus (points per second). */
    scorePerSec: 2,
  
    // ─── Environment ─────────────────────────────────────────────────────────
    /** Ground Y (logical px) — runner stands here. */
    groundY: 430,
    /** Sky ceiling Y (logical px). */
    ceilingY: 40,
  
    // ─── Obstacle z-spawn offset ─────────────────────────────────────────────
    spawnX: 420,
  
    // ─── Coin strip ─────────────────────────────────────────────────────────
    coinR: 10,
  } as const;
  
  /** Obstacle types */
  export type ObstacleKind =
    | 'barrier'      // tall wall — must jump over
    | 'lowBeam'      // horizontal laser — must duck under
    | 'pitfall'      // gap in the floor — must jump over
    | 'tripleBarrier'// three-lane spanning wall, one lane open
    | 'swarm';       // swarm of debris — dodge left/right
  
  /** Coin arc types */
  export type CoinArcKind = 'line' | 'arc' | 'zigzag';
