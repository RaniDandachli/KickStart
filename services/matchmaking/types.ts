import type { QueueKind } from '@/store/matchmakingStore';

/**
 * Production H2H uses Supabase queue RPCs + Realtime on `match_sessions` (see `h2hEnqueueOrMatch`, `useH2hQueueMatchSignals`).
 * Lockstep / WebRTC P2P would require a relay or native `react-native-webrtc` and is not part of this async skill-contest flow.
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
