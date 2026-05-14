import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchMyAsyncHostPendingWithMatches } from '@/services/api/h2hAsyncHostMyRuns';

export function useMyAsyncHostPendingRuns(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myAsyncHostPending(userId ?? ''),
    queryFn: () => fetchMyAsyncHostPendingWithMatches(userId!),
    enabled: Boolean(ENABLE_BACKEND && userId),
    staleTime: 15_000,
    refetchInterval: (q) => {
      const rows = q.state.data;
      if (!rows?.length) return false;
      const needs = rows.some((row) => {
        if (row.pending.status === 'waiting_opponent') return true;
        if (row.pending.status !== 'consumed' || !row.match) return false;
        return row.match.status !== 'completed' && row.match.status !== 'cancelled' && row.match.status !== 'void';
      });
      return needs ? 10_000 : false;
    },
  });
}
