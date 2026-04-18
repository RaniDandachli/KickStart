import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { RoundAdvanceOverlay } from '@/components/ui/RoundAdvanceOverlay';
import { Screen } from '@/components/ui/Screen';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import {
  computeOpponentRoundScore,
  getDailyTournamentPrizeUsd,
  getDailyTournamentRounds,
  getRoundLabel,
  pickDailyGameKey,
  randomOpponentName,
  todayYmdLocal,
  titleForDailyGame,
} from '@/lib/dailyFreeTournament';
import { pushProfilePollingPause } from '@/lib/profilePollingPause';
import { appChromeLinePink, runit } from '@/lib/runitArcadeTheme';
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
  const dayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const recordMatchFinished = useDailyFreeTournamentStore((s) => s.recordMatchFinished);
  const forcedOutcome = useDailyFreeTournamentStore((s) => s.forcedOutcomeForCurrentMatch());
  const todaysKey = dayKey || todayYmdLocal();
  const dailyRounds = getDailyTournamentRounds(todaysKey);
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(todaysKey);
  useDailyFreeResetClock(uid, hydrate, { withCountdown: false });

  useEffect(() => pushProfilePollingPause(), []);

  const [roundPlayKey, setRoundPlayKey] = useState(0);
  const [roundSplash, setRoundSplash] = useState(false);
  const finishOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void hydrate(uid);
    }, [uid, hydrate]),
  );

  /** Bounce stale bracket state only when the screen gains focus — not on every round advance mid-run. */
  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;
      const s = useDailyFreeTournamentStore.getState();
      const rounds = getDailyTournamentRounds(s.dayKey || todayYmdLocal());
      if (s.eliminated || s.nextRound > rounds) {
        router.replace('/(app)/(tabs)/tournaments/daily-free');
      }
    }, [hydrated, router]),
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
      const roundName = getRoundLabel(nextRound);
      recordMatchFinished();
      const st = useDailyFreeTournamentStore.getState();
      const rounds = getDailyTournamentRounds(st.dayKey || todayYmdLocal());
      const nowElim = st.eliminated;
      const crowned = !st.eliminated && st.nextRound > rounds;
      const goEvents = () => router.replace('/(app)/(tabs)/tournaments/daily-free');
      if (nowElim) {
        Alert.alert(
          'Run ends here',
          `You were eliminated in ${roundName}. A fresh bracket unlocks at local midnight.`,
          [{ text: 'OK', onPress: goEvents }],
        );
        return;
      }
      if (crowned) {
        Alert.alert(
          'Path cleared',
          `You ran all ${rounds} rounds today — showcase tier was $${dailyPrizeUsd}. Come back after midnight for a new draw.`,
          [{ text: 'OK', onPress: goEvents }],
        );
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRoundSplash(true);
      setTimeout(() => {
        setRoundSplash(false);
        finishOnce.current = false;
        setRoundPlayKey((k) => k + 1);
      }, 480);
    },
    [dailyPrizeUsd, nextRound, recordMatchFinished, router],
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
    <View style={{ flex: 1, backgroundColor: runit.bgDeep }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: appChromeLinePink,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(148,163,184,0.9)', letterSpacing: 1 }}>
          LIVE EVENT · MATCH {nextRound}/{dailyRounds}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#e2e8f0', marginTop: 4 }} numberOfLines={1}>
          {roundTitle} · {getRoundLabel(nextRound)}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', marginTop: 2 }} numberOfLines={2}>
          Head-to-head vs {oppName}. High score takes the match — {dailyRounds} wins to clear today’s path.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        {gameKey === 'tap-dash' ? (
          <TapDashGame key={`tap-${roundPlayKey}`} dailyTournament={bundle} />
        ) : null}
        {gameKey === 'tile-clash' ? (
          <TileClashGame key={`tile-${roundPlayKey}`} dailyTournament={bundle} />
        ) : null}
        {gameKey === 'ball-run' ? (
          <NeonBallRunGame key={`ball-${roundPlayKey}`} dailyTournament={bundle} />
        ) : null}
      </View>
      <RoundAdvanceOverlay
        visible={roundSplash}
        title="Next round"
        subtitle={`${roundTitle} · ${getRoundLabel(nextRound)}`}
      />
    </View>
  );
}
