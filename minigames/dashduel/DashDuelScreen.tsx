import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { Countdown } from '@/minigames/ui/Countdown';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { DashDuelGame } from '@/minigames/dashduel/DashDuelGame';
import { DashDuelLobby } from '@/minigames/dashduel/DashDuelLobby';
import { DashDuelResults } from '@/minigames/dashduel/DashDuelResults';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import {
  awardRedeemTicketsForPrizeRun,
  DASH_DUEL_POINTS_PER_TICKET,
  ticketsFromDashDuelDisplayedScore,
} from '@/lib/ticketPayouts';
import { scoreForPlayer, type DashRunState } from '@/minigames/dashduel/engine';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/store/authStore';

type Phase = 'home' | 'lobby' | 'countdown' | 'playing' | 'results';

function nextSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
}

export default function DashDuelScreen() {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [phase, setPhase] = useState<Phase>('home');
  const [mode, setMode] = useState<'practice' | 'vs'>('practice');
  const [seed, setSeed] = useState(nextSeed);
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [finalState, setFinalState] = useState<DashRunState | null>(null);
  const [ticketsEarned, setTicketsEarned] = useState(0);
  const appliedRouteMode = useRef(false);

  const runFlow = phase !== 'home';

  const goPractice = useCallback(() => {
    setMode('practice');
    setSeed(nextSeed());
    setPhase('countdown');
  }, []);

  const goVs = useCallback(() => {
    const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
    if (!ok) {
      Alert.alert(
        'Not enough prize credits',
        `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
      );
      return;
    }
    setMode('vs');
    setSeed(nextSeed());
    setPhase('lobby');
  }, [profileQ.data?.prize_credits]);

  /** From Arcade: ?mode=practice | ?mode=prize — skip the home picker once. */
  useEffect(() => {
    if (appliedRouteMode.current) return;
    const m = String(modeParam ?? '');
    if (m === 'practice') {
      appliedRouteMode.current = true;
      goPractice();
    } else if (m === 'prize') {
      appliedRouteMode.current = true;
      const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
      if (!ok) {
        Alert.alert(
          'Not enough prize credits',
          `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
        );
        router.back();
        return;
      }
      setMode('vs');
      setSeed(nextSeed());
      setPhase('lobby');
    }
  }, [modeParam, goPractice, router, profileQ.data?.prize_credits]);

  const lobbyStart = useCallback(() => setPhase('countdown'), []);

  const onCountdownDone = useCallback(() => setPhase('playing'), []);

  const onRoundComplete = useCallback(
    (w: 'p1' | 'p2' | 'draw', s: DashRunState) => {
      if (mode === 'vs') {
        const pts = scoreForPlayer(s.p1, s.scroll);
        const n = ticketsFromDashDuelDisplayedScore(pts);
        awardRedeemTicketsForPrizeRun(n);
        setTicketsEarned(n);
      } else {
        setTicketsEarned(0);
      }
      setWinner(w);
      setFinalState(s);
      setPhase('results');
    },
    [mode],
  );

  const rematch = useCallback(() => {
    setWinner(null);
    setFinalState(null);
    setTicketsEarned(0);
    setSeed(nextSeed());
    setPhase('countdown');
  }, []);

  const exitToMenu = useCallback(() => {
    setWinner(null);
    setFinalState(null);
    setTicketsEarned(0);
    setPhase('home');
  }, []);

  const prizeLabel = mode === 'vs' ? 'Prize $9' : undefined;
  const practiceLabel = mode === 'practice' ? 'Practice' : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden={runFlow} style="light" />
      <SafeAreaView className="flex-1 bg-[#020617]" edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <View className="relative flex-1">
          {phase === 'home' ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: isLandscape ? 32 : 24,
                flexDirection: isLandscape ? 'row' : 'column',
                alignItems: 'center',
                gap: isLandscape ? 32 : 0,
              }}
            >
              <View style={{ flex: isLandscape ? 1 : undefined, maxWidth: 420, width: '100%' }}>
                <Text className="mb-2 text-center text-3xl font-black text-cyan-300">Dash Duel</Text>
                <Text className="mb-2 text-center text-sm font-semibold text-slate-400">
                  Portrait auto-run · tap to jump · same course for both rivals
                </Text>
                <Text className="mb-8 text-center text-base leading-6 text-slate-300">
                  Fast rhythm runner: procedural modules, shared seed, speed ramps up. Survive longer to win.
                </Text>
              </View>
              <View style={{ flex: isLandscape ? 0.9 : undefined, width: '100%', maxWidth: 360 }}>
                <AppButton title="Practice run (free)" onPress={goPractice} />
                <AppButton
                  className="mt-3"
                  title={`Prize run vs AI · ${PRIZE_RUN_ENTRY_CREDITS} credits`}
                  variant="secondary"
                  onPress={goVs}
                />
                <AppButton className="mt-6" title="Back to arcade" variant="ghost" onPress={() => router.back()} />
              </View>
            </View>
          ) : null}

          {phase === 'lobby' ? <DashDuelLobby onStart={lobbyStart} onBack={() => setPhase('home')} /> : null}

          {phase === 'countdown' || phase === 'playing' ? (
            <View style={{ flex: 1, width: '100%' }}>
              {phase === 'playing' ? (
                <DashDuelGame
                  key={seed}
                  seed={seed}
                  prizeLabel={prizeLabel}
                  practiceLabel={practiceLabel}
                  onExit={() => router.back()}
                  onRoundComplete={onRoundComplete}
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-black">
                  <Text className="mb-6 text-center text-slate-500">Get ready</Text>
                </View>
              )}
            </View>
          ) : null}

          <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

          {finalState && winner ? (
            <DashDuelResults
              visible={phase === 'results'}
              winner={winner}
              state={finalState}
              ticketsEarned={mode === 'vs' ? ticketsEarned : undefined}
              onRematch={rematch}
              onExit={exitToMenu}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
