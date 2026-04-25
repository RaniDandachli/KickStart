import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, ImageBackground, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { runItArcadeLogoSource } from '@/lib/brandLogo';
import { APP_SCREEN_GRADIENT_COLORS, APP_SCREEN_GRADIENT_LOCATIONS, runit } from '@/lib/runitArcadeTheme';

const TOTAL_MS = 2800;
const HERO = require('@/assets/images/run-it-arcade-splash-hero.png');

type Props = {
  onComplete: () => void;
};

/**
 * Cinematic splash — full-bleed **explosion** key art, dark vignette, crown logo reveal (scale + glow).
 */
export function NeonArcadeSplash({ onComplete }: Props) {
  const { width: w, height: h } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  const isWeb = Platform.OS === 'web';
  const shortSide = Math.min(w, h);
  const logoMax = isWeb ? Math.min(w * 0.48, 300) : Math.min(shortSide * 0.6, 300);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(0.65, { duration: TOTAL_MS * 0.45, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: TOTAL_MS * 0.55, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onComplete)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0.92, 0.55, 0.35], Extrapolation.CLAMP),
  }));

  const logoStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.12, 0.28, 1], [0, 0.4, 1, 1], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(p, [0, 0.25, 0.5, 1], [0.82, 1.02, 1, 1], Extrapolation.CLAMP),
        },
        {
          translateY: interpolate(p, [0, 0.2], [12, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const goldHaloStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0.15, 0.4, 0.75], [0, 0.5, 0.22], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(p, [0.2, 0.5, 1], [0.75, 1.08, 1.02], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.1, 0.35, 0.5], [0, 0.2, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(progress.value, [0, 0.4], [-w * 0.2, w * 0.15], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[styles.root, isWeb && styles.rootWeb]} pointerEvents="auto">
      <ImageBackground
        source={HERO}
        style={StyleSheet.absoluteFill}
        resizeMode={isWeb ? 'cover' : 'contain'}
        accessibilityLabel=""
      >
        <LinearGradient
          colors={['rgba(5,2,8,0.25)', 'rgba(5,2,12,0.5)', 'rgba(2,0,6,0.88)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[StyleSheet.absoluteFill, styles.purpleWash, dimStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(88, 28, 135, 0.18)', 'transparent', 'rgba(5,0,12,0.75)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.lightSweep, sweepStyle]} pointerEvents="none" />
      </ImageBackground>

      <LinearGradient
        colors={[...APP_SCREEN_GRADIENT_COLORS]}
        locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.gradBlend]}
        pointerEvents="none"
      />

      {isWeb ? (
        <LinearGradient
          colors={['transparent', 'rgba(5,0,10,0.5)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.webVignette]}
          pointerEvents="none"
        />
      ) : null}

      <View
        style={[
          styles.center,
          {
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 20) + 20,
            paddingHorizontal: 16,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.goldHalo,
            { width: Math.min(480, shortSide * 1.05), height: Math.min(480, shortSide * 1.05) },
            goldHaloStyle,
          ]}
          pointerEvents="none"
        />
        <Animated.View style={logoStyle}>
          <Image
            source={runItArcadeLogoSource}
            style={{ width: logoMax * 1.05, height: logoMax }}
            resizeMode="contain"
            accessibilityLabel="Run It Arcade"
            accessibilityRole="image"
          />
        </Animated.View>
      </View>
    </View>
  );
}

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
  gradBlend: {
    opacity: 0.28,
  },
  purpleWash: {
    zIndex: 1,
  },
  webVignette: {
    zIndex: 2,
  },
  lightSweep: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 252, 240, 0.06)',
    zIndex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    maxWidth: '100%' as const,
  },
  goldHalo: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    shadowColor: runit.gold,
    shadowOpacity: 0.85,
    shadowRadius: 64,
  },
});
