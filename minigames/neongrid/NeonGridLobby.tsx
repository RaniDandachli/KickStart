import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';

type Props = { onStart: () => void; onBack: () => void };

export function NeonGridLobby({ onStart, onBack }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
        <SafeIonicons name="chevron-back" size={26} color="#E2E8F0" />
      </Pressable>
      <Text style={styles.title}>Prize run</Text>
      <Text style={styles.sub}>Cross lanes · hop forward on open tiles · one mistake ends the run</Text>
      <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.card}>
        <Text style={styles.cardTxt}>Credits are debited when you tap Ready (backend mode).</Text>
      </LinearGradient>
      <AppButton title="Ready" onPress={onStart} />
      {Platform.OS === 'web' ? <Text style={styles.hint}>Space — start countdown (same as other arcade games)</Text> : null}
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
    borderColor: 'rgba(167,139,250,0.35)',
  },
  cardTxt: { color: 'rgba(226,232,240,0.95)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  hint: { marginTop: 10, textAlign: 'center', color: 'rgba(148,163,184,0.9)', fontSize: 12, fontWeight: '600' },
});
