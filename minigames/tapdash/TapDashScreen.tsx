import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import {
  MINIGAME_HUD_MS,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { Countdown } from '@/minigames/ui/Countdown';
import { TAP_DASH } from '@/minigames/config/tuning';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { MiniGameHUD } from '@/minigames/ui/MiniGameHUD';
import { MiniResultsModal } from '@/minigames/ui/MiniResultsModal';
import { ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import {
  createTapDashState,
  stepTapDash,
  tapDashAiFlap,
  type TapDashState,
} from '@/minigames/tapdash/TapDashEngine';

function LaneView({
  state,
  who,
  scale,
  laneW,
  laneH,
}: {
  state: TapDashState;
  who: 1 | 2;
  scale: number;
  laneW: number;
  laneH: number;
}) {
  const bird = who === 1 ? state.p1 : state.p2;
  const bx = TAP_DASH.birdX * scale;
  const by = bird.y * scale;
  const br = TAP_DASH.birdR * scale;
  return (
    <View style={{ width: laneW, height: laneH, backgroundColor: '#E0F2FE' }}>
      {state.pipes.map((p) => {
        const px = p.x * scale;
        const pw = TAP_DASH.pipeW * scale;
        const g0 = (p.gapY - TAP_DASH.gapHalf) * scale;
        const g1 = (p.gapY + TAP_DASH.gapHalf) * scale;
        return (
          <View key={p.id} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
            <View
              style={{
                position: 'absolute',
                left: px,
                top: 0,
                width: pw,
                height: g0,
                backgroundColor: '#15803D',
                borderWidth: 2,
                borderColor: '#14532D',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: px,
                top: g1,
                width: pw,
                height: Math.max(0, laneH - g1),
                backgroundColor: '#15803D',
                borderWidth: 2,
                borderColor: '#14532D',
              }}
            />
          </View>
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: bx - br,
          top: by - br,
          width: br * 2,
          height: br * 2,
          borderRadius: br,
          backgroundColor: who === 1 ? '#F97316' : '#6366F1',
          borderWidth: 2,
          borderColor: '#0F172A',
        }}
      />
      {!bird.alive ? (
        <Text
          style={{
            position: 'absolute',
            bottom: 8,
            alignSelf: 'center',
            fontWeight: '900',
            color: '#DC2626',
            fontSize: 12,
          }}
        >
          OUT
        </Text>
      ) : null}
    </View>
  );
}

export default function TapDashScreen() {
  useHidePlayTabBar();
  const router = useRouter();
  const { width: sw } = useWindowDimensions();
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'playing' | 'done'>('intro');
  const [uiTick, setUiTick] = useState(0);
  const stateRef = useRef<TapDashState | null>(null);
  const seedRef = useRef(Date.now() & 0xfffffff);
  const p1Flap = useRef(false);
  const lastHudEmitRef = useRef(0);

  const laneW = useMemo(() => (sw - 20) / 2, [sw]);
  const scale = laneW / TAP_DASH.laneW;
  const laneH = TAP_DASH.laneH * scale;

  const startRun = useCallback(() => {
    seedRef.current = (Date.now() ^ 0xdeadbeef) >>> 0;
    stateRef.current = createTapDashState(seedRef.current);
    resetMinigameHudClock(lastHudEmitRef);
    setUiTick((t) => t + 1);
    setPhase('countdown');
  }, []);

  const onCountdownDone = useCallback(() => {
    resetMinigameHudClock(lastHudEmitRef);
    setPhase('playing');
  }, []);

  const loop = useCallback((totalDtMs: number) => {
    const s = stateRef.current;
    if (!s) return;
    let first = true;
    runFixedPhysicsSteps(totalDtMs, (h) => {
      const p2f = tapDashAiFlap(s);
      const p1f = first && p1Flap.current;
      if (first) p1Flap.current = false;
      first = false;
      stepTapDash(s, h, { p1Flap: p1f, p2Flap: p2f });
      if (s.timeLeftMs <= 0) return false;
      return true;
    });
    if (s.timeLeftMs <= 0) {
      setPhase('done');
      setUiTick((t) => t + 1);
      return;
    }
    if (shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS)) {
      setUiTick((t) => t + 1);
    }
  }, []);

  useRafLoop(loop, phase === 'playing');

  const snap = stateRef.current;
  const winnerTitle =
    snap && phase === 'done'
      ? snap.scoreP1 > snap.scoreP2
        ? 'You win!'
        : snap.scoreP2 > snap.scoreP1
          ? 'AI wins!'
          : 'Draw!'
      : '';

  return (
    <SafeAreaView className="flex-1 bg-[#0f2847]" edges={['top', 'left', 'right']}>
      {phase === 'intro' ? (
        <View className="flex-1 justify-center px-6">
          <Text className="mb-2 text-center text-3xl font-black text-amber-300">Tap Dash</Text>
          <Text className="mb-8 text-center text-base font-medium text-slate-300">
            Tap your side to glide upward. Slip through the gates — same course as the AI. Highest score after
            30s wins.
          </Text>
          <AppButton title="Play vs AI" onPress={startRun} />
        </View>
      ) : null}

      {phase === 'countdown' || phase === 'playing' || phase === 'done' ? (
        <View className="flex-1">
          {snap ? (
            <MiniGameHUD
              timeLeftMs={snap.timeLeftMs}
              scoreP1={snap.scoreP1}
              scoreP2={snap.scoreP2}
              subtitle="Tap Dash · 30s"
            />
          ) : null}
          <View className="flex-1 flex-row justify-center gap-2 px-2 pt-2">
            <Pressable
              className="overflow-hidden rounded-2xl border-2 border-emerald-300"
              onPress={() => {
                p1Flap.current = true;
              }}
              style={{ width: laneW }}
            >
              {snap ? <LaneView state={snap} who={1} scale={scale} laneW={laneW} laneH={laneH} /> : null}
              <Text className="bg-emerald-100 py-1 text-center text-xs font-bold text-emerald-900">You · tap</Text>
            </Pressable>
            <View className="overflow-hidden rounded-2xl border-2 border-sky-300" style={{ width: laneW }}>
              {snap ? <LaneView state={snap} who={2} scale={scale} laneW={laneW} laneH={laneH} /> : null}
              <Text className="bg-sky-100 py-1 text-center text-xs font-bold text-sky-900">AI</Text>
            </View>
          </View>
          <Text className="pb-2 text-center text-xs font-medium text-violet-700" key={uiTick}>
            {phase === 'playing' ? 'Tap left lane to boost' : ''}
          </Text>
        </View>
      ) : null}

      <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

      <MiniResultsModal
        visible={phase === 'done' && !!snap}
        title={winnerTitle}
        scoreP1={snap?.scoreP1 ?? 0}
        scoreP2={snap?.scoreP2 ?? 0}
        onRematch={() => {
          startRun();
        }}
        onMenu={() => {}}
        onExitMinigames={() => router.replace(ROUTE_MINIGAMES)}
        onExitHome={() => router.replace(ROUTE_HOME)}
      />
    </SafeAreaView>
  );
}
