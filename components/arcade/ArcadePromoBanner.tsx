import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export function ArcadePromoBanner() {
  return (
    <LinearGradient
      colors={[runit.neonPurple, runit.neonPink, runit.neonPurple]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, runitGlowPinkSoft]}
    >
      <View style={styles.innerBorder}>
        <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>PRIZE CREDITS</Text>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>Beat the AI</Text>
        <Text style={styles.sub}>
          Prize credits pay for prize runs vs AI. Save redeem tickets for the Prizes shop — gear, gift cards, and more.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    padding: 3,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  innerBorder: {
    borderRadius: 13,
    backgroundColor: 'rgba(5, 2, 12, 0.45)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  kicker: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sub: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
