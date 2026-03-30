import { create } from 'zustand';

/** Guest / offline demo balance — mirrors `profiles.prize_credits` when backend is off. */
const START_PRIZE_CREDITS = 1240;

type State = {
  credits: number;
  /** Returns false if balance too low. */
  trySpend: (amount: number) => boolean;
  /** Award after wins / grants. */
  add: (amount: number) => void;
};

export const useDemoPrizeCreditsStore = create<State>((set, get) => ({
  credits: START_PRIZE_CREDITS,
  trySpend: (amount) => {
    const n = Math.max(0, Math.floor(amount));
    if (n <= 0) return true;
    const cur = get().credits;
    if (cur < n) return false;
    set({ credits: cur - n });
    return true;
  },
  add: (amount) =>
    set((s) => ({
      credits: Math.max(0, s.credits + Math.floor(amount)),
    })),
}));
