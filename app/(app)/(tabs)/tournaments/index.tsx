import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_CREDIT_CUPS, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { useTournaments } from '@/hooks/useTournaments';
import { CREDIT_CUPS } from '@/lib/cupTournaments';
import { DAILY_FREE_PRIZE_USD, DAILY_FREE_TOURNAMENT_ROUNDS } from '@/lib/dailyFreeTournament';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function TournamentsListScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { data, isLoading, isError } = useTournaments(false);
  const dailyUid = useAuthStore((s) => s.user?.id ?? 'guest');
  const dailyHydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const dailyResetCountdown = useDailyFreeResetClock(dailyUid, dailyHydrate);

  return (
    <Screen>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>EVENTS</Text>
      <Text style={styles.sub}>Skill-based tournaments — admin-awarded prizes</Text>

      {ENABLE_DAILY_FREE_TOURNAMENT ? (
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/tournaments/daily-free')}
          style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[runit.neonCyan, '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardName, { fontFamily: runitFont.bold }]} numberOfLines={2}>
                  Tournament of the Day
                </Text>
                <View style={[styles.statePill, { borderColor: '#39ff14' }]}>
                  <Text style={[styles.statePillText, { color: '#39ff14' }]}>FREE</Text>
                </View>
              </View>
              <View style={styles.dailyPrizeRow}>
                <Text style={[styles.dailyPrizeDollar, { fontFamily: runitFont.black }]}>${DAILY_FREE_PRIZE_USD}</Text>
                <Text style={styles.dailyPrizeSub}>showcase prize</Text>
              </View>
              <Text style={styles.cardMetaTxt}>
                {DAILY_FREE_TOURNAMENT_ROUNDS} rounds · ${DAILY_FREE_PRIZE_USD} showcase · no entry fee
              </Text>
              <Text style={styles.dailyResetTiny}>Resets in {dailyResetCountdown}</Text>
              <Text style={[styles.cardPrize, styles.cardPrizeDailyTagline]}>
                New bracket at local midnight — tap to enter
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.viewLink}>Enter</Text>
                <SafeIonicons name="chevron-forward" size={14} color={runit.neonPink} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {ENABLE_CREDIT_CUPS ? (
        <>
          <Text style={styles.sectionKicker}>CREDIT CUPS</Text>
          <Text style={styles.cupSectionSub}>Single elimination · same games as Tournament of the Day · win prize credits to your account</Text>
          {CREDIT_CUPS.map((cup) => (
            <Pressable
              key={cup.id}
              onPress={() => router.push(`/(app)/(tabs)/tournaments/cup/${cup.id}`)}
              style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={cupAccentGradient(cup.accent)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardBorder}
              >
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardName, { fontFamily: runitFont.bold }]} numberOfLines={2}>
                      {cup.name}
                    </Text>
                    <View style={[styles.statePill, { borderColor: '#39ff14' }]}>
                      <Text style={[styles.statePillText, { color: '#39ff14' }]}>PRIZE</Text>
                    </View>
                  </View>
                  <Text style={styles.cupCreditsLine}>
                    {cup.prizeCredits.toLocaleString()} prize credits · {DAILY_FREE_TOURNAMENT_ROUNDS} rounds
                  </Text>
                  <Text style={[styles.cardPrize, styles.cardPrizeDailyTagline]}>{cup.subtitle}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewLink}>Enter cup</Text>
                    <SafeIonicons name="chevron-forward" size={14} color={runit.neonPink} />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          ))}
        </>
      ) : null}

      {isLoading && (
        <>
          <SkeletonBlock className="mb-3 h-24" />
          <SkeletonBlock className="mb-3 h-24" />
        </>
      )}
      {isError && <EmptyState title="Could not load events" description="Check .env and RLS policies." />}

      {data?.map((t) => {
        const isHi = !!(highlight && t.id === highlight);
        return (
          <Pressable key={t.id} onPress={() => router.push(`/(app)/(tabs)/tournaments/${t.id}`)} style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}>
            <LinearGradient
              colors={isHi ? [runit.neonCyan, runit.neonPurple] : [runit.neonPurple, 'rgba(157,78,237,0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardBorder}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardName, { fontFamily: runitFont.bold }]} numberOfLines={2}>{t.name}</Text>
                  <View style={[styles.statePill, { borderColor: stateColor(t.state) }]}>
                    <Text style={[styles.statePillText, { color: stateColor(t.state) }]}>{formatTournamentState(t.state).toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaTxt}>{formatFormat(t.format)} · {t.current_player_count}/{t.max_players} players</Text>
                  <Text style={[styles.cardMetaTxt, { color: runit.neonCyan }]}>{formatEntryType(t.entry_type)}</Text>
                </View>
                {t.starts_at ? <Text style={styles.cardDate}>⏱  {new Date(t.starts_at).toLocaleString()}</Text> : null}
                <Text style={styles.cardPrize} numberOfLines={3}>{t.prize_description}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.viewLink}>View details</Text>
                  <SafeIonicons name="chevron-forward" size={14} color={runit.neonPink} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}

      {!isError && !isLoading && !data?.length ? (
        <EmptyState title="No tournaments" description="Run seed SQL or call createTournament (admin)." />
      ) : null}
    </Screen>
  );
}

function cupAccentGradient(accent: (typeof CREDIT_CUPS)[number]['accent']): readonly [string, string] {
  switch (accent) {
    case 'cyan':
      return ['#0e7490', '#06b6d4'] as const;
    case 'purple':
      return ['#6b21a8', '#a855f7'] as const;
    case 'pink':
      return ['#be185d', '#f472b6'] as const;
    case 'amber':
      return ['#b45309', '#fbbf24'] as const;
    case 'emerald':
      return ['#047857', '#34d399'] as const;
    default:
      return [runit.neonPurple, 'rgba(157,78,237,0.3)'] as const;
  }
}

function stateColor(state: string) {
  if (state === 'open') return '#39ff14';
  if (state === 'active') return '#00f0ff';
  if (state === 'full') return '#ffbe0b';
  return 'rgba(148,163,184,0.8)';
}

const styles = StyleSheet.create({
  title: { color: runit.neonPink, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  sub: { color: 'rgba(203,213,225,0.85)', fontSize: 13, marginBottom: 18 },
  sectionKicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 4,
  },
  cupSectionSub: { color: 'rgba(148,163,184,0.88)', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  cupCreditsLine: { color: '#fef08a', fontSize: 15, fontWeight: '900', marginBottom: 4 },
  cardWrap: { marginBottom: 14 },
  cardBorder: { borderRadius: 16, padding: 2 },
  cardInner: { backgroundColor: 'rgba(8,4,18,0.88)', borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '900' },
  statePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statePillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  cardMetaTxt: { color: 'rgba(148,163,184,0.85)', fontSize: 12, fontWeight: '700' },
  cardDate: { color: 'rgba(148,163,184,0.75)', fontSize: 11, marginBottom: 6 },
  dailyPrizeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
    marginTop: 2,
  },
  dailyPrizeDollar: {
    color: '#fef08a',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(250,204,21,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  dailyPrizeSub: { color: 'rgba(254,243,199,0.95)', fontSize: 13, fontWeight: '800' },
  cardPrize: {
    color: '#f1f5f9',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
    fontWeight: '800',
  },
  cardPrizeDailyTagline: { fontSize: 13, fontWeight: '600', color: 'rgba(203,213,225,0.85)', marginTop: 0 },
  dailyResetTiny: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewLink: { color: runit.neonPink, fontSize: 13, fontWeight: '800' },
});
