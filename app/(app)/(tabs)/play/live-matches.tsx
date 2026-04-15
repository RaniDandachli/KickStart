import { HomeH2hCarouselWeb, type H2hCarouselRow } from '@/components/arcade/HomeH2hCarouselWeb';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { H2hTierPickModal } from '@/components/arcade/H2hTierPickModal';
import { HeadToHeadPlayModal } from '@/components/arcade/HeadToHeadPlayModal';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonDanceGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { IllustratedEmptyState } from '@/components/ui/IllustratedEmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useHomeH2hQueueBoard } from '@/hooks/useHomeH2hQueueBoard';
import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';
import { pushCrossTab } from '@/lib/appNavigation';
import { H2H_OPEN_GAMES, type H2hGameKey, type H2hLobbyKind } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { queryKeys } from '@/lib/queryKeys';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { sortWaitersForDisplay, useHomeH2hBoardStore } from '@/store/homeH2hBoardStore';

/**
 * Head-to-head browse — open searches per game (moved off Home for a calmer landing).
 */
export default function LiveMatchesScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = typeof rawReturnTo === 'string' && rawReturnTo.startsWith('/') ? rawReturnTo : undefined;
  const webDesktopTabs = useWebUsesTopTabBar();
  const isWeb = Platform.OS === 'web';
  const h2hBoardQuery = useHomeH2hQueueBoard();

  const [h2hGate, setH2hGate] = useState<{
    path: string;
    title: string;
    entryUsd: number;
    prizeUsd: number;
    gameKey: H2hGameKey;
    lobbyKind: H2hLobbyKind;
    waiterId?: string;
    entryFeeWalletCents?: number;
    listedPrizeUsdCents?: number;
  } | null>(null);

  const [tierPick, setTierPick] = useState<{ title: string; gameKey: H2hGameKey; route: string } | null>(null);

  const waiters = useHomeH2hBoardStore((s) => s.waiters);
  const replaceWaitersFromServer = useHomeH2hBoardStore((s) => s.replaceWaitersFromServer);
  const removeWaiter = useHomeH2hBoardStore((s) => s.removeWaiter);

  useEffect(() => {
    if (!ENABLE_BACKEND) return;
    replaceWaitersFromServer(h2hBoardQuery.data ?? []);
  }, [h2hBoardQuery.data, replaceWaitersFromServer]);

  /** Per-game waiter position (user-controlled carousel when a game has multiple waiters). */
  const [waiterIndexByGame, setWaiterIndexByGame] = useState<Partial<Record<H2hGameKey, number>>>({});

  const h2hRows = useMemo(() => {
    return H2H_OPEN_GAMES.map((g) => {
      const forGame = sortWaitersForDisplay(waiters.filter((w) => w.gameKey === g.gameKey));
      const queueTotal = forGame.length;
      const idxRaw = waiterIndexByGame[g.gameKey] ?? 0;
      const idx = queueTotal > 0 ? ((idxRaw % queueTotal) + queueTotal) % queueTotal : 0;
      const w = queueTotal > 0 ? forGame[idx]! : null;
      const tier =
        w != null
          ? MATCH_ENTRY_TIERS[((w.tierIndex % MATCH_ENTRY_TIERS.length) + MATCH_ENTRY_TIERS.length) % MATCH_ENTRY_TIERS.length]
          : null;
      if (!w || !tier) {
        return { ...g, activeWaiter: null, queueTotal: 0, rotateIndex: 0 };
      }
      const postedMinutesAgo = Math.max(1, Math.floor((Date.now() - w.postedAt) / 60_000));
      const rotateIndex = queueTotal > 0 ? idx + 1 : 0;
      const entryUsd = w.entryFeeWalletCents != null ? w.entryFeeWalletCents / 100 : tier.entry;
      const prizeUsd = w.listedPrizeUsdCents != null ? w.listedPrizeUsdCents / 100 : tier.prize;
      return {
        ...g,
        activeWaiter: {
          id: w.id,
          tierShortLabel: tier.shortLabel,
          entryUsd,
          prizeUsd,
          hostLabel: w.hostLabel,
          postedMinutesAgo,
          entryFeeWalletCents: w.entryFeeWalletCents,
          listedPrizeUsdCents: w.listedPrizeUsdCents,
        },
        queueTotal,
        rotateIndex,
      };
    });
  }, [waiters, waiterIndexByGame]);

  useEffect(() => {
    // Keep selected waiter index valid when queue sizes change.
    setWaiterIndexByGame((prev) => {
      const next: Partial<Record<H2hGameKey, number>> = { ...prev };
      for (const g of H2H_OPEN_GAMES) {
        const total = waiters.filter((w) => w.gameKey === g.gameKey).length;
        if (total <= 0) {
          next[g.gameKey] = 0;
          continue;
        }
        const cur = next[g.gameKey] ?? 0;
        next[g.gameKey] = ((cur % total) + total) % total;
      }
      return next;
    });
  }, [waiters]);

  const totalWaiters = waiters.length;
  const boardLoading = ENABLE_BACKEND && h2hBoardQuery.isLoading;
  const boardEmpty = ENABLE_BACKEND && !boardLoading && totalWaiters === 0;

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
      default:
        return <TapDashGameIcon size={size} />;
    }
  }

  function h2hGradients(gameKey: H2hGameKey): readonly [string, string] {
    const row = H2H_OPEN_GAMES.find((x) => x.gameKey === gameKey);
    const bg = row?.bgColors;
    if (bg && bg.length >= 2) return [bg[0], bg[bg.length - 1]];
    return ['#141028', '#3b2b68'];
  }

  function openRow(row: H2hCarouselRow) {
    if (row.activeWaiter) {
      setH2hGate({
        path: row.route,
        title: row.title,
        entryUsd: row.activeWaiter.entryUsd,
        prizeUsd: row.activeWaiter.prizeUsd,
        gameKey: row.gameKey,
        lobbyKind: 'host_waiting',
        waiterId: row.activeWaiter.id,
        entryFeeWalletCents: row.activeWaiter.entryFeeWalletCents,
        listedPrizeUsdCents: row.activeWaiter.listedPrizeUsdCents,
      });
    } else {
      setTierPick({ title: row.title, gameKey: row.gameKey, route: row.route });
    }
  }

  function shiftWaiter(gameKey: H2hGameKey, total: number, delta: number) {
    if (total <= 1) return;
    setWaiterIndexByGame((prev) => {
      const cur = prev[gameKey] ?? 0;
      const next = ((cur + delta) % total + total) % total;
      return { ...prev, [gameKey]: next };
    });
  }

  return (
    <LinearGradient colors={['#06020e', '#12081f', '#050208']} style={styles.screenRoot} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (returnTo ? router.replace(returnTo as never) : router.back())}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
          >
            <SafeIonicons name="chevron-back" size={24} color="rgba(226,232,240,0.95)" />
          </Pressable>
          <Text style={[styles.topTitle, { fontFamily: runitFont.black }]}>Live matches</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Real-time 1v1 queues — <Text style={styles.introEm}>Join</Text> matches their tier.{' '}
            <Text style={styles.introEm}>Find opponent</Text> picks your tier first.
          </Text>

          {boardLoading ? <LoadingState message="Loading live queues…" /> : null}
          {boardEmpty ? (
            <View style={{ marginBottom: 16 }}>
              <IllustratedEmptyState
                icon="people-outline"
                title="No one in queue yet"
                description="When players search for a match, they appear here by game and tier. You can still pick a game below and start matchmaking — or use Quick Match from the Arcade tab."
                primaryLabel="Go to Arcade"
                onPrimary={() => router.push('/(app)/(tabs)/play')}
                secondaryLabel="Quick Match"
                onSecondary={() => {
                  const rt = encodeURIComponent(returnTo ?? '/(app)/(tabs)/play/live-matches');
                  pushCrossTab(router, `/(app)/(tabs)/play/casual?quick=1&returnTo=${rt}` as never);
                }}
              />
            </View>
          ) : null}

          {isWeb ? (
            <HomeH2hCarouselWeb
              rows={h2hRows}
              h2hIconFor={h2hIconFor}
              h2hGradients={h2hGradients}
              phoneWeb={!webDesktopTabs}
              onRowPress={openRow}
            />
          ) : (
            h2hRows.map((row) => {
              const [c1, c2] = h2hGradients(row.gameKey);
              const hostWaiting = row.activeWaiter != null;
              const entryLbl = row.activeWaiter ? formatUsdFromCents(Math.round(row.activeWaiter.entryUsd * 100)) : '—';
              const prizeLbl = row.activeWaiter ? formatUsdFromCents(Math.round(row.activeWaiter.prizeUsd * 100)) : '—';
              return (
                <Pressable
                  key={row.gameKey}
                  style={({ pressed }) => [styles.gameWrap, pressed && { opacity: 0.9 }]}
                  onPress={() => openRow(row)}
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
                                <View style={styles.queuePickerRow}>
                                  <Pressable
                                    hitSlop={8}
                                    style={({ pressed }) => [styles.queuePickerBtn, pressed && { opacity: 0.8 }]}
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      shiftWaiter(row.gameKey, row.queueTotal, -1);
                                    }}
                                  >
                                    <SafeIonicons name="chevron-back" size={14} color="#cbd5e1" />
                                  </Pressable>
                                  <Text style={styles.queueRotate}>
                                    Opponent {row.rotateIndex}/{row.queueTotal}
                                  </Text>
                                  <Pressable
                                    hitSlop={8}
                                    style={({ pressed }) => [styles.queuePickerBtn, pressed && { opacity: 0.8 }]}
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      shiftWaiter(row.gameKey, row.queueTotal, 1);
                                    }}
                                  >
                                    <SafeIonicons name="chevron-forward" size={14} color="#cbd5e1" />
                                  </Pressable>
                                </View>
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
          <View style={{ height: 40 }} />
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
            const ec =
              h2hGate.entryFeeWalletCents != null ? h2hGate.entryFeeWalletCents : Math.round(h2hGate.entryUsd * 100);
            const pc =
              h2hGate.listedPrizeUsdCents != null ? h2hGate.listedPrizeUsdCents : Math.round(h2hGate.prizeUsd * 100);
            const centsPrefix = `entryCents=${ec}&prizeCents=${pc}&`;
            const liveReturn = returnTo
              ? `/(app)/(tabs)/play/live-matches?returnTo=${encodeURIComponent(returnTo)}`
              : '/(app)/(tabs)/play/live-matches';
            const rt = encodeURIComponent(liveReturn);
            pushCrossTab(
              router,
              `/(app)/(tabs)/play/casual?${centsPrefix}entry=${e}&prize=${p}&game=${gk}&intent=join&returnTo=${rt}` as never,
            );
            setH2hGate(null);
          }}
        />

        <H2hTierPickModal
          visible={!!tierPick}
          gameTitle={tierPick?.title ?? ''}
          onClose={() => setTierPick(null)}
          onSelectTier={(tier) => {
            if (!tierPick) return;
            const ec = Math.round(tier.entry * 100);
            const pc = Math.round(tier.prize * 100);
            const e = encodeURIComponent(String(tier.entry));
            const p = encodeURIComponent(String(tier.prize));
            const gk = encodeURIComponent(tierPick.gameKey);
            const liveReturn = returnTo
              ? `/(app)/(tabs)/play/live-matches?returnTo=${encodeURIComponent(returnTo)}`
              : '/(app)/(tabs)/play/live-matches';
            const rt = encodeURIComponent(liveReturn);
            pushCrossTab(
              router,
              `/(app)/(tabs)/play/casual?entryCents=${ec}&prizeCents=${pc}&entry=${e}&prize=${p}&game=${gk}&intent=start&returnTo=${rt}` as never,
            );
            setTierPick(null);
          }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  topTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 14, paddingBottom: 32 },
  intro: { color: 'rgba(148,163,184,0.95)', fontSize: 13, fontWeight: '600', marginBottom: 14, lineHeight: 18 },
  introEm: { color: '#e9d5ff', fontWeight: '800' },
  gameWrap: { marginBottom: 10 },
  gameBorder: {
    borderRadius: 16,
    padding: 2,
    shadowColor: 'rgba(225,29,140,0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  gameCard: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, minHeight: 80 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameIconCol: { width: 52, alignItems: 'center', justifyContent: 'center' },
  gameTextCol: { flex: 1 },
  h2hTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  gameTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.4, flexShrink: 1 },
  waitingPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  pillQueued: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.35)',
  },
  pillOpenSlot: {
    backgroundColor: 'rgba(225,29,140,0.08)',
    borderColor: 'rgba(225,29,140,0.3)',
  },
  waitingPillTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  pillTagQueued: { color: '#c4b5fd' },
  pillTagOpen: { color: '#fbcfe8' },
  hostLine: { color: 'rgba(203,213,225,0.88)', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  hostName: { color: '#e9d5ff', fontWeight: '800' },
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
  queuePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  queuePickerBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  queueRotate: { color: 'rgba(167,139,250,0.95)', fontSize: 10, fontWeight: '700' },
  prizeBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', minWidth: 90, alignItems: 'center' },
  prizeBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
