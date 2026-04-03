import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isUuid } from '@/lib/isUuid';
import { queryKeys } from '@/lib/queryKeys';
import { fetchMatchSessionWithPlayers, type MatchSessionWithPlayers } from '@/services/api/h2hMatchSession';

export function useMatchSessionWithPlayers(matchId: string | undefined) {
  return useQuery<MatchSessionWithPlayers | null>({
    queryKey: queryKeys.matchSession(matchId ?? ''),
    queryFn: () => fetchMatchSessionWithPlayers(matchId!),
    enabled: ENABLE_BACKEND && !!matchId && isUuid(matchId),
  });
}
