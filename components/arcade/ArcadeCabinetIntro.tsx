import { useCallback, useEffect, useRef } from 'react';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { arcade } from '@/lib/arcadeTheme';

type Props = {
  onComplete: () => void;
};

const DOOR_MS = 820;
const FADE_MS = 340;

/**
 * Full-screen 80s cabinet: twin doors slide open, CRT glow, then fades away.
 */
export function ArcadeCabinetIntro({ onComplete }: Props) {
  const { width: w } = useWindowDimensions();
  const half = w / 2;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const leftX = useSharedValue(0);
  const rightX = useSharedValue(0);
  const shellOpacity = useSharedValue(1);
  const crtGlow = useSharedValue(0.4);

  const finishJs = useCallback(() => {
    onCompleteRef.current();
  }, []);

  const fadeOut = useCallback(() => {
    shellOpacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(finishJs)();
    });
  }, [finishJs, shellOpacity]);

  const skip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    leftX.value = -half;
    rightX.value = half;
    crtGlow.value = 1;
    fadeOut();
  }, [crtGlow, fadeOut, half, leftX, rightX]);

  useEffect(() => {
    const hw = w / 2;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    leftX.value = 0;
    rightX.value = 0;
    shellOpacity.value = 1;
    crtGlow.value = 0.4;
    crtGlow.value = withTiming(1, { duration: DOOR_MS, easing: Easing.inOut(Easing.quad) });
    leftX.value = withTiming(-hw, { duration: DOOR_MS, easing: Easing.out(Easing.cubic) });
    rightX.value = withTiming(hw, { duration: DOOR_MS, easing: Easing.out(Easing.cubic) });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      shellOpacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(finishJs)();
      });
    }, DOOR_MS + 40);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [w, finishJs, leftX, rightX, crtGlow, shellOpacity]);

  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftX.value }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightX.value }],
  }));
  const shellStyle = useAnimatedStyle(() => ({
    opacity: shellOpacity.value,
  }));
  const crtPulse = useAnimatedStyle(() => ({
    opacity: crtGlow.value * 0.75,
  }));

  return (
    <Animated.View style={[styles.shell, shellStyle]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityLabel="Skip intro">
        <View style={styles.skipHint}>
          <Text style={styles.skipText}>Tap to skip</Text>
        </View>
      </Pressable>

      <View style={styles.crtWrap} pointerEvents="none">
        <Animated.View style={[styles.crtGlow, crtPulse]}>
          <LinearGradient
            colors={['#22d3ee', '#e879f9', '#f472b6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <Text style={styles.crtTitle}>ARCADE</Text>
        <Text style={styles.crtSub}>PRIZE CREDITS</Text>
      </View>

      <View style={styles.doors} pointerEvents="none">
        <Animated.View style={[styles.door, styles.doorLeft, { width: half }, leftStyle]}>
          <LinearGradient
            colors={['#4c0519', '#9d174d', '#581c87']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.chromeEdge} />
          <Text style={styles.sideLabel}>◢ 01</Text>
          <View style={[styles.speakerCol, { left: 18 }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.speakerHole} />
            ))}
          </View>
        </Animated.View>
        <Animated.View style={[styles.door, styles.doorRight, { width: half }, rightStyle]}>
          <LinearGradient
            colors={['#581c87', '#7c3aed', '#0e7490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.chromeEdge, styles.chromeEdgeRight]} />
          <Text style={styles.sideLabelRight}>02 ◣</Text>
          <View style={[styles.speakerCol, { right: 18, alignItems: 'flex-end' }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.speakerHole} />
            ))}
          </View>
        </Animated.View>
      </View>

      <View style={styles.marquee} pointerEvents="none">
        <LinearGradient
          colors={['#1e1b4b', '#312e81', '#1e1b4b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.marqueeGrad}
        >
          <View style={styles.marqueeRow} accessibilityRole="text">
            <SafeIonicons name="star" size={11} color="#fef08a" accessible={false} />
            <Text style={styles.marqueeText}> Run iT Arcade </Text>
            <SafeIonicons name="star" size={11} color="#fef08a" accessible={false} />
            <Text style={styles.marqueeText}> INSERT SKILL </Text>
            <SafeIonicons name="star" size={11} color="#fef08a" accessible={false} />
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    backgroundColor: '#05010a',
  },
  skipHint: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  skipText: {
    color: 'rgba(226,232,240,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  crtWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crtGlow: {
    position: 'absolute',
    width: '78%',
    height: '42%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  crtTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: arcade.white,
    letterSpacing: 10,
    textShadowColor: '#22d3ee',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    zIndex: 2,
  },
  crtSub: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#f9a8d4',
    zIndex: 2,
  },
  doors: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  door: {
    height: '100%',
    overflow: 'hidden',
  },
  doorLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  doorRight: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chromeEdge: {
    position: 'absolute',
    right: 0,
    top: '12%',
    bottom: '12%',
    width: 5,
    backgroundColor: 'rgba(253,224,71,0.55)',
    shadowColor: '#fde047',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  chromeEdgeRight: {
    left: 0,
    right: undefined,
  },
  sideLabel: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sideLabelRight: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  speakerCol: {
    position: 'absolute',
    bottom: 160,
    gap: 6,
  },
  speakerHole: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  marquee: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  marqueeGrad: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.45)',
    alignItems: 'center',
  },
  marqueeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  marqueeText: {
    color: '#fef08a',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
