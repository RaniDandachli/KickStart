import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchLeaderboard } from '@/services/api/leaderboard';

export function useLeaderboard(params: {
  seasonId: string | null;
  scope: 'global' | 'regional' | 'friends';
  region: string;
}) {
  return useQuery({
    queryKey: queryKeys.leaderboard(params.scope, params.seasonId, params.region),
    queryFn: () => fetchLeaderboard(params),
    enabled: ENABLE_BACKEND,
  });
}
