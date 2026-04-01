import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';

/**
 * Subscribes to Supabase auth and mirrors into Zustand for routing + selectors.
 * Runs whenever Supabase is configured so optional sign-in (e.g. from Profile in guest mode) still updates session.
 */
export function useAuthBootstrap(): void {
  const setFromSession = useAuthStore((s) => s.setFromSession);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    void supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (mounted) setFromSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setFromSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setFromSession]);
}
