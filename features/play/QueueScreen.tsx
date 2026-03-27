import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { OpponentFoundModal } from '@/features/play/OpponentFoundModal';
import { mockMatchmakingSingleton } from '@/services/matchmaking/mockMatchmaking';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

export function QueueScreen({ mode }: { mode: QueueKind }) {
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

  const title = mode === 'ranked' ? 'Ranked queue' : 'Casual queue';

  return (
    <Screen scroll={false}>
      <Text className="mb-4 text-2xl font-bold text-white">{title}</Text>
      {phase === 'idle' ? (
        <AppButton title="Find match" onPress={() => void start()} />
      ) : phase === 'searching' ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#c8f31c" />
          <Text className="mt-4 text-center text-white/70">Searching for a fair opponent…</Text>
          <AppButton className="mt-6" title="Cancel" variant="ghost" onPress={decline} />
        </View>
      ) : (
        <View className="items-center py-10">
          <Text className="text-white/60">Match ready — accept in the modal.</Text>
          <AppButton className="mt-6" title="Cancel" variant="ghost" onPress={decline} />
        </View>
      )}
      <OpponentFoundModal
        visible={phase === 'found'}
        opponent={opponent}
        onAccept={accept}
        onDecline={decline}
      />
    </Screen>
  );
}
