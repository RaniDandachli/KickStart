import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { BracketTreePreview, type BracketMatchPreview } from '@/features/tournaments/BracketTreePreview';
import { buildEmptySingleEliminationSkeleton } from '@/features/tournaments/bracketPlaceholder';
import { useTournamentBracket } from '@/hooks/useTournamentBracket';
import type { BracketPlayer } from '@/utils/bracket';

type Props = {
  tournamentId: string | undefined;
  /** Used for empty wireframe column count (default 8). */
  podSize: number;
};

/**
 * Friday cup: always shows an 8-slot single-elimination wireframe; fills with live pods when configured.
 */
export function FridayCupBracketSection({ tournamentId, podSize }: Props) {
  const skeleton = buildEmptySingleEliminationSkeleton(podSize);
  const bq = useTournamentBracket(tournamentId);

  const showLive =
    ENABLE_BACKEND &&
    tournamentId &&
    !bq.isLoading &&
    !bq.error &&
    bq.data?.pods?.length &&
    bq.data.pods.some((p) => p.matches.length > 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Bracket</Text>
      <Text style={styles.sectionSub}>
        {showLive
          ? 'Live bracket waves update as admins generate each group of players.'
          : 'Empty bracket — names appear after the first bracket is generated (each wave is up to ' + podSize + ' players).'}
      </Text>

      {bq.isLoading && ENABLE_BACKEND && tournamentId ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#22d3ee" size="small" />
          <Text style={styles.loadingTxt}>Loading bracket…</Text>
        </View>
      ) : null}

      {bq.error && ENABLE_BACKEND && tournamentId ? (
        <Text style={styles.errTxt}>Could not load bracket ({bq.error.message})</Text>
      ) : null}

      {showLive && bq.data
        ? bq.data.pods
            .filter((p) => p.matches.length > 0)
            .map((pod) => {
              const labels = bq.data!.labels;
              const r0 = pod.matches
                .filter((m) => m.round_index === 0)
                .sort((a, b) => a.match_index - b.match_index);
              const players: BracketPlayer[] = [];
              let seed = 1;
              const seen = new Set<string>();
              for (const m of r0) {
                for (const pid of [m.player_a_id, m.player_b_id]) {
                  if (pid && !seen.has(pid)) {
                    seen.add(pid);
                    players.push({ id: pid, seed: seed++ });
                  }
                }
              }
              const previewMatches: BracketMatchPreview[] = pod.matches.map((m) => ({
                id: m.id,
                roundIndex: m.round_index,
                a: m.player_a_id ? labels.get(m.player_a_id) ?? m.player_a_id.slice(0, 8) : undefined,
                b: m.player_b_id ? labels.get(m.player_b_id) ?? m.player_b_id.slice(0, 8) : undefined,
                winner: m.winner_id ? labels.get(m.winner_id) : undefined,
              }));
              const multi = bq.data!.pods.filter((x) => x.matches.length > 0).length > 1;
              return (
                <View key={pod.bracketPodIndex} style={styles.podBlock}>
                  {multi ? (
                    <Text style={styles.podLabel}>Wave {pod.bracketPodIndex}</Text>
                  ) : null}
                  <BracketTreePreview hideTitle players={players} matches={previewMatches} />
                </View>
              );
            })
        : (
            <View style={styles.skeletonCard}>
              <BracketTreePreview hideTitle players={[]} matches={skeleton} />
            </View>
          )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18, gap: 8 },
  sectionTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  sectionSub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  loadingTxt: { color: 'rgba(148,163,184,0.9)', fontSize: 12 },
  errTxt: { color: 'rgba(248,113,113,0.95)', fontSize: 12, marginBottom: 6 },
  skeletonCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(8,12,24,0.55)',
    padding: 12,
  },
  podBlock: { marginBottom: 14, gap: 6 },
  podLabel: { color: '#22d3ee', fontSize: 13, fontWeight: '800' },
});
