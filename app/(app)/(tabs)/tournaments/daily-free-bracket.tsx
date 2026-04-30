import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { BracketPathBoard } from '@/features/tournaments/BracketPathBoard';
import { buildFakeBracketPath } from '@/lib/fakeBracketPathModel';
import { getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { useProfile } from '@/hooks/useProfile';
import { runit } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

function parseBracketFieldSize(roundLabel: string): number {
  const m = /Round of (\d+)/i.exec(roundLabel);
  return m ? parseInt(m[1], 10) : 1024;
}

function formatBracketEventDate(dayKey: string): string {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return 'Today';
  const dt = new Date(y, mo - 1, d);
  const todayK = todayYmdLocal();
  const prefix = dayKey === todayK ? 'Today' : 'Event';
  return `${prefix} · ${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

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

  const bracketStats = useMemo(() => {
    const fieldPlayers = parseBracketFieldSize(cells[0]?.roundLabel ?? 'Round of 1024');
    const championLine =
      !eliminated && nextRound > totalRounds ? 'You (showcase)' : 'TBD';
    return {
      fieldPlayers,
      eventDateLine: formatBracketEventDate(todaysKey),
      championLine,
    };
  }, [cells, eliminated, nextRound, todaysKey, totalRounds]);

  const disclaimer =
    'Showcase prizes follow official rules. Bracket layout is for clarity — pairings may be resolved automatically after each round.';

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
        <SafeIonicons name="chevron-back" size={22} color="#FFD700" />
        <Text style={styles.backTxt}>{'<'} Back</Text>
      </Pressable>

      <BracketPathBoard
        heroTitle="YOUR BRACKET"
        heroSubtitle="Tournament of the Day — your path through today's rounds. Opponents are matched for this event; focus on your skill games."
        eventBadge={{
          title: 'TOURNAMENT OF THE DAY',
          subtitle: 'Compete. Win. Climb.',
        }}
        title="Run path"
        subtitle="Scroll horizontally · Greens are wins · Live match is highlighted"
        cells={cells}
        youName={youName}
        maskFutureYou
        bracketStats={bracketStats}
        disclaimerText={disclaimer}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backTxt: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  off: { color: 'rgba(148,163,184,0.9)' },
});
