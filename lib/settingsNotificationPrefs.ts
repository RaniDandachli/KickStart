import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kc_settings_notification_prefs_v2';

export type NotificationPrefs = {
  matchInvites: boolean;
  /** Tournament of the Day is live — daily reminder */
  tournamentUpdates: boolean;
  /** 100 daily Arcade Credits (grant + messaging) */
  dailyCredits: boolean;
};

const DEFAULTS: NotificationPrefs = {
  matchInvites: true,
  tournamentUpdates: true,
  dailyCredits: true,
};

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      const legacy = await AsyncStorage.getItem('kc_settings_notification_prefs_v1');
      if (legacy) {
        try {
          const j = JSON.parse(legacy) as Partial<NotificationPrefs>;
          const merged: NotificationPrefs = {
            matchInvites: typeof j.matchInvites === 'boolean' ? j.matchInvites : DEFAULTS.matchInvites,
            tournamentUpdates:
              typeof j.tournamentUpdates === 'boolean' ? j.tournamentUpdates : DEFAULTS.tournamentUpdates,
            dailyCredits: DEFAULTS.dailyCredits,
          };
          await AsyncStorage.setItem(KEY, JSON.stringify(merged));
          await AsyncStorage.removeItem('kc_settings_notification_prefs_v1');
          return merged;
        } catch {
          /* fall through */
        }
      }
      return { ...DEFAULTS };
    }
    const j = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      matchInvites: typeof j.matchInvites === 'boolean' ? j.matchInvites : DEFAULTS.matchInvites,
      tournamentUpdates: typeof j.tournamentUpdates === 'boolean' ? j.tournamentUpdates : DEFAULTS.tournamentUpdates,
      dailyCredits: typeof j.dailyCredits === 'boolean' ? j.dailyCredits : DEFAULTS.dailyCredits,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
