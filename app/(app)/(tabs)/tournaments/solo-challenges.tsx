import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { SOLO_CHALLENGES } from '@/lib/soloChallenges';
import { getSoloTriesUsedToday, SOLO_CHALLENGE_MAX_TRIES_PER_DAY } from '@/lib/soloChallengeTries';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export default function SoloChallengesScreen() {
  const router = useRouter();
  const [tries, setTries] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const next: Record<string, number> = {};
    for (const c of SOLO_CHALLENGES) {
      next[c.id] = await getSoloTriesUsedToday(c.id);
    }
    setTries(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen scroll>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backRow}>
        <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>SOLO CHALLENGES</Text>
      <Text style={styles.sub}>
        Free entry · beat the target score in one run · {SOLO_CHALLENGE_MAX_TRIES_PER_DAY} tries per challenge per day · prizes are showcase
        amounts until eligibility is verified
      </Text>

      {SOLO_CHALLENGES.map((c) => {
        const used = tries[c.id] ?? 0;
        const remaining = Math.max(0, SOLO_CHALLENGE_MAX_TRIES_PER_DAY - used);
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              const prizeLabel = encodeURIComponent(`$${c.showcasePrizeUsd} showcase`);
              router.push(
                `/(app)/(tabs)/play/minigames/tap-dash?challengeId=${encodeURIComponent(c.id)}&targetScore=${c.targetScore}&prizeLabel=${prizeLabel}` as never,
              );
            }}
            style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient colors={[runit.neonPink, '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBorder}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <Text style={[styles.cardName, { fontFamily: runitFont.bold }]}>{c.title}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillTxt}>FREE</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{c.subtitle}</Text>
                <Text style={styles.prize}>${c.showcasePrizeUsd} showcase prize (policy-dependent)</Text>
                <Text style={styles.tries}>
                  Tries left today: {remaining}/{SOLO_CHALLENGE_MAX_TRIES_PER_DAY}
                </Text>
                <View style={styles.footer}>
                  <Text style={styles.link}>Play</Text>
                  <SafeIonicons name="chevron-forward" size={14} color={runit.neonPink} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  title: { color: runit.neonPink, fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  sub: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  cardWrap: { marginBottom: 14 },
  cardBorder: { borderRadius: 14, padding: 2 },
  cardInner: {
    backgroundColor: 'rgba(8,4,18,0.92)',
    borderRadius: 12,
    padding: 14,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardName: { flex: 1, color: '#f8fafc', fontSize: 17, fontWeight: '900' },
  pill: {
    borderWidth: 1,
    borderColor: '#39ff14',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillTxt: { color: '#39ff14', fontSize: 11, fontWeight: '900' },
  meta: { color: 'rgba(203,213,225,0.92)', fontSize: 13, marginTop: 8, lineHeight: 19 },
  prize: { color: '#fde68a', fontSize: 14, fontWeight: '800', marginTop: 10 },
  tries: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginTop: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10 },
  link: { color: runit.neonPink, fontSize: 13, fontWeight: '800' },
});
