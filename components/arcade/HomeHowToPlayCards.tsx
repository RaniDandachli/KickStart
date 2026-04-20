import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { runit, runitFont } from '@/lib/runitArcadeTheme';

/** Shared deep panel — same family as H2H rows / hero */
const PANEL = ['#070b18', '#0d152c', '#162442'] as const;
const CYAN = '#22d3ee';

type Props = {
  onQuickMatch: () => void;
  onBrowseLive: () => void;
  onChooseContest: () => void;
};

/** Compact mode cards — plum/magenta/cyan only (matches Run It Arcade shell) */
export function HomeHowToPlayCards({ onQuickMatch, onBrowseLive, onChooseContest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.pageTitle, { fontFamily: runitFont.black }]}>How do you want to play?</Text>

      <Pressable
        onPress={onQuickMatch}
        accessibilityRole="button"
        accessibilityLabel="Quick match"
        style={({ pressed }) => [styles.cardOuter, pressed && styles.cardPressed]}
      >
        <LinearGradient
          colors={['rgba(34,211,238,0.55)', runit.neonPurple]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.cardBorderGlow}
        >
          <LinearGradient colors={[...PANEL]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardInner}>
            <View style={styles.cardRow}>
              <View style={[styles.iconBox, styles.iconBoxQuick]}>
                <SafeIonicons name="flash" size={20} color={CYAN} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.cardTitle, { fontFamily: runitFont.black }]}>Quick match</Text>
                <Text style={styles.cardSub}>Instant random matchup</Text>
                <Text style={styles.cardHint}>Any game · fastest queue</Text>
              </View>
            </View>
            <View style={styles.ctaRow}>
              <LinearGradient
                colors={['rgba(34,211,238,0.9)', runit.neonPurple]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.ctaPill}
              >
                <Text style={styles.ctaPillText}>Play now</Text>
              </LinearGradient>
            </View>
          </LinearGradient>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={onBrowseLive}
        accessibilityRole="button"
        accessibilityLabel="Browse live matches"
        style={({ pressed }) => [styles.cardOuter, pressed && styles.cardPressed]}
      >
        <LinearGradient
          colors={[runit.neonPink, runit.neonPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardBorderGlow}
        >
          <LinearGradient colors={[...PANEL]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardInner}>
            <View style={styles.cardRow}>
              <View style={[styles.iconBox, styles.iconBoxLive]}>
                <View style={styles.liveDot} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.cardTitle, { fontFamily: runitFont.black }]}>Live matches</Text>
                <Text style={styles.cardSub}>Join open matches or host your own</Text>
                <Text style={styles.cardHint}>Pick from waiting players</Text>
              </View>
            </View>
            <View style={styles.ctaRow}>
              <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.ctaPill}>
                <Text style={styles.ctaPillText}>Browse live</Text>
              </LinearGradient>
            </View>
          </LinearGradient>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={onChooseContest}
        accessibilityRole="button"
        accessibilityLabel="Choose your contest"
        style={({ pressed }) => [styles.cardOuter, pressed && styles.cardPressed]}
      >
        <LinearGradient
          colors={[runit.neonPurple, 'rgba(225,29,140,0.85)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.cardBorderGlow}
        >
          <LinearGradient colors={[...PANEL]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardInner}>
            <View style={styles.starfield} pointerEvents="none">
              {[12, 28, 44, 62, 78, 22, 55, 88].map((left, i) => (
                <View
                  key={i}
                  style={[styles.star, { left: `${left}%`, top: `${(i * 11) % 70}%`, opacity: 0.12 + (i % 5) * 0.06 }]}
                />
              ))}
            </View>
            <View style={styles.cardRow}>
              <View style={[styles.iconBox, styles.iconBoxContest]}>
                <SafeIonicons name="trophy" size={19} color="rgba(252,231,243,0.95)" />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.cardTitle, { fontFamily: runitFont.black }]}>Choose your contest</Text>
                <Text style={styles.cardSub}>Pick entry fee + game · compete your way</Text>
              </View>
            </View>
            <View style={styles.ctaRow}>
              <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.ctaPill}>
                <Text style={styles.ctaPillText}>Select contest</Text>
              </LinearGradient>
            </View>
          </LinearGradient>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4, marginTop: 0 },
  pageTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardOuter: { marginBottom: 8 },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cardBorderGlow: {
    borderRadius: 14,
    padding: 1.5,
    shadowColor: 'rgba(255,0,110,0.25)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  cardInner: {
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBoxQuick: {
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderColor: 'rgba(34,211,238,0.28)',
  },
  iconBoxLive: {
    backgroundColor: 'rgba(255,0,110,0.12)',
    borderColor: 'rgba(255,0,110,0.28)',
  },
  iconBoxContest: {
    backgroundColor: 'rgba(255, 0, 110, 0.18)',
    borderColor: 'rgba(167,139,250,0.32)',
  },
  liveDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: runit.neonPink,
    shadowColor: runit.neonPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    elevation: 3,
  },
  textCol: { flex: 1, minWidth: 0 },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '900', marginBottom: 2, letterSpacing: 0.15 },
  cardSub: { color: 'rgba(226,232,240,0.88)', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  cardHint: { color: 'rgba(148,163,184,0.9)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  ctaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  ctaPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ctaPillText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  starfield: { ...StyleSheet.absoluteFillObject },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(196,181,253,0.7)',
  },
});
