import { mulberry32 } from '@/minigames/core/seededRng';

/** Logical playfield height (world units; y increases downward). */
export const PLAY_H = 560;
export const GROUND_Y = 500;
export const BALL_R = 14;
export const GROUNDED_CY = GROUND_Y - BALL_R;
export const GRAVITY = 0.42;
export const JUMP_V = -10.6;
export const JUMP_CHARGE_EXTRA = -3.2;
export const MAX_CHARGE_MS = 160;

export type Lane = 0 | 1 | 2;
export type ObstacleKind = 'low' | 'wall';

export type Obstacle = {
  id: number;
  z: number;
  lane: Lane;
  kind: ObstacleKind;
};

export type BallRunState = {
  seed: number;
  rng: () => number;
  ballLane: Lane;
  ballCy: number;
  ballVy: number;
  obstacles: Obstacle[];
  nextId: number;
  distance: number;
  speed: number;
  timeMs: number;
  alive: boolean;
  jumps: number;
  laneChanges: number;
  inputEvents: number;
  lastWallLane: number | null;
};

const COLLISION_Z = 24;

function obstacleTop(kind: ObstacleKind): number {
  return kind === 'low' ? GROUND_Y - 46 : GROUND_Y - 172;
}

/** Same lane + vertical overlap with obstacle column (top .. ground). */
function ballHitsObstacle(ballCy: number, lane: Lane, o: Obstacle): boolean {
  if (lane !== o.lane) return false;
  const top = obstacleTop(o.kind);
  const bot = GROUND_Y;
  const ballBottom = ballCy + BALL_R;
  const ballTop = ballCy - BALL_R;
  if (ballBottom <= top) return false;
  if (ballTop >= bot) return false;
  return true;
}

function collisionCheck(s: BallRunState): boolean {
  for (const o of s.obstacles) {
    if (o.z > COLLISION_Z || o.z < -COLLISION_Z) continue;
    if (ballHitsObstacle(s.ballCy, s.ballLane, o)) return true;
  }
  return false;
}

function maxObstacleZ(obs: Obstacle[]): number {
  let m = 0;
  for (const o of obs) if (o.z > m) m = o.z;
  return m;
}

const MIN_SPAWN_GAP = 136;
const MAX_SPAWN_GAP = 232;
const SPAWN_AHEAD_TARGET = 400;

type Pattern =
  | { t: 'low'; lane: Lane }
  | { t: 'wall'; lane: Lane }
  | { t: 'double'; lanes: [Lane, Lane] };

function pickPattern(s: BallRunState): Pattern {
  const rng = s.rng;
  const tier = Math.min(10, Math.floor(s.timeMs / 14_000));
  const r = rng();

  if (r < 0.36) {
    return { t: 'low', lane: randomLane(rng) };
  }
  if (r < 0.68) {
    let lane = randomLane(rng);
    if (s.lastWallLane === lane && rng() < 0.5) {
      lane = ((lane + 1 + Math.floor(rng() * 2)) % 3) as Lane;
    }
    return { t: 'wall', lane };
  }
  if (r < 0.84 && tier >= 1) {
    const a = randomLane(rng);
    let b = randomLane(rng);
    if (b === a) b = ((a + 1) % 3) as Lane;
    return { t: 'double', lanes: [a, b] };
  }
  return { t: 'low', lane: randomLane(rng) };
}

function randomLane(rng: () => number): Lane {
  return Math.floor(rng() * 3) as Lane;
}

function spawnFromPattern(s: BallRunState, baseZ: number, p: Pattern): void {
  const gap = MIN_SPAWN_GAP + s.rng() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
  const z0 = baseZ + gap;
  if (p.t === 'wall') {
    s.obstacles.push({ id: s.nextId++, z: z0, lane: p.lane, kind: 'wall' });
    s.lastWallLane = p.lane;
    return;
  }
  if (p.t === 'double') {
    s.obstacles.push(
      { id: s.nextId++, z: z0, lane: p.lanes[0], kind: 'low' },
      { id: s.nextId++, z: z0 + 86, lane: p.lanes[1], kind: 'low' },
    );
    s.lastWallLane = null;
    return;
  }
  s.obstacles.push({ id: s.nextId++, z: z0, lane: p.lane, kind: 'low' });
  s.lastWallLane = null;
}

function trySpawn(s: BallRunState): void {
  const maxZ = maxObstacleZ(s.obstacles);
  if (maxZ > SPAWN_AHEAD_TARGET) return;
  const pat = pickPattern(s);
  spawnFromPattern(s, maxZ, pat);
}

export function createBallRunState(seed?: number): BallRunState {
  const s = (seed ?? (Date.now() ^ (Math.floor(Math.random() * 0x7fffffff) >>> 0))) >>> 0;
  return {
    seed: s,
    rng: mulberry32(s),
    ballLane: 1,
    ballCy: GROUNDED_CY,
    ballVy: 0,
    obstacles: [],
    nextId: 1,
    distance: 0,
    speed: 0.21,
    timeMs: 0,
    alive: true,
    jumps: 0,
    laneChanges: 0,
    inputEvents: 0,
    lastWallLane: null,
  };
}

export function getRunSeed(s: BallRunState): number {
  return s.seed;
}

export function stepBallRun(dt: number, s: BallRunState): void {
  if (!s.alive) return;
  const d = Math.min(40, Math.max(0, dt));
  s.timeMs += d;
  const tier = Math.min(14, Math.floor(s.timeMs / 11_000));
  s.speed = 0.2 + tier * 0.019 + Math.min(0.11, s.distance / 55_000);
  s.distance += s.speed * d;

  s.ballVy += GRAVITY * d;
  s.ballCy += s.ballVy * d;
  if (s.ballCy >= GROUNDED_CY) {
    s.ballCy = GROUNDED_CY;
    if (s.ballVy > 0) s.ballVy = 0;
  }

  for (const o of s.obstacles) o.z -= s.speed * d;
  s.obstacles = s.obstacles.filter((o) => o.z > -95);

  trySpawn(s);

  if (collisionCheck(s)) {
    s.alive = false;
  }
}

export function laneLeft(s: BallRunState): void {
  if (!s.alive || s.ballLane <= 0) return;
  s.ballLane = (s.ballLane - 1) as Lane;
  s.laneChanges += 1;
  s.inputEvents += 1;
}

export function laneRight(s: BallRunState): void {
  if (!s.alive || s.ballLane >= 2) return;
  s.ballLane = (s.ballLane + 1) as Lane;
  s.laneChanges += 1;
  s.inputEvents += 1;
}

export function jump(s: BallRunState, charge01 = 0): void {
  if (!s.alive) return;
  const onGround = s.ballCy >= GROUNDED_CY - 0.75 && s.ballVy >= -0.08;
  if (!onGround) return;
  const c = Math.max(0, Math.min(1, charge01));
  s.ballVy = JUMP_V + JUMP_CHARGE_EXTRA * c;
  s.jumps += 1;
  s.inputEvents += 1;
}

export function displayScore(s: BallRunState): number {
  return Math.floor(s.distance);
}
