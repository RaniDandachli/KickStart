// ─── NEON RUNNER — Types ───────────────────────────────────────────────────

export type ObstacleKind =
  | 'void'
  | 'spike'
  | 'ceilingSpike'
  | 'crystal'
  | 'wall'
  | 'ring'
  | 'laser'
  | 'stairUp';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  used?: boolean;
}

export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export interface PlayerSim {
  worldX: number;
  y: number;
  vy: number;
  onGround: boolean;
  angle: number;
  rotV: number;
  dead: boolean;
  trail: TrailPoint[];
}

export interface RunState {
  player: PlayerSim;
  obstacles: Obstacle[];
  scroll: number;
  genCursor: number;
  /** Next index into `PATTERN_SEGMENTS` (deterministic loop). */
  nextPatternIndex: number;
  speed: number;
  elapsed: number;
  /** Counts successful jump impulses (for server score validation). */
  jumpCount: number;
  phase: 'playing' | 'dead' | 'idle';
  seed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}
