import { create } from 'zustand';

import { trackProductEvent } from '@/lib/analytics/productAnalytics';

/** Guest start balance before welcome/daily grants (`applyArcadePrizeCreditGrants`). */
const START_PRIZE_CREDITS = 0;

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
    trackProductEvent('arcade_credit_spend', { credits: n, source: 'guest_device' });
    return true;
  },
  add: (amount) =>
    set((s) => ({
      credits: Math.max(0, s.credits + Math.floor(amount)),
    })),
}));
