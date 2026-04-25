/**
 * Void Runner — arcade integration build (lane runner).
 */

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  MINIGAME_HUD_MS,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { useLockNavigatorGesturesWhile } from '@/minigames/ui/useLockNavigatorGesturesWhile';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';

import {
  createVoidRunnerState,
  stepVoidRunner,
  voidRunnerInputDuck,
  voidRunnerInputJump,
  voidRunnerInputLeft,
  voidRunnerInputRight,
  type Coin,
  type GroundCrack,
  type Obstacle,
  type ScorePopup,
  type VoidRunnerState,
} from './voidRunnerEngine';
import { VOID_RUNNER } from './voidRunnerTuning';

type VoidRunnerGameProps = {
  seed: number;
  subtitle?: string;
  skipStartOverlay?: boolean;
  onExit: () => void;
  onRunComplete: (score: number, durationMs: number, tapCount: number) => void;
};

const LOGIC_W = VOID_RUNNER.laneW;
const LOGIC_H = VOID_RUNNER.laneH;

const OBSTACLE_COLORS: Record<string, readonly [string, string, string]> = {
  barrier: ['#7C3AED', '#5B21B6', '#4C1D95'],
  lowBeam: ['#EC4899', '#DB2777', '#9D174D'],
  pitfall: ['#0EA5E9', '#0284C7', '#075985'],
  tripleBarrier: ['#F59E0B', '#D97706', '#92400E'],
  swarm: ['#EF4444', '#DC2626', '#991B1B'],
};

const StarField = memo(function StarField({
  seed,
  scrollX,
  w,
  h,
}: {
  seed: number;
  scrollX: number;
  w: number;
  h: number;
}) {
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        key: i,
        lx: ((i * 137.508 + seed) % 100) / 100,
        ly: ((i * 73.1 + seed * 2.3) % 100) / 100,
        s: 0.8 + (i % 5) * 0.5,
        speed: 0.08 + (i % 4) * 0.06,
        opacity: 0.12 + (i % 7) * 0.06,
      })),
    [seed],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((st) => {
        const offset = (scrollX * st.speed * 0.4) % w;
        const rx = ((st.lx * w) - offset + w * 2) % w;
        return (
          <View
            key={st.key}
            style={{
              position: 'absolute',
              left: rx,
              top: st.ly * h,
              width: st.s,
              height: st.s,
              borderRadius: st.s,
              backgroundColor: '#E0F2FE',
              opacity: st.opacity,
            }}
          />
        );
      })}
    </View>
  );
});

function GridFloor({
  scrollX,
  w,
  groundY,
  scale,
}: {
  scrollX: number;
  w: number;
  groundY: number;
  scale: number;
}) {
  const laneW = VOID_RUNNER.laneWidth * scale;
  const lineSpacing = 36 * scale;
  const offset = (scrollX * scale) % lineSpacing;
  const numLines = Math.ceil(w / lineSpacing) + 2;
  return (
    <View style={[StyleSheet.absoluteFill, { top: groundY * scale }]} pointerEvents="none">
      {[1, 2].map((i) => (
        <View
          key={`ld${i}`}
          style={{
            position: 'absolute',
            left: i * laneW,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(139, 92, 246, 0.35)',
          }}
        />
      ))}
      {Array.from({ length: numLines }, (_, i) => {
        const x = i * lineSpacing - offset;
        const prog = Math.max(0, x / w);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: 0,
              width: 1,
              height: 48 * scale,
              backgroundColor: `rgba(99, 102, 241, ${0.18 + prog * 0.1})`,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 2,
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
        }}
      />
    </View>
  );
}

function ObstacleView({ obs, scale, groundY }: { obs: Obstacle; scale: number; groundY: number }) {
  const colors = OBSTACLE_COLORS[obs.kind] ?? OBSTACLE_COLORS.barrier;
  const laneW = VOID_RUNNER.laneWidth * scale;
  const gY = groundY * scale;
  const obstH = obs.h * scale;

  if (obs.kind === 'pitfall') {
    const lane = obs.lane;
    const lx = VOID_RUNNER.laneCentres[lane] * scale - laneW * 0.45;
    return (
      <View
        style={{
          position: 'absolute',
          left: lx,
          top: gY - 6,
          width: laneW * 0.9,
          height: 24 * scale,
        }}
      >
        <LinearGradient
          colors={['rgba(14, 165, 233, 0)', 'rgba(14, 165, 233, 0.9)', 'rgba(14, 165, 233, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, borderRadius: 4 }}
        />
      </View>
    );
  }

  if (obs.kind === 'lowBeam') {
    const beamY = (VOID_RUNNER.groundY - VOID_RUNNER.runnerH * 0.72) * scale;
    const lx = VOID_RUNNER.laneCentres[obs.lane] * scale - laneW * 0.45;
    return (
      <View
        style={{
          position: 'absolute',
          left: lx,
          top: beamY - 8 * scale,
          width: laneW * 0.9,
          height: 16 * scale,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[colors[0], colors[1], colors[0]]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  if (obs.kind === 'tripleBarrier') {
    const openLane = obs.openLane ?? 1;
    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: gY - obstH,
          height: obstH,
        }}
        pointerEvents="none"
      >
        {[0, 1, 2].map((li) => {
          if (li === openLane) return null;
          const lx = VOID_RUNNER.laneCentres[li] * scale - laneW * 0.45;
          return (
            <View
              key={li}
              style={{
                position: 'absolute',
                left: lx,
                top: 0,
                width: laneW * 0.9,
                height: obstH,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={[colors[0], colors[1], colors[2]]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ flex: 1 }}
              />
            </View>
          );
        })}
      </View>
    );
  }

  if (obs.kind === 'swarm') {
    const lx = VOID_RUNNER.laneCentres[obs.lane] * scale - laneW * 0.4;
    return (
      <View
        style={{
          position: 'absolute',
          left: lx,
          top: gY - obstH,
          width: laneW * 0.8,
          height: obstH,
        }}
        pointerEvents="none"
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const relX = ((i * 0.23 + 0.1) * laneW * 0.8) * scale;
          const relY = ((i % 2) * 0.4 + 0.1) * obstH;
          const sz = (10 + (i % 3) * 4) * scale;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: relX,
                top: relY,
                width: sz,
                height: sz,
                borderRadius: 3,
                backgroundColor: colors[i % 3],
                opacity: 0.85,
              }}
            />
          );
        })}
      </View>
    );
  }

  const lx = VOID_RUNNER.laneCentres[obs.lane] * scale - laneW * 0.45;
  return (
    <View
      style={{
        position: 'absolute',
        left: lx,
        top: gY - obstH,
        width: laneW * 0.9,
        height: obstH,
        borderRadius: 6,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[colors[0], colors[1], colors[2]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

function CoinView({ coin, scale }: { coin: Coin; scale: number }) {
  if (coin.collected) return null;
  const cx = coin.x * scale;
  const cy = coin.y * scale;
  const r = VOID_RUNNER.coinR * scale;
  return (
    <View
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['#FDE68A', '#FBBF24', '#F59E0B']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

function PopupView({ popup, scale, nowMs }: { popup: ScorePopup; scale: number; nowMs: number }) {
  const age = nowMs - popup.bornMs;
  const t = Math.min(1, age / 900);
  const opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  const dy = t * 40 * scale;
  return (
    <Text
      style={{
        position: 'absolute',
        left: popup.x * scale - 40,
        top: popup.y * scale - dy,
        width: 80,
        textAlign: 'center',
        color: popup.color,
        fontWeight: '900',
        fontSize: 14 * scale,
        opacity,
      }}
      pointerEvents="none"
    >
      {popup.text}
    </Text>
  );
}

function GroundCrackView({
  crack,
  scale,
  nowMs,
  groundY,
}: {
  crack: GroundCrack;
  scale: number;
  nowMs: number;
  groundY: number;
}) {
  const age = nowMs - crack.bornMs;
  const t = Math.min(1, age / 1200);
  const opacity = 1 - t;
  const laneX = VOID_RUNNER.laneCentres[crack.lane] * scale;
  const gY = groundY * scale;
  const spread = t * 28 * scale;
  return (
    <View
      style={{
        position: 'absolute',
        left: laneX - spread - 2,
        top: gY - 3,
        width: spread * 2 + 4,
        height: 6,
        opacity,
      }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', 'rgba(139, 92, 246, 0.8)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

function RunnerView({ state, scale }: { state: VoidRunnerState; scale: number }) {
  const r = state.runner;
  const cx = r.x * scale;
  const cy = r.y * scale;
  const rw = VOID_RUNNER.runnerW * scale;
  const standH = VOID_RUNNER.runnerH * scale;
  const duckH = standH * VOID_RUNNER.duckHFactor;
  const h = r.ducking ? duckH : standH;
  const top = cy;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0.14, 0.26, 0.36].map((opacity, i) => {
        const trailX = cx - (i + 1) * 12 * scale;
        return (
          <View
            key={`tr${i}`}
            style={{
              position: 'absolute',
              left: trailX - rw * (0.8 - i * 0.1),
              top,
              width: rw * 2 * (0.8 - i * 0.1),
              height: h,
              borderRadius: 4,
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              opacity,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: cx - rw,
          top,
          width: rw * 2,
          height: h,
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#C4B5FD', '#8B5CF6', '#6D28D9']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{ flex: 1 }}
        />
        <View
          style={{
            position: 'absolute',
            left: '15%',
            right: '15%',
            top: r.ducking ? '8%' : '12%',
            height: r.ducking ? '22%' : '18%',
            borderRadius: 3,
            backgroundColor: '#67E8F9',
            opacity: 0.9,
          }}
        />
      </View>
    </View>
  );
}

export function VoidRunnerGame({
  seed,
  subtitle,
  skipStartOverlay,
  onExit,
  onRunComplete,
}: VoidRunnerGameProps) {
  const { width: sw, height: sh } = useWindowDimensions();
  const scale = useMemo(() => {
    const maxW = Math.min(sw, 520);
    const maxH = sh * 0.92;
    return Math.min(maxW / LOGIC_W, maxH / LOGIC_H);
  }, [sw, sh]);
  const canvasW = LOGIC_W * scale;
  const canvasH = LOGIC_H * scale;

  const [phase, setPhase] = useState<'ready' | 'playing'>('ready');
  const [runEnded, setRunEnded] = useState(false);
  useLockNavigatorGesturesWhile(phase === 'playing' && !runEnded);

  const [, setUiTick] = useState(0);
  const bump = useCallback(() => setUiTick((t) => t + 1), []);
  const stateRef = useRef<VoidRunnerState>(createVoidRunnerState(seed));
  const lastHudEmitRef = useRef(0);
  const bestScoreRef = useRef(0);
  const startTimeRef = useRef(0);
  const tapCountRef = useRef(0);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunEnded(true);
    const st = stateRef.current;
    const fs = Math.max(0, Math.floor(st.score));
    if (fs > bestScoreRef.current) bestScoreRef.current = fs;
    onRunComplete(fs, Math.max(0, Date.now() - startTimeRef.current), tapCountRef.current);
  }, [onRunComplete]);

  const startGame = useCallback(() => {
    finishedRef.current = false;
    setRunEnded(false);
    stateRef.current = createVoidRunnerState(seed);
    resetMinigameHudClock(lastHudEmitRef);
    startTimeRef.current = Date.now();
    tapCountRef.current = 0;
    setPhase('playing');
    bump();
  }, [bump, seed]);

  useEffect(() => {
    if (!skipStartOverlay || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startGame();
  }, [skipStartOverlay, startGame]);

  const loop = useCallback(
    (totalDtMs: number) => {
      const s = stateRef.current;
      if (!s.alive || finishedRef.current) return;
      runFixedPhysicsSteps(totalDtMs, (dtMs) => {
        stepVoidRunner(s, dtMs);
        return s.alive;
      });
      if (!s.alive) {
        finishRun();
        bump();
        return;
      }
      if (shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS)) bump();
    },
    [bump, finishRun],
  );
  useRafLoop(loop, phase === 'playing' && !runEnded);

  const recordMove = useCallback(() => {
    tapCountRef.current += 1;
  }, []);

  const handleTouchStart = useCallback(
    (e: any) => {
      const t = e.nativeEvent;
      touchStartRef.current = { x: t.locationX ?? t.pageX, y: t.locationY ?? t.pageY, t: Date.now() };
      if (phase === 'ready') {
        startGame();
        return;
      }
      if (phase !== 'playing' || runEnded) return;
      const s = stateRef.current;
      const touchX = t.locationX ?? t.pageX;
      const thirdW = canvasW / 3;
      if (touchX < thirdW) {
        recordMove();
        voidRunnerInputLeft(s);
      } else if (touchX > thirdW * 2) {
        recordMove();
        voidRunnerInputRight(s);
      } else {
        recordMove();
        voidRunnerInputJump(s);
      }
    },
    [phase, startGame, canvasW, runEnded, recordMove],
  );

  const handleTouchEnd = useCallback(
    (e: any) => {
      if (phase !== 'playing' || runEnded) return;
      const start = touchStartRef.current;
      if (!start) return;
      const t = e.nativeEvent;
      const endY = t.locationY ?? t.pageY;
      const dy = endY - start.y;
      const dt = Date.now() - start.t;
      if (dy > 40 && dt < 350) {
        recordMove();
        voidRunnerInputDuck(stateRef.current);
      }
      touchStartRef.current = null;
    },
    [phase, runEnded, recordMove],
  );

  useWebGameKeyboard((phase === 'playing' || phase === 'ready') && !runEnded, {
    ArrowLeft: (down) => {
      if (!down) return;
      if (phase === 'ready') startGame();
      else {
        recordMove();
        voidRunnerInputLeft(stateRef.current);
      }
    },
    ArrowRight: (down) => {
      if (!down) return;
      if (phase === 'ready') startGame();
      else {
        recordMove();
        voidRunnerInputRight(stateRef.current);
      }
    },
    ArrowUp: (down) => {
      if (!down) return;
      if (phase === 'ready') startGame();
      else {
        recordMove();
        voidRunnerInputJump(stateRef.current);
      }
    },
    Space: (down) => {
      if (!down) return;
      if (phase === 'ready') startGame();
      else {
        recordMove();
        voidRunnerInputJump(stateRef.current);
      }
    },
    ArrowDown: (down) => {
      if (!down || phase !== 'playing') return;
      recordMove();
      voidRunnerInputDuck(stateRef.current);
    },
  });

  const s = stateRef.current;
  const displayScore = Math.floor(s.score);
  const groundY = VOID_RUNNER.groundY;

  return (
    <View style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.hud} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={14} onPress={onExit} style={styles.hudBack}>
            <SafeIonicons name="chevron-back" size={26} color="rgba(199,210,254,0.9)" />
          </Pressable>
          <View style={styles.hudCenter}>
            <Text style={styles.hudScore}>{displayScore}</Text>
            {subtitle ? (
              <Text style={styles.hudSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {phase === 'playing' && s.combo >= 3 ? (
              <Text style={styles.hudCombo}>×{Math.floor(s.combo / 3) + 1} COMBO</Text>
            ) : (
              <View style={styles.hudComboPlaceholder} />
            )}
          </View>
          <View style={styles.hudBest}>
            <Text style={styles.hudBestLabel}>BEST</Text>
            <Text style={styles.hudBestValue}>{bestScoreRef.current}</Text>
          </View>
        </View>

        <View style={styles.canvasContainer}>
          <Pressable
            style={[styles.canvas, { width: canvasW, height: canvasH }]}
            onPressIn={handleTouchStart}
            onPressOut={handleTouchEnd}
            disabled={runEnded}
          >
            <LinearGradient
              colors={['#020617', '#0A0F2E', '#050B1F', '#02061A']}
              locations={[0, 0.3, 0.7, 1]}
              start={{ x: 0.4, y: 0 }}
              end={{ x: 0.6, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <StarField seed={seed} scrollX={s.scrollX} w={canvasW} h={canvasH * 0.7} />
            <View style={[styles.cityLayer, { bottom: (LOGIC_H - groundY + 8) * scale }]} pointerEvents="none">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const bw = (18 + (i * 31) % 22) * scale;
                const bh = (40 + (i * 17) % 60) * scale;
                const bx = ((i * 52 + s.scrollX * 0.06) % (canvasW + 80)) - 40;
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: bx,
                      bottom: 0,
                      width: bw,
                      height: bh,
                      backgroundColor: 'rgba(30, 15, 60, 0.9)',
                    }}
                  />
                );
              })}
            </View>
            <GridFloor scrollX={s.scrollX} w={canvasW} groundY={groundY} scale={scale} />
            {s.groundCracks.map((crack) => (
              <GroundCrackView key={crack.id} crack={crack} scale={scale} nowMs={s.worldTimeMs} groundY={groundY} />
            ))}
            {s.coins.map((coin) => (
              <CoinView key={coin.id} coin={coin} scale={scale} />
            ))}
            {s.obstacles.map((obs) => (
              <ObstacleView key={obs.id} obs={obs} scale={scale} groundY={groundY} />
            ))}
            <RunnerView state={s} scale={scale} />
            {s.popups.map((p) => (
              <PopupView key={p.id} popup={p} scale={scale} nowMs={s.worldTimeMs} />
            ))}
            {phase === 'ready' ? (
              <View style={styles.overlay}>
                <LinearGradient
                  colors={['rgba(2,6,23,0.0)', 'rgba(2,6,23,0.88)', 'rgba(2,6,23,0.96)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.readyContent}>
                  <Text style={styles.readyGameName}>VOID{'\n'}RUNNER</Text>
                  <View style={styles.readyDivider} />
                  <Text style={styles.readyTagline}>Shred the rift. Survive the surge.</Text>
                  <Text style={styles.readyCta}>
                    {Platform.OS === 'web' ? 'TAP OR PRESS SPACE TO RUN' : 'TAP TO RUN'}
                  </Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        </View>

        {phase === 'playing' ? (
          <View style={styles.touchZoneRow} pointerEvents="none">
            {(['←', '↑ JUMP', '→'] as const).map((label, i) => (
              <View key={i} style={styles.touchZone}>
                <Text style={styles.touchZoneText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const PURPLE = '#8B5CF6';
const AMBER = '#FBBF24';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  root: { flex: 1, backgroundColor: '#020617' },
  hud: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 6,
    zIndex: 30,
  },
  hudBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudScore: {
    color: '#F1F5F9',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(139, 92, 246, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  hudSubtitle: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(199,210,254,0.65)',
    maxWidth: 220,
    textAlign: 'center',
  },
  hudCombo: { marginTop: 2, color: AMBER, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  hudComboPlaceholder: { marginTop: 2, height: 16 },
  hudBest: { width: 56, alignItems: 'flex-end', paddingTop: 4, paddingRight: 4 },
  hudBestLabel: { color: 'rgba(148,163,184,0.7)', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  hudBestValue: { color: 'rgba(253,224,71,0.9)', fontSize: 16, fontWeight: '800' },
  canvasContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  canvas: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  cityLayer: { position: 'absolute', left: 0, right: 0, height: 80 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  readyContent: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 28 },
  readyGameName: {
    color: '#E2E8F0',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    lineHeight: 54,
    textShadowColor: PURPLE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  readyDivider: { marginVertical: 14, width: 64, height: 2, backgroundColor: PURPLE, borderRadius: 2 },
  readyTagline: {
    color: 'rgba(199, 210, 254, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
  },
  readyCta: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  touchZoneRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: 32,
    zIndex: 5,
  },
  touchZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  touchZoneText: { color: 'rgba(139, 92, 246, 0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
