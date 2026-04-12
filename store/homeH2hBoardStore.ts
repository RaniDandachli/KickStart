import { create } from 'zustand';

import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { H2H_OPEN_GAMES } from '@/lib/homeOpenMatches';

const HOSTS = [
  'NeonFox',
  'PixelAce',
  'Jordan',
  'Maya',
  'Riley',
  'Sam',
  'Casey',
  'Alex',
  'Sky',
  'Volt',
] as const;

export type H2hBoardWaiter = {
  id: string;
  gameKey: (typeof H2H_OPEN_GAMES)[number]['gameKey'];
  tierIndex: number;
  hostLabel: string;
  postedAt: number;
};

function makeId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomTierIndex(): number {
  return Math.floor(Math.random() * MATCH_ENTRY_TIERS.length);
}

function randomHost(): string {
  return HOSTS[Math.floor(Math.random() * HOSTS.length)]!;
}

function randomGameKey(): (typeof H2H_OPEN_GAMES)[number]['gameKey'] {
  const g = H2H_OPEN_GAMES[Math.floor(Math.random() * H2H_OPEN_GAMES.length)]!;
  return g.gameKey;
}

/** FIFO-ish: longest waiting first feels fair for “who’s up next”. */
export function sortWaitersForDisplay(waiters: H2hBoardWaiter[]): H2hBoardWaiter[] {
  return [...waiters].sort((a, b) => a.postedAt - b.postedAt);
}

function seedSampleOpenRows(): H2hBoardWaiter[] {
  const out: H2hBoardWaiter[] = [];
  let n = 0;
  for (let i = 0; i < H2H_OPEN_GAMES.length; i++) {
    const g = H2H_OPEN_GAMES[i]!;
    const count = 1 + (i % 2);
    for (let j = 0; j < count; j++) {
      const tierIndex = (i + j * 2 + n) % MATCH_ENTRY_TIERS.length;
      out.push({
        id: `seed_${n++}`,
        gameKey: g.gameKey,
        tierIndex,
        hostLabel: HOSTS[(i + j) % HOSTS.length]!,
        postedAt: Date.now() - (((i * 3 + j * 5) % 24) + 1) * 60_000,
      });
    }
  }
  return out;
}

function randomNewWaiter(): H2hBoardWaiter {
  return {
    id: makeId(),
    gameKey: randomGameKey(),
    tierIndex: randomTierIndex(),
    hostLabel: randomHost(),
    postedAt: Date.now() - Math.floor(Math.random() * 8) * 60_000,
  };
}

/** When no one is queued yet — synthesize an open row so Quick Match still has a target tier/game. */
export function buildSyntheticWaiter(): H2hBoardWaiter {
  return {
    id: makeId(),
    gameKey: randomGameKey(),
    tierIndex: randomTierIndex(),
    hostLabel: randomHost(),
    postedAt: Date.now(),
  };
}

/** Sentinel id: real backend, empty board — Quick Match still enqueues with default game/tier. */
export const QUICK_MATCH_PLACEHOLDER_WAITER_ID = '__quick_match__';

/**
 * Quick Match: longest-waiting real row when backend is on; else demo board / synthetic.
 */
export function pickAnyOpenWaiterForQuickMatch(): H2hBoardWaiter {
  const st = useHomeH2hBoardStore.getState();
  if (!ENABLE_BACKEND) st.ensureOpenMatchBoard();
  const sorted = sortWaitersForDisplay(st.waiters);
  if (sorted.length > 0) return sorted[0]!;
  if (ENABLE_BACKEND) {
    return {
      id: QUICK_MATCH_PLACEHOLDER_WAITER_ID,
      gameKey: H2H_OPEN_GAMES[0]!.gameKey,
      tierIndex: 0,
      hostLabel: 'Matchmaking pool',
      postedAt: Date.now(),
    };
  }
  return buildSyntheticWaiter();
}

type HomeH2hBoardState = {
  waiters: H2hBoardWaiter[];
  /** Seed sample open rows until live lobby data exists. */
  ensureOpenMatchBoard: () => void;
  /** Replace board from Supabase `home_h2h_queue_board` (ENABLE_BACKEND). */
  replaceWaitersFromServer: (waiters: H2hBoardWaiter[]) => void;
  removeWaiter: (id: string) => void;
  /**
   * Simulates matches completing and new players queueing — removes “filled” slots
   * and occasionally adds a new waiter so the board keeps moving.
   */
  tickSimulation: () => void;
};

export const useHomeH2hBoardStore = create<HomeH2hBoardState>((set, get) => ({
  waiters: [],

  ensureOpenMatchBoard: () => {
    if (ENABLE_BACKEND) return;
    if (get().waiters.length > 0) return;
    set({ waiters: seedSampleOpenRows() });
  },

  replaceWaitersFromServer: (waiters) => set({ waiters }),

  removeWaiter: (id) => {
    if (id === QUICK_MATCH_PLACEHOLDER_WAITER_ID) return;
    set((s) => ({ waiters: s.waiters.filter((w) => w.id !== id) }));
  },

  tickSimulation: () => {
    if (ENABLE_BACKEND) return;
    const list = get().waiters;
    if (list.length === 0) {
      set({ waiters: seedSampleOpenRows() });
      return;
    }
    const r = Math.random();
    if (r < 0.38) {
      const victim = list[Math.floor(Math.random() * list.length)];
      if (victim) get().removeWaiter(victim.id);
    } else if (r < 0.62 && list.length < 24) {
      set({ waiters: [...get().waiters, randomNewWaiter()] });
    }
  },
}));
