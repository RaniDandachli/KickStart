import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchActiveSeason } from '@/services/api/seasons';

export function useActiveSeason() {
  return useQuery({
    queryKey: queryKeys.seasonActive(),
    queryFn: fetchActiveSeason,
    enabled: ENABLE_BACKEND,
  });
}
