import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';

type Props = {
  visible: boolean;
  finalScore: number;
  durationMs: number;
  tapCount: number;
  seed: number;
  ticketsEarned?: number;
  hideRematch?: boolean;
  h2hFooter?: ReactNode;
  onRematch: () => void;
  onExit: () => void;
};

/** Full-screen overlay — mirrors Dash Duel results shell without landscape assumptions. */
export function NeonGridResults({
  visible,
  finalScore,
  durationMs,
  tapCount,
  seed,
  ticketsEarned,
  hideRematch,
  h2hFooter,
  onRematch,
  onExit,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLabel="Neon Grid results">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Exit" onPress={onExit} style={styles.exit}>
            <Text style={styles.exitTxt}>← Exit</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.kicker}>Run complete</Text>
          <Text style={styles.title}>Neon Grid</Text>
          <Text style={styles.row}>Score (rows) · {Math.max(0, Math.floor(finalScore))}</Text>
          <Text style={styles.row}>Time · {(durationMs / 1000).toFixed(1)}s</Text>
          <Text style={styles.row}>Moves · {Math.max(0, Math.floor(tapCount))}</Text>
          <Text style={styles.seed}>Seed {seed}</Text>
          {ticketsEarned != null && ticketsEarned > 0 ? (
            <Text style={styles.tickets}>Redeem tickets +{ticketsEarned}</Text>
          ) : null}
          {h2hFooter}
          {!hideRematch ? <AppButton title="Rematch" onPress={onRematch} className="mt-4" /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.96)',
    zIndex: 50,
  },
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 4 },
  exit: { alignSelf: 'flex-start', padding: 8 },
  exitTxt: { color: '#e2e8f0', fontSize: 16, fontWeight: '800' },
  card: {
    flex: 1,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  kicker: { color: 'rgba(148,163,184,0.95)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '900', marginTop: 6, marginBottom: 14 },
  row: { color: 'rgba(226,232,240,0.95)', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  seed: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginTop: 8 },
  tickets: { color: '#5eead4', fontSize: 15, fontWeight: '900', marginTop: 12 },
});
