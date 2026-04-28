import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  appChromeLinePink,
  runit,
  runitFont,
  runitGlowCyanSoft,
  runitGlowPinkSoft,
  runitTextGlowCyan,
  runitTextGlowPink,
} from '@/lib/runitArcadeTheme';

interface Props {
  /** Head-to-head 1v1 (Home tab). */
  onOneVsOne: () => void;
  /** Quick solo minigame. */
  onSoloPlay: () => void;
  /** Free + wallet score challenges (Tap Dash first). */
  onMoneyChallenges: () => void;
  onTournament: () => void;
}

export function ArcadeQuickMatch({ onOneVsOne, onSoloPlay, onMoneyChallenges, onTournament }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.ruleRow}>
        <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>QUICK PLAY</Text>
        <View style={styles.ruleLine} />
      </View>
      <View style={styles.row}>
        <Pressable onPress={onOneVsOne} style={({ pressed }) => [styles.cardOuter, pressed && styles.pressed]}>
          <LinearGradient
            colors={[runit.neonPink, 'rgba(255,0,110,0.35)', 'rgba(6,2,14,0.95)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.card1, runitGlowPinkSoft]}
          >
            <SafeIonicons name="flash" size={28} color="#fff" style={styles.cardIcon} />
            <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>1v1</Text>
            <Text style={styles.cardSub}>BATTLE</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={onSoloPlay} style={({ pressed }) => [styles.cardOuter, pressed && styles.pressed]}>
          <LinearGradient
            colors={[runit.neonCyan, 'rgba(0,240,255,0.25)', 'rgba(6,2,14,0.95)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.card1, runitGlowCyanSoft]}
          >
            <SafeIonicons name="star" size={26} color="#fff" style={styles.cardIcon} />
            <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>SOLO</Text>
            <Text style={styles.cardSub}>PLAY</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable onPress={onMoneyChallenges} style={({ pressed }) => [styles.moneyRow, pressed && styles.pressed]}>
        <LinearGradient
          colors={[runit.neonPink, '#a16207', runit.neonPurple]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.eventsGrad, { borderRadius: 14 }]}
        >
          <SafeIonicons name="cash-outline" size={22} color="#fff" />
          <Text style={[styles.eventsText, { fontFamily: runitFont.black }]}>DAILY RACE</Text>
          <SafeIonicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onTournament} style={({ pressed }) => [styles.eventsRow, pressed && styles.pressed]}>
        <LinearGradient
          colors={[runit.neonPurple, runit.neonPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.eventsGrad}
        >
          <SafeIonicons name="trophy" size={20} color="#fff" />
          <Text style={[styles.eventsText, { fontFamily: runitFont.black }]}>EVENTS · TOURNAMENTS</Text>
          <SafeIonicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  ruleLine: {
    flex: 1,
    height: 1,
    backgroundColor: appChromeLinePink,
    marginLeft: 4,
  },
  row: { flexDirection: 'row', gap: 10 },
  cardOuter: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  card1: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    minHeight: 120,
  },
  cardIcon: { marginBottom: 6 },
  cardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 2,
  },
  cardSubDark: { color: 'rgba(255,255,255,0.9)' },
  moneyRow: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(253,224,71,0.45)',
  },
  eventsRow: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  eventsGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  eventsText: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
});
