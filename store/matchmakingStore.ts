import { create } from 'zustand';

export type QueueKind = 'casual' | 'ranked' | 'custom';

export interface MatchOpponentPreview {
  id: string;
  username: string;
  rating: number;
  region: string;
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
  /** Set when player accepts match found — lobby / match / result read this. */
  activeMatch: ActiveMatchSession | null;
  setQueue: (q: QueueKind | null) => void;
  setPhase: (p: MatchmakingState['phase']) => void;
  setFound: (matchId: string, opponent: MatchOpponentPreview) => void;
  setActiveMatch: (m: ActiveMatchSession | null) => void;
  reset: () => void;
}

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  queue: null,
  phase: 'idle',
  mockMatchId: null,
  opponent: null,
  activeMatch: null,
  setQueue: (queue) => set({ queue }),
  setPhase: (phase) => set({ phase }),
  setFound: (mockMatchId, opponent) => set({ mockMatchId, opponent, phase: 'found' }),
  setActiveMatch: (activeMatch) => set({ activeMatch }),
  reset: () =>
    set({
      queue: null,
      phase: 'idle',
      mockMatchId: null,
      opponent: null,
      activeMatch: null,
    }),
}));
