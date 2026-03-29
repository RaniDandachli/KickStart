import type { Obstacle, SegmentEndTag, SegmentModule } from '@/minigames/dashduel/types';
import { DD } from '@/minigames/dashduel/constants';

const G = DD.GROUND_Y;

function spike(base: number, dx: number, w: number, h: number, key: string): Obstacle {
  const x0 = base + dx;
  return {
    kind: 'spike',
    x0,
    x1: x0 + w,
    y0: G - h,
    y1: G,
    key,
  };
}

function gap(base: number, dx0: number, dx1: number, key: string): Obstacle {
  return { kind: 'gap', x0: base + dx0, x1: base + dx1, key };
}

function plat(base: number, dx0: number, dx1: number, yTop: number, key: string): Obstacle {
  return { kind: 'platform', x0: base + dx0, x1: base + dx1, yTop, key };
}

function ceil(base: number, dx0: number, dx1: number, y0: number, y1: number, key: string): Obstacle {
  return { kind: 'ceiling', x0: base + dx0, x1: base + dx1, y0, y1, key };
}

/** Intro — empty runway so the first 10s stay readable. */
export const M_INTRO: SegmentModule = {
  id: 'intro',
  width: 140,
  tierMin: 0,
  tierMax: 0,
  startTags: ['flat', 'gap', 'spike', 'air'],
  endTag: 'flat',
  build: () => [],
};

export const M_RECOVERY: SegmentModule = {
  id: 'recovery',
  width: 110,
  tierMin: 0,
  tierMax: 3,
  startTags: ['flat', 'spike', 'gap', 'air'],
  endTag: 'flat',
  build: () => [],
};

export const M_SINGLE_SPIKE: SegmentModule = {
  id: 'single_spike',
  width: 100,
  tierMin: 0,
  tierMax: 3,
  startTags: ['flat'],
  endTag: 'spike',
  build: (b) => [spike(b, 52, 9, 20, `${b}-s1`)],
};

export const M_DOUBLE_SPIKE: SegmentModule = {
  id: 'double_spike',
  width: 110,
  tierMin: 1,
  tierMax: 3,
  startTags: ['flat'],
  endTag: 'spike',
  build: (b) => [spike(b, 38, 8, 18, `${b}-d1`), spike(b, 72, 8, 18, `${b}-d2`)],
};

export const M_TRIPLE_SPIKE: SegmentModule = {
  id: 'triple_spike',
  width: 130,
  tierMin: 2,
  tierMax: 3,
  startTags: ['flat'],
  endTag: 'spike',
  build: (b) => [
    spike(b, 36, 7, 16, `${b}-t1`),
    spike(b, 64, 7, 16, `${b}-t2`),
    spike(b, 92, 7, 16, `${b}-t3`),
  ],
};

export const M_SMALL_GAP: SegmentModule = {
  id: 'small_gap',
  width: 105,
  tierMin: 0,
  tierMax: 3,
  startTags: ['flat', 'spike'],
  endTag: 'gap',
  build: (b) => [gap(b, 44, 78, `${b}-g1`)],
};

export const M_GAP_SPIKE: SegmentModule = {
  id: 'gap_spike',
  width: 125,
  tierMin: 1,
  tierMax: 3,
  startTags: ['flat'],
  endTag: 'spike',
  build: (b) => [gap(b, 32, 62, `${b}-gsg`), spike(b, 88, 9, 20, `${b}-gss`)],
};

export const M_RHYTHM: SegmentModule = {
  id: 'rhythm',
  width: 140,
  tierMin: 1,
  tierMax: 3,
  startTags: ['flat'],
  endTag: 'spike',
  build: (b) => [
    spike(b, 34, 7, 15, `${b}-r1`),
    spike(b, 58, 7, 15, `${b}-r2`),
    spike(b, 82, 7, 15, `${b}-r3`),
    spike(b, 106, 7, 15, `${b}-r4`),
  ],
};

export const M_PLATFORM_JUMP: SegmentModule = {
  id: 'platform_jump',
  width: 130,
  tierMin: 1,
  tierMax: 3,
  startTags: ['flat', 'spike'],
  endTag: 'air',
  build: (b) => [
    gap(b, 28, 52, `${b}-pj1`),
    plat(b, 58, 98, 138, `${b}-p1`),
    spike(b, 108, 8, 18, `${b}-pjs`),
  ],
};

export const M_LOW_CEILING: SegmentModule = {
  id: 'low_ceiling',
  width: 115,
  tierMin: 2,
  tierMax: 3,
  startTags: ['flat'],
  endTag: 'flat',
  build: (b) => [
    ceil(b, 40, 95, 0, 36, `${b}-c1`),
    spike(b, 52, 8, 17, `${b}-cs`),
  ],
};

export const M_PLATFORM_DROP: SegmentModule = {
  id: 'platform_drop',
  width: 120,
  tierMin: 1,
  tierMax: 3,
  startTags: ['flat', 'air'],
  endTag: 'gap',
  build: (b) => [
    plat(b, 22, 72, 142, `${b}-pd1`),
    gap(b, 78, 108, `${b}-pdg`),
  ],
};

export const M_COMBO_HARD: SegmentModule = {
  id: 'combo_hard',
  width: 150,
  tierMin: 3,
  tierMax: 3,
  startTags: ['flat', 'spike'],
  endTag: 'spike',
  build: (b) => [
    spike(b, 28, 8, 18, `${b}-ch1`),
    gap(b, 48, 72, `${b}-chg`),
    spike(b, 96, 9, 22, `${b}-ch2`),
    spike(b, 122, 8, 18, `${b}-ch3`),
  ],
};

export const ALL_MODULES: SegmentModule[] = [
  M_INTRO,
  M_RECOVERY,
  M_SINGLE_SPIKE,
  M_DOUBLE_SPIKE,
  M_TRIPLE_SPIKE,
  M_SMALL_GAP,
  M_GAP_SPIKE,
  M_RHYTHM,
  M_PLATFORM_JUMP,
  M_LOW_CEILING,
  M_PLATFORM_DROP,
  M_COMBO_HARD,
];

/** Safe fallbacks if pool is empty. */
export function recoveryModule(): SegmentModule {
  return M_RECOVERY;
}

export function introModule(): SegmentModule {
  return M_INTRO;
}

export function tagFromEnd(s: SegmentEndTag): SegmentEndTag {
  return s;
}
