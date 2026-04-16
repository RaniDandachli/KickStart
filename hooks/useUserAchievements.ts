import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchUserAchievements } from '@/services/api/profiles';

export function useUserAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.userAchievements(userId ?? ''),
    queryFn: () => fetchUserAchievements(userId!),
    enabled: ENABLE_BACKEND && !!userId,
  });
}
