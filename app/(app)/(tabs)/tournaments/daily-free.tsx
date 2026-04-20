import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { GuestAuthPromptModal } from '@/components/auth/GuestAuthPromptModal';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import {
  getDailyTournamentPrizeUsd,
  getDailyTournamentRounds,
  getRoundLabel,
  todayYmdLocal,
} from '@/lib/dailyFreeTournament';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function DailyFreeTournamentScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId ?? 'guest';
  const mustSignInToPlay = ENABLE_BACKEND && !userId;
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const hydrated = useDailyFreeTournamentStore((s) => s.hydrated);
  const nextRound = useDailyFreeTournamentStore((s) => s.nextRound);
  const eliminated = useDailyFreeTournamentStore((s) => s.eliminated);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const resetCountdown = useDailyFreeResetClock(uid, hydrate);
  const dayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const todaysKey = dayKey || todayYmdLocal();
  const dailyRounds = getDailyTournamentRounds(todaysKey);
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(todaysKey);

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

  const clearedToday = !eliminated && nextRound > dailyRounds;
  const canPlay = !eliminated && nextRound <= dailyRounds;
  const showSignInToPlay = mustSignInToPlay && canPlay;
  const statusLine = eliminated
    ? `Today’s run ended in ${getRoundLabel(Math.min(nextRound, dailyRounds))}. New bracket at midnight.`
    : clearedToday
      ? `You reached the end of today’s ${dailyRounds}-round path — showcase tier was $${dailyPrizeUsd}. New bracket in ${resetCountdown}.`
      : canPlay
        ? `Next: ${getRoundLabel(nextRound)} (match ${nextRound} of ${dailyRounds})`
        : 'Bracket complete';

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <SafeIonicons name="chevron-back" size={22} color="#22d3ee" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>TOURNAMENT OF THE DAY</Text>
      <Text style={styles.prizeLine}>${dailyPrizeUsd} daily showcase · free entry · {dailyRounds} rounds today</Text>
      <Text style={styles.body}>
        {Platform.OS === 'web'
          ? `One entry per local day (resets at midnight). On web, rounds rotate between Tap Dash and Tile Clash — survive all ${dailyRounds} matches to finish today’s path ($${dailyPrizeUsd} showcase). Use the app for Neon Ball Run and other 3D games.`
          : `One entry per local day (resets at midnight). Rotating skill rounds — Tap Dash, Tile Clash, and Neon Ball Run — survive all ${dailyRounds} rounds to finish today’s path ($${dailyPrizeUsd} showcase).`}
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
            : showSignInToPlay
              ? 'Sign in to play'
              : canPlay
                ? 'Play next match'
                : clearedToday || eliminated
                  ? 'Come back tomorrow'
                  : 'Bracket complete'
        }
        disabled={!hydrated || (!canPlay && !showSignInToPlay)}
        onPress={() => {
          if (showSignInToPlay) {
            setGuestAuthOpen(true);
            return;
          }
          router.push('/(app)/(tabs)/tournaments/daily-free-play');
        }}
      />

      <AppButton
        title="View bracket"
        variant="secondary"
        onPress={() => router.push('/(app)/(tabs)/tournaments/daily-free-bracket')}
      />

      <GuestAuthPromptModal
        visible={guestAuthOpen}
        variant="tournaments"
        onClose={() => setGuestAuthOpen(false)}
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
