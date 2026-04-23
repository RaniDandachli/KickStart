// ─── NEON RUNNER — Pattern Generator ──────────────────────────────────────
//
// PHYSICS (Speed 1 = 0.185 px/ms at 60fps ≈ 2.96 px/frame):
//   Jump arc: JUMP_V=-5.6, GRAVITY=0.32
//   Apex at frame ~17.5 → height ≈ 49px (~2 tiles)
//   Full airtime ~35 frames → horiz dist ≈ 103px ≈ 4.3 tiles
//
// GD OBSTACLE RULES (from actual level research):
//   Single spike (1T=24px wide): one clean jump
//   Double spike (2T=48px): one jump still clears (arc is wider than spike)
//   Triple spike (3T=72px): one FULL jump barely clears — hardest "raw" obstacle
//   4+ spikes in a row: IMPOSSIBLE without orb — never place bare
//   1T gap: easy jump
//   2T gap: hold jump needed
//   3T+ gap: needs orb
//   All obstacles placed with BREATH spacing so player sees them ~0.5s ahead
//
// LEVEL SEQUENCE (from GD research):
//
// ZONE 0 "Circuit Rush" ≈ Stereo Madness:
//   Long flat open → 1 spike → blocks → 4-step stair → flat → alternating
//   high/low blocks → 2 spikes → flat → triple spike (rare) → mountain stair
//
// ZONE 1 "Void Garden" ≈ Back On Track:
//   Block column walls with gaps → platform sequences → jump pads (orbs) →
//   more spike patterns
//
// ZONE 2 "Neon Abyss" ≈ Polargeist:
//   Orbs introduced → orb over gap → orb before 4-spike → descending cols
//   → ceiling hazards begin
//
// ZONE 3 "Pulse Inferno" ≈ Dry Out+:
//   Tread-spike stairs → hard corridors → dense rhythm patterns

import { GROUND_Y, NR } from './constants';
import type { Obstacle } from './types';

export interface PlacedSegment {
  obstacles: Obstacle[];
  width: number;
}

const T = NR.TILE; // 24px

// ── GD spike: full tile width (equilateral triangle aesthetic) ─────────────
const SW = T;   // 24px wide — same as a tile
const SH = T;   // 24px tall

// ── Spacing constants (tuned to physics) ──────────────────────────────────
// At 0.185 px/ms: 108px ≈ 584ms ≈ exactly 1 jump duration
// Player needs to SEE the obstacle before it arrives.
const B  = 108;  // standard breath — 1 full jump cycle
const BS = 72;   // short breath — late game tight sections
const AS = 56;   // after-spike landing clearance

// ─────────────────────────────────────────────────────────────────────────
// PRIMITIVE BUILDERS
// ─────────────────────────────────────────────────────────────────────────

/** Ground spike(s). Full tile wide, sitting on floor. */
function sp(x: number, n = 1): Obstacle[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'spike' as const,
    x: x + i * SW,
    y: GROUND_Y - SH,
    w: SW,
    h: SH,
  }));
}

/** Ceiling spike(s) hanging from dropY downward. */
function csp(x: number, dropY: number, n = 1): Obstacle[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'ceilingSpike' as const,
    x: x + i * SW,
    y: dropY,
    w: SW,
    h: SH,
  }));
}

/** Ground void gap. */
function gap(x: number, w: number): Obstacle {
  return { kind: 'void', x, y: GROUND_Y, w, h: NR.GROUND_H };
}

/** Block rising from ground. h = height above floor. */
function blk(x: number, w: number, h: number): Obstacle {
  return { kind: 'wall', x, y: GROUND_Y - h, w, h };
}

/** Block hanging from ceiling. h = how far down from y=0. */
function cblk(x: number, w: number, h: number): Obstacle {
  return { kind: 'wall', x, y: 0, w, h };
}

/** Jump orb. yHead = pixels above the player head when standing. */
function orb(x: number, yHead: number): Obstacle {
  const sz = Math.round(T * 0.8);
  return {
    kind: 'ring',
    x: x - sz / 2,
    y: GROUND_Y - NR.PLAYER_H - yHead - sz / 2,
    w: sz,
    h: sz,
  };
}

// ── Stair helpers ──────────────────────────────────────────────────────────

function stairsUp(obs: Obstacle[], x: number, n: number, treadSpikes?: boolean[]): number {
  for (let i = 0; i < n; i++) {
    const h = T * (i + 1);
    obs.push(blk(x, T, h));
    if (treadSpikes?.[i]) {
      // Spike on back edge of tread — land on front, then must hop
      obs.push({ kind: 'spike', x: x + T - SW, y: GROUND_Y - h - SH, w: SW, h: SH });
    }
    x += T + 4; // 4px gap between steps — tight but canonical GD
  }
  return x;
}

function stairsDown(obs: Obstacle[], x: number, n: number): number {
  for (let i = n; i >= 1; i--) {
    obs.push(blk(x, T, T * i));
    x += T + 4;
  }
  return x;
}

// ─────────────────────────────────────────────────────────────────────────
// SEGMENTS — Every obstacle position hand-validated against physics
// Format: all positions absolute from x0, width = total footprint
// ─────────────────────────────────────────────────────────────────────────

// ── ZONE 0 (Stereo Madness) ───────────────────────────────────────────────

/** Long opening flat — like SM's actual intro. */
const z0_intro = (x0: number): PlacedSegment =>
  ({ obstacles: [], width: B + 200 + B });

/** Short rest breath. */
const z0_rest = (x0: number): PlacedSegment =>
  ({ obstacles: [], width: B });

/** Single spike — SM's very first obstacle. */
const z0_s1 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: sp(x, 1), width: B + SW + B };
};

/** Double spike — still one clean jump. */
const z0_s2 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: sp(x, 2), width: B + SW * 2 + B };
};

/** Triple spike — SM's hardest "raw" obstacle, appears rarely. */
const z0_s3 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: sp(x, 3), width: B + SW * 3 + B };
};

/** 1T small gap. */
const z0_gap1 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [gap(x, T * 1.1)], width: B + T * 1.1 + B };
};

/** 2T gap — hold jump needed. */
const z0_gap2 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [gap(x, T * 2.0)], width: B + T * 2 + B };
};

/** 1T tall block — SM classic, jump over or onto. */
const z0_blk1 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [blk(x, T, T)], width: B + T + B };
};

/** Wide low platform (2T × 1T). */
const z0_blk2 = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [blk(x, T * 2, T)], width: B + T * 2 + B };
};

/** Tall block 2H — needs full arc. */
const z0_blk2h = (x0: number): PlacedSegment => {
  const x = x0 + B;
  return { obstacles: [blk(x, T, T * 2)], width: B + T + B };
};

/** SM classic: block immediately followed by spike. */
const z0_blkSpk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(blk(x, T, T));
  obs.push(...sp(x + T + 20, 1));
  return { obstacles: obs, width: B + T + 20 + SW + B };
};

/** Spike then block. */
const z0_spkBlk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 1));
  obs.push(blk(x + SW + AS, T, T));
  return { obstacles: obs, width: B + SW + AS + T + B };
};

/** Spike then gap — two rhythm jumps. */
const z0_spkGap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 1));
  obs.push(gap(x + SW + AS, T * 1.1));
  return { obstacles: obs, width: B + SW + AS + T * 1.1 + B };
};

/**
 * SM core rhythm section: 1 spike → gap → 2 spikes.
 * This is the actual repeating pattern from Stereo Madness.
 */
const z0_smRhythm = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(...sp(x, 1)); x += SW + AS;
  obs.push(gap(x, T * 1.1)); x += T * 1.1 + AS;
  obs.push(...sp(x, 2)); x += SW * 2;
  return { obstacles: obs, width: x + B - x0 };
};

/**
 * SM iconic 4-step ascending staircase.
 * Exact from research: "jump on all four steps".
 */
const z0_stair4 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  x = stairsUp(obs, x, 4);
  return { obstacles: obs, width: x + B - x0 };
};

/** 3-step stair with spike at entry (like SM's stair variant). */
const z0_stair3spk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(...sp(x, 1)); x += SW + AS;
  x = stairsUp(obs, x, 3);
  return { obstacles: obs, width: x + B - x0 };
};

/** Up-down mountain (3 up → 3 down). SM section 2. */
const z0_mountain = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  x = stairsUp(obs, x, 3);
  x = stairsDown(obs, x, 3);
  return { obstacles: obs, width: x + B - x0 };
};

/**
 * SM alternating high-low section:
 * tall block → spike → low block → spike.
 * "watch alternating high and low block sections"
 */
const z0_altHiLo = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(blk(x, T, T * 2)); x += T + 20;
  obs.push(...sp(x, 1)); x += SW + AS;
  obs.push(blk(x, T, T)); x += T + 20;
  obs.push(...sp(x, 2)); x += SW * 2;
  return { obstacles: obs, width: x + B - x0 };
};

/** SM block then 2 spikes. */
const z0_blk2spk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(blk(x, T, T));
  obs.push(...sp(x + T + 18, 2));
  return { obstacles: obs, width: B + T + 18 + SW * 2 + B };
};

// ── ZONE 1 (Back On Track) ────────────────────────────────────────────────

/**
 * BOT block column walls: 3 tall columns with gaps.
 * "three block columns" from BOT research.
 */
const z1_colWalls = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(blk(x, T, T * 2)); x += T + 40;
  obs.push(blk(x, T, T * 3)); x += T + 40;
  obs.push(blk(x, T, T * 2)); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

/**
 * BOT descending staircase — "a line of descending blocks".
 * Player hops down each step.
 */
const z1_descend4 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  x = stairsDown(obs, x, 4);
  return { obstacles: obs, width: x + B - x0 };
};

/**
 * BOT platform chain — "four adjacent narrow platforms".
 */
const z1_platforms = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  for (let i = 0; i < 4; i++) {
    obs.push(blk(x, T * 2, T));
    x += T * 2 + 36;
  }
  return { obstacles: obs, width: x + B - x0 };
};

/** Double mountain. */
const z1_dblMtn = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  x = stairsUp(obs, x, 2);
  x = stairsDown(obs, x, 2);
  x += 28;
  x = stairsUp(obs, x, 2);
  x = stairsDown(obs, x, 2);
  return { obstacles: obs, width: x + B - x0 };
};

/** 2 spikes then tall block. */
const z1_2spkBlk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 2));
  obs.push(blk(x + SW * 2 + AS, T, T * 2));
  return { obstacles: obs, width: B + SW * 2 + AS + T + B };
};

/** Block platform with spike near far end — land, see spike, hop. */
const z1_platTrap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(blk(x, T * 3, T));
  obs.push(...sp(x + T * 2, 1));
  return { obstacles: obs, width: B + T * 3 + B };
};

/** Tall block run — 3 separate tall blocks. */
const z1_tallRun = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  for (let i = 0; i < 3; i++) {
    obs.push(blk(x, T, T * 2));
    x += T + AS;
  }
  return { obstacles: obs, width: x + B - x0 };
};

// ── ZONE 2 (Polargeist) ───────────────────────────────────────────────────

/**
 * Polargeist signature: orb BEFORE a big spike cluster.
 * The orb gives a double-jump that clears what looks impossible.
 * Research: "the first jump uses an orb to help you get across the seemingly
 *  impossibly quadruple spike"
 */
const z2_orbSpike4 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(orb(x, T * 1.4));     // orb — hit it on approach
  x += T * 2 + 8;
  obs.push(...sp(x, 4));          // 4 spikes — cleared by double-jump
  x += SW * 4;
  return { obstacles: obs, width: x + B - x0 };
};

/** Orb over a gap — the basic Polargeist orb tutorial. */
const z2_orbGap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  const gw = T * 2;
  obs.push(gap(x, gw));
  obs.push(orb(x + gw / 2, T * 1.2));
  x += gw;
  return { obstacles: obs, width: x + B - x0 };
};

/** Orb above 2 spikes. */
const z2_orbSpk2 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...sp(x, 2));
  obs.push(orb(x + SW, T * 1.5));
  return { obstacles: obs, width: B + SW * 2 + B };
};

/** Polargeist orb chain — 3 orbs at varied heights. */
const z2_orbChain = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(orb(x, T * 1.0)); x += T * 2.5;
  obs.push(orb(x, T * 2.0)); x += T * 2.5;
  obs.push(orb(x, T * 1.0)); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

/** Polargeist descending column maze. */
const z2_descCols = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  for (let h = 4; h >= 1; h--) {
    obs.push(blk(x, T, T * h));
    x += T + 36;
  }
  return { obstacles: obs, width: x + B - x0 };
};

/** Ceiling spike strip — 4 tiles, player runs under. */
const z2_ceilStrip = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  const x = x0 + B;
  obs.push(...csp(x, 5, 4));
  return { obstacles: obs, width: B + SW * 4 + B };
};

/** Ceiling spike + floor spike — narrow corridor. */
const z2_corridor = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(...csp(x, 5, 3));
  obs.push(...sp(x + SW, 1));
  x += SW * 3;
  return { obstacles: obs, width: x + B - x0 };
};

/**
 * Ceiling-hanging block column — like the hanging blocks in screenshots.
 * Hangs down 55% of sky height — leaves ~T*2 clearance for player to walk under.
 */
const z2_ceilCol = (x0: number): PlacedSegment => {
  const h = Math.floor(GROUND_Y * 0.55);
  const x = x0 + B;
  return { obstacles: [cblk(x, T, h)], width: B + T + B };
};

/** Two ceiling columns alternating depth. */
const z2_ceilCol2 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(cblk(x, T, Math.floor(GROUND_Y * 0.50))); x += T + 52;
  obs.push(cblk(x, T, Math.floor(GROUND_Y * 0.62))); x += T;
  return { obstacles: obs, width: x + B - x0 };
};

/** Ceiling col then ground spike. */
const z2_ceilColSpk = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  obs.push(cblk(x, T, Math.floor(GROUND_Y * 0.52))); x += T + 28;
  obs.push(...sp(x, 1)); x += SW;
  return { obstacles: obs, width: x + B - x0 };
};

/** Orb over 3T gap. */
const z2_orbGap3 = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + B;
  const gw = T * 2.8;
  obs.push(gap(x, gw));
  obs.push(orb(x + gw / 2, T * 1.3));
  x += gw;
  return { obstacles: obs, width: x + B - x0 };
};

// ── ZONE 3 (Dry Out+) ─────────────────────────────────────────────────────

/** Stair with tread spike on step 2. */
const z3_stairTread = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  x = stairsUp(obs, x, 3, [false, true, false]);
  return { obstacles: obs, width: x + BS - x0 };
};

/** 4-step stair with alternating tread spikes. */
const z3_stairTreadAlt = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  x = stairsUp(obs, x, 4, [true, false, true, false]);
  return { obstacles: obs, width: x + BS - x0 };
};

/** Hard corridor: 6 ceiling spikes + 2 floor spikes timed. */
const z3_hardCorridor = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(...csp(x, 5, 6));
  obs.push(...sp(x + SW * 1, 1));
  obs.push(...sp(x + SW * 4, 1));
  x += SW * 6;
  return { obstacles: obs, width: x + BS - x0 };
};

/** Gap-spike-gap-spike rhythm. */
const z3_gapSpkWave = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(gap(x, T * 1.1)); x += T * 1.1 + 18;
  obs.push(...sp(x, 1)); x += SW + 18;
  obs.push(gap(x, T * 1.1)); x += T * 1.1 + 18;
  obs.push(...sp(x, 1)); x += SW;
  return { obstacles: obs, width: x + BS - x0 };
};

/** Triple gap chain. */
const z3_tripleGap = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  for (let i = 0; i < 3; i++) {
    obs.push(gap(x, T * 1.1));
    x += T * 1.1 + 18;
  }
  return { obstacles: obs, width: x + BS - x0 };
};

/** Mountain with tread spike at peak. */
const z3_mtnTread = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  x = stairsUp(obs, x, 3, [false, true, false]);
  x = stairsDown(obs, x, 3);
  return { obstacles: obs, width: x + BS - x0 };
};

/** Orb chain over a long pit. */
const z3_orbPit = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  const gw = T * 5.5;
  obs.push(gap(x, gw));
  obs.push(orb(x + T * 0.7, T * 1.0));
  obs.push(orb(x + T * 2.6, T * 2.1));
  obs.push(orb(x + T * 4.3, T * 1.0));
  x += gw;
  return { obstacles: obs, width: x + BS - x0 };
};

/** Ceiling col row — 3 hanging blocks at alternating depths. */
const z3_ceilColRow = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  [GROUND_Y * 0.48, GROUND_Y * 0.60, GROUND_Y * 0.50].forEach(h => {
    obs.push(cblk(x, T, Math.floor(h)));
    x += T + 44;
  });
  return { obstacles: obs, width: x + BS - x0 };
};

/** Ceiling cols interleaved with ground spikes. */
const z3_ceilColsSpks = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(cblk(x, T, Math.floor(GROUND_Y * 0.54))); x += T + 28;
  obs.push(...sp(x, 1)); x += SW + 28;
  obs.push(cblk(x, T, Math.floor(GROUND_Y * 0.50))); x += T + 28;
  obs.push(...sp(x, 1)); x += SW;
  return { obstacles: obs, width: x + BS - x0 };
};

/** Orb4spike variant + ceiling col. */
const z3_orbSpk4Ceil = (x0: number): PlacedSegment => {
  const obs: Obstacle[] = [];
  let x = x0 + BS;
  obs.push(cblk(x, T, Math.floor(GROUND_Y * 0.52)));
  obs.push(orb(x + T / 2, T * 1.5));
  x += T + 48;
  obs.push(...sp(x, 3)); x += SW * 3;
  return { obstacles: obs, width: x + BS - x0 };
};

// ─────────────────────────────────────────────────────────────────────────
// ZONE POOLS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Zone 0 — ordered exactly like Stereo Madness cube section progression.
 * Tiers 0–1 play through this strictly in order so each mechanic is introduced.
 */
const Z0: readonly ((x: number) => PlacedSegment)[] = [
  z0_intro,      // 0 long open run-in
  z0_s1,         // 1 first spike
  z0_blk1,       // 2 first block
  z0_s2,         // 3 double spike
  z0_s1,         // 4 repeat single
  z0_gap1,       // 5 first gap
  z0_rest,       // 6 short rest
  z0_blk2,       // 7 wide platform
  z0_blkSpk,     // 8 block + spike
  z0_stair4,     // 9 THE SM staircase
  z0_rest,       // 10 rest
  z0_spkGap,     // 11 spike → gap rhythm
  z0_smRhythm,   // 12 SM core rhythm
  z0_altHiLo,    // 13 alternating high-low
  z0_blk2h,      // 14 tall block
  z0_s2,         // 15
  z0_stair3spk,  // 16 stair with entry spike
  z0_mountain,   // 17 up-down mountain
  z0_rest,       // 18
  z0_s3,         // 19 triple spike — SM's hardest raw obstacle
  z0_blk2spk,    // 20 block then 2 spikes
  z0_spkBlk,     // 21 spike then block
];

/** Zone 1 — Back On Track style. */
const Z1: readonly ((x: number) => PlacedSegment)[] = [
  z1_colWalls,
  z1_descend4,
  z1_platforms,
  z1_dblMtn,
  z1_2spkBlk,
  z1_platTrap,
  z1_tallRun,
  z0_s3,
  z0_smRhythm,
  z0_mountain,
  z0_stair4,
  z0_altHiLo,
  z0_rest,
];

/** Zone 2 — Polargeist style. */
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
  z0_s3,
  z1_colWalls,
  z0_rest,
];

/** Zone 3 — Dry Out+ style. */
const Z3: readonly ((x: number) => PlacedSegment)[] = [
  z3_stairTread,
  z3_stairTreadAlt,
  z3_hardCorridor,
  z3_gapSpkWave,
  z3_tripleGap,
  z3_mtnTread,
  z3_orbPit,
  z3_ceilColRow,
  z3_ceilColsSpks,
  z3_orbSpk4Ceil,
  z2_orbSpike4,
  z2_ceilCol2,
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

  // Tiers 0–1: strictly sequential through Z0 — every mechanic taught in order
  if (tier <= 1) return Z0[seq % Z0.length]!;

  // Tiers 2–3: mostly Z1, sprinkle Z0 rest/rhythm
  if (tier <= 3) {
    const r = ((seq * 1664525 + seed * 1013904223) >>> 0) % 10;
    if (r < 2) return Z0[seq % Z0.length]!;
    return pick(Z1, seq, seed);
  }

  // Tiers 4–5: mostly Z2, some Z1
  if (tier <= 5) {
    const r = ((seq * 2246822519 + seed * 2654435761) >>> 0) % 10;
    if (r < 2) return pick(Z1, seq, seed);
    return pick(Z2, seq, seed);
  }

  // Tiers 6+: mostly Z3, some Z2
  const r = ((seq * 1664525 + seed * 22695477) >>> 0) % 5;
  if (r < 1) return pick(Z2, seq, seed);
  return pick(Z3, seq, seed);
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