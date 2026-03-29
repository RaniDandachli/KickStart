import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ARCADE_STAKE_TIERS } from '@/components/arcade/stakeTiers';
import { arcade } from '@/lib/arcadeTheme';

type Props = {
  /** Demo / live stats — replace with API later */
  matchesLive?: number;
  wonTodayUsd?: number;
  walletUsdLabel?: string;
  playersOnline?: number;
  searchingCount?: number;
  searchingStakeUsd?: number;
  onStakePress: (entry: number, win: number) => void;
  onQuickMatch: () => void;
};

export function HomePlayHero({
  matchesLive = 23,
  wonTodayUsd = 1240,
  walletUsdLabel = '12.40',
  playersOnline = 1284,
  searchingCount = 3,
  searchingStakeUsd = 5,
  onStakePress,
  onQuickMatch,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.modeHeadline}>Cash matches</Text>
      <Text style={styles.modeSub}>Real money 1v1 — Tap Dash, Tile Clash & Dash Duel</Text>

      {/* 1. Live activity strip */}
      <View style={styles.liveBar}>
        <View style={styles.liveItem}>
          <Ionicons name="flame" size={14} color="#4ADE80" />
          <Text style={styles.liveText}>
            <Text style={styles.liveStrong}>{matchesLive}</Text> matches live
          </Text>
        </View>
        <Text style={styles.dot}>•</Text>
        <View style={styles.liveItem}>
          <Ionicons name="cash" size={14} color="#FDE047" />
          <Text style={styles.liveText}>
            <Text style={styles.liveStrong}>${wonTodayUsd.toLocaleString()}</Text> won today
          </Text>
        </View>
      </View>

      {/* Wallet */}
      <View style={styles.walletRow}>
        <Text style={styles.walletLabel}>Wallet</Text>
        <Text style={styles.walletVal}>${walletUsdLabel}</Text>
      </View>

      {/* 2. Stake CTAs */}
      <Text style={styles.heroKicker}>Start match</Text>
      <View style={styles.stakesRow}>
        {ARCADE_STAKE_TIERS.map((tier) => (
          <Pressable
            key={tier.entry}
            onPress={() => onStakePress(tier.entry, tier.win)}
            style={({ pressed }) => [styles.stakeOuter, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={['#0d9488', '#14b8a6', '#0f766e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.stakeInner}
            >
              <Text style={styles.stakeUsd}>${tier.entry}</Text>
              <Text style={styles.stakeLbl}>MATCH</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      {/* Quick match */}
      <Pressable onPress={onQuickMatch} style={({ pressed }) => [styles.quickOuter, pressed && styles.pressed]}>
        <LinearGradient colors={['#22D3EE', '#0891B2', '#0E7490']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickGrad}>
          <View style={styles.quickLeft}>
            <Ionicons name="flash" size={22} color="#FFFBEB" />
            <View>
              <Text style={styles.quickTitle}>QUICK MATCH</Text>
              <Text style={styles.quickSub}>Find opponent instantly</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </Pressable>

      {/* 3. Presence */}
      <View style={styles.presence}>
        <View style={styles.presenceRow}>
          <Ionicons name="people" size={16} color="rgba(148,163,184,0.95)" />
          <Text style={styles.presenceText}>
            <Text style={styles.presenceStrong}>{playersOnline.toLocaleString()}</Text> players online
          </Text>
        </View>
        <View style={styles.presenceRow}>
          <Ionicons name="search" size={16} color="rgba(148,163,184,0.95)" />
          <Text style={styles.presenceText}>
            <Text style={styles.presenceStrong}>{searchingCount}</Text> searching for ${searchingStakeUsd} match
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modeHeadline: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  modeSub: {
    color: 'rgba(203, 213, 225, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  wrap: {
    marginBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
    backgroundColor: 'rgba(6, 13, 24, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: -4,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  liveItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveText: { color: 'rgba(226, 232, 240, 0.92)', fontSize: 12, fontWeight: '600' },
  liveStrong: { fontWeight: '900', color: arcade.white },
  dot: { color: 'rgba(148, 163, 184, 0.6)', fontSize: 12 },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
  },
  walletLabel: { color: arcade.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  walletVal: { color: '#4ADE80', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  heroKicker: {
    color: 'rgba(226, 232, 240, 0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  stakesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  stakeOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  stakeInner: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stakeUsd: {
    color: '#FFFBEB',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  stakeLbl: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 3,
    opacity: 0.98,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  quickOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  quickLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  quickTitle: {
    color: '#FFFBEB',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  quickSub: {
    color: 'rgba(255, 251, 235, 0.88)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  presence: { gap: 8 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  presenceText: { color: 'rgba(203, 213, 225, 0.95)', fontSize: 12, fontWeight: '600', flex: 1 },
  presenceStrong: { fontWeight: '900', color: arcade.white },
});
