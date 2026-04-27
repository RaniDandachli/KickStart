/**
 * VoidRunnerEngine.ts
 * Pure physics / state engine for Void Runner.
 * No React dependencies — mirrors TapDashEngine.ts patterns.
 */

import { VOID_RUNNER, type CoinArcKind, type ObstacleKind } from './voidRunnerTuning';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Runner {
  /** Current lane index (0 = left, 1 = mid, 2 = right). */
  lane: number;
  /** Target lane — runner slides towards this. */
  targetLane: number;
  /** Logical Y position (top of bounding box). */
  y: number;
  /** Vertical velocity (positive = down). */
  vy: number;
  /** Whether the runner is airborne. */
  airborne: boolean;
  /** Whether the runner is ducking. */
  ducking: boolean;
  /** Remaining duck time (ms). */
  duckTimer: number;
  /** Whether the runner is alive. */
  alive: boolean;
  /** Current X (interpolates towards lane centre). */
  x: number;
  /** Horizontal velocity for slide animation. */
  vx: number;
}

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  /** Lane index for single-lane obstacles. -1 for multi-lane. */
  lane: number;
  /** For tripleBarrier: which lane is the opening. */
  openLane?: number;
  /** Visual height (logical px). */
  h: number;
  /** Whether the obstacle has been cleared (scored). */
  cleared: boolean;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  lane: number;
  collected: boolean;
}

export interface VoidRunnerState {
  runner: Runner;
  obstacles: Obstacle[];
  coins: Coin[];
  nextId: number;
  spawnAcc: number;
  nextSpawnMs: number;
  coinSpawnAcc: number;
  nextCoinSpawnMs: number;
  score: number;
  distanceTicks: number;
  worldTimeMs: number;
  alive: boolean;
  /** Scroll offset for visual parallax layers. */
  scrollX: number;
  /** Current scroll speed (px/ms). */
  scrollSpeed: number;
  /** Combo multiplier (consecutive obstacles without death). */
  combo: number;
  /** Collection of recent score popups. */
  popups: ScorePopup[];
  nextPopupId: number;
  /** Ground crack visual accents. */
  groundCracks: GroundCrack[];
  nextCrackId: number;
  /** Input queue flags. */
  _queueJump: boolean;
  _queueDuck: boolean;
  _queueLeft: boolean;
  _queueRight: boolean;
}

export interface ScorePopup {
  id: number;
  text: string;
  x: number;
  y: number;
  bornMs: number;
  color: string;
}

export interface GroundCrack {
  id: number;
  x: number;
  lane: number;
  bornMs: number;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createVoidRunnerState(): VoidRunnerState {
  const midLane = 1;
  return {
    runner: {
      lane: midLane,
      targetLane: midLane,
      y: VOID_RUNNER.groundY - VOID_RUNNER.runnerH,
      vy: 0,
      airborne: false,
      ducking: false,
      duckTimer: 0,
      alive: true,
      x: VOID_RUNNER.laneCentres[midLane],
      vx: 0,
    },
    obstacles: [],
    coins: [],
    nextId: 1,
    spawnAcc: 0,
    nextSpawnMs: 1200,
    coinSpawnAcc: 0,
    nextCoinSpawnMs: 800,
    score: 0,
    distanceTicks: 0,
    worldTimeMs: 0,
    alive: true,
    scrollX: 0,
    scrollSpeed: VOID_RUNNER.baseScrollPerMs,
    combo: 0,
    popups: [],
    nextPopupId: 1,
    groundCracks: [],
    nextCrackId: 1,
    _queueJump: false,
    _queueDuck: false,
    _queueLeft: false,
    _queueRight: false,
  };
}

// ─── Input API ───────────────────────────────────────────────────────────────

export function voidRunnerInputJump(s: VoidRunnerState): void {
  s._queueJump = true;
}
export function voidRunnerInputDuck(s: VoidRunnerState): void {
  s._queueDuck = true;
}
export function voidRunnerInputLeft(s: VoidRunnerState): void {
  s._queueLeft = true;
}
export function voidRunnerInputRight(s: VoidRunnerState): void {
  s._queueRight = true;
}

// ─── Spawning ─────────────────────────────────────────────────────────────────

function seededRand(seed: number): number {
  // Cheap inline mulberry32
  seed |= 0;
  seed = (seed + 0x6D2B79F5) | 0;
  let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
}

let _spawnSeed = Date.now() & 0xfffffff;
function nextRand(): number {
  _spawnSeed = (_spawnSeed * 1664525 + 1013904223) & 0xffffffff;
  return ((_spawnSeed >>> 0) / 4294967296);
}

function spawnObstacle(s: VoidRunnerState): void {
  const r = nextRand();
  const score = s.score;

  // Bias obstacle types based on score progression
  let kind: ObstacleKind;
  if (score < 5) {
    kind = r < 0.6 ? 'barrier' : 'lowBeam';
  } else if (score < 15) {
    kind = r < 0.35 ? 'barrier' : r < 0.65 ? 'lowBeam' : r < 0.82 ? 'pitfall' : 'tripleBarrier';
  } else {
    kind = r < 0.25 ? 'barrier' : r < 0.45 ? 'lowBeam' : r < 0.60 ? 'pitfall' : r < 0.80 ? 'tripleBarrier' : 'swarm';
  }

  const lane = Math.floor(nextRand() * 3);
  const openLane = Math.floor(nextRand() * 3);

  let h = 80;
  if (kind === 'lowBeam') h = 28;
  if (kind === 'pitfall') h = 40;
  if (kind === 'tripleBarrier') h = 100;
  if (kind === 'swarm') h = 60;
  if (kind === 'barrier') h = 72 + nextRand() * 40;

  s.obstacles.push({
    id: s.nextId++,
    kind,
    x: VOID_RUNNER.spawnX,
    lane,
    openLane: kind === 'tripleBarrier' ? openLane : undefined,
    h,
    cleared: false,
  });
}

function spawnCoinArc(s: VoidRunnerState): void {
  const lane = Math.floor(nextRand() * 3);
  const arcKind: CoinArcKind = nextRand() < 0.4 ? 'arc' : nextRand() < 0.5 ? 'zigzag' : 'line';
  const count = 4 + Math.floor(nextRand() * 5);
  const spacing = 44;
  const baseX = VOID_RUNNER.spawnX + 60;

  for (let i = 0; i < count; i++) {
    let y = VOID_RUNNER.groundY - VOID_RUNNER.runnerH * 0.5;
    let coinLane = lane;

    if (arcKind === 'arc') {
      const t = i / (count - 1);
      y = VOID_RUNNER.groundY - VOID_RUNNER.runnerH - Math.sin(t * Math.PI) * 80;
    } else if (arcKind === 'zigzag') {
      coinLane = (lane + (i % 2)) % 3;
    }

    s.coins.push({
      id: s.nextId++,
      x: baseX + i * spacing,
      y,
      lane: coinLane,
      collected: false,
    });
  }
}

// ─── Collision ────────────────────────────────────────────────────────────────

function runnerTop(r: Runner): number {
  const h = r.ducking ? VOID_RUNNER.runnerH * VOID_RUNNER.duckHFactor : VOID_RUNNER.runnerH;
  return r.y;
}
function runnerBottom(r: Runner): number {
  return r.y + (r.ducking ? VOID_RUNNER.runnerH * VOID_RUNNER.duckHFactor : VOID_RUNNER.runnerH);
}
function runnerLeft(r: Runner): number {
  return r.x - VOID_RUNNER.runnerW;
}
function runnerRight(r: Runner): number {
  return r.x + VOID_RUNNER.runnerW;
}

function obstacleLeft(o: Obstacle): number {
  return o.x - 24;
}
function obstacleRight(o: Obstacle): number {
  return o.x + 24;
}

function checkCollision(r: Runner, obs: Obstacle[]): boolean {
  if (!r.alive) return false;
  const rl = runnerLeft(r);
  const rr = runnerRight(r);
  const rt = runnerTop(r);
  const rb = runnerBottom(r);

  for (const o of obs) {
    const ol = obstacleLeft(o);
    const or_ = obstacleRight(o);
    if (rr < ol || rl > or_) continue; // X-axis miss

    // Lane check
    if (o.kind === 'tripleBarrier') {
      if (r.lane === o.openLane) continue; // safe lane
    } else if (o.kind === 'swarm') {
      // Swarm hits if in same lane AND not fast enough off the ground
      if (r.lane !== o.lane) continue;
    } else {
      if (r.lane !== o.lane) continue;
    }

    // Y collision per type
    if (o.kind === 'barrier' || o.kind === 'tripleBarrier' || o.kind === 'swarm') {
      const obstacleTop = VOID_RUNNER.groundY - o.h;
      if (rb > obstacleTop && rt < VOID_RUNNER.groundY) return true;
    } else if (o.kind === 'lowBeam') {
      // Beam sits at mid-chest height — duck to survive
      const beamY = VOID_RUNNER.groundY - VOID_RUNNER.runnerH * 0.72;
      if (!r.ducking && rb > beamY - 12 && rt < beamY + 12) return true;
    } else if (o.kind === 'pitfall') {
      // Pitfall: runner must be airborne when passing
      if (!r.airborne && rb >= VOID_RUNNER.groundY - 4) return true;
    }
  }
  return false;
}

// ─── Step ─────────────────────────────────────────────────────────────────────

const FRAME_REF = 1000 / 60; // 16.67ms

export function stepVoidRunner(s: VoidRunnerState, dtMs: number): void {
  if (!s.alive) return;

  const f = Math.min(10, Math.max(0.5, dtMs / FRAME_REF));
  s.worldTimeMs += dtMs;
  s.distanceTicks += dtMs;

  // Speed ramp
  const rampSteps = Math.floor(s.score / 10);
  s.scrollSpeed = VOID_RUNNER.baseScrollPerMs + rampSteps * VOID_RUNNER.speedRampPerTen;

  // ── Process inputs ──────────────────────────────────────────────────────
  const r = s.runner;

  if (s._queueLeft) {
    s._queueLeft = false;
    if (r.lane > 0) {
      r.lane -= 1;
      r.targetLane = r.lane;
    }
  }
  if (s._queueRight) {
    s._queueRight = false;
    if (r.lane < 2) {
      r.lane += 1;
      r.targetLane = r.lane;
    }
  }
  if (s._queueJump) {
    s._queueJump = false;
    if (!r.airborne) {
      r.vy = VOID_RUNNER.jumpVy;
      r.airborne = true;
      r.ducking = false;
      r.duckTimer = 0;
    }
  }
  if (s._queueDuck) {
    s._queueDuck = false;
    if (!r.airborne) {
      r.ducking = true;
      r.duckTimer = VOID_RUNNER.duckMs;
    }
  }

  // ── Runner vertical physics ─────────────────────────────────────────────
  if (r.airborne) {
    r.vy += VOID_RUNNER.gravity * f;
    r.vy = Math.min(r.vy, VOID_RUNNER.maxFallVy);
    r.y += r.vy * f;
    const groundTop = VOID_RUNNER.groundY - VOID_RUNNER.runnerH;
    if (r.y >= groundTop) {
      r.y = groundTop;
      r.vy = 0;
      r.airborne = false;
      // Spawn ground crack on landing
      s.groundCracks.push({
        id: s.nextCrackId++,
        x: r.x,
        lane: r.lane,
        bornMs: s.worldTimeMs,
      });
    }
  }

  // ── Duck timer ──────────────────────────────────────────────────────────
  if (r.ducking) {
    r.duckTimer -= dtMs;
    if (r.duckTimer <= 0) {
      r.ducking = false;
      r.duckTimer = 0;
    }
  }

  // ── Runner horizontal interpolation ────────────────────────────────────
  const targetX = VOID_RUNNER.laneCentres[r.lane];
  const dx = targetX - r.x;
  r.x += dx * Math.min(1, 0.28 * f);

  // ── Scroll + obstacle movement ─────────────────────────────────────────
  const scrollDelta = s.scrollSpeed * dtMs;
  s.scrollX += scrollDelta;

  for (const o of s.obstacles) {
    o.x -= scrollDelta;
  }
  for (const c of s.coins) {
    c.x -= scrollDelta;
  }

  // ── Cull off-screen entities ────────────────────────────────────────────
  s.obstacles = s.obstacles.filter((o) => o.x > -80);
  s.coins = s.coins.filter((c) => c.x > -20);
  s.groundCracks = s.groundCracks.filter((g) => s.worldTimeMs - g.bornMs < 1200);
  s.popups = s.popups.filter((p) => s.worldTimeMs - p.bornMs < 900);

  // ── Obstacle scoring ───────────────────────────────────────────────────
  const runnerX = VOID_RUNNER.laneCentres[r.lane];
  for (const o of s.obstacles) {
    if (!o.cleared && o.x + 24 < runnerX - VOID_RUNNER.runnerW) {
      o.cleared = true;
      s.combo += 1;
      const pts = VOID_RUNNER.scorePerObstacle * Math.max(1, Math.floor(s.combo / 3));
      s.score += pts;
      s.popups.push({
        id: s.nextPopupId++,
        text: s.combo > 0 && s.combo % 3 === 0 ? `×${Math.floor(s.combo / 3) + 1} COMBO!` : `+${pts}`,
        x: VOID_RUNNER.laneCentres[r.lane],
        y: r.y - 20,
        bornMs: s.worldTimeMs,
        color: s.combo % 3 === 0 ? '#FBBF24' : '#34D399',
      });
    }
  }

  // ── Coin collection ────────────────────────────────────────────────────
  for (const c of s.coins) {
    if (c.collected) continue;
    if (c.lane !== r.lane) continue;
    if (Math.abs(c.x - r.x) > 28) continue;
    const coinMid = c.y;
    const runnerMid = r.y + VOID_RUNNER.runnerH * 0.5;
    if (Math.abs(coinMid - runnerMid) > 52) continue;
    c.collected = true;
    s.score += VOID_RUNNER.scorePerCoin;
    s.popups.push({
      id: s.nextPopupId++,
      text: `+${VOID_RUNNER.scorePerCoin}`,
      x: c.x,
      y: c.y - 10,
      bornMs: s.worldTimeMs,
      color: '#FBBF24',
    });
  }

  // ── Time-based score ───────────────────────────────────────────────────
  s.score += (VOID_RUNNER.scorePerSec / 1000) * dtMs;

  // ── Collision detection ────────────────────────────────────────────────
  if (checkCollision(r, s.obstacles)) {
    r.alive = false;
    s.alive = false;
    s.combo = 0;
    return;
  }

  // ── Spawn obstacles ────────────────────────────────────────────────────
  s.spawnAcc += dtMs;
  if (s.spawnAcc >= s.nextSpawnMs) {
    spawnObstacle(s);
    s.spawnAcc = 0;
    const baseMin = Math.max(500, VOID_RUNNER.minSpawnMs - rampSteps * 30);
    const baseMax = Math.max(700, VOID_RUNNER.maxSpawnMs - rampSteps * 20);
    s.nextSpawnMs = baseMin + nextRand() * (baseMax - baseMin);
  }

  // ── Spawn coins ────────────────────────────────────────────────────────
  s.coinSpawnAcc += dtMs;
  if (s.coinSpawnAcc >= s.nextCoinSpawnMs) {
    if (nextRand() < 0.55) spawnCoinArc(s);
    s.coinSpawnAcc = 0;
    s.nextCoinSpawnMs = 1600 + nextRand() * 1200;
  }
}