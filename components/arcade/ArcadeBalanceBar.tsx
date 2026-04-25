import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';

interface Props {
  balanceLabel?: string;
  onAddPress?: () => void;
}

export function ArcadeBalanceBar({ balanceLabel = '12,456 PRIZE CREDITS', onAddPress }: Props) {
  return (
    <LinearGradient
      colors={[runit.neonPink, runit.neonPurple]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.outer, runitGlowPinkSoft]}
    >
      <View style={styles.inner}>
        <Text style={styles.coin}>🪙</Text>
        <Text style={styles.balance} numberOfLines={1}>
          {balanceLabel.toUpperCase()}
        </Text>
        <Pressable onPress={onAddPress} accessibilityRole="button" style={({ pressed }) => [styles.addWrap, pressed && styles.addPressed]}>
          <LinearGradient colors={[runit.neonCyan, '#CA8A04']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
            <Text style={styles.addText}>+</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 2, 14, 0.55)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  coin: { fontSize: 20, marginRight: 8 },
  balance: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: runitFont.black,
    ...runitTextGlowPink,
  },
  addWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    marginLeft: 8,
  },
  addPressed: {
    opacity: 0.85,
    ...runitGlowPinkSoft,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  addText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 22,
    fontFamily: runitFont.black,
    lineHeight: 24,
  },
});
