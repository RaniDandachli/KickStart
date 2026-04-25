import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import {
  COLORS,
  SHIP_H,
  SHIP_W,
  SHIP_X_OFFSET,
} from '@/minigames/neonship/constants';
import { createShipGame, stepShipGame, type ShipGameState } from '@/minigames/neonship/engine';
import type { Spike } from '@/minigames/neonship/types';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

type Props = {
  seed: number;
  subtitle?: string;
  skipStartOverlay?: boolean;
  onExit: () => void;
  onRunComplete: (score: number, durationMs: number, tapCount: number) => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  hot: boolean;
};

function makeRng(s: number) {
  let t = s >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function NeonShipGame({ seed, subtitle, skipStartOverlay, onExit, onRunComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const hudH = 52;
  /** Non-finite window size → NaN in Math.max → NaN in all SVG paths → native RNSVG crash. */
  const shSafe = Number.isFinite(sh) && sh > 0 ? sh : 667;
  const swSafe = Number.isFinite(sw) && sw > 0 ? sw : 390;
  const playH = Math.max(280, shSafe - hudH - 8);

  const [, setTick] = useState(0);
  const gameRef = useRef<ShipGameState>(createShipGame(seed, playH));
  const thrustRef = useRef(false);
  const finishedRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastThrustRef = useRef(false);
  const [loopOn, setLoopOn] = useState(false);
  const [started, setStarted] = useState(false);
  /** Mirrors end-of-run for UI (refs don’t re-render); thrust overlay uses this, not `finishedRef`. */
  const [runEnded, setRunEnded] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const rngRef = useRef(makeRng(seed));
  const playHRef = useRef(playH);
  playHRef.current = playH;
  const bump = useCallback(() => setTick((t) => t + 1), []);

  /**
   * Reset run when seed or H2H auto-start changes — do NOT list `playH` as a dependency.
   * When the window reports its final size, `playH` changes once; re-running this would
   * clear `started` / `loopOn` and kill the game right after "Start flight".
   */
  useEffect(() => {
    const ph = playHRef.current;
    gameRef.current = createShipGame(seed, ph);
    rngRef.current = makeRng(seed ^ 0xdeadbeef);
    thrustRef.current = false;
    finishedRef.current = false;
    lastThrustRef.current = false;
    particlesRef.current = [];
    setLoopOn(false);
    setStarted(false);
    setRunEnded(false);
    bump();
    if (skipStartOverlay) {
      startTimeRef.current = Date.now();
      finishedRef.current = false;
      setStarted(true);
      setLoopOn(true);
      bump();
    }
  }, [seed, bump, skipStartOverlay]);

  /** While idle, keep corridor geometry in sync with layout height only (no run reset). */
  useEffect(() => {
    if (started || loopOn || skipStartOverlay) return;
    gameRef.current = createShipGame(seed, playH);
    bump();
  }, [playH, seed, started, loopOn, skipStartOverlay, bump]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLoopOn(false);
    setRunEnded(true);
    const g = gameRef.current;
    onRunComplete(g.score, Math.max(0, Date.now() - startTimeRef.current), g.tapCount);
  }, [onRunComplete]);

  const step = useCallback(
    (dtMs: number) => {
      const g = gameRef.current;
      if (!loopOn || finishedRef.current || !g.alive) return;
      const thrust = thrustRef.current;
      if (thrust && !lastThrustRef.current) g.tapCount += 1;
      lastThrustRef.current = thrust;

      runFixedPhysicsSteps(dtMs, (h) => {
        stepShipGame(g, h, thrust);
        return g.alive;
      });

      // Spawn exhaust particles
      const rng = rngRef.current;
      const shipCx = SHIP_X_OFFSET + 3;
      const shipCy = g.shipY + SHIP_H / 2;
      const count = thrust ? 3 : 1;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: shipCx,
          y: shipCy + (rng() - 0.5) * 7,
          vx: -(55 + rng() * 85),
          vy: (rng() - 0.5) * 26,
          life: 0.2 + rng() * 0.2,
          maxLife: 0.35,
          r: thrust ? 2.5 + rng() * 2 : 1 + rng() * 1.2,
          hot: thrust,
        });
      }

      const dt = Math.min(0.05, dtMs / 1000);
      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, life: p.life - dt, x: p.x + p.vx * dt, y: p.y + p.vy * dt }))
        .filter((p) => p.life > 0);

      if (!g.alive) finish();
      bump();
    },
    [bump, finish, loopOn],
  );

  useRafLoop(step, loopOn);

  const beginRun = useCallback(() => {
    startTimeRef.current = Date.now();
    gameRef.current = createShipGame(seed, playH);
    rngRef.current = makeRng(seed ^ 0xdeadbeef);
    thrustRef.current = false;
    lastThrustRef.current = false;
    finishedRef.current = false;
    particlesRef.current = [];
    setRunEnded(false);
    setStarted(true);
    setLoopOn(true);
    bump();
  }, [seed, playH, bump]);

  const start = useCallback(() => {
    if (started) return;
    beginRun();
  }, [started, beginRun]);

  useWebGameKeyboard(started && loopOn && !runEnded, {
    Space: (d) => {
      thrustRef.current = d;
      bump();
    },
    ArrowUp: (d) => {
      thrustRef.current = d;
      bump();
    },
  });

  const g = gameRef.current;
  const scroll = g.scroll;
  const isThrusting = thrustRef.current;

  // Rocket position
  const rx = SHIP_X_OFFSET;
  const ry = g.shipY;
  const rw = SHIP_W;
  const rh = SHIP_H;
  const midY = ry + rh / 2;

  // Rocket SVG paths (nose points right, origin at left)
  const bodyPath = [
    `M${rx + rw},${midY}`,
    `L${rx + rw - 7},${ry + 2}`,
    `L${rx + 5},${ry + 3}`,
    `L${rx + 3},${midY}`,
    `L${rx + 5},${ry + rh - 3}`,
    `L${rx + rw - 7},${ry + rh - 2}`,
    'Z',
  ].join(' ');

  const topFinPath = [
    `M${rx + 3},${ry + 2}`,
    `L${rx + 1},${ry - 7}`,
    `L${rx + 13},${ry + 5}`,
    `L${rx + 5},${ry + 3}`,
    'Z',
  ].join(' ');

  const botFinPath = [
    `M${rx + 3},${ry + rh - 2}`,
    `L${rx + 1},${ry + rh + 7}`,
    `L${rx + 13},${ry + rh - 5}`,
    `L${rx + 5},${ry + rh - 3}`,
    'Z',
  ].join(' ');

  // Flame path — bezier curve behind nozzle mouth
  const flamePath = isThrusting
    ? `M${rx + 4},${midY - 5} C${rx - 20},${midY - 2} ${rx - 20},${midY + 2} ${rx + 4},${midY + 5}`
    : `M${rx + 4},${midY - 3} C${rx - 9},${midY - 1} ${rx - 9},${midY + 1} ${rx + 4},${midY + 3}`;

  function segForSpike(spike: Spike) {
    for (const seg of g.segments) {
      if (spike.x >= seg.x0 && spike.x < seg.x1) return seg;
    }
    return null;
  }

  function spikePoints(spike: Spike, seg: { topH: number; bottomH: number }): string | null {
    const cx = spike.x - scroll;
    const hw = spike.hw;
    const h = spike.h;
    let base: number;
    let tip: number;
    if (spike.onTop) {
      base = seg.topH;
      tip = base + h;
    } else {
      base = playH - seg.bottomH;
      tip = base - h;
    }
    const xs = [cx - hw, cx, cx + hw];
    const ys = [base, tip, base];
    if (![...xs, ...ys].every((n) => Number.isFinite(n))) return null;
    return `${xs[0]},${ys[0]} ${xs[1]},${ys[1]} ${xs[2]},${ys[2]}`;
  }

  return (
    <View style={styles.root}>
      {/* HUD */}
      <View style={[styles.hud, { height: hudH }]}>
        <Pressable onPress={onExit} hitSlop={12} style={styles.back}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <View style={styles.hudMid}>
          <Text style={styles.title}>VOID GLIDER</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreNum}>{g.score}</Text>
          <Text style={styles.scoreLbl}>DIST</Text>
        </View>
        {Platform.OS === 'web' && started && !runEnded ? (
          <Text style={styles.hudWebHint} pointerEvents="none">
            Hold click / Space
          </Text>
        ) : null}
      </View>

      {/* Play area */}
      <View style={[styles.playWrap, { height: playH }]}>
        {/* Background gradient */}
        <LinearGradient
          pointerEvents="none"
          colors={[COLORS.skyTop, COLORS.skyBot]}
          style={StyleSheet.absoluteFill}
        />

        {/* Corridor blocks — Views stay, matching original pattern */}
        {g.segments.map((seg, i) => {
          const w = seg.x1 - seg.x0;
          const left0 = seg.x0 - scroll;
          const left1 = seg.x1 - scroll;
          if (left1 < -40 || left0 > swSafe + 40) return null;
          return (
            <View key={`${seg.x0}-${i}`} pointerEvents="none">
              {/* Top block */}
              <View
                style={[
                  styles.block,
                  {
                    left: left0,
                    top: 0,
                    width: w,
                    height: seg.topH,
                    backgroundColor: COLORS.block,
                    borderColor: COLORS.blockEdge,
                  },
                ]}
              />
              {/* Top neon edge glow strip */}
              <View
                style={[
                  styles.edgeGlow,
                  { left: left0, top: seg.topH - 3, width: w },
                ]}
              />

              {/* Bottom block */}
              <View
                style={[
                  styles.block,
                  {
                    left: left0,
                    top: playH - seg.bottomH,
                    width: w,
                    height: seg.bottomH,
                    backgroundColor: COLORS.block,
                    borderColor: COLORS.blockEdge,
                  },
                ]}
              />
              {/* Bottom neon edge glow strip */}
              <View
                style={[
                  styles.edgeGlow,
                  { left: left0, top: playH - seg.bottomH, width: w },
                ]}
              />
            </View>
          );
        })}

        {/* Native Svg often steals hits even with pointerEvents="none"; wrap + keep draw under the touch layer. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill} collapsable={false}>
          <Svg
            width={swSafe}
            height={playH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
          {/* Wall spike decorations */}
          {g.segments.map((seg, i) => {
            const lx = seg.x0 - scroll;
            const lx2 = seg.x1 - scroll;
            if (lx2 < -40 || lx > swSafe + 40) return null;
            const w = lx2 - lx;
            const topBase = seg.topH;
            const botBase = playH - seg.bottomH;
            const topSpikes = buildWallSpikePaths(lx, topBase, w, true);
            const botSpikes = buildWallSpikePaths(lx, botBase, w, false);
            const wallD = `${topSpikes} ${botSpikes}`.trim();
            if (!wallD || !Number.isFinite(lx) || !Number.isFinite(w)) return null;
            return (
              <Path
                key={`wsp-${i}-${seg.x0}`}
                d={wallD}
                fill="rgba(244,114,182,0.42)"
                stroke="rgba(244,114,182,0.18)"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Mid-corridor obstacle spikes */}
          {g.spikes.map((spike, i) => {
            const scx = spike.x - scroll;
            if (scx + spike.hw < -20 || scx - spike.hw > swSafe + 20) return null;
            const seg = segForSpike(spike);
            if (!seg) return null;
            const pts = spikePoints(spike, seg);
            if (!pts) return null;
            const tipCy = spike.onTop
              ? seg.topH + spike.h - 2
              : playH - seg.bottomH - spike.h + 2;
            if (!Number.isFinite(scx) || !Number.isFinite(tipCy)) return null;
            return (
              <G key={`sp-${i}-${spike.x}`}>
                <Ellipse
                  cx={scx}
                  cy={tipCy}
                  rx={spike.hw + 3}
                  ry={4}
                  fill="#be123c"
                  opacity={0.22}
                />
                <Polygon
                  points={pts}
                  fill="#f472b6"
                  stroke="#fda4af"
                  strokeWidth={1.5}
                />
                <Circle cx={scx} cy={tipCy} r={1.8} fill="#fff" opacity={0.65} />
              </G>
            );
          })}

          {/* Exhaust particles */}
          {particlesRef.current.map((p, i) => {
            const a = Math.max(0, p.life / p.maxLife);
            return (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={Math.max(0.3, p.r * a)}
                fill={p.hot ? `rgba(251,191,36,${a.toFixed(2)})` : `rgba(167,139,250,${(a * 0.8).toFixed(2)})`}
              />
            );
          })}

          {/* Flame */}
          {g.alive ? (
            <Path
              d={flamePath}
              fill="none"
              stroke={isThrusting ? '#f97316' : '#a855f7'}
              strokeWidth={isThrusting ? 7 : 4}
              strokeLinecap="round"
              opacity={isThrusting ? 0.85 : 0.45}
            />
          ) : null}
          {g.alive && isThrusting ? (
            <Path
              d={flamePath}
              fill="none"
              stroke="#fef3c7"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.7}
            />
          ) : null}

          {/* Rocket body */}
          {g.alive ? (
            <>
              {/* Bottom fin */}
              <Path d={botFinPath} fill="#7c3aed" stroke="#a78bfa" strokeWidth={0.8} />
              {/* Top fin */}
              <Path d={topFinPath} fill="#7c3aed" stroke="#a78bfa" strokeWidth={0.8} />
              {/* Main body */}
              <Path d={bodyPath} fill="#FFD700" stroke="#FFE082" strokeWidth={1} />
              {/* Body highlight stripe */}
              <Path
                d={`M${rx + rw - 5},${ry + 4} L${rx + 7},${ry + 6}`}
                stroke="#e0f9ff"
                strokeWidth={1.2}
                strokeLinecap="round"
                opacity={0.5}
              />
              {/* Cockpit window */}
              <Ellipse
                cx={rx + rw * 0.52}
                cy={midY}
                rx={5}
                ry={4}
                fill="#164e63"
                stroke="#FFD700"
                strokeWidth={1}
              />
              <Ellipse
                cx={rx + rw * 0.52 - 1}
                cy={midY - 1}
                rx={2}
                ry={1.5}
                fill="#e0f9ff"
                opacity={0.6}
              />
              {/* Nose tip glow */}
              <Circle cx={rx + rw} cy={midY} r={2} fill="#e0f9ff" opacity={0.55} />
            </>
          ) : null}
          </Svg>
        </View>

        {/* Start overlay — tap anywhere to start (button remains visual CTA). */}
        {!started ? (
          <Pressable onPress={start} style={({ pressed }) => [styles.startOverlay, pressed && styles.startOverlayPressed]}>
            <Text style={styles.startTitle}>Void Glider</Text>
            <Text style={styles.startSub}>
              Hold to thrust up · release to fall · dodge the corridor and spikes
            </Text>
            <View style={styles.startBtn}>
              <Text style={styles.startBtnTxt}>Tap anywhere to start</Text>
            </View>
          </Pressable>
        ) : null}

      </View>

      {/* Thrust MUST sit outside `playWrap` — `overflow: 'hidden'` breaks hit-testing on Android; sibling overlay covers playfield only. */}
      {started && !runEnded ? (
        <Pressable
          style={[styles.thrustOverlay, { top: hudH, height: playH }]}
          onPressIn={() => {
            thrustRef.current = true;
            bump();
          }}
          onPressOut={() => {
            thrustRef.current = false;
            bump();
          }}
        >
          <View style={styles.thrustOverlayFill} collapsable={false} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Build a single SVG path string for a full row of wall spikes. */
function buildWallSpikePaths(lx: number, baseY: number, w: number, pointDown: boolean): string {
  const count = Math.max(2, Math.floor(w / 13));
  const sw = w / count;
  let d = '';
  for (let i = 0; i < count; i++) {
    const x0 = lx + i * sw;
    const x1 = x0 + sw;
    const mx = x0 + sw / 2;
    const tipY = pointDown ? baseY + 9 : baseY - 9;
    d += `M${x0},${baseY} L${mx},${tipY} L${x1},${baseY} `;
  }
  return d.trim();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.skyTop, position: 'relative' },
  hud: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232,121,249,0.2)',
    backgroundColor: 'rgba(10,4,20,0.95)',
  },
  back: { padding: 10 },
  backTxt: { color: COLORS.hud, fontSize: 20, fontWeight: '900' },
  hudMid: { flex: 1, alignItems: 'center' },
  title: {
    color: 'rgba(232,121,249,0.9)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
  sub: { color: COLORS.hudMuted, fontSize: 10, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end', paddingRight: 8, minWidth: 56 },
  scoreNum: { color: COLORS.shipFill, fontSize: 22, fontWeight: '900' },
  scoreLbl: { color: COLORS.hudMuted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  hudWebHint: {
    position: 'absolute',
    right: 8,
    bottom: 4,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(200,180,220,0.55)',
  },
  playWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  /** Sibling of `playWrap`, not a child — avoids `overflow: 'hidden'` touch bugs. */
  thrustOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2000,
    elevation: 2000,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  thrustOverlayFill: {
    width: '100%',
    height: '100%',
    minHeight: 48,
    minWidth: 48,
  },
  block: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  edgeGlow: {
    position: 'absolute',
    height: 3,
    backgroundColor: COLORS.blockEdge,
    opacity: 0.95,
  },
  startOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,4,20,0.78)',
    paddingHorizontal: 24,
  },
  startOverlayPressed: {
    opacity: 0.96,
  },
  startTitle: { color: COLORS.hud, fontSize: 28, fontWeight: '900', marginBottom: 8 },
  startSub: {
    color: COLORS.hudMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  startBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: COLORS.blockEdge,
  },
  startBtnTxt: { color: '#1a0524', fontSize: 16, fontWeight: '900' },
});