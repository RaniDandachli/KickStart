// ─── NEON RUNNER — Engine ─────────────────────────────────────────────────
// GD-authentic physics. Speed ramps with tier. Zone-change signals emitted.

import { GROUND_Y, NR } from './constants';
import { cullObstacles, generateAhead, getTier, PATTERN_SEGMENT_COUNT } from './generator';
import { Obstacle, PlayerSim, RunState } from './types';

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRunState(seed: number): RunState {
  const player: PlayerSim = {
    worldX: 0,
    y: GROUND_Y - NR.PLAYER_H,
    vy: 0,
    onGround: true,
    angle: 0,
    rotV: 0,
    dead: false,
    trail: [],
    justLanded: false,
    tier: 0,
  };

  const state: RunState = {
    player,
    obstacles: [],
    scroll: 0,
    genCursor: NR.PLAY_W * 1.5,
    nextPatternIndex: seed % PATTERN_SEGMENT_COUNT,
    speed: NR.RUN_SPEED,
    elapsed: 0,
    jumpCount: 0,
    phase: 'playing',
    seed,
    tier: 0,
    zoneChanged: false,
    lastTier: 0,
  };
  generateAhead(state, player.worldX);

  return state;
}

// ─── Input ──────────────────────────────────────────────────────────────────

export interface InputState {
  jumpPressedThisFrame: boolean;
  jumpHeld: boolean;
  jumpBufferMs: number;
  coyoteMs: number;
}

export function createInputState(): InputState {
  return { jumpPressedThisFrame: false, jumpHeld: false, jumpBufferMs: 0, coyoteMs: 0 };
}

// ─── Step ───────────────────────────────────────────────────────────────────

export function stepRun(state: RunState, input: InputState, dt: number): void {
  if (state.phase !== 'playing') return;

  const { player } = state;
  const dtNorm = dt / 16;

  state.elapsed += dt;

  // Clear one-frame flags
  player.justLanded = false;
  state.zoneChanged = false;

  input.jumpBufferMs = Math.max(0, input.jumpBufferMs - dt);
  input.coyoteMs = Math.max(0, input.coyoteMs - dt);

  const wasOnGround = player.onGround;

  // ── Jump ────────────────────────────────────────────────────────────────
  const wantJump = input.jumpPressedThisFrame || input.jumpBufferMs > 0;
  if (wantJump) {
    if (player.onGround || input.coyoteMs > 0) {
      player.vy = NR.JUMP_V;
      player.onGround = false;
      player.rotV = -(Math.PI * 2) / 60;
      input.coyoteMs = 0;
      input.jumpBufferMs = 0;
      state.jumpCount += 1;
    } else if (input.jumpPressedThisFrame) {
      input.jumpBufferMs = NR.JUMP_BUFFER_MS;
    }
  }
  input.jumpPressedThisFrame = false;

  // ── Gravity + vertical movement ─────────────────────────────────────────
  player.vy += NR.GRAVITY * dtNorm;
  if (player.vy > NR.MAX_FALL_VY) player.vy = NR.MAX_FALL_VY;
  player.y += player.vy * dtNorm;

  // ── Snap onto wall tops ──────────────────────────────────────────────────
  snapToWallTop(state);

  // ── Floor clamp ──────────────────────────────────────────────────────────
  if (player.y >= GROUND_Y - NR.PLAYER_H - 0.5 && player.vy >= 0) {
    player.y = GROUND_Y - NR.PLAYER_H;
    player.vy = 0;
  }

  // ── On-ground state ──────────────────────────────────────────────────────
  player.onGround = computeOnGround(state);

  if (player.onGround) {
    const snap = Math.round(player.angle / (Math.PI / 2)) * (Math.PI / 2);
    player.angle += (snap - player.angle) * 0.35;
    player.rotV = 0;
    if (NR.COYOTE_MS > 0) input.coyoteMs = NR.COYOTE_MS;
  } else {
    if (wasOnGround && NR.COYOTE_MS > 0) input.coyoteMs = NR.COYOTE_MS;
    player.angle += player.rotV * dtNorm;
  }

  // ── Chain jump on landing ────────────────────────────────────────────────
  const justLanded = !wasOnGround && player.onGround;
  if (justLanded) {
    player.justLanded = true;
    if (input.jumpHeld) {
      player.vy = NR.JUMP_V;
      player.onGround = false;
      player.rotV = -(Math.PI * 2) / 60;
      input.jumpBufferMs = 0;
      input.coyoteMs = 0;
      state.jumpCount += 1;
    }
  }

  // ── Horizontal movement ──────────────────────────────────────────────────
  player.worldX += state.speed * dt;
  state.scroll += state.speed * dt;

  // ── Tier + speed update ──────────────────────────────────────────────────
  const newTier = getTier(state.scroll);
  if (newTier !== state.tier) {
    state.lastTier = state.tier;
    state.tier = newTier;
    player.tier = newTier;
    // Zone changes on even tier boundaries (0→2→4→6)
    if (Math.floor(newTier / 2) !== Math.floor(state.lastTier / 2)) {
      state.zoneChanged = true;
    }
  }
  // Speed ramps up with tier, capped at max
  state.speed = Math.min(
    NR.RUN_SPEED_MAX,
    NR.RUN_SPEED + state.tier * NR.RUN_SPEED_PER_TIER,
  );

  // ── Trail ────────────────────────────────────────────────────────────────
  player.trail.push({ x: player.worldX + NR.PLAYER_W / 2, y: player.y + NR.PLAYER_H / 2, age: 0 });
  for (const tp of player.trail) tp.age += dt;
  const TRAIL_MAX_AGE = 120;
  while (player.trail.length > 0 && player.trail[0]!.age > TRAIL_MAX_AGE) {
    player.trail.shift();
  }
  if (player.trail.length > 12) player.trail.splice(0, player.trail.length - 12);

  // ── World rebase ─────────────────────────────────────────────────────────
  const REBASE_X = 15_000;
  const REBASE_SHIFT = 10_000;
  if (player.worldX > REBASE_X) {
    player.worldX -= REBASE_SHIFT;
    state.genCursor -= REBASE_SHIFT;
    for (const o of state.obstacles) o.x -= REBASE_SHIFT;
    for (const tp of player.trail) tp.x -= REBASE_SHIFT;
  }

  // ── Void fall ────────────────────────────────────────────────────────────
  if (player.y > NR.PLAY_H + NR.TILE * 3) {
    killPlayer(state);
    return;
  }

  // ── Collision detection ──────────────────────────────────────────────────
  checkCollisions(state, input);
  if (state.phase !== 'playing') return;

  // ── Generation / culling ─────────────────────────────────────────────────
  generateAhead(state, player.worldX);
  cullObstacles(state.obstacles, player.worldX);
}

// ─── Snap onto wall top ───────────────────────────────────────────────────────

function snapToWallTop(state: RunState): void {
  const { player } = state;
  if (player.vy < 0) return;
  const margin = 2;
  const px1 = player.worldX + margin;
  const px2 = player.worldX + NR.PLAYER_W - margin;
  const py2 = player.y + NR.PLAYER_H;
  const py1 = player.y;

  let best: Obstacle | null = null;
  for (const o of state.obstacles) {
    if (o.kind !== 'wall') continue;
    const ox1 = o.x;
    const ox2 = o.x + o.w;
    if (px2 <= ox1 || px1 >= ox2) continue;
    const topY = o.y;
    if (py2 >= topY - 8 && py2 <= topY + 14 && py1 < topY) {
      if (!best || o.y < best.y) best = o;
    }
  }
  if (best) {
    player.y = best.y - NR.PLAYER_H;
    player.vy = 0;
  }
}

// ─── On-ground check ──────────────────────────────────────────────────────────

function computeOnGround(state: RunState): boolean {
  const p = state.player;
  if (p.vy < 0) return false;
  if (p.y >= GROUND_Y - NR.PLAYER_H - 0.5) return true;
  const margin = 2;
  const px1 = p.worldX + margin;
  const px2 = p.worldX + NR.PLAYER_W - margin;
  const py2 = p.y + NR.PLAYER_H;
  for (const o of state.obstacles) {
    if (o.kind !== 'wall') continue;
    const ox1 = o.x + margin;
    const ox2 = o.x + o.w - margin;
    if (px2 > ox1 && px1 < ox2 && Math.abs(py2 - o.y) < 6) return true;
  }
  return false;
}

// ─── Collision detection ──────────────────────────────────────────────────────

function checkCollisions(state: RunState, input: InputState): void {
  const { player } = state;
  const margin = 4;
  const px1 = player.worldX + margin;
  const px2 = player.worldX + NR.PLAYER_W - margin;
  const py1 = player.y + margin;
  const py2 = player.y + NR.PLAYER_H - margin;

  for (const o of state.obstacles) {
    switch (o.kind) {
      case 'void': {
        const gx1 = o.x + 1, gx2 = o.x + o.w - 1;
        if (px2 > gx1 && px1 < gx2 && py2 >= GROUND_Y && player.vy >= 0) {
          killPlayer(state);
          return;
        }
        break;
      }

      case 'wall': {
        const ox1 = o.x + margin;
        const ox2 = o.x + o.w - margin;
        if (!(px2 > ox1 && px1 < ox2)) break;
        const topY = o.y;
        const onTop =
          player.vy >= 0 && py2 >= topY - 6 && py2 <= topY + 12 && py1 < topY;
        if (onTop) break;
        if (py2 > topY + margin && py1 < o.y + o.h - margin) {
          const playerFeetAtTop = Math.abs((player.y + NR.PLAYER_H) - topY) < 8;
          if (!playerFeetAtTop) {
            killPlayer(state);
            return;
          }
        }
        break;
      }

      case 'spike': {
        if (playerHitsSpikeTriangle(o, px1, py1, px2, py2, true)) {
          killPlayer(state);
          return;
        }
        break;
      }

      case 'ceilingSpike': {
        if (playerHitsSpikeTriangle(o, px1, py1, px2, py2, false)) {
          killPlayer(state);
          return;
        }
        break;
      }

      case 'crystal': {
        const ox1 = o.x + margin, ox2 = o.x + o.w - margin;
        if (px2 > ox1 && px1 < ox2 && py2 > o.y + margin && py1 < o.y + o.h - margin) {
          killPlayer(state);
          return;
        }
        break;
      }

      case 'laser': {
        if (px2 > o.x && px1 < o.x + o.w && py2 > o.y && py1 < o.y + o.h) {
          killPlayer(state);
          return;
        }
        break;
      }

      case 'ring': {
        if (o.used) break;
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = o.w / 2;
        const pcx = player.worldX + NR.PLAYER_W / 2, pcy = player.y + NR.PLAYER_H / 2;
        const dx = pcx - cx, dy = pcy - cy;
        if (dx * dx + dy * dy < (r + NR.PLAYER_W * 0.55) ** 2 && input.jumpHeld) {
          o.used = true;
          player.vy = NR.JUMP_V * 1.1;
          player.rotV = -(Math.PI * 2) / 60;
          input.coyoteMs = 0;
        }
        break;
      }
    }
  }
}

function killPlayer(state: RunState): void {
  state.player.dead = true;
  state.phase = 'dead';
}

// ─── Spike triangle collision ─────────────────────────────────────────────────

function pointInTriangle(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): boolean {
  const s1 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const s2 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const s3 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
  const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(hasNeg && hasPos);
}

function playerHitsSpikeTriangle(
  o: Obstacle,
  px1: number, py1: number,
  px2: number, py2: number,
  pointingUp: boolean,
): boolean {
  let ax: number, ay: number, bx: number, by: number, cx: number, cy: number;
  if (pointingUp) {
    ax = o.x + o.w / 2; ay = o.y;
    bx = o.x; by = o.y + o.h;
    cx = o.x + o.w; cy = o.y + o.h;
  } else {
    ax = o.x + o.w / 2; ay = o.y + o.h;
    bx = o.x; by = o.y;
    cx = o.x + o.w; cy = o.y;
  }
  const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
  const minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy);
  if (px2 <= minX || px1 >= maxX || py2 <= minY || py1 >= maxY) return false;

  const pts: [number, number][] = [
    [px1, py1], [px2, py1], [px2, py2], [px1, py2],
    [(px1 + px2) * 0.5, (py1 + py2) * 0.5],
  ];
  for (const [qx, qy] of pts) {
    if (pointInTriangle(qx, qy, ax, ay, bx, by, cx, cy)) return true;
  }
  for (const [qx, qy] of [[ax, ay], [bx, by], [cx, cy]] as [number, number][]) {
    if (qx > px1 && qx < px2 && qy > py1 && qy < py2) return true;
  }
  return false;
}

// ─── Score ────────────────────────────────────────────────────────────────────

export function scoreFromState(state: RunState): number {
  return Math.max(0, Math.floor(state.scroll * NR.DIST_SCALE));
}