import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { OpponentFoundModal } from '@/features/play/OpponentFoundModal';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isUuid } from '@/lib/isUuid';
import {
  createH2hMatchSessionViaEdge,
  displayNameForProfile,
  resolveDevOpponentUserId,
} from '@/services/api/h2hMatchSession';
import { useH2hQueueMatchSignals } from '@/hooks/useH2hQueueMatchSignals';
import { h2hCancelQueue, h2hEnqueueOrMatch, h2hEnqueueQuickMatch } from '@/services/matchmaking/h2hQueue';
import { getSupabase } from '@/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { H2H_QUICK_MATCH_GAME_KEY, type H2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { queryKeys } from '@/lib/queryKeys';
import { SKILL_CONTEST_LAUNCH_BODY, SKILL_CONTEST_LAUNCH_TITLE } from '@/constants/skillContestLaunch';
import { SKILL_CONTEST_ENTRY_SHORT } from '@/lib/skillContestCopy';
import { profileBlocksPaidSkillContest } from '@/lib/skillContestRegionGate';
import { arcade } from '@/lib/arcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { QUICK_MATCH_PLACEHOLDER_WAITER_ID, useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

type QuickMatchCtx = {
  isFreeCasual: boolean;
  entryUsd: number;
  prizeUsd: number;
  gameTitle: string;
  /** Real minigame key, or `H2H_QUICK_MATCH_GAME_KEY` when using server wildcard queue. */
  gameKey: H2hGameKey | typeof H2H_QUICK_MATCH_GAME_KEY;
  waiterId: string;
  opponentName: string;
  /** Backend Quick Match: `h2h_enqueue_quick_match` — any affordable specific waiter, wallet-capped. */
  isQuickMatchWildcard?: boolean;
  /** Snapshot for rehydrate after remount (matches server `wildcard_budget_cents`). */
  maxAffordableEntryCents?: number;
  /**
   * When Quick Match picked a row from `home_h2h_queue_board`, use these exact cents so we join the same
   * `h2h_queue_entries` bucket as “Find opponent” / Home join for that game+tier (single global pool per tier).
   */
  exactTierCents?: { entry: number; prize: number };
};

/** Same tier resolution as `start()` — used to repopulate refs after remount (Strict Mode) while Zustand stays `searching`. */
function buildBackendQueueParams(args: {
  mode: QueueKind;
  quickCtx: QuickMatchCtx | null;
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  gameKey?: string;
  queueTierCents?: { entry: number; prize: number };
}): {
  mode: QueueKind;
  gameKey: string;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
} {
  const q = args.quickCtx;
  if (q?.isQuickMatchWildcard) {
    return {
      mode: args.mode,
      gameKey: H2H_QUICK_MATCH_GAME_KEY,
      entryFeeWalletCents: 0,
      listedPrizeUsdCents: 0,
    };
  }
  const isFreeCasual = q?.isFreeCasual === true;
  const effectiveEntry = isFreeCasual ? undefined : q != null ? q.entryUsd : args.entryFeeUsd;
  const effectivePrize = isFreeCasual ? undefined : q != null ? q.prizeUsd : args.listedPrizeUsd;
  const hasPaidEntry =
    !isFreeCasual &&
    effectiveEntry != null &&
    effectivePrize != null &&
    !Number.isNaN(effectiveEntry) &&
    !Number.isNaN(effectivePrize);
  const resolvedGameKey = (q?.gameKey ?? args.gameKey) ?? '';
  return {
    mode: args.mode,
    gameKey: resolvedGameKey,
    entryFeeWalletCents:
      hasPaidEntry && effectiveEntry != null
        ? (q?.exactTierCents?.entry ?? args.queueTierCents?.entry ?? Math.round(effectiveEntry * 100))
        : 0,
    listedPrizeUsdCents:
      hasPaidEntry && effectivePrize != null
        ? (q?.exactTierCents?.prize ?? args.queueTierCents?.prize ?? Math.round(effectivePrize * 100))
        : 0,
  };
}

export function QueueScreen({
  mode,
  entryFeeUsd,
  listedPrizeUsd,
  gameTitle,
  gameKey,
  queueIntent,
  quickMatch,
  queueTierCents,
}: {
  mode: QueueKind;
  /** When set with `listedPrizeUsd`, queue shows a paid 1v1 skill contest (fixed reward tier). */
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  /** Which minigame this 1v1 is for (from Home / deep link). */
  gameTitle?: string;
  /** Minigame key for server `match_sessions.game_key` when backend is enabled. */
  gameKey?: string;
  /** Join an existing lobby vs start search when pool is empty. */
  queueIntent?: 'join' | 'start';
  /** Home “Quick match” — pair across any open lobby / tier; wallet or free casual. */
  quickMatch?: boolean;
  /**
   * When present (from `?entryCents=&prizeCents=` on Home join/start), RPC uses these exact values
   * so joiners match `h2h_queue_entries` byte-for-byte with the waiting host.
   */
  queueTierCents?: { entry: number; prize: number };
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const profileQ = useProfile(ENABLE_BACKEND && userId !== 'guest' ? userId : undefined);
  const addWalletCents = useDemoWalletStore((s) => s.addWalletCents);
  const entryChargedDemoRef = useRef(0);
  /** Max entry fee (cents) Quick Match can accept — server `h2h_enqueue_quick_match` / `wildcard_budget_cents`. */
  const quickMatchMaxAffordableEntryCentsRef = useRef(0);
  const backendQueueParamsRef = useRef<{
    mode: QueueKind;
    gameKey: string;
    entryFeeWalletCents: number;
    listedPrizeUsdCents: number;
  } | null>(null);
  /** One-shot alert for fatal queue RPC errors while polling (wallet drift, session create failure). */
  const queuePollAlertShownRef = useRef(false);
  const queuePollTransientFailRef = useRef(0);
  /** True after Home `intent=join|start` auto-fired `start()` once, or user cancelled — no repeat autostart until next navigation. */
  const h2hIntentAutostartDoneOrCancelledRef = useRef(false);
  const phase = useMatchmakingStore((s) => s.phase);
  const opponent = useMatchmakingStore((s) => s.opponent);
  const setPhase = useMatchmakingStore((s) => s.setPhase);
  const setFound = useMatchmakingStore((s) => s.setFound);
  const setActiveMatch = useMatchmakingStore((s) => s.setActiveMatch);
  const setQueue = useMatchmakingStore((s) => s.setQueue);
  const reset = useMatchmakingStore((s) => s.reset);

  useH2hQueueMatchSignals({
    enabled: ENABLE_BACKEND && userId !== 'guest' && phase === 'searching',
    userId,
    queueParamsRef: backendQueueParamsRef,
  });

  const quickMatchCtxRef = useRef<QuickMatchCtx | null>(null);
  const quickAutoStartedRef = useRef(false);
  /** Prevents double-tap / autostart + tap racing two `start()` calls (web + native). */
  const queueStartInFlightRef = useRef(false);
  const [quickResolving, setQuickResolving] = useState(!!quickMatch);

  const start = useCallback(async () => {
    if (!ENABLE_BACKEND || userId === 'guest') {
      Alert.alert(
        'Sign in required',
        'Head-to-head matchmaking uses your live account and Supabase. Sign in and keep EXPO_PUBLIC_ENABLE_BACKEND enabled.',
      );
      return;
    }
    if (queueStartInFlightRef.current) {
      return;
    }
    queueStartInFlightRef.current = true;
    try {
    const stDup = useMatchmakingStore.getState();
    if (stDup.phase === 'searching' && backendQueueParamsRef.current != null) {
      return;
    }

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

    if (ENABLE_BACKEND && userId !== 'guest' && q?.isQuickMatchWildcard) {
      if (profileQ.isError) {
        Alert.alert('Could not load profile', 'Check your connection and try again.');
        return;
      }
      if (!profileQ.isFetched) {
        Alert.alert('One moment', 'Loading your wallet. Try again in a second.');
        return;
      }
      const blocked = await profileBlocksPaidSkillContest(userId);
      const live = profileQ.data?.wallet_cents ?? 0;
      const max = blocked ? 0 : live;
      quickMatchMaxAffordableEntryCentsRef.current = max;
      quickMatchCtxRef.current = { ...q, maxAffordableEntryCents: max };
      setQueue(mode);
      setPhase('searching');
      queuePollAlertShownRef.current = false;
      backendQueueParamsRef.current = buildBackendQueueParams({
        mode,
        quickCtx: quickMatchCtxRef.current,
        entryFeeUsd,
        listedPrizeUsd,
        gameKey,
        queueTierCents,
      });
      return;
    }

    if (hasPaidEntry && effectiveEntry != null) {
      if (profileQ.isError) {
        Alert.alert('Could not load profile', 'Check your connection and try again.');
        return;
      }
      if (ENABLE_BACKEND && userId !== 'guest' && (await profileBlocksPaidSkillContest(userId))) {
        Alert.alert(
          'Not available in your region',
          'Paid skill contests are not offered for your profile region. Update region if it is wrong, or contact support.',
        );
        return;
      }
      const needCents =
        q?.exactTierCents?.entry ?? queueTierCents?.entry ?? Math.round(effectiveEntry * 100);
      if (!profileQ.isFetched) {
        Alert.alert('One moment', 'Loading your wallet. Try again in a second.');
        return;
      }
      const liveCents = profileQ.data?.wallet_cents ?? 0;
      if (liveCents < needCents) {
        Alert.alert(
          'Insufficient wallet',
          `You need at least ${formatUsdFromCents(needCents)} in your cash wallet to enter this contest. Add funds or pick a lower tier.`,
        );
        return;
      }
      if (q?.waiterId && !q.isQuickMatchWildcard) {
        useHomeH2hBoardStore.getState().removeWaiter(q.waiterId);
      }
    }

    setQueue(mode);
    setPhase('searching');

    queuePollAlertShownRef.current = false;
    backendQueueParamsRef.current = buildBackendQueueParams({
      mode,
      quickCtx: quickMatchCtxRef.current,
      entryFeeUsd,
      listedPrizeUsd,
      gameKey,
      queueTierCents,
    });
    } finally {
      queueStartInFlightRef.current = false;
    }
  }, [
    mode,
    userId,
    entryFeeUsd,
    listedPrizeUsd,
    gameKey,
    setQueue,
    setPhase,
    queueTierCents,
    profileQ.isFetched,
    profileQ.isError,
    profileQ.data?.wallet_cents,
  ]);

  useEffect(() => {
    if (!ENABLE_BACKEND || userId === 'guest' || phase !== 'searching') return;
    const params = backendQueueParamsRef.current;
    if (!params) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const p = backendQueueParamsRef.current;
      if (!p) return;
      try {
        const r =
          p.gameKey === H2H_QUICK_MATCH_GAME_KEY
            ? await h2hEnqueueQuickMatch({
                mode: p.mode,
                maxAffordableEntryCents: quickMatchMaxAffordableEntryCentsRef.current,
              })
            : await h2hEnqueueOrMatch(p);
        if (cancelled) return;
        if (!r.ok) {
          if (r.error === 'match_create_failed') {
            queuePollTransientFailRef.current += 1;
            return;
          }
          if (r.error === 'insufficient_wallet' && !queuePollAlertShownRef.current) {
            queuePollAlertShownRef.current = true;
            backendQueueParamsRef.current = null;
            void h2hCancelQueue().catch(() => {});
            useMatchmakingStore.getState().reset();
            Alert.alert(
              'Matchmaking issue',
              'Your wallet no longer covers contest access. Add funds or pick a different tier.',
            );
          }
          return;
        }
        if (r.matched) {
          queuePollTransientFailRef.current = 0;
          void qc.invalidateQueries({ queryKey: queryKeys.homeH2hBoard() });
          const supabase = getSupabase();
          const { data: prof } = await supabase
            .from('profiles')
            .select('id,username,display_name,region')
            .eq('id', r.opponent_user_id)
            .maybeSingle();
          const name = displayNameForProfile(prof?.username ?? null, prof?.display_name ?? null);
          const reg = prof?.region?.trim();
          useMatchmakingStore.getState().setFound(
            r.match_session_id,
            {
              id: r.opponent_user_id,
              username: name,
              rating: 1500,
              region: reg && reg.length > 0 ? reg : 'NA',
            },
            { serverSessionReady: true },
          );
        } else {
          queuePollTransientFailRef.current = 0;
        }
      } catch (e) {
        queuePollTransientFailRef.current += 1;
        if (queuePollTransientFailRef.current >= 6 && !queuePollAlertShownRef.current) {
          queuePollAlertShownRef.current = true;
          backendQueueParamsRef.current = null;
          void h2hCancelQueue().catch(() => {});
          useMatchmakingStore.getState().reset();
          Alert.alert(
            'Matchmaking issue',
            e instanceof Error
              ? e.message
              : 'Could not reach the matchmaking service. Check your connection and try again.',
          );
        }
      }
    };

    void tick();
    const iv = setInterval(() => void tick(), 1300);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [phase, userId, qc]);

  const runQuickMatchResolve = useCallback(async () => {
    const bailToArcade = () => {
      setQuickResolving(false);
      useMatchmakingStore.getState().reset();
      quickMatchCtxRef.current = null;
      quickAutoStartedRef.current = false;
      router.replace('/(app)/(tabs)/play');
    };

    if (ENABLE_BACKEND && userId !== 'guest') {
      if (!profileQ.isFetched) {
        setQuickResolving(false);
        Alert.alert('One moment', 'Loading your profile…');
        return;
      }
      quickMatchCtxRef.current = {
        isQuickMatchWildcard: true,
        isFreeCasual: false,
        entryUsd: 0,
        prizeUsd: 0,
        gameTitle: 'Any open contest',
        gameKey: H2H_QUICK_MATCH_GAME_KEY,
        waiterId: QUICK_MATCH_PLACEHOLDER_WAITER_ID,
        opponentName: 'Matching pool',
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
      'Sign in required',
      'Quick match uses your live account and wallet. Sign in to continue.',
    );
  }, [router, start, userId, profileQ.isFetched]);

  useEffect(() => {
    if (!quickMatch || quickAutoStartedRef.current) return;
    quickAutoStartedRef.current = true;
    void runQuickMatchResolve();
  }, [quickMatch, runQuickMatchResolve]);

  /** Home deep-links with `intent=join|start` — begin queue immediately so the host is actually in `h2h_queue_entries` when a joiner arrives. */
  useEffect(() => {
    if (!ENABLE_BACKEND || userId === 'guest') return;
    if (!profileQ.isFetched) return;
    if (quickMatch) return;
    if (queueIntent !== 'join' && queueIntent !== 'start') return;
    if (!gameKey || entryFeeUsd == null || listedPrizeUsd == null) return;
    if (h2hIntentAutostartDoneOrCancelledRef.current) return;
    if (useMatchmakingStore.getState().phase !== 'idle') return;

    void (async () => {
      await start();
      if (useMatchmakingStore.getState().phase === 'searching') {
        h2hIntentAutostartDoneOrCancelledRef.current = true;
      }
    })();
  }, [
    ENABLE_BACKEND,
    userId,
    profileQ.isFetched,
    quickMatch,
    queueIntent,
    gameKey,
    entryFeeUsd,
    listedPrizeUsd,
    start,
  ]);

  /**
   * After remount (e.g. React Strict Mode), `backendQueueParamsRef` is cleared but global `phase` can still be `searching`.
   * Without params, polling and Realtime never run — rehydrate from props or reset Quick Match (lost ctx).
   */
  useEffect(() => {
    if (!ENABLE_BACKEND || userId === 'guest' || phase !== 'searching') return;
    if (backendQueueParamsRef.current != null) return;

    if (quickMatch && quickMatchCtxRef.current == null) {
      cleanupBackendQueue();
      useMatchmakingStore.getState().reset();
      return;
    }

    if (quickMatch && quickMatchCtxRef.current?.isQuickMatchWildcard) {
      const live = profileQ.data?.wallet_cents ?? 0;
      quickMatchMaxAffordableEntryCentsRef.current = quickMatchCtxRef.current.maxAffordableEntryCents ?? live;
      backendQueueParamsRef.current = buildBackendQueueParams({
        mode,
        quickCtx: quickMatchCtxRef.current,
        entryFeeUsd,
        listedPrizeUsd,
        gameKey,
        queueTierCents,
      });
      void (async () => {
        if (!profileQ.isFetched) return;
        const blocked = await profileBlocksPaidSkillContest(userId);
        quickMatchMaxAffordableEntryCentsRef.current = blocked ? 0 : live;
      })();
      return;
    }

    backendQueueParamsRef.current = buildBackendQueueParams({
      mode,
      quickCtx: quickMatchCtxRef.current,
      entryFeeUsd,
      listedPrizeUsd,
      gameKey,
      queueTierCents,
    });
  }, [
    ENABLE_BACKEND,
    userId,
    phase,
    quickMatch,
    mode,
    entryFeeUsd,
    listedPrizeUsd,
    gameKey,
    queueTierCents,
    qc,
    profileQ.isFetched,
    profileQ.data?.wallet_cents,
  ]);

  function cleanupBackendQueue() {
    backendQueueParamsRef.current = null;
    if (!ENABLE_BACKEND) return;
    const uid = useAuthStore.getState().user?.id;
    if (uid && uid !== 'guest') {
      void (async () => {
        try {
          await h2hCancelQueue();
        } catch {
          /* network */
        }
        await qc.invalidateQueries({ queryKey: queryKeys.homeH2hBoard() });
      })();
    }
  }

  async function accept() {
    backendQueueParamsRef.current = null;
    entryChargedDemoRef.current = 0;
    const { mockMatchId: mid, opponent: opp, serverSessionReady } = useMatchmakingStore.getState();
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

    let resolvedGameKey: string = (q?.gameKey ?? gameKey) as string;
    if (resolvedGameKey === H2H_QUICK_MATCH_GAME_KEY && ENABLE_BACKEND && userId !== 'guest') {
      const supabase = getSupabase();
      const { data: ms } = await supabase.from('match_sessions').select('game_key').eq('id', mid).maybeSingle();
      const gk = ms?.game_key;
      if (typeof gk === 'string' && gk.trim().length > 0) resolvedGameKey = gk.trim();
    }

    if (ENABLE_BACKEND && userId !== 'guest') {
      if (serverSessionReady) {
        resolvedMatchId = mid;
        resolvedOpp = opp;
        void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        void qc.invalidateQueries({ queryKey: queryKeys.transactions(userId) });
        void qc.invalidateQueries({ queryKey: queryKeys.homeH2hBoard() });
      } else {
        const oppUuid = resolveDevOpponentUserId(opp.id);
        if (oppUuid && isUuid(oppUuid)) {
          try {
            const { match_session_id } = await createH2hMatchSessionViaEdge({
              mode,
              opponentUserId: oppUuid,
              gameKey: resolvedGameKey,
              entryFeeWalletCents:
                hasPaidEntry && effectiveEntry != null
                  ? (queueTierCents?.entry ?? Math.round(effectiveEntry * 100))
                  : undefined,
              listedPrizeUsdCents:
                hasPaidEntry && effectivePrize != null
                  ? (queueTierCents?.prize ?? Math.round(effectivePrize * 100))
                  : undefined,
            });
            resolvedMatchId = match_session_id;
            resolvedOpp = { ...opp, id: oppUuid };
            void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
            void qc.invalidateQueries({ queryKey: queryKeys.transactions(userId) });
          } catch (e) {
            Alert.alert('Could not start match', e instanceof Error ? e.message : 'Server error');
            return;
          }
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
    h2hIntentAutostartDoneOrCancelledRef.current = true;
    cleanupBackendQueue();
    refundEntryIfQueuedDemo();
    quickMatchCtxRef.current = null;
    reset();
  }

  /** Leave queue: always land on Arcade hub. `router.back()` after a cross-tab push from Home pops Home, not play/index. */
  function leaveScreen() {
    h2hIntentAutostartDoneOrCancelledRef.current = true;
    cleanupBackendQueue();
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

  /** Same action for host (`start`) and joiner (`join`) — both call the same pool RPC with this tier. */
  const samePoolIntent = queueIntent === 'join' || queueIntent === 'start';

  const idleCta = !hasPaidEntry
    ? 'Find match'
    : samePoolIntent
      ? 'Enter match queue'
      : 'Enter contest & find match';

  const searchingMsg =
    samePoolIntent && hasPaidEntry
      ? 'Pairing with another player…'
      : quickMatch
        ? q?.isQuickMatchWildcard
          ? 'Finding any opponent you can afford…'
          : 'Pairing you with an open player…'
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
        <SafeIonicons name="chevron-back" size={24} color={arcade.gold} />
        <Text style={styles.backText}>Arcade</Text>
      </Pressable>
      <Text className="mb-2 text-2xl font-black text-white">{title}</Text>
      {quickMatch ? (
        <Text className="mb-4 text-center text-sm text-slate-400">
          We match you with any open player in queue — any game, any contest tier. If your cash wallet can&apos;t cover contest access, add
          funds or play a free casual match (no access charge, no listed prize).
        </Text>
      ) : hasPaidEntry ? (
        <>
          <View style={styles.contestPricing}>
            <View style={styles.contestPricingCol}>
              <Text style={styles.contestPricingLbl}>Match access</Text>
              <Text style={styles.contestPricingAmt}>
                {formatUsdFromCents(Math.round((effectiveEntry ?? 0) * 100))}
              </Text>
            </View>
            <View style={styles.contestPricingRule} />
            <View style={[styles.contestPricingCol, styles.contestPricingPrizeCol]}>
              <Text style={styles.contestPrizeLbl}>🏆 Top performer prize</Text>
              <Text style={styles.contestPrizeAmt}>
                {formatUsdFromCents(Math.round((effectivePrize ?? 0) * 100))}
              </Text>
            </View>
          </View>
          {samePoolIntent ? (
            <Text className="mb-4 text-center text-sm text-slate-400">
              You and your opponent both use this same screen and the same button — you enter the{' '}
              <Text className="font-semibold text-slate-200">identical contest queue</Text> for this game and tier. Whoever is waiting first
              pairs with the next person who enters. (We also try to start the queue automatically when your profile is ready.)
            </Text>
          ) : (
            <>
              <Text className="mb-2 text-center text-xs font-semibold text-amber-200/90">{SKILL_CONTEST_LAUNCH_TITLE}</Text>
              <Text className="mb-2 text-center text-xs leading-5 text-slate-400">
                {SKILL_CONTEST_LAUNCH_BODY[0]} {SKILL_CONTEST_LAUNCH_BODY[2]}
              </Text>
              <Text className="mb-4 text-center text-sm text-slate-400">
                Cash wallet for access · top score wins the listed prize · losers earn Arcade Credits. {SKILL_CONTEST_ENTRY_SHORT}
              </Text>
            </>
          )}
        </>
      ) : (
        <Text className="mb-4 text-sm text-slate-400">Free casual matchmaking</Text>
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
              Prizes are set by tier and awarded by Run It — not a player pool. Every play earns something: Arcade Credits if you don&apos;t
              take top score.
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
  contestPricing: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  contestPricingCol: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  contestPricingPrizeCol: { backgroundColor: 'rgba(30,27,75,0.45)' },
  contestPricingLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  contestPricingAmt: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  contestPricingRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 8,
  },
  contestPrizeLbl: {
    color: 'rgba(254,243,199,0.95)',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
    lineHeight: 12,
  },
  contestPrizeAmt: {
    color: '#FDE047',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
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
