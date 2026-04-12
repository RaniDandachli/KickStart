import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { fetchHomeH2hQueueBoardWaiters } from '@/services/api/homeH2hQueueBoard';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Live H2H waiters for Home carousel/list (Supabase `h2h_queue_entries`).
 * When `ENABLE_BACKEND` is false, the query is disabled — use the demo zustand board instead.
 */
export function useHomeH2hQueueBoard() {
  return useQuery({
    queryKey: queryKeys.homeH2hBoard(),
    queryFn: fetchHomeH2hQueueBoardWaiters,
    enabled: ENABLE_BACKEND,
    staleTime: 4_000,
    refetchInterval: ENABLE_BACKEND ? 5_000 : false,
  });
}
