import { useLocalSearchParams } from 'expo-router';

import TapDashGame from '@/minigames/tapdash/TapDashGame';
import { getMoneyChallengeById, toSoloChallengeBundle } from '@/lib/moneyChallenges';
import type { SoloChallengeBundle } from '@/lib/soloChallenges';

export default function TapDashRoute() {
  const { mode, challengeId, targetScore, prizeLabel, weeklyRace } = useLocalSearchParams<{
    mode?: string;
    challengeId?: string;
    targetScore?: string;
    prizeLabel?: string;
    weeklyRace?: string;
  }>();

  const wr = weeklyRace === '1' || weeklyRace === 'true';

  const normalizedChallengeId =
    typeof challengeId === 'string' && challengeId.length > 0
      ? (() => {
          try {
            return decodeURIComponent(challengeId);
          } catch {
            return challengeId;
          }
        })()
      : '';

  const solo: SoloChallengeBundle | undefined = (() => {
    if (wr || !normalizedChallengeId) return undefined;

    const def = getMoneyChallengeById(normalizedChallengeId);
    if (def) return toSoloChallengeBundle(def);

    if (!targetScore) return undefined;

    const ts = parseInt(String(targetScore), 10);
    return {
      challengeId: normalizedChallengeId,
      targetScore: Math.max(1, Number.isFinite(ts) ? ts : 1),
      prizeLabel:
        typeof prizeLabel === 'string' && prizeLabel.length > 0
          ? decodeURIComponent(prizeLabel)
          : '$100 showcase',
      maxAttemptsPerDay: 10,
    };
  })();

  const playMode = wr ? 'practice' : solo ? 'practice' : mode === 'prize' ? 'prize' : 'practice';
  return <TapDashGame playMode={playMode} soloChallenge={solo} weeklyRace={wr} />;
}
