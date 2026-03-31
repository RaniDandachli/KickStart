import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useArcadeGrantBannerStore } from '@/store/arcadeGrantBannerStore';
import { runitFont } from '@/lib/runitArcadeTheme';

/** Shown on Arcade when welcome or daily credits were just applied (guest mode). */
export function ArcadeGrantBanner() {
  const welcome = useArcadeGrantBannerStore((s) => s.welcome);
  const daily = useArcadeGrantBannerStore((s) => s.daily);
  const clear = useArcadeGrantBannerStore((s) => s.clear);

  if (welcome <= 0 && daily <= 0) return null;

  let msg = '';
  if (welcome > 0 && daily > 0) {
    msg = `Welcome bonus +${welcome.toLocaleString()} · Daily free +${daily.toLocaleString()} prize credits`;
  } else if (welcome > 0) {
    msg = `Welcome! +${welcome.toLocaleString()} prize credits added`;
  } else {
    msg = `Daily bonus +${daily.toLocaleString()} prize credits`;
  }

  return (
    <LinearGradient colors={['rgba(16,185,129,0.35)', 'rgba(6,182,212,0.25)']} style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name="gift" size={22} color="#a7f3d0" />
        <Text style={[styles.txt, { fontFamily: runitFont.black }]}>{msg}</Text>
        <Pressable onPress={() => clear()} hitSlop={12} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={20} color="rgba(226,232,240,0.85)" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.45)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  txt: { flex: 1, color: '#ecfdf5', fontSize: 13, lineHeight: 18, fontWeight: '800' },
});
