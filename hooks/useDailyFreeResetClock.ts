import { useEffect, useRef, useState } from 'react';

import { formatCountdownHms, msUntilNextLocalMidnight, todayYmdLocal } from '@/lib/dailyFreeTournament';

export type DailyFreeResetClockOptions = {
  /**
   * When false (e.g. live event **play** screens), skip per-second React state updates so the minigame
   * subtree is not re-rendered every second — only midnight rollover still hydrates.
   */
  withCountdown?: boolean;
};

/**
 * Ticks every second with a countdown to local midnight; when the calendar day changes,
 * re-hydrates Tournament of the Day so a new bracket & prize window apply without restarting the app.
 */
export function useDailyFreeResetClock(
  userKey: string,
  hydrate: (key: string) => Promise<void>,
  options?: DailyFreeResetClockOptions,
): string {
  const withCountdown = options?.withCountdown !== false;
  const [countdown, setCountdown] = useState(() =>
    withCountdown ? formatCountdownHms(msUntilNextLocalMidnight()) : '',
  );
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
      if (withCountdown) {
        setCountdown(formatCountdownHms(msUntilNextLocalMidnight(now)));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [userKey, withCountdown]);

  return countdown;
}
