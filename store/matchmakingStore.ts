import { create } from 'zustand';

import type { H2hQueuePollPayload, MatchmakingAcceptRoute } from '@/features/play/matchmakingTypes';

export type QueueKind = 'casual' | 'ranked' | 'custom';

export interface MatchOpponentPreview {
  id: string;
  username: string;
  rating: number;
  region: string;
  /** From `profile_fight_stats` when available — for Match found UI. */
  wins?: number;
  losses?: number;
  matchesPlayed?: number;
}

/** Live 1v1 session after accept — survives until result screen clears it. */
export type ActiveMatchSession = {
  matchId: string;
  opponent: MatchOpponentPreview;
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  /** Free casual run: no fee/prize; opponent controls hidden in stub match (no “bot” copy). */
  casualFree?: boolean;
};

interface MatchmakingState {
  queue: QueueKind | null;
  phase: 'idle' | 'searching' | 'found' | 'lobby' | 'in_match';
  mockMatchId: string | null;
  opponent: MatchOpponentPreview | null;
  /**
   * When true, `mockMatchId` is already a real `match_sessions` row (e.g. from `h2h_enqueue_or_match`);
   * accept must not call createH2hMatchSession again.
   */
  serverSessionReady: boolean;
  /** Set when player accepts match found — lobby / match / result read this. */
  activeMatch: ActiveMatchSession | null;
  /**
   * When true, leaving the queue route does not cancel the server wait (user opted in).
   * Polling + realtime run in `MatchmakingQueueRunner`.
   */
  keepSearchingWhenAway: boolean;
  /** Latest RPC params for `h2h_enqueue_or_match` / Quick Match — kept in sync while searching. */
  queuePollSnapshot: H2hQueuePollPayload | null;
  /** Route + wallet context for accepting a match when the modal is hosted globally. */
  matchmakingAcceptRoute: MatchmakingAcceptRoute | null;
  setQueue: (q: QueueKind | null) => void;
  setPhase: (p: MatchmakingState['phase']) => void;
  setFound: (matchId: string, opponent: MatchOpponentPreview, opts?: { serverSessionReady?: boolean }) => void;
  setActiveMatch: (m: ActiveMatchSession | null) => void;
  setKeepSearchingWhenAway: (v: boolean) => void;
  setQueuePollSnapshot: (p: H2hQueuePollPayload | null) => void;
  setMatchmakingAcceptRoute: (r: MatchmakingAcceptRoute | null) => void;
  reset: () => void;
}

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  queue: null,
  phase: 'idle',
  mockMatchId: null,
  opponent: null,
  serverSessionReady: false,
  activeMatch: null,
  keepSearchingWhenAway: false,
  queuePollSnapshot: null,
  matchmakingAcceptRoute: null,
  setQueue: (queue) => set({ queue }),
  setPhase: (phase) => set({ phase }),
  setFound: (mockMatchId, opponent, opts) =>
    set({
      mockMatchId,
      opponent,
      phase: 'found',
      serverSessionReady: opts?.serverSessionReady === true,
    }),
  setActiveMatch: (activeMatch) => set({ activeMatch }),
  setKeepSearchingWhenAway: (keepSearchingWhenAway) => set({ keepSearchingWhenAway }),
  setQueuePollSnapshot: (queuePollSnapshot) => set({ queuePollSnapshot }),
  setMatchmakingAcceptRoute: (matchmakingAcceptRoute) => set({ matchmakingAcceptRoute }),
  reset: () =>
    set({
      queue: null,
      phase: 'idle',
      mockMatchId: null,
      opponent: null,
      serverSessionReady: false,
      activeMatch: null,
      keepSearchingWhenAway: false,
      queuePollSnapshot: null,
      matchmakingAcceptRoute: null,
    }),
}));
