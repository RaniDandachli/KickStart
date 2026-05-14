import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { QuickMatchSetupPanel } from '@/features/play/QuickMatchSetupPanel';
import { AsyncHostPendingRunsPanel } from '@/components/arcade/AsyncHostPendingRunsPanel';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { H2hQueueStatusLine } from '@/features/play/H2hFlowStatusLine';
import type { QuickMatchCtx } from '@/features/play/matchmakingTypes';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isSupabaseLikelyConfigured } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { isWebPushConfigured, registerWebPushForUser, unregisterWebPushForUser } from '@/lib/webPushRegister';
import { useHomeLobbyStats } from '@/hooks/useHomeLobbyStats';
import { useProfile } from '@/hooks/useProfile';
import { ensureArcadeAndroidNotificationChannel } from '@/lib/arcadeLocalNotifications';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { buildBackendQueueParams } from '@/lib/h2hBuildQueueParams';
import { supportsClientAsyncHostQueue } from '@/lib/h2hSkillContestGames';
import { buildOpenSlotWatchFromQueueParams } from '@/lib/h2hOpenSlotWatch';
import { syncExitMatchmakingToServer, type MatchmakingExitSnapshot } from '@/lib/matchmakingExitClient';
import { H2H_QUICK_MATCH_GAME_KEY } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { SKILL_CONTEST_LAUNCH_BODY, SKILL_CONTEST_LAUNCH_TITLE } from '@/constants/skillContestLaunch';
import { SKILL_CONTEST_ENTRY_SHORT } from '@/lib/skillContestCopy';
import { profileBlocksPaidSkillContest } from '@/lib/skillContestRegionGate';
import { arcade } from '@/lib/arcadeTheme';
import { runit, runitFont, runitShell } from '@/lib/runitArcadeTheme';
import {
  defaultQuickMatchSingleEntryFee,
  normalizeQuickMatchAllowedEntries,
} from '@/lib/quickMatchTiers';
import { pushCrossTab } from '@/lib/appNavigation';
import { useAuthStore } from '@/store/authStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { QUICK_MATCH_PLACEHOLDER_WAITER_ID, useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

/** After this many seconds searching, Quick Match slow-queue tips use stronger copy (async play is per-game; see `canOfferAsyncWhileSearching`). */
const ASYNC_PLAY_WAIT_PROMPT_SEC = 60;

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
  onOpenHowItWorks,
  queueAutoStart = false,
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
  /** Quick Match “Learn more” — e.g. open Arcade how-it-works from `casual.tsx`. */
  onOpenHowItWorks?: () => void;
  /** From choose-contest / pick-game: begin search immediately (one tap). */
  queueAutoStart?: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const profileQ = useProfile(ENABLE_BACKEND && userId !== 'guest' ? userId : undefined);
  const lobbyStatsQ = useHomeLobbyStats();
  const addWalletCents = useDemoWalletStore((s) => s.addWalletCents);
  const entryChargedDemoRef = useRef(0);
  /** Max entry fee (cents) Quick Match can accept — server `h2h_enqueue_quick_match` / `wildcard_budget_cents`. */
  const quickMatchMaxAffordableEntryCentsRef = useRef(0);
  const quickMatchAllowedEntryCentsRef = useRef<number[]>([0]);
  /** True after Home `intent=join|start` auto-fired `start()` once, or user cancelled — no repeat autostart until next navigation. */
  const h2hIntentAutostartDoneOrCancelledRef = useRef(false);
  /** One-shot: `?autoStart=1` from choose-contest / pick-game enters search without a second tap. */
  const queueAutoStartFiredRef = useRef(false);
  const phase = useMatchmakingStore((s) => s.phase);
  const setPhase = useMatchmakingStore((s) => s.setPhase);
  const setQueue = useMatchmakingStore((s) => s.setQueue);
  const reset = useMatchmakingStore((s) => s.reset);
  const queueKind = useMatchmakingStore((s) => s.queue);
  const keepSearchingWhenAway = useMatchmakingStore((s) => s.keepSearchingWhenAway);
  const setKeepSearchingWhenAway = useMatchmakingStore((s) => s.setKeepSearchingWhenAway);
  const [pingOpenQueueAlerts, setPingOpenQueueAlerts] = useState(false);
  const [searchElapsedSec, setSearchElapsedSec] = useState(0);
  const radarSpin = useRef(new Animated.Value(0)).current;
  /** One-time sync from server when a search starts so the Switch matches account after remount/refetch. */
  const openPingHydratedRef = useRef(false);
  const prevPhaseRef = useRef(phase);
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
  const [quickMatchTierPick, setQuickMatchTierPick] = useState<number[]>([0]);
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
    if (phase !== 'searching') {
      openPingHydratedRef.current = false;
      return;
    }
    if (!ENABLE_BACKEND || userId === 'guest' || !profileQ.data || openPingHydratedRef.current) return;
    const p = profileQ.data;
    const w = p.h2h_open_slot_watch as { enabled?: boolean } | undefined;
    if (p.push_notify_h2h_open_slots === true && w?.enabled === true) {
      setPingOpenQueueAlerts(true);
    }
    openPingHydratedRef.current = true;
  }, [phase, userId, profileQ.data]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === 'searching' && phase === 'idle' && ENABLE_BACKEND && userId !== 'guest') {
      setPingOpenQueueAlerts(false);
      void registerExpoPushWithSupabase(userId);
    }
    prevPhaseRef.current = phase;
  }, [phase, userId]);

  const onPingOpenQueueAlertsChange = useCallback(
    async (next: boolean) => {
      if (!ENABLE_BACKEND || userId === 'guest') return;
      setPingOpenQueueAlerts(next);
      if (!next) {
        await unregisterWebPushForUser();
        await registerExpoPushWithSupabase(userId);
        if (userId !== 'guest') void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        return;
      }
      const quickCtx = quickMatchCtxRef.current;
      const openWatch = buildOpenSlotWatchFromQueueParams({
        mode,
        quickCtx,
        entryFeeUsd,
        listedPrizeUsd,
        gameKey,
        queueTierCents,
      });
      if (Platform.OS !== 'web') {
        await ensureArcadeAndroidNotificationChannel();
        const { status: before } = await Notifications.getPermissionsAsync();
        let status = before;
        if (before !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted') {
          setPingOpenQueueAlerts(false);
          Alert.alert(
            'Notifications needed',
            'Turn on notifications for Run It Arcade in system settings so we can ping you when someone joins a matching queue.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ],
          );
          return;
        }
        await registerExpoPushWithSupabase(userId, { openSlotWatch: { ...openWatch, enabled: true } });
      } else {
        /** Web: subscribe + save keys first so we do not mark the profile “on” if the browser cannot push. */
        if (isWebPushConfigured()) {
          const wr = await registerWebPushForUser();
          if (!wr.ok) {
            setPingOpenQueueAlerts(false);
            Alert.alert('Browser notifications', wr.error);
            return;
          }
        }
        await registerExpoPushWithSupabase(userId, { openSlotWatch: { ...openWatch, enabled: true } });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
    [userId, mode, entryFeeUsd, listedPrizeUsd, gameKey, queueTierCents, qc],
  );

  /** One tap for users stuck searching — same contest rules, but they can leave the screen and get pinged. */
  const enableBackgroundSearchAndAlerts = useCallback(async () => {
    await onKeepSearchingChange(true);
    await onPingOpenQueueAlertsChange(true);
  }, [onKeepSearchingChange, onPingOpenQueueAlertsChange]);

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
        setQuickMatchTierPick(defaultQuickMatchSingleEntryFee(cap));
        quickMatchTierDefaultsAppliedRef.current = true;
      } else {
        setQuickMatchTierPick((prev) => {
          const norm = normalizeQuickMatchAllowedEntries(prev, cap);
          if (norm.length === 0) return [0];
          const preferred = norm.find((c) => prev.includes(c));
          return [preferred ?? norm[norm.length - 1]!];
        });
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
      setPingOpenQueueAlerts(false);
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
    setPingOpenQueueAlerts(false);
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
        Alert.alert('Pick an entry fee', 'Choose an entry fee (including free practice) to search on.');
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

  /** Home tab: pick game + tier and start/join so others hit the same contest row. */
  const goHomePickEntryFee = useCallback(() => {
    dismissMatchmakingToIdle();
    router.push('/(app)/(tabs)' as never);
  }, [dismissMatchmakingToIdle, router]);

  const goArcadeWarmup = useCallback(() => {
    dismissMatchmakingToIdle();
    router.push('/(app)/(tabs)/play' as never);
  }, [dismissMatchmakingToIdle, router]);

  /** Leave live search and open async host submit for the current game + tier (same cents resolution as idle “async tier” card). */
  const openAsyncSubmitFromQueue = useCallback(() => {
    const qNow = quickMatchCtxRef.current;
    const isFc = qNow?.isFreeCasual === true;
    const eUsd = isFc ? undefined : qNow != null ? qNow.entryUsd : entryFeeUsd;
    const pUsd = isFc ? undefined : qNow != null ? qNow.prizeUsd : listedPrizeUsd;
    const gkRaw = gameKey?.trim();
    if (!gkRaw || !supportsClientAsyncHostQueue(gkRaw) || eUsd == null || pUsd == null || Number.isNaN(eUsd) || Number.isNaN(pUsd)) {
      return;
    }
    const ec = qNow?.exactTierCents?.entry ?? queueTierCents?.entry ?? Math.round(eUsd * 100);
    const pc = qNow?.exactTierCents?.prize ?? queueTierCents?.prize ?? Math.round(pUsd * 100);
    const rt = encodeURIComponent(returnToHref ?? '/(app)/(tabs)/play');
    const gk = encodeURIComponent(gkRaw);
    dismissMatchmakingToIdle();
    router.push(
      `/(app)/(tabs)/play/contest-async-submit?asyncStake=1&gameKey=${gk}&h2hMode=${mode}&entryCents=${ec}&prizeCents=${pc}&returnTo=${rt}` as never,
    );
  }, [
    gameKey,
    entryFeeUsd,
    listedPrizeUsd,
    queueTierCents?.entry,
    queueTierCents?.prize,
    mode,
    returnToHref,
    router,
    dismissMatchmakingToIdle,
  ]);

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

  useEffect(() => {
    if (!queueAutoStart || queueAutoStartFiredRef.current) return;
    if (quickMatch || phase !== 'idle') return;
    if (!gameKey?.trim() || !hasPaidEntry || !samePoolIntent) return;
    if (!ENABLE_BACKEND || userId === 'guest') {
      queueAutoStartFiredRef.current = true;
      return;
    }
    if (!profileQ.isFetched) return;
    if (profileQ.isError) {
      queueAutoStartFiredRef.current = true;
      return;
    }
    queueAutoStartFiredRef.current = true;
    void start();
  }, [
    queueAutoStart,
    quickMatch,
    phase,
    gameKey,
    hasPaidEntry,
    samePoolIntent,
    ENABLE_BACKEND,
    userId,
    profileQ.isFetched,
    profileQ.isError,
    start,
  ]);

  const idleCta = !hasPaidEntry
    ? 'Find match'
    : samePoolIntent
      ? 'Find match'
      : 'Enter contest & find match';

  const searchingMsg =
    samePoolIntent && hasPaidEntry
      ? 'Searching for a skilled opponent…'
      : quickMatch
        ? q?.isQuickMatchWildcard
          ? 'Looking for someone actively waiting in queue…'
          : 'Pairing you with an open player…'
        : 'Searching for a fair opponent…';

  const supabaseConfigured = isSupabaseLikelyConfigured();

  useEffect(() => {
    if (phase !== 'searching') {
      setSearchElapsedSec(0);
      radarSpin.setValue(0);
      return;
    }
    const tick = setInterval(() => setSearchElapsedSec((s) => s + 1), 1000);
    const spin = Animated.loop(
      Animated.timing(radarSpin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => {
      clearInterval(tick);
      spin.stop();
    };
  }, [phase, radarSpin]);

  const radarSweepRotate = radarSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const searchClock = `${String(Math.floor(searchElapsedSec / 60)).padStart(2, '0')}:${String(searchElapsedSec % 60).padStart(2, '0')}`;

  /** Paid game+tier queue only — play solo now, score is stored until an opponent completes their run. */
  const canOfferAsyncWhileSearching =
    phase === 'searching' &&
    !quickMatch &&
    hasPaidEntry &&
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    !!gameKey?.trim() &&
    supportsClientAsyncHostQueue(gameKey);

  const showAsyncPlayWhileSearchingPanel = canOfferAsyncWhileSearching;

  const radarQueueHint = canOfferAsyncWhileSearching
    ? searchElapsedSec < ASYNC_PLAY_WAIT_PROMPT_SEC
      ? 'Most matches pair quickly — or tap below to play your run now; we compare scores when someone joins this tier.'
      : 'Still in queue? Play your run now (below) — we exit live search, save your score, and settle when the next player finishes.'
    : searchElapsedSec < ASYNC_PLAY_WAIT_PROMPT_SEC
      ? 'Most matches pair in under 60 seconds.'
      : 'At launch the player pool can be small — try again later or pick another tier.';

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
      {ENABLE_BACKEND && userId !== 'guest' ? <AsyncHostPendingRunsPanel userId={userId} /> : null}
      {phase === 'searching' ? (
        <>
          <Text style={[styles.findHero, { fontFamily: runitFont.black }]}>Finding Your Match</Text>
          <Text style={styles.findSub}>
            We&apos;ll pair you with the next{' '}
            <Text style={styles.findSubEm}>{displayGameTitle ?? (quickMatch ? 'matching' : '1v1')} player</Text>
            {hasPaidEntry ? ' in this tier.' : quickMatch ? ' on an allowed tier.' : '.'}
          </Text>
          <View style={styles.searchingLivePill}>
            <View style={styles.searchingLiveDot} />
            <Text style={styles.searchingLiveTxt}>Searching live queue</Text>
          </View>
        </>
      ) : quickMatch ? null : (
        <Text style={styles.pageTitle}>{title}</Text>
      )}
      {phase !== 'searching' && !(quickMatch && phase === 'idle' && !quickResolving) ? (
        <H2hQueueStatusLine phase={phase} mode={queueKind ?? mode} />
      ) : null}
      {quickMatch && phase === 'idle' && !quickResolving ? (
        <QuickMatchSetupPanel
          lobby={lobbyStatsQ.data ?? undefined}
          maxAffordableEntryCents={
            ENABLE_BACKEND && userId !== 'guest' && profileQ.isFetched && !profileQ.isError ? quickMatchDisplayCap : 0
          }
          selectedEntryCents={quickMatchTierPick}
          onSelectEntryFee={(c) => setQuickMatchTierPick([c])}
          onStartSearch={() => void runQuickMatchResolve()}
          onOpenHowItWorks={onOpenHowItWorks}
          onHomePickEntryFee={goHomePickEntryFee}
          onArcadePractice={goArcadeWarmup}
          keepSearchingWhenAway={keepSearchingWhenAway}
          onKeepSearchingChange={(v) => void onKeepSearchingChange(v)}
          pingOpenQueueAlerts={pingOpenQueueAlerts}
          onPingOpenQueueAlertsChange={(v) => void onPingOpenQueueAlertsChange(v)}
          showNotificationSettings={ENABLE_BACKEND && userId !== 'guest'}
          isWebPushConfigured={isWebPushConfigured()}
        />
      ) : null}
      {!quickMatch && hasPaidEntry ? (
        <>
          {phase !== 'searching' ? (
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
              {hasPaidEntry &&
              supportsClientAsyncHostQueue(gameKey) &&
              phase === 'idle' &&
              ENABLE_BACKEND &&
              userId !== 'guest' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Submit async run for this tier"
                  onPress={() => {
                    const ec = Math.round((effectiveEntry ?? 0) * 100);
                    const pc = Math.round((effectivePrize ?? 0) * 100);
                    const rt = encodeURIComponent(returnToHref ?? '/(app)/(tabs)/play');
                    const gk = encodeURIComponent(String(gameKey ?? 'tap-dash'));
                    router.push(
                      `/(app)/(tabs)/play/contest-async-submit?asyncStake=1&gameKey=${gk}&h2hMode=${mode}&entryCents=${ec}&prizeCents=${pc}&returnTo=${rt}` as never,
                    );
                  }}
                  style={({ pressed }) => [styles.asyncTierCard, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.asyncTierTitle}>Submit async run (this tier)</Text>
                  <Text style={styles.asyncTierBody}>
                    Play once now with your contest wallet entry held for this row — not live matchmaking. Someone who later joins from the queue with the same entry fee
                    from the queue still plays live; we compare scores when they finish. Use Home or notifications when you get a hit.
                  </Text>
                  <Text style={styles.asyncTierCta}>Open minigame →</Text>
                </Pressable>
              ) : null}
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
          ) : null}
        </>
      ) : !quickMatch ? (
        <Text className="mb-4 text-sm text-slate-400">Free casual matchmaking</Text>
      ) : null}
      {quickResolving && phase === 'idle' ? (
        <View style={styles.qmPreparing}>
          <ActivityIndicator size="large" color={runit.neonPink} />
          <Text style={styles.qmPreparingTxt}>Preparing search…</Text>
        </View>
      ) : phase === 'idle' && !quickMatch ? (
        <AppButton title={idleCta} onPress={() => void start()} />
      ) : phase === 'searching' ? (
        <View style={styles.retroSearchWrap}>
          <View style={styles.radarCard}>
            <View style={styles.radarCardLeft}>
              <Text style={styles.radarTitle}>Searching for opponent…</Text>
              <Text style={styles.radarSub}>
                Finding another player in <Text style={styles.radarSubEm}>{displayGameTitle ?? 'this queue'}</Text>
              </Text>
              <View style={styles.radarClockRow}>
                <SafeIonicons name="time-outline" size={22} color={runit.neonPink} />
                <Text style={[styles.radarClock, { fontFamily: runitFont.black }]}>{searchClock}</Text>
              </View>
              <Text style={styles.radarHint}>{radarQueueHint}</Text>
            </View>
            <View style={styles.radarCardRight}>
              <View style={styles.radarRings}>
                <View style={[styles.radarRing, styles.radarRing1]} />
                <View style={[styles.radarRing, styles.radarRing2]} />
                <View style={[styles.radarRing, styles.radarRing3]} />
                <Animated.View
                  style={[
                    styles.radarSweep,
                    {
                      transform: [{ rotate: radarSweepRotate }],
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {showAsyncPlayWhileSearchingPanel ? (
            <View style={[styles.asyncTierCard, styles.asyncPlayWhileSearchCard, styles.asyncPlayTopCard]}>
              <Text style={styles.asyncTierTitle}>Play now · compare later</Text>
              <Text style={styles.asyncTierBody}>
                Run your contest for this game and tier right away — we record your score. When another player joins and finishes their run, we compare scores and determine the winner for this contest row.
              </Text>
              <Text style={styles.asyncPlayWhileSearchFoot}>
                This leaves the live queue first (frees your spot), then opens the minigame.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play contest run now and lock score for a later match on this tier"
                onPress={openAsyncSubmitFromQueue}
                style={({ pressed }) => [styles.asyncPlayWhileSearchCtaWrap, pressed && { opacity: 0.88 }]}
              >
                <Text style={styles.asyncTierCta}>Play my run & lock score →</Text>
              </Pressable>
            </View>
          ) : null}

          {hasPaidEntry ? (
            <View style={styles.retroDualRow}>
              <View style={[styles.retroFeeCard, styles.retroFeeCardPurple]}>
                <SafeIonicons name="hardware-chip-outline" size={22} color={runit.neonPurple} />
                <Text style={styles.retroFeeLbl}>ENTRY (MATCH ACCESS)</Text>
                <Text style={[styles.retroFeeAmt, { fontFamily: runitFont.black }]}>
                  {formatUsdFromCents(Math.round((effectiveEntry ?? 0) * 100))}
                </Text>
              </View>
              <View style={[styles.retroFeeCard, styles.retroFeeCardGold]}>
                <SafeIonicons name="trophy" size={22} color={runit.gold} />
                <Text style={styles.retroPrizeLblCaps}>TOP PERFORMER PRIZE</Text>
                <Text style={[styles.retroPrizeAmtLg, { fontFamily: runitFont.black }]}>
                  {formatUsdFromCents(Math.round((effectivePrize ?? 0) * 100))}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.vsCard}>
            <View style={styles.vsCol}>
              <Text style={styles.vsLbl}>You</Text>
              <View style={styles.vsOrbYou}>
                <SafeIonicons name="happy-outline" size={30} color="#0c0618" />
              </View>
              <View style={styles.vsPedGold} />
            </View>
            <Text style={[styles.vsWord, { fontFamily: runitFont.black }]}>VS</Text>
            <View style={styles.vsCol}>
              <Text style={styles.vsLbl}>Waiting for opponent</Text>
              <View style={styles.vsOrbWait}>
                <SafeIonicons name="person-outline" size={30} color="rgba(226,232,240,0.45)" />
              </View>
              <View style={styles.vsPedPurple} />
            </View>
          </View>

          <View style={styles.stepsRow}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleOn]}>
                <Text style={[styles.stepNum, { fontFamily: runitFont.black }]}>1</Text>
              </View>
              <SafeIonicons name="game-controller-outline" size={16} color={runit.gold} style={styles.stepIcon} />
              <Text style={styles.stepTitleOn}>Join queue</Text>
              <Text style={styles.stepCapOn}>You&apos;re in line</Text>
            </View>
            <View style={styles.stepDash} />
            <View style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={[styles.stepNumMuted, { fontFamily: runitFont.black }]}>2</Text>
              </View>
              <SafeIonicons name="people-outline" size={16} color="rgba(167,139,250,0.7)" style={styles.stepIcon} />
              <Text style={styles.stepTitleMuted}>Match player</Text>
              <Text style={styles.stepCapMuted}>Pair when ready</Text>
            </View>
            <View style={styles.stepDash} />
            <View style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={[styles.stepNumMuted, { fontFamily: runitFont.black }]}>3</Text>
              </View>
              <SafeIonicons name="stats-chart" size={16} color="rgba(167,139,250,0.7)" style={styles.stepIcon} />
              <Text style={styles.stepTitleMuted}>Play for score</Text>
              <Text style={styles.stepCapMuted}>Highest wins</Text>
            </View>
          </View>

          <Text style={styles.searchingMsgRetro}>{searchingMsg}</Text>
          {hasPaidEntry ? (
            <>
              <Text style={styles.finePrintPink}>
                1v1 needs <Text style={styles.finePrintPinkBold}>two different accounts</Text> (you can&apos;t match yourself). Same game, fee,
                and prize tier.
              </Text>
              <Text style={styles.finePrintMuted}>
                Prizes follow the tier. Arcade Credits if you don&apos;t take top score.
              </Text>
            </>
          ) : null}

          {ENABLE_BACKEND && userId !== 'guest' ? (
            <View style={styles.toggleDeck}>
              <View style={[styles.toggleRow, styles.toggleRowGold]}>
                <View style={styles.toggleRowLeft}>
                  <SafeIonicons name="notifications-outline" size={18} color={runit.gold} />
                  <View style={styles.toggleTextCol}>
                    <Text style={[styles.toggleTitle, { color: runit.gold }]}>Keep my spot in queue</Text>
                    <Text style={styles.toggleBody}>
                      {Platform.OS === 'web'
                        ? 'Leave this page and keep searching in the background. Turn off to stop when you go back.'
                        : 'Recommended — browse the app or lock your phone; we keep searching and alert you when someone pairs.'}
                    </Text>
                  </View>
                </View>
                <Switch
                  accessibilityLabel="Keep searching in the background"
                  value={keepSearchingWhenAway}
                  onValueChange={(v) => void onKeepSearchingChange(v)}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(255,215,0,0.55)' }}
                  thumbColor={keepSearchingWhenAway ? '#0c0618' : '#64748b'}
                  ios_backgroundColor="rgba(255,255,255,0.12)"
                />
              </View>
              <View style={[styles.toggleRow, styles.toggleRowPink]}>
                <View style={styles.toggleRowLeft}>
                  <SafeIonicons name="notifications-outline" size={18} color={runit.neonPink} />
                  <View style={styles.toggleTextCol}>
                    <Text style={[styles.toggleTitle, { color: runit.neonPink }]}>Ping me for open queues</Text>
                    <Text style={styles.toggleBody}>
                      {Platform.OS === 'web'
                        ? isWebPushConfigured()
                          ? 'Browser notifications when someone queues for a matching contest. Filters in Profile → Settings.'
                          : 'Saves filters on your account; add web push keys for browser alerts. Mobile uses Expo push.'
                        : 'Push when someone is waiting for a contest like this — jump in from Live matches.'}
                    </Text>
                  </View>
                </View>
                <Switch
                  accessibilityLabel="Notify when someone queues for a matching contest"
                  value={pingOpenQueueAlerts}
                  onValueChange={(v) => void onPingOpenQueueAlertsChange(v)}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(232,121,249,0.55)' }}
                  thumbColor={pingOpenQueueAlerts ? '#f8fafc' : '#64748b'}
                  ios_backgroundColor="rgba(255,255,255,0.12)"
                />
              </View>
            </View>
          ) : null}

          <View style={styles.faqCard}>
            {hasPaidEntry ? (
              <>
                <View style={styles.faqHead}>
                  <SafeIonicons name="help-circle-outline" size={20} color="rgba(148,163,184,0.95)" />
                  <Text style={[styles.faqTitle, { fontFamily: runitFont.black }]}>How 1v1 scoring works</Text>
                </View>
                <Text style={styles.faqBody}>
                  {quickMatch
                    ? 'When Quick Match pairs you, each player plays a run. Higher score wins the listed prize for that tier; others earn Arcade Credits.'
                    : canOfferAsyncWhileSearching
                      ? 'Each player plays a run. We compare scores — higher wins the top performer prize for this tier; consolation credits if you do not. You can also use “Play now · compare later” (green card above) to play right away; we save your score until another player joins this tier and finishes their run.'
                      : 'Each player plays a run. We compare scores — higher wins the top performer prize for this tier; consolation credits if you do not.'}
                </Text>
                {ENABLE_BACKEND && userId !== 'guest' ? (
                  <Pressable
                    onPress={() => void enableBackgroundSearchAndAlerts()}
                    disabled={keepSearchingWhenAway && pingOpenQueueAlerts}
                    style={({ pressed }) => [
                      styles.faqLink,
                      (keepSearchingWhenAway && pingOpenQueueAlerts) && styles.faqLinkDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.faqLinkTxt}>
                      {keepSearchingWhenAway && pingOpenQueueAlerts
                        ? 'Background search & alerts on'
                        : 'Turn on background search & alerts'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.faqTitleSm}>Still no opponent?</Text>
                <Text style={styles.faqBody}>
                  {quickMatch
                    ? 'Open Home to start a contest at an exact game and entry fee so the next player joins your row, try more tiers above, or keep background search on while you practice in Arcade.'
                    : 'Try Quick Match for a wider pool, or Live matches to pick another contest.'}
                </Text>
              </>
            )}
            <AppButton style={styles.retroBrowseBtn} title="Browse live matches" variant="secondary" onPress={goBrowseLiveAfterLeave} />
            {!quickMatch ? (
              <AppButton style={styles.retroQuickBtn} title="Try Quick Match instead" variant="ghost" onPress={goTryQuickMatchAfterLeave} />
            ) : (
              <AppButton style={styles.retroQuickBtn} title="Home — pick entry fee" variant="ghost" onPress={goHomePickEntryFee} />
            )}
          </View>

          {quickMatch && searchElapsedSec >= 25 ? (
            <View style={styles.queueSlowBanner}>
              <Text style={styles.queueSlowTitle}>
                {searchElapsedSec >= ASYNC_PLAY_WAIT_PROMPT_SEC ? 'Still waiting?' : 'Taking a while?'}
              </Text>
              <Text style={styles.queueSlowBody}>
                {searchElapsedSec >= ASYNC_PLAY_WAIT_PROMPT_SEC
                  ? 'With fewer players online, Quick Match can take longer — you are not blocked. Open Home, pick the exact game and entry fee you want, and either wait in that row or play your run first so the next person who joins the same tier can be matched against your score when they finish.'
                  : 'Fewer players online usually means a longer wait on Quick Match. The clearest path is Home: pick a game and entry fee tier and start a queue so the next player joins your exact contest. You can also keep searching here and practice in Arcade.'}
              </Text>
              <View style={styles.queueSlowActions}>
                <Pressable
                  onPress={goHomePickEntryFee}
                  accessibilityRole="button"
                  accessibilityLabel="Open Home to pick an entry fee"
                  style={({ pressed }) => [styles.queueSlowBtn, pressed && { opacity: 0.88 }]}
                >
                  <Text style={styles.queueSlowBtnTxt}>Home — pick entry fee</Text>
                </Pressable>
                <Pressable
                  onPress={goArcadeWarmup}
                  accessibilityRole="button"
                  accessibilityLabel="Open Arcade to practice"
                  style={({ pressed }) => [styles.queueSlowBtn, styles.queueSlowBtnGhost, pressed && { opacity: 0.88 }]}
                >
                  <Text style={styles.queueSlowBtnTxtGhost}>Arcade — practice</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View
            style={styles.retroKeepBtn}
            accessible
            accessibilityLabel="You are actively searching for a match"
          >
            <SafeIonicons name="game-controller-outline" size={24} color="#0c0618" />
            <View style={styles.retroKeepTxtCol}>
              <Text style={[styles.retroKeepTitle, { fontFamily: runitFont.black }]}>Keep Searching</Text>
              <Text style={styles.retroKeepSub}>Find me a match</Text>
            </View>
          </View>

          <Pressable
            onPress={decline}
            accessibilityRole="button"
            accessibilityLabel="Leave queue"
            style={({ pressed }) => [styles.retroLeaveBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={[styles.retroLeaveTitle, { fontFamily: runitFont.black }]}>Leave Queue</Text>
            <Text style={styles.retroLeaveSub}>Exit and stop searching</Text>
          </Pressable>

          <View style={styles.retroTrustRow}>
            <SafeIonicons name="shield-checkmark-outline" size={14} color="rgba(148,163,184,0.85)" />
            <Text style={styles.retroTrustTxt}>Fair matches · Real players · Real prizes</Text>
          </View>
        </View>
      ) : null}
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
  asyncTierCard: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.38)',
    backgroundColor: 'rgba(6,78,59,0.22)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  asyncTierTitle: {
    color: '#ecfdf5',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  asyncTierBody: {
    color: 'rgba(148,163,184,0.96)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  asyncTierCta: {
    color: runit.neonPink,
    fontSize: 13,
    fontWeight: '800',
  },
  asyncPlayWhileSearchCard: {
    marginTop: 6,
    marginBottom: 12,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  asyncPlayTopCard: {
    marginTop: 16,
  },
  asyncPlayWhileSearchFoot: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  asyncPlayWhileSearchCtaWrap: {
    alignSelf: 'flex-start',
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

  pageTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },

  qmScreenTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  qmIntro: {
    color: 'rgba(203,213,225,0.95)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  qmStakesPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  qmStakesHead: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  qmStakesBody: {
    color: 'rgba(148,163,184,0.96)',
    fontSize: 12,
    lineHeight: 17,
  },
  qmStakesEm: { fontWeight: '800', color: '#e2e8f0' },
  qmStakesActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    justifyContent: 'center',
  },
  qmStakeLink: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(79,70,229,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.45)',
  },
  qmStakeLinkGhost: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(148,163,184,0.35)',
  },
  qmStakeLinkTxt: { color: '#e0e7ff', fontSize: 12, fontWeight: '800' },
  qmStakeLinkTxtGhost: { color: 'rgba(226,232,240,0.9)', fontSize: 12, fontWeight: '700' },
  qmTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.45)',
    marginBottom: 14,
  },
  qmTipTxt: { flex: 1, color: 'rgba(226,232,240,0.9)', fontSize: 12, lineHeight: 17 },
  qmTipBold: { fontWeight: '800', color: '#cbd5e1' },
  qmSearchCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.45)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  qmSearchHead: { color: '#e2e8f0', fontSize: 15, marginBottom: 12, textAlign: 'center', fontWeight: '800' },
  qmSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qmSearchBtnTxt: { color: '#fff', fontSize: 15, letterSpacing: 0.2 },
  qmSettingsPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 14,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  qmSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
  },
  qmSettingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.22)',
    marginLeft: 28,
  },
  qmSettingTitle: { fontSize: 12, fontWeight: '800', color: '#e2e8f0', marginBottom: 2 },
  qmToggleCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
  qmToggleTxtCol: { flex: 1, minWidth: 0 },
  qmToggleBody: { color: 'rgba(148,163,184,0.95)', fontSize: 10, lineHeight: 14 },
  qmHowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.4)',
    marginBottom: 8,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  qmHowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  qmHowMid: { flex: 1, minWidth: 0 },
  qmHowTitle: { color: '#e2e8f0', fontSize: 14, marginBottom: 4, fontWeight: '800' },
  qmHowSub: { color: 'rgba(148,163,184,0.95)', fontSize: 11, lineHeight: 15 },
  qmHowCta: { color: '#a5b4fc', fontWeight: '800', fontSize: 12 },
  qmPreparing: { alignItems: 'center', paddingVertical: 24 },
  qmPreparingTxt: { marginTop: 12, color: 'rgba(203,213,225,0.95)', fontSize: 14, textAlign: 'center' },

  queueSlowBanner: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    backgroundColor: 'rgba(30,27,75,0.45)',
  },
  queueSlowTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  queueSlowBody: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  queueSlowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  queueSlowBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(79,70,229,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.4)',
  },
  queueSlowBtnGhost: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(148,163,184,0.35)',
  },
  queueSlowBtnTxt: { color: '#e0e7ff', fontSize: 12, fontWeight: '800' },
  queueSlowBtnTxtGhost: { color: 'rgba(226,232,240,0.88)', fontSize: 12, fontWeight: '700' },

  findHero: {
    color: '#f8fafc',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  findSub: { color: 'rgba(148,163,184,0.95)', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  findSubEm: { color: '#e2e8f0', fontWeight: '700' },
  searchingLivePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(15,23,42,0.65)',
    marginBottom: 18,
  },
  searchingLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  searchingLiveTxt: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  retroSearchWrap: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingBottom: 8 },
  radarCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    backgroundColor: 'rgba(8,4,18,0.88)',
    marginBottom: 16,
    minHeight: 132,
  },
  radarCardLeft: { flex: 1, padding: 14, justifyContent: 'center', minWidth: 0 },
  radarTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  radarSub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  radarSubEm: { color: '#cbd5e1', fontWeight: '700' },
  radarClockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  radarClock: { color: '#e2e8f0', fontSize: 28, fontVariant: ['tabular-nums'] },
  radarHint: { color: 'rgba(148,163,184,0.85)', fontSize: 11, fontWeight: '600' },
  radarCardRight: { width: 128, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,0,12,0.5)' },
  radarRings: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  radarRing: {
    position: 'absolute' as const,
    borderWidth: 1,
    borderColor: 'rgba(232,121,249,0.35)',
    backgroundColor: 'transparent',
  },
  radarRing1: { width: 102, height: 102, borderRadius: 51, top: 8, left: 8 },
  radarRing2: { width: 74, height: 74, borderRadius: 37, top: 22, left: 22 },
  radarRing3: { width: 46, height: 46, borderRadius: 23, top: 36, left: 36 },
  radarSweep: {
    position: 'absolute' as const,
    width: 3,
    height: 40,
    borderRadius: 2,
    backgroundColor: runit.neonPink,
    top: 39,
    left: 57,
    shadowColor: runit.neonPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },

  retroDualRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  retroFeeCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    backgroundColor: runitShell.scrim92,
  },
  retroFeeCardPurple: {
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.65)',
    shadowColor: 'rgba(168,85,247,0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  retroFeeCardGold: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.55)',
    shadowColor: 'rgba(255,215,0,0.25)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  retroFeeLbl: {
    color: runit.neonPurple,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  retroPrizeLblCaps: {
    color: runit.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  retroFeeAmt: { color: '#f8fafc', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  retroPrizeAmtLg: { color: runit.gold, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },

  vsCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(8,4,18,0.75)',
    marginBottom: 18,
  },
  vsCol: { flex: 1, alignItems: 'center', minWidth: 0 },
  vsLbl: { color: 'rgba(148,163,184,0.95)', fontSize: 11, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  vsOrbYou: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,236,150,0.9)',
    marginBottom: 4,
    shadowColor: runit.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
  vsOrbWait: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(76,29,149,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.55)',
    marginBottom: 4,
    shadowColor: 'rgba(167,139,250,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  vsPedGold: {
    height: 6,
    width: 72,
    borderRadius: 3,
    backgroundColor: 'rgba(255,215,0,0.45)',
  },
  vsPedPurple: {
    height: 6,
    width: 72,
    borderRadius: 3,
    backgroundColor: 'rgba(139,92,246,0.45)',
  },
  vsWord: {
    color: runit.neonPink,
    fontSize: 22,
    fontStyle: 'italic' as const,
    paddingHorizontal: 4,
    marginBottom: 28,
    textShadowColor: 'rgba(232,121,249,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  stepItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.5)',
    backgroundColor: 'rgba(24,10,40,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleOn: {
    borderColor: runit.gold,
    backgroundColor: 'rgba(255,215,0,0.15)',
    shadowColor: runit.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  stepNum: { color: runit.gold, fontSize: 14, fontWeight: '900' },
  stepNumMuted: { color: 'rgba(167,139,250,0.85)', fontSize: 14, fontWeight: '900' },
  stepIcon: { marginBottom: 4 },
  stepTitleOn: { color: runit.gold, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  stepCapOn: { color: 'rgba(253,224,71,0.85)', fontSize: 9, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  stepTitleMuted: { color: 'rgba(148,163,184,0.85)', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  stepCapMuted: { color: 'rgba(100,116,139,0.95)', fontSize: 9, textAlign: 'center', marginTop: 2 },
  stepDash: {
    width: 14,
    height: 2,
    marginTop: 16,
    borderRadius: 1,
    backgroundColor: 'rgba(139,92,246,0.35)',
  },

  searchingMsgRetro: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  },
  finePrintPink: {
    color: 'rgba(251,207,232,0.92)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  finePrintPinkBold: { fontWeight: '800', color: '#fce7f3' },
  finePrintMuted: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  toggleDeck: { gap: 10, marginBottom: 16, width: '100%' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: runitShell.scrim88,
  },
  toggleRowGold: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  toggleRowPink: {
    borderWidth: 1,
    borderColor: 'rgba(232,121,249,0.4)',
  },
  toggleRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  toggleTextCol: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 13, fontWeight: '900', marginBottom: 4 },
  toggleBody: { color: 'rgba(148,163,184,0.95)', fontSize: 11, lineHeight: 16 },

  faqCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    backgroundColor: 'rgba(8,4,18,0.82)',
    padding: 14,
    marginBottom: 16,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  faqTitle: { color: '#f8fafc', fontSize: 14, flex: 1 },
  faqTitleSm: { color: '#f8fafc', fontSize: 13, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  faqBody: { color: 'rgba(148,163,184,0.95)', fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: 10 },
  faqLink: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 8 },
  faqLinkDisabled: { opacity: 0.45 },
  faqLinkTxt: { color: runit.neonPink, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  retroBrowseBtn: { marginTop: 4 },
  retroQuickBtn: { marginTop: 8 },

  retroKeepBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: runit.gold,
    borderWidth: 1,
    borderColor: 'rgba(255,236,150,0.95)',
    marginBottom: 12,
    shadowColor: runit.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  retroKeepTxtCol: { alignItems: 'flex-start' },
  retroKeepTitle: { color: '#0c0618', fontSize: 16, fontWeight: '900' },
  retroKeepSub: { color: 'rgba(12,6,24,0.75)', fontSize: 12, fontWeight: '700', marginTop: 2 },

  retroLeaveBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(232,121,249,0.75)',
    backgroundColor: 'rgba(12,4,22,0.65)',
    marginBottom: 14,
  },
  retroLeaveTitle: { color: runit.neonPink, fontSize: 16, fontWeight: '900' },
  retroLeaveSub: { color: 'rgba(244,114,182,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  retroTrustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  retroTrustTxt: { color: 'rgba(148,163,184,0.85)', fontSize: 11, fontWeight: '600' },
});
