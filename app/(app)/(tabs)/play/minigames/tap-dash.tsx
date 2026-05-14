import { useLocalSearchParams } from 'expo-router';

import TapDashGame from '@/minigames/tapdash/TapDashGame';
import { getMoneyChallengeById, toSoloChallengeBundle } from '@/lib/moneyChallenges';
import type { SoloChallengeBundle } from '@/lib/soloChallenges';
import type { QueueKind } from '@/store/matchmakingStore';
import type { AsyncH2hQueueSubmit } from '@/types/match';

export default function TapDashRoute() {
  const {
    mode,
    challengeId,
    targetScore,
    prizeLabel,
    weeklyRace,
    asyncStake,
    h2hMode,
    entryCents,
    prizeCents,
  } = useLocalSearchParams<{
    mode?: string;
    challengeId?: string;
    targetScore?: string;
    prizeLabel?: string;
    weeklyRace?: string;
    asyncStake?: string;
    h2hMode?: string;
    entryCents?: string;
    prizeCents?: string;
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

  const asyncH2hQueueSubmit: AsyncH2hQueueSubmit | undefined = (() => {
    if (wr || solo) return undefined;
    const stakeRaw = Array.isArray(asyncStake) ? asyncStake[0] : asyncStake;
    const on = stakeRaw === '1' || stakeRaw === 'true';
    if (!on) return undefined;
    const ecRaw = Array.isArray(entryCents) ? entryCents[0] : entryCents;
    const pcRaw = Array.isArray(prizeCents) ? prizeCents[0] : prizeCents;
    const hmRaw = Array.isArray(h2hMode) ? h2hMode[0] : h2hMode;
    const ec = parseInt(String(ecRaw ?? ''), 10);
    const pc = parseInt(String(pcRaw ?? ''), 10);
    if (!Number.isFinite(ec) || ec < 0 || !Number.isFinite(pc) || pc < 0) return undefined;
    const qm: QueueKind = hmRaw === 'ranked' ? 'ranked' : hmRaw === 'custom' ? 'custom' : 'casual';
    return { mode: qm, gameKey: 'tap-dash' as const, entryFeeWalletCents: ec, listedPrizeUsdCents: pc };
  })();

  const playMode = wr ? 'practice' : solo ? 'practice' : mode === 'prize' ? 'prize' : 'practice';
  return (
    <TapDashGame playMode={playMode} soloChallenge={solo} weeklyRace={wr} asyncH2hQueueSubmit={asyncH2hQueueSubmit} />
  );
}
