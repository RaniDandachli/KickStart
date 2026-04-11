// ─── NEON RUNNER — Game Screen ─────────────────────────────────────────────
// Locked to landscape via expo-screen-orientation.
// GD-authentic visuals: neon grid, glowing player, sharp spikes, solid stairs.

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Polygon, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { GROUND_Y, NR } from '@/minigames/dashduel/constants';
import { DashDuelHud } from '@/minigames/dashduel/DashDuelHud';
import { DashDuelOpponentStrip } from '@/minigames/dashduel/DashDuelOpponentStrip';
import { createInputState, createRunState, scoreFromState, stepRun, type InputState } from '@/minigames/dashduel/engine';
import type { Obstacle, RunState } from '@/minigames/dashduel/types';

type Props = {
  seed: number;
  practiceLabel?: string;
  prizeLabel?: string;
  onExit: () => void;
  onRoundComplete: (finalScore: number, distance: number, durationMs: number, jumpCount: number) => void;
};

function camX(playerWorldX: number): number {
  return playerWorldX - NR.PLAY_W * NR.PLAYER_SCREEN_X_RATIO;
}

/** RN Text / layout can misbehave with NaN/∞ from bad game state — coerce for HUD. */
function safeNonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function safeDrive(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function obstacleStableKey(o: Obstacle): string {
  const base = `${o.kind}:${o.x.toFixed(1)}:${o.y.toFixed(1)}:${o.w.toFixed(1)}:${o.h.toFixed(1)}`;
  return o.kind === 'ring' ? `${base}:${o.used ? 1 : 0}` : base;
}

const HUD_BUMP_MIN_MS = 100;
/** Hard cap — dense segments + SVG spikes can stall JS if we mount hundreds at once. */
const MAX_RENDERED_OBSTACLES = 96;

export function DashDuelGame({ seed, practiceLabel, prizeLabel, onExit, onRoundComplete }: Props) {
  // Orientation: parent `DashDuelScreen` locks landscape for the whole flow (game unmount must not unlock).

  // ── Layout — always use landscape dimensions ─────────────────────────────
  const { width: sw, height: sh } = useWindowDimensions();
  // After orientation lock, sw > sh. Before it settles, take the max as width.
  const lw = Math.max(sw, sh);
  const lh = Math.min(sw, sh);
  const insets = useSafeAreaInsets();

  // Available area: full width minus notch/sides, height minus HUD (~52px) and hint (~28px)
  const HUD_H = 52;
  const HINT_H = 28;
  const availW = lw - Math.max(insets.left, insets.right) * 2 - 8;
  const availH = lh - insets.top - insets.bottom - HUD_H - HINT_H;

  const scaleByW = availW / NR.PLAY_W;
  const scaleByH = availH / NR.PLAY_H;
  const rawScale = Math.min(scaleByW, scaleByH);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? Math.max(0.1, Math.min(rawScale, 6)) : 1;
  const playW = NR.PLAY_W * scale;
  const playH = NR.PLAY_H * scale;

  // ── Engine refs ──────────────────────────────────────────────────────────
  const stateRef = useRef<RunState | null>(null);
  const inputRef = useRef<InputState>(createInputState());
  const completedRef = useRef(false);
  const abortedRef = useRef(false);
  const lastHudBumpRef = useRef(0);
  const lastObsCountRef = useRef(0);
  const roundCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  /**
   * RN core `Animated.Value` + `setValue` from rAF — avoids Reanimated shared-value
   * teardown races that can hard-crash the app when the round ends and this screen unmounts.
   */
  const worldTxAnim = useRef(new Animated.Value(0)).current;
  const playerLAnim = useRef(new Animated.Value(0)).current;
  const playerTAnim = useRef(new Animated.Value(0)).current;
  const playerWAnim = useRef(new Animated.Value(NR.PLAYER_W)).current;
  const playerHAnim = useRef(new Animated.Value(NR.PLAYER_H)).current;
  /** Rotation in degrees (RN transform rotate string). */
  const playerDegAnim = useRef(new Animated.Value(0)).current;
  const playerRotate = useMemo(
    () =>
      playerDegAnim.interpolate({
        inputRange: [-72000, 72000],
        outputRange: ['-72000deg', '72000deg'],
      }),
    [playerDegAnim],
  );

  const [, setTick] = useState(0);
  const [engineOn, setEngineOn] = useState(true);
  /** Tear down spikes/SVG/Animated world before parent unmount — avoids native crash + freeze on death. */
  const [stripPlayfield, setStripPlayfield] = useState(false);

  if (stateRef.current === null) {
    stateRef.current = createRunState(seed);
    inputRef.current = createInputState();
  }

  const bump = useCallback(() => setTick((t) => t + 1), []);

  // ── RAF loop ─────────────────────────────────────────────────────────────
  const loop = useCallback(
    (totalDtMs: number) => {
      if (abortedRef.current) return;
      const s = stateRef.current;
      if (!s || s.phase !== 'playing' || completedRef.current) return;

      runFixedPhysicsSteps(totalDtMs, (h) => {
        if (!s || abortedRef.current) return false;
        stepRun(s, inputRef.current, h);
        return s.phase === 'playing';
      });

      const snap = stateRef.current!;
      const sc = scaleRef.current;
      const cx = camX(snap.player.worldX);
      worldTxAnim.setValue(safeDrive(-cx * sc));
      playerLAnim.setValue(safeDrive(snap.player.worldX * sc));
      playerTAnim.setValue(safeDrive(snap.player.y * sc));
      playerWAnim.setValue(safeDrive(NR.PLAYER_W * sc));
      playerHAnim.setValue(safeDrive(NR.PLAYER_H * sc));
      playerDegAnim.setValue(safeDrive((snap.player.angle * 180) / Math.PI));

      const ended = snap.phase === 'dead';
      const now = performance.now();
      const oc = snap.obstacles.length;
      const obsChanged = oc !== lastObsCountRef.current;
      if (obsChanged) lastObsCountRef.current = oc;
      if (ended || obsChanged || now - lastHudBumpRef.current >= HUD_BUMP_MIN_MS) {
        lastHudBumpRef.current = now;
        bump();
      }

      if (ended && !completedRef.current) {
        completedRef.current = true;
        setStripPlayfield(true);
        setEngineOn(false);
        const pts = safeNonNegInt(scoreFromState(snap));
        const dist = safeNonNegInt(snap.scroll);
        const dur = safeNonNegInt(Number.isFinite(snap.elapsed) ? snap.elapsed : 0);
        const jumps = safeNonNegInt(snap.jumpCount);
        if (roundCompleteTimerRef.current) clearTimeout(roundCompleteTimerRef.current);
        // Let React commit the stripped playfield (no SVG / wide world) before parent swaps to results — prevents landscape Modal/native teardown crashes.
        roundCompleteTimerRef.current = setTimeout(() => {
          roundCompleteTimerRef.current = null;
          if (abortedRef.current) return;
          try {
            onRoundComplete(pts, dist, dur, jumps);
          } catch (e) {
            if (__DEV__) console.warn('[DashDuelGame] onRoundComplete failed', e);
          }
        }, 72);
      }
    },
    [bump, onRoundComplete],
  );

  useRafLoop(loop, engineOn);

  useEffect(() => {
    if (roundCompleteTimerRef.current) {
      clearTimeout(roundCompleteTimerRef.current);
      roundCompleteTimerRef.current = null;
    }
    abortedRef.current = false;
    completedRef.current = false;
    lastHudBumpRef.current = 0;
    lastObsCountRef.current = 0;
    setStripPlayfield(false);
    stateRef.current = createRunState(seed);
    inputRef.current = createInputState();
    setEngineOn(true);
    bump();
  }, [seed, bump]);

  useEffect(
    () => () => {
      if (roundCompleteTimerRef.current) {
        clearTimeout(roundCompleteTimerRef.current);
        roundCompleteTimerRef.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (stripPlayfield) return;
    const st = stateRef.current;
    if (!st) return;
    const cx = camX(st.player.worldX);
    const sc = scale;
    worldTxAnim.setValue(safeDrive(-cx * sc));
    playerLAnim.setValue(safeDrive(st.player.worldX * sc));
    playerTAnim.setValue(safeDrive(st.player.y * sc));
    playerWAnim.setValue(safeDrive(NR.PLAYER_W * sc));
    playerHAnim.setValue(safeDrive(NR.PLAYER_H * sc));
    playerDegAnim.setValue(safeDrive((st.player.angle * 180) / Math.PI));
  }, [scale, seed, stripPlayfield]);

  // ── Render data ──────────────────────────────────────────────────────────
  const s = stateRef.current!;
  const cx = camX(s.player.worldX);
  const displayScore = safeNonNegInt(scoreFromState(s));
  const rivalDist = safeNonNegInt(s.scroll * 0.92);

  const visLeft = cx - 60;
  const visRight = cx + NR.PLAY_W + 80;
  const visibleObstacles: Obstacle[] = [];
  if (!stripPlayfield) {
    for (const o of s.obstacles) {
      if (o.x + o.w < visLeft || o.x > visRight) continue;
      visibleObstacles.push(o);
      if (visibleObstacles.length >= MAX_RENDERED_OBSTACLES) break;
    }
  }

  const obs = s.obstacles;
  const tailWorld =
    obs.length === 0
      ? NR.PLAY_W * 3
      : obs[obs.length - 1].x + obs[obs.length - 1].w + NR.TILE * 2;
  const worldUnits = Math.max(NR.PLAY_W * 3, tailWorld, s.player.worldX + NR.PLAY_W * 2);
  /** Failsafe: extremely wide native layer has crashed some devices after long runs. */
  const worldWpx = Math.min(worldUnits * scale, 28000);

  const onJumpIn = () => {
    inputRef.current.jumpPressedThisFrame = true;
    inputRef.current.jumpHeld = true;
  };
  const onJumpOut = () => {
    inputRef.current.jumpHeld = false;
  };

  const keyboardPlayActive = engineOn && !stripPlayfield;
  useWebGameKeyboard(keyboardPlayActive, {
    Space: (down) => {
      if (down) onJumpIn();
      else onJumpOut();
    },
    ArrowUp: (down) => {
      if (down) onJumpIn();
      else onJumpOut();
    },
  });

  const handleExit = useCallback(() => {
    abortedRef.current = true;
    if (roundCompleteTimerRef.current) {
      clearTimeout(roundCompleteTimerRef.current);
      roundCompleteTimerRef.current = null;
    }
    setEngineOn(false);
    onExit();
  }, [onExit]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* HUD */}
      <MemoHud
        distance={safeNonNegInt(s.scroll)}
        score={displayScore}
        practiceLabel={practiceLabel}
        prizeLabel={prizeLabel}
        onBack={handleExit}
        speedFrac={1}
        timeLeftMs={NR.ROUND_MS > 0 ? NR.ROUND_MS - s.elapsed : 0}
      />
      <MemoOpponentStrip
        p1Alive={!s.player.dead}
        p2Alive
        p1Dist={safeNonNegInt(s.scroll)}
        p2Dist={rivalDist}
        p1Flash={s.player.dead ? 1 : 0}
      />

      {/* Playfield — stripped to a plain box on death so unmount doesn’t tear down 100+ SVG nodes at once */}
      {stripPlayfield ? (
        <View
          style={[styles.fieldOuter, { width: playW, height: playH, backgroundColor: '#060f1e' }]}
          collapsable={false}
        />
      ) : (
        <View style={[styles.fieldOuter, { width: playW, height: playH }]} collapsable={false}>
          <Pressable style={StyleSheet.absoluteFill} onPressIn={onJumpIn} onPressOut={onJumpOut}>
            <View style={[styles.sky, { width: playW, height: playH }]} collapsable={false}>
              <MemoGridBg width={playW} height={playH} groundY={GROUND_Y * scale} />
              <Animated.View
                style={[
                  styles.world,
                  {
                    width: worldWpx,
                    height: playH,
                    transform: [{ translateX: worldTxAnim }],
                  },
                ]}
                collapsable={false}
              >
                <View
                  style={[
                    styles.ground,
                    {
                      top: GROUND_Y * scale,
                      height: (NR.PLAY_H - GROUND_Y) * scale,
                      width: worldWpx,
                    },
                  ]}
                />
                {visibleObstacles.map((o, idx) => (
                  <MemoObstacle key={`${obstacleStableKey(o)}#${idx}`} o={o} scale={scale} playH={playH} />
                ))}
                <Animated.View
                  style={[
                    styles.player,
                    {
                      left: playerLAnim,
                      top: playerTAnim,
                      width: playerWAnim,
                      height: playerHAnim,
                      transform: [{ rotate: playerRotate }],
                    },
                  ]}
                  collapsable={false}
                >
                  <View style={styles.playerInner} />
                </Animated.View>
              </Animated.View>
            </View>
          </Pressable>
        </View>
      )}

      {/* Hint */}
      <View style={[styles.hintBlock, { marginBottom: Math.max(4, insets.bottom) }]}>
        <Text style={styles.tapHint}>
          {Platform.OS === 'web' ? 'CLICK / SPACE / ↑ TO JUMP · HOLD TO CHAIN' : 'TAP TO JUMP · HOLD TO CHAIN'}
        </Text>
      </View>
    </View>
  );
}

// ─── Background Grid ──────────────────────────────────────────────────────────

const MemoGridBg = memo(function GridBg({
  width, height, groundY,
}: { width: number; height: number; groundY: number }) {
  const gridSize = 22;
  const vLines: ReactNode[] = [];
  const hLines: ReactNode[] = [];
  for (let x = 0; x <= width; x += gridSize) {
    vLines.push(
      <View key={`v${x}`} style={{ position: 'absolute', left: x, top: 0, width: 0.5, height: groundY, backgroundColor: 'rgba(56,189,248,0.06)' }} />
    );
  }
  for (let y = 0; y <= groundY; y += gridSize) {
    hLines.push(
      <View key={`h${y}`} style={{ position: 'absolute', left: 0, top: y, height: 0.5, width, backgroundColor: 'rgba(56,189,248,0.06)' }} />
    );
  }
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{vLines}{hLines}</View>;
});

// ─── Obstacle rendering ───────────────────────────────────────────────────────

type ObstacleProps = { o: Obstacle; scale: number; playH: number };

function SpikeView({
  left,
  top,
  w,
  h,
  pointingUp,
  gradientId,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  pointingUp: boolean;
  /** Must be unique per spike — duplicate SVG ids crash some native renderers after long runs. */
  gradientId: string;
}): ReactNode {
  const sw = Math.max(1.2, Math.min(w, h) * 0.1);
  const ins = Math.max(0.4, sw * 0.4);
  const points = pointingUp
    ? `${w / 2},${ins} ${w - ins},${h - ins} ${ins},${h - ins}`
    : `${w / 2},${h - ins} ${ins},${ins} ${w - ins},${ins}`;
  return (
    <View style={{ position: 'absolute', left, top, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pointingUp ? '#fef08a' : '#ff6b6b'} />
            <Stop offset="1" stopColor={pointingUp ? '#ca8a04' : '#b91c1c'} />
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={points}
          fill={`url(#${gradientId})`}
          stroke={pointingUp ? 'rgba(255,255,255,0.9)' : 'rgba(255,180,180,0.9)'}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const MemoObstacle = memo(function ObstacleView({ o, scale, playH }: ObstacleProps): ReactNode {
  const spikeGradientId = useId().replace(/:/g, '_');
  const left = o.x * scale;
  const w = Math.max(1, o.w * scale);
  const top = o.y * scale;
  const h = Math.max(1, o.h * scale);

  switch (o.kind) {
    case 'void':
      return (
        <View style={[styles.voidPit, {
          left,
          top: GROUND_Y * scale,
          width: w,
          height: Math.max(0, playH - GROUND_Y * scale),
        }]} />
      );

    case 'spike':
      return <SpikeView gradientId={spikeGradientId} left={left} top={top} w={w} h={h} pointingUp />;

    case 'ceilingSpike':
      return (
        <SpikeView gradientId={spikeGradientId} left={left} top={top} w={w} h={h} pointingUp={false} />
      );

    case 'wall':
      return (
        <View style={[styles.wall, { left, top, width: w, height: h }]}>
          <View style={[styles.wallTopStripe, { width: w }]} />
          {/* Vertical seam lines for taller blocks — GD aesthetic */}
          {h > w * 1.2 && (
            <View style={[styles.wallMidLine, { top: h * 0.45, width: w }]} />
          )}
        </View>
      );

    case 'crystal':
      return <View style={[styles.crystal, { left, top, width: w, height: h }]} />;

    case 'laser':
      return <View style={[styles.laser, { left, top, width: w, height: Math.max(4, h) }]} />;

    case 'ring': {
      const dim = Math.max(w, h);
      return (
        <View style={[styles.ring, {
          left: left + (w - dim) / 2,
          top: top + (h - dim) / 2,
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          opacity: o.used ? 0.2 : 1,
        }]} />
      );
    }

    default:
      return null;
  }
});

// ─── HUD wrappers ─────────────────────────────────────────────────────────────

const MemoHud = memo(function HudWrap(props: {
  distance: number; score: number; practiceLabel?: string; prizeLabel?: string;
  onBack: () => void; speedFrac: number; timeLeftMs: number;
}) {
  return (
    <DashDuelHud
      distance={props.distance}
      score={props.score}
      streak={0}
      practiceLabel={props.practiceLabel}
      prizeLabel={props.prizeLabel}
      onBack={props.onBack}
      timeLeftMs={props.timeLeftMs}
      hideClock={NR.ROUND_MS <= 0}
      compact
      speedFrac={props.speedFrac}
    />
  );
});

const MemoOpponentStrip = memo(function StripWrap(props: {
  p1Alive: boolean; p2Alive: boolean; p1Dist: number; p2Dist: number; p1Flash: number;
}) {
  return <DashDuelOpponentStrip {...props} compact />;
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldOuter: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(56,189,248,0.55)',
    borderRadius: 3,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 14,
  },
  sky: {
    backgroundColor: '#060f1e',
  },
  world: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  ground: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#0d2240',
    borderTopWidth: 2,
    borderTopColor: '#38bdf8',
  },
  voidPit: {
    position: 'absolute',
    backgroundColor: '#020617',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(239,68,68,0.6)',
  },
  // GD blocks: blue steel with bright top edge and glow border
  wall: {
    position: 'absolute',
    backgroundColor: '#1a4a72',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    overflow: 'hidden',
  },
  wallTopStripe: {
    height: 3,
    backgroundColor: 'rgba(186,230,253,0.8)',
  },
  wallMidLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(56,189,248,0.25)',
  },
  crystal: {
    position: 'absolute',
    backgroundColor: 'rgba(167,139,250,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.9)',
    borderRadius: 2,
  },
  laser: {
    position: 'absolute',
    backgroundColor: 'rgba(248,113,113,0.9)',
    borderRadius: 1,
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(163,230,53,0.95)',
    backgroundColor: 'transparent',
  },
  // GD player: cyan square, glowing, white inner diamond
  player: {
    position: 'absolute',
    backgroundColor: '#22d3ee',
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#e0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 7,
    elevation: 10,
  },
  playerInner: {
    width: '42%',
    height: '42%',
    backgroundColor: '#ffffff',
    borderRadius: 1,
    opacity: 0.9,
    transform: [{ rotate: '45deg' }],
  },
  hintBlock: {
    paddingTop: 5,
  },
  tapHint: {
    color: 'rgba(148,163,184,0.7)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
});

export default DashDuelGame;