import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchRecentMatchFeed } from '@/services/api/recentMatches';

export function useRecentMatches(userId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.recentMatches(userId ?? ''), limit] as const,
    queryFn: () => fetchRecentMatchFeed(limit),
    enabled: ENABLE_BACKEND && !!userId,
    staleTime: 20_000,
    retry: 1,
  });
}
