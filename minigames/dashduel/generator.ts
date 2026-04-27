// ─── NEON RUNNER — Pattern Generator ──────────────────────────────────────
//
// PHYSICS REFERENCE:
//   PLAY_H=160, GROUND_Y=128 (PLAY_H - GROUND_H=32), PLAYER_H=18, TILE=24
//   Jump apex ≈ 49px above ground → max clearable block height = 2T (48px)
//   A 3T (72px) block is UNJUMPABLE — never place standalone
//   Horizontal jump distance at Speed 1 ≈ 103px
//
// FAIRNESS RULES enforced in every segment:
//   • No standalone block taller than 2T (48px)
//   • stairsDown ONLY used after stairsUp (player must already be elevated)
//   • Ceiling clearance: GROUND_Y - hangH >= PLAYER_H + 8 = 26px minimum
//     → max hang = GROUND_Y - 26 = 102px  (using 70px max = safe)
//   • Ceiling spike clearance: dropY + SH <= GROUND_Y - PLAYER_H - 8
//     → spike bottom <= 102  → with SH=24 and dropY=5: bottom=29 ✓ (safe to walk under)
//     → if player jumps apex=GROUND_Y-49=79: spike bottom must be > 79
//     → dropY must be > 79 - SH = 55 for player to jump safely under
//     → use dropY=60 for "duck under" sections where jumping is fine too
//   • No orb placed inside or above a ceiling obstacle
//   • 4-spike bare = impossible; only place with orb before it
//   • All segments start/end with B=108px breathing room

import { GROUND_Y, NR } from './constants';
import type { Obstacle } from './types';

export interface PlacedSegment {
  obstacles: Obstacle[];
  width: number;
}

const T  = NR.TILE;   // 24px
const SW = T;         // spike width = full tile
const SH = T;         // spike height = full tile
const PH = NR.PLAYER_H; // 18px

// Breathing room (at 0.185px/ms, B=108px ≈ 584ms ≈ 1 full jump)
const B  = 108;
const BS = 72;   // tight breath for late game
const AS = 52;   // after-spike clearance

// Ceiling hang limits
// Player head when standing = GROUND_Y - PH = 110
// Player head at apex = GROUND_Y - PH - 49 = 61
// Safe ceiling hang (player can walk AND jump under): hangH <= 60
const CEIL_SAFE = 60;    // player can freely jump under this
// Forced duck hang (player must NOT jump): hangH > 100 — removed, too hard to signal
// We'll only use CEIL_SAFE ceiling blocks so jumping under is always fine

// ─────────────────────────────────────────────────────────────────────────
// PRIMITIVE BUILDERS
// ─────────────────────────────────────────────────────────────────────────

/** Ground spike(s). */
function sp(x: number, n = 1): Obstacle[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'spike' as const,
    x: x + i * SW, y: GROUND_Y - SH, w: SW, h: SH,
  }));
}

/** Ceiling spike(s). dropY = distance from top of screen. */
function csp(x: number, n = 1): Obstacle[] {
  // Drop just far enough that player can jump under them
  // Bottom of spike = dropY + SH. Player apex top = 61.
  // For player to safely jump under: dropY > 61 → use dropY=64
  return Array.from({ length: n }, (_, i) => ({
    kind: 'ceilingSpike' as const,
    x: x + i * SW, y: 64, w: SW, h: SH,
  }));
}

/** Ground gap. */
function gap(x: number, w: number): Obstacle {
  return { kind: 'void', x, y: GROUND_Y, w, h: NR.GROUND_H };
}

/** Ground-rising block. h = height above floor. MAX safe = T*2 (48px). */
function blk(x: number, w: number, h: number): Obstacle {
  // Clamp to max jumpable height
  const safeH = Math.min(h, T * 2);
  return { kind: 'wall', x, y: GROUND_Y - safeH, w, h: safeH };
}

/** Ceiling-hanging block. h = how far it hangs down. MAX = CEIL_SAFE. */
function cblk(x: number, w: number): Obstacle {
  // Always use CEIL_SAFE so player can freely jump under it
  return { kind: 'wall', x, y: 0, w, h: CEIL_SAFE };
}

/** Jump orb. yHead = pixels above player head when standing. */
function orb(x: number, yHead: number): Obstacle {
  const sz = Math.round(T * 0.82);
  return {
    kind: 'ring',
    x: x - sz / 2,
    y: GROUND_Y - PH - yHead - sz / 2,
    w: sz, h: sz,
  };
}

// ── Stair builders ──────────────────────────────────────────────────────────

/** Ascending stairs: step i has height T*(i+1). Max step = 2T (safe). */
function stairsUp(
  obs: Obstacle[], x: number, n: number,
  treadSpikes?: boolean[],
): number {
  // Cap at 2 steps to keep max height at 2T (48px) = jumpable
  const steps = Math.min(n, 2);
  for (let i = 0; i < steps; i++) {
    const h = T * (i + 1);
    obs.push(blk(x, T, h));
    if (treadSpikes?.[i]) {
      obs.push({ kind: 'spike', x: x + T - SW, y: GROUND_Y - h - SH, w: SW, h: SH });
    }
    x += T + 4;
  }
  return x;
}

/**
 * Descending stairs: starts from the height the player is already AT.
 * startH = height of first (leftmost) column. Goes down to T.
 * ONLY valid after stairsUp — player must be elevated already.
 */
function stairsDown(
  obs: Obstacle[], x: number, startH: number,
): number {
  for (let h = startH; h >= T; h -= T) {
    obs.push(blk(x, T, h));
    x += T + 4;
  }
  return x;
}

// ─────────────────────────────────────────────────────────────────────────
// SEGMENTS
// ─────────────────────────────────────────────────────────────────────────

// ── ZONE 0 — Circuit Rush (≈ Stereo Madness) ─────────────────────────────
// Ordered to introduce mechanics one at a time, exactly like SM.

const z0_intro = (_: number): PlacedSegment =>
  ({ obstacles: [], width: B + 220 + B });

const z0_rest = (_: number): PlacedSegment =>
  ({ obstacles: [], width: B + 60 });

const z0_s1 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: sp(x, 1), width: B + SW + B };
};

const z0_s2 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: sp(x, 2), width: B + SW * 2 + B };
};

// Triple spike — SM's hardest raw obstacle. One full jump clears 3T width.
const z0_s3 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: sp(x, 3), width: B + SW * 3 + B };
};

const z0_gap1 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  const w = T * 1.2;
  return { obstacles: [gap(x, w)], width: B + w + B };
};

const z0_gap2 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  const w = T * 2.0;
  return { obstacles: [gap(x, w)], width: B + w + B };
};

// 1T block — jump over it.
const z0_blk1 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [blk(x, T, T)], width: B + T + B };
};

// Wide 2T platform.
const z0_blk2 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [blk(x, T * 2, T)], width: B + T * 2 + B };
};

// 2T tall block — needs full arc to clear.
const z0_blk2h = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [blk(x, T, T * 2)], width: B + T + B };
};

// Block then spike — land on block, hop over spike.
const z0_blkSpk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(blk(x, T, T));
  obs.push(...sp(x + T + 22, 1));
  return { obstacles: obs, width: B + T + 22 + SW + B };
};

// Spike then block.
const z0_spkBlk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 1));
  obs.push(blk(x + SW + AS, T, T));
  return { obstacles: obs, width: B + SW + AS + T + B };
};

// Spike then gap.
const z0_spkGap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 1));
  obs.push(gap(x + SW + AS, T * 1.2));
  return { obstacles: obs, width: B + SW + AS + T * 1.2 + B };
};

// SM core rhythm: spike → gap → double spike.
const z0_smRhythm = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(...sp(x, 1)); x += SW + AS;
  obs.push(gap(x, T * 1.2)); x += T * 1.2 + AS;
  obs.push(...sp(x, 2)); x += SW * 2;
  return { obstacles: obs, width: x + B - x0 };
};

// Classic GD “pulse”: single spike — short gap — repeat (readable sync).
const z0_gdPulse = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  const gapW = T * 1.15;
  const beat = 32;
  for (let i = 0; i < 4; i++) {
    obs.push(...sp(x, 1));
    x += SW + beat;
    obs.push(gap(x, gapW));
    x += gapW + beat;
  }
  return { obstacles: obs, width: x + B - x0 };
};

// Block — gap — block (early GD platform cadence).
const z0_blockGapWave = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  const gapW = T * 1.25;
  for (let i = 0; i < 3; i++) {
    obs.push(blk(x, T, T));
    x += T + 36;
    obs.push(gap(x, gapW));
    x += gapW + 36;
  }
  return { obstacles: obs, width: x + B - x0 };
};

// SM 4-step staircase. Steps: 1T, 2T (capped). Player hops up two steps.
// In SM the stair has 4 physical steps but the jump mechanic means you hop
// every tile. We do 2 rising steps (1T → 2T) then flat, readable.
const z0_stair4 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  // Step 1 (1T), Step 2 (2T), then two flat 2T blocks to run across the top
  obs.push(blk(x, T, T));  x += T + 4;
  obs.push(blk(x, T, T * 2)); x += T + 4;
  obs.push(blk(x, T, T * 2)); x += T + 4;
  // Step down: 1T block then flat ground
  obs.push(blk(x, T, T)); x += T + 4;
  return { obstacles: obs, width: x + B - x0 };
};

// 2-step stair up with spike entry.
const z0_stair2spk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(...sp(x, 1)); x += SW + AS;
  x = stairsUp(obs, x, 2);
  return { obstacles: obs, width: x + B - x0 };
};

// Up-down mountain: 1T up → 2T up → 2T down → 1T down.
const z0_mountain = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(blk(x, T, T));   x += T + 4;
  obs.push(blk(x, T, T*2)); x += T + 4;
  obs.push(blk(x, T, T*2)); x += T + 4;
  obs.push(blk(x, T, T));   x += T + 4;
  return { obstacles: obs, width: x + B - x0 };
};

// Alternating tall-low: 2T block → spike → 1T block → 2 spikes.
const z0_altHiLo = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(blk(x, T, T * 2)); x += T + 22;
  obs.push(...sp(x, 1)); x += SW + AS;
  obs.push(blk(x, T, T)); x += T + 22;
  obs.push(...sp(x, 2)); x += SW * 2;
  return { obstacles: obs, width: x + B - x0 };
};

// Block then 2 spikes.
const z0_blk2spk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(blk(x, T, T));
  obs.push(...sp(x + T + 20, 2));
  return { obstacles: obs, width: B + T + 20 + SW * 2 + B };
};

// ── ZONE 1 — Void Garden (≈ Back On Track) ───────────────────────────────

// BOT-style column walls: 3 columns max 2T tall with wide gaps.
// Gaps of 40px are jumpable (player jump dist ≈ 103px).
const z1_colWalls = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(blk(x, T, T * 2)); x += T + 44;
  obs.push(blk(x, T, T));     x += T + 44;
  obs.push(blk(x, T, T * 2)); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

// Platform chain: 4 platforms at 1T height.
const z1_platforms = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  for (let i = 0; i < 4; i++) {
    obs.push(blk(x, T * 2, T));
    x += T * 2 + 36;
  }
  return { obstacles: obs, width: x + B - x0 };
};

// Double mountain.
const z1_dblMtn = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  // Mountain 1
  obs.push(blk(x, T, T)); x += T + 4;
  obs.push(blk(x, T, T*2)); x += T + 4;
  obs.push(blk(x, T, T)); x += T + 28;
  // Mountain 2
  obs.push(blk(x, T, T)); x += T + 4;
  obs.push(blk(x, T, T*2)); x += T + 4;
  obs.push(blk(x, T, T)); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

// 2 spikes then 2T tall block — spikes force a jump, block is after landing.
const z1_2spkBlk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 2));
  obs.push(blk(x + SW * 2 + AS, T, T * 2));
  return { obstacles: obs, width: B + SW * 2 + AS + T + B };
};

// Platform with spike on back edge — land on front half, then hop spike.
const z1_platTrap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  // 3T wide platform at 1T height
  obs.push(blk(x, T * 3, T));
  // Spike ON TOP of the platform — place it at platform-top y
  obs.push({
    kind: 'spike',
    x: x + T * 2,
    y: GROUND_Y - T - SH,  // sits on top of the 1T platform
    w: SW, h: SH,
  });
  return { obstacles: obs, width: B + T * 3 + B };
};

// 3 tall (2T) blocks with generous spacing.
const z1_tallRun = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  for (let i = 0; i < 3; i++) {
    obs.push(blk(x, T, T * 2));
    x += T + 72; // generous landing clearance after 2T jump
  }
  return { obstacles: obs, width: x + B - x0 };
};

// ── ZONE 2 — Neon Abyss (≈ Polargeist) ──────────────────────────────────

// Orb over a 2T gap — learn orb mechanic safely.
const z2_orbGap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  const gw = T * 2;
  obs.push(gap(x, gw));
  obs.push(orb(x + gw / 2, T * 1.2));
  x += gw;
  return { obstacles: obs, width: x + B - x0 };
};

// Orb then triple spike (raw 3-spike alone is unfair in mixed pools).
const z2_orbThenS3 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(orb(x + T * 0.55, T * 1.38));
  x += T * 2.5 + 24;
  obs.push(...sp(x, 3));
  x += SW * 3;
  return { obstacles: obs, width: x + B - x0 };
};

// Orb before 4 spikes — the Polargeist signature moment.
// Orb is placed with plenty of runway (T*3 before spikes) so player can see it.
const z2_orbSpike4 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(orb(x + T, T * 1.4)); // orb with T of runway before it
  x += T * 3 + 12;               // generous space after orb before spikes
  obs.push(...sp(x, 4));
  x += SW * 4;
  return { obstacles: obs, width: x + B - x0 };
};

// Orb then double spike — orb was overlapping spike 2 when centered at x+SW (unfair).
const z2_orbSpk2 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(orb(x + T * 0.55, T * 1.45));
  x += T * 2 + 32;
  obs.push(...sp(x, 2));
  x += SW * 2;
  return { obstacles: obs, width: x + B - x0 };
};

// Orb chain — 3 orbs at varied heights (no hazards, pure orb practice).
const z2_orbChain = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(orb(x, T * 1.0)); x += T * 2.6;
  obs.push(orb(x, T * 1.8)); x += T * 2.6;
  obs.push(orb(x, T * 1.0)); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

// Descending column maze — starts at 2T and descends (safe: 2T max).
const z2_descCols = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  // 2T → 1T → 1T → gap: player hops down
  obs.push(blk(x, T, T * 2)); x += T + 44;
  obs.push(blk(x, T, T));     x += T + 44;
  obs.push(blk(x, T, T));     x += T;
  return { obstacles: obs, width: x + B - x0 };
};

// Ceiling spike strip — dropY=64, so bottom=88. Player apex top=61. Safe to jump under.
const z2_ceilStrip = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: csp(x, 4), width: B + SW * 4 + B };
};

// Ceiling spikes + one floor spike — floor hazard centered under gap (not under a ceiling tile).
const z2_corridor = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(...csp(x, 3));
  obs.push(...sp(x + SW * 1.35, 1));
  x += SW * 3 + 12;
  return { obstacles: obs, width: x + B - x0 };
};

// Ceiling column — hangs CEIL_SAFE=60px down. Player can jump under.
// Col bottom = 60. Player apex top = 61. Barely fits — player can walk under freely.
const z2_ceilCol = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [cblk(x, T)], width: B + T + B };
};

// Two ceiling cols — same safe hang depth.
const z2_ceilCol2 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(cblk(x, T)); x += T + 56;
  obs.push(cblk(x, T)); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

// Ceiling col then ground spike.
const z2_ceilColSpk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(cblk(x, T)); x += T + 30;
  obs.push(...sp(x, 1)); x += SW;
  return { obstacles: obs, width: x + B - x0 };
};

// Orb over a wider 3T gap.
const z2_orbGap3 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  const gw = T * 2.8;
  obs.push(gap(x, gw));
  obs.push(orb(x + gw / 2, T * 1.3));
  x += gw;
  return { obstacles: obs, width: x + B - x0 };
};

// ── ZONE 3 — Pulse Inferno (≈ Dry Out+) ─────────────────────────────────

// Stair up with spike on 2nd tread. Fixed: only 2 steps (max 2T).
const z3_stairTread = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  x = stairsUp(obs, x, 2, [false, true]);
  return { obstacles: obs, width: x + BS - x0 };
};

// Mountain with tread spike at peak. Fixed: 1T→2T→2T→1T with spike on 2T tread.
const z3_mtnTread = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(blk(x, T, T)); x += T + 4;
  // 2T tread with spike on back edge
  obs.push(blk(x, T, T*2));
  obs.push({ kind: 'spike', x: x + T - SW, y: GROUND_Y - T*2 - SH, w: SW, h: SH });
  x += T + 4;
  obs.push(blk(x, T, T*2)); x += T + 4;
  obs.push(blk(x, T, T));   x += T;
  return { obstacles: obs, width: x + BS - x0 };
};

// Ceiling run + single floor spike (readable “duck the spike” — old 2-floor version was too tight).
const z3_hardCorridor = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(...csp(x, 4));
  obs.push(...sp(x + SW * 1.75, 1));
  x += SW * 4 + 16;
  return { obstacles: obs, width: x + BS - x0 };
};

// Gap → spike → gap → spike rhythm.
const z3_gapSpkWave = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(gap(x, T * 1.2)); x += T * 1.2 + 20;
  obs.push(...sp(x, 1)); x += SW + 20;
  obs.push(gap(x, T * 1.2)); x += T * 1.2 + 20;
  obs.push(...sp(x, 1)); x += SW;
  return { obstacles: obs, width: x + BS - x0 };
};

// Triple gap chain.
const z3_tripleGap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  for (let i = 0; i < 3; i++) {
    obs.push(gap(x, T * 1.2));
    x += T * 1.2 + 20;
  }
  return { obstacles: obs, width: x + BS - x0 };
};

// Orb chain over a long pit (wider pit + even spacing — old layout was failure-prone).
const z3_orbPit = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  const gw = T * 6.4;
  obs.push(gap(x, gw));
  obs.push(orb(x + T * 1.15, T * 1.05));
  obs.push(orb(x + T * 3.2, T * 1.95));
  obs.push(orb(x + T * 5.25, T * 1.05));
  x += gw;
  return { obstacles: obs, width: x + BS - x0 };
};

// Ceiling col row — 3 cols, all CEIL_SAFE depth.
const z3_ceilColRow = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  for (let i = 0; i < 3; i++) {
    obs.push(cblk(x, T));
    x += T + 48;
  }
  return { obstacles: obs, width: x + BS - x0 };
};

// Ceiling column — runway — spike — runway (interleaved was easy to clip).
const z3_ceilColsSpks = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(cblk(x, T));
  x += T + 44;
  obs.push(...sp(x, 1));
  x += SW + 44;
  obs.push(cblk(x, T));
  x += T + 20;
  return { obstacles: obs, width: x + BS - x0 };
};

// Orb + 3 spikes (not 4 — safer for zone 3).
const z3_orbSpk3 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(orb(x + T, T * 1.4)); // clear telegraph
  x += T * 3;
  obs.push(...sp(x, 3)); x += SW * 3;
  return { obstacles: obs, width: x + BS - x0 };
};

// ─────────────────────────────────────────────────────────────────────────
// POOLS
// ─────────────────────────────────────────────────────────────────────────

// Zone 0 — strictly ordered (Stereo Madness progression)
const Z0: readonly ((x: number) => PlacedSegment)[] = [
  z0_intro,      // 0  long run-in
  z0_s1,         // 1  first spike
  z0_blk1,       // 2  first block
  z0_s2,         // 3  double spike
  z0_s1,         // 4  single again
  z0_gap1,       // 5  first gap
  z0_gdPulse,    // 6  GD-style spike–gap pulse
  z0_rest,       // 7  rest
  z0_blk2,       // 8  wide platform
  z0_blkSpk,     // 9  block+spike combo
  z0_stair4,     // 10 THE staircase
  z0_rest,       // 11 rest
  z0_spkGap,     // 12 spike→gap
  z0_smRhythm,   // 13 SM rhythm
  z0_blockGapWave, // 14 block–gap–block wave
  z0_altHiLo,    // 15 high-low alternation
  z0_blk2h,      // 16 tall block
  z0_s2,         // 17
  z0_stair2spk,  // 18 stair with entry spike
  z0_mountain,   // 19 up-down mountain
  z0_rest,       // 20
  z0_s3,         // 21 triple spike (tutorial capstone)
  z0_blk2spk,    // 22 block then spikes
  z0_spkBlk,     // 23 spike then block
];

// Zone 1 — Back On Track style
const Z1: readonly ((x: number) => PlacedSegment)[] = [
  z0_gdPulse,
  z1_colWalls,
  z1_platforms,
  z0_blockGapWave,
  z1_dblMtn,
  z1_2spkBlk,
  z1_platTrap,
  z1_tallRun,
  z2_orbThenS3,
  z0_smRhythm,
  z0_mountain,
  z0_stair4,
  z0_altHiLo,
  z0_rest,
];

// Zone 2 — Polargeist style
const Z2: readonly ((x: number) => PlacedSegment)[] = [
  z2_orbGap,
  z2_orbSpike4,
  z2_orbSpk2,
  z2_orbChain,
  z2_descCols,
  z2_ceilStrip,
  z2_corridor,
  z2_ceilCol,
  z2_ceilCol2,
  z2_ceilColSpk,
  z2_orbGap3,
  z2_orbThenS3,
  z0_smRhythm,
  z1_colWalls,
  z0_rest,
];

// Zone 3 — Dry Out+ style
const Z3: readonly ((x: number) => PlacedSegment)[] = [
  z3_gapSpkWave,
  z3_stairTread,
  z3_mtnTread,
  z0_gdPulse,
  z3_tripleGap,
  z3_orbPit,
  z3_ceilColRow,
  z3_orbSpk3,
  z2_ceilCol2,
  z3_ceilColsSpks,
  z3_hardCorridor,
  z2_orbSpike4,
  z0_blockGapWave,
  z0_rest,
];

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export const PATTERN_SEGMENTS: readonly ((x: number) => PlacedSegment)[] = [
  ...Z0, ...Z1, ...Z2, ...Z3,
] as const;

export const PATTERN_SEGMENT_COUNT = PATTERN_SEGMENTS.length;

export function getTier(scroll: number): number {
  return Math.min(NR.MAX_TIER, Math.floor(scroll / NR.SCROLL_PER_TIER));
}

function pick<T>(pool: readonly T[], seq: number, seed: number): T {
  return pool[((seq * 2654435761 + seed * 374761393) >>> 0) % pool.length]!;
}

function pickFn(scroll: number, seq: number, seed: number): (x: number) => PlacedSegment {
  const tier = getTier(scroll);
  if (tier <= 1) return Z0[seq % Z0.length]!;
  if (tier <= 3) {
    const r = ((seq * 1664525 + seed * 1013904223) >>> 0) % 10;
    return r < 2 ? Z0[seq % Z0.length]! : pick(Z1, seq, seed);
  }
  if (tier <= 5) {
    const r = ((seq * 2246822519 + seed * 2654435761) >>> 0) % 10;
    return r < 2 ? pick(Z1, seq, seed) : pick(Z2, seq, seed);
  }
  const r = ((seq * 1664525 + seed * 22695477) >>> 0) % 5;
  return r < 1 ? pick(Z2, seq, seed) : pick(Z3, seq, seed);
}

export interface GenerationState {
  obstacles: import('./types').Obstacle[];
  genCursor: number;
  nextPatternIndex: number;
  scroll: number;
  seed: number;
}

export function generateAhead(state: GenerationState, playerWorldX: number): void {
  const lookahead = NR.PLAY_W * 3.5;
  while (state.genCursor < playerWorldX + lookahead) {
    const fn = pickFn(state.scroll, state.nextPatternIndex, state.seed);
    state.nextPatternIndex++;
    const placed = fn(state.genCursor);
    state.obstacles.push(...placed.obstacles);
    state.genCursor += placed.width;
  }
}

const MAX_OBS = 420;

export function cullObstacles(obs: import('./types').Obstacle[], playerWorldX: number): void {
  const minX = playerWorldX - NR.PLAY_W * 2;
  let i = 0;
  while (i < obs.length && obs[i]!.x + obs[i]!.w < minX) i++;
  if (i > 0) obs.splice(0, i);
  if (obs.length > MAX_OBS) obs.splice(0, obs.length - MAX_OBS);
}