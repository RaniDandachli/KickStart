import { create } from 'zustand';

/** Set by `applyArcadePrizeCreditGrants` via tabs layout; Arcade hub reads for a one-time banner. */
type State = {
  welcome: number;
  daily: number;
  setGrants: (w: number, d: number) => void;
  clear: () => void;
};

export const useArcadeGrantBannerStore = create<State>((set) => ({
  welcome: 0,
  daily: 0,
  setGrants: (welcome, daily) => set({ welcome, daily }),
  clear: () => set({ welcome: 0, daily: 0 }),
}));
