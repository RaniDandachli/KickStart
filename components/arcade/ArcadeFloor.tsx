import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { type PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { runit } from '@/lib/runitArcadeTheme';

/** Extra space so scroll content clears the bottom tab bar (icons + labels). */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 54 : 56;

/** Subtle CRT-style horizontal lines — 80s monitor vibe, very light. */
function ScanlineOverlay() {
  const n = 36;
  return (
    <View style={styles.scanWrap} pointerEvents="none">
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={[styles.scanLine, { top: `${(i / (n - 1)) * 100}%` }]}
        />
      ))}
    </View>
  );
}

/** Pink / cyan horizon glow + purple haze — clean 80s arcade floor. */
function ArcadeRetroAtmosphere() {
  return (
    <>
      <LinearGradient
        colors={['rgba(157,78,237,0.18)', 'transparent', 'rgba(0,240,255,0.1)']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 0.95 }}
        style={styles.atmoTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(255,0,110,0.08)', 'rgba(6,2,14,0.95)']}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.atmoBottom}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(255,0,110,0.07)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.horizonGlow}
        pointerEvents="none"
      />
      <View style={styles.starfield} pointerEvents="none">
        {STARFIELD.map((s, i) => (
          <View
            key={i}
            style={[
              styles.star,
              {
                left: s.x,
                top: s.y,
                opacity: s.o,
                width: s.w,
                height: s.w,
              },
            ]}
          />
        ))}
      </View>
      <ScanlineOverlay />
    </>
  );
}

const STARFIELD: { x: `${number}%`; y: `${number}%`; o: number; w: number }[] = [
  { x: '6%', y: '11%', o: 0.4, w: 2 },
  { x: '22%', y: '8%', o: 0.25, w: 2 },
  { x: '78%', y: '14%', o: 0.35, w: 3 },
  { x: '88%', y: '22%', o: 0.2, w: 2 },
  { x: '44%', y: '18%', o: 0.15, w: 2 },
  { x: '62%', y: '9%', o: 0.3, w: 2 },
  { x: '15%', y: '28%', o: 0.22, w: 2 },
  { x: '91%', y: '35%', o: 0.18, w: 2 },
];

/**
 * 80s-inspired arcade floor: deep purple-black, neon haze, stars, scanlines.
 */
export function ArcadeFloor({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 10) + TAB_BAR_CLEARANCE;

  return (
    <LinearGradient
      colors={[runit.bgDeep, '#12081f', '#0c0618', '#050208']}
      locations={[0, 0.35, 0.65, 1]}
      style={styles.flex}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <ArcadeRetroAtmosphere />
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  atmoTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
  },
  atmoBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    bottom: 0,
  },
  horizonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '18%',
    height: '42%',
  },
  starfield: { ...StyleSheet.absoluteFillObject },
  star: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#e9d5ff',
    shadowColor: runit.neonPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  scanWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.11)',
  },
});
