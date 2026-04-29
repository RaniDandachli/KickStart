import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { ENABLE_WEEKLY_RACE } from '@/constants/featureFlags';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { useTournaments } from '@/hooks/useTournaments';
import {
  dailyRaceBannerSource,
  fridayCupBannerSource,
  tournamentOfTheDayHeroSource,
  weeklyRaceBannerSource,
} from '@/lib/brandLogo';
import { getDailyTournamentPrizeUsd, getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { appChromeGradientFadePink, runit, runitFont } from '@/lib/runitArcadeTheme';
import { dailyRaceLeaderHref, oneVsOneChallengesHref } from '@/lib/tabRoutes';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

export default function TournamentsListScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { data, isLoading, isError } = useTournaments(false);
  const dailyUid = useAuthStore((s) => s.user?.id ?? 'guest');
  const dailyHydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const dailyDayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const dailyResetCountdown = useDailyFreeResetClock(dailyUid, async (k) => {
    await dailyHydrate(k);
  });
  const todaysKey = dailyDayKey || todayYmdLocal();
  const dailyRounds = getDailyTournamentRounds(todaysKey);
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(todaysKey);

  const { width: screenW } = useWindowDimensions();
  /** Two columns above ~340pt; snug tiles on dense browse screens */
  const gridTileWidth = useMemo(() => {
    const pad = 40; // matches Screen horizontal padding ×2
    const gap = 10;
    const inner = Math.max(280, screenW - pad);
    return (inner - gap) / 2;
  }, [screenW]);

  type FeaturedEvent = {
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    pill: string;
    onPress: () => void;
    imageSource: any;
    imageFit?: 'cover' | 'contain';
    imageHeight?: number;
  };

  const featuredEvents: FeaturedEvent[] = [
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
      imageHeight: 76,
    },
    ...(ENABLE_WEEKLY_RACE
      ? ([
          {
            id: 'daily-race-leader' as const,
            title: 'Daily Race',
            subtitle: '$10 entry · rotating minigame · best score board · play on your schedule',
            cta: 'Open Daily Race',
            pill: 'CASH' as const,
            onPress: () => router.push(dailyRaceLeaderHref()),
            imageSource: weeklyRaceBannerSource,
            imageFit: 'cover' as const,
            imageHeight: 76,
          },
        ] as const)
      : []),
    {
      id: 'one-vs-one',
      title: '1v1 Challenges',
      subtitle: 'Tap Dash · post a score; matchups settle when others play — not live',
      cta: 'Enter challenges',
      pill: 'SKILL',
      onPress: () => router.push(oneVsOneChallengesHref()),
      imageSource: dailyRaceBannerSource,
      imageFit: 'cover' as const,
      imageHeight: 76,
    },
  ];

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
                <View style={[styles.featureImageBox, featured.imageHeight ? { height: featured.imageHeight } : null]}>
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

function stateColor(state: string) {
  if (state === 'open') return '#39ff14';
  if (state === 'active') return '#a78bfa';
  if (state === 'full') return '#ffbe0b';
  return 'rgba(148,163,184,0.8)';
}

const styles = StyleSheet.create({
  sectionKickerTight: { marginTop: 4, marginBottom: 8 },
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
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewLink: { color: runit.neonPink, fontSize: 12, fontWeight: '800' },
});
