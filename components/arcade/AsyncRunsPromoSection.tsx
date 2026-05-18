import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { runit, runitFont } from '@/lib/runitArcadeTheme';

const GREEN = '#34d399';
const GREEN_DIM = 'rgba(52, 211, 153, 0.35)';
const CARD_BG = 'rgba(8, 10, 14, 0.96)';

const STEPS = [
  {
    key: '1',
    title: 'You play',
    body: 'Start a solo contest run. Your entry fee is held for this tier.',
    icon: 'game-controller' as const,
  },
  {
    key: '2',
    title: 'Someone joins',
    body: 'Another player enters the same game with the same entry fee & prize tier.',
    icon: 'person-add' as const,
  },
  {
    key: '3',
    title: 'We compare',
    body: 'When both runs are finished, we compare validated scores.',
    icon: 'trophy' as const,
  },
  {
    key: '4',
    title: 'Higher score wins',
    body: 'The better score wins the listed prize for that contest row.',
    icon: 'cash' as const,
  },
] as const;

const TRUST = [
  {
    key: 'fair',
    icon: 'shield-checkmark' as const,
    title: 'Fair & verified',
    sub: 'Server-validated scores on every contest run.',
  },
  {
    key: 'wait',
    icon: 'time' as const,
    title: 'No lobby wait',
    sub: 'Play now — we match your score when the next player finishes.',
  },
  {
    key: 'real',
    icon: 'stats-chart' as const,
    title: 'Same contest',
    sub: 'Same game · same entry · higher score wins the tier prize.',
  },
  {
    key: 'bell',
    icon: 'notifications-outline' as const,
    title: 'Stay in the loop',
    sub: 'Enable alerts in Profile → Settings for results & open queues.',
  },
] as const;

type Props = {
  onStartPress: () => void;
  /** Tighter layout for laptop / nested columns. */
  compact?: boolean;
};

export function AsyncRunsPromoSection({ onStartPress, compact = false }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 900 && !compact;
  const stepsHorizontal = width >= 640 && !compact;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.borderGlow}>
        <View style={styles.card}>
          <View style={[wide ? styles.topRow : styles.topCol]}>
            <View style={[styles.left, wide && styles.leftWide]}>
              <View style={styles.kickerRow}>
                <SafeIonicons name="flash" size={14} color={GREEN} />
                <Text style={styles.kicker}>ASYNC RUNS</Text>
              </View>
              <Text style={[styles.headline, { fontFamily: runitFont.black }, compact && styles.headlineCompact]}>
                Play your run.{'\n'}High score wins.
              </Text>
              <Text style={styles.body}>
                Start a run by yourself with your entry fee held for that contest row. When another player joins the same game and tier, we compare scores after both runs are complete — higher score takes the win. Stack multiple runs and check results anytime.
              </Text>
              <Pressable
                onPress={onStartPress}
                accessibilityRole="button"
                accessibilityLabel="Start an async run — pick game and entry fee"
                style={({ pressed }) => [styles.ctaOuter, pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={[runit.neonPurple, '#6d28d9']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaGrad}
                >
                  <SafeIonicons name="flash" size={20} color="#fff" />
                  <Text style={[styles.ctaTxt, { fontFamily: runitFont.black }]}>Open 1v1 Battles</Text>
                  <SafeIonicons name="chevron-forward" size={22} color="rgba(255,255,255,0.92)" />
                </LinearGradient>
              </Pressable>
            </View>

            <View style={[styles.right, wide && styles.rightWide]}>
              <Text style={styles.howLabel}>HOW IT WORKS</Text>
              {stepsHorizontal ? (
                <View style={styles.stepsRow}>
                  {STEPS.map((s) => (
                    <View key={s.key} style={styles.stepCell}>
                      <View style={styles.stepIconRing}>
                        <SafeIonicons name={s.icon} size={18} color={GREEN} />
                      </View>
                      <Text style={styles.stepNum}>{s.key}</Text>
                      <Text style={[styles.stepTitle, { fontFamily: runitFont.black }]}>{s.title}</Text>
                      <Text style={styles.stepBody}>{s.body}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.stepsStack}>
                  {STEPS.map((s) => (
                    <View key={s.key} style={styles.stepRowVert}>
                      <View style={styles.stepIconRingSm}>
                        <SafeIonicons name={s.icon} size={16} color={GREEN} />
                      </View>
                      <View style={styles.stepTextVert}>
                        <Text style={styles.stepNumSm}>{s.key}</Text>
                        <Text style={[styles.stepTitleSm, { fontFamily: runitFont.black }]}>{s.title}</Text>
                        <Text style={styles.stepBodySm}>{s.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.trustBar}>
            {TRUST.map((t) => (
              <View key={t.key} style={[styles.trustItem, compact && styles.trustItemCompact]}>
                <SafeIonicons name={t.icon} size={16} color={GREEN} style={styles.trustIcon} />
                <Text style={[styles.trustTitle, { fontFamily: runitFont.black }]}>{t.title}</Text>
                <Text style={styles.trustSub}>{t.sub}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, marginBottom: 18, paddingHorizontal: 2 },
  wrapCompact: { marginBottom: 12 },
  borderGlow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GREEN_DIM,
    padding: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.12)',
  },
  card: {
    borderRadius: 17,
    backgroundColor: CARD_BG,
    paddingVertical: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  topCol: { gap: 18 },
  left: { flex: 1, minWidth: 0 },
  leftWide: { flex: 1.05, paddingRight: 8 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  kicker: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  headline: {
    color: '#f8fafc',
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  headlineCompact: { fontSize: 22, lineHeight: 28 },
  body: {
    color: 'rgba(148, 163, 184, 0.96)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaOuter: { borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch', maxWidth: 420 },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  ctaTxt: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  right: { flex: 1, minWidth: 0 },
  rightWide: { flex: 1.15 },
  howLabel: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  stepsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepCell: {
    flex: 1,
    minWidth: 120,
    maxWidth: 200,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    position: 'relative',
  },
  stepIconRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: GREEN_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepNum: { color: GREEN, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  stepTitle: { color: '#f1f5f9', fontSize: 13, marginBottom: 4 },
  stepBody: { color: 'rgba(148,163,184,0.92)', fontSize: 11, lineHeight: 15 },
  stepsStack: { gap: 12 },
  stepRowVert: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepIconRingSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: GREEN_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTextVert: { flex: 1, minWidth: 0 },
  stepNumSm: { color: GREEN, fontSize: 11, fontWeight: '800', marginBottom: 2 },
  stepTitleSm: { color: '#f1f5f9', fontSize: 14, marginBottom: 4 },
  stepBodySm: { color: 'rgba(148,163,184,0.92)', fontSize: 12, lineHeight: 17 },
  trustBar: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  trustItem: { width: '48%', minWidth: 140, flexGrow: 1 },
  trustItemCompact: { width: '100%', minWidth: 0 },
  trustIcon: { marginBottom: 6 },
  trustTitle: { color: '#e2e8f0', fontSize: 12, marginBottom: 4, letterSpacing: 0.3 },
  trustSub: { color: 'rgba(148,163,184,0.9)', fontSize: 11, lineHeight: 16 },
});
