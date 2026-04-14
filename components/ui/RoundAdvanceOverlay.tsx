import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
};

/**
 * Brief full-screen beat between tournament rounds (same route, remounted minigame).
 */
export function RoundAdvanceOverlay({ visible, title, subtitle }: Props) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[StyleSheet.absoluteFillObject, styles.wrap]}
      pointerEvents="none"
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
