import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { GameplayPlaceholder } from '@/features/play/GameplayPlaceholder';
import { useMatchSessionWithPlayers } from '@/hooks/useMatchSessionWithPlayers';
import { displayNameForProfile } from '@/services/api/h2hMatchSession';
import type { KickClashMatchSession, MatchFinishPayload } from '@/types/match';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';

export default function MatchPlayScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const activeMatch = useMatchmakingStore((s) => s.activeMatch);

  const session = useMemo<KickClashMatchSession>(() => {
    const opp = activeMatch?.matchId === matchId ? activeMatch.opponent : null;
    const opponentId = opp?.id ?? 'opponent';
    return {
      id: matchId,
      mode: 'casual',
      localPlayerId: userId,
      opponentId,
      opponentDisplayName: opp?.username ?? 'Opponent',
      listedPrizeUsd: activeMatch?.listedPrizeUsd,
      entryFeeUsd: activeMatch?.entryFeeUsd,
      scoreSelf: 0,
      scoreOpponent: 0,
      startedAt: Date.now(),
      durationSec: 90,
    };
  }, [matchId, userId, activeMatch]);

  const [done, setDone] = useState(false);

  function onFinish(result: MatchFinishPayload) {
    if (done) return;
    setDone(true);
    const qp = new URLSearchParams({
      winner: result.winnerId,
      sa: String(result.finalScore.self),
      sb: String(result.finalScore.opponent),
    });
    if (result.winnerId === 'draw') qp.set('draw', '1');
    const oppName = session.opponentDisplayName ?? 'Opponent';
    qp.set('opp', encodeURIComponent(oppName));
    if (session.opponentId && session.opponentId !== 'opponent') {
      qp.set('oppId', session.opponentId);
    }
    if (session.listedPrizeUsd != null) qp.set('prize', String(session.listedPrizeUsd));
    if (session.entryFeeUsd != null) qp.set('entry', String(session.entryFeeUsd));
    router.replace(`/(app)/(tabs)/play/result/${matchId}?${qp.toString()}`);
  }

  return (
    <Screen scroll={false}>
      <Text className="mb-1 text-xs uppercase text-slate-400">Player vs player</Text>
      <Text className="mb-3 text-lg font-black text-white">
        You vs {session.opponentDisplayName}
        {session.listedPrizeUsd != null ? ` · Prize $${session.listedPrizeUsd}` : ''}
      </Text>
      <GameplayPlaceholder
        session={session}
        hideOpponentControls={!!activeMatch?.casualFree}
        onFinish={onFinish}
        onPauseToggle={(p) => {
          if (p) Alert.alert('Paused', 'TODO: engine pause + sync');
        }}
      />
    </Screen>
  );
}
