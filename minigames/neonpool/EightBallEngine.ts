// ─── EightBallEngine.ts ──────────────────────────────────────────────────────
// Pure physics + game-logic layer for Run It Arcade – 8 Ball Pool.
// No React, no RN imports. Used by NeonPoolScreen (2P duel UI).

export const POOL = {
  // Table logical dimensions (landscape)
  tableW: 660,
  tableH: 330,
  cushion: 20, // rail thickness (logical px)
  ballR: 11,
  friction: 0.988, // velocity multiplier per frame (~60fps)
  spinDecay: 0.94,
  minSpeed: 0.04, // below this → treat ball as stopped
  maxShotPower: 18,
  aimLineLen: 200,
  pocketR: 14, // pocket mouth radius (collision)
  pocketVisR: 16, // visual
} as const;

// ─── Pocket positions ────────────────────────────────────────────────────────
const C = POOL.cushion;
const TW = POOL.tableW;
const TH = POOL.tableH;
export const POCKETS: Vec2[] = [
  { x: C, y: C }, // TL
  { x: TW / 2, y: C - 4 }, // TM
  { x: TW - C, y: C }, // TR
  { x: C, y: TH - C }, // BL
  { x: TW / 2, y: TH - C + 4 }, // BM
  { x: TW - C, y: TH - C }, // BR
];

// ─── Types ───────────────────────────────────────────────────────────────────
export type Vec2 = { x: number; y: number };

export type BallType = 'cue' | 'eight' | 'solid' | 'stripe';

export interface Ball {
  id: number; // 0=cue, 8=eight, 1-7=solid, 9-15=stripe
  type: BallType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number; // side-spin (-1..1), affects cushion bounce
  pocketed: boolean;
  color: string; // neon arcade colour
}

export type PlayerGroup = 'solid' | 'stripe' | null;

export type FoulReason =
  | 'scratch' // cue ball pocketed
  | 'no_hit' // cue ball didn't hit any ball
  | 'wrong_group' // hit opponent's ball first
  | 'eight_early'; // pocketed 8-ball before clearing group

export interface EightBallState {
  balls: Ball[];
  currentPlayer: 1 | 2;
  groupP1: PlayerGroup;
  groupP2: PlayerGroup;
  phase: 'aiming' | 'shot_in_progress' | 'ball_in_hand' | 'game_over';
  winner: 1 | 2 | null;
  foul: FoulReason | null;
  /** IDs of balls pocketed this turn (cleared each turn start). */
  pocketedThisTurn: number[];
  firstContactId: number | null; // first ball cue touched this turn
  turnCount: number;
  /** Cue tip position in logical space (during aiming). */
  aimAngle: number; // radians
  aimPower: number; // 0..1
  cueSpin: number; // -1..1
  /** Ball-in-hand: where player is placing cue ball */
  ballInHandPos: Vec2 | null;
  /** Running shot count (for UI stats) */
  shotCount: number;
}

// ─── BALL COLORS (neon arcade palette) ────────────────────────────────────────
const BALL_COLORS: Record<number, string> = {
  0: '#F0F0F0', // cue – white
  1: '#FACC15',
  2: '#3B82F6',
  3: '#EF4444',
  4: '#A855F7',
  5: '#F97316',
  6: '#10B981',
  7: '#EC4899',
  8: '#1E1E2E',
  9: '#FACC15',
  10: '#3B82F6',
  11: '#EF4444',
  12: '#A855F7',
  13: '#F97316',
  14: '#10B981',
  15: '#EC4899',
};

// ─── RACK SETUP ──────────────────────────────────────────────────────────────
function rackBalls(): Ball[] {
  const rx = TW * 0.67;
  const ry = TH / 2;
  const r = POOL.ballR;
  const rowSpacingX = r * 2 * 0.867; // cos30
  const rowSpacingY = r * 2;

  const rows: number[][] = [
    [1],
    [9, 2],
    [3, 8, 10],
    [11, 7, 4, 14],
    [6, 15, 13, 5, 12],
  ];

  const balls: Ball[] = [];

  rows.forEach((row, ri) => {
    const rowCount = row.length;
    row.forEach((id, ci) => {
      const bx = rx + ri * rowSpacingX;
      const by = ry + (ci - (rowCount - 1) / 2) * rowSpacingY;
      const type: BallType =
        id === 0 ? 'cue' : id === 8 ? 'eight' : id <= 7 ? 'solid' : 'stripe';
      balls.push({
        id,
        type,
        x: bx,
        y: by,
        vx: 0,
        vy: 0,
        spin: 0,
        pocketed: false,
        color: BALL_COLORS[id],
      });
    });
  });

  balls.push({
    id: 0,
    type: 'cue',
    x: TW * 0.25,
    y: TH / 2,
    vx: 0,
    vy: 0,
    spin: 0,
    pocketed: false,
    color: BALL_COLORS[0],
  });

  return balls;
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────
export function createEightBallState(): EightBallState {
  return {
    balls: rackBalls(),
    currentPlayer: 1,
    groupP1: null,
    groupP2: null,
    phase: 'aiming',
    winner: null,
    foul: null,
    pocketedThisTurn: [],
    firstContactId: null,
    turnCount: 0,
    aimAngle: Math.PI,
    aimPower: 0.5,
    cueSpin: 0,
    ballInHandPos: null,
    shotCount: 0,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function anyMoving(balls: Ball[]): boolean {
  return balls.some((b) => !b.pocketed && Math.abs(b.vx) + Math.abs(b.vy) > POOL.minSpeed);
}

// ─── POCKET CHECK ────────────────────────────────────────────────────────────
function checkPockets(state: EightBallState): void {
  const { balls, pocketedThisTurn } = state;
  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const p of POCKETS) {
      if (dist(ball, p) < POOL.pocketR + POOL.ballR * 0.5) {
        ball.pocketed = true;
        ball.vx = 0;
        ball.vy = 0;
        pocketedThisTurn.push(ball.id);
        break;
      }
    }
  }
}

// ─── BALL–BALL COLLISION ─────────────────────────────────────────────────────
function resolveBallCollisions(balls: Ball[], state: EightBallState): void {
  const active = balls.filter((b) => !b.pocketed);
  const d = POOL.ballR * 2;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= d * d || distSq === 0) continue;

      const len = Math.sqrt(distSq);
      const nx = dx / len;
      const ny = dy / len;

      if (state.firstContactId === null && state.phase === 'shot_in_progress') {
        if (a.id === 0) state.firstContactId = b.id;
        if (b.id === 0) state.firstContactId = a.id;
      }

      const overlap = (d - len) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      const dvx = a.vx - b.vx;
      const dvy = a.vy - b.vy;
      const dot = dvx * nx + dvy * ny;
      if (dot <= 0) continue;

      a.vx -= dot * nx;
      a.vy -= dot * ny;
      b.vx += dot * nx;
      b.vy += dot * ny;
    }
  }
}

// ─── CUSHION BOUNCE ──────────────────────────────────────────────────────────
function resolveCushions(ball: Ball): void {
  const r = POOL.ballR;
  const minX = POOL.cushion + r;
  const maxX = TW - POOL.cushion - r;
  const minY = POOL.cushion + r;
  const maxY = TH - POOL.cushion - r;

  const energyLoss = 0.78;

  if (ball.x < minX) {
    ball.x = minX;
    ball.vx = Math.abs(ball.vx) * energyLoss;
    ball.vy += ball.spin * 0.6;
  }
  if (ball.x > maxX) {
    ball.x = maxX;
    ball.vx = -Math.abs(ball.vx) * energyLoss;
    ball.vy += ball.spin * 0.6;
  }
  if (ball.y < minY) {
    ball.y = minY;
    ball.vy = Math.abs(ball.vy) * energyLoss;
    ball.vx += ball.spin * 0.6;
  }
  if (ball.y > maxY) {
    ball.y = maxY;
    ball.vy = -Math.abs(ball.vy) * energyLoss;
    ball.vx += ball.spin * 0.6;
  }
}

// ─── PHYSICS STEP ────────────────────────────────────────────────────────────
export function stepPhysics(state: EightBallState, dtMs: number): void {
  if (state.phase !== 'shot_in_progress') return;

  const subSteps = 2;
  for (let s = 0; s < subSteps; s++) {
    for (const ball of state.balls) {
      if (ball.pocketed) continue;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= POOL.friction;
      ball.vy *= POOL.friction;
      ball.spin *= POOL.spinDecay;
      if (Math.abs(ball.vx) < POOL.minSpeed * 0.5) ball.vx = 0;
      if (Math.abs(ball.vy) < POOL.minSpeed * 0.5) ball.vy = 0;
      resolveCushions(ball);
    }
    resolveBallCollisions(state.balls, state);
    checkPockets(state);
  }

  if (!anyMoving(state.balls)) {
    evaluateTurn(state);
  }
}

// ─── TURN EVALUATION ─────────────────────────────────────────────────────────
function currentGroup(state: EightBallState): PlayerGroup {
  return state.currentPlayer === 1 ? state.groupP1 : state.groupP2;
}

function setGroup(state: EightBallState, player: 1 | 2, group: PlayerGroup): void {
  if (player === 1) state.groupP1 = group;
  else state.groupP2 = group;
}

function evaluateTurn(state: EightBallState): void {
  state.phase = 'aiming';
  state.foul = null;

  const cueBall = state.balls.find((b) => b.id === 0)!;
  const pocketed = state.pocketedThisTurn;

  if (cueBall.pocketed) {
    cueBall.pocketed = false;
    state.foul = 'scratch';
    state.phase = 'ball_in_hand';
    switchTurn(state);
    return;
  }

  if (state.firstContactId === null) {
    state.foul = 'no_hit';
    state.phase = 'ball_in_hand';
    switchTurn(state);
    return;
  }

  const firstBall = state.balls.find((b) => b.id === state.firstContactId)!;

  if (state.groupP1 === null) {
    if (pocketed.length > 0) {
      const firstPocket = state.balls.find((b) => b.id === pocketed[0] && b.id !== 8)!;
      if (firstPocket) {
        const g = firstPocket.type as 'solid' | 'stripe';
        setGroup(state, state.currentPlayer, g);
        setGroup(state, state.currentPlayer === 1 ? 2 : 1, g === 'solid' ? 'stripe' : 'solid');
      }
    }
  }

  const myGroup = currentGroup(state);

  if (myGroup !== null && firstBall.type !== 'cue' && firstBall.type !== myGroup) {
    const myBallsLeft = state.balls.filter((b) => !b.pocketed && b.type === myGroup).length;
    if (!(myBallsLeft === 0 && firstBall.id === 8)) {
      state.foul = 'wrong_group';
      state.phase = 'ball_in_hand';
      switchTurn(state);
      return;
    }
  }

  if (pocketed.includes(8)) {
    const myBallsLeft = state.balls.filter((b) => !b.pocketed && b.type === myGroup).length;
    if (myGroup !== null && myBallsLeft === 0) {
      state.winner = state.currentPlayer;
      state.phase = 'game_over';
    } else {
      state.foul = 'eight_early';
      state.winner = state.currentPlayer === 1 ? 2 : 1;
      state.phase = 'game_over';
    }
    return;
  }

  const validPocketed = pocketed.filter((id) => {
    const b = state.balls.find((bb) => bb.id === id)!;
    return myGroup === null ? b.type !== 'cue' && b.type !== 'eight' : b.type === myGroup;
  });

  if (validPocketed.length > 0) {
    state.pocketedThisTurn = [];
    state.firstContactId = null;
    state.turnCount++;
  } else {
    switchTurn(state);
  }
}

function switchTurn(state: EightBallState): void {
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.pocketedThisTurn = [];
  state.firstContactId = null;
  state.turnCount++;
}

// ─── SHOOT ───────────────────────────────────────────────────────────────────
export function shootCue(state: EightBallState, angle: number, power: number, spin: number): void {
  if (state.phase !== 'aiming' && state.phase !== 'ball_in_hand') return;
  const cue = state.balls.find((b) => b.id === 0)!;
  if (cue.pocketed) return;

  const spd = power * POOL.maxShotPower;
  cue.vx = Math.cos(angle) * spd;
  cue.vy = Math.sin(angle) * spd;
  cue.spin = clamp(spin, -1, 1);
  state.phase = 'shot_in_progress';
  state.pocketedThisTurn = [];
  state.firstContactId = null;
  state.shotCount++;
}

// ─── BALL IN HAND ─────────────────────────────────────────────────────────────
export function placeCueBall(state: EightBallState, x: number, y: number): void {
  if (state.phase !== 'ball_in_hand') return;
  const r = POOL.ballR + 2;
  const cx = clamp(x, POOL.cushion + r, TW - POOL.cushion - r);
  const cy = clamp(y, POOL.cushion + r, TH - POOL.cushion - r);

  const cue = state.balls.find((b) => b.id === 0)!;
  for (const b of state.balls) {
    if (b.id === 0 || b.pocketed) continue;
    if (dist({ x: cx, y: cy }, b) < POOL.ballR * 2 + 2) return;
  }
  cue.x = cx;
  cue.y = cy;
  cue.pocketed = false;
  state.ballInHandPos = null;
  state.phase = 'aiming';
}

// ─── AIM LINE PREDICTION (1-bounce) ──────────────────────────────────────────
export interface AimLine {
  cueStart: Vec2;
  cueTip: Vec2;
  ghostBall: Vec2 | null;
  deflectEnd: Vec2 | null;
  objectBallDir: Vec2 | null;
  hitBallId: number | null;
}

export function computeAimLine(state: EightBallState, angle: number): AimLine {
  const cue = state.balls.find((b) => b.id === 0)!;
  if (!cue || cue.pocketed) {
    const dummy: Vec2 = { x: 0, y: 0 };
    return {
      cueStart: dummy,
      cueTip: dummy,
      ghostBall: null,
      deflectEnd: null,
      objectBallDir: null,
      hitBallId: null,
    };
  }

  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const len = POOL.aimLineLen;
  let tMin: number = len;
  let hitBall: Ball | null = null;
  let hitGhost: Vec2 | null = null;

  for (const ball of state.balls) {
    if (ball.pocketed || ball.id === 0) continue;
    const ex = ball.x - cue.x;
    const ey = ball.y - cue.y;
    const proj = ex * dx + ey * dy;
    if (proj <= 0) continue;
    const cx2 = ex - proj * dx;
    const cy2 = ey - proj * dy;
    const distSq = cx2 * cx2 + cy2 * cy2;
    const d2 = POOL.ballR * 2;
    if (distSq >= d2 * d2) continue;
    const t = proj - Math.sqrt(d2 * d2 - distSq);
    if (t < tMin && t > POOL.ballR) {
      tMin = t;
      hitBall = ball;
      hitGhost = { x: cue.x + dx * t, y: cue.y + dy * t };
    }
  }

  const cueTip: Vec2 = { x: cue.x + dx * tMin, y: cue.y + dy * tMin };

  if (!hitBall || !hitGhost) {
    let bx = cueTip.x;
    let by = cueTip.y;
    let bdx = dx;
    let bdy = dy;
    const remLen = len - tMin;
    if (bx <= POOL.cushion + POOL.ballR || bx >= TW - POOL.cushion - POOL.ballR) bdx = -bdx;
    if (by <= POOL.cushion + POOL.ballR || by >= TH - POOL.cushion - POOL.ballR) bdy = -bdy;
    const deflect: Vec2 = { x: bx + bdx * remLen * 0.6, y: by + bdy * remLen * 0.6 };
    return {
      cueStart: { x: cue.x, y: cue.y },
      cueTip,
      ghostBall: null,
      deflectEnd: deflect,
      objectBallDir: null,
      hitBallId: null,
    };
  }

  const nx = hitBall.x - hitGhost.x;
  const ny = hitBall.y - hitGhost.y;
  const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
  const objDir: Vec2 = { x: nx / nlen, y: ny / nlen };
  const objEnd: Vec2 = { x: hitBall.x + objDir.x * 80, y: hitBall.y + objDir.y * 80 };

  const perp: Vec2 = { x: dy, y: -dx };
  const perpLen = 60;
  const deflectEnd: Vec2 = {
    x: hitGhost.x + perp.x * perpLen,
    y: hitGhost.y + perp.y * perpLen,
  };

  return {
    cueStart: { x: cue.x, y: cue.y },
    cueTip,
    ghostBall: hitGhost,
    deflectEnd,
    objectBallDir: objEnd,
    hitBallId: hitBall.id,
  };
}

// ─── BALL COUNTS ─────────────────────────────────────────────────────────────
export function ballsLeft(state: EightBallState, group: PlayerGroup): number {
  if (!group) return 7;
  return state.balls.filter((b) => !b.pocketed && b.type === group).length;
}
