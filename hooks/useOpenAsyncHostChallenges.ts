import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchOpenAsyncHostChallenges } from '@/services/api/h2hAsyncHostOpenChallenges';

export function useOpenAsyncHostChallenges(userId: string | undefined, gameKey?: string | null) {
  const gk = gameKey?.trim() ? gameKey.trim().toLowerCase() : null;
  return useQuery({
    queryKey: queryKeys.openAsyncHostChallenges(gk),
    queryFn: () => fetchOpenAsyncHostChallenges({ gameKey: gk, limit: 50, excludeHostUserId: userId }),
    enabled: Boolean(ENABLE_BACKEND && userId),
    staleTime: 12_000,
    refetchInterval: 20_000,
  });
}
