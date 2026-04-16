import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchProfileDisplayByIds, fetchTournamentBracket } from '@/services/api/tournaments';

export function useTournamentBracket(tournamentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tournamentBracket(tournamentId ?? ''),
    queryFn: async () => {
      const { rounds, matches } = await fetchTournamentBracket(tournamentId!);
      const ids = matches.flatMap((m) => [m.player_a_id, m.player_b_id, m.winner_id].filter(Boolean) as string[]);
      const labels = await fetchProfileDisplayByIds(ids);
      return { rounds, matches, labels };
    },
    enabled: ENABLE_BACKEND && !!tournamentId,
  });
}
