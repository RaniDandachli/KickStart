import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { BracketPathBoard } from '@/features/tournaments/BracketPathBoard';
import { buildFakeBracketPath } from '@/lib/fakeBracketPathModel';
import { getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { useProfile } from '@/hooks/useProfile';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function DailyFreeBracketScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId ?? 'guest';
  const profileQ = useProfile(userId);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const nextRound = useDailyFreeTournamentStore((s) => s.nextRound);
  const eliminated = useDailyFreeTournamentStore((s) => s.eliminated);
  const loseAtRound = useDailyFreeTournamentStore((s) => s.loseAtRound);
  const dayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const todaysKey = dayKey || todayYmdLocal();
  const totalRounds = getDailyTournamentRounds(todaysKey);

  useFocusEffect(
    useCallback(() => {
      void hydrate(uid);
    }, [uid, hydrate]),
  );

  const youName =
    (profileQ.data?.display_name && profileQ.data.display_name.trim()) ||
    profileQ.data?.username ||
    'You';

  const cells = buildFakeBracketPath({
    totalRounds,
    nextRound,
    eliminated,
    loseAtRound,
    youName,
    userKey: uid,
    mode: 'daily',
  });

  if (!ENABLE_DAILY_FREE_TOURNAMENT) {
    return (
      <Screen>
        <Text style={styles.off}>Unavailable.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backRow}>
        <SafeIonicons name="chevron-back" size={22} color="#22d3ee" />
        <Text style={styles.backTxt}>Back</Text>
      </Pressable>

      <Text style={[styles.h1, { fontFamily: runitFont.black }, runitTextGlowPink]}>YOUR BRACKET</Text>
      <Text style={styles.lede}>
        Tournament of the Day — your path through today’s rounds. Opponents are matched for this event; focus on your
        skill games.
      </Text>

      <BracketPathBoard
        title="Run path"
        subtitle="Scroll horizontally · greens are wins, live match is highlighted"
        cells={cells}
        youName={youName}
      />

      <View style={styles.note}>
        <SafeIonicons name="information-circle-outline" size={18} color={runit.neonCyan} />
        <Text style={styles.noteTxt}>
          Showcase prizes follow official rules. Bracket layout is for clarity — pairings may be resolved automatically
          after each round.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#22d3ee', fontSize: 14, fontWeight: '700' },
  h1: { color: runit.neonPink, fontSize: 22, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  lede: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  note: { flexDirection: 'row', gap: 10, marginTop: 20, padding: 12, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.65)' },
  noteTxt: { flex: 1, color: 'rgba(203,213,225,0.88)', fontSize: 12, lineHeight: 17 },
  off: { color: 'rgba(148,163,184,0.9)' },
});
