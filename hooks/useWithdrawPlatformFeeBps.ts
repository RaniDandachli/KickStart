import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchWithdrawPlatformFeeBps } from '@/services/wallet/withdrawFeeBps';

/** Cash-out fee basis points from Supabase (operators set `platform_economy.withdraw_platform_fee_bps`). */
export function useWithdrawPlatformFeeBps(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.withdrawPlatformFeeBps(),
    queryFn: fetchWithdrawPlatformFeeBps,
    enabled: ENABLE_BACKEND && !!userId,
    staleTime: 120_000,
  });
}
