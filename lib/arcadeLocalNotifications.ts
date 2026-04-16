import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { isRemotePushPreferred } from '@/lib/expoPushRegistration';
import { loadNotificationPrefs } from '@/lib/settingsNotificationPrefs';

const ANDROID_CHANNEL = 'arcade-rewards';

const ID_TOURNAMENT = 'arcade-schedule-tournament-of-day';

/** 10:00 local — daily nudge for the free tournament. */
const TOURNAMENT_HOUR = 10;
const TOURNAMENT_MINUTE = 0;

export function configureArcadeNotificationBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Rewards & events',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#FF006E',
  });
}

/** Same channel as tournament / daily locals — use before immediate match-found notifications on Android. */
export async function ensureArcadeAndroidNotificationChannel(): Promise<void> {
  await ensureAndroidChannel();
}

function androidChannelExtras(): { channelId: string } | Record<string, never> {
  return Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {};
}

/**
 * Cancels our recurring tournament reminder and re-schedules from prefs + permission.
 * Call after settings change or when the signed-in area mounts (not on web).
 */
export async function refreshArcadeScheduledNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await ensureAndroidChannel();
  await Notifications.cancelScheduledNotificationAsync(ID_TOURNAMENT).catch(() => {});

  if (await isRemotePushPreferred()) return;

  const prefs = await loadNotificationPrefs();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' || !prefs.tournamentUpdates) return;

  await Notifications.scheduleNotificationAsync({
    identifier: ID_TOURNAMENT,
    content: {
      title: 'Tournament of the Day is live',
      body: 'Free to enter — jump in now and chase the top of the board.',
      data: { href: '/(app)/(tabs)/tournaments/daily-free' },
      ...androidChannelExtras(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: TOURNAMENT_HOUR,
      minute: TOURNAMENT_MINUTE,
    },
  });
}

/**
 * OS prompt + reschedule. Safe to call on app entry.
 */
export async function ensureArcadeNotificationPermissionAndSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  await ensureAndroidChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

/**
 * Fires when daily credits were just granted (backend RPC or guest local grant).
 */
export async function presentDailyCreditsGrantedIfEnabled(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await isRemotePushPreferred()) return;
  await ensureAndroidChannel();
  const prefs = await loadNotificationPrefs();
  if (!prefs.dailyCredits) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '100 Arcade Credits added',
      body: 'They are in your wallet. Open Arcade and play head-to-head or minigames.',
      data: { href: '/(app)/(tabs)/play' },
      ...androidChannelExtras(),
    },
    trigger: null,
  });
}
