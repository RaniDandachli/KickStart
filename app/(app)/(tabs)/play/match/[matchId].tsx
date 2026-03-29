import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { GameplayPlaceholder } from '@/features/play/GameplayPlaceholder';
import type { KickClashMatchSession, MatchFinishPayload } from '@/types/match';
import { useAuthStore } from '@/store/authStore';

export default function MatchPlayScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? 'local-player');

  const session = useMemo<KickClashMatchSession>(
    () => ({
      id: matchId,
      mode: 'casual',
      localPlayerId: userId,
      opponentId: 'opponent',
      scoreSelf: 0,
      scoreOpponent: 0,
      startedAt: Date.now(),
      durationSec: 180,
    }),
    [matchId, userId]
  );

  const [done, setDone] = useState(false);

  function onFinish(result: MatchFinishPayload) {
    if (done) return;
    setDone(true);
    const qp = new URLSearchParams({
      winner: result.winnerId,
      sa: String(result.finalScore.self),
      sb: String(result.finalScore.opponent),
    });
    router.replace(`/(app)/(tabs)/play/result/${matchId}?${qp.toString()}`);
  }

  return (
    <Screen>
      <Text className="mb-2 text-xs text-slate-400">Gameplay placeholder</Text>
      <GameplayPlaceholder
        session={session}
        onFinish={onFinish}
        onPauseToggle={(p) => {
          if (p) Alert.alert('Paused', 'TODO: engine pause + sync');
        }}
      />
    </Screen>
  );
}
