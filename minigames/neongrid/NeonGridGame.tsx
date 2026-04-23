import { SafeIonicons } from '@/components/icons/SafeIonicons';
import {
  MINIGAME_HUD_MS_MOTION,
  shouldEmitMinigameHudFrame
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { LANE_COUNT, SURGE_MAX, VEHICLE_COLORS } from './constants';
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

const PLAYER_Y_FRAC = 0.62;

// ─── Character renderer (Spirit Fox) ─────────────────────────────────────────

function SpiritFox({
  size,
  surgeActive,
  bopScale,
  flicker,
}: {
  size: number;
  surgeActive: boolean;
  bopScale: number;
  flicker: boolean;
}) {
  const bodyH = Math.round(size * 0.52 * bopScale);
  const bodyW = Math.round(size * 0.52 / bopScale);
  const earSize = Math.round(size * 0.18);
  const glowColor = surgeActive ? '#FF6B35' : '#FFD700';
  const coreColor = surgeActive ? '#FFB347' : '#FFF5CC';

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: flicker ? 0.08 : 1,
      }}
    >
      {/* Glow halo */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.88,
          height: size * 0.88,
          borderRadius: size * 0.44,
          backgroundColor: glowColor + '22',
          shadowColor: glowColor,
          shadowOpacity: 0.9,
          shadowRadius: surgeActive ? 22 : 14,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      {/* Ears */}
      <View style={{ flexDirection: 'row', width: bodyW + earSize, justifyContent: 'space-between', marginBottom: -2 }}>
        <View style={[styles.ear, { width: earSize, height: earSize, borderBottomRightRadius: earSize * 0.6, backgroundColor: glowColor }]} />
        <View style={[styles.ear, { width: earSize, height: earSize, borderBottomLeftRadius: earSize * 0.6, backgroundColor: glowColor }]} />
      </View>
      {/* Body */}
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderRadius: bodyW * 0.38,
          backgroundColor: glowColor,
          shadowColor: glowColor,
          shadowOpacity: 1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Inner core */}
        <View
          style={{
            width: bodyW * 0.45,
            height: bodyH * 0.45,
            borderRadius: bodyW * 0.22,
            backgroundColor: coreColor,
            opacity: 0.85,
          }}
        />
      </View>
      {/* Tail */}
      <View
        style={{
          width: size * 0.28,
          height: size * 0.14,
          borderRadius: size * 0.07,
          backgroundColor: glowColor + 'AA',
          marginTop: 2,
          alignSelf: 'flex-end',
          marginRight: size * 0.05,
        }}
      />
    </View>
  );
}

// ─── Tree renderer ────────────────────────────────────────────────────────────

function Tree({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* Canopy */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.05,
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.36,
          backgroundColor: '#1A4A1A',
          shadowColor: '#0D3A0D',
          shadowOpacity: 0.7,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          borderWidth: 1.5,
          borderColor: '#2A6A2A',
        }}
      />
      {/* Highlight */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.22,
          width: size * 0.22,
          height: size * 0.18,
          borderRadius: size * 0.1,
          backgroundColor: '#2D7A2D',
          opacity: 0.6,
        }}
      />
      {/* Trunk */}
      <View
        style={{
          width: size * 0.2,
          height: size * 0.28,
          borderRadius: 3,
          backgroundColor: '#5C3A1A',
          marginBottom: 0,
        }}
      />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NeonGridGame({ seed, subtitle, onExit, onRunComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();

  const tileSize = useMemo(() => Math.floor(Math.min(sw, 480) / LANE_COUNT), [sw]);
  const controlsH = Math.min(180, Math.max(140, sh * 0.22));
  const playfieldH = Math.max(220, sh - controlsH);

  const [, setUiTick] = useState(0);
  const gameRef = useRef<GameRef>(createGameRef(seed));
  const startTimeRef = useRef(Date.now());
  const lastHudRef = useRef(0);
  const finishedRef = useRef(false);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const g = gameRef.current;
    onRunComplete(g.score, Math.max(0, Date.now() - startTimeRef.current), g.tapCount);
  }, [onRunComplete]);

  const step = useCallback(
    (totalDtMs: number) => {
      const g = gameRef.current;
      if (finishedRef.current) return;
      runFixedPhysicsSteps(totalDtMs, (dtMs) => { stepGame(g, dtMs); return true; });
      if (!g.alive && g.deathFlash <= 0) finishRun();
      if (shouldEmitMinigameHudFrame(lastHudRef, MINIGAME_HUD_MS_MOTION)) bump();
    },
    [bump, finishRun],
  );

  useRafLoop(step, !finishedRef.current);

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
  const hopArc = getHopArc(g);

  const playerScreenY = playfieldH * PLAYER_Y_FRAC;
  const cameraRow = dispRow;

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
  const playerPixY = playerScreenY - hopArc * tileSize;

  const deathAlpha = g.deathFlash > 0 ? Math.min(0.6, g.deathFlash / 500) : 0;
  const playerFlicker = g.deathFlash > 0 && Math.floor(g.deathFlash / 65) % 2 === 0;

  const surgeFill = g.surgeCharge / SURGE_MAX;
  const surgeReady = g.surgeCharge >= SURGE_MAX && !g.surgeActive;

  const gridW = LANE_COUNT * tileSize;

  // Gradient sky — rows further forward = darker indigo
  const skyRows = Array.from({ length: 5 }, (_, i) => i);

  return (
    <View style={styles.root}>

      {/* ── Playfield ──────────────────────────────────────────────── */}
      <View style={[styles.playfield, { height: playfieldH }]}>

        {/* Sky gradient backdrop */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#0D1B2A',
              // Warm horizon glow at bottom
            },
          ]}
          pointerEvents="none"
        />

        {/* Rendered rows */}
        {visibleRows.map((row) => {
          const ry = rowScreenY(row.rowId);
          if (ry + tileSize < -tileSize || ry > playfieldH + tileSize) return null;

          // Row background
          let rowBg: string;
          let rowBorder: string;
          if (row.kind === 'safe') {
            const alt = row.rowId % 2 === 0;
            rowBg = alt ? '#1A3A1A' : '#1E4020';
            rowBorder = '#2A5A2A';
          } else if (row.kind === 'road') {
            const alt = row.rowId % 2 === 0;
            rowBg = alt ? '#1A130C' : '#1E160E';
            rowBorder = '#2A1E10';
          } else {
            // river
            const alt = row.rowId % 2 === 0;
            rowBg = alt ? '#0A2035' : '#0C2840';
            rowBorder = '#0A3A65';
          }

          return (
            <View
              key={row.rowId}
              style={[
                styles.row,
                {
                  top: ry,
                  height: tileSize,
                  width: gridW,
                  backgroundColor: rowBg,
                  borderBottomColor: rowBorder,
                },
              ]}
            >
              {/* Road markings */}
              {row.kind === 'road' && (
                <>
                  {/* Center dashed line */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: tileSize / 2 - 1,
                      height: 2,
                      opacity: 0.18,
                      backgroundColor: '#FFD700',
                    }}
                  />
                  {/* Edge kerbs */}
                  <View style={[styles.kerb, { top: 0 }]} />
                  <View style={[styles.kerb, { bottom: 0 }]} />
                </>
              )}

              {/* River ripple stripes */}
              {row.kind === 'river' && (
                <>
                  <View style={[styles.ripple, { top: tileSize * 0.22 }]} />
                  <View style={[styles.ripple, { top: tileSize * 0.62 }]} />
                </>
              )}

              {/* Safe row grass texture stripes */}
              {row.kind === 'safe' && row.rowId % 3 === 0 && (
                <View style={styles.grassStripe} />
              )}

              {/* Vehicles (road) */}
              {row.kind === 'road' && row.vehicles.map((v) => {
                const vx = v.col * tileSize;
                const vw = v.width * tileSize - 6;
                if (vx + vw < -tileSize || vx > gridW + tileSize) return null;
                const color = VEHICLE_COLORS[v.colorIdx % VEHICLE_COLORS.length]!;
                const goRight = v.speed > 0;
                return <CarSprite key={v.id} v={v} tileSize={tileSize} color={color} goRight={goRight} />;
              })}

              {/* Logs (river) */}
              {row.kind === 'river' && row.logs.map((l) => {
                const lx = l.col * tileSize;
                const lw = l.width * tileSize - 4;
                if (lx + lw < -tileSize || lx > gridW + tileSize) return null;
                return <LogSprite key={l.id} log={l} tileSize={tileSize} />;
              })}

              {/* Trees (safe) */}
              {row.kind === 'safe' && row.treeMask.map((isTree, col) => {
                if (!isTree) return null;
                return (
                  <View
                    key={col}
                    style={{
                      position: 'absolute',
                      left: col * tileSize,
                      top: 0,
                      width: tileSize,
                      height: tileSize,
                      zIndex: 4,
                    }}
                  >
                    <Tree size={tileSize} />
                  </View>
                );
              })}

              {/* Spirit energy node */}
              {row.surgeNodeCol !== null && !row.surgeCollected && (
                <View
                  style={[
                    styles.spiritNode,
                    {
                      left: row.surgeNodeCol * tileSize + tileSize * 0.5 - 14,
                      top: tileSize * 0.5 - 14,
                    },
                  ]}
                >
                  <View style={styles.spiritNodeInner} />
                  <Text style={styles.spiritNodeGlyph}>✦</Text>
                </View>
              )}

              {/* Row bottom border */}
              <View style={[styles.rowSep, { borderBottomColor: rowBorder }]} />
            </View>
          );
        })}

        {/* Player — Spirit Fox */}
        <View
          style={[
            styles.playerWrap,
            {
              left: playerPixX,
              top: playerPixY,
              width: tileSize,
              height: tileSize,
            },
          ]}
        >
          <SpiritFox
            size={tileSize}
            surgeActive={g.surgeActive}
            bopScale={g.bopScale}
            flicker={playerFlicker}
          />
        </View>

        {/* Shadow under player (grounded) */}
        {!g.hopping && (
          <View
            style={[
              styles.playerShadow,
              {
                left: playerPixX + tileSize * 0.2,
                top: playerScreenY + tileSize * 0.82,
                width: tileSize * 0.6,
                opacity: 0.35,
              },
            ]}
          />
        )}

        {/* Surge spirit-time banner */}
        {g.surgeActive && (
          <View style={styles.spiritBanner} pointerEvents="none">
            <Text style={styles.spiritBannerTxt}>✦  SPIRIT TIME  ✦</Text>
          </View>
        )}

        {/* Death overlay */}
        {deathAlpha > 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(220,50,50,${deathAlpha.toFixed(2)})`, zIndex: 8 },
            ]}
            pointerEvents="none"
          />
        )}

        {/* HUD */}
        <View style={styles.hud} pointerEvents="none">
          <View>
            <Text style={styles.scoreNum}>{g.score}</Text>
            <Text style={styles.scoreLbl}>STEPS</Text>
          </View>

          <View style={styles.hudMid}>
            <Text style={styles.hudTitle}>SPIRIT CROSS</Text>
            {subtitle ? <Text style={styles.hudSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>

          <View style={styles.hudRight}>
            <Text style={styles.spiritLbl}>SPIRIT</Text>
            <View style={styles.spiritMeterTrack}>
              <View
                style={[
                  styles.spiritMeterFill,
                  {
                    width: `${Math.round(surgeFill * 100)}%` as any,
                    backgroundColor: surgeReady
                      ? '#FF6B35'
                      : g.surgeActive
                        ? '#FFB347'
                        : '#FFD700',
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Back button */}
        <Pressable onPress={onExit} hitSlop={14} style={styles.backBtn}>
          <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
        </Pressable>

        {/* Ambient vignette */}
        <View style={styles.vignette} pointerEvents="none" />
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

        {/* Spirit button */}
        <Pressable
          onPress={activateSurge}
          style={({ pressed }) => [
            styles.spiritBtn,
            surgeReady && styles.spiritBtnReady,
            g.surgeActive && styles.spiritBtnActive,
            pressed && styles.spiritBtnPressed,
          ]}
        >
          <Text style={[styles.spiritBtnGlyph, surgeReady && { color: '#FF6B35' }]}>✦</Text>
          <Text style={[styles.spiritBtnLabel, surgeReady && { color: '#FF6B35' }]}>
            {g.surgeActive ? 'ACTIVE' : surgeReady ? 'SPIRIT!' : 'SPIRIT'}
          </Text>
        </Pressable>

        {Platform.OS === 'web' ? (
          <Text style={styles.webHint}>{'WASD / ↑↓←→\nSpace = ✦'}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Car sprite ───────────────────────────────────────────────────────────────

function CarSprite({
  v,
  tileSize,
  color,
  goRight,
}: {
  v: Vehicle;
  tileSize: number;
  color: string;
  goRight: boolean;
}) {
  const vx = v.col * tileSize;
  const vw = v.width * tileSize - 6;
  const isLong = v.width >= 2;

  return (
    <View
      style={[
        styles.car,
        {
          left: vx + 3,
          width: vw,
          height: tileSize - 10,
          top: 5,
          backgroundColor: color + '30',
          borderColor: color,
          shadowColor: color,
        },
      ]}
    >
      {/* Headlights / taillights */}
      <View
        style={[
          styles.carLight,
          { [goRight ? 'right' : 'left']: 3, backgroundColor: color },
        ]}
      />
      {/* Windshield */}
      {isLong && (
        <View
          style={[
            styles.carWindshield,
            {
              [goRight ? 'left' : 'right']: vw * 0.28,
              width: vw * 0.28,
            },
          ]}
        />
      )}
      {/* Roof line */}
      <View style={[styles.carRoof, { width: isLong ? vw * 0.55 : vw * 0.65 }]} />
    </View>
  );
}

// ─── Log sprite ───────────────────────────────────────────────────────────────

function LogSprite({ log, tileSize }: { log: Log; tileSize: number }) {
  const lx = log.col * tileSize;
  const lw = log.width * tileSize - 4;

  return (
    <View
      style={[
        styles.log,
        {
          left: lx + 2,
          width: lw,
          height: tileSize - 12,
          top: 6,
        },
      ]}
    >
      {/* Wood grain lines */}
      {Array.from({ length: Math.max(1, Math.floor(lw / 14)) }, (_, i) => (
        <View
          key={i}
          style={[
            styles.logGrain,
            { left: 8 + i * 14, height: tileSize - 18 },
          ]}
        />
      ))}
      {/* Highlight edge */}
      <View style={styles.logHighlight} />
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
      <SafeIonicons name={icon as any} size={20} color="#FFD700" />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070D14' },

  playfield: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0D1B2A',
    position: 'relative',
  },

  row: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    zIndex: 1,
    borderBottomWidth: 1,
  },

  kerb: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#E8E0CC',
    opacity: 0.08,
  },

  ripple: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#4A90D9',
    opacity: 0.22,
  },

  grassStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3A7A3A',
    opacity: 0.25,
  },

  rowSep: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    borderBottomWidth: 1,
  },

  // Car
  car: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 1.5,
    shadowOpacity: 0.85,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 4,
    zIndex: 3,
    overflow: 'hidden',
  },
  carLight: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 5,
    borderRadius: 2,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    shadowColor: '#FFFFFF',
  },
  carWindshield: {
    position: 'absolute',
    top: 3,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(200,230,255,0.3)',
  },
  carRoof: {
    position: 'absolute',
    top: 2,
    left: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Log
  log: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: '#6B4F1A',
    borderWidth: 1.5,
    borderColor: '#8B6914',
    shadowColor: '#3A2A08',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 3,
    overflow: 'hidden',
  },
  logGrain: {
    position: 'absolute',
    top: 2,
    width: 1.5,
    borderRadius: 1,
    backgroundColor: '#4A3410',
    opacity: 0.55,
  },
  logHighlight: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C49A2A',
    opacity: 0.35,
  },

  // Spirit node
  spiritNode: {
    position: 'absolute',
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  spiritNodeInner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFD700',
    opacity: 0.18,
    shadowColor: '#FFD700',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  spiritNodeGlyph: {
    fontSize: 14,
    lineHeight: 18,
    color: '#FFE566',
    textShadowColor: '#FFD700',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },

  // Ear helper
  ear: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },

  // Player wrapper
  playerWrap: {
    position: 'absolute',
    zIndex: 10,
  },
  playerShadow: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000000',
    zIndex: 9,
  },

  // Spirit time banner
  spiritBanner: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  } as any,
  spiritBannerTxt: {
    color: '#FFB347',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 5,
    opacity: 0.9,
    textShadowColor: '#FF6B35',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },

  // Vignette
  vignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 7,
    // Simulated vignette with semi-transparent edges
    borderWidth: 32,
    borderColor: 'rgba(7,13,20,0.45)',
    borderRadius: 4,
    pointerEvents: 'none',
  } as any,

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
    color: '#FFD700',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
    textShadowColor: '#FF8C00',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  scoreLbl: {
    color: 'rgba(200,180,130,0.8)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  hudMid: { alignItems: 'center', flex: 1 },
  hudTitle: {
    color: 'rgba(255,215,0,0.55)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 5,
  },
  hudSub: {
    color: 'rgba(200,180,130,0.65)',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
  hudRight: { alignItems: 'flex-end' },
  spiritLbl: {
    color: 'rgba(200,180,130,0.8)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  spiritMeterTrack: {
    marginTop: 4,
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(40,30,15,0.85)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(180,140,60,0.3)',
  },
  spiritMeterFill: {
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
    backgroundColor: '#0A1018',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,215,0,0.08)',
  },

  dpad: { gap: 4 },
  dpadRow: { flexDirection: 'row', gap: 4 },
  dpadSpacer: { width: 44, height: 44 },

  dBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(20,16,8,0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dBtnActive: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderColor: 'rgba(255,180,0,0.7)',
  },

  spiritBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(20,16,8,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  spiritBtnReady: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255,107,53,0.1)',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  spiritBtnActive: {
    borderColor: '#FFB347',
    backgroundColor: 'rgba(255,179,71,0.1)',
  },
  spiritBtnPressed: { opacity: 0.65 },
  spiritBtnGlyph: { fontSize: 22, color: '#FFD700', lineHeight: 26 },
  spiritBtnLabel: {
    color: '#FFD700',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  webHint: {
    color: 'rgba(160,140,100,0.75)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});