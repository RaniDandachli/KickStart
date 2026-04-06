import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchProfileFightStats } from '@/services/api/profileFightStats';

export function useProfileFightStats(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.userStats(userId ?? ''),
    queryFn: () => fetchProfileFightStats(userId!),
    enabled: ENABLE_BACKEND && !!userId,
    staleTime: 20_000,
    retry: 1,
  });
}
