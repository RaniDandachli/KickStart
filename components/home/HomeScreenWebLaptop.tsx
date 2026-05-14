import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    type ViewStyle,
} from 'react-native';

import { AsyncRunsPromoSection } from '@/components/arcade/AsyncRunsPromoSection';
import type { H2hCarouselRow } from '@/components/arcade/HomeH2hCarouselWeb';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { WebHomeSidebar } from '@/components/web/WebHomeSidebar';
import { ENABLE_BACKEND, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { useFloatingOnlineCount } from '@/hooks/useFloatingOnlineCount';
import { usePaidOut24hTickerCents } from '@/hooks/usePaidOut24hTickerCents';
import { competeWinCashHeroSource, runItArcadeLogoSource, tournamentOfTheDayHeroSource } from '@/lib/brandLogo';
import { getDailyTournamentPrizeUsd, getDailyTournamentRounds } from '@/lib/dailyFreeTournament';
import { type H2hGameKey } from '@/lib/homeOpenMatches';
import {
    FAKE_RECENT_WINNER_LINES,
    FAKE_TOP_EARNER_FRAMES,
    FAKE_TOP_EARNERS_ROTATION_MS,
} from '@/lib/homeSocialDemo';
import { HOME_WEB_LAPTOP_MIN_WIDTH } from '@/lib/homeWebLayout';
import { formatUsdFromCents } from '@/lib/money';
import { appBorderAccentMuted, runit, runitFont } from '@/lib/runitArcadeTheme';
import type { HomeLobbyRecentReward } from '@/services/api/homeLobby';
import type { ProfileFightStats } from '@/services/api/profileFightStats';

const TIER_SUB =
  `${MATCH_ENTRY_TIERS[0].shortLabel} · ${MATCH_ENTRY_TIERS[MATCH_ENTRY_TIERS.length - 1].shortLabel} · Pick a tier to match`;

const BRAND_GOLD = '#FFD700';
const RANK_COLORS = ['#fbbf24', '#C4B5FD', '#FFD700', '#f472b6'];

function formatPaidOut24h(cents: number): string {
  const usd = cents / 100;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 1) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function initialsFromUsername(username: string): string {
  const s = username.replace(/[^a-zA-Z0-9]/g, '');
  if (s.length >= 2) return (s[0] + s[1]).toUpperCase();
  if (s.length === 1) return s.toUpperCase() + '•';
  return '??';
}

function avatarColor(i: number): string {
  const palette = ['#7c3aed', '#2563eb', '#B45309', '#db2777', '#ea580c'];
  return palette[i % palette.length];
}

export type HomeScreenWebLaptopProps = {
  walletDisplay: string;
  walletCents: number;
  liveLobby: null | {
    playersOnline: number;
    rewardsWalletCents24h: number;
    matchesLive: number;
    matchesQueued: number;
  };
  recentRewards: HomeLobbyRecentReward[];
  fightStats: ProfileFightStats | null | undefined;
  fightLoading: boolean;
  uid: string | undefined;
  dailyDayKey: string;
  dailyResetCountdownHms: string;
  onWalletPress: () => void;
  onAddMoney: () => void;
  onPlayNow: () => void;
  onHowItWorks: () => void;
  onEnterDailyTournament: () => void;
  onBrowseLiveMatches: () => void;
  onJoinTournamentEvents: () => void;
  onOpenArcade: () => void;
  onOpenPrizes: () => void;
  onInviteFriends: () => void;
  onOpenProfile: () => void;
  /** First letter for header avatar. */
  userInitial: string;
  /** Opens notification / alert settings (e.g. Profile → Settings). */
  onNotificationsPress?: () => void;
  h2hCarouselRows: H2hCarouselRow[];
  onH2hCarouselRowPress: (row: H2hCarouselRow) => void;
  h2hIconFor: (gameKey: H2hGameKey, size: number) => ReactNode;
  h2hGradients: (gameKey: H2hGameKey) => readonly [string, string];
  /** Optional — opens async run picker (Play stack). */
  onAsyncRun?: () => void;
};

export function HomeScreenWebLaptop({
  walletDisplay,
  walletCents,
  liveLobby,
  recentRewards: _recentRewardsReserved,
  fightStats,
  fightLoading,
  uid,
  dailyDayKey,
  dailyResetCountdownHms,
  onWalletPress,
  onAddMoney,
  onPlayNow,
  onHowItWorks,
  onEnterDailyTournament,
  onBrowseLiveMatches,
  onJoinTournamentEvents,
  onOpenArcade,
  onOpenPrizes,
  onInviteFriends,
  onOpenProfile,
  userInitial,
  onNotificationsPress,
  h2hCarouselRows,
  onH2hCarouselRowPress,
  h2hIconFor,
  h2hGradients,
  onAsyncRun,
}: HomeScreenWebLaptopProps) {
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(dailyDayKey);
  const dailyRounds = getDailyTournamentRounds(dailyDayKey);

  const playersOnlineDisplay = useFloatingOnlineCount(3200);
  const paidOutTickerCents = usePaidOut24hTickerCents();
  const rewardsWalletCents24h = liveLobby?.rewardsWalletCents24h ?? 0;
  const paidOut =
    rewardsWalletCents24h > 0
      ? formatPaidOut24h(rewardsWalletCents24h)
      : formatPaidOut24h(paidOutTickerCents);
  const matchesLiveOnly = liveLobby?.matchesLive ?? 0;
  const activeGames = h2hCarouselRows.length;
  const avLetter = (userInitial || 'P').replace(/\s/g, '').slice(0, 1).toUpperCase() || 'P';

  const totdProgress = useMemo(() => {
    const h = dailyDayKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const entered = 96 + (h % 90);
    const cap = 256;
    const pct = (entered / cap) * 100;
    return { entered, cap, pct: Math.min(100, Math.max(8, pct)) };
  }, [dailyDayKey]);

  const [fakeEarnerFrame, setFakeEarnerFrame] = useState(0);

  useEffect(() => {
    const n = FAKE_TOP_EARNER_FRAMES.length;
    const id = setInterval(
      () => setFakeEarnerFrame((f) => (f + 1) % n),
      FAKE_TOP_EARNERS_ROTATION_MS,
    );
    return () => clearInterval(id);
  }, []);

  /** Social-proof board — always show human-looking demo names (RPC rows are often test noise). */
  const topEarners = useMemo(() => {
    const frame = FAKE_TOP_EARNER_FRAMES[fakeEarnerFrame % FAKE_TOP_EARNER_FRAMES.length] ?? [];
    return frame.map((row, i) => ({
      username: row.username,
      cents: row.cents,
      created_at: `demo:frame${fakeEarnerFrame}:row${i}`,
    }));
  }, [fakeEarnerFrame]);

  const countdownParts = dailyResetCountdownHms.split(':');
  const hh = countdownParts[0] ?? '00';
  const mm = countdownParts[1] ?? '00';
  const ss = countdownParts[2] ?? '00';

  const winRate =
    fightStats && fightStats.wins + fightStats.losses > 0
      ? `${Math.round((100 * fightStats.wins) / (fightStats.wins + fightStats.losses))}%`
      : '—';

  const totalMatches =
    fightStats != null ? String(fightStats.matches_played ?? fightStats.wins + fightStats.losses) : '—';

  const streak =
    fightStats != null && fightStats.current_streak > 0 ? String(fightStats.current_streak) : '—';

  const { width: viewportW } = useWindowDimensions();
  const compact = viewportW < HOME_WEB_LAPTOP_MIN_WIDTH;
  const gameCardW = compact ? 210 : 156;
  const gameIconSize = compact ? 34 : 26;

  const liveStatusStrip = (
    <View style={[styles.liveStrip, compact && styles.liveStripCompact, !compact && styles.liveStripDesk]}>
      <View style={[styles.liveStripLeft, compact && styles.liveStripLeftCompact]}>
        <View style={styles.liveDotRow}>
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.liveStripTxt}>{playersOnlineDisplay} online</Text>
        </View>
        <Text style={styles.liveSep}>·</Text>
        <View style={styles.liveDotRow}>
          <View style={[styles.dot, { backgroundColor: '#94a3b8' }]} />
          <Text style={styles.liveStripTxt}>{liveLobby?.matchesQueued ?? 0} starting</Text>
        </View>
        <Text style={styles.liveSep}>·</Text>
        <View style={styles.liveDotRow}>
          <View style={[styles.dot, { backgroundColor: runit.neonPink }]} />
          <Text style={styles.liveStripTxt}>{liveLobby?.matchesLive ?? 0} live matches</Text>
        </View>
      </View>
      <Text style={[styles.liveStripReward, compact && styles.liveStripRewardCompact]}>
        {formatUsdFromCents(rewardsWalletCents24h > 0 ? rewardsWalletCents24h : paidOutTickerCents)} rewards · 24h
      </Text>
    </View>
  );

  const upperMain = (
    <>
        {/* Laptop: activity first (above the fold with trending). Narrow web: bar below header. */}
        {!compact ? liveStatusStrip : null}
        {/* Top bar — dashboard: wallet, alerts, +, avatar (laptop: sidebar has logo) */}
        <View style={[styles.topNav, compact && styles.topNavCompact, !compact && styles.topNavDesk]}>
          <View style={[styles.brandBlock, compact && styles.brandBlockCompact]}>
            {compact ? (
              <Image
                source={runItArcadeLogoSource}
                style={styles.compactWebLogo}
                contentFit="contain"
                accessibilityLabel="Run It Arcade"
              />
            ) : null}
          </View>
          <View style={[styles.navRight, compact && styles.navRightCompact]}>
            {onNotificationsPress ? (
              <View style={styles.bellWrap}>
                <Pressable
                  onPress={onNotificationsPress}
                  accessibilityRole="button"
                  accessibilityLabel="Notification and alert settings"
                  style={({ pressed }) => [styles.navIconBtn, pressed && { opacity: 0.88 }]}
                >
                  <SafeIonicons name="notifications-outline" size={20} color="#e2e8f0" />
                </Pressable>
                <View style={styles.bellDot} />
              </View>
            ) : null}
            <Pressable
              onPress={onWalletPress}
              style={({ pressed }) => [styles.walletPill, pressed && { opacity: 0.9 }]}
            >
              <SafeIonicons name="wallet-outline" size={16} color="#94a3b8" />
              <Text style={styles.walletAmt}>{walletDisplay}</Text>
            </Pressable>
            <Pressable
              onPress={onAddMoney}
              style={({ pressed }) => [styles.addMoneyPlus, pressed && { opacity: 0.9 }]}
            >
              <SafeIonicons name="add" size={22} color="#0c0618" />
            </Pressable>
            <Pressable
              onPress={onOpenProfile}
              style={({ pressed }) => [styles.avatarRing, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.avatarInner}>
                <Text style={styles.avatarLetter}>{avLetter}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {compact ? liveStatusStrip : null}

        {/* Hero */}
        <View style={[styles.heroRow, compact && styles.heroRowCompact, !compact && styles.heroRowDesk]}>
          <View style={[styles.heroLeftWrap, compact && styles.heroLeftWrapCompact, !compact && styles.heroLeftWrapDesk]}>
            <Image
              source={competeWinCashHeroSource}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={['rgba(4,0,10,0.88)', 'rgba(12,0,28,0.5)', 'rgba(6,0,14,0.35)']}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroLeft, compact && styles.heroLeftCompact, !compact && styles.heroLeftDesk]}>
              <View style={[styles.kickerRow, !compact && styles.kickerRowDesk]}>
                <View style={styles.kickerLine} />
                <Text style={styles.kicker}>SKILL-BASED COMPETITION</Text>
              </View>
              <Text style={[styles.heroHeadline, compact && styles.heroHeadlineCompact, !compact && styles.heroHeadlineDesk, { fontFamily: runitFont.black }]}>
                COMPETE. WIN <Text style={styles.heroReal}>REAL CASH</Text>.{' '}
                <Text style={styles.heroInstant}>INSTANTLY.</Text>
              </Text>
              <View style={[styles.perkRow, !compact && styles.perkRowDesk]}>
                <View style={styles.perkPill}>
                  <SafeIonicons name="people" size={12} color={BRAND_GOLD} />
                  <Text style={styles.perkPillTxt}>Real players</Text>
                </View>
                <View style={styles.perkPill}>
                  <SafeIonicons name="trophy" size={12} color={BRAND_GOLD} />
                  <Text style={styles.perkPillTxt}>Real prizes</Text>
                </View>
                <View style={styles.perkPill}>
                  <SafeIonicons name="timer-outline" size={12} color={BRAND_GOLD} />
                  <Text style={styles.perkPillTxt}>Real fast</Text>
                </View>
              </View>
              <Text style={[styles.heroSub, compact && styles.heroSubCompact, !compact && styles.heroSubDesk]}>
                1v1 matchups. Tiered entry. Same games as Arcade. Prizes scale with skill level.
              </Text>
              <View style={styles.heroBtns}>
                <Pressable
                  onPress={onPlayNow}
                  style={({ pressed }) => [styles.btnPlay, compact && styles.btnPlayCompact, !compact && styles.btnPlayDesk, pressed && { opacity: 0.92 }]}
                >
                  <SafeIonicons name="play-circle" size={18} color="#fff" />
                  <Text style={[styles.btnPlayTxt, compact && styles.btnPlayTxtCompact, !compact && styles.btnPlayTxtDesk]}>Play now</Text>
                </Pressable>
                <Pressable
                  onPress={onHowItWorks}
                  style={({ pressed }) => [styles.btnGhost, compact && styles.btnGhostCompact, !compact && styles.btnGhostDesk, pressed && { opacity: 0.92 }]}
                >
                  <SafeIonicons name="play-circle" size={18} color="rgba(167,139,250,0.95)" />
                  <Text style={[styles.btnGhostTxt, compact && styles.btnGhostTxtCompact, !compact && styles.btnGhostTxtDesk]}>How it works</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Pressable
            onPress={onEnterDailyTournament}
            style={({ pressed }) => [
              styles.tourneyCardOuter,
              compact && styles.tourneyCardOuterCompact,
              pressed && { opacity: 0.96 },
            ]}
          >
            <View style={[styles.tourneyStack, compact && styles.tourneyStackMinH, !compact && styles.tourneyStackDesk]}>
              <Image
                source={tournamentOfTheDayHeroSource}
                style={styles.tourneyBgImg}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
              <LinearGradient
                colors={['rgba(3,0,6,0.4)', 'rgba(12,4,20,0.9)', 'rgba(4,0,8,0.95)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.tourneyCard, compact && styles.tourneyCardCompact, !compact && styles.tourneyCardDesk]}>
                <View style={[styles.tourneyKickerRow, !compact && styles.tourneyKickerRowDesk]}>
                  <View style={styles.kickerLine} />
                  <Text style={styles.tourneyKickerLabel}>DAILY TOURNAMENT</Text>
                </View>
                <Text
                  style={[styles.tourneyMega, compact && styles.tourneyMegaCompact, !compact && styles.tourneyMegaDesk, { fontFamily: runitFont.black }]}
                  numberOfLines={3}
                >
                  <Text style={styles.tourneyMegaDim}>TOURNAMENT </Text>
                  <Text style={styles.tourneyMegaPink}>OF THE </Text>
                  <Text style={styles.tourneyMegaGold}>DAY</Text>
                </Text>
                <View style={styles.tourneyLockupRow}>
                  <Image
                    source={runItArcadeLogoSource}
                    style={[styles.tourneyLockup, compact && styles.tourneyLockupCompact, !compact && styles.tourneyLockupDesk]}
                    contentFit="contain"
                  />
                </View>
                <View style={styles.tourneyPrizeRow}>
                  <Text style={styles.tourneyPrizeSub}>Showcase prize</Text>
                  <Text style={[styles.dailyPrizeAmt, !compact && styles.dailyPrizeAmtDesk]}>${dailyPrizeUsd}</Text>
                </View>
                <View style={[styles.countdownRow, !compact && styles.countdownRowDesk]}>
                  <View style={[styles.countBox, compact && styles.countBoxCompact, !compact && styles.countBoxDesk]}>
                    <Text style={[styles.countNum, compact && styles.countNumCompact, !compact && styles.countNumDesk]}>{hh}</Text>
                    <Text style={styles.countLbl}>HR</Text>
                  </View>
                  <Text style={styles.countSep}>:</Text>
                  <View style={[styles.countBox, compact && styles.countBoxCompact, !compact && styles.countBoxDesk]}>
                    <Text style={[styles.countNum, compact && styles.countNumCompact, !compact && styles.countNumDesk]}>{mm}</Text>
                    <Text style={styles.countLbl}>MIN</Text>
                  </View>
                  <Text style={styles.countSep}>:</Text>
                  <View style={[styles.countBox, compact && styles.countBoxCompact, !compact && styles.countBoxDesk]}>
                    <Text style={[styles.countNum, compact && styles.countNumCompact, !compact && styles.countNumDesk]}>{ss}</Text>
                    <Text style={styles.countLbl}>SEC</Text>
                  </View>
                </View>
                <Text style={[styles.tourneyFoot, compact && styles.tourneyFootCompact, !compact && styles.tourneyFootDesk]}>
                  {ENABLE_DAILY_FREE_TOURNAMENT ? 'Free to enter · ' : ''}Skill path · {dailyRounds} rounds. New
                  bracket at local midnight.
                </Text>
                <View style={[styles.tourneyChips, compact && styles.tourneyChipsCompact, !compact && styles.tourneyChipsDesk]}>
                  <View style={[styles.miniChip, compact && styles.miniChipCompact]}>
                    <SafeIonicons name="ticket-outline" size={12} color={BRAND_GOLD} />
                    <Text style={[styles.miniChipTxt, compact && styles.miniChipTxtCompact]}>Open entry</Text>
                  </View>
                  <View style={[styles.miniChip, compact && styles.miniChipCompact]}>
                    <SafeIonicons name="gift-outline" size={12} color={BRAND_GOLD} />
                    <Text style={[styles.miniChipTxt, compact && styles.miniChipTxtCompact]}>No wallet needed</Text>
                  </View>
                </View>
                <LinearGradient
                  colors={[runit.neonPurple, '#3f3f46', '#18181B']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.tourneyCta, compact && styles.tourneyCtaCompact, !compact && styles.tourneyCtaDesk]}
                >
                  <SafeIonicons name="calendar-outline" size={18} color="#fff" />
                  <Text style={[styles.tourneyCtaTxt, !compact && styles.tourneyCtaTxtDesk]}>
                    {ENABLE_DAILY_FREE_TOURNAMENT ? 'Enter free →' : 'View events →'}
                  </Text>
                </LinearGradient>
                <View style={styles.tourneyProgressBlock}>
                  <View style={styles.tourneyProgressTrack}>
                    <View style={[styles.tourneyProgressFill, { width: `${Math.round(totdProgress.pct)}%` }]} />
                  </View>
                  <Text style={[styles.tourneyProgressMeta, !compact && styles.tourneyProgressMetaDesk]}>
                    {totdProgress.entered} / {totdProgress.cap} entered
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Stat bar — 4-up like reference dashboard */}
        <View style={[styles.statBar, compact && styles.statBarCompact, !compact && styles.statBarDesk]}>
          <View style={[styles.statBarItem, compact && styles.statBarItemCompact]}>
            <Text style={[styles.statBarVal, compact && styles.statBarValCompact, !compact && styles.statBarValDesk, { fontFamily: runitFont.black }]}>{paidOut}</Text>
            <Text style={[styles.statBarLbl, compact && styles.statBarLblCompact, !compact && styles.statBarLblDesk]}>PAID OUT · 24H</Text>
          </View>
          <View style={[styles.statBarItem, compact && styles.statBarItemCompact]}>
            <Text style={[styles.statBarVal, compact && styles.statBarValCompact, !compact && styles.statBarValDesk, { fontFamily: runitFont.black }]}>
              {matchesLiveOnly}
            </Text>
            <Text style={[styles.statBarLbl, compact && styles.statBarLblCompact, !compact && styles.statBarLblDesk]}>LIVE MATCHES</Text>
          </View>
          <View style={[styles.statBarItem, compact && styles.statBarItemCompact]}>
            <Text style={[styles.statBarVal, compact && styles.statBarValCompact, !compact && styles.statBarValDesk, { fontFamily: runitFont.black }]}>
              {playersOnlineDisplay}
            </Text>
            <Text style={[styles.statBarLbl, compact && styles.statBarLblCompact, !compact && styles.statBarLblDesk]}>PLAYERS ONLINE</Text>
          </View>
          <View style={[styles.statBarItem, compact && styles.statBarItemCompact]}>
            <Text style={[styles.statBarVal, compact && styles.statBarValCompact, !compact && styles.statBarValDesk, { fontFamily: runitFont.black }]}>{activeGames}</Text>
            <Text style={[styles.statBarLbl, compact && styles.statBarLblCompact, !compact && styles.statBarLblDesk]}>IN QUEUE + GAMES</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={[styles.quickRow, compact && styles.quickRowCompact, !compact && styles.quickRowDesk]}>
          <Pressable
            onPress={onPlayNow}
            style={({ pressed }) => [styles.quickBtn, styles.quickPlay, !compact && styles.quickBtnDesk, pressed && { opacity: 0.92 }]}
          >
            <SafeIonicons name="play" size={16} color="#fff" />
            <Text style={[styles.quickBtnTxt, !compact && styles.quickBtnTxtDesk]}>Play now</Text>
          </Pressable>
          {onAsyncRun ? (
            <Pressable
              onPress={onAsyncRun}
              style={({ pressed }) => [styles.quickBtn, styles.quickAsync, !compact && styles.quickBtnDesk, pressed && { opacity: 0.92 }]}
            >
              <SafeIonicons name="flash" size={16} color="#0c0618" />
              <Text style={[styles.quickBtnTxt, styles.quickBtnTxtDark, !compact && styles.quickBtnTxtDesk]}>Async</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onJoinTournamentEvents}
            style={({ pressed }) => [styles.quickBtn, styles.quickMagenta, !compact && styles.quickBtnDesk, pressed && { opacity: 0.92 }]}
          >
            <SafeIonicons name="calendar-outline" size={16} color="#fff" />
            <Text style={[styles.quickBtnTxt, !compact && styles.quickBtnTxtDesk]}>Tournaments</Text>
          </Pressable>
          <Pressable
            onPress={onAddMoney}
            style={({ pressed }) => [styles.quickBtn, styles.quickBlue, !compact && styles.quickBtnDesk, pressed && { opacity: 0.92 }]}
          >
            <SafeIonicons name="wallet-outline" size={16} color="#e2e8f0" />
            <Text style={[styles.quickBtnTxt, !compact && styles.quickBtnTxtDesk]}>Add funds</Text>
          </Pressable>
          <Pressable
            onPress={onInviteFriends}
            style={({ pressed }) => [styles.quickBtn, styles.quickGold, !compact && styles.quickBtnDesk, pressed && { opacity: 0.92 }]}
          >
            <SafeIonicons name="share-social" size={16} color="#0c0618" />
            <Text style={[styles.quickBtnTxt, styles.quickBtnTxtDark, !compact && styles.quickBtnTxtDesk]}>Invite friends</Text>
          </Pressable>
        </View>

        {/* Trending games */}
        <>
          <View style={[styles.sectionHead, compact && styles.sectionHeadCompact, !compact && styles.sectionHeadDesk]}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  !compact && styles.sectionTitleDesk,
                  { fontFamily: runitFont.black },
                ]}
              >
                TRENDING GAMES
              </Text>
              <Text style={[styles.sectionSub, !compact && styles.sectionSubDesk]}>1v1 queues · same games as the Arcade</Text>
            </View>
            <Pressable onPress={onBrowseLiveMatches} hitSlop={6}>
              <Text style={styles.sectionLink}>See all →</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.liveCardsScroll}
          >
            {h2hCarouselRows.map((row) => {
              const grad = h2hGradients(row.gameKey);
              const highlight = row.gameKey === 'tap-dash';
              const hostWaiting = row.activeWaiter != null;
              const cardStyle: ViewStyle[] = [styles.gameCard, { width: gameCardW }];
              if (highlight) {
                cardStyle.push(styles.gameCardHot);
              }
              const subLine = hostWaiting
                ? `${row.activeWaiter!.hostLabel} waiting · ${row.activeWaiter!.postedMinutesAgo}m · ${row.activeWaiter!.tierShortLabel} tier`
                : TIER_SUB;
              const entryCents = hostWaiting
                ? Math.round(row.activeWaiter!.entryUsd * 100)
                : Math.round(MATCH_ENTRY_TIERS[0].entry * 100);
              return (
                <Pressable
                  key={row.gameKey}
                  onPress={() => onH2hCarouselRowPress(row)}
                  style={({ pressed }) => [cardStyle, pressed && { opacity: 0.94 }]}
                >
                  <LinearGradient
                    colors={[grad[0], grad[1]]}
                    style={[
                      styles.gameCardGrad,
                      compact && styles.gameCardGradCompact,
                      !compact && styles.gameCardGradDesk,
                    ]}
                  >
                    {highlight ? (
                      <View style={styles.gameHotPill}>
                        <Text style={styles.gameHotPillTxt}>HOT</Text>
                      </View>
                    ) : null}
                    <View style={styles.gameCardTop}>
                      {h2hIconFor(row.gameKey, gameIconSize)}
                      <View style={styles.gameCardTitles}>
                        <Text style={[styles.gameTitle, !compact && styles.gameTitleDesk]}>{row.title}</Text>
                        <Text style={[styles.gameSub, !compact && styles.gameSubDesk]} numberOfLines={2}>
                          {subLine}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.gameCardBottom}>
                      {highlight && !hostWaiting ? (
                        <View style={styles.priceDash}>
                          <SafeIonicons name="flame" size={18} color={BRAND_GOLD} />
                        </View>
                      ) : (
                        <Text style={styles.priceTxt}>{formatUsdFromCents(entryCents)}</Text>
                      )}
                      <View style={[styles.findOppBtn, !compact && styles.findOppBtnDesk]}>
                        <Text style={[styles.findOppTxt, !compact && styles.findOppTxtDesk]}>
                          {hostWaiting ? 'Join' : 'Find Opponent'}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </ScrollView>
        </>

        <AsyncRunsPromoSection
          compact={compact}
          onStartPress={() => {
            onAsyncRun?.();
          }}
        />
    </>
  );

  const lowerMain = (
    <>
        {/* Your stats + leaderboards — narrow web: stats full width, earners + recent side-by-side */}
        {compact ? (
          <View style={styles.compactStatsLeaderboards}>
            <View style={[styles.panel, styles.panelCompact, styles.compactPanelFull]}>
              <Text style={[styles.panelTitle, { fontFamily: runitFont.black }]}>YOUR STATS</Text>
              {ENABLE_BACKEND && uid && fightLoading ? (
                <Text style={styles.panelMuted}>Loading your stats…</Text>
              ) : (
                <>
                  <StatLine label="Total matches" value={uid ? totalMatches : '—'} valueGreen={false} />
                  <StatLine label="Win rate" value={uid ? winRate : '—'} valueGreen={false} />
                  <StatLine
                    label="Cash wallet"
                    value={uid ? formatUsdFromCents(walletCents) : '—'}
                    valueGreen={!!uid}
                  />
                  <StatLine label="Current streak" value={uid ? streak : '—'} valueGreen={false} />
                </>
              )}
            </View>
            <View style={styles.compactLeaderPair}>
              <View style={[styles.panel, styles.panelCompact, styles.compactPanelHalf]}>
                <Text style={[styles.panelTitle, styles.panelTitleCompact, { fontFamily: runitFont.black }]}>
                  TOP EARNERS · 24H
                </Text>
                {topEarners.map((r, i) => (
                  <View key={`${r.username}-${r.created_at}`} style={styles.leaderRow}>
                    <Text style={[styles.leaderRank, { color: RANK_COLORS[i % RANK_COLORS.length] }]}>{i + 1}</Text>
                    <View style={[styles.leaderAvatar, styles.leaderAvatarCompact, { backgroundColor: avatarColor(i) }]}>
                      <Text style={styles.leaderAvTxt}>{initialsFromUsername(r.username)}</Text>
                    </View>
                    <Text style={styles.leaderName} numberOfLines={1}>
                      {r.username}
                    </Text>
                    <Text style={styles.leaderAmt}>+{formatUsdFromCents(r.cents)}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.panel, styles.panelCompact, styles.compactPanelHalf]}>
                <Text style={[styles.panelTitle, styles.panelTitleCompact, { fontFamily: runitFont.black }]}>
                  RECENT WINS
                </Text>
                {FAKE_RECENT_WINNER_LINES.map((w, i) => (
                  <View key={`${w.name}-${i}`} style={styles.recentRow}>
                    <View style={[styles.leaderAvatar, styles.leaderAvatarCompact, { backgroundColor: avatarColor(i + 2) }]}>
                      <Text style={styles.leaderAvTxt}>{initialsFromUsername(w.name)}</Text>
                    </View>
                    <View style={styles.recentMid}>
                      <Text style={styles.recentName} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <Text style={styles.recentSub} numberOfLines={1}>
                        {w.game} · {w.ago}
                      </Text>
                    </View>
                    <Text style={styles.recentWin}>+{formatUsdFromCents(w.amountCents)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.threeCol}>
            <View style={[styles.panel, styles.panelDesk]}>
              <Text style={[styles.panelTitle, { fontFamily: runitFont.black }]}>YOUR STATS</Text>
              {ENABLE_BACKEND && uid && fightLoading ? (
                <Text style={styles.panelMuted}>Loading your stats…</Text>
              ) : (
                <>
                  <StatLine label="Total matches" value={uid ? totalMatches : '—'} valueGreen={false} />
                  <StatLine label="Win rate" value={uid ? winRate : '—'} valueGreen={false} />
                  <StatLine
                    label="Cash wallet"
                    value={uid ? formatUsdFromCents(walletCents) : '—'}
                    valueGreen={!!uid}
                  />
                  <StatLine label="Current streak" value={uid ? streak : '—'} valueGreen={false} />
                </>
              )}
            </View>
            <View style={[styles.panel, styles.panelDesk]}>
              <Text style={[styles.panelTitle, { fontFamily: runitFont.black }]}>TOP EARNERS · 24H</Text>
              {topEarners.map((r, i) => (
                <View key={`${r.username}-${r.created_at}`} style={styles.leaderRow}>
                  <Text style={[styles.leaderRank, { color: RANK_COLORS[i % RANK_COLORS.length] }]}>{i + 1}</Text>
                  <View style={[styles.leaderAvatar, { backgroundColor: avatarColor(i) }]}>
                    <Text style={styles.leaderAvTxt}>{initialsFromUsername(r.username)}</Text>
                  </View>
                  <Text style={styles.leaderName} numberOfLines={1}>
                    {r.username}
                  </Text>
                  <Text style={styles.leaderAmt}>+{formatUsdFromCents(r.cents)}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.panel, styles.panelDesk]}>
              <Text style={[styles.panelTitle, { fontFamily: runitFont.black }]}>RECENT WINS</Text>
              {FAKE_RECENT_WINNER_LINES.map((w, i) => (
                <View key={`${w.name}-${i}`} style={styles.recentRow}>
                  <View style={[styles.leaderAvatar, { backgroundColor: avatarColor(i + 2) }]}>
                    <Text style={styles.leaderAvTxt}>{initialsFromUsername(w.name)}</Text>
                  </View>
                  <View style={styles.recentMid}>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <Text style={styles.recentSub} numberOfLines={1}>
                      {w.game} · {w.ago}
                    </Text>
                  </View>
                  <Text style={styles.recentWin}>+{formatUsdFromCents(w.amountCents)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: compact ? 24 : 48 }} />
    </>
  );

  const mainMobile = (
    <>
      {upperMain}
      {lowerMain}
    </>
  );

  if (!compact) {
    return (
      <View style={styles.laptopRoot}>
        <View style={[styles.dashboardRow, styles.dashboardRowFill]}>
          <WebHomeSidebar />
          <View style={[styles.mainColumn, styles.mainColumnLaptop]}>
            <ScrollView
              className={Platform.OS === 'web' ? 'hide-scrollbar-y' : undefined}
              style={styles.laptopStatsScroll}
              contentContainerStyle={styles.laptopStatsScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {upperMain}
              {lowerMain}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.max, styles.maxCompact]}>{mainMobile}</View>
    </ScrollView>
  );
}

function StatLine({
  label,
  value,
  valueGreen,
}: {
  label: string;
  value: string;
  valueGreen: boolean;
}) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLineLbl}>{label}</Text>
      <Text style={[styles.statLineVal, valueGreen && styles.statLineValGreen]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
    paddingTop: 12,
    alignItems: 'stretch',
  },
  /** Laptop: sidebar + main row fill the tab viewport. */
  laptopRoot: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
  },
  dashboardRowFill: {
    flex: 1,
    minHeight: 0,
  },
  mainColumnLaptop: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 8,
  },
  /** Main column scroll: hero, trending strip, and stat panels move together. */
  laptopStatsScroll: {
    flex: 1,
    minHeight: 0,
  },
  laptopStatsScrollContent: {
    paddingTop: 0,
    paddingBottom: 32,
  },
  /** Laptop hero: denser so above-the-fold fits one screen. */
  topNavDesk: { marginBottom: 6, paddingTop: 2 },
  liveStripDesk: { marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10 },
  heroRowDesk: { marginBottom: 10, gap: 10 },
  /** Match tourney column min height so the two hero cards align in one row. */
  heroLeftWrapDesk: { minHeight: 172 },
  heroLeftDesk: { paddingVertical: 12, paddingHorizontal: 14 },
  kickerRowDesk: { marginBottom: 6 },
  heroHeadlineDesk: { fontSize: 22, lineHeight: 26, marginBottom: 6 },
  perkRowDesk: { marginBottom: 6, gap: 6 },
  heroSubDesk: { fontSize: 12, lineHeight: 17, marginBottom: 10, maxWidth: 440 },
  btnPlayDesk: { paddingVertical: 10, paddingHorizontal: 18 },
  btnPlayTxtDesk: { fontSize: 14 },
  btnGhostDesk: { paddingVertical: 10, paddingHorizontal: 18 },
  btnGhostTxtDesk: { fontSize: 14 },
  tourneyStackDesk: { minHeight: 172 },
  tourneyCardDesk: { padding: 12 },
  tourneyKickerRowDesk: { marginBottom: 6 },
  tourneyMegaDesk: { fontSize: 20, lineHeight: 24, marginBottom: 4 },
  tourneyLockupDesk: { width: 108, height: 32 },
  dailyPrizeAmtDesk: { fontSize: 20 },
  countdownRowDesk: { marginBottom: 10, gap: 4 },
  countBoxDesk: { paddingVertical: 6, paddingHorizontal: 8, minWidth: 58 },
  countNumDesk: { fontSize: 16 },
  tourneyFootDesk: { fontSize: 11, lineHeight: 15, marginBottom: 8 },
  tourneyChipsDesk: { marginBottom: 8, gap: 6 },
  tourneyCtaDesk: { paddingVertical: 10, marginBottom: 6 },
  tourneyCtaTxtDesk: { fontSize: 13 },
  tourneyProgressMetaDesk: { fontSize: 10 },
  statBarDesk: { marginBottom: 8, gap: 6 },
  statBarValDesk: { fontSize: 18 },
  statBarLblDesk: { fontSize: 9, marginTop: 2 },
  quickRowDesk: { marginBottom: 8, gap: 6 },
  quickBtnDesk: { paddingVertical: 8, paddingHorizontal: 10, minWidth: 0 },
  quickBtnTxtDesk: { fontSize: 11 },
  sectionHeadDesk: { marginBottom: 6 },
  sectionTitleDesk: { fontSize: 11 },
  sectionSubDesk: { fontSize: 11 },
  gameCardGradDesk: { minHeight: 112, padding: 10 },
  gameTitleDesk: { fontSize: 15, marginBottom: 2 },
  gameSubDesk: { fontSize: 10, lineHeight: 14 },
  findOppBtnDesk: { paddingVertical: 6, paddingHorizontal: 10 },
  findOppTxtDesk: { fontSize: 11 },
  panelDesk: { minHeight: 160, padding: 14 },
  /** Laptop + sidebar */
  dashboardRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1440,
    minHeight: 400,
    alignSelf: 'center',
    alignItems: 'stretch' as const,
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    maxWidth: 1120,
    paddingTop: 6,
    paddingRight: 24,
    paddingLeft: 8,
    paddingBottom: 20,
  },
  max: {
    width: '100%',
    maxWidth: 1200,
    paddingHorizontal: 20,
  },
  /** Web mobile: header wordmark — one row with wallet/actions; reads at a glance. */
  compactWebLogo: { width: 204, height: 62, maxWidth: '58%' as const },
  perkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  perkPillTxt: { color: 'rgba(254,243,199,0.95)', fontSize: 11, fontWeight: '800' },
  heroInstant: { color: BRAND_GOLD },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 16,
    paddingTop: 8,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  bellWrap: { position: 'relative' as const },
  bellDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
  },
  addMoneyPlus: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_GOLD,
    borderWidth: 1,
    borderColor: 'rgba(255,224,100,0.5)',
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(45,0,32,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#f8fafc', fontSize: 14, fontWeight: '900' },
  brandBlock: { minWidth: 0, flexShrink: 1, justifyContent: 'center' as const },
  brandBlockCompact: { flex: 1, minWidth: 0, marginRight: 4 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  walletAmt: { color: '#4ade80', fontSize: 14, fontWeight: '800' },
  addMoneyOutline: {
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.45)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addMoneyOutlineTxt: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(8,4,18,0.65)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  liveStripLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  liveStripTxt: { color: 'rgba(226,232,240,0.9)', fontSize: 12, fontWeight: '600' },
  liveSep: { color: 'rgba(148,163,184,0.5)', marginHorizontal: 4 },
  liveStripReward: { color: 'rgba(148,163,184,0.95)', fontSize: 12, fontWeight: '600' },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
    marginBottom: 32,
  },
  /** Tourney block sits above the marketing hero on narrow web (see `heroRowCompact`). */
  tourneyStackMinH: { minHeight: 200 },
  heroLeftWrap: {
    flex: 1,
    minWidth: 0,
    flexBasis: 0,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative' as const,
    minHeight: 300,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  kickerLine: { width: 28, height: 2, backgroundColor: runit.neonPink, borderRadius: 1 },
  kicker: {
    color: runit.neonPink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroHeadline: {
    color: '#f8fafc',
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  heroReal: { color: runit.neonPink },
  heroSub: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    maxWidth: 480,
  },
  heroBtns: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  btnPlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(91,33,182,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  btnPlayTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.6)',
    backgroundColor: 'rgba(2,0,6,0.35)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  btnGhostTxt: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  tourneyStack: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative' as const,
    minHeight: 300,
  },
  tourneyBgImg: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Right column: same flex basis as `heroLeft` (mirrors first hero). */
  tourneyCardOuter: {
    flex: 1,
    minWidth: 0,
    flexBasis: 0,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.55)',
    alignSelf: 'stretch',
  },
  tourneyCard: {
    padding: 20,
    position: 'relative' as const,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  tourneyKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tourneyKickerLabel: {
    color: runit.neonPink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tourneyMega: { fontSize: 26, lineHeight: 30, marginBottom: 8, textAlign: 'left' as const },
  tourneyMegaCompact: { fontSize: 22, lineHeight: 26 },
  tourneyMegaDim: { color: 'rgba(241,245,249,0.9)' },
  tourneyMegaPink: { color: runit.neonPink },
  tourneyMegaGold: { color: BRAND_GOLD },
  tourneyLockupRow: { alignItems: 'center' as const, marginBottom: 8 },
  tourneyLockup: { width: 152, height: 46 },
  tourneyLockupCompact: { width: 124, height: 38 },
  tourneyPrizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tourneyPrizeSub: { color: 'rgba(148,163,184,0.9)', fontSize: 12, fontWeight: '700' },
  dailyPrizeAmt: {
    color: '#4ade80',
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  tourneyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  tourneyCtaCompact: { paddingVertical: 12 },
  tourneyCtaTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
  tourneyProgressBlock: { gap: 6 },
  tourneyProgressTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(15,23,42,0.85)',
    overflow: 'hidden' as const,
  },
  tourneyProgressFill: {
    height: '100%' as const,
    borderRadius: 4,
    backgroundColor: 'rgba(167,85,250,0.95)',
  },
  tourneyProgressMeta: { color: 'rgba(203,213,225,0.9)', fontSize: 11, fontWeight: '700' },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 6,
  },
  countBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.65)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 72,
  },
  countNum: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  countLbl: { color: 'rgba(148,163,184,0.85)', fontSize: 9, fontWeight: '700', marginTop: 2 },
  countSep: { color: 'rgba(148,163,184,0.5)', fontSize: 18, fontWeight: '700' },
  tourneyFoot: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  tourneyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  miniChipTxt: { color: 'rgba(203,213,225,0.9)', fontSize: 11, fontWeight: '600' },
  statBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
    gap: 12,
  },
  statBarItem: { flexBasis: '22%', flexGrow: 1, minWidth: 120, alignItems: 'center' },
  /** 2×2 grid on phone web — no orphaned numbers, labels stay under values. */
  statBarItemCompact: {
    flexBasis: '48%',
    maxWidth: '48%',
    minWidth: 0,
    flexGrow: 0,
  },
  statBarVal: { color: '#f8fafc', fontSize: 28, fontWeight: '900' },
  statBarLbl: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sectionSub: { color: 'rgba(148,163,184,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectionLink: {
    color: BRAND_GOLD,
    fontSize: 13,
    fontWeight: '800',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  quickRowCompact: { gap: 8, marginBottom: 18 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 120,
  },
  quickPlay: { backgroundColor: 'rgba(91,33,182,0.85)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.45)' },
  quickAsync: { backgroundColor: 'rgba(52, 211, 153, 0.88)', borderWidth: 1, borderColor: 'rgba(6, 78, 59, 0.45)' },
  quickMagenta: { backgroundColor: 'rgba(190,24,93,0.8)', borderWidth: 1, borderColor: 'rgba(244,114,182,0.4)' },
  quickBlue: { backgroundColor: 'rgba(30,58,138,0.85)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.4)' },
  quickGold: { backgroundColor: BRAND_GOLD, borderWidth: 1, borderColor: 'rgba(255,236,150,0.6)' },
  quickBtnTxt: { color: '#f8fafc', fontSize: 13, fontWeight: '900' },
  quickBtnTxtDark: { color: '#0c0618' },
  liveCardsScroll: {
    gap: 14,
    paddingBottom: 8,
    paddingRight: 8,
  },
  gameCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  gameCardHot: {
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.75)',
    shadowColor: 'rgba(255,215,0,0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 8,
  },
  gameHotPill: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gameHotPillTxt: { color: BRAND_GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  gameCardGrad: {
    padding: 14,
    minHeight: 168,
    justifyContent: 'space-between',
    position: 'relative' as const,
  },
  gameCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  gameCardTitles: { flex: 1, minWidth: 0 },
  gameTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  gameSub: { color: 'rgba(203,213,225,0.85)', fontSize: 11, lineHeight: 15 },
  gameCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  priceTxt: { color: '#4ade80', fontSize: 16, fontWeight: '800' },
  priceDash: { minWidth: 28 },
  findOppBtn: {
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.35)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  findOppTxt: { color: '#e2e8f0', fontSize: 12, fontWeight: '800' },
  threeCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
    alignItems: 'stretch',
  },
  compactStatsLeaderboards: { width: '100%' as const, marginTop: 4, gap: 10 },
  compactLeaderPair: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  compactPanelFull: { width: '100%' as const },
  compactPanelHalf: { flex: 1, minWidth: 0, minHeight: 0 },
  panelTitleCompact: { fontSize: 10, marginBottom: 8, letterSpacing: 0.6 },
  leaderAvatarCompact: { width: 30, height: 30, borderRadius: 15 },
  panel: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(8,4,18,0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appBorderAccentMuted,
    padding: 18,
    minHeight: 200,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  recentMid: { flex: 1, minWidth: 0 },
  recentName: { color: 'rgba(203,213,225,0.95)', fontSize: 13, fontWeight: '700' },
  recentSub: { color: 'rgba(148,163,184,0.9)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  recentWin: { color: '#4ade80', fontSize: 13, fontWeight: '800' },
  panelTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  panelMuted: { color: 'rgba(148,163,184,0.9)', fontSize: 13, lineHeight: 18 },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  statLineLbl: { color: 'rgba(148,163,184,0.95)', fontSize: 14 },
  statLineVal: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  statLineValGreen: { color: '#4ade80' },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  leaderRank: { width: 22, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  leaderName: { flex: 1, color: 'rgba(203,213,225,0.95)', fontSize: 14, fontWeight: '600' },
  leaderAmt: { color: '#4ade80', fontSize: 14, fontWeight: '800' },

  /** Viewports narrower than `HOME_WEB_LAPTOP_MIN_WIDTH` (phone browsers, small tablets). */
  scrollContentCompact: { paddingTop: 0, paddingBottom: 24 },
  maxCompact: { paddingHorizontal: 12, maxWidth: '100%' as const },
  topNavCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
    paddingTop: 2,
  },
  navRightCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 6,
  },
  liveStripCompact: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  liveStripLeftCompact: { flex: 1, minWidth: 0 },
  liveStripRewardCompact: { flexShrink: 0 },
  /** DOM order is hero then tourney; reverse column puts Tournament of the Day first without duplicating nodes. */
  heroRowCompact: {
    flexDirection: 'column-reverse',
    gap: 12,
    marginBottom: 16,
  },
  heroLeftWrapCompact: {
    width: '100%' as const,
    flexBasis: 'auto' as const,
    minHeight: 220,
  },
  heroLeftCompact: { minWidth: 0 },
  heroHeadlineCompact: {
    fontSize: 26,
    lineHeight: 31,
    marginBottom: 8,
  },
  heroSubCompact: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    maxWidth: '100%' as const,
  },
  btnPlayCompact: {
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  btnPlayTxtCompact: { fontSize: 14 },
  btnGhostCompact: {
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  btnGhostTxtCompact: { fontSize: 14 },
  tourneyCardOuterCompact: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  tourneyCardCompact: {
    padding: 14,
  },
  countBoxCompact: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  countNumCompact: { fontSize: 18 },
  tourneyFootCompact: { fontSize: 11, marginBottom: 8, lineHeight: 15 },
  tourneyChipsCompact: { marginBottom: 10, gap: 6 },
  miniChipCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  miniChipTxtCompact: { fontSize: 10 },
  statBarCompact: {
    marginBottom: 14,
    gap: 6,
    paddingHorizontal: 0,
  },
  statBarValCompact: { fontSize: 20 },
  statBarLblCompact: { fontSize: 9, marginTop: 2 },
  sectionHeadCompact: { marginBottom: 8 },
  gameCardGradCompact: { minHeight: 132, padding: 11 },
  panelCompact: { minHeight: 0, padding: 14 },
});
