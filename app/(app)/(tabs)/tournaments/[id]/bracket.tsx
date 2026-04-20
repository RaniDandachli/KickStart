import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { BracketEliminationBoard } from '@/features/tournaments/BracketEliminationBoard';
import { useTournamentBracket } from '@/hooks/useTournamentBracket';
import type { TournamentBracketMatch } from '@/services/api/tournaments';

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

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bq = useTournamentBracket(id);

  if (!id) {
    return (
      <Screen>
        <Text className="text-slate-400">Missing tournament.</Text>
      </Screen>
    );
  }

  if (bq.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color="#22d3ee" />
        <Text className="mt-3 text-sm text-slate-400">Loading bracket…</Text>
      </Screen>
    );
  }

  if (bq.error) {
    return (
      <Screen>
        <Text className="text-red-300">Could not load bracket</Text>
        <Text className="mt-2 text-sm text-slate-400">{bq.error.message}</Text>
      </Screen>
    );
  }

  const { matches, pods, profileById } = bq.data ?? {
    matches: [],
    pods: [],
    profileById: new Map(),
  };

  if (!matches.length) {
    return (
      <Screen>
        <Text className="mb-2 text-xs text-slate-400">Tournament {id}</Text>
        <Text className="text-base text-slate-200">No bracket yet</Text>
        <Text className="mt-2 text-sm text-slate-400">
          An admin can generate the bracket once enough players have joined (single elimination). For cups with
          unlimited signups, each generate call fills the next wave of unassigned entrants.
        </Text>
      </Screen>
    );
  }

  const livePods = pods.filter((p) => p.matches.length > 0);

  return (
    <Screen>
      <Text className="mb-2 text-xs text-slate-400">Tournament {id}</Text>
      {livePods.length > 1 ? (
        <Text className="mb-3 text-xs text-slate-500">{livePods.length} bracket waves · single elimination</Text>
      ) : livePods[0]?.rounds.length ? (
        <Text className="mb-3 text-xs text-slate-500">
          {livePods[0].rounds.length} round{livePods[0].rounds.length === 1 ? '' : 's'} · single elimination
        </Text>
      ) : null}

      {livePods.map((pod) => (
        <View key={pod.bracketPodIndex} className={livePods.length > 1 ? 'mb-8' : ''}>
          {livePods.length > 1 ? (
            <Text className="mb-2 text-sm font-bold text-cyan-300">Wave {pod.bracketPodIndex}</Text>
          ) : null}
          <BracketEliminationBoard matches={toBoardMatches(pod.matches)} profileById={profileById} />
        </View>
      ))}
    </Screen>
  );
}
