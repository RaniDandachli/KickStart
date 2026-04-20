// ─── NEON RUNNER — Game Screen ─────────────────────────────────────────────
// Zone-themed visuals: each tier range shifts the entire color palette,
// mimicking the "level progression" feel of Geometry Dash.
// Parallax backgrounds, player trail, land particles, and zone flash.

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
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Polygon, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GROUND_Y, NR, ZONE_THEMES, getZoneTheme, type ZoneTheme } from '@/minigames/dashduel/constants';
import { DashDuelHud } from '@/minigames/dashduel/DashDuelHud';
import { DashDuelOpponentStrip } from '@/minigames/dashduel/DashDuelOpponentStrip';
import {
  createInputState,
  createRunState,
  scoreFromState,
  stepRun,
  type InputState,
} from '@/minigames/dashduel/engine';
import type { Obstacle, Particle, RunState } from '@/minigames/dashduel/types';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';

type Props = {
  seed: number;
  practiceLabel?: string;
  prizeLabel?: string;
  onExit: () => void;
  onRoundComplete: (
    finalScore: number,
    distance: number,
    durationMs: number,
    jumpCount: number,
  ) => void;
};

function camX(playerWorldX: number): number {
  return playerWorldX - NR.PLAY_W * NR.PLAYER_SCREEN_X_RATIO;
}

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
const MAX_RENDERED_OBSTACLES = 96;
const PARALLAX_FAR_SPEED = 0.12;   // scrolls at 12% of world speed
const PARALLAX_NEAR_SPEED = 0.35;  // scrolls at 35% of world speed

// ── Particle helpers ──────────────────────────────────────────────────────

function spawnLandParticles(
  particles: Particle[],
  worldX: number,
  y: number,
  theme: ZoneTheme,
): void {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * (i / (count - 1)));
    const speed = 0.8 + Math.random() * 1.4;
    particles.push({
      x: worldX + NR.PLAYER_W / 2,
      y: y + NR.PLAYER_H,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle)) * speed * 0.8,
      life: 220 + Math.random() * 80,
      maxLife: 300,
      radius: 1.5 + Math.random() * 1.5,
      color: theme.playerFill,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function DashDuelGame({ seed, practiceLabel, prizeLabel, onExit, onRoundComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const lw = Math.max(sw, sh);
  const lh = Math.min(sw, sh);
  const insets = useSafeAreaInsets();

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

  // Particles live outside React state for perf — rendered via canvas-style View list
  const particlesRef = useRef<Particle[]>([]);

  // Zone flash state
  const zoneFlashRef = useRef(0); // ms remaining
  const [zoneFlashActive, setZoneFlashActive] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ZoneTheme>(ZONE_THEMES[0]);

  const worldTxAnim = useRef(new Animated.Value(0)).current;
  const playerLAnim = useRef(new Animated.Value(0)).current;
  const playerTAnim = useRef(new Animated.Value(0)).current;
  const playerWAnim = useRef(new Animated.Value(NR.PLAYER_W)).current;
  const playerHAnim = useRef(new Animated.Value(NR.PLAYER_H)).current;
  const playerDegAnim = useRef(new Animated.Value(0)).current;

  // Parallax scroll animated values — driven from scroll
  const parFarTxAnim = useRef(new Animated.Value(0)).current;
  const parNearTxAnim = useRef(new Animated.Value(0)).current;

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

      // Parallax: offset moves opposite to scroll (slower than world)
      const farOff = -(snap.scroll * PARALLAX_FAR_SPEED * sc) % (NR.PLAY_W * sc * 2);
      const nearOff = -(snap.scroll * PARALLAX_NEAR_SPEED * sc) % (NR.PLAY_W * sc * 2);
      parFarTxAnim.setValue(safeDrive(farOff));
      parNearTxAnim.setValue(safeDrive(nearOff));

      // Particles
      const theme = getZoneTheme(snap.tier);
      if (snap.player.justLanded) {
        spawnLandParticles(particlesRef.current, snap.player.worldX, snap.player.y, theme);
      }
      // Advance + cull particles
      for (const p of particlesRef.current) {
        p.x += p.vx * (totalDtMs / 16);
        p.y += p.vy * (totalDtMs / 16);
        p.vy += 0.08 * (totalDtMs / 16);
        p.life -= totalDtMs;
      }
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // Zone flash
      if (snap.zoneChanged) {
        zoneFlashRef.current = 280;
        setCurrentTheme(theme);
        setZoneFlashActive(true);
      }
      if (zoneFlashRef.current > 0) {
        zoneFlashRef.current -= totalDtMs;
        if (zoneFlashRef.current <= 0) setZoneFlashActive(false);
      }

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
    particlesRef.current = [];
    setStripPlayfield(false);
    setCurrentTheme(ZONE_THEMES[0]);
    setZoneFlashActive(false);
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
  const theme = getZoneTheme(s.tier);

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

  // Visible particles (convert world→screen)
  const visParticles = stripPlayfield
    ? []
    : particlesRef.current.filter((p) => p.x > cx - 10 && p.x < cx + NR.PLAY_W + 10);

  // Visible trail points
  const trailPoints = stripPlayfield ? [] : s.player.trail;

  const obs = s.obstacles;
  const tailWorld =
    obs.length === 0
      ? NR.PLAY_W * 3
      : obs[obs.length - 1]!.x + obs[obs.length - 1]!.w + NR.TILE * 2;
  const worldUnits = Math.max(NR.PLAY_W * 3, tailWorld, s.player.worldX + NR.PLAY_W * 2);
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
    Space: (down) => { if (down) onJumpIn(); else onJumpOut(); },
    ArrowUp: (down) => { if (down) onJumpIn(); else onJumpOut(); },
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

  // Zone name display (show for ~2s after zone change)
  const [zoneLabel, setZoneLabel] = useState('');
  const zoneLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!zoneFlashActive) return;
    setZoneLabel(currentTheme.name);
    if (zoneLabelTimerRef.current) clearTimeout(zoneLabelTimerRef.current);
    zoneLabelTimerRef.current = setTimeout(() => setZoneLabel(''), 2000);
  }, [zoneFlashActive, currentTheme]);
  useEffect(() => () => { if (zoneLabelTimerRef.current) clearTimeout(zoneLabelTimerRef.current); }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.sky }]}>
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

      {stripPlayfield ? (
        <View
          style={[styles.fieldOuter, { width: playW, height: playH, backgroundColor: theme.sky, borderColor: theme.groundLine + '88' }]}
          collapsable={false}
        />
      ) : (
        <View
          style={[
            styles.fieldOuter,
            {
              width: playW,
              height: playH,
              borderColor: theme.groundLine + '99',
              shadowColor: theme.playerGlow,
            },
          ]}
          collapsable={false}
        >
          <Pressable style={StyleSheet.absoluteFill} onPressIn={onJumpIn} onPressOut={onJumpOut}>
            {/* Sky background */}
            <View style={[styles.sky, { width: playW, height: playH, backgroundColor: theme.sky }]} collapsable={false}>

              {/* Parallax layer FAR — slow geometric shapes */}
              <Animated.View
                style={[styles.parallaxLayer, { transform: [{ translateX: parFarTxAnim }] }]}
                pointerEvents="none"
              >
                <MemoParallaxFar theme={theme} width={playW * 2.2} height={playH} />
              </Animated.View>

              {/* Parallax layer NEAR — faster silhouettes */}
              <Animated.View
                style={[styles.parallaxLayer, { transform: [{ translateX: parNearTxAnim }] }]}
                pointerEvents="none"
              >
                <MemoParallaxNear theme={theme} width={playW * 2.2} height={playH} groundY={GROUND_Y * scale} />
              </Animated.View>

              {/* Grid */}
              <MemoGridBg width={playW} height={playH} groundY={GROUND_Y * scale} color={theme.gridLine} />

              {/* Zone flash overlay */}
              {zoneFlashActive && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: theme.groundLine, opacity: 0.12, borderRadius: 2 },
                  ]}
                  pointerEvents="none"
                />
              )}

              {/* Zone label */}
              {zoneLabel !== '' && (
                <View style={styles.zoneLabelWrap} pointerEvents="none">
                  <Text style={[styles.zoneLabel, { color: theme.groundLine }]}>{zoneLabel}</Text>
                </View>
              )}

              {/* World layer */}
              <Animated.View
                style={[
                  styles.world,
                  { width: worldWpx, height: playH, transform: [{ translateX: worldTxAnim }] },
                ]}
                collapsable={false}
              >
                {/* Ground */}
                <View
                  style={[
                    styles.ground,
                    {
                      top: GROUND_Y * scale,
                      height: (NR.PLAY_H - GROUND_Y) * scale,
                      width: worldWpx,
                      backgroundColor: theme.ground,
                      borderTopColor: theme.groundLine,
                    },
                  ]}
                />

                {/* Trail */}
                {trailPoints.map((tp, i) => {
                  const opacity = (1 - tp.age / 120) * 0.55 * (i / Math.max(trailPoints.length - 1, 1));
                  if (opacity < 0.04) return null;
                  const sz = Math.max(2, (NR.PLAYER_W * scale * 0.55) * (i / Math.max(trailPoints.length - 1, 1)));
                  return (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: tp.x * scale - sz / 2,
                        top: tp.y * scale - sz / 2,
                        width: sz,
                        height: sz,
                        borderRadius: sz / 2,
                        backgroundColor: theme.playerFill,
                        opacity,
                      }}
                    />
                  );
                })}

                {/* Particles */}
                {visParticles.map((p, i) => {
                  const opacity = Math.max(0, p.life / p.maxLife) * 0.9;
                  const sz = Math.max(1, p.radius * scale);
                  return (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: p.x * scale - sz / 2,
                        top: p.y * scale - sz / 2,
                        width: sz,
                        height: sz,
                        borderRadius: sz / 2,
                        backgroundColor: p.color,
                        opacity,
                      }}
                    />
                  );
                })}

                {/* Obstacles */}
                {visibleObstacles.map((o, idx) => (
                  <MemoObstacle
                    key={`${obstacleStableKey(o)}#${idx}`}
                    o={o}
                    scale={scale}
                    playH={playH}
                    theme={theme}
                  />
                ))}

                {/* Player */}
                <Animated.View
                  style={[
                    styles.player,
                    {
                      left: playerLAnim,
                      top: playerTAnim,
                      width: playerWAnim,
                      height: playerHAnim,
                      backgroundColor: theme.playerFill,
                      borderColor: theme.playerBorder,
                      shadowColor: theme.playerGlow,
                      transform: [{ rotate: playerRotate }],
                    },
                  ]}
                  collapsable={false}
                >
                  <View style={[styles.playerInner, { backgroundColor: theme.playerInner }]} />
                </Animated.View>
              </Animated.View>
            </View>
          </Pressable>
        </View>
      )}

      {/* Hint */}
      <View style={[styles.hintBlock, { marginBottom: Math.max(4, insets.bottom) }]}>
        <Text style={[styles.tapHint, { color: theme.groundLine + 'aa' }]}>
          {Platform.OS === 'web'
            ? 'CLICK / SPACE / ↑ TO JUMP · HOLD TO CHAIN'
            : 'TAP TO JUMP · HOLD TO CHAIN JUMPS'}
        </Text>
      </View>
    </View>
  );
}

// ─── Parallax Backgrounds ─────────────────────────────────────────────────────

const MemoParallaxFar = memo(function ParallaxFar({
  theme,
  width,
  height,
}: {
  theme: ZoneTheme;
  width: number;
  height: number;
}) {
  // Distant geometric silhouettes — repeat to allow infinite scroll
  const shapes: ReactNode[] = [];
  const count = 10;
  const skyH = height * 0.72;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * width;
    const h = skyH * (0.2 + ((i * 7 + 3) % 10) / 10 * 0.35);
    const w = width / count * 0.55;
    shapes.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: skyH - h,
          width: w,
          height: h,
          backgroundColor: theme.parallaxColor,
        }}
      />,
    );
  }
  return <View style={{ width, height, position: 'relative' }}>{shapes}</View>;
});

const MemoParallaxNear = memo(function ParallaxNear({
  theme,
  width,
  height,
  groundY,
}: {
  theme: ZoneTheme;
  width: number;
  height: number;
  groundY: number;
}) {
  // Closer, taller silhouettes just above the ground plane
  const shapes: ReactNode[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * width;
    const h = (groundY * 0.18) + ((i * 13 + 5) % 7) * (groundY * 0.05);
    const w = width / count * 0.65;
    shapes.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: groundY - h,
          width: w,
          height: h,
          backgroundColor: theme.parallaxColor,
          opacity: 1.8,
        }}
      />,
    );
  }
  return <View style={{ width, height, position: 'relative' }}>{shapes}</View>;
});

// ─── Background Grid ──────────────────────────────────────────────────────────

const MemoGridBg = memo(function GridBg({
  width,
  height,
  groundY,
  color,
}: {
  width: number;
  height: number;
  groundY: number;
  color: string;
}) {
  const gridSize = 22;
  const vLines: ReactNode[] = [];
  const hLines: ReactNode[] = [];
  for (let x = 0; x <= width; x += gridSize) {
    vLines.push(
      <View
        key={`v${x}`}
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          width: 0.5,
          height: groundY,
          backgroundColor: color,
        }}
      />,
    );
  }
  for (let y = 0; y <= groundY; y += gridSize) {
    hLines.push(
      <View
        key={`h${y}`}
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          height: 0.5,
          width,
          backgroundColor: color,
        }}
      />,
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {vLines}
      {hLines}
    </View>
  );
});

// ─── Obstacle rendering ───────────────────────────────────────────────────────

type ObstacleProps = { o: Obstacle; scale: number; playH: number; theme: ZoneTheme };

function SpikeView({
  left,
  top,
  w,
  h,
  pointingUp,
  gradientId,
  fill0,
  fill1,
  stroke,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  pointingUp: boolean;
  gradientId: string;
  fill0: string;
  fill1: string;
  stroke: string;
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
            <Stop offset="0" stopColor={fill0} />
            <Stop offset="1" stopColor={fill1} />
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={points}
          fill={`url(#${gradientId})`}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const MemoObstacle = memo(function ObstacleView({ o, scale, playH, theme }: ObstacleProps): ReactNode {
  const spikeGradientId = useId().replace(/:/g, '_');
  const left = o.x * scale;
  const w = Math.max(1, o.w * scale);
  const top = o.y * scale;
  const h = Math.max(1, o.h * scale);

  switch (o.kind) {
    case 'void':
      return (
        <View
          style={[
            styles.voidPit,
            {
              left,
              top: GROUND_Y * scale,
              width: w,
              height: Math.max(0, playH - GROUND_Y * scale),
              backgroundColor: theme.voidFill,
              borderTopColor: theme.voidLine,
            },
          ]}
        />
      );

    case 'spike':
      return (
        <SpikeView
          gradientId={spikeGradientId}
          left={left}
          top={top}
          w={w}
          h={h}
          pointingUp
          fill0={theme.spikeFill0}
          fill1={theme.spikeFill1}
          stroke={theme.spikeStroke}
        />
      );

    case 'ceilingSpike':
      return (
        <SpikeView
          gradientId={spikeGradientId}
          left={left}
          top={top}
          w={w}
          h={h}
          pointingUp={false}
          fill0={theme.spikeFill1}
          fill1={theme.spikeFill0}
          stroke={theme.spikeStroke}
        />
      );

    case 'wall':
      return (
        <View
          style={[
            styles.wall,
            {
              left,
              top,
              width: w,
              height: h,
              backgroundColor: theme.wallFill,
              borderColor: theme.wallBorder,
            },
          ]}
        >
          <View style={[styles.wallTopStripe, { width: w, backgroundColor: theme.wallStripe }]} />
          {h > w * 1.2 && (
            <View
              style={[
                styles.wallMidLine,
                { top: h * 0.45, width: w, backgroundColor: theme.wallBorder + '40' },
              ]}
            />
          )}
        </View>
      );

    case 'ring': {
      const dim = Math.max(w, h);
      return (
        <View
          style={[
            styles.ring,
            {
              left: left + (w - dim) / 2,
              top: top + (h - dim) / 2,
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              borderColor: theme.ringBorder,
              opacity: o.used ? 0.15 : 1,
            },
          ]}
        />
      );
    }

    case 'crystal':
      return (
        <View
          style={[
            styles.crystal,
            {
              left,
              top,
              width: w,
              height: h,
              backgroundColor: theme.spikeFill0 + 'e0',
              borderColor: theme.spikeFill0,
            },
          ]}
        />
      );

    case 'laser':
      return (
        <View
          style={[
            styles.laser,
            {
              left,
              top,
              width: w,
              height: Math.max(4, h),
              backgroundColor: theme.spikeFill1 + 'e8',
            },
          ]}
        />
      );

    default:
      return null;
  }
});

// ─── HUD wrappers ─────────────────────────────────────────────────────────────

const MemoHud = memo(function HudWrap(props: {
  distance: number;
  score: number;
  practiceLabel?: string;
  prizeLabel?: string;
  onBack: () => void;
  speedFrac: number;
  timeLeftMs: number;
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
  p1Alive: boolean;
  p2Alive: boolean;
  p1Dist: number;
  p2Dist: number;
  p1Flash: number;
}) {
  return <DashDuelOpponentStrip {...props} compact />;
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldOuter: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 14,
  },
  sky: {
    overflow: 'hidden',
  },
  parallaxLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  world: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  ground: {
    position: 'absolute',
    left: 0,
    borderTopWidth: 2,
  },
  voidPit: {
    position: 'absolute',
    borderTopWidth: 1.5,
  },
  wall: {
    position: 'absolute',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  wallTopStripe: {
    height: 3,
  },
  wallMidLine: {
    position: 'absolute',
    height: 1,
  },
  crystal: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 2,
  },
  laser: {
    position: 'absolute',
    borderRadius: 1,
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  player: {
    position: 'absolute',
    borderRadius: 2,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 10,
  },
  playerInner: {
    width: '40%',
    height: '40%',
    borderRadius: 1,
    opacity: 0.88,
    transform: [{ rotate: '45deg' }],
  },
  hintBlock: {
    paddingTop: 5,
  },
  tapHint: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  zoneLabelWrap: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  zoneLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    opacity: 0.82,
  },
});

export default DashDuelGame;