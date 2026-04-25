import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { BracketPathBoard } from '@/features/tournaments/BracketPathBoard';
import { buildFakeBracketPath } from '@/lib/fakeBracketPathModel';
import { getCreditCupById } from '@/lib/cupTournaments';
import { DAILY_FREE_TOURNAMENT_ROUNDS } from '@/lib/dailyFreeTournament';
import { useProfile } from '@/hooks/useProfile';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useCupBracketStore } from '@/store/cupBracketStore';

export default function CupBracketScreen() {
  const router = useRouter();
  const { cupId: cupIdParam } = useLocalSearchParams<{ cupId?: string }>();
  const cupId = typeof cupIdParam === 'string' ? cupIdParam : '';
  const cup = getCreditCupById(cupId);
  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId ?? 'guest';
  const profileQ = useProfile(userId);
  const hydrate = useCupBracketStore((s) => s.hydrate);
  const nextRound = useCupBracketStore((s) => s.nextRound);
  const eliminated = useCupBracketStore((s) => s.eliminated);
  const loseAtRound = useCupBracketStore((s) => s.loseAtRound);

  useFocusEffect(
    useCallback(() => {
      if (cup?.id) void hydrate(uid, cup.id);
    }, [uid, cup?.id, hydrate]),
  );

  const youName =
    (profileQ.data?.display_name && profileQ.data.display_name.trim()) ||
    profileQ.data?.username ||
    'You';

  const cells =
    cup &&
    buildFakeBracketPath({
      totalRounds: DAILY_FREE_TOURNAMENT_ROUNDS,
      nextRound,
      eliminated,
      loseAtRound,
      youName,
      userKey: uid,
      mode: 'cup',
      cupId: cup.id,
    });

  if (!cup || !cells) {
    return (
      <Screen>
        <Text style={styles.off}>Cup not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
          <Text style={styles.backTxt}>Back</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backRow}>
        <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
        <Text style={styles.backTxt}>Back</Text>
      </Pressable>

      <Text style={[styles.h1, { fontFamily: runitFont.black }, runitTextGlowPink]}>{cup.name.toUpperCase()} · BRACKET</Text>
      <Text style={styles.lede}>
        {cup.prizeCredits.toLocaleString()} prize credits on a full clear — your run for today.
      </Text>

      <BracketPathBoard title="Cup path" subtitle="One match per round · same flow as Tournament of the Day" cells={cells} youName={youName} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  h1: { color: runit.neonPink, fontSize: 20, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
  lede: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  off: { color: 'rgba(148,163,184,0.9)', marginBottom: 12 },
});
