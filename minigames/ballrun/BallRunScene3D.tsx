// ─────────────────────────────────────────────────────────────
//  NeonBallRunScreen.tsx  –  vs-AI race, 30-second survival
//  Renderer: @react-three/fiber (R3F) — side-by-side 3D canvases
//  Mirrors TapDashScreen.tsx conventions exactly
// ─────────────────────────────────────────────────────────────

import { Canvas, useFrame } from '@react-three/fiber/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as THREE from 'three';

import { AppButton } from '@/components/ui/AppButton';
import {
    MINIGAME_HUD_MS_MOTION,
    resetMinigameHudClock,
    shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { Countdown } from '@/minigames/ui/Countdown';
import { ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { MiniGameHUD } from '@/minigames/ui/MiniGameHUD';
import { MiniResultsModal } from '@/minigames/ui/MiniResultsModal';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';

import { BALL_RUN } from './ballRunConstants';
import {
    AiDifficulty,
    createNeonBallRunState,
    getBallX,
    mergedGapBlockedLanes,
    queueJump,
    queueShift,
    runBallRunAi,
    stepNeonBallRun,
    surfaceY,
    type NeonBallRunState,
    type RampSegment,
} from './BallRunEngine';

const MATCH_MS = 30_000;

// ── Minimal 3D lane scene for split-screen ────────────────────
// Simpler than the full game — fixed overhead-ish camera,
// showing a compressed bird's-eye-ish 3D view of the lane

function LaneCamera({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  useFrame(({ camera }) => {
    const s = stateRef.current;
    if (!s) return;
    const bx = getBallX(s);
    camera.position.x += (bx - camera.position.x) * 0.1;
    camera.position.z = s.ballZ + 8;
    camera.lookAt(bx, s.ballY, s.ballZ - 3);
  });

  return null;
}

function MiniRamp({ seg, color }: { seg: RampSegment; color: string }) {
  const len = seg.zStart - seg.zEnd;
  const midZ = (seg.zStart + seg.zEnd) / 2;
  const midY = (seg.yStart + seg.yEnd) / 2;
  const pitch = Math.atan2(seg.yStart - seg.yEnd, len);
  const w = (BALL_RUN.laneCount - 1) * BALL_RUN.laneSpacing + 2;
  return (
    <mesh position={[0, midY + 0.08, midZ]} rotation={[-pitch, 0, 0]}>
      <boxGeometry args={[w, 0.18, len]} />
      <meshStandardMaterial color="#12003a" emissive={color} emissiveIntensity={0.35} />
    </mesh>
  );
}

function MiniObstacle({ x, z, yBase, kind }: { x: number; z: number; yBase: number; kind: string }) {
  const color = kind === 'spike' ? '#ff1155' : kind === 'moving' ? '#ff4400' : '#6600cc';
  return (
    <mesh position={[x, yBase + 0.55, z]}>
      <boxGeometry args={[BALL_RUN.tileWidth * 0.8, kind === 'spike' ? 0.9 : 1.1, 0.5]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function MiniGapPit({ seg, laneHalf }: { seg: RampSegment; laneHalf: number }) {
  const blocked = mergedGapBlockedLanes(seg);
  if (blocked.length === 0) return null;
  const len = seg.zStart - seg.zEnd;
  const midZ = (seg.zStart + seg.zEnd) / 2;
  const midY = (seg.yStart + seg.yEnd) / 2;
  const pitch = Math.atan2(seg.yStart - seg.yEnd, len);
  const sorted = [...blocked].sort((a, b) => a - b);
  const minL = sorted[0]!;
  const maxL = sorted[sorted.length - 1]!;
  const centerLane = (minL + maxL) / 2;
  const cx = (centerLane - laneHalf) * BALL_RUN.laneSpacing;
  const width = (maxL - minL + 1) * BALL_RUN.laneSpacing - 0.12;
  return (
    <group position={[cx, midY, midZ]} rotation={[-pitch, 0, 0]}>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[width, 0.35, len * 0.9]} />
        <meshStandardMaterial color="#240008" emissive="#ff0066" emissiveIntensity={1.1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.05), 0.12, 0]}>
          <boxGeometry args={[0.1, 0.4, len * 0.9]} />
          <meshStandardMaterial color="#ff4488" emissive="#ff88cc" emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

function MiniBall({ stateRef, color }: { stateRef: React.MutableRefObject<NeonBallRunState | null>; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = stateRef.current;
    if (!s || !ref.current) return;
    ref.current.position.set(getBallX(s), s.ballY, s.ballZ);
    ref.current.rotation.x = (s.ballSpin * Math.PI) / 180;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[BALL_RUN.ballRadius, 14, 14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.1} metalness={0.8} />
    </mesh>
  );
}

function MiniTrack({ stateRef, ballColor }: { stateRef: React.MutableRefObject<NeonBallRunState | null>; ballColor: string }) {
  const laneHalf = (BALL_RUN.laneCount - 1) / 2;
  const s = stateRef.current;

  return (
    <>
      <color attach="background" args={['#02001a']} />
      <fog attach="fog" args={['#02001a', 15, 35]} />
      <ambientLight intensity={0.2} color="#0a0030" />
      <pointLight intensity={2.5} distance={10} color={ballColor} position={[0, 3, 0]} />

      {s?.segments.map((seg) => (
        <MiniRamp key={`r-${seg.id}`} seg={seg} color={ballColor} />
      ))}

      {s?.segments.map((seg) => {
        const zMid = (seg.zStart + seg.zEnd) / 2;
        const gapNodes = mergedGapBlockedLanes(seg).length > 0 ? (
          <MiniGapPit key={`gap-${seg.id}`} seg={seg} laneHalf={laneHalf} />
        ) : null;
        const solid = (kind: typeof seg.obstacle, data: typeof seg.obstacleData, az: number | null) => {
          if (!kind || !data || kind === 'gap') return null;
          const zUse = az ?? zMid;
          const yBase = surfaceY(seg, zUse);
          const lanes = kind === 'moving' ? [Math.round(data.movingLane)] : data.blockedLanes;
          return lanes.map((lane) => (
            <MiniObstacle
              key={`obs-${seg.id}-${kind}-${lane}-${zUse}`}
              x={(lane - laneHalf) * BALL_RUN.laneSpacing}
              z={zUse}
              yBase={yBase}
              kind={kind}
            />
          ));
        };
        return (
          <group key={`seg-${seg.id}`}>
            {gapNodes}
            {solid(seg.obstacle, seg.obstacleData, seg.obstacleAnchorZ)}
            {solid(seg.obstacle2, seg.obstacleData2, seg.obstacleAnchorZ2)}
          </group>
        );
      })}

      {/* Ball */}
      <MiniBall stateRef={stateRef} color={ballColor} />
      <LaneCamera stateRef={stateRef} />
    </>
  );
}

// ── Mini canvas wrapper ────────────────────────────────────────

function MiniCanvas({
  stateRef,
  ballColor,
  label,
  who,
}: {
  stateRef: React.MutableRefObject<NeonBallRunState | null>;
  ballColor: string;
  label: string;
  who: 1 | 2;
}) {
  return (
    <View style={[styles.laneCard, { borderColor: who === 1 ? 'rgba(0,255,255,0.4)' : 'rgba(255,0,204,0.4)' }]}>
      <Canvas
        style={{ flex: 1 }}
        camera={{ position: [0, 5, 10], fov: 70, near: 0.1, far: 80 }}
        gl={{ antialias: false }} // perf for split-screen
      >
        <MiniTrack stateRef={stateRef} ballColor={ballColor} />
      </Canvas>
      {/* Dead overlay */}
      {stateRef.current && !stateRef.current.alive && (
        <View style={styles.deadOverlay}>
          <Text style={[styles.deadText, { color: ballColor }]}>OUT</Text>
        </View>
      )}
      <Text style={[styles.laneLabel, { color: ballColor, backgroundColor: who === 1 ? 'rgba(0,255,255,0.08)' : 'rgba(255,0,204,0.08)' }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function NeonBallRunScreen() {
  useHidePlayTabBar();
  const router = useRouter();
  const { width: sw } = useWindowDimensions();

  const [phase, setPhase] = useState<'intro' | 'countdown' | 'playing' | 'done'>('intro');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [uiTick, setUiTick] = useState(0);

  const p1Ref = useRef<NeonBallRunState | null>(null);
  const p2Ref = useRef<NeonBallRunState | null>(null);
  const elapsedRef = useRef(0);
  const matchDoneLatch = useRef(false);
  const lastHudEmitRef = useRef(0);

  // P1 swipe
  const sx = useRef(0);
  const sy = useRef(0);
  const swipeFired = useRef(false);

  const startRun = useCallback(() => {
    matchDoneLatch.current = false;
    p1Ref.current = createNeonBallRunState();
    p2Ref.current = createNeonBallRunState();
    elapsedRef.current = 0;
    resetMinigameHudClock(lastHudEmitRef);
    setUiTick(t => t + 1);
    setPhase('countdown');
  }, []);

  const onCountdownDone = useCallback(() => {
    resetMinigameHudClock(lastHudEmitRef);
    setPhase('playing');
  }, []);

  const loop = useCallback(
    (totalDtMs: number) => {
      const p1 = p1Ref.current;
      const p2 = p2Ref.current;
      if (!p1 || !p2) return;

      let matchJustEnded = false;
      runFixedPhysicsSteps(totalDtMs, (h) => {
        elapsedRef.current += h;
        const dtSec = h / 1000;

        if (p1.alive) stepNeonBallRun(p1, dtSec);
        if (p2.alive) {
          runBallRunAi(p2, difficulty);
          stepNeonBallRun(p2, dtSec);
        }

        const done = elapsedRef.current >= MATCH_MS || (!p1.alive && !p2.alive);
        if (done) {
          if (!matchDoneLatch.current) {
            matchDoneLatch.current = true;
            setPhase('done');
            matchJustEnded = true;
          }
          return false;
        }
        return true;
      });
      if (matchJustEnded || shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS_MOTION)) {
        setUiTick((t) => t + 1);
      }
    },
    [difficulty],
  );

  useRafLoop(loop, phase === 'playing');

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    sx.current = e.nativeEvent.pageX;
    sy.current = e.nativeEvent.pageY;
    swipeFired.current = false;
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    if (swipeFired.current || !p1Ref.current?.alive) return;
    const dx = e.nativeEvent.pageX - sx.current;
    const dy = e.nativeEvent.pageY - sy.current;
    if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeFired.current = true;
      queueShift(p1Ref.current, dx > 0 ? 1 : -1);
    } else if (dy < -28 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      swipeFired.current = true;
      queueJump(p1Ref.current);
    }
  }, []);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (!swipeFired.current && p1Ref.current?.alive) {
      const dx = Math.abs(e.nativeEvent.pageX - sx.current);
      const dy = Math.abs(e.nativeEvent.pageY - sy.current);
      if (dx < 12 && dy < 12) queueJump(p1Ref.current!);
    }
  }, []);

  const p1 = p1Ref.current;
  const p2 = p2Ref.current;
  const timeLeftMs = Math.max(0, MATCH_MS - elapsedRef.current);

  const winnerTitle =
    p1 && p2 && phase === 'done'
      ? !p1.alive && p2.alive ? 'AI wins!'
        : p1.alive && !p2.alive ? 'You win! 🏆'
        : Math.floor(p1.score) > Math.floor(p2.score) ? 'You win! 🏆'
        : Math.floor(p2.score) > Math.floor(p1.score) ? 'AI wins!'
        : 'Draw!'
      : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── Intro ── */}
      {phase === 'intro' && (
        <View style={styles.intro}>
          <LinearGradient colors={['#02001a', '#08003a', '#02001a']} style={StyleSheet.absoluteFill} />
          <Text style={styles.introTitle}>NEON BALL RUN</Text>
          <Text style={styles.introSub}>30-SECOND SURVIVAL RACE</Text>

          <Text style={styles.diffLabel}>DIFFICULTY</Text>
          <View style={styles.diffRow}>
            {(['easy', 'medium', 'hard'] as AiDifficulty[]).map(d => (
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

          <AppButton title="▶  RACE" onPress={startRun} />
          <Text style={styles.introHint}>Swipe ← → to dodge · Tap to jump · Outlast the AI</Text>
        </View>
      )}

      {/* ── Game ── */}
      {(phase === 'countdown' || phase === 'playing' || phase === 'done') && (
        <View style={{ flex: 1 }}>
          {p1 && p2 && (
            <MiniGameHUD
              timeLeftMs={timeLeftMs}
              scoreP1={Math.floor(p1.score)}
              scoreP2={Math.floor(p2.score)}
              subtitle="Neon Ball Run · 30s"
            />
          )}

          <Pressable
            style={styles.lanesRow}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <MiniCanvas stateRef={p1Ref} ballColor="#00ffff" label="YOU · swipe" who={1} />
            <MiniCanvas stateRef={p2Ref} ballColor="#ff00cc" label={`AI · ${difficulty.toUpperCase()}`} who={2} />
          </Pressable>

          {phase === 'playing' && (
            <Text style={styles.swipeHint}>swipe ← → on left side to steer · tap to jump</Text>
          )}
        </View>
      )}

      <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

      <MiniResultsModal
        visible={phase === 'done' && !!p1 && !!p2}
        title={winnerTitle}
        scoreP1={p1 ? Math.floor(p1.score) : 0}
        scoreP2={p2 ? Math.floor(p2.score) : 0}
        onRematch={startRun}
        onMenu={() => {}}
        onExitMinigames={() => router.replace(ROUTE_MINIGAMES)}
        onExitHome={() => router.replace(ROUTE_HOME)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#02001a' },

  intro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingHorizontal: 24,
  },
  introTitle: {
    fontSize: 34, fontWeight: '900', letterSpacing: 5, color: '#00ffff',
    textShadowColor: '#00ffff', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  introSub: { fontSize: 10, letterSpacing: 5, color: 'rgba(255,0,204,0.75)', fontWeight: '700' },
  introHint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 4 },

  diffLabel: { fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
  diffRow: { flexDirection: 'row', gap: 10 },
  diffBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.15)',
  },
  diffBtnActive: { borderColor: '#00ffff', backgroundColor: 'rgba(0,255,255,0.08)' },
  diffBtnText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  diffBtnTextActive: { color: '#00ffff' },

  lanesRow: {
    flex: 1, flexDirection: 'row',
    justifyContent: 'center', gap: 6,
    paddingHorizontal: 6, paddingTop: 4,
  },
  laneCard: {
    flex: 1, borderRadius: 12, borderWidth: 1.5,
    overflow: 'hidden',
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  deadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  deadText: { fontWeight: '900', fontSize: 16, letterSpacing: 3 },
  laneLabel: {
    paddingVertical: 5, textAlign: 'center',
    fontSize: 11, fontWeight: '800', letterSpacing: 1,
  },

  swipeHint: {
    textAlign: 'center', fontSize: 10,
    color: 'rgba(0,255,255,0.3)', letterSpacing: 0.4, paddingVertical: 6,
  },
});