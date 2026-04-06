import { useCallback, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DD } from '@/minigames/dashduel/constants';
import { createDashRun, scoreForPlayer, stepDashRun, winnerLabel, type DashRunState } from '@/minigames/dashduel/engine';
import type { Obstacle } from '@/minigames/dashduel/types';
import { GdStyleLayer } from '@/minigames/dashduel/GdStyleLayer';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';

import { DashDuelHud } from '@/minigames/dashduel/DashDuelHud';
import { DashDuelOpponentStrip } from '@/minigames/dashduel/DashDuelOpponentStrip';

type Props = {
  seed: number;
  practiceLabel?: string;
  prizeLabel?: string;
  onExit: () => void;
  onRoundComplete: (winner: 'p1' | 'p2' | 'draw', state: DashRunState) => void;
};

/** HUD + strip + hint — reserve vertical space so the playfield scales correctly in landscape. */
const HUD_RESERVE = 118;

export function DashDuelGame({ seed, practiceLabel, prizeLabel, onExit, onRoundComplete }: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const availH = sh - insets.top - insets.bottom - HUD_RESERVE;
  const availW = Math.max(40, sw - Math.max(insets.left, insets.right) - 4);
  const rawScale = Math.min(availW / DD.PLAY_W, Math.max(120, availH) / DD.PLAY_H);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? Math.max(0.08, Math.min(rawScale, 4)) : 0.5;
  const playW = DD.PLAY_W * scale;
  const playH = DD.PLAY_H * scale;

  const runRef = useRef<DashRunState | null>(null);
  const jumpRef = useRef(false);
  const completedRef = useRef(false);
  const [, setTick] = useState(0);
  const [engineOn, setEngineOn] = useState(true);

  /** Never call setState during render — parent remounts with key={seed} when seed changes. */
  if (runRef.current === null) {
    runRef.current = createDashRun(seed);
  }

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const loop = useCallback(
    (totalDtMs: number) => {
      const s = runRef.current;
      if (!s || s.roundOver || completedRef.current) return;
      let first = true;
      runFixedPhysicsSteps(totalDtMs, (h) => {
        if (!s || s.roundOver || completedRef.current) return false;
        const jump = first && jumpRef.current;
        if (first) jumpRef.current = false;
        first = false;
        stepDashRun(s, h, jump, undefined);
        return !s.roundOver;
      });
      bump();
      if (s.roundOver && !completedRef.current) {
        completedRef.current = true;
        setEngineOn(false);
        const w = winnerLabel(s.p1, s.p2, s.scroll, s.timeMs >= DD.ROUND_MS);
        const snap = s;
        queueMicrotask(() => {
          onRoundComplete(w, snap);
        });
      }
    },
    [bump, onRoundComplete],
  );

  useRafLoop(loop, engineOn);

  const s = runRef.current;
  const speedFrac = Math.max(0, Math.min(1, (s.scrollSpeed - DD.BASE_SCROLL_PER_MS) / (DD.MAX_SCROLL_PER_MS - DD.BASE_SCROLL_PER_MS)));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 2 }]}>
      <DashDuelHud
        distance={Math.floor(s.scroll)}
        score={scoreForPlayer(s.p1, s.scroll)}
        streak={s.p1.streak}
        practiceLabel={practiceLabel}
        prizeLabel={prizeLabel}
        onBack={onExit}
        timeLeftMs={Math.max(0, DD.ROUND_MS - s.timeMs)}
        compact
        speedFrac={speedFrac}
      />
      <DashDuelOpponentStrip
        p1Alive={s.p1.alive}
        p2Alive={s.p2.alive}
        p1Dist={s.p1.bestScroll}
        p2Dist={s.p2.bestScroll}
        p1Flash={s.p1.dangerFlash}
        compact
      />

      <View style={styles.fieldOuter}>
        <Pressable
          style={[styles.fieldWrap, { width: playW, height: playH }]}
          onPressIn={() => {
            jumpRef.current = true;
          }}
        >
          <GdStyleLayer scroll={s.scroll} playW={playW} playH={playH} speedFrac={speedFrac} />

          {/* Speed-pulse vignette — brightens at high speed */}
          {speedFrac > 0.5 ? (
            <LinearGradient
              colors={[`rgba(255,0,110,${(speedFrac - 0.5) * 0.18})`, 'transparent', 'transparent', `rgba(0,240,255,${(speedFrac - 0.5) * 0.12})`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}

          <PlayfieldContent scale={scale} scroll={s.scroll} course={s.course} p1={s.p1} nearFlash={s.p1.dangerFlash} />

          {/* Danger flash — red tint when near hazard */}
          {s.p1.dangerFlash > 0.1 ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(239,68,68,${s.p1.dangerFlash * 0.22})` }]}
              pointerEvents="none"
            />
          ) : null}
        </Pressable>
      </View>

      <View style={[styles.hintBlock, { marginBottom: Math.max(4, insets.bottom) }]}>
        <Text style={styles.tapHint}>Tap to jump</Text>
        <Text style={styles.legendHint}>
          Red pit = jump over · Cyan spike = avoid · Purple ceiling = duck under
        </Text>
      </View>
    </View>
  );
}

function PlayfieldContent({
  scale,
  scroll,
  course,
  p1,
  nearFlash,
}: {
  scale: number;
  scroll: number;
  course: Obstacle[];
  p1: { y: number; vy: number; squash: number; alive: boolean };
  nearFlash: number;
}) {
  const viewL = scroll - 40;
  const viewR = scroll + DD.PLAY_W + 80;
  const groundY = DD.GROUND_Y * scale;
  const blockH = Math.max(10, 14 * scale);

  return (
    <View style={StyleSheet.absoluteFill}>
      {course.map((o) => {
        if (o.x1 < viewL || o.x0 > viewR) return null;
        const left = (o.x0 - scroll) * scale;

        if (o.kind === 'gap') {
          const gw = (o.x1 - o.x0) * scale;
          return (
            <View
              key={o.key}
              style={[
                styles.gap,
                {
                  left,
                  width: gw,
                  height: 52 * scale,
                  top: groundY,
                },
              ]}
            >
              {/* Red glow rim on top of pit */}
              <View style={[styles.gapRim, { width: gw }]} />
              <Text style={[styles.hazardTag, { fontSize: Math.max(8, 10 * scale) }]}>PIT</Text>
              <Text style={[styles.hazardTagSub, { fontSize: Math.max(6, 7 * scale) }]}>↑ jump</Text>
            </View>
          );
        }
        if (o.kind === 'platform') {
          return (
            <View
              key={o.key}
              style={[
                styles.plat,
                {
                  left,
                  width: (o.x1 - o.x0) * scale,
                  top: o.yTop * scale,
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(0,240,255,0.85)', 'rgba(0,240,255,0.4)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          );
        }
        if (o.kind === 'spike') {
          const w = (o.x1 - o.x0) * scale;
          const h = (o.y1 - o.y0) * scale;
          const top = o.y0 * scale;
          return (
            <View key={o.key} style={[styles.spikeWrap, { left, top, width: w, height: h }]}>
              <LinearGradient
                colors={['#ff006e', '#e8007a', '#9d4edd']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.spikeInner, { borderRadius: 2 }]}
              />
              <View style={[styles.spikeEdge, StyleSheet.absoluteFill]} />
              <View style={styles.spikeLabelBox} pointerEvents="none">
                <Ionicons
                  name="warning"
                  size={Math.max(8, 10 * scale)}
                  color="rgba(255,255,255,0.92)"
                  accessibilityLabel="Hazard"
                />
              </View>
            </View>
          );
        }
        if (o.kind === 'ceiling') {
          const ch = (o.y1 - o.y0) * scale;
          return (
            <View
              key={o.key}
              style={[
                styles.ceilWrap,
                {
                  left,
                  width: (o.x1 - o.x0) * scale,
                  top: o.y0 * scale,
                  height: ch,
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(157,78,221,0.75)', 'rgba(99,102,241,0.45)', 'rgba(0,240,255,0.15)']}
                style={[styles.ceil, StyleSheet.absoluteFill]}
              />
              <Text style={[styles.hazardTagCeil, { fontSize: Math.max(7, 8 * scale), bottom: Math.min(6, ch * 0.35) }]}>
                LOW
              </Text>
            </View>
          );
        }
        return null;
      })}

      {/* Ground — neon cyan/pink rim */}
      <View style={[styles.groundShadow, { top: groundY + 2, width: DD.PLAY_W * scale, height: blockH }]} />
      <LinearGradient
        colors={['#06020e', '#0c0520', '#06020e']}
        style={[styles.groundBlock, { top: groundY, width: DD.PLAY_W * scale, height: blockH }]}
      />
      <LinearGradient
        colors={['#ff006e', '#9d4edd', '#00f0ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.groundTopLine, { top: groundY, width: DD.PLAY_W * scale }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.45)', 'rgba(0,240,255,0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.groundRim, { top: groundY - 1, width: DD.PLAY_W * scale }]}
      />

      {/* Player trail — neon pink/cyan alternating */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View
            key={i}
            style={[
              styles.trail,
              {
                left: DD.PLAYER_OFFSET_X * scale - 7 - i * 7,
                top: p1.y * scale - 7,
                opacity: 0.08 + i * 0.09,
                transform: [{ scale: 1 - i * 0.06 }],
                backgroundColor: i % 2 === 0 ? 'rgba(255,0,110,0.55)' : 'rgba(0,240,255,0.5)',
                borderColor: i % 2 === 0 ? 'rgba(255,0,110,0.4)' : 'rgba(0,240,255,0.35)',
              },
            ]}
          />
        ))}
      </View>

      {/* Player — RuniT pink→purple gradient, neon border */}
      <View
        style={[
          styles.player,
          {
            left: DD.PLAYER_OFFSET_X * scale - (DD.PLAYER_W / 2) * scale,
            top: p1.y * scale - (DD.PLAYER_H / 2) * scale,
            width: DD.PLAYER_W * scale * (1 - 0.06 * p1.squash),
            height: DD.PLAYER_H * scale * (1 + 0.08 * p1.squash),
            opacity: p1.alive ? 1 : 0.35,
            borderColor: nearFlash > 0.2 ? '#FCA5A5' : '#00f0ff',
            shadowColor: nearFlash > 0.2 ? '#ef4444' : '#ff006e',
          },
        ]}
      >
        <LinearGradient
          colors={['#ff006e', '#c026d3', '#9d4edd']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.playerShine} />
        {/* Cyan edge highlight */}
        <View style={styles.playerEdge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignItems: 'center', backgroundColor: '#06020e' },
  fieldOuter: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  fieldWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,0,110,0.55)',
    shadowColor: '#ff006e',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  gap: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gapRim: {
    position: 'absolute',
    top: 0,
    height: 3,
    backgroundColor: 'rgba(248,113,113,0.9)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  hazardTag: {
    color: 'rgba(248,113,113,0.95)',
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  hazardTagSub: {
    color: 'rgba(254,202,202,0.8)',
    fontWeight: '800',
    marginTop: 1,
  },
  spikeLabelBox: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ceilWrap: {
    position: 'absolute',
    overflow: 'hidden',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderBottomWidth: 2,
    borderColor: 'rgba(157,78,221,0.75)',
    shadowColor: '#9d4edd',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  hazardTagCeil: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(216,180,254,0.95)',
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plat: {
    position: 'absolute',
    height: 6,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.6)',
    shadowColor: '#00f0ff',
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  spikeWrap: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 2,
    borderWidth: 2,
    borderColor: 'rgba(255,0,110,0.85)',
    shadowColor: '#ff006e',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  spikeInner: { flex: 1 },
  spikeEdge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ceil: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  groundShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 2,
  },
  groundBlock: {
    position: 'absolute',
    borderTopWidth: 0,
  },
  groundTopLine: {
    position: 'absolute',
    height: 3,
    shadowColor: '#ff006e',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  groundRim: {
    position: 'absolute',
    height: 4,
  },
  trail: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 2,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  player: {
    position: 'absolute',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 2.5,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  playerShine: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '38%',
    height: '38%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  playerEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,240,255,0.7)',
  },
  hintBlock: {
    marginTop: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    maxWidth: 420,
  },
  tapHint: {
    color: 'rgba(226,232,240,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  legendHint: {
    marginTop: 3,
    color: 'rgba(148,163,184,0.75)',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
  },
});
