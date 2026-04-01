import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { getSupabase } from '@/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';

/** One-time grant when the app is first installed (guest / demo). */
export const WELCOME_PRIZE_CREDITS = 100;
/** Claimed once per calendar day (local time) on first open that day. */
export const DAILY_FREE_PRIZE_CREDITS = 100;

const KEY_WELCOME = '@kickclash/arcade_welcome_credits_v1';
const KEY_DAILY_YMD = '@kickclash/arcade_daily_claim_ymd';

function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type ArcadeGrantResult = { welcome: number; daily: number };

let grantFlight: Promise<ArcadeGrantResult> | null = null;

/** Call on sign-out so the next session can run daily claim again. */
export function resetArcadeGrantFlight(): void {
  grantFlight = null;
}

async function runArcadePrizeCreditGrantsLocal(): Promise<ArcadeGrantResult> {
  let welcome = 0;
  let daily = 0;
  const add = useDemoPrizeCreditsStore.getState().add;

  const wel = await AsyncStorage.getItem(KEY_WELCOME);
  if (wel !== '1') {
    welcome = WELCOME_PRIZE_CREDITS;
    add(welcome);
    await AsyncStorage.setItem(KEY_WELCOME, '1');
  }

  const ymd = todayYmdLocal();
  const last = await AsyncStorage.getItem(KEY_DAILY_YMD);
  if (last !== ymd) {
    daily = DAILY_FREE_PRIZE_CREDITS;
    add(daily);
    await AsyncStorage.setItem(KEY_DAILY_YMD, ymd);
  }

  return { welcome, daily };
}

/** Signup bonus lives in `handle_new_user`; this only runs the daily RPC and refreshes profile cache. */
async function runArcadePrizeCreditGrantsBackend(
  queryClient?: QueryClient
): Promise<ArcadeGrantResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('claim_daily_prize_credits');
  if (error) {
    return { welcome: 0, daily: 0 };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    return { welcome: 0, daily: 0 };
  }
  const daily =
    row.claimed === true
      ? typeof row.amount === 'number'
        ? row.amount
        : DAILY_FREE_PRIZE_CREDITS
      : 0;

  const uid = useAuthStore.getState().user?.id;
  if (uid && queryClient) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile(uid) });
  }

  return { welcome: 0, daily };
}

/**
 * Guest mode: welcome credits once per install + daily free credits once per calendar day (AsyncStorage).
 * With backend on: signup bonus is applied in DB (`handle_new_user`); daily claim runs via `claim_daily_prize_credits` RPC.
 * Single-flight so React Strict Mode / parallel callers cannot double-apply.
 */
export function applyArcadePrizeCreditGrants(queryClient?: QueryClient): Promise<ArcadeGrantResult> {
  if (!grantFlight) {
    grantFlight = ENABLE_BACKEND
      ? runArcadePrizeCreditGrantsBackend(queryClient)
      : runArcadePrizeCreditGrantsLocal();
  }
  return grantFlight;
}
