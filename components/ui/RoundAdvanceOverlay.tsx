import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
};

/**
 * Brief full-screen beat between tournament rounds (same route, remounted minigame).
 * Fades in/out via shared opacity so hiding is smooth (keep mounted; parent passes `visible`).
 */
export function RoundAdvanceOverlay({ visible, title, subtitle }: Props) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 220 : 280 });
  }, [visible, opacity]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.wrap, aStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 100,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  sub: {
    marginTop: 10,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
