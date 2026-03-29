import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { arcade } from '@/lib/arcadeTheme';
import { getSupabase } from '@/supabase/client';
import { useRafLoop } from '@/minigames/core/useRafLoop';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';

/** 60 FPS reference frame duration (ms). */
const FRAME_MS = 1000 / 60;
const GRAVITY = 0.42;
const JUMP_VY = -9.35;
const MAX_FALL_VY = 9.6;

/** Logical world — full lane is playable (no ground band). */
const LANE_H = 420;
const PLAY_H = LANE_H;

const LANE_W = 400;
const ORB_X = 78;
const ORB_VIS_R = 15.5;
const ORB_HIT_R = 11.5;
const GATE_W = 44;
const BASE_GAP_HALF = 76;
const PIPE_SCROLL_PER_MS = 0.082;

type Gate = {
  id: number;
  x: number;
  baseGapY: number;
  gapY: number;
  gapHalf: number;
  phase: number;
  amp: number;
  scored: boolean;
  scrollMul: number;
};

type PassBurst = { id: number; x: number; y: number; bornMs: number };

type GameModel = {
  orbY: number;
  orbVy: number;
  gates: Gate[];
  nextGateId: number;
  spawnAcc: number;
  spawnIntervalMs: number;
  score: number;
  streak: number;
  taps: number;
  alive: boolean;
  trail: { x: number; y: number }[];
  bursts: PassBurst[];
  nextBurstId: number;
  worldTimeMs: number;
};

function circleHitsRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function gateHitsOrb(gate: Gate, orbY: number): boolean {
  const g0 = gate.gapY - gate.gapHalf;
  const g1 = gate.gapY + gate.gapHalf;
  const x = gate.x;
  const bx = ORB_X;
  const by = orbY;
  const br = ORB_HIT_R;
  if (bx + br < x || bx - br > x + GATE_W) return false;
  const topH = Math.max(0, g0);
  if (topH > 0 && circleHitsRect(bx, by, br, x, 0, GATE_W, topH)) return true;
  const botY = g1;
  const botH = Math.max(0, PLAY_H - botY);
  if (botH > 0 && circleHitsRect(bx, by, br, x, botY, GATE_W, botH)) return true;
  return false;
}

function createGame(): GameModel {
  return {
    orbY: PLAY_H * 0.42,
    orbVy: 0,
    gates: [],
    nextGateId: 1,
    spawnAcc: 0,
    spawnIntervalMs: 1580 + Math.random() * 420,
    score: 0,
    streak: 0,
    taps: 0,
    alive: true,
    trail: [],
    bursts: [],
    nextBurstId: 1,
    worldTimeMs: 0,
  };
}

function spawnGate(m: GameModel): void {
  const gapHalf = BASE_GAP_HALF - 10 + Math.random() * 28;
  const pad = ORB_HIT_R + 16;
  const lo = pad + gapHalf;
  const hi = PLAY_H - pad - gapHalf;
  const baseGapY = lo + Math.random() * Math.max(1, hi - lo);
  m.gates.push({
    id: m.nextGateId++,
    x: LANE_W + 28,
    baseGapY,
    gapY: baseGapY,
    gapHalf,
    phase: Math.random() * Math.PI * 2,
    amp: 10 + Math.random() * 12,
    scored: false,
    scrollMul: 0.92 + Math.random() * 0.16,
  });
}

function NeonOrb({ size, vy }: { size: number; vy: number }) {
  const r = size / 2;
  const tilt = Math.max(-22, Math.min(22, vy * 2.8));
  return (
    <View
      style={[
        styles.orbGlow,
        {
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          shadowOpacity: 0.85,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
        <LinearGradient
          colors={['#4ADE80', '#22D3EE', '#38BDF8', '#A78BFA']}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: r,
            borderWidth: 1.5,
            borderColor: 'rgba(167, 243, 208, 0.5)',
          }}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: r,
              backgroundColor: 'rgba(255,255,255,0.22)',
              width: size * 0.38,
              height: size * 0.32,
              top: size * 0.12,
              left: size * 0.14,
            },
          ]}
        />
      </View>
    </View>
  );
}

function NeonGateColumn({
  px,
  pw,
  g0,
  g1,
  playH,
  tint,
}: {
  px: number;
  pw: number;
  g0: number;
  g1: number;
  playH: number;
  tint: 'cyan' | 'violet' | 'emerald';
}) {
  const palettes = {
    cyan: ['#22D3EE', '#06B6D4', '#0E7490'] as const,
    violet: ['#A78BFA', '#8B5CF6', '#5B21B6'] as const,
    emerald: ['#34D399', '#10B981', '#047857'] as const,
  };
  const edge = ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'] as const;
  const colors = palettes[tint];
  const capPad = 3;
  const capW = pw + capPad * 2;
  const capH = Math.max(7, pw * 0.28);
  const topBodyH = Math.max(0, g0 - capH);
  const botBodyH = Math.max(0, playH - g1 - capH);

  return (
    <>
      {topBodyH > 0 ? (
        <View style={[styles.gateBlock, { left: px, width: pw, height: topBodyH, top: 0 }]}>
          <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={edge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { width: 3, opacity: 0.9 }]}
          />
        </View>
      ) : null}
      <View style={[styles.gateCap, { left: px - capPad, width: capW, top: Math.max(0, g0 - capH), height: capH }]}>
        <LinearGradient colors={[...colors]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[styles.gateCap, { left: px - capPad, width: capW, top: g1, height: capH }]}>
        <LinearGradient colors={[...colors]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      {botBodyH > 0 ? (
        <View style={[styles.gateBlock, { left: px, width: pw, height: botBodyH, top: g1 + capH }]}>
          <LinearGradient colors={[...colors]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={edge}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 3, opacity: 0.85 }}
          />
        </View>
      ) : null}
    </>
  );
}

function GridLayer({ playW, playH, scrollPx }: { playW: number; playH: number; scrollPx: number }) {
  const cols = 14;
  const rows = 18;
  const cw = playW / cols;
  const rh = playH / rows;
  const ox = scrollPx % cw;
  const oy = (scrollPx * 0.35) % rh;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: cols + 1 }, (_, i) => (
        <View
          key={`v${i}`}
          style={[
            styles.gridLine,
            {
              left: i * cw - ox,
              height: playH,
              width: 1,
            },
          ]}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, j) => (
        <View
          key={`h${j}`}
          style={[
            styles.gridLineH,
            {
              top: j * rh - oy,
              width: playW,
              height: 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ParticleField({ seed }: { seed: number }) {
  const dots = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => ({
      key: i,
      left: ((i * 47 + seed) % 100) / 100,
      top: ((i * 73 + seed * 3) % 100) / 100,
      s: 1.2 + (i % 5) * 0.35,
      o: 0.08 + (i % 7) * 0.028,
    }));
  }, [seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d) => (
        <View
          key={d.key}
          style={[
            styles.particle,
            {
              left: `${d.left * 100}%`,
              top: `${d.top * 100}%`,
              width: d.s,
              height: d.s,
              opacity: d.o,
            },
          ]}
        />
      ))}
    </View>
  );
}

function PassBurstView({
  bursts,
  scale,
  nowMs,
}: {
  bursts: PassBurst[];
  scale: number;
  nowMs: number;
}) {
  return (
    <>
      {bursts
        .filter((b) => nowMs - b.bornMs <= 520)
        .map((b) => {
        const age = nowMs - b.bornMs;
        const t = age / 520;
        const px = b.x * scale;
        const py = b.y * scale;
        const a = 1 - t;
        return (
          <View key={b.id} style={[StyleSheet.absoluteFill, { zIndex: 12 }]} pointerEvents="none">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const ang = (i / 8) * Math.PI * 2 + t * 3;
              const dist = (24 + i * 6) * scale * (0.4 + t * 0.6);
              return (
                <View
                  key={i}
                  style={[
                    styles.burstDot,
                    {
                      left: px + Math.cos(ang) * dist - 2,
                      top: py + Math.sin(ang) * dist - 2,
                      opacity: a * 0.85,
                      backgroundColor: i % 2 === 0 ? '#34D399' : '#22D3EE',
                    },
                  ]}
                />
              );
            })}
            <View
              style={[
                styles.passRing,
                {
                  left: px - 28 * scale,
                  top: py - 28 * scale,
                  width: 56 * scale,
                  height: 56 * scale,
                  borderRadius: 28 * scale,
                  opacity: a * 0.55,
                  borderColor: 'rgba(52, 211, 153, 0.9)',
                },
              ]}
            />
          </View>
        );
      })}
    </>
  );
}


export default function TapDashGame() {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const credits = profileQ.data?.credits ?? 0;

  const { width: sw, height: sh } = useWindowDimensions();
  const [laneSize, setLaneSize] = useState({ w: sw - 16, h: Math.max(320, Math.min(sh * 0.72, 620)) });

  const laneW = laneSize.w;
  const laneH = laneSize.h;
  const scale = laneH / LANE_H;
  const playPx = laneH;

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [, setUiTick] = useState(0);
  const modelRef = useRef<GameModel>(createGame());
  const flapQueueRef = useRef(0);
  const startTimeRef = useRef(0);
  const endStatsRef = useRef({ score: 0, durationMs: 0, taps: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const resetRun = useCallback(() => {
    modelRef.current = createGame();
    flapQueueRef.current = 0;
    startTimeRef.current = 0;
    setSubmitOk(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const endGame = useCallback(
    (m: GameModel) => {
      m.alive = false;
      m.streak = 0;
      const durationMs = Math.max(0, Date.now() - startTimeRef.current);
      endStatsRef.current = { score: m.score, durationMs, taps: m.taps };
      setPhase('over');
      bump();
    },
    [bump],
  );

  const step = useCallback(
    (dtMs: number) => {
      const m = modelRef.current;
      if (!m.alive) return;

      const f = Math.min(3.5, Math.max(0, dtMs / FRAME_MS));
      m.worldTimeMs += dtMs;
      const t = m.worldTimeMs;

      if (flapQueueRef.current > 0) {
        m.orbVy = JUMP_VY;
        m.taps += 1;
        flapQueueRef.current -= 1;
      }

      m.orbVy += GRAVITY * f;
      m.orbVy = Math.min(m.orbVy, MAX_FALL_VY);
      m.orbY += m.orbVy * f;

      if (m.orbY < ORB_HIT_R || m.orbY > PLAY_H - ORB_HIT_R) {
        endGame(m);
        return;
      }

      const pad = ORB_HIT_R + 16;
      for (const g of m.gates) {
        const lo = pad + g.gapHalf;
        const hi = PLAY_H - pad - g.gapHalf;
        const raw = g.baseGapY + Math.sin(t * 0.00115 + g.phase) * g.amp;
        g.gapY = Math.max(lo, Math.min(hi, raw));
      }

      m.spawnAcc += dtMs;
      if (m.spawnAcc >= m.spawnIntervalMs) {
        spawnGate(m);
        m.spawnAcc = 0;
        m.spawnIntervalMs = 1480 + Math.random() * 640;
      }

      for (const g of m.gates) {
        g.x -= PIPE_SCROLL_PER_MS * g.scrollMul * dtMs;
      }
      m.gates = m.gates.filter((g) => g.x > -GATE_W - 20);

      for (const g of m.gates) {
        if (gateHitsOrb(g, m.orbY)) {
          endGame(m);
          return;
        }
      }

      const bx = ORB_X;
      for (const g of m.gates) {
        if (!g.scored && g.x + GATE_W < bx - ORB_HIT_R) {
          g.scored = true;
          m.score += 1;
          m.streak += 1;
          m.bursts.push({
            id: m.nextBurstId++,
            x: g.x + GATE_W * 0.5,
            y: g.gapY,
            bornMs: m.worldTimeMs,
          });
        }
      }

      const tr = m.trail;
      tr.push({ x: ORB_X, y: m.orbY });
      while (tr.length > 14) tr.shift();

      m.bursts = m.bursts.filter((b) => m.worldTimeMs - b.bornMs < 550);

      bump();
    },
    [bump, endGame],
  );

  useRafLoop(step, phase === 'playing');

  const queueFlap = useCallback(() => {
    flapQueueRef.current = Math.min(2, flapQueueRef.current + 1);
  }, []);

  const onTap = useCallback(() => {
    if (phase === 'ready') {
      modelRef.current = createGame();
      startTimeRef.current = Date.now();
      modelRef.current.worldTimeMs = 0;
      setSubmitOk(false);
      setPhase('playing');
      queueFlap();
      bump();
      return;
    }
    if (phase === 'playing') {
      queueFlap();
    }
  }, [phase, bump, queueFlap]);

  const submitScore = useCallback(async () => {
    const { score, durationMs, taps } = endStatsRef.current;
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        Alert.alert('Sign in required', 'Log in to submit your score.');
        return;
      }
      const { error } = await supabase.functions.invoke('submitMinigameScore', {
        body: {
          game_type: 'tap_dash' as const,
          score,
          duration_ms: durationMs,
          taps,
        },
      });
      if (error) {
        Alert.alert('Submit failed', error.message ?? 'Could not reach server.');
        return;
      }
      setSubmitOk(true);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const m = modelRef.current;
  const orbSize = ORB_VIS_R * scale * 2;
  const scrollPx = (m.worldTimeMs * 0.024) % 200;
  const tintAt = (id: number) => (['cyan', 'violet', 'emerald'] as const)[id % 3];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.topIconBtn}
          >
            <Ionicons name="chevron-back" size={26} color="rgba(226,232,240,0.95)" />
          </Pressable>
          <View style={styles.scoreColumn}>
            <Text style={styles.scoreText}>{m.score}</Text>
            {phase === 'playing' && m.streak >= 2 ? (
              <Text style={styles.streakText}>x{m.streak} streak</Text>
            ) : (
              <Text style={styles.streakPlaceholder}> </Text>
            )}
          </View>
          <View style={styles.creditsPill}>
            <Ionicons name="wallet-outline" size={16} color="#5EEAD4" style={{ marginRight: 4 }} />
            <Text style={styles.creditsText}>{credits.toLocaleString()}</Text>
          </View>
        </View>

        <Pressable style={styles.pressFlex} onPressIn={onTap} disabled={phase === 'over'}>
          <View
            style={styles.lane}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setLaneSize({ w: width, h: height });
            }}
          >
            <LinearGradient
              colors={['#070B14', '#0B1220', '#020617']}
              locations={[0, 0.45, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ParticleField seed={42} />
            <GridLayer playW={laneW} playH={playPx} scrollPx={scrollPx} />

            <View style={[styles.playSlice, { height: playPx }]}>
              {m.gates.map((g) => {
                const px = g.x * scale;
                const pw = GATE_W * scale;
                const g0 = (g.gapY - g.gapHalf) * scale;
                const g1 = (g.gapY + g.gapHalf) * scale;
                return (
                  <View key={g.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <NeonGateColumn px={px} pw={pw} g0={g0} g1={g1} playH={playPx} tint={tintAt(g.id)} />
                  </View>
                );
              })}

              {m.trail.map((p, i) => {
                const age = m.trail.length - i;
                const a = 0.08 + (age / m.trail.length) * 0.32;
                const s = (ORB_VIS_R * 0.35 + (age / m.trail.length) * ORB_VIS_R * 0.5) * scale * 2;
                return (
                  <View
                    key={`t${i}`}
                    style={[
                      styles.trailDot,
                      {
                        left: p.x * scale - s / 2,
                        top: p.y * scale - s / 2,
                        width: s,
                        height: s,
                        borderRadius: s / 2,
                        opacity: a,
                      },
                    ]}
                  />
                );
              })}

              <PassBurstView bursts={m.bursts} scale={scale} nowMs={m.worldTimeMs} />

              <View
                style={[
                  styles.orbWrap,
                  {
                    left: ORB_X * scale - ORB_VIS_R * scale,
                    top: m.orbY * scale - ORB_VIS_R * scale,
                  },
                ]}
              >
                <NeonOrb size={orbSize} vy={m.orbVy} />
              </View>
            </View>

            <LinearGradient
              colors={['rgba(34,211,238,0.12)', 'transparent', 'rgba(167,139,250,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.vignette]}
              pointerEvents="none"
            />
          </View>

          {phase === 'ready' ? (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintBrand}>TAP DASH</Text>
              <Text style={styles.hintSub}>Neon sprint · precision run</Text>
              <Text style={styles.hintBody}>Tap to thrust · thread the gates</Text>
              <Text style={styles.hintCta}>Tap to start</Text>
            </View>
          ) : null}
        </Pressable>

        {phase === 'over' ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
              <Text style={styles.goTitle}>Run ended</Text>
              <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
              <AppButton title="Play Again" onPress={resetRun} className="mb-3" />
              <AppButton
                title={submitOk ? 'Score submitted' : 'Submit Score'}
                variant="secondary"
                loading={submitting}
                disabled={submitOk || submitting}
                onPress={submitScore}
              />
              {submitting ? (
                <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#04080f' },
  root: { flex: 1, width: '100%' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 30,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreText: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(34, 211, 238, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  streakText: {
    marginTop: 2,
    color: 'rgba(52, 211, 153, 0.95)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  streakPlaceholder: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.35)',
    minWidth: 72,
    justifyContent: 'center',
  },
  creditsText: {
    color: 'rgba(226, 232, 240, 0.95)',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pressFlex: { flex: 1, width: '100%', alignItems: 'center' },
  lane: {
    flex: 1,
    width: '100%',
    minHeight: 280,
    maxWidth: 440,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  playSlice: {
    width: '100%',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(56, 189, 248, 0.07)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(226, 232, 240, 0.35)',
  },
  gateBlock: {
    position: 'absolute',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  gateCap: {
    position: 'absolute',
    borderRadius: 5,
    overflow: 'hidden',
    shadowColor: '#A78BFA',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  trailDot: {
    position: 'absolute',
    backgroundColor: 'rgba(52, 211, 153, 0.65)',
    zIndex: 8,
  },
  burstDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  passRing: {
    position: 'absolute',
    borderWidth: 2,
    zIndex: 11,
  },
  orbWrap: {
    position: 'absolute',
    zIndex: 16,
  },
  orbGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34D399',
  },
  vignette: { opacity: 0.9 },
  hint: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(2, 6, 15, 0.55)',
  },
  hintBrand: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 6,
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowRadius: 14,
  },
  hintSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  hintBody: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  hintCta: {
    color: '#5EEAD4',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    backgroundColor: 'rgba(10, 15, 28, 0.98)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  goTitle: {
    color: arcade.white,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  goScore: {
    color: arcade.textMuted,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
});
