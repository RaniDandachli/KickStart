import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Max wall-clock ms to advance simulation in one rAF tick (after a hitch or background).
 */
export const RAF_LOOP_MAX_ELAPSED_MS = 100;

/** @deprecated Use RAF_LOOP_MAX_ELAPSED_MS */
export const RAF_LOOP_MAX_DT_MS = RAF_LOOP_MAX_ELAPSED_MS;

/** Target physics step (~60Hz) when splitting one frame into multiple integrations. */
export const RAF_PHYSICS_STEP_MS = 1000 / 60;

/**
 * Run fixed-size integration steps in one JS turn. Stops early if `onStep` returns false.
 * Use from inside your rAF callback (one `useRafLoop` tick) so React Native renders once per frame.
 */
export function runFixedPhysicsSteps(
  totalMs: number,
  onStep: (dtMs: number) => boolean,
  stepMs: number = RAF_PHYSICS_STEP_MS,
): void {
  let left = totalMs;
  while (left > 0.0005) {
    const h = Math.min(stepMs, left);
    if (!onStep(h)) return;
    left -= h;
  }
}

/**
 * One callback per animation frame with the full (capped) elapsed ms.
 * Coalesce physics with `runFixedPhysicsSteps` inside the callback + a single setState.
 */
export function useRafLoop(cb: (dtMs: number) => void, enabled: boolean): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  const lastRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;
    const onAppState = (s: AppStateStatus) => {
      if (s === 'active') lastRef.current = performance.now();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    lastRef.current = performance.now();
    const loop = (now: number) => {
      const elapsed = Math.min(RAF_LOOP_MAX_ELAPSED_MS, Math.max(0, now - lastRef.current));
      lastRef.current = now;
      if (elapsed > 0.0005) cbRef.current(elapsed);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [enabled]);
}
