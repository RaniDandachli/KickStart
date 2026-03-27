import { create } from 'zustand';

export type QueueKind = 'casual' | 'ranked' | 'custom';

export interface MatchOpponentPreview {
  id: string;
  username: string;
  rating: number;
  region: string;
}

interface MatchmakingState {
  queue: QueueKind | null;
  phase: 'idle' | 'searching' | 'found' | 'lobby' | 'in_match';
  mockMatchId: string | null;
  opponent: MatchOpponentPreview | null;
  setQueue: (q: QueueKind | null) => void;
  setPhase: (p: MatchmakingState['phase']) => void;
  setFound: (matchId: string, opponent: MatchOpponentPreview) => void;
  reset: () => void;
}

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  queue: null,
  phase: 'idle',
  mockMatchId: null,
  opponent: null,
  setQueue: (queue) => set({ queue }),
  setPhase: (phase) => set({ phase }),
  setFound: (mockMatchId, opponent) => set({ mockMatchId, opponent, phase: 'found' }),
  reset: () =>
    set({
      queue: null,
      phase: 'idle',
      mockMatchId: null,
      opponent: null,
    }),
}));
