import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { fetchAsyncBattleBoard } from '@/services/api/h2hAsyncHostOpenChallenges';
import { queryKeys } from '@/lib/queryKeys';

export function useAsyncBattleBoard(userId: string | undefined, gameKey?: string | null) {
  const gk = gameKey?.trim() ? gameKey.trim().toLowerCase() : null;
  return useQuery({
    queryKey: queryKeys.asyncBattleBoard(gk, userId ?? ''),
    queryFn: () => fetchAsyncBattleBoard({ userId: userId!, gameKey: gk, limit: 50 }),
    enabled: Boolean(ENABLE_BACKEND && userId),
    staleTime: 8_000,
    refetchInterval: 15_000,
  });
}

/** @deprecated use useAsyncBattleBoard */
export function useOpenAsyncHostChallenges(userId: string | undefined, gameKey?: string | null) {
  const q = useAsyncBattleBoard(userId, gameKey);
  return {
    ...q,
    data: q.data?.rows.filter((r) => !r.isOwnPostedRun),
  };
}
