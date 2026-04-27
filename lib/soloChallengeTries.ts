import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { todayYmdLocal } from '@/lib/dailyFreeTournament';
import { getSupabase } from '@/supabase/client';

const PREFIX = '@kickclash/solo_challenge_tries_v1';

/** Max runs per challenge per local calendar day (must match `solo_challenge_consume_try` migration). */
export const SOLO_CHALLENGE_MAX_TRIES_PER_DAY = 50;

/**
 * Challenge ids enforced in Postgres `solo_challenge_consume_try` allowlist — keep in sync with migrations.
 * Other ids use device-only AsyncStorage until a migration adds them.
 */
export const BACKEND_SOLO_CHALLENGE_IDS = new Set<string>(['tap_dash_100', 'money_tapdash_hot']);

function keyFor(challengeId: string, dayKey: string): string {
  return `${PREFIX}/${encodeURIComponent(dayKey)}/${encodeURIComponent(challengeId)}`;
}

async function readLocalTries(challengeId: string, day: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(challengeId, day));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function getSessionUserId(): Promise<string | null> {
  if (!ENABLE_BACKEND) return null;
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

function shouldUseBackendRpc(challengeId: string, userId: string | null): boolean {
  return Boolean(userId && BACKEND_SOLO_CHALLENGE_IDS.has(challengeId));
}

/** Tries used today for this challenge — server count when signed in + allowlisted; otherwise local only. */
export async function getSoloTriesUsedToday(challengeId: string): Promise<number> {
  const day = todayYmdLocal();
  const userId = await getSessionUserId();

  if (shouldUseBackendRpc(challengeId, userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('solo_challenge_daily_attempts')
        .select('attempts')
        .eq('user_id', userId!)
        .eq('challenge_id', challengeId)
        .eq('calendar_day', day)
        .maybeSingle();

      if (error) throw error;
      const n = data?.attempts;
      if (typeof n === 'number' && n >= 0) {
        return Math.min(n, SOLO_CHALLENGE_MAX_TRIES_PER_DAY);
      }
      return 0;
    } catch {
      // Table missing, offline, etc. — fall back so the screen still works.
    }
  }

  return readLocalTries(challengeId, day);
}

type RpcConsumePayload = {
  ok?: boolean;
  error?: string;
  attempts_after?: number;
  max_attempts?: number;
};

export async function tryConsumeSoloChallengeTry(
  challengeId: string,
): Promise<
  | { ok: true; usedAfter: number }
  | { ok: false; used: number; rpcFailed?: boolean; requiresWalletUnlock?: boolean }
> {
  const day = todayYmdLocal();
  const userId = await getSessionUserId();

  if (shouldUseBackendRpc(challengeId, userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('solo_challenge_consume_try', {
        p_challenge_id: challengeId,
        p_calendar_day: day,
      });

      if (error) throw error;

      const payload = data as RpcConsumePayload;
      const used =
        typeof payload.attempts_after === 'number' && payload.attempts_after >= 0
          ? payload.attempts_after
          : await readLocalTries(challengeId, day);

      if (payload.ok === true && typeof payload.attempts_after === 'number') {
        return { ok: true, usedAfter: payload.attempts_after };
      }

      if (payload.error === 'payment_required') {
        return { ok: false, used, requiresWalletUnlock: true };
      }

      return { ok: false, used };
    } catch {
      const used = await readLocalTries(challengeId, day);
      return { ok: false, used, rpcFailed: true };
    }
  }

  const used = await readLocalTries(challengeId, day);
  if (used >= SOLO_CHALLENGE_MAX_TRIES_PER_DAY) {
    return { ok: false, used };
  }
  const next = used + 1;
  await AsyncStorage.setItem(keyFor(challengeId, day), String(next));
  return { ok: true, usedAfter: next };
}
