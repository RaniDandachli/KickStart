import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { env } from '@/lib/env';
import type { H2hOpenSlotWatchPayload } from '@/lib/h2hOpenSlotWatch';
import { loadNotificationPrefs } from '@/lib/settingsNotificationPrefs';
import { getSupabase } from '@/supabase/client';

const KEY_REMOTE_ACTIVE = 'kc_remote_push_active';

function normalizeWatchEntryCents(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Math.max(0, Math.floor(Number(x)))).filter((n) => !Number.isNaN(n));
}

function normalizeWatchGameKeys(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const keys = raw.map((x) => String(x).trim()).filter((s) => s.length > 0);
  return keys.length > 0 ? keys : null;
}

export type { H2hOpenSlotWatchPayload } from '@/lib/h2hOpenSlotWatch';

export type RegisterExpoPushOpts = {
  /**
   * When set, overrides Settings-derived values for `push_notify_h2h_open_slots` and `h2h_open_slot_watch`
   * (e.g. queue screen narrows tiers / game). Pass `null` to mean “use Settings prefs” explicitly.
   */
  openSlotWatch?: H2hOpenSlotWatchPayload | null;
};

export async function isRemotePushPreferred(): Promise<boolean> {
  if (!ENABLE_BACKEND) return false;
  const v = await AsyncStorage.getItem(KEY_REMOTE_ACTIVE);
  return v === '1';
}

export function clearRemotePushLocalFlag(): void {
  void AsyncStorage.removeItem(KEY_REMOTE_ACTIVE);
}

async function setRemotePushLocalFlag(active: boolean): Promise<void> {
  if (active) await AsyncStorage.setItem(KEY_REMOTE_ACTIVE, '1');
  else await AsyncStorage.removeItem(KEY_REMOTE_ACTIVE);
}

function resolveExpoProjectId(): string | null {
  const fromEnv = env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const eas = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof eas === 'string' && eas.trim() ? eas.trim() : null;
}

/**
 * Syncs notification toggles + optional Expo push token to `profiles` (for Edge push targeting).
 * On **web**, updates profile fields only (no Expo device token) so queue watch prefs still save for mobile.
 */
export async function registerExpoPushWithSupabase(uid: string, opts?: RegisterExpoPushOpts): Promise<void> {
  if (!ENABLE_BACKEND) return;

  const prefs = await loadNotificationPrefs();
  const override = opts?.openSlotWatch;

  let pushOpenSlots: boolean;
  let h2hWatch: { enabled: boolean; entryCents: number[]; gameKeys: string[] | null };

  if (override != null) {
    pushOpenSlots = override.enabled;
    h2hWatch = {
      enabled: override.enabled,
      entryCents: Array.isArray(override.entryCents)
        ? override.entryCents.map((x) => Math.max(0, Math.floor(Number(x))))
        : [],
      gameKeys: override.gameKeys,
    };
  } else {
    pushOpenSlots = prefs.openMatchAlerts;
    const entryCents = normalizeWatchEntryCents(prefs.openMatchWatchEntryCents);
    const gameKeys = normalizeWatchGameKeys(prefs.openMatchWatchGameKeys);
    h2hWatch = prefs.openMatchAlerts
      ? { enabled: true, entryCents, gameKeys }
      : { enabled: false, entryCents: [] as number[], gameKeys: null as string[] | null };
  }

  const prefsPatch = {
    push_notify_match_invites: prefs.matchInvites,
    push_notify_tournament_of_day: prefs.tournamentUpdates,
    push_notify_daily_credits: prefs.dailyCredits,
    push_notify_h2h_open_slots: pushOpenSlots,
    h2h_open_slot_watch: h2hWatch,
  };

  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  if (Platform.OS === 'web') {
    const { error } = await supabase.from('profiles').update({ ...prefsPatch }).eq('id', uid);
    if (error) console.warn('[expoPush] web profile sync failed', error.message);
    return;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await supabase
      .from('profiles')
      .update({
        ...prefsPatch,
        expo_push_token: null,
        expo_push_token_updated_at: nowIso,
      })
      .eq('id', uid);
    await setRemotePushLocalFlag(false);
    return;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    console.warn(
      '[expoPush] Set EXPO_PUBLIC_EXPO_PROJECT_ID or expo.extra.eas.projectId so push tokens can be issued.',
    );
    await supabase
      .from('profiles')
      .update({
        ...prefsPatch,
        expo_push_token: null,
        expo_push_token_updated_at: nowIso,
      })
      .eq('id', uid);
    await setRemotePushLocalFlag(false);
    return;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = data?.trim() ?? '';
    const { error } = await supabase
      .from('profiles')
      .update({
        ...prefsPatch,
        expo_push_token: token || null,
        expo_push_token_updated_at: nowIso,
      })
      .eq('id', uid);
    if (error) throw error;
    await setRemotePushLocalFlag(token.length > 0);
  } catch (e) {
    console.warn('[expoPush] register failed', e instanceof Error ? e.message : e);
    await setRemotePushLocalFlag(false);
  }
}

export async function clearExpoPushTokenOnSupabase(uid: string): Promise<void> {
  try {
    await getSupabase()
      .from('profiles')
      .update({
        expo_push_token: null,
        expo_push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', uid);
  } catch {
    /* ignore */
  }
  await setRemotePushLocalFlag(false);
}
