import { TAP_DASH } from '@/minigames/config/tuning';
import { mulberry32 } from '@/minigames/core/seededRng';

export interface Bird {
  y: number;
  vy: number;
  alive: boolean;
}

export interface Pipe {
  id: number;
  x: number;
  gapY: number;
  passedP1: boolean;
  passedP2: boolean;
}

export interface TapDashState {
  p1: Bird;
  p2: Bird;
  pipes: Pipe[];
  nextPipeId: number;
  spawnAcc: number;
  timeLeftMs: number;
  scoreP1: number;
  scoreP2: number;
  rng: ReturnType<typeof mulberry32>;
  /** Separate stream so AI decisions don't consume obstacle randomness. */
  aiRng: ReturnType<typeof mulberry32>;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function pipeHitsBird(pipe: Pipe, bx: number, by: number, br: number): boolean {
  const { x, gapY, pipeW } = { x: pipe.x, gapY: pipe.gapY, pipeW: TAP_DASH.pipeW };
  const g0 = gapY - TAP_DASH.gapHalf;
  const g1 = gapY + TAP_DASH.gapHalf;
  if (bx + br < x || bx - br > x + pipeW) return false;
  const topH = Math.max(0, g0);
  if (topH > 0 && circleHitsRect(bx, by, br, x, 0, pipeW, topH)) return true;
  const botY = g1;
  const botH = Math.max(0, TAP_DASH.laneH - botY);
  if (botH > 0 && circleHitsRect(bx, by, br, x, botY, pipeW, botH)) return true;
  return false;
}

export function createTapDashState(seed: number): TapDashState {
  const rng = mulberry32(seed);
  const aiRng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const mid = TAP_DASH.laneH * 0.5;
  return {
    p1: { y: mid, vy: 0, alive: true },
    p2: { y: mid, vy: 0, alive: true },
    pipes: [],
    nextPipeId: 1,
    spawnAcc: 900,
    timeLeftMs: TAP_DASH.roundMs,
    scoreP1: 0,
    scoreP2: 0,
    rng,
    aiRng,
  };
}

function spawnPipe(state: TapDashState): void {
  const pad = TAP_DASH.birdR + 14;
  const lo = pad + TAP_DASH.gapHalf;
  const hi = TAP_DASH.laneH - pad - TAP_DASH.gapHalf;
  const gapY = lo + state.rng() * Math.max(1, hi - lo);
  state.pipes.push({
    id: state.nextPipeId++,
    x: TAP_DASH.laneW + 24,
    gapY,
    passedP1: false,
    passedP2: false,
  });
}

function integrateBird(b: Bird, pipes: Pipe[], dt: number, flap: boolean): void {
  if (!b.alive) return;
  if (flap) b.vy += TAP_DASH.flapVy;
  b.vy += TAP_DASH.gravity * dt;
  b.vy = clamp(b.vy, TAP_DASH.vyClamp[0], TAP_DASH.vyClamp[1]);
  b.y += b.vy * dt * 60;
  const r = TAP_DASH.birdR;
  const bx = TAP_DASH.birdX;
  if (b.y < r || b.y > TAP_DASH.laneH - r) b.alive = false;
  if (!b.alive) return;
  for (const p of pipes) {
    if (pipeHitsBird(p, bx, b.y, r)) {
      b.alive = false;
      return;
    }
  }
}

/** AI decides whether to flap this frame (same pipes / seed as human). */
export function tapDashAiFlap(state: TapDashState): boolean {
  const rng = state.aiRng;
  const b = state.p2;
  if (!b.alive) return false;
  const bx = TAP_DASH.birdX;
  let next: Pipe | undefined;
  for (const p of state.pipes) {
    if (p.x + TAP_DASH.pipeW > bx - 4) {
      next = p;
      break;
    }
  }
  const mid = next ? next.gapY : TAP_DASH.laneH * 0.5;
  if (b.y > mid + 10) return rng() < 0.42;
  if (b.y < mid - 14) return rng() < 0.06;
  if (b.vy > 0.35) return rng() < 0.28;
  return rng() < 0.11;
}

export function stepTapDash(
  state: TapDashState,
  dtMs: number,
  inputs: { p1Flap: boolean; p2Flap: boolean },
): void {
  const dt = Math.min(0.05, dtMs / 1000);
  state.timeLeftMs = Math.max(0, state.timeLeftMs - dtMs);
  state.spawnAcc += dtMs;
  const [a, b] = TAP_DASH.spawnEveryMs;
  if (state.spawnAcc >= a + state.rng() * (b - a)) {
    spawnPipe(state);
    state.spawnAcc = 0;
  }

  for (const p of state.pipes) {
    p.x -= TAP_DASH.scrollPerMs * dtMs;
  }
  state.pipes = state.pipes.filter((p) => p.x > -TAP_DASH.pipeW - 8);

  integrateBird(state.p1, state.pipes, dtMs, inputs.p1Flap);
  integrateBird(state.p2, state.pipes, dtMs, inputs.p2Flap);

  const bx = TAP_DASH.birdX;
  for (const p of state.pipes) {
    if (p.x + TAP_DASH.pipeW < bx - TAP_DASH.birdR) {
      if (!p.passedP1 && state.p1.alive) {
        p.passedP1 = true;
        state.scoreP1 += TAP_DASH.scorePerGate;
      }
      if (!p.passedP2 && state.p2.alive) {
        p.passedP2 = true;
        state.scoreP2 += TAP_DASH.scorePerGate;
      }
    }
  }

  const tick = TAP_DASH.scorePerMsAlive * dtMs;
  if (state.p1.alive) state.scoreP1 += tick;
  if (state.p2.alive) state.scoreP2 += tick;
}