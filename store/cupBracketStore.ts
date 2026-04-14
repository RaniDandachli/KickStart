import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { cupBracketStorageKey } from '@/lib/cupBracketStorage';
import { computeCupLoseAtRound } from '@/lib/cupTournaments';
import { todayYmdLocal } from '@/lib/dailyFreeTournament';

export type CupBracketPersist = {
  cupId: string;
  dayKey: string;
  loseAtRound: number;
  nextRound: number;
  eliminated: boolean;
};

type State = CupBracketPersist & {
  hydrated: boolean;
  storageUserId: string;
  activeCupId: string;
  hydrate: (userKey: string, cupId: string) => Promise<void>;
  recordMatchFinished: () => void;
  forcedOutcomeForCurrentMatch: () => 'win' | 'lose';
};

async function persistSlice(userId: string, cupId: string, s: CupBracketPersist): Promise<void> {
  if (!userId || !cupId) return;
  await AsyncStorage.setItem(cupBracketStorageKey(userId, cupId), JSON.stringify(s));
}

export const useCupBracketStore = create<State>((set, get) => ({
  cupId: '',
  dayKey: '',
  loseAtRound: 6,
  nextRound: 1,
  eliminated: false,
  hydrated: false,
  storageUserId: '',
  activeCupId: '',

  hydrate: async (userKey: string, cupId: string) => {
    const today = todayYmdLocal();
    const prevUser = get().storageUserId;
    const prevCup = get().activeCupId;
    if (prevUser !== userKey || prevCup !== cupId) {
      set({
        storageUserId: userKey,
        activeCupId: cupId,
        cupId,
        hydrated: false,
        dayKey: '',
        nextRound: 1,
        eliminated: false,
        loseAtRound: 6,
      });
    }

    try {
      const raw = await AsyncStorage.getItem(cupBracketStorageKey(userKey, cupId));
      if (raw) {
        const parsed = JSON.parse(raw) as CupBracketPersist;
        if (
          parsed.cupId === cupId &&
          parsed.dayKey === today &&
          parsed.loseAtRound >= 2 &&
          parsed.loseAtRound <= 11
        ) {
          set({
            ...parsed,
            hydrated: true,
            storageUserId: userKey,
            activeCupId: cupId,
          });
          return;
        }
      }
    } catch {
      /* fall through */
    }
    const loseAtRound = computeCupLoseAtRound(today, userKey, cupId);
    const next: CupBracketPersist = {
      cupId,
      dayKey: today,
      loseAtRound,
      nextRound: 1,
      eliminated: false,
    };
    set({ ...next, hydrated: true, storageUserId: userKey, activeCupId: cupId });
    await persistSlice(userKey, cupId, next);
  },

  forcedOutcomeForCurrentMatch: () => {
    const { nextRound, loseAtRound } = get();
    if (nextRound > loseAtRound) return 'lose';
    return nextRound < loseAtRound ? 'win' : 'lose';
  },

  recordMatchFinished: () => {
    const { nextRound, loseAtRound } = get();
    const userId = get().storageUserId;
    const cupId = get().activeCupId;
    if (nextRound === loseAtRound) {
      set({ eliminated: true });
    } else {
      set({ nextRound: nextRound + 1 });
    }
    const snap = get();
    void persistSlice(userId, cupId, {
      cupId: snap.cupId,
      dayKey: snap.dayKey,
      loseAtRound: snap.loseAtRound,
      nextRound: snap.nextRound,
      eliminated: snap.eliminated,
    });
  },
}));
