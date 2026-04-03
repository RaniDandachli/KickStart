import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { computeLoseAtRound, todayYmdLocal } from '@/lib/dailyFreeTournament';

const STORAGE_PREFIX = '@kickclash/daily_free_tournament_v2';

function storageKeyForUser(userId: string): string {
  return `${STORAGE_PREFIX}/${encodeURIComponent(userId)}`;
}

export type DailyFreeTournamentPersist = {
  dayKey: string;
  loseAtRound: number;
  nextRound: number;
  eliminated: boolean;
};

type State = DailyFreeTournamentPersist & {
  hydrated: boolean;
  /** User id this in-memory snapshot + persistence belongs to (matches last hydrate). */
  storageUserId: string;
  hydrate: (userKey: string) => Promise<void>;
  /** After a completed match (updates round / elimination). */
  recordMatchFinished: () => void;
  forcedOutcomeForCurrentMatch: () => 'win' | 'lose';
};

async function persistSlice(userId: string, s: DailyFreeTournamentPersist): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(storageKeyForUser(userId), JSON.stringify(s));
}

export const useDailyFreeTournamentStore = create<State>((set, get) => ({
  dayKey: '',
  loseAtRound: 6,
  nextRound: 1,
  eliminated: false,
  hydrated: false,
  storageUserId: '',

  hydrate: async (userKey: string) => {
    const today = todayYmdLocal();
    const prevUser = get().storageUserId;
    if (prevUser !== userKey) {
      set({
        storageUserId: userKey,
        hydrated: false,
        dayKey: '',
        nextRound: 1,
        eliminated: false,
        loseAtRound: 6,
      });
    }

    try {
      const raw = await AsyncStorage.getItem(storageKeyForUser(userKey));
      if (raw) {
        const parsed = JSON.parse(raw) as DailyFreeTournamentPersist;
        if (parsed.dayKey === today && parsed.loseAtRound >= 2 && parsed.loseAtRound <= 11) {
          set({
            ...parsed,
            hydrated: true,
            storageUserId: userKey,
          });
          return;
        }
      }
    } catch {
      /* fall through */
    }
    const loseAtRound = computeLoseAtRound(today, userKey);
    const next: DailyFreeTournamentPersist = {
      dayKey: today,
      loseAtRound,
      nextRound: 1,
      eliminated: false,
    };
    set({ ...next, hydrated: true, storageUserId: userKey });
    await persistSlice(userKey, next);
  },

  forcedOutcomeForCurrentMatch: () => {
    const { nextRound, loseAtRound } = get();
    if (nextRound > loseAtRound) return 'lose';
    return nextRound < loseAtRound ? 'win' : 'lose';
  },

  recordMatchFinished: () => {
    const { nextRound, loseAtRound } = get();
    const userId = get().storageUserId;
    if (nextRound === loseAtRound) {
      set({ eliminated: true });
    } else {
      set({ nextRound: nextRound + 1 });
    }
    const snap = get();
    void persistSlice(userId, {
      dayKey: snap.dayKey,
      loseAtRound: snap.loseAtRound,
      nextRound: snap.nextRound,
      eliminated: snap.eliminated,
    });
  },
}));
