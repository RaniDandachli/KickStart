import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchProfileBracketByIds, fetchTournamentBracket } from '@/services/api/tournaments';

export function useTournamentBracket(tournamentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tournamentBracket(tournamentId ?? ''),
    queryFn: async () => {
      const { rounds, matches, pods } = await fetchTournamentBracket(tournamentId!);
      const ids = matches.flatMap((m) => [m.player_a_id, m.player_b_id, m.winner_id].filter(Boolean) as string[]);
      const profileById = await fetchProfileBracketByIds(ids);
      return { rounds, matches, pods, profileById };
    },
    enabled: ENABLE_BACKEND && !!tournamentId,
  });
}
