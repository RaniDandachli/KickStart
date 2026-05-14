import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useOpenAsyncHostChallenges } from '@/hooks/useOpenAsyncHostChallenges';
import { normalizeH2hSkillContestGameKey } from '@/lib/h2hSkillContestGames';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import { titleForH2hGameKey } from '@/lib/homeOpenMatches';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import { h2hJoinSpecificAsyncHostChallenge } from '@/services/matchmaking/h2hQueue';

const GREEN = '#34d399';

type Props = {
  userId: string | undefined;
};

function gameTitle(gameKey: string): string {
  const g = normalizeH2hSkillContestGameKey(gameKey);
  return g ? titleForH2hGameKey(g) : gameKey;
}

export function OpenAsyncChallengesFeed({ userId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useOpenAsyncHostChallenges(userId, null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (userId && ENABLE_BACKEND) void q.refetch();
    }, [userId, q.refetch]),
  );

  const invalidateLists = useCallback(() => {
    void qc.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'openAsyncHostChallenges' });
    if (userId) void qc.invalidateQueries({ queryKey: queryKeys.myAsyncHostPending(userId) });
  }, [qc, userId]);

  const onChallenge = useCallback(
    async (pendingId: string) => {
      if (!ENABLE_BACKEND || !userId) {
        Alert.alert('Sign in', 'Create an account to accept async challenges and stake the same entry.');
        return;
      }
      setJoiningId(pendingId);
      try {
        const r = await h2hJoinSpecificAsyncHostChallenge(pendingId);
        if (!r.ok) {
          const code = r.error;
          const msg =
            code === 'insufficient_wallet'
              ? 'Not enough cash in your wallet for this entry. Add funds and try again.'
              : code === 'async_host_pending'
                ? 'You already have an open async run waiting for an opponent. Cancel or finish it in Play first.'
                : code === 'async_already_matched'
                  ? 'Someone else just picked this one up. Refresh the list.'
                  : code === 'async_expired'
                    ? 'This challenge expired. Refresh for newer runs.'
                    : code === 'cannot_challenge_own_run'
                      ? 'That is your own posted score — pick a different row.'
                      : code === 'not_authenticated'
                        ? 'Sign in to continue.'
                        : 'Could not join this challenge. Try again.';
          Alert.alert('Challenge', msg);
          invalidateLists();
          return;
        }
        if (r.matched) {
          invalidateLists();
          void invalidateProfileEconomy(qc, userId);
          router.push(`/(app)/(tabs)/play/match/${r.match_session_id}` as never);
        }
      } catch (e) {
        Alert.alert('Challenge', e instanceof Error ? e.message : 'Something went wrong.');
        invalidateLists();
      } finally {
        setJoiningId(null);
      }
    },
    [invalidateLists, qc, router, userId],
  );

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
    return (
      <View style={styles.errBox}>
        <Text style={styles.errTxt}>Could not load open challenges.</Text>
        <Pressable onPress={() => void q.refetch()} style={styles.retry}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const rows = q.data ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <SafeIonicons name="flash" size={20} color={GREEN} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>BEAT A POSTED SCORE</Text>
          <Text style={styles.sectionSub}>
            {`Each row is another player's locked run: same entry fee, same prize tier. Think you can beat it? Tap below — we open the contest and compare validated scores when you finish.`}
          </Text>
        </View>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No open runs right now. Post your own from Play → Contests & queue (async) so others can chase your score.
        </Text>
      ) : (
        rows.map((row) => {
          const entry = row.entry_fee_wallet_cents > 0 ? formatUsdFromCents(row.entry_fee_wallet_cents) : 'Free';
          const prize =
            row.listed_prize_usd_cents != null && row.listed_prize_usd_cents > 0
              ? formatUsdFromCents(row.listed_prize_usd_cents)
              : '—';
          const busy = joiningId === row.id;
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={[styles.game, { fontFamily: runitFont.bold }]}>{gameTitle(row.game_key)}</Text>
                <View style={styles.modePill}>
                  <Text style={styles.modePillTxt}>{row.mode}</Text>
                </View>
              </View>
              <Text style={styles.scoreLine}>
                Score to beat: <Text style={styles.scoreEm}>{row.host_score.toLocaleString()}</Text>
              </Text>
              <Text style={styles.meta}>
                Entry {entry} · Win up to {prize}
              </Text>
              <Text style={styles.hook}>Match the entry — if your run wins, you take the prize tier (per rules).</Text>
              <Pressable
                onPress={() => void onChallenge(row.id)}
                disabled={busy}
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
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
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
  errTxt: { color: '#fda4af', fontSize: 13 },
  retry: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12 },
  retryTxt: { color: runit.neonPink, fontWeight: '800' },
  empty: { color: 'rgba(148,163,184,0.92)', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.22)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  game: { flex: 1, color: '#f8fafc', fontSize: 16 },
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
