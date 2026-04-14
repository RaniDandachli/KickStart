import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { todayYmdLocal } from '@/lib/dailyFreeTournament';

const STORAGE_PREFIX = '@kickclash/cup_daily_run_v1';

function storageKeyFor(userId: string): string {
  return `${STORAGE_PREFIX}/${encodeURIComponent(userId)}`;
}

export type CupDailyRunPersist = {
  dayKey: string;
  /** First cup the user starts a match in today; other cups stay locked until tomorrow. */
  committedCupId: string | null;
};

type State = CupDailyRunPersist & {
  hydrated: boolean;
  storageUserId: string;
  hydrate: (userKey: string) => Promise<void>;
  /**
   * Call when entering a cup play screen. Locks the daily run to that cup if not already set.
   * Returns false if today's run was already committed to a different cup.
   */
  tryCommitCup: (userKey: string, cupId: string) => Promise<{ ok: true } | { ok: false; committedTo: string }>;
};

async function persist(userId: string, s: CupDailyRunPersist): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(storageKeyFor(userId), JSON.stringify(s));
}

export const useCupDailyRunStore = create<State>((set, get) => ({
  dayKey: '',
  committedCupId: null,
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
        committedCupId: null,
      });
    }

    try {
      const raw = await AsyncStorage.getItem(storageKeyFor(userKey));
      if (raw) {
        const parsed = JSON.parse(raw) as CupDailyRunPersist;
        if (parsed.dayKey === today && (parsed.committedCupId === null || typeof parsed.committedCupId === 'string')) {
          set({
            dayKey: parsed.dayKey,
            committedCupId: parsed.committedCupId,
            hydrated: true,
            storageUserId: userKey,
          });
          return;
        }
      }
    } catch {
      /* fall through */
    }

    const next: CupDailyRunPersist = { dayKey: today, committedCupId: null };
    set({ ...next, hydrated: true, storageUserId: userKey });
    await persist(userKey, next);
  },

  tryCommitCup: async (userKey: string, cupId: string) => {
    await get().hydrate(userKey);
    const { dayKey, committedCupId } = get();
    if (committedCupId === null) {
      set({ committedCupId: cupId });
      await persist(userKey, { dayKey, committedCupId: cupId });
      return { ok: true };
    }
    if (committedCupId === cupId) return { ok: true };
    return { ok: false, committedTo: committedCupId };
  },
}));
