// ─────────────────────────────────────────────────────────────
//  NeonBallRunEngine — subway-style ramp run: ball rolls on tilted
//  decks, air gaps between ramps (jump), 3 lanes, obstacles on deck.
//  World: Z forward = −Z, X = lanes, Y = up.
// ─────────────────────────────────────────────────────────────

import { BALL_RUN } from './ballRunConstants';

export { BALL_RUN };

export type ObstacleKind = 'gap' | 'spike' | 'wall' | 'moving' | 'barricade';

export interface ObstacleData {
  blockedLanes: number[];
  movingLane: number;
  movingDir: 1 | -1;
  movingSpeed: number;
}

/** One tilted ramp deck; zStart > zEnd (back toward +Z, front toward −Z). */
export interface RampSegment {
  id: number;
  zStart: number;
  zEnd: number;
  yStart: number;
  yEnd: number;
  laneSolid: boolean[];
  obstacle: ObstacleKind | null;
  obstacleData: ObstacleData | null;
  /** World Z where props sit — near the front of the deck (before the gap). Null if no obstacle or gap-only (lane holes span whole segment). */
  obstacleAnchorZ: number | null;
  /** Second hazard on the same deck (dense mode). */
  obstacle2: ObstacleKind | null;
  obstacleData2: ObstacleData | null;
  obstacleAnchorZ2: number | null;
  passed: boolean;
}

/** @deprecated Use RampSegment — kept for older imports */
export type TileRow = RampSegment;

/** Union of hole lanes from one or two gap hazards on the same deck. */
export function mergedGapBlockedLanes(seg: RampSegment): number[] {
  const set = new Set<number>();
  if (seg.obstacle === 'gap' && seg.obstacleData) for (const l of seg.obstacleData.blockedLanes) set.add(l);
  if (seg.obstacle2 === 'gap' && seg.obstacleData2) for (const l of seg.obstacleData2.blockedLanes) set.add(l);
  return Array.from(set).sort((a, b) => a - b);
}

export interface NeonParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  decay: number;
  size: number;
  color: string;
}

export interface NeonBallRunState {
  lane: number;
  targetLane: number;
  laneShiftT: number;
  ballY: number;
  ballVy: number;
  onGround: boolean;
  jumpCount: number;
  ballSpin: number;
  ballZ: number;

  elapsedSec: number;
  speed: number;

  segments: RampSegment[];
  nextSegmentId: number;
  nextSpawnZStart: number;
  nextRampYEnd: number;
  spawnIndex: number;
  rowsSinceObstacle: number;
  nextObstacleIn: number;

  score: number;
  dodgeCount: number;

  alive: boolean;
  deathReason: string;

  particles: NeonParticle[];
  pendingShift: -1 | 0 | 1;
  pendingJump: boolean;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

export function laneX(lane: number): number {
  const half = (BALL_RUN.laneCount - 1) / 2;
  return (lane - half) * BALL_RUN.laneSpacing;
}

export function laneFromX(x: number): number {
  const half = (BALL_RUN.laneCount - 1) / 2;
  return x / BALL_RUN.laneSpacing + half;
}

export function getBallX(state: NeonBallRunState): number {
  if (state.laneShiftT >= 1) return laneX(state.lane);
  return laneX(state.lane) + (laneX(state.targetLane) - laneX(state.lane)) * easeOutCubic(state.laneShiftT);
}

export function surfaceY(seg: RampSegment, ballZ: number): number {
  const dz = seg.zStart - seg.zEnd;
  if (dz <= 1e-6) return seg.yStart;
  const t = (seg.zStart - ballZ) / dz;
  return seg.yStart + t * (seg.yEnd - seg.yStart);
}

function findSegment(state: NeonBallRunState, ballZ: number): RampSegment | null {
  for (const s of state.segments) {
    if (ballZ <= s.zStart && ballZ >= s.zEnd) return s;
  }
  return null;
}

function makeObstacleData(kind: ObstacleKind, elapsedSec: number): ObstacleData {
  const n = BALL_RUN.laneCount;
  if (kind === 'gap') {
    const w = Math.random() < 0.5 ? 1 : 2;
    const s = Math.floor(Math.random() * Math.max(1, n - w));
    return { blockedLanes: Array.from({ length: w }, (_, i) => s + i), movingLane: 0, movingDir: 1, movingSpeed: 0 };
  }
  if (kind === 'spike') {
    const count = Math.random() < 0.34 ? 2 : 1;
    const set = new Set<number>();
    while (set.size < count) set.add(Math.floor(Math.random() * n));
    return { blockedLanes: [...set], movingLane: 0, movingDir: 1, movingSpeed: 0 };
  }
  if (kind === 'wall') {
    const gap = Math.random() < 0.5 ? 0 : n - 1;
    const blocked = Array.from({ length: n }, (_, i) => i).filter(i => i !== gap && i !== (gap === 0 ? 1 : n - 2));
    return { blockedLanes: blocked, movingLane: 0, movingDir: 1, movingSpeed: 0 };
  }
  if (kind === 'barricade') {
    const mid = Math.floor(n / 2);
    return { blockedLanes: [mid - 1, mid, mid + 1].filter(i => i >= 0 && i < n), movingLane: 0, movingDir: 1, movingSpeed: 0 };
  }
  const sl = Math.random() < 0.5 ? 0 : n - 1;
  return { blockedLanes: [sl], movingLane: sl, movingDir: sl === 0 ? 1 : -1, movingSpeed: 2.5 + Math.random() * 3.2 };
}

/** Calmer mix — fewer moving trains on screen; gaps a touch more common. */
function pickKindHard(_elapsed: number): ObstacleKind {
  const r = Math.random();
  if (r < 0.24) return 'spike';
  if (r < 0.46) return 'moving';
  if (r < 0.68) return 'wall';
  if (r < 0.82) return 'barricade';
  return 'gap';
}

function spawnRampSegment(state: NeonBallRunState, forceClear: boolean): void {
  const zStart = state.nextSpawnZStart;
  const zEnd = zStart - BALL_RUN.rampLength;
  const len = zStart - zEnd;
  const yStart = state.nextRampYEnd;
  const yEnd = yStart - BALL_RUN.rampDropPerSeg;

  let obstacle: ObstacleKind | null = null;
  let obstacleData: ObstacleData | null = null;
  let obstacle2: ObstacleKind | null = null;
  let obstacleData2: ObstacleData | null = null;
  let obstacleAnchorZ: number | null = null;
  let obstacleAnchorZ2: number | null = null;

  if (!forceClear) {
    const breezy = Math.random() < 0.4;
    if (breezy) {
      state.rowsSinceObstacle = 0;
    } else {
      obstacle = pickKindHard(state.elapsedSec);
      obstacleData = makeObstacleData(obstacle, state.elapsedSec);
      state.rowsSinceObstacle = 0;
      const doubleHazard = Math.random() < 0.12;
      if (doubleHazard) {
        obstacle2 = pickKindHard(state.elapsedSec);
        obstacleData2 = makeObstacleData(obstacle2, state.elapsedSec);
        obstacleAnchorZ = obstacle !== 'gap' ? zStart - 0.38 * len : null;
        obstacleAnchorZ2 = obstacle2 !== 'gap' ? zStart - 0.72 * len : null;
      } else {
        obstacleAnchorZ = obstacle !== 'gap' ? zStart - 0.72 * len : null;
      }
    }
  }

  const laneSolid = Array.from({ length: BALL_RUN.laneCount }, (_, i) => {
    let ok = true;
    if (obstacle === 'gap' && obstacleData?.blockedLanes.includes(i)) ok = false;
    if (obstacle2 === 'gap' && obstacleData2?.blockedLanes.includes(i)) ok = false;
    return ok;
  });

  const seg: RampSegment = {
    id: state.nextSegmentId++,
    zStart,
    zEnd,
    yStart,
    yEnd,
    laneSolid,
    obstacle,
    obstacleData,
    obstacleAnchorZ,
    obstacle2,
    obstacleData2,
    obstacleAnchorZ2,
    passed: false,
  };
  state.segments.push(seg);

  state.nextSpawnZStart = zEnd - BALL_RUN.rampGap;
  state.nextRampYEnd = yEnd;
  state.spawnIndex++;
}

function burst(state: NeonBallRunState, x: number, y: number, z: number, color: string, count: number, speed: number): void {
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const spd = (Math.random() * 0.5 + 0.5) * speed;
    state.particles.push({
      x, y, z,
      vx: Math.sin(phi) * Math.cos(theta) * spd,
      vy: Math.abs(Math.sin(phi) * Math.sin(theta) * spd) + 1,
      vz: Math.cos(phi) * spd * 0.3,
      life: 1, decay: 0.03 + Math.random() * 0.04,
      size: Math.random() * 0.18 + 0.06, color,
    });
  }
}

function killBall(state: NeonBallRunState, reason: string): void {
  state.alive = false;
  state.deathReason = reason;
  const bx = getBallX(state);
  burst(state, bx, state.ballY, state.ballZ, '#ff00cc', 20, 6);
  burst(state, bx, state.ballY, state.ballZ, '#ffff00', 12, 4);
  burst(state, bx, state.ballY, state.ballZ, '#ffffff', 8, 5);
}

function tickMovingBlock(d: ObstacleData, dtSec: number): void {
  d.movingLane += d.movingDir * d.movingSpeed * dtSec;
  if (d.movingLane >= BALL_RUN.laneCount - 1) { d.movingLane = BALL_RUN.laneCount - 1; d.movingDir = -1; }
  if (d.movingLane <= 0) { d.movingLane = 0; d.movingDir = 1; }
  d.blockedLanes = [Math.round(d.movingLane)];
}

function checkCollisions(state: NeonBallRunState): void {
  const ballLane = clamp(Math.round(laneFromX(getBallX(state))), 0, BALL_RUN.laneCount - 1);
  const br = BALL_RUN.ballRadius;

  for (const seg of state.segments) {
    const near = seg.zStart;
    const far = seg.zEnd;
    if (state.ballZ + br < far || state.ballZ - br > near) continue;

    if (!seg.laneSolid[ballLane]) { killBall(state, 'Fell through the gap!'); return; }

    const tryHit = (kind: ObstacleKind | null, d: ObstacleData | null, obsZ: number | null): boolean => {
      if (!kind || !d || kind === 'gap') return false;
      if (obsZ != null && Math.abs(state.ballZ - obsZ) > BALL_RUN.obstacleHitHalfWidth) return false;
      const surfY = surfaceY(seg, obsZ ?? state.ballZ);
      const onDeck = state.onGround && state.ballY <= surfY + br * 1.45;
      if (kind === 'spike' && d.blockedLanes.includes(ballLane) && onDeck) { killBall(state, 'Hit a spike!'); return true; }
      if ((kind === 'wall' || kind === 'barricade') && d.blockedLanes.includes(ballLane) && onDeck) { killBall(state, 'Crashed into a wall!'); return true; }
      if (kind === 'moving' && Math.round(d.movingLane) === ballLane && onDeck) { killBall(state, 'Got crushed!'); return true; }
      return false;
    };
    if (tryHit(seg.obstacle, seg.obstacleData, seg.obstacleAnchorZ)) return;
    if (tryHit(seg.obstacle2, seg.obstacleData2, seg.obstacleAnchorZ2)) return;
  }
}

function checkDodges(state: NeonBallRunState): void {
  for (const seg of state.segments) {
    if (seg.passed) continue;
    if (state.ballZ < seg.zEnd - BALL_RUN.ballRadius) {
      seg.passed = true;
      if (seg.obstacle) {
        state.dodgeCount++;
        state.score += BALL_RUN.scorePerDodge;
        burst(state, getBallX(state), state.ballY + 1, state.ballZ, '#00ff88', 6, 2);
      }
    }
  }
}

export function createNeonBallRunState(): NeonBallRunState {
  const state: NeonBallRunState = {
    lane: Math.floor(BALL_RUN.laneCount / 2),
    targetLane: Math.floor(BALL_RUN.laneCount / 2),
    laneShiftT: 1,
    ballY: BALL_RUN.ballY, ballVy: 0, onGround: true, jumpCount: 0,
    ballSpin: 0, ballZ: 0,
    elapsedSec: 0, speed: BALL_RUN.baseSpeed,
    segments: [],
    nextSegmentId: 1,
    nextSpawnZStart: 0,
    nextRampYEnd: 0,
    spawnIndex: 0,
    /** 0 = first hazard can appear right after the two intro clean segments. */
    rowsSinceObstacle: 0, nextObstacleIn: 0,
    score: 0, dodgeCount: 0,
    alive: true, deathReason: '',
    particles: [], pendingShift: 0, pendingJump: false,
  };

  const need = BALL_RUN.visibleTilesAhead + 2;
  for (let i = 0; i < need; i++) {
    spawnRampSegment(state, i < 2);
  }

  state.ballY = surfaceY(state.segments[0]!, state.ballZ) + BALL_RUN.ballRadius;
  return state;
}

export function queueShift(state: NeonBallRunState, dir: -1 | 1): void { state.pendingShift = dir; }
export function queueJump(state: NeonBallRunState): void { state.pendingJump = true; }

export function stepNeonBallRun(state: NeonBallRunState, dtSec: number): void {
  if (!state.alive) { updateParticles(state, dtSec); return; }

  state.elapsedSec += dtSec;
  {
    const tau = BALL_RUN.speedRampTimeConstantSec;
    const ease = 1 - Math.exp(-state.elapsedSec / tau);
    state.speed = BALL_RUN.baseSpeed + (BALL_RUN.maxSpeed - BALL_RUN.baseSpeed) * ease;
    state.speed = Math.min(BALL_RUN.maxSpeed, state.speed);
  }
  state.ballZ -= state.speed * dtSec;

  if (state.pendingShift !== 0 && state.laneShiftT >= 1) {
    const next = clamp(state.lane + state.pendingShift, 0, BALL_RUN.laneCount - 1);
    if (next !== state.lane) { state.targetLane = next; state.laneShiftT = 0; }
    state.pendingShift = 0;
  } else { state.pendingShift = 0; }
  if (state.laneShiftT < 1) {
    state.laneShiftT = Math.min(1, state.laneShiftT + dtSec / BALL_RUN.laneShiftDuration);
    if (state.laneShiftT >= 1) state.lane = state.targetLane;
  }

  if (state.pendingJump) {
    state.pendingJump = false;
    if (state.jumpCount < BALL_RUN.maxJumpCount) {
      state.ballVy = BALL_RUN.jumpVy; state.onGround = false; state.jumpCount++;
      burst(state, getBallX(state), state.ballY, state.ballZ, '#00ffff', 8, 3);
    }
  }

  const bx = getBallX(state);
  const ballLane = clamp(Math.round(laneFromX(bx)), 0, BALL_RUN.laneCount - 1);
  const seg = findSegment(state, state.ballZ);

  if (!state.onGround) {
    state.ballVy -= BALL_RUN.gravity * dtSec;
    state.ballY += state.ballVy * dtSec;

    if (seg && seg.laneSolid[ballLane]) {
      const sy = surfaceY(seg, state.ballZ);
      const target = sy + BALL_RUN.ballRadius;
      if (state.ballY <= target && state.ballVy <= 0) {
        state.ballY = target;
        state.ballVy = 0;
        state.onGround = true;
        state.jumpCount = 0;
      }
    } else if (!seg && state.ballY < -18) {
      killBall(state, 'Missed the ramp!');
      updateParticles(state, dtSec);
      return;
    } else if (seg && !seg.laneSolid[ballLane] && state.ballY < surfaceY(seg, state.ballZ) - 0.2) {
      killBall(state, 'Fell through!');
      updateParticles(state, dtSec);
      return;
    }
  } else {
    if (seg && seg.laneSolid[ballLane]) {
      const sy = surfaceY(seg, state.ballZ);
      state.ballY = sy + BALL_RUN.ballRadius;
    } else if (!seg) {
      state.onGround = false;
      state.ballVy = 0;
    } else if (!seg.laneSolid[ballLane]) {
      state.onGround = false;
      state.ballVy = 0;
    }
  }

  state.ballSpin = (state.ballSpin + state.speed * 60 * dtSec) % 360;

  const span = BALL_RUN.rampLength + BALL_RUN.rampGap;
  const spawnThreshold = state.ballZ - BALL_RUN.visibleTilesAhead * span;
  while (state.nextSpawnZStart > spawnThreshold) {
    spawnRampSegment(state, false);
  }

  // Drop ramps the ball has fully passed (front edge zEnd is ahead of the ball in −Z).
  // IMPORTANT: do NOT use zStart > ballZ + margin — that deletes the whole track near z≈0 and you fall forever.
  state.segments = state.segments.filter(s => state.ballZ >= s.zEnd);

  for (const s of state.segments) {
    if (s.obstacle === 'moving' && s.obstacleData) tickMovingBlock(s.obstacleData, dtSec);
    if (s.obstacle2 === 'moving' && s.obstacleData2) tickMovingBlock(s.obstacleData2, dtSec);
  }

  state.score += BALL_RUN.scorePerSec * dtSec;
  checkDodges(state);
  checkCollisions(state);
  updateParticles(state, dtSec);
}

function updateParticles(state: NeonBallRunState, dtSec: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dtSec; p.y += p.vy * dtSec; p.z += p.vz * dtSec;
    p.vy -= 5 * dtSec; p.life -= p.decay;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

export type AiDifficulty = 'easy' | 'medium' | 'hard';

type HazardAhead = { kind: ObstacleKind; data: ObstacleData; az: number };

function collectHazardsAhead(state: NeonBallRunState, lookAheadZ: number): HazardAhead[] {
  const out: HazardAhead[] = [];
  for (const seg of state.segments) {
    if (seg.passed) continue;
    const push = (kind: ObstacleKind | null, data: ObstacleData | null, anchorZ: number | null) => {
      if (!kind || !data) return;
      const az = kind === 'gap' ? (seg.zStart + seg.zEnd) / 2 : (anchorZ ?? (seg.zStart + seg.zEnd) / 2);
      if (az > state.ballZ || az < lookAheadZ) return;
      out.push({ kind, data, az });
    };
    push(seg.obstacle, seg.obstacleData, seg.obstacleAnchorZ);
    push(seg.obstacle2, seg.obstacleData2, seg.obstacleAnchorZ2);
  }
  return out;
}

export function runBallRunAi(state: NeonBallRunState, difficulty: AiDifficulty): void {
  const r = { easy: 0.3, medium: 0.62, hard: 0.9 }[difficulty];
  const currentLane = Math.round(state.lane);
  const lookAheadZ = state.ballZ - BALL_RUN.tileDepth * 3;

  const hazards = collectHazardsAhead(state, lookAheadZ);
  if (hazards.length === 0) return;
  hazards.sort((a, b) => b.az - a.az);
  const h = hazards[0]!;

  const blocked =
    h.kind === 'moving' ? [Math.round(h.data.movingLane)] : h.data.blockedLanes;
  if (!blocked.includes(currentLane)) return;

  const canJump =
    (h.kind === 'spike' || h.kind === 'moving') && state.onGround && state.jumpCount < BALL_RUN.maxJumpCount;
  if (canJump && Math.random() < r * 0.55) { queueJump(state); return; }

  if (state.laneShiftT >= 1 && Math.random() < r) {
    const left = currentLane > 0 && !blocked.includes(currentLane - 1);
    const right = currentLane < BALL_RUN.laneCount - 1 && !blocked.includes(currentLane + 1);
    if (left && right) queueShift(state, Math.random() < 0.5 ? -1 : 1);
    else if (left) queueShift(state, -1);
    else if (right) queueShift(state, 1);
  }
}
