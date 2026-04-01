import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { computeLoseAtRound, todayYmdLocal } from '@/lib/dailyFreeTournament';

const STORAGE_KEY = '@kickclash/daily_free_tournament_v1';

export type DailyFreeTournamentPersist = {
  dayKey: string;
  loseAtRound: number;
  nextRound: number;
  eliminated: boolean;
};

type State = DailyFreeTournamentPersist & {
  hydrated: boolean;
  hydrate: (userKey: string) => Promise<void>;
  /** After a completed match (scripted win until elimination round). */
  recordMatchFinished: () => void;
  forcedOutcomeForCurrentMatch: () => 'win' | 'lose';
};

async function persistSlice(s: DailyFreeTournamentPersist): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const useDailyFreeTournamentStore = create<State>((set, get) => ({
  dayKey: '',
  loseAtRound: 6,
  nextRound: 1,
  eliminated: false,
  hydrated: false,

  hydrate: async (userKey: string) => {
    const today = todayYmdLocal();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DailyFreeTournamentPersist;
        if (parsed.dayKey === today && parsed.loseAtRound >= 2 && parsed.loseAtRound <= 8) {
          set({
            ...parsed,
            hydrated: true,
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
    set({ ...next, hydrated: true });
    await persistSlice(next);
  },

  forcedOutcomeForCurrentMatch: () => {
    const { nextRound, loseAtRound } = get();
    if (nextRound > loseAtRound) return 'lose';
    return nextRound < loseAtRound ? 'win' : 'lose';
  },

  recordMatchFinished: () => {
    const { nextRound, loseAtRound } = get();
    if (nextRound === loseAtRound) {
      set({ eliminated: true });
    } else {
      set({ nextRound: nextRound + 1 });
    }
    const snap = get();
    void persistSlice({
      dayKey: snap.dayKey,
      loseAtRound: snap.loseAtRound,
      nextRound: snap.nextRound,
      eliminated: snap.eliminated,
    });
  },
}));
