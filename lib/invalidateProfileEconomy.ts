import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';

/** Refetch profile after server updates `prize_credits` / `redeem_tickets` (minigame prize runs, wallet, etc.). */
export function invalidateProfileEconomy(queryClient: QueryClient, userId: string | undefined): void {
  if (!userId) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
}
