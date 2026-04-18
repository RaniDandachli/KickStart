import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { QuickMatchTierChips } from '@/components/arcade/QuickMatchTierChips';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { H2hQueueStatusLine } from '@/features/play/H2hFlowStatusLine';
import type { QuickMatchCtx } from '@/features/play/matchmakingTypes';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isSupabaseLikelyConfigured } from '@/lib/env';
import { useProfile } from '@/hooks/useProfile';
import { ensureArcadeAndroidNotificationChannel } from '@/lib/arcadeLocalNotifications';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { buildBackendQueueParams } from '@/lib/h2hBuildQueueParams';
import { syncExitMatchmakingToServer, type MatchmakingExitSnapshot } from '@/lib/matchmakingExitClient';
import { H2H_QUICK_MATCH_GAME_KEY } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { SKILL_CONTEST_LAUNCH_BODY, SKILL_CONTEST_LAUNCH_TITLE } from '@/constants/skillContestLaunch';
import { SKILL_CONTEST_ENTRY_SHORT } from '@/lib/skillContestCopy';
import { profileBlocksPaidSkillContest } from '@/lib/skillContestRegionGate';
import { arcade } from '@/lib/arcadeTheme';
import {
  defaultQuickMatchAllowedSelection,
  normalizeQuickMatchAllowedEntries,
} from '@/lib/quickMatchTiers';
import { pushCrossTab } from '@/lib/appNavigation';
import { useAuthStore } from '@/store/authStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { QUICK_MATCH_PLACEHOLDER_WAITER_ID, useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

export function QueueScreen({
  mode,
  entryFeeUsd,
  listedPrizeUsd,
  gameTitle,
  gameKey,
  queueIntent,
  quickMatch,
  queueTierCents,
  returnToHref,
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
  /** Preferred route when user leaves this flow. */
  returnToHref?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const profileQ = useProfile(ENABLE_BACKEND && userId !== 'guest' ? userId : undefined);
  const addWalletCents = useDemoWalletStore((s) => s.addWalletCents);
  const entryChargedDemoRef = useRef(0);
  /** Max entry fee (cents) Quick Match can accept — server `h2h_enqueue_quick_match` / `wildcard_budget_cents`. */
  const quickMatchMaxAffordableEntryCentsRef = useRef(0);
  const quickMatchAllowedEntryCentsRef = useRef<number[]>([0]);
  /** True after Home `intent=join|start` auto-fired `start()` once, or user cancelled — no repeat autostart until next navigation. */
  const h2hIntentAutostartDoneOrCancelledRef = useRef(false);
  const phase = useMatchmakingStore((s) => s.phase);
  const setPhase = useMatchmakingStore((s) => s.setPhase);
  const setQueue = useMatchmakingStore((s) => s.setQueue);
  const reset = useMatchmakingStore((s) => s.reset);
  const queueKind = useMatchmakingStore((s) => s.queue);
  const keepSearchingWhenAway = useMatchmakingStore((s) => s.keepSearchingWhenAway);
  const setKeepSearchingWhenAway = useMatchmakingStore((s) => s.setKeepSearchingWhenAway);
  const setQueuePollSnapshot = useMatchmakingStore((s) => s.setQueuePollSnapshot);
  const setMatchmakingAcceptRoute = useMatchmakingStore((s) => s.setMatchmakingAcceptRoute);

  function refundEntryIfQueuedDemo() {
    const n = entryChargedDemoRef.current;
    if (n > 0) {
      addWalletCents(n);
      entryChargedDemoRef.current = 0;
    }
  }

  const dismissMatchmakingToIdle = useCallback(() => {
    const st = useMatchmakingStore.getState();
    if (st.phase !== 'searching' && st.phase !== 'found') return;
    const snapshot: MatchmakingExitSnapshot = {
      phase: st.phase,
      mockMatchId: st.mockMatchId,
      serverSessionReady: st.serverSessionReady,
    };
    h2hIntentAutostartDoneOrCancelledRef.current = true;
    quickMatchCtxRef.current = null;
    refundEntryIfQueuedDemo();
    reset();
    void syncExitMatchmakingToServer(qc, snapshot);
  }, [qc, reset]);

  const quickMatchCtxRef = useRef<QuickMatchCtx | null>(null);
  /** Prevents double-tap / autostart + tap racing two `start()` calls (web + native). */
  const queueStartInFlightRef = useRef(false);
  const [quickResolving, setQuickResolving] = useState(false);
  const [quickMatchTierPick, setQuickMatchTierPick] = useState<number[]>([]);
  const [quickMatchDisplayCap, setQuickMatchDisplayCap] = useState(0);
  const quickMatchTierDefaultsAppliedRef = useRef(false);
  const leaveTarget = returnToHref ?? '/(app)/(tabs)/play';

  const pushMatchmakingAcceptRoute = useCallback(() => {
    if (userId === 'guest') return;
    setMatchmakingAcceptRoute({
      userId,
      mode,
      entryFeeUsd,
      listedPrizeUsd,
      gameKey,
      queueTierCents,
      returnToHref,
      quickMatch: !!quickMatch,
      quickMatchCtx: quickMatchCtxRef.current,
    });
  }, [
    userId,
    mode,
    entryFeeUsd,
    listedPrizeUsd,
    gameKey,
    queueTierCents,
    returnToHref,
    quickMatch,
    setMatchmakingAcceptRoute,
  ]);

  const onKeepSearchingChange = useCallback(
    async (next: boolean) => {
      setKeepSearchingWhenAway(next);
      if (!next || Platform.OS === 'web' || !ENABLE_BACKEND || userId === 'guest') return;
      await ensureArcadeAndroidNotificationChannel();
      const { status: before } = await Notifications.getPermissionsAsync();
      let status = before;
      if (before !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status === 'granted') {
        await registerExpoPushWithSupabase(userId);
        return;
      }
      Alert.alert(
        'Allow notifications to get pinged',
        'When an opponent is found while you’re in another app or your phone is locked, we can alert you. Turn on notifications for Run It Arcade in your device settings.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Open settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
    },
    [setKeepSearchingWhenAway, userId],
  );

  useEffect(() => {
    if (!quickMatch) quickMatchTierDefaultsAppliedRef.current = false;
  }, [quickMatch]);

  useEffect(() => {
    if (!quickMatch || !ENABLE_BACKEND || userId === 'guest') return;
    if (!profileQ.isFetched || profileQ.isError) return;
    let cancelled = false;
    void (async () => {
      const blocked = await profileBlocksPaidSkillContest(userId);
      if (cancelled) return;
      const live = profileQ.data?.wallet_cents ?? 0;
      const cap = blocked ? 0 : live;
      setQuickMatchDisplayCap(cap);
      if (!quickMatchTierDefaultsAppliedRef.current) {
        setQuickMatchTierPick(defaultQuickMatchAllowedSelection(cap));
        quickMatchTierDefaultsAppliedRef.current = true;
      } else {
        setQuickMatchTierPick((prev) => normalizeQuickMatchAllowedEntries(prev, cap));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quickMatch, userId, profileQ.isFetched, profileQ.isError, profileQ.data?.wallet_cents]);

  const start = useCallback(async () => {
    if (!ENABLE_BACKEND || userId === 'guest') {
      Alert.alert(
        'Sign in required',
        'Head-to-head matchmaking needs a signed-in account and online play. Sign in and try again.',
      );
      return;
    }
    if (queueStartInFlightRef.current) {
      return;
    }
    queueStartInFlightRef.current = true;
    try {
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
      const allowed = normalizeQuickMatchAllowedEntries(q.allowedEntryCents ?? quickMatchAllowedEntryCentsRef.current, max);
      quickMatchAllowedEntryCentsRef.current = allowed.length > 0 ? allowed : [0];
      quickMatchCtxRef.current = {
        ...q,
        maxAffordableEntryCents: max,
        allowedEntryCents: quickMatchAllowedEntryCentsRef.current,
      };
      setQueue(mode);
      setPhase('searching');
      const snap = buildBackendQueueParams({
        mode,
        quickCtx: quickMatchCtxRef.current,
        entryFeeUsd,
        listedPrizeUsd,
        gameKey,
        queueTierCents,
      });
      setQueuePollSnapshot(snap);
      pushMatchmakingAcceptRoute();
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

    const snap = buildBackendQueueParams({
      mode,
      quickCtx: quickMatchCtxRef.current,
      entryFeeUsd,
      listedPrizeUsd,
      gameKey,
      queueTierCents,
    });
    setQueuePollSnapshot(snap);
    pushMatchmakingAcceptRoute();
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
    setQueuePollSnapshot,
    pushMatchmakingAcceptRoute,
  ]);

  const runQuickMatchResolve = useCallback(async () => {
    if (ENABLE_BACKEND && userId !== 'guest') {
      if (!profileQ.isFetched) {
        setQuickResolving(false);
        Alert.alert('One moment', 'Loading your profile…');
        return;
      }
      const blocked = await profileBlocksPaidSkillContest(userId);
      const live = profileQ.data?.wallet_cents ?? 0;
      const max = blocked ? 0 : live;
      const selected = normalizeQuickMatchAllowedEntries(quickMatchTierPick, max);
      if (selected.length === 0) {
        Alert.alert('Pick a tier', 'Choose at least one contest tier (or Free casual) you want to match on.');
        return;
      }
      setQuickResolving(true);
      quickMatchMaxAffordableEntryCentsRef.current = max;
      quickMatchAllowedEntryCentsRef.current = selected;
      quickMatchCtxRef.current = {
        isQuickMatchWildcard: true,
        isFreeCasual: false,
        entryUsd: 0,
        prizeUsd: 0,
        gameTitle: 'Any open contest',
        gameKey: H2H_QUICK_MATCH_GAME_KEY,
        waiterId: QUICK_MATCH_PLACEHOLDER_WAITER_ID,
        opponentName: 'Matching pool',
        maxAffordableEntryCents: max,
        allowedEntryCents: selected,
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
  }, [start, userId, profileQ.isFetched, profileQ.data?.wallet_cents, quickMatchTierPick]);

  /**
   * Keep queue poll snapshot aligned with current route props whenever we are searching.
   */
  useEffect(() => {
    if (!ENABLE_BACKEND || userId === 'guest' || phase !== 'searching') return;

    if (quickMatch && quickMatchCtxRef.current == null) {
      dismissMatchmakingToIdle();
      return;
    }

    if (quickMatch && quickMatchCtxRef.current?.isQuickMatchWildcard) {
      const live = profileQ.data?.wallet_cents ?? 0;
      const syncCap = quickMatchCtxRef.current.maxAffordableEntryCents ?? live;
      quickMatchMaxAffordableEntryCentsRef.current = syncCap;
      const ctx0 = quickMatchCtxRef.current;
      const allowed = normalizeQuickMatchAllowedEntries(ctx0.allowedEntryCents ?? quickMatchAllowedEntryCentsRef.current, syncCap);
      quickMatchAllowedEntryCentsRef.current = allowed.length > 0 ? allowed : [0];
      quickMatchCtxRef.current = {
        ...ctx0,
        maxAffordableEntryCents: syncCap,
        allowedEntryCents: quickMatchAllowedEntryCentsRef.current,
      };
      setQueuePollSnapshot(
        buildBackendQueueParams({
          mode,
          quickCtx: quickMatchCtxRef.current,
          entryFeeUsd,
          listedPrizeUsd,
          gameKey,
          queueTierCents,
        }),
      );
      pushMatchmakingAcceptRoute();
      void (async () => {
        if (!profileQ.isFetched) return;
        const blocked = await profileBlocksPaidSkillContest(userId);
        const cap = blocked ? 0 : live;
        quickMatchMaxAffordableEntryCentsRef.current = cap;
        const ctx = quickMatchCtxRef.current;
        if (ctx?.isQuickMatchWildcard && useMatchmakingStore.getState().phase === 'searching') {
          const nextAllowed = normalizeQuickMatchAllowedEntries(ctx.allowedEntryCents ?? quickMatchAllowedEntryCentsRef.current, cap);
          quickMatchAllowedEntryCentsRef.current = nextAllowed.length > 0 ? nextAllowed : [0];
          quickMatchCtxRef.current = {
            ...ctx,
            maxAffordableEntryCents: cap,
            allowedEntryCents: quickMatchAllowedEntryCentsRef.current,
          };
          setQueuePollSnapshot(
            buildBackendQueueParams({
              mode,
              quickCtx: quickMatchCtxRef.current,
              entryFeeUsd,
              listedPrizeUsd,
              gameKey,
              queueTierCents,
            }),
          );
          pushMatchmakingAcceptRoute();
        }
      })();
      return;
    }

    setQueuePollSnapshot(
      buildBackendQueueParams({
        mode,
        quickCtx: quickMatchCtxRef.current,
        entryFeeUsd,
        listedPrizeUsd,
        gameKey,
        queueTierCents,
      }),
    );
    pushMatchmakingAcceptRoute();
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
    profileQ.isFetched,
    profileQ.data?.wallet_cents,
    dismissMatchmakingToIdle,
    setQueuePollSnapshot,
    pushMatchmakingAcceptRoute,
  ]);

  /** Leaving the queue route (back, another tab, refresh) while searching or on “match found” — full server + local cleanup. */
  useFocusEffect(
    useCallback(() => {
      return () => {
        const st = useMatchmakingStore.getState();
        if (st.phase === 'found') {
          dismissMatchmakingToIdle();
          return;
        }
        if (!st.keepSearchingWhenAway) {
          dismissMatchmakingToIdle();
        }
      };
    }, [dismissMatchmakingToIdle]),
  );

  function decline() {
    dismissMatchmakingToIdle();
  }

  /** Leave queue: return to initiating tab route when available. */
  function leaveScreen() {
    dismissMatchmakingToIdle();
    router.replace(leaveTarget as never);
  }

  const goTryQuickMatchAfterLeave = useCallback(() => {
    dismissMatchmakingToIdle();
    const rt = encodeURIComponent(returnToHref ?? '/(app)/(tabs)/play');
    pushCrossTab(router, `/(app)/(tabs)/play/casual?quick=1&returnTo=${rt}` as never);
  }, [dismissMatchmakingToIdle, returnToHref, router]);

  const goBrowseLiveAfterLeave = useCallback(() => {
    dismissMatchmakingToIdle();
    const rt = encodeURIComponent(returnToHref ?? '/(app)/(tabs)/play');
    pushCrossTab(router, `/(app)/(tabs)/play/live-matches?returnTo=${rt}` as never);
  }, [dismissMatchmakingToIdle, returnToHref, router]);

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
          ? 'Looking for someone actively waiting in queue…'
          : 'Pairing you with an open player…'
        : 'Searching for a fair opponent…';

  const supabaseConfigured = isSupabaseLikelyConfigured();

  return (
    <Screen scroll>
      {ENABLE_BACKEND && !supabaseConfigured ? (
        <Text className="mb-3 rounded-lg bg-amber-500/20 px-3 py-2 text-center text-xs font-semibold text-amber-100">
          Matchmaking can&apos;t connect right now. Check your internet connection, update the app, or try again in a moment.
        </Text>
      ) : null}
      {ENABLE_BACKEND && userId !== 'guest' && profileQ.isError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading wallet"
          onPress={() => void profileQ.refetch()}
          style={({ pressed }) => [styles.profileErrBanner, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.profileErrTxt}>Could not load your wallet. Tap to retry.</Text>
        </Pressable>
      ) : null}
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
      <H2hQueueStatusLine phase={phase} mode={queueKind ?? mode} />
      {quickMatch ? (
        <>
          <Text className="mb-4 text-center text-sm text-slate-400">
            Choose which contest access tiers you&apos;re OK with (free or paid). We only pair you on a tier you select — including with
            another Quick Match search (same minigame rotation as before). You can still match someone waiting on a specific game at a tier you
            allow. After you search, turn on <Text className="font-semibold text-slate-300">Keep my spot in queue</Text> below to browse the app
            and get notified when someone pairs — then accept or decline in the popup.
          </Text>
          {ENABLE_BACKEND && userId !== 'guest' && profileQ.isFetched && !profileQ.isError ? (
            <QuickMatchTierChips
              maxAffordableEntryCents={quickMatchDisplayCap}
              selected={quickMatchTierPick}
              onChange={setQuickMatchTierPick}
            />
          ) : null}
        </>
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
              You and your opponent both tap the same button below — that enters the{' '}
              <Text className="font-semibold text-slate-200">same contest queue</Text> for this game and tier. The first person waiting pairs
              with the next person who enters with the exact same tier (or joins you from Live / Quick Match).
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
          <Text className="mt-4 text-center text-slate-300">Preparing search…</Text>
        </View>
      ) : phase === 'idle' ? (
        quickMatch ? (
          <AppButton title="Search for opponent" onPress={() => void runQuickMatchResolve()} />
        ) : (
          <AppButton title={idleCta} onPress={() => void start()} />
        )
      ) : phase === 'searching' ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="mt-4 text-center text-slate-300">{searchingMsg}</Text>
          {hasPaidEntry ? (
            <Text className="mt-3 max-w-sm text-center text-xs leading-5 text-amber-100/90">
              1v1 needs <Text className="font-semibold text-amber-50">two different accounts</Text> (one player can&apos;t match themselves).
              Both players should pick the same game, fee, and prize tier.
            </Text>
          ) : null}
          {hasPaidEntry ? (
            <Text className="mt-2 text-center text-xs font-medium text-slate-400">
              Prizes are set by tier and awarded by Run It — not a player pool. Every play earns something: Arcade Credits if you don&apos;t
              take top score.
            </Text>
          ) : null}
          {ENABLE_BACKEND && userId !== 'guest' ? (
            <View className="mt-4 w-full max-w-sm rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-3 py-3">
              <View className="mb-2 flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 pr-1">
                  <Text className="text-sm font-black text-emerald-100">Keep my spot in queue</Text>
                  <Text className="mt-1 text-[11px] leading-4 text-slate-400">
                    {Platform.OS === 'web' ? (
                      <>
                        Leave this page and keep looking for an opponent in the background. Turn off if you want to stop searching when you go
                        back.
                      </>
                    ) : (
                      <>
                        <Text className="font-semibold text-slate-300">Recommended.</Text> Go anywhere in the app or lock your phone — we keep
                        your search running. When someone pairs, you&apos;ll get a{' '}
                        <Text className="font-semibold text-slate-300">phone alert</Text> (after you allow notifications) and a popup to accept.
                        Turn off to cancel matchmaking when you leave this screen.
                      </>
                    )}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Keep searching in the background"
                  value={keepSearchingWhenAway}
                  onValueChange={(v) => void onKeepSearchingChange(v)}
                  trackColor={{ false: 'rgba(255,255,255,0.18)', true: 'rgba(52,211,153,0.85)' }}
                  thumbColor={keepSearchingWhenAway ? '#f8fafc' : '#94a3b8'}
                  ios_backgroundColor="rgba(255,255,255,0.2)"
                />
              </View>
            </View>
          ) : null}
          <View className="mt-5 w-full max-w-sm rounded-xl border border-slate-500/35 bg-slate-950/55 px-4 py-3">
            <Text className="text-center text-xs font-bold text-slate-100">Still no opponent?</Text>
            <Text className="mt-1.5 text-center text-[11px] leading-5 text-slate-400">
              {quickMatch ? (
                <>
                  Few players online or your tier picks may be narrow. Add more tiers above, or open Live matches to queue for a specific game
                  and tier.
                </>
              ) : (
                <>
                  Matchmaking needs someone on the same game and tier. Try{' '}
                  <Text className="font-semibold text-slate-300">Quick Match</Text> for a wider pool, or{' '}
                  <Text className="font-semibold text-slate-300">Live matches</Text> to pick another contest.
                </>
              )}
            </Text>
            <AppButton className="mt-3" title="Browse live matches" variant="secondary" onPress={goBrowseLiveAfterLeave} />
            {!quickMatch ? (
              <AppButton className="mt-2" title="Try Quick Match instead" variant="ghost" onPress={goTryQuickMatchAfterLeave} />
            ) : null}
          </View>
          <AppButton className="mt-4" title="Cancel" variant="ghost" onPress={decline} />
        </View>
      ) : (
        <View className="items-center py-10">
          <Text className="max-w-xs text-center text-sm font-medium leading-5 text-slate-300">
            Match ready — accept in the popup
            {Platform.OS !== 'web' ? ' (you may also have gotten a notification if you were away).' : '.'}
          </Text>
          <AppButton className="mt-6" title="Cancel" variant="ghost" onPress={decline} />
        </View>
      )}
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
  profileErrBanner: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  profileErrTxt: {
    color: 'rgba(254,226,226,0.98)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
});
