import { Platform } from 'react-native';

import type { H2hGameKey } from '@/lib/homeOpenMatches';

/** Native daily / cup bracket rotation (vaulted games excluded — see `SHOW_*_MINIGAME` flags). */
export const H2H_BRACKET_GAME_ROTATION: readonly H2hGameKey[] = ['tap-dash', 'tile-clash', 'cyber-road'];

/**
 * Bracket minigames for the current client. Web skips some native-only titles so daily runs stay completable.
 */
export function h2hBracketGameRotationForClient(): readonly H2hGameKey[] {
  if (Platform.OS === 'web') {
    return ['tap-dash', 'tile-clash', 'cyber-road'] as const;
  }
  return H2H_BRACKET_GAME_ROTATION;
}
