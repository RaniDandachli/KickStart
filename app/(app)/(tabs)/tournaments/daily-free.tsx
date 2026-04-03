import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import {
  DAILY_FREE_PRIZE_USD,
  DAILY_FREE_TOURNAMENT_ROUNDS,
  getRoundLabel,
} from '@/lib/dailyFreeTournament';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function DailyFreeTournamentScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const hydrated = useDailyFreeTournamentStore((s) => s.hydrated);
  const nextRound = useDailyFreeTournamentStore((s) => s.nextRound);
  const eliminated = useDailyFreeTournamentStore((s) => s.eliminated);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const resetCountdown = useDailyFreeResetClock(uid, hydrate);

  useFocusEffect(
    useCallback(() => {
      void hydrate(uid);
    }, [uid, hydrate]),
  );

  if (!ENABLE_DAILY_FREE_TOURNAMENT) {
    return (
      <Screen>
        <Text style={styles.off}>This event is not available.</Text>
        <AppButton title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const clearedToday = !eliminated && nextRound > DAILY_FREE_TOURNAMENT_ROUNDS;
  const canPlay = !eliminated && nextRound <= DAILY_FREE_TOURNAMENT_ROUNDS;
  const statusLine = eliminated
    ? `Today’s run ended in ${getRoundLabel(Math.min(nextRound, DAILY_FREE_TOURNAMENT_ROUNDS))}. New bracket at midnight.`
    : clearedToday
      ? `You cleared today’s ${DAILY_FREE_TOURNAMENT_ROUNDS}-round path — showcase prize tier $${DAILY_FREE_PRIZE_USD}. New bracket in ${resetCountdown}.`
      : canPlay
        ? `Next: ${getRoundLabel(nextRound)} (match ${nextRound} of ${DAILY_FREE_TOURNAMENT_ROUNDS})`
        : 'Bracket complete';

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <Ionicons name="chevron-back" size={22} color="#22d3ee" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>TOURNAMENT OF THE DAY</Text>
      <Text style={styles.prizeLine}>
        ${DAILY_FREE_PRIZE_USD} showcase prize · free entry · {DAILY_FREE_TOURNAMENT_ROUNDS} wins to crown
      </Text>
      <Text style={styles.body}>
        {`One entry per local day (resets at midnight). Ten skill rounds with rotating games — Tap Dash, Tile Clash, and Neon Ball Run — climb to the final for the $${DAILY_FREE_PRIZE_USD} showcase path or get knocked out along the way.`}
      </Text>
      <Text style={styles.countdownLine}>New tournament in {resetCountdown}</Text>
      <Text style={styles.disclaimer}>
        Prize details and eligibility follow the official event rules. No entry fee for this path.
      </Text>

      <LinearGradient
        colors={[runit.neonCyan, runit.neonPurple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statusBorder}
      >
        <View style={styles.statusInner}>
          <Text style={[styles.statusTitle, { fontFamily: runitFont.bold }]}>Today’s run</Text>
          <Text style={styles.statusBody}>{!hydrated ? 'Loading…' : statusLine}</Text>
        </View>
      </LinearGradient>

      <AppButton
        title={
          !hydrated
            ? 'Loading…'
            : canPlay
              ? 'Play next match'
              : clearedToday || eliminated
                ? 'Come back tomorrow'
                : 'Bracket complete'
        }
        disabled={!hydrated || !canPlay}
        onPress={() => router.push('/(app)/(tabs)/tournaments/daily-free-play')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#22d3ee', fontSize: 14, fontWeight: '700' },
  title: { color: runit.neonPink, fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  prizeLine: { color: 'rgba(203,213,225,0.95)', fontSize: 15, fontWeight: '800', marginBottom: 10 },
  body: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  disclaimer: { color: 'rgba(148,163,184,0.75)', fontSize: 11, lineHeight: 16, marginBottom: 18 },
  countdownLine: {
    color: '#fde68a',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
    fontVariant: ['tabular-nums'],
  },
  statusBorder: { borderRadius: 14, padding: 2, marginBottom: 16 },
  statusInner: {
    backgroundColor: 'rgba(8,4,18,0.92)',
    borderRadius: 12,
    padding: 14,
  },
  statusTitle: { color: '#fff', fontSize: 14, marginBottom: 6 },
  statusBody: { color: 'rgba(203,213,225,0.9)', fontSize: 13, lineHeight: 18 },
  off: { color: 'rgba(148,163,184,0.9)', marginBottom: 12 },
});
