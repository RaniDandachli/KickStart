import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfilePollingPaused } from '@/lib/profilePollingPause';
import { queryKeys } from '@/lib/queryKeys';
import { fetchProfileById } from '@/services/api/profiles';

/**
 * Poll interval for `profiles` (wallet_cents, prize_credits, etc.) while any `useProfile` subscriber is mounted.
 * Shared query key → one timer per signed-in user app-wide. Tune down for snappier UI, up to reduce API load.
 * Set to `false` below to disable polling and rely on focus/reconnect + `invalidateQueries` only.
 */
const PROFILE_REFETCH_INTERVAL_MS = 12_000;

export function useProfile(userId: string | undefined) {
  const pollingPaused = useProfilePollingPaused();
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => fetchProfileById(userId!),
    enabled: ENABLE_BACKEND && !!userId,
    refetchInterval:
      ENABLE_BACKEND && userId && !pollingPaused ? PROFILE_REFETCH_INTERVAL_MS : false,
    /** Pause interval ticks when the app is backgrounded (saves battery on mobile). */
    refetchIntervalInBackground: false,
  });
}
