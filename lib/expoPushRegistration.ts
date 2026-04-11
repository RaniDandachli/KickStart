import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { env } from '@/lib/env';
import { loadNotificationPrefs } from '@/lib/settingsNotificationPrefs';
import { getSupabase } from '@/supabase/client';

const KEY_REMOTE_ACTIVE = 'kc_remote_push_active';

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
 * Registers Expo push token + syncs notification toggles to `profiles` (for Edge targeting).
 * Clears token on device when permission denied or project id missing.
 */
export async function registerExpoPushWithSupabase(uid: string): Promise<void> {
  if (!ENABLE_BACKEND || Platform.OS === 'web') return;

  const prefs = await loadNotificationPrefs();
  const prefsPatch = {
    push_notify_match_invites: prefs.matchInvites,
    push_notify_tournament_of_day: prefs.tournamentUpdates,
    push_notify_daily_credits: prefs.dailyCredits,
  };

  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

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
