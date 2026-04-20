import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_CREDIT_CUPS, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { useTournaments } from '@/hooks/useTournaments';
import { loadCupBracketPersist } from '@/lib/cupBracketStorage';
import { CREDIT_CUPS, getCreditCupById } from '@/lib/cupTournaments';
import { DAILY_FREE_TOURNAMENT_ROUNDS, getDailyTournamentPrizeUsd, getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { appChromeGradientFadePink, runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
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
  const [cupCarouselIndex, setCupCarouselIndex] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    if (CREDIT_CUPS.length === 0) {
      setCupCarouselIndex(0);
      return;
    }
    if (cupCarouselIndex >= CREDIT_CUPS.length) {
      setCupCarouselIndex(CREDIT_CUPS.length - 1);
    }
  }, [cupCarouselIndex]);

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
      imageSource: require('../../../../assets/how-it-works/01-home.png'),
    },
    {
      id: 'friday',
      title: 'Friday $70 Cup',
      subtitle: '$10 entry · 8 players per wave · cash prize',
      cta: 'Join cup',
      pill: 'CASH',
      onPress: () => router.push('/(app)/(tabs)/tournaments/friday-cup'),
      imageSource: require('../../../../assets/how-it-works/03-queue.png'),
      trophyUri:
        'file:///C:/Users/rania/.cursor/projects/c-Users-rania-KickClash/assets/c__Users_rania_AppData_Roaming_Cursor_User_workspaceStorage_fa0437850cf66277d34d95c04ef67442_images_image-2ed0f71f-2d2b-4c0b-9362-f362d7e99f24.png',
    },
    {
      id: 'solo',
      title: 'Solo Challenges',
      subtitle: 'Beat score targets · 50 tries/day · showcase prizes',
      cta: 'Play now',
      pill: 'FREE',
      onPress: () => router.push('/(app)/(tabs)/tournaments/solo-challenges'),
      imageSource: require('../../../../assets/how-it-works/04-tap-dash.png'),
    },
  ] as const;

  const featured = featuredEvents[featuredIndex];

  return (
    <Screen>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>EVENTS</Text>
      <Text style={styles.sub}>Skill-based tournaments — admin-awarded prizes</Text>

      <Text style={styles.sectionKicker}>FEATURED EVENTS</Text>
      <Pressable onPress={featured.onPress} style={({ pressed }) => [styles.heroCardWrap, pressed && { opacity: 0.95 }]}>
        <LinearGradient
          colors={[runit.neonCyan, runit.neonPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCardBorder}
        >
          <View style={styles.heroCardInner}>
            <Image source={featured.imageSource} style={styles.heroImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(4,8,20,0.15)', 'rgba(4,8,20,0.88)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.heroOverlay}
            />
            <View style={styles.heroTopRow}>
              <View style={[styles.statePill, styles.heroPill]}>
                <Text style={styles.heroPillText}>{featured.pill}</Text>
              </View>
              {featured.trophyUri ? <Image source={{ uri: featured.trophyUri }} style={styles.heroTrophy} contentFit="contain" /> : null}
            </View>
            <View style={styles.heroBottom}>
              <Text style={[styles.heroTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                {featured.title}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                {featured.subtitle}
              </Text>
              {featured.id === 'daily' ? <Text style={styles.dailyResetTiny}>Resets in {dailyResetCountdown}</Text> : null}
              <View style={styles.heroCtaRow}>
                <Text style={styles.heroCta}>{featured.cta}</Text>
                <SafeIonicons name="chevron-forward" size={16} color="#a5f3fc" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
      <View style={styles.heroControls}>
        <Pressable
          onPress={() => setFeaturedIndex((prev) => (prev === 0 ? featuredEvents.length - 1 : prev - 1))}
          style={({ pressed }) => [styles.heroNavBtn, pressed && { opacity: 0.85 }]}
        >
          <SafeIonicons name="chevron-back" size={16} color={runit.neonCyan} />
          <Text style={styles.heroNavTxt}>Prev</Text>
        </Pressable>
        <Text style={styles.carouselPosition}>
          {featuredIndex + 1} / {featuredEvents.length}
        </Text>
        <Pressable
          onPress={() => setFeaturedIndex((prev) => (prev === featuredEvents.length - 1 ? 0 : prev + 1))}
          style={({ pressed }) => [styles.heroNavBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.heroNavTxt}>Next</Text>
          <SafeIonicons name="chevron-forward" size={16} color={runit.neonCyan} />
        </Pressable>
      </View>

      {ENABLE_CREDIT_CUPS ? (
        <>
          <Text style={styles.sectionKicker}>CREDIT CUPS</Text>
          <Text style={styles.cupSectionSub}>
            One Run It cup run per day (pick a tier) · single elimination · prize credits — most players still top up for Arcade
          </Text>
          {CREDIT_CUPS.length ? (() => {
            const cup = CREDIT_CUPS[cupCarouselIndex];
            const snap = cupBoard?.byId[cup.id];
            const wonToday = snap?.won ?? false;
            const lockedOther =
              !!(cupBoard?.commitId && cupBoard.commitId !== cup.id && !wonToday);
            const otherName = cupBoard?.commitId ? getCreditCupById(cupBoard.commitId)?.name : undefined;
            const dim = wonToday || lockedOther;
            return (
              <View style={styles.cardWrap}>
                <View style={styles.carouselControlsRow}>
                  <Pressable
                    onPress={() =>
                      setCupCarouselIndex((prev) =>
                        prev === 0 ? CREDIT_CUPS.length - 1 : prev - 1,
                      )
                    }
                    style={({ pressed }) => [styles.carouselNavBtn, pressed && { opacity: 0.86 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Show previous cup"
                  >
                    <SafeIonicons name="chevron-back" size={16} color={runit.neonCyan} />
                    <Text style={styles.carouselNavTxt}>Prev</Text>
                  </Pressable>
                  <Text style={styles.carouselPosition}>
                    {cupCarouselIndex + 1} / {CREDIT_CUPS.length}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setCupCarouselIndex((prev) =>
                        prev === CREDIT_CUPS.length - 1 ? 0 : prev + 1,
                      )
                    }
                    style={({ pressed }) => [styles.carouselNavBtn, pressed && { opacity: 0.86 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Show next cup"
                  >
                    <Text style={styles.carouselNavTxt}>Next</Text>
                    <SafeIonicons name="chevron-forward" size={16} color={runit.neonCyan} />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => router.push(`/(app)/(tabs)/tournaments/cup/${cup.id}`)}
                  style={({ pressed }) => [dim && { opacity: 0.55 }, pressed && !dim && { opacity: 0.92 }]}
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
                        <View
                          style={[
                            styles.statePill,
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
                      <Text style={styles.cupCreditsLine}>
                        {cup.prizeCredits.toLocaleString()} prize credits · {DAILY_FREE_TOURNAMENT_ROUNDS} rounds
                      </Text>
                      <Text style={[styles.cardPrize, styles.cardPrizeDailyTagline]}>
                        {wonToday
                          ? 'Cleared today — back after midnight'
                          : lockedOther
                            ? `Daily run on ${otherName ?? 'another cup'}`
                            : cup.subtitle}
                      </Text>
                      <View style={styles.cardFooter}>
                        <Text style={[styles.viewLink, dim && { color: 'rgba(203,213,225,0.75)' }]}>
                          {wonToday ? 'View' : lockedOther ? 'Details' : 'Enter cup'}
                        </Text>
                        <SafeIonicons name="chevron-forward" size={14} color={dim ? 'rgba(203,213,225,0.6)' : runit.neonPink} />
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            );
          })() : null}
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
  heroCardWrap: { marginBottom: 8 },
  heroCardBorder: { borderRadius: 22, padding: 2.5 },
  heroCardInner: {
    borderRadius: 20,
    backgroundColor: 'rgba(5,10,25,0.94)',
    minHeight: 220,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPill: {
    borderColor: 'rgba(167,243,208,0.95)',
    backgroundColor: 'rgba(6,20,28,0.6)',
  },
  heroPillText: { color: '#a7f3d0', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroTrophy: { width: 36, height: 36 },
  heroBottom: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  heroTitle: { color: '#f8fafc', fontSize: 24, letterSpacing: 0.6, marginBottom: 6 },
  heroSubtitle: { color: 'rgba(226,232,240,0.95)', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  heroCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroCta: { color: '#a5f3fc', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  heroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.55)',
    backgroundColor: 'rgba(8,18,30,0.65)',
  },
  heroNavTxt: { color: runit.neonCyan, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  carouselControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  carouselNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.55)',
    backgroundColor: 'rgba(8,18,30,0.65)',
  },
  carouselNavTxt: { color: runit.neonCyan, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  carouselPosition: { color: 'rgba(186,230,253,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
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
