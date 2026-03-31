// Pure 2D pool physics + simplified 8-ball style rules (stripes / solids / 8 last).
import { NEON_POOL as P } from './neonPoolConstants';

export type BallKind = 'cue' | 'solid' | 'stripe' | 'eight';

export interface PoolBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onTable: boolean;
  kind: BallKind;
}

export type GamePhase = 'aim' | 'simulate' | 'ballInHand' | 'won' | 'lost';

export interface PoolState {
  balls: PoolBall[];
  phase: GamePhase;
  openTable: boolean;
  playerGroup: 'solids' | 'stripes' | null;
  score: number;
  shots: number;
  fouls: number;
  /** Ids pocketed during current shot (cleared when cue is struck) */
  pocketedThisShot: number[];
  message: string;
}

const inner = () => ({
  minX: P.cushion + P.ballR,
  maxX: P.tableW - P.cushion - P.ballR,
  minY: P.cushion + P.ballR,
  maxY: P.tableH - P.cushion - P.ballR,
});

export function pocketCenters(): { x: number; y: number }[] {
  const m = 6;
  return [
    { x: m, y: m },
    { x: P.tableW / 2, y: m },
    { x: P.tableW - m, y: m },
    { x: P.tableW - m, y: P.tableH - m },
    { x: P.tableW / 2, y: P.tableH - m },
    { x: m, y: P.tableH - m },
  ];
}

function ballKind(n: number): BallKind {
  if (n === 0) return 'cue';
  if (n === 8) return 'eight';
  if (n >= 1 && n <= 7) return 'solid';
  return 'stripe';
}

function rackPositions(): { id: number; x: number; y: number }[] {
  const cx = 720;
  const cy = P.tableH / 2;
  const d = P.ballR * 2.15;
  const rows = [
    [1],
    [2, 3],
    [4, 8, 5],
    [6, 7, 9, 10],
    [11, 12, 13, 14, 15],
  ];
  const out: { id: number; x: number; y: number }[] = [];
  let col = 0;
  for (const ids of rows) {
    const n = ids.length;
    const startY = cy - ((n - 1) * d) / 2;
    for (let i = 0; i < n; i++) {
      const id = ids[i]!;
      out.push({ id, x: cx + col * d * 0.866, y: startY + i * d });
    }
    col++;
  }
  return out;
}

export function createPoolState(): PoolState {
  const balls: PoolBall[] = [
    {
      id: 0,
      x: 240,
      y: P.tableH / 2,
      vx: 0,
      vy: 0,
      onTable: true,
      kind: 'cue',
    },
  ];
  for (const p of rackPositions()) {
    balls.push({
      id: p.id,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      onTable: true,
      kind: ballKind(p.id),
    });
  }
  return {
    balls,
    phase: 'aim',
    openTable: true,
    playerGroup: null,
    score: 0,
    shots: 0,
    fouls: 0,
    pocketedThisShot: [],
    message: 'Aim, pull back behind the cue for power, release to shoot',
  };
}

export function beginShot(state: PoolState): void {
  state.pocketedThisShot = [];
}

function anyMoving(balls: PoolBall[]): boolean {
  for (const b of balls) {
    if (!b.onTable) continue;
    if (b.vx * b.vx + b.vy * b.vy > 0.035) return true;
  }
  return false;
}

function clampWalls(b: PoolBall): void {
  const { minX, maxX, minY, maxY } = inner();
  if (b.x < minX) {
    b.x = minX;
    b.vx *= -P.railRestitution;
  }
  if (b.x > maxX) {
    b.x = maxX;
    b.vx *= -P.railRestitution;
  }
  if (b.y < minY) {
    b.y = minY;
    b.vy *= -P.railRestitution;
  }
  if (b.y > maxY) {
    b.y = maxY;
    b.vy *= -P.railRestitution;
  }
}

function resolveBallBall(a: PoolBall, b: PoolBall): void {
  if (!a.onTable || !b.onTable) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const minD = P.ballR * 2;
  if (dist >= minD - 0.1) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minD - dist + 0.05;
  const sep = overlap * 0.5;
  a.x -= nx * sep;
  a.y -= ny * sep;
  b.x += nx * sep;
  b.y += ny * sep;
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlong = rvx * nx + rvy * ny;
  if (velAlong > 0) return;
  const j = -((1 + P.ballRestitution) * velAlong) / 2;
  const jx = j * nx;
  const jy = j * ny;
  a.vx -= jx;
  a.vy -= jy;
  b.vx += jx;
  b.vy += jy;
}

function tryPocket(b: PoolBall, pockets: { x: number; y: number }[], state: PoolState): void {
  if (!b.onTable) return;
  for (const p of pockets) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < P.pocketGrabR) {
      b.onTable = false;
      b.vx = 0;
      b.vy = 0;
      if (b.id !== 0) state.pocketedThisShot.push(b.id);
      return;
    }
  }
}

function integrate(b: PoolBall, dt: number): void {
  if (!b.onTable) return;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vx *= P.friction;
  b.vy *= P.friction;
}

export function stepPoolPhysics(state: PoolState, dtMs: number): void {
  if (state.phase !== 'simulate') return;
  const dt = (dtMs / 1000) / P.substeps;
  const pockets = pocketCenters();
  for (let s = 0; s < P.substeps; s++) {
    for (const b of state.balls) integrate(b, dt);
    for (const b of state.balls) {
      if (b.onTable) clampWalls(b);
    }
    const list = state.balls.filter((b) => b.onTable);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        resolveBallBall(list[i]!, list[j]!);
      }
    }
    for (const b of state.balls) tryPocket(b, pockets, state);
  }

  if (state.phase === 'simulate' && !anyMoving(state.balls)) {
    settleTurn(state);
  }
}

function objectBallsRemaining(state: PoolState): number {
  let n = 0;
  for (const b of state.balls) {
    if (b.id === 0 || b.id === 8) continue;
    if (b.onTable) n++;
  }
  return n;
}

function settleTurn(state: PoolState): void {
  const cue = state.balls.find((b) => b.id === 0)!;

  // Cue pocketed = scratch
  if (!cue.onTable) {
    state.fouls++;
    state.score = Math.max(0, state.score - 50);
    cue.onTable = true;
    cue.x = 120;
    cue.y = P.tableH / 2;
    cue.vx = 0;
    cue.vy = 0;
    state.phase = 'ballInHand';
    state.message = 'Scratch — tap to place the cue in the kitchen (left zone), then shoot';
    state.pocketedThisShot = [];
    return;
  }

  const pocketed = state.pocketedThisShot;

  // 8-ball early
  if (pocketed.includes(8)) {
    const othersLeft = objectBallsRemaining(state);
    if (othersLeft > 0) {
      state.phase = 'lost';
      state.message = 'The 8-ball went in early — you lose';
      return;
    }
    state.phase = 'won';
    state.score += 2500;
    state.message = 'You cleared the table!';
    return;
  }

  // Assign groups from first pocket after break
  if (state.openTable && pocketed.length > 0) {
    const first = pocketed.find((id) => id !== 8);
    if (first != null) {
      const k = ballKind(first);
      if (k === 'solid') state.playerGroup = 'solids';
      else if (k === 'stripe') state.playerGroup = 'stripes';
      state.openTable = false;
    }
  }

  for (const id of pocketed) {
    if (id === 8) continue;
    state.score += 120;
  }

  state.pocketedThisShot = [];

  if (state.phase !== 'won' && state.phase !== 'lost') {
    state.phase = 'aim';
    state.message = pocketed.length > 0 ? 'Nice — shoot again' : 'Aim and shoot';
  }
}

/** Apply impulse to cue ball and enter simulate phase. */
export function shootCue(state: PoolState, nx: number, ny: number, power: number): void {
  const cue = state.balls.find((b) => b.id === 0);
  if (!cue || !cue.onTable || state.phase === 'won' || state.phase === 'lost') return;
  const len = Math.hypot(nx, ny) || 1;
  const ux = nx / len;
  const uy = ny / len;
  const p = Math.min(P.maxShotPower, Math.max(2, power));
  cue.vx = ux * p;
  cue.vy = uy * p;
  state.shots++;
  beginShot(state);
  state.phase = 'simulate';
}

/** Place cue in kitchen during ball-in-hand */
export function placeCueBall(state: PoolState, x: number, y: number): boolean {
  const cue = state.balls.find((b) => b.id === 0);
  if (!cue) return false;
  const { minX, maxX, minY, maxY } = inner();
  const nx = Math.max(minX, Math.min(maxX, x));
  const ny = Math.max(minY, Math.min(maxY, y));
  if (nx > P.headStringX) return false;
  for (const b of state.balls) {
    if (b.id === 0 || !b.onTable) continue;
    if (Math.hypot(nx - b.x, ny - b.y) < P.ballR * 2.2) return false;
  }
  cue.x = nx;
  cue.y = ny;
  cue.vx = 0;
  cue.vy = 0;
  cue.onTable = true;
  state.phase = 'aim';
  state.message = 'Aim and shoot';
  return true;
}
