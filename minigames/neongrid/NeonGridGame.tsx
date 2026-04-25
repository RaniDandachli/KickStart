import { SafeIonicons } from '@/components/icons/SafeIonicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';

import { COLORS, LANE_COUNT, SURGE_MAX, VEHICLE_COLORS } from './constants';
import {
  createGameRef,
  getDispPos,
  getHopArc,
  stepGame,
  tryActivateSurge,
  tryHop,
  type GameRef,
  type GridRow,
  type Log,
  type Vehicle,
} from './engine';

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  seed: number;
  subtitle?: string;
  onExit: () => void;
  onRunComplete: (score: number, durationMs: number, tapCount: number) => void;
};

const PLAYER_Y_FRAC = 0.60;
const HUD_H = 56;
/** BEST / OBJECTIVE / DISTANCE strip — fixed so playfield math stays stable. */
const STATS_RIBBON_H = 76;
/** 1 = default scale; lower values zoom out (more rows visible). */
const PLAYFIELD_ZOOM = 1;
/** Extra rows past cull bounds to reduce pop-in at row edges. */
const ROW_VIEW_BUFFER = 2;
const BEST_SCORE_KEY = 'kc_street_dash_best_blocks_v1';
/** Finger must travel this far (dp) before a swipe counts as a move. */
const SWIPE_ACTIVATE_PX = 14;
const SWIPE_COMMIT_PX = 30;

// ─── SVG Car ──────────────────────────────────────────────────────────────────
function SvgCar({ v, T, isLong }: { v: Vehicle; T: number; isLong: boolean }) {
  const C = VEHICLE_COLORS[v.colorIdx % VEHICLE_COLORS.length]!;
  const goR = v.speed > 0;
  const W = v.width * T - 6;
  const H = T - 12;
  // Body proportions
  const bodyR = 6;
  const roofW = isLong ? W * 0.52 : W * 0.6;
  const roofH = H * 0.48;
  const roofX = isLong ? (goR ? W * 0.11 : W * 0.37) : (W - roofW) / 2;
  const roofY = H * 0.05;
  const wsW = roofW * (isLong ? 0.32 : 0.48);
  const wsX = goR ? roofX + 4 : roofX + roofW - wsW - 4;
  // Wheel positions
  const wR = Math.max(4, T * 0.12);
  const w1x = W * 0.2;
  const w2x = W * 0.78;
  const wy = H - wR * 0.3;
  // Headlight
  const lightX = goR ? W - 5 : 5;
  const lightY1 = H * 0.28;
  const lightY2 = H * 0.68;

  return (
    <G>
      {/* Drop shadow */}
      <Rect x={3} y={3} width={W} height={H} rx={bodyR} fill="rgba(0,0,0,0.2)" />
      {/* 3D side face */}
      <Rect x={2} y={2} width={W} height={H} rx={bodyR} fill={C.roof} />
      {/* Top face (body) */}
      <Rect x={0} y={0} width={W} height={H} rx={bodyR} fill={C.body} stroke="rgba(0,0,0,0.55)" strokeWidth={2} />
      {/* Roof cabin shadow */}
      <Rect x={roofX + 2} y={roofY + 2} width={roofW} height={roofH} rx={4} fill="rgba(0,0,0,0.25)" />
      {/* Roof cabin */}
      <Rect x={roofX} y={roofY} width={roofW} height={roofH} rx={4} fill={C.roof} stroke="rgba(0,0,0,0.45)" strokeWidth={1.5} />
      {/* Windshield */}
      <Rect x={wsX} y={roofY + roofH * 0.12} width={wsW} height={roofH * 0.72} rx={2} fill="rgba(200,240,255,0.55)" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      {/* Roof highlight stripe */}
      <Rect x={roofX + 4} y={roofY + 3} width={roofW - 8} height={3} rx={1.5} fill="rgba(255,255,255,0.18)" />
      {/* Body highlight stripe */}
      <Rect x={6} y={4} width={W - 12} height={3} rx={1.5} fill="rgba(255,255,255,0.12)" />
      {/* Headlights */}
      <Ellipse cx={lightX} cy={lightY1} rx={4} ry={3.5} fill={goR ? '#FFFAB4' : '#FF8888'} />
      <Ellipse cx={lightX} cy={lightY2} rx={4} ry={3.5} fill={goR ? '#FFFAB4' : '#FF8888'} />
      {/* Taillights */}
      <Ellipse cx={goR ? 5 : W - 5} cy={lightY1} rx={3} ry={2.5} fill="#DC2626" opacity={0.92} />
      <Ellipse cx={goR ? 5 : W - 5} cy={lightY2} rx={3} ry={2.5} fill="#DC2626" opacity={0.92} />
      {/* Wheels */}
      <Circle cx={w1x} cy={wy} r={wR} fill="#1A1A1A" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
      <Circle cx={w1x} cy={wy} r={wR * 0.45} fill="#555" />
      <Circle cx={w2x} cy={wy} r={wR} fill="#1A1A1A" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
      <Circle cx={w2x} cy={wy} r={wR * 0.45} fill="#555" />
    </G>
  );
}

// ─── SVG Log ──────────────────────────────────────────────────────────────────
function SvgLog({ log, T }: { log: Log; T: number }) {
  const W = log.width * T - 4;
  const H = T - 14;
  const grains = Math.max(1, Math.floor(W / 16));

  return (
    <G>
      {/* Drop shadow */}
      <Rect x={3} y={3} width={W} height={H} rx={7} fill="rgba(0,0,0,0.28)" />
      {/* Side face */}
      <Rect x={2} y={2} width={W} height={H} rx={7} fill={COLORS.logSide} />
      {/* Top face */}
      <Rect x={0} y={0} width={W} height={H} rx={7} fill={COLORS.logTop} stroke="rgba(0,0,0,0.45)" strokeWidth={2} />
      {/* Highlight stripe */}
      <Rect x={5} y={3} width={W - 10} height={4} rx={2} fill="rgba(200,160,60,0.35)" />
      {/* Wood grain lines */}
      {Array.from({ length: grains }, (_, i) => {
        const gx = 10 + i * (W / (grains + 1));
        return (
          <Path key={i} d={`M${gx} 4 L${gx} ${H - 4}`} stroke="rgba(60,30,0,0.35)" strokeWidth={1.5} strokeLinecap="round" />
        );
      })}
    </G>
  );
}

// ─── SVG Tree ─────────────────────────────────────────────────────────────────
function SvgTree({ T }: { T: number }) {
  const cR = T * 0.34;
  const cx = T / 2;
  const cy = T * 0.38;
  const tW = T * 0.2;
  const tH = T * 0.34;
  const tX = cx - tW / 2;
  const tY = cy + cR * 0.7;

  return (
    <G>
      {/* Trunk shadow */}
      <Rect x={tX + 2} y={tY + 2} width={tW} height={tH} rx={3} fill="rgba(0,0,0,0.25)" />
      {/* Trunk */}
      <Rect x={tX} y={tY} width={tW} height={tH} rx={3} fill={COLORS.treeTrunk} stroke="rgba(0,0,0,0.45)" strokeWidth={1.5} />
      {/* Canopy shadow */}
      <Circle cx={cx + 3} cy={cy + 3} r={cR} fill={COLORS.treeShade} />
      {/* Canopy */}
      <Circle cx={cx} cy={cy} r={cR} fill={COLORS.treeCanopy} stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
      {/* Canopy highlight */}
      <Ellipse cx={cx - cR * 0.25} cy={cy - cR * 0.2} rx={cR * 0.45} ry={cR * 0.32} fill={COLORS.treeHighlight} opacity={0.7} />
    </G>
  );
}

// ─── SVG Player — chunky blue kart (ref); bopScale only nudges height, never stretches width ─
function SvgStreetRacer({
  T,
  surgeActive,
  bopScale,
}: {
  T: number;
  surgeActive: boolean;
  bopScale: number;
}) {
  const body = surgeActive ? '#F43F5E' : '#1D4ED8';
  const side = surgeActive ? '#9F1239' : '#1E3A8A';
  const cap = '#DC2626';
  const cx = T / 2;
  /** Keep proportions readable — engine uses 0.72–1.5 bop; never invert aspect. */
  const squash = Math.max(0.92, Math.min(1.12, bopScale));

  const carW = T * 0.5;
  const carH = T * 0.27 * squash;
  const carY = T * 0.56;
  const carX = cx - carW / 2;
  const rr = 6;

  const wR = Math.max(3.5, T * 0.085);
  const wx1 = carX + carW * 0.24;
  const wx2 = carX + carW * 0.76;
  const wy = carY + carH * 0.82;

  const headR = T * 0.1;
  const hx = cx + carW * 0.14;
  const hy = carY - headR * 0.15;

  const chevHalf = T * 0.1;
  const chevGap = T * 0.03;
  const chevBottom = carY - T * 0.06;

  return (
    <G>
      <Ellipse cx={cx + 1} cy={T * 0.9} rx={T * 0.26} ry={T * 0.035} fill="rgba(0,0,0,0.5)" />

      {/* Cyan speed pool + chevrons — point UP (toward top / forward) */}
      <Ellipse
        cx={cx}
        cy={carY - T * 0.12}
        rx={T * 0.34}
        ry={T * 0.14}
        fill={COLORS.goldBoost}
        fillOpacity={0.12}
      />
      <Path
        d={`M ${cx - T * 0.32} ${carY - T * 0.02} Q ${cx} ${carY - T * 0.38} ${cx + T * 0.32} ${carY - T * 0.02}`}
        fill="none"
        stroke={COLORS.goldBoost}
        strokeWidth={2.5}
        strokeOpacity={0.45}
        strokeLinecap="round"
      />
      {[0, 1, 2].map((i) => {
        const yBase = chevBottom - i * (chevHalf * 0.9 + chevGap);
        const tipY = yBase - chevHalf * 0.85;
        const baseY = yBase + chevHalf * 0.35;
        return (
          <Polygon
            key={i}
            points={`${cx},${tipY} ${cx - chevHalf * 0.72},${baseY} ${cx + chevHalf * 0.72},${baseY}`}
            fill={COLORS.goldBoost}
            fillOpacity={0.28 + i * 0.15}
            stroke={COLORS.goldBoost}
            strokeOpacity={0.55}
            strokeWidth={1.2}
          />
        );
      })}

      <Rect x={carX + 2} y={carY + 2} width={carW} height={carH} rx={rr} fill="rgba(0,0,0,0.4)" />
      <Rect x={carX} y={carY} width={carW} height={carH} rx={rr} fill={side} />
      <Rect
        x={carX}
        y={carY}
        width={carW}
        height={carH * 0.9}
        rx={rr}
        fill={body}
        stroke="#0F172A"
        strokeWidth={2}
      />
      <Rect x={carX + 5} y={carY + 4} width={carW - 10} height={2.5} rx={1} fill="rgba(255,255,255,0.25)" />

      <Rect
        x={carX + carW * 0.34}
        y={carY + carH * 0.14}
        width={carW * 0.32}
        height={carH * 0.42}
        rx={3}
        fill="rgba(191,219,254,0.55)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1}
      />

      <Circle cx={wx1} cy={wy} r={wR} fill="#0A0A0F" stroke="#000" strokeWidth={1.2} />
      <Circle cx={wx1} cy={wy} r={wR * 0.35} fill="#52525B" />
      <Circle cx={wx2} cy={wy} r={wR} fill="#0A0A0F" stroke="#000" strokeWidth={1.2} />
      <Circle cx={wx2} cy={wy} r={wR * 0.35} fill="#52525B" />

      <Circle cx={hx} cy={hy} r={headR} fill="#FECACA" stroke="#0F172A" strokeWidth={1} />
      <Path
        d={`M ${hx - headR * 0.9} ${hy - headR * 0.05} L ${hx + headR * 0.85} ${hy - headR * 0.12} L ${hx + headR * 0.65} ${hy - headR * 1.05} L ${hx - headR * 0.65} ${hy - headR * 0.95} Z`}
        fill={surgeActive ? '#FBBF24' : cap}
        stroke="#450A0A"
        strokeWidth={1}
      />
    </G>
  );
}

// ─── Collectible coin (spirit node) — gold + star ─────────────────────────────
function SvgSpiritNode({ T }: { T: number }) {
  const cx = T / 2;
  const cy = T / 2;
  const r = T * 0.3;
  const starOuter = r * 0.42;
  const starInner = starOuter * 0.42;
  const starPts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? starOuter : starInner;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    starPts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
  }
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r * 1.35} fill="rgba(250,204,21,0.15)" />
      <Circle cx={cx} cy={cy} r={r} fill="#CA8A04" stroke="#FDE047" strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={r * 0.72} fill="#EAB308" />
      <Polygon points={starPts.join(' ')} fill="#FFFBEB" stroke="#FACC15" strokeWidth={0.8} />
    </G>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function NeonGridGame({ seed, subtitle, onExit, onRunComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const tileSize = useMemo(() => {
    const base = Math.min(sw, 500) / LANE_COUNT;
    return Math.max(40, Math.floor(base * PLAYFIELD_ZOOM));
  }, [sw]);
  /** Bottom sheet: side buttons + safe area (no D-pad — playfield uses swipes). */
  const controlsH = useMemo(() => {
    const core = 58;
    const bottomInset = Math.max(10, insets.bottom);
    const padTop = 2;
    const webExtra = Platform.OS === 'web' ? 34 : 0;
    return padTop + core + webExtra + bottomInset;
  }, [insets.bottom]);
  const playfieldH = Math.max(120, sh - STATS_RIBBON_H - HUD_H - controlsH);

  const [, setUiTick] = useState(0);
  /** True after countdown in parent; traffic and input should run immediately (no extra tap). */
  const [started, setStarted] = useState(true);
  const [bestScore, setBestScore] = useState(0);
  const gameRef = useRef<GameRef>(createGameRef(seed));
  const startTimeRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  useEffect(() => {
    bump();
  }, [bump, seed]);

  useEffect(() => {
    void AsyncStorage.getItem(BEST_SCORE_KEY).then((raw) => {
      const n = parseInt(raw ?? '0', 10);
      if (!Number.isNaN(n) && n > 0) setBestScore(n);
    });
  }, []);

  const startRun = useCallback(() => {
    if (started) return;
    finishedRef.current = false;
    startTimeRef.current = Date.now();
    setStarted(true);
    bump();
  }, [bump, started]);

  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const g = gameRef.current;
    const score = g.score;
    setBestScore((prev) => {
      if (score > prev) {
        void AsyncStorage.setItem(BEST_SCORE_KEY, String(score));
        return score;
      }
      return prev;
    });
    onRunComplete(score, Math.max(0, Date.now() - startTimeRef.current), g.tapCount);
    bump();
  }, [bump, onRunComplete]);

  const step = useCallback(
    (totalDtMs: number) => {
      const g = gameRef.current;
      if (finishedRef.current || !started) return;
      runFixedPhysicsSteps(totalDtMs, (dtMs) => {
        stepGame(g, dtMs);
        return true;
      });
      if (!g.alive && g.deathFlash <= 0) {
        finishRun();
        return;
      }
      bump();
    },
    [bump, finishRun, started],
  );

  useRafLoop(step, started && !finishedRef.current);

  const hop = useCallback((dr: number, dc: number) => {
    if (finishedRef.current || !started) return;
    tryHop(gameRef.current, dr, dc);
    bump();
  }, [bump, started]);

  const hopRef = useRef(hop);
  hopRef.current = hop;
  const startedRef = useRef(started);
  startedRef.current = started;

  const swipePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          if (!startedRef.current || finishedRef.current) return false;
          return Math.abs(g.dx) > SWIPE_ACTIVATE_PX || Math.abs(g.dy) > SWIPE_ACTIVATE_PX;
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          if (!startedRef.current || finishedRef.current) return;
          const { dx, dy } = g;
          if (Math.abs(dx) < SWIPE_COMMIT_PX && Math.abs(dy) < SWIPE_COMMIT_PX) return;
          if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx > 0) hopRef.current(0, 1);
            else hopRef.current(0, -1);
          } else {
            if (dy < 0) hopRef.current(1, 0);
            else hopRef.current(-1, 0);
          }
        },
      }),
    [],
  );

  const activateSurge = useCallback(() => {
    if (finishedRef.current || !started) return;
    tryActivateSurge(gameRef.current);
    bump();
  }, [bump, started]);

  useWebGameKeyboard(!finishedRef.current, {
    Enter:      (d) => { if (d && !started) startRun(); },
    ArrowUp:    (d) => { if (d) hop(1, 0); },
    ArrowDown:  (d) => { if (d) hop(-1, 0); },
    ArrowLeft:  (d) => { if (d) hop(0, -1); },
    ArrowRight: (d) => { if (d) hop(0, 1); },
    KeyW: (d) => { if (d) hop(1, 0); },
    KeyS: (d) => { if (d) hop(-1, 0); },
    KeyA: (d) => { if (d) hop(0, -1); },
    KeyD: (d) => { if (d) hop(0, 1); },
    Space: (d) => { if (!d) return; if (!started) startRun(); else activateSurge(); },
  });

  // ── Render values ──────────────────────────────────────────────────────────
  const g = gameRef.current;
  const { dispRow, dispCol } = getDispPos(g);
  const hopArc = getHopArc(g);

  const playerScreenY = playfieldH * PLAYER_Y_FRAC;
  const cameraRow = dispRow;
  const gridW = LANE_COUNT * tileSize;
  const gridOffsetX = Math.max(0, (sw - gridW) / 2);

  const rowsBelow = Math.ceil(playerScreenY / tileSize) + 2 + ROW_VIEW_BUFFER;
  const rowsAbove = Math.ceil((playfieldH - playerScreenY) / tileSize) + 2 + ROW_VIEW_BUFFER;
  const visibleRows: GridRow[] = [];
  for (let r = Math.floor(cameraRow) - rowsBelow; r <= Math.ceil(cameraRow) + rowsAbove; r++) {
    const row = g.rows.get(r);
    if (row) visibleRows.push(row);
  }

  function rowScreenY(rowId: number): number {
    return playerScreenY - (rowId - cameraRow) * tileSize;
  }

  const playerPixX = gridOffsetX + dispCol * tileSize;
  const playerPixY = playerScreenY - hopArc * tileSize;

  const deathAlpha = g.deathFlash > 0 ? Math.min(0.55, g.deathFlash / 600) : 0;
  const playerFlicker = g.deathFlash > 0 && Math.floor(g.deathFlash / 60) % 2 === 0;
  const surgeFill = g.surgeCharge / SURGE_MAX;
  const surgeReady = g.surgeCharge >= SURGE_MAX && !g.surgeActive;
  const displayBest = Math.max(bestScore, g.score);
  const distanceM = Math.max(0, Math.floor(g.playerRow * 8 + g.score * 2));

  const onPause = useCallback(() => {
    Alert.alert('Paused', undefined, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Leave run', style: 'destructive', onPress: onExit },
    ]);
  }, [onExit]);

  const stubSoon = useCallback((title: string) => {
    Alert.alert(title, 'Coming soon in Street Dash.');
  }, []);

  return (
    <LinearGradient colors={[COLORS.skyBottom, COLORS.skyTop]} style={styles.root}>
      {/* ── Top: BEST · OBJECTIVE · DISTANCE (reference strip) ───────── */}
      <View style={[styles.statsRibbon, { minHeight: STATS_RIBBON_H }]}>
        <View style={styles.statsCol}>
          <SafeIonicons name="trophy" size={17} color={COLORS.hudGold} />
          <Text style={styles.statsLbl}>BEST</Text>
          <Text style={styles.statsVal}>{displayBest.toLocaleString()}</Text>
        </View>
        <View style={styles.statsCenter}>
          <Text style={styles.statsObjectiveLbl}>OBJECTIVE</Text>
          <Text style={styles.statsObjectiveTxt} numberOfLines={2}>
            Dodge cars and collect coins!
          </Text>
          {subtitle ? <Text style={styles.statsSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.statsCol}>
          <SafeIonicons name="speedometer-outline" size={17} color="#F8FAFC" />
          <Text style={styles.statsLbl}>DISTANCE</Text>
          <Text style={styles.statsVal}>{distanceM}m</Text>
        </View>
      </View>

      {/* ── HUD ──────────────────────────────────────────────────────── */}
      <View style={[styles.hud, { height: HUD_H }]}>
        <Pressable onPress={onPause} hitSlop={14} style={styles.hudPauseBtn} accessibilityLabel="Pause">
          <SafeIonicons name="pause" size={22} color={COLORS.neonPurple} />
        </Pressable>

        <View style={styles.blocksPill}>
          <View style={styles.hexIcon}>
            <Text style={styles.hexGlyph}>⬡</Text>
          </View>
          <View>
            <Text style={styles.blocksNum}>{g.score}</Text>
            <Text style={styles.blocksLbl}>BLOCKS</Text>
          </View>
        </View>

        <View style={styles.hudCenter}>
          <Text style={styles.logoStreet}>STREET</Text>
          <View style={styles.logoRow}>
            <Text style={styles.logoDash}>DASH</Text>
            <Text style={styles.logoCrown}>👑</Text>
          </View>
        </View>

        <View style={styles.hudRight}>
          <View style={styles.spiritRow}>
            <SafeIonicons name="flame" size={14} color={COLORS.neonPurple} />
            <Text style={styles.spiritLbl}>SPIRIT</Text>
          </View>
          <View style={styles.spiritTrack}>
            <LinearGradient
              colors={
                surgeReady
                  ? [COLORS.surgeOrange, COLORS.hudGold]
                  : g.surgeActive
                    ? ['#FB923C', COLORS.hudGold]
                    : [COLORS.neonPurpleDim, COLORS.neonPurple]
              }
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[
                styles.spiritFillGrad,
                { width: `${Math.round(surgeFill * 100)}%` as `${number}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* ── Playfield (swipe up/down/left/right to move) ─────────────── */}
      <View style={[styles.playfield, { height: playfieldH }]} {...swipePan.panHandlers}>
        {!started ? (
          <Pressable onPress={startRun} style={({ pressed }) => [styles.startOverlay, pressed && styles.startOverlayPressed]}>
            <Text style={styles.startTitle}>Street Dash</Text>
            <Text style={styles.startSub}>Tap anywhere to start, then cross as many blocks as you can.</Text>
            <View style={styles.startBtn}>
              <Text style={styles.startBtnTxt}>Tap anywhere</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Rows — neon street slice */}
        {visibleRows.map((row) => {
          const ry = rowScreenY(row.rowId);
          if (ry + tileSize < -tileSize || ry > playfieldH + tileSize) return null;

          const grad =
            row.kind === 'safe'
              ? row.rowId % 2 === 0
                ? (['#2c2838', '#1e1c28'] as const)
                : (['#252030', '#18151f'] as const)
              : row.kind === 'road'
                ? row.rowId % 2 === 0
                  ? (['#24222e', '#16141c'] as const)
                  : (['#1c1a24', '#121018'] as const)
                : row.rowId % 2 === 0
                  ? (['#152238', '#0f1a30'] as const)
                  : (['#121f3a', '#0c1830'] as const);

          return (
            <View
              key={row.rowId}
              style={{
                position: 'absolute',
                left: gridOffsetX,
                top: ry,
                width: gridW,
                height: tileSize,
                overflow: 'hidden',
              }}
            >
              <LinearGradient colors={grad} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
              {/* Row SVG layer — decorations + objects */}
              <Svg width={gridW} height={tileSize}>
                {row.kind === 'road' && (
                  <>
                    <Rect x={0} y={0} width={gridW} height={tileSize * 0.22} fill="rgba(10,8,18,0.92)" />
                    {Array.from({ length: 5 }, (_, i) => {
                      const bw = 12 + ((row.rowId + i * 7) % 18);
                      const bx = (i * (gridW / 4.2) + (row.rowId * 13) % 40) % (gridW - bw);
                      return <Rect key={`b${i}`} x={bx} y={2} width={bw} height={tileSize * 0.18} rx={1} fill={`rgba(${80 + i * 20},${40 + i * 10},${120 + i * 15},0.35)`} />;
                    })}
                    <Rect x={0} y={0} width={gridW} height={2} fill="rgba(147,51,234,0.25)" />
                    <Rect x={0} y={tileSize - 2} width={gridW} height={2} fill="rgba(255,255,255,0.05)" />
                    {Array.from({ length: Math.ceil(gridW / (tileSize * 0.55)) }, (_, i) => {
                      const dashW = tileSize * 0.28;
                      const gapW = tileSize * 0.24;
                      const px = i * (dashW + gapW);
                      return (
                        <Rect key={i} x={px} y={tileSize / 2 - 1.5} width={dashW} height={3} rx={1.5} fill="rgba(253,224,71,0.38)" />
                      );
                    })}
                    {/* Vertical lane dividers (3 lanes) */}
                    {[1, 2].map((lane) => {
                      const x = lane * tileSize - 1;
                      const n = Math.max(3, Math.floor(tileSize / 11));
                      return Array.from({ length: n }, (_, j) => (
                        <Rect
                          key={`lane${lane}-${j}`}
                          x={x}
                          y={tileSize * 0.22 + j * ((tileSize * 0.76) / n)}
                          width={2}
                          height={Math.max(5, (tileSize * 0.76) / n - 4)}
                          rx={1}
                          fill="rgba(248,250,252,0.2)"
                        />
                      ));
                    })}
                  </>
                )}

                {row.kind === 'safe' && (() => {
                  const mhX = (gridW * 0.12 + ((row.rowId * 47) % Math.max(1, Math.floor(gridW * 0.5)))) as number;
                  const lampSide = row.rowId % 2 === 0;
                  const lx = lampSide ? gridW - tileSize * 0.18 : tileSize * 0.18;
                  return (
                    <>
                      <Rect x={mhX} y={tileSize * 0.72} width={tileSize * 0.4} height={tileSize * 0.11} rx={4} fill="rgba(0,0,0,0.35)" />
                      <Ellipse cx={mhX + tileSize * 0.2} cy={tileSize * 0.775} rx={tileSize * 0.13} ry={tileSize * 0.048} fill="rgba(60,55,75,0.9)" stroke="rgba(100,90,120,0.5)" strokeWidth={1} />
                      <Circle cx={lx} cy={tileSize * 0.28} r={tileSize * 0.07} fill="rgba(253,224,71,0.38)" />
                      <Rect x={lx - 2} y={tileSize * 0.28} width={4} height={tileSize * 0.42} fill="rgba(40,35,55,0.9)" />
                    </>
                  );
                })()}

                {row.kind === 'river' && (
                  <>
                    <Path d={`M 8 ${tileSize * 0.5} Q ${gridW * 0.5} ${tileSize * 0.46} ${gridW - 8} ${tileSize * 0.5}`} stroke="rgba(255,215,0,0.07)" strokeWidth={1.25} fill="none" strokeLinecap="round" />
                  </>
                )}

                {/* Logs */}
                {row.kind === 'river' && row.logs.map((l) => {
                  const lx = l.col * tileSize;
                  if (lx + l.width * tileSize < -tileSize || lx > gridW + tileSize) return null;
                  return (
                    <G key={l.id} transform={`translate(${lx + 2}, 7)`}>
                      <SvgLog log={l} T={tileSize} />
                    </G>
                  );
                })}

                {/* Vehicles */}
                {row.kind === 'road' && row.vehicles.map((v) => {
                  const vx = v.col * tileSize;
                  if (vx + v.width * tileSize < -tileSize || vx > gridW + tileSize) return null;
                  return (
                    <G key={v.id} transform={`translate(${vx + 3}, 6)`}>
                      <SvgCar v={v} T={tileSize} isLong={v.width >= 2} />
                    </G>
                  );
                })}

                {/* Trees */}
                {row.kind === 'safe' && row.treeMask.map((isTree, col) => {
                  if (!isTree) return null;
                  return (
                    <G key={col} transform={`translate(${col * tileSize}, 0)`}>
                      <SvgTree T={tileSize} />
                    </G>
                  );
                })}

                {/* Spirit node */}
                {row.surgeNodeCol !== null && !row.surgeCollected && (
                  <G transform={`translate(${row.surgeNodeCol * tileSize}, 0)`}>
                    <SvgSpiritNode T={tileSize} />
                  </G>
                )}
              </Svg>

              {/* Row bottom border */}
              <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: 'rgba(0,0,0,0.22)',
              }} />
            </View>
          );
        })}

        {/* Player */}
        {!playerFlicker && (
          <View style={{
            position: 'absolute',
            left: playerPixX,
            top: playerPixY,
            width: tileSize,
            height: tileSize,
            zIndex: 10,
          }}>
            <Svg width={tileSize} height={tileSize}>
              <SvgStreetRacer T={tileSize} surgeActive={g.surgeActive} bopScale={g.bopScale} />
            </Svg>
          </View>
        )}

        {/* Spirit Time banner */}
        {g.surgeActive && (
          <View style={styles.spiritBanner} pointerEvents="none">
            <Text style={styles.spiritBannerTxt}>✦  SPIRIT TIME  ✦</Text>
          </View>
        )}

        {/* Death flash */}
        {deathAlpha > 0 && (
          <View
            style={[StyleSheet.absoluteFill, {
              backgroundColor: `rgba(220,40,40,${deathAlpha.toFixed(2)})`,
              zIndex: 20,
            }]}
            pointerEvents="none"
          />
        )}
      </View>

      {/* ── Controls — pinned low; thin purple rule above ───────────── */}
      <LinearGradient
        colors={['#1a1628', COLORS.metalPanel, '#0c0a12']}
        style={[
          styles.controlsSheet,
          {
            minHeight: controlsH,
            paddingBottom: Math.max(10, insets.bottom),
          },
        ]}
      >
        <View style={styles.controlsRow}>
          <View style={styles.sideBtnCol}>
            <MetalSideBtn icon="settings-outline" label="SETTINGS" onPress={() => stubSoon('Settings')} />
            <MetalSideBtn icon="cart-outline" label="SHOP" onPress={() => stubSoon('Shop')} />
          </View>

          <View style={styles.swipeHintWrap} pointerEvents="none">
            <SafeIonicons name="hand-left-outline" size={22} color="rgba(196,181,253,0.75)" />
            <Text style={styles.swipeHint}>Swipe the street</Text>
            <Text style={styles.swipeHintSub}>up · down · left · right</Text>
          </View>

          <View style={styles.sideBtnCol}>
            <MetalSideBtn icon="star-outline" label="MISSIONS" onPress={() => stubSoon('Missions')} />
            <MetalSideBtn
              icon="flame"
              label="BOOSTS"
              highlight={surgeReady || g.surgeActive}
              onPress={activateSurge}
            />
          </View>
        </View>
        {Platform.OS === 'web' ? (
          <Text style={styles.webHint}>{'WASD / arrows · or swipe the playfield · Space = boost'}</Text>
        ) : null}
      </LinearGradient>
    </LinearGradient>
  );
}

function MetalSideBtn({
  icon,
  label,
  onPress,
  highlight,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metalSideBtn,
        highlight && styles.metalSideBtnHot,
        pressed && styles.metalSideBtnPressed,
      ]}
    >
      <SafeIonicons name={icon as any} size={18} color={highlight ? COLORS.hudGold : COLORS.neonPurple} />
      <Text style={[styles.metalSideLbl, highlight && { color: COLORS.hudGold }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },

  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(6,4,12,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(147,51,234,0.35)',
  },
  hudPauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(253,224,71,0.75)',
    backgroundColor: 'rgba(250,204,21,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocksPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(12,10,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(253,224,71,0.2)',
  },
  hexIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(234,179,8,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexGlyph: {
    fontSize: 14,
    color: COLORS.hudGold,
  },
  blocksNum: {
    color: COLORS.hudGold,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  blocksLbl: {
    color: COLORS.hudMuted,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  hudCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStreet: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: 'rgba(147,51,234,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: -2,
  },
  logoDash: {
    color: COLORS.neonPurple,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 5,
    textShadowColor: 'rgba(192,132,252,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  logoCrown: {
    fontSize: 10,
    marginLeft: 2,
    marginTop: -4,
  },
  hudRight: {
    alignItems: 'flex-end',
    paddingRight: 6,
    minWidth: 76,
  },
  spiritRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spiritLbl: {
    color: COLORS.hudMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  spiritTrack: {
    marginTop: 4,
    width: 72,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(12,8,24,0.95)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.4)',
  },
  spiritFillGrad: {
    height: '100%',
    borderRadius: 5,
  },

  playfield: {
    overflow: 'hidden',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(168,85,247,0.55)',
  },

  statsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#05030a',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderTopColor: 'rgba(168,85,247,0.85)',
    borderBottomColor: 'rgba(168,85,247,0.85)',
  },
  statsCol: {
    width: 68,
    flexShrink: 0,
    alignItems: 'center',
  },
  statsCenter: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statsLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  statsVal: {
    color: COLORS.hudGold,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  statsObjectiveLbl: {
    color: COLORS.neonPurple,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  statsObjectiveTxt: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  statsSub: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },

  spiritBanner: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 22,
  } as any,
  spiritBannerTxt: {
    color: COLORS.hudGold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: COLORS.neonPurple,
    textShadowRadius: 12,
  },

  startOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(4,2,12,0.88)',
  },
  startOverlayPressed: {
    opacity: 0.96,
  },
  startTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  startSub: {
    color: COLORS.hudMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  startBtn: {
    minWidth: 180,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.neonPurple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  startBtnTxt: {
    color: '#0A0A0A',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  controlsSheet: {
    width: '100%',
    paddingTop: 2,
    paddingHorizontal: 6,
    justifyContent: 'center',
    flexGrow: 0,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: 4,
  },
  sideBtnCol: {
    gap: 6,
    width: 64,
    flexShrink: 0,
  },
  swipeHintWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    minWidth: 0,
  },
  swipeHint: {
    marginTop: 4,
    color: 'rgba(248,250,252,0.92)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  swipeHintSub: {
    marginTop: 2,
    color: 'rgba(148,163,184,0.9)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  metalSideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(10,8,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.45)',
  },
  metalSideBtnHot: {
    borderColor: COLORS.hudGold,
    backgroundColor: 'rgba(234,179,8,0.12)',
  },
  metalSideBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  metalSideLbl: {
    marginTop: 2,
    color: COLORS.hudMuted,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  webHint: {
    color: 'rgba(196,181,253,0.55)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 10,
  },
});