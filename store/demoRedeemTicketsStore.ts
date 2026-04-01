import { create } from 'zustand';

/**
 * Tickets used only to **redeem** catalog prizes — not for arcade entry.
 * Live app: `profiles.redeem_tickets` (see supabase/migrations/00001_schema.sql).
 */
const START_REDEEM_TICKETS = 5;

type State = {
  tickets: number;
  trySpend: (amount: number) => boolean;
  add: (amount: number) => void;
};

export const useDemoRedeemTicketsStore = create<State>((set, get) => ({
  tickets: START_REDEEM_TICKETS,
  trySpend: (amount) => {
    const n = Math.max(0, Math.floor(amount));
    if (n <= 0) return true;
    const cur = get().tickets;
    if (cur < n) return false;
    set({ tickets: cur - n });
    return true;
  },
  add: (amount) =>
    set((s) => ({
      tickets: Math.max(0, s.tickets + Math.floor(amount)),
    })),
}));
