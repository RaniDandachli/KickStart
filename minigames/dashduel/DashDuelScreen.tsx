import { useCallback, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { Countdown } from '@/minigames/ui/Countdown';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { DashDuelGame } from '@/minigames/dashduel/DashDuelGame';
import { DashDuelLobby } from '@/minigames/dashduel/DashDuelLobby';
import { DashDuelResults } from '@/minigames/dashduel/DashDuelResults';
import type { DashRunState } from '@/minigames/dashduel/engine';

type Phase = 'home' | 'lobby' | 'countdown' | 'playing' | 'results';

function nextSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
}

export default function DashDuelScreen() {
  useHidePlayTabBar();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [phase, setPhase] = useState<Phase>('home');
  const [mode, setMode] = useState<'practice' | 'vs'>('practice');
  const [seed, setSeed] = useState(nextSeed);
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [finalState, setFinalState] = useState<DashRunState | null>(null);

  const runFlow = phase !== 'home';

  const goPractice = useCallback(() => {
    setMode('practice');
    setSeed(nextSeed());
    setPhase('countdown');
  }, []);

  const goVs = useCallback(() => {
    setMode('vs');
    setSeed(nextSeed());
    setPhase('lobby');
  }, []);

  const lobbyStart = useCallback(() => setPhase('countdown'), []);

  const onCountdownDone = useCallback(() => setPhase('playing'), []);

  const onRoundComplete = useCallback((w: 'p1' | 'p2' | 'draw', s: DashRunState) => {
    setWinner(w);
    setFinalState(s);
    setPhase('results');
  }, []);

  const rematch = useCallback(() => {
    setWinner(null);
    setFinalState(null);
    setSeed(nextSeed());
    setPhase('countdown');
  }, []);

  const exitToMenu = useCallback(() => {
    setWinner(null);
    setFinalState(null);
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
                <AppButton title="Practice run" onPress={goPractice} />
                <AppButton className="mt-3" title="1v1 vs AI (match)" variant="secondary" onPress={goVs} />
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
              onRematch={rematch}
              onExit={exitToMenu}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
