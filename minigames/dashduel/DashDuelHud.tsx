import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { runit } from '@/lib/runitArcadeTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  /** 0–1 fraction of max speed reached — drives speed pip color. */
  speedFrac?: number;
  /** Hide countdown when round has no time cap (endless). */
  hideClock?: boolean;
};

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function SpeedPips({ frac }: { frac: number }) {
  const filled = Math.round(frac * 4);
  return (
    <View style={pipStyles.row}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            pipStyles.pip,
            {
              backgroundColor: i < filled
                ? i < 2 ? 'rgba(123,92,255,0.9)' : 'rgba(255,26,140,0.9)'
                : 'rgba(255,255,255,0.15)',
              shadowColor: i < filled ? (i < 2 ? runit.neonPurple : runit.neonPink) : 'transparent',
              shadowOpacity: i < filled ? 0.8 : 0,
              shadowRadius: 4,
            },
          ]}
        />
      ))}
    </View>
  );
}

const pipStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, alignItems: 'center', marginTop: 3 },
  pip: { width: 6, height: 6, borderRadius: 3 },
});

export function DashDuelHud(props: Props) {
  const {
    distance,
    score,
    streak,
    practiceLabel,
    prizeLabel,
    timeLeftMs,
    onBack,
    compact,
    speedFrac = 0,
    hideClock,
  } = props;
  const c = compact ? stylesCompact : null;

  const isUrgent = timeLeftMs < 10_000;
  const isCritical = timeLeftMs < 5_000;

  const clockColor = isCritical
    ? 'rgba(248,113,113,0.95)'
    : isUrgent
      ? 'rgba(251,191,36,0.95)'
      : 'rgba(148,163,184,0.75)';

  return (
    <View style={[styles.top, c?.top]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Exit run"
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        onPress={onBack}
        style={[styles.backBtn, compact && styles.backBtnCompact]}
      >
        <SafeIonicons name="chevron-back" size={compact ? 22 : 24} color="#F8FAFC" />
        <Text style={[styles.exitLabel, compact && styles.exitLabelCompact]}>Exit</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={[styles.dist, c?.dist]}>{distance}m</Text>
        <Text style={[styles.scoreLine, c?.scoreLine]}>
          {score} pts{streak >= 2 ? <Text style={styles.streak}>  ×{streak}</Text> : null}
        </Text>
        <SpeedPips frac={speedFrac} />
      </View>

      <View style={styles.rightCol}>
        {prizeLabel ? (
          <LinearGradient
            colors={['rgba(255,26,140,0.22)', 'rgba(123,92,255,0.2)']}
            style={styles.prizePill}
          >
            <Text style={styles.prizeText}>{prizeLabel}</Text>
          </LinearGradient>
        ) : practiceLabel ? (
          <Text style={styles.practice}>{practiceLabel}</Text>
        ) : null}
        {hideClock ? null : (
          <View style={styles.clockRow}>
            {isCritical ? (
              <SafeIonicons name="flash" size={12} color={clockColor} accessibilityLabel="Critical time" />
            ) : null}
            <Text style={[styles.clockSmall, { color: clockColor }]}>{formatClock(timeLeftMs)}</Text>
          </View>
        )}
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
    backgroundColor: 'rgba(6,2,14,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,26,140,0.4)',
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
    textShadowColor: 'rgba(255,26,140,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  scoreLine: { color: 'rgba(148,163,184,0.95)', fontSize: 12, fontWeight: '700' },
  streak: { color: 'rgba(167,139,250,0.95)' },
  rightCol: { alignItems: 'flex-end', minWidth: 88 },
  prizePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,26,140,0.35)',
  },
  prizeText: { color: runit.neonPink, fontSize: 11, fontWeight: '800' },
  practice: { color: 'rgba(148,163,184,0.95)', fontSize: 11, fontWeight: '700' },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  clockSmall: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
});

const stylesCompact = StyleSheet.create({
  top: { marginBottom: 4, paddingHorizontal: 2 },
  dist: { fontSize: 22 },
  scoreLine: { fontSize: 11 },
});
