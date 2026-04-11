import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';

type Props = {
  visible: boolean;
  finalScore: number;
  distance: number;
  seed: number;
  /** Set for prize (vs AI flavor) runs — redeem tickets granted from score. */
  ticketsEarned?: number;
  /** Head-to-head: one run per match session — hide rematch. */
  hideRematch?: boolean;
  /** Extra status (submit / poll) under the stats. */
  h2hFooter?: ReactNode;
  onRematch: () => void;
  onExit: () => void;
};

/**
 * Full-screen overlay (not RN `Modal`) — Modal + landscape + orientation locks has caused
 * native freezes/crashes on some Android/iOS builds when the game view unmounts underneath.
 */
export function DashDuelResults({
  visible,
  finalScore,
  distance,
  seed,
  ticketsEarned,
  hideRematch,
  h2hFooter,
  onRematch,
  onExit,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLabel="Run results">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit to menu"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
            onPress={onExit}
            style={styles.topExit}
          >
            <Ionicons name="chevron-back" size={26} color="#F8FAFC" />
            <Text style={styles.topExitLabel}>Exit to menu</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <LinearGradient colors={['rgba(2,6,23,0.94)', 'rgba(15,23,42,0.97)']} style={styles.card}>
            <Text style={styles.kicker}>Run complete</Text>
            <Text style={styles.title}>Neon run ended</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.lbl}>Distance</Text>
                <Text style={styles.val}>
                  {Number.isFinite(distance) ? Math.max(0, Math.floor(distance)) : 0}m
                </Text>
              </View>
              <Text style={styles.sep}>·</Text>
              <View style={styles.col}>
                <Text style={styles.lbl}>Score</Text>
                <Text style={styles.val}>
                  {Number.isFinite(finalScore) ? Math.max(0, Math.floor(finalScore)) : 0}
                </Text>
              </View>
            </View>
            <Text style={styles.seed}>Seed {seed}</Text>
            {ticketsEarned != null && ticketsEarned > 0 ? (
              <Text style={styles.ticketsLine}>+{ticketsEarned} redeem tickets</Text>
            ) : null}
            {h2hFooter}
            {hideRematch ? null : <AppButton title="Rematch" onPress={onRematch} />}
            <AppButton className="mt-3" title="Exit to menu" variant="secondary" onPress={onExit} />
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  safe: { flex: 1 },
  topBar: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  topExit: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  topExitLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  scroll: { flex: 1 },
  scrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  card: { borderRadius: 16, padding: 22, borderWidth: 1, borderColor: 'rgba(34,211,238,0.35)' },
  kicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 16 },
  col: { alignItems: 'center', minWidth: 100 },
  lbl: { color: 'rgba(148,163,184,0.9)', fontSize: 11, fontWeight: '700' },
  val: { color: '#5EEAD4', fontSize: 24, fontWeight: '900' },
  sep: { color: 'rgba(148,163,184,0.6)', fontWeight: '900' },
  seed: { color: 'rgba(100,116,139,0.95)', fontSize: 10, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  ticketsLine: {
    color: '#FDE047',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
});
