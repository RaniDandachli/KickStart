import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { getH2hLossArcadeCreditsForEntryFeeWalletCents } from '@/constants/h2hLossArcadeCredits';
import { trackProductEvent } from '@/lib/analytics/productAnalytics';
import { isUuid } from '@/lib/isUuid';
import { formatUsdFromCents } from '@/lib/money';
import { H2H_OPEN_GAMES } from '@/lib/homeOpenMatches';
import { queryKeys } from '@/lib/queryKeys';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import {
    fetchMatchSessionWithPlayers,
    recordH2hMatchResultViaEdge,
} from '@/services/api/h2hMatchSession';
import { useAuthStore } from '@/store/authStore';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';

/** Clear queue / “match found” machine so the next contest doesn’t stay stuck in lobby/found. */
function resetMatchmakingAfterMatch() {
  useMatchmakingStore.getState().reset();
}

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
    /** Set when you forfeited from the match screen — `recordMatchResult` skips minigame score verification. */
    forfeit?: string;
  }>();
  const rawMid = params.matchId;
  const matchId = Array.isArray(rawMid) ? rawMid[0] : rawMid;
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id ?? 'guest');
  const clearActiveMatch = useMatchmakingStore((s) => s.setActiveMatch);
  const addWalletCents = useDemoWalletStore((s) => s.addWalletCents);
  const addDemoArcadeCredits = useDemoPrizeCreditsStore((s) => s.add);

  const winner = Array.isArray(params.winner) ? params.winner[0] : params.winner;
  const saRaw = Array.isArray(params.sa) ? params.sa[0] : params.sa;
  const sbRaw = Array.isArray(params.sb) ? params.sb[0] : params.sb;
  const draw = Array.isArray(params.draw) ? params.draw[0] : params.draw;
  const forfeitRaw = Array.isArray(params.forfeit) ? params.forfeit[0] : params.forfeit;
  const isForfeitFlow = forfeitRaw === '1' || forfeitRaw === 'true';
  const rawOpp = Array.isArray(params.opp) ? params.opp[0] : params.opp;
  const oppName = rawOpp ? decodeURIComponent(rawOpp) : 'Opponent';
  const rawPrize = Array.isArray(params.prize) ? params.prize[0] : params.prize;
  const rawEntry = Array.isArray(params.entry) ? params.entry[0] : params.entry;

  const prizeUsd = rawPrize != null ? Number(rawPrize) : NaN;
  const entryUsd = rawEntry != null ? Number(rawEntry) : NaN;
  const hasPrize = Number.isFinite(prizeUsd) && prizeUsd > 0;
  const hasPaidRematch =
    Number.isFinite(entryUsd) && entryUsd > 0 && Number.isFinite(prizeUsd) && prizeUsd > 0;

  const { data: ms } = useQuery({
    queryKey: queryKeys.matchSession(matchId ?? ''),
    queryFn: () => fetchMatchSessionWithPlayers(matchId!),
    enabled: ENABLE_BACKEND && !!matchId && isUuid(matchId) && uid !== 'guest',
  });

  const rematchGameQs = useMemo(() => {
    const gk = ms?.game_key;
    if (!gk || !H2H_OPEN_GAMES.some((g) => g.gameKey === gk)) return '';
    return `&game=${encodeURIComponent(gk)}&intent=start`;
  }, [ms?.game_key]);

  const rematchHref: Href = hasPaidRematch
    ? (`/(app)/(tabs)/play/casual?entryCents=${Math.round(entryUsd * 100)}&prizeCents=${Math.round(prizeUsd * 100)}&entry=${encodeURIComponent(String(entryUsd))}&prize=${encodeURIComponent(String(prizeUsd))}${rematchGameQs}` as Href)
    : '/(app)/(tabs)/play/casual';

  const isDraw = draw === '1' || winner === 'draw';
  const won = !isDraw && winner === uid;
  const lost = !isDraw && !won;

  const entryFeeWalletCents = useMemo(() => {
    if (ms?.entry_fee_wallet_cents != null && ms.entry_fee_wallet_cents > 0) {
      return ms.entry_fee_wallet_cents;
    }
    if (Number.isFinite(entryUsd) && entryUsd > 0) return Math.round(entryUsd * 100);
    return 0;
  }, [ms?.entry_fee_wallet_cents, entryUsd]);

  const expectedLossCredits = useMemo(
    () => getH2hLossArcadeCreditsForEntryFeeWalletCents(entryFeeWalletCents),
    [entryFeeWalletCents],
  );

  const [serverLossCredits, setServerLossCredits] = useState<number | null>(null);
  const [serverPrizeWalletCents, setServerPrizeWalletCents] = useState<number | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSubmitting, setRecordSubmitting] = useState(false);

  const lossCreditsShown = serverLossCredits ?? expectedLossCredits;
  const showLossCredits = lost && !isDraw && lossCreditsShown != null && lossCreditsShown > 0;

  const outcomeLine = useMemo(() => {
    if (isDraw) {
      return hasPrize
        ? 'Tie score — this contest isn’t finished yet.'
        : 'No winner — same score.';
    }
    if (won) return `You had the top score against ${oppName}.`;
    return `You didn't take the top score this time — ${oppName} did.`;
  }, [isDraw, hasPrize, won, oppName]);

  const recordedOkRef = useRef(false);
  const submitInFlightRef = useRef(false);

  const submitMatchToServer = useCallback(async () => {
    if (!ENABLE_BACKEND || !matchId || !isUuid(matchId) || uid === 'guest') return;
    if (recordedOkRef.current || submitInFlightRef.current) return;
    if (!ms) return;

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

    setRecordError(null);
    setRecordSubmitting(true);
    submitInFlightRef.current = true;
    try {
      const res = await recordH2hMatchResultViaEdge({
        matchSessionId: matchId,
        isDraw,
        winnerUserId,
        loserUserId,
        score: scorePayload,
        wasRanked: false,
        forfeitDeclaredByUserId: isForfeitFlow && !isDraw ? uid : undefined,
      });
      recordedOkRef.current = true;
      if (res.loss_consolation_credits != null && res.loss_consolation_credits > 0) {
        setServerLossCredits(res.loss_consolation_credits);
        trackProductEvent('h2h_loss_credits_granted', {
          credits: res.loss_consolation_credits,
          entry_fee_wallet_cents: entryFeeWalletCents,
          source: 'server',
        });
      }
      if (res.prize_wallet_cents_added != null && res.prize_wallet_cents_added > 0) {
        setServerPrizeWalletCents(res.prize_wallet_cents_added);
        trackProductEvent('h2h_win_prize_credited', {
          wallet_cents: res.prize_wallet_cents_added,
          source: 'server',
        });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions(uid) });
      void qc.invalidateQueries({ queryKey: queryKeys.userStats(uid) });
      void qc.invalidateQueries({ queryKey: queryKeys.recentMatches(uid) });
      void qc.invalidateQueries({ queryKey: queryKeys.matchSession(matchId) });
    } catch (e: unknown) {
      console.warn('[recordH2hMatchResult]', e);
      const msg = e instanceof Error ? e.message : 'Could not save match to the server.';
      setRecordError(msg);
    } finally {
      submitInFlightRef.current = false;
      setRecordSubmitting(false);
    }
  }, [
    ENABLE_BACKEND,
    matchId,
    uid,
    ms,
    saRaw,
    sbRaw,
    winner,
    isDraw,
    qc,
    entryFeeWalletCents,
    isForfeitFlow,
  ]);

  useEffect(() => {
    void submitMatchToServer();
  }, [submitMatchToServer]);

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

  const lossConsolationDemoApplied = useRef(false);
  useEffect(() => {
    if (lossConsolationDemoApplied.current) return;
    if (ENABLE_BACKEND) return;
    if (!lost || isDraw) return;
    const c = getH2hLossArcadeCreditsForEntryFeeWalletCents(entryFeeWalletCents);
    if (c <= 0) return;
    lossConsolationDemoApplied.current = true;
    addDemoArcadeCredits(c);
    trackProductEvent('h2h_loss_credits_granted', {
      credits: c,
      entry_fee_wallet_cents: entryFeeWalletCents,
      source: 'guest_preview',
    });
  }, [ENABLE_BACKEND, lost, isDraw, entryFeeWalletCents, addDemoArcadeCredits]);

  useEffect(() => {
    resetMatchmakingAfterMatch();
    return () => {
      clearActiveMatch(null);
    };
  }, [clearActiveMatch]);

  const heroTitle = isDraw ? 'DRAW' : won ? 'VICTORY' : 'MATCH COMPLETE';
  const titleStyle = isDraw ? runitTextGlowCyan : won ? runitTextGlowPink : runitTextGlowCyan;

  const prizeCentsForDisplay =
    ENABLE_BACKEND && serverPrizeWalletCents != null && serverPrizeWalletCents > 0
      ? serverPrizeWalletCents
      : hasPrize
        ? Math.round(prizeUsd * 100)
        : 0;

  function goArcadeFromLoss() {
    if (lost) {
      trackProductEvent('h2h_loss_to_arcade_cta', { match_id: matchId ?? '' });
    }
    router.replace('/(app)/(tabs)/play');
  }

  return (
    <Screen scroll>
      <Text style={[styles.bigTitle, { fontFamily: runitFont.black }, titleStyle]}>{heroTitle}</Text>
      <Text style={styles.vsLine}>Skill contest</Text>
      <Text style={styles.outcomeLine}>{outcomeLine}</Text>
      <Text style={styles.oppHint}>vs {oppName}</Text>

      {ENABLE_BACKEND && recordSubmitting && !recordError ? (
        <View style={styles.recordPending}>
          <ActivityIndicator color="#5eead4" />
          <Text style={styles.recordPendingText}>Recording result and prizes on the server…</Text>
        </View>
      ) : null}

      {ENABLE_BACKEND && recordError ? (
        <View style={styles.recordErrorBox}>
          <Text style={styles.recordErrorText}>
            Could not save this match: {recordError}. Your wallet will not update until this succeeds.
          </Text>
          <AppButton title="Retry save" variant="secondary" onPress={() => void submitMatchToServer()} />
        </View>
      ) : null}

      <LinearGradient
        colors={[runit.neonPurple, 'rgba(12,6,22,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, runitGlowPinkSoft]}
      >
        <Text style={styles.scoreLabel}>Final score (you — opponent)</Text>
        <Text style={styles.scoreBig}>
          {saRaw ?? '?'} — {sbRaw ?? '?'}
        </Text>
        <Text style={styles.mono} numberOfLines={1}>
          {matchId}
        </Text>

        {won && prizeCentsForDisplay > 0 && !ENABLE_BACKEND ? (
          <View style={styles.walletBanner}>
            <SafeIonicons name="wallet" size={22} color={runit.neonCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTitle}>Cash wallet updated</Text>
              <Text style={styles.walletBody}>
                +{formatUsdFromCents(prizeCentsForDisplay)} listed prize credited to your cash wallet (guest preview on this device).
              </Text>
            </View>
          </View>
        ) : null}

        {won && prizeCentsForDisplay > 0 && ENABLE_BACKEND ? (
          <View style={styles.walletBanner}>
            <SafeIonicons name="wallet" size={22} color={runit.neonCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTitle}>Cash wallet</Text>
              <Text style={styles.walletBody}>
                +{formatUsdFromCents(prizeCentsForDisplay)} skill-contest prize credited to your cash wallet (withdrawable when
                payouts are enabled).
              </Text>
            </View>
          </View>
        ) : null}

        {showLossCredits ? (
          <View style={styles.arcadeCreditsBanner}>
            <SafeIonicons name="ribbon-outline" size={22} color="#fbbf24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.arcadeCreditsTitle}>Arcade Credits earned</Text>
              <Text style={styles.arcadeCreditsBody}>
                You didn&apos;t win this match, but you earned {lossCreditsShown.toLocaleString()} Arcade Credits for playing.
              </Text>
              <Text style={styles.arcadeCreditsFoot}>
                Arcade Credits are for Arcade mode only — not cash, not transferable. Use them to keep playing, earn tickets, and
                work toward prizes.
              </Text>
            </View>
          </View>
        ) : null}

        {isDraw ? (
          <View style={styles.drawBox}>
            <SafeIonicons name="git-compare-outline" size={22} color={runit.neonCyan} />
            <Text style={styles.drawTitle}>
              {hasPrize ? 'Break the tie — same contest' : 'Same score — it&apos;s a draw'}
            </Text>
            {hasPrize ? (
              <Text style={styles.drawBody}>
                Your match access for this skill contest already counted for that round. Because you tied,{' '}
                <Text style={styles.drawEm}>no one was top performer</Text>
                {' — the listed prize wasn&apos;t paid out.'}
                {'\n\n'}
                You need{' '}
                <Text style={styles.drawEm}>another match at the same fee and same prize</Text>
                {
                  ' to decide a winner. Whoever earns the top score in that game wins the cash — same rules as always. Tap below to queue again right away.'
                }
              </Text>
            ) : (
              <Text style={styles.drawBody}>No winner this time. Queue again for another match.</Text>
            )}
          </View>
        ) : null}

        {lost && !showLossCredits ? (
          <Text style={styles.serverNote}>
            Every match is practice for the next run. Queue again when you&apos;re ready.
          </Text>
        ) : null}
      </LinearGradient>

      <View style={styles.btnCol}>
        {lost ? (
          <AppButton title="Play Arcade" onPress={goArcadeFromLoss} variant="primary" />
        ) : null}
        {isDraw ? (
          <AppButton
            title={
              hasPaidRematch
                ? 'Play again — same fee & prize'
                : 'Go again — find a match'
            }
            onPress={() => router.replace(rematchHref)}
          />
        ) : null}
        {!lost ? (
          <AppButton
            title="Arcade"
            onPress={() => router.replace('/(app)/(tabs)/play')}
            variant={isDraw ? 'secondary' : 'primary'}
          />
        ) : null}
        <AppButton title="Back Home" variant="ghost" onPress={() => router.replace('/(app)/(tabs)')} />
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
  recordPending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    paddingVertical: 8,
  },
  recordPendingText: { color: 'rgba(148,163,184,0.95)', fontSize: 13, fontWeight: '600' },
  recordErrorBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
    gap: 10,
  },
  recordErrorText: { color: 'rgba(254,226,226,0.95)', fontSize: 13, lineHeight: 18 },
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
  arcadeCreditsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(120,53,15,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  walletTitle: { color: runit.neonCyan, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  walletBody: { color: 'rgba(226,232,240,0.95)', fontSize: 13, lineHeight: 18 },
  arcadeCreditsTitle: { color: '#fbbf24', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  arcadeCreditsBody: { color: 'rgba(226,232,240,0.95)', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  arcadeCreditsFoot: { color: 'rgba(148,163,184,0.95)', fontSize: 12, lineHeight: 17 },
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
  drawEm: { fontWeight: '800', color: '#e2e8f0' },
  btnCol: { gap: 10, width: '100%' },
});
