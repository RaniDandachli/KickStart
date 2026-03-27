import type { MatchmakingService } from '@/services/matchmaking/types';

/** Deterministic mock delays for UX scaffolding */
const FOUND_MS = 1800;

export function createMockMatchmakingService(): MatchmakingService {
  const listeners = new Map<string, (p: { matchSessionId: string; opponentUserId: string }) => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    async startSearch(userId, _queue) {
      const searchId = `search_${userId}_${Date.now()}`;
      const t = setTimeout(() => {
        const cb = listeners.get(searchId);
        cb?.({
          matchSessionId: `mock_match_${Date.now()}`,
          opponentUserId: 'mock_opponent_1',
        });
        timers.delete(searchId);
      }, FOUND_MS);
      timers.set(searchId, t);
      return { searchId };
    },

    async cancelSearch(searchId) {
      const t = timers.get(searchId);
      if (t) clearTimeout(t);
      timers.delete(searchId);
      listeners.delete(searchId);
    },

    onOpponentFound(searchId, handler) {
      listeners.set(searchId, handler);
      return () => listeners.delete(searchId);
    },
  };
}

export const mockMatchmakingSingleton = createMockMatchmakingService();
