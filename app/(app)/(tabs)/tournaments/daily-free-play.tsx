import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  computeOpponentRoundScore,
  DAILY_FREE_PRIZE_USD,
  DAILY_FREE_TOURNAMENT_ROUNDS,
  getRoundLabel,
  pickDailyGameKey,
  randomOpponentName,
  titleForDailyGame,
} from '@/lib/dailyFreeTournament';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import NeonBallRunGame from '@/minigames/ballrun/BallRunGame';
import TapDashGame from '@/minigames/tapdash/TapDashGame';
import TileClashGame from '@/minigames/tileclash/TileClashGame';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { MatchFinishPayload } from '@/types/match';

export default function DailyFreeTournamentPlayScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const hydrated = useDailyFreeTournamentStore((s) => s.hydrated);
  const nextRound = useDailyFreeTournamentStore((s) => s.nextRound);
  const eliminated = useDailyFreeTournamentStore((s) => s.eliminated);
  const dayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const recordMatchFinished = useDailyFreeTournamentStore((s) => s.recordMatchFinished);
  const forcedOutcome = useDailyFreeTournamentStore((s) => s.forcedOutcomeForCurrentMatch());
  useDailyFreeResetClock(uid, hydrate);

  const [done, setDone] = useState(false);
  const finishOnce = useRef(false);

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
  const gameKey = useMemo(() => pickDailyGameKey(dayKey, nextRound, uid), [dayKey, nextRound, uid]);
  const opponentRoundScore = useMemo(
    () => computeOpponentRoundScore(gameKey, dayKey, nextRound, uid),
    [gameKey, dayKey, nextRound, uid],
  );

  const onComplete = useCallback(
    (_payload: MatchFinishPayload) => {
      if (finishOnce.current) return;
      finishOnce.current = true;
      if (done) return;
      setDone(true);
      const roundName = getRoundLabel(nextRound);
      recordMatchFinished();
      const st = useDailyFreeTournamentStore.getState();
      const nowElim = st.eliminated;
      const crowned = !st.eliminated && st.nextRound > DAILY_FREE_TOURNAMENT_ROUNDS;
      const goEvents = () => router.replace('/(app)/(tabs)/tournaments/daily-free');
      if (nowElim) {
        Alert.alert(
          'Run ends here',
          `You were eliminated in ${roundName}. A fresh bracket unlocks at local midnight.`,
          [{ text: 'OK', onPress: goEvents }],
        );
      } else if (crowned) {
        Alert.alert(
          'Bracket cleared',
          `You ran all ${DAILY_FREE_TOURNAMENT_ROUNDS} rounds today — you’re on the $${DAILY_FREE_PRIZE_USD} showcase path. Come back after midnight for a new draw.`,
          [{ text: 'OK', onPress: goEvents }],
        );
      } else {
        Alert.alert('Victory', `You advance past ${roundName}.`, [{ text: 'OK', onPress: goEvents }]);
      }
    },
    [done, nextRound, recordMatchFinished, router],
  );

  const bundle: DailyTournamentBundle = useMemo(
    () => ({
      opponentDisplayName: oppName,
      opponentRoundScore,
      forcedOutcome,
      localPlayerId: uid,
      opponentId: 'tournament-opponent',
      scoreVarianceKey: `${dayKey}|daily|r${nextRound}|${uid}`,
      onComplete,
    }),
    [oppName, opponentRoundScore, forcedOutcome, uid, onComplete, dayKey, nextRound],
  );

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
          LIVE EVENT · MATCH {nextRound}/{DAILY_FREE_TOURNAMENT_ROUNDS}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#e2e8f0', marginTop: 4 }} numberOfLines={1}>
          {roundTitle} · {getRoundLabel(nextRound)}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', marginTop: 2 }} numberOfLines={2}>
          Head-to-head vs {oppName}. High score takes the match — {DAILY_FREE_TOURNAMENT_ROUNDS} wins to clear today’s path.
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
