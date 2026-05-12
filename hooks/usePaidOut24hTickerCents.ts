import { useEffect, useRef, useState } from 'react';

function randInt(lo: number, hi: number) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Seeded-ish floor so a cold refresh doesn’t always land on the same band. */
function sessionFloorCents() {
  const day = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  const spread = 450_000; // $4.5k spread
  return 220_000 + (Math.abs(h) % spread); // $2.2k–$6.7k
}

/**
 * Decorative “paid out · 24h” cents for empty lobby snapshots.
 * Climbs at irregular intervals/step sizes, then soft-resets and ramps again.
 */
export function usePaidOut24hTickerCents() {
  const floorRef = useRef(sessionFloorCents());
  const ceilingRef = useRef(floorRef.current + randInt(350_000, 1_100_000));
  const [cents, setCents] = useState(() => floorRef.current + randInt(5_000, 85_000));

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      // ~$8–$32 per tick; occasional larger “burst”
      const big = Math.random() < 0.12;
      const step = big ? randInt(3_200, 6_500) : randInt(800, 3_200);
      // ~45s–5m between bumps (sometimes “~$15/min”, sometimes slower)
      const delayMs = randInt(45_000, 300_000);

      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setCents((prev) => {
          const floor = floorRef.current;
          let next = prev + step;
          const ceiling = ceilingRef.current;
          if (next >= ceiling) {
            floorRef.current = sessionFloorCents();
            ceilingRef.current = floorRef.current + randInt(350_000, 1_100_000);
            next = floorRef.current + randInt(2_000, 95_000);
          }
          return next;
        });
        scheduleNext();
      }, delayMs);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return cents;
}
