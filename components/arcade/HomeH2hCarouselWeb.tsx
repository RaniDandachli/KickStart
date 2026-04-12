import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import type { H2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export type H2hCarouselRow = {
  gameKey: H2hGameKey;
  title: string;
  route: string;
  activeWaiter: null | {
    id: string;
    tierShortLabel: string;
    entryUsd: number;
    prizeUsd: number;
    hostLabel: string;
    postedMinutesAgo: number;
  };
  queueTotal: number;
  rotateIndex: number;
};

type Props = {
  rows: H2hCarouselRow[];
  h2hIconFor: (gameKey: H2hGameKey, size: number) => ReactNode;
  h2hGradients: (gameKey: H2hGameKey) => readonly [string, string];
  onRowPress: (row: H2hCarouselRow) => void;
};

/**
 * Desktop web: horizontal snap carousel for H2H games (VAZA-style peek).
 */
const AUTO_MS = 4200;
const PAUSE_AFTER_DRAG_MS = 9000;

export function HomeH2hCarouselWeb({ rows, h2hIconFor, h2hGradients, onRowPress }: Props) {
  const { width: winW } = useWindowDimensions();
  const cardW = Math.min(Math.max(winW * 0.78, 300), 560);
  const sidePad = Math.max(12, (winW - cardW) / 2);
  const stepPx = cardW + 14;

  const scrollRef = useRef<ScrollView>(null);
  const cardWRef = useRef(cardW);
  cardWRef.current = cardW;
  const stepRef = useRef(stepPx);
  stepRef.current = stepPx;
  const indexRef = useRef(0);
  const pausedUntilRef = useRef(0);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const step = stepRef.current;
      const i = Math.max(0, Math.min(rows.length - 1, index));
      indexRef.current = i;
      scrollRef.current?.scrollTo({ x: i * step, y: 0, animated });
    },
    [rows.length],
  );

  useEffect(() => {
    indexRef.current = 0;
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [stepPx, rows.length]);

  useEffect(() => {
    if (rows.length <= 1) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const next = (indexRef.current + 1) % rows.length;
      scrollToIndex(next, true);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [rows.length, scrollToIndex]);

  const onScrollBeginDrag = useCallback(() => {
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_DRAG_MS;
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const step = stepRef.current;
      if (step <= 0) return;
      const idx = Math.round(x / step);
      indexRef.current = Math.max(0, Math.min(rows.length - 1, idx));
    },
    [rows.length],
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stepPx}
        snapToAlignment="start"
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: sidePad }]}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {rows.map((row) => {
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
              style={({ pressed }) => [styles.cardShell, { width: cardW }, pressed && { opacity: 0.92 }]}
              onPress={() => onRowPress(row)}
            >
              <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameBorder}>
                <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gameCard}>
                  <View style={styles.gameRow}>
                    <View style={styles.gameIconCol}>{h2hIconFor(row.gameKey, 56)}</View>
                    <View style={styles.gameTextCol}>
                      <View style={styles.h2hTitleRow}>
                        <Text style={[styles.gameTitle, runitTextGlowPink]} numberOfLines={2}>
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
                          <Text style={styles.hostLine} numberOfLines={3}>
                            <Text style={styles.hostName}>{row.activeWaiter.hostLabel}</Text> waiting ·{' '}
                            {row.activeWaiter.postedMinutesAgo}m ago
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
                          <Text style={styles.hostLine} numberOfLines={3}>
                            No open searches — tap to pick a contest tier ({MATCH_ENTRY_TIERS[0]?.shortLabel ?? 'Starter'}–
                            {MATCH_ENTRY_TIERS[MATCH_ENTRY_TIERS.length - 1]?.shortLabel ?? 'Legend'}) and matchmake.
                          </Text>
                          <Text style={styles.tierTag} numberOfLines={1}>
                            Choose tier on next step
                          </Text>
                          <Text style={styles.gameEntryMuted}>Preset tiers match Quick Match</Text>
                        </>
                      )}
                    </View>
                    <LinearGradient
                      colors={[runit.neonPink, runit.neonPurple]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.prizeBtn}
                    >
                      <Text style={styles.prizeBtnText}>{hostWaiting ? 'Join' : 'Find opponent'}</Text>
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>
        {rows.length > 1
          ? 'Auto-cycles through games — swipe anytime · same tiers as Quick Match'
          : 'Same tiers as Quick Match'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 8,
    gap: 14,
  },
  cardShell: { marginRight: 0 },
  gameBorder: {
    borderRadius: 18,
    padding: 2,
    shadowColor: 'rgba(255,0,110,0.45)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
  gameCard: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, minHeight: 120 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gameIconCol: { width: 58, alignItems: 'center', justifyContent: 'center' },
  gameTextCol: { flex: 1, minWidth: 0 },
  h2hTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  gameTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.3, flexShrink: 1 },
  waitingPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
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
  waitingPillTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  pillTagQueued: { color: runit.neonCyan },
  pillTagOpen: { color: '#fbbf24' },
  hostLine: { color: 'rgba(203,213,225,0.9)', fontSize: 12, fontWeight: '600', marginBottom: 4, lineHeight: 16 },
  hostName: { color: '#fde68a', fontWeight: '800' },
  tierTag: {
    color: 'rgba(167,139,250,0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  gameEntry: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700' },
  gameEntryMuted: { color: 'rgba(148,163,184,0.88)', fontSize: 12, fontWeight: '600' },
  queueRotate: { color: 'rgba(167,139,250,0.95)', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  prizeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.32)',
    minWidth: 100,
    alignItems: 'center',
    alignSelf: 'center',
  },
  prizeBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  hint: {
    textAlign: 'center',
    color: 'rgba(148,163,184,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
});
