import { useEffect, useState } from 'react';

const MIN = 10;
const MAX = 37;

function randInt(lo: number, hi: number) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function clamp(n: number) {
  return Math.max(MIN, Math.min(MAX, n));
}

/** Marketing “players online” — drifts randomly between 10 and 37. */
export function useFloatingOnlineCount(intervalMs = 3200) {
  const [n, setN] = useState(() => randInt(MIN, MAX));
  useEffect(() => {
    const tick = () => {
      setN((prev) => clamp(prev + randInt(-4, 4)));
    };
    const id = setInterval(() => {
      tick();
    }, intervalMs + randInt(-700, 700));
    return () => clearInterval(id);
  }, [intervalMs]);
  return n;
}
