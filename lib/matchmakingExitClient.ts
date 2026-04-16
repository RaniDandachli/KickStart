import type { QueryClient } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isUuid } from '@/lib/isUuid';
import { queryKeys } from '@/lib/queryKeys';
import { h2hAbandonMatchSessionRpc } from '@/services/api/h2hMatchSession';
import { h2hCancelQueue } from '@/services/matchmaking/h2hQueue';
import { useAuthStore } from '@/store/authStore';

export type MatchmakingExitSnapshot = {
  phase: 'searching' | 'found';
  mockMatchId: string | null;
  serverSessionReady: boolean;
};

/**
 * Remove `h2h_queue_entries` waiter row; if the user had already been paired into a real `match_sessions` row
 * but did not accept, cancel that lobby so the other player is not stuck and the board stays accurate.
 */
export async function syncExitMatchmakingToServer(qc: QueryClient, snapshot: MatchmakingExitSnapshot): Promise<void> {
  if (!ENABLE_BACKEND) return;
  const uid = useAuthStore.getState().user?.id;
  if (!uid || uid === 'guest') return;
  try {
    await h2hCancelQueue();
  } catch {
    /* still try abandon */
  }
  if (
    snapshot.phase === 'found' &&
    snapshot.serverSessionReady &&
    snapshot.mockMatchId &&
    isUuid(snapshot.mockMatchId)
  ) {
    try {
      await h2hAbandonMatchSessionRpc(snapshot.mockMatchId);
    } catch {
      /* network */
    }
  }
  await qc.invalidateQueries({ queryKey: queryKeys.homeH2hBoard() });
}
