import { useEffect, useRef } from 'react';

import { updateProfileFields } from '@/services/api/profiles';
import { getSupabase } from '@/supabase/client';
import type { User } from '@supabase/supabase-js';

function normalizeCountryMeta(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(u) ? u : null;
}

/**
 * When email confirmation is required, signup stores `country_code` on user_metadata only.
 * After first verified sign-in, copy it onto `profiles.country_code` if still unset.
 */
export function useSyncSignupCountry(user: User | null): void {
  const attemptedForUser = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      attemptedForUser.current = null;
      return;
    }

    const fromMeta = normalizeCountryMeta(user.user_metadata?.country_code);
    if (!fromMeta) return;

    if (attemptedForUser.current === uid) return;
    attemptedForUser.current = uid;

    void (async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('profiles').select('country_code').eq('id', uid).maybeSingle();

      if (error || data == null) {
        attemptedForUser.current = null;
        return;
      }
      if (data.country_code) return;

      try {
        await updateProfileFields(uid, { country_code: fromMeta });
      } catch {
        attemptedForUser.current = null;
      }
    })();
  }, [user?.id, user?.user_metadata]);
}
