import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { Countdown } from '@/minigames/ui/Countdown';
import { TILE_CLASH } from '@/minigames/config/tuning';
import {
  MINIGAME_HUD_MS,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { MiniGameHUD } from '@/minigames/ui/MiniGameHUD';
import { MiniResultsModal } from '@/minigames/ui/MiniResultsModal';
import { ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import {
  createTileClashState,
  stepTileClash,
  tapColumn,
  tileClashAiPick,
  type TileClashState,
} from '@/minigames/tileclash/TileClashEngine';
import { useTileClashMusic } from '@/minigames/tileclash/useTileClashMusic';

const ABSTRACT_W = 100;

function TileBoard({
  state,
  scaleX,
  scaleY,
  boardW,
  laneH,
  onColumnPress,
  interactive,
}: {
  state: TileClashState;
  scaleX: number;
  scaleY: number;
  boardW: number;
  laneH: number;
  onColumnPress?: (col: number) => void;
  interactive: boolean;
}) {
  const colW = boardW / TILE_CLASH.cols;
  return (
    <View style={{ width: boardW, height: laneH, backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: TILE_CLASH.hitZoneTop * scaleY,
          height: (TILE_CLASH.hitZoneBottom - TILE_CLASH.hitZoneTop) * scaleY,
          borderWidth: 2,
          borderColor: '#FBBF24',
          backgroundColor: 'rgba(251, 191, 36, 0.12)',
        }}
      />
      {state.tiles.map((t) => {
        const x = t.col * (ABSTRACT_W / TILE_CLASH.cols) * scaleX;
        const y = t.y * scaleY;
        const w = (ABSTRACT_W / TILE_CLASH.cols) * scaleX - 3;
        const h = TILE_CLASH.tileH * scaleY;
        const bg = t.kind === 'good' ? '#10B981' : '#64748B';
        return (
          <View
            key={t.id}
            style={{
              position: 'absolute',
              left: x + 1.5,
              top: y,
              width: w,
              height: h,
              borderRadius: 6,
              backgroundColor: bg,
              borderWidth: 2,
              borderColor: '#0F172A',
            }}
          />
        );
      })}
      {interactive
        ? Array.from({ length: TILE_CLASH.cols }, (_, col) => (
            <Pressable
              key={col}
              onPress={() => onColumnPress?.(col)}
              style={{
                position: 'absolute',
                left: col * colW,
                top: 0,
                width: colW,
                height: laneH,
              }}
            />
          ))
        : null}
    </View>
  );
}

export default function TileClashScreen() {
  useHidePlayTabBar();
  const router = useRouter();
  const { width: sw } = useWindowDimensions();
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'playing' | 'done'>('intro');
  useTileClashMusic(phase === 'countdown' || phase === 'playing');
  const [uiTick, setUiTick] = useState(0);
  const stateRef = useRef<TileClashState | null>(null);
  const lastHudEmitRef = useRef(0);

  const pad = 10;
  const boardW = (sw - pad * 3) / 2;
  const scaleX = boardW / ABSTRACT_W;
  const laneH = TILE_CLASH.laneH * scaleX;

  const startRun = useCallback(() => {
    stateRef.current = createTileClashState((Date.now() ^ 0xcafebabe) >>> 0);
    resetMinigameHudClock(lastHudEmitRef);
    setUiTick((t) => t + 1);
    setPhase('countdown');
  }, []);

  const onCountdownDone = useCallback(() => {
    setPhase('playing');
  }, []);

  const loop = useCallback((totalDtMs: number) => {
    const s = stateRef.current;
    if (!s) return;
    runFixedPhysicsSteps(totalDtMs, (h) => {
      stepTileClash(s, h);
      if (s.timeLeftMs <= 0) return false;
      return true;
    });
    const col = tileClashAiPick(s);
    if (col >= 0) tapColumn(s, col, 2);
    if (s.timeLeftMs <= 0) setPhase('done');
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
          <Text className="mb-2 text-center text-3xl font-black text-amber-300">Tile Clash</Text>
          <Text className="mb-8 text-center text-base font-medium text-slate-300">
            Emerald tiles are safe — tap them in the gold band. Slate tiles cost points. Speed ramps up. Same pattern
            as the AI — best score wins.
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
              subtitle="Tile Clash · ~26s"
            />
          ) : null}
          <View className="flex-1 flex-row justify-center gap-2 px-2 pt-2">
            <View className="items-center">
              <Text className="mb-1 text-xs font-bold text-emerald-800">You</Text>
              {snap ? (
                <TileBoard
                  state={snap}
                  scaleX={scaleX}
                  scaleY={scaleX}
                  boardW={boardW}
                  laneH={laneH}
                  interactive={phase === 'playing'}
                  onColumnPress={(col) => {
                    if (stateRef.current && phase === 'playing') tapColumn(stateRef.current, col, 1);
                    setUiTick((t) => t + 1);
                  }}
                />
              ) : null}
            </View>
            <View className="items-center">
              <Text className="mb-1 text-xs font-bold text-amber-900">AI</Text>
              {snap ? (
                <TileBoard
                  state={snap}
                  scaleX={scaleX}
                  scaleY={scaleX}
                  boardW={boardW}
                  laneH={laneH}
                  interactive={false}
                />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

      <MiniResultsModal
        visible={phase === 'done' && !!snap}
        title={winnerTitle}
        scoreP1={snap?.scoreP1 ?? 0}
        scoreP2={snap?.scoreP2 ?? 0}
        onRematch={startRun}
        onMenu={() => {}}
        onExitMinigames={() => router.replace(ROUTE_MINIGAMES)}
        onExitHome={() => router.replace(ROUTE_HOME)}
      />
    </SafeAreaView>
  );
}
