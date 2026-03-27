import type { QueueKind } from '@/store/matchmakingStore';

/**
 * Supabase-ready adapter contract: swap mock for Realtime channel + Edge Function ticket flow.
 * TODO: Wire to `match_sessions` writes and authoritative server matchmaking.
 */
export interface MatchmakingService {
  startSearch: (userId: string, queue: QueueKind) => Promise<{ searchId: string }>;
  cancelSearch: (searchId: string) => Promise<void>;
  /** Subscribe to opponent found; unsubscribe cleanup returned. */
  onOpponentFound: (
    searchId: string,
    handler: (payload: { matchSessionId: string; opponentUserId: string }) => void
  ) => () => void;
}

export interface MatchSessionModel {
  id: string;
  mode: QueueKind | 'custom';
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  endsAt: number;
}
