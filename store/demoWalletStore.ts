import { create } from 'zustand';

/**
 * Local wallet simulation when `ENABLE_BACKEND` is false.
 * When you wire Supabase, replace with `recordMatchResult` + profile invalidation.
 */
const START_CENTS = 1240;

type DemoWalletState = {
  walletCents: number;
  addPrizeCents: (cents: number) => void;
  /** Head-to-head entry fee (demo). Returns false if balance too low. */
  trySpend: (cents: number) => boolean;
};

export const useDemoWalletStore = create<DemoWalletState>((set, get) => ({
  walletCents: START_CENTS,
  addPrizeCents: (cents) =>
    set((s) => ({
      walletCents: Math.max(0, s.walletCents + Math.floor(cents)),
    })),
  trySpend: (cents) => {
    const n = Math.max(0, Math.floor(cents));
    if (n <= 0) return true;
    const cur = get().walletCents;
    if (cur < n) return false;
    set({ walletCents: cur - n });
    return true;
  },
}));

export function resetDemoWalletForDev() {
  useDemoWalletStore.setState({ walletCents: START_CENTS });
}
