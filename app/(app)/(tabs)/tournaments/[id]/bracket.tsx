import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { BracketTreePreview, type BracketMatchPreview } from '@/features/tournaments/BracketTreePreview';
import { useTournamentBracket } from '@/hooks/useTournamentBracket';
import type { BracketPlayer } from '@/utils/bracket';

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

  const { rounds, matches, labels } = bq.data ?? { rounds: [], matches: [], labels: new Map() };

  if (!matches.length) {
    return (
      <Screen>
        <Text className="mb-2 text-xs text-slate-400">Tournament {id}</Text>
        <Text className="text-base text-slate-200">No bracket yet</Text>
        <Text className="mt-2 text-sm text-slate-400">
          An admin can generate the bracket once enough players have joined (single elimination).
        </Text>
      </Screen>
    );
  }

  const r0 = matches
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

  const previewMatches: BracketMatchPreview[] = matches.map((m) => ({
    id: m.id,
    roundIndex: m.round_index,
    a: m.player_a_id ? labels.get(m.player_a_id) ?? m.player_a_id.slice(0, 8) : undefined,
    b: m.player_b_id ? labels.get(m.player_b_id) ?? m.player_b_id.slice(0, 8) : undefined,
    winner: m.winner_id ? labels.get(m.winner_id) : undefined,
  }));

  return (
    <Screen>
      <Text className="mb-2 text-xs text-slate-400">Tournament {id}</Text>
      {rounds.length ? (
        <Text className="mb-3 text-xs text-slate-500">
          {rounds.length} round{rounds.length === 1 ? '' : 's'} · single elimination
        </Text>
      ) : null}
      <BracketTreePreview players={players} matches={previewMatches} />
    </Screen>
  );
}
