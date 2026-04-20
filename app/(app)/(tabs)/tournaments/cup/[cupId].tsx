import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { GuestAuthPromptModal } from '@/components/auth/GuestAuthPromptModal';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { getCreditCupById } from '@/lib/cupTournaments';
import { DAILY_FREE_TOURNAMENT_ROUNDS, getRoundLabel } from '@/lib/dailyFreeTournament';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useCupBracketStore } from '@/store/cupBracketStore';
import { useCupDailyRunStore } from '@/store/cupDailyRunStore';

export default function CreditCupHubScreen() {
  const router = useRouter();
  const { cupId } = useLocalSearchParams<{ cupId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId ?? 'guest';
  const mustSignInToPlay = ENABLE_BACKEND && !userId;
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const cup = typeof cupId === 'string' ? getCreditCupById(cupId) : undefined;

  const hydrated = useCupBracketStore((s) => s.hydrated);
  const nextRound = useCupBracketStore((s) => s.nextRound);
  const eliminated = useCupBracketStore((s) => s.eliminated);
  const hydrate = useCupBracketStore((s) => s.hydrate);
  const cupDailyHydrate = useCupDailyRunStore((s) => s.hydrate);
  const committedCupId = useCupDailyRunStore((s) => s.committedCupId);

  const hydrateCup = useCallback(
    async (k: string) => {
      if (cup?.id) await hydrate(k, cup.id);
    },
    [cup?.id, hydrate],
  );
  useDailyFreeResetClock(uid, async (k) => {
    await hydrateCup(k);
    await cupDailyHydrate(k);
  });

  useFocusEffect(
    useCallback(() => {
      if (cup?.id) void hydrate(uid, cup.id);
      void cupDailyHydrate(uid);
    }, [uid, cup?.id, hydrate, cupDailyHydrate]),
  );

  if (!cup) {
    return (
      <Screen>
        <Text style={styles.off}>Cup not found.</Text>
        <AppButton title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const clearedToday = !eliminated && nextRound > DAILY_FREE_TOURNAMENT_ROUNDS;
  const blockedByOtherCup = !!(committedCupId && committedCupId !== cup.id);
  const canPlay =
    !blockedByOtherCup && !eliminated && nextRound <= DAILY_FREE_TOURNAMENT_ROUNDS;
  const showSignInToPlay = mustSignInToPlay && canPlay;
  const otherCupName = blockedByOtherCup ? getCreditCupById(committedCupId!)?.name : undefined;
  const statusLine = blockedByOtherCup
    ? `Your Run It cup run today is on ${otherCupName ?? 'another cup'}. One cup run per day — back at midnight.`
    : eliminated
      ? `Run ended in ${getRoundLabel(Math.min(nextRound, DAILY_FREE_TOURNAMENT_ROUNDS))}. New bracket at midnight.`
      : clearedToday
        ? `You cleared this cup — ${cup.prizeCredits.toLocaleString()} prize credits are yours. This cup is done until tomorrow.`
        : canPlay
          ? `Next: ${getRoundLabel(nextRound)} (match ${nextRound} of ${DAILY_FREE_TOURNAMENT_ROUNDS})`
          : 'Bracket complete';

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backRow}>
        <SafeIonicons name="chevron-back" size={22} color="#22d3ee" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>{cup.name.toUpperCase()}</Text>
      <Text style={styles.sub}>{cup.subtitle}</Text>
      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.prizeBand}>
        <Text style={styles.prizeBandTxt}>
          Win {DAILY_FREE_TOURNAMENT_ROUNDS} matches · {cup.prizeCredits.toLocaleString()} prize credits to your account
        </Text>
      </LinearGradient>
      <Text style={styles.body}>
        One Run It cup run per day across all tiers — pick the cup you want first. Same single-elimination flow as Tournament of the Day:
        rotating skill games, fixed outcomes per round. Clear the bracket to credit prize credits (server-side when signed in).
      </Text>

      <LinearGradient colors={[runit.neonCyan, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusBorder}>
        <View style={styles.statusInner}>
          <Text style={[styles.statusTitle, { fontFamily: runitFont.bold }]}>Today&apos;s run</Text>
          <Text style={styles.statusBody}>{!hydrated ? 'Loading…' : statusLine}</Text>
        </View>
      </LinearGradient>

      <AppButton
        title={
          !hydrated
            ? 'Loading…'
            : blockedByOtherCup
              ? 'Cup run on another tier'
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
          router.push(`/(app)/(tabs)/tournaments/cup/${cup.id}/play`);
        }}
      />

      <AppButton
        title="View bracket"
        variant="secondary"
        onPress={() => router.push(`/(app)/(tabs)/tournaments/cup-bracket?cupId=${encodeURIComponent(cup.id)}`)}
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
  title: { color: runit.neonPink, fontSize: 22, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  sub: { color: 'rgba(148,163,184,0.95)', fontSize: 13, marginBottom: 10 },
  prizeBand: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  prizeBandTxt: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  body: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
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
