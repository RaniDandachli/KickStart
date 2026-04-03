import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isUuid } from '@/lib/isUuid';
import { formatUsdFromCents } from '@/lib/money';
import { queryKeys } from '@/lib/queryKeys';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import {
  fetchMatchSessionWithPlayers,
  recordH2hMatchResultViaEdge,
} from '@/services/api/h2hMatchSession';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';

export default function MatchResultScreen() {
  const params = useLocalSearchParams<{
    matchId: string;
    winner?: string;
    sa?: string;
    sb?: string;
    draw?: string;
    prize?: string;
    entry?: string;
    opp?: string;
    oppId?: string;
  }>();
  const rawMid = params.matchId;
  const matchId = Array.isArray(rawMid) ? rawMid[0] : rawMid;
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const clearActiveMatch = useMatchmakingStore((s) => s.setActiveMatch);
  const addWalletCents = useDemoWalletStore((s) => s.addWalletCents);

  const winner = Array.isArray(params.winner) ? params.winner[0] : params.winner;
  const saRaw = Array.isArray(params.sa) ? params.sa[0] : params.sa;
  const sbRaw = Array.isArray(params.sb) ? params.sb[0] : params.sb;
  const draw = Array.isArray(params.draw) ? params.draw[0] : params.draw;
  const rawOpp = Array.isArray(params.opp) ? params.opp[0] : params.opp;
  const oppName = rawOpp ? decodeURIComponent(rawOpp) : 'Opponent';
  const rawPrize = Array.isArray(params.prize) ? params.prize[0] : params.prize;
  const rawEntry = Array.isArray(params.entry) ? params.entry[0] : params.entry;

  const prizeUsd = rawPrize != null ? Number(rawPrize) : NaN;
  const entryUsd = rawEntry != null ? Number(rawEntry) : NaN;
  const hasPrize = Number.isFinite(prizeUsd) && prizeUsd > 0;
  const hasPaidRematch =
    Number.isFinite(entryUsd) && entryUsd > 0 && Number.isFinite(prizeUsd) && prizeUsd > 0;
  const rematchHref: Href = hasPaidRematch
    ? (`/(app)/(tabs)/play/casual?entry=${encodeURIComponent(String(entryUsd))}&prize=${encodeURIComponent(String(prizeUsd))}` as Href)
    : '/(app)/(tabs)/play/casual';

  const { data: ms } = useQuery({
    queryKey: queryKeys.matchSession(matchId ?? ''),
    queryFn: () => fetchMatchSessionWithPlayers(matchId!),
    enabled: ENABLE_BACKEND && !!matchId && isUuid(matchId) && uid !== 'guest',
  });

  const isDraw = draw === '1' || winner === 'draw';
  const won = !isDraw && winner === uid;
  const lost = !isDraw && !won;

  const outcomeLine = useMemo(() => {
    if (isDraw) return 'No winner — same score.';
    if (won) return `You won against ${oppName}.`;
    return `${oppName} won this match.`;
  }, [isDraw, won, oppName]);

  const recordedRef = useRef(false);
  useEffect(() => {
    if (!ENABLE_BACKEND || !matchId || !isUuid(matchId) || uid === 'guest') return;
    if (recordedRef.current) return;
    if (!ms) return;
    if (ms.status === 'completed') {
      recordedRef.current = true;
      return;
    }

    const saNum = Number(saRaw);
    const sbNum = Number(sbRaw);
    if (!Number.isFinite(saNum) || !Number.isFinite(sbNum)) return;

    const pa = ms.player_a_id;
    const pb = ms.player_b_id;
    if (!pa || !pb) return;

    const isA = uid === pa;
    const scorePayload = isA ? { a: saNum, b: sbNum } : { a: sbNum, b: saNum };

    let winnerUserId: string | null = null;
    let loserUserId: string | null = null;
    if (!isDraw) {
      if (winner === uid) {
        winnerUserId = uid;
        loserUserId = isA ? pb : pa;
      } else {
        loserUserId = uid;
        winnerUserId = isA ? pb : pa;
      }
    }

    recordedRef.current = true;
    void recordH2hMatchResultViaEdge({
      matchSessionId: matchId,
      isDraw,
      winnerUserId,
      loserUserId,
      score: scorePayload,
      wasRanked: false,
    })
      .then(() => qc.invalidateQueries({ queryKey: queryKeys.matchSession(matchId) }))
      .catch((e) => {
        console.warn('[recordH2hMatchResult]', e);
        recordedRef.current = false;
      });
  }, [ENABLE_BACKEND, matchId, uid, ms, saRaw, sbRaw, draw, winner, isDraw, qc]);

  const payoutApplied = useRef(false);
  useEffect(() => {
    if (payoutApplied.current) return;
    if (!won || isDraw || !hasPrize) return;
    if (ENABLE_BACKEND) {
      return;
    }
    payoutApplied.current = true;
    addWalletCents(Math.round(prizeUsd * 100));
  }, [won, isDraw, hasPrize, prizeUsd, addWalletCents]);

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
      <Text style={styles.vsLine}>Player vs player</Text>
      <Text style={styles.outcomeLine}>{outcomeLine}</Text>
      <Text style={styles.oppHint}>vs {oppName}</Text>

      <LinearGradient colors={[runit.neonPurple, 'rgba(12,6,22,0.95)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, runitGlowPinkSoft]}>
        <Text style={styles.scoreLabel}>Final score (you — opponent)</Text>
        <Text style={styles.scoreBig}>
          {saRaw ?? '?'} — {sbRaw ?? '?'}
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
                +{formatUsdFromCents(Math.round(prizeUsd * 100))} prize credited (local demo).
              </Text>
            </View>
          </View>
        ) : null}

        {won && hasPrize && ENABLE_BACKEND ? (
          <Text style={styles.serverNote}>Prize will credit after server verification (Stripe + Edge Function next).</Text>
        ) : null}

        {isDraw ? (
          <View style={styles.drawBox}>
            <Ionicons name="git-compare-outline" size={22} color={runit.neonCyan} />
            <Text style={styles.drawTitle}>Same score — it&apos;s a draw</Text>
            <Text style={styles.drawBody}>
              {hasPrize
                ? "No winner, so the prize was not awarded. Rematch with the same contest fee and reward tier."
                : 'No winner this time. Queue again for another match.'}
            </Text>
          </View>
        ) : null}

        {lost ? <Text style={styles.serverNote}>Tip: tap +Goal faster next run — this screen is a prototype.</Text> : null}
      </LinearGradient>

      <View style={styles.btnCol}>
        {isDraw ? (
          <AppButton title={hasPaidRematch ? 'Rematch — same fee & reward tier' : 'Go again — find a match'} onPress={() => router.replace(rematchHref)} />
        ) : null}
        <AppButton title="Arcade" onPress={() => router.replace('/(app)/(tabs)/play')} variant={isDraw ? 'secondary' : 'primary'} />
        <AppButton title="Home" variant="ghost" onPress={() => router.replace('/(app)/(tabs)')} />
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
  vsLine: { color: 'rgba(148,163,184,0.95)', fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  outcomeLine: {
    color: 'rgba(226,232,240,0.98)',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  oppHint: { color: 'rgba(148,163,184,0.9)', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
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
  drawBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,240,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.28)',
    gap: 8,
  },
  drawTitle: { color: runit.neonCyan, fontSize: 15, fontWeight: '900' },
  drawBody: { color: 'rgba(226,232,240,0.95)', fontSize: 13, lineHeight: 19 },
  btnCol: { gap: 10, width: '100%' },
});
