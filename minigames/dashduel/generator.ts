// ─── NEON RUNNER — Deterministic pattern course ────────────────────────────
// Stereo Madness–inspired patterns. GD stairs = solid ground columns, not ledges.
// Patterns scale through 4 zone themes as the player progresses.

import { GROUND_Y, NR } from './constants';
import type { Obstacle } from './types';

export interface PlacedSegment {
  obstacles: Obstacle[];
  width: number;
}

const T = NR.TILE; // 24px

// ── GD spike geometry ──────────────────────────────────────────────────────
const SPIKE_W = Math.round(T * 0.67); // ~16px
const SPIKE_H = T;                     // 24px

// ── Layout constants ───────────────────────────────────────────────────────
const H_PAD = 96;
const H_PAD_TIGHT = 60;    // tighter breathing room for mid/late game
const SPIKE_GAP = 52;
const SPIKE_TIGHT = 1;

// ── Helpers ────────────────────────────────────────────────────────────────

function spike(x: number, count = 1): Obstacle[] {
  const out: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      kind: 'spike',
      x: x + i * (SPIKE_W + SPIKE_TIGHT),
      y: GROUND_Y - SPIKE_H,
      w: SPIKE_W,
      h: SPIKE_H,
    });
  }
  return out;
}

function gapVoid(x: number, w: number): Obstacle {
  return { kind: 'void', x, y: GROUND_Y, w, h: NR.GROUND_H };
}

function col(x: number, w: number, h: number): Obstacle {
  return { kind: 'wall', x, y: GROUND_Y - h, w, h };
}

function ceilSpike(x: number, w: number, drop: number, h = 14): Obstacle {
  return { kind: 'ceilingSpike', x, y: drop, w, h };
}

function ring(x: number, yAboveGround: number): Obstacle {
  const sz = T * 0.9;
  return { kind: 'ring', x, y: GROUND_Y - NR.PLAYER_H - yAboveGround - sz / 2, w: sz, h: sz };
}

// ── Stair builders ─────────────────────────────────────────────────────────

function buildStairsUp(
  obs: Obstacle[],
  startX: number,
  n: number,
  gap = 4,
  treadSpikes?: boolean[],
): number {
  let x = startX;
  for (let i = 0; i < n; i++) {
    const h = T * (i + 1);
    obs.push(col(x, T, h));
    if (treadSpikes?.[i]) {
      const topY = GROUND_Y - h;
      const spikeLeft = Math.max(x + 2, x + T - SPIKE_W - 4);
      obs.push({ kind: 'spike', x: spikeLeft, y: topY - SPIKE_H, w: SPIKE_W, h: SPIKE_H });
    }
    x += T + gap;
  }
  return x;
}

function buildStairsDownFromPeak(obs: Obstacle[], startX: number, n: number, gap = 4): number {
  let x = startX;
  for (let i = n; i >= 1; i--) {
    const h = T * i;
    obs.push(col(x, T, h));
    x += T + gap;
  }
  return x;
}

// ─────────────────────────────────────────────────────────────────────────
// SEGMENT LIBRARY — Tier 0–1 (Stereo Madness / tutorial)
// ─────────────────────────────────────────────────────────────────────────

function segBreath(x0: number): PlacedSegment {
  return { obstacles: [], width: H_PAD + 120 + H_PAD };
}

function segBreathShort(x0: number): PlacedSegment {
  return { obstacles: [], width: H_PAD + 48 };
}

function segSingleSpike(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: spike(x), width: H_PAD + SPIKE_W + H_PAD };
}

function segDoubleSpike(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: spike(x, 2), width: H_PAD + SPIKE_W * 2 + SPIKE_TIGHT + H_PAD };
}

function segTripleSpike(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: spike(x, 3), width: H_PAD + SPIKE_W * 3 + SPIKE_TIGHT * 2 + H_PAD };
}

function segSmallGap(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  const w = T * 1.1;
  return { obstacles: [gapVoid(x, w)], width: H_PAD + w + H_PAD };
}

function segWideGap(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  const w = T * 2;
  return { obstacles: [gapVoid(x, w)], width: H_PAD + w + H_PAD };
}

function segBlock1(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: [col(x, T, T)], width: H_PAD + T + H_PAD };
}

function segBlock2(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: [col(x, T * 2, T)], width: H_PAD + T * 2 + H_PAD };
}

function segTallBlock(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: [col(x, T, T * 2)], width: H_PAD + T + H_PAD };
}

function segBlockThenSpike(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T, T));
  x += T + 18;
  obs.push(...spike(x));
  x += SPIKE_W + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segSpikeThenBlock(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  obs.push(col(x, T, T));
  x += T + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segSpikeGap(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  obs.push(gapVoid(x, T * 1.1));
  x += T * 1.1 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Stereo Madness section 1 rhythm: spike → gap → double spike */
function segSM1(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  obs.push(gapVoid(x, T * 1.1));
  x += T * 1.1 + SPIKE_GAP;
  obs.push(...spike(x, 2));
  x += SPIKE_W * 2 + SPIKE_TIGHT + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** SM classic: gap → block → spike */
function segSM2(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(gapVoid(x, T * 1.05));
  x += T * 1.05 + SPIKE_GAP;
  obs.push(col(x, T, T));
  x += T + 18;
  obs.push(...spike(x));
  x += SPIKE_W + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

// ── Ring segments ──────────────────────────────────────────────────────────

/** Orb jump over a gap — player hits ring mid-air */
function segRingGap(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  const gw = T * 1.8;
  obs.push(gapVoid(x, gw));
  // ring positioned above the gap center
  obs.push(ring(x + gw / 2 - T * 0.45, T * 1.4));
  x += gw + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Two rings in sequence — bounce-bounce rhythm */
function segDoubleRing(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(ring(x, T * 1.2));
  x += T * 3;
  obs.push(ring(x, T * 2.2));
  x += T * 2 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Ring over a spike */
function segRingSpike(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x + SPIKE_W * 0.5));
  obs.push(ring(x - T * 0.3, T * 1.8));
  x += SPIKE_W + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

// ── Stair segments ─────────────────────────────────────────────────────────

function segStairsUp3(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  x = buildStairsUp(obs, x, 3);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segStairsUp4(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 4);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segStairsDown4(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 4);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segStairsMountain(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 3, 2);
  x += 4;
  x = buildStairsDownFromPeak(obs, x, 3, 2);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Two mountains back to back — double hop rhythm */
function segDoubleMountain(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 2, 3);
  x += 6;
  x = buildStairsDownFromPeak(obs, x, 2, 3);
  x += 24;
  x = buildStairsUp(obs, x, 2, 3);
  x += 6;
  x = buildStairsDownFromPeak(obs, x, 2, 3);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segBlock1Spike2(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T, T));
  x += T + 14;
  obs.push(...spike(x, 2));
  x += SPIKE_W * 2 + SPIKE_TIGHT + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Low block + gap — quick hop to clear both */
function segBlockGap(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T, T));
  x += T + 20;
  obs.push(gapVoid(x, T * 1.1));
  x += T * 1.1 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

// ── Ceiling segments ───────────────────────────────────────────────────────

function segCeilRun(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(ceilSpike(x, T * 3.5, 6, 14));
  x += T * 3.5 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segCorridor(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  const len = T * 5;
  obs.push(ceilSpike(x, len, 7, 12));
  obs.push(...spike(x + 28));
  obs.push(...spike(x + 28 + SPIKE_W + 56));
  x += len + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segGapCeil(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(gapVoid(x, T * 1.2));
  x += T * 1.2 + 16;
  obs.push(ceilSpike(x, T * 2, 6, 13));
  x += T * 2 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

// ── Combo segments ─────────────────────────────────────────────────────────

/** Stereo Madness "zigzag" block section */
function segZigzag(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T, T));
  x += T + 20;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  obs.push(col(x, T, T * 2));
  x += T + 20;
  obs.push(...spike(x, 2));
  x += SPIKE_W * 2 + SPIKE_TIGHT + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Short repeating pattern: spike-gap-spike, very rhythmic */
function segRhythmicSpikes(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  for (let i = 0; i < 3; i++) {
    obs.push(...spike(x));
    x += SPIKE_W + 48;
  }
  x += H_PAD - 48;
  return { obstacles: obs, width: x - x0 };
}

/** Block platform with spike on far end — land, then jump again */
function segPlatformTrap(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T * 2, T));
  obs.push(...spike(x + T * 2 - SPIKE_W - 2, 1));
  x += T * 2 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Gap with ring above it, then a spike on landing */
function segRingGapSpike(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  const gw = T * 1.7;
  obs.push(gapVoid(x, gw));
  obs.push(ring(x + gw / 2 - T * 0.45, T * 1.5));
  x += gw + 28;
  obs.push(...spike(x));
  x += SPIKE_W + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

// ── Late-game / tier 4+ segments ───────────────────────────────────────────

function segStairsUp3TreadMid(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  x = buildStairsUp(obs, x, 3, 4, [false, true, false]);
  x += H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

function segStairsUp4TreadAlt(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  x = buildStairsUp(obs, x, 4, 4, [true, false, true, false]);
  x += H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

function segGauntletFloor(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  for (let i = 0; i < 5; i++) {
    obs.push(...spike(x));
    x += SPIKE_W + (i < 4 ? SPIKE_GAP : 0);
  }
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

function segCorridorHard(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  const len = T * 6;
  obs.push(ceilSpike(x, len, 6, 13));
  obs.push(...spike(x + 22));
  obs.push(...spike(x + 22 + SPIKE_W + 70));
  obs.push(...spike(x + 22 + (SPIKE_W + 70) * 2));
  x += len + H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

function segVoidSpikeWave(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  obs.push(gapVoid(x, T * 1.05));
  x += T * 1.05 + 18;
  obs.push(...spike(x));
  x += SPIKE_W + 22;
  obs.push(gapVoid(x, T * 1.05));
  x += T * 1.05 + 18;
  obs.push(...spike(x));
  x += SPIKE_W + H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

function segLowCeilingFlyLane(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  const len = T * 7;
  obs.push(ceilSpike(x, len, 4, 16));
  obs.push(...spike(x + T * 2.25));
  x += len + H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

function segStairsMountainTread(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  x = buildStairsUp(obs, x, 3, 2, [false, true, false]);
  x += 4;
  x = buildStairsDownFromPeak(obs, x, 3, 2);
  x += H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

function segTripleGapChain(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  for (let k = 0; k < 3; k++) {
    obs.push(gapVoid(x, T * 1.05));
    x += T * 1.05 + 16;
  }
  x += H_PAD_TIGHT - 16;
  return { obstacles: obs, width: x - x0 };
}

/** Ring chain over a long pit — 3 bounces */
function segRingChainPit(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  const pitW = T * 5.5;
  obs.push(gapVoid(x, pitW));
  obs.push(ring(x + T * 0.7, T * 1.2));
  obs.push(ring(x + T * 2.5, T * 2.0));
  obs.push(ring(x + T * 4.2, T * 1.2));
  x += pitW + H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

/** Staircase then immediate spike gauntlet — Back On Track feel */
function segStairsThenGauntlet(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  x = buildStairsUp(obs, x, 3, 3);
  x += 18;
  for (let i = 0; i < 3; i++) {
    obs.push(...spike(x));
    x += SPIKE_W + 46;
  }
  x += H_PAD_TIGHT - 46;
  return { obstacles: obs, width: x - x0 };
}

/** Very late: ceiling + floor simultaneous, single path */
function segDeathCorridor(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  const len = T * 8;
  obs.push(ceilSpike(x, len, 5, 15));
  // Floor spikes with exactly enough gaps to hop through
  obs.push(...spike(x + T * 1.5));
  obs.push(...spike(x + T * 3.5));
  obs.push(...spike(x + T * 5.8));
  x += len + H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

/** Double gap with a ring bridging them — fluid momentum section */
function segDoubleGapRing(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  obs.push(gapVoid(x, T * 1.1));
  x += T * 1.1 + 20;
  obs.push(ring(x, T * 1.6));
  x += T * 0.5;
  obs.push(gapVoid(x, T * 1.1));
  x += T * 1.1 + H_PAD_TIGHT;
  return { obstacles: obs, width: x - x0 };
}

/** Tall block gauntlet — each 2T block needs a full jump */
function segTallBlockRun(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD_TIGHT;
  for (let i = 0; i < 3; i++) {
    obs.push(col(x, T, T * 2));
    x += T + 52;
  }
  x += H_PAD_TIGHT - 52;
  return { obstacles: obs, width: x - x0 };
}

// ─────────────────────────────────────────────────────────────────────────
// PATTERN TABLE — Organized by tier pool
// ─────────────────────────────────────────────────────────────────────────

// Tier 0–1 pool (indices 0–15): Tutorial / Stereo Madness
const POOL_INTRO: readonly ((x: number) => PlacedSegment)[] = [
  segBreath,           // 0
  segSingleSpike,      // 1
  segBlock1,           // 2
  segDoubleSpike,      // 3
  segSingleSpike,      // 4
  segSmallGap,         // 5
  segBlock1,           // 6
  segBreath,           // 7
  segSpikeGap,         // 8
  segBlock2,           // 9
  segDoubleSpike,      // 10
  segBlockThenSpike,   // 11
  segSpikeThenBlock,   // 12
  segBreath,           // 13
  segSM1,              // 14
  segRhythmicSpikes,   // 15
];

// Tier 2–3 pool: Back On Track / Polargeist early
const POOL_MID: readonly ((x: number) => PlacedSegment)[] = [
  segStairsUp3,        // classic GD stairs
  segStairsUp4,
  segStairsMountain,
  segDoubleMountain,
  segWideGap,
  segTallBlock,
  segBlock1Spike2,
  segBlockGap,
  segPlatformTrap,
  segCeilRun,
  segZigzag,
  segCorridor,
  segGapCeil,
  segSM2,
  segRingGap,
  segRingSpike,
  segDoubleRing,
  segTripleSpike,
  segBreathShort,
  segStairsDown4,
];

// Tier 4–5 pool: Polargeist / Dry Out
const POOL_LATE: readonly ((x: number) => PlacedSegment)[] = [
  segStairsUp3TreadMid,
  segStairsUp4TreadAlt,
  segGauntletFloor,
  segCorridorHard,
  segVoidSpikeWave,
  segLowCeilingFlyLane,
  segStairsMountainTread,
  segTripleGapChain,
  segRingGapSpike,
  segRingChainPit,
  segStairsThenGauntlet,
  segDoubleGapRing,
  segTallBlockRun,
  segDoubleRing,
  segBreathShort,
];

// Tier 6–8 pool: Endgame (merges late + extra hard)
const POOL_HARD: readonly ((x: number) => PlacedSegment)[] = [
  segDeathCorridor,
  segGauntletFloor,
  segRingChainPit,
  segCorridorHard,
  segVoidSpikeWave,
  segStairsUp4TreadAlt,
  segTallBlockRun,
  segStairsThenGauntlet,
  segLowCeilingFlyLane,
  segStairsMountainTread,
  segTripleGapChain,
  segDoubleGapRing,
  segBreathShort,
];

// Flat combined array kept for legacy `PATTERN_SEGMENT_COUNT`
export const PATTERN_SEGMENTS: readonly ((x: number) => PlacedSegment)[] = [
  ...POOL_INTRO,
  ...POOL_MID,
  ...POOL_LATE,
  ...POOL_HARD,
] as const;

export const PATTERN_SEGMENT_COUNT = PATTERN_SEGMENTS.length;

export function getTier(scroll: number): number {
  return Math.min(NR.MAX_TIER, Math.floor(scroll / NR.SCROLL_PER_TIER));
}

function pickSegmentFromPool(
  pool: readonly ((x: number) => PlacedSegment)[],
  seq: number,
  seed: number,
): (x: number) => PlacedSegment {
  // Weighted random using LCG — feels less mechanical than pure sequential
  const n = pool.length;
  const mix = ((seq * 2654435761 + seed * 374761393) >>> 0) % n;
  return pool[mix]!;
}

export interface GenerationState {
  obstacles: import('./types').Obstacle[];
  genCursor: number;
  nextPatternIndex: number;
  scroll: number;
  seed: number;
}

function pickPatternFn(
  scroll: number,
  seq: number,
  seed: number,
): (x: number) => PlacedSegment {
  const tier = getTier(scroll);

  if (tier <= 1) {
    // Pure sequential through intro pool for first ~2 tiers — teaches mechanics
    return POOL_INTRO[seq % POOL_INTRO.length]!;
  }

  if (tier <= 3) {
    // Mix intro (20%) + mid (80%)
    const mix = ((seq * 1664525 + seed * 1013904223) >>> 0) % 100;
    if (mix < 20) return POOL_INTRO[seq % POOL_INTRO.length]!;
    return pickSegmentFromPool(POOL_MID, seq, seed);
  }

  if (tier <= 5) {
    // Mid (20%) + late (70%) + intro breath (10%)
    const mix = ((seq * 2246822519 + seed * 2654435761) >>> 0) % 100;
    if (mix < 10) return POOL_INTRO[seq % POOL_INTRO.length]!;
    if (mix < 30) return pickSegmentFromPool(POOL_MID, seq, seed);
    return pickSegmentFromPool(POOL_LATE, seq, seed);
  }

  // Tier 6+: mostly hard, sprinkle late for variety
  const mix = ((seq * 1664525 + seed * 22695477) >>> 0) % 100;
  if (mix < 15) return pickSegmentFromPool(POOL_LATE, seq, seed);
  return pickSegmentFromPool(POOL_HARD, seq, seed);
}

export function generateAhead(state: GenerationState, playerWorldX: number): void {
  const lookahead = NR.PLAY_W * 3;
  while (state.genCursor < playerWorldX + lookahead) {
    const seq = state.nextPatternIndex;
    const segFn = pickPatternFn(state.scroll, seq, state.seed);
    state.nextPatternIndex++;
    const placed = segFn(state.genCursor);
    state.obstacles.push(...placed.obstacles);
    state.genCursor += placed.width;
  }
}

const MAX_OBSTACLES_RETAINED = 420;

export function cullObstacles(obstacles: import('./types').Obstacle[], playerWorldX: number): void {
  const minX = playerWorldX - NR.PLAY_W * 2;
  let i = 0;
  while (i < obstacles.length && obstacles[i]!.x + obstacles[i]!.w < minX) i++;
  if (i > 0) obstacles.splice(0, i);
  if (obstacles.length > MAX_OBSTACLES_RETAINED) {
    obstacles.splice(0, obstacles.length - MAX_OBSTACLES_RETAINED);
  }
}