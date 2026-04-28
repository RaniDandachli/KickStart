import type { Href } from 'expo-router';

const ALLOWED_PREFIX = '/(app)/(tabs)/';

/** Default “return to Arcade hub” when opening a minigame from the Play tab. */
export const ARCADE_HUB_RETURN_PATH = '/(app)/(tabs)/play';

/** Append `returnHref` to a minigame path (handles existing `?mode=` etc.). */
export function withReturnHref(pathWithQuery: string, returnPath: string): string {
  const sep = pathWithQuery.includes('?') ? '&' : '?';
  return `${pathWithQuery}${sep}returnHref=${encodeURIComponent(returnPath)}`;
}

/**
 * Safe “return to” path for minigame exits — pass as `returnHref` (encodeURIComponent).
 * Only in-app tab routes under `/(app)/(tabs)/…` are accepted (no external URLs).
 */
export function parseMinigameReturnHref(raw: unknown): Href | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  if (!decoded.startsWith(ALLOWED_PREFIX)) return undefined;
  const pathOnly = decoded.split('?')[0]?.split('#')[0] ?? '';
  if (!pathOnly.startsWith(ALLOWED_PREFIX)) return undefined;
  if (pathOnly.length > 220) return undefined;
  return pathOnly as Href;
}

/** Label for the primary exit chip (replacing generic “Minigames”). */
export function primaryExitLabel(returnHref: Href | undefined): string {
  if (!returnHref) return 'Minigames';
  const s = String(returnHref);
  if (
    s.includes('/tournaments/one-vs-one-challenges') ||
    s.includes('money-challenges')
  )
    return '1v1 challenges';
  if (s.includes('/tournaments/daily-race')) return 'Daily race';
  if (s.includes('/tournaments/weekly-race')) return 'Daily race';
  if (s.includes('/prizes')) return 'Prizes';
  if (s.includes('/tournaments')) return 'Events';
  if (s.includes('/profile')) return 'You';
  if (!s.includes('/minigames') && s.includes('/play')) return 'Arcade';
  if (s === '/(app)/(tabs)' || s === '/(app)/(tabs)/') return 'Home';
  return 'Back';
}
