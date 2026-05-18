import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useMyAsyncHostPendingRuns } from '@/hooks/useMyAsyncHostPendingRuns';
import { pushCrossTab } from '@/lib/appNavigation';
import { normalizeH2hSkillContestGameKey } from '@/lib/h2hSkillContestGames';
import { titleForH2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import type { AsyncHostPendingWithMatch } from '@/services/api/h2hAsyncHostMyRuns';

function gameTitle(gameKey: string): string {
  const g = normalizeH2hSkillContestGameKey(gameKey);
  return g ? titleForH2hGameKey(g) : gameKey.trim() || 'Skill contest';
}

type Pill = { text: string; color: string; bg: string };

function statusPill(uid: string, row: AsyncHostPendingWithMatch): Pill {
  const { pending, match } = row;
  if (pending.status === 'waiting_opponent') {
    return { text: 'Pending', color: '#fde68a', bg: 'rgba(250,204,21,0.18)' };
  }
  if (pending.status === 'expired') {
    return { text: 'Expired', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
  }
  if (pending.status === 'cancelled') {
    return { text: 'Cancelled', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
  }
  if (pending.status === 'consumed' && match) {
    if (match.status !== 'completed') {
      return { text: 'In progress', color: '#7dd3fc', bg: 'rgba(56,189,248,0.2)' };
    }
    const wa = match.winner_user_id;
    const draw = wa == null && match.score_a === match.score_b;
    if (draw) return { text: 'Draw', color: '#e2e8f0', bg: 'rgba(226,232,240,0.15)' };
    if (wa === uid) return { text: 'Winner', color: '#86efac', bg: 'rgba(34,197,94,0.2)' };
    if (wa) return { text: 'Lost', color: '#fda4af', bg: 'rgba(244,63,94,0.18)' };
    return { text: 'Completed', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
  }
  return { text: 'Recorded', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
}

/** Async host rows always create `match_sessions` with the host as player A. */
function hostVersusScores(match: NonNullable<AsyncHostPendingWithMatch['match']>) {
  return { you: match.score_a, opponent: match.score_b };
}

function outcomeBlock(uid: string, row: AsyncHostPendingWithMatch): string[] {
  const { pending, match } = row;
  const lines: string[] = [];
  if (pending.status === 'waiting_opponent') {
    lines.push('Waiting for someone to join this tier — your score and entry are on file.');
    return lines;
  }
  if (pending.status === 'expired') {
    lines.push('No opponent in time — paid entry was refunded if it applied.');
    return lines;
  }
  if (pending.status === 'cancelled') {
    lines.push('You cancelled this row — paid entry was refunded if it applied.');
    return lines;
  }
  if (pending.status === 'consumed' && match) {
    if (match.status !== 'completed') {
      lines.push('An opponent joined this contest — open the match if you still need to finish your side.');
      return lines;
    }
    const { you, opponent } = hostVersusScores(match);
    lines.push(`You · ${you.toLocaleString()}   vs   Opponent · ${opponent.toLocaleString()}`);
    const prizeCents = pending.listed_prize_usd_cents ?? 0;
    const prizeLabel = prizeCents > 0 ? formatUsdFromCents(prizeCents) : null;
    const wa = match.winner_user_id;
    const draw = wa == null && you === opponent;
    if (draw) {
      lines.push('Same score — this tier is a draw under contest rules.');
      return lines;
    }
    if (wa === uid) {
      if (prizeLabel) {
        lines.push(
          `You won — the listed prize (${prizeLabel}) has been credited to your cash wallet where applicable (subject to rules & eligibility).`,
        );
      } else {
        lines.push('You won this contest on this tier (no cash prize was listed for this row).');
      }
      return lines;
    }
    if (wa) {
      lines.push(`Opponent won with ${opponent.toLocaleString()} — the listed prize went to them on this tier.`);
      if (prizeLabel) {
        lines.push('You did not receive this tier’s cash prize.');
      }
      return lines;
    }
    lines.push('This contest is marked complete — check your wallet and match history if something looks off.');
  }
  return lines;
}

type Props = {
  userId: string;
  /**
   * `default` — standalone panel (e.g. queue) with gradient shell; hides when empty/loading/error.
   * `embedded` — inside Async Runs promo: always shows shell; loading / empty / error / rows.
   */
  variant?: 'default' | 'embedded';
};

/**
 * Lists the signed-in host’s async contest rows: game, locked score, stake, pending vs completed, and settlement lines.
 */
export function AsyncHostPendingRunsPanel({ userId, variant = 'default' }: Props) {
  const router = useRouter();
  const q = useMyAsyncHostPendingRuns(userId);
  const embedded = variant === 'embedded';

  if (!ENABLE_BACKEND) return null;

  if (!embedded) {
    if (q.isLoading || q.isError) return null;
    if ((q.data ?? []).length === 0) return null;
  }

  const rows = q.data ?? [];

  const body = (
    <>
      <View style={styles.headRow}>
        <SafeIonicons name="albums-outline" size={embedded ? 18 : 20} color="#c4b5fd" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: runitFont.black }]}>Your async runs</Text>
          <Text style={styles.sub}>
            {embedded
              ? 'Pending rows, live contests, and finished results — your game, your score, and how each contest ended.'
              : 'Runs you locked for this account — waiting for a challenger, in play, or already settled.'}
          </Text>
        </View>
      </View>

      {embedded && q.isLoading ? (
        <View style={styles.embedStateRow}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={styles.embedStateTxt}>Loading your runs…</Text>
        </View>
      ) : null}

      {embedded && q.isError ? (
        <View style={styles.embedStateCol}>
          <Text style={styles.errTxt}>Could not load your async runs.</Text>
          <Pressable onPress={() => void q.refetch()} style={styles.retry}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {embedded && !q.isLoading && !q.isError && rows.length === 0 ? (
        <Text style={styles.emptyTxt}>
          No async runs on file yet. Use Start an Async Run above to lock a score for others to challenge.
        </Text>
      ) : null}

      {!q.isLoading && !q.isError
        ? rows.map((row) => {
            const pill = statusPill(userId, row);
            const entry = formatUsdFromCents(row.pending.entry_fee_wallet_cents ?? 0);
            const prize =
              row.pending.listed_prize_usd_cents != null && row.pending.listed_prize_usd_cents > 0
                ? formatUsdFromCents(row.pending.listed_prize_usd_cents)
                : '—';
            const openMatch =
              row.pending.status === 'consumed' &&
              row.match &&
              row.match.status !== 'completed' &&
              row.match.status !== 'cancelled' &&
              row.match.status !== 'void';

            const outcomes = outcomeBlock(userId, row);

            return (
              <View key={row.pending.id} style={[styles.card, embedded && styles.cardEmbedded]}>
                <View style={styles.cardTop}>
                  <Text style={styles.game}>{gameTitle(row.pending.game_key)}</Text>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.pillTxt, { color: pill.color }]}>{pill.text}</Text>
                  </View>
                </View>
                <Text style={styles.scoreLine}>
                  Your locked score · <Text style={styles.scoreEm}>{row.pending.host_score.toLocaleString()}</Text>
                </Text>
                <Text style={styles.metaLine}>
                  Entry {entry} · Win up to {prize}
                </Text>
                {outcomes.map((line, i) => (
                  <Text key={i} style={[styles.detail, i > 0 && styles.detailGap]}>
                    {line}
                  </Text>
                ))}
                {openMatch ? (
                  <Pressable
                    onPress={() =>
                      pushCrossTab(router, `/(app)/(tabs)/play/match/${row.match!.id}` as never)
                    }
                    style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Open match"
                  >
                    <Text style={styles.ctaTxt}>Open match</Text>
                    <SafeIonicons name="chevron-forward" size={16} color="#38bdf8" />
                  </Pressable>
                ) : null}
              </View>
            );
          })
        : null}
    </>
  );

  if (embedded) {
    return <View style={styles.embedWrap}>{body}</View>;
  }

  return (
    <LinearGradient colors={['rgba(99,102,241,0.22)', 'rgba(15,23,42,0.92)']} style={styles.wrap}>
      {body}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.35)',
    gap: 12,
  },
  embedWrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.25)',
    gap: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: '#f8fafc', fontSize: 14, letterSpacing: 0.4 },
  sub: { color: 'rgba(203,213,225,0.88)', fontSize: 11, lineHeight: 16, marginTop: 4 },
  embedStateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  embedStateCol: { gap: 8 },
  embedStateTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 12 },
  errTxt: { color: '#fda4af', fontSize: 12 },
  retry: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10 },
  retryTxt: { color: runit.neonPink, fontWeight: '800', fontSize: 13 },
  emptyTxt: { color: 'rgba(148,163,184,0.92)', fontSize: 12, lineHeight: 18 },
  card: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(2,6,23,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  cardEmbedded: {
    backgroundColor: 'rgba(2,6,23,0.35)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  game: { flex: 1, color: '#e0e7ff', fontSize: 14, fontWeight: '800' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  scoreLine: { color: 'rgba(226,232,240,0.88)', fontSize: 13, marginBottom: 4 },
  scoreEm: { color: '#fef08a', fontWeight: '900' },
  metaLine: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 6 },
  detail: { color: 'rgba(203,213,225,0.92)', fontSize: 12, lineHeight: 17 },
  detailGap: { marginTop: 6 },
  cta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  ctaTxt: { color: '#38bdf8', fontSize: 13, fontWeight: '800' },
});
