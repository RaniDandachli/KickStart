import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useAsyncBattleBoard } from '@/hooks/useOpenAsyncHostChallenges';
import { pushCrossTab } from '@/lib/appNavigation';
import { briefError } from '@/lib/briefFeedback';
import { normalizeH2hSkillContestGameKey } from '@/lib/h2hSkillContestGames';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import { titleForH2hGameKey } from '@/lib/homeOpenMatches';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import { oneVsOneChallengesHref } from '@/lib/tabRoutes';
import { invalidateAsyncBattleBoardQueries, type AsyncBattleBoardRow } from '@/services/api/h2hAsyncHostOpenChallenges';
import { joinAsyncChallengeAndOpenMatch } from '@/services/api/h2hAsyncHostJoinChallenge';

const GREEN = '#34d399';

type Props = {
  userId: string | undefined;
  /** Override navigation when empty-state CTA is pressed (default: Play → async run, return here). */
  onPostOwnRunPress?: () => void;
  /** Screen supplies its own page title / intro (e.g. Events 1v1 battles). */
  hideBoardHeader?: boolean;
};

function gameTitle(gameKey: string): string {
  const g = normalizeH2hSkillContestGameKey(gameKey);
  return g ? titleForH2hGameKey(g) : gameKey;
}

export function OpenAsyncChallengesFeed({ userId, onPostOwnRunPress, hideBoardHeader }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useAsyncBattleBoard(userId, null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const boardRows = q.data?.rows ?? [];
  const hasOwnWaiting = boardRows.some((r) => r.isOwnPostedRun);

  useFocusEffect(
    useCallback(() => {
      if (userId && ENABLE_BACKEND) {
        void q.refetch();
        if (userId) void qc.invalidateQueries({ queryKey: queryKeys.myAsyncHostPending(userId) });
      }
    }, [userId, q.refetch, qc]),
  );

  const invalidateLists = useCallback(() => {
    invalidateAsyncBattleBoardQueries(qc);
    if (userId) void qc.invalidateQueries({ queryKey: queryKeys.myAsyncHostPending(userId) });
  }, [qc, userId]);

  const onChallenge = useCallback(
    async (row: AsyncBattleBoardRow) => {
      if (row.isOwnPostedRun) return;
      if (!ENABLE_BACKEND || !userId) {
        briefError('Sign in', 'Create an account to accept async challenges and stake the same entry.');
        return;
      }
      setJoiningId(row.id);
      try {
        const result = await joinAsyncChallengeAndOpenMatch({
          pendingId: row.id,
          tier: {
            entryFeeWalletCents: row.entry_fee_wallet_cents,
            listedPrizeUsdCents: row.listed_prize_usd_cents,
          },
          router,
          queryClient: qc,
          userId,
        });
        if (!result.ok) {
          briefError('Challenge', result.message);
          invalidateLists();
          return;
        }
        invalidateLists();
      } catch (e) {
        briefError('Challenge', e instanceof Error ? e.message : 'Something went wrong.');
        invalidateLists();
      } finally {
        setJoiningId(null);
      }
    },
    [invalidateLists, qc, router, userId],
  );

  const goPostOwnAsyncRun = useCallback(() => {
    if (onPostOwnRunPress) {
      onPostOwnRunPress();
      return;
    }
    const rt = encodeURIComponent(String(oneVsOneChallengesHref()));
    pushCrossTab(router, `/(app)/(tabs)/play/async-run?returnTo=${rt}` as never);
  }, [onPostOwnRunPress, router]);

  if (!ENABLE_BACKEND) return null;

  if (!userId) {
    return (
      <View style={styles.guestBox}>
        <SafeIonicons name="people-outline" size={22} color={GREEN} />
        <Text style={[styles.guestTitle, { fontFamily: runitFont.black }]}>Open async challenges</Text>
        <Text style={styles.guestBody}>
          {`Sign in to browse real scores other players have posted — same entry, same game — and jump straight into a contest to beat their locked run.`}
        </Text>
      </View>
    );
  }

  if (q.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={GREEN} />
        <Text style={styles.loadingTxt}>Loading open challenges…</Text>
      </View>
    );
  }

  if (q.isError) {
    const errMsg = q.error instanceof Error ? q.error.message : 'Unknown error';
    return (
      <View style={styles.errBox}>
        <Text style={styles.errTxt}>Could not load open challenges.</Text>
        <Text style={styles.errDetail} numberOfLines={4}>
          {errMsg}
        </Text>
        <Text style={styles.errHint}>
          {`If you only see your own score below, that is expected — your run is hidden from you on this board. Other players can challenge it. Apply SQL migration 00063 + 00065 on Supabase if this keeps failing.`}
        </Text>
        <Pressable onPress={() => void q.refetch()} style={styles.retry}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const rows = boardRows;

  return (
    <View style={styles.wrap}>
      {q.data?.loadWarning ? (
        <Text style={styles.warnTxt}>{q.data.loadWarning}</Text>
      ) : null}
      {!hideBoardHeader ? (
        <View style={styles.headRow}>
          <SafeIonicons name="flash" size={20} color={GREEN} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>CONTESTS WAITING TO SETTLE</Text>
            <Text style={styles.sectionSub}>
              {`Each row is another player's locked run: same entry fee, same prize tier. Think you can beat it? Tap below — we open the contest and compare validated scores when you finish.`}
            </Text>
          </View>
        </View>
      ) : null}

      {rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <SafeIonicons name="rocket-outline" size={28} color={runit.neonPink} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { fontFamily: runitFont.black }]}>Nothing to beat yet</Text>
          <Text style={styles.emptyBody}>
            {hasOwnWaiting
              ? `Your run is on the board below — other players can challenge it. You cannot join your own row.`
              : `No open runs yet. Post your score and it will appear here for others to challenge at the same entry tier.`}
          </Text>
          <Pressable
            onPress={goPostOwnAsyncRun}
            accessibilityRole="button"
            accessibilityLabel="Post your async run so others can challenge your score"
            style={({ pressed }) => [styles.emptyCtaOuter, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['rgba(236,72,153,0.45)', 'rgba(15,23,42,0.96)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.emptyCtaGrad}
            >
              <SafeIonicons name="flash" size={18} color={runit.neonPink} />
              <Text style={[styles.emptyCtaTxt, { fontFamily: runitFont.black }]}>Post my score — async run</Text>
              <SafeIonicons name="chevron-forward" size={18} color={runit.neonPink} />
            </LinearGradient>
          </Pressable>
          <Text style={styles.emptyHint}>Tap the button above to post the first run on this board.</Text>
        </View>
      ) : (
        rows.map((row) => {
          const entry = row.entry_fee_wallet_cents > 0 ? formatUsdFromCents(row.entry_fee_wallet_cents) : 'Free';
          const prize =
            row.listed_prize_usd_cents != null && row.listed_prize_usd_cents > 0
              ? formatUsdFromCents(row.listed_prize_usd_cents)
              : '—';
          const busy = joiningId === row.id;
          const own = row.isOwnPostedRun;
          return (
            <View key={row.id} style={[styles.card, own && styles.cardOwn]}>
              <View style={styles.cardTop}>
                <Text style={[styles.game, { fontFamily: runitFont.bold }]}>{gameTitle(row.game_key)}</Text>
                <View style={[styles.pill, own ? styles.pillOwn : styles.pillOpen]}>
                  <Text style={[styles.pillTxt, { color: own ? '#fde68a' : '#86efac' }]}>
                    {own ? 'Your run · Pending' : 'Open'}
                  </Text>
                </View>
              </View>
              <Text style={styles.scoreLine}>
                {own ? 'Your locked score' : 'Score to beat'}:{' '}
                <Text style={styles.scoreEm}>{row.host_score.toLocaleString()}</Text>
              </Text>
              <Text style={styles.meta}>
                Entry {entry} · Win up to {prize}
              </Text>
              <Text style={styles.hook}>
                {own
                  ? 'Waiting for a challenger — Quick Match or Start Match at this tier can pick this up automatically.'
                  : 'Match the entry — if your run wins, you take the prize tier (per rules).'}
              </Text>
              {own ? null : (
                <Pressable
                  onPress={() => void onChallenge(row)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Challenge ${gameTitle(row.game_key)} for ${entry} entry`}
                  style={({ pressed }) => [styles.ctaOuter, (pressed || busy) && { opacity: 0.88 }]}
                >
                  <LinearGradient
                    colors={['rgba(52,211,153,0.35)', 'rgba(15,23,42,0.95)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.ctaGrad}
                  >
                    {busy ? (
                      <ActivityIndicator color="#ecfdf5" />
                    ) : (
                      <>
                        <SafeIonicons name="trophy" size={18} color={GREEN} />
                        <Text style={[styles.ctaTxt, { fontFamily: runitFont.black }]}>Think you can beat it?</Text>
                        <SafeIonicons name="chevron-forward" size={18} color={GREEN} />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  warnTxt: {
    color: 'rgba(251,191,36,0.92)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  sectionTitle: { color: '#ecfdf5', fontSize: 14, letterSpacing: 1.2, marginBottom: 6 },
  sectionSub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, lineHeight: 18 },
  guestBox: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(6,78,59,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
    gap: 8,
  },
  guestTitle: { color: '#ecfdf5', fontSize: 15, letterSpacing: 0.5 },
  guestBody: { color: 'rgba(226,232,240,0.9)', fontSize: 12, lineHeight: 18 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  loadingTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 13 },
  errBox: { marginBottom: 16, gap: 8 },
  errTxt: { color: '#fda4af', fontSize: 13, fontWeight: '700' },
  errDetail: { color: 'rgba(253,186,219,0.9)', fontSize: 11, lineHeight: 16, marginTop: 6 },
  errHint: { color: 'rgba(148,163,184,0.92)', fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 4 },
  retry: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12 },
  retryTxt: { color: runit.neonPink, fontWeight: '800' },
  emptyCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.28)',
    alignItems: 'stretch',
  },
  emptyIcon: { alignSelf: 'center', marginBottom: 10 },
  emptyTitle: { color: '#fce7f3', fontSize: 16, letterSpacing: 0.4, marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: 'rgba(226,232,240,0.9)', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  emptyCtaOuter: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  emptyCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emptyCtaTxt: { flex: 1, color: '#fdf2f8', fontSize: 14, letterSpacing: 0.2 },
  emptyHint: { color: 'rgba(148,163,184,0.88)', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.22)',
  },
  cardOwn: {
    borderColor: 'rgba(250,204,21,0.35)',
    backgroundColor: 'rgba(30,27,12,0.45)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  game: { flex: 1, color: '#f8fafc', fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillOpen: { backgroundColor: 'rgba(34,197,94,0.18)' },
  pillOwn: { backgroundColor: 'rgba(250,204,21,0.18)' },
  pillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  modePillTxt: { color: '#e2e8f0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  scoreLine: { color: 'rgba(226,232,240,0.9)', fontSize: 14, marginBottom: 4 },
  scoreEm: { color: '#fde047', fontWeight: '900' },
  meta: { color: 'rgba(148,163,184,0.95)', fontSize: 13, marginBottom: 8 },
  hook: { color: 'rgba(148,163,184,0.88)', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  ctaOuter: { borderRadius: 12, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ctaTxt: { flex: 1, color: '#ecfdf5', fontSize: 14, letterSpacing: 0.3 },
});
