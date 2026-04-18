import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import type { H2hCarouselRow } from '@/components/arcade/HomeH2hCarouselWeb';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { ENABLE_BACKEND, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import type { HomeLobbyRecentReward } from '@/services/api/homeLobby';
import type { ProfileFightStats } from '@/services/api/profileFightStats';
import { type H2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { appBorderAccentMuted, runit, runitFont } from '@/lib/runitArcadeTheme';
import { getDailyTournamentPrizeUsd, getDailyTournamentRounds } from '@/lib/dailyFreeTournament';

const TIER_SUB =
  `${MATCH_ENTRY_TIERS[0].shortLabel} · ${MATCH_ENTRY_TIERS[MATCH_ENTRY_TIERS.length - 1].shortLabel} · Pick a tier to match`;

const RANK_COLORS = ['#fbbf24', '#38bdf8', '#2dd4bf', '#f472b6'];

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
  const palette = ['#7c3aed', '#2563eb', '#0d9488', '#db2777', '#ea580c'];
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
  h2hCarouselRows: H2hCarouselRow[];
  onH2hCarouselRowPress: (row: H2hCarouselRow) => void;
  h2hIconFor: (gameKey: H2hGameKey, size: number) => ReactNode;
  h2hGradients: (gameKey: H2hGameKey) => readonly [string, string];
};

export function HomeScreenWebLaptop({
  walletDisplay,
  walletCents,
  liveLobby,
  recentRewards,
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
  h2hCarouselRows,
  onH2hCarouselRowPress,
  h2hIconFor,
  h2hGradients,
}: HomeScreenWebLaptopProps) {
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(dailyDayKey);
  const dailyRounds = getDailyTournamentRounds(dailyDayKey);

  const paidOut = liveLobby ? formatPaidOut24h(liveLobby.rewardsWalletCents24h) : '$0';
  const matchesInFlight = liveLobby ? liveLobby.matchesLive + liveLobby.matchesQueued : 0;
  const activeGames = h2hCarouselRows.length;

  const topEarners = useMemo(() => {
    const sorted = [...recentRewards].sort((a, b) => b.cents - a.cents);
    return sorted.slice(0, 4);
  }, [recentRewards]);

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

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.max}>
        {/* Top bar — wordmark + wallet (tab strip above has Home / Events / Arcade / Prizes with icons) */}
        <View style={styles.topNav}>
          <View style={styles.brandBlock}>
            <Text style={[styles.brandRunIt, { fontFamily: runitFont.black }]}>RUN IT</Text>
            <Text style={[styles.brandArcade, { fontFamily: runitFont.black }]}>ARCADE</Text>
          </View>
          <View style={styles.navRight}>
            <Pressable
              onPress={onWalletPress}
              style={({ pressed }) => [styles.walletPill, pressed && { opacity: 0.9 }]}
            >
              <SafeIonicons name="wallet-outline" size={16} color="#94a3b8" />
              <Text style={styles.walletAmt}>{walletDisplay}</Text>
            </Pressable>
            <Pressable
              onPress={onAddMoney}
              style={({ pressed }) => [styles.addMoneyOutline, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.addMoneyOutlineTxt}>+ Add Money</Text>
            </Pressable>
          </View>
        </View>

        {/* Live status strip */}
        <View style={styles.liveStrip}>
          <View style={styles.liveStripLeft}>
            <View style={styles.liveDotRow}>
              <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.liveStripTxt}>
                {liveLobby?.playersOnline ?? 0} online
              </Text>
            </View>
            <Text style={styles.liveSep}>·</Text>
            <View style={styles.liveDotRow}>
              <View style={[styles.dot, { backgroundColor: '#94a3b8' }]} />
              <Text style={styles.liveStripTxt}>
                {liveLobby?.matchesQueued ?? 0} starting
              </Text>
            </View>
            <Text style={styles.liveSep}>·</Text>
            <View style={styles.liveDotRow}>
              <View style={[styles.dot, { backgroundColor: runit.neonPink }]} />
              <Text style={styles.liveStripTxt}>
                {liveLobby?.matchesLive ?? 0} live matches
              </Text>
            </View>
          </View>
          <Text style={styles.liveStripReward}>
            {formatUsdFromCents(liveLobby?.rewardsWalletCents24h ?? 0)} rewards · 24h
          </Text>
        </View>

        {/* Hero */}
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <View style={styles.kickerRow}>
              <View style={styles.kickerLine} />
              <Text style={styles.kicker}>SKILL-BASED COMPETITION</Text>
            </View>
            <Text style={[styles.heroHeadline, { fontFamily: runitFont.black }]}>
              COMPETE. WIN <Text style={styles.heroReal}>REAL</Text> MONEY.
            </Text>
            <Text style={styles.heroSub}>
              1v1 matchups. Tiered entry. Same games as Arcade. Prizes scale with skill level.
            </Text>
            <View style={styles.heroBtns}>
              <Pressable
                onPress={onPlayNow}
                style={({ pressed }) => [styles.btnPlay, pressed && { opacity: 0.92 }]}
              >
                <SafeIonicons name="play" size={18} color="#fff" />
                <Text style={styles.btnPlayTxt}>Play Now</Text>
              </Pressable>
              <Pressable
                onPress={onHowItWorks}
                style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.btnGhostTxt}>How it works</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={onEnterDailyTournament}
            style={({ pressed }) => [styles.tourneyCardOuter, pressed && { opacity: 0.96 }]}
          >
            <LinearGradient
              colors={['#1a0b2e', '#12081f', '#0c0618']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tourneyCard}
            >
              <View style={styles.dailyHeadRow}>
                <View style={styles.dailyBadge}>
                  <Text style={styles.dailyBadgeTxt}>DAILY TOURNAMENT</Text>
                </View>
                <Text style={styles.dailyPrizeAmt}>${dailyPrizeUsd}</Text>
              </View>
              <View style={styles.countdownRow}>
                <View style={styles.countBox}>
                  <Text style={styles.countNum}>{hh}</Text>
                  <Text style={styles.countLbl}>HR</Text>
                </View>
                <Text style={styles.countSep}>:</Text>
                <View style={styles.countBox}>
                  <Text style={styles.countNum}>{mm}</Text>
                  <Text style={styles.countLbl}>MIN</Text>
                </View>
                <Text style={styles.countSep}>:</Text>
                <View style={styles.countBox}>
                  <Text style={styles.countNum}>{ss}</Text>
                  <Text style={styles.countLbl}>SEC</Text>
                </View>
              </View>
              <Text style={styles.tourneyFoot}>
                {ENABLE_DAILY_FREE_TOURNAMENT ? 'Free to enter · ' : ''}Skill path · {dailyRounds}{' '}
                rounds. New bracket at local midnight.
              </Text>
              <View style={styles.tourneyChips}>
                <View style={styles.miniChip}>
                  <SafeIonicons name="person-outline" size={12} color="#94a3b8" />
                  <Text style={styles.miniChipTxt}>Open entry</Text>
                </View>
                <View style={styles.miniChip}>
                  <SafeIonicons name="time-outline" size={12} color="#94a3b8" />
                  <Text style={styles.miniChipTxt}>No wallet needed</Text>
                </View>
              </View>
              <View style={styles.enterRow}>
                <Text style={styles.enterBtnTxt}>
                  {ENABLE_DAILY_FREE_TOURNAMENT ? 'Enter Free →' : 'View events →'}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Stat bar */}
        <View style={styles.statBar}>
          <View style={styles.statBarItem}>
            <Text style={[styles.statBarVal, { fontFamily: runitFont.black }]}>{paidOut}</Text>
            <Text style={styles.statBarLbl}>PAID OUT · 24H</Text>
          </View>
          <View style={styles.statBarItem}>
            <Text style={[styles.statBarVal, { fontFamily: runitFont.black }]}>
              {matchesInFlight}
            </Text>
            <Text style={styles.statBarLbl}>LIVE + QUEUED</Text>
          </View>
          <View style={styles.statBarItem}>
            <Text style={[styles.statBarVal, { fontFamily: runitFont.black }]}>{activeGames}</Text>
            <Text style={styles.statBarLbl}>ACTIVE GAMES</Text>
          </View>
        </View>

        {/* Live matches */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>LIVE MATCHES</Text>
          <Pressable onPress={onBrowseLiveMatches} hitSlop={6}>
            <Text style={styles.sectionLink}>See all →</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.liveCardsScroll}
        >
          {h2hCarouselRows.map((row) => {
            const grad = h2hGradients(row.gameKey);
            const highlight = row.gameKey === 'tap-dash';
            const hostWaiting = row.activeWaiter != null;
            const cardStyle: ViewStyle[] = [styles.gameCard];
            if (highlight) {
              cardStyle.push(styles.gameCardHighlight);
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
                <LinearGradient colors={[grad[0], grad[1]]} style={styles.gameCardGrad}>
                  <View style={styles.gameCardTop}>
                    {h2hIconFor(row.gameKey, 40)}
                    <View style={styles.gameCardTitles}>
                      <Text style={styles.gameTitle}>{row.title}</Text>
                      <Text style={styles.gameSub} numberOfLines={2}>
                        {subLine}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.gameCardBottom}>
                    {highlight && !hostWaiting ? (
                      <View style={styles.priceDash}>
                        <SafeIonicons name="flash" size={18} color="#4ade80" />
                      </View>
                    ) : (
                      <Text style={styles.priceTxt}>{formatUsdFromCents(entryCents)}</Text>
                    )}
                    <View style={styles.findOppBtn}>
                      <Text style={styles.findOppTxt}>{hostWaiting ? 'Join' : 'Find Opponent'}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Two columns */}
        <View style={styles.twoCol}>
          <View style={styles.panel}>
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
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, { fontFamily: runitFont.black }]}>
              TOP EARNERS · 24H
            </Text>
            {topEarners.length === 0 ? (
              <Text style={styles.panelMuted}>No recent payouts yet. Be the first on the board.</Text>
            ) : (
              topEarners.map((r, i) => (
                <View key={`${r.username}-${r.created_at}`} style={styles.leaderRow}>
                  <Text style={[styles.leaderRank, { color: RANK_COLORS[i % RANK_COLORS.length] }]}>
                    {i + 1}
                  </Text>
                  <View style={[styles.leaderAvatar, { backgroundColor: avatarColor(i) }]}>
                    <Text style={styles.leaderAvTxt}>{initialsFromUsername(r.username)}</Text>
                  </View>
                  <Text style={styles.leaderName} numberOfLines={1}>
                    {r.username}
                  </Text>
                  <Text style={styles.leaderAmt}>+{formatUsdFromCents(r.cents)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.scrollHint}>
          <View style={styles.scrollCircle}>
            <SafeIonicons name="chevron-down" size={18} color="#94a3b8" />
          </View>
        </View>
        <View style={{ height: 48 }} />
      </View>
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
    alignItems: 'center',
  },
  max: {
    width: '100%',
    maxWidth: 1200,
    paddingHorizontal: 32,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 16,
    paddingTop: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(139,92,246,0.75)',
    backgroundColor: 'rgba(6,2,14,0.35)',
    borderRadius: 12,
  },
  brandBlock: { minWidth: 100 },
  brandRunIt: {
    color: '#f8fafc',
    fontSize: 13,
    letterSpacing: 1.2,
    lineHeight: 16,
  },
  brandArcade: {
    color: runit.neonPink,
    fontSize: 17,
    letterSpacing: 1.4,
    lineHeight: 20,
  },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
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
    marginBottom: 28,
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
    gap: 28,
    marginBottom: 36,
  },
  heroLeft: { flex: 1, minWidth: 280, justifyContent: 'center' },
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
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.2)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  btnPlayTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.35)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  btnGhostTxt: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  tourneyCardOuter: {
    width: 380,
    maxWidth: '42%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignSelf: 'center',
  },
  tourneyCard: {
    padding: 20,
    borderRadius: 18,
  },
  dailyHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  dailyBadge: {
    backgroundColor: 'rgba(225,29,140,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,110,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dailyBadgeTxt: {
    color: runit.neonPink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dailyPrizeAmt: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
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
  enterRow: {
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  enterBtnTxt: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  statBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 36,
    paddingHorizontal: 8,
    gap: 16,
  },
  statBarItem: { flex: 1, alignItems: 'center' },
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
  },
  sectionTitle: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sectionLink: {
    color: runit.neonCyan,
    fontSize: 13,
    fontWeight: '800',
  },
  liveCardsScroll: {
    gap: 14,
    paddingBottom: 8,
    paddingRight: 8,
  },
  gameCard: {
    width: 260,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  gameCardHighlight: {
    borderWidth: 2,
    borderColor: 'rgba(225,29,140,0.75)',
    shadowColor: 'rgba(255,0,110,0.45)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
  gameCardGrad: {
    padding: 14,
    minHeight: 168,
    justifyContent: 'space-between',
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
  twoCol: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
    alignItems: 'stretch',
  },
  panel: {
    flex: 1,
    backgroundColor: 'rgba(8,4,18,0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appBorderAccentMuted,
    padding: 18,
    minHeight: 200,
  },
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
  scrollHint: { alignItems: 'center', marginTop: 24 },
  scrollCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
