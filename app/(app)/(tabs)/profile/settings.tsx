import { useRouter } from 'expo-router';
import { Linking, Switch, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { refreshArcadeScheduledNotifications } from '@/lib/arcadeLocalNotifications';
import { supportContactHref } from '@/lib/env';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { loadNotificationPrefs, saveNotificationPrefs } from '@/lib/settingsNotificationPrefs';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const [pushMatch, setPushMatch] = useState(true);
  const [pushTournament, setPushTournament] = useState(true);
  const [pushDailyCredits, setPushDailyCredits] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void loadNotificationPrefs().then((p) => {
      if (cancelled) return;
      setPushMatch(p.matchInvites);
      setPushTournament(p.tournamentUpdates);
      setPushDailyCredits(p.dailyCredits);
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
    }).then(async () => {
      if (uid && ENABLE_BACKEND) {
        await registerExpoPushWithSupabase(uid);
      }
      void refreshArcadeScheduledNotifications();
    });
  }, [prefsReady, pushMatch, pushTournament, pushDailyCredits, uid]);

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Settings</Text>
      <Card className="mb-4">
        <Text className="mb-3 font-semibold text-slate-900">Notifications</Text>
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
        <Text className="mt-2 text-xs text-slate-400">
          Saved on this device and synced to your account when signed in (for server push). With backend on, tournament
          nudges are sent via push on a schedule you set in Supabase Cron; daily credits fire after your UTC-day claim.
          Without a token, the app falls back to local reminders at 10:00 local. Allow notifications in system settings.
        </Text>
      </Card>
      <Card className="mb-4">
        <Text className="mb-2 font-semibold text-slate-900">Prize shipping</Text>
        <Text className="mb-3 text-sm text-slate-500">
          Physical prizes ship to the address you save. You can also add it when you redeem.
        </Text>
        <AppButton
          title="Shipping address"
          variant="secondary"
          onPress={() => router.push('/(app)/(tabs)/profile/shipping-address')}
        />
      </Card>
      <AppButton title="Dispute a match" variant="secondary" onPress={() => router.push('/(app)/(tabs)/profile/dispute')} />
      <AppButton className="mt-2" title="Legal" variant="ghost" onPress={() => router.push('/(app)/(tabs)/profile/legal')} />
      <AppButton
        className="mt-2"
        title="Support"
        variant="ghost"
        onPress={() => {
          const href = supportContactHref();
          if (href) {
            void Linking.openURL(href);
            return;
          }
          router.push('/(app)/(tabs)/profile/support');
        }}
      />
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
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-slate-900">{label}</Text>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} />
    </View>
  );
}
