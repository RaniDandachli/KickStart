import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Routes used by minigame “run ended” screens. */
export const ROUTE_MINIGAMES = '/(app)/(tabs)/play/minigames' as const;
export const ROUTE_HOME = '/(app)/(tabs)' as const;

type Props = {
  onMinigames: () => void;
  /** Omit to hide Home and keep a single exit (e.g. tight daily-tournament cards). */
  onHome?: () => void;
  /** Use on light cards (e.g. MiniResultsModal) — dark icons/text. */
  lightBackground?: boolean;
};

/**
 * Top-of-card back navigation after a run ends — Minigames list + optional Home tab.
 */
export function GameOverExitRow({ onMinigames, onHome, lightBackground }: Props) {
  const icon = lightBackground ? '#5b21b6' : '#e2e8f0';
  const labelStyle = lightBackground ? styles.labelLight : styles.labelDark;
  const border = lightBackground ? 'rgba(91, 33, 182, 0.2)' : 'rgba(148, 163, 184, 0.25)';

  return (
    <View style={[styles.row, { borderBottomColor: border }]}>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
        onPress={onMinigames}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to minigames"
      >
        <Ionicons name="chevron-back" size={24} color={icon} />
        <Text style={labelStyle}>Minigames</Text>
      </Pressable>
      {onHome ? (
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
          onPress={onHome}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          <Ionicons name="home-outline" size={24} color={icon} />
          <Text style={labelStyle}>Home</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  labelDark: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  labelLight: {
    color: '#4c1d95',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
