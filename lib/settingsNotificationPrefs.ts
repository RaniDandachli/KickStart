import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kc_settings_notification_prefs_v4';

export type NotificationPrefs = {
  matchInvites: boolean;
  /** Tournament of the Day is live — daily reminder */
  tournamentUpdates: boolean;
  /** 100 daily Arcade Credits (grant + messaging) */
  dailyCredits: boolean;
  /** When someone is waiting in the H2H queue and your tier/game filters match (server cron + Expo). */
  openMatchAlerts: boolean;
  /**
   * Entry fee tiers (cents) to watch when `openMatchAlerts` is on.
   * Empty array = notify for any entry fee (see `h2hOpenMatchWatchScan`).
   */
  openMatchWatchEntryCents: number[];
  /**
   * Minigame keys to watch; `null` = any game. Empty array is treated like any game on save.
   */
  openMatchWatchGameKeys: string[] | null;
};

const DEFAULTS: NotificationPrefs = {
  matchInvites: true,
  tournamentUpdates: true,
  dailyCredits: true,
  openMatchAlerts: false,
  openMatchWatchEntryCents: [],
  openMatchWatchGameKeys: null,
};

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      const legacyV3 = await AsyncStorage.getItem('kc_settings_notification_prefs_v3');
      if (legacyV3) {
        try {
          const j = JSON.parse(legacyV3) as Partial<NotificationPrefs>;
          const merged: NotificationPrefs = {
            matchInvites: typeof j.matchInvites === 'boolean' ? j.matchInvites : DEFAULTS.matchInvites,
            tournamentUpdates:
              typeof j.tournamentUpdates === 'boolean' ? j.tournamentUpdates : DEFAULTS.tournamentUpdates,
            dailyCredits: typeof j.dailyCredits === 'boolean' ? j.dailyCredits : DEFAULTS.dailyCredits,
            openMatchAlerts: typeof j.openMatchAlerts === 'boolean' ? j.openMatchAlerts : DEFAULTS.openMatchAlerts,
            openMatchWatchEntryCents: normalizeEntryCents(j.openMatchWatchEntryCents),
            openMatchWatchGameKeys: normalizeGameKeys(j.openMatchWatchGameKeys),
          };
          await AsyncStorage.setItem(KEY, JSON.stringify(merged));
          await AsyncStorage.removeItem('kc_settings_notification_prefs_v3');
          return merged;
        } catch {
          /* fall through */
        }
      }
      const legacyV2 = await AsyncStorage.getItem('kc_settings_notification_prefs_v2');
      if (legacyV2) {
        try {
          const j = JSON.parse(legacyV2) as Partial<NotificationPrefs>;
          const merged: NotificationPrefs = {
            matchInvites: typeof j.matchInvites === 'boolean' ? j.matchInvites : DEFAULTS.matchInvites,
            tournamentUpdates:
              typeof j.tournamentUpdates === 'boolean' ? j.tournamentUpdates : DEFAULTS.tournamentUpdates,
            dailyCredits: typeof j.dailyCredits === 'boolean' ? j.dailyCredits : DEFAULTS.dailyCredits,
            openMatchAlerts:
              typeof j.openMatchAlerts === 'boolean' ? j.openMatchAlerts : DEFAULTS.openMatchAlerts,
            openMatchWatchEntryCents: DEFAULTS.openMatchWatchEntryCents,
            openMatchWatchGameKeys: DEFAULTS.openMatchWatchGameKeys,
          };
          await AsyncStorage.setItem(KEY, JSON.stringify(merged));
          await AsyncStorage.removeItem('kc_settings_notification_prefs_v2');
          return merged;
        } catch {
          /* fall through */
        }
      }
      const legacy = await AsyncStorage.getItem('kc_settings_notification_prefs_v1');
      if (legacy) {
        try {
          const j = JSON.parse(legacy) as Partial<NotificationPrefs>;
          const merged: NotificationPrefs = {
            matchInvites: typeof j.matchInvites === 'boolean' ? j.matchInvites : DEFAULTS.matchInvites,
            tournamentUpdates:
              typeof j.tournamentUpdates === 'boolean' ? j.tournamentUpdates : DEFAULTS.tournamentUpdates,
            dailyCredits: DEFAULTS.dailyCredits,
            openMatchAlerts: DEFAULTS.openMatchAlerts,
            openMatchWatchEntryCents: DEFAULTS.openMatchWatchEntryCents,
            openMatchWatchGameKeys: DEFAULTS.openMatchWatchGameKeys,
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
      openMatchAlerts: typeof j.openMatchAlerts === 'boolean' ? j.openMatchAlerts : DEFAULTS.openMatchAlerts,
      openMatchWatchEntryCents: normalizeEntryCents(j.openMatchWatchEntryCents),
      openMatchWatchGameKeys: normalizeGameKeys(j.openMatchWatchGameKeys),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function normalizeEntryCents(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Math.max(0, Math.floor(Number(x)))).filter((n) => !Number.isNaN(n));
}

function normalizeGameKeys(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const keys = raw.map((x) => String(x).trim()).filter((s) => s.length > 0);
  return keys.length > 0 ? keys : null;
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
