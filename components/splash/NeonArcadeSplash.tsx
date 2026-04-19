import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { WebRunItArcadeWordmark } from '@/components/web/WebRunItArcadeWordmark';
import { APP_SCREEN_GRADIENT_COLORS, APP_SCREEN_GRADIENT_LOCATIONS } from '@/lib/runitArcadeTheme';

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
  const rawLogo = Math.min(w * 0.78, h * 0.5);
  const logoSize = isWeb ? Math.min(rawLogo, 260) : rawLogo;
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

  const borderStyle = useAnimatedStyle(() => {
    const op = interpolate(progress.value, [0.08, 0.32], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(progress.value, [0.08, 0.32], [0.94, 1], Extrapolation.CLAMP);
    return { opacity: op, transform: [{ scale }] };
  });

  const logoOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.16) return interpolate(p, [0, 0.16], [0, 1], Extrapolation.CLAMP);
    if (p < 0.42) {
      const t = (p - 0.16) / 0.26;
      return 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 11));
    }
    return 1;
  });

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const cyanGlowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const pulse = interpolate(p, [0.32, 0.5, 0.68], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: 0.35 * pulse };
  });

  const bounceStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0.44, 0.52, 0.62], [0.94, 1.06, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: s }] };
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

  const webTaglineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.value, [0.2, 0.45], [12, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const webSublineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.32, 0.52], [0, 0.92], Extrapolation.CLAMP),
  }));

  const LOGO = require('../../assets/images/run-it-arcade-icon.png');

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

      <View style={styles.center}>
        <Animated.View style={[styles.borderGlow, borderStyle]}>
          <LinearGradient
            colors={['#ff006e', '#a78bfa', '#ff006e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.borderGrad}
          >
            <View style={[styles.borderInner, { width: logoSize + 8, height: logoSize + 8 }]}>
              <Animated.View style={[StyleSheet.absoluteFill, cyanGlowStyle]} pointerEvents="none">
                <View style={styles.cyanGlowFill} />
              </Animated.View>

              <Animated.View style={[styles.logoWrap, bounceStyle]}>
                <Animated.View style={logoStyle}>
                  <Image source={LOGO} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
                </Animated.View>
              </Animated.View>
            </View>
          </LinearGradient>
        </Animated.View>

        {isWeb ? (
          <Animated.View style={[styles.webTaglineBlock, webTaglineStyle]}>
            <WebRunItArcadeWordmark size="splash" layout="inline" style={styles.webWordmark} />
            <Animated.View style={webSublineStyle}>
              <Text style={styles.webSubtitle}>Skill contests · Events · Prizes</Text>
            </Animated.View>
          </Animated.View>
        ) : null}
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

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050208',
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
  webTaglineBlock: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 520,
  },
  webWordmark: {
    alignSelf: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  webSubtitle: {
    marginTop: 10,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  borderGlow: {
    borderRadius: 22,
    padding: 2,
    shadowColor: '#ff006e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 24,
    ...(Platform.OS === 'android' ? { elevation: 18 } : {}),
  },
  borderGrad: {
    borderRadius: 20,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderInner: {
    position: 'relative',
    borderRadius: 18,
    backgroundColor: 'rgba(6, 2, 14, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cyanGlowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'rgba(167,139,250,0.22)',
    shadowColor: '#a78bfa',
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowColor: '#a78bfa',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  ringBurst: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255,0,110,0.45)',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
});
