import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useMyAsyncHostPendingRuns } from '@/hooks/useMyAsyncHostPendingRuns';
import { formatUsdFromCents } from '@/lib/money';
import { runitFont } from '@/lib/runitArcadeTheme';
import type { AsyncHostPendingWithMatch } from '@/services/api/h2hAsyncHostMyRuns';

function gameKeyLabel(gameKey: string): string {
  const g = gameKey.trim().toLowerCase();
  if (!g) return 'Skill contest';
  return g
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
      return { text: 'Live', color: '#7dd3fc', bg: 'rgba(56,189,248,0.2)' };
    }
    const wa = match.winner_user_id;
    const draw = wa == null && match.score_a === match.score_b;
    if (draw) return { text: 'Draw', color: '#e2e8f0', bg: 'rgba(226,232,240,0.15)' };
    if (wa === uid) return { text: 'Won', color: '#86efac', bg: 'rgba(34,197,94,0.2)' };
    if (wa) return { text: 'Lost', color: '#fda4af', bg: 'rgba(244,63,94,0.18)' };
    return { text: 'Settled', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
  }
  return { text: 'Recorded', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
}

function detailLine(uid: string, row: AsyncHostPendingWithMatch): string {
  const { pending, match } = row;
  if (pending.status === 'waiting_opponent') {
    return 'Waiting for another player to join this tier — your score is on file.';
  }
  if (pending.status === 'expired') {
    return 'No opponent in time — paid entry was refunded if applicable.';
  }
  if (pending.status === 'cancelled') {
    return 'You left this stack — paid entry was refunded if applicable.';
  }
  if (pending.status === 'consumed' && match) {
    if (match.status !== 'completed') {
      return 'Someone joined — open the match to play your side and settle the contest.';
    }
    const prize = pending.listed_prize_usd_cents != null ? formatUsdFromCents(pending.listed_prize_usd_cents) : '—';
    if (match.winner_user_id === uid) return `You took the contest — prize tier was ${prize}.`;
    if (match.winner_user_id) return `Opponent took the contest — listed prize was ${prize}.`;
    if (match.score_a === match.score_b) return `Same score — listed prize was ${prize}.`;
    return `Final scores ${match.score_a}–${match.score_b} · listed prize ${prize}.`;
  }
  return '';
}

type Props = {
  userId: string;
};

/**
 * Lists the signed-in host’s async contest rows: score + stake held, prize on the line, and pending / won / lost.
 */
export function AsyncHostPendingRunsPanel({ userId }: Props) {
  const router = useRouter();
  const q = useMyAsyncHostPendingRuns(userId);

  if (!ENABLE_BACKEND) return null;
  if (q.isLoading || q.isError) return null;
  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  return (
    <LinearGradient colors={['rgba(99,102,241,0.22)', 'rgba(15,23,42,0.92)']} style={styles.wrap}>
      <View style={styles.headRow}>
        <SafeIonicons name="hourglass-outline" size={20} color="#c4b5fd" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: runitFont.black }]}>Contests waiting to settle</Text>
          <Text style={styles.sub}>
            Runs you locked without a live opponent — we keep your score and stake until someone joins this tier.
          </Text>
        </View>
      </View>
      {rows.map((row) => {
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

        return (
          <View key={row.pending.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.game}>{gameKeyLabel(row.pending.game_key)}</Text>
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
            <Text style={styles.detail}>{detailLine(userId, row)}</Text>
            {openMatch ? (
              <Pressable
                onPress={() => router.push(`/(app)/(tabs)/play/match/${row.match!.id}`)}
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
      })}
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
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: '#f8fafc', fontSize: 15, letterSpacing: 0.3 },
  sub: { color: 'rgba(203,213,225,0.9)', fontSize: 12, lineHeight: 17, marginTop: 4 },
  card: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(2,6,23,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  game: { flex: 1, color: '#e0e7ff', fontSize: 14, fontWeight: '800' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  scoreLine: { color: 'rgba(226,232,240,0.88)', fontSize: 13, marginBottom: 4 },
  scoreEm: { color: '#fef08a', fontWeight: '900' },
  metaLine: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 6 },
  detail: { color: 'rgba(148,163,184,0.92)', fontSize: 12, lineHeight: 17 },
  cta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  ctaTxt: { color: '#38bdf8', fontSize: 13, fontWeight: '800' },
});
