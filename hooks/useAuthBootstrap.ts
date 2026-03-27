import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';

/**
 * Subscribes to Supabase auth and mirrors into Zustand for routing + selectors.
 */
export function useAuthBootstrap(): void {
  const setFromSession = useAuthStore((s) => s.setFromSession);

  useEffect(() => {
    if (!ENABLE_BACKEND) {
      setFromSession(null);
      return;
    }

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
