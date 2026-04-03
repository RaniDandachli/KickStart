import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { OpponentFoundModal } from '@/features/play/OpponentFoundModal';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isUuid } from '@/lib/isUuid';
import {
  createH2hMatchSessionViaEdge,
  resolveDevOpponentUserId,
} from '@/services/api/h2hMatchSession';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { pushCrossTab } from '@/lib/appNavigation';
import { titleForH2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { mockMatchmakingSingleton } from '@/services/matchmaking/mockMatchmaking';
import { arcade } from '@/lib/arcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { pickAnyOpenWaiterForQuickMatch, useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

type QuickMatchCtx = {
  isFreeCasual: boolean;
  entryUsd: number;
  prizeUsd: number;
  gameTitle: string;
  waiterId: string;
  opponentName: string;
};

export function QueueScreen({
  mode,
  entryFeeUsd,
  listedPrizeUsd,
  gameTitle,
  gameKey,
  queueIntent,
  quickMatch,
}: {
  mode: QueueKind;
  /** When set with `listedPrizeUsd`, queue shows a paid 1v1 skill contest (fixed reward; UI only until billing). */
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  /** Which minigame this 1v1 is for (from Home / deep link). */
  gameTitle?: string;
  /** Minigame key for server `match_sessions.game_key` when backend is enabled. */
  gameKey?: string;
  /** Join an existing lobby vs start search when pool is empty (demo UX). */
  queueIntent?: 'join' | 'start';
  /** Home “Quick match” — pair across any open lobby / tier; wallet or free casual. */
  quickMatch?: boolean;
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

  const quickMatchCtxRef = useRef<QuickMatchCtx | null>(null);
  const quickAutoStartedRef = useRef(false);
  const [quickResolving, setQuickResolving] = useState(!!quickMatch);

  const start = useCallback(async () => {
    const q = quickMatchCtxRef.current;
    const isFreeCasual = q?.isFreeCasual === true;
    const effectiveEntry = isFreeCasual ? undefined : q != null ? q.entryUsd : entryFeeUsd;
    const effectivePrize = isFreeCasual ? undefined : q != null ? q.prizeUsd : listedPrizeUsd;
    const hasPaidEntry =
      !isFreeCasual &&
      effectiveEntry != null &&
      effectivePrize != null &&
      !Number.isNaN(effectiveEntry) &&
      !Number.isNaN(effectivePrize);

    if (hasPaidEntry && effectiveEntry != null) {
      const needCents = Math.round(effectiveEntry * 100);
      if (!ENABLE_BACKEND) {
        if (!trySpendWallet(needCents)) {
          Alert.alert(
            'Insufficient wallet',
            `You need at least ${formatUsdFromCents(needCents)} in your cash wallet to enter this contest.`,
          );
          return;
        }
        entryChargedDemoRef.current = needCents;
      } else {
        if (walletCents < needCents) {
          Alert.alert(
            'Insufficient wallet',
            `You need at least ${formatUsdFromCents(needCents)} in your cash wallet to enter this contest. Add funds or pick a lower tier.`,
          );
          return;
        }
      }
      if (q?.waiterId) useHomeH2hBoardStore.getState().removeWaiter(q.waiterId);
    }

    setQueue(mode);
    setPhase('searching');
    const { searchId: sid } = await mockMatchmakingSingleton.startSearch(userId, mode);
    setSearchId(sid);
    const unsub = mockMatchmakingSingleton.onOpponentFound(sid, ({ matchSessionId, opponentUserId }) => {
      const q2 = quickMatchCtxRef.current;
      const name =
        q2?.opponentName ??
        (opponentUserId === 'mock_opponent_1' ? 'NeoStriker' : 'Rival');
      const regions = ['NA', 'EU', 'LATAM', 'APAC'] as const;
      setFound(matchSessionId, {
        id: opponentUserId,
        username: name,
        rating: 1500 + Math.floor(Math.random() * 120),
        region: regions[Math.floor(Math.random() * regions.length)]!,
      });
      unsub();
    });
  }, [mode, userId, entryFeeUsd, listedPrizeUsd, setQueue, setPhase, setFound, trySpendWallet, walletCents]);

  const runQuickMatchResolve = useCallback(async () => {
    const w = pickAnyOpenWaiterForQuickMatch();
    const tier = MATCH_ENTRY_TIERS[w.tierIndex]!;
    const needCents = Math.round(tier.entry * 100);
    const canPay = ENABLE_BACKEND ? walletCents >= needCents : useDemoWalletStore.getState().walletCents >= needCents;
    const gTitle = titleForH2hGameKey(w.gameKey);

    const bailToArcade = () => {
      setQuickResolving(false);
      useMatchmakingStore.getState().reset();
      quickMatchCtxRef.current = null;
      quickAutoStartedRef.current = false;
      router.replace('/(app)/(tabs)/play');
    };

    if (canPay) {
      quickMatchCtxRef.current = {
        isFreeCasual: false,
        entryUsd: tier.entry,
        prizeUsd: tier.prize,
        gameTitle: gTitle,
        waiterId: w.id,
        opponentName: w.hostLabel,
      };
      try {
        await start();
      } finally {
        setQuickResolving(false);
      }
      return;
    }

    setQuickResolving(false);
    Alert.alert(
      'Wallet balance',
      `This pairing needs ${formatUsdFromCents(needCents)} to enter the contest. Add funds to your wallet, or play a free casual match with no entry fee or cash prize.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: bailToArcade },
        {
          text: 'Add funds',
          onPress: () => pushCrossTab(router, '/(app)/(tabs)/profile/add-funds'),
        },
        {
          text: 'Free casual match',
          onPress: () => {
            quickMatchCtxRef.current = {
              isFreeCasual: true,
              entryUsd: 0,
              prizeUsd: 0,
              gameTitle: gTitle,
              waiterId: w.id,
              opponentName: w.hostLabel,
            };
            void start();
          },
        },
      ],
    );
  }, [router, start, walletCents]);

  useEffect(() => {
    if (!quickMatch || quickAutoStartedRef.current) return;
    quickAutoStartedRef.current = true;
    void runQuickMatchResolve();
  }, [quickMatch, runQuickMatchResolve]);

  async function accept() {
    entryChargedDemoRef.current = 0;
    const { mockMatchId: mid, opponent: opp } = useMatchmakingStore.getState();
    if (!mid || !opp) return;
    const q = quickMatchCtxRef.current;
    const isFreeCasual = q?.isFreeCasual === true;
    const effectiveEntry = isFreeCasual ? undefined : q != null ? q.entryUsd : entryFeeUsd;
    const effectivePrize = isFreeCasual ? undefined : q != null ? q.prizeUsd : listedPrizeUsd;
    const hasPaidEntry =
      !isFreeCasual &&
      effectiveEntry != null &&
      effectivePrize != null &&
      !Number.isNaN(effectiveEntry) &&
      !Number.isNaN(effectivePrize);

    let resolvedMatchId = mid;
    let resolvedOpp = opp;

    if (ENABLE_BACKEND && userId !== 'guest') {
      const oppUuid = resolveDevOpponentUserId(opp.id);
      if (oppUuid && isUuid(oppUuid)) {
        try {
          const { match_session_id } = await createH2hMatchSessionViaEdge({
            mode,
            opponentUserId: oppUuid,
            gameKey,
            entryFeeWalletCents: hasPaidEntry && effectiveEntry != null ? Math.round(effectiveEntry * 100) : undefined,
            listedPrizeUsdCents: hasPaidEntry && effectivePrize != null ? Math.round(effectivePrize * 100) : undefined,
          });
          resolvedMatchId = match_session_id;
          resolvedOpp = { ...opp, id: oppUuid };
        } catch (e) {
          Alert.alert('Could not start match', e instanceof Error ? e.message : 'Server error');
          return;
        }
      }
    }

    setActiveMatch({
      matchId: resolvedMatchId,
      opponent: resolvedOpp,
      entryFeeUsd: hasPaidEntry ? effectiveEntry : undefined,
      listedPrizeUsd: hasPaidEntry ? effectivePrize : undefined,
      casualFree: isFreeCasual ? true : undefined,
    });
    setPhase('lobby');
    router.push(`/(app)/(tabs)/play/lobby/${resolvedMatchId}`);
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
    quickMatchCtxRef.current = null;
    reset();
  }

  /** Leave queue: always land on Arcade hub. `router.back()` after a cross-tab push from Home pops Home, not play/index. */
  function leaveScreen() {
    if (searchId) void mockMatchmakingSingleton.cancelSearch(searchId);
    refundEntryIfQueuedDemo();
    quickMatchCtxRef.current = null;
    quickAutoStartedRef.current = false;
    reset();
    router.replace('/(app)/(tabs)/play');
  }

  const q = quickMatchCtxRef.current;
  const isFreeCasual = q?.isFreeCasual === true;
  const effectiveEntry = isFreeCasual ? undefined : q != null ? q.entryUsd : entryFeeUsd;
  const effectivePrize = isFreeCasual ? undefined : q != null ? q.prizeUsd : listedPrizeUsd;
  const displayGameTitle = q?.gameTitle ?? gameTitle;
  const hasPaidEntry =
    !isFreeCasual &&
    effectiveEntry != null &&
    effectivePrize != null &&
    !Number.isNaN(effectiveEntry) &&
    !Number.isNaN(effectivePrize);

  const title = quickMatch
    ? 'Quick match'
    : hasPaidEntry
      ? displayGameTitle
        ? `1v1 · ${displayGameTitle}`
        : `1v1 · Fee $${effectiveEntry} · Reward $${effectivePrize}`
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
        : quickMatch
          ? 'Pairing you with an open player…'
          : 'Searching for a fair opponent…';

  const modalPrizeUsd = hasPaidEntry ? effectivePrize : undefined;

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
      {quickMatch ? (
        <Text className="mb-4 text-center text-sm text-slate-400">
          We match you with any open player in queue — any game, any contest tier. If your wallet can&apos;t cover the fee, you can add funds
          or play a free casual match (no entry, no cash prize).
        </Text>
      ) : hasPaidEntry ? (
        <>
          <Text className="mb-1 text-center text-base font-semibold" style={{ color: '#FFFFFF' }}>
            ${effectiveEntry} contest fee · ${effectivePrize} prize (top score)
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
      {quickResolving && phase === 'idle' ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="mt-4 text-center text-slate-300">Finding an open match…</Text>
        </View>
      ) : phase === 'idle' ? (
        quickMatch ? null : (
          <AppButton title={idleCta} onPress={() => void start()} />
        )
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
        prizeUsd={modalPrizeUsd}
        freeCasual={isFreeCasual}
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
