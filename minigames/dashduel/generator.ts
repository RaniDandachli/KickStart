// ─── NEON RUNNER — Deterministic pattern course ────────────────────────────
// Stereo Madness–inspired patterns. GD stairs = solid ground columns, not ledges.

import { GROUND_Y, NR } from './constants';
import type { Obstacle } from './types';

export interface PlacedSegment {
  obstacles: Obstacle[];
  width: number;
}

const T = NR.TILE; // 24px

// ── GD spike geometry ─────────────────────────────────────────────────────
// Real GD: spike is narrower than a tile (~2/3 T wide, full T tall)
const SPIKE_W = Math.round(T * 0.67); // ~16px
const SPIKE_H = T;                     // 24px tall — pointy, imposing

// ── Layout ────────────────────────────────────────────────────────────────
const H_PAD = 96;          // breathing room between segments (at Speed 1, ~0.52s)
const SPIKE_GAP = 52;      // landing clearance after a spike group
const SPIKE_TIGHT = 1;     // flush cluster gap

// ── Helpers ───────────────────────────────────────────────────────────────

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

/**
 * Solid block column rising from the ground.
 * This is the real GD building block. `h` = height above ground.
 */
function col(x: number, w: number, h: number): Obstacle {
  return { kind: 'wall', x, y: GROUND_Y - h, w, h };
}

function ceilSpike(x: number, w: number, drop: number, h = 14): Obstacle {
  return { kind: 'ceilingSpike', x, y: drop, w, h };
}

// ─────────────────────────────────────────────────────────────────────────
// GD STAIR PATTERNS
//
// In Geometry Dash, stairs are solid columns built up from the floor:
//
//        ┌──┐
//     ┌──┤  │
//  ┌──┤  │  │
// ─┴──┴──┴──┴──  ← ground
//
// Each step is 1 tile wide, rising 1T per step.
// The player hops up each column in sequence.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ascending stair columns (Stereo Madness classic).
 * `n` steps, each 1T wide, heights: 1T, 2T, 3T … nT.
 * Gap between columns = `gap` (enough to hop but not float).
 */
function buildStairsUp(
  obs: Obstacle[],
  startX: number,
  n: number,
  gap = 4,
  /** Spike on the tread (Geometry Dash–style) — indexed per step, 0..n-1 */
  treadSpikes?: boolean[],
): number {
  let x = startX;
  for (let i = 0; i < n; i++) {
    const h = T * (i + 1);
    obs.push(col(x, T, h));
    if (treadSpikes?.[i]) {
      const topY = GROUND_Y - h;
      // Trailing edge of the tread — leaves the front/left of the step clear to land and jump over.
      const spikeLeft = Math.max(x + 2, x + T - SPIKE_W - 4);
      obs.push({
        kind: 'spike',
        x: spikeLeft,
        y: topY - SPIKE_H,
        w: SPIKE_W,
        h: SPIKE_H,
      });
    }
    x += T + gap;
  }
  return x;
}

/**
 * Descending columns after you're already elevated (e.g. peak of a mountain).
 * Heights left→right: nT, (n−1)T … 1T — hop down each tread.
 * Do NOT use at flat ground entry: first column would be nT tall and unclimbable.
 */
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
// SEGMENT LIBRARY
// ─────────────────────────────────────────────────────────────────────────

/** Flat ground, no hazards — tutorial run-in */
function segBreath(x0: number): PlacedSegment {
  return { obstacles: [], width: H_PAD + 120 + H_PAD };
}

/** Single ground spike */
function segSingleSpike(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: spike(x), width: H_PAD + SPIKE_W + H_PAD };
}

/** Two spikes flush — clear in one jump */
function segDoubleSpike(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return {
    obstacles: spike(x, 2),
    width: H_PAD + SPIKE_W * 2 + SPIKE_TIGHT + H_PAD,
  };
}

/** Three spikes flush */
function segTripleSpike(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return {
    obstacles: spike(x, 3),
    width: H_PAD + SPIKE_W * 3 + SPIKE_TIGHT * 2 + H_PAD,
  };
}

/** Narrow gap (1 tile) */
function segSmallGap(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  const w = T * 1.1;
  return { obstacles: [gapVoid(x, w)], width: H_PAD + w + H_PAD };
}

/** Wide gap (2 tiles) — hold jump */
function segWideGap(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  const w = T * 2;
  return { obstacles: [gapVoid(x, w)], width: H_PAD + w + H_PAD };
}

/** Single 1T block — jump over it */
function segBlock1(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: [col(x, T, T)], width: H_PAD + T + H_PAD };
}

/** Two adjacent 1T blocks — platform to land on */
function segBlock2(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: [col(x, T * 2, T)], width: H_PAD + T * 2 + H_PAD };
}

/** 2T tall column — need a clean jump to clear */
function segTallBlock(x0: number): PlacedSegment {
  const x = x0 + H_PAD;
  return { obstacles: [col(x, T, T * 2)], width: H_PAD + T + H_PAD };
}

/** GD classic: block then spike right after landing — jump on top, immediate hop */
function segBlockThenSpike(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T, T));
  x += T + 18;
  obs.push(...spike(x));
  x += SPIKE_W + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Spike then single block — jump spike, land on block */
function segSpikeThenBlock(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  obs.push(col(x, T, T));
  x += T + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Spike → gap — two rhythmic jumps */
function segSpikeGap(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  obs.push(gapVoid(x, T * 1.1));
  x += T * 1.1 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Stereo Madness section 1: 1 spike → gap → 2 spikes */
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

/**
 * TRUE GD ASCENDING STAIRS — 3 steps (1T → 2T → 3T solid ground columns).
 * Spike before entry sharpens jump timing into the first step.
 */
function segStairsUp3(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(...spike(x));
  x += SPIKE_W + SPIKE_GAP;
  x = buildStairsUp(obs, x, 3);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/**
 * 4-step ascending stair run — Stereo Madness long stair section.
 * Clean entry — let the player build rhythm.
 */
function segStairsUp4(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 4);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/**
 * Stair run from flat ground — must start at 1T (same as ascending).
 * (A true tall→short descent only works after a peak; see `buildStairsDownFromPeak`.)
 */
function segStairsDown4(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 4);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/**
 * Up-then-down stair set (GD "mountain" pattern).
 * 3 up → 3 down. Player bounces across the peak.
 */
function segStairsMountain(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 3, 2);
  x += 4;
  x = buildStairsDownFromPeak(obs, x, 3, 2);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** 1T block → 2 spikes after landing */
function segBlock1Spike2(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(col(x, T, T));
  x += T + 14;
  obs.push(...spike(x, 2));
  x += SPIKE_W * 2 + SPIKE_TIGHT + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Ceiling spike run — stay grounded */
function segCeilRun(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(ceilSpike(x, T * 3.5, 6, 14));
  x += T * 3.5 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Floor + ceiling — tight corridor with spaced floor spikes */
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

/** Gap then ceiling spike just past landing */
function segGapCeil(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(gapVoid(x, T * 1.2));
  x += T * 1.2 + 16;
  obs.push(ceilSpike(x, T * 2, 6, 13));
  x += T * 2 + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/**
 * Stereo Madness "zigzag" block section:
 * low block → spike → tall block → spike.
 */
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

// ── Late-game (tier 4+) — same run speed, denser hazards / stair tread traps ──

/** 3-up stairs with a spike on the middle tread — teaches stair+tread reads */
function segStairsUp3TreadMid(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 3, 4, [false, true, false]);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** 4-up with alternating tread spikes */
function segStairsUp4TreadAlt(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 4, 4, [true, false, true, false]);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Tight floor spike chain — each spike needs its own hop */
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

/** Longer low-ceiling corridor + three spaced floor spikes */
function segCorridorHard(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  const len = T * 6;
  obs.push(ceilSpike(x, len, 6, 13));
  obs.push(...spike(x + 22));
  obs.push(...spike(x + 22 + SPIKE_W + 70));
  obs.push(...spike(x + 22 + (SPIKE_W + 70) * 2));
  x += len + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Gap / spike / gap / spike — rhythm section */
function segVoidSpikeWave(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  obs.push(gapVoid(x, T * 1.05));
  x += T * 1.05 + 18;
  obs.push(...spike(x));
  x += SPIKE_W + 22;
  obs.push(gapVoid(x, T * 1.05));
  x += T * 1.05 + 18;
  obs.push(...spike(x));
  x += SPIKE_W + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/**
 * “Upside-down discipline” without flipping physics: very low ceiling strip
 * + one floor spike — stay small and time the hop (ship-style pressure, cube rules).
 */
function segLowCeilingFlyLane(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  const len = T * 7;
  obs.push(ceilSpike(x, len, 4, 16));
  obs.push(...spike(x + T * 2.25));
  x += len + H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Mountain stair with a tread spike on the 2nd step of the climb */
function segStairsMountainTread(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  x = buildStairsUp(obs, x, 3, 2, [false, true, false]);
  x += 4;
  x = buildStairsDownFromPeak(obs, x, 3, 2);
  x += H_PAD;
  return { obstacles: obs, width: x - x0 };
}

/** Three back-to-back pits — hold-jump rhythm */
function segTripleGapChain(x0: number): PlacedSegment {
  const obs: Obstacle[] = [];
  let x = x0 + H_PAD;
  for (let k = 0; k < 3; k++) {
    obs.push(gapVoid(x, T * 1.05));
    x += T * 1.05 + 16;
  }
  x += H_PAD - 16;
  return { obstacles: obs, width: x - x0 };
}

// ─────────────────────────────────────────────────────────────────────────
// PATTERN TABLE
// Ordered like Stereo Madness: easy tutorial → escalating rhythm → hard.
// ─────────────────────────────────────────────────────────────────────────

export const PATTERN_SEGMENTS: readonly ((x: number) => PlacedSegment)[] = [
  segBreath,           // 0  run-in flat
  segSingleSpike,      // 1  first obstacle
  segBlock1,           // 2  first block
  segDoubleSpike,      // 3
  segSingleSpike,      // 4  repeat
  segSmallGap,         // 5  first gap
  segBlock1,           // 6
  segStairsUp3,        // 7  first real GD stairs
  segBreath,           // 8  rest
  segSpikeGap,         // 9
  segBlock2,           // 10
  segDoubleSpike,      // 11
  segStairsUp4,        // 12 longer stair run
  segSM1,              // 13 Stereo Madness rhythm pattern
  segBlockThenSpike,   // 14
  segStairsDown4,      // 15 descending stairs
  segSpikeThenBlock,   // 16
  segTripleSpike,      // 17
  segStairsMountain,   // 18 up+down mountain
  segBreath,           // 19 rest
  segWideGap,          // 20
  segTallBlock,        // 21
  segBlock1Spike2,     // 22
  segCeilRun,          // 23 ceiling section
  segZigzag,           // 24 variable jumps
  segCorridor,         // 25 tight corridor
  segGapCeil,          // 26
  segStairsUp4,        // 27 callback
  segBlock1Spike2,     // 28
  segBreath,           // 29 rest
  // Late pool (scroll tier 4+; biased in when far enough)
  segStairsUp3TreadMid,
  segStairsUp4TreadAlt,
  segGauntletFloor,
  segCorridorHard,
  segVoidSpikeWave,
  segLowCeilingFlyLane,
  segStairsMountainTread,
  segTripleGapChain,
] as const;

export const PATTERN_SEGMENT_COUNT = PATTERN_SEGMENTS.length;

/** ~distance (px) per difficulty step; same run speed, patterns get denser */
const SCROLL_PER_TIER = 680;
/** First index of the “late” append-only pool (must match table order). */
const HARD_PATTERN_START = 30;

export interface GenerationState {
  obstacles: Obstacle[];
  genCursor: number;
  nextPatternIndex: number;
  scroll: number;
  seed: number;
}

function pickPatternIndex(scroll: number, seq: number, seed: number): number {
  const n = PATTERN_SEGMENTS.length;
  const tier = Math.min(8, Math.floor(scroll / SCROLL_PER_TIER));
  const introEnd = 16;
  const midEnd = 28;

  if (tier <= 1) {
    return seq % Math.min(introEnd + tier * 2, n);
  }
  if (tier <= 3) {
    return seq % Math.min(midEnd + (tier - 2) * 2, n);
  }

  const mix = ((seq * 2654435761 + seed * 374761393) >>> 0) % 256;
  if (tier >= 5 && HARD_PATTERN_START < n && mix < 130) {
    return HARD_PATTERN_START + (seq % (n - HARD_PATTERN_START));
  }
  return seq % n;
}

export function generateAhead(state: GenerationState, playerWorldX: number): void {
  const lookahead = NR.PLAY_W * 3;
  while (state.genCursor < playerWorldX + lookahead) {
    const seq = state.nextPatternIndex;
    const pi = pickPatternIndex(state.scroll, seq, state.seed) % PATTERN_SEGMENTS.length;
    const segFn = PATTERN_SEGMENTS[pi]!;
    state.nextPatternIndex++;
    const placed = segFn(state.genCursor);
    state.obstacles.push(...placed.obstacles);
    state.genCursor += placed.width;
  }
}

/** Hard cap so long runs can’t retain thousands of segments in memory (native crash risk). */
const MAX_OBSTACLES_RETAINED = 420;

export function cullObstacles(obstacles: Obstacle[], playerWorldX: number): void {
  const minX = playerWorldX - NR.PLAY_W * 2;
  let i = 0;
  while (i < obstacles.length && obstacles[i].x + obstacles[i].w < minX) i++;
  if (i > 0) obstacles.splice(0, i);
  if (obstacles.length > MAX_OBSTACLES_RETAINED) {
    obstacles.splice(0, obstacles.length - MAX_OBSTACLES_RETAINED);
  }
}