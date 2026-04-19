import { Platform } from 'react-native';

import type { H2hGameKey } from '@/lib/homeOpenMatches';

/** Native daily / cup bracket rotation (all supported H2H minigames). */
export const H2H_BRACKET_GAME_ROTATION: readonly H2hGameKey[] = ['tap-dash', 'tile-clash', 'ball-run'];

/**
 * Bracket minigames for the current client. Web skips titles that need expo-gl / native 3D (e.g. Ball Run)
 * so daily and credit-cup runs stay completable in the browser.
 */
export function h2hBracketGameRotationForClient(): readonly H2hGameKey[] {
  if (Platform.OS === 'web') {
    return ['tap-dash', 'tile-clash'] as const;
  }
  return H2H_BRACKET_GAME_ROTATION;
}
