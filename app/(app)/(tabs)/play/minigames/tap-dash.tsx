import { useLocalSearchParams } from 'expo-router';

import TapDashGame from '@/minigames/tapdash/TapDashGame';
import type { SoloChallengeBundle } from '@/lib/soloChallenges';

export default function TapDashRoute() {
  const { mode, challengeId, targetScore, prizeLabel } = useLocalSearchParams<{
    mode?: string;
    challengeId?: string;
    targetScore?: string;
    prizeLabel?: string;
  }>();

  const solo: SoloChallengeBundle | undefined =
    typeof challengeId === 'string' && challengeId.length > 0 && targetScore
      ? {
          challengeId,
          targetScore: Math.max(1, parseInt(String(targetScore), 10) || 1),
          prizeLabel:
            typeof prizeLabel === 'string' && prizeLabel.length > 0
              ? decodeURIComponent(prizeLabel)
              : '$100 showcase',
        }
      : undefined;

  const playMode = solo ? 'practice' : mode === 'prize' ? 'prize' : 'practice';
  return <TapDashGame playMode={playMode} soloChallenge={solo} />;
}
