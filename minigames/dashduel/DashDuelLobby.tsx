import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';

type Props = { onStart: () => void; onBack: () => void };

export function DashDuelLobby({ onStart, onBack }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
        <SafeIonicons name="chevron-back" size={26} color="#E2E8F0" />
      </Pressable>
      <Text style={styles.title}>Match lobby</Text>
      <Text style={styles.sub}>1v1 same seed · PvP: random who goes first · higher score wins</Text>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.card}>
        <View style={styles.row}>
          <LinearGradient colors={['#22D3EE', '#34D399']} style={styles.av}>
            <Text style={styles.avt}>You</Text>
          </LinearGradient>
          <Text style={styles.vs}>VS</Text>
          <LinearGradient colors={['#A78BFA', '#6366F1']} style={styles.av}>
            <Text style={styles.avt}>NeoRival</Text>
          </LinearGradient>
        </View>
        <Text style={styles.feeLine}>Contest access $5 · Top performer prize $9 · Run It</Text>
      </LinearGradient>
      <AppButton title="Ready" onPress={onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, justifyContent: 'center' },
  back: { position: 'absolute', top: 8, left: 8, zIndex: 2, padding: 8 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  sub: { color: 'rgba(148,163,184,0.95)', textAlign: 'center', marginTop: 6, marginBottom: 20, fontWeight: '600' },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 },
  av: {
    width: 88,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avt: { color: '#0f172a', fontWeight: '900', fontSize: 12 },
  vs: { color: '#FDE047', fontWeight: '900', fontSize: 18 },
  feeLine: { color: 'rgba(100,116,139,0.95)', fontSize: 11, textAlign: 'center', fontWeight: '600' },
});
