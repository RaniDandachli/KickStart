import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { env } from '@/lib/env';
import {
  FRIDAY_CUP_FORFEIT_GRACE_MINUTES,
  FRIDAY_CUP_MAX_PLAYERS,
  FRIDAY_CUP_NAME,
  FRIDAY_CUP_PRIZE_POOL_USD,
  FRIDAY_CUP_START_HOUR_LOCAL,
  nextFridayAtLocalHour,
  FRIDAY_CUP_ENTRY_USD,
} from '@/lib/fridayCashCup';
import { fridayCupBannerSource } from '@/lib/brandLogo';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { FridayCupBracketSection } from '@/features/tournaments/FridayCupBracketSection';
import { joinTournament } from '@/services/api/tournaments';
import { queryKeys } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useTournament } from '@/hooks/useTournaments';
import { useAuthStore } from '@/store/authStore';

export default function FridayCupScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const tid = env.EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID;
  const qc = useQueryClient();
  const { data: tournamentRow, refetch, isLoading: tournamentLoading } = useTournament(tid);
  const [busy, setBusy] = useState(false);

  const kickoff = useMemo(() => nextFridayAtLocalHour(FRIDAY_CUP_START_HOUR_LOCAL), []);
  const hasTournamentId = !!tid;
  const hasLiveTournament = !!(tid && tournamentRow);
  const shouldShowSetupHelp = !hasTournamentId || (!tournamentLoading && !hasLiveTournament);

  const onJoin = useCallback(async () => {
    if (!ENABLE_BACKEND || !tid) {
      Alert.alert(
        'Coming soon',
        'Link this screen to your live tournament by setting EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID to a row in `tournaments` ($10 entry, 8 players, single elimination).',
      );
      return;
    }
    if (!tournamentRow) {
      Alert.alert(
        'Cup unavailable',
        'This Friday cup ID is set, but no matching tournament was found yet. Verify EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID and restart the app.',
      );
      return;
    }
    if (!uid) {
      Alert.alert('Sign in required', 'Create an account and add funds to enter.');
      return;
    }
    setBusy(true);
    try {
      const r = await joinTournament(tid);
      if (!r.ok) {
        Alert.alert('Could not join', r.error ?? 'Try again later.');
        return;
      }
      Alert.alert(
        'You’re in',
        'You’ll show up in a bracket wave after an admin runs generateBracket for the next group. Watch this screen for updates.',
      );
      void refetch();
      void qc.invalidateQueries({ queryKey: ['tournaments'] });
      if (tid) void qc.invalidateQueries({ queryKey: queryKeys.tournamentBracket(tid) });
    } finally {
      setBusy(false);
    }
  }, [tid, uid, refetch, qc]);

  const goBracket = useCallback(() => {
    if (!tid) return;
    router.push(`/(app)/(tabs)/tournaments/${tid}/bracket`);
  }, [router, tid]);

  return (
    <Screen scroll>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backRow}>
        <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <View style={styles.bannerWrap} accessibilityLabel="Friday Cup">
        <Image source={fridayCupBannerSource} style={styles.bannerImage} contentFit="cover" />
      </View>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>{FRIDAY_CUP_NAME.toUpperCase()}</Text>
      <Text style={styles.sub}>Real head-to-head · single elimination · ${FRIDAY_CUP_ENTRY_USD} entry · ${FRIDAY_CUP_PRIZE_POOL_USD} prize pool</Text>

      <LinearGradient colors={[runit.neonCyan, '#6B21A8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBorder}>
        <View style={styles.heroInner}>
          <Text style={styles.heroLine}>Next kickoff (local time)</Text>
          <Text style={[styles.heroWhen, { fontFamily: runitFont.bold }]}>
            {kickoff.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.heroFine}>
            Each bracket wave is {FRIDAY_CUP_MAX_PLAYERS} players · signups can continue for more waves · matches start at{' '}
            {FRIDAY_CUP_START_HOUR_LOCAL}:00 — if you’re scheduled and don’t show within {FRIDAY_CUP_FORFEIT_GRACE_MINUTES} minutes, you
            forfeit and your opponent advances.
          </Text>
        </View>
      </LinearGradient>

      <FridayCupBracketSection tournamentId={tid} podSize={FRIDAY_CUP_MAX_PLAYERS} />

      <Text style={styles.body}>
        Signups stay open: every {FRIDAY_CUP_MAX_PLAYERS} players who have not yet been placed can get a new bracket wave
        (admin runs <Text style={styles.mono}>generateBracket</Text> per wave). This cup is a real-money skill competition — pool
        totals and payouts follow posted rules; operator fees may apply.
      </Text>

      {shouldShowSetupHelp ? (
        <Text style={styles.setupBox}>
          <Text style={styles.setupTitle}>Admin setup / troubleshoot</Text>
          {'\n'}1. In Supabase SQL, insert a tournament row (see <Text style={styles.mono}>supabase/scripts/seed-friday-eight-cup.example.sql</Text>)
          with <Text style={styles.mono}>unlimited_entrants = true</Text> and <Text style={styles.mono}>bracket_pod_size = 8</Text>.
          {'\n'}2. Copy the returned <Text style={styles.mono}>id</Text> into <Text style={styles.mono}>.env</Text> as{' '}
          <Text style={styles.mono}>EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID</Text> and restart the app.
          {'\n'}3. After each wave of entrants joins, call the <Text style={styles.mono}>generateBracket</Text> Edge Function (admin JWT) with
          that tournament id — repeat for waves 2, 3, … as you fill more groups of {FRIDAY_CUP_MAX_PLAYERS}.
        </Text>
      ) : null}

      {tid && tournamentRow ? (
        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>Live event</Text>
          <Text style={styles.liveMeta}>{tournamentRow.name}</Text>
          <Text style={styles.liveMeta}>
            State: {tournamentRow.state}
            {tournamentRow.unlimited_entrants
              ? ` · ${tournamentRow.current_player_count} joined · ${FRIDAY_CUP_MAX_PLAYERS} per bracket wave`
              : ` · ${tournamentRow.current_player_count}/${tournamentRow.max_players} joined`}
          </Text>
          <AppButton title="Full-screen bracket" onPress={goBracket} />
        </View>
      ) : (
        <Text style={styles.muted}>No tournament UUID in env yet — paste the Supabase tournament id to enable join + live data.</Text>
      )}

      <AppButton
        title={hasLiveTournament ? 'Enter ($10 wallet)' : 'Cup unavailable'}
        onPress={onJoin}
        disabled={busy || !hasLiveTournament}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  bannerWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  bannerImage: { width: '100%', aspectRatio: 2.85, backgroundColor: '#050816' },
  title: { color: runit.neonPink, fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  sub: { color: 'rgba(203,213,225,0.95)', fontSize: 14, fontWeight: '700', marginBottom: 14 },
  heroBorder: { borderRadius: 16, padding: 2, marginBottom: 16 },
  heroInner: {
    backgroundColor: 'rgba(8,12,24,0.94)',
    borderRadius: 14,
    padding: 16,
  },
  heroLine: { color: 'rgba(148,163,184,0.95)', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  heroWhen: { color: '#ecfeff', fontSize: 20, marginBottom: 10 },
  heroFine: { color: 'rgba(226,232,240,0.9)', fontSize: 13, lineHeight: 20 },
  body: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  setupBox: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  setupTitle: { color: '#e2e8f0', fontWeight: '800', fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 11, color: '#FFE082' },
  liveCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    marginBottom: 14,
    gap: 8,
  },
  liveTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  liveMeta: { color: 'rgba(203,213,225,0.9)', fontSize: 13 },
  muted: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginBottom: 12 },
});
