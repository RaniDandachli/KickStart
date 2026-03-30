import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  scroll: number;
  playW: number;
  playH: number;
  /** 0–1 speed fraction (for streak intensity). */
  speedFrac?: number;
};

/** RuniT-themed parallax grid + horizon glow + speed streaks. */
export function GdStyleLayer({ scroll, playW, playH, speedFrac = 0 }: Props) {
  const gridOff = scroll % 32;
  const cols = Math.ceil(playW / 32) + 3;
  const rows = Math.ceil(playH / 28) + 2;

  // Speed-streak horizontal lines — more visible at high speed
  const streakCount = 10;
  const streakOpacityBase = 0.04 + speedFrac * 0.14;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Deep RuniT bg */}
      <LinearGradient
        colors={['#06020e', '#0c0520', '#0a0318', '#04010a']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Cyan horizon band */}
      <LinearGradient
        colors={['transparent', 'rgba(0,240,255,0.09)', 'transparent']}
        style={[styles.horizon, { top: playH * 0.36 }]}
      />
      {/* Pink accent horizon */}
      <LinearGradient
        colors={['transparent', 'rgba(255,0,110,0.05)', 'transparent']}
        style={[styles.horizon, { top: playH * 0.55, height: 32 }]}
      />

      {/* Speed streaks — horizontal lines scrolling left */}
      {Array.from({ length: streakCount }, (_, i) => {
        const yPct = ((i * 31 + 7) % 85) + 5;
        const w = 18 + (i % 5) * 14;
        const xOff = (scroll * (0.6 + (i % 4) * 0.2)) % (playW + w);
        return (
          <View
            key={`sk${i}`}
            style={[
              styles.speedStreak,
              {
                top: `${yPct}%`,
                width: w,
                right: xOff,
                opacity: streakOpacityBase * (0.5 + (i % 3) * 0.5),
              },
            ]}
          />
        );
      })}

      {/* Vertical grid (scrolls with world) */}
      {Array.from({ length: cols }, (_, i) => (
        <View
          key={`v${i}`}
          style={[
            styles.vLine,
            {
              left: i * 32 - gridOff - 32,
              height: playH,
            },
          ]}
        />
      ))}

      {/* Horizontal grid */}
      {Array.from({ length: rows }, (_, j) => (
        <View
          key={`h${j}`}
          style={[
            styles.hLine,
            {
              top: j * 28,
              width: playW,
            },
          ]}
        />
      ))}

      {/* Purple corner vignettes */}
      <LinearGradient
        colors={['rgba(157,78,221,0.18)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 0.3 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
        pointerEvents="none"
      />

      {/* Ground zone darkening */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)']}
        style={[styles.groundFade, { top: playH * 0.68, height: playH * 0.32 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 44,
  },
  speedStreak: {
    position: 'absolute',
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(0,240,255,0.75)',
  },
  vLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(0,240,255,0.09)',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(157,78,221,0.07)',
  },
  groundFade: {
    position: 'absolute',
    left: 0,
    width: '100%',
  },
});
