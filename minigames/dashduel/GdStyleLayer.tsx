import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  scroll: number;
  playW: number;
  playH: number;
};

/** Geometry-Dash-inspired parallax grid + horizon glow (no copyrighted assets). */
export function GdStyleLayer({ scroll, playW, playH }: Props) {
  const gridOff = scroll % 32;
  const cols = Math.ceil(playW / 32) + 3;
  const rows = Math.ceil(playH / 28) + 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#01040c', '#050a18', '#0a1628', '#020617']}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Horizon band */}
      <LinearGradient
        colors={['transparent', 'rgba(34,211,238,0.07)', 'transparent']}
        style={[styles.horizon, { top: playH * 0.38 }]}
      />
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
      {/* Ground zone darkening */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)']}
        style={[styles.groundFade, { top: playH * 0.72, height: playH * 0.28 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(34, 211, 238, 0.07)',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.05)',
  },
  groundFade: {
    position: 'absolute',
    left: 0,
    width: '100%',
  },
});
