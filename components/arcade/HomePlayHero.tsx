import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { arcade } from '@/lib/arcadeTheme';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

const WINNER_ROTATION_MS = 3800;

const RECENT_WINNERS_LOOP = [
  { name: 'Alex', amount: 38, mins: 2 },
  { name: 'Maya', amount: 19, mins: 5 },
  { name: 'Jordan', amount: 95, mins: 8 },
  { name: 'Sam', amount: 12, mins: 12 },
  { name: 'Riley', amount: 47, mins: 3 },
  { name: 'Casey', amount: 22, mins: 6 },
] as const;

const TIER_PANEL_STYLES = [
  { rotate: '-3deg', colors: ['#0f766e', '#14b8a6', '#5eead4'] as const, shadow: '#2dd4bf', iconColor: '#ecfdf5' },
  { rotate: '2deg', colors: ['#1e40af', '#2563eb', '#38bdf8'] as const, shadow: '#38bdf8', iconColor: '#eff6ff' },
  { rotate: '-2deg', colors: ['#7c3aed', '#8b5cf6', '#a78bfa'] as const, shadow: '#a78bfa', iconColor: '#f5f3ff' },
  { rotate: '3deg', colors: ['#86198f', '#c026d3', '#e879f9'] as const, shadow: '#e879f9', iconColor: '#fdf4ff' },
  { rotate: '-2deg', colors: ['#b45309', '#d97706', '#fbbf24'] as const, shadow: '#fbbf24', iconColor: '#fffbeb' },
  { rotate: '2deg', colors: ['#be123c', '#e11d48', '#fb7185'] as const, shadow: '#fb7185', iconColor: '#fff1f2' },
] as const;

type Props = {
  matchesLive?: number;
  prizesAwardedDemoUsd?: number;
  playersBattling?: number;
  matchesStarting?: number;
  walletDisplay?: string;
  /** Opens add-funds / wallet top-up when the wallet pill is pressed. */
  onWalletPress?: () => void;
  onEntryTierPress: (entry: number, prize: number) => void;
  onQuickMatch: () => void;
};

export function HomePlayHero({
  matchesLive = 23,
  prizesAwardedDemoUsd = 3920,
  playersBattling = 1284,
  matchesStarting = 42,
  walletDisplay = '$12.40',
  onWalletPress,
  onEntryTierPress,
  onQuickMatch,
}: Props) {
  const [winnerIdx, setWinnerIdx] = useState(0);
  const tickOpacity = useRef(new Animated.Value(1)).current;
  const skipFirstWinnerAnim = useRef(true);

  useEffect(() => {
    const id = setInterval(() => {
      setWinnerIdx((i) => (i + 1) % RECENT_WINNERS_LOOP.length);
    }, WINNER_ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (skipFirstWinnerAnim.current) {
      skipFirstWinnerAnim.current = false;
      return;
    }
    tickOpacity.setValue(0.35);
    Animated.timing(tickOpacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [winnerIdx, tickOpacity]);

  const w = RECENT_WINNERS_LOOP[winnerIdx];
  const winnerLine = `${w.name} earned $${w.amount} reward · ${w.mins} min ago`;

  const walletPill = (
    <LinearGradient
      colors={[runit.neonPink, runit.neonPurple]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.walletPillOuter}
    >
      <View style={styles.walletPillInner}>
        <Ionicons name="wallet-outline" size={14} color="#FDE047" />
        <Text style={styles.walletPillCompact}>
          Wallet <Text style={styles.walletPillVal}>{walletDisplay}</Text>
        </Text>
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.root}>
      <View style={styles.topBand}>
        <Animated.View style={[styles.winnerTicker, { opacity: tickOpacity }]} accessibilityLiveRegion="polite">
          <View style={styles.winnerTickerRow}>
            <Ionicons name="trophy" size={14} color="#fbbf24" />
            <Text style={styles.winnerTickerText} numberOfLines={1}>
              {winnerLine}
            </Text>
          </View>
        </Animated.View>
        <View style={styles.walletSlot}>
          {onWalletPress ? (
            <Pressable onPress={onWalletPress} accessibilityRole="button" accessibilityLabel="Add funds to wallet">
              {({ pressed }) => <View style={pressed ? { opacity: 0.88 } : undefined}>{walletPill}</View>}
            </Pressable>
          ) : (
            walletPill
          )}
        </View>
      </View>

      <View style={styles.logoFrame}>
        <LinearGradient
          colors={['rgba(34,211,238,0.35)', 'rgba(236,72,153,0.25)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoFrameGrad}
        />
        <View style={styles.logoInner}>
          <Text style={[styles.brandRunit, { fontFamily: runitFont.black }, runitTextGlowPink]}>RUN IT</Text>
          <Text style={[styles.brandArcade, { fontFamily: runitFont.black }, runitTextGlowCyan]}>ARCADE</Text>
          <View style={styles.logoRule} />
          <Text style={styles.brandHome}>HOME</Text>
          <Text style={styles.brandTag}>1v1 skill contests · prizes set by tier · same games as Arcade</Text>
        </View>
      </View>

      <Pressable
        onPress={onQuickMatch}
        style={({ pressed }) => [styles.quickOuter, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
      >
        <LinearGradient colors={['#0369a1', '#0ea5e9', '#38bdf8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickGrad}>
          <Ionicons name="flash" size={26} color="#FFFBEB" />
          <Text style={styles.quickTitle}>QUICK MATCH</Text>
        </LinearGradient>
      </Pressable>
      <Text style={styles.heroTag}>Find a match in seconds</Text>

      <View style={styles.statsPanel}>
        <View style={styles.statsRow2}>
          <View style={styles.statCell}>
            <View style={styles.statRowInline}>
              <Ionicons name="people" size={13} color="#4ade80" />
              <Text style={styles.statTxtSm} numberOfLines={1}>
                <Text style={styles.statNum}>{playersBattling.toLocaleString()}</Text> online
              </Text>
            </View>
          </View>
          <View style={styles.statCell}>
            <View style={styles.statRowInline}>
              <Ionicons name="cash-outline" size={13} color="#FDE047" />
              <Text style={styles.statTxtSm} numberOfLines={1}>
                <Text style={styles.statNum}>${(prizesAwardedDemoUsd / 1000).toFixed(1)}k</Text> rewards · 10m
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow2}>
          <View style={styles.statCell}>
            <View style={styles.statRowInline}>
              <Ionicons name="flame" size={13} color="#fb923c" />
              <Text style={styles.statTxtSm} numberOfLines={1}>
                <Text style={styles.statNum}>{matchesStarting}</Text> starting
              </Text>
            </View>
          </View>
          <View style={styles.statCell}>
            <View style={styles.statRowInline}>
              <Ionicons name="flash" size={13} color={runit.neonCyan} />
              <Text style={styles.statTxtSm} numberOfLines={1}>
                <Text style={styles.statNum}>{matchesLive}</Text> live
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.pickTier}>Choose contest tier</Text>
      <View style={styles.tiersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tiersScroll}
          style={styles.tiersScrollView}
        >
          {MATCH_ENTRY_TIERS.map((tier, i) => {
            const v = TIER_PANEL_STYLES[i] ?? TIER_PANEL_STYLES[0];
            return (
              <Pressable
                key={tier.entry}
                onPress={() => onEntryTierPress(tier.entry, tier.prize)}
                style={({ pressed }) => [
                  styles.tierOuter,
                  {
                    transform: [{ rotate: v.rotate }, ...(pressed ? [{ scale: 0.97 }] : [])],
                  },
                ]}
              >
                <LinearGradient
                  colors={[...v.colors]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.tierInner, { shadowColor: v.shadow }]}
                >
                  <View style={styles.tierIconCircle}>
                    <Ionicons name={tier.icon} size={22} color={v.iconColor} />
                  </View>
                  <Text style={styles.tierShort}>{tier.shortLabel.toUpperCase()}</Text>
                  <Text style={styles.tierUsd}>${tier.entry}</Text>
                  <Text style={styles.tierLbl}>FEE</Text>
                  <Text style={styles.tierPrizeHint}>Prize ${tier.prize}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Text style={styles.complianceHint}>
        Your entry covers access to a skill contest. Prizes are fixed by tier, awarded by Run It, and not pooled with other
        players&apos; fees.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 20 },
  topBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: -2,
  },
  winnerTicker: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(8,4,18,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.28)',
  },
  winnerTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  winnerTickerText: {
    flex: 1,
    minWidth: 0,
    color: 'rgba(226,232,240,0.92)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  walletSlot: { flexShrink: 0 },
  walletPillOuter: {
    borderRadius: 11,
    padding: 1.5,
    maxWidth: '100%',
    shadowColor: 'rgba(255,0,110,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  walletPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,2,14,0.72)',
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  walletPillCompact: {
    color: 'rgba(226,232,240,0.88)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  walletPillVal: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  logoFrame: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.4)',
    overflow: 'hidden',
    shadowColor: arcade.neonMagenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  logoFrameGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  logoInner: {
    backgroundColor: 'rgba(6,13,24,0.92)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  brandRunit: {
    color: runit.neonPink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  brandArcade: {
    color: runit.neonCyan,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: -3,
  },
  brandHome: {
    marginTop: 5,
    color: arcade.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 4,
    opacity: 0.92,
  },
  logoRule: {
    marginTop: 6,
    height: 1,
    width: '40%',
    borderRadius: 1,
    backgroundColor: 'rgba(34,211,238,0.45)',
  },
  brandTag: {
    marginTop: 6,
    color: 'rgba(203,213,225,0.9)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  quickOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'rgba(56,189,248,0.85)',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  quickGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  quickTitle: {
    color: '#FFFBEB',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroTag: {
    textAlign: 'center',
    color: '#FDE047',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statsPanel: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(15,23,42,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    gap: 6,
  },
  statsRow2: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, minWidth: 0 },
  statRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
  },
  statTxtSm: { color: 'rgba(241,245,249,0.92)', fontSize: 10, fontWeight: '600', lineHeight: 14 },
  statNum: { fontWeight: '900', color: arcade.white },
  pickTier: {
    color: arcade.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  tiersWrap: {
    paddingTop: 0,
  },
  tiersScrollView: { marginHorizontal: -4 },
  tiersScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  tierOuter: {
    width: 104,
    borderRadius: 14,
    overflow: 'visible',
  },
  tierInner: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  tierIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 6,
  },
  tierShort: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tierUsd: {
    color: '#FFFBEB',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tierLbl: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  tierPrizeHint: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  complianceHint: {
    marginTop: 10,
    paddingHorizontal: 4,
    color: 'rgba(148,163,184,0.88)',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
});
