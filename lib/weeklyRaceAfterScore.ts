import { Alert } from 'react-native';

import type { H2hGameKey } from '@/lib/homeOpenMatches';
import { weeklyRaceDayKey } from '@/lib/weeklyRace';
import { recordWeeklyRaceScoreClient } from '@/services/api/weeklyRace';

/**
 * After `submitMinigameScore` succeeds, register one race attempt and update high score.
 * @returns `true` if the server accepted the run (caller can invalidate weekly-race query).
 * Ignores not_entered / game_mismatch (wrong deep link) without alert noise.
 */
export async function onWeeklyRaceAfterMinigameScore(
  gameKey: H2hGameKey,
  score: number,
): Promise<boolean> {
  const r = await recordWeeklyRaceScoreClient(weeklyRaceDayKey(), gameKey, score);
  if (r.ok) return true;
  const e = r.error ?? '';
  if (e === 'not_entered' || e === 'game_mismatch' || e === 'no_attempts_left') {
    if (e === 'no_attempts_left') {
      Alert.alert('Weekly race', 'You have used all 10 scored runs for today.');
    }
    return false;
  }
  Alert.alert('Weekly race', e || 'Could not update your race score.');
  return false;
}
