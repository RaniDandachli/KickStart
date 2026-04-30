import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
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
import { formatCountdownHms, getDailyTournamentPrizeUsd, getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import {
  FRIDAY_CUP_MAX_PLAYERS,
  FRIDAY_CUP_NAME,
  FRIDAY_CUP_PRIZE_POOL_USD,
  FRIDAY_CUP_START_HOUR_LOCAL,
  nextFridayAtLocalHour,
} from '@/lib/fridayCashCup';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { dailyRaceLeaderHref, oneVsOneChallengesHref } from '@/lib/tabRoutes';
import { WEEKLY_RACE_ENTRY_FEE_CENTS, WEEKLY_RACE_PAYOUTS_USD } from '@/lib/weeklyRace';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';
import type { TournamentRow } from '@/types/database';

type EventFilter = 'all' | 'free' | 'cash' | 'skill' | 'upcoming' | 'live';
type SortKey = 'soonest' | 'name';

type PillKind = 'FREE' | 'CASH' | 'SKILL';

type FeaturedImageSource = NonNullable<ComponentProps<typeof Image>['source']>;

type FeaturedDef = {
  id: string;
  title: string;
  description: string;
  metaLine: string;
  cta: string;
  pill: PillKind;
  imageSource: FeaturedImageSource;
  imageFit: 'cover' | 'contain';
  imageHeight?: number;
  onPress: () => void;
  prizeHeadline: string;
  prizeSub?: string;
  /** Big timer row — label + HMS (split for display). */
  timerKind?: 'resets' | 'starts' | 'ends';
  /** When set with timerKind, show large countdown using this HMS string. */
  timerHms?: string;
  borderAccent: 'green' | 'purple' | 'gold';
  sortMs: number;
  filterTags: { free: boolean; cash: boolean; skill: boolean; upcoming: boolean; live: boolean };
};

function CountdownDigits({ hms }: { hms: string }) {
  const parts = hms.split(':');
  const h = parts[0] ?? '00';
  const m = parts[1] ?? '00';
  const s = parts[2] ?? '00';
  return (
    <View style={styles.clockRow}>
      <View style={styles.clockCell}>
        <Text style={styles.clockNum}>{h}</Text>
        <Text style={styles.clockLbl}>HRS</Text>
      </View>
      <Text style={styles.clockSep}>:</Text>
      <View style={styles.clockCell}>
        <Text style={styles.clockNum}>{m}</Text>
        <Text style={styles.clockLbl}>MIN</Text>
      </View>
      <Text style={styles.clockSep}>:</Text>
      <View style={styles.clockCell}>
        <Text style={styles.clockNum}>{s}</Text>
        <Text style={styles.clockLbl}>SEC</Text>
      </View>
    </View>
  );
}

function pillColors(pill: PillKind): { bg: string; border: string; text: string } {
  if (pill === 'SKILL') {
    return {
      bg: 'rgba(59, 130, 246, 0.22)',
      border: 'rgba(96, 165, 250, 0.85)',
      text: '#93c5fd',
    };
  }
  if (pill === 'CASH') {
    return {
      bg: 'rgba(34, 197, 94, 0.18)',
      border: 'rgba(74, 222, 128, 0.9)',
      text: '#86efac',
    };
  }
  return {
    bg: 'rgba(34, 197, 94, 0.2)',
    border: 'rgba(167, 243, 208, 0.95)',
    text: '#bbf7d0',
  };
}

function cardBorderColors(accent: FeaturedDef['borderAccent']): [string, string] {
  if (accent === 'green') return ['rgba(74, 222, 128, 0.75)', 'rgba(34, 197, 94, 0.35)'];
  if (accent === 'gold') return [runit.gold, 'rgba(168, 85, 247, 0.5)'];
  return [runit.neonPurple, 'rgba(192, 132, 252, 0.35)'];
}

function FeaturedWideCard({
  item,
  dailyHms,
  fridayHms,
}: {
  item: FeaturedDef;
  dailyHms: string;
  fridayHms: string;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  const timerHms =
    item.id === 'daily' ? dailyHms : item.id === 'friday' ? fridayHms : item.timerHms ?? '';
  const showBigTimer = item.timerKind != null && timerHms.length > 0;
  const timerLabel =
    item.timerKind === 'resets' ? 'RESETS IN' : item.timerKind === 'starts' ? 'STARTS IN' : 'ENDS IN';
  const pc = pillColors(item.pill);
  const [c0, c1] = cardBorderColors(item.borderAccent);

  return (
    <Pressable onPress={item.onPress} style={({ pressed }) => [styles.fCardPress, pressed && { opacity: 0.94 }]}>
      <LinearGradient colors={[c0, c1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fCardBorder}>
        <View style={styles.fCardInner}>
          <View style={[styles.fRow, narrow && styles.fRowStack]}>
            <View style={[styles.fImageCol, narrow && { width: '100%' }]}>
              <View style={[styles.fImageBox, item.imageHeight ? { height: item.imageHeight } : { height: 100 }]}>
                <Image
                  source={item.imageSource}
                  style={StyleSheet.absoluteFillObject}
                  contentFit={item.imageFit}
                />
                <LinearGradient
                  colors={['rgba(5,2,8,0.05)', 'rgba(5,2,8,0.65)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={[styles.fPill, { borderColor: pc.border, backgroundColor: pc.bg }]}>
                  <Text style={[styles.fPillTxt, { color: pc.text }]}>{item.pill}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.fMid, narrow && { paddingTop: 10 }]}>
              <Text style={[styles.fTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                {item.title.toUpperCase()}
              </Text>
              <View style={styles.fMetaRow}>
                <SafeIonicons name="ribbon-outline" size={13} color="rgba(148,163,184,0.9)" />
                <Text style={styles.fMetaTxt} numberOfLines={2}>
                  {item.metaLine}
                </Text>
              </View>
              <Text style={styles.fDesc} numberOfLines={3}>
                {item.description}
              </Text>
              {showBigTimer ? (
                <View style={styles.fTimerBlock}>
                  <Text style={styles.fTimerLbl}>{timerLabel}</Text>
                  <CountdownDigits hms={timerHms} />
                </View>
              ) : null}
            </View>

            <View style={[styles.fRight, narrow && styles.fRightFull]}>
              <Text style={styles.fPrizeLbl}>
                {item.pill === 'CASH' || item.prizeSub ? 'PRIZE POOL' : 'PRIZE'}
              </Text>
              <Text
                style={[
                  styles.fPrizeVal,
                  item.pill === 'SKILL' ? styles.fPrizeSkill : item.pill === 'CASH' ? styles.fPrizeCash : styles.fPrizeGold,
                ]}
                numberOfLines={2}
              >
                {item.prizeHeadline}
              </Text>
              {item.prizeSub ? <Text style={styles.fPrizeSub}>{item.prizeSub}</Text> : null}
              <LinearGradient
                colors={[runit.neonPurple, runit.neonPink]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.fJoinGrad}
              >
                <Text style={[styles.fJoinTxt, { fontFamily: runitFont.black }]}>{item.cta.toUpperCase()}</Text>
                <SafeIonicons name="chevron-forward" size={18} color="#fff" />
              </LinearGradient>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

type ListRow = {
  key: string;
  title: string;
  pill: PillKind | 'TAG';
  pillText: string;
  details: string;
  timing: string;
  prize: string;
  prizeStyle: StyleProp<TextStyle>;
  cta: string;
  onPress: () => void;
  sortMs: number;
  filterTags: FeaturedDef['filterTags'];
  state?: TournamentRow['state'];
};

function matchesFilter(f: EventFilter, row: ListRow): boolean {
  if (f === 'all') return true;
  if (f === 'free') return row.filterTags.free;
  if (f === 'cash') return row.filterTags.cash;
  if (f === 'skill') return row.filterTags.skill;
  if (f === 'upcoming') return row.filterTags.upcoming;
  if (f === 'live') return row.state === 'active' || row.filterTags.live;
  return true;
}

function tournamentPrizeStyle(t: TournamentRow): StyleProp<TextStyle> {
  if (t.entry_type === 'credits' && t.entry_fee_wallet_cents > 0) return styles.rowPrizeCash;
  if (t.entry_type === 'free') return styles.rowPrizeGreen;
  return styles.rowPrizeGold;
}

export default function TournamentsListScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { width } = useWindowDimensions();
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

  const fridayKickoff = useMemo(
    () => nextFridayAtLocalHour(FRIDAY_CUP_START_HOUR_LOCAL),
    [todaysKey],
  );
  const fridayHms = useMemo(
    () => formatCountdownHms(Math.max(0, fridayKickoff.getTime() - Date.now())),
    [fridayKickoff, dailyResetCountdown],
  );

  const [filter, setFilter] = useState<EventFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('soonest');

  const featuredDefs: FeaturedDef[] = useMemo(() => {
    const msToMidnight = () => {
      const d = new Date();
      const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
      return n.getTime() - d.getTime();
    };
    const base: FeaturedDef[] = [
      {
        id: 'daily',
        title: 'Tournament of the Day',
        description:
          'Free showcase bracket — climb rounds on the daily minigame. Top performer wins the listed prize; everyone else earns Arcade Credits.',
        metaLine: `${dailyRounds} rounds · No entry fee · Skill contest`,
        cta: 'Join now',
        pill: 'FREE',
        onPress: () => router.push('/(app)/(tabs)/tournaments/daily-free'),
        imageSource: tournamentOfTheDayHeroSource,
        imageFit: 'cover',
        prizeHeadline: `$${dailyPrizeUsd}`,
        prizeSub: 'showcase pool',
        timerKind: 'resets',
        borderAccent: 'green',
        sortMs: msToMidnight(),
        filterTags: { free: true, cash: false, skill: false, upcoming: true, live: false },
      },
      {
        id: 'friday',
        title: FRIDAY_CUP_NAME,
        description:
          'Single-elimination cash cup — fixed entry, fixed prize pool. Rewards are issued after admin verification.',
        metaLine: `${FRIDAY_CUP_MAX_PLAYERS} players per wave · Cash wallet entry`,
        cta: 'Join cup',
        pill: 'CASH',
        onPress: () => router.push('/(app)/(tabs)/tournaments/friday-cup'),
        imageSource: fridayCupBannerSource,
        imageFit: 'cover',
        imageHeight: 100,
        prizeHeadline: `$${FRIDAY_CUP_PRIZE_POOL_USD}`,
        timerKind: 'starts',
        borderAccent: 'gold',
        sortMs: Math.max(0, fridayKickoff.getTime() - Date.now()),
        filterTags: { free: false, cash: true, skill: false, upcoming: true, live: false },
      },
    ];
    if (ENABLE_WEEKLY_RACE) {
      base.push({
        id: 'daily-race-leader',
        title: 'Daily Race',
        description:
          'Paid leaderboard — rotating minigame, best score wins. Play on your schedule until the day resets.',
        metaLine: `Best score board · ${formatUsdFromCents(WEEKLY_RACE_ENTRY_FEE_CENTS)} entry`,
        cta: 'Open Daily Race',
        pill: 'CASH',
        onPress: () => router.push(dailyRaceLeaderHref()),
        imageSource: weeklyRaceBannerSource,
        imageFit: 'cover',
        imageHeight: 100,
        prizeHeadline: `$${WEEKLY_RACE_PAYOUTS_USD.first}`,
        prizeSub: '1st · paid spots',
        borderAccent: 'purple',
        sortMs: 2 * 60 * 60 * 1000,
        filterTags: { free: false, cash: true, skill: false, upcoming: true, live: false },
      });
    }
    base.push({
      id: 'one-vs-one',
      title: '1v1 Challenges',
      description:
        'Post a score on Tap Dash; matchups settle when others play — async skill runs, not live head-to-head.',
      metaLine: 'Async matchups · Leaderboard style',
      cta: 'Enter challenges',
      pill: 'SKILL',
      onPress: () => router.push(oneVsOneChallengesHref()),
      imageSource: dailyRaceBannerSource,
      imageFit: 'cover',
      imageHeight: 100,
      prizeHeadline: 'BRAGGING RIGHTS',
      borderAccent: 'purple',
      sortMs: 9e12,
      filterTags: { free: false, cash: false, skill: true, upcoming: true, live: false },
    });
    return base;
  }, [router, dailyRounds, dailyPrizeUsd, fridayKickoff, todaysKey]);

  const listRows: ListRow[] = useMemo(() => {
    const fromFeatured: ListRow[] = featuredDefs.map((d) => ({
      key: `f-${d.id}`,
      title: d.title,
      pill: d.pill,
      pillText: d.pill,
      details: d.metaLine,
      timing:
        d.id === 'daily'
          ? `Resets in ${dailyResetCountdown}`
          : d.id === 'friday'
            ? `Starts in ${fridayHms}`
            : d.id === 'daily-race-leader'
              ? 'Resets daily · play anytime'
              : 'On your schedule',
      prize: d.prizeHeadline + (d.prizeSub ? ` ${d.prizeSub}` : ''),
      prizeStyle:
        d.pill === 'SKILL'
          ? styles.rowPrizeBlue
          : d.pill === 'CASH'
            ? styles.rowPrizeCash
            : styles.rowPrizeGold,
      cta: d.cta,
      onPress: d.onPress,
      sortMs: d.sortMs,
      filterTags: d.filterTags,
    }));

    const fromDb: ListRow[] = (data ?? []).map((t) => {
      const fee = formatEntryType(t.entry_type);
      const wave =
        t.unlimited_entrants && t.bracket_pod_size
          ? `${t.bracket_pod_size} per wave · rolling`
          : `${formatFormat(t.format)} · ${t.current_player_count}/${t.max_players} players`;
      const timing = t.starts_at
        ? `${formatTournamentState(t.state)} · ${new Date(t.starts_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : `${formatTournamentState(t.state)}`;
      const isFree = t.entry_type === 'free' || t.entry_fee_wallet_cents <= 0;
      const isCash = t.entry_type === 'credits' && t.entry_fee_wallet_cents > 0;
      return {
        key: `t-${t.id}`,
        title: t.name,
        pill: 'TAG',
        pillText: formatTournamentState(t.state).toUpperCase(),
        details: `${wave} · ${fee}`,
        timing,
        prize: t.prize_description,
        prizeStyle: tournamentPrizeStyle(t),
        cta: 'Join now',
        onPress: () => router.push(`/(app)/(tabs)/tournaments/${t.id}`),
        sortMs: t.starts_at ? new Date(t.starts_at).getTime() : 9e12 - 1,
        filterTags: {
          free: isFree,
          cash: isCash,
          skill: false,
          upcoming: t.state === 'open' || t.state === 'full',
          live: t.state === 'active',
        },
        state: t.state,
      };
    });

    return [...fromFeatured, ...fromDb];
  }, [featuredDefs, data, router, dailyResetCountdown, fridayHms]);

  const filteredRows = useMemo(() => {
    const f = listRows.filter((r) => matchesFilter(filter, r));
    if (sortKey === 'name') {
      return [...f].sort((a, b) => a.title.localeCompare(b.title));
    }
    return [...f].sort((a, b) => a.sortMs - b.sortMs);
  }, [listRows, filter, sortKey]);

  const cycleSort = useCallback(() => {
    setSortKey((k) => (k === 'soonest' ? 'name' : 'soonest'));
  }, []);

  const filterChip = (id: EventFilter, label: string, dot?: boolean) => {
    const on = filter === id;
    return (
      <Pressable
        key={id}
        onPress={() => setFilter(id)}
        style={({ pressed }) => [
          styles.chip,
          on && styles.chipOn,
          pressed && { opacity: 0.88 },
        ]}
      >
        {dot ? <View style={styles.chipDot} /> : null}
        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
      </Pressable>
    );
  };

  const isWide = width >= 720;

  return (
    <Screen>
      {/* Hero */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroEyebrow}>COMPETE</Text>
          <Text style={[styles.heroTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>EVENTS</Text>
          <Text style={styles.heroSub}>
            Skill-based tournaments and featured runs — prizes are awarded by admins after verification.
          </Text>
        </View>
        <View style={styles.heroArt} pointerEvents="none">
          <View style={styles.shard1} />
          <View style={styles.shard2} />
          <LinearGradient
            colors={[runit.neonPurple, runit.purpleDeep]}
            style={styles.trophyGlow}
          >
            <SafeIonicons name="trophy" size={44} color={runit.gold} />
          </LinearGradient>
        </View>
      </View>

      {/* Featured */}
      <View style={styles.featuredHead}>
        <SafeIonicons name="star" size={16} color={runit.neonPurple} />
        <Text style={[styles.featuredHeadTxt, { fontFamily: runitFont.black }]}>FEATURED EVENTS</Text>
      </View>
      <View style={styles.featuredStack}>
        {featuredDefs.map((d) => (
          <FeaturedWideCard key={d.id} item={d} dailyHms={dailyResetCountdown} fridayHms={fridayHms} />
        ))}
      </View>

      {isLoading ? (
        <>
          <LoadingState message="Loading events and tournaments…" />
          <SkeletonBlock className="mb-3 h-16" />
          <SkeletonBlock className="mb-3 h-16" />
        </>
      ) : null}
      {isError ? <EmptyState title="Could not load events" description="Check your connection and try again." /> : null}

      {/* All events */}
      <View style={styles.allHeadRow}>
        <Text style={[styles.allTitle, { fontFamily: runitFont.black }]}>ALL EVENTS</Text>
        <Pressable onPress={cycleSort} style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.sortTxt}>Sort by: {sortKey === 'soonest' ? 'Soonest' : 'Name'}</Text>
          <SafeIonicons name="chevron-down" size={16} color="rgba(226,232,240,0.75)" />
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        {filterChip('all', 'All')}
        {filterChip('free', 'Free')}
        {filterChip('cash', 'Cash')}
        {filterChip('skill', 'Skill')}
        {filterChip('upcoming', 'Upcoming')}
        {filterChip('live', 'Live', true)}
      </View>

      {/* Table header (wide) */}
      {isWide ? (
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 1.4 }]}>Event</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Details</Text>
          <Text style={[styles.th, { flex: 1 }]}>Timing</Text>
          <Text style={[styles.th, { flex: 0.9 }]}>Prize</Text>
          <Text style={[styles.th, { width: 108 }]}> </Text>
        </View>
      ) : null}

      {filteredRows.map((row) => {
        const hi = !!(highlight && row.key.startsWith('t-') && highlight === row.key.slice(2));
        const pillStyle =
          row.pill === 'TAG'
            ? { bg: 'rgba(15,23,42,0.6)', border: 'rgba(148,163,184,0.45)', text: '#e2e8f0' }
            : pillColors(row.pill);
        return (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            style={({ pressed }) => [styles.rowWrap, hi && styles.rowHi, pressed && { opacity: 0.92 }]}
          >
            <View style={[styles.rowInner, !isWide && styles.rowInnerStack]}>
              {isWide ? (
                <>
                  <View style={[styles.rowCell, { flex: 1.4 }]}>
                    <View style={styles.rowNameRow}>
                      <SafeIonicons name="trophy-outline" size={18} color={runit.neonPurple} />
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {row.title}
                      </Text>
                    </View>
                    <View style={[styles.miniPill, { borderColor: pillStyle.border, backgroundColor: pillStyle.bg }]}>
                      <Text style={[styles.miniPillTxt, { color: pillStyle.text }]}>{row.pillText}</Text>
                    </View>
                  </View>
                  <Text style={[styles.rowCell, styles.rowDetails, { flex: 1.2 }]} numberOfLines={3}>
                    {row.details}
                  </Text>
                  <Text style={[styles.rowCell, styles.rowTiming, { flex: 1 }]} numberOfLines={2}>
                    {row.timing}
                  </Text>
                  <Text style={[styles.rowCell, row.prizeStyle, { flex: 0.9 }]} numberOfLines={2}>
                    {row.prize}
                  </Text>
                  <View style={{ width: 108 }}>
                    <LinearGradient
                      colors={[runit.neonPurple, runit.neonPink]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.rowCta}
                    >
                      <Text style={styles.rowCtaTxt}>{row.cta}</Text>
                      <SafeIonicons name="chevron-forward" size={14} color="#fff" />
                    </LinearGradient>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.rowStackTop}>
                    <View style={styles.rowNameRow}>
                      <SafeIonicons name="trophy-outline" size={18} color={runit.neonPurple} />
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {row.title}
                      </Text>
                    </View>
                    <View style={[styles.miniPill, { borderColor: pillStyle.border, backgroundColor: pillStyle.bg }]}>
                      <Text style={[styles.miniPillTxt, { color: pillStyle.text }]}>{row.pillText}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowDetails} numberOfLines={3}>
                    {row.details}
                  </Text>
                  <Text style={styles.rowTiming} numberOfLines={2}>
                    {row.timing}
                  </Text>
                  <Text style={[row.prizeStyle, styles.rowPrizeMob]} numberOfLines={2}>
                    {row.prize}
                  </Text>
                  <LinearGradient
                    colors={[runit.neonPurple, runit.neonPink]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.rowCtaFull}
                  >
                    <Text style={styles.rowCtaTxt}>{row.cta}</Text>
                    <SafeIonicons name="chevron-forward" size={14} color="#fff" />
                  </LinearGradient>
                </>
              )}
            </View>
          </Pressable>
        );
      })}

      {!isError && !isLoading && !data?.length && filter === 'all' ? (
        <EmptyState title="No database tournaments" description="Featured runs above are always available." />
      ) : null}
      {!isError && filteredRows.length === 0 ? (
        <EmptyState title="No events match" description="Try a different filter." />
      ) : null}

      <Pressable
        onPress={() => router.push('/terms-of-service')}
        style={({ pressed }) => [styles.footerBar, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.footerLeft}>
          <SafeIonicons name="information-circle-outline" size={16} color="rgba(148,163,184,0.85)" />
          <Text style={styles.footerTxt}>
            Prizes follow official rules. Rewards are issued after admin verification.
          </Text>
        </View>
        <View style={styles.footerLinkRow}>
          <Text style={styles.footerLink}>View official rules</Text>
          <SafeIonicons name="chevron-forward" size={14} color={runit.neonPink} />
        </View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 12,
  },
  heroLeft: { flex: 1, minWidth: 0, paddingRight: 4 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.4,
    color: 'rgba(226, 232, 240, 0.5)',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 34,
    letterSpacing: 1,
    color: '#fff',
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 38,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.92)',
  },
  heroArt: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...runitGlowPinkSoft,
  },
  shard1: {
    position: 'absolute',
    width: 12,
    height: 28,
    backgroundColor: 'rgba(168,85,247,0.35)',
    borderRadius: 2,
    transform: [{ rotate: '32deg' }, { translateX: -36 }, { translateY: -18 }],
  },
  shard2: {
    position: 'absolute',
    width: 10,
    height: 22,
    backgroundColor: 'rgba(232,121,249,0.3)',
    borderRadius: 2,
    transform: [{ rotate: '-24deg' }, { translateX: 38 }, { translateY: 12 }],
  },
  featuredHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  featuredHeadTxt: {
    color: '#f8fafc',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  featuredStack: { gap: 14, marginBottom: 22 },
  fCardPress: { borderRadius: 16 },
  fCardBorder: { borderRadius: 16, padding: 1.5 },
  fCardInner: {
    borderRadius: 14,
    backgroundColor: 'rgba(8, 4, 18, 0.94)',
    overflow: 'hidden',
  },
  fRow: { flexDirection: 'row', padding: 14, gap: 12 },
  fRowStack: { flexDirection: 'column' },
  fImageCol: { width: 112 },
  fImageBox: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,2,12,1)',
    position: 'relative',
  },
  fPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  fPillTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  fMid: { flex: 1, minWidth: 0 },
  fTitle: {
    color: '#fff',
    fontSize: 15,
    letterSpacing: 0.5,
    lineHeight: 20,
    marginBottom: 8,
  },
  fMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  fMetaTxt: {
    flex: 1,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  fDesc: {
    color: 'rgba(203, 213, 225, 0.88)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  fTimerBlock: { marginTop: 4 },
  fTimerLbl: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: 'rgba(226, 232, 240, 0.55)',
    marginBottom: 6,
  },
  clockRow: { flexDirection: 'row', alignItems: 'flex-end' },
  clockCell: { alignItems: 'center', minWidth: 44 },
  clockNum: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  clockLbl: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.75)',
    letterSpacing: 0.5,
  },
  clockSep: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 20,
    fontWeight: '300',
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  fRight: { width: 118, justifyContent: 'flex-start', paddingTop: 2 },
  fRightFull: { width: '100%', marginTop: 4 },
  fPrizeLbl: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: 'rgba(148, 163, 184, 0.75)',
    marginBottom: 4,
  },
  fPrizeVal: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    lineHeight: 26,
  },
  fPrizeGold: { color: runit.goldBright },
  fPrizeCash: { color: '#86efac' },
  fPrizeSkill: { color: '#93c5fd', fontSize: 14, lineHeight: 18 },
  fPrizeSub: { fontSize: 10, fontWeight: '700', color: 'rgba(226,232,240,0.55)', marginBottom: 10 },
  fJoinGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  fJoinTxt: { color: '#fff', fontSize: 11, letterSpacing: 0.6 },
  allHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  allTitle: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 1,
  },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortTxt: { color: 'rgba(226,232,240,0.8)', fontSize: 12, fontWeight: '700' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  chipOn: {
    backgroundColor: 'rgba(107, 33, 168, 0.55)',
    borderColor: 'rgba(192, 132, 252, 0.55)',
  },
  chipTxt: { color: 'rgba(203, 213, 225, 0.85)', fontSize: 12, fontWeight: '800' },
  chipTxtOn: { color: '#fff' },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
    marginBottom: 4,
  },
  th: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: 'rgba(148, 163, 184, 0.65)',
  },
  rowWrap: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(5, 2, 12, 0.45)',
  },
  rowHi: {
    borderColor: 'rgba(232, 121, 249, 0.55)',
    backgroundColor: 'rgba(107, 33, 168, 0.15)',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  rowInnerStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  rowCell: { justifyContent: 'center' },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rowTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  miniPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  miniPillTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  rowDetails: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  rowTiming: { color: 'rgba(226, 232, 240, 0.75)', fontSize: 11, fontWeight: '700' },
  rowPrizeGold: { color: runit.goldBright, fontSize: 12, fontWeight: '900' },
  rowPrizeCash: { color: '#86efac', fontSize: 12, fontWeight: '900' },
  rowPrizeGreen: { color: '#a7f3d0', fontSize: 12, fontWeight: '800' },
  rowPrizeBlue: { color: '#93c5fd', fontSize: 12, fontWeight: '900' },
  rowPrizeMob: { marginTop: 4, marginBottom: 8 },
  rowStackTop: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rowCtaFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
  },
  rowCtaTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  footerBar: {
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 2, 12, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 200 },
  footerTxt: {
    flex: 1,
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  footerLink: { color: runit.neonPink, fontSize: 12, fontWeight: '800' },
});
