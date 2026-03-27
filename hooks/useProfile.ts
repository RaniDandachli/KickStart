import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchProfileById } from '@/services/api/profiles';

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => fetchProfileById(userId!),
    enabled: ENABLE_BACKEND && !!userId,
  });
}
