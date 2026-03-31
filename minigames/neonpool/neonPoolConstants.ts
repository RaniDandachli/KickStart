/** Logical table space — top-down pool (generic 8-ball style rules, not a trademarked name). */
export const NEON_POOL = {
  tableW: 960,
  tableH: 480,
  cushion: 36,
  ballR: 8,
  /** Capture radius for pocketing */
  pocketGrabR: 26,
  friction: 0.988,
  ballRestitution: 0.92,
  railRestitution: 0.82,
  /** Simulation substeps per frame */
  substeps: 8,
  maxShotPower: 28,
  /** table units → shot power from pull-back distance */
  pullPowerScale: 0.11,
  /** Fallback when player only flicks forward (no pull) */
  forwardPowerScale: 0.065,
  minShotPower: 2.2,
  /** Cue placement after scratch — behind this x (kitchen) */
  headStringX: 200,
} as const;
