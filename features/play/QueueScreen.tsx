import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { OpponentFoundModal } from '@/features/play/OpponentFoundModal';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { mockMatchmakingSingleton } from '@/services/matchmaking/mockMatchmaking';
import { arcade } from '@/lib/arcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

export function QueueScreen({
  mode,
  entryFeeUsd,
  listedPrizeUsd,
  gameTitle,
  gameKey: _gameKey,
  queueIntent,
}: {
  mode: QueueKind;
  /** When set with `listedPrizeUsd`, queue shows a paid 1v1 skill contest (fixed reward; UI only until billing). */
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  /** Which minigame this 1v1 is for (from Home / deep link). */
  gameTitle?: string;
  /** Reserved for future routing / analytics when matchmaking is server-backed. */
  gameKey?: string;
  /** Join an existing lobby vs start search when pool is empty (demo UX). */
  queueIntent?: 'join' | 'start';
}) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const walletCents = useWalletDisplayCents();
  const trySpendWallet = useDemoWalletStore((s) => s.trySpend);
  const addWalletCents = useDemoWalletStore((s) => s.addWalletCents);
  const entryChargedDemoRef = useRef(0);
  const [searchId, setSearchId] = useState<string | null>(null);
  const phase = useMatchmakingStore((s) => s.phase);
  const opponent = useMatchmakingStore((s) => s.opponent);
  const setPhase = useMatchmakingStore((s) => s.setPhase);
  const setFound = useMatchmakingStore((s) => s.setFound);
  const setActiveMatch = useMatchmakingStore((s) => s.setActiveMatch);
  const setQueue = useMatchmakingStore((s) => s.setQueue);
  const reset = useMatchmakingStore((s) => s.reset);

  const hasPaidEntry =
    entryFeeUsd != null &&
    listedPrizeUsd != null &&
    !Number.isNaN(entryFeeUsd) &&
    !Number.isNaN(listedPrizeUsd);

  async function start() {
    if (hasPaidEntry && entryFeeUsd != null) {
      const needCents = Math.round(entryFeeUsd * 100);
      if (!ENABLE_BACKEND) {
        if (!trySpendWallet(needCents)) {
          Alert.alert(
            'Insufficient wallet',
            `You need at least $${entryFeeUsd.toFixed(2)} in your cash wallet to enter this contest.`,
          );
          return;
        }
        entryChargedDemoRef.current = needCents;
      } else {
        if (walletCents < needCents) {
          Alert.alert(
            'Insufficient wallet',
            `You need at least $${entryFeeUsd.toFixed(2)} in your cash wallet to enter this contest. Add funds or pick a lower tier.`,
          );
          return;
        }
        // TODO: escrow / deduct via Edge Function before matchmaking
      }
    }

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
    entryChargedDemoRef.current = 0;
    const { mockMatchId: mid, opponent: opp } = useMatchmakingStore.getState();
    if (!mid || !opp) return;
    setActiveMatch({
      matchId: mid,
      opponent: opp,
      entryFeeUsd: hasPaidEntry ? entryFeeUsd : undefined,
      listedPrizeUsd: hasPaidEntry ? listedPrizeUsd : undefined,
    });
    setPhase('lobby');
    router.push(`/(app)/(tabs)/play/lobby/${mid}`);
  }

  function refundEntryIfQueuedDemo() {
    const n = entryChargedDemoRef.current;
    if (n > 0) {
      addWalletCents(n);
      entryChargedDemoRef.current = 0;
    }
  }

  function decline() {
    if (searchId) void mockMatchmakingSingleton.cancelSearch(searchId);
    refundEntryIfQueuedDemo();
    reset();
  }

  /** Leave queue: always land on Arcade hub. `router.back()` after a cross-tab push from Home pops Home, not play/index. */
  function leaveScreen() {
    if (searchId) void mockMatchmakingSingleton.cancelSearch(searchId);
    refundEntryIfQueuedDemo();
    reset();
    router.replace('/(app)/(tabs)/play');
  }

  const title = hasPaidEntry
    ? gameTitle
      ? `1v1 · ${gameTitle}`
      : `1v1 · Fee $${entryFeeUsd} · Reward $${listedPrizeUsd}`
    : mode === 'ranked'
      ? 'Ranked queue'
      : 'Casual queue';

  const idleCta =
    !hasPaidEntry ? 'Find match' : queueIntent === 'join' ? 'Join match' : queueIntent === 'start' ? 'Find opponent' : 'Enter contest & find match';

  const searchingMsg =
    queueIntent === 'join'
      ? 'Joining their lobby…'
      : queueIntent === 'start'
        ? 'Looking for an opponent…'
        : 'Searching for a fair opponent…';

  return (
    <Screen scroll={false}>
      <Pressable
        onPress={leaveScreen}
        accessibilityRole="button"
        accessibilityLabel="Back to Arcade"
        style={({ pressed }) => [styles.backRow, pressed && styles.backPressed]}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={24} color={arcade.gold} />
        <Text style={styles.backText}>Arcade</Text>
      </Pressable>
      <Text className="mb-2 text-2xl font-black text-white">{title}</Text>
      {hasPaidEntry ? (
        <>
          <Text className="mb-1 text-center text-base font-semibold" style={{ color: '#FFFFFF' }}>
            ${entryFeeUsd} contest fee · ${listedPrizeUsd} prize (top score)
          </Text>
          {queueIntent === 'join' ? (
            <Text className="mb-4 text-center text-sm text-slate-400">
              Someone is already in queue for this game at this reward tier — you’re joining them.
            </Text>
          ) : queueIntent === 'start' ? (
            <Text className="mb-4 text-center text-sm text-slate-400">
              No one’s in queue yet — we’ll match you with the next player at this reward tier.
            </Text>
          ) : (
            <Text className="mb-4 text-center text-sm text-slate-400">Cash wallet · skill contest (demo)</Text>
          )}
        </>
      ) : (
        <Text className="mb-4 text-sm text-slate-400">Free matchmaking (demo)</Text>
      )}
      {phase === 'idle' ? (
        <AppButton title={idleCta} onPress={() => void start()} />
      ) : phase === 'searching' ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="mt-4 text-center text-slate-300">{searchingMsg}</Text>
          {hasPaidEntry ? (
            <Text className="mt-2 text-center text-xs font-medium text-slate-400">
              Demo: prizes are set by tier, awarded by Run It — not pooled from other players’ fees.
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
        prizeUsd={hasPaidEntry ? listedPrizeUsd : undefined}
        onAccept={accept}
        onDecline={decline}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 2,
    paddingVertical: 6,
    paddingRight: 12,
    gap: 2,
  },
  backPressed: { opacity: 0.75 },
  backText: {
    color: arcade.gold,
    fontSize: 17,
    fontWeight: '800',
  },
});
