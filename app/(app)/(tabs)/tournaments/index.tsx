import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_CREDIT_CUPS, ENABLE_DAILY_FREE_TOURNAMENT, ENABLE_WEEKLY_RACE } from '@/constants/featureFlags';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { useTournaments } from '@/hooks/useTournaments';
import { loadCupBracketPersist } from '@/lib/cupBracketStorage';
import { CREDIT_CUPS, getCreditCupById } from '@/lib/cupTournaments';
import {
  dailyRaceBannerSource,
  fridayCupBannerSource,
  tournamentOfTheDayHeroSource,
  weeklyRaceBannerSource,
} from '@/lib/brandLogo';
import { DAILY_FREE_TOURNAMENT_ROUNDS, getDailyTournamentPrizeUsd, getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { appChromeGradientFadePink, runit, runitFont } from '@/lib/runitArcadeTheme';
import { dailyRaceHref } from '@/lib/tabRoutes';
import { useAuthStore } from '@/store/authStore';
import { useCupDailyRunStore } from '@/store/cupDailyRunStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function TournamentsListScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { data, isLoading, isError } = useTournaments(false);
  const dailyUid = useAuthStore((s) => s.user?.id ?? 'guest');
  const dailyHydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const cupDailyHydrate = useCupDailyRunStore((s) => s.hydrate);
  const dailyDayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const dailyResetCountdown = useDailyFreeResetClock(dailyUid, async (k) => {
    await dailyHydrate(k);
    await cupDailyHydrate(k);
  });
  const todaysKey = dailyDayKey || todayYmdLocal();
  const dailyRounds = getDailyTournamentRounds(todaysKey);
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(todaysKey);

  const [cupBoard, setCupBoard] = useState<{
    commitId: string | null;
    byId: Record<string, { won: boolean; lost: boolean }>;
  } | null>(null);
  const { width: screenW } = useWindowDimensions();
  /** Two columns above ~340pt; snug tiles on dense browse screens */
  const gridTileWidth = useMemo(() => {
    const pad = 40; // matches Screen horizontal padding ×2
    const gap = 10;
    const inner = Math.max(280, screenW - pad);
    return (inner - gap) / 2;
  }, [screenW]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        await useCupDailyRunStore.getState().hydrate(dailyUid);
        if (cancelled) return;
        const commit = useCupDailyRunStore.getState().committedCupId;
        const today = todayYmdLocal();
        const byId: Record<string, { won: boolean; lost: boolean }> = {};
        for (const c of CREDIT_CUPS) {
          const p = await loadCupBracketPersist(dailyUid, c.id);
          if (!p || p.dayKey !== today) {
            byId[c.id] = { won: false, lost: false };
            continue;
          }
          const won = !p.eliminated && p.nextRound > DAILY_FREE_TOURNAMENT_ROUNDS;
          const lost = p.eliminated;
          byId[c.id] = { won, lost };
        }
        if (!cancelled) setCupBoard({ commitId: commit, byId });
      })();
      return () => {
        cancelled = true;
      };
    }, [dailyUid]),
  );

  const featuredEvents = [
    {
      id: 'daily',
      title: 'Tournament of the Day',
      subtitle: `${dailyRounds} rounds · $${dailyPrizeUsd} showcase · no entry fee`,
      cta: 'Join now',
      pill: 'FREE',
      onPress: () => router.push('/(app)/(tabs)/tournaments/daily-free'),
      imageSource: tournamentOfTheDayHeroSource,
      imageFit: 'cover' as const,
    },
    {
      id: 'friday',
      title: 'Friday $70 Cup',
      subtitle: '$10 entry · 8 players per wave · cash prize',
      cta: 'Join cup',
      pill: 'CASH',
      onPress: () => router.push('/(app)/(tabs)/tournaments/friday-cup'),
      imageSource: fridayCupBannerSource,
      imageFit: 'cover' as const,
    },
    ...(ENABLE_WEEKLY_RACE
      ? ([
          {
            id: 'weekly-race' as const,
            title: 'Weekly Race',
            subtitle: '$10 entry · 10 runs · best score on daily game · top-3 pool',
            cta: 'View race',
            pill: 'CASH' as const,
            onPress: () => router.push('/(app)/(tabs)/tournaments/weekly-race'),
            imageSource: weeklyRaceBannerSource,
            imageFit: 'cover' as const,
          },
        ] as const)
      : []),
    {
      id: 'daily-race',
      title: 'Daily Race',
      subtitle: 'Tap Dash showcase lanes · free + wallet tiers · up to 10 tries/day',
      cta: 'Enter daily race',
      pill: 'RACE',
      onPress: () => router.push(dailyRaceHref()),
      imageSource: dailyRaceBannerSource,
      imageFit: 'cover' as const,
    },
  ] as const;

  return (
    <Screen>
      <ScreenHeader
        compact
        eyebrow="Compete"
        title="Events"
        subtitle="Skill-based tournaments and featured runs — prizes are awarded by admins after verification."
      />

      <SectionLabel style={styles.sectionKickerTight}>Featured events</SectionLabel>
      <View style={styles.gridRow}>
        {featuredEvents.map((featured) => (
          <Pressable
            key={featured.id}
            onPress={featured.onPress}
            style={({ pressed }) => [
              styles.featureTile,
              { width: gridTileWidth },
              pressed && { opacity: 0.93 },
            ]}
          >
            <LinearGradient
              colors={[runit.neonCyan, runit.neonPurple]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featureBorder}
            >
              <View style={styles.featureInner}>
                <View style={styles.featureImageBox}>
                  <Image
                    source={featured.imageSource}
                    style={StyleSheet.absoluteFillObject}
                    contentFit={featured.imageFit ?? 'cover'}
                  />
                  <LinearGradient
                    colors={['rgba(4,8,20,0.02)', 'rgba(4,8,22,0.55)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={[styles.statePill, styles.featurePill]}>
                    <Text style={[styles.heroPillText]}>{featured.pill}</Text>
                  </View>
                </View>
                <View style={styles.featureBody}>
                  <Text style={[styles.featureTileTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                    {featured.title}
                  </Text>
                  <Text style={styles.featureTileSub} numberOfLines={2}>
                    {featured.subtitle}
                  </Text>
                  {featured.id === 'daily' ? (
                    <Text style={styles.featureResetTiny} numberOfLines={1}>
                      Resets in {dailyResetCountdown}
                    </Text>
                  ) : null}
                  <View style={styles.heroCtaRow}>
                    <Text style={styles.featureCta}>{featured.cta}</Text>
                    <SafeIonicons name="chevron-forward" size={14} color="#FFE082" />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      {ENABLE_CREDIT_CUPS ? (
        <>
          <SectionLabel style={styles.sectionKickerCup}>Credit cups</SectionLabel>
          <Text style={styles.cupSectionSub}>One cup run per day per tier · single elimination · credits from shop or wins</Text>
          {CREDIT_CUPS.length ? (
            <View style={styles.gridRow}>
              {CREDIT_CUPS.map((cup) => {
                const snap = cupBoard?.byId[cup.id];
                const wonToday = snap?.won ?? false;
                const lockedOther = !!(cupBoard?.commitId && cupBoard.commitId !== cup.id && !wonToday);
                const otherName = cupBoard?.commitId ? getCreditCupById(cupBoard.commitId)?.name : undefined;
                const dim = wonToday || lockedOther;
                return (
                  <Pressable
                    key={cup.id}
                    onPress={() => router.push(`/(app)/(tabs)/tournaments/cup/${cup.id}`)}
                    style={({ pressed }) => [
                      { width: gridTileWidth },
                      dim && { opacity: 0.55 },
                      pressed && !dim && { opacity: 0.92 },
                    ]}
                  >
                    <LinearGradient
                      colors={cupAccentGradient(cup.accent)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cupTileBorder}
                    >
                      <View style={styles.cupTileInner}>
                        <View style={styles.cardTopCompact}>
                          <Text style={[styles.cupTileName, { fontFamily: runitFont.bold }]} numberOfLines={2}>
                            {cup.name}
                          </Text>
                          <View
                            style={[
                              styles.statePill,
                              styles.cupBadge,
                              {
                                borderColor: wonToday ? 'rgba(148,163,184,0.7)' : lockedOther ? '#fbbf24' : '#39ff14',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statePillText,
                                {
                                  color: wonToday ? 'rgba(203,213,225,0.95)' : lockedOther ? '#fbbf24' : '#39ff14',
                                },
                              ]}
                            >
                              {wonToday ? 'DONE' : lockedOther ? 'LOCKED' : 'PRIZE'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.cupCreditsLineCompact}>
                          {cup.prizeCredits.toLocaleString()} cr · {DAILY_FREE_TOURNAMENT_ROUNDS} rds
                        </Text>
                        <Text style={styles.cupTileTag} numberOfLines={2}>
                          {wonToday
                            ? 'Back after midnight'
                            : lockedOther
                              ? `Using ${otherName ?? 'another cup'} today`
                              : cup.subtitle}
                        </Text>
                        <View style={styles.heroCtaRow}>
                          <Text style={[styles.viewLinkCompact, dim && { color: 'rgba(203,213,225,0.75)' }]}>
                            {wonToday ? 'View' : lockedOther ? 'Details' : 'Enter'}
                          </Text>
                          <SafeIonicons
                            name="chevron-forward"
                            size={13}
                            color={dim ? 'rgba(203,213,225,0.55)' : runit.neonPink}
                          />
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}

      {isLoading ? (
        <>
          <LoadingState message="Loading events and tournaments…" />
          <SkeletonBlock className="mb-3 h-24" />
          <SkeletonBlock className="mb-3 h-24" />
        </>
      ) : null}
      {isError && <EmptyState title="Could not load events" description="Check your connection and try again." />}

      {data?.map((t) => {
        const isHi = !!(highlight && t.id === highlight);
        return (
          <Pressable key={t.id} onPress={() => router.push(`/(app)/(tabs)/tournaments/${t.id}`)} style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}>
            <LinearGradient
              colors={isHi ? [runit.neonCyan, runit.neonPink] : [runit.neonPink, appChromeGradientFadePink]}
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
    case 'gold':
      return ['#5B21B6', '#FFD700'] as const;
    case 'purple':
      return ['#6b21a8', '#a855f7'] as const;
    case 'pink':
      return ['#be185d', '#f472b6'] as const;
    case 'amber':
      return ['#b45309', '#fbbf24'] as const;
    case 'emerald':
      return ['#047857', '#FFD700'] as const;
    default:
      return [runit.neonPink, appChromeGradientFadePink] as const;
  }
}

function stateColor(state: string) {
  if (state === 'open') return '#39ff14';
  if (state === 'active') return '#a78bfa';
  if (state === 'full') return '#ffbe0b';
  return 'rgba(148,163,184,0.8)';
}

const styles = StyleSheet.create({
  sectionKickerTight: { marginTop: 4, marginBottom: 8 },
  sectionKickerCup: { marginTop: 14, marginBottom: 6 },
  cupSectionSub: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
    justifyContent: 'flex-start',
  },
  featureTile: { marginBottom: 6 },
  featureBorder: { borderRadius: 14, padding: 2, overflow: 'hidden' },
  featureInner: {
    borderRadius: 12,
    backgroundColor: 'rgba(5,10,25,0.96)',
    overflow: 'hidden',
  },
  featureImageBox: {
    height: 56,
    width: '100%',
    position: 'relative',
    backgroundColor: 'rgba(12,14,28,1)',
    overflow: 'hidden',
    borderRadius: 10,
    marginBottom: 0,
  },
  featureBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  featurePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderColor: 'rgba(167,243,208,0.95)',
    backgroundColor: 'rgba(6,20,28,0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  heroPillText: { color: '#a7f3d0', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  featureTileTitle: {
    color: '#f8fafc',
    fontSize: 13,
    letterSpacing: 0.35,
    marginBottom: 3,
    lineHeight: 16,
  },
  featureTileSub: {
    color: 'rgba(226,232,240,0.9)',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    marginBottom: 4,
  },
  featureResetTiny: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  heroCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  featureCta: { color: '#FFE082', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },

  cupTileBorder: { borderRadius: 12, padding: 2, marginBottom: 2 },
  cupTileInner: {
    borderRadius: 10,
    backgroundColor: 'rgba(8,4,18,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 108,
  },
  cupTileName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 17 },
  cupBadge: { paddingHorizontal: 5, paddingVertical: 2 },
  cupCreditsLineCompact: {
    color: '#fef08a',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 3,
    marginTop: 2,
  },
  cupTileTag: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  cardTopCompact: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 2 },
  viewLinkCompact: { color: runit.neonPink, fontSize: 12, fontWeight: '800' },
  cupCreditsLine: { color: '#fef08a', fontSize: 15, fontWeight: '900', marginBottom: 4 },
  cardWrap: { marginBottom: 10 },
  cardBorder: { borderRadius: 14, padding: 2 },
  cardInner: { backgroundColor: 'rgba(8,4,18,0.88)', borderRadius: 12, padding: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  cardName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 19 },
  statePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statePillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  cardMetaTxt: { color: 'rgba(148,163,184,0.85)', fontSize: 11, fontWeight: '700' },
  cardDate: { color: 'rgba(148,163,184,0.75)', fontSize: 10, marginBottom: 4 },
  cardPrize: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 7,
    fontWeight: '700',
  },
  cardPrizeDailyTagline: { fontSize: 12, fontWeight: '600', color: 'rgba(203,213,225,0.85)', marginTop: 0 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewLink: { color: runit.neonPink, fontSize: 12, fontWeight: '800' },
});
