import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { refreshArcadeScheduledNotifications } from '@/lib/arcadeLocalNotifications';
import { supportContactHref } from '@/lib/env';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { isWebPushConfigured, registerWebPushForUser, unregisterWebPushForUser } from '@/lib/webPushRegister';
import { loadNotificationPrefs, saveNotificationPrefs } from '@/lib/settingsNotificationPrefs';
import { runit } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const [pushMatch, setPushMatch] = useState(true);
  const [pushTournament, setPushTournament] = useState(true);
  const [pushDailyCredits, setPushDailyCredits] = useState(true);
  const [pushOpenMatches, setPushOpenMatches] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void loadNotificationPrefs().then((p) => {
      if (cancelled) return;
      setPushMatch(p.matchInvites);
      setPushTournament(p.tournamentUpdates);
      setPushDailyCredits(p.dailyCredits);
      setPushOpenMatches(p.openMatchAlerts);
      setPrefsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    void saveNotificationPrefs({
      matchInvites: pushMatch,
      tournamentUpdates: pushTournament,
      dailyCredits: pushDailyCredits,
      openMatchAlerts: pushOpenMatches,
    }).then(async () => {
      if (uid && ENABLE_BACKEND) {
        await registerExpoPushWithSupabase(uid);
        if (Platform.OS === 'web') {
          if (pushOpenMatches && isWebPushConfigured()) {
            await registerWebPushForUser();
          } else if (!pushOpenMatches) {
            await unregisterWebPushForUser();
          }
        }
      }
      void refreshArcadeScheduledNotifications();
    });
  }, [prefsReady, pushMatch, pushTournament, pushDailyCredits, pushOpenMatches, uid]);

  return (
    <Screen>
      <Text style={styles.screenTitle}>Settings</Text>
      <Text style={styles.screenSub}>Notifications, shipping, and support</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SafeIonicons name="notifications-outline" size={22} color={runit.neonCyan} />
          <Text style={styles.cardTitle}>Notifications</Text>
        </View>
        <RowToggle label="Match invites" value={pushMatch} disabled={!prefsReady} onValueChange={setPushMatch} />
        <RowToggle
          label="Tournament of the Day"
          value={pushTournament}
          disabled={!prefsReady}
          onValueChange={setPushTournament}
        />
        <RowToggle
          label="Daily Arcade Credits"
          value={pushDailyCredits}
          disabled={!prefsReady}
          onValueChange={setPushDailyCredits}
        />
        <RowToggle
          label="Open match alerts"
          value={pushOpenMatches}
          disabled={!prefsReady}
          onValueChange={setPushOpenMatches}
        />
        <Text style={styles.helpText}>
          Preferences are saved on this device and on your account when you&apos;re signed in. Tournament reminders follow the schedule the
          operator sets; daily credit reminders fire after you claim for the day. Open match alerts notify you when someone is waiting in
          queue for a contest that matches your filters (default: any tier and game). Allow notifications so these and &quot;match
          found&quot; pings (from Keep my spot in queue on the match screen) can reach you. If push isn&apos;t available, the app may use a
          local reminder around 10:00. You can change alerts anytime in system notification settings.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SafeIonicons name="cube-outline" size={22} color={runit.neonCyan} />
          <Text style={styles.cardTitle}>Prize shipping</Text>
        </View>
        <Text style={styles.bodyText}>Physical prizes ship to the address you save. You can also add it when you redeem.</Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryLink, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/shipping-address')}
        >
          <Text style={styles.primaryLinkText}>Shipping address</Text>
          <SafeIonicons name="chevron-forward" size={20} color={runit.neonCyan} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitleOnly}>More</Text>
        <Pressable
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/marketing')}
        >
          <SafeIonicons name="megaphone-outline" size={22} color="#bef264" />
          <Text style={styles.listRowLabel}>Marketing (internal)</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/dispute')}
        >
          <SafeIonicons name="shield-outline" size={22} color="#e2e8f0" />
          <Text style={styles.listRowLabel}>Dispute a match</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/legal')}
        >
          <SafeIonicons name="document-text-outline" size={22} color="#e2e8f0" />
          <Text style={styles.listRowLabel}>Legal</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.listRow, styles.listRowLast, pressed && styles.pressed]}
          onPress={() => {
            const href = supportContactHref();
            if (href) {
              void Linking.openURL(href);
              return;
            }
            router.push('/(app)/(tabs)/profile/support');
          }}
        >
          <SafeIonicons name="help-circle-outline" size={22} color="#e2e8f0" />
          <Text style={styles.listRowLabel}>Support</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
      </View>
    </Screen>
  );
}

function RowToggle({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: 'rgba(167,139,250,0.9)' }}
        thumbColor={value ? '#f8fafc' : '#94a3b8'}
        ios_backgroundColor="rgba(255,255,255,0.2)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
  },
  screenSub: {
    color: 'rgba(203,213,225,0.9)',
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 237, 0.4)',
    backgroundColor: 'rgba(12, 6, 22, 0.88)',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  cardTitleOnly: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  toggleLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  helpText: {
    marginTop: 12,
    color: 'rgba(203,213,225,0.88)',
    fontSize: 14,
    lineHeight: 21,
  },
  bodyText: {
    color: 'rgba(203,213,225,0.92)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  primaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.45)',
    gap: 8,
  },
  primaryLinkText: {
    color: runit.neonCyan,
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
    minHeight: 54,
  },
  listRowLast: {
    paddingBottom: 4,
  },
  listRowLabel: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
});
