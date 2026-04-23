import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  APP_SCREEN_GRADIENT_COLORS,
  APP_SCREEN_GRADIENT_LOCATIONS,
  runit,
} from '@/lib/runitArcadeTheme';

const TOTAL_MS = 2000;

type Props = {
  onComplete: () => void;
};

/**
 * 2s neon arcade splash — CRT sweep, border, logo flicker, cyan pulse, bounce, particles, ring pulse.
 * Web: full-viewport fixed layer, app gradient, capped logo, brand tagline.
 */
export function NeonArcadeSplash({ onComplete }: Props) {
  const { width: w, height: h } = useWindowDimensions();
  const progress = useSharedValue(0);

  const isWeb = Platform.OS === 'web';
  const rawLogo = Math.min(w * 0.92, h * 0.72);
  const logoSize = isWeb ? Math.min(rawLogo, 440) : rawLogo;
  const ringSize = w * 1.12;

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: TOTAL_MS, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onComplete)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progress is a stable Reanimated ref
  }, [onComplete]);

  const scanlineStyle = useAnimatedStyle(() => {
    const y = interpolate(progress.value, [0, 0.22], [-0.08, 1.08], Extrapolation.CLAMP);
    const op = interpolate(progress.value, [0, 0.05, 0.2, 0.22], [0, 0.45, 0.35, 0], Extrapolation.CLAMP);
    return {
      opacity: op,
      transform: [{ translateY: y * h }],
    };
  }, [h]);

  const logoStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [0, 0.08, 0.16, 0.22, 1], [0, 1, 0.8, 1, 1], Extrapolation.CLAMP);
    const scale = interpolate(p, [0, 0.14, 0.32, 1], [0.86, 1.06, 1, 1], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  const cyanGlowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const pulseA = interpolate(p, [0.1, 0.26, 0.4], [0, 1, 0], Extrapolation.CLAMP);
    const pulseB = interpolate(p, [0.46, 0.62, 0.78], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: 0.34 * Math.max(pulseA, pulseB) };
  });

  const magentaGlowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const pulseA = interpolate(p, [0.22, 0.38, 0.52], [0, 1, 0], Extrapolation.CLAMP);
    const pulseB = interpolate(p, [0.68, 0.84, 1], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: 0.3 * Math.max(pulseA, pulseB) };
  });

  const particlesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.62, 0.78], [0, 1], Extrapolation.CLAMP),
  }));

  const ringPulseStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const scale = interpolate(p, [0.78, 0.92, 1], [0.85, 1.25, 1.18], Extrapolation.CLAMP);
    const op = interpolate(p, [0.78, 0.88, 1], [0, 0.55, 0], Extrapolation.CLAMP);
    return { opacity: op, transform: [{ scale }] };
  });

  const lightningStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const flashA = interpolate(p, [0.12, 0.18, 0.26], [0, 1, 0], Extrapolation.CLAMP);
    const flashB = interpolate(p, [0.42, 0.48, 0.56], [0, 1, 0], Extrapolation.CLAMP);
    const flashC = interpolate(p, [0.74, 0.8, 0.9], [0, 1, 0], Extrapolation.CLAMP);
    return {
      opacity: 0.88 * Math.max(flashA, flashB, flashC),
    };
  });

  const boltColorStyle = useAnimatedStyle(() => {
    const c = interpolateColor(progress.value, [0, 0.5, 1], ['#6ee7ff', '#60a5fa', '#f472b6']);
    return { backgroundColor: c };
  });

  const LOGO = require('../../assets/images/run-it-arcade-icon.png');
  const USER_LOGO_WEB_URI =
    'file:///C:/Users/rania/.cursor/projects/c-Users-rania-KickClash/assets/c__Users_rania_AppData_Roaming_Cursor_User_workspaceStorage_fa0437850cf66277d34d95c04ef67442_images_ligth-88f8d384-eded-4b9f-948a-7fadad744a41.png';
  const logoSource = isWeb ? { uri: USER_LOGO_WEB_URI } : LOGO;

  return (
    <View style={[styles.root, isWeb && styles.rootWeb]} pointerEvents="auto">
      <LinearGradient
        colors={[...APP_SCREEN_GRADIENT_COLORS]}
        locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {isWeb ? (
        <LinearGradient
          colors={['transparent', 'rgba(5,2,8,0.2)', 'rgba(5,2,8,0.72)']}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.webVignette]}
          pointerEvents="none"
        />
      ) : null}

      <Animated.View
        style={[
          styles.ringBurst,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            left: (w - ringSize) / 2,
            top: (h - ringSize) / 2,
          },
          ringPulseStyle,
        ]}
        pointerEvents="none"
      />

      <Animated.View style={[styles.scanlineWrap, scanlineStyle]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(180,220,255,0.35)', 'transparent']}
          style={styles.scanlineBar}
        />
      </Animated.View>

      <Animated.View style={[styles.lightningLayer, lightningStyle]} pointerEvents="none">
        {LIGHTNING_BOLTS.map((bolt) => (
          <Animated.View
            key={bolt.id}
            style={[
              styles.lightningBolt,
              boltColorStyle,
              {
                width: bolt.w,
                height: bolt.h,
                left: `${bolt.x}%`,
                top: `${bolt.y}%`,
                transform: [{ rotate: `${bolt.r}deg` }],
              },
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.center}>
        <Animated.View style={[styles.logoAura, cyanGlowStyle]} pointerEvents="none">
          <View style={styles.cyanGlowFill} />
        </Animated.View>
        <Animated.View style={[styles.logoAuraMagenta, magentaGlowStyle]} pointerEvents="none">
          <View style={styles.magentaGlowFill} />
        </Animated.View>
        <Animated.View style={logoStyle}>
          <Image source={logoSource} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.particles, particlesStyle]} pointerEvents="none">
        {PARTICLE_SEEDS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.particle,
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                opacity: s.a,
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

/** Fixed layout-friendly spark positions (percent of splash root). */
const PARTICLE_SEEDS = [
  { x: 12, y: 22, a: 0.9 },
  { x: 88, y: 18, a: 0.85 },
  { x: 18, y: 72, a: 0.75 },
  { x: 84, y: 68, a: 0.8 },
  { x: 50, y: 12, a: 0.7 },
  { x: 8, y: 48, a: 0.65 },
  { x: 92, y: 44, a: 0.7 },
  { x: 42, y: 88, a: 0.6 },
  { x: 62, y: 86, a: 0.65 },
  { x: 28, y: 38, a: 0.55 },
  { x: 74, y: 32, a: 0.55 },
];

const LIGHTNING_BOLTS = [
  { id: 'a', x: 18, y: 19, w: 2, h: 210, r: -36 },
  { id: 'b', x: 74, y: 15, w: 2, h: 235, r: 34 },
  { id: 'c', x: 14, y: 58, w: 2, h: 190, r: -52 },
  { id: 'd', x: 79, y: 56, w: 2, h: 190, r: 50 },
  { id: 'e', x: 46, y: 6, w: 2, h: 175, r: -2 },
  { id: 'f', x: 49, y: 73, w: 2, h: 160, r: -174 },
] as const;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: runit.bgDeep,
    zIndex: 9999,
    elevation: 9999,
  },
  rootWeb: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    minHeight: '100%',
  },
  webVignette: {
    zIndex: 1,
  },
  scanlineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 14,
    zIndex: 10,
  },
  scanlineBar: {
    flex: 1,
    height: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cyanGlowFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.24)',
    shadowColor: runit.neonCyan,
    shadowOpacity: 1,
    shadowRadius: 56,
  },
  magentaGlowFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    shadowColor: runit.neonPink,
    shadowOpacity: 1,
    shadowRadius: 48,
  },
  logoAura: {
    position: 'absolute',
    width: 520,
    height: 520,
  },
  logoAuraMagenta: {
    position: 'absolute',
    width: 460,
    height: 460,
    transform: [{ translateY: 14 }],
  },
  particles: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0f7ff',
    shadowColor: runit.neonPurple,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  ringBurst: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255, 26, 140, 0.45)',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  lightningLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  lightningBolt: {
    position: 'absolute',
    borderRadius: 8,
    shadowColor: '#60a5fa',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
});
