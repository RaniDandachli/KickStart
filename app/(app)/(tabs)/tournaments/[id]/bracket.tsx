import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { BracketTreePreview } from '@/features/tournaments/BracketTreePreview';
import type { BracketPlayer } from '@/utils/bracket';
import { pairPlayersForRound } from '@/utils/bracket';

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const players: BracketPlayer[] = [
    { id: 'p1', seed: 1 },
    { id: 'p2', seed: 2 },
    { id: 'p3', seed: 3 },
    { id: 'p4', seed: 4 },
  ];
  const slots = pairPlayersForRound(players);
  const matches = slots.map((s, i) => ({
    id: `m${i}`,
    roundIndex: 0,
    a: s.playerAId ?? undefined,
    b: s.playerBId ?? undefined,
  }));

  return (
    <Screen>
      <Text className="mb-2 text-xs text-white/40">Tournament {id}</Text>
      <BracketTreePreview players={players} matches={matches} />
      <Text className="mt-4 text-sm text-white/50">
        TODO: Replace mock bracket with `tournament_matches` + `generateBracket` Edge output.
      </Text>
    </Screen>
  );
}
