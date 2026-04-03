import { useEffect, useRef, useState } from 'react';

import { formatCountdownHms, msUntilNextLocalMidnight, todayYmdLocal } from '@/lib/dailyFreeTournament';

/**
 * Ticks every second with a countdown to local midnight; when the calendar day changes,
 * re-hydrates Tournament of the Day so a new bracket & prize window apply without restarting the app.
 */
export function useDailyFreeResetClock(userKey: string, hydrate: (key: string) => Promise<void>): string {
  const [countdown, setCountdown] = useState(() => formatCountdownHms(msUntilNextLocalMidnight()));
  const dayRef = useRef(todayYmdLocal());
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const day = todayYmdLocal();
      if (day !== dayRef.current) {
        dayRef.current = day;
        void hydrateRef.current(userKey);
      }
      setCountdown(formatCountdownHms(msUntilNextLocalMidnight(now)));
    }, 1000);
    return () => clearInterval(id);
  }, [userKey]);

  return countdown;
}
