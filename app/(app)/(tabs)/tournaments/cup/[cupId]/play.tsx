import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { RoundAdvanceOverlay } from '@/components/ui/RoundAdvanceOverlay';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
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
import { pushProfilePollingPause } from '@/lib/profilePollingPause';
import { appChromeLinePink, runit } from '@/lib/runitArcadeTheme';
import NeonBallRunGame from '@/minigames/ballrun/BallRunGame';
import TapDashGame from '@/minigames/tapdash/TapDashGame';
import TileClashGame from '@/minigames/tileclash/TileClashGame';
import { grantArcadePrizeCredits } from '@/services/economy/grantArcadePrizeCredits';
import { useAuthStore } from '@/store/authStore';
import { useCupBracketStore } from '@/store/cupBracketStore';
import { useCupDailyRunStore } from '@/store/cupDailyRunStore';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { MatchFinishPayload } from '@/types/match';

export default function CreditCupPlayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cupId } = useLocalSearchParams<{ cupId: string }>();
  const cup = typeof cupId === 'string' ? getCreditCupById(cupId) : undefined;

  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId ?? 'guest';
  const hydrated = useCupBracketStore((s) => s.hydrated);
  const nextRound = useCupBracketStore((s) => s.nextRound);
  const dayKey = useCupBracketStore((s) => s.dayKey);
  const hydrate = useCupBracketStore((s) => s.hydrate);
  const recordMatchFinished = useCupBracketStore((s) => s.recordMatchFinished);
  const forcedOutcome = useCupBracketStore((s) => s.forcedOutcomeForCurrentMatch());

  const cupDailyHydrate = useCupDailyRunStore((s) => s.hydrate);
  const hydrateCup = useCallback(
    async (k: string) => {
      if (cup?.id) await hydrate(k, cup.id);
    },
    [cup?.id, hydrate],
  );
  useDailyFreeResetClock(
    uid,
    async (k) => {
      await hydrateCup(k);
      await cupDailyHydrate(k);
    },
    { withCountdown: false },
  );

  useEffect(() => pushProfilePollingPause(), []);

  const [dailyCommitOk, setDailyCommitOk] = useState(false);
  const [roundPlayKey, setRoundPlayKey] = useState(0);
  const [roundSplash, setRoundSplash] = useState(false);
  const finishOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (cup?.id) void hydrate(uid, cup.id);
      void cupDailyHydrate(uid);
    }, [uid, cup?.id, hydrate, cupDailyHydrate]),
  );

  useFocusEffect(
    useCallback(() => {
      if (ENABLE_BACKEND && !userId && cup?.id) {
        router.replace(`/(app)/(tabs)/tournaments/cup/${cup.id}`);
      }
    }, [userId, router, cup?.id]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!cup?.id || !hydrated) return;
      if (ENABLE_BACKEND && !userId) return;
      let cancelled = false;
      setDailyCommitOk(false);
      void (async () => {
        const r = await useCupDailyRunStore.getState().tryCommitCup(uid, cup.id);
        if (cancelled) return;
        if (!r.ok) {
          const other = getCreditCupById(r.committedTo);
          router.replace('/(app)/(tabs)/tournaments');
          Alert.alert(
            'Daily cup run',
            `You already used your Run It cup run today on ${other?.name ?? 'another cup'}.`,
          );
          return;
        }
        setDailyCommitOk(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [cup?.id, uid, userId, hydrated, router]),
  );

  /** Only when focusing the screen — avoids kicking mid-run when `nextRound` advances. */
  useFocusEffect(
    useCallback(() => {
      if (!cup || !hydrated) return;
      const s = useCupBracketStore.getState();
      if (s.eliminated || s.nextRound > DAILY_FREE_TOURNAMENT_ROUNDS) {
        router.replace(`/(app)/(tabs)/tournaments/cup/${cup.id}`);
      }
    }, [cup, hydrated, router]),
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

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRoundSplash(true);
      setTimeout(() => {
        setRoundSplash(false);
        finishOnce.current = false;
        setRoundPlayKey((k) => k + 1);
      }, 480);
    },
    [nextRound, recordMatchFinished, router, cup, uid, queryClient],
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

  if (ENABLE_BACKEND && !userId) {
    return (
      <Screen scroll={false}>
        <Text className="text-slate-400">Sign in to play cup events.</Text>
      </Screen>
    );
  }

  if (!hydrated || !dailyCommitOk) {
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
