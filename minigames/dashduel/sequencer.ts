import { mulberry32 } from '@/minigames/core/seededRng';
import { DD } from '@/minigames/dashduel/constants';
import { ALL_MODULES, introModule, recoveryModule } from '@/minigames/dashduel/modules';
import type { Obstacle, SegmentEndTag, SegmentModule } from '@/minigames/dashduel/types';

/** Difficulty tier from world cursor (not scroll) — matches design: 0 intro, 1 mid, 2 late, 3 end. */
export function tierFromCursor(cursorX: number): number {
  if (cursorX < 900) return 0;
  if (cursorX < 3600) return 1;
  if (cursorX < 11000) return 2;
  return 3;
}

function pickModule(rng: () => number, tier: number, prevEnd: SegmentEndTag, cursorX: number): SegmentModule {
  const pool = ALL_MODULES.filter(
    (m) => m.tierMin <= tier && tier <= m.tierMax && m.startTags.includes(prevEnd),
  );
  if (pool.length === 0) return recoveryModule();
  // Bias recovery after harsh combos to avoid impossible chains.
  if (prevEnd === 'spike' && rng() < 0.28 && cursorX > 2000) {
    const rec = pool.find((m) => m.id === 'recovery');
    if (rec) return rec;
  }
  return pool[Math.floor(rng() * pool.length)]!;
}

/** Deterministic full course for fair 1v1 — both players use the same `seed`. */
export function buildCourse(seed: number): Obstacle[] {
  const rng = mulberry32(seed);
  const out: Obstacle[] = [];
  let cursor = 0;
  let prevEnd: SegmentEndTag = 'flat';

  const first = introModule();
  out.push(...first.build(cursor));
  cursor += first.width;
  prevEnd = first.endTag;

  let guard = 0;
  while (cursor < DD.COURSE_LENGTH && guard++ < 4000) {
    const tier = tierFromCursor(cursor);
    const m = pickModule(rng, tier, prevEnd, cursor);
    out.push(...m.build(cursor));
    cursor += m.width;
    prevEnd = m.endTag;
  }

  return out.sort((a, b) => {
    const ax = a.kind === 'gap' ? a.x0 : a.x0;
    const bx = b.kind === 'gap' ? b.x0 : b.x0;
    return ax - bx;
  });
}
