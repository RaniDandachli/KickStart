// ─── NEON RUNNER — Game Screen ─────────────────────────────────────────────
// Animated.Value + setValue() for world/player movement — no React re-renders
// per frame. Performance fixes: no ground grid Views, no per-block grid lines,
// SVG spikes are simple (no per-spike gradient IDs), zone label auto-hides.

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
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
import Svg, { Circle, Defs, Polygon, Stop, LinearGradient as SvgGrad } from 'react-native-svg';

import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import {
  GROUND_Y,
  NR,
  ZONE_THEMES,
  getZoneTheme,
  type ZoneTheme,
} from '@/minigames/dashduel/constants';
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

// ─── Props ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function camX(playerWorldX: number): number {
  return (
    playerWorldX -
    NR.PLAY_W * NR.CAMERA_VIEW_WIDTH_MULT * NR.PLAYER_SCREEN_X_RATIO
  );
}

function safeInt(n: number): number {
  return !Number.isFinite(n) || n < 0 ? 0 : Math.floor(n);
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function obsKey(o: Obstacle): string {
  const b = `${o.kind}:${Math.round(o.x)}:${Math.round(o.y)}:${Math.round(o.w)}:${Math.round(o.h)}`;
  return o.kind === 'ring' ? `${b}:${o.used ? 1 : 0}` : b;
}

const HUD_MIN_MS = 100;
const MAX_VIS_OBS = 80;
const PAR_FAR  = 0.08;
const PAR_NEAR = 0.28;

// ── Land particles ────────────────────────────────────────────────────────────

function spawnLand(particles: Particle[], worldX: number, y: number): void {
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI * (i / 5);
    const speed = 0.6 + Math.random() * 1.1;
    particles.push({
      x: worldX + NR.PLAYER_W / 2, y: y + NR.PLAYER_H,
      vx: Math.cos(angle) * speed, vy: -Math.abs(Math.sin(angle)) * speed * 0.7,
      life: 180 + Math.random() * 80, maxLife: 260,
      radius: 1.2 + Math.random() * 1.3, color: '#39e600',
    });
  }
}

// ── Background rect data (stable per seed) ────────────────────────────────────

interface BgR { x: number; y: number; w: number; h: number }

function makeBgRects(seed: number, pw: number, ph: number, n: number, layer: number): BgR[] {
  const skyH = ph * 0.80;
  return Array.from({ length: n }, (_, i) => {
    const r1 = ((seed * 1664525 + i * 22695477 + 1013904223 + layer * 999) >>> 0) / 0xffffffff;
    const r2 = ((seed * 6364136  + i * 1664525  + 1442695037 + layer * 777) >>> 0) / 0xffffffff;
    const r3 = ((seed * 1103515245 + i * 12345  + 2531011    + layer * 555) >>> 0) / 0xffffffff;
    const r4 = ((seed * 214013    + i * 2531011  + 6364136    + layer * 333) >>> 0) / 0xffffffff;
    return {
      x: r3 * (pw * 1.5),
      y: r4 * (skyH * 0.9),
      w: pw * (0.06 + r1 * 0.20),
      h: skyH * (0.12 + r2 * 0.55),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DashDuelGame({ seed, practiceLabel, prizeLabel, onExit, onRoundComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const lw = Math.max(sw, sh);
  const lh = Math.min(sw, sh);
  const insets = useSafeAreaInsets();

  const HUD_H = 52, HINT_H = 28;
  const availW = lw - Math.max(insets.left, insets.right) * 2 - 8;
  const availH = lh - insets.top - insets.bottom - HUD_H - HINT_H;
  const rawScale = Math.min(availW / NR.PLAY_W, availH / NR.PLAY_H);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? Math.max(0.1, Math.min(rawScale, 6)) : 1;
  const PW = NR.PLAY_W * scale;
  const PH = NR.PLAY_H * scale;
  /** Wider camera window in world units → slightly zoomed out horizontally for lookahead */
  const sx = scale / NR.CAMERA_VIEW_WIDTH_MULT;
  const sy = scale;

  // ── Engine refs ──────────────────────────────────────────────────────────
  const stateRef   = useRef<RunState | null>(null);
  const inputRef   = useRef<InputState>(createInputState());
  const doneRef    = useRef(false);
  const abortRef   = useRef(false);
  const hudTRef    = useRef(0);
  const lastObsN   = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleRef   = useRef(scale);
  scaleRef.current = scale;

  const particlesRef = useRef<Particle[]>([]);
  const zFlashRef    = useRef(0);
  const [zoneFlash, setZoneFlash]   = useState(false);
  const [theme, setTheme]           = useState<ZoneTheme>(ZONE_THEMES[0]);
  const [zoneLabel, setZoneLabel]   = useState('');
  const zoneLblTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animated values ──────────────────────────────────────────────────────
  // World translate
  const worldTx  = useRef(new Animated.Value(0)).current;
  // Player position & rotation
  const playerL  = useRef(new Animated.Value(0)).current;
  const playerT  = useRef(new Animated.Value(0)).current;
  const playerDeg = useRef(new Animated.Value(0)).current;
  // Parallax
  const parFar   = useRef(new Animated.Value(0)).current;
  const parNear  = useRef(new Animated.Value(0)).current;

  const playerRotate = useMemo(() =>
    playerDeg.interpolate({ inputRange: [-72000, 72000], outputRange: ['-72000deg', '72000deg'] }),
  [playerDeg]);

  const [, setTick] = useState(0);
  const [engineOn, setEngineOn] = useState(true);
  const [strip, setStrip] = useState(false);

  if (stateRef.current === null) {
    stateRef.current = createRunState(seed);
    inputRef.current = createInputState();
  }

  const bump = useCallback(() => setTick(t => t + 1), []);

  // ── BG rects (stable) ────────────────────────────────────────────────────
  const bgFar  = useMemo(() => makeBgRects(seed, NR.PLAY_W, NR.PLAY_H, 12, 0), [seed]);
  const bgNear = useMemo(() => makeBgRects(seed, NR.PLAY_W, NR.PLAY_H, 8,  1), [seed]);

  // ── RAF loop ─────────────────────────────────────────────────────────────
  const loop = useCallback((dtMs: number) => {
    if (abortRef.current) return;
    const s = stateRef.current;
    if (!s || s.phase !== 'playing' || doneRef.current) return;

    runFixedPhysicsSteps(dtMs, (h) => {
      if (!s || abortRef.current) return false;
      stepRun(s, inputRef.current, h);
      return s.phase === 'playing';
    });

    const snap = stateRef.current!;
    const sc = scaleRef.current;
    const sxLoop = sc / NR.CAMERA_VIEW_WIDTH_MULT;
    const syLoop = sc;
    const cx = camX(snap.player.worldX);

    // Update Animated values (native driver NOT used — values drive layout directly)
    worldTx.setValue(safe(-cx * sxLoop));
    playerL.setValue(safe(snap.player.worldX * sxLoop));
    playerT.setValue(safe(snap.player.y * syLoop));
    playerDeg.setValue(safe((snap.player.angle * 180) / Math.PI));
    parFar.setValue(
      safe(-(snap.scroll * PAR_FAR * sxLoop) % (NR.PLAY_W * sxLoop * 2.5)),
    );
    parNear.setValue(
      safe(-(snap.scroll * PAR_NEAR * sxLoop) % (NR.PLAY_W * sxLoop * 2.5)),
    );

    // Particles
    if (snap.player.justLanded) spawnLand(particlesRef.current, snap.player.worldX, snap.player.y);
    for (const p of particlesRef.current) {
      p.x += p.vx * (dtMs / 16); p.y += p.vy * (dtMs / 16);
      p.vy += 0.08 * (dtMs / 16); p.life -= dtMs;
    }
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Zone change
    if (snap.zoneChanged) {
      const t = getZoneTheme(snap.tier);
      setTheme(t);
      setZoneFlash(true);
      setZoneLabel(t.name);
      if (zoneLblTimer.current) clearTimeout(zoneLblTimer.current);
      zoneLblTimer.current = setTimeout(() => {
        setZoneFlash(false);
        setZoneLabel('');
        zoneLblTimer.current = null;
      }, 1800);
    }

    // HUD bump (~10fps)
    const now = performance.now();
    const oc = snap.obstacles.length;
    if (snap.phase === 'dead' || oc !== lastObsN.current || now - hudTRef.current > HUD_MIN_MS) {
      lastObsN.current = oc; hudTRef.current = now;
      bump();
    }

    if (snap.phase === 'dead' && !doneRef.current) {
      doneRef.current = true;
      setStrip(true);
      setEngineOn(false);
      const pts = safeInt(scoreFromState(snap));
      const dist = safeInt(snap.scroll);
      const dur  = safeInt(snap.elapsed);
      const jmps = safeInt(snap.jumpCount);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (abortRef.current) return;
        try { onRoundComplete(pts, dist, dur, jmps); } catch {}
      }, 72);
    }
  }, [bump, onRoundComplete]);

  useRafLoop(loop, engineOn);

  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (zoneLblTimer.current) { clearTimeout(zoneLblTimer.current); zoneLblTimer.current = null; }
    abortRef.current = false; doneRef.current = false;
    hudTRef.current = 0; lastObsN.current = 0;
    particlesRef.current = [];
    setStrip(false); setTheme(ZONE_THEMES[0]); setZoneFlash(false); setZoneLabel('');
    stateRef.current = createRunState(seed);
    inputRef.current = createInputState();
    setEngineOn(true);
    bump();
  }, [seed, bump]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (zoneLblTimer.current) clearTimeout(zoneLblTimer.current);
  }, []);

  useLayoutEffect(() => {
    if (strip) return;
    const st = stateRef.current; if (!st) return;
    const sc = scale;
    const sxLayout = sc / NR.CAMERA_VIEW_WIDTH_MULT;
    const syLayout = sc;
    const cx = camX(st.player.worldX);
    worldTx.setValue(safe(-cx * sxLayout));
    playerL.setValue(safe(st.player.worldX * sxLayout));
    playerT.setValue(safe(st.player.y * syLayout));
    playerDeg.setValue(safe((st.player.angle * 180) / Math.PI));
  }, [scale, seed, strip]);

  // ── Render data ──────────────────────────────────────────────────────────
  const s  = stateRef.current!;
  const cx = camX(s.player.worldX);
  const visLeft  = cx - 40;
  const visRight = cx + NR.PLAY_W * NR.CAMERA_VIEW_WIDTH_MULT + 60;

  const visObs: Obstacle[] = [];
  if (!strip) {
    for (const o of s.obstacles) {
      if (o.x + o.w < visLeft || o.x > visRight) continue;
      visObs.push(o);
      if (visObs.length >= MAX_VIS_OBS) break;
    }
  }

  const visPar = strip ? [] : particlesRef.current.filter(
    p =>
      p.x > cx - 10 &&
      p.x < cx + NR.PLAY_W * NR.CAMERA_VIEW_WIDTH_MULT + 10,
  );
  const trailPts = strip ? [] : s.player.trail;

  const obs = s.obstacles;
  const worldW = Math.min(
    Math.max(
      NR.PLAY_W * 3,
      obs.length > 0 ? obs[obs.length - 1]!.x + 200 : 0,
      s.player.worldX + NR.PLAY_W * 2,
    ) * sx,
    28000,
  );

  const GY = GROUND_Y * sy; // ground y in screen coords
  const GH = (NR.PLAY_H - GROUND_Y) * sy;
  const PW_player = NR.PLAYER_W * sx;
  const PH_player = NR.PLAYER_H * sy;

  const onJumpIn  = () => { inputRef.current.jumpPressedThisFrame = true; inputRef.current.jumpHeld = true; };
  const onJumpOut = () => { inputRef.current.jumpHeld = false; };

  useWebGameKeyboard(engineOn && !strip, {
    Space:   d => { if (d) onJumpIn(); else onJumpOut(); },
    ArrowUp: d => { if (d) onJumpIn(); else onJumpOut(); },
  });

  const handleExit = useCallback(() => {
    abortRef.current = true;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setEngineOn(false);
    onExit();
  }, [onExit]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.sky }]}>
      <MemoHud
        distance={safeInt(s.scroll)} score={safeInt(scoreFromState(s))}
        practiceLabel={practiceLabel} prizeLabel={prizeLabel}
        onBack={handleExit} speedFrac={1}
        timeLeftMs={NR.ROUND_MS > 0 ? NR.ROUND_MS - s.elapsed : 0}
      />
      <MemoStrip
        p1Alive={!s.player.dead} p2Alive p1Dist={safeInt(s.scroll)}
        p2Dist={safeInt(s.scroll * 0.92)} p1Flash={s.player.dead ? 1 : 0}
      />

      {/* ── Playfield ── */}
      {strip ? (
        <View style={[styles.field, { width: PW, height: PH, backgroundColor: theme.sky, borderColor: theme.accentColor + '55' }]} />
      ) : (
        <Pressable
          style={[styles.field, { width: PW, height: PH, borderColor: theme.accentColor + '88' }]}
          onPressIn={onJumpIn} onPressOut={onJumpOut}
        >
          {/* Sky */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.sky }]} pointerEvents="none" />

          {/* ── Parallax far bg rectangles ── */}
          <Animated.View style={[styles.parLayer, { transform: [{ translateX: parFar }] }]} pointerEvents="none">
            {bgFar.map((r, i) => (
              <View key={i} style={{
                position: 'absolute',
                left: r.x * sx, top: r.y * sy,
                width: r.w * sx, height: r.h * sy,
                backgroundColor: theme.bgRect1,
                opacity: 0.06 + (i % 3) * 0.02,
              }} />
            ))}
          </Animated.View>

          {/* ── Parallax near bg rectangles ── */}
          <Animated.View style={[styles.parLayer, { transform: [{ translateX: parNear }] }]} pointerEvents="none">
            {bgNear.map((r, i) => (
              <View key={i} style={{
                position: 'absolute',
                left: r.x * sx, top: r.y * sy,
                width: r.w * sx, height: r.h * sy,
                backgroundColor: theme.bgRect2,
                opacity: 0.09 + (i % 2) * 0.03,
              }} />
            ))}
          </Animated.View>

          {/* Zone flash overlay — shown briefly on theme change */}
          {zoneFlash && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.accentColor, opacity: 0.08 }]} pointerEvents="none" />
          )}

          {/* Zone label */}
          {zoneLabel !== '' && (
            <View style={styles.zoneLblWrap} pointerEvents="none">
              <Text style={[styles.zoneLbl, { color: theme.accentColor }]}>{zoneLabel.toUpperCase()}</Text>
            </View>
          )}

          {/* ── Ground — no grid Views, just a solid bar with top border ── */}
          <View
            style={{
              position: 'absolute', left: 0, top: GY,
              width: PW, height: GH,
              backgroundColor: theme.ground,
              borderTopWidth: 2, borderTopColor: theme.groundLine,
            }}
            pointerEvents="none"
          />

          {/* ── Scrolling world ── */}
          <Animated.View
            style={[styles.world, { width: worldW, height: PH, transform: [{ translateX: worldTx }] }]}
            collapsable={false}
          >
            {/* Trail — pixel squares */}
            {trailPts.map((tp, i) => {
              const frac = i / Math.max(trailPts.length - 1, 1);
              const opacity = frac * 0.6 * (1 - tp.age / 120);
              if (opacity < 0.04) return null;
              const sz = Math.max(2, NR.PLAYER_W * sx * 0.35 * frac);
              return (
                <View key={i} style={{
                  position: 'absolute',
                  left: tp.x * sx - sz / 2, top: tp.y * sy - sz / 2,
                  width: sz, height: sz,
                  backgroundColor: theme.playerOuter, opacity,
                }} />
              );
            })}

            {/* Land particles */}
            {visPar.map((p, i) => {
              const op = Math.max(0, p.life / p.maxLife) * 0.85;
              const sz = Math.max(1, p.radius * sy);
              return (
                <View key={i} style={{
                  position: 'absolute',
                  left: p.x * sx - sz / 2, top: p.y * sy - sz / 2,
                  width: sz, height: sz, borderRadius: sz / 2,
                  backgroundColor: p.color, opacity: op,
                }} />
              );
            })}

            {/* Obstacles */}
            {visObs.map((o, idx) => (
              <ObstacleView
                key={`${obsKey(o)}#${idx}`}
                o={o}
                scaleX={sx}
                scaleY={sy}
                playH={PH}
                groundY={GY}
                theme={theme}
              />
            ))}

            {/* ── Player ── */}
            <Animated.View
              style={{
                position: 'absolute',
                left: playerL, top: playerT,
                width: PW_player, height: PH_player,
                transform: [{ rotate: playerRotate }],
              }}
              collapsable={false}
            >
              {/* Outer green border */}
              <View style={{
                position: 'absolute', top: 0, left: 0,
                width: PW_player, height: PH_player,
                borderWidth: Math.max(2, sy * 2.5),
                borderColor: theme.playerOuter,
              }} />
              {/* Mid square */}
              <View style={{
                position: 'absolute',
                top: PH_player * 0.22, left: PW_player * 0.22,
                width: PW_player * 0.56, height: PH_player * 0.56,
                borderWidth: Math.max(1, sy * 1.5),
                borderColor: theme.playerMid,
                backgroundColor: theme.playerMid + '44',
              }} />
              {/* Inner brand gold center */}
              <View style={{
                position: 'absolute',
                top: PH_player * 0.40, left: PW_player * 0.40,
                width: PW_player * 0.20, height: PH_player * 0.20,
                backgroundColor: theme.playerInner,
              }} />
            </Animated.View>
          </Animated.View>
        </Pressable>
      )}

      <View style={[styles.hint, { marginBottom: Math.max(4, insets.bottom) }]}>
        <Text style={[styles.hintTxt, { color: theme.accentColor + 'bb' }]}>
          {Platform.OS === 'web'
            ? 'SPACE / ↑ JUMP · TAP OR HOLD ON RINGS'
            : 'TAP JUMP · TAP OR HOLD ON RINGS'}
        </Text>
      </View>
    </View>
  );
}

// ─── Obstacle renderer ────────────────────────────────────────────────────────

const ObstacleView = memo(function ObstacleView({
  o, scaleX, scaleY, playH, groundY, theme,
}: {
  o: Obstacle;
  scaleX: number;
  scaleY: number;
  playH: number;
  groundY: number;
  theme: ZoneTheme;
}): ReactNode {
  // Use a stable gradient ID based on obstacle position — no useId() inside memo
  const gid = `sg${Math.round(o.x)}_${Math.round(o.y)}_${o.kind === 'ceilingSpike' ? 'd' : 'u'}`;
  const left = o.x * scaleX;
  const w    = Math.max(1, o.w * scaleX);
  const top  = o.y * scaleY;
  const h    = Math.max(1, o.h * scaleY);

  switch (o.kind) {
    case 'void':
      return (
        <View style={{
          position: 'absolute', left, top: groundY, width: w,
          height: Math.max(0, playH - groundY),
          backgroundColor: theme.voidFill,
          borderTopWidth: 2, borderTopColor: theme.voidLine,
        }} />
      );

    case 'wall':
      return (
        <View style={{
          position: 'absolute', left, top, width: w, height: h,
          backgroundColor: theme.wallFill,
          borderWidth: 1.5, borderColor: theme.wallBorder,
          overflow: 'hidden',
        }}>
          {/* Top highlight stripe only — no grid lines for performance */}
          <View style={{ height: Math.max(2, scaleY * 2.5), backgroundColor: theme.wallStripe, width: w }} />
        </View>
      );

    case 'spike':
    case 'ceilingSpike': {
      const up = o.kind === 'spike';
      const pts = up
        ? `${w / 2},0 ${w},${h} 0,${h}`
        : `${w / 2},${h} 0,0 ${w},0`;
      const sw2 = Math.max(1.5, h * 0.06);
      return (
        <View style={{ position: 'absolute', left, top, width: w, height: h }}>
          <Svg width={w} height={h}>
            <Defs>
              <SvgGrad id={gid} x1="0" y1={up ? '0' : '1'} x2="0" y2={up ? '1' : '0'}>
                <Stop offset="0" stopColor={theme.spikeFill0} />
                <Stop offset="1" stopColor={theme.spikeFill1} />
              </SvgGrad>
            </Defs>
            <Polygon
              points={pts}
              fill={`url(#${gid})`}
              stroke={theme.spikeStroke}
              strokeWidth={sw2}
              strokeLinejoin="miter"
            />
          </Svg>
        </View>
      );
    }

    case 'ring': {
      const dim = Math.max(w, h);
      const r   = dim / 2;
      const rcx = left + w / 2;
      const rcy = top + h / 2;
      return (
        <View style={{ position: 'absolute', left: rcx - r, top: rcy - r, width: dim, height: dim }}>
          <Svg width={dim} height={dim}>
            <Circle
              cx={r} cy={r} r={r - 1.5}
              fill="transparent"
              stroke={o.used ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.92)'}
              strokeWidth={2}
              strokeDasharray={o.used ? undefined : `${r * 0.55} ${r * 0.35}`}
            />
            {!o.used && <Circle cx={r} cy={r} r={r * 0.22} fill="rgba(255,255,255,0.85)" />}
          </Svg>
        </View>
      );
    }

    default:
      return null;
  }
});

// ─── HUD / strip wrappers ─────────────────────────────────────────────────────

const MemoHud = memo(function HudWrap(p: {
  distance: number; score: number; practiceLabel?: string; prizeLabel?: string;
  onBack: () => void; speedFrac: number; timeLeftMs: number;
}) {
  return (
    <DashDuelHud
      distance={p.distance} score={p.score} streak={0}
      practiceLabel={p.practiceLabel} prizeLabel={p.prizeLabel}
      onBack={p.onBack} timeLeftMs={p.timeLeftMs}
      hideClock={NR.ROUND_MS <= 0} compact speedFrac={p.speedFrac}
    />
  );
});

const MemoStrip = memo(function StripWrap(p: {
  p1Alive: boolean; p2Alive: boolean; p1Dist: number; p2Dist: number; p1Flash: number;
}) {
  return <DashDuelOpponentStrip {...p} compact />;
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1, width: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  field: {
    alignSelf: 'center', overflow: 'hidden',
    borderWidth: 2, borderRadius: 2,
  },
  parLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  world: {
    position: 'absolute', left: 0, top: 0,
  },
  zoneLblWrap: {
    position: 'absolute', top: '16%', left: 0, right: 0,
    alignItems: 'center', zIndex: 10, pointerEvents: 'none',
  },
  zoneLbl: {
    fontSize: 11, fontWeight: '800', letterSpacing: 4,
  },
  hint: { paddingTop: 5 },
  hintTxt: {
    fontSize: 10, fontWeight: '700',
    textAlign: 'center', letterSpacing: 1.5,
  },
});

export default DashDuelGame;