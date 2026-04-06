import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  getCreditCupById,
  pickCupGameKey,
  randomCupOpponentName,
} from '@/lib/cupTournaments';
import {
  computeOpponentRoundScore,
  DAILY_FREE_TOURNAMENT_ROUNDS,
  getRoundLabel,
  titleForDailyGame,
} from '@/lib/dailyFreeTournament';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import NeonBallRunGame from '@/minigames/ballrun/BallRunGame';
import TapDashGame from '@/minigames/tapdash/TapDashGame';
import TileClashGame from '@/minigames/tileclash/TileClashGame';
import { grantArcadePrizeCredits } from '@/services/economy/grantArcadePrizeCredits';
import { useAuthStore } from '@/store/authStore';
import { useCupBracketStore } from '@/store/cupBracketStore';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { MatchFinishPayload } from '@/types/match';

export default function CreditCupPlayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cupId } = useLocalSearchParams<{ cupId: string }>();
  const cup = typeof cupId === 'string' ? getCreditCupById(cupId) : undefined;

  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const hydrated = useCupBracketStore((s) => s.hydrated);
  const nextRound = useCupBracketStore((s) => s.nextRound);
  const eliminated = useCupBracketStore((s) => s.eliminated);
  const dayKey = useCupBracketStore((s) => s.dayKey);
  const hydrate = useCupBracketStore((s) => s.hydrate);
  const recordMatchFinished = useCupBracketStore((s) => s.recordMatchFinished);
  const forcedOutcome = useCupBracketStore((s) => s.forcedOutcomeForCurrentMatch());

  const hydrateCup = useCallback(
    async (k: string) => {
      if (cup?.id) await hydrate(k, cup.id);
    },
    [cup?.id, hydrate],
  );
  useDailyFreeResetClock(uid, hydrateCup);

  const [done, setDone] = useState(false);
  const finishOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (cup?.id) void hydrate(uid, cup.id);
    }, [uid, cup?.id, hydrate]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!cup || !hydrated) return;
      if (eliminated || nextRound > DAILY_FREE_TOURNAMENT_ROUNDS) {
        router.replace(`/(app)/(tabs)/tournaments/cup/${cup.id}`);
      }
    }, [cup, hydrated, eliminated, nextRound, router]),
  );

  const oppName = useMemo(
    () => (cup ? randomCupOpponentName(uid, nextRound, cup.id) : ''),
    [cup, uid, nextRound],
  );
  const gameKey = useMemo(
    () => (cup ? pickCupGameKey(dayKey, nextRound, uid, cup.id) : 'tap-dash'),
    [cup, dayKey, nextRound, uid],
  );
  const opponentRoundScore = useMemo(
    () => computeOpponentRoundScore(gameKey, dayKey, nextRound, uid),
    [gameKey, dayKey, nextRound, uid],
  );

  const onComplete = useCallback(
    async (_payload: MatchFinishPayload) => {
      if (finishOnce.current || !cup) return;
      finishOnce.current = true;
      if (done) return;
      setDone(true);
      const roundName = getRoundLabel(nextRound);
      recordMatchFinished();
      const st = useCupBracketStore.getState();
      const nowElim = st.eliminated;
      const crowned = !st.eliminated && st.nextRound > DAILY_FREE_TOURNAMENT_ROUNDS;
      const goHub = () => router.replace(`/(app)/(tabs)/tournaments/cup/${cup.id}`);

      if (nowElim) {
        Alert.alert(
          'Run ends here',
          `You were eliminated in ${roundName}. Come back after midnight for a new bracket.`,
          [{ text: 'OK', onPress: goHub }],
        );
        return;
      }

      if (crowned) {
        const grant = await grantArcadePrizeCredits({
          amount: cup.prizeCredits,
          cupId: cup.id,
          dayKey: st.dayKey,
          userId: uid,
          queryClient,
        });
        const creditMsg = grant.ok
          ? grant.duplicate
            ? `${cup.prizeCredits.toLocaleString()} prize credits were already credited for this win.`
            : `${cup.prizeCredits.toLocaleString()} prize credits added to your account.`
          : `Could not add credits automatically (${grant.error ?? 'unknown'}). Try again or contact support.`;
        Alert.alert('Cup won!', creditMsg, [{ text: 'OK', onPress: goHub }]);
        return;
      }

      Alert.alert('Victory', `You advance past ${roundName}.`, [{ text: 'OK', onPress: goHub }]);
    },
    [done, nextRound, recordMatchFinished, router, cup, uid, queryClient],
  );

  const bundle: DailyTournamentBundle = useMemo(
    () => ({
      opponentDisplayName: oppName,
      opponentRoundScore,
      forcedOutcome,
      localPlayerId: uid,
      opponentId: 'cup-opponent',
      scoreVarianceKey: cup ? `${dayKey}|cup:${cup.id}|r${nextRound}|${uid}` : undefined,
      onComplete,
    }),
    [oppName, opponentRoundScore, forcedOutcome, uid, onComplete, dayKey, nextRound, cup],
  );

  if (!cup) {
    return (
      <Screen scroll={false}>
        <Text className="text-slate-400">Cup not found.</Text>
      </Screen>
    );
  }

  if (!hydrated) {
    return (
      <Screen scroll={false}>
        <Text className="text-slate-400">Loading…</Text>
      </Screen>
    );
  }

  const roundTitle = titleForDailyGame(gameKey);

  return (
    <View style={{ flex: 1, backgroundColor: '#04080f' }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(148,163,184,0.2)',
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(148,163,184,0.9)', letterSpacing: 1 }}>
          {cup.name.toUpperCase()} · MATCH {nextRound}/{DAILY_FREE_TOURNAMENT_ROUNDS} · {cup.prizeCredits.toLocaleString()} CR
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#e2e8f0', marginTop: 4 }} numberOfLines={1}>
          {roundTitle} · {getRoundLabel(nextRound)}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', marginTop: 2 }} numberOfLines={2}>
          Head-to-head vs {oppName}. High score wins — clear all {DAILY_FREE_TOURNAMENT_ROUNDS} rounds to earn prize credits.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        {gameKey === 'tap-dash' ? <TapDashGame dailyTournament={bundle} /> : null}
        {gameKey === 'tile-clash' ? <TileClashGame dailyTournament={bundle} /> : null}
        {gameKey === 'ball-run' ? <NeonBallRunGame dailyTournament={bundle} /> : null}
      </View>
    </View>
  );
}
