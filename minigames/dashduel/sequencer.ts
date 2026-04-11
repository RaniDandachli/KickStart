/**
 * Test / debug helper: snapshot of generated obstacles for a forward simulation.
 * Runtime uses `generateAhead` incrementally from `engine.ts`.
 */
import { NR } from '@/minigames/dashduel/constants';
import { generateAhead, PATTERN_SEGMENT_COUNT } from '@/minigames/dashduel/patternCourse';
import type { Obstacle } from '@/minigames/dashduel/types';

/** Deterministic obstacle list (same seed → same layout; seed shifts pattern phase). */
export function buildCourse(seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const slice = {
    obstacles,
    genCursor: NR.PLAY_W * 1.2,
    nextPatternIndex: seed % PATTERN_SEGMENT_COUNT,
    scroll: 0,
    seed,
  };
  let px = 0;
  for (let i = 0; i < 100; i++) {
    generateAhead(slice, px);
    px += 320;
    slice.scroll += 320;
  }
  return [...obstacles].sort((a, b) => a.x - b.x);
}
