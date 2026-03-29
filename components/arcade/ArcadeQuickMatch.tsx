import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { arcade } from '@/lib/arcadeTheme';

interface Props {
  /** Open Home tab for real-money 1v1 (same games, cash stakes). */
  onCashHome: () => void;
  onTournament: () => void;
}

export function ArcadeQuickMatch({ onCashHome, onTournament }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.ruleRow}>
        <Text style={styles.sectionTitle}>Real money</Text>
        <View style={styles.ruleLine} />
      </View>
      <View style={styles.row}>
        <Pressable onPress={onCashHome} style={({ pressed }) => [styles.greyBtn, pressed && styles.pressed]}>
          <Text style={styles.greyTitle}>Home</Text>
          <Text style={styles.greySub}>Cash 1v1 vs players</Text>
        </Pressable>
        <Pressable onPress={onTournament} style={({ pressed }) => [styles.orangeWrap, pressed && styles.pressed]}>
          <LinearGradient colors={[arcade.orangeDeep, arcade.orange, '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orangeBtn}>
            <Ionicons name="trophy" size={22} color="#fff" style={styles.trophy} />
            <Text style={styles.orangeTitle}>Events</Text>
            <Text style={styles.orangeSub}>Tournaments</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionTitle: {
    color: arcade.textMuted,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ruleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.4)',
    marginLeft: 4,
  },
  row: { flexDirection: 'row', gap: 12 },
  greyBtn: {
    flex: 1,
    backgroundColor: 'rgba(248,250,252,0.95)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    elevation: 3,
  },
  greyTitle: { color: arcade.navy1, fontSize: 18, fontWeight: '900' },
  greySub: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 4 },
  orangeWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  orangeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    elevation: 6,
  },
  trophy: { marginBottom: 4 },
  orangeTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  orangeSub: { color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
