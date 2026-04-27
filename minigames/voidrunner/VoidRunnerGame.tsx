/**
 * VoidRunnerGame.tsx
 * Void Runner — cyberpunk endless runner for Runit Arcades.
 *
 * Controls (portrait):
 *   Left third  → slide left
 *   Right third → slide right
 *   Middle tap  → jump
 *   Swipe down  → duck
 *
 * Web: Arrow keys (←→↑↓), Space to jump
 */

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    memo,
    useCallback,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
  
  import {
    MINIGAME_HUD_MS,
    resetMinigameHudClock,
    shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
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
  
  // ─── Constants ───────────────────────────────────────────────────────────────
  
  const LOGIC_W = VOID_RUNNER.laneW;  // 390
  const LOGIC_H = VOID_RUNNER.laneH;  // 520
  
  const OBSTACLE_COLORS: Record<string, readonly [string, string, string]> = {
    barrier:       ['#7C3AED', '#5B21B6', '#4C1D95'],
    lowBeam:       ['#EC4899', '#DB2777', '#9D174D'],
    pitfall:       ['#0EA5E9', '#0284C7', '#075985'],
    tripleBarrier: ['#F59E0B', '#D97706', '#92400E'],
    swarm:         ['#EF4444', '#DC2626', '#991B1B'],
  };
  
  // ─── Sub-components ──────────────────────────────────────────────────────────
  
  /** Parallax starfield — purely decorative, memoized. */
  const StarField = memo(function StarField({ seed, scrollX, w, h }: { seed: number; scrollX: number; w: number; h: number }) {
    const stars = useMemo(() => {
      return Array.from({ length: 60 }, (_, i) => ({
        key: i,
        lx: ((i * 137.508 + seed) % 100) / 100,
        ly: ((i * 73.1 + seed * 2.3) % 100) / 100,
        s: 0.8 + (i % 5) * 0.5,
        speed: 0.08 + (i % 4) * 0.06,
        opacity: 0.12 + (i % 7) * 0.06,
        twinkle: i % 3 === 0,
      }));
    }, [seed]);
  
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
  
  /** Animated grid floor that scrolls with game speed. */
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
    const offset = scrollX * scale % lineSpacing;
    const numLines = Math.ceil(w / lineSpacing) + 2;
  
    return (
      <View
        style={[StyleSheet.absoluteFill, { top: groundY * scale }]}
        pointerEvents="none"
      >
        {/* Lane dividers */}
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
        {/* Receding horizontal grid lines */}
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
        {/* Ground glow line */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 2,
            backgroundColor: 'rgba(139, 92, 246, 0.7)',
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 8,
          }}
        />
      </View>
    );
  }
  
  /** Neon tube obstacle render. */
  function ObstacleView({
    obs,
    scale,
    groundY,
  }: {
    obs: Obstacle;
    scale: number;
    groundY: number;
  }) {
    const colors = OBSTACLE_COLORS[obs.kind] ?? OBSTACLE_COLORS.barrier;
    const laneX = VOID_RUNNER.laneCentres[obs.kind === 'tripleBarrier' ? 1 : obs.lane] * scale;
    const laneW = VOID_RUNNER.laneWidth * scale;
  
    const gY = groundY * scale;
    const obstH = obs.h * scale;
  
    if (obs.kind === 'pitfall') {
      // Pitfall: glowing rift in the ground
      const px = (obs.x - 32) * scale;
      const pw = 64 * scale;
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
      // Low beam: horizontal laser bar
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
          {/* Scanline effect */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(255,255,255,0.2)',
              height: 2,
              top: '30%',
            }}
          />
        </View>
      );
    }
  
    if (obs.kind === 'tripleBarrier') {
      // Full-width barrier with one lane open
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
                {/* Glowing top edge */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    backgroundColor: colors[0],
                  }}
                />
              </View>
            );
          })}
        </View>
      );
    }
  
    if (obs.kind === 'swarm') {
      // Swarm: cluster of debris hexagons
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
                  transform: [{ rotate: `${i * 23}deg` }],
                }}
              />
            );
          })}
        </View>
      );
    }
  
    // Default: single-lane barrier
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
        {/* Glow top cap */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: colors[0],
            shadowColor: colors[0],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 8,
          }}
        />
        {/* Circuit line decoration */}
        <View
          style={{
            position: 'absolute',
            left: '20%',
            right: '20%',
            top: '35%',
            height: 2,
            backgroundColor: 'rgba(255,255,255,0.25)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: '20%',
            right: '20%',
            top: '65%',
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        />
      </View>
    );
  }
  
  /** Glowing collectible coin. */
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
        <View
          style={{
            position: 'absolute',
            left: '20%',
            top: '15%',
            width: '30%',
            height: '25%',
            borderRadius: 99,
            backgroundColor: 'rgba(255,255,255,0.5)',
          }}
        />
      </View>
    );
  }
  
  /** Score popup that floats upward. */
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
          letterSpacing: 0.5,
          textShadowColor: popup.color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
        pointerEvents="none"
      >
        {popup.text}
      </Text>
    );
  }
  
  /** Ground crack spark on landing. */
  function GroundCrackView({ crack, scale, nowMs, groundY }: { crack: GroundCrack; scale: number; nowMs: number; groundY: number }) {
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
  
  /** The runner character — a sleek cyberpunk silhouette. */
  function RunnerView({
    state,
    scale,
  }: {
    state: VoidRunnerState;
    scale: number;
  }) {
    const r = state.runner;
    const cx = r.x * scale;
    const cy = r.y * scale;
    const rw = VOID_RUNNER.runnerW * scale;
    const standH = VOID_RUNNER.runnerH * scale;
    const duckH = standH * VOID_RUNNER.duckHFactor;
    const h = r.ducking ? duckH : standH;
    const top = cy;
  
    // Trail
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Motion trail */}
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
  
        {/* Main body */}
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
          {/* Visor */}
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
          {/* Chest stripe */}
          <View
            style={{
              position: 'absolute',
              left: '30%',
              right: '30%',
              top: r.ducking ? '42%' : '38%',
              height: 2,
              backgroundColor: '#34D399',
              opacity: 0.7,
            }}
          />
        </View>
  
        {/* Foot glow */}
        <View
          style={{
            position: 'absolute',
            left: cx - rw * 1.6,
            top: top + h - 4,
            width: rw * 3.2,
            height: 6,
            borderRadius: 6,
            backgroundColor: 'rgba(139, 92, 246, 0.5)',
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 6,
          }}
        />
  
        {/* Airborne thrusters */}
        {r.airborne ? (
          <View
            style={{
              position: 'absolute',
              left: cx - rw * 0.7,
              top: top + h + 2,
              width: rw * 1.4,
              height: 14 * scale,
              borderRadius: 4,
            }}
          >
            <LinearGradient
              colors={['#8B5CF6', 'rgba(139,92,246,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}
      </View>
    );
  }
  
  // ─── Main Component ───────────────────────────────────────────────────────────
  
  export default function VoidRunnerGame() {
    useHidePlayTabBar();
    const router = useRouter();
    const { width: sw, height: sh } = useWindowDimensions();
  
    // Compute scale so the logical canvas fills the available area
    const scale = useMemo(() => {
      const maxW = Math.min(sw, 520);
      const maxH = sh * 0.92;
      return Math.min(maxW / LOGIC_W, maxH / LOGIC_H);
    }, [sw, sh]);
  
    const canvasW = LOGIC_W * scale;
    const canvasH = LOGIC_H * scale;
  
    const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
    useLockNavigatorGesturesWhile(phase === 'playing');
  
    const [, setUiTick] = useState(0);
    const bump = useCallback(() => setUiTick((t) => t + 1), []);
  
    const stateRef = useRef<VoidRunnerState>(createVoidRunnerState());
    const lastHudEmitRef = useRef(0);
    const bestScoreRef = useRef(0);
  
    // Swipe detection
    const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  
    const resetGame = useCallback(() => {
      stateRef.current = createVoidRunnerState();
      resetMinigameHudClock(lastHudEmitRef);
      setPhase('ready');
      bump();
    }, [bump]);
  
    const startGame = useCallback(() => {
      stateRef.current = createVoidRunnerState();
      resetMinigameHudClock(lastHudEmitRef);
      setPhase('playing');
      bump();
    }, [bump]);
  
    const loop = useCallback(
      (totalDtMs: number) => {
        const s = stateRef.current;
        if (!s.alive) return;
  
        runFixedPhysicsSteps(totalDtMs, (dtMs) => {
          stepVoidRunner(s, dtMs);
          return s.alive;
        });
  
        if (!s.alive) {
          const finalScore = Math.floor(s.score);
          if (finalScore > bestScoreRef.current) bestScoreRef.current = finalScore;
          setPhase('over');
          bump();
          return;
        }
  
        if (shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS)) {
          bump();
        }
      },
      [bump],
    );
  
    useRafLoop(loop, phase === 'playing');
  
    // ── Touch input ───────────────────────────────────────────────────────────
    const handleTouchStart = useCallback(
      (e: any) => {
        const t = e.nativeEvent;
        touchStartRef.current = { x: t.locationX ?? t.pageX, y: t.locationY ?? t.pageY, t: Date.now() };
  
        if (phase === 'ready') {
          startGame();
          return;
        }
  
        if (phase !== 'playing') return;
  
        const s = stateRef.current;
        const touchX = t.locationX ?? t.pageX;
        const thirdW = canvasW / 3;
  
        if (touchX < thirdW) {
          voidRunnerInputLeft(s);
        } else if (touchX > thirdW * 2) {
          voidRunnerInputRight(s);
        } else {
          voidRunnerInputJump(s);
        }
      },
      [phase, startGame, canvasW],
    );
  
    const handleTouchEnd = useCallback(
      (e: any) => {
        if (phase !== 'playing') return;
        const start = touchStartRef.current;
        if (!start) return;
        const t = e.nativeEvent;
        const endY = t.locationY ?? t.pageY;
        const dy = endY - start.y;
        const dt = Date.now() - start.t;
        if (dy > 40 && dt < 350) {
          // Swipe down → duck
          voidRunnerInputDuck(stateRef.current);
        }
        touchStartRef.current = null;
      },
      [phase],
    );
  
    // ── Web keyboard ──────────────────────────────────────────────────────────
    useWebGameKeyboard(phase === 'playing' || phase === 'ready', {
      ArrowLeft:  (down) => { if (down) { if (phase === 'ready') startGame(); else voidRunnerInputLeft(stateRef.current); }},
      ArrowRight: (down) => { if (down) { if (phase === 'ready') startGame(); else voidRunnerInputRight(stateRef.current); }},
      ArrowUp:    (down) => { if (down) { if (phase === 'ready') startGame(); else voidRunnerInputJump(stateRef.current); }},
      Space:      (down) => { if (down) { if (phase === 'ready') startGame(); else voidRunnerInputJump(stateRef.current); }},
      ArrowDown:  (down) => { if (down && phase === 'playing') voidRunnerInputDuck(stateRef.current); },
    });
  
    const s = stateRef.current;
    const displayScore = Math.floor(s.score);
    const groundY = VOID_RUNNER.groundY;
  
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.root}>
  
          {/* ── HUD ─────────────────────────────────────────────────────────── */}
          <View style={styles.hud} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={14}
              onPress={() => router.back()}
              style={styles.hudBack}
            >
              <SafeIonicons name="chevron-back" size={26} color="rgba(199,210,254,0.9)" />
            </Pressable>
  
            <View style={styles.hudCenter}>
              <Text style={styles.hudScore}>{displayScore}</Text>
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
  
          {/* ── Game canvas ──────────────────────────────────────────────────── */}
          <View style={styles.canvasContainer}>
            <Pressable
              style={[styles.canvas, { width: canvasW, height: canvasH }]}
              onPressIn={handleTouchStart}
              onPressOut={handleTouchEnd}
              disabled={phase === 'over'}
            >
              {/* Deep space background */}
              <LinearGradient
                colors={['#020617', '#0A0F2E', '#050B1F', '#02061A']}
                locations={[0, 0.3, 0.7, 1]}
                start={{ x: 0.4, y: 0 }}
                end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
  
              {/* Nebula accent */}
              <View
                style={{
                  position: 'absolute',
                  left: '10%',
                  top: '5%',
                  width: '80%',
                  height: '40%',
                  borderRadius: 999,
                  backgroundColor: 'rgba(109, 40, 217, 0.08)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: '-10%',
                  top: '20%',
                  width: '60%',
                  height: '30%',
                  borderRadius: 999,
                  backgroundColor: 'rgba(6, 182, 212, 0.05)',
                }}
              />
  
              <StarField seed={42} scrollX={s.scrollX} w={canvasW} h={canvasH * 0.7} />
  
              {/* Distant city silhouette */}
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
  
              {/* Grid floor */}
              <GridFloor scrollX={s.scrollX} w={canvasW} groundY={groundY} scale={scale} />
  
              {/* Ground cracks */}
              {s.groundCracks.map((crack) => (
                <GroundCrackView
                  key={crack.id}
                  crack={crack}
                  scale={scale}
                  nowMs={s.worldTimeMs}
                  groundY={groundY}
                />
              ))}
  
              {/* Coins */}
              {s.coins.map((coin) => (
                <CoinView key={coin.id} coin={coin} scale={scale} />
              ))}
  
              {/* Obstacles */}
              {s.obstacles.map((obs) => (
                <ObstacleView key={obs.id} obs={obs} scale={scale} groundY={groundY} />
              ))}
  
              {/* Runner */}
              <RunnerView state={s} scale={scale} />
  
              {/* Score popups */}
              {s.popups.map((p) => (
                <PopupView key={p.id} popup={p} scale={scale} nowMs={s.worldTimeMs} />
              ))}
  
              {/* ── Ready overlay ──────────────────────────────────────────── */}
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
  
                    <View style={styles.controlsRow}>
                      <View style={styles.controlHint}>
                        <View style={[styles.controlIcon, { borderColor: '#8B5CF6' }]}>
                          <Text style={styles.controlIconText}>←</Text>
                        </View>
                        <Text style={styles.controlLabel}>SLIDE</Text>
                      </View>
                      <View style={styles.controlHint}>
                        <View style={[styles.controlIcon, { borderColor: '#22D3EE' }]}>
                          <Text style={styles.controlIconText}>↑</Text>
                        </View>
                        <Text style={styles.controlLabel}>JUMP</Text>
                      </View>
                      <View style={styles.controlHint}>
                        <View style={[styles.controlIcon, { borderColor: '#34D399' }]}>
                          <Text style={styles.controlIconText}>↓</Text>
                        </View>
                        <Text style={styles.controlLabel}>DUCK</Text>
                      </View>
                      <View style={styles.controlHint}>
                        <View style={[styles.controlIcon, { borderColor: '#FBBF24' }]}>
                          <Text style={styles.controlIconText}>●</Text>
                        </View>
                        <Text style={styles.controlLabel}>COIN</Text>
                      </View>
                    </View>
  
                    <Text style={styles.readyCta}>
                      {Platform.OS === 'web' ? 'TAP OR PRESS SPACE TO RUN' : 'TAP TO RUN'}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Pressable>
          </View>
  
          {/* ── Game Over modal ───────────────────────────────────────────────── */}
          {phase === 'over' ? (
            <View style={styles.gameOverOverlay}>
              <View style={styles.gameOverCard}>
                <LinearGradient
                  colors={['rgba(10,10,30,0.98)', 'rgba(15,5,35,0.99)']}
                  style={StyleSheet.absoluteFill}
                />
                {/* Accent line */}
                <View style={styles.gameOverAccent} />
  
                <Text style={styles.gameOverTitle}>RUN ENDED</Text>
                <Text style={styles.gameOverSubtitle}>VOID RUNNER</Text>
  
                <View style={styles.statsRow}>
                  <View style={styles.statBlock}>
                    <Text style={styles.statValue}>{displayScore}</Text>
                    <Text style={styles.statLabel}>SCORE</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <Text style={[styles.statValue, { color: '#FBBF24' }]}>{bestScoreRef.current}</Text>
                    <Text style={styles.statLabel}>BEST</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <Text style={styles.statValue}>{Math.floor(s.worldTimeMs / 1000)}s</Text>
                    <Text style={styles.statLabel}>TIME</Text>
                  </View>
                </View>
  
                {displayScore >= bestScoreRef.current && displayScore > 0 ? (
                  <View style={styles.newBestBadge}>
                    <Text style={styles.newBestText}>NEW BEST</Text>
                  </View>
                ) : null}
  
                <View style={styles.gameOverButtons}>
                  <Pressable
                    style={({ pressed }) => [styles.runAgainBtn, pressed && { opacity: 0.85 }]}
                    onPress={resetGame}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#6D28D9']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.runAgainGradient}
                    />
                    <Text style={styles.runAgainText}>RUN AGAIN</Text>
                  </Pressable>
  
                  <View style={styles.exitRow}>
                    <Pressable
                      style={styles.exitBtn}
                      onPress={() => router.replace(ROUTE_MINIGAMES)}
                    >
                      <Text style={styles.exitBtnText}>ARCADE</Text>
                    </Pressable>
                    <Pressable
                      style={styles.exitBtn}
                      onPress={() => router.replace(ROUTE_HOME)}
                    >
                      <Text style={styles.exitBtnText}>HOME</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
  
          {/* ── Touch zone labels (playing only) ─────────────────────────────── */}
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
      </SafeAreaView>
    );
  }
  
  // ─── Styles ───────────────────────────────────────────────────────────────────
  
  const PURPLE = '#8B5CF6';
  const CYAN   = '#22D3EE';
  const EMERALD = '#34D399';
  const AMBER  = '#FBBF24';
  
  const styles = StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: '#020617',
    },
    root: {
      flex: 1,
      backgroundColor: '#020617',
    },
  
    // HUD
    hud: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 8,
      paddingTop: 4,
      paddingBottom: 6,
      zIndex: 30,
    },
    hudBack: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hudCenter: {
      flex: 1,
      alignItems: 'center',
    },
    hudScore: {
      color: '#F1F5F9',
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -0.5,
      textShadowColor: 'rgba(139, 92, 246, 0.7)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    hudCombo: {
      marginTop: 2,
      color: AMBER,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      textShadowColor: AMBER,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    hudComboPlaceholder: {
      marginTop: 2,
      height: 16,
    },
    hudBest: {
      width: 56,
      alignItems: 'flex-end',
      paddingTop: 4,
      paddingRight: 4,
    },
    hudBestLabel: {
      color: 'rgba(148,163,184,0.7)',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    hudBestValue: {
      color: 'rgba(253,224,71,0.9)',
      fontSize: 16,
      fontWeight: '800',
    },
  
    // Canvas
    canvasContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.3)',
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 12,
    },
  
    // City backdrop
    cityLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 80,
    },
  
    // Ready overlay
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    readyContent: {
      alignItems: 'center',
      paddingHorizontal: 28,
      paddingBottom: 28,
    },
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
    readyDivider: {
      marginVertical: 14,
      width: 64,
      height: 2,
      backgroundColor: PURPLE,
      borderRadius: 2,
    },
    readyTagline: {
      color: 'rgba(199, 210, 254, 0.85)',
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: 20,
    },
    controlsRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 22,
    },
    controlHint: {
      alignItems: 'center',
      gap: 5,
    },
    controlIcon: {
      width: 38,
      height: 38,
      borderRadius: 8,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    controlIconText: {
      color: '#E2E8F0',
      fontSize: 16,
      fontWeight: '700',
    },
    controlLabel: {
      color: 'rgba(148,163,184,0.7)',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    readyCta: {
      color: EMERALD,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 1.5,
      textShadowColor: EMERALD,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
  
    // Game over
    gameOverOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(2, 6, 23, 0.7)',
      zIndex: 60,
      paddingHorizontal: 20,
    },
    gameOverCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.45)',
      padding: 24,
      shadowColor: PURPLE,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
    },
    gameOverAccent: {
      position: 'absolute',
      top: 0,
      left: 24,
      right: 24,
      height: 2,
      backgroundColor: PURPLE,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      shadowColor: PURPLE,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
    },
    gameOverTitle: {
      color: '#E2E8F0',
      fontSize: 28,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: 4,
      marginTop: 8,
      textShadowColor: PURPLE,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 16,
    },
    gameOverSubtitle: {
      color: 'rgba(148,163,184,0.6)',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 3,
      textAlign: 'center',
      marginBottom: 20,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: 16,
      paddingVertical: 16,
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
      borderColor: 'rgba(139, 92, 246, 0.25)',
    },
    statBlock: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      color: '#F1F5F9',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    statLabel: {
      color: 'rgba(148,163,184,0.6)',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginTop: 2,
    },
    statDivider: {
      width: 0.5,
      height: 36,
      backgroundColor: 'rgba(139, 92, 246, 0.25)',
    },
    newBestBadge: {
      alignSelf: 'center',
      backgroundColor: 'rgba(251, 191, 36, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(251, 191, 36, 0.5)',
      borderRadius: 99,
      paddingHorizontal: 16,
      paddingVertical: 5,
      marginBottom: 16,
    },
    newBestText: {
      color: AMBER,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
    },
    gameOverButtons: {
      gap: 10,
      marginTop: 4,
    },
    runAgainBtn: {
      height: 52,
      borderRadius: 12,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    runAgainGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    runAgainText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 2,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    exitRow: {
      flexDirection: 'row',
      gap: 10,
    },
    exitBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
    },
    exitBtnText: {
      color: 'rgba(199, 210, 254, 0.85)',
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 2,
    },
  
    // Touch zone hints
    touchZoneRow: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      height: 32,
      zIndex: 5,
    },
    touchZone: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    touchZoneText: {
      color: 'rgba(139, 92, 246, 0.35)',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
  });