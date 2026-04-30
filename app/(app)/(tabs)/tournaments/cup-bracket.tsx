import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { BracketPathBoard } from '@/features/tournaments/BracketPathBoard';
import { buildFakeBracketPath } from '@/lib/fakeBracketPathModel';
import { getCreditCupById } from '@/lib/cupTournaments';
import { DAILY_FREE_TOURNAMENT_ROUNDS, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { useProfile } from '@/hooks/useProfile';
import { runit } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useCupBracketStore } from '@/store/cupBracketStore';

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
  const dayKey = useCupBracketStore((s) => s.dayKey);
  const bracketDayKey = dayKey || todayYmdLocal();

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

  const bracketStats = useMemo(() => {
    if (!cells?.length) return undefined;
    const fieldPlayers = parseBracketFieldSize(cells[0]?.roundLabel ?? 'Round of 1024');
    const championLine =
      !eliminated && nextRound > DAILY_FREE_TOURNAMENT_ROUNDS ? 'You (showcase)' : 'TBD';
    return {
      fieldPlayers,
      eventDateLine: formatBracketEventDate(bracketDayKey),
      championLine,
    };
  }, [cells, eliminated, nextRound, bracketDayKey]);

  const disclaimer =
    'Showcase prizes follow official rules. Bracket layout is for clarity — pairings may be resolved automatically after each round.';

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
        <Text style={styles.backTxt}>{'<'} Back</Text>
      </Pressable>

      <BracketPathBoard
        heroTitle={`${cup.name.toUpperCase()} · BRACKET`}
        heroSubtitle={`${cup.prizeCredits.toLocaleString()} prize credits on a full clear — your run for today.`}
        eventBadge={{
          title: cup.name.toUpperCase(),
          subtitle: cup.subtitle,
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
  off: { color: 'rgba(148,163,184,0.9)', marginBottom: 12 },
});
