import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { GameplayPlaceholder } from '@/features/play/GameplayPlaceholder';
import type { KickClashMatchSession, MatchFinishPayload } from '@/types/match';
import { DAILY_FREE_PRIZE_USD, DAILY_FREE_TOURNAMENT_ROUNDS, getRoundLabel, randomOpponentName } from '@/lib/dailyFreeTournament';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function DailyFreeTournamentMatchScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const hydrated = useDailyFreeTournamentStore((s) => s.hydrated);
  const nextRound = useDailyFreeTournamentStore((s) => s.nextRound);
  const eliminated = useDailyFreeTournamentStore((s) => s.eliminated);
  const dayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const recordMatchFinished = useDailyFreeTournamentStore((s) => s.recordMatchFinished);
  const forcedOutcome = useDailyFreeTournamentStore((s) => s.forcedOutcomeForCurrentMatch());

  const [done, setDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void hydrate(uid);
    }, [uid, hydrate]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;
      if (eliminated || nextRound > DAILY_FREE_TOURNAMENT_ROUNDS) {
        router.replace('/(app)/(tabs)/tournaments/daily-free');
      }
    }, [hydrated, eliminated, nextRound, router]),
  );

  const oppName = useMemo(() => randomOpponentName(uid, nextRound), [uid, nextRound]);

  const session = useMemo<KickClashMatchSession>(
    () => ({
      id: `daily-${dayKey}-${nextRound}`,
      mode: 'casual',
      localPlayerId: uid,
      opponentId: 'daily-cpu',
      opponentDisplayName: oppName,
      listedPrizeUsd: DAILY_FREE_PRIZE_USD,
      scoreSelf: 0,
      scoreOpponent: 0,
      startedAt: Date.now(),
      durationSec: 24,
    }),
    [uid, dayKey, nextRound, oppName],
  );

  const onFinish = useCallback(
    (_result: MatchFinishPayload) => {
      if (done) return;
      setDone(true);
      const roundName = getRoundLabel(nextRound);
      recordMatchFinished();
      const nowElim = useDailyFreeTournamentStore.getState().eliminated;
      if (nowElim) {
        Alert.alert(
          'Run ends here',
          `You were eliminated in ${roundName}. Come back tomorrow for another free run.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Victory', `You advance past ${roundName}.`, [{ text: 'OK', onPress: () => router.back() }]);
      }
    },
    [done, nextRound, recordMatchFinished, router],
  );

  if (!hydrated) {
    return (
      <Screen scroll={false}>
        <Text className="text-slate-400">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Text className="mb-1 text-xs uppercase text-slate-400">Daily free tournament</Text>
      <Text className="mb-3 text-lg font-black text-white">
        Match {nextRound} · {getRoundLabel(nextRound)} · vs {oppName}
      </Text>
      <Text className="mb-2 text-xs text-slate-500">
        Skill contest (stub) — tap +Goal to practice; buzzer decides the round for this promotional bracket.
      </Text>
      <GameplayPlaceholder
        session={session}
        onFinish={onFinish}
        forcedOutcome={forcedOutcome}
        hideOpponentControls
      />
    </Screen>
  );
}
