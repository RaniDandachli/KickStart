import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { GuestAuthPromptModal } from '@/components/auth/GuestAuthPromptModal';
import { ENABLE_BACKEND, ENABLE_WEEKLY_RACE } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useWeeklyRaceEntry } from '@/hooks/useWeeklyRaceEntry';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import {
  buildWeeklyRaceLeaderboardView,
  labelForWeeklyRaceGame,
  nextWeeklyRaceDayKey,
  pickWeeklyRaceGameKey,
  routeForWeeklyRaceGameKey,
  WEEKLY_RACE_ENTRY_FEE_CENTS,
  WEEKLY_RACE_MAX_ATTEMPTS,
  WEEKLY_RACE_PAYOUTS_USD,
  weeklyRaceDayKey,
} from '@/lib/weeklyRace';
import {
  appChromeGradientFadePink,
  runit,
  runitFont,
  runitTextGlowPink,
} from '@/lib/runitArcadeTheme';
import { enterWeeklyRaceClient, finalizeWeeklyRacePendingDaysClient } from '@/services/api/weeklyRace';
import { useAuthStore } from '@/store/authStore';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';

export default function WeeklyRaceScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const [guestOpen, setGuestOpen] = useState(false);
  const qc = useQueryClient();
  const dayKey = useMemo(() => weeklyRaceDayKey(), []);
  const tomorrowKey = useMemo(() => nextWeeklyRaceDayKey(), []);
  const todaysGame = useMemo(() => pickWeeklyRaceGameKey(dayKey), [dayKey]);
  const tomorrowsGame = useMemo(() => pickWeeklyRaceGameKey(tomorrowKey), [tomorrowKey]);
  const playRoute = routeForWeeklyRaceGameKey(todaysGame);
  const profileQ = useProfile(uid);
  const entryQ = useWeeklyRaceEntry();
  const walletCents = profileQ.data?.wallet_cents ?? 0;
  const displayName = (profileQ.data?.display_name?.trim() || profileQ.data?.username || 'You').trim();

  useFocusEffect(
    useCallback(() => {
      if (!ENABLE_BACKEND || !uid) return;
      void (async () => {
        const r = await finalizeWeeklyRacePendingDaysClient();
        if (!r.ok || !uid) return;
        const cents = r.you_received_cents ?? 0;
        if (cents > 0) {
          void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
          void invalidateProfileEconomy(qc, uid);
          Alert.alert(
            'Weekly Race prize',
            `We added ${formatUsdFromCents(cents)} to your cash wallet for finishing in the top 3 on an eligible day. Keep climbing the board!`,
          );
        }
      })();
    }, [uid, qc]),
  );

  const leaderboard = useMemo(
    () =>
      buildWeeklyRaceLeaderboardView({
        dayKey,
        gameKey: todaysGame,
        yourBest: entryQ.data?.best_score != null ? entryQ.data!.best_score : null,
        yourDisplayName: displayName,
      }),
    [dayKey, todaysGame, entryQ.data?.best_score, displayName],
  );

  const enterM = useMutation({
    mutationFn: async () => {
      if (!ENABLE_BACKEND) throw new Error('Backend disabled');
      return enterWeeklyRaceClient(dayKey, todaysGame);
    },
    onSuccess: (r) => {
      if (!r?.ok) {
        Alert.alert('Could not enter', r?.error ?? 'Try again.');
        return;
      }
      void qc.invalidateQueries({ queryKey: queryKeys.weeklyRace(dayKey) });
      if (uid) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
        void invalidateProfileEconomy(qc, uid);
      }
      Alert.alert('You’re in', 'Play up to 10 runs today. We keep your best score for the board.');
    },
    onError: (e: Error) => Alert.alert('Could not enter', e.message),
  });

  const onEnter = useCallback(() => {
    if (!uid) {
      setGuestOpen(true);
      return;
    }
    if (walletCents < WEEKLY_RACE_ENTRY_FEE_CENTS) {
      Alert.alert('Add funds', `You need ${formatUsdFromCents(WEEKLY_RACE_ENTRY_FEE_CENTS)} in your cash wallet.`);
      return;
    }
    if (entryQ.data) {
      Alert.alert('Already entered', "You're already in today’s race.");
      return;
    }
    enterM.mutate();
  }, [uid, walletCents, entryQ.data, enterM]);

  const onPlay = useCallback(() => {
    if (!uid) {
      setGuestOpen(true);
      return;
    }
    if (!entryQ.data) {
      Alert.alert('Enter first', 'Pay the entry fee to unlock your 10 scored runs.');
      return;
    }
    if (!playRoute) {
      Alert.alert('Route missing', "Couldn’t open today’s minigame.");
      return;
    }
    if (entryQ.data.attempts_used >= WEEKLY_RACE_MAX_ATTEMPTS) {
      Alert.alert('No runs left', "You've used all 10 scored attempts for today.");
      return;
    }
    if (entryQ.data.game_key !== todaysGame) {
      Alert.alert('Game mismatch', 'Your entry is for a different build — try again after daily reset.');
      return;
    }
    const href = `${playRoute}?weeklyRace=1` as Href;
    router.push(href);
  }, [uid, entryQ.data, playRoute, router, todaysGame]);

  if (!ENABLE_WEEKLY_RACE) {
    return (
      <Screen>
        <Text style={styles.muted}>Weekly Race is not available in this build.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>WEEKLY RACE</Text>
      <Text style={styles.supportBanner}>
        We&apos;re still small — pools will grow over time and prize amounts will climb. Thanks for sticking with Run It
        Arcade; keep practicing and competing.
      </Text>
      <Text style={styles.sub}>
        $10 entry · 10 scored runs · best score counts · a different minigame every day at local midnight (no Stacker, no Turbo
        Arena). Top three cash scores among real entrants split ${WEEKLY_RACE_PAYOUTS_USD.first} / $
        {WEEKLY_RACE_PAYOUTS_USD.second} / ${WEEKLY_RACE_PAYOUTS_USD.third}, credited after the day completes (UTC rollover).
      </Text>

      <LinearGradient
        colors={[runit.neonCyan, appChromeGradientFadePink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardBorder}
      >
        <View style={styles.cardInner}>
          <Text style={styles.cardLbl}>TODAY&apos;S GAME</Text>
          <Text style={styles.cardGame}>{labelForWeeklyRaceGame(todaysGame)}</Text>
          <Text style={styles.rotateHint}>
            Tomorrow resets the board · next game preview:{' '}
            <Text style={styles.rotateHintStrong}>{labelForWeeklyRaceGame(tomorrowsGame)}</Text>
          </Text>
          <Text style={styles.cardMeta}>
            Day {dayKey} · Prizes credit to wallet: 1st ${WEEKLY_RACE_PAYOUTS_USD.first} · 2nd $
            {WEEKLY_RACE_PAYOUTS_USD.second} · 3rd ${WEEKLY_RACE_PAYOUTS_USD.third} · among everyone who entered for that date.
          </Text>
        </View>
      </LinearGradient>

      {!ENABLE_BACKEND ? (
        <Text style={styles.warn}>Enable the backend to enter with your wallet (set EXPO_PUBLIC_ENABLE_BACKEND=true).</Text>
      ) : null}

      <View style={styles.rowActions}>
        <AppButton
          title={
            entryQ.data
              ? 'Entered for today'
              : `Enter ${formatUsdFromCents(WEEKLY_RACE_ENTRY_FEE_CENTS)}`
          }
          onPress={onEnter}
          disabled={!!entryQ.data || enterM.isPending}
          loading={enterM.isPending}
        />
        <AppButton
          title="Play a run"
          variant="secondary"
          onPress={onPlay}
          disabled={
            !entryQ.data ||
            (entryQ.data?.attempts_used ?? 0) >= WEEKLY_RACE_MAX_ATTEMPTS
          }
        />
      </View>

      {entryQ.data ? (
        <Text style={styles.attempts}>
          Runs used: {entryQ.data.attempts_used} / {WEEKLY_RACE_MAX_ATTEMPTS} · Your best:{' '}
          {entryQ.data.best_score.toLocaleString()}
        </Text>
      ) : (
        <Text style={styles.attempts}>Enter to unlock 10 scored runs today.</Text>
      )}

      <Text style={styles.sectionTitle}>Board (today)</Text>
      <View style={styles.table}>
        {leaderboard.map((r) => (
          <View
            key={`${r.rank}-${r.name}`}
            style={[styles.row, r.isYou && styles.rowYou]}
          >
            <Text style={styles.rRank}>#{r.rank}</Text>
            <Text style={styles.rName} numberOfLines={1}>
              {r.name}
              {r.isYou ? '  (you)' : ''}
            </Text>
            <Text style={styles.rScore}>{r.score.toLocaleString()}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footNote}>
        This board mixes Rivals previews with your best score for flair. Actual payouts rank real entrants only (server)
        once that calendar day closes.
      </Text>

      <GuestAuthPromptModal visible={guestOpen} variant="tournaments" onClose={() => setGuestOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backTxt: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  title: { color: runit.neonPink, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  supportBanner: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.28)',
    borderRadius: 12,
    padding: 12,
    color: 'rgba(226,232,240,0.95)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  sub: { color: 'rgba(203,213,225,0.95)', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  cardBorder: { borderRadius: 16, padding: 2, marginBottom: 16 },
  cardInner: { borderRadius: 14, backgroundColor: 'rgba(8,4,18,0.9)', padding: 14 },
  cardLbl: { color: 'rgba(148,163,184,0.95)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 },
  cardGame: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  rotateHint: { color: 'rgba(226,232,240,0.88)', fontSize: 13, marginBottom: 10, lineHeight: 18 },
  rotateHintStrong: { fontWeight: '900', color: '#FFE082' },
  cardMeta: { color: 'rgba(203,213,225,0.88)', fontSize: 12, lineHeight: 18 },
  warn: { color: '#fecaca', fontSize: 12, marginBottom: 8 },
  rowActions: { gap: 8, marginBottom: 12 },
  attempts: { color: 'rgba(203,213,225,0.9)', fontSize: 13, marginBottom: 16 },
  sectionTitle: { color: runit.neonCyan, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  table: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  rowYou: { backgroundColor: 'rgba(99,102,241,0.12)' },
  rRank: { width: 36, color: 'rgba(148,163,184,0.9)', fontWeight: '800', fontSize: 13 },
  rName: { flex: 1, color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  rScore: { color: '#FFE082', fontWeight: '900', fontSize: 14 },
  footNote: { color: 'rgba(148,163,184,0.75)', fontSize: 11, lineHeight: 16, marginTop: 10 },
  muted: { color: 'rgba(148,163,184,0.8)', padding: 16 },
});
