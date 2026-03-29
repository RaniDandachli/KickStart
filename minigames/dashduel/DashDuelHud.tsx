import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  distance: number;
  score: number;
  streak: number;
  practiceLabel?: string;
  prizeLabel?: string;
  timeLeftMs: number;
  onBack: () => void;
  /** Tighter layout for landscape fullscreen. */
  compact?: boolean;
};

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function DashDuelHud(props: Props) {
  const { distance, score, streak, practiceLabel, prizeLabel, timeLeftMs, onBack, compact } = props;
  const c = compact ? stylesCompact : null;
  return (
    <View style={[styles.top, c?.top]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Exit run"
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        onPress={onBack}
        style={[styles.backBtn, compact && styles.backBtnCompact]}
      >
        <Ionicons name="chevron-back" size={compact ? 22 : 24} color="#F8FAFC" />
        <Text style={[styles.exitLabel, compact && styles.exitLabelCompact]}>Exit</Text>
      </Pressable>
      <View style={styles.center}>
        <Text style={[styles.dist, c?.dist]}>{distance}m</Text>
        <Text style={[styles.scoreLine, c?.scoreLine]}>
          {score} pts
          {streak >= 2 ? <Text style={styles.streak}> streak</Text> : null}
        </Text>
      </View>
      <View style={styles.rightCol}>
        {prizeLabel ? (
          <LinearGradient colors={['rgba(52,211,153,0.25)', 'rgba(34,211,238,0.15)']} style={styles.prizePill}>
            <Text style={styles.prizeText}>{prizeLabel}</Text>
          </LinearGradient>
        ) : practiceLabel ? (
          <Text style={styles.practice}>{practiceLabel}</Text>
        ) : null}
        <Text style={styles.clockSmall}>{formatClock(timeLeftMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
    gap: 2,
  },
  backBtnCompact: {
    paddingHorizontal: 8,
    minHeight: 38,
  },
  exitLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  exitLabelCompact: {
    fontSize: 12,
  },
  center: { flex: 1, alignItems: 'center' },
  dist: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(34,211,238,0.45)',
    textShadowRadius: 10,
  },
  scoreLine: { color: 'rgba(148,163,184,0.95)', fontSize: 12, fontWeight: '700' },
  streak: { color: 'rgba(52,211,153,0.95)' },
  rightCol: { alignItems: 'flex-end', minWidth: 88 },
  prizePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
  },
  prizeText: { color: '#5EEAD4', fontSize: 11, fontWeight: '800' },
  practice: { color: 'rgba(148,163,184,0.95)', fontSize: 11, fontWeight: '700' },
  clockSmall: { color: 'rgba(148,163,184,0.7)', fontSize: 10, marginTop: 2, fontVariant: ['tabular-nums'] },
});

const stylesCompact = StyleSheet.create({
  top: { marginBottom: 4, paddingHorizontal: 2 },
  dist: { fontSize: 22 },
  scoreLine: { fontSize: 11 },
});
