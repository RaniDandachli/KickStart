import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { arcade } from '@/lib/arcadeTheme';
import {
  MINIGAME_HUD_MS_MOTION,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';

import { LANE_COUNT, SURGE_MAX } from './constants';
import {
  createGameRef,
  getDispPos,
  stepGame,
  tryActivateSurge,
  tryHop,
  VEHICLE_COLORS,
  type GameRef,
  type GridRow,
} from './engine';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  seed: number;
  /** Prize / H2H line shown under the title. */
  subtitle?: string;
  onExit: () => void;
  onRunComplete: (score: number, durationMs: number, tapCount: number) => void;
};

// ─── Layout ───────────────────────────────────────────────────────────────────

/** Player renders at this fraction from top of the playfield. */
const PLAYER_Y_FRAC = 0.65;

// ─── Main component ───────────────────────────────────────────────────────────

export function NeonGridGame({ seed, subtitle, onExit, onRunComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();

  const tileSize = useMemo(() => Math.floor(Math.min(sw, 500) / LANE_COUNT), [sw]);
  const controlsH = Math.min(180, Math.max(140, sh * 0.22));
  const playfieldH = Math.max(220, sh - controlsH);

  const [, setUiTick] = useState(0);
  const gameRef = useRef<GameRef>(createGameRef(seed));
  const startTimeRef = useRef(Date.now());
  const lastHudRef = useRef(0);
  const finishedRef = useRef(false);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  // ── Game finish ────────────────────────────────────────────────────────────

  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const g = gameRef.current;
    const durationMs = Math.max(0, Date.now() - startTimeRef.current);
    onRunComplete(g.score, durationMs, g.tapCount);
  }, [onRunComplete]);

  // ── Physics loop ───────────────────────────────────────────────────────────

  const step = useCallback(
    (totalDtMs: number) => {
      const g = gameRef.current;
      if (finishedRef.current) return;

      runFixedPhysicsSteps(totalDtMs, (dtMs) => {
        stepGame(g, dtMs);
        return true;
      });

      // Once the death flash fully fades, hand off to parent
      if (!g.alive && g.deathFlash <= 0) {
        finishRun();
      }

      if (shouldEmitMinigameHudFrame(lastHudRef, MINIGAME_HUD_MS_MOTION)) bump();
    },
    [bump, finishRun],
  );

  useRafLoop(step, !finishedRef.current);

  // ── Input ──────────────────────────────────────────────────────────────────

  const hop = useCallback(
    (dr: number, dc: number) => {
      if (finishedRef.current) return;
      tryHop(gameRef.current, dr, dc);
      bump();
    },
    [bump],
  );

  const activateSurge = useCallback(() => {
    if (finishedRef.current) return;
    tryActivateSurge(gameRef.current);
    bump();
  }, [bump]);

  useWebGameKeyboard(!finishedRef.current, {
    ArrowUp:    (d) => { if (d) hop(1, 0); },
    ArrowDown:  (d) => { if (d) hop(-1, 0); },
    ArrowLeft:  (d) => { if (d) hop(0, -1); },
    ArrowRight: (d) => { if (d) hop(0, 1); },
    KeyW: (d) => { if (d) hop(1, 0); },
    KeyS: (d) => { if (d) hop(-1, 0); },
    KeyA: (d) => { if (d) hop(0, -1); },
    KeyD: (d) => { if (d) hop(0, 1); },
    Space: (d) => { if (d) activateSurge(); },
  });

  // ── Derived render values ──────────────────────────────────────────────────

  const g = gameRef.current;
  const { dispRow, dispCol } = getDispPos(g);

  const playerScreenY = playfieldH * PLAYER_Y_FRAC;
  const cameraRow = dispRow;

  // Visible row window
  const rowsBelow = Math.ceil(playerScreenY / tileSize) + 2;
  const rowsAbove = Math.ceil((playfieldH - playerScreenY) / tileSize) + 2;
  const visibleRows: GridRow[] = [];
  for (let r = Math.floor(cameraRow) - rowsBelow; r <= Math.ceil(cameraRow) + rowsAbove; r++) {
    const row = g.rows.get(r);
    if (row) visibleRows.push(row);
  }

  function rowScreenY(rowId: number): number {
    return playerScreenY - (rowId - cameraRow) * tileSize;
  }

  const playerPixX = dispCol * tileSize;

  // Death flicker
  const deathAlpha = g.deathFlash > 0 ? Math.min(0.65, g.deathFlash / 400) : 0;
  const playerFlicker = g.deathFlash > 0 && Math.floor(g.deathFlash / 70) % 2 === 0;

  // Surge
  const surgeFill = g.surgeCharge / SURGE_MAX;
  const surgeReady = g.surgeCharge >= SURGE_MAX && !g.surgeActive;

  const gridW = LANE_COUNT * tileSize;

  return (
    <View style={styles.root}>

      {/* ── Playfield ──────────────────────────────────────────────── */}
      <View style={[styles.playfield, { height: playfieldH }]}>

        {/* Background grid lines */}
        {Array.from({ length: LANE_COUNT + 1 }, (_, i) => (
          <View key={`gv${i}`} style={[styles.gridV, { left: i * tileSize }]} />
        ))}

        {/* Rendered rows */}
        {visibleRows.map((row) => {
          const ry = rowScreenY(row.rowId);
          if (ry + tileSize < -tileSize || ry > playfieldH + tileSize) return null;

          const isTraffic = row.kind === 'traffic';
          const firstV = row.vehicles[0];
          const movesRight = firstV && firstV.speed > 0;
          const rowBg = isTraffic
            ? movesRight
              ? 'rgba(34,211,238,0.055)'
              : 'rgba(232,121,249,0.055)'
            : 'transparent';

          return (
            <View
              key={row.rowId}
              style={[styles.row, { top: ry, height: tileSize, width: gridW, backgroundColor: rowBg }]}
            >
              {/* Direction indicator stripe */}
              {isTraffic && (
                <View
                  style={[
                    styles.dirStripe,
                    { backgroundColor: movesRight ? 'rgba(34,211,238,0.55)' : 'rgba(232,121,249,0.55)' },
                  ]}
                />
              )}

              {/* Vehicles */}
              {row.vehicles.map((v) => {
                const vx = v.col * tileSize;
                const vw = v.width * tileSize - 5;
                if (vx + vw < -tileSize || vx > gridW + tileSize) return null;
                const color = VEHICLE_COLORS[v.colorIdx % VEHICLE_COLORS.length]!;
                const goRight = v.speed > 0;
                return (
                  <View
                    key={v.id}
                    style={[
                      styles.vehicle,
                      {
                        left: vx + 2,
                        width: vw,
                        height: tileSize - 8,
                        top: 4,
                        backgroundColor: color + '28',
                        borderColor: color,
                        shadowColor: color,
                      },
                    ]}
                  >
                    {/* Leading edge glow bar */}
                    <View
                      style={[
                        styles.vehicleLead,
                        {
                          [goRight ? 'right' : 'left']: 0,
                          backgroundColor: color,
                          shadowColor: color,
                        },
                      ]}
                    />
                    {/* Windshield glint */}
                    <View style={styles.vehicleGlass} />
                  </View>
                );
              })}

              {/* ⚡ Surge node */}
              {row.surgeNodeCol !== null && !row.surgeCollected && (
                <View
                  style={[
                    styles.surgeNode,
                    {
                      left: row.surgeNodeCol * tileSize + tileSize * 0.5 - 12,
                      top: tileSize * 0.5 - 12,
                    },
                  ]}
                >
                  <Text style={styles.surgeNodeGlyph}>⚡</Text>
                </View>
              )}

              {/* Row separator */}
              <View style={styles.rowSep} />
            </View>
          );
        })}

        {/* Player cube */}
        <View
          style={[
            styles.player,
            {
              left: playerPixX + 5,
              top: playerScreenY + 5,
              width: tileSize - 10,
              height: tileSize - 10,
              opacity: playerFlicker ? 0.1 : 1,
              borderColor: g.surgeActive ? arcade.gold : '#22D3EE',
              shadowColor: g.surgeActive ? arcade.gold : '#22D3EE',
              shadowRadius: g.surgeActive ? 18 : 11,
              backgroundColor: g.surgeActive ? 'rgba(250,204,21,0.2)' : 'rgba(34,211,238,0.16)',
            },
          ]}
        >
          <View style={[styles.playerCore, { backgroundColor: g.surgeActive ? arcade.gold : '#22D3EE' }]} />
        </View>

        {/* Surge active banner */}
        {g.surgeActive && (
          <View style={styles.surgeBanner} pointerEvents="none">
            <Text style={styles.surgeBannerTxt}>⚡ TIME FREEZE</Text>
          </View>
        )}

        {/* Death flash red overlay */}
        {deathAlpha > 0 && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(239,68,68,${deathAlpha.toFixed(2)})`, zIndex: 8 }]}
            pointerEvents="none"
          />
        )}

        {/* HUD */}
        <View style={styles.hud} pointerEvents="none">
          <View>
            <Text style={styles.scoreNum}>{g.score}</Text>
            <Text style={styles.scoreLbl}>TILES</Text>
          </View>

          <View style={styles.hudMid}>
            <Text style={styles.hudTitle}>NEON GRID</Text>
            {subtitle ? <Text style={styles.hudSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>

          <View style={styles.hudRight}>
            <Text style={styles.surgeLbl}>SURGE</Text>
            <View style={styles.surgeMeterTrack}>
              <View
                style={[
                  styles.surgeMeterFill,
                  {
                    width: `${Math.round(surgeFill * 100)}%` as any,
                    backgroundColor: surgeReady
                      ? arcade.gold
                      : g.surgeActive
                        ? '#22D3EE'
                        : '#4ade80',
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Back button */}
        <Pressable onPress={onExit} hitSlop={14} style={styles.backBtn}>
          <SafeIonicons name="chevron-back" size={22} color={arcade.gold} />
        </Pressable>
      </View>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <View style={[styles.controls, { height: controlsH }]}>

        {/* D-pad */}
        <View style={styles.dpad}>
          <View style={styles.dpadRow}>
            <View style={styles.dpadSpacer} />
            <DBtn icon="arrow-up" onPress={() => hop(1, 0)} />
            <View style={styles.dpadSpacer} />
          </View>
          <View style={styles.dpadRow}>
            <DBtn icon="arrow-back" onPress={() => hop(0, -1)} />
            <DBtn icon="arrow-down" onPress={() => hop(-1, 0)} />
            <DBtn icon="arrow-forward" onPress={() => hop(0, 1)} />
          </View>
        </View>

        {/* Surge button */}
        <Pressable
          onPress={activateSurge}
          style={({ pressed }) => [
            styles.surgeBtn,
            surgeReady && styles.surgeBtnReady,
            g.surgeActive && styles.surgeBtnActive,
            pressed && styles.surgeBtnPressed,
          ]}
        >
          <Text style={[styles.surgeBtnGlyph, surgeReady && { color: arcade.gold }]}>⚡</Text>
          <Text style={[styles.surgeBtnLabel, surgeReady && { color: arcade.gold }]}>
            {g.surgeActive ? 'ACTIVE' : surgeReady ? 'SURGE!' : 'SURGE'}
          </Text>
        </Pressable>

        {Platform.OS === 'web' ? (
          <Text style={styles.webHint}>{'WASD\nSpc=⚡'}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── D-pad button ─────────────────────────────────────────────────────────────

function DBtn({ icon, onPress }: { icon: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.dBtn, pressed && styles.dBtnActive]}
    >
      <SafeIonicons name={icon as any} size={20} color="#22D3EE" />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712' },

  // Playfield
  playfield: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#030712',
    position: 'relative',
  },

  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(56,189,248,0.055)',
    zIndex: 0,
  },

  row: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    zIndex: 1,
  },

  dirStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 2,
  },

  rowSep: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(56,189,248,0.055)',
  },

  vehicle: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1.5,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 7,
    elevation: 5,
    zIndex: 3,
    overflow: 'hidden',
  },

  vehicleLead: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 4,
    borderRadius: 2,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5,
  },

  vehicleGlass: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  surgeNode: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },

  surgeNodeGlyph: {
    fontSize: 16,
    lineHeight: 20,
  },

  // Player
  player: {
    position: 'absolute',
    borderRadius: 7,
    borderWidth: 2,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  playerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.9,
  },

  surgeBanner: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  } as any,

  surgeBannerTxt: {
    color: '#22D3EE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 4,
    opacity: 0.85,
  },

  // HUD
  hud: {
    position: 'absolute',
    top: 6,
    left: 40,
    right: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 30,
  },

  scoreNum: {
    color: '#22D3EE',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
    textShadowColor: '#22D3EE',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },

  scoreLbl: {
    color: 'rgba(148,163,184,0.8)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },

  hudMid: { alignItems: 'center', flex: 1 },

  hudTitle: {
    color: 'rgba(226,232,240,0.55)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 5,
  },

  hudSub: {
    color: 'rgba(148,163,184,0.65)',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },

  hudRight: { alignItems: 'flex-end' },

  surgeLbl: {
    color: 'rgba(148,163,184,0.8)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },

  surgeMeterTrack: {
    marginTop: 4,
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(51,65,85,0.85)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.3)',
  },

  surgeMeterFill: {
    height: '100%',
    borderRadius: 3,
  },

  backBtn: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 40,
    padding: 8,
  },

  // Controls
  controls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#060d18',
    borderTopWidth: 1,
    borderTopColor: 'rgba(34,211,238,0.08)',
  },

  // D-pad
  dpad: { gap: 4 },
  dpadRow: { flexDirection: 'row', gap: 4 },
  dpadSpacer: { width: 44, height: 44 },

  dBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(10,22,40,0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(34,211,238,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  dBtnActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: 'rgba(34,211,238,0.7)',
  },

  // Surge button
  surgeBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(10,22,40,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(74,222,128,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },

  surgeBtnReady: {
    borderColor: arcade.gold,
    backgroundColor: 'rgba(250,204,21,0.08)',
    shadowColor: arcade.gold,
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  surgeBtnActive: {
    borderColor: '#22D3EE',
    backgroundColor: 'rgba(34,211,238,0.1)',
  },

  surgeBtnPressed: { opacity: 0.65 },

  surgeBtnGlyph: { fontSize: 22, color: '#4ade80', lineHeight: 26 },

  surgeBtnLabel: {
    color: '#4ade80',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  webHint: {
    color: 'rgba(100,116,139,0.75)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
