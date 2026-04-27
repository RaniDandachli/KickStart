// ─────────────────────────────────────────────────────────────
//  NeonBallRunGame.tsx  –  single-player / prize-run mode
//  Renderer: @react-three/fiber (R3F) + expo-gl
//  Mirrors TapDashGame.tsx conventions exactly
// ─────────────────────────────────────────────────────────────

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Canvas, invalidate, useFrame, useThree } from '@react-three/fiber/native';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
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
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { alertInsufficientPrizeCredits, pushArcadeCreditsShop } from '@/lib/arcadeCreditsShop';
import { arcade } from '@/lib/arcadeTheme';
import { finalizeDailyScores } from '@/lib/dailyFreeTournament';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { useAutoSubmitOnPhaseOver } from '@/lib/useAutoSubmitOnPhaseOver';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow, ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useLockNavigatorGesturesWhile } from '@/minigames/ui/useLockNavigatorGesturesWhile';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { H2hSkillContestBundle } from '@/types/match';

import { BALL_RUN } from './ballRunConstants';
import {
    createNeonBallRunState,
    getBallX,
    mergedGapBlockedLanes,
    queueJump,
    queueShift,
    stepNeonBallRun,
    surfaceY,
    type NeonBallRunState,
    type RampSegment,
} from './BallRunEngine';

// ── Prize scoring ─────────────────────────────────────────────
const POINTS_PER_TICKET = 150;
function ticketsFromScore(score: number) { return Math.floor(score / POINTS_PER_TICKET); }

// ── Materials (shared, created once per Canvas) ───────────────

const CYAN = '#00ffff';
const PINK = '#ff00cc';
const PURPLE = '#aa00ff';
const CHEVRON_YELLOW = '#e8cf00';
const TRACK_BLACK = '#080810';

/** React HUD (score / speed / streak) — physics + R3F invalidate every frame; avoid 60 RN reconciles/sec. */
const HUD_REACT_INTERVAL_MS = 1000 / 20;

// ── 3D Scene components ───────────────────────────────────────

/** Camera follows ball from behind and above (snap placement so the lane stays in frame on native GL). */
function FollowCamera({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  const { camera } = useThree();

  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const bx = getBallX(s);
    const targetY = s.ballY + 6;
    const targetZ = s.ballZ + 12;
    camera.position.set(bx, targetY, targetZ);
    camera.lookAt(bx, s.ballY + 0.4, s.ballZ - 14);
    if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/** Neon grid floor extending into the distance */
function NeonGrid({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const s = stateRef.current;
    if (!s || !meshRef.current) return;
    meshRef.current.position.z = s.ballZ - 30;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
      <planeGeometry args={[80, 120, 10, 14]} />
      <meshBasicMaterial color="#1e1a4a" wireframe opacity={0.22} transparent />
    </mesh>
  );
}

/** Dark void below gaps — reads as “jump the gap” like endless runners. */
function VoidAbyss({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const laneW = (BALL_RUN.laneCount - 1) * BALL_RUN.laneSpacing + BALL_RUN.tileWidth * 3;
  useFrame(() => {
    const s = stateRef.current;
    if (!s || !meshRef.current) return;
    const bx = getBallX(s);
    meshRef.current.position.set(bx, -14, s.ballZ - 20);
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[laneW + 24, 320]} />
      <meshBasicMaterial color="#050008" />
    </mesh>
  );
}

/** Sky backdrop with stars (keep count modest — each star is a draw call). */
function SkyDome() {
  return (
    <>
      {/* Fog-like background color handled by scene */}
      {Array.from({ length: 22 }, (_, i) => {
        const x = (((i * 73 + 17) % 100) / 100 - 0.5) * 80;
        const y = ((i * 47 + 31) % 100) / 100 * 20 + 3;
        const z = -(((i * 31 + 7) % 100) / 100) * 80 - 5;
        const brightness = 0.4 + (i % 5) * 0.12;
        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.06 + (i % 3) * 0.03, 4, 4]} />
            <meshBasicMaterial color={`hsl(${(i * 37) % 60 + 180}, 80%, ${Math.round(brightness * 100)}%)`} />
          </mesh>
        );
      })}
    </>
  );
}

/** One tilted ramp deck (Subway-style) + lane strips + hole pits. */
function RampSegmentMesh({ seg }: { seg: RampSegment }) {
  const len = seg.zStart - seg.zEnd;
  const midZ = (seg.zStart + seg.zEnd) / 2;
  const midY = (seg.yStart + seg.yEnd) / 2;
  const pitch = Math.atan2(seg.yStart - seg.yEnd, len);
  const laneHalf = (BALL_RUN.laneCount - 1) / 2;
  const lw = BALL_RUN.tileWidth - 0.06;
  const trackW = (BALL_RUN.laneCount - 1) * BALL_RUN.laneSpacing + lw + 1.2;

  return (
    <group>
      {/* Substrate + rails */}
      <mesh position={[0, midY + 0.11, midZ]} rotation={[-pitch, 0, 0]}>
        <boxGeometry args={[trackW, 0.24, len]} />
        <meshBasicMaterial color="#2d1a55" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (trackW / 2 + 0.06), midY + 0.35, midZ]} rotation={[-pitch, 0, 0]}>
          <boxGeometry args={[0.12, 0.5, len]} />
          <meshBasicMaterial color="#ff44aa" />
        </mesh>
      ))}
      {/* Per-lane deck strips (neon top) */}
      {Array.from({ length: BALL_RUN.laneCount }, (_, i) => {
        const x = (i - laneHalf) * BALL_RUN.laneSpacing;
        if (!seg.laneSolid[i]) {
          return (
            <group key={`hole-${i}`} position={[x, midY - 0.05, midZ]} rotation={[-pitch, 0, 0]}>
              <mesh position={[0, -0.45, 0]}>
                <boxGeometry args={[lw + 0.04, 0.7, len * 0.94]} />
                <meshBasicMaterial color="#120008" />
              </mesh>
            </group>
          );
        }
        return (
          <mesh key={`lane-${i}`} position={[x, midY + 0.14, midZ]} rotation={[-pitch, 0, 0]}>
            <boxGeometry args={[lw, 0.1, len]} />
            <meshBasicMaterial color="#4a2a8e" />
          </mesh>
        );
      })}
      {Array.from({ length: BALL_RUN.laneCount }, (_, i) => {
        if (!seg.laneSolid[i]) return null;
        const x = (i - laneHalf) * BALL_RUN.laneSpacing;
        return (
          <mesh key={`edge-${i}`} position={[x, midY + 0.2, midZ]} rotation={[-pitch, 0, 0]}>
            <boxGeometry args={[lw - 0.02, 0.04, len]} />
            <meshBasicMaterial color={CYAN} />
          </mesh>
        );
      })}
    </group>
  );
}

function SpikeMesh({ x, z, yBase }: { x: number; z: number; yBase: number }) {
  return (
    <group position={[x, yBase + 0.65, z]}>
      <mesh>
        <coneGeometry args={[0.5, 1.25, 8]} />
        <meshBasicMaterial color="#ff3366" />
      </mesh>
    </group>
  );
}

function WallMesh({ x, z, yBase }: { x: number; z: number; yBase: number }) {
  const w = BALL_RUN.tileWidth - 0.1;
  return (
    <group position={[x, yBase + 1.0, z]}>
      <mesh>
        <boxGeometry args={[w, 1.35, 0.22]} />
        <meshBasicMaterial color="#8899b0" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <boxGeometry args={[w, 0.05, 0.26]} />
        <meshBasicMaterial color={PINK} />
      </mesh>
    </group>
  );
}

/** Lane-hole hazard pit on tilted ramp (gap obstacle). */
function GapPitMesh({ seg, blockedLanes, laneHalf }: { seg: RampSegment; blockedLanes: number[]; laneHalf: number }) {
  if (blockedLanes.length === 0) return null;
  const len = seg.zStart - seg.zEnd;
  const midZ = (seg.zStart + seg.zEnd) / 2;
  const midY = (seg.yStart + seg.yEnd) / 2;
  const pitch = Math.atan2(seg.yStart - seg.yEnd, len);
  const sorted = [...blockedLanes].sort((a, b) => a - b);
  const minL = sorted[0]!;
  const maxL = sorted[sorted.length - 1]!;
  const centerLane = (minL + maxL) / 2;
  const cx = (centerLane - laneHalf) * BALL_RUN.laneSpacing;
  const width = (maxL - minL + 1) * BALL_RUN.laneSpacing - 0.1;
  return (
    <group position={[cx, midY + 0.02, midZ]} rotation={[-pitch, 0, 0]}>
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[width, 0.42, len * 0.92]} />
        <meshBasicMaterial color="#3d0018" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.05), 0.18, 0]}>
          <boxGeometry args={[0.12, 0.48, len * 0.92]} />
          <meshBasicMaterial color="#ff4488" />
        </mesh>
      ))}
    </group>
  );
}

function MovingMesh({
  segmentId,
  laneHalf,
  stateRef,
  seg,
  which,
}: {
  segmentId: number;
  laneHalf: number;
  stateRef: React.MutableRefObject<NeonBallRunState | null>;
  seg: RampSegment;
  which: 'primary' | 'secondary';
}) {
  const zMid = (seg.zStart + seg.zEnd) / 2;
  const zObs =
    which === 'primary'
      ? (seg.obstacleAnchorZ ?? zMid)
      : (seg.obstacleAnchorZ2 ?? zMid);
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const s = stateRef.current;
    const row = s?.segments.find((r) => r.id === segmentId);
    if (!row) return;
    const isPrimary = which === 'primary';
    const moving = isPrimary ? row.obstacle === 'moving' && row.obstacleData : row.obstacle2 === 'moving' && row.obstacleData2;
    if (!moving) return;
    const d = isPrimary ? row.obstacleData! : row.obstacleData2!;
    const ml = d.movingLane;
    const x = (ml - laneHalf) * BALL_RUN.laneSpacing;
    const zUse = isPrimary ? (row.obstacleAnchorZ ?? zObs) : (row.obstacleAnchorZ2 ?? zObs);
    const y = surfaceY(row, zUse) + 0.85;
    g.position.set(x, y, zUse);
    g.rotation.y = clock.getElapsedTime() * 2.2;
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[BALL_RUN.tileWidth * 0.85, 1.0, 0.75]} />
        <meshBasicMaterial color="#ff6622" />
      </mesh>
    </group>
  );
}

/** The neon ball */
function BallMesh({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  const rootRef = useRef<THREE.Group>(null);
  const rollRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const s = stateRef.current;
    if (!s || !rootRef.current) return;
    const bx = getBallX(s);
    rootRef.current.position.set(bx, s.ballY, s.ballZ);
    if (rollRef.current) {
      rollRef.current.rotation.x = (s.ballSpin * Math.PI) / 180;
      rollRef.current.rotation.z = -(s.ballSpin * Math.PI) / 360;
    }
  });

  return (
    <group ref={rootRef}>
      <mesh>
        <sphereGeometry args={[BALL_RUN.ballRadius * 1.45, 12, 12]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.12} />
      </mesh>
      <group ref={rollRef}>
        <mesh>
          <sphereGeometry args={[BALL_RUN.ballRadius, 24, 24]} />
          <meshBasicMaterial color="#0d0d12" />
        </mesh>
        <mesh>
          <sphereGeometry args={[BALL_RUN.ballRadius * 1.01, 16, 16]} />
          <meshBasicMaterial color={CYAN} wireframe opacity={0.85} transparent />
        </mesh>
      </group>
    </group>
  );
}

const PARTICLE_POOL = 100;

/** Burst particles — pooled meshes (no per-frame Geometry/Mesh alloc — was a major hitch). */
function ParticleMeshes({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const poolReadyRef = useRef(false);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g || poolReadyRef.current) return;
    poolReadyRef.current = true;
    const geo = new THREE.SphereGeometry(0.08, 4, 4);
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      g.add(mesh);
    }
  }, []);

  useFrame(() => {
    const s = stateRef.current;
    const g = groupRef.current;
    if (!s || !g) return;
    const particles = s.particles;
    const children = g.children as THREE.Mesh[];
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const mesh = children[i];
      if (!mesh) continue;
      if (i < particles.length) {
        const p = particles[i]!;
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
        mesh.scale.setScalar(p.size * p.life * 12);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.set(p.color);
        mat.opacity = p.life;
      } else {
        mesh.visible = false;
      }
    }
  });

  return <group ref={groupRef} />;
}

/** Track meshes — re-render only when `trackRevision` bumps (segment list changed), not every frame. */
function TrackScene({
  stateRef,
  trackRevision,
}: {
  stateRef: React.MutableRefObject<NeonBallRunState | null>;
  trackRevision: number;
}) {
  void trackRevision;
  const s = stateRef.current;
  if (!s) return null;

  return (
    <>
      {s.segments.map((seg) => (
        <SegmentMeshes key={seg.id} seg={seg} stateRef={stateRef} />
      ))}
    </>
  );
}

function SegmentMeshes({
  seg,
  stateRef,
}: {
  seg: RampSegment;
  stateRef: React.MutableRefObject<NeonBallRunState | null>;
}) {
  const laneHalf = (BALL_RUN.laneCount - 1) / 2;
  const zMid = (seg.zStart + seg.zEnd) / 2;
  const gapLanes = mergedGapBlockedLanes(seg);

  const renderSolidHazard = (
    kind: NonNullable<RampSegment['obstacle']> | null,
    data: RampSegment['obstacleData'],
    anchorZ: number | null,
    keyPrefix: string,
  ) => {
    if (!kind || !data || kind === 'gap') return null;
    const zObs = anchorZ ?? zMid;
    const yObs = surfaceY(seg, zObs);
    return (
      <>
        {kind === 'spike'
          ? data.blockedLanes.map((lane) => (
              <SpikeMesh
                key={`${keyPrefix}-sp${lane}`}
                x={(lane - laneHalf) * BALL_RUN.laneSpacing}
                z={zObs}
                yBase={yObs}
              />
            ))
          : null}
        {kind === 'wall' || kind === 'barricade'
          ? data.blockedLanes.map((lane) => (
              <WallMesh
                key={`${keyPrefix}-wl${lane}`}
                x={(lane - laneHalf) * BALL_RUN.laneSpacing}
                z={zObs}
                yBase={yObs}
              />
            ))
          : null}
        {kind === 'moving' ? (
          <MovingMesh
            segmentId={seg.id}
            laneHalf={laneHalf}
            stateRef={stateRef}
            seg={seg}
            which={keyPrefix === 'a' ? 'primary' : 'secondary'}
          />
        ) : null}
      </>
    );
  };

  return (
    <group>
      <RampSegmentMesh seg={seg} />
      {gapLanes.length > 0 ? <GapPitMesh seg={seg} blockedLanes={gapLanes} laneHalf={laneHalf} /> : null}
      {renderSolidHazard(seg.obstacle, seg.obstacleData, seg.obstacleAnchorZ, 'a')}
      {renderSolidHazard(seg.obstacle2, seg.obstacleData2, seg.obstacleAnchorZ2, 'b')}
    </group>
  );
}

/** Point lights for neon glow effect */
function NeonLights({ stateRef }: { stateRef: React.MutableRefObject<NeonBallRunState | null> }) {
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const bx = getBallX(s);
    if (light1Ref.current) light1Ref.current.position.set(bx, s.ballY + 2, s.ballZ);
    if (light2Ref.current) light2Ref.current.position.set(bx, 0, s.ballZ - 4);
  });

  return (
    <>
      {/* distance must be 0 — small values black out meshStandard tiles far from the ball */}
      <ambientLight intensity={0.55} color="#221a38" />
      <hemisphereLight intensity={0.4} color="#8b7aad" groundColor="#050208" />
      <pointLight ref={light1Ref} intensity={2.4} distance={0} decay={2} color={CYAN} />
      <pointLight ref={light2Ref} intensity={1.3} distance={0} decay={2} color={PURPLE} />
      <directionalLight position={[6, 16, 10]} intensity={0.65} color="#f0e8ff" />
    </>
  );
}

/** Full 3D scene */
function GameScene({
  stateRef,
  trackRevision,
}: {
  stateRef: React.MutableRefObject<NeonBallRunState | null>;
  trackRevision: number;
}) {
  return (
    <>
      <color attach="background" args={['#02001a']} />
      <fog attach="fog" args={['#02001a', 55, 220]} />
      <NeonLights stateRef={stateRef} />
      <SkyDome />
      <NeonGrid stateRef={stateRef} />
      <VoidAbyss stateRef={stateRef} />
      <TrackScene stateRef={stateRef} trackRevision={trackRevision} />
      <BallMesh stateRef={stateRef} />
      <ParticleMeshes stateRef={stateRef} />
      <FollowCamera stateRef={stateRef} />
    </>
  );
}

// ── Swipe handler ─────────────────────────────────────────────

function useSwipe(stateRef: React.MutableRefObject<NeonBallRunState | null>) {
  const sx = useRef(0);
  const sy = useRef(0);
  const fired = useRef(false);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    sx.current = e.nativeEvent.pageX;
    sy.current = e.nativeEvent.pageY;
    fired.current = false;
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    if (fired.current || !stateRef.current?.alive) return;
    const dx = e.nativeEvent.pageX - sx.current;
    const dy = e.nativeEvent.pageY - sy.current;
    if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      fired.current = true;
      queueShift(stateRef.current, dx > 0 ? 1 : -1);
    } else if (dy < -28 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      fired.current = true;
      queueJump(stateRef.current);
    }
  }, []);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (!fired.current && stateRef.current?.alive) {
      const dx = Math.abs(e.nativeEvent.pageX - sx.current);
      const dy = Math.abs(e.nativeEvent.pageY - sy.current);
      if (dx < 12 && dy < 12) queueJump(stateRef.current!);
    }
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

// ── Speed bar ─────────────────────────────────────────────────

function SpeedBar({ speed }: { speed: number }) {
  const frac = (speed - BALL_RUN.baseSpeed) / (BALL_RUN.maxSpeed - BALL_RUN.baseSpeed);
  return (
    <View style={styles.speedRow}>
      <Text style={styles.speedLabel}>SPEED</Text>
      <View style={styles.speedTrack}>
        <LinearGradient
          colors={['#00ffff', '#ff00cc']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={[styles.speedFill, { width: `${Math.min(frac * 100, 100)}%` }]}
        />
      </View>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function NeonBallRunGame({
  playMode = 'practice',
  runSeed: _runSeed,
  dailyTournament,
  h2hSkillContest,
}: {
  playMode?: 'practice' | 'prize';
  /** Reserved for deterministic runs / leaderboards (engine is RNG today). */
  runSeed?: number;
  dailyTournament?: DailyTournamentBundle;
  h2hSkillContest?: H2hSkillContestBundle;
}) {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const queryClient = useQueryClient();
  const prizeCredits = usePrizeCreditsDisplay();
  const { height: sh } = useWindowDimensions();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  useLockNavigatorGesturesWhile(phase === 'playing');
  const [, setUiTick] = useState(0);
  const [trackRevision, setTrackRevision] = useState(0);

  const stateRef = useRef<NeonBallRunState | null>(null);
  const lastTrackSigRef = useRef('');
  const lastHudReactRef = useRef(0);
  const startTimeRef = useRef(0);
  const endStatsRef = useRef({ score: 0, dodgeCount: 0, durationMs: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [autoSubmitSeq, setAutoSubmitSeq] = useState(0);
  const dailyCompleteRef = useRef(false);
  const prizeRunReservationRef = useRef<string | null>(null);

  const bump = useCallback(() => setUiTick(t => t + 1), []);

  const endGame = useCallback((s: NeonBallRunState) => {
    endStatsRef.current = {
      score: Math.floor(s.score),
      dodgeCount: s.dodgeCount,
      durationMs: Math.max(0, Date.now() - startTimeRef.current),
    };
    setPhase('over');
    if (!dailyTournament && !h2hSkillContest) {
      setAutoSubmitSeq((n) => n + 1);
    }
    bump();
  }, [bump, dailyTournament, h2hSkillContest]);

  const step = useCallback(
    (totalDtMs: number) => {
      const s = stateRef.current;
      if (!s || !s.alive) return;
      runFixedPhysicsSteps(totalDtMs, (h) => {
        if (!s.alive) return false;
        stepNeonBallRun(s, h / 1000);
        if (!s.alive) {
          endGame(s);
          return false;
        }
        return true;
      });
      if (s.alive) {
        const sig = s.segments
          .map((x) => x.id)
          .sort((a, b) => a - b)
          .join(',');
        if (sig !== lastTrackSigRef.current) {
          lastTrackSigRef.current = sig;
          setTrackRevision((n) => n + 1);
        }
        const now = performance.now();
        if (now - lastHudReactRef.current >= HUD_REACT_INTERVAL_MS) {
          lastHudReactRef.current = now;
          bump();
        }
        invalidate();
      }
    },
    [bump, endGame],
  );

  useRafLoop(step, phase === 'playing');

  const buildH2hBody = useCallback(() => {
    const { score, dodgeCount, durationMs } = endStatsRef.current;
    return {
      game_type: 'ball_run' as const,
      score,
      duration_ms: durationMs,
      taps: dodgeCount,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
  );

  const startGame = useCallback(() => {
    void (async () => {
      if (!dailyTournament && !h2hSkillContest && playMode === 'prize') {
        if (ENABLE_BACKEND) {
          if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
          const r = await beginMinigamePrizeRun('ball_run');
          if (!r.ok) {
            if (r.error === 'insufficient_credits') {
              alertInsufficientPrizeCredits(
                router,
                `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
              );
            } else {
              Alert.alert('Could not start prize run', r.message ?? 'Try again.');
            }
            return;
          }
          prizeRunReservationRef.current = r.reservationId;
          if (uid) invalidateProfileEconomy(queryClient, uid);
        } else {
          const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
          if (!ok) {
            alertInsufficientPrizeCredits(
              router,
              `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
            );
            return;
          }
        }
      }
      stateRef.current = createNeonBallRunState();
      startTimeRef.current = Date.now();
      lastTrackSigRef.current = stateRef.current.segments
        .map((x) => x.id)
        .sort((a, b) => a - b)
        .join(',');
      setTrackRevision((n) => n + 1);
      setSubmitOk(false);
      setSubmitErr(false);
      setPhase('playing');
      lastHudReactRef.current = 0;
      bump();
    })();
  }, [playMode, profileQ.data?.prize_credits, bump, dailyTournament, h2hSkillContest, router, queryClient, uid]);

  const resetRun = useCallback(() => {
    stateRef.current = null;
    lastTrackSigRef.current = '';
    setSubmitOk(false);
    setSubmitErr(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const submitScore = useCallback(async () => {
    const { score, dodgeCount, durationMs } = endStatsRef.current;
    setSubmitting(true);
    setSubmitErr(false);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        Alert.alert('Sign in required', 'Log in to submit your score.');
        setSubmitErr(true);
        return;
      }
      const prizeRun = !dailyTournament && playMode === 'prize' && !h2hSkillContest;
      if (!assertPrizeRunReservation(prizeRun, ENABLE_BACKEND, prizeRunReservationRef.current)) {
        setSubmitErr(true);
        return;
      }
      const body: Record<string, unknown> = {
        game_type: 'ball_run',
        score,
        duration_ms: durationMs,
        taps: dodgeCount,
      };
      if (prizeRun && ENABLE_BACKEND) {
        body.prize_run = true;
        body.prize_run_reservation_id = prizeRunReservationRef.current!;
      }
      const { error } = await invokeEdgeFunction('submitMinigameScore', { body });
      if (error) {
        Alert.alert('Submit failed', error.message ?? 'Could not reach server.');
        setSubmitErr(true);
        return;
      }
      invalidateProfileEconomy(queryClient, uid);
      setSubmitOk(true);
    } finally {
      setSubmitting(false);
    }
  }, [dailyTournament, playMode, h2hSkillContest, queryClient, uid]);

  useAutoSubmitOnPhaseOver({
    phase,
    overValue: 'over',
    runToken: autoSubmitSeq,
    disabled: Boolean(dailyTournament || h2hSkillContest),
    onSubmit: submitScore,
  });

  const s = stateRef.current;
  const swipe = useSwipe(stateRef);
  /** Was 0.68 — taller GL view so the run fills the screen under the HUD (still leaves room for speed bar). */
  const canvasH = Math.round(Math.min(Math.max(sh * 0.78, 280), sh * 0.88));

  useWebGameKeyboard(phase === 'playing', {
    ArrowLeft: (down) => {
      if (down && stateRef.current?.alive) queueShift(stateRef.current, -1);
    },
    ArrowRight: (down) => {
      if (down && stateRef.current?.alive) queueShift(stateRef.current, 1);
    },
    ArrowUp: (down) => {
      if (down && stateRef.current?.alive) queueJump(stateRef.current!);
    },
    Space: (down) => {
      if (down && stateRef.current?.alive) queueJump(stateRef.current!);
    },
  });

  const dailyPayload =
    dailyTournament && phase === 'over'
      ? finalizeDailyScores(
          endStatsRef.current.score,
          dailyTournament.opponentRoundScore,
          dailyTournament.forcedOutcome,
          dailyTournament.localPlayerId,
          dailyTournament.opponentId,
          dailyTournament.scoreVarianceKey,
        )
      : null;

  const onContinueDaily = useCallback(() => {
    if (!dailyTournament || !dailyPayload || dailyCompleteRef.current) return;
    dailyCompleteRef.current = true;
    dailyTournament.onComplete(dailyPayload);
  }, [dailyTournament, dailyPayload]);

  /** Web: game over — Space / ↑ / Enter = Roll Again or (daily) Continue. H2H waits on server. */
  useWebGameKeyboard(
    Platform.OS === 'web' && phase === 'over' && !h2hSkillContest && (!dailyTournament || !!dailyPayload),
    {
      Space: (down) => {
        if (!down) return;
        if (dailyTournament) onContinueDaily();
        else resetRun();
      },
      ArrowUp: (down) => {
        if (!down) return;
        if (dailyTournament) onContinueDaily();
        else resetRun();
      },
      Enter: (down) => {
        if (!down) return;
        if (dailyTournament) onContinueDaily();
        else resetRun();
      },
    },
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <SafeIonicons name="chevron-back" size={26} color="rgba(226,232,240,0.95)" />
          </Pressable>
          <View style={styles.scoreCol}>
            <Text style={styles.scoreText}>{s ? Math.floor(s.score) : 0}</Text>
            {s && s.dodgeStreak >= 2 ? (
              <Text style={styles.streakText}>{s.dodgeStreak}x HAZARD STREAK</Text>
            ) : null}
            {s && s.dodgeCount > 0 && (
              <Text style={styles.dodgeText}>+{s.dodgeCount} hazard{s.dodgeCount !== 1 ? 's' : ''} cleared</Text>
            )}
            {(dailyTournament || h2hSkillContest) && phase !== 'over' ? (
              <Text style={styles.vsOppBall} numberOfLines={1}>
                vs {dailyTournament?.opponentDisplayName ?? h2hSkillContest?.opponentDisplayName}
              </Text>
            ) : null}
          </View>
          {dailyTournament || h2hSkillContest ? (
            <View style={styles.topBarRightSpacer} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buy arcade credits"
              onPress={() => pushArcadeCreditsShop(router)}
              style={({ pressed }) => [styles.creditsPill, pressed && { opacity: 0.88 }]}
            >
              <View style={{ marginRight: 4 }}>
                <SafeIonicons name="gift-outline" size={16} color="#5EEAD4" />
              </View>
              <Text style={styles.creditsText}>{prizeCredits.toLocaleString()}</Text>
            </Pressable>
          )}
        </View>

        {phase === 'playing' && s && <SpeedBar speed={s.speed} />}

        {/* 3D Canvas */}
        <Pressable
          style={[styles.canvasWrap, { height: canvasH }]}
          onTouchStart={swipe.onTouchStart}
          onTouchMove={swipe.onTouchMove}
          onTouchEnd={swipe.onTouchEnd}
          disabled={phase === 'over'}
        >
          <Canvas
            style={{ flex: 1 }}
            frameloop="always"
            camera={{ position: [0, 6, 12], fov: 65, near: 0.1, far: 220 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <GameScene stateRef={stateRef} trackRevision={trackRevision} />
          </Canvas>

          {/* Ready overlay */}
          {phase === 'ready' && (
            <View style={styles.readyOverlay}>
              <Text style={styles.readyTitle}>NEON BALL RUN</Text>
              <Text style={styles.readySub}>RAMP RUN · JUMP THE GAPS</Text>
              <View style={styles.readyDivider} />
              <Text style={styles.readyMode}>
                {h2hSkillContest
                  ? `Head-to-head · vs ${h2hSkillContest.opponentDisplayName} · server-validated score`
                  : dailyTournament
                    ? `Tournament of the Day · vs ${dailyTournament.opponentDisplayName}`
                    : playMode === 'prize'
                      ? `Prize run · ${PRIZE_RUN_ENTRY_CREDITS} credits · +1 ticket per ${POINTS_PER_TICKET} score`
                      : 'Practice · free · no credits spent'}
              </Text>
              <Text style={styles.readyHint}>
                Swipe ← → to dodge · Swipe ↑ or tap to jump
                {Platform.OS === 'web' ? '\nWeb: arrow keys + Space to jump' : ''}
              </Text>
              <Text style={styles.readyHint2}>
                Chain hazard clears for a streak bonus · roll the ramps · jump gaps · dodge spikes & trains
              </Text>
              <AppButton title="▶  ROLL" onPress={startGame} />
            </View>
          )}
        </Pressable>

        {/* Control hint */}
        {phase === 'playing' && (
          <View style={styles.hintRow}>
            <Text style={styles.hintText}>
              {Platform.OS === 'web'
                ? '← → lanes · ↑ or Space jump'
                : '← swipe → to switch lanes · swipe ↑ or tap to jump gaps'}
            </Text>
          </View>
        )}

        {/* Game over — Modal so RN GL Canvas cannot paint above the UI (native layer ordering). */}
        <Modal
          visible={phase === 'over'}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {
            if (dailyTournament) return;
            router.replace('/(app)/(tabs)/play/minigames');
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.card}>
              {dailyTournament && dailyPayload ? (
                <>
                  <GameOverExitRow
                    onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                    onHome={() => router.replace(ROUTE_HOME)}
                  />
                  <Text style={styles.goTitle}>Round result</Text>
                  <Text style={styles.goVsBall} numberOfLines={1}>
                    You vs {dailyTournament.opponentDisplayName}
                  </Text>
                  <Text style={styles.goScore}>
                    {dailyPayload.finalScore.self} — {dailyPayload.finalScore.opponent}
                  </Text>
                  <Text style={styles.practiceNote}>
                    {dailyPayload.winnerId === dailyTournament.localPlayerId
                      ? 'You take the match and move on.'
                      : 'They take the match — you’re out of today’s event.'}
                  </Text>
                  <AppButton title="Continue" onPress={onContinueDaily} />
                </>
              ) : h2hSkillContest ? (
                <>
                  <GameOverExitRow
                    onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                    onHome={() => router.replace(ROUTE_HOME)}
                  />
                  <Text style={styles.goTitle}>Run ended</Text>
                  <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
                  {h2hSubmitPhase === 'loading' ? (
                    <Text style={styles.practiceNote}>Submitting your run…</Text>
                  ) : null}
                  {h2hSubmitPhase === 'error' ? (
                    <>
                      <Text style={styles.practiceNote}>Could not submit this run. Check your connection.</Text>
                      <AppButton title="Retry submit" className="mt-3" onPress={() => setH2hRetryKey((k) => k + 1)} />
                    </>
                  ) : null}
                  {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
                    <Text style={styles.practiceNote}>
                      Waiting for {h2hSkillContest.opponentDisplayName} to finish…
                    </Text>
                  ) : null}
                  {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
                    <Text style={styles.practiceNote}>Both runs in — finalizing match…</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <GameOverExitRow
                    onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                    onHome={() => router.replace(ROUTE_HOME)}
                  />
                  <Text style={styles.goTitle}>WIPED OUT</Text>
                  {s && <Text style={styles.goReason}>{s.deathReason}</Text>}
                  <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
                  <Text style={styles.goDodge}>Obstacles dodged: {endStatsRef.current.dodgeCount}</Text>
                  {playMode === 'prize' && (
                    <Text style={styles.goTickets}>
                      +{ticketsFromScore(endStatsRef.current.score)} redeem tickets
                    </Text>
                  )}
                  <AppButton title="Roll Again" onPress={resetRun} className="mb-3" />
                  {playMode === 'prize' ? (
                    <>
                      {submitting ? (
                        <>
                          <Text style={styles.practiceNote}>Saving score…</Text>
                          <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                        </>
                      ) : null}
                      {submitOk ? <Text style={styles.practiceNote}>Score saved.</Text> : null}
                      {submitErr && !submitting ? (
                        <>
                          <Text style={styles.practiceNote}>Could not save score.</Text>
                          <AppButton
                            title="Retry"
                            variant="secondary"
                            className="mt-2"
                            onPress={() => {
                              setSubmitErr(false);
                              void submitScore();
                            }}
                          />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {submitting ? (
                        <>
                          <Text style={styles.practiceNote}>Saving practice run…</Text>
                          <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                        </>
                      ) : null}
                      {submitOk ? (
                        <Text style={styles.practiceNote}>Practice run saved (no prize tickets).</Text>
                      ) : null}
                      {submitErr && !submitting ? (
                        <>
                          <Text style={styles.practiceNote}>Could not save run.</Text>
                          <AppButton
                            title="Retry"
                            variant="secondary"
                            className="mt-2"
                            onPress={() => {
                              setSubmitErr(false);
                              void submitScore();
                            }}
                          />
                        </>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#02001a' },
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingTop: 2, paddingBottom: 6, zIndex: 30,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarRightSpacer: { width: 72, height: 36 },
  scoreCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreText: {
    color: '#F8FAFC', fontSize: 34, fontWeight: '900', letterSpacing: -0.5,
    textShadowColor: '#00ffff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  dodgeText: { marginTop: 1, color: 'rgba(0,255,136,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  streakText: {
    marginTop: 2,
    color: 'rgba(255, 0, 204, 0.95)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  vsOppBall: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(226,232,240,0.75)',
    maxWidth: 200,
    textAlign: 'center',
  },
  goVsBall: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  creditsPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1, borderColor: 'rgba(94,234,212,0.35)',
    minWidth: 72, justifyContent: 'center',
  },
  creditsText: { color: 'rgba(226,232,240,0.95)', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  speedLabel: { fontSize: 8, letterSpacing: 2, color: 'rgba(0,255,255,0.55)', fontWeight: '700', width: 40 },
  speedTrack: {
    flex: 1, height: 5, backgroundColor: 'rgba(0,255,255,0.08)',
    borderRadius: 3, borderWidth: 1, borderColor: 'rgba(0,255,255,0.2)', overflow: 'hidden',
  },
  speedFill: { height: '100%', borderRadius: 3 },

  canvasWrap: { width: '100%', overflow: 'hidden', borderRadius: 0 },

  readyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,0,26,0.82)',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32, zIndex: 40,
  },
  readyTitle: {
    fontSize: 34, fontWeight: '900', letterSpacing: 5, color: '#00ffff',
    textShadowColor: '#00ffff', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  readySub: { fontSize: 10, letterSpacing: 4, color: 'rgba(255,0,204,0.8)', fontWeight: '700' },
  readyDivider: { width: 120, height: 1, backgroundColor: '#00ffff', opacity: 0.3, marginVertical: 4 },
  readyMode: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: '#fde047', textAlign: 'center' },
  readyHint: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', letterSpacing: 0.4 },
  readyHint2: { fontSize: 11, color: 'rgba(255,80,80,0.65)', textAlign: 'center', letterSpacing: 0.3, marginBottom: 6 },

  hintRow: { paddingVertical: 8, alignItems: 'center' },
  hintText: { color: 'rgba(0,255,255,0.35)', fontSize: 11, letterSpacing: 0.5, fontWeight: '600' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,15,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, padding: 22, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.3)',
    backgroundColor: 'rgba(8,0,30,0.98)',
    shadowColor: '#00ffff', shadowOpacity: 0.14, shadowRadius: 20, gap: 8,
  },
  goTitle: {
    color: '#ff00cc', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 4,
    textShadowColor: '#ff00cc', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
  },
  goReason: { color: 'rgba(255,100,100,0.85)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  goScore: { color: '#F8FAFC', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  goDodge: { color: 'rgba(0,255,136,0.8)', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  goTickets: { color: '#FDE047', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  practiceNote: { color: 'rgba(148,163,184,0.9)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});