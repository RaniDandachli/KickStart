import { HomeH2hCarouselWeb } from '@/components/arcade/HomeH2hCarouselWeb';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HowItWorksModal } from '@/components/arcade/HowItWorksModal';
import { H2hTierPickModal } from '@/components/arcade/H2hTierPickModal';
import { HeadToHeadPlayModal } from '@/components/arcade/HeadToHeadPlayModal';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { HomeNeonBackground } from '@/components/arcade/HomeNeonBackground';
import { HomeArcadeTierPickRow, HomePlayHero } from '@/components/arcade/HomePlayHero';
import {
    BallRunGameIcon,
    DashDuelGameIcon,
    TapDashGameIcon,
    TileClashGameIcon,
    TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { buildTickerLinesFromLobby, useHomeLobbyStats } from '@/hooks/useHomeLobbyStats';
import { useProfile } from '@/hooks/useProfile';
import { useProfileFightStats } from '@/hooks/useProfileFightStats';
import { useTournaments } from '@/hooks/useTournaments';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { pushCrossTab } from '@/lib/appNavigation';
import { H2H_OPEN_GAMES, type H2hGameKey, type H2hLobbyKind } from '@/lib/homeOpenMatches';
import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';
import { ENABLE_BACKEND, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { useHomeH2hQueueBoard } from '@/hooks/useHomeH2hQueueBoard';
import { DAILY_FREE_PRIZE_USD, DAILY_FREE_TOURNAMENT_ROUNDS } from '@/lib/dailyFreeTournament';
import { formatUsdFromCents } from '@/lib/money';
import { queryKeys } from '@/lib/queryKeys';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';
import { sortWaitersForDisplay, useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const webDesktopTabs = useWebUsesTopTabBar();
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const dailyUid = useAuthStore((s) => s.user?.id ?? 'guest');
  const dailyHydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const dailyResetCountdown = useDailyFreeResetClock(dailyUid, dailyHydrate);
  const profileQ = useProfile(uid);
  const fightQ = useProfileFightStats(uid);
  const seasonQ = useActiveSeason();
  const tournamentsQ = useTournaments(true);
  const lobbyStatsQ = useHomeLobbyStats();
  const h2hBoardQuery = useHomeH2hQueueBoard();

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
        ['2', 'WINS', runit.neonCyan],
        ['1', 'LOSSES', runit.neonPink],
        ['3', 'STREAK', runit.neonPurple],
      ] as const;
    }
    const f = fightQ.data;
    return [
      [String(f?.wins ?? 0), 'WINS', runit.neonCyan],
      [String(f?.losses ?? 0), 'LOSSES', runit.neonPink],
      [String(f?.current_streak ?? 0), 'STREAK', runit.neonPurple],
    ] as const;
  }, [fightQ.data, uid]);

  const walletCents = useWalletDisplayCents();
  const walletDisplay = formatUsdFromCents(walletCents);
  const [h2hGate, setH2hGate] = useState<{
    path: string;
    title: string;
    entryUsd: number;
    prizeUsd: number;
    gameKey: H2hGameKey;
    lobbyKind: H2hLobbyKind;
    waiterId?: string;
  } | null>(null);

  const [tierPick, setTierPick] = useState<{ title: string; gameKey: H2hGameKey; route: string } | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const waiters = useHomeH2hBoardStore((s) => s.waiters);
  const ensureOpenMatchBoard = useHomeH2hBoardStore((s) => s.ensureOpenMatchBoard);
  const replaceWaitersFromServer = useHomeH2hBoardStore((s) => s.replaceWaitersFromServer);
  const removeWaiter = useHomeH2hBoardStore((s) => s.removeWaiter);
  const tickSimulation = useHomeH2hBoardStore((s) => s.tickSimulation);

  useEffect(() => {
    if (!ENABLE_BACKEND) return;
    replaceWaitersFromServer(h2hBoardQuery.data ?? []);
  }, [ENABLE_BACKEND, h2hBoardQuery.data, replaceWaitersFromServer]);

  useEffect(() => {
    if (ENABLE_BACKEND) return;
    ensureOpenMatchBoard();
  }, [ENABLE_BACKEND, ensureOpenMatchBoard]);

  useEffect(() => {
    if (ENABLE_BACKEND) return;
    const id = setInterval(() => tickSimulation(), 12_000);
    return () => clearInterval(id);
  }, [ENABLE_BACKEND, tickSimulation]);

  const [rotateTick, setRotateTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRotateTick((t) => t + 1), 4500);
    return () => clearInterval(id);
  }, []);

  const h2hRows = useMemo(() => {
    return H2H_OPEN_GAMES.map((g) => {
      const forGame = sortWaitersForDisplay(waiters.filter((w) => w.gameKey === g.gameKey));
      const w = forGame.length ? forGame[rotateTick % forGame.length]! : null;
      const tier =
        w != null
          ? MATCH_ENTRY_TIERS[((w.tierIndex % MATCH_ENTRY_TIERS.length) + MATCH_ENTRY_TIERS.length) % MATCH_ENTRY_TIERS.length]
          : null;
      if (!w || !tier) {
        return { ...g, activeWaiter: null, queueTotal: 0, rotateIndex: 0 };
      }
      const postedMinutesAgo = Math.max(1, Math.floor((Date.now() - w.postedAt) / 60_000));
      const queueTotal = forGame.length;
      const rotateIndex = queueTotal > 0 ? (rotateTick % queueTotal) + 1 : 0;
      return {
        ...g,
        activeWaiter: {
          id: w.id,
          tierShortLabel: tier.shortLabel,
          entryUsd: tier.entry,
          prizeUsd: tier.prize,
          hostLabel: w.hostLabel,
          postedMinutesAgo,
        },
        queueTotal,
        rotateIndex,
      };
    });
  }, [waiters, rotateTick]);

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
      default:
        return <TapDashGameIcon size={size} />;
    }
  }

  function h2hGradients(gameKey: H2hGameKey): readonly [string, string] {
    switch (gameKey) {
      case 'tap-dash':
        return ['#1e1b4b', '#4c1d95'];
      case 'tile-clash':
        return ['#0f172a', '#5b21b6'];
      case 'dash-duel':
        return ['#020617', '#0c4a6e'];
      case 'ball-run':
        return ['#1a0b2e', '#831843'];
      case 'turbo-arena':
        return ['#020617', '#7c2d12'];
      default:
        return ['#1e1b4b', '#4c1d95'];
    }
  }

  return (
    <LinearGradient colors={['#06020e', '#12081f', '#0c0618', '#050208']} locations={[0, 0.35, 0.65, 1]} style={styles.screenRoot} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <StatusBar style="light" />
      <HomeNeonBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, isWeb && styles.scrollWebDesktop]}
          showsVerticalScrollIndicator={false}
        >
          <HomePlayHero
            liveLobby={liveLobby}
            walletDisplay={walletDisplay}
            onWalletPress={() => pushCrossTab(router, '/(app)/(tabs)/profile/add-funds')}
            onEntryTierPress={(entry, prize) =>
              pushCrossTab(
                router,
                `/(app)/(tabs)/play/casual?entry=${encodeURIComponent(String(entry))}&prize=${encodeURIComponent(String(prize))}`,
              )
            }
            onQuickMatch={() => pushCrossTab(router, '/(app)/(tabs)/play/casual?quick=1')}
            onHowItWorksPress={() => setHowItWorksOpen(true)}
            webStacked={isWeb}
          />

          <View style={styles.sectionLabel}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>
              {Platform.OS === 'web' ? 'LIVE MATCHES' : 'HEAD-TO-HEAD'}
            </Text>
            <View style={styles.livePill} accessibilityRole="text" accessibilityLabel="Live skill contests">
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
            <View style={styles.sectionLine} />
          </View>
          <Text style={styles.sectionSub}>
            {Platform.OS === 'web' ? (
              <>
                Real-time 1v1 queues — <Text style={styles.sectionEm}>Join</Text> matches their tier.{' '}
                <Text style={styles.sectionEm}>Find opponent</Text> picks your tier first.
              </>
            ) : (
              <>
                Live 1v1 queues per game — we show who’s waiting (rotates if several).{' '}
                <Text style={styles.sectionEm}>Join</Text> = same tier as their search.{' '}
                <Text style={styles.sectionEm}>Find opponent</Text> = pick a contest tier, then we match you.
              </>
            )}
          </Text>

          {Platform.OS === 'web' ? (
            <HomeH2hCarouselWeb
              rows={h2hRows}
              h2hIconFor={h2hIconFor}
              h2hGradients={h2hGradients}
              phoneWeb={!webDesktopTabs}
              onRowPress={(row) => {
                if (row.activeWaiter) {
                  setH2hGate({
                    path: row.route,
                    title: row.title,
                    entryUsd: row.activeWaiter.entryUsd,
                    prizeUsd: row.activeWaiter.prizeUsd,
                    gameKey: row.gameKey,
                    lobbyKind: 'host_waiting',
                    waiterId: row.activeWaiter.id,
                  });
                } else {
                  setTierPick({ title: row.title, gameKey: row.gameKey, route: row.route });
                }
              }}
            />
          ) : (
            h2hRows.map((row) => {
              const [c1, c2] = h2hGradients(row.gameKey);
              const hostWaiting = row.activeWaiter != null;
              const entryLbl = row.activeWaiter
                ? formatUsdFromCents(Math.round(row.activeWaiter.entryUsd * 100))
                : '—';
              const prizeLbl = row.activeWaiter
                ? formatUsdFromCents(Math.round(row.activeWaiter.prizeUsd * 100))
                : '—';
              return (
                <Pressable
                  key={row.gameKey}
                  style={({ pressed }) => [styles.gameWrap, pressed && { opacity: 0.9 }]}
                  onPress={() => {
                    if (row.activeWaiter) {
                      setH2hGate({
                        path: row.route,
                        title: row.title,
                        entryUsd: row.activeWaiter.entryUsd,
                        prizeUsd: row.activeWaiter.prizeUsd,
                        gameKey: row.gameKey,
                        lobbyKind: 'host_waiting',
                        waiterId: row.activeWaiter.id,
                      });
                    } else {
                      setTierPick({ title: row.title, gameKey: row.gameKey, route: row.route });
                    }
                  }}
                >
                  <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameBorder}>
                    <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gameCard}>
                      <View style={styles.gameRow}>
                        <View style={styles.gameIconCol}>{h2hIconFor(row.gameKey, 48)}</View>
                        <View style={styles.gameTextCol}>
                          <View style={styles.h2hTitleRow}>
                            <Text style={[styles.gameTitle, runitTextGlowPink]} numberOfLines={1}>
                              {row.title}
                            </Text>
                            <View style={[styles.waitingPill, hostWaiting ? styles.pillQueued : styles.pillOpenSlot]}>
                              <Text style={[styles.waitingPillTxt, hostWaiting ? styles.pillTagQueued : styles.pillTagOpen]}>
                                {hostWaiting ? 'IN QUEUE' : 'OPEN'}
                              </Text>
                            </View>
                          </View>
                          {hostWaiting && row.activeWaiter ? (
                            <>
                              <Text style={styles.hostLine} numberOfLines={2}>
                                <Text style={styles.hostName}>{row.activeWaiter.hostLabel}</Text> waiting · {row.activeWaiter.postedMinutesAgo}m ago
                              </Text>
                              {row.queueTotal > 1 ? (
                                <Text style={styles.queueRotate}>
                                  Showing {row.rotateIndex} of {row.queueTotal} in queue
                                </Text>
                              ) : null}
                              <Text style={styles.tierTag} numberOfLines={1}>
                                {row.activeWaiter.tierShortLabel} tier
                              </Text>
                              <Text style={styles.gameEntry}>
                                Entry {entryLbl} · Listed reward {prizeLbl}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.hostLine} numberOfLines={2}>
                                No open searches right now — tap to pick a contest tier and start matchmaking.
                              </Text>
                              <Text style={styles.tierTag} numberOfLines={1}>
                                Choose tier on next step
                              </Text>
                              <Text style={styles.gameEntryMuted}>Preset tiers match Quick Match</Text>
                            </>
                          )}
                        </View>
                        <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.prizeBtn}>
                          <Text style={styles.prizeBtnText}>{hostWaiting ? 'Join' : 'Find opponent'}</Text>
                        </LinearGradient>
                      </View>
                    </LinearGradient>
                  </LinearGradient>
                </Pressable>
              );
            })
          )}

          <View style={[styles.sectionLabel, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>
              {ENABLE_DAILY_FREE_TOURNAMENT && isWeb
                ? 'DAILY TOURNAMENT'
                : ENABLE_DAILY_FREE_TOURNAMENT
                  ? 'DAILY EVENT'
                  : 'LIVE EVENT'}
            </Text>
            {ENABLE_DAILY_FREE_TOURNAMENT ? (
              <View style={styles.homeTourneyFreePill}>
                <Text style={styles.homeTourneyFreePillTxt}>FREE · $0 ENTRY</Text>
              </View>
            ) : null}
            <View style={styles.sectionLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.gameWrap, pressed && { opacity: 0.9 }]}
            onPress={() =>
              ENABLE_DAILY_FREE_TOURNAMENT
                ? pushCrossTab(router, '/(app)/(tabs)/tournaments/daily-free')
                : pushCrossTab(router, '/(app)/(tabs)/tournaments')
            }
          >
            {ENABLE_DAILY_FREE_TOURNAMENT && isWeb ? (
              <View style={styles.dailyBannerOuter}>
                <LinearGradient
                  colors={['rgba(251,191,36,0)', 'rgba(245,158,11,0.35)', 'rgba(234,88,12,0.45)']}
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
                        <SafeIonicons name="trophy" size={48} color="#fbbf24" />
                      </View>
                      <View style={styles.dailyBannerCopy}>
                        <Text style={[styles.dailyBannerHeadline, { fontFamily: runitFont.black }]}>
                          ${DAILY_FREE_PRIZE_USD} DAILY FREE-TO-ENTER
                        </Text>
                        <Text style={styles.dailyBannerSub}>
                          Skill path · {DAILY_FREE_TOURNAMENT_ROUNDS} rounds · No wallet
                        </Text>
                      </View>
                      <LinearGradient colors={['#34d399', '#14b8a6', '#0d9488']} style={styles.joinBtnDailyBanner}>
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
                  ENABLE_DAILY_FREE_TOURNAMENT
                    ? ['#064e3b', '#7c3aed', '#be185d']
                    : [runit.neonPurple, runit.neonPink]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gameBorder, ENABLE_DAILY_FREE_TOURNAMENT && styles.gameBorderDailyFree]}
              >
                <View style={ENABLE_DAILY_FREE_TOURNAMENT ? styles.tourneyCardDaily : styles.tourneyCard}>
                  <View style={styles.trophyIcon} accessibilityLabel="Tournament">
                    <SafeIonicons name="trophy" size={ENABLE_DAILY_FREE_TOURNAMENT ? 44 : 34} color="#fef08a" />
                  </View>
                  <View style={styles.tourneyMid}>
                    {ENABLE_DAILY_FREE_TOURNAMENT ? (
                      <>
                        <View style={styles.homeDailyTitleRow}>
                          <Text style={[styles.tourneyKicker, { fontFamily: runitFont.black }]}>TOURNAMENT OF THE DAY</Text>
                        </View>
                        <View style={styles.homeDailyChips}>
                          <View style={styles.homeDailyChip}>
                            <Text style={styles.homeDailyChipTxt}>Skill path</Text>
                          </View>
                          <View style={[styles.homeDailyChip, styles.homeDailyChipAccent]}>
                            <Text style={styles.homeDailyChipTxtAccent}>{DAILY_FREE_TOURNAMENT_ROUNDS} rounds</Text>
                          </View>
                          <View style={styles.homeDailyChip}>
                            <Text style={styles.homeDailyChipTxt}>No wallet</Text>
                          </View>
                        </View>
                        <View style={styles.homeDailyPrizeRow}>
                          <Text style={[styles.homeDailyPrizeUsd, { fontFamily: runitFont.black }]}>${DAILY_FREE_PRIZE_USD}</Text>
                          <Text style={styles.homeDailyPrizeSub}>showcase prize · play free</Text>
                        </View>
                        <Text style={styles.tourneyMetaDaily}>
                          Resets in {dailyResetCountdown} · New bracket at local midnight · Same skill games as Arcade
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.tourneyTitle, runitTextGlowCyan]} numberOfLines={2}>
                          {nextTournament?.name ?? 'Daily Tournament'}
                        </Text>
                        <Text style={styles.tourneyMeta}>
                          {nextTournament
                            ? `${nextTournament.current_player_count}/${nextTournament.max_players} players · ${formatTournamentState(nextTournament.state)}`
                            : '18/20 players · open'}
                        </Text>
                      </>
                    )}
                  </View>
                  <LinearGradient
                    colors={ENABLE_DAILY_FREE_TOURNAMENT ? ['#34d399', '#059669'] : [runit.neonPink, runit.neonPurple]}
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

          <View style={[styles.sectionLabel, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>
              {isWeb ? 'ARCADE GAMES' : 'YOUR STATS'}
            </Text>
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
          {isWeb ? (
            <>
              <HomeArcadeTierPickRow
                onEntryTierPress={(entry, prize) =>
                  pushCrossTab(
                    router,
                    `/(app)/(tabs)/play/casual?entry=${encodeURIComponent(String(entry))}&prize=${encodeURIComponent(String(prize))}`,
                  )
                }
                webWideSnap={webDesktopTabs}
              />
              <Text style={styles.statsFoot}>Hey {displayName} — climb the board this season.</Text>
            </>
          ) : (
            <Text style={styles.statsFoot}>Hey {displayName} — climb the board this season.</Text>
          )}

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

          <View style={{ height: 32 }} />
        </ScrollView>

        <HeadToHeadPlayModal
          visible={!!h2hGate}
          gameTitle={h2hGate?.title ?? ''}
          entryUsd={h2hGate?.entryUsd ?? 0}
          prizeUsd={h2hGate?.prizeUsd ?? 0}
          lobbyKind={h2hGate?.lobbyKind ?? 'host_waiting'}
          onClose={() => setH2hGate(null)}
          onPractice={() => {
            if (!h2hGate) return;
            pushCrossTab(router, `${h2hGate.path}?mode=practice` as never);
            setH2hGate(null);
          }}
          onHeadToHeadPrize={() => {
            if (!h2hGate) return;
            if (h2hGate.waiterId) removeWaiter(h2hGate.waiterId);
            if (ENABLE_BACKEND) void queryClient.invalidateQueries({ queryKey: queryKeys.homeH2hBoard() });
            const e = encodeURIComponent(String(h2hGate.entryUsd));
            const p = encodeURIComponent(String(h2hGate.prizeUsd));
            const gk = encodeURIComponent(h2hGate.gameKey);
            pushCrossTab(router, `/(app)/(tabs)/play/casual?entry=${e}&prize=${p}&game=${gk}&intent=join` as never);
            setH2hGate(null);
          }}
        />

        <H2hTierPickModal
          visible={!!tierPick}
          gameTitle={tierPick?.title ?? ''}
          onClose={() => setTierPick(null)}
          onSelectTier={(tier) => {
            if (!tierPick) return;
            const e = encodeURIComponent(String(tier.entry));
            const p = encodeURIComponent(String(tier.prize));
            const gk = encodeURIComponent(tierPick.gameKey);
            pushCrossTab(router, `/(app)/(tabs)/play/casual?entry=${e}&prize=${p}&game=${gk}&intent=start` as never);
            setTierPick(null);
          }}
        />

        <HowItWorksModal visible={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />
      </SafeAreaView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingBottom: 100, paddingTop: 6 },
  scrollWebDesktop: { maxWidth: 1100, width: '100%', alignSelf: 'center' },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionTitle: { color: 'rgba(226,232,240,0.95)', fontSize: 13, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', textShadowColor: runit.neonCyan, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.45)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  livePillText: {
    color: '#86efac',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(157,78,237,0.45)' },
  sectionSub: { color: 'rgba(148,163,184,0.9)', fontSize: 12, fontWeight: '600', marginBottom: 12, lineHeight: 17 },
  sectionEm: { color: '#fde68a', fontWeight: '800' },
  gameWrap: { marginBottom: 10 },
  gameBorder: { borderRadius: 16, padding: 2, shadowColor: 'rgba(255,0,110,0.4)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8 },
  gameCard: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, minHeight: 80 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameIconCol: { width: 52, alignItems: 'center', justifyContent: 'center' },
  gameTextCol: { flex: 1 },
  h2hTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  gameTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.4, flexShrink: 1 },
  waitingPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillQueued: {
    backgroundColor: 'rgba(0,240,255,0.12)',
    borderColor: 'rgba(0,240,255,0.35)',
  },
  pillOpenSlot: {
    backgroundColor: 'rgba(250,204,21,0.1)',
    borderColor: 'rgba(250,204,21,0.4)',
  },
  waitingPillTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  pillTagQueued: { color: runit.neonCyan },
  pillTagOpen: { color: '#fbbf24' },
  hostLine: { color: 'rgba(203,213,225,0.88)', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  hostName: { color: '#fde68a', fontWeight: '800' },
  tierTag: {
    color: 'rgba(167,139,250,0.95)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  gameEntry: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  gameEntryMuted: { color: 'rgba(148,163,184,0.85)', fontSize: 11, fontWeight: '600' },
  queueRotate: { color: 'rgba(167,139,250,0.95)', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  prizeBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', minWidth: 90, alignItems: 'center' },
  prizeBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  tourneyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: 'rgba(8,4,18,0.88)' },
  tourneyCardDaily: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(8,4,18,0.88)',
  },
  trophyIcon: { justifyContent: 'center' },
  tourneyMid: { flex: 1 },
  tourneyKicker: {
    color: 'rgba(167,139,250,0.95)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  homeDailyPrizeRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  homeDailyPrizeUsd: {
    color: '#fef08a',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(250,204,21,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  homeDailyPrizeSub: { color: 'rgba(254,243,199,0.95)', fontSize: 13, fontWeight: '800' },
  tourneyTitle: { color: runit.neonCyan, fontSize: 16, fontWeight: '900', marginBottom: 4 },
  tourneyMeta: { color: 'rgba(203,213,225,0.85)', fontSize: 12, fontWeight: '600' },
  homeTourneyFreePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(52,211,153,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.55)',
  },
  homeTourneyFreePillTxt: {
    color: '#6ee7b7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  gameBorderDailyFree: {
    borderWidth: 2,
    borderColor: 'rgba(52,211,153,0.45)',
    shadowColor: 'rgba(52,211,153,0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
  homeDailyTitleRow: { marginBottom: 6 },
  homeDailyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  homeDailyChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  homeDailyChipAccent: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: 'rgba(52,211,153,0.4)',
  },
  homeDailyChipTxt: { color: 'rgba(226,232,240,0.9)', fontSize: 10, fontWeight: '800' },
  homeDailyChipTxtAccent: { color: '#a7f3d0', fontSize: 10, fontWeight: '900' },
  tourneyMetaDaily: {
    color: 'rgba(204,251,241,0.88)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  joinBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  joinBtnDailyFree: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  joinBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  joinBtnTextDailyFree: { color: '#042f2e', fontSize: 10, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  homeStatsLoading: { flex: 1, color: 'rgba(148,163,184,0.9)', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  statGrad: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statInner: { backgroundColor: 'rgba(6,2,14,0.8)', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900' },
  statLbl: { color: 'rgba(148,163,184,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  statsFoot: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  seasonCard: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(157,78,237,0.3)', backgroundColor: 'rgba(8,4,18,0.7)' },
  seasonName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  muted: { color: 'rgba(148,163,184,0.85)', fontSize: 13 },
  dailyBannerOuter: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
    shadowColor: 'rgba(251,191,36,0.25)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 10,
  },
  dailyBannerGlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  dailyBannerBorder: {
    borderRadius: 16,
    padding: 2,
    zIndex: 1,
  },
  dailyBannerInner: {
    borderRadius: 14,
    backgroundColor: 'rgba(8,4,18,0.92)',
    paddingVertical: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  dailyBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dailyBannerCopy: { flex: 1, minWidth: 0 },
  dailyBannerHeadline: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
    lineHeight: 22,
  },
  dailyBannerSub: {
    color: 'rgba(203,213,225,0.92)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  joinBtnDailyBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignSelf: 'center',
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  joinBtnDailyBannerText: {
    color: '#042f2e',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  dailyBannerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginTop: 14,
    marginBottom: 10,
  },
  dailyBannerFoot: {
    color: 'rgba(204,251,241,0.88)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
});
