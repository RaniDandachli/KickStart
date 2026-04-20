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
  /** True on the frame the player just landed — cleared after one step. */
  justLanded: boolean;
  /** Current tier (0–8), updated each step. */
  tier: number;
}

export interface RunState {
  player: PlayerSim;
  obstacles: Obstacle[];
  scroll: number;
  genCursor: number;
  nextPatternIndex: number;
  speed: number;
  elapsed: number;
  jumpCount: number;
  phase: 'playing' | 'dead' | 'idle';
  seed: number;
  /** Current difficulty tier (0–8), drives theme + speed. */
  tier: number;
  /** Set to true the frame a zone transition happens — for flash effect. */
  zoneChanged: boolean;
  lastTier: number;
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