import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { joinTournament } from '@/services/api/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useTournament } from '@/hooks/useTournaments';
import { useAuthStore } from '@/store/authStore';

export default function FridayCupScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const tid = env.EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID;
  const qc = useQueryClient();
  const { data: tournamentRow, refetch } = useTournament(tid);
  const [busy, setBusy] = useState(false);

  const kickoff = useMemo(() => nextFridayAtLocalHour(FRIDAY_CUP_START_HOUR_LOCAL), []);

  const onJoin = useCallback(async () => {
    if (!ENABLE_BACKEND || !tid) {
      Alert.alert(
        'Coming soon',
        'Link this screen to your live tournament by setting EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID to a row in `tournaments` ($10 entry, 8 players, single elimination).',
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
      Alert.alert('You’re in', 'Bracket updates live here once the event is generated. Be ready at kickoff.');
      void refetch();
      void qc.invalidateQueries({ queryKey: ['tournaments'] });
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
        <SafeIonicons name="chevron-back" size={22} color="#22d3ee" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>{FRIDAY_CUP_NAME.toUpperCase()}</Text>
      <Text style={styles.sub}>Real head-to-head · single elimination · ${FRIDAY_CUP_ENTRY_USD} entry · ${FRIDAY_CUP_PRIZE_POOL_USD} prize pool</Text>

      <LinearGradient colors={[runit.neonCyan, '#0369a1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBorder}>
        <View style={styles.heroInner}>
          <Text style={styles.heroLine}>Next kickoff (local time)</Text>
          <Text style={[styles.heroWhen, { fontFamily: runitFont.bold }]}>
            {kickoff.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.heroFine}>
            {FRIDAY_CUP_MAX_PLAYERS} players · matches start at {FRIDAY_CUP_START_HOUR_LOCAL}:00 — if you’re scheduled and don’t show within{' '}
            {FRIDAY_CUP_FORFEIT_GRACE_MINUTES} minutes, you forfeit and your opponent advances.
          </Text>
        </View>
      </LinearGradient>

      <Text style={styles.body}>
        This cup is real money skill competition: you face other entrants in scheduled games. Pool totals and payouts follow the posted rules;
        operator fees may apply. Configure the Supabase tournament row + bracket generation in the dashboard, then paste its UUID into{' '}
        <Text style={styles.mono}>EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID</Text>.
      </Text>

      {tid && tournamentRow ? (
        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>Live event</Text>
          <Text style={styles.liveMeta}>{tournamentRow.name}</Text>
          <Text style={styles.liveMeta}>
            State: {tournamentRow.state} · {tournamentRow.current_player_count}/{tournamentRow.max_players} joined
          </Text>
          <AppButton title="View bracket" onPress={goBracket} />
        </View>
      ) : (
        <Text style={styles.muted}>No tournament UUID configured — join button explains setup.</Text>
      )}

      <AppButton title={tid ? 'Enter ($10 wallet)' : 'Setup required'} onPress={onJoin} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#22d3ee', fontSize: 14, fontWeight: '700' },
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
  mono: { fontFamily: 'monospace', fontSize: 11, color: '#a5f3fc' },
  liveCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    marginBottom: 14,
    gap: 8,
  },
  liveTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  liveMeta: { color: 'rgba(203,213,225,0.9)', fontSize: 13 },
  muted: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginBottom: 12 },
});
