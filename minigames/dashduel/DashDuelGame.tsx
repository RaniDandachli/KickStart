import { useCallback, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DD } from '@/minigames/dashduel/constants';
import { createDashRun, scoreForPlayer, stepDashRun, winnerLabel, type DashRunState } from '@/minigames/dashduel/engine';
import type { Obstacle } from '@/minigames/dashduel/types';
import { GdStyleLayer } from '@/minigames/dashduel/GdStyleLayer';
import { useRafLoop } from '@/minigames/core/useRafLoop';

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
    (dtMs: number) => {
      const s = runRef.current;
      if (!s || s.roundOver || completedRef.current) return;
      stepDashRun(s, dtMs, jumpRef.current, undefined);
      jumpRef.current = false;
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
          <GdStyleLayer scroll={s.scroll} playW={playW} playH={playH} />
          <View style={styles.streaks} pointerEvents="none">
            {Array.from({ length: 14 }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.streak,
                  {
                    top: 12 + (i % 5) * 28,
                    opacity: 0.05 + (i % 4) * 0.03,
                  },
                ]}
              />
            ))}
          </View>
          <PlayfieldContent scale={scale} scroll={s.scroll} course={s.course} p1={s.p1} nearFlash={s.p1.dangerFlash} />
        </Pressable>
      </View>

      <View style={[styles.hintBlock, { marginBottom: Math.max(4, insets.bottom) }]}>
        <Text style={styles.tapHint}>Tap to jump</Text>
        <Text style={styles.legendHint}>
          Rhythm taps · Dark pit = jump · Teal = spike · Purple = low jump · Cyan = ledge
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
      {Array.from({ length: 40 }, (_, i) => (
        <View
          key={`p${i}`}
          style={[
            styles.particle,
            {
              left: `${(i * 47) % 100}%`,
              top: `${(i * 17) % 90}%`,
              opacity: 0.05 + (i % 6) * 0.025,
            },
          ]}
        />
      ))}

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
                  height: 48 * scale,
                  top: groundY,
                },
              ]}
            >
              <Text style={[styles.hazardTag, { fontSize: Math.max(8, 10 * scale) }]}>PIT</Text>
              <Text style={[styles.hazardTagSub, { fontSize: Math.max(7, 8 * scale) }]}>jump</Text>
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
            />
          );
        }
        if (o.kind === 'spike') {
          const w = (o.x1 - o.x0) * scale;
          const h = (o.y1 - o.y0) * scale;
          const top = o.y0 * scale;
          return (
            <View key={o.key} style={[styles.spikeWrap, { left, top, width: w, height: h }]}>
              <LinearGradient
                colors={['#5EEAD4', '#22D3EE', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.spikeInner, { borderRadius: 2 }]}
              />
              <View style={[styles.spikeEdge, StyleSheet.absoluteFill]} />
              <View style={styles.spikeLabelBox} pointerEvents="none">
                <Text style={[styles.hazardTagSpike, { fontSize: Math.max(7, 8 * scale) }]}>SPIKE</Text>
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
                colors={['rgba(99,102,241,0.55)', 'rgba(34,211,238,0.2)']}
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

      {/* Block-style ground */}
      <View style={[styles.groundShadow, { top: groundY + 2, width: DD.PLAY_W * scale, height: blockH }]} />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={[styles.groundBlock, { top: groundY, width: DD.PLAY_W * scale, height: blockH }]}
      />
      <View style={[styles.groundTopLine, { top: groundY, width: DD.PLAY_W * scale }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(34,211,238,0.35)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.groundRim, { top: groundY - 1, width: DD.PLAY_W * scale }]}
      />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.trail,
              {
                left: DD.PLAYER_OFFSET_X * scale - 7 - i * 6,
                top: p1.y * scale - 7,
                opacity: 0.1 + i * 0.07,
                transform: [{ scale: 1 - i * 0.07 }],
              },
            ]}
          />
        ))}
      </View>

      <View
        style={[
          styles.player,
          {
            left: DD.PLAYER_OFFSET_X * scale - (DD.PLAYER_W / 2) * scale,
            top: p1.y * scale - (DD.PLAYER_H / 2) * scale,
            width: DD.PLAYER_W * scale * (1 - 0.06 * p1.squash),
            height: DD.PLAYER_H * scale * (1 + 0.08 * p1.squash),
            opacity: p1.alive ? 1 : 0.35,
            borderColor: nearFlash > 0.2 ? '#FCA5A5' : '#F8FAFC',
          },
        ]}
      >
        <LinearGradient colors={['#4ADE80', '#22D3EE', '#818CF8']} style={StyleSheet.absoluteFill} />
        <View style={styles.playerFace} />
        <View style={styles.playerShine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignItems: 'center', backgroundColor: '#000' },
  fieldOuter: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  fieldWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.45)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  streaks: { ...StyleSheet.absoluteFillObject },
  streak: {
    position: 'absolute',
    right: 0,
    width: 2,
    height: 20,
    backgroundColor: 'rgba(52,211,153,0.35)',
  },
  particle: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#F8FAFC',
  },
  gap: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 2,
    borderColor: 'rgba(248,113,113,0.55)',
  },
  hazardTag: {
    color: 'rgba(248,113,113,0.95)',
    fontWeight: '900',
    letterSpacing: 1,
  },
  hazardTagSub: {
    color: 'rgba(254,202,202,0.85)',
    fontWeight: '800',
    marginTop: 1,
  },
  hazardTagSpike: {
    color: 'rgba(15,23,42,0.92)',
    fontWeight: '900',
    letterSpacing: 0.5,
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
  },
  hazardTagCeil: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(254,249,195,0.95)',
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plat: {
    position: 'absolute',
    height: 7,
    borderRadius: 2,
    backgroundColor: 'rgba(34,211,238,0.55)',
    borderWidth: 2,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  spikeWrap: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#F8FAFC',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  spikeInner: { flex: 1 },
  spikeEdge: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  ceil: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  groundShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 2,
  },
  groundBlock: {
    position: 'absolute',
    borderTopWidth: 2,
    borderColor: 'rgba(15,23,42,0.9)',
  },
  groundTopLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: 'rgba(52,211,153,0.75)',
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
    backgroundColor: 'rgba(52,211,153,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    transform: [{ rotate: '45deg' }],
  },
  player: {
    position: 'absolute',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 3,
    shadowColor: '#34D399',
    shadowOpacity: 0.75,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  playerFace: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  playerShine: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '38%',
    height: '38%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  hintBlock: {
    marginTop: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    maxWidth: 420,
  },
  tapHint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  legendHint: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.75)',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
  },
});
