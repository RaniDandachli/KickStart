import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';

export default function MatchResultScreen() {
  const { matchId, winner, sa, sb, draw, prize, opp } = useLocalSearchParams<{
    matchId: string;
    winner?: string;
    sa?: string;
    sb?: string;
    draw?: string;
    prize?: string;
    opp?: string;
  }>();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const clearActiveMatch = useMatchmakingStore((s) => s.setActiveMatch);
  const addPrizeCents = useDemoWalletStore((s) => s.addPrizeCents);

  const isDraw = draw === '1' || winner === 'draw';
  const won = !isDraw && winner === uid;
  const lost = !isDraw && !won;
  const rawOpp = Array.isArray(opp) ? opp[0] : opp;
  const oppName = rawOpp ? decodeURIComponent(rawOpp) : 'Opponent';
  const prizeUsd = prize != null ? Number(prize) : NaN;
  const hasPrize = Number.isFinite(prizeUsd) && prizeUsd > 0;

  const payoutApplied = useRef(false);
  useEffect(() => {
    if (payoutApplied.current) return;
    if (!won || isDraw || !hasPrize) return;
    if (ENABLE_BACKEND) {
      // Wire: invoke `recordMatchResult` then invalidate profile / wallet query.
      return;
    }
    payoutApplied.current = true;
    addPrizeCents(Math.round(prizeUsd * 100));
  }, [won, isDraw, hasPrize, prizeUsd, addPrizeCents]);

  useEffect(() => {
    return () => {
      clearActiveMatch(null);
    };
  }, [clearActiveMatch]);

  const title = isDraw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
  const titleStyle = isDraw ? runitTextGlowCyan : won ? runitTextGlowPink : styles.defeatGlow;

  return (
    <Screen scroll={false}>
      <Text style={[styles.bigTitle, { fontFamily: runitFont.black }, titleStyle]}>{title}</Text>
      <Text style={styles.vsLine}>
        vs {oppName}
      </Text>

      <LinearGradient colors={[runit.neonPurple, 'rgba(12,6,22,0.95)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, runitGlowPinkSoft]}>
        <Text style={styles.scoreLabel}>Final score</Text>
        <Text style={styles.scoreBig}>
          {sa ?? '?'} — {sb ?? '?'}
        </Text>
        <Text style={styles.mono} numberOfLines={1}>
          {matchId}
        </Text>

        {won && hasPrize && !ENABLE_BACKEND ? (
          <View style={styles.walletBanner}>
            <Ionicons name="wallet" size={22} color={runit.neonCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTitle}>Wallet updated</Text>
              <Text style={styles.walletBody}>
                +{formatUsdFromCents(Math.round(prizeUsd * 100))} added from this win (local demo).
              </Text>
            </View>
          </View>
        ) : null}

        {won && hasPrize && ENABLE_BACKEND ? (
          <Text style={styles.serverNote}>Prize will credit after server verification (Stripe + Edge Function next).</Text>
        ) : null}

        {isDraw && hasPrize ? (
          <Text style={styles.serverNote}>Draw — no prize awarded. Play a rematch to settle it.</Text>
        ) : null}

        {lost ? <Text style={styles.serverNote}>Tip: tap +Goal faster next run — this screen is a prototype.</Text> : null}
      </LinearGradient>

      <View style={styles.btnCol}>
        <AppButton title="Arcade" onPress={() => router.replace('/(app)/(tabs)/play')} />
        <AppButton title="Home" variant="secondary" onPress={() => router.replace('/(app)/(tabs)')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigTitle: {
    fontSize: 32,
    letterSpacing: 4,
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  defeatGlow: {
    textShadowColor: 'rgba(148,163,184,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    color: '#e2e8f0',
  },
  vsLine: { color: 'rgba(148,163,184,0.95)', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scoreLabel: { color: 'rgba(148,163,184,0.95)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  scoreBig: { color: '#f8fafc', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  mono: { fontSize: 10, color: 'rgba(100,116,139,0.95)', fontVariant: ['tabular-nums'] },
  walletBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(6,2,14,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.35)',
  },
  walletTitle: { color: runit.neonCyan, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  walletBody: { color: 'rgba(226,232,240,0.95)', fontSize: 13, lineHeight: 18 },
  serverNote: { marginTop: 14, color: 'rgba(148,163,184,0.95)', fontSize: 12, lineHeight: 17 },
  btnCol: { gap: 10, width: '100%' },
});
