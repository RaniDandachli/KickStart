import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
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

async function runArcadePrizeCreditGrants(): Promise<ArcadeGrantResult> {
  if (ENABLE_BACKEND) {
    return { welcome: 0, daily: 0 };
  }

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

/**
 * Guest mode: welcome credits once per install + daily free credits once per calendar day.
 * With backend on, credits should come from Supabase (signup bonus + cron); this is a no-op client-side.
 * Single-flight so React Strict Mode / parallel callers cannot double-apply.
 */
export function applyArcadePrizeCreditGrants(): Promise<ArcadeGrantResult> {
  if (!grantFlight) {
    grantFlight = runArcadePrizeCreditGrants();
  }
  return grantFlight;
}
