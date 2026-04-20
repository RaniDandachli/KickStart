import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { arcade } from '@/lib/arcadeTheme';

/** Starry floor + blue neon “speed lines” — cyber-arcade vibe without image assets. */
const STARS: { l: `${number}%`; t: `${number}%`; o: number; s: number }[] = [
  { l: '5%', t: '8%', o: 0.4, s: 2 },
  { l: '18%', t: '22%', o: 0.25, s: 2 },
  { l: '88%', t: '12%', o: 0.35, s: 3 },
  { l: '72%', t: '28%', o: 0.2, s: 2 },
  { l: '42%', t: '6%', o: 0.18, s: 2 },
  { l: '12%', t: '45%', o: 0.22, s: 2 },
  { l: '92%', t: '48%', o: 0.28, s: 2 },
  { l: '55%', t: '38%', o: 0.15, s: 2 },
];

export function HomeNeonBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Motion streaks — low-opacity cones */}
      <LinearGradient
        colors={['rgba(59,130,246,0.34)', 'transparent', 'rgba(34,211,238,0.18)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 0.95 }}
        style={styles.streakA}
      />
      <LinearGradient
        colors={['transparent', 'rgba(34,211,238,0.11)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.streakB}
      />
      <LinearGradient
        colors={['rgba(96,165,250,0.2)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.6 }}
        style={styles.streakC}
      />
      {STARS.map((st, i) => (
        <View
          key={i}
          style={[
            styles.star,
            {
              left: st.l,
              top: st.t,
              opacity: st.o,
              width: st.s,
              height: st.s,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  streakA: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  streakB: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '65%',
  },
  streakC: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  star: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: arcade.neonCyan,
    shadowColor: arcade.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
});
