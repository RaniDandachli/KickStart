import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { BracketEliminationBoard } from '@/features/tournaments/BracketEliminationBoard';
import { buildEmptySingleEliminationSkeleton } from '@/features/tournaments/bracketPlaceholder';
import { useTournamentBracket } from '@/hooks/useTournamentBracket';
import type { TournamentBracketMatch } from '@/services/api/tournaments';

type Props = {
  tournamentId: string | undefined;
  /** Used for empty wireframe column count (default 8). */
  podSize: number;
};

function toBoardMatches(matches: TournamentBracketMatch[]) {
  return matches.map((m) => ({
    id: m.id,
    roundIndex: m.round_index,
    matchIndex: m.match_index,
    playerAId: m.player_a_id,
    playerBId: m.player_b_id,
    winnerId: m.winner_id,
  }));
}

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

  const emptyProfiles = new Map();

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Bracket</Text>
      <Text style={styles.sectionSub}>
        {showLive
          ? 'Live bracket waves update as admins generate each group of players.'
          : 'Preview layout — avatars and names appear after generateBracket runs for a wave.'}
      </Text>

      {bq.isLoading && ENABLE_BACKEND && tournamentId ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#FFD700" size="small" />
          <Text style={styles.loadingTxt}>Loading bracket…</Text>
        </View>
      ) : null}

      {bq.error && ENABLE_BACKEND && tournamentId ? (
        <Text style={styles.errTxt}>Could not load bracket ({bq.error.message})</Text>
      ) : null}

      {showLive && bq.data ? (
        bq.data.pods
          .filter((p) => p.matches.length > 0)
          .map((pod) => {
            const multi = bq.data!.pods.filter((x) => x.matches.length > 0).length > 1;
            return (
              <View key={pod.bracketPodIndex} style={styles.podBlock}>
                {multi ? <Text style={styles.podLabel}>Wave {pod.bracketPodIndex}</Text> : null}
                <BracketEliminationBoard
                  matches={toBoardMatches(pod.matches)}
                  profileById={bq.data!.profileById}
                />
              </View>
            );
          })
      ) : (
        <View style={styles.skeletonCard}>
          <BracketEliminationBoard matches={skeleton} profileById={emptyProfiles} skeleton />
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
    borderColor: 'rgba(255,215,0,0.28)',
    backgroundColor: 'rgba(8,12,24,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  podBlock: { marginBottom: 14, gap: 6 },
  podLabel: { color: '#FFD700', fontSize: 13, fontWeight: '800' },
});
