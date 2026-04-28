import type { Href } from 'expo-router';

/**
 * Tap Dash 1v1 challenge hub (async score matchups) — stack under Events.
 * @see `app/(app)/(tabs)/tournaments/one-vs-one-challenges.tsx`
 */
export function oneVsOneChallengesHref(): Href {
  return '/(app)/(tabs)/tournaments/one-vs-one-challenges' as unknown as Href;
}

/**
 * Paid rotating minigame leaderboard (UI: “Daily Race”; server `weekly_race_*`).
 * @see `app/(app)/(tabs)/tournaments/daily-race.tsx`
 */
export function dailyRaceLeaderHref(): Href {
  return '/(app)/(tabs)/tournaments/daily-race' as unknown as Href;
}

/** @deprecated Ambiguous name — prefer {@link oneVsOneChallengesHref} or {@link dailyRaceLeaderHref}. */
export function dailyRaceHref(): Href {
  return oneVsOneChallengesHref();
}

/** @deprecated Use oneVsOneChallengesHref — legacy bottom-tab slug. */
export function moneyChallengesHref(): Href {
  return oneVsOneChallengesHref();
}
