import { create } from 'zustand';

import { H2H_OPEN_GAMES } from '@/lib/homeOpenMatches';

export type H2hBoardWaiter = {
  id: string;
  gameKey: (typeof H2H_OPEN_GAMES)[number]['gameKey'];
  tierIndex: number;
  hostLabel: string;
  postedAt: number;
  /** From `home_h2h_queue_board` — use for queue URLs so RPC params match the DB row exactly. */
  entryFeeWalletCents?: number;
  listedPrizeUsdCents?: number;
};

/** FIFO-ish: longest waiting first feels fair for “who’s up next”. */
export function sortWaitersForDisplay(waiters: H2hBoardWaiter[]): H2hBoardWaiter[] {
  return [...waiters].sort((a, b) => a.postedAt - b.postedAt);
}

/** Placeholder id for client-only bookkeeping (not a Supabase queue row). */
export const QUICK_MATCH_PLACEHOLDER_WAITER_ID = '__quick_match__';

type HomeH2hBoardState = {
  waiters: H2hBoardWaiter[];
  /** Replace board from Supabase `home_h2h_queue_board`. */
  replaceWaitersFromServer: (waiters: H2hBoardWaiter[]) => void;
  removeWaiter: (id: string) => void;
};

export const useHomeH2hBoardStore = create<HomeH2hBoardState>((set) => ({
  waiters: [],

  replaceWaitersFromServer: (waiters) => set({ waiters }),

  removeWaiter: (id) => {
    if (id === QUICK_MATCH_PLACEHOLDER_WAITER_ID) return;
    set((s) => ({ waiters: s.waiters.filter((w) => w.id !== id) }));
  },
}));
