import type { QueryClient } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { getSupabase } from '@/supabase/client';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';

export type GrantArcadePrizeCreditsParams = {
  amount: number;
  cupId: string;
  dayKey: string;
  userId: string;
  queryClient?: QueryClient;
};

/**
 * Credits a user's `profiles.prize_credits` once per idempotency key (cup + day + user).
 * Guest mode: updates on-device Arcade Credits only.
 */
export async function grantArcadePrizeCredits(params: GrantArcadePrizeCreditsParams): Promise<{
  ok: boolean;
  duplicate?: boolean;
  error?: string;
}> {
  const { amount, cupId, dayKey, userId, queryClient } = params;
  const allowed = [1000, 2000, 3000, 4000, 5000];
  if (!allowed.includes(amount)) {
    return { ok: false, error: 'invalid_amount' };
  }

  if (!ENABLE_BACKEND || userId === 'guest') {
    useDemoPrizeCreditsStore.getState().add(amount);
    if (queryClient && userId && userId !== 'guest') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    }
    return { ok: true };
  }

  const idempotencyKey = `cup_${cupId}_${dayKey}_${userId}`;
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('grant_arcade_prize_credits', {
    p_amount: amount,
    p_description: `Credit cup win: ${cupId}`,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as { ok?: boolean; duplicate?: boolean } | null;
  if (queryClient && userId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  }

  if (row?.ok === false) {
    return { ok: false, error: 'rpc_rejected' };
  }
  return { ok: true, duplicate: row?.duplicate === true };
}
