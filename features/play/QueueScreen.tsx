import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { OpponentFoundModal } from '@/features/play/OpponentFoundModal';
import { mockMatchmakingSingleton } from '@/services/matchmaking/mockMatchmaking';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

export function QueueScreen({
  mode,
  stakeEntryUsd,
  stakeWinUsd,
}: {
  mode: QueueKind;
  /** When set with `stakeWinUsd`, queue is a paid 1v1 stakes match (UI only until billing). */
  stakeEntryUsd?: number;
  stakeWinUsd?: number;
}) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const [searchId, setSearchId] = useState<string | null>(null);
  const phase = useMatchmakingStore((s) => s.phase);
  const opponent = useMatchmakingStore((s) => s.opponent);
  const setPhase = useMatchmakingStore((s) => s.setPhase);
  const setFound = useMatchmakingStore((s) => s.setFound);
  const setQueue = useMatchmakingStore((s) => s.setQueue);
  const reset = useMatchmakingStore((s) => s.reset);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  async function start() {
    setQueue(mode);
    setPhase('searching');
    const { searchId: sid } = await mockMatchmakingSingleton.startSearch(userId, mode);
    setSearchId(sid);
    const unsub = mockMatchmakingSingleton.onOpponentFound(sid, ({ matchSessionId, opponentUserId }) => {
      setFound(matchSessionId, {
        id: opponentUserId,
        username: opponentUserId === 'mock_opponent_1' ? 'NeoStriker' : 'Rival',
        rating: 1588,
        region: 'EU',
      });
      unsub();
    });
  }

  function accept() {
    const mid = useMatchmakingStore.getState().mockMatchId;
    if (!mid) return;
    setPhase('lobby');
    router.push(`/(app)/(tabs)/play/lobby/${mid}`);
  }

  function decline() {
    if (searchId) void mockMatchmakingSingleton.cancelSearch(searchId);
    reset();
  }

  const hasStakes =
    stakeEntryUsd != null &&
    stakeWinUsd != null &&
    !Number.isNaN(stakeEntryUsd) &&
    !Number.isNaN(stakeWinUsd);
  const title = hasStakes
    ? `1v1 · $${stakeEntryUsd} → $${stakeWinUsd}`
    : mode === 'ranked'
      ? 'Ranked queue'
      : 'Casual queue';

  return (
    <Screen scroll={false}>
      <Text className="mb-2 text-2xl font-black text-white">{title}</Text>
      {hasStakes ? (
        <Text className="mb-4 text-center text-base font-semibold" style={{ color: '#FFFFFF' }}>
          Entry ${stakeEntryUsd} · Winner takes ${stakeWinUsd}
        </Text>
      ) : (
        <Text className="mb-4 text-sm text-slate-400">Free matchmaking (demo)</Text>
      )}
      {phase === 'idle' ? (
        <AppButton title={hasStakes ? 'Enter & find match' : 'Find match'} onPress={() => void start()} />
      ) : phase === 'searching' ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="mt-4 text-center text-slate-300">Searching for a fair opponent…</Text>
          {hasStakes ? (
            <Text className="mt-2 text-center text-xs font-medium text-slate-400">
              Pool: ${stakeEntryUsd! * 2} · Prize ${stakeWinUsd} shown before fees
            </Text>
          ) : null}
          <AppButton className="mt-6" title="Cancel" variant="ghost" onPress={decline} />
        </View>
      ) : (
        <View className="items-center py-10">
          <Text className="text-center font-medium text-slate-300">Match ready — accept in the modal.</Text>
          <AppButton className="mt-6" title="Cancel" variant="ghost" onPress={decline} />
        </View>
      )}
      <OpponentFoundModal
        visible={phase === 'found'}
        opponent={opponent}
        prizeUsd={hasStakes ? stakeWinUsd : undefined}
        onAccept={accept}
        onDecline={decline}
      />
    </Screen>
  );
}
