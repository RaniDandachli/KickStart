import type { Href } from 'expo-router';

/** Daily Race hub (Tap Dash showcases) — stack under Events. */
export function dailyRaceHref(): Href {
  return '/(app)/(tabs)/tournaments/daily-race' as unknown as Href;
}

/** @deprecated Use dailyRaceHref — alias for migrations & deep links. */
export function moneyChallengesHref(): Href {
  return dailyRaceHref();
}
