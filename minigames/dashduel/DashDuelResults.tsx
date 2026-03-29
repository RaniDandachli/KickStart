import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { scoreForPlayer, type DashRunState } from '@/minigames/dashduel/engine';

type Props = {
  visible: boolean;
  winner: 'p1' | 'p2' | 'draw';
  state: DashRunState;
  onRematch: () => void;
  onExit: () => void;
};

export function DashDuelResults({ visible, winner, state, onRematch, onExit }: Props) {
  const s1 = scoreForPlayer(state.p1, state.scroll);
  const s2 = scoreForPlayer(state.p2, state.scroll);
  const title = winner === 'p1' ? 'You win' : winner === 'p2' ? 'Rival wins' : 'Draw';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onExit}>
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
            <Text style={styles.title}>{title}</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.lbl}>You</Text>
                <Text style={styles.val}>{Math.floor(state.p1.bestScroll)}m</Text>
                <Text style={styles.sub}>{s1} pts</Text>
              </View>
              <Text style={styles.sep}>vs</Text>
              <View style={styles.col}>
                <Text style={styles.lbl}>Rival</Text>
                <Text style={styles.val}>{Math.floor(state.p2.bestScroll)}m</Text>
                <Text style={styles.sub}>{s2} pts</Text>
              </View>
            </View>
            <Text style={styles.seed}>Seed {state.seed}</Text>
            <AppButton title="Rematch" onPress={onRematch} />
            <AppButton className="mt-3" title="Exit to menu" variant="secondary" onPress={onExit} />
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
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
  sub: { color: '#94A3B8', fontSize: 13, fontWeight: '700', marginTop: 2 },
  sep: { color: 'rgba(148,163,184,0.6)', fontWeight: '900' },
  seed: { color: 'rgba(100,116,139,0.95)', fontSize: 10, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
});
