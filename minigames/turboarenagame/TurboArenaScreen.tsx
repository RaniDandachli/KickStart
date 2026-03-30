// ─────────────────────────────────────────────
//  TurboArenaScreen.tsx  –  vs-AI + local-2P match screen
//  Mirrors TapDashScreen.tsx conventions exactly
// ─────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { useRafLoop } from '@/minigames/core/useRafLoop';
import { Countdown } from '@/minigames/ui/Countdown';
import { MiniGameHUD } from '@/minigames/ui/MiniGameHUD';
import { MiniResultsModal } from '@/minigames/ui/MiniResultsModal';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import {
    AiDifficulty,
    createTurboArenaState,
    stepTurboArena,
    TURBO,
    type TurboArenaState,
    type TurboInputs,
} from './TurboArenaEngine';

// ── Scaling helpers ───────────────────────────

function useArenaScale(sw: number, sh: number) {
  const maxW = Math.min(sw - 16, 680);
  const scale = maxW / TURBO.worldW;
  const arenaW = TURBO.worldW * scale;
  const arenaH = TURBO.worldH * scale;
  return { scale, arenaW, arenaH };
}

// ── Arena view ────────────────────────────────

function ArenaView({
  state,
  scale,
  arenaW,
  arenaH,
  frameCount,
}: {
  state: TurboArenaState;
  scale: number;
  arenaW: number;
  arenaH: number;
  frameCount: number;
}) {
  const { player, cpu, ball } = state;
  const groundY = TURBO.groundY * scale;
  const goalH = TURBO.goalH * scale;
  const goalW = TURBO.goalW * scale;
  const goalY = TURBO.goalY * scale;
  const carW = TURBO.carW * scale;
  const carH = TURBO.carH * scale;
  const ballR = TURBO.ballR * scale;

  return (
    <View style={[styles.arena, { width: arenaW, height: arenaH }]}>
      {/* Sky background */}
      <LinearGradient
        colors={['#02001a', '#0a0030', '#1a0040']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Retro perspective grid */}
      <RetroGrid arenaW={arenaW} groundY={groundY} arenaH={arenaH} />

      {/* Ground */}
      <View
        style={[
          styles.ground,
          { top: groundY, width: arenaW, height: arenaH - groundY },
        ]}
      />
      {/* Neon ground line */}
      <View style={[styles.groundLine, { top: groundY, width: arenaW }]} />

      {/* Goals */}
      <GoalView side="left" goalW={goalW} goalH={goalH} goalY={goalY} arenaH={arenaH} />
      <GoalView side="right" goalW={goalW} goalH={goalH} goalY={goalY} arenaW={arenaW} arenaH={arenaH} />

      {/* Center line */}
      <View style={[styles.centerLine, { left: arenaW / 2, height: groundY }]} />

      {/* Particles */}
      {state.particles.map((p, i) => (
        <View
          key={i}
          style={[
            styles.particle,
            {
              left: p.x * scale - p.r,
              top: p.y * scale - p.r,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: p.r,
              backgroundColor: p.color,
              opacity: p.life,
              shadowColor: p.glow ? p.color : undefined,
              shadowOpacity: p.glow ? 0.9 : 0,
              shadowRadius: p.glow ? 6 : 0,
            },
          ]}
        />
      ))}

      {/* Ball trail */}
      {ball.trail.map((pt, i) => {
        const a = (i / ball.trail.length) * 0.25;
        const s = ballR * (i / ball.trail.length) * 0.7;
        return (
          <View
            key={`bt${i}`}
            style={[
              styles.ballTrail,
              {
                left: pt.x * scale - s,
                top: pt.y * scale - s,
                width: s * 2,
                height: s * 2,
                borderRadius: s,
                opacity: a,
              },
            ]}
          />
        );
      })}

      {/* Ball */}
      <View
        style={[
          styles.ballOuter,
          {
            left: ball.x * scale - ballR,
            top: ball.y * scale - ballR,
            width: ballR * 2,
            height: ballR * 2,
            borderRadius: ballR,
          },
        ]}
      >
        <LinearGradient
          colors={['#eeffff', '#88ccff', '#003388']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: ballR }]}
        />
        {/* Shine */}
        <View
          style={[
            styles.ballShine,
            {
              width: ballR * 0.5,
              height: ballR * 0.4,
              borderRadius: ballR * 0.25,
              top: ballR * 0.2,
              left: ballR * 0.2,
            },
          ]}
        />
      </View>

      {/* Player car */}
      <CarView car={player} scale={scale} carW={carW} carH={carH} isPlayer />
      {/* CPU car */}
      <CarView car={cpu} scale={scale} carW={carW} carH={carH} isPlayer={false} />

      {/* Goal flash overlay */}
      {state.goalFlash ? (
        <View style={[StyleSheet.absoluteFill, styles.goalFlashOverlay]}>
          <Text style={styles.goalFlashText}>GOAL!</Text>
          <Text style={styles.goalFlashSub}>
            {state.goalFlash.scorer === 1 ? 'ORANGE' : 'CYAN'} scores
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RetroGrid({
  arenaW,
  groundY,
  arenaH,
}: {
  arenaW: number;
  groundY: number;
  arenaH: number;
}) {
  const vanishX = arenaW / 2;
  const vanishY = groundY * 0.55;
  const cols = 12;
  const rows = 7;

  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      pointerEvents="none"
    >
      {/* Floor gradient */}
      <LinearGradient
        colors={['#10003a', '#06001a']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: vanishY,
          left: 0,
          right: 0,
          height: groundY - vanishY,
        }}
      />
      {/* Perspective lines approximated as thin Views */}
      {Array.from({ length: cols + 1 }, (_, i) => {
        const bx = (arenaW / cols) * i;
        const angle = Math.atan2(bx - vanishX, groundY - vanishY);
        const len = Math.sqrt(
          Math.pow(bx - vanishX, 2) + Math.pow(groundY - vanishY, 2),
        );
        return (
          <View
            key={`vg${i}`}
            style={{
              position: 'absolute',
              left: vanishX,
              top: vanishY,
              width: 1,
              height: len,
              backgroundColor: 'rgba(180,0,255,0.18)',
              transformOrigin: 'top',
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        );
      })}
      {/* Horizontal lines */}
      {Array.from({ length: rows }, (_, j) => {
        const t = (j + 1) / rows;
        const ly = vanishY + (groundY - vanishY) * t;
        const lw = arenaW * t;
        return (
          <View
            key={`hg${j}`}
            style={{
              position: 'absolute',
              left: vanishX - lw / 2,
              top: ly,
              width: lw,
              height: 1,
              backgroundColor: 'rgba(180,0,255,0.18)',
            }}
          />
        );
      })}
    </View>
  );
}

function GoalView({
  side,
  goalW,
  goalH,
  goalY,
  arenaW,
  arenaH,
}: {
  side: 'left' | 'right';
  goalW: number;
  goalH: number;
  goalY: number;
  arenaW?: number;
  arenaH: number;
}) {
  const isLeft = side === 'left';
  const color = isLeft ? '#ff6600' : '#0088ff';
  return (
    <View
      style={[
        styles.goal,
        {
          left: isLeft ? 0 : (arenaW ?? 0) - goalW,
          top: goalY,
          width: goalW,
          height: goalH,
          borderColor: color,
          shadowColor: color,
          backgroundColor: isLeft
            ? 'rgba(255,102,0,0.12)'
            : 'rgba(0,136,255,0.12)',
        },
      ]}
    />
  );
}

function CarView({
  car,
  scale,
  carW,
  carH,
  isPlayer,
}: {
  car: import('./TurboArenaEngine').Car;
  scale: number;
  carW: number;
  carH: number;
  isPlayer: boolean;
}) {
  const color = isPlayer ? '#ff6600' : '#0088ff';
  const accent = isPlayer ? '#ffcc00' : '#00ffff';
  const wheelR = carH * 0.28;

  return (
    <View
      style={[
        styles.carWrap,
        {
          left: car.x * scale,
          top: car.y * scale,
          width: carW,
          height: carH,
          transform: car.flipped ? [{ scaleX: -1 }] : [],
        },
      ]}
    >
      {/* Boost flame */}
      {car.isBoosting && (
        <LinearGradient
          colors={[isPlayer ? '#ffdd00' : '#00aaff', 'transparent']}
          start={{ x: 1, y: 0.5 }}
          end={{ x: 0, y: 0.5 }}
          style={[
            styles.boostFlame,
            { width: carW * 0.55, height: carH * 0.35 },
          ]}
        />
      )}
      {/* Body */}
      <LinearGradient
        colors={[accent, color, '#111111']}
        locations={[0, 0.4, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.carBody, { borderRadius: carH * 0.18, shadowColor: color }]}
      >
        {/* Windshield */}
        <View
          style={[
            styles.windshield,
            {
              width: carW * 0.38,
              height: carH * 0.42,
              top: carH * 0.06,
              right: carW * 0.1,
              borderRadius: carH * 0.1,
            },
          ]}
        />
        {/* Stripe */}
        <View
          style={[
            styles.stripe,
            {
              backgroundColor: accent,
              top: carH * 0.6,
              height: carH * 0.1,
            },
          ]}
        />
      </LinearGradient>
      {/* Wheels */}
      {[carW * 0.22, carW * 0.78].map((wx, i) => (
        <View
          key={i}
          style={[
            styles.wheel,
            {
              left: wx - wheelR,
              top: carH - wheelR * 0.8,
              width: wheelR * 2,
              height: wheelR * 2,
              borderRadius: wheelR,
              borderColor: accent,
              shadowColor: accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── D-pad controls ────────────────────────────

function DPad({
  inputsRef,
}: {
  inputsRef: MutableRefObject<TurboInputs>;
}) {
  const setKey = (key: keyof TurboInputs, val: boolean) => {
    if (key === 'jump' && val && !inputsRef.current.jump) {
      // Leading-edge only for jump
      inputsRef.current = { ...inputsRef.current, jump: true };
      setTimeout(() => {
        inputsRef.current = { ...inputsRef.current, jump: false };
      }, 80);
    } else if (key !== 'jump') {
      inputsRef.current = { ...inputsRef.current, [key]: val };
    }
  };

  return (
    <View style={styles.dpad}>
      {/* Left */}
      <Pressable
        style={styles.dpadBtn}
        onPressIn={() => setKey('left', true)}
        onPressOut={() => setKey('left', false)}
      >
        <Text style={styles.dpadIcon}>◀</Text>
      </Pressable>

      {/* Jump */}
      <Pressable
        style={[styles.dpadBtn, styles.jumpBtn]}
        onPressIn={() => setKey('jump', true)}
      >
        <Text style={[styles.dpadIcon, { color: '#ffff00', fontSize: 13 }]}>JUMP</Text>
      </Pressable>

      {/* Right */}
      <Pressable
        style={styles.dpadBtn}
        onPressIn={() => setKey('right', true)}
        onPressOut={() => setKey('right', false)}
      >
        <Text style={styles.dpadIcon}>▶</Text>
      </Pressable>

      {/* Boost */}
      <Pressable
        style={[styles.dpadBtn, styles.boostBtn]}
        onPressIn={() => setKey('boost', true)}
        onPressOut={() => setKey('boost', false)}
      >
        <Text style={[styles.dpadIcon, { color: '#ff00cc', fontSize: 11 }]}>BOOST</Text>
      </Pressable>
    </View>
  );
}

function KickBtn({
  inputsRef,
}: {
  inputsRef: MutableRefObject<TurboInputs>;
}) {
  return (
    <Pressable
      style={styles.kickBtn}
      onPressIn={() => {
        inputsRef.current = { ...inputsRef.current, kick: true };
        setTimeout(() => {
          inputsRef.current = { ...inputsRef.current, kick: false };
        }, 80);
      }}
    >
      <Text style={styles.kickText}>⚡ KICK</Text>
    </Pressable>
  );
}

// ── Boost bar ──────────────────────────────────

function BoostBar({ boost }: { boost: number }) {
  return (
    <View style={styles.boostBarWrap}>
      <Text style={styles.boostLabel}>BOOST</Text>
      <View style={styles.boostTrack}>
        <View style={[styles.boostFill, { width: `${boost * 100}%` }]} />
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────

export type TurboArenaPlayMode = 'practice' | 'prize';

type Props = { playMode?: TurboArenaPlayMode };

export default function TurboArenaScreen({ playMode = 'practice' }: Props) {
  useHidePlayTabBar();
  const router = useRouter();
  const { width: sw, height: sh } = useWindowDimensions();
  const { scale, arenaW, arenaH } = useArenaScale(sw, sh);

  const [phase, setPhase] = useState<'intro' | 'countdown' | 'playing' | 'done'>('intro');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [, setUiTick] = useState(0);
  const stateRef = useRef<TurboArenaState | null>(null);

  const p1InputsRef = useRef<TurboInputs>({
    left: false,
    right: false,
    jump: false,
    boost: false,
    kick: false,
  });

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const startRun = useCallback(() => {
    stateRef.current = createTurboArenaState();
    setPhase('countdown');
    bump();
  }, [bump]);

  const onCountdownDone = useCallback(() => {
    setPhase('playing');
  }, []);

  const loop = useCallback(
    (dtMs: number) => {
      const s = stateRef.current;
      if (!s) return;

      stepTurboArena(s, dtMs, p1InputsRef.current, difficulty);

      if (s.timeLeftMs <= 0) {
        setPhase('done');
      }
      bump();
    },
    [bump, difficulty],
  );

  useRafLoop(loop, phase === 'playing');

  const snap = stateRef.current;

  const winnerTitle =
    snap && phase === 'done'
      ? snap.scoreP1 > snap.scoreP2
        ? 'You win!'
        : snap.scoreP2 > snap.scoreP1
          ? 'CPU wins!'
          : 'Draw!'
      : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#22d3ee" />
          </Pressable>
          <Text style={styles.topBarTitle}>Turbo Arena</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>

        {/* ── Intro ── */}
        {phase === 'intro' ? (
          <View style={styles.intro}>
            <LinearGradient
              colors={['#02001a', '#0a0030', '#1a0040']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.introTitle}>TURBO ARENA</Text>
            <Text style={styles.introSub}>RETRO ROCKET SOCCER</Text>
            {playMode === 'prize' ? (
              <Text style={styles.prizeHint}>Prize run — uses prize credits like other arcade games</Text>
            ) : null}

            <View style={styles.modeRow}>
              {(['easy', 'medium', 'hard'] as AiDifficulty[]).map((d) => (
                <Pressable
                  key={d}
                  style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]}
                  onPress={() => setDifficulty(d)}
                >
                  <Text style={[styles.diffBtnText, difficulty === d && styles.diffBtnTextActive]}>
                    {d.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <AppButton title="▶  PLAY" onPress={startRun} />
            <Text style={styles.introHint}>
              Drive · jump · boost · kick the ball into the opponent&apos;s goal
            </Text>
          </View>
        ) : null}

        {/* ── Game HUD + Arena ── */}
        {(phase === 'countdown' || phase === 'playing' || phase === 'done') && snap ? (
          <>
            <MiniGameHUD
              timeLeftMs={snap.timeLeftMs}
              scoreP1={snap.scoreP1}
              scoreP2={snap.scoreP2}
              labelP1="Orange"
              labelP2="Cyan"
              subtitle="Turbo Arena · 2 min"
            />

            <View style={styles.arenaWrap}>
              <ArenaView state={snap} scale={scale} arenaW={arenaW} arenaH={arenaH} />
            </View>

            {/* Controls */}
            {phase === 'playing' && (
              <View style={styles.controlsRow}>
                <DPad inputsRef={p1InputsRef} />
                <BoostBar boost={snap.player.boost} />
                <KickBtn inputsRef={p1InputsRef} />
              </View>
            )}
          </>
        ) : null}

        <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

        <MiniResultsModal
          visible={phase === 'done' && !!snap}
          title={winnerTitle}
          scoreP1={snap?.scoreP1 ?? 0}
          scoreP2={snap?.scoreP2 ?? 0}
          onRematch={startRun}
          onMenu={() => setPhase('intro')}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────

const CYAN = '#00ffff';
const PINK = '#ff00cc';
const ORANGE = '#ff6600';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#02001a' },
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 6,
    zIndex: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: { width: 44, height: 44 },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(226,232,240,0.85)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  prizeHint: {
    fontSize: 11,
    color: 'rgba(250,204,21,0.9)',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },

  // Intro
  intro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },
  introTitle: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 6,
    color: CYAN,
    textShadowColor: CYAN,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  introSub: {
    fontSize: 11,
    letterSpacing: 5,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '700',
  },
  introHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  diffBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.15)',
  },
  diffBtnActive: { borderColor: CYAN, backgroundColor: 'rgba(0,255,255,0.08)' },
  diffBtnText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  diffBtnTextActive: { color: CYAN },

  // Arena
  arenaWrap: { alignItems: 'center', paddingTop: 6 },
  arena: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0,255,255,0.3)',
    shadowColor: CYAN,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  ground: {
    position: 'absolute',
    backgroundColor: '#06001a',
  },
  groundLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#cc00ff',
    shadowColor: '#cc00ff',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  goal: {
    position: 'absolute',
    borderWidth: 2,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 4,
    borderRadius: 2,
  },
  centerLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(0,255,255,0.1)',
  },
  particle: { position: 'absolute', elevation: 5 },
  ballTrail: { position: 'absolute', backgroundColor: '#aaffff' },
  ballOuter: {
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: '#aaffff',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  ballShine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  carWrap: { position: 'absolute' },
  carBody: {
    flex: 1,
    overflow: 'hidden',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  windshield: {
    position: 'absolute',
    backgroundColor: 'rgba(160,220,255,0.72)',
  },
  stripe: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    opacity: 0.7,
  },
  wheel: {
    position: 'absolute',
    backgroundColor: '#222',
    borderWidth: 2,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  boostFlame: {
    position: 'absolute',
    left: -20,
    top: '32%',
    opacity: 0.85,
    borderRadius: 4,
  },

  // Goal flash
  goalFlashOverlay: {
    backgroundColor: 'rgba(0,0,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  goalFlashText: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 8,
    color: '#ffff00',
    textShadowColor: '#ff8800',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  goalFlashSub: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
  },

  // Controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(0,255,255,0.25)',
    backgroundColor: 'rgba(0,0,15,0.96)',
    gap: 8,
  },
  dpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 148,
    gap: 5,
  },
  dpadBtn: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBtn: {
    borderColor: 'rgba(255,255,0,0.4)',
    backgroundColor: 'rgba(255,255,0,0.06)',
  },
  boostBtn: {
    borderColor: 'rgba(255,0,204,0.4)',
    backgroundColor: 'rgba(255,0,204,0.06)',
  },
  dpadIcon: { color: CYAN, fontSize: 18, fontWeight: '700' },

  boostBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
  boostLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(255,0,204,0.7)',
    fontWeight: '700',
  },
  boostTrack: {
    width: 72,
    height: 10,
    backgroundColor: 'rgba(255,0,204,0.1)',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,0,204,0.4)',
    overflow: 'hidden',
  },
  boostFill: {
    height: '100%',
    backgroundColor: PINK,
    shadowColor: PINK,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    borderRadius: 5,
  },

  kickBtn: {
    width: 80,
    height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(255,102,0,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,102,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  kickText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
});