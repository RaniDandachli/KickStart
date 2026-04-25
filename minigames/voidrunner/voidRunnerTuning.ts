/**
 * Void Runner — tuning constants.
 */

export const VOID_RUNNER = {
  laneW: 390,
  laneH: 520,
  numLanes: 3,
  laneCentres: [78, 195, 312] as [number, number, number],
  laneWidth: 104,
  runnerY: 380,
  runnerH: 54,
  runnerW: 22,
  duckHFactor: 0.48,
  duckMs: 600,
  jumpVy: -14.5,
  gravity: 0.72,
  maxFallVy: 16,
  baseScrollPerMs: 0.28,
  speedRampPerTen: 0.012,
  minSpawnMs: 900,
  maxSpawnMs: 1600,
  scorePerObstacle: 1,
  scorePerCoin: 5,
  scorePerSec: 2,
  groundY: 430,
  ceilingY: 40,
  spawnX: 420,
  coinR: 10,
} as const;

export type ObstacleKind =
  | 'barrier'
  | 'lowBeam'
  | 'pitfall'
  | 'tripleBarrier'
  | 'swarm';

export type CoinArcKind = 'line' | 'arc' | 'zigzag';
