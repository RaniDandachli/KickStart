import { HomeH2hCarouselWeb, type H2hCarouselRow } from '@/components/arcade/HomeH2hCarouselWeb';
import { HomeScreenWebLaptop } from '@/components/home/HomeScreenWebLaptop';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeNeonBackground } from '@/components/arcade/HomeNeonBackground';
import { HomePlayHero } from '@/components/arcade/HomePlayHero';
import { HowItWorksModal } from '@/components/arcade/HowItWorksModal';
import {
    BallRunGameIcon,
    DashDuelGameIcon,
    NeonDanceGameIcon,
    NeonGridGameIcon,
    NeonShipGameIcon,
    TapDashGameIcon,
    TileClashGameIcon,
    TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { GuestAuthPromptModal, type GuestAuthPromptVariant } from '@/components/auth/GuestAuthPromptModal';
import { ENABLE_BACKEND, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { useHomeH2hQueueBoard } from '@/hooks/useHomeH2hQueueBoard';
import { buildTickerLinesFromLobby, useHomeLobbyStats } from '@/hooks/useHomeLobbyStats';
import { useProfile } from '@/hooks/useProfile';
import { useProfileFightStats } from '@/hooks/useProfileFightStats';
import { useTournaments } from '@/hooks/useTournaments';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';
import { pushCrossTab } from '@/lib/appNavigation';
import { buildHomeH2hCarouselRows } from '@/lib/buildHomeH2hCarouselRows';
import { getDailyTournamentPrizeUsd, getDailyTournamentRounds, todayYmdLocal } from '@/lib/dailyFreeTournament';
import { H2H_OPEN_GAMES_ALL, type H2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import {
    APP_SCREEN_GRADIENT_COLORS,
    APP_SCREEN_GRADIENT_LOCATIONS,
    appBorderAccentMuted,
    appChromeLinePink,
    runit,
    runitFont,
} from '@/lib/runitArcadeTheme';
import { runItArcadeLogoSource } from '@/lib/brandLogo';
import { pushCashWalletShop, SHOP_PATH } from '@/lib/shopNavigation';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';
import { useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const webDesktopTabs = useWebUsesTopTabBar();
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const dailyUid = useAuthStore((s) => s.user?.id ?? 'guest');
  const dailyHydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const dailyDayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const dailyResetCountdown = useDailyFreeResetClock(dailyUid, dailyHydrate);
  const todaysKey = dailyDayKey || todayYmdLocal();
  const dailyRounds = getDailyTournamentRounds(todaysKey);
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(todaysKey);
  const profileQ = useProfile(uid);
  const fightQ = useProfileFightStats(uid);
  const seasonQ = useActiveSeason();
  const tournamentsQ = useTournaments(true);
  const lobbyStatsQ = useHomeLobbyStats();
  const h2hBoardQuery = useHomeH2hQueueBoard();
  const replaceWaitersFromServer = useHomeH2hBoardStore((s) => s.replaceWaitersFromServer);
  const h2hWaiters = useHomeH2hBoardStore((s) => s.waiters);

  useEffect(() => {
    if (!ENABLE_BACKEND) return;
    replaceWaitersFromServer(h2hBoardQuery.data ?? []);
  }, [h2hBoardQuery.data, replaceWaitersFromServer]);

  const h2hCarouselRows = useMemo(
    () => buildHomeH2hCarouselRows(ENABLE_BACKEND ? h2hWaiters : []),
    [h2hWaiters],
  );

  const liveLobby = useMemo(() => {
    if (!ENABLE_BACKEND || lobbyStatsQ.data == null) return null;
    const d = lobbyStatsQ.data;
    return {
      playersOnline: d.players_online,
      rewardsWalletCents24h: d.rewards_wallet_cents_24h,
      matchesLive: d.matches_in_progress,
      matchesQueued: d.matches_queued,
      tickerLines: buildTickerLinesFromLobby(d.recent_rewards, d.recent_arcade),
    };
  }, [lobbyStatsQ.data]);

  const profile = profileQ.data;
  const nextTournament = tournamentsQ.data?.[0];
  const displayName = profile?.display_name ?? profile?.username ?? 'Player';

  const homeYourStats = useMemo(() => {
    if (!ENABLE_BACKEND || !uid) {
      return [
        ['2', 'WINS', runit.neonPink],
        ['1', 'LOSSES', '#94a3b8'],
        ['3', 'STREAK', runit.neonPurple],
      ] as const;
    }
    const f = fightQ.data;
    return [
      [String(f?.wins ?? 0), 'WINS', runit.neonPink],
      [String(f?.losses ?? 0), 'LOSSES', '#94a3b8'],
      [String(f?.current_streak ?? 0), 'STREAK', runit.neonPurple],
    ] as const;
  }, [fightQ.data, uid]);

  const walletCents = useWalletDisplayCents();
  const walletDisplay = formatUsdFromCents(walletCents);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [playNowOpen, setPlayNowOpen] = useState(false);
  const [guestPrompt, setGuestPrompt] = useState<GuestAuthPromptVariant | null>(null);
  const needAccount = ENABLE_BACKEND && !uid;

  function openGuestPrompt(v: GuestAuthPromptVariant) {
    setGuestPrompt(v);
  }

  function goAddMoney() {
    if (needAccount) openGuestPrompt('wallet');
    else pushCrossTab(router, SHOP_PATH as never);
  }

  function goWalletShop() {
    if (needAccount) openGuestPrompt('wallet');
    else pushCashWalletShop(router);
  }

  function openPlayNowOrAuth() {
    if (needAccount) openGuestPrompt('play');
    else setPlayNowOpen(true);
  }

  function goNotificationSettings() {
    if (needAccount) openGuestPrompt('play');
    else pushCrossTab(router, '/(app)/(tabs)/profile/settings');
  }

  function browseLiveOrAuth() {
    if (needAccount) openGuestPrompt('play');
    else goBrowseLive();
  }

  function entryTierOrAuth(entry: number, prize: number) {
    if (needAccount) openGuestPrompt('play');
    else {
      const ec = Math.round(entry * 100);
      const pc = Math.round(prize * 100);
      pushCrossTab(
        router,
        `/(app)/(tabs)/play/casual?entryCents=${ec}&prizeCents=${pc}&entry=${encodeURIComponent(String(entry))}&prize=${encodeURIComponent(String(prize))}`,
      );
    }
  }

  function goQuickMatch() {
    const rt = encodeURIComponent('/(app)/(tabs)');
    pushCrossTab(router, `/(app)/(tabs)/play/casual?quick=1&returnTo=${rt}` as never);
  }

  function goBrowseLive() {
    const rt = encodeURIComponent('/(app)/(tabs)');
    pushCrossTab(router, `/(app)/(tabs)/play/live-matches?returnTo=${rt}` as never);
  }

  function openH2hCarouselRow(row: H2hCarouselRow) {
    if (needAccount) {
      openGuestPrompt('play');
      return;
    }
    const rt = encodeURIComponent('/(app)/(tabs)');
    if (row.activeWaiter) {
      pushCrossTab(
        router,
        `/(app)/(tabs)/play/live-matches?returnTo=${rt}&joinWaiterId=${encodeURIComponent(row.activeWaiter.id)}` as never,
      );
    } else {
      pushCrossTab(
        router,
        `/(app)/(tabs)/play/live-matches?returnTo=${rt}&pickTierGame=${encodeURIComponent(row.gameKey)}` as never,
      );
    }
  }

  function goChooseContest() {
    const rt = encodeURIComponent('/(app)/(tabs)');
    pushCrossTab(router, `/(app)/(tabs)/play/choose-contest?returnTo=${rt}` as never);
  }

  function goDailyTournament() {
    if (ENABLE_DAILY_FREE_TOURNAMENT) {
      pushCrossTab(router, '/(app)/(tabs)/tournaments/daily-free');
    } else {
      pushCrossTab(router, '/(app)/(tabs)/tournaments');
    }
  }

  function h2hIconFor(gameKey: H2hGameKey, size: number) {
    switch (gameKey) {
      case 'tap-dash':
        return <TapDashGameIcon size={size} />;
      case 'tile-clash':
        return <TileClashGameIcon size={size} />;
      case 'dash-duel':
        return <DashDuelGameIcon size={size} />;
      case 'ball-run':
        return <BallRunGameIcon size={size} />;
      case 'turbo-arena':
        return <TurboArenaGameIcon size={size} />;
      case 'neon-dance':
        return <NeonDanceGameIcon size={size} />;
      case 'neon-grid':
        return <NeonGridGameIcon size={size} />;
      case 'neon-ship':
        return <NeonShipGameIcon size={size} />;
      default:
        return <TapDashGameIcon size={size} />;
    }
  }

  function h2hGradients(gameKey: H2hGameKey): readonly [string, string] {
    const row = H2H_OPEN_GAMES_ALL.find((x) => x.gameKey === gameKey);
    const bg = row?.bgColors;
    if (bg && bg.length >= 2) return [bg[0], bg[bg.length - 1]];
    return ['#141028', '#3b2b68'];
  }

  if (isWeb) {
    return (
      <LinearGradient
        colors={[...APP_SCREEN_GRADIENT_COLORS]}
        locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
        style={styles.screenRoot}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <HomeNeonBackground />
        <SafeAreaView style={[styles.safeLaptop, { paddingTop: insets.top }]} edges={['left', 'right', 'bottom']}>
          <HomeScreenWebLaptop
            walletDisplay={walletDisplay}
            walletCents={walletCents}
            liveLobby={liveLobby}
            recentRewards={lobbyStatsQ.data?.recent_rewards ?? []}
            fightStats={fightQ.data}
            fightLoading={fightQ.isLoading}
            uid={uid}
            dailyDayKey={todaysKey}
            dailyResetCountdownHms={dailyResetCountdown}
            onWalletPress={goWalletShop}
            onAddMoney={goAddMoney}
            onPlayNow={openPlayNowOrAuth}
            onHowItWorks={() => setHowItWorksOpen(true)}
            onEnterDailyTournament={goDailyTournament}
            onBrowseLiveMatches={browseLiveOrAuth}
            onNotificationsPress={goNotificationSettings}
            h2hCarouselRows={h2hCarouselRows}
            onH2hCarouselRowPress={openH2hCarouselRow}
            h2hIconFor={h2hIconFor}
            h2hGradients={h2hGradients}
          />
        </SafeAreaView>

        <HowItWorksModal visible={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />

        <Modal visible={playNowOpen} transparent animationType="fade" onRequestClose={() => setPlayNowOpen(false)}>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setPlayNowOpen(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, { fontFamily: runitFont.black }]}>Choose how you want to play</Text>
              <Pressable
                onPress={() => {
                  setPlayNowOpen(false);
                  if (needAccount) openGuestPrompt('play');
                  else goQuickMatch();
                }}
                style={({ pressed }) => [styles.modalAction, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.modalActionMain}>
                  <View style={styles.modalActionIcon}>
                    <SafeIonicons name="flash" size={18} color={runit.neonCyan} />
                  </View>
                  <Text style={styles.modalActionTitle}>Quick Play</Text>
                </View>
                <Text style={styles.modalActionSub}>Fastest queue. We find the first available match for you.</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPlayNowOpen(false);
                  if (needAccount) openGuestPrompt('play');
                  else goChooseContest();
                }}
                style={({ pressed }) => [styles.modalAction, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.modalActionMain}>
                  <View style={styles.modalActionIcon}>
                    <SafeIonicons name="options-outline" size={18} color={runit.neonPink} />
                  </View>
                  <Text style={styles.modalActionTitle}>Start Your Own Match</Text>
                </View>
                <Text style={styles.modalActionSub}>Pick your game + contest tier, then queue for an opponent.</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <GuestAuthPromptModal
          visible={guestPrompt != null}
          variant={guestPrompt ?? 'wallet'}
          onClose={() => setGuestPrompt(null)}
        />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...APP_SCREEN_GRADIENT_COLORS]}
      locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
      style={styles.screenRoot}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <HomeNeonBackground />
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 6 },
            isWeb && styles.scrollWebDesktop,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {ENABLE_BACKEND ? (
            <View style={styles.homeAlertsStrip}>
              <Pressable
                onPress={goNotificationSettings}
                accessibilityRole="button"
                accessibilityLabel="Alerts and notifications — open settings"
                style={({ pressed }) => [styles.homeAlertsStripInner, pressed && { opacity: 0.88 }]}
              >
                <SafeIonicons name="notifications-outline" size={22} color="#e2e8f0" />
                <Text style={styles.homeAlertsStripTxt}>Match & queue alerts</Text>
                <SafeIonicons name="chevron-forward" size={18} color="rgba(226,232,240,0.45)" />
              </Pressable>
            </View>
          ) : null}
          {isWeb && !webDesktopTabs ? (
            <View style={styles.webLogoNarrowRow}>
              <Image
                source={runItArcadeLogoSource}
                style={styles.webLogoNarrowImg}
                contentFit="contain"
                accessibilityLabel="Run It Arcade"
              />
            </View>
          ) : null}
          <HomePlayHero
            liveLobby={liveLobby}
            walletDisplay={walletDisplay}
            onWalletPress={goWalletShop}
            onEntryTierPress={entryTierOrAuth}
            onQuickMatch={() => (needAccount ? openGuestPrompt('play') : goQuickMatch())}
            onHowItWorksPress={() => setHowItWorksOpen(true)}
            webStacked={isWeb}
            compactHome
          >
            <Pressable
              onPress={goAddMoney}
              accessibilityRole="button"
              accessibilityLabel="Add money — open wallet and top-up"
              style={({ pressed }) => [styles.addMoneyHeroBtn, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={['#B45309', '#D97706', '#FFD700']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addMoneyHeroGrad}
              >
                <SafeIonicons name="wallet-outline" size={18} color="#fff" />
                <Text style={styles.addMoneyHeroText}>ADD MONEY</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={openPlayNowOrAuth}
              accessibilityRole="button"
              accessibilityLabel="Play now"
              style={({ pressed }) => [styles.playNowBtn, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.playNowGrad}>
                <SafeIonicons name="flash" size={18} color="#fff" />
                <Text style={styles.playNowText}>PLAY NOW</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.liveCarouselHead}>
              <View style={styles.liveCarouselHeadLeft}>
                <Text style={[styles.liveCarouselTitle, { fontFamily: runitFont.black }]}>LIVE MATCHES</Text>
                <Pressable
                  onPress={browseLiveOrAuth}
                  accessibilityRole="button"
                  accessibilityLabel="Join a match — open live matches"
                  style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                  hitSlop={6}
                >
                  <Text style={styles.liveCarouselJoinHint}>Join a match</Text>
                </Pressable>
              </View>
              <Pressable onPress={browseLiveOrAuth} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                <Text style={styles.liveCarouselLink}>See all</Text>
              </Pressable>
            </View>
            <HomeH2hCarouselWeb
              rows={h2hCarouselRows}
              h2hIconFor={h2hIconFor}
              h2hGradients={h2hGradients}
              phoneWeb={!webDesktopTabs}
              onRowPress={openH2hCarouselRow}
            />
          </HomePlayHero>

          <View style={[styles.sectionLabel, { marginTop: 10 }]}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>
              {ENABLE_DAILY_FREE_TOURNAMENT ? 'DAILY TOURNAMENT' : 'LIVE EVENT'}
            </Text>
            {ENABLE_DAILY_FREE_TOURNAMENT ? (
              <View style={styles.homeTourneyFreePill}>
                <Text style={styles.homeTourneyFreePillTxt}>FREE · $0 ENTRY</Text>
              </View>
            ) : null}
            <View style={styles.sectionLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.dailyPress, pressed && { opacity: 0.95 }]}
            onPress={() =>
              ENABLE_DAILY_FREE_TOURNAMENT
                ? pushCrossTab(router, '/(app)/(tabs)/tournaments/daily-free')
                : pushCrossTab(router, '/(app)/(tabs)/tournaments')
            }
          >
            {ENABLE_DAILY_FREE_TOURNAMENT && isWeb ? (
              <View style={styles.dailyBannerOuter}>
                <LinearGradient
                  colors={['rgba(139,92,246,0)', 'rgba(139,92,246,0.2)', 'rgba(225,29,140,0.22)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.dailyBannerGlow}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={['#0f172a', '#0c0a12', '#0c0a12']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dailyBannerBorder}
                >
                  <View style={styles.dailyBannerInner}>
                    <View style={styles.dailyBannerTop}>
                      <View style={styles.trophyIcon} accessibilityLabel="Tournament">
                        <SafeIonicons name="trophy" size={40} color="#f9a8d4" />
                      </View>
                      <View style={styles.dailyBannerCopy}>
                        <Text style={[styles.dailyBannerHeadline, { fontFamily: runitFont.black }]}>
                          ${dailyPrizeUsd} DAILY FREE-TO-ENTER
                        </Text>
                        <Text style={styles.dailyBannerSub}>
                          Skill path · {dailyRounds} rounds · No wallet
                        </Text>
                      </View>
                      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} style={styles.joinBtnDailyBanner}>
                        <Text style={styles.joinBtnDailyBannerText}>PLAY FREE</Text>
                      </LinearGradient>
                    </View>
                    <View style={styles.dailyBannerRule} />
                    <Text style={styles.dailyBannerFoot}>
                      Resets in {dailyResetCountdown} · New bracket at local midnight · Same skill games as Arcade
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            ) : (
              <LinearGradient
                colors={
                  ENABLE_DAILY_FREE_TOURNAMENT ? [runit.neonPurple, '#5b21b6', runit.neonPink] : [runit.neonPurple, runit.neonPink]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gameBorder, ENABLE_DAILY_FREE_TOURNAMENT && styles.gameBorderDailyFree]}
              >
                <View style={ENABLE_DAILY_FREE_TOURNAMENT ? styles.tourneyCardDaily : styles.tourneyCard}>
                  <View style={styles.trophyIcon} accessibilityLabel="Tournament">
                    <SafeIonicons name="trophy" size={ENABLE_DAILY_FREE_TOURNAMENT ? 38 : 32} color="#fbcfe8" />
                  </View>
                  <View style={styles.tourneyMid}>
                    {ENABLE_DAILY_FREE_TOURNAMENT ? (
                      <>
                        <Text style={[styles.tourneyKicker, { fontFamily: runitFont.black }]}>TOURNAMENT OF THE DAY</Text>
                        <View style={styles.homeDailyChips}>
                          <View style={styles.homeDailyChip}>
                            <Text style={styles.homeDailyChipTxt}>Skill path</Text>
                          </View>
                          <View style={[styles.homeDailyChip, styles.homeDailyChipAccent]}>
                            <Text style={styles.homeDailyChipTxtAccent}>{dailyRounds} rounds</Text>
                          </View>
                          <View style={styles.homeDailyChip}>
                            <Text style={styles.homeDailyChipTxt}>No wallet</Text>
                          </View>
                        </View>
                        <View style={styles.homeDailyPrizeRow}>
                          <Text style={[styles.homeDailyPrizeUsd, { fontFamily: runitFont.black }]}>${dailyPrizeUsd}</Text>
                          <Text style={styles.homeDailyPrizeSub}>showcase prize · play free</Text>
                        </View>
                        <Text style={styles.tourneyMetaDaily}>
                          Resets in {dailyResetCountdown} · New bracket at local midnight · Same skill games as Arcade
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.tourneyTitle} numberOfLines={2}>
                          {nextTournament?.name ?? 'Daily Tournament'}
                        </Text>
                        <Text style={styles.tourneyMeta}>
                          {nextTournament
                            ? `${nextTournament.current_player_count}/${nextTournament.max_players} players · ${formatTournamentState(nextTournament.state)}`
                            : 'Open bracket'}
                        </Text>
                      </>
                    )}
                  </View>
                  <LinearGradient
                    colors={[runit.neonPink, runit.neonPurple]}
                    style={[styles.joinBtn, ENABLE_DAILY_FREE_TOURNAMENT && styles.joinBtnDailyFree]}
                  >
                    <Text style={[styles.joinBtnText, ENABLE_DAILY_FREE_TOURNAMENT && styles.joinBtnTextDailyFree]}>
                      {ENABLE_DAILY_FREE_TOURNAMENT ? 'PLAY FREE' : 'JOIN'}
                    </Text>
                  </LinearGradient>
                </View>
              </LinearGradient>
            )}
          </Pressable>

          <View style={[styles.sectionLabel, { marginTop: 18 }]}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>YOUR STATS</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.statsRow}>
            {ENABLE_BACKEND && uid && fightQ.isLoading ? (
              <Text style={styles.homeStatsLoading}>Loading your stats…</Text>
            ) : (
              homeYourStats.map(([val, lbl, col]) => (
                <LinearGradient key={lbl} colors={[col, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
                  <View style={styles.statInner}>
                    <Text style={[styles.statVal, { color: col as string }]}>{val}</Text>
                    <Text style={styles.statLbl}>{lbl}</Text>
                  </View>
                </LinearGradient>
              ))
            )}
          </View>

          <Text style={styles.statsFoot}>Hey {displayName} — climb the board this season.</Text>

          <View style={styles.seasonCard}>
            {seasonQ.isLoading ? (
              <Text style={styles.muted}>Loading season…</Text>
            ) : seasonQ.data ? (
              <>
                <Text style={styles.seasonName}>{seasonQ.data.name}</Text>
                <Text style={styles.muted}>Ends {new Date(seasonQ.data.ends_at).toLocaleDateString()}</Text>
              </>
            ) : (
              <Text style={styles.muted}>Season info loading…</Text>
            )}
          </View>

          {isWeb && webDesktopTabs ? (
            <Text style={styles.webHint}>Arcade games & prize runs live under the Arcade tab.</Text>
          ) : null}

          <View style={{ height: 36 }} />
        </ScrollView>

        <HowItWorksModal visible={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />

        <Modal visible={playNowOpen} transparent animationType="fade" onRequestClose={() => setPlayNowOpen(false)}>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setPlayNowOpen(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.modalTitle, { fontFamily: runitFont.black }]}>Choose how you want to play</Text>
              <Pressable
                onPress={() => {
                  setPlayNowOpen(false);
                  if (needAccount) openGuestPrompt('play');
                  else goQuickMatch();
                }}
                style={({ pressed }) => [styles.modalAction, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.modalActionMain}>
                  <View style={styles.modalActionIcon}>
                    <SafeIonicons name="flash" size={18} color={runit.neonCyan} />
                  </View>
                  <Text style={styles.modalActionTitle}>Quick Play</Text>
                </View>
                <Text style={styles.modalActionSub}>Fastest queue. We find the first available match for you.</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPlayNowOpen(false);
                  if (needAccount) openGuestPrompt('play');
                  else goChooseContest();
                }}
                style={({ pressed }) => [styles.modalAction, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.modalActionMain}>
                  <View style={styles.modalActionIcon}>
                    <SafeIonicons name="options-outline" size={18} color={runit.neonPink} />
                  </View>
                  <Text style={styles.modalActionTitle}>Start Your Own Match</Text>
                </View>
                <Text style={styles.modalActionSub}>Pick your game + contest tier, then queue for an opponent.</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <GuestAuthPromptModal
          visible={guestPrompt != null}
          variant={guestPrompt ?? 'wallet'}
          onClose={() => setGuestPrompt(null)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  safe: { flex: 1 },
  safeLaptop: { flex: 1, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 92 },
  scrollWebDesktop: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  homeAlertsStrip: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    marginBottom: 10,
    paddingHorizontal: 0,
  },
  homeAlertsStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  homeAlertsStripTxt: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '800',
  },
  webLogoNarrowRow: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    paddingHorizontal: 16,
    marginBottom: 6,
    marginTop: 2,
  },
  webLogoNarrowImg: { width: 168, height: 56, alignSelf: 'flex-start' },
  addMoneyHeroBtn: { marginBottom: 10 },
  addMoneyHeroGrad: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addMoneyHeroText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  playNowBtn: { marginBottom: 12 },
  playNowGrad: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playNowText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.7 },
  liveCarouselHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  liveCarouselHeadLeft: {
    flex: 1,
    marginRight: 8,
  },
  liveCarouselJoinHint: {
    marginTop: 4,
    color: runit.neonCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  liveCarouselTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  liveCarouselLink: {
    color: runit.neonCyan,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(139,92,246,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: appChromeLinePink },
  homeTourneyFreePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
  },
  homeTourneyFreePillTxt: {
    color: '#e9d5ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dailyPress: {
    marginBottom: 8,
    alignItems: 'center',
  },
  gameBorder: {
    borderRadius: 18,
    padding: 2,
    width: '94%',
    maxWidth: 420,
    alignSelf: 'center',
    shadowColor: 'rgba(225,29,140,0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
  gameBorderDailyFree: {
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.4)',
    shadowColor: 'rgba(139,92,246,0.35)',
  },
  tourneyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: 'rgba(8,4,18,0.88)' },
  tourneyCardDaily: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(8,4,18,0.88)',
  },
  trophyIcon: { justifyContent: 'center' },
  tourneyMid: { flex: 1, minWidth: 0 },
  tourneyKicker: {
    color: 'rgba(167,139,250,0.95)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  homeDailyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  homeDailyChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  homeDailyChipAccent: {
    backgroundColor: 'rgba(225,29,140,0.1)',
    borderColor: 'rgba(225,29,140,0.3)',
  },
  homeDailyChipTxt: { color: 'rgba(226,232,240,0.9)', fontSize: 10, fontWeight: '800' },
  homeDailyChipTxtAccent: { color: '#fbcfe8', fontSize: 10, fontWeight: '900' },
  homeDailyPrizeRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  homeDailyPrizeUsd: {
    color: '#fce7f3',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(225,29,140,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  homeDailyPrizeSub: { color: 'rgba(233,213,255,0.95)', fontSize: 12, fontWeight: '800' },
  tourneyTitle: { color: '#c4b5fd', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  tourneyMeta: { color: 'rgba(203,213,225,0.85)', fontSize: 12, fontWeight: '600' },
  tourneyMetaDaily: {
    color: 'rgba(203,213,225,0.9)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  joinBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  joinBtnDailyFree: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  joinBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  joinBtnTextDailyFree: { color: '#fff', fontSize: 11, letterSpacing: 0.5 },
  dailyBannerOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
    width: '94%',
    maxWidth: 420,
    alignSelf: 'center',
    shadowColor: 'rgba(139,92,246,0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 12,
  },
  dailyBannerGlow: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  dailyBannerBorder: { borderRadius: 18, padding: 2, zIndex: 1 },
  dailyBannerInner: {
    borderRadius: 16,
    backgroundColor: 'rgba(8,4,18,0.92)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  dailyBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dailyBannerCopy: { flex: 1, minWidth: 0 },
  dailyBannerHeadline: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
    lineHeight: 20,
  },
  dailyBannerSub: {
    color: 'rgba(203,213,225,0.92)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  joinBtnDailyBanner: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignSelf: 'center',
    shadowColor: 'rgba(225,29,140,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  joinBtnDailyBannerText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  dailyBannerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginTop: 10,
    marginBottom: 8,
  },
  dailyBannerFoot: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  homeStatsLoading: { flex: 1, color: 'rgba(148,163,184,0.9)', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  statGrad: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statInner: { backgroundColor: 'rgba(6,2,14,0.8)', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900' },
  statLbl: { color: 'rgba(148,163,184,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  statsFoot: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginBottom: 14, textAlign: 'center' },
  seasonCard: {
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appBorderAccentMuted,
    backgroundColor: 'rgba(8,4,18,0.7)',
  },
  seasonName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  muted: { color: 'rgba(148,163,184,0.85)', fontSize: 13 },
  webHint: {
    textAlign: 'center',
    color: 'rgba(148,163,184,0.85)',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(10,8,20,0.96)',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  modalAction: {
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingVertical: 11,
    paddingHorizontal: 10,
    minHeight: 64,
  },
  modalActionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalActionIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  modalActionTitle: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 19 },
  modalActionSub: { color: 'rgba(203,213,225,0.95)', fontSize: 11, marginLeft: 32, lineHeight: 15 },
});
