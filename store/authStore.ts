import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  setFromSession: (session: Session | null) => void;
  signOutLocal: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  setFromSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'signedIn' : 'signedOut',
    }),
  signOutLocal: () => set({ session: null, user: null, status: 'signedOut' }),
}));
