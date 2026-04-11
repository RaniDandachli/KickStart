import type { MutableRefObject } from 'react';

/** Default ~31fps — enough for score/HUD while cutting JS thread reconciles roughly in half vs 60fps rAF. */
export const MINIGAME_HUD_MS = 1000 / 31;
/** Faster cadence for games where motion is read from React state (moving block, scrolling tiles). ~40fps. */
export const MINIGAME_HUD_MS_MOTION = 1000 / 40;

/**
 * Gate `setUiTick` / `bump()` calls driven from {@link useRafLoop}. Physics can stay 60Hz in refs;
 * React only repaints at this interval unless you force a frame (tap, game over).
 */
export function shouldEmitMinigameHudFrame(
  lastEmitAtMs: MutableRefObject<number>,
  intervalMs: number = MINIGAME_HUD_MS,
): boolean {
  const now = performance.now();
  if (now - lastEmitAtMs.current >= intervalMs) {
    lastEmitAtMs.current = now;
    return true;
  }
  return false;
}

/** Call when starting a run so the first playing frame always paints. */
export function resetMinigameHudClock(lastEmitAtMs: MutableRefObject<number>): void {
  lastEmitAtMs.current = 0;
}
