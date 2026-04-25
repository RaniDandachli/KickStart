/**
 * Pure physics / state for Void Runner (no React).
 */

import { VOID_RUNNER, type CoinArcKind, type ObstacleKind } from './voidRunnerTuning';

export interface Runner {
  lane: number;
  targetLane: number;
  y: number;
  vy: number;
  airborne: boolean;
  ducking: boolean;
  duckTimer: number;
  alive: boolean;
  x: number;
  vx: number;
}

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  lane: number;
  openLane?: number;
  h: number;
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
  scrollX: number;
  scrollSpeed: number;
  combo: number;
  popups: ScorePopup[];
  nextPopupId: number;
  groundCracks: GroundCrack[];
  nextCrackId: number;
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

let _spawnSeed = Date.now() & 0xfffffff;

export function createVoidRunnerState(seed?: number): VoidRunnerState {
  const base = (seed != null ? (seed ^ 0x9e3779b9) : Date.now() & 0xfffffff) >>> 0;
  _spawnSeed = base;
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

function nextRand(): number {
  _spawnSeed = (_spawnSeed * 1664525 + 1013904223) & 0xffffffff;
  return (_spawnSeed >>> 0) / 4294967296;
}

function spawnObstacle(s: VoidRunnerState): void {
  const r = nextRand();
  const score = s.score;
  let kind: ObstacleKind;
  if (score < 5) {
    kind = r < 0.6 ? 'barrier' : 'lowBeam';
  } else if (score < 15) {
    kind = r < 0.35 ? 'barrier' : r < 0.65 ? 'lowBeam' : r < 0.82 ? 'pitfall' : 'tripleBarrier';
  } else {
    kind = r < 0.25 ? 'barrier' : r < 0.45 ? 'lowBeam' : r < 0.6 ? 'pitfall' : r < 0.8 ? 'tripleBarrier' : 'swarm';
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
      const t = i / Math.max(1, count - 1);
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

function runnerTop(r: Runner): number {
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
    if (rr < ol || rl > or_) continue;
    if (o.kind === 'tripleBarrier') {
      if (r.lane === o.openLane) continue;
    } else if (o.kind === 'swarm') {
      if (r.lane !== o.lane) continue;
    } else {
      if (r.lane !== o.lane) continue;
    }
    if (o.kind === 'barrier' || o.kind === 'tripleBarrier' || o.kind === 'swarm') {
      const obstacleTop = VOID_RUNNER.groundY - o.h;
      if (rb > obstacleTop && rt < VOID_RUNNER.groundY) return true;
    } else if (o.kind === 'lowBeam') {
      const beamY = VOID_RUNNER.groundY - VOID_RUNNER.runnerH * 0.72;
      if (!r.ducking && rb > beamY - 12 && rt < beamY + 12) return true;
    } else if (o.kind === 'pitfall') {
      if (!r.airborne && rb >= VOID_RUNNER.groundY - 4) return true;
    }
  }
  return false;
}

const FRAME_REF = 1000 / 60;

export function stepVoidRunner(s: VoidRunnerState, dtMs: number): void {
  if (!s.alive) return;
  const f = Math.min(10, Math.max(0.5, dtMs / FRAME_REF));
  s.worldTimeMs += dtMs;
  s.distanceTicks += dtMs;
  const rampSteps = Math.floor(s.score / 10);
  s.scrollSpeed = VOID_RUNNER.baseScrollPerMs + rampSteps * VOID_RUNNER.speedRampPerTen;
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

  if (r.airborne) {
    r.vy += VOID_RUNNER.gravity * f;
    r.vy = Math.min(r.vy, VOID_RUNNER.maxFallVy);
    r.y += r.vy * f;
    const groundTop = VOID_RUNNER.groundY - VOID_RUNNER.runnerH;
    if (r.y >= groundTop) {
      r.y = groundTop;
      r.vy = 0;
      r.airborne = false;
      s.groundCracks.push({
        id: s.nextCrackId++,
        x: r.x,
        lane: r.lane,
        bornMs: s.worldTimeMs,
      });
    }
  }

  if (r.ducking) {
    r.duckTimer -= dtMs;
    if (r.duckTimer <= 0) {
      r.ducking = false;
      r.duckTimer = 0;
    }
  }

  const targetX = VOID_RUNNER.laneCentres[r.lane];
  r.x += (targetX - r.x) * Math.min(1, 0.28 * f);

  const scrollDelta = s.scrollSpeed * dtMs;
  s.scrollX += scrollDelta;
  for (const o of s.obstacles) o.x -= scrollDelta;
  for (const c of s.coins) c.x -= scrollDelta;

  s.obstacles = s.obstacles.filter((o) => o.x > -80);
  s.coins = s.coins.filter((c) => c.x > -20);
  s.groundCracks = s.groundCracks.filter((g) => s.worldTimeMs - g.bornMs < 1200);
  s.popups = s.popups.filter((p) => s.worldTimeMs - p.bornMs < 900);

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

  s.score += (VOID_RUNNER.scorePerSec / 1000) * dtMs;

  if (checkCollision(r, s.obstacles)) {
    r.alive = false;
    s.alive = false;
    s.combo = 0;
    return;
  }

  s.spawnAcc += dtMs;
  if (s.spawnAcc >= s.nextSpawnMs) {
    spawnObstacle(s);
    s.spawnAcc = 0;
    const baseMin = Math.max(500, VOID_RUNNER.minSpawnMs - rampSteps * 30);
    const baseMax = Math.max(700, VOID_RUNNER.maxSpawnMs - rampSteps * 20);
    s.nextSpawnMs = baseMin + nextRand() * (baseMax - baseMin);
  }

  s.coinSpawnAcc += dtMs;
  if (s.coinSpawnAcc >= s.nextCoinSpawnMs) {
    if (nextRand() < 0.55) spawnCoinArc(s);
    s.coinSpawnAcc = 0;
    s.nextCoinSpawnMs = 1600 + nextRand() * 1200;
  }
}
