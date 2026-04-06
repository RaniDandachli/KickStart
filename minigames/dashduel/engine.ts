import { DD, playerFootY, playerX } from '@/minigames/dashduel/constants';
import { buildCourse } from '@/minigames/dashduel/sequencer';
import type { Obstacle, PlayerSim } from '@/minigames/dashduel/types';

const HW = DD.PLAYER_W / 2;
const HH = DD.PLAYER_H / 2;
const G = DD.GROUND_Y;

export interface DashRunState {
  seed: number;
  course: Obstacle[];
  scroll: number;
  scrollSpeed: number;
  timeMs: number;
  p1: PlayerSim;
  p2: PlayerSim;
  /** True when your run ended (you died or time cap). Rivals can already be out — keep playing. */
  roundOver: boolean;
}

function makePlayer(): PlayerSim {
  return {
    y: G - HH,
    vy: 0,
    alive: true,
    diedAtScroll: null,
    bestScroll: 0,
    clearedKeys: new Set(),
    streak: 0,
    nearFlash: 0,
    squash: 0,
    dangerFlash: 0,
    jumpBufferMs: 0,
  };
}

export function createDashRun(seed: number): DashRunState {
  return {
    seed,
    course: buildCourse(seed),
    scroll: 0,
    scrollSpeed: DD.BASE_SCROLL_PER_MS,
    timeMs: 0,
    p1: makePlayer(),
    p2: makePlayer(),
    roundOver: false,
  };
}

/** True if the player's feet span overlaps a pit (center-only checks felt unfair). */
function feetOverlapGap(px: number, course: Obstacle[]): boolean {
  const pl = px - HW;
  const pr = px + HW;
  for (const o of course) {
    if (o.kind === 'gap' && pr > o.x0 && pl < o.x1) return true;
  }
  return false;
}

function aabbHit(
  px: number,
  py: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): boolean {
  const pl = px - HW;
  const pr = px + HW;
  const pt = py - HH;
  const pb = py + HH;
  return pl < x1 && pr > x0 && pt < y1 && pb > y0;
}

function obstacleHitsPlayer(px: number, py: number, o: Obstacle): boolean {
  const inset = DD.HAZARD_HIT_INSET;
  switch (o.kind) {
    case 'spike': {
      const x0 = o.x0 + inset;
      const x1 = o.x1 - inset;
      const y0 = o.y0 + inset;
      if (x0 >= x1 || y0 >= o.y1) return false;
      return aabbHit(px, py, x0, x1, y0, o.y1);
    }
    case 'ceiling': {
      const x0 = o.x0 + inset;
      const x1 = o.x1 - inset;
      const y1 = o.y1 - inset;
      if (x0 >= x1 || o.y0 >= y1) return false;
      return aabbHit(px, py, x0, x1, o.y0, y1);
    }
    default:
      return false;
  }
}

function platformTopAt(px: number, footY: number, vy: number, course: Obstacle[]): number | null {
  const pl = px - HW;
  const pr = px + HW;
  for (const o of course) {
    if (o.kind !== 'platform') continue;
    if (pr > o.x0 && pl < o.x1 && footY >= o.yTop - 4 && footY <= o.yTop + 14 && vy >= -0.55) {
      return o.yTop;
    }
  }
  return null;
}

function resolveStand(
  px: number,
  py: number,
  vy: number,
  course: Obstacle[],
): { y: number; vy: number; grounded: boolean } {
  const foot = playerFootY(py);
  const onPlat = platformTopAt(px, foot, vy, course);
  if (onPlat !== null && foot >= onPlat - 8 && vy >= -0.2) {
    return { y: onPlat - HH, vy: 0, grounded: true };
  }
  if (!feetOverlapGap(px, course)) {
    if (foot >= G - 2 && foot <= G + 14 && vy >= 0) {
      return { y: G - HH, vy: 0, grounded: true };
    }
  }
  return { y: py, vy, grounded: false };
}

function stepPlayer(
  p: PlayerSim,
  px: number,
  dt: number,
  jump: boolean,
  course: Obstacle[],
  scroll: number,
): void {
  if (!p.alive) {
    p.nearFlash = Math.max(0, p.nearFlash - dt * 0.003);
    p.squash = Math.max(0, p.squash - dt * 0.004);
    p.dangerFlash = Math.max(0, p.dangerFlash - dt * 0.004);
    return;
  }

  let { y, vy } = p;
  if (jump) {
    p.jumpBufferMs = DD.JUMP_BUFFER_MS;
  }

  const footPre = playerFootY(y);
  const onGroundPre = !feetOverlapGap(px, course) && footPre >= G - 4 && footPre <= G + 8;
  const onPlatPre = platformTopAt(px, footPre, vy, course) !== null;
  if (p.jumpBufferMs > 0 && (onGroundPre || onPlatPre) && vy >= -0.02) {
    vy = DD.JUMP_VY;
    p.squash = 1;
    p.jumpBufferMs = 0;
  }

  vy += DD.GRAVITY * dt;
  vy = Math.min(vy, DD.MAX_FALL);
  y += vy * dt;

  const res = resolveStand(px, y, vy, course);
  y = res.y;
  vy = res.vy;

  if (p.jumpBufferMs > 0 && res.grounded) {
    vy = DD.JUMP_VY;
    p.squash = 1;
    p.jumpBufferMs = 0;
  } else {
    p.jumpBufferMs = Math.max(0, p.jumpBufferMs - dt);
  }

  // Hazards
  for (const o of course) {
    if (o.kind === 'spike' || o.kind === 'ceiling') {
      if (obstacleHitsPlayer(px, y, o)) {
        p.alive = false;
        p.diedAtScroll = scroll;
        p.dangerFlash = 1;
        return;
      }
    }
  }

  // Fall
  if (playerFootY(y) > DD.FALL_DEATH_Y) {
    p.alive = false;
    p.diedAtScroll = scroll;
    p.dangerFlash = 1;
  }

  p.y = y;
  p.vy = vy;
  p.bestScroll = Math.max(p.bestScroll, scroll);

  for (const o of course) {
    if (o.kind !== 'spike') continue;
    if (o.x1 < px - 6 && !p.clearedKeys.has(o.key)) {
      p.clearedKeys.add(o.key);
      p.streak += 1;
    }
  }
}

function aiJump(scroll: number, py: number, vy: number, course: Obstacle[]): boolean {
  const px = playerX(scroll);
  const foot = playerFootY(py);
  const onGroundish = foot >= G - 8 && vy >= -0.08;
  if (!onGroundish) return false;
  for (const o of course) {
    if (o.kind === 'spike' && o.x0 > px && o.x0 < px + 125) {
      const d = o.x0 - px;
      if (d > 18 && d < 88) return true;
    }
    if (o.kind === 'gap' && o.x0 > px && o.x0 < px + 100) {
      const d = o.x0 - px;
      if (d > 12 && d < 72) return true;
    }
  }
  return false;
}

export function stepDashRun(
  state: DashRunState,
  dtMs: number,
  p1Jump: boolean,
  p2OverrideJump?: boolean,
): void {
  if (state.roundOver) return;
  /** useRafLoop substeps ~60Hz; keep a safety cap if this engine is called elsewhere. */
  const dt = Math.min(100, Math.max(0, dtMs));
  state.timeMs += dt;

  state.scrollSpeed = Math.min(
    DD.MAX_SCROLL_PER_MS,
    DD.BASE_SCROLL_PER_MS + state.scroll * DD.SCROLL_RAMP_PER_MS2,
  );
  state.scroll += state.scrollSpeed * dt;

  const px1 = playerX(state.scroll);
  const px2 = playerX(state.scroll);
  const jump2 = p2OverrideJump ?? aiJump(state.scroll, state.p2.y, state.p2.vy, state.course);

  stepPlayer(state.p1, px1, dt, p1Jump, state.course, state.scroll);
  stepPlayer(state.p2, px2, dt, jump2, state.course, state.scroll);

  const timeUp = state.timeMs >= DD.ROUND_MS;
  /** Survival run: only end when the human (p1) dies or the round timer hits — not when AI dies first. */
  const playerOut = !state.p1.alive;
  if (timeUp || playerOut) state.roundOver = true;
}

export function scoreForPlayer(p: PlayerSim, scroll: number): number {
  const dist = p.bestScroll;
  const clear = p.clearedKeys.size;
  const mult = 1 + Math.min(4, Math.floor(p.streak / 5)) * 0.15;
  return Math.floor(dist * 0.4 + clear * 12 * mult);
}

/**
 * Resolves winner after a survival run (ends on p1 death or time).
 * If rival died earlier, p1 can still win at time-up by score / distance.
 */
export function winnerLabel(
  p1: PlayerSim,
  p2: PlayerSim,
  scroll: number,
  timeUp: boolean,
): 'p1' | 'p2' | 'draw' {
  if (!p1.alive) {
    if (p2.alive) return 'p2';
    const t1 = p1.diedAtScroll ?? 0;
    const t2 = p2.diedAtScroll ?? 0;
    if (t1 > t2) return 'p1';
    if (t2 > t1) return 'p2';
    return scoreForPlayer(p1, scroll) >= scoreForPlayer(p2, scroll) ? 'p1' : 'p2';
  }
  if (timeUp) {
    if (!p2.alive) return 'p1';
    const s1 = scoreForPlayer(p1, scroll);
    const s2 = scoreForPlayer(p2, scroll);
    if (s1 > s2) return 'p1';
    if (s2 > s1) return 'p2';
    if (p1.bestScroll > p2.bestScroll) return 'p1';
    if (p2.bestScroll > p1.bestScroll) return 'p2';
    return 'draw';
  }
  return 'draw';
}
