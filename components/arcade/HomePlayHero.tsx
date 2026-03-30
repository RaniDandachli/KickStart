import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { arcade } from '@/lib/arcadeTheme';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

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
  onEntryTierPress: (entry: number, prize: number) => void;
  onQuickMatch: () => void;
};

export function HomePlayHero({
  matchesLive = 23,
  prizesAwardedDemoUsd = 3920,
  playersBattling = 1284,
  matchesStarting = 42,
  walletDisplay = '$12.40',
  onEntryTierPress,
  onQuickMatch,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.walletBar}>
        <LinearGradient
          colors={[runit.neonPink, runit.neonPurple]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.walletPillOuter}
        >
          <View style={styles.walletPillInner}>
            <Ionicons name="wallet-outline" size={18} color="#FDE047" />
            <View style={styles.walletPillText}>
              <Text style={styles.walletPillLbl}>Wallet</Text>
              <Text style={styles.walletPillVal}>{walletDisplay}</Text>
            </View>
          </View>
        </LinearGradient>
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
          <Text style={styles.brandTag}>Head-to-head skill matches · 1v1 · same games as Arcade</Text>
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
        <View style={styles.statLine}>
          <Ionicons name="people-outline" size={18} color="#fb923c" />
          <Text style={styles.statTxt}>
            <Text style={styles.statNum}>{playersBattling.toLocaleString()}</Text> players online
          </Text>
        </View>
        <View style={styles.statLine}>
          <Ionicons name="trophy-outline" size={18} color="#fbbf24" />
          <Text style={styles.statTxt}>
            <Text style={styles.statNum}>${prizesAwardedDemoUsd.toLocaleString()}</Text> in prizes (demo, last 10 min)
          </Text>
        </View>
        <View style={styles.statLine}>
          <Ionicons name="timer-outline" size={18} color="#38bdf8" />
          <Text style={styles.statTxt}>
            <Text style={styles.statNum}>{matchesStarting}</Text> matches starting…
          </Text>
        </View>
        <View style={styles.statLine}>
          <Ionicons name="pulse" size={18} color="#4ADE80" />
          <Text style={styles.statTxt}>
            <Text style={styles.statNum}>{matchesLive}</Text> matches live now
          </Text>
        </View>
      </View>

      <Text style={styles.pickTier}>Choose entry level</Text>
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
                  <Text style={styles.tierLbl}>ENTRY</Text>
                  <Text style={styles.tierPrizeHint}>Prize ${tier.prize}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 20 },
  walletBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletPillOuter: {
    borderRadius: 14,
    padding: 2,
    maxWidth: '100%',
    shadowColor: 'rgba(255,0,110,0.45)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  walletPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(6,2,14,0.72)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  walletPillText: { alignItems: 'flex-start' },
  walletPillLbl: {
    color: 'rgba(226,232,240,0.85)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  walletPillVal: {
    color: '#FDE047',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  logoFrame: {
    borderRadius: 20,
    padding: 3,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: 'rgba(236,72,153,0.45)',
    overflow: 'hidden',
    shadowColor: arcade.neonMagenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  logoFrameGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  logoInner: {
    backgroundColor: 'rgba(6,13,24,0.92)',
    borderRadius: 17,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  brandRunit: {
    color: runit.neonPink,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandArcade: {
    color: runit.neonCyan,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 10,
    marginTop: -4,
  },
  brandHome: {
    marginTop: 8,
    color: arcade.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 6,
    opacity: 0.92,
  },
  logoRule: {
    marginTop: 10,
    height: 2,
    width: '46%',
    borderRadius: 2,
    backgroundColor: 'rgba(34,211,238,0.5)',
  },
  brandTag: {
    marginTop: 10,
    color: 'rgba(203,213,225,0.95)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 18,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    gap: 10,
  },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statTxt: { color: 'rgba(241,245,249,0.95)', fontSize: 13, fontWeight: '600', flex: 1 },
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
});
