import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchActivePrizeCatalog } from '@/services/api/prizes';

export function usePrizeCatalog() {
  return useQuery({
    queryKey: queryKeys.prizeCatalog(),
    queryFn: fetchActivePrizeCatalog,
    enabled: ENABLE_BACKEND,
  });
}
