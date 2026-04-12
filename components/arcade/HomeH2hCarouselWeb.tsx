import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Narrow web (e.g. iPhone Safari): smaller card, tighter type, more next-card peek */
  phoneWeb?: boolean;
};

const AUTO_MS = 4200;
const PAUSE_AFTER_DRAG_MS = 9000;

/** Matches `app/(app)/(tabs)/index.tsx` scroll `paddingHorizontal` so cards line up with section titles. */
const SCROLL_PAD_X = 14;

export function HomeH2hCarouselWeb({
  rows,
  h2hIconFor,
  h2hGradients,
  onRowPress,
  phoneWeb = false,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const cardGap = phoneWeb ? 10 : 14;
  const cardW = phoneWeb
    ? Math.max(258, Math.min(winW - SCROLL_PAD_X - 36, 334))
    : Math.min(Math.max(winW * 0.78, 300), 560);
  const stepPx = cardW + cardGap;
  const iconSize = phoneWeb ? 44 : 52;

  const scrollRef = useRef<ScrollView>(null);
  const cardWRef = useRef(cardW);
  cardWRef.current = cardW;
  const stepRef = useRef(stepPx);
  stepRef.current = stepPx;
  const indexRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const [pageIdx, setPageIdx] = useState(0);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const step = stepRef.current;
      const i = Math.max(0, Math.min(rows.length - 1, index));
      indexRef.current = i;
      setPageIdx(i);
      scrollRef.current?.scrollTo({ x: i * step, y: 0, animated });
    },
    [rows.length],
  );

  useEffect(() => {
    indexRef.current = 0;
    setPageIdx(0);
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
      const clamped = Math.max(0, Math.min(rows.length - 1, idx));
      indexRef.current = clamped;
      setPageIdx(clamped);
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
        contentContainerStyle={[
          styles.scrollContent,
          phoneWeb && styles.scrollContentPhone,
          { paddingLeft: 0, paddingRight: SCROLL_PAD_X, gap: cardGap },
        ]}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {rows.map((row) => {
          const [c1, c2] = h2hGradients(row.gameKey);
          const hostWaiting = row.activeWaiter != null;
          const entryLbl = row.activeWaiter
            ? formatUsdFromCents(Math.round(row.activeWaiter.entryUsd * 100))
            : '—';
          const tierLine = row.activeWaiter
            ? `${row.activeWaiter.tierShortLabel.toUpperCase()} TIER`
            : 'PICK A TIER TO MATCH';
          return (
            <Pressable
              key={row.gameKey}
              style={({ pressed }) => [styles.cardShell, { width: cardW }, pressed && { opacity: 0.92 }]}
              onPress={() => onRowPress(row)}
            >
              <LinearGradient
                colors={[runit.neonPink, runit.neonPurple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gameBorder, phoneWeb && styles.gameBorderPhone]}
              >
                <LinearGradient
                  colors={[c1, c2]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.gameCard, phoneWeb && styles.gameCardPhone]}
                >
                  <View style={[styles.cardTop, phoneWeb && styles.cardTopPhone]}>
                    <View style={[styles.gameIconCol, phoneWeb && styles.gameIconColPhone]}>
                      {h2hIconFor(row.gameKey, iconSize)}
                    </View>
                    <View style={styles.gameTextCol}>
                      <Text style={[styles.gameTitle, runitTextGlowPink, phoneWeb && styles.gameTitlePhone]} numberOfLines={1}>
                        {row.title}
                      </Text>
                      {hostWaiting && row.activeWaiter ? (
                        <>
                          <Text style={[styles.hostLine, phoneWeb && styles.hostLinePhone]} numberOfLines={2}>
                            <Text style={styles.hostName}>{row.activeWaiter.hostLabel}</Text> waiting ·{' '}
                            {row.activeWaiter.postedMinutesAgo}m ago
                          </Text>
                          {row.queueTotal > 1 ? (
                            <Text style={[styles.queueRotate, phoneWeb && styles.queueRotatePhone]}>
                              {row.rotateIndex} of {row.queueTotal} in queue
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text style={[styles.hostLine, phoneWeb && styles.hostLinePhone]} numberOfLines={phoneWeb ? 3 : 2}>
                          {phoneWeb
                            ? `No search — tap to pick a tier (${MATCH_ENTRY_TIERS[0]?.shortLabel ?? 'Starter'}–${MATCH_ENTRY_TIERS[MATCH_ENTRY_TIERS.length - 1]?.shortLabel ?? 'Legend'}).`
                            : `No open search — tap to pick a tier (${MATCH_ENTRY_TIERS[0]?.shortLabel ?? 'Starter'}–${MATCH_ENTRY_TIERS[MATCH_ENTRY_TIERS.length - 1]?.shortLabel ?? 'Legend'}).`}
                        </Text>
                      )}
                      <Text style={[styles.tierTag, phoneWeb && styles.tierTagPhone]} numberOfLines={1}>
                        {tierLine}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.cardFooter, phoneWeb && styles.cardFooterPhone]}>
                    <Text style={[styles.entryLine, phoneWeb && styles.entryLinePhone]}>
                      Entry <Text style={styles.entryAmt}>{entryLbl}</Text>
                    </Text>
                    <LinearGradient
                      colors={[runit.neonPink, '#ec4899']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.joinBtn, phoneWeb && styles.joinBtnPhone]}
                    >
                      <Text style={[styles.joinBtnText, phoneWeb && styles.joinBtnTextPhone]}>
                        {hostWaiting ? 'Join' : 'Find opponent'}
                      </Text>
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
      {rows.length > 1 ? (
        <View style={[styles.dotsRow, phoneWeb && styles.dotsRowPhone]} accessibilityRole="adjustable">
          {rows.map((r, i) => (
            <View
              key={r.gameKey}
              style={[styles.dot, i === pageIdx ? styles.dotActive : styles.dotIdle, phoneWeb && styles.dotPhone]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 8,
  },
  scrollContentPhone: { paddingVertical: 6 },
  cardShell: { marginRight: 0 },
  gameBorder: {
    borderRadius: 14,
    padding: 2,
    shadowColor: 'rgba(255,0,110,0.45)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
  gameBorderPhone: {
    borderRadius: 12,
    padding: 1.5,
    shadowRadius: 12,
  },
  gameCard: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 128 },
  gameCardPhone: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    minHeight: 108,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  cardTopPhone: { gap: 9, marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  cardFooterPhone: { paddingTop: 7, gap: 8 },
  gameIconCol: { width: 56, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  gameIconColPhone: { width: 48, paddingTop: 0 },
  gameTextCol: { flex: 1, minWidth: 0 },
  gameTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3, marginBottom: 4 },
  gameTitlePhone: { fontSize: 15, marginBottom: 2 },
  hostLine: { color: 'rgba(203,213,225,0.9)', fontSize: 12, fontWeight: '600', marginBottom: 4, lineHeight: 16 },
  hostLinePhone: { fontSize: 11, lineHeight: 14, marginBottom: 3 },
  hostName: { color: '#fde68a', fontWeight: '800' },
  tierTag: {
    color: 'rgba(167,139,250,0.98)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tierTagPhone: { fontSize: 9, letterSpacing: 0.7 },
  queueRotate: { color: 'rgba(167,139,250,0.95)', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  queueRotatePhone: { fontSize: 9, marginBottom: 2 },
  entryLine: { color: 'rgba(226,232,240,0.88)', fontSize: 13, fontWeight: '700' },
  entryLinePhone: { fontSize: 12 },
  entryAmt: { color: '#fff', fontWeight: '900', fontVariant: ['tabular-nums'] },
  joinBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    minWidth: 112,
    alignItems: 'center',
  },
  joinBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
  joinBtnPhone: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 9,
    minWidth: 96,
    borderWidth: 1,
  },
  joinBtnTextPhone: { fontSize: 11, letterSpacing: 0.35 },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  dotsRowPhone: { marginTop: 8, gap: 5 },
  dot: { height: 3, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.35)' },
  dotPhone: { height: 3 },
  dotIdle: { width: 14 },
  dotActive: {
    width: 28,
    backgroundColor: 'rgba(34,211,238,0.85)',
    shadowColor: runit.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
});
