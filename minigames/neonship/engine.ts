import {
  FORWARD_PX_S,
  GAP_H_MAX,
  GAP_H_MIN,
  GRAVITY_PX_S2,
  MARGIN,
  MAX_VY,
  SEG_W_MAX,
  SEG_W_MIN,
  SHIP_H,
  SHIP_W,
  SHIP_X_OFFSET,
  SPIKE_H,
  SPIKE_HW,
  SPIKE_SPACING_MAX,
  SPIKE_SPACING_MIN,
  THRUST_PX_S2,
} from '@/minigames/neonship/constants';
import type { CorridorSegment, Spike } from '@/minigames/neonship/types';

function mulberry32(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type ShipGameState = {
  seed: number;
  playH: number;
  scroll: number;
  shipY: number;
  shipVy: number;
  alive: boolean;
  /** Distance score (world px traveled / scale). */
  score: number;
  tapCount: number;
  segments: CorridorSegment[];
  spikes: Spike[];
  nextSegX: number;
  nextSpikeX: number;
  rand: () => number;
};

export function createShipGame(seed: number, playH: number): ShipGameState {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const g: ShipGameState = {
    seed,
    playH,
    scroll: 0,
    shipY: playH * 0.5,
    shipVy: 0,
    alive: true,
    score: 0,
    tapCount: 0,
    segments: [],
    spikes: [],
    nextSegX: SHIP_X_OFFSET + 280,
    nextSpikeX: SHIP_X_OFFSET + 520,
    rand,
  };
  while (g.segments.length < 6) {
    pushSegment(g);
  }
  // seed initial spikes beyond the opening safe zone
  while (g.nextSpikeX < g.nextSegX + 400) {
    pushSpike(g);
  }
  return g;
}

function pushSegment(g: ShipGameState): void {
  const r = g.rand;
  const w = SEG_W_MIN + Math.floor(r() * (SEG_W_MAX - SEG_W_MIN + 1));
  const gapH = GAP_H_MIN + Math.floor(r() * (GAP_H_MAX - GAP_H_MIN + 1));
  const maxCenter = g.playH - MARGIN - gapH / 2;
  const minCenter = MARGIN + gapH / 2;
  const gapCenter = minCenter + r() * Math.max(1, maxCenter - minCenter);
  const topH = Math.max(MARGIN, gapCenter - gapH / 2);
  const bottomH = Math.max(MARGIN, g.playH - (gapCenter + gapH / 2));
  const x0 = g.nextSegX;
  const x1 = x0 + w;
  g.segments.push({ x0, x1, topH, bottomH });
  g.nextSegX = x1 + 8;
}

/** Find the corridor segment whose x-range contains worldX, or null. */
function segmentAt(g: ShipGameState, worldX: number): CorridorSegment | null {
  for (const seg of g.segments) {
    if (worldX >= seg.x0 && worldX < seg.x1) return seg;
  }
  return null;
}

function pushSpike(g: ShipGameState): void {
  const r = g.rand;
  const onTop = r() > 0.5;
  g.spikes.push({
    x: g.nextSpikeX,
    onTop,
    hw: SPIKE_HW,
    h: SPIKE_H,
  });
  g.nextSpikeX += SPIKE_SPACING_MIN + Math.floor(r() * (SPIKE_SPACING_MAX - SPIKE_SPACING_MIN + 1));
}

export function shipWorldX(g: ShipGameState): number {
  return g.scroll + SHIP_X_OFFSET;
}

function pruneSegments(g: ShipGameState): void {
  const sx = shipWorldX(g);
  while (g.segments.length > 0 && g.segments[0]!.x1 < sx - 80) {
    g.segments.shift();
  }
}

function pruneSpikes(g: ShipGameState): void {
  const sx = shipWorldX(g);
  while (g.spikes.length > 0 && g.spikes[0]!.x + g.spikes[0]!.hw < sx - 60) {
    g.spikes.shift();
  }
}

function collide(g: ShipGameState): boolean {
  const sx = shipWorldX(g);
  const sy = g.shipY;

  // Wall collision
  for (const seg of g.segments) {
    if (sx + SHIP_W <= seg.x0 || sx >= seg.x1) continue;
    const hitTop = sy < seg.topH;
    const hitBottom = sy + SHIP_H > g.playH - seg.bottomH;
    if (hitTop || hitBottom) return true;
  }

  // Spike collision
  for (const spike of g.spikes) {
    const sLeft = spike.x - spike.hw;
    const sRight = spike.x + spike.hw;
    if (sx + SHIP_W <= sLeft || sx >= sRight) continue;

    const seg = segmentAt(g, spike.x);
    if (!seg) continue;

    if (spike.onTop) {
      // Spike hangs down from top wall surface
      const spikeBase = seg.topH;
      const spikeTip = spikeBase + spike.h;
      if (sy < spikeTip && sy + SHIP_H > spikeBase) return true;
    } else {
      // Spike protrudes up from bottom wall surface
      const spikeBase = g.playH - seg.bottomH;
      const spikeTip = spikeBase - spike.h;
      if (sy + SHIP_H > spikeTip && sy < spikeBase) return true;
    }
  }

  return false;
}

export function stepShipGame(g: ShipGameState, dtMs: number, thrust: boolean): void {
  if (!g.alive) return;
  const dt = Math.min(0.05, Math.max(0, dtMs / 1000));
  g.scroll += FORWARD_PX_S * dt;
  g.score = Math.floor(g.scroll / 8);

  let ay = GRAVITY_PX_S2;
  if (thrust) ay -= THRUST_PX_S2;
  g.shipVy = clamp(g.shipVy + ay * dt, -MAX_VY, MAX_VY);
  g.shipY += g.shipVy * dt;
  g.shipY = clamp(g.shipY, 4, g.playH - SHIP_H - 4);

  pruneSegments(g);
  pruneSpikes(g);

  while (g.nextSegX < g.scroll + 1200) {
    pushSegment(g);
  }
  while (g.nextSpikeX < g.scroll + 1400) {
    pushSpike(g);
  }

  if (collide(g)) {
    g.alive = false;
  }
}