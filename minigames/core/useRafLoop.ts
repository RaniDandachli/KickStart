import { useEffect, useRef } from 'react';

/** requestAnimationFrame loop with clamped dt (ms). */
export function useRafLoop(cb: (dtMs: number) => void, enabled: boolean): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  const lastRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    lastRef.current = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(48, Math.max(0, now - lastRef.current));
      lastRef.current = now;
      cbRef.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [enabled]);
}
