import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchRecentTransactions } from '@/services/api/transactions';

export function useTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.transactions(userId ?? ''),
    queryFn: () => fetchRecentTransactions(userId!),
    enabled: ENABLE_BACKEND && !!userId,
  });
}
