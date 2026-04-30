import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonDanceGameIcon,
  NeonGridGameIcon,
  StackerGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { ArcadeMinigameRow } from '@/components/arcade/ArcadeMinigameRow';
import { ArcadePlayLauncher, type ArcadePlayLauncherRoute } from '@/components/arcade/ArcadePlayLauncher';
import { ArcadePlayModeModal } from '@/components/arcade/ArcadePlayModeModal';
import { ENABLE_BACKEND, SHOW_NEON_SHIP_MINIGAME } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { alertInsufficientPrizeCredits, pushArcadeCreditsShop } from '@/lib/arcadeCreditsShop';
import {
  consumePrizeRunEntryCredits,
  PRIZE_RUN_ENTRY_CREDITS,
  STACKER_PRIZE_RUN_ENTRY_CREDITS,
  TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS,
} from '@/lib/arcadeEconomy';
import { ARCADE_HUB_RETURN_PATH, withReturnHref } from '@/lib/minigameReturnHref';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

const BASE = '/(app)/(tabs)/play/minigames';

type Ion = ComponentProps<typeof SafeIonicons>['name'];

type FeaturedSlide = {
  route: ArcadePlayLauncherRoute;
  title: string;
  tag: string;
  body: string;
  hotLabel: string;
  playing: string;
};

const GAME_MODAL_TITLE: Partial<Record<ArcadePlayLauncherRoute, string>> = {
  'tap-dash': 'Tap Dash',
  'tile-clash': 'Tile Clash',
  'dash-duel': 'Dash Duel',
  'ball-run': 'Neon Ball Run',
  'neon-dance': 'Neon Dance',
  'neon-grid': 'Street Dash',
  'turbo-arena': 'Turbo Arena',
  stacker: 'Stacker',
  'neon-ship': 'Void Glider',
  'neon-pool': 'Neon Pool',
};

const FEATURED_SLIDES: FeaturedSlide[] = [
  {
    route: 'dash-duel',
    title: 'DASH DUEL',
    tag: '1v1 FAST-PACED SHOWDOWNS',
    body: "Compete head-to-head and prove you're the fastest.",
    hotLabel: 'HOT',
    playing: '1.2K PLAYING NOW',
  },
  {
    route: 'tap-dash',
    title: 'TAP DASH',
    tag: 'REFLEX SKILL RUN',
    body: 'Chain perfect taps and climb the skill ladder.',
    hotLabel: 'HOT',
    playing: '980 PLAYING NOW',
  },
  {
    route: 'tile-clash',
    title: 'TILE CLASH',
    tag: 'PUZZLE SPEED',
    body: 'Clear the grid faster than your rival.',
    hotLabel: 'HOT',
    playing: '760 PLAYING NOW',
  },
  {
    route: 'ball-run',
    title: 'NEON BALL RUN',
    tag: 'ENDLESS ARCADE',
    body: 'Dodge, weave, and push for a new best distance.',
    hotLabel: 'HOT',
    playing: '540 PLAYING NOW',
  },
  {
    route: 'neon-dance',
    title: 'NEON DANCE',
    tag: 'RHYTHM ACTION',
    body: 'Hit the marks and own the floor.',
    hotLabel: 'HOT',
    playing: '620 PLAYING NOW',
  },
];

type HotDef = {
  route: ArcadePlayLauncherRoute;
  title: string;
  playing: string;
  avgWin: string;
  icon: ReactNode;
  bg: readonly [string, string, string];
  border: 'pink' | 'gold' | 'purple';
  featured?: boolean;
};

function prizeCreditsForRoute(route: ArcadePlayLauncherRoute) {
  if (route === 'turbo-arena') return TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS;
  if (route === 'stacker') return STACKER_PRIZE_RUN_ENTRY_CREDITS;
  return undefined;
}

function ArcadeHubFeaturedCarousel() {
  const [idx, setIdx] = useState(0);
  const slide = FEATURED_SLIDES[idx]!;

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % FEATURED_SLIDES.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={styles.featuredWrap}>
      <View style={styles.featuredLabelRow}>
        <SafeIonicons name="star" size={16} color={runit.gold} />
        <Text style={styles.featuredLabel}>FEATURED GAME</Text>
      </View>
      <ArcadePlayLauncher gameRoute={slide.route} title={GAME_MODAL_TITLE[slide.route] ?? slide.title}>
        <LinearGradient
          colors={['#0a0614', '#1e1035', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.featuredCard, runitGlowPinkSoft]}
        >
          <View style={styles.featuredRow}>
            <View style={styles.featuredLeft}>
              <View style={styles.hotPill}>
                <Text style={styles.hotPillTxt}>🔥 {slide.hotLabel}</Text>
              </View>
              <Text style={[styles.featuredTitle, { fontFamily: runitFont.black }]}>{slide.title}</Text>
              <Text style={styles.featuredSub}>{slide.tag}</Text>
              <Text style={styles.featuredBody}>{slide.body}</Text>
              <LinearGradient
                colors={[runit.gold, '#CA8A04']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.playNowBtn}
              >
                <Text style={[styles.playNowTxt, { fontFamily: runitFont.black }]}>PLAY NOW</Text>
                <SafeIonicons name="chevron-forward" size={18} color="#0c0618" />
              </LinearGradient>
            </View>
            <View style={styles.featuredArt}>
              <Text style={styles.triGlyphL}>◀</Text>
              <Text style={styles.vsTxt}>VS</Text>
              <Text style={styles.triGlyphR}>▶</Text>
            </View>
          </View>
          <View style={styles.featuredFoot}>
            <View style={styles.avatarStack}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.avatarDot, { marginLeft: i === 0 ? 0 : -10 }]} />
              ))}
            </View>
            <Text style={styles.playingNow}>{slide.playing}</Text>
          </View>
        </LinearGradient>
      </ArcadePlayLauncher>
      <View style={styles.dotsRow}>
        {FEATURED_SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => setIdx(i)} hitSlop={8} style={styles.dotHit}>
            <View style={[styles.dot, i === idx && styles.dotOn]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HotGameCard(props: HotDef) {
  const { route, title, playing, avgWin, icon, bg, border, featured } = props;
  const borderColors =
    border === 'gold'
      ? ([runit.gold, 'rgba(255,215,0,0.35)'] as const)
      : border === 'purple'
        ? ([runit.neonPurple, runit.neonPink] as const)
        : ([runit.neonPink, runit.neonPurple] as const);

  return (
    <ArcadePlayLauncher gameRoute={route} title={title}>
      <LinearGradient
        colors={borderColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hotOuter, featured && styles.hotOuterFeatured]}
      >
        <LinearGradient colors={bg} style={styles.hotInner}>
          {featured ? (
            <View style={styles.badge1v1}>
              <Text style={styles.badge1v1Txt}>1v1</Text>
            </View>
          ) : null}
          <View style={styles.hotIconSlot}>{icon}</View>
          <Text style={[styles.hotTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.hotPlaying}>
            <Text style={styles.hotDot}>●</Text> {playing}
          </Text>
          <Text style={styles.hotAvg}>{avgWin}</Text>
          <View style={styles.hotPlayFab}>
            <SafeIonicons name="play" size={18} color="#fff" />
          </View>
        </LinearGradient>
      </LinearGradient>
    </ArcadePlayLauncher>
  );
}

function SectionHeader({
  icon,
  title,
  onViewAll,
}: {
  icon: Ion;
  title: string;
  onViewAll: () => void;
}) {
  return (
    <View style={styles.secHead}>
      <View style={styles.secHeadLeft}>
        <SafeIonicons name={icon} size={18} color={runit.neonPink} />
        <Text style={[styles.secTitle, { fontFamily: runitFont.black }]}>{title}</Text>
      </View>
      <Pressable onPress={onViewAll} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
        <Text style={styles.viewAll}>View all &gt;</Text>
      </Pressable>
    </View>
  );
}

type HubDiscoveryProps = {
  shapeDashRow: ReactNode;
};

export function ArcadeHubDiscovery({ shapeDashRow }: HubDiscoveryProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const fourCol = width >= 960;

  const hotGames: HotDef[] = useMemo(
    () => [
      {
        route: 'tap-dash',
        title: 'Tap Dash',
        playing: '842 playing',
        avgWin: 'Avg Win $8',
        icon: <TapDashGameIcon size={40} />,
        bg: ['#1e1b4b', '#312e81', '#4c1d95'],
        border: 'pink',
      },
      {
        route: 'tile-clash',
        title: 'Tile Clash',
        playing: '621 playing',
        avgWin: 'Avg Win $9',
        icon: <TileClashGameIcon size={40} />,
        bg: ['#0f172a', '#1e1b4b', '#5b21b6'],
        border: 'purple',
      },
      {
        route: 'dash-duel',
        title: 'Dash Duel',
        playing: '1.2K playing',
        avgWin: 'Avg Win $12',
        icon: <DashDuelGameIcon size={40} />,
        bg: ['#020617', '#0c4a6e', '#164e63'],
        border: 'gold',
        featured: true,
      },
      {
        route: 'ball-run',
        title: 'Neon Ball Run',
        playing: '430 playing',
        avgWin: 'Avg Win $15',
        icon: <BallRunGameIcon size={40} />,
        bg: ['#1a0b2e', '#4c1d95', '#831843'],
        border: 'pink',
      },
      {
        route: 'neon-dance',
        title: 'Neon Dance',
        playing: '315 playing',
        avgWin: 'Avg Win $7',
        icon: <NeonDanceGameIcon size={40} />,
        bg: ['#050508', '#1e1b4b', '#312e81'],
        border: 'pink',
      },
    ],
    [],
  );

  const goMinigames = () => router.push('/(app)/(tabs)/play/minigames' as never);

  const colNew = (
    <View style={[styles.catCol, fourCol && styles.catCol4]}>
      <SectionHeader icon="sparkles" title="NEW GAMES" onViewAll={goMinigames} />
      <ArcadeMinigameRow
        compact
        gameRoute="neon-grid"
        title="Street Dash"
        entryLabel="New"
        winLabel="PLAY"
        bgColors={['#0f172a', '#312e81', '#831843']}
        borderAccent="purple"
        iconSlot={<NeonGridGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="turbo-arena"
        title="Turbo Arena"
        entryLabel="New"
        winLabel="PLAY"
        bgColors={['#020617', '#0c4a6e', '#7c2d12']}
        borderAccent="gold"
        iconSlot={<TurboArenaGameIcon size={32} />}
      />
      {shapeDashRow}
    </View>
  );

  const colReward = (
    <View style={[styles.catCol, fourCol && styles.catCol4]}>
      <SectionHeader icon="trophy" title="HIGH REWARD" onViewAll={goMinigames} />
      <ArcadeMinigameRow
        compact
        gameRoute="stacker"
        title="Stacker"
        entryLabel="Avg Win $20"
        winLabel="PLAY"
        bgColors={['#0c0a0f', '#1e1b4b', '#831843']}
        borderAccent="purple"
        iconSlot={<StackerGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="ball-run"
        title="Neon Ball Run"
        entryLabel="Avg Win $15"
        winLabel="PLAY"
        bgColors={['#1a0b2e', '#4c1d95', '#831843']}
        borderAccent="pink"
        iconSlot={<BallRunGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="dash-duel"
        title="Dash Duel"
        entryLabel="Avg Win $12"
        winLabel="PLAY"
        bgColors={['#020617', '#0c4a6e', '#164e63']}
        borderAccent="gold"
        iconSlot={<DashDuelGameIcon size={32} />}
      />
    </View>
  );

  const colSkill = (
    <View style={[styles.catCol, fourCol && styles.catCol4]}>
      <SectionHeader icon="locate-outline" title="SKILL GAMES" onViewAll={goMinigames} />
      <ArcadeMinigameRow
        compact
        gameRoute="tap-dash"
        title="Tap Dash"
        entryLabel="High Skill"
        winLabel="PLAY"
        bgColors={['#1e1b4b', '#312e81', '#4c1d95']}
        borderAccent="pink"
        iconSlot={<TapDashGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="tile-clash"
        title="Tile Clash"
        entryLabel="High Skill"
        winLabel="PLAY"
        bgColors={['#0f172a', '#1e1b4b', '#5b21b6']}
        borderAccent="purple"
        iconSlot={<TileClashGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="dash-duel"
        title="Dash Duel"
        entryLabel="High Skill"
        winLabel="PLAY"
        bgColors={['#020617', '#0c4a6e', '#164e63']}
        borderAccent="gold"
        iconSlot={<DashDuelGameIcon size={32} />}
      />
    </View>
  );

  const colJackpot = (
    <View style={[styles.catCol, fourCol && styles.catCol4]}>
      <SectionHeader icon="star" title="JACKPOT" onViewAll={goMinigames} />
      <ArcadeMinigameRow
        compact
        gameRoute="stacker"
        title="Stacker"
        entryLabel="Jackpot"
        winLabel="PLAY"
        bgColors={['#0c0a0f', '#1e1b4b', '#831843']}
        borderAccent="purple"
        iconSlot={<StackerGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="turbo-arena"
        title="Turbo Arena"
        entryLabel="Jackpot"
        winLabel="PLAY"
        bgColors={['#020617', '#0c4a6e', '#7c2d12']}
        borderAccent="gold"
        iconSlot={<TurboArenaGameIcon size={32} />}
      />
      <ArcadeMinigameRow
        compact
        gameRoute="neon-dance"
        title="Neon Dance"
        entryLabel="Jackpot"
        winLabel="PLAY"
        bgColors={['#050508', '#1e1b4b', '#312e81']}
        borderAccent="pink"
        iconSlot={<NeonDanceGameIcon size={32} />}
      />
    </View>
  );

  return (
    <View>
      <ArcadeHubFeaturedCarousel />

      <View style={styles.hotHeaderRow}>
        <View style={styles.hotTitleRow}>
          <Text style={styles.hotFlame}>🔥</Text>
          <Text style={[styles.hotSectionTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>
            HOT GAMES
          </Text>
        </View>
        <Pressable onPress={goMinigames}>
          <Text style={styles.viewAll}>View all &gt;</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotScroll}>
        {hotGames.map((h) => (
          <HotGameCard key={h.route + (h.featured ? 'f' : '')} {...h} />
        ))}
      </ScrollView>

      <View style={[styles.catGrid, fourCol && styles.catGridRow]}>
        {colNew}
        {colReward}
        {colSkill}
        {colJackpot}
      </View>

      <ArcadeHubQuickPlayRandom />
    </View>
  );
}

function randomPool(): ArcadePlayLauncherRoute[] {
  const p: ArcadePlayLauncherRoute[] = [
    'tap-dash',
    'tile-clash',
    'dash-duel',
    'ball-run',
    'neon-dance',
    'neon-grid',
    'turbo-arena',
    'stacker',
  ];
  if (SHOW_NEON_SHIP_MINIGAME) p.push('neon-ship');
  return p;
}

function ArcadeHubQuickPlayRandom() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const [route, setRoute] = useState<ArcadePlayLauncherRoute | null>(null);
  const title = route ? GAME_MODAL_TITLE[route] ?? 'Game' : '';
  const path = route ? `${BASE}/${route}` : '';
  const prizeEntryCredits = route ? prizeCreditsForRoute(route) : undefined;
  const prizeCost = prizeEntryCredits ?? PRIZE_RUN_ENTRY_CREDITS;

  const spin = () => {
    const pool = randomPool();
    setRoute(pool[Math.floor(Math.random() * pool.length)]!);
  };

  return (
    <View style={styles.quickWrap}>
      <LinearGradient
        colors={[runit.neonPurple, '#4c1d95', '#1e1b4b']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.quickOuter, runitGlowPinkSoft]}
      >
        <Pressable
          onPress={spin}
          style={({ pressed }) => [styles.quickInner, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Quick play random game"
        >
          <SafeIonicons name="flash" size={32} color="#fff" style={styles.quickIcon} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.quickTitle, { fontFamily: runitFont.black }]}>QUICK PLAY</Text>
            <Text style={styles.quickSub}>Play a random game</Text>
          </View>
        </Pressable>
      </LinearGradient>
      <View style={styles.shardRow} pointerEvents="none">
        <View style={[styles.shard, { transform: [{ rotate: '12deg' }] }]} />
        <View style={[styles.shard, styles.shard2, { transform: [{ rotate: '-18deg' }] }]} />
        <View style={[styles.shard, styles.shard3, { transform: [{ rotate: '25deg' }] }]} />
      </View>

      <ArcadePlayModeModal
        visible={route != null}
        gameTitle={title}
        prizeEntryCredits={prizeEntryCredits}
        onClose={() => setRoute(null)}
        onBuyCredits={() => {
          setRoute(null);
          pushArcadeCreditsShop(router);
        }}
        onPractice={() => {
          if (!route) return;
          setRoute(null);
          router.push(withReturnHref(`${path}?mode=practice`, ARCADE_HUB_RETURN_PATH) as never);
        }}
        onPrizeRun={() => {
          if (!route) return;
          if (ENABLE_BACKEND && uid && !consumePrizeRunEntryCredits(profileQ.data?.prize_credits, prizeCost)) {
            alertInsufficientPrizeCredits(
              router,
              `Prize runs cost ${prizeCost} prize credits. Practice is free.`,
            );
            return;
          }
          setRoute(null);
          router.push(withReturnHref(`${path}?mode=prize`, ARCADE_HUB_RETURN_PATH) as never);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  featuredWrap: { marginBottom: 18 },
  featuredLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featuredLabel: {
    color: runit.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  featuredCard: {
    borderRadius: 18,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.45)',
    overflow: 'hidden',
  },
  featuredRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  featuredLeft: { flex: 1, minWidth: 0 },
  hotPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
    marginBottom: 8,
  },
  hotPillTxt: { color: '#fecaca', fontSize: 11, fontWeight: '900' },
  featuredTitle: {
    color: '#fff',
    fontSize: 26,
    fontStyle: 'italic',
    fontWeight: '900',
    letterSpacing: 1,
    ...runitTextGlowPink,
  },
  featuredSub: {
    color: 'rgba(196,181,253,0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  featuredBody: {
    color: 'rgba(226,232,240,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 18,
  },
  playNowBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: 'stretch',
    maxWidth: 220,
  },
  playNowTxt: { color: '#0c0618', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  featuredArt: {
    width: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  triGlyphL: {
    color: 'rgba(34,211,238,0.95)',
    fontSize: 36,
    fontWeight: '900',
    marginTop: -4,
    textShadowColor: 'rgba(34,211,238,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  triGlyphR: {
    color: 'rgba(192,132,252,0.98)',
    fontSize: 36,
    fontWeight: '900',
    marginTop: -4,
    textShadowColor: 'rgba(192,132,252,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  vsTxt: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    marginHorizontal: -2,
    ...runitTextGlowCyan,
  },
  featuredFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.5)',
    borderWidth: 2,
    borderColor: 'rgba(15,23,42,0.9)',
  },
  playingNow: { color: 'rgba(226,232,240,0.85)', fontSize: 11, fontWeight: '800' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  dotHit: { padding: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(88,28,135,0.65)',
  },
  dotOn: {
    backgroundColor: runit.neonPink,
    shadowColor: runit.neonPink,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  hotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  hotTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotFlame: { fontSize: 18 },
  hotSectionTitle: {
    color: '#fff',
    fontSize: 16,
    letterSpacing: 2,
  },
  viewAll: {
    color: 'rgba(196,181,253,0.95)',
    fontSize: 12,
    fontWeight: '800',
  },
  hotScroll: {
    gap: 12,
    paddingBottom: 8,
    paddingRight: 8,
  },
  hotOuter: {
    width: 152,
    borderRadius: 16,
    padding: 2,
    marginRight: 4,
  },
  hotOuterFeatured: {
    padding: 3,
    shadowColor: runit.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  hotInner: {
    position: 'relative',
    borderRadius: 14,
    padding: 12,
    minHeight: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badge1v1: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(253,224,71,0.5)',
    zIndex: 2,
  },
  badge1v1Txt: { color: runit.gold, fontSize: 10, fontWeight: '900' },
  hotIconSlot: { alignItems: 'center', marginTop: 18, marginBottom: 10 },
  hotTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    minHeight: 40,
  },
  hotPlaying: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  hotDot: { color: '#4ade80', fontSize: 10 },
  hotAvg: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  hotPlayFab: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catGrid: { marginTop: 20, gap: 18 },
  catGridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  catCol: { gap: 0 },
  catCol4: { flex: 1, minWidth: 0 },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  secHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secTitle: {
    color: 'rgba(248,250,252,0.98)',
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  quickWrap: { marginTop: 22, marginBottom: 8 },
  quickOuter: {
    borderRadius: 18,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.55)',
  },
  quickInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(4,2,12,0.45)',
  },
  quickIcon: { marginRight: 4 },
  quickTitle: {
    color: '#fff',
    fontSize: 22,
    letterSpacing: 2,
    fontWeight: '900',
    ...runitTextGlowPink,
  },
  quickSub: {
    color: 'rgba(226,232,240,0.88)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  shardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 10,
    opacity: 0.55,
  },
  shard: {
    width: 14,
    height: 28,
    borderRadius: 3,
    backgroundColor: 'rgba(192,132,252,0.5)',
  },
  shard2: { backgroundColor: 'rgba(34,211,238,0.45)' },
  shard3: { backgroundColor: 'rgba(253,224,71,0.4)' },
});
