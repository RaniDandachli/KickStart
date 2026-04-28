import { usePreventRemove } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { GameplayPlaceholder } from '@/features/play/GameplayPlaceholder';
import { H2hBallRunMatch } from '@/features/play/H2hBallRunMatch';
import { H2hDashDuelMatch } from '@/features/play/H2hDashDuelMatch';
import { H2hNeonDanceMatch } from '@/features/play/H2hNeonDanceMatch';
import { H2hNeonGridMatch } from '@/features/play/H2hNeonGridMatch';
import { H2hNeonShipMatch } from '@/features/play/H2hNeonShipMatch';
import { H2hTapDashMatch } from '@/features/play/H2hTapDashMatch';
import { H2hTileClashMatch } from '@/features/play/H2hTileClashMatch';
import { H2hShapeDashMatch } from '@/features/play/H2hShapeDashMatch';
import { H2hTurboArenaMatch } from '@/features/play/H2hTurboArenaMatch';
import { useMatchSessionWithPlayers } from '@/hooks/useMatchSessionWithPlayers';
import { isUuid } from '@/lib/isUuid';
import { queryKeys } from '@/lib/queryKeys';
import { displayNameForProfile, h2hEnterMatchPlayRpc } from '@/services/api/h2hMatchSession';
import { useAuthStore } from '@/store/authStore';
import type { QueueKind } from '@/store/matchmakingStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';
import type { HeadToHeadMatchSession, MatchFinishPayload } from '@/types/match';

export default function MatchPlayScreen() {
  const params = useLocalSearchParams<{ matchId: string | string[] }>();
  const rawMid = params.matchId;
  const matchId = Array.isArray(rawMid) ? rawMid[0] : rawMid;
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const activeMatch = useMatchmakingStore((s) => s.activeMatch);
  const msQ = useMatchSessionWithPlayers(matchId);
  const enterPlayAttemptedRef = useRef(false);

  useEffect(() => {
    enterPlayAttemptedRef.current = false;
  }, [matchId]);

  useEffect(() => {
    if (!ENABLE_BACKEND || userId === 'guest' || !matchId || !isUuid(matchId)) return;
    if (!msQ.data || enterPlayAttemptedRef.current) return;
    if (msQ.data.status !== 'lobby') return;
    const pa = msQ.data.player_a_id;
    const pb = msQ.data.player_b_id;
    if (pa !== userId && pb !== userId) return;

    enterPlayAttemptedRef.current = true;
    void h2hEnterMatchPlayRpc(matchId)
      .then((r) => {
        if (r.ok) void qc.invalidateQueries({ queryKey: queryKeys.matchSession(matchId) });
        else enterPlayAttemptedRef.current = false;
      })
      .catch(() => {
        enterPlayAttemptedRef.current = false;
      });
  }, [ENABLE_BACKEND, userId, matchId, msQ.data, qc]);

  const session = useMemo<HeadToHeadMatchSession>(() => {
    const mid = matchId ?? '';
    const opp = activeMatch?.matchId === mid ? activeMatch.opponent : null;
    let opponentId = opp?.id ?? 'opponent';
    let opponentDisplayName = opp?.username ?? 'Opponent';
    let mode: QueueKind = 'casual';
    let listedPrizeUsd = activeMatch?.matchId === mid ? activeMatch.listedPrizeUsd : undefined;
    let entryFeeUsd = activeMatch?.matchId === mid ? activeMatch.entryFeeUsd : undefined;

    if (ENABLE_BACKEND && msQ.data && userId !== 'guest') {
      const ms = msQ.data;
      const isA = ms.player_a_id === userId;
      const oid = isA ? ms.player_b_id : ms.player_a_id;
      if (oid) opponentId = oid;
      const ou = isA
        ? displayNameForProfile(ms.player_b_username, ms.player_b_display)
        : displayNameForProfile(ms.player_a_username, ms.player_a_display);
      if (ou.trim()) opponentDisplayName = ou;
      if (ms.mode === 'casual' || ms.mode === 'ranked' || ms.mode === 'custom') {
        mode = ms.mode;
      }
      const ec = ms.entry_fee_wallet_cents ?? 0;
      const pc = ms.listed_prize_usd_cents ?? 0;
      if (ec > 0) entryFeeUsd = ec / 100;
      if (pc > 0) listedPrizeUsd = pc / 100;
    }

    return {
      id: mid,
      mode,
      localPlayerId: userId,
      opponentId,
      opponentDisplayName,
      listedPrizeUsd,
      entryFeeUsd,
      scoreSelf: 0,
      scoreOpponent: 0,
      startedAt: Date.now(),
      durationSec: 90,
    };
  }, [matchId, userId, activeMatch, msQ.data]);

  const casualFreeFromServer =
    ENABLE_BACKEND &&
    !!msQ.data &&
    (msQ.data.entry_fee_wallet_cents ?? 0) <= 0 &&
    !(msQ.data.listed_prize_usd_cents != null && msQ.data.listed_prize_usd_cents > 0);

  const hideOppControls =
    (activeMatch?.matchId === matchId && activeMatch.casualFree === true) || casualFreeFromServer;

  const needsServerSession = ENABLE_BACKEND && userId !== 'guest' && isUuid(matchId ?? '') && msQ.isPending;

  const [done, setDone] = useState(false);

  const replaceWithResult = useCallback(
    (qp: URLSearchParams) => {
      if (!matchId || !isUuid(matchId)) return;
      const path = `/(app)/(tabs)/play/result/${matchId}?${qp.toString()}`;
      InteractionManager.runAfterInteractions(() => {
        router.replace(path as Href);
      });
    },
    [matchId, router],
  );

  const navigateToForfeitResult = useCallback(() => {
    if (!matchId || !isUuid(matchId)) return;
    setDone(true);
    const qp = new URLSearchParams({
      winner: session.opponentId,
      sa: '0',
      sb: '1',
      forfeit: '1',
      opp: encodeURIComponent(session.opponentDisplayName ?? 'Opponent'),
    });
    if (session.opponentId && session.opponentId !== 'opponent' && isUuid(session.opponentId)) {
      qp.set('oppId', session.opponentId);
    }
    if (session.listedPrizeUsd != null) qp.set('prize', String(session.listedPrizeUsd));
    if (session.entryFeeUsd != null) qp.set('entry', String(session.entryFeeUsd));
    replaceWithResult(qp);
  }, [
    replaceWithResult,
    session.entryFeeUsd,
    session.listedPrizeUsd,
    session.opponentDisplayName,
    session.opponentId,
  ]);

  const shouldPreventLeave =
    Boolean(
      ENABLE_BACKEND &&
        userId !== 'guest' &&
        !done &&
        msQ.data?.status === 'in_progress' &&
        isUuid(session.opponentId),
    );

  usePreventRemove(shouldPreventLeave, () => {
    Alert.alert(
      'Leave match?',
      'Leaving counts as a forfeit — your opponent wins this contest.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: () => navigateToForfeitResult(),
        },
      ],
    );
  });

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
    replaceWithResult(qp);
  }

  function confirmForfeit() {
    Alert.alert(
      'Forfeit match?',
      'Your opponent will be recorded as the winner. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Forfeit', style: 'destructive', onPress: () => navigateToForfeitResult() },
      ],
    );
  }

  const isParticipant =
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    !!msQ.data &&
    (msQ.data.player_a_id === userId || msQ.data.player_b_id === userId);

  const canForfeit =
    !done &&
    isParticipant &&
    msQ.data?.status === 'in_progress' &&
    isUuid(session.opponentId) &&
    ENABLE_BACKEND;

  const serverGameKey = (msQ.data?.game_key ?? '').trim().toLowerCase();
  const legacySoccerH2hRetired =
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    !!matchId &&
    isUuid(matchId) &&
    isParticipant &&
    !!msQ.data &&
    (msQ.data.status === 'lobby' || msQ.data.status === 'in_progress') &&
    !done &&
    serverGameKey === 'kick-clash';
  const neonHopRetired =
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    !!matchId &&
    isUuid(matchId) &&
    isParticipant &&
    !!msQ.data &&
    (msQ.data.status === 'lobby' || msQ.data.status === 'in_progress') &&
    !done &&
    serverGameKey === 'neon-hop';
  const useSkillContestH2h =
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    !!matchId &&
    isUuid(matchId) &&
    isParticipant &&
    !!msQ.data &&
    (msQ.data.status === 'lobby' || msQ.data.status === 'in_progress') &&
    !done &&
    (serverGameKey === '' ||
      serverGameKey === 'tap-dash' ||
      serverGameKey === 'tile-clash' ||
      serverGameKey === 'ball-run' ||
      serverGameKey === 'dash-duel' ||
      serverGameKey === 'turbo-arena' ||
      serverGameKey === 'neon-dance' ||
      serverGameKey === 'neon-grid' ||
      serverGameKey === 'neon-ship' ||
      serverGameKey === 'shape-dash');

  if (msQ.isError) {
    return (
      <Screen scroll={false}>
        <Text className="text-base font-semibold text-white">Could not load this match</Text>
        <Text className="mt-2 text-sm text-slate-400">Check your connection or return to the Arcade.</Text>
        <AppButton className="mt-6" title="Back to Arcade" onPress={() => router.replace('/(app)/(tabs)/play')} />
      </Screen>
    );
  }

  if (needsServerSession) {
    return (
      <Screen scroll={false}>
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="mt-4 text-center text-slate-300">Loading match…</Text>
        </View>
      </Screen>
    );
  }

  if (
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    matchId &&
    isUuid(matchId) &&
    msQ.data &&
    isParticipant &&
    msQ.data.status === 'cancelled'
  ) {
    return (
      <Screen scroll={false}>
        <Text className="text-lg font-black text-white">Match cancelled</Text>
        <Text className="mt-2 text-sm text-slate-400">
          This session was closed (left lobby, expired, or abandoned). Paid contest access was refunded when applicable.
        </Text>
        <AppButton
          className="mt-6"
          title="Back to Arcade"
          onPress={() => {
            useMatchmakingStore.getState().setActiveMatch(null);
            router.replace('/(app)/(tabs)/play');
          }}
        />
      </Screen>
    );
  }

  if (
    ENABLE_BACKEND &&
    userId !== 'guest' &&
    matchId &&
    isUuid(matchId) &&
    msQ.data &&
    isParticipant &&
    msQ.data.status === 'completed'
  ) {
    const m = msQ.data;
    const isA = m.player_a_id === userId;
    const saSelf = isA ? m.score_a : m.score_b;
    const sbOpp = isA ? m.score_b : m.score_a;
    const isDraw = m.winner_user_id == null && m.score_a === m.score_b;
    const goViewResult = () => {
      const qp = new URLSearchParams({
        sa: String(saSelf),
        sb: String(sbOpp),
      });
      if (isDraw) {
        qp.set('draw', '1');
        qp.set('winner', 'draw');
      } else if (m.winner_user_id) {
        qp.set('winner', m.winner_user_id);
      }
      const on = isA
        ? displayNameForProfile(m.player_b_username, m.player_b_display)
        : displayNameForProfile(m.player_a_username, m.player_a_display);
      qp.set('opp', encodeURIComponent(on || 'Opponent'));
      if (m.listed_prize_usd_cents != null && m.listed_prize_usd_cents > 0) {
        qp.set('prize', String(m.listed_prize_usd_cents / 100));
      }
      if (m.entry_fee_wallet_cents != null && m.entry_fee_wallet_cents > 0) {
        qp.set('entry', String(m.entry_fee_wallet_cents / 100));
      }
      replaceWithResult(qp);
    };

    return (
      <Screen scroll={false}>
        <Text className="text-lg font-black text-white">Match finished</Text>
        <Text className="mt-2 text-sm text-slate-400">This contest is already on the books.</Text>
        <AppButton className="mt-6" title="View result" onPress={goViewResult} />
        <AppButton
          className="mt-2"
          title="Arcade"
          variant="ghost"
          onPress={() => {
            useMatchmakingStore.getState().setActiveMatch(null);
            router.replace('/(app)/(tabs)/play');
          }}
        />
      </Screen>
    );
  }

  if (legacySoccerH2hRetired || neonHopRetired) {
    return (
      <Screen scroll={false}>
        <Text className="text-lg font-black text-white">Minigame unavailable</Text>
        <Text className="mt-2 text-sm text-slate-400">
          This head-to-head used a minigame that has been removed. Please return to the Arcade — staff can cancel stale
          matches if needed.
        </Text>
        <AppButton
          className="mt-6"
          title="Back to Arcade"
          onPress={() => {
            useMatchmakingStore.getState().setActiveMatch(null);
            router.replace('/(app)/(tabs)/play');
          }}
        />
      </Screen>
    );
  }

  if (useSkillContestH2h) {
    const h2hProps = {
      matchSessionId: matchId!,
      localPlayerId: userId,
      opponentId: session.opponentId,
      opponentDisplayName: session.opponentDisplayName ?? 'Opponent',
      onComplete: onFinish,
    };
    const game =
      serverGameKey === 'tile-clash' ? (
        <H2hTileClashMatch {...h2hProps} />
      ) : serverGameKey === 'ball-run' ? (
        <H2hBallRunMatch {...h2hProps} />
      ) : serverGameKey === 'dash-duel' ? (
        <H2hDashDuelMatch {...h2hProps} />
      ) : serverGameKey === 'turbo-arena' ? (
        <H2hTurboArenaMatch {...h2hProps} />
      ) : serverGameKey === 'neon-dance' ? (
        <H2hNeonDanceMatch {...h2hProps} />
      ) : serverGameKey === 'neon-grid' ? (
        <H2hNeonGridMatch {...h2hProps} />
      ) :       serverGameKey === 'neon-ship' ? (
        <H2hNeonShipMatch {...h2hProps} />
      ) : serverGameKey === 'shape-dash' ? (
        <H2hShapeDashMatch {...h2hProps} />
      ) : (
        <H2hTapDashMatch {...h2hProps} />
      );
    return (
      <Screen scroll={false} className="px-0">
        <View
          className="flex-1"
          style={{
            marginHorizontal: -16,
            minHeight: 0,
            alignSelf: 'stretch',
          }}
        >
          {game}
        </View>
        {canForfeit ? (
          <View className="px-4 pb-4">
            <AppButton title="Forfeit match" variant="danger" onPress={confirmForfeit} />
          </View>
        ) : null}
      </Screen>
    );
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
        hideOpponentControls={hideOppControls}
        onFinish={onFinish}
        onPauseToggle={(p) => {
          if (p) Alert.alert('Paused', 'Take a breather — resume when you are ready.');
        }}
      />
      {canForfeit ? (
        <AppButton className="mt-4" title="Forfeit match" variant="danger" onPress={confirmForfeit} />
      ) : null}
    </Screen>
  );
}
