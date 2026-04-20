import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus, Platform } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { ensureArcadeAndroidNotificationChannel } from '@/lib/arcadeLocalNotifications';
import { H2H_QUICK_MATCH_GAME_KEY, type H2hGameKey } from '@/lib/homeOpenMatches';
import { isUuid } from '@/lib/isUuid';
import { queryKeys } from '@/lib/queryKeys';
import { syncExitMatchmakingToServer } from '@/lib/matchmakingExitClient';
import { useH2hQueueMatchSignals, type H2hQueueParamsRef } from '@/hooks/useH2hQueueMatchSignals';
import {
  createH2hMatchSessionViaEdge,
  displayNameForProfile,
  resolveDevOpponentUserId,
} from '@/services/api/h2hMatchSession';
import { requestOpenMatchWatchScan } from '@/lib/requestOpenMatchWatchScan';
import { h2hCancelQueue, h2hEnqueueOrMatch, h2hEnqueueQuickMatch } from '@/services/matchmaking/h2hQueue';
import { getSupabase } from '@/supabase/client';
import { useMatchmakingStore } from '@/store/matchmakingStore';
import { useAuthStore } from '@/store/authStore';
import { OpponentFoundModal } from '@/features/play/OpponentFoundModal';

/** Global H2H queue poll + realtime + match modal so search continues off the queue route when enabled. */
export function MatchmakingQueueRunner() {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const phase = useMatchmakingStore((s) => s.phase);
  const opponent = useMatchmakingStore((s) => s.opponent);
  const keepSearchingWhenAway = useMatchmakingStore((s) => s.keepSearchingWhenAway);
  const queuePollSnapshot = useMatchmakingStore((s) => s.queuePollSnapshot);
  const setPhase = useMatchmakingStore((s) => s.setPhase);
  const setActiveMatch = useMatchmakingStore((s) => s.setActiveMatch);
  const reset = useMatchmakingStore((s) => s.reset);
  const setQueuePollSnapshot = useMatchmakingStore((s) => s.setQueuePollSnapshot);
  const setKeepSearchingWhenAway = useMatchmakingStore((s) => s.setKeepSearchingWhenAway);

  const queueParamsRef = useRef<H2hQueueParamsRef['current']>(null);
  useEffect(() => {
    queueParamsRef.current = queuePollSnapshot;
  }, [queuePollSnapshot]);

  const openSlotNotifyQueueIdRef = useRef<string | null>(null);
  const queuePollAlertShownRef = useRef(false);
  const queuePollTransientFailRef = useRef(0);
  const queuePollSoftRpcFailRef = useRef(0);
  const queuePollNetworkFailRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useH2hQueueMatchSignals({
    enabled: ENABLE_BACKEND && userId !== 'guest' && phase === 'searching',
    userId,
    queueParamsRef: queueParamsRef as unknown as H2hQueueParamsRef,
  });

  useEffect(() => {
    if (!ENABLE_BACKEND || userId === 'guest' || phase !== 'searching') return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const p = useMatchmakingStore.getState().queuePollSnapshot;
      if (!p) return;
      try {
        const r =
          p.gameKey === H2H_QUICK_MATCH_GAME_KEY
            ? await h2hEnqueueQuickMatch({
                mode: p.mode,
                maxAffordableEntryCents: p.maxAffordableEntryCents ?? 0,
                allowedEntryCents: p.quickMatchAllowedEntryCents ?? [0],
              })
            : await h2hEnqueueOrMatch(p);
        if (cancelled) return;
        queuePollNetworkFailRef.current = 0;
        if (!r.ok) {
          if (r.error === 'match_create_failed') {
            queuePollTransientFailRef.current += 1;
            if (queuePollTransientFailRef.current >= 12 && !queuePollAlertShownRef.current) {
              queuePollAlertShownRef.current = true;
              setQueuePollSnapshot(null);
              void h2hCancelQueue().catch(() => {});
              useMatchmakingStore.getState().reset();
              Alert.alert(
                'Matchmaking issue',
                r.detail
                  ? `Could not create the match: ${r.detail}`
                  : 'Could not create the match after several tries. Both players need enough wallet for this tier and must use two different accounts.',
              );
            }
            return;
          }
          if (r.error === 'insufficient_wallet' && !queuePollAlertShownRef.current) {
            queuePollAlertShownRef.current = true;
            setQueuePollSnapshot(null);
            void h2hCancelQueue().catch(() => {});
            useMatchmakingStore.getState().reset();
            Alert.alert(
              'Matchmaking issue',
              'Your wallet no longer covers contest access. Add funds or pick a different tier.',
            );
            return;
          }
          const authBroken =
            r.error === 'not_authenticated' ||
            (typeof r.detail === 'string' && /jwt|not authorized|invalid token/i.test(r.detail));
          if (authBroken && !queuePollAlertShownRef.current) {
            queuePollAlertShownRef.current = true;
            setQueuePollSnapshot(null);
            void h2hCancelQueue().catch(() => {});
            useMatchmakingStore.getState().reset();
            Alert.alert(
              'Sign in required',
              'Your session may have expired. Sign in again and re-enter the queue.',
            );
            return;
          }
          queuePollSoftRpcFailRef.current += 1;
          if (queuePollSoftRpcFailRef.current >= 28 && !queuePollAlertShownRef.current) {
            queuePollAlertShownRef.current = true;
            setQueuePollSnapshot(null);
            void h2hCancelQueue().catch(() => {});
            useMatchmakingStore.getState().reset();
            const body = [r.error, r.detail].filter((x) => typeof x === 'string' && x.length > 0).join('\n\n');
            Alert.alert(
              'Matchmaking issue',
              body.length > 0
                ? body
                : 'The queue request failed repeatedly. Both players should be signed in, online, and on the same contest tier — then try again.',
            );
          }
          return;
        }
        queuePollSoftRpcFailRef.current = 0;
        if (r.ok && !r.matched && r.queue_entry_id) {
          if (openSlotNotifyQueueIdRef.current !== r.queue_entry_id) {
            openSlotNotifyQueueIdRef.current = r.queue_entry_id;
            requestOpenMatchWatchScan();
          }
        }
        if (r.matched) {
          queuePollTransientFailRef.current = 0;
          void qc.invalidateQueries({ queryKey: queryKeys.homeH2hBoard() });
          const route = useMatchmakingStore.getState().matchmakingAcceptRoute;
          const qWild = route?.quickMatchCtx;
          if (qWild?.isQuickMatchWildcard && ENABLE_BACKEND && userId !== 'guest') {
            try {
              const supabase = getSupabase();
              const { data: ms } = await supabase
                .from('match_sessions')
                .select('entry_fee_wallet_cents, listed_prize_usd_cents, game_key')
                .eq('id', r.match_session_id)
                .maybeSingle();
              const ec = Number(ms?.entry_fee_wallet_cents ?? 0);
              const pc = Number(ms?.listed_prize_usd_cents ?? 0);
              const gk = ms?.game_key?.trim();
              if (route) {
                useMatchmakingStore.getState().setMatchmakingAcceptRoute({
                  ...route,
                  quickMatchCtx: qWild
                    ? {
                        ...qWild,
                        entryUsd: ec / 100,
                        prizeUsd: pc / 100,
                        isFreeCasual: ec <= 0,
                        gameKey:
                          gk && gk.length > 0 ? (gk as H2hGameKey) : qWild.gameKey,
                        exactTierCents: ec > 0 ? { entry: ec, prize: pc } : undefined,
                      }
                    : null,
                });
              }
            } catch {
              /* keep ctx */
            }
          }
          let name = 'Opponent';
          let reg: string | undefined;
          try {
            const supabase = getSupabase();
            const { data: prof } = await supabase
              .from('profiles')
              .select('id,username,display_name,region')
              .eq('id', r.opponent_user_id)
              .maybeSingle();
            name = displayNameForProfile(prof?.username ?? null, prof?.display_name ?? null);
            reg = prof?.region?.trim();
          } catch {
            /* ignore */
          }
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
        queuePollNetworkFailRef.current += 1;
        if (queuePollNetworkFailRef.current >= 24 && !queuePollAlertShownRef.current) {
          queuePollAlertShownRef.current = true;
          setQueuePollSnapshot(null);
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
    const iv = setInterval(() => void tick(), 900);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [phase, userId, qc, setQueuePollSnapshot]);

  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const was = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (was !== 'searching' || phase !== 'found') return;
    if (!keepSearchingWhenAway || Platform.OS === 'web') return;
    const state = appStateRef.current;
    if (state !== 'background' && state !== 'inactive') return;

    const opp = useMatchmakingStore.getState().opponent;
    const label = opp?.username?.trim() ? opp.username : 'A player';

    void (async () => {
      await ensureArcadeAndroidNotificationChannel();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Opponent found',
          body: `${label} is ready — open Run It Arcade to accept.`,
          sound: 'default',
          data: { href: '/(app)/(tabs)/play' },
          ...(Platform.OS === 'android' ? { channelId: 'arcade-rewards' as const } : {}),
        },
        trigger: null,
      });
    })();
  }, [phase, keepSearchingWhenAway]);

  useEffect(() => {
    if (phase !== 'searching') {
      queuePollAlertShownRef.current = false;
      queuePollTransientFailRef.current = 0;
      queuePollSoftRpcFailRef.current = 0;
      queuePollNetworkFailRef.current = 0;
    }
  }, [phase]);

  const dismissMatchmakingToIdle = useCallback(() => {
    const st = useMatchmakingStore.getState();
    if (st.phase !== 'searching' && st.phase !== 'found') return;
    const snapshot = {
      phase: st.phase,
      mockMatchId: st.mockMatchId,
      serverSessionReady: st.serverSessionReady,
    };
    reset();
    void syncExitMatchmakingToServer(qc, snapshot);
  }, [qc, reset]);

  const accept = useCallback(async () => {
    setKeepSearchingWhenAway(false);
    setQueuePollSnapshot(null);
    const { mockMatchId: mid, opponent: opp, serverSessionReady } = useMatchmakingStore.getState();
    if (!mid || !opp) return;
    const route = useMatchmakingStore.getState().matchmakingAcceptRoute;
    const q = route?.quickMatchCtx ?? null;
    const entryFeeUsd = route?.entryFeeUsd;
    const listedPrizeUsd = route?.listedPrizeUsd;
    const gameKey = route?.gameKey;
    const mode = route?.mode ?? 'casual';
    const queueTierCents = route?.queueTierCents;
    const returnToHref = route?.returnToHref;
    const uid = userId;

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
    if (resolvedGameKey === H2H_QUICK_MATCH_GAME_KEY && ENABLE_BACKEND && uid !== 'guest') {
      const supabase = getSupabase();
      const { data: ms } = await supabase.from('match_sessions').select('game_key').eq('id', mid).maybeSingle();
      const gk = ms?.game_key;
      if (typeof gk === 'string' && gk.trim().length > 0) resolvedGameKey = gk.trim();
    }

    if (ENABLE_BACKEND && uid !== 'guest') {
      if (serverSessionReady) {
        resolvedMatchId = mid;
        resolvedOpp = opp;
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
        void qc.invalidateQueries({ queryKey: queryKeys.transactions(uid) });
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
            void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
            void qc.invalidateQueries({ queryKey: queryKeys.transactions(uid) });
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
    const rt = returnToHref ? `?returnTo=${encodeURIComponent(returnToHref)}` : '';
    router.push(`/(app)/(tabs)/play/lobby/${resolvedMatchId}${rt}`);
  }, [qc, router, setActiveMatch, setKeepSearchingWhenAway, setPhase, setQueuePollSnapshot, userId]);

  const acceptRoute = useMatchmakingStore((s) => s.matchmakingAcceptRoute);
  const q = acceptRoute?.quickMatchCtx ?? null;
  const isFreeCasual = q?.isFreeCasual === true;
  const effectiveEntry = isFreeCasual ? undefined : q != null ? q.entryUsd : acceptRoute?.entryFeeUsd;
  const effectivePrize = isFreeCasual ? undefined : q != null ? q.prizeUsd : acceptRoute?.listedPrizeUsd;
  const hasPaidEntry =
    !isFreeCasual &&
    effectiveEntry != null &&
    effectivePrize != null &&
    !Number.isNaN(effectiveEntry) &&
    !Number.isNaN(effectivePrize);
  const modalPrizeUsd = hasPaidEntry ? effectivePrize : undefined;

  return (
    <OpponentFoundModal
      visible={phase === 'found'}
      opponent={opponent}
      prizeUsd={modalPrizeUsd}
      freeCasual={isFreeCasual}
      onAccept={accept}
      onDecline={dismissMatchmakingToIdle}
    />
  );
}
