import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import type { MutableRefObject } from 'react';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';

import {
  GROUNDED_CY,
  stepBallRun,
  type BallRunState,
  type Lane,
  type Obstacle,
} from '@/minigames/ballrun/BallRunEngine';
import { mulberry32 } from '@/minigames/core/seededRng';

const LANE_W = 2.35;
const Z_SCALE = 0.0105;
const BALL_WORLD_R = 0.36;
const JUMP_SCALE = 0.026;
/** Ball sits farther “down the track” so it’s not glued to the screen edge. */
const BALL_ANCHOR_Z = -0.72;
/** Visual ramp: obstacles farther along -Z sit slightly lower on the slope. */
const RAMP_Y_PER_WORLD_Z = 0.045;
const RUNWAY_TILT = 0.14;
const LANE_SMOOTH = 13;
/** Camera sits back so more runway shows ahead of the ball. */
const CAM_BACK = 5.35;
const CAM_HEIGHT = 2.05;
const CAM_LOOK_Z = -18;

function laneX(lane: Lane): number {
  return (lane - 1) * LANE_W;
}

function ballWorldY(s: BallRunState): number {
  return BALL_WORLD_R + Math.max(0, (GROUNDED_CY - s.ballCy) * JUMP_SCALE);
}

function ObstacleMesh({ o }: { o: Obstacle }) {
  const x = laneX(o.lane);
  const z = -o.z * Z_SCALE;
  const tall = o.kind === 'wall';
  const w = 1.35;
  const h = tall ? 1.85 : 0.55;
  const d = 0.55;
  const y = h / 2 + 0.02 + z * RAMP_Y_PER_WORLD_Z;
  const col = tall ? '#4c1d95' : '#a21caf';
  return (
    <mesh position={[x, y, z]} castShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={col}
        emissive={tall ? '#34d399' : '#22d3ee'}
        emissiveIntensity={0.35}
        metalness={0.35}
        roughness={0.45}
      />
    </mesh>
  );
}

function NeonBuildings({ seed }: { seed: number }) {
  const items = useMemo(() => {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const out: { x: number; z: number; h: number; w: number }[] = [];
    for (let i = 0; i < 48; i++) {
      const z = -2 - i * 2.8 - rng() * 1.2;
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (5.5 + rng() * 2.8);
      const h = 1.8 + rng() * 5.5;
      const w = 0.9 + rng() * 0.7;
      out.push({ x, z, h, w });
    }
    return out;
  }, [seed]);

  return (
    <>
      {items.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial
            color="#030308"
            emissive="#38bdf8"
            emissiveIntensity={0.12}
            metalness={0.2}
            roughness={0.85}
            wireframe
          />
        </mesh>
      ))}
    </>
  );
}

/** TRON-style floor grid for the main rolling platform. */
function useRunwayGridTexture() {
  return useMemo(() => {
    const cells = 64;
    const data = new Uint8Array(cells * cells * 4);
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const i = (y * cells + x) * 4;
        const edge = x % 8 === 0 || y % 8 === 0;
        if (edge) {
          data[i] = 180;
          data[i + 1] = 240;
          data[i + 2] = 255;
          data[i + 3] = 255;
        } else {
          data[i] = 4;
          data[i + 1] = 6;
          data[i + 2] = 12;
          data[i + 3] = 255;
        }
      }
    }
    const tex = new THREE.DataTexture(data, cells, cells);
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 48);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

function useHazardStripeTexture() {
  return useMemo(() => {
    const w = 32;
    const h = 8;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const stripe = Math.floor(x / 4) % 2;
        if (stripe === 0) {
          data[i] = 250;
          data[i + 1] = 204;
          data[i + 2] = 21;
          data[i + 3] = 255;
        } else {
          data[i] = 15;
          data[i + 1] = 15;
          data[i + 2] = 18;
          data[i + 3] = 255;
        }
      }
    }
    const tex = new THREE.DataTexture(data, w, h);
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function useBallStripeTexture() {
  return useMemo(() => {
    const w = 128;
    const h = 64;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const band = Math.floor(x / 10) % 2;
        const i = (y * w + x) * 4;
        if (band === 0) {
          data[i] = 12;
          data[i + 1] = 24;
          data[i + 2] = 40;
          data[i + 3] = 255;
        } else {
          data[i] = 0;
          data[i + 1] = 220;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
    }
    const tex = new THREE.DataTexture(data, w, h);
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

function RollingBall({
  modelRef,
  visualXRef,
}: {
  modelRef: MutableRefObject<BallRunState>;
  visualXRef: MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rollAcc = useRef(0);
  const stripeMap = useBallStripeTexture();

  useFrame((_, delta) => {
    const m = modelRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;
    const targetX = laneX(m.ballLane);
    const t = 1 - Math.exp(-LANE_SMOOTH * delta);
    visualXRef.current = THREE.MathUtils.lerp(visualXRef.current, targetX, t);
    const by = ballWorldY(m);
    mesh.position.set(visualXRef.current, by, BALL_ANCHOR_Z);
    const rollRate = 18 + m.speed * 220;
    rollAcc.current += delta * rollRate;
    mesh.rotation.x = -rollAcc.current;
    const lean = (visualXRef.current - targetX) * 0.22;
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, (m.ballLane - 1) * 0.07 + lean, 0.08);
    mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, -(m.ballLane - 1) * 0.11, 0.12);
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[BALL_WORLD_R, 40, 40]} />
      <meshStandardMaterial
        map={stripeMap}
        color="#ffffff"
        emissive="#0891b2"
        emissiveIntensity={0.22}
        metalness={0.45}
        roughness={0.32}
      />
    </mesh>
  );
}

function FollowCamera({
  modelRef,
  visualXRef,
  phase,
  paused,
}: {
  modelRef: MutableRefObject<BallRunState>;
  visualXRef: MutableRefObject<number>;
  phase: string;
  paused: boolean;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (phase !== 'playing' || paused) return;
    const m = modelRef.current;
    const bx = visualXRef.current;
    const by = ballWorldY(m);
    const cx = bx;
    const cy = by + CAM_HEIGHT;
    const cz = BALL_ANCHOR_Z + CAM_BACK;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.1);
    camera.lookAt(bx, by + 0.08 + RUNWAY_TILT * 1.8, CAM_LOOK_Z);
  });

  return null;
}

function GameLoop({
  modelRef,
  phase,
  paused,
  onDead,
  bump,
}: {
  modelRef: MutableRefObject<BallRunState>;
  phase: string;
  paused: boolean;
  onDead: () => void;
  bump: () => void;
}) {
  const deadSent = useRef(false);
  const frameN = useRef(0);

  useEffect(() => {
    if (phase === 'ready') deadSent.current = false;
  }, [phase]);

  useFrame((_, delta) => {
    if (phase !== 'playing' || paused) return;
    const m = modelRef.current;
    stepBallRun(delta * 1000, m);
    frameN.current += 1;
    if (frameN.current % 2 === 0) bump();
    if (!m.alive && !deadSent.current) {
      deadSent.current = true;
      onDead();
    }
  });

  return null;
}

function RunwayPlatform({
  gridMap,
  hazardMap,
}: {
  gridMap: THREE.Texture;
  hazardMap: THREE.Texture;
}) {
  const tilt = -Math.PI / 2 + RUNWAY_TILT;
  return (
    <group>
      {/* Wide foreground deck — reads as the “platform” under the ball */}
      <mesh rotation={[tilt, 0, 0]} position={[0, 0.01, -2]} receiveShadow>
        <planeGeometry args={[18, 28]} />
        <meshStandardMaterial
          map={gridMap}
          color="#ffffff"
          emissive="#0c4a6e"
          emissiveIntensity={0.06}
          metalness={0.25}
          roughness={0.65}
        />
      </mesh>

      {/* Long main strip into the distance */}
      <mesh rotation={[tilt, 0, 0]} position={[0, -0.015, -38]} receiveShadow>
        <planeGeometry args={[22, 200]} />
        <meshStandardMaterial
          map={gridMap}
          color="#ffffff"
          emissive="#082f3f"
          emissiveIntensity={0.08}
          metalness={0.2}
          roughness={0.82}
        />
      </mesh>

      {/* Hazard-style band (decorative) */}
      <mesh rotation={[tilt, 0, 0]} position={[0, 0.018, -9]}>
        <planeGeometry args={[5.2, 2.2]} />
        <meshStandardMaterial
          map={hazardMap}
          color="#ffffff"
          emissive="#fbbf24"
          emissiveIntensity={0.12}
          metalness={0.15}
          roughness={0.55}
        />
      </mesh>

      {/* Edge rails */}
      <mesh rotation={[tilt, 0, 0]} position={[-3.35, 0.035, -28]}>
        <boxGeometry args={[0.12, 0.08, 120]} />
        <meshStandardMaterial color="#020617" emissive="#22d3ee" emissiveIntensity={0.45} />
      </mesh>
      <mesh rotation={[tilt, 0, 0]} position={[3.35, 0.035, -28]}>
        <boxGeometry args={[0.12, 0.08, 120]} />
        <meshStandardMaterial color="#020617" emissive="#22d3ee" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function SceneContent({
  modelRef,
  phase,
  paused,
  onDead,
  bump,
  tick,
}: {
  modelRef: MutableRefObject<BallRunState>;
  phase: string;
  paused: boolean;
  onDead: () => void;
  bump: () => void;
  tick: number;
}) {
  const seed = modelRef.current.seed;
  const gridMap = useRunwayGridTexture();
  const hazardMap = useHazardStripeTexture();
  const visualBallXRef = useRef(laneX(modelRef.current.ballLane));

  useEffect(() => {
    if (phase === 'ready') {
      visualBallXRef.current = laneX(modelRef.current.ballLane);
    }
  }, [phase]);

  const grid = useMemo(() => {
    const g = new THREE.GridHelper(120, 60, '#22d3ee', '#0e7490');
    g.rotation.x = RUNWAY_TILT;
    g.position.set(0, 0.02, -35);
    return g;
  }, []);

  return (
    <>
      <color attach="background" args={['#06060f']} />
      <fog attach="fog" args={['#06060f', 16, 62]} />

      <ambientLight intensity={0.38} />
      <directionalLight position={[4, 14, 6]} intensity={1.15} color="#bae6fd" />
      <pointLight position={[0, 4, 1]} intensity={0.55} color="#00f0ff" />

      <NeonBuildings seed={seed} />

      <RunwayPlatform gridMap={gridMap} hazardMap={hazardMap} />

      {/* Base fill under grid texture */}
      <mesh
        rotation={[-Math.PI / 2 + RUNWAY_TILT, 0, 0]}
        position={[0, -0.04, -32]}
        receiveShadow
      >
        <planeGeometry args={[30, 200]} />
        <meshStandardMaterial
          color="#030308"
          emissive="#041015"
          emissiveIntensity={0.05}
          metalness={0.15}
          roughness={0.92}
        />
      </mesh>

      <primitive object={grid} />

      <mesh rotation={[-Math.PI / 2 + RUNWAY_TILT * 0.85, 0, 0]} position={[0, 0.045, BALL_ANCHOR_Z - 0.15]}>
        <planeGeometry args={[4.8, 0.5]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#22d3ee" emissiveIntensity={0.1} />
      </mesh>

      {modelRef.current.obstacles.map((o) => (
        <ObstacleMesh key={`${o.id}-${tick}`} o={o} />
      ))}

      <RollingBall modelRef={modelRef} visualXRef={visualBallXRef} />
      <FollowCamera modelRef={modelRef} visualXRef={visualBallXRef} phase={phase} paused={paused} />
      <GameLoop modelRef={modelRef} phase={phase} paused={paused} onDead={onDead} bump={bump} />
    </>
  );
}

type Props = {
  modelRef: MutableRefObject<BallRunState>;
  phase: 'ready' | 'playing' | 'paused' | 'over';
  paused: boolean;
  onDead: () => void;
  bump: () => void;
  tick: number;
};

export function BallRunScene3D({ modelRef, phase, paused, onDead, bump, tick }: Props) {
  return (
    <View style={styles.wrap}>
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true, alpha: false }}
        camera={{
          position: [0, CAM_HEIGHT + 0.45, BALL_ANCHOR_Z + CAM_BACK - 0.2],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
      >
        <Suspense fallback={null}>
          <SceneContent
            modelRef={modelRef}
            phase={phase}
            paused={paused}
            onDead={onDead}
            bump={bump}
            tick={tick}
          />
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0A0A0A' },
  canvas: { flex: 1 },
});
